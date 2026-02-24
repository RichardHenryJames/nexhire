const sql = require('mssql');
const config = {
  server: 'refopen-sqlserver-dev.database.windows.net',
  database: 'refopen-sql-db-dev',
  user: 'sqladmin',
  password: 'RefOpenDev@2024!Tle@yTK$',
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 30000 }
};

(async () => {
  const pool = await sql.connect(config);
  
  const r = await pool.request().query(`
    SELECT u.FirstName, u.LastName, u.Phone, u.Email,
           a.Headline, a.CurrentJobTitle, a.CurrentCompanyName, a.CurrentLocation,
           a.LinkedInProfile, a.GithubProfile, a.PortfolioURL,
           a.PrimarySkills, a.SecondarySkills,
           a.Institution, a.HighestEducation, a.FieldOfStudy, a.GraduationYear, a.GPA,
           a.TotalExperienceMonths
    FROM Users u
    JOIN Applicants a ON u.UserID = a.UserID
    WHERE u.Email = 'parimalkumar261@gmail.com'
  `);
  const f = r.recordset[0];
  console.log('👤 ' + f.FirstName + ' ' + f.LastName + ' | ' + f.Phone);
  console.log('💼 ' + f.CurrentJobTitle + ' at ' + f.CurrentCompanyName);
  console.log('📍 ' + f.CurrentLocation);
  console.log('🔗 LinkedIn: ' + f.LinkedInProfile);
  console.log('🔗 GitHub: ' + f.GithubProfile);
  console.log('🌐 Portfolio: ' + f.PortfolioURL);
  console.log('🎓 ' + f.HighestEducation + ' in ' + f.FieldOfStudy + ' — ' + f.Institution + ' (' + f.GraduationYear + ', GPA: ' + f.GPA + ')');
  console.log('🛠️ Primary: ' + f.PrimarySkills);
  console.log('🛠️ Secondary: ' + f.SecondarySkills);
  console.log('📅 Experience: ' + f.TotalExperienceMonths + ' months');
  console.log('📰 Headline: ' + f.Headline);

  const w = await pool.request().query(`
    SELECT w.JobTitle, w.CompanyName, w.StartDate, w.EndDate, w.IsCurrent, w.Location,
           LEFT(CAST(w.Description AS NVARCHAR(MAX)), 80) as DescPreview
    FROM WorkExperiences w
    JOIN Applicants a ON w.ApplicantID = a.ApplicantID
    JOIN Users u ON a.UserID = u.UserID
    WHERE u.Email = 'parimalkumar261@gmail.com' AND w.IsActive = 1
    ORDER BY w.IsCurrent DESC, w.EndDate DESC
  `);
  console.log('\n💼 WORK EXPERIENCES (' + w.recordset.length + '):');
  w.recordset.forEach(x => {
    console.log('  ' + x.JobTitle + ' @ ' + x.CompanyName + ' | ' + x.Location);
    console.log('    ' + (x.IsCurrent ? 'Current' : x.EndDate?.toISOString().split('T')[0]) + ' | ' + x.DescPreview + '...');
  });

  console.log('\n✅ All good! Delete old resume project in UI → Create New → auto-fill will pull all this data.');
  pool.close();
})().catch(e => { console.error(e.message); process.exit(1); });
