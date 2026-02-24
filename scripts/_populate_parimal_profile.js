/**
 * Populate realistic profile data for Parimal Kumar in dev DB
 * So resume builder auto-fill can be tested properly
 */
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

  // 1. Find the user
  const userResult = await pool.request().query(`
    SELECT u.UserID, u.FirstName, u.LastName, u.Email, u.Phone,
           a.ApplicantID, a.Headline, a.Summary, a.CurrentLocation, a.LinkedInProfile,
           a.GithubProfile, a.PortfolioURL, a.PrimarySkills, a.SecondarySkills,
           a.Institution, a.HighestEducation, a.FieldOfStudy, a.GraduationYear, a.GPA,
           a.Certifications, a.CurrentJobTitle, a.CurrentCompanyName, a.TotalExperienceMonths
    FROM Users u
    LEFT JOIN Applicants a ON u.UserID = a.UserID
    WHERE u.Email = 'parimalkumar261@gmail.com'
  `);

  if (userResult.recordset.length === 0) {
    console.error('User not found!');
    pool.close();
    return;
  }

  const user = userResult.recordset[0];
  console.log('Found user:', user.UserID);
  console.log('Current data:');
  console.log('  Name:', user.FirstName, user.LastName);
  console.log('  Phone:', user.Phone || '(empty)');
  console.log('  ApplicantID:', user.ApplicantID || '(no applicant record)');
  console.log('  Headline:', user.Headline || '(empty)');
  console.log('  Skills:', user.PrimarySkills?.substring(0, 50) || '(empty)');
  console.log('  Institution:', user.Institution || '(empty)');

  // 2. Update User table
  await pool.request()
    .input('userId', sql.UniqueIdentifier, user.UserID)
    .query(`
      UPDATE Users SET
        Phone = '+91 9876543210',
        UpdatedAt = GETUTCDATE()
      WHERE UserID = @userId
    `);
  console.log('\n✅ Updated Users table (phone)');

  // 3. Update Applicants table with rich profile data
  if (user.ApplicantID) {
    await pool.request()
      .input('appId', sql.UniqueIdentifier, user.ApplicantID)
      .query(`
        UPDATE Applicants SET
          Headline = 'Full-Stack Software Engineer | React Native · Node.js · Azure · AI/ML',
          Summary = 'Results-driven Full-Stack Engineer with 4+ years of experience building scalable web and mobile applications. Specialized in React Native, Node.js, and Azure cloud infrastructure. Led development of RefOpen — a referral-powered job platform serving 10,000+ users with real-time messaging, AI resume analysis, and payment integration. Passionate about building products that solve real problems at scale.',
          CurrentLocation = 'Ranchi, Jharkhand, India',
          LinkedInProfile = 'https://linkedin.com/in/parimalkumar',
          GithubProfile = 'https://github.com/parimalkumar',
          PortfolioURL = 'https://parimalkumar.dev',
          PrimarySkills = '["React Native","Node.js","TypeScript","JavaScript","Azure Functions","SQL Server","React.js","Next.js","Expo","REST APIs"]',
          SecondarySkills = '["Python","Docker","Redis","Git","CI/CD","Tailwind CSS","MongoDB","Firebase","GraphQL","Puppeteer"]',
          Institution = 'Birla Institute of Technology, Mesra, Ranchi',
          HighestEducation = 'B.Tech',
          FieldOfStudy = 'Computer Science & Engineering',
          GraduationYear = '2022',
          GPA = '8.2/10',
          Certifications = '[{"name":"AWS Certified Cloud Practitioner","issuer":"Amazon Web Services","date":"2024"},{"name":"Azure Fundamentals (AZ-900)","issuer":"Microsoft","date":"2023"},{"name":"Meta React Native Specialization","issuer":"Coursera / Meta","date":"2023"}]',
          CurrentJobTitle = 'Co-Founder & Lead Engineer',
          CurrentCompanyName = 'RefOpen (Plax Labs)',
          TotalExperienceMonths = 48,
          PreferredJobTypes = 'Full-Time',
          PreferredWorkTypes = 'Remote,Hybrid',
          PreferredLocations = 'Bangalore,Hyderabad,Remote',
          IsOpenToWork = 1,
          ProfileCompleteness = 95,
          UpdatedAt = GETUTCDATE()
        WHERE ApplicantID = @appId
      `);
    console.log('✅ Updated Applicants table (full profile)');

    // 4. Delete existing work experiences and add fresh ones
    await pool.request()
      .input('appId', sql.UniqueIdentifier, user.ApplicantID)
      .query(`DELETE FROM WorkExperiences WHERE ApplicantID = @appId`);

    // Work Experience 1: Current role
    await pool.request()
      .input('appId', sql.UniqueIdentifier, user.ApplicantID)
      .query(`
        INSERT INTO WorkExperiences (ApplicantID, JobTitle, CompanyName, Department, EmploymentType, StartDate, IsCurrent, Location, Country, Description, Skills, IsActive)
        VALUES (@appId, 'Co-Founder & Lead Engineer', 'RefOpen (Plax Labs)', 'Engineering', 'Full-Time', '2024-01-01', 1, 'Ranchi, India', 'India',
          'Built RefOpen from scratch — a referral-powered job platform with 10,000+ users across web and mobile.
Architected full-stack system: React Native (Expo) frontend + Azure Functions (Node.js/TypeScript) backend + SQL Server.
Developed AI-powered Resume Analyzer using Google Gemini with 95% user satisfaction rate.
Implemented real-time messaging with SignalR, push notifications via Expo, and in-app wallet with UPI/Razorpay payments.
Built automated job scraping pipeline ingesting 500+ jobs/day from Adzuna API with deduplication and enrichment.
Designed referral verification system with company email OTP, proof uploads, and admin approval workflow.
Led mobile app conversion achieving <2s cold start and instant tab switching on Android.',
          '["React Native","Expo","Azure Functions","TypeScript","SQL Server","SignalR","Razorpay","Google Gemini AI"]', 1)
      `);
    console.log('✅ Added work experience: Co-Founder & Lead Engineer at RefOpen');

    // Work Experience 2: Previous role
    await pool.request()
      .input('appId', sql.UniqueIdentifier, user.ApplicantID)
      .query(`
        INSERT INTO WorkExperiences (ApplicantID, JobTitle, CompanyName, Department, EmploymentType, StartDate, EndDate, IsCurrent, Location, Country, Description, Skills, IsActive)
        VALUES (@appId, 'Software Engineer', 'TCS (Tata Consultancy Services)', 'Digital Engineering', 'Full-Time', '2022-07-01', '2023-12-31', 0, 'Bangalore, India', 'India',
          'Developed and maintained enterprise React.js dashboards for Fortune 500 banking client serving 50,000+ daily users.
Built RESTful microservices in Node.js handling 10M+ API calls/month with 99.9% uptime.
Reduced page load times by 40% through code splitting, lazy loading, and Redis caching implementation.
Mentored 3 junior developers on React best practices, code reviews, and agile methodologies.
Automated CI/CD pipelines using Azure DevOps, cutting deployment time from 2 hours to 15 minutes.',
          '["React.js","Node.js","Azure DevOps","Redis","SQL Server","REST APIs","Jenkins"]', 1)
      `);
    console.log('✅ Added work experience: Software Engineer at TCS');

    // Work Experience 3: Internship
    await pool.request()
      .input('appId', sql.UniqueIdentifier, user.ApplicantID)
      .query(`
        INSERT INTO WorkExperiences (ApplicantID, JobTitle, CompanyName, Department, EmploymentType, StartDate, EndDate, IsCurrent, Location, Country, Description, Skills, IsActive)
        VALUES (@appId, 'Software Engineering Intern', 'Infosys', 'Innovation Hub', 'Internship', '2022-01-01', '2022-06-30', 0, 'Pune, India', 'India',
          'Built a real-time inventory tracking dashboard using React.js and WebSocket for warehouse operations.
Developed Python scripts for data pipeline automation, processing 100K+ records daily.
Won "Best Intern Project" award for inventory prediction model using scikit-learn with 87% accuracy.',
          '["React.js","Python","WebSocket","scikit-learn","PostgreSQL"]', 1)
      `);
    console.log('✅ Added work experience: SDE Intern at Infosys');

    // 5. Now delete existing resume builder project sections and re-auto-fill
    const projectResult = await pool.request().query(`
      SELECT ProjectID FROM ResumeBuilderProjects WHERE UserID = '${user.UserID}' AND IsDeleted = 0
    `);

    if (projectResult.recordset.length > 0) {
      const projectId = projectResult.recordset[0].ProjectID;
      console.log('\n📄 Found resume project:', projectId);
      console.log('   Will need to re-run auto-fill after deploying backend.');
      console.log('   Or delete this project and create a new one from the UI.');
    }
  }

  // 6. Verify final state
  console.log('\n📊 FINAL STATE:');
  const final = await pool.request().query(`
    SELECT u.FirstName, u.LastName, u.Phone, u.Email,
           a.Headline, a.CurrentJobTitle, a.CurrentCompanyName, a.CurrentLocation,
           a.LinkedInProfile, a.GithubProfile,
           LEN(a.PrimarySkills) as SkillsLen,
           LEN(a.Summary) as SummaryLen,
           a.Institution, a.HighestEducation, a.FieldOfStudy, a.GraduationYear, a.GPA,
           (SELECT COUNT(*) FROM WorkExperiences WHERE ApplicantID = a.ApplicantID AND IsActive = 1) as WorkExpCount,
           LEN(a.Certifications) as CertsLen
    FROM Users u
    JOIN Applicants a ON u.UserID = a.UserID
    WHERE u.Email = 'parimalkumar261@gmail.com'
  `);
  const f = final.recordset[0];
  console.log(`  👤 ${f.FirstName} ${f.LastName} | ${f.Phone}`);
  console.log(`  💼 ${f.CurrentJobTitle} at ${f.CurrentCompanyName}`);
  console.log(`  📍 ${f.CurrentLocation}`);
  console.log(`  🔗 LinkedIn: ${f.LinkedInProfile}`);
  console.log(`  🔗 GitHub: ${f.GithubProfile}`);
  console.log(`  🎓 ${f.HighestEducation} in ${f.FieldOfStudy} — ${f.Institution} (${f.GraduationYear}, GPA: ${f.GPA})`);
  console.log(`  🛠️ Skills: ${f.SkillsLen} chars`);
  console.log(`  📝 Summary: ${f.SummaryLen} chars`);
  console.log(`  💼 Work Experiences: ${f.WorkExpCount}`);
  console.log(`  📜 Certifications: ${f.CertsLen} chars`);

  console.log('\n🎉 Done! Now either:');
  console.log('  1. Delete the old resume project in the UI and create a new one (auto-fill will pull this data)');
  console.log('  2. Or after deploying backend, tap any existing project → manually trigger auto-fill from the API');

  pool.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
