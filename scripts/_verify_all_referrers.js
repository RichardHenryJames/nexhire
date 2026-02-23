const sql = require('mssql');

(async () => {
  const pool = await sql.connect({
    server: 'refopen-sqlserver-ci.database.windows.net',
    database: 'refopen-sql-db',
    user: 'sqladmin',
    password: 'SecureRef2026#Prod!Kv',
    options: { encrypt: true, trustServerCertificate: false }
  });

  // Find all users with current job, not yet verified, excluding test users (phone=0000000000)
  const r = await pool.request().query(`
    SELECT u.UserID, u.FirstName, u.LastName, u.Email,
           we.WorkExperienceID, we.CompanyName, we.OrganizationID
    FROM Users u
    JOIN Applicants a ON u.UserID = a.UserID
    JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
    WHERE we.IsCurrent = 1
      AND we.EndDate IS NULL
      AND u.IsVerifiedReferrer = 0
      AND we.CompanyName IS NOT NULL
      AND u.Phone != '0000000000'
    ORDER BY we.CompanyName
  `);

  console.log('Users to verify:', r.recordset.length);

  for (const row of r.recordset) {
    // 1. Mark user as verified referrer
    await pool.request()
      .input('uid', sql.UniqueIdentifier, row.UserID)
      .query('UPDATE Users SET IsVerifiedReferrer = 1, UpdatedAt = GETUTCDATE() WHERE UserID = @uid');

    // 2. Mark work experience as verified
    await pool.request()
      .input('weid', sql.UniqueIdentifier, row.WorkExperienceID)
      .query(`UPDATE WorkExperiences 
              SET VerificationStatus = 1, VerifiedAt = GETUTCDATE(), 
                  CompanyEmailVerified = 1, CompanyEmailVerifiedAt = GETUTCDATE() 
              WHERE WorkExperienceID = @weid`);

    // 3. Increment org verified referrers count
    if (row.OrganizationID) {
      await pool.request()
        .input('oid', sql.Int, row.OrganizationID)
        .query('UPDATE Organizations SET VerifiedReferrersCount = VerifiedReferrersCount + 1, UpdatedAt = GETUTCDATE() WHERE OrganizationID = @oid');
    }

    console.log(`  ✅ ${row.FirstName} ${row.LastName} @ ${row.CompanyName}` +
      (row.OrganizationID ? ` (OrgID: ${row.OrganizationID})` : ' (no org link)'));
  }

  console.log('\n🎉 Done! All verified.');
  await pool.close();
})().catch(e => console.error('Error:', e.message));
