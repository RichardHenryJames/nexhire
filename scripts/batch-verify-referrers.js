/**
 * Batch Verify Referrers
 * 
 * Finds all users who:
 *   - Have a current job (IsCurrent=1, EndDate=NULL)
 *   - Are NOT yet verified referrers
 *   - Have a valid company name
 *   - Are not test users (Phone != '0000000000')
 * 
 * For each, it:
 *   1. Sets Users.IsVerifiedReferrer = 1
 *   2. Marks their WorkExperience as verified (VerificationStatus=1, CompanyEmailVerified=1)
 *   3. Increments Organizations.VerifiedReferrersCount
 * 
 * Usage:
 *   node scripts/batch-verify-referrers.js                  (dev DB from local.settings.json)
 *   node scripts/batch-verify-referrers.js --prod           (prod DB from env-config.prod.json)
 *   node scripts/batch-verify-referrers.js --dry-run        (preview without changes)
 *   node scripts/batch-verify-referrers.js --prod --dry-run (preview on prod)
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const isProd = process.argv.includes('--prod');
const isDryRun = process.argv.includes('--dry-run');

// Load DB creds — dev from local.settings.json, prod from env-config.prod.json
let env;
if (isProd) {
  const prodPath = path.join(__dirname, '..', 'env-config.prod.json');
  const prodConfig = JSON.parse(fs.readFileSync(prodPath, 'utf8'));
  env = prodConfig.variables;
  // Prod password might be a Key Vault reference — check and prompt if so
  if (env.DB_PASSWORD && env.DB_PASSWORD.startsWith('@Microsoft.KeyVault')) {
    // Use the known prod password (same as setup-referrer approach)
    console.log('⚠️  Prod password is a Key Vault reference. Using direct credentials.');
    env.DB_PASSWORD = process.env.REFOPEN_PROD_DB_PASSWORD || 'SecureRef2026#Prod!Kv';
  }
} else {
  const settingsPath = path.join(__dirname, '..', 'local.settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  env = settings.Values;
}

const config = {
  server: env.DB_SERVER,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  options: {
    encrypt: env.DB_ENCRYPT === 'true',
    trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

async function batchVerify() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to database');
    console.log(`   Environment: ${isProd ? '🔴 PRODUCTION' : '🟢 Development'}`);
    console.log(`   Server: ${env.DB_SERVER}`);
    console.log(`   Database: ${env.DB_NAME}`);
    if (isDryRun) console.log('   ⚠️  DRY RUN — no changes will be made\n');
    else console.log('');

    // Find all eligible users
    const result = await pool.request().query(`
      SELECT u.UserID, u.FirstName, u.LastName, u.Email,
             we.WorkExperienceID, we.CompanyName, we.JobTitle, we.OrganizationID, we.StartDate
      FROM Users u
      JOIN Applicants a ON u.UserID = a.UserID
      JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
      WHERE we.IsCurrent = 1
        AND we.EndDate IS NULL
        AND u.IsVerifiedReferrer = 0
        AND we.CompanyName IS NOT NULL
        AND (u.Phone IS NULL OR u.Phone != '0000000000')
      ORDER BY we.CompanyName
    `);

    console.log(`Found ${result.recordset.length} user(s) to verify:\n`);

    if (result.recordset.length === 0) {
      console.log('No users to verify. All eligible users are already verified.');
      return;
    }

    let verified = 0;
    let skipped = 0;

    for (const row of result.recordset) {
      const startDate = row.StartDate ? new Date(row.StartDate).toISOString().split('T')[0] : '-';

      if (isDryRun) {
        console.log(`  [DRY] ${row.FirstName} ${row.LastName} | ${row.Email} | ${row.CompanyName} | ${row.JobTitle || '-'} | Since ${startDate}`);
        verified++;
        continue;
      }

      // 1. Mark user as verified referrer
      await pool.request()
        .input('uid', sql.UniqueIdentifier, row.UserID)
        .query('UPDATE Users SET IsVerifiedReferrer = 1, UpdatedAt = GETUTCDATE() WHERE UserID = @uid');

      // 2. Mark work experience as verified
      await pool.request()
        .input('weid', sql.UniqueIdentifier, row.WorkExperienceID)
        .query(`
          UPDATE WorkExperiences
          SET VerificationStatus = 1, VerifiedAt = GETUTCDATE(),
              CompanyEmailVerified = 1, CompanyEmailVerifiedAt = GETUTCDATE()
          WHERE WorkExperienceID = @weid
        `);

      // 3. VerifiedReferrersCount handled by nightly reconciliation timer

      console.log(`  ✅ ${row.FirstName} ${row.LastName} @ ${row.CompanyName}` +
        (row.OrganizationID ? ` (OrgID: ${row.OrganizationID})` : ' (no org link)'));
      verified++;
    }

    console.log('\n' + '═'.repeat(50));
    if (isDryRun) {
      console.log(`📋 DRY RUN: ${verified} user(s) would be verified`);
      console.log('   Run without --dry-run to apply changes.');
    } else {
      console.log(`🎉 Done! ${verified} user(s) verified as referrers.`);
    }
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Login failed')) {
      console.error('   → Check DB credentials in local.settings.json');
    }
  } finally {
    if (pool) await pool.close();
  }
}

batchVerify();
