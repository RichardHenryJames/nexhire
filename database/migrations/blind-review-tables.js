/**
 * Blind Review - Database Migration
 * 
 * Creates:
 * 1. BlindReviewRequests - Applicant submits profile for anonymous review
 * 2. BlindReviewResponses - Referrer's feedback on anonymized profile
 * 3. BlindReviewUsage - Track free/paid usage per user
 * 4. PricingSettings entries for BLIND_REVIEW_FREE_USES + BLIND_REVIEW_COST
 */

const sql = require('mssql');

(async () => {
  const pool = await sql.connect({
    server: 'refopen-sqlserver-ci.database.windows.net',
    database: 'refopen-sql-db',
    user: 'sqladmin',
    password: 'SecureRef2026#Prod!Kv',
    options: { encrypt: true, trustServerCertificate: false, requestTimeout: 120000 }
  });

  // ── 1. BlindReviewRequests ───────────────────────────────────
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BlindReviewRequests')
    BEGIN
      CREATE TABLE BlindReviewRequests (
        RequestID         UNIQUEIDENTIFIER NOT NULL DEFAULT newid() PRIMARY KEY,
        ApplicantID       UNIQUEIDENTIFIER NOT NULL,              -- FK → Applicants.ApplicantID
        UserID            UNIQUEIDENTIFIER NOT NULL,              -- FK → Users.UserID
        OrganizationID    INT              NOT NULL,              -- FK → Organizations.OrganizationID (target company)
        TargetRole        NVARCHAR(200)    NOT NULL,              -- Role they want reviewed for
        SourceType        NVARCHAR(20)     NOT NULL DEFAULT 'resume', -- 'resume' or 'profile'
        ResumeID          UNIQUEIDENTIFIER NULL,                  -- FK → ApplicantResumes.ResumeID (if source=resume)
        AnonymizedProfile NVARCHAR(MAX)    NULL,                  -- JSON: anonymized profile card
        AIScore           INT              NULL,                  -- 0-100 preliminary AI referrability score
        AIAnalysis        NVARCHAR(MAX)    NULL,                  -- JSON: AI strengths/weaknesses/flags
        Status            NVARCHAR(30)     NOT NULL DEFAULT 'pending', -- pending, in_review, completed, expired, cancelled
        ResponseCount     INT              NOT NULL DEFAULT 0,    -- How many referrers responded
        FinalScore        INT              NULL,                  -- Aggregated score after human reviews
        FinalFeedback     NVARCHAR(MAX)    NULL,                  -- JSON: AI-aggregated summary of all responses
        WasFree           BIT              NOT NULL DEFAULT 0,    -- Was this a free-tier use?
        ExpiresAt         DATETIME2        NOT NULL,              -- 72h TTL for pending requests
        CreatedAt         DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt         DATETIME2        NOT NULL DEFAULT GETUTCDATE()
      );
      
      CREATE INDEX IX_BlindReviewRequests_UserID ON BlindReviewRequests(UserID);
      CREATE INDEX IX_BlindReviewRequests_OrganizationID ON BlindReviewRequests(OrganizationID);
      CREATE INDEX IX_BlindReviewRequests_Status ON BlindReviewRequests(Status);
      CREATE INDEX IX_BlindReviewRequests_ExpiresAt ON BlindReviewRequests(ExpiresAt) WHERE Status = 'pending';
      
      PRINT 'Created BlindReviewRequests table';
    END
    ELSE PRINT 'BlindReviewRequests already exists';
  `);

  // ── 2. BlindReviewResponses ──────────────────────────────────
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BlindReviewResponses')
    BEGIN
      CREATE TABLE BlindReviewResponses (
        ResponseID        UNIQUEIDENTIFIER NOT NULL DEFAULT newid() PRIMARY KEY,
        RequestID         UNIQUEIDENTIFIER NOT NULL,              -- FK → BlindReviewRequests.RequestID
        ReviewerID        UNIQUEIDENTIFIER NOT NULL,              -- FK → Users.UserID (the referrer)
        WouldRefer        BIT              NOT NULL,              -- Would you refer this person? yes/no
        OverallRating     INT              NOT NULL,              -- 1-5 stars
        StrengthsFeedback NVARCHAR(2000)   NULL,                  -- Free-text: what's strong
        WeaknessesFeedback NVARCHAR(2000)  NULL,                  -- Free-text: what needs improvement
        Suggestions       NVARCHAR(2000)   NULL,                  -- Free-text: actionable advice
        ProfileFit        INT              NULL,                  -- 1-5: how well does profile fit the role?
        CreatedAt         DATETIME2        NOT NULL DEFAULT GETUTCDATE()
      );
      
      CREATE INDEX IX_BlindReviewResponses_RequestID ON BlindReviewResponses(RequestID);
      CREATE INDEX IX_BlindReviewResponses_ReviewerID ON BlindReviewResponses(ReviewerID);
      CREATE UNIQUE INDEX UQ_BlindReviewResponses_Request_Reviewer ON BlindReviewResponses(RequestID, ReviewerID);
      
      PRINT 'Created BlindReviewResponses table';
    END
    ELSE PRINT 'BlindReviewResponses already exists';
  `);

  // ── 3. BlindReviewUsage ──────────────────────────────────────
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BlindReviewUsage')
    BEGIN
      CREATE TABLE BlindReviewUsage (
        ID                INT              IDENTITY(1,1) PRIMARY KEY,
        UserID            UNIQUEIDENTIFIER NOT NULL,
        RequestID         UNIQUEIDENTIFIER NULL,                  -- FK → BlindReviewRequests.RequestID
        OrganizationID    INT              NULL,
        AIScore           INT              NULL,
        ElapsedMs         INT              NULL DEFAULT 0,
        CreatedAt         DATETIME2        NOT NULL DEFAULT GETUTCDATE()
      );

      CREATE INDEX IX_BlindReviewUsage_UserID ON BlindReviewUsage(UserID);
      
      PRINT 'Created BlindReviewUsage table';
    END
    ELSE PRINT 'BlindReviewUsage already exists';
  `);

  // ── 4. Pricing settings (SettingID is IDENTITY — don't specify it) ──
  // BLIND_REVIEW_FREE_USES
  const freeExists = await pool.request().query(`SELECT 1 AS ex FROM PricingSettings WHERE SettingKey = 'BLIND_REVIEW_FREE_USES'`);
  if (!freeExists.recordset.length) {
    await pool.request().query(`
      INSERT INTO PricingSettings (SettingKey, SettingValue, Description, IsActive)
      VALUES ('BLIND_REVIEW_FREE_USES', 1, 'Number of free blind reviews per user', 1)
    `);
    console.log('  Inserted BLIND_REVIEW_FREE_USES = 1');
  } else {
    console.log('  BLIND_REVIEW_FREE_USES already exists');
  }

  // BLIND_REVIEW_COST
  const costExists = await pool.request().query(`SELECT 1 AS ex FROM PricingSettings WHERE SettingKey = 'BLIND_REVIEW_COST'`);
  if (!costExists.recordset.length) {
    await pool.request().query(`
      INSERT INTO PricingSettings (SettingKey, SettingValue, Description, IsActive)
      VALUES ('BLIND_REVIEW_COST', 49, 'Cost per blind review in INR (after free uses)', 1)
    `);
    console.log('  Inserted BLIND_REVIEW_COST = 49');
  } else {
    console.log('  BLIND_REVIEW_COST already exists');
  }

  // ── Verify ───────────────────────────────────────────────────
  const tables = ['BlindReviewRequests', 'BlindReviewResponses', 'BlindReviewUsage'];
  for (const t of tables) {
    const cols = await pool.request().query(
      `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}' ORDER BY ORDINAL_POSITION`
    );
    console.log(`\n✅ ${t} (${cols.recordset.length} columns):`);
    cols.recordset.forEach(c => console.log(`   ${c.COLUMN_NAME} (${c.DATA_TYPE})`));
  }

  const pricing = await pool.request().query(
    `SELECT SettingKey, SettingValue FROM PricingSettings WHERE SettingKey LIKE 'BLIND_REVIEW%'`
  );
  console.log('\n✅ Pricing:');
  pricing.recordset.forEach(r => console.log(`   ${r.SettingKey} = ${Number(r.SettingValue)}`));

  await pool.close();
  console.log('\n✅ Migration complete!');
})();
