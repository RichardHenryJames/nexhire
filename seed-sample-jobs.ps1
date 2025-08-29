param(
  [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host "Seeding sample jobs into NexHire DB..." -ForegroundColor Green

if (-not (Get-Module -ListAvailable -Name SqlServer)) {
  Write-Host "Installing SqlServer PowerShell module..." -ForegroundColor Yellow
  Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

$sql = @"
-- Ensure reference data exists (run setup-database.ps1 first)

-- Organizations catalog
DECLARE @Orgs TABLE(
  Name NVARCHAR(200), Type NVARCHAR(50), Industry NVARCHAR(100), Size NVARCHAR(20), Website NVARCHAR(500), Headquarters NVARCHAR(255)
);
INSERT INTO @Orgs(Name,Type,Industry,Size,Website,Headquarters)
VALUES
 ('Acme Corp','Private','Software','201-500','https://acme.example','Bengaluru, IN')
,('Globex Corporation','Private','FinTech','501-1000','https://globex.example','Pune, IN')
,('Innotech Solutions','Startup','IT Services','51-200','https://innotech.example','Hyderabad, IN')
,('Umbrella Labs','Private','Biotech','1001-5000','https://umbrella.example','San Francisco, US')
,('Wayne Enterprises','Private','Conglomerate','5000+','https://wayne.example','London, UK')
,('Stark Industries','Private','Defense','5000+','https://stark.example','New York, US')
,('Cyberdyne Systems','Private','Robotics','1001-5000','https://cyberdyne.example','Tokyo, JP')
,('NexusSoft','Startup','SaaS','201-500','https://nexussoft.example','Singapore, SG');

-- Upsert orgs
INSERT INTO Organizations (Name, Type, Industry, Size, Website, Headquarters, IsActive)
SELECT o.Name,o.Type,o.Industry,o.Size,o.Website,o.Headquarters,1
FROM @Orgs o
WHERE NOT EXISTS (SELECT 1 FROM Organizations x WHERE x.Name = o.Name);

-- Poster users per org
DECLARE @Users TABLE(Email NVARCHAR(320), FirstName NVARCHAR(100), LastName NVARCHAR(100));
INSERT INTO @Users(Email,FirstName,LastName)
VALUES
 ('recruiter+acme@nexhire.test','Acme','Recruiter')
,('recruiter+globex@nexhire.test','Globex','Recruiter')
,('recruiter+innotech@nexhire.test','Innotech','Recruiter')
,('recruiter+umbrella@nexhire.test','Umbrella','Recruiter')
,('recruiter+wayne@nexhire.test','Wayne','Recruiter')
,('recruiter+stark@nexhire.test','Stark','Recruiter')
,('recruiter+cyberdyne@nexhire.test','Cyberdyne','Recruiter')
,('recruiter+nexussoft@nexhire.test','NexusSoft','Recruiter');

INSERT INTO Users (Email, Password, UserType, FirstName, LastName, CreatedAt, UpdatedAt, IsActive)
SELECT u.Email,'temporary-hash','Employer',u.FirstName,u.LastName,SYSUTCDATETIME(),SYSUTCDATETIME(),1
FROM @Users u
WHERE NOT EXISTS (SELECT 1 FROM Users x WHERE x.Email=u.Email);

-- Lookups
DECLARE @now DATETIMEOFFSET = SYSDATETIMEOFFSET();
DECLARE @INR INT = (SELECT TOP 1 CurrencyID FROM Currencies WHERE Code='INR');
DECLARE @USD INT = (SELECT TOP 1 CurrencyID FROM Currencies WHERE Code='USD');
DECLARE @GBP INT = (SELECT TOP 1 CurrencyID FROM Currencies WHERE Code='GBP');
DECLARE @SGD INT = (SELECT TOP 1 CurrencyID FROM Currencies WHERE Code='SGD');
DECLARE @JPY INT = (SELECT TOP 1 CurrencyID FROM Currencies WHERE Code='JPY');

-- Map strings to IDs via inline functions (table variables + joins later)
DECLARE @JobTypes TABLE(Type NVARCHAR(100), JobTypeID INT);
INSERT INTO @JobTypes(Type,JobTypeID)
SELECT jt.Type, jt.JobTypeID FROM JobTypes jt;

DECLARE @WorkTypes TABLE(Type NVARCHAR(50), WorkplaceTypeID INT);
INSERT INTO @WorkTypes(Type,WorkplaceTypeID)
SELECT wt.Type, wt.WorkplaceTypeID FROM WorkplaceTypes wt;

-- Jobs catalog (25+ rows)
DECLARE @Jobs TABLE(
  OrgName NVARCHAR(200), PosterEmail NVARCHAR(320), Title NVARCHAR(200), JobType NVARCHAR(100), WorkplaceType NVARCHAR(50),
  Dept NVARCHAR(100), [Desc] NVARCHAR(MAX), Resp NVARCHAR(MAX), Benefits NVARCHAR(MAX),
  Location NVARCHAR(200), Country NVARCHAR(100), City NVARCHAR(100),
  SalaryMin DECIMAL(15,2), SalaryMax DECIMAL(15,2), CurrencyCode NVARCHAR(3), SalaryPeriod NVARCHAR(50),
  ExpMin INT, ExpMax INT, Tags NVARCHAR(1000)
);
INSERT INTO @Jobs
VALUES
('Acme Corp','recruiter+acme@nexhire.test','Senior Software Engineer','Full-time','Remote','Engineering','Build scalable web apps','Design, develop, mentor','Remote first, Learning budget','Bengaluru, KA','India','Bengaluru',2800000,4200000,'INR','Annual',5,10,'javascript,node,react,aws'),
('Acme Corp','recruiter+acme@nexhire.test','Product Manager','Full-time','Hybrid','Product','Own the roadmap','Write PRDs, align, ship','Hybrid work, ESOPs','Bengaluru, KA','India','Bengaluru',3000000,4500000,'INR','Annual',4,9,'product,agile,roadmap'),
('Acme Corp','recruiter+acme@nexhire.test','UX Designer','Full-time','Onsite','Design','Design great UX','Research, wireframes','Onsite cafeteria','Pune, MH','India','Pune',1400000,2400000,'INR','Annual',2,6,'figma,ux,ui'),
('Acme Corp','recruiter+acme@nexhire.test','Marketing Manager','Full-time','Hybrid','Marketing','Grow demand','Campaigns, content, analytics','Hybrid, Insurance','Bengaluru, KA','India','Bengaluru',1800000,2800000,'INR','Annual',4,8,'seo,sem,content'),
('Globex Corporation','recruiter+globex@nexhire.test','Data Engineer','Full-time','Remote','Data','Data pipelines at scale','ETL, DW, Lakehouse','Remote, L&D','Hyderabad, TS','India','Hyderabad',2600000,3800000,'INR','Annual',4,8,'python,spark,airflow'),
('Globex Corporation','recruiter+globex@nexhire.test','QA Automation Engineer','Full-time','Onsite','Quality','Automation frameworks','SDET, CI/CD','Onsite perks','Pune, MH','India','Pune',1200000,2200000,'INR','Annual',2,5,'selenium,cypress'),
('Globex Corporation','recruiter+globex@nexhire.test','DevOps Engineer','Full-time','Hybrid','Platform','Cloud infra','IaC, K8s, Observability','Hybrid, Allowances','Pune, MH','India','Pune',2400000,3600000,'INR','Annual',3,7,'aws,kubernetes,terraform'),
('Innotech Solutions','recruiter+innotech@nexhire.test','Frontend Engineer','Full-time','Remote','Engineering','React apps','SPA, SSR','Remote, Device budget','Hyderabad, TS','India','Hyderabad',1800000,3000000,'INR','Annual',2,6,'react,typescript'),
('Innotech Solutions','recruiter+innotech@nexhire.test','Backend Engineer','Full-time','Onsite','Engineering','APIs & services','Node/Go, DB','Onsite lunch','Hyderabad, TS','India','Hyderabad',2000000,3200000,'INR','Annual',3,7,'node,go,postgres'),
('Innotech Solutions','recruiter+innotech@nexhire.test','Mobile Engineer','Full-time','Hybrid','Engineering','iOS/Android apps','RN/Swift/Kotlin','Hybrid benefits','Hyderabad, TS','India','Hyderabad',1800000,3000000,'INR','Annual',2,6,'react-native,swift,kotlin'),
('Innotech Solutions','recruiter+innotech@nexhire.test','Customer Success Manager','Full-time','Onsite','Success','Customer onboarding','QBRs, adoption','Onsite allowances','Hyderabad, TS','India','Hyderabad',1200000,2000000,'INR','Annual',2,5,'cs,retention'),
('Innotech Solutions','recruiter+innotech@nexhire.test','HR Generalist','Full-time','Onsite','HR','People ops','Payroll, policies','Onsite','Hyderabad, TS','India','Hyderabad',900000,1400000,'INR','Annual',2,5,'hr,people'),
('Umbrella Labs','recruiter+umbrella@nexhire.test','Support Engineer','Full-time','Remote','Support','Enterprise support','Troubleshoot, KB','Remote stipend','San Francisco, CA','United States','San Francisco',90000,120000,'USD','Annual',3,6,'support,sre'),
('Umbrella Labs','recruiter+umbrella@nexhire.test','Office Manager','Full-time','Onsite','Operations','Office ops','Vendors, events','Onsite perks','San Francisco, CA','United States','San Francisco',65000,85000,'USD','Annual',3,6,'ops,admin'),
('Stark Industries','recruiter+stark@nexhire.test','Data Scientist','Full-time','Hybrid','R&D','ML products','Modeling, MLOps','Hybrid, RSUs','New York, NY','United States','New York',120000,170000,'USD','Annual',3,7,'python,ml,cloud'),
('Stark Industries','recruiter+stark@nexhire.test','AI Researcher','Full-time','Onsite','R&D','AI research','Papers, prototypes','Onsite labs','New York, NY','United States','New York',150000,220000,'USD','Annual',5,12,'ai,dl,transformers'),
('Wayne Enterprises','recruiter+wayne@nexhire.test','Cloud Architect','Full-time','Hybrid','IT','Cloud strategy','Architecture, governance','Hybrid benefits','London','United Kingdom','London',90000,130000,'GBP','Annual',6,12,'azure,aws,design'),
('Wayne Enterprises','recruiter+wayne@nexhire.test','Systems Analyst','Full-time','Onsite','IT','Systems analysis','Stakeholders, docs','Onsite','London','United Kingdom','London',55000,80000,'GBP','Annual',3,7,'systems,ba'),
('Cyberdyne Systems','recruiter+cyberdyne@nexhire.test','Security Engineer','Full-time','Hybrid','Security','Product security','Threat modeling','Hybrid','Tokyo','Japan','Tokyo',9000000,14000000,'JPY','Annual',4,9,'security,appsec'),
('Cyberdyne Systems','recruiter+cyberdyne@nexhire.test','Robotics Engineer','Full-time','Onsite','Engineering','Robotics','Control systems','Onsite lab','Tokyo','Japan','Tokyo',8000000,12000000,'JPY','Annual',3,7,'robotics,c++'),
('NexusSoft','recruiter+nexussoft@nexhire.test','Site Reliability Engineer','Full-time','Remote','Platform','Reliability','SLOs, infra code','Remote, stipend','Singapore','Singapore','Singapore',120000,180000,'SGD','Annual',4,9,'sre,k8s'),
('NexusSoft','recruiter+nexussoft@nexhire.test','Full Stack Developer','Full-time','Hybrid','Engineering','SaaS feature teams','API + UI','Hybrid','Singapore','Singapore','Singapore',90000,140000,'SGD','Annual',3,7,'node,react'),
('Acme Corp','recruiter+acme@nexhire.test','Software Engineer Intern','Internship','Hybrid','Engineering','Learn & build','Support features','Hybrid, mentor','Bengaluru, KA','India','Bengaluru',25000,50000,'INR','Monthly',0,1,'intern,js'),
('Globex Corporation','recruiter+globex@nexhire.test','Freelance Content Writer','Freelance','Remote','Marketing','Tech content','Blogs, case studies','Remote','Pune, MH','India','Pune',40000,80000,'INR','Monthly',2,6,'content,writing'),
('Wayne Enterprises','recruiter+wayne@nexhire.test','Temporary Admin Assistant','Temporary','Onsite','Admin','Office admin','Filing, data entry','Onsite','London','United Kingdom','London',2000,2500,'GBP','Monthly',1,3,'admin,temp');

-- Insert jobs if not exist
INSERT INTO Jobs (
  OrganizationID, PostedByUserID, Title, JobTypeID, WorkplaceTypeID,
  Department, Description, Responsibilities, BenefitsOffered,
  Location, Country, City, IsRemote,
  SalaryRangeMin, SalaryRangeMax, CurrencyID, SalaryPeriod,
  ExperienceMin, ExperienceMax,
  Status, Visibility, PublishedAt, ExpiresAt, Tags
)
SELECT 
  org.OrganizationID,
  u.UserID,
  j.Title,
  jt.JobTypeID,
  wt.WorkplaceTypeID,
  j.Dept,
  j.[Desc],
  j.Resp,
  j.Benefits,
  j.Location,
  j.Country,
  j.City,
  CASE WHEN wt.Type='Remote' THEN 1 ELSE 0 END,
  j.SalaryMin,
  j.SalaryMax,
  CASE j.CurrencyCode WHEN 'INR' THEN @INR WHEN 'USD' THEN @USD WHEN 'GBP' THEN @GBP WHEN 'SGD' THEN @SGD WHEN 'JPY' THEN @JPY ELSE @INR END,
  j.SalaryPeriod,
  j.ExpMin,
  j.ExpMax,
  'Published','Public', @now, DATEADD(day, 60, @now), j.Tags
FROM @Jobs j
JOIN Organizations org ON org.Name = j.OrgName
JOIN Users u ON u.Email = j.PosterEmail
JOIN @JobTypes jt ON jt.Type = j.JobType
JOIN @WorkTypes wt ON wt.Type = j.WorkplaceType
LEFT JOIN Jobs exist ON exist.Title = j.Title AND exist.OrganizationID = org.OrganizationID
WHERE exist.JobID IS NULL;

-- Attach a few skills to engineering jobs if available
DECLARE @SkillJs INT = (SELECT TOP 1 SkillID FROM Skills WHERE Name='JavaScript');
DECLARE @SkillPy INT = (SELECT TOP 1 SkillID FROM Skills WHERE Name='Python');
IF @SkillJs IS NOT NULL
BEGIN
  INSERT INTO JobSkills (JobID, SkillID, IsRequired)
  SELECT j.JobID, @SkillJs, 1
  FROM Jobs j
  WHERE j.Title IN ('Senior Software Engineer','Frontend Engineer','Full Stack Developer')
    AND NOT EXISTS (SELECT 1 FROM JobSkills x WHERE x.JobID=j.JobID AND x.SkillID=@SkillJs);
END
IF @SkillPy IS NOT NULL
BEGIN
  INSERT INTO JobSkills (JobID, SkillID, IsRequired)
  SELECT j.JobID, @SkillPy, 0
  FROM Jobs j
  WHERE j.Title IN ('Data Engineer','Data Scientist')
    AND NOT EXISTS (SELECT 1 FROM JobSkills x WHERE x.JobID=j.JobID AND x.SkillID=@SkillPy);
END

-- Summary
SELECT COUNT(*) AS JobCount FROM Jobs WHERE Status='Published' AND (ExpiresAt IS NULL OR ExpiresAt > SYSDATETIMEOFFSET()) AND IsArchived=0;
"@

try {
  $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $sql -QueryTimeout 180
  Write-Host "Seed completed. Published jobs count:" $($result.JobCount) -ForegroundColor Green
  Write-Host "You can now refresh the Jobs screen." -ForegroundColor Cyan
}
catch {
  Write-Error "Seeding failed: $($_.Exception.Message)"
  exit 1
}
