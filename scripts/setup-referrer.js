/**
 * Setup rahul@gmail.com as a Verified Referrer for ANY company
 * 
 * What it does:
 *   1. Clears all past work experience for rahul@gmail.com
 *   2. Looks up the company by name (or creates it)
 *   3. Adds a 2y 5m current work experience at that company
 *   4. Updates Applicants table (CurrentOrganizationID, CurrentCompanyName)
 *   5. Marks user as IsVerifiedReferrer = 1
 *   6. Marks the work experience as verified (VerificationStatus=1, CompanyEmailVerified=1)
 *   7. Increments Organizations.VerifiedReferrersCount
 * 
 * Usage:
 *   node scripts/setup-referrer.js "Meesho"
 *   node scripts/setup-referrer.js "Google"
 *   node scripts/setup-referrer.js "Flipkart"
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const REFERRER_EMAIL = 'rahul@gmail.com';

// Load DB creds from local.settings.json (no hardcoding)
const settingsPath = path.join(__dirname, '..', 'local.settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const env = settings.Values;

const config = {
  server: env.DB_SERVER,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  options: { encrypt: env.DB_ENCRYPT === 'true', trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE === 'true' }
};

const companyName = process.argv[2];

if (!companyName) {
  console.log('❌ Usage: node scripts/setup-referrer.js "<CompanyName>"');
  console.log('');
  console.log('   Examples:');
  console.log('     node scripts/setup-referrer.js "Meesho"');
  console.log('     node scripts/setup-referrer.js "Google"');
  console.log('     node scripts/setup-referrer.js "Flipkart"');
  console.log('');
  console.log(`   This will make ${REFERRER_EMAIL} a verified referrer at the given company.`);
  process.exit(1);
}

async function setupReferrer() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to database\n');

    // ─── Step 1: Find the user ─────────────────────────
    const userResult = await pool.request()
      .input('email', sql.NVarChar, REFERRER_EMAIL)
      .query(`SELECT UserID, FirstName, LastName, Email, IsVerifiedReferrer FROM Users WHERE Email = @email`);

    if (userResult.recordset.length === 0) {
      console.log(`❌ User not found: ${REFERRER_EMAIL}`);
      return;
    }

    const user = userResult.recordset[0];
    console.log(`👤 User: ${user.FirstName} ${user.LastName} (${user.Email})`);

    // ─── Step 2: Get or create ApplicantID ─────────────
    let applicantResult = await pool.request()
      .input('userId', sql.UniqueIdentifier, user.UserID)
      .query(`SELECT ApplicantID, CurrentCompanyName, CurrentOrganizationID FROM Applicants WHERE UserID = @userId`);

    let applicantId;
    if (applicantResult.recordset.length === 0) {
      // Create applicant record
      const newApplicant = await pool.request()
        .input('userId', sql.UniqueIdentifier, user.UserID)
        .query(`
          INSERT INTO Applicants (ApplicantID, UserID, OpenToRefer, CreatedAt, UpdatedAt)
          VALUES (NEWID(), @userId, 1, GETUTCDATE(), GETUTCDATE());
          SELECT ApplicantID FROM Applicants WHERE UserID = @userId;
        `);
      applicantId = newApplicant.recordset[0].ApplicantID;
      console.log(`   ✅ Created Applicant record: ${applicantId}`);
    } else {
      applicantId = applicantResult.recordset[0].ApplicantID;
      console.log(`   📋 ApplicantID: ${applicantId}`);
      console.log(`   📋 Previous Company: ${applicantResult.recordset[0].CurrentCompanyName || 'None'}`);
    }

    // ─── Step 3: Look up or create the Organization ────
    let orgResult = await pool.request()
      .input('name', sql.NVarChar, companyName)
      .query(`SELECT OrganizationID, Name, VerifiedReferrersCount FROM Organizations WHERE Name = @name`);

    // Try fuzzy match if exact not found
    if (orgResult.recordset.length === 0) {
      orgResult = await pool.request()
        .input('name', sql.NVarChar, `%${companyName}%`)
        .query(`SELECT TOP 1 OrganizationID, Name, VerifiedReferrersCount FROM Organizations WHERE Name LIKE @name ORDER BY LEN(Name)`);
    }

    let orgId, orgName;
    if (orgResult.recordset.length > 0) {
      orgId = orgResult.recordset[0].OrganizationID;
      orgName = orgResult.recordset[0].Name;
      console.log(`\n🏢 Found Organization: ${orgName} (ID: ${orgId})`);
    } else {
      // Create the organization
      const newOrg = await pool.request()
        .input('name', sql.NVarChar, companyName)
        .query(`
          INSERT INTO Organizations (Name, IsActive, VerifiedReferrersCount, CreatedAt, UpdatedAt)
          VALUES (@name, 1, 0, GETUTCDATE(), GETUTCDATE());
          SELECT OrganizationID, Name FROM Organizations WHERE Name = @name;
        `);
      orgId = newOrg.recordset[0].OrganizationID;
      orgName = newOrg.recordset[0].Name;
      console.log(`\n🏢 Created Organization: ${orgName} (ID: ${orgId})`);
    }

    // ─── Step 4: Clear ALL old work experiences ────────
    const deleteResult = await pool.request()
      .input('applicantId', sql.UniqueIdentifier, applicantId)
      .query(`
        DELETE FROM WorkExperiences WHERE ApplicantID = @applicantId;
        SELECT @@ROWCOUNT AS Deleted;
      `);
    const deletedCount = deleteResult.recordset[0]?.Deleted || 0;
    console.log(`\n🗑️  Cleared ${deletedCount} old work experience(s)`);

    // ─── Step 4b: Clear ALL messages and conversations ─
    const msgResult = await pool.request()
      .input('userId', sql.UniqueIdentifier, user.UserID)
      .query(`
        DELETE FROM Messages WHERE ConversationID IN (
          SELECT ConversationID FROM Conversations WHERE User1ID = @userId OR User2ID = @userId
        );
        SELECT @@ROWCOUNT AS Deleted;
      `);
    const deletedMsgs = msgResult.recordset[0]?.Deleted || 0;

    const convoResult = await pool.request()
      .input('userId', sql.UniqueIdentifier, user.UserID)
      .query(`
        DELETE FROM Conversations WHERE User1ID = @userId OR User2ID = @userId;
        SELECT @@ROWCOUNT AS Deleted;
      `);
    const deletedConvos = convoResult.recordset[0]?.Deleted || 0;
    console.log(`💬 Cleared ${deletedMsgs} message(s) and ${deletedConvos} conversation(s)`);

    // ─── Step 5: Add new work experience (2y 5m, current) ─
    // StartDate = 2y 5m ago from today
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);
    startDate.setMonth(startDate.getMonth() - 5);
    const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD

    await pool.request()
      .input('applicantId', sql.UniqueIdentifier, applicantId)
      .input('orgId', sql.Int, orgId)
      .input('companyName', sql.NVarChar, orgName)
      .input('startDate', sql.Date, startDateStr)
      .query(`
        INSERT INTO WorkExperiences (
          WorkExperienceID, ApplicantID, OrganizationID, CompanyName, JobTitle,
          EmploymentType, StartDate, EndDate, IsCurrent, Location, Country,
          VerificationStatus, VerifiedAt, CompanyEmailVerified, CompanyEmailVerifiedAt,
          CreatedAt, UpdatedAt, IsActive
        )
        VALUES (
          NEWID(), @applicantId, @orgId, @companyName, 'Senior Software Engineer',
          'Full-time', @startDate, NULL, 1, 'Bangalore, India', 'India',
          1, GETUTCDATE(), 1, GETUTCDATE(),
          GETUTCDATE(), GETUTCDATE(), 1
        )
      `);
    console.log(`\n✅ Added work experience:`);
    console.log(`   🏢 ${orgName} — Senior Software Engineer`);
    console.log(`   📅 ${startDateStr} → Present (2y 5m)`);
    console.log(`   ✓  Verified + CompanyEmailVerified`);

    // ─── Step 6: Update Applicants table ───────────────
    await pool.request()
      .input('applicantId', sql.UniqueIdentifier, applicantId)
      .input('orgId', sql.Int, orgId)
      .input('companyName', sql.NVarChar, orgName)
      .query(`
        UPDATE Applicants
        SET CurrentOrganizationID = @orgId,
            CurrentCompanyName = @companyName,
            OpenToRefer = 1,
            UpdatedAt = GETUTCDATE()
        WHERE ApplicantID = @applicantId
      `);
    console.log(`\n✅ Updated Applicants → CurrentCompany: ${orgName}`);

    // ─── Step 7: Mark user as IsVerifiedReferrer ───────
    await pool.request()
      .input('userId', sql.UniqueIdentifier, user.UserID)
      .query(`
        UPDATE Users
        SET IsVerifiedReferrer = 1, UpdatedAt = GETUTCDATE()
        WHERE UserID = @userId
      `);
    console.log(`✅ Users.IsVerifiedReferrer = 1`);

    // ─── Step 8: VerifiedReferrersCount handled by nightly reconciliation timer ─
    console.log(`✅ VerifiedReferrersCount will be updated by nightly timer`);

    // ─── Summary ───────────────────────────────────────
    console.log('\n' + '═'.repeat(50));
    console.log(`🎉 DONE! ${user.FirstName} ${user.LastName} is now a Verified Referrer at ${orgName}`);
    console.log('═'.repeat(50));
    console.log(`\n   Email:   ${user.Email}`);
    console.log(`   Company: ${orgName} (ID: ${orgId})`);
    console.log(`   Role:    Senior Software Engineer`);
    console.log(`   Tenure:  2 years 5 months (current)`);
    console.log(`   Status:  ✓ Verified Referrer`);
    console.log(`\n   To switch to a different company, just run again:`);
    console.log(`   node scripts/setup-referrer.js "NewCompanyName"`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ENETUNREACH') || error.message.includes('ECONNREFUSED')) {
      console.error('   → Make sure you are connected to the internet / VPN');
    }
  } finally {
    if (pool) await pool.close();
  }
}

setupReferrer();
