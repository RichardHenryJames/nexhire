param(
  [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host "Seeding enhanced sample jobs into NexHire DB for unit testing..." -ForegroundColor Green

if (-not (Get-Module -ListAvailable -Name SqlServer)) {
  Write-Host "Installing SqlServer PowerShell module..." -ForegroundColor Yellow
  Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

$sql = @"
-- Ensure reference data exists (run setup-database.ps1 first)

-- Ensure currencies exist
INSERT INTO Currencies (Code, Name)
SELECT Code, Name FROM (VALUES
    ('INR', 'Indian Rupee'),
    ('USD', 'US Dollar'),
    ('GBP', 'British Pound'),
    ('SGD', 'Singapore Dollar'),
    ('JPY', 'Japanese Yen'),
    ('EUR', 'Euro'),
    ('AUD', 'Australian Dollar'),
    ('CAD', 'Canadian Dollar'),
    ('AED', 'UAE Dirham'),
    ('KRW', 'South Korean Won'),
    ('KES', 'Kenyan Shilling')
) AS c(Code, Name)
WHERE NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = c.Code);

-- Organizations catalog (expanded for testing: added gaming, retail, energy, etc.)
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
,('NexusSoft','Startup','SaaS','201-500','https://nexussoft.example','Singapore, SG')
,('MediTech Health','Private','Healthcare','501-1000','https://meditech.example','Boston, US')
,('EduCorp','Public','Education','1001-5000','https://educorp.example','Sydney, AU')
,('FinSecure','Startup','Finance','51-200','https://finsecure.example','Mumbai, IN')
,('EcoManufacture','Private','Manufacturing','201-500','https://ecomanufacture.example','Berlin, DE')
,('EntertainHub','Private','Entertainment','501-1000','https://entertainhub.example','Los Angeles, US')
,('GameForge','Startup','Gaming','51-200','https://gameforge.example','Seoul, KR')
,('GreenEnergy','Private','Energy','201-500','https://greenenergy.example','Dubai, AE')
,('RetailRise','Public','Retail','1001-5000','https://retailrise.example','Toronto, CA')
,('AgriTech','Private','Agriculture','51-200','https://agritech.example','Amsterdam, NL')
,('HopeNonProfit','Non-Profit','Non-Profit','51-200','https://hopenonprofit.example','Nairobi, KE');

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
,('recruiter+nexussoft@nexhire.test','NexusSoft','Recruiter')
,('recruiter+meditech@nexhire.test','MediTech','Recruiter')
,('recruiter+educorp@nexhire.test','EduCorp','Recruiter')
,('recruiter+finsecure@nexhire.test','FinSecure','Recruiter')
,('recruiter+ecomanufacture@nexhire.test','EcoManufacture','Recruiter')
,('recruiter+entertainhub@nexhire.test','EntertainHub','Recruiter')
,('recruiter+gameforge@nexhire.test','GameForge','Recruiter')
,('recruiter+greenenergy@nexhire.test','GreenEnergy','Recruiter')
,('recruiter+retailrise@nexhire.test','RetailRise','Recruiter')
,('recruiter+agritech@nexhire.test','AgriTech','Recruiter')
,('recruiter+hopenonprofit@nexhire.test','HopeNonProfit','Recruiter');

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
DECLARE @EUR INT = (SELECT TOP 1 CurrencyID FROM Currencies WHERE Code='EUR');
DECLARE @AUD INT = (SELECT TOP 1 CurrencyID FROM Currencies WHERE Code='AUD');
DECLARE @CAD INT = (SELECT TOP 1 CurrencyID FROM Currencies WHERE Code='CAD');
DECLARE @AED INT = (SELECT TOP 1 CurrencyID FROM Currencies WHERE Code='AED');
DECLARE @KRW INT = (SELECT TOP 1 CurrencyID FROM Currencies WHERE Code='KRW');
DECLARE @KES INT = (SELECT TOP 1 CurrencyID FROM Currencies WHERE Code='KES');

-- Map strings to IDs
DECLARE @JobTypes TABLE(Type NVARCHAR(100), JobTypeID INT);
INSERT INTO @JobTypes(Type,JobTypeID)
SELECT jt.Type, jt.JobTypeID FROM JobTypes jt;

DECLARE @WorkTypes TABLE(Type NVARCHAR(50), WorkplaceTypeID INT);
INSERT INTO @WorkTypes(Type,WorkplaceTypeID)
SELECT wt.Type, wt.WorkplaceTypeID FROM WorkplaceTypes wt;

-- Jobs catalog (70+ rows, fixed quotes and typos)
DECLARE @Jobs TABLE(
  OrgName NVARCHAR(200), PosterEmail NVARCHAR(320), Title NVARCHAR(200), JobType NVARCHAR(100), WorkplaceType NVARCHAR(50),
  Dept NVARCHAR(100), [Desc] NVARCHAR(MAX), Resp NVARCHAR(MAX), Benefits NVARCHAR(MAX),
  Location NVARCHAR(200), Country NVARCHAR(100), City NVARCHAR(100),
  SalaryMin DECIMAL(15,2), SalaryMax DECIMAL(15,2), CurrencyCode NVARCHAR(3), SalaryPeriod NVARCHAR(50),
  ExpMin INT, ExpMax INT, Tags NVARCHAR(1000)
);
INSERT INTO @Jobs
VALUES
('Acme Corp','recruiter+acme@nexhire.test','Senior Software Engineer','Full-time','Remote','Engineering','Build scalable web apps','Design, develop, mentor','Remote first, learning budget','Bengaluru, KA','India','Bengaluru',2800000,4200000,'INR','Annual',5,10,'javascript,node,react,aws'),
('Acme Corp','recruiter+acme@nexhire.test','Product Manager','Full-time','Hybrid','Product','Own the roadmap','Write PRDs, align, ship','Hybrid work, ESOPs','Bengaluru, KA','India','Bengaluru',3000000,4500000,'INR','Annual',4,9,'product,agile,roadmap'),
('Acme Corp','recruiter+acme@nexhire.test','UX Designer','Full-time','Onsite','Design','Design great UX','Research, wireframes','Onsite cafeteria','Pune, MH','India','Pune',1400000,2400000,'INR','Annual',2,6,'figma,ux,ui'),
('Acme Corp','recruiter+acme@nexhire.test','Junior Software Engineer','Full-time','Hybrid','Engineering','Entry-level development','Code features, bug fixes','Mentorship, training','Bengaluru, KA','India','Bengaluru',800000,1200000,'INR','Annual',0,2,'javascript,python,basics'),
('Acme Corp','recruiter+acme@nexhire.test','Software Engineer Intern','Internship','Hybrid','Engineering','Learn and build','Support features','Hybrid, mentor','Bengaluru, KA','India','Bengaluru',25000,50000,'INR','Monthly',0,1,'intern,js'),
('Acme Corp','recruiter+acme@nexhire.test','Executive Software Architect','Full-time','Remote','Engineering','Architecture design','Scalability, tech strategy','Equity','Bengaluru, KA','India','Bengaluru',5000000,7000000,'INR','Annual',10,15,'architecture,cloud,exec'),
('Globex Corporation','recruiter+globex@nexhire.test','Data Engineer','Full-time','Remote','Data','Data pipelines at scale','ETL, DW, Lakehouse','Remote, learning and development','Hyderabad, TS','India','Hyderabad',2600000,3800000,'INR','Annual',4,8,'python,spark,airflow'),
('Globex Corporation','recruiter+globex@nexhire.test','QA Automation Engineer','Full-time','Onsite','Quality','Automation frameworks','SDET, CI/CD','Onsite perks','Pune, MH','India','Pune',1200000,2200000,'INR','Annual',2,5,'selenium,cypress'),
('Globex Corporation','recruiter+globex@nexhire.test','DevOps Engineer','Full-time','Hybrid','Platform','Cloud infra','IaC, K8s, Observability','Hybrid, allowances','Pune, MH','India','Pune',2400000,3600000,'INR','Annual',3,7,'aws,kubernetes,terraform'),
('Globex Corporation','recruiter+globex@nexhire.test','Finance Analyst','Full-time','Remote','Finance','Financial modeling','Reports, forecasts','Remote flexibility','Pune, MH','India','Pune',1500000,2500000,'INR','Annual',2,5,'excel,finance,analytics'),
('Globex Corporation','recruiter+globex@nexhire.test','Freelance Content Writer','Freelance','Remote','Marketing','Tech content','Blogs, case studies','Remote','Pune, MH','India','Pune',40000,80000,'INR','Monthly',2,6,'content,writing'),
('Innotech Solutions','recruiter+innotech@nexhire.test','Frontend Engineer','Full-time','Remote','Engineering','React apps','SPA, SSR','Remote, device budget','Hyderabad, TS','India','Hyderabad',1800000,3000000,'INR','Annual',2,6,'react,typescript'),
('Innotech Solutions','recruiter+innotech@nexhire.test','Backend Engineer','Full-time','Onsite','Engineering','APIs and services','Node/Go, DB','Onsite lunch','Hyderabad, TS','India','Hyderabad',2000000,3200000,'INR','Annual',3,7,'node,go,postgres'),
('Innotech Solutions','recruiter+innotech@nexhire.test','Mobile Engineer','Full-time','Hybrid','Engineering','iOS/Android apps','RN/Swift/Kotlin','Hybrid benefits','Hyderabad, TS','India','Hyderabad',1800000,3000000,'INR','Annual',2,6,'react-native,swift,kotlin'),
('Innotech Solutions','recruiter+innotech@nexhire.test','Customer Success Manager','Full-time','Onsite','Success','Customer onboarding','QBRs, adoption','Onsite allowances','Hyderabad, TS','India','Hyderabad',1200000,2000000,'INR','Annual',2,5,'cs,retention'),
('Innotech Solutions','recruiter+innotech@nexhire.test','HR Generalist','Full-time','Onsite','HR','People ops','Payroll, policies','Onsite','Hyderabad, TS','India','Hyderabad',900000,1400000,'INR','Annual',2,5,'hr,people'),
('Innotech Solutions','recruiter+innotech@nexhire.test','Intern - Data Analyst','Internship','Remote','Data','Learn data tools','Basic analysis, reports','Stipend, certificate','Hyderabad, TS','India','Hyderabad',15000,25000,'INR','Monthly',0,1,'excel,sql,intern'),
('Umbrella Labs','recruiter+umbrella@nexhire.test','Support Engineer','Full-time','Remote','Support','Enterprise support','Troubleshoot, KB','Remote stipend','San Francisco, CA','United States','San Francisco',90000,120000,'USD','Annual',3,6,'support,sre'),
('Umbrella Labs','recruiter+umbrella@nexhire.test','Office Manager','Full-time','Onsite','Operations','Office ops','Vendors, events','Onsite perks','San Francisco, CA','United States','San Francisco',65000,85000,'USD','Annual',3,6,'ops,admin'),
('Umbrella Labs','recruiter+umbrella@nexhire.test','Biotech Research Intern','Internship','Onsite','R&D','Lab assistance','Experiments, data entry','Mentorship','San Francisco, CA','United States','San Francisco',2000,3000,'USD','Monthly',0,1,'biology,lab,intern'),
('Umbrella Labs','recruiter+umbrella@nexhire.test','Senior Biotech Scientist','Full-time','Hybrid','R&D','Lead experiments','Research, publications','Equity','San Francisco, CA','United States','San Francisco',150000,220000,'USD','Annual',7,12,'biotech,research,senior'),
('Stark Industries','recruiter+stark@nexhire.test','Data Scientist','Full-time','Hybrid','R&D','ML products','Modeling, MLOps','Hybrid, RSUs','New York, NY','United States','New York',120000,170000,'USD','Annual',3,7,'python,ml,cloud'),
('Stark Industries','recruiter+stark@nexhire.test','AI Researcher','Full-time','Onsite','R&D','AI research','Papers, prototypes','Onsite labs','New York, NY','United States','New York',150000,220000,'USD','Annual',5,12,'ai,dl,transformers'),
('Stark Industries','recruiter+stark@nexhire.test','Executive Director - R&D','Full-time','Hybrid','Leadership','Lead innovation','Strategy, team management','Equity, bonuses','New York, NY','United States','New York',250000,350000,'USD','Annual',10,20,'leadership,ai,exec'),
('Stark Industries','recruiter+stark@nexhire.test','AI Ethics Consultant','Contract','Remote','Ethics','AI governance','Policy, audits','Project pay','New York, NY','United States','New York',10000,15000,'USD','Monthly',4,8,'ai,ethics,consulting'),
('Wayne Enterprises','recruiter+wayne@nexhire.test','Cloud Architect','Full-time','Hybrid','IT','Cloud strategy','Architecture, governance','Hybrid benefits','London','United Kingdom','London',90000,130000,'GBP','Annual',6,12,'azure,aws,design'),
('Wayne Enterprises','recruiter+wayne@nexhire.test','Systems Analyst','Full-time','Onsite','IT','Systems analysis','Stakeholders, documentation','Onsite','London','United Kingdom','London',55000,80000,'GBP','Annual',3,7,'systems,ba'),
('Wayne Enterprises','recruiter+wayne@nexhire.test','Part-time IT Support','Part-time','Onsite','IT','Basic support','Helpdesk, troubleshooting','Flexible hours','London','United Kingdom','London',20000,30000,'GBP','Annual',1,3,'support,parttime'),
('Wayne Enterprises','recruiter+wayne@nexhire.test','Temporary Admin Assistant','Temporary','Onsite','Admin','Office admin','Filing, data entry','Onsite','London','United Kingdom','London',2000,2500,'GBP','Monthly',1,3,'admin,temp'),
('Cyberdyne Systems','recruiter+cyberdyne@nexhire.test','Security Engineer','Full-time','Hybrid','Security','Product security','Threat modeling','Hybrid','Tokyo','Japan','Tokyo',9000000,14000000,'JPY','Annual',4,9,'security,appsec'),
('Cyberdyne Systems','recruiter+cyberdyne@nexhire.test','Robotics Engineer','Full-time','Onsite','Engineering','Robotics','Control systems','Onsite lab','Tokyo','Japan','Tokyo',8000000,12000000,'JPY','Annual',3,7,'robotics,c++'),
('Cyberdyne Systems','recruiter+cyberdyne@nexhire.test','Senior Robotics Lead','Full-time','Hybrid','Engineering','Lead robotics teams','Design, oversee projects','Leadership perks','Tokyo','Japan','Tokyo',15000000,22000000,'JPY','Annual',8,15,'robotics,leadership,senior'),
('NexusSoft','recruiter+nexussoft@nexhire.test','Site Reliability Engineer','Full-time','Remote','Platform','Reliability','SLOs, infra code','Remote, stipend','Singapore','Singapore','Singapore',120000,180000,'SGD','Annual',4,9,'sre,k8s'),
('NexusSoft','recruiter+nexussoft@nexhire.test','Full Stack Developer','Full-time','Hybrid','Engineering','SaaS feature teams','API and UI','Hybrid','Singapore','Singapore','Singapore',90000,140000,'SGD','Annual',3,7,'node,react'),
('NexusSoft','recruiter+nexussoft@nexhire.test','Contract UI Designer','Contract','Remote','Design','Short-term UI work','Prototypes, iterations','Project-based pay','Singapore','Singapore','Singapore',5000,8000,'SGD','Monthly',2,5,'ui,figma,contract'),
('MediTech Health','recruiter+meditech@nexhire.test','Nurse Practitioner','Full-time','Onsite','Healthcare','Patient care','Assessments, treatments','Health benefits','Boston, MA','United States','Boston',80000,110000,'USD','Annual',2,6,'nursing,healthcare,patient'),
('MediTech Health','recruiter+meditech@nexhire.test','Medical Intern','Internship','Onsite','Healthcare','Shadow doctors','Basic procedures','Certificate','Boston, MA','United States','Boston',1000,2000,'USD','Monthly',0,1,'medical,intern,health'),
('MediTech Health','recruiter+meditech@nexhire.test','Senior Physician','Full-time','Hybrid','Healthcare','Lead medical team','Diagnoses, strategy','Bonuses','Boston, MA','United States','Boston',150000,250000,'USD','Annual',7,15,'physician,leadership,senior'),
('MediTech Health','recruiter+meditech@nexhire.test','Healthcare Data Analyst','Full-time','Remote','Data','Analyze patient data','Reports, insights','Remote health stipend','Boston, MA','United States','Boston',90000,130000,'USD','Annual',3,6,'data,healthcare,sql'),
('EduCorp','recruiter+educorp@nexhire.test','Teacher - Mathematics','Full-time','Onsite','Education','Teach students','Lesson plans, grading','Pension','Sydney, NSW','Australia','Sydney',70000,90000,'AUD','Annual',2,5,'teaching,math,education'),
('EduCorp','recruiter+educorp@nexhire.test','Education Coordinator','Full-time','Hybrid','Administration','Program coordination','Curriculum, events','Hybrid work','Sydney, NSW','Australia','Sydney',60000,80000,'AUD','Annual',3,7,'education,coordination'),
('EduCorp','recruiter+educorp@nexhire.test','Student Intern - Admin','Internship','Part-time','Administration','Assist office','Data entry, filing','Flexible','Sydney, NSW','Australia','Sydney',1000,1500,'AUD','Monthly',0,1,'intern,admin,education'),
('EduCorp','recruiter+educorp@nexhire.test','E-Learning Developer','Full-time','Hybrid','Development','Build online courses','LMS, content','Hybrid tools','Sydney, NSW','Australia','Sydney',65000,85000,'AUD','Annual',2,5,'elearning,development,html'),
('FinSecure','recruiter+finsecure@nexhire.test','Financial Advisor','Full-time','Remote','Finance','Client advice','Portfolios, planning','Remote stipend','Mumbai, MH','India','Mumbai',1200000,2000000,'INR','Annual',3,6,'finance,advisory,investments'),
('FinSecure','recruiter+finsecure@nexhire.test','Junior Accountant','Full-time','Hybrid','Accounting','Bookkeeping','Audits, reports','Training','Mumbai, MH','India','Mumbai',600000,900000,'INR','Annual',0,2,'accounting,fresher,excel'),
('FinSecure','recruiter+finsecure@nexhire.test','Senior Risk Analyst','Full-time','Onsite','Risk','Risk assessment','Models, compliance','Bonuses','Mumbai, MH','India','Mumbai',2500000,3500000,'INR','Annual',6,12,'risk,finance,senior'),
('FinSecure','recruiter+finsecure@nexhire.test','Freelance Auditor','Freelance','Remote','Audit','Compliance checks','Reviews, reports','Project pay','Mumbai, MH','India','Mumbai',50000,80000,'INR','Monthly',4,8,'audit,freelance,compliance'),
('EcoManufacture','recruiter+ecomanufacture@nexhire.test','Manufacturing Engineer','Full-time','Onsite','Engineering','Process optimization','Design, production','Onsite safety gear','Berlin','Germany','Berlin',60000,80000,'EUR','Annual',3,7,'manufacturing,engineering,cad'),
('EcoManufacture','recruiter+ecomanufacture@nexhire.test','Supply Chain Manager','Full-time','Hybrid','Operations','Logistics','Vendors, inventory','Hybrid','Berlin','Germany','Berlin',70000,100000,'EUR','Annual',4,9,'supplychain,logistics'),
('EcoManufacture','recruiter+ecomanufacture@nexhire.test','Intern - Quality Control','Internship','Onsite','Quality','Testing products','Inspections, reports','Mentorship','Berlin','Germany','Berlin',1000,1500,'EUR','Monthly',0,1,'quality,intern,manufacturing'),
('EntertainHub','recruiter+entertainhub@nexhire.test','Content Producer','Full-time','Hybrid','Production','Create media','Scripting, editing','Creative perks','Los Angeles, CA','United States','Los Angeles',80000,120000,'USD','Annual',3,7,'content,production,video'),
('EntertainHub','recruiter+entertainhub@nexhire.test','Marketing Intern','Internship','Remote','Marketing','Social media','Campaigns, analytics','Remote tools','Los Angeles, CA','United States','Los Angeles',1500,2500,'USD','Monthly',0,1,'marketing,intern,social'),
('EntertainHub','recruiter+entertainhub@nexhire.test','Director of Photography','Full-time','Onsite','Creative','Lead shoots','Lighting, composition','Equipment budget','Los Angeles, CA','United States','Los Angeles',120000,180000,'USD','Annual',5,10,'photography,creative,director'),
('GameForge','recruiter+gameforge@nexhire.test','Game Developer','Full-time','Hybrid','Engineering','Build game features','Code, test games','Stock options','Seoul','South Korea','Seoul',80000000,120000000,'KRW','Annual',3,7,'unity,c#,gaming'),
('GameForge','recruiter+gameforge@nexhire.test','Intern - Game Tester','Internship','Remote','Quality','Test game builds','Bug reports','Certificate','Seoul','South Korea','Seoul',1000000,2000000,'KRW','Monthly',0,1,'qa,gaming,intern'),
('GreenEnergy','recruiter+greenenergy@nexhire.test','Renewable Energy Engineer','Full-time','Onsite','Engineering','Design solar/wind systems','Technical specs','Green perks','Dubai','United Arab Emirates','Dubai',200000,300000,'AED','Annual',4,8,'energy,solar,engineering'),
('GreenEnergy','recruiter+greenenergy@nexhire.test','Energy Analyst','Full-time','Hybrid','Analytics','Market analysis','Reports, forecasts','Hybrid','Dubai','United Arab Emirates','Dubai',150000,220000,'AED','Annual',3,6,'energy,analytics,tableau'),
('RetailRise','recruiter+retailrise@nexhire.test','Store Manager','Full-time','Onsite','Retail','Manage store ops','Staff, sales','Bonuses','Toronto, ON','Canada','Toronto',60000,90000,'CAD','Annual',3,7,'retail,management,sales'),
('RetailRise','recruiter+retailrise@nexhire.test','E-Commerce Specialist','Full-time','Remote','E-Commerce','Online sales','Listings, SEO','Remote tools','Toronto, ON','Canada','Toronto',55000,80000,'CAD','Annual',2,5,'ecommerce,seo,marketing'),
('AgriTech','recruiter+agritech@nexhire.test','Agronomist','Full-time','Hybrid','Agriculture','Crop research','Field studies','Sustainability perks','Amsterdam','Netherlands','Amsterdam',50000,75000,'EUR','Annual',3,6,'agriculture,research,soil'),
('AgriTech','recruiter+agritech@nexhire.test','Farm Tech Intern','Internship','Onsite','Technology','Assist IoT setups','Sensor testing','Mentorship','Amsterdam','Netherlands','Amsterdam',800,1200,'EUR','Monthly',0,1,'iot,agriculture,intern'),
('HopeNonProfit','recruiter+hopenonprofit@nexhire.test','Program Coordinator','Full-time','Hybrid','Programs','Community projects','Plan and execute','Impact-driven','Nairobi','Kenya','Nairobi',400000,600000,'KES','Annual',2,5,'nonprofit,coordination,community'),
('HopeNonProfit','recruiter+hopenonprofit@nexhire.test','Volunteer - Outreach','Volunteer','Remote','Outreach','Raise awareness','Community engagement','None','Nairobi','Kenya','Nairobi',0,0,'KES','Monthly',1,3,'outreach,nonprofit,volunteer'),
('Acme Corp','recruiter+acme@nexhire.test','Principal Engineer','Full-time','Remote','Engineering','Tech leadership','Architecture, mentor','Equity','Remote','India','Remote',4500000,6500000,'INR','Annual',12,20,'javascript,cloud,leadership'),
('MediTech Health','recruiter+meditech@nexhire.test','Radiologist','Full-time','Onsite','Healthcare','Imaging diagnostics','Scans, reports','Health benefits','Boston, MA','United States','Boston',180000,260000,'USD','Annual',5,10,'radiology,healthcare,imaging'),
('GameForge','recruiter+gameforge@nexhire.test','Senior Game Designer','Full-time','Hybrid','Design','Game concepts','Level design, story','Stock options','Seoul','South Korea','Seoul',120000000,180000000,'KRW','Annual',6,12,'gaming,design,senior');

-- Insert jobs with error handling
DECLARE @RowNum INT = 1;
DECLARE @TotalRows INT = (SELECT COUNT(*) FROM @Jobs);
DECLARE @ErrorMsg NVARCHAR(MAX);

WHILE @RowNum <= @TotalRows
BEGIN
    BEGIN TRY
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
            CASE j.CurrencyCode
                WHEN 'INR' THEN @INR
                WHEN 'USD' THEN @USD
                WHEN 'GBP' THEN @GBP
                WHEN 'SGD' THEN @SGD
                WHEN 'JPY' THEN @JPY
                WHEN 'EUR' THEN @EUR
                WHEN 'AUD' THEN @AUD
                WHEN 'CAD' THEN @CAD
                WHEN 'AED' THEN @AED
                WHEN 'KRW' THEN @KRW
                WHEN 'KES' THEN @KES
                ELSE @INR
            END,
            j.SalaryPeriod,
            j.ExpMin,
            j.ExpMax,
            'Published','Public', @now, DATEADD(day, 60, @now), j.Tags
        FROM (SELECT *, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS rn FROM @Jobs) j
        JOIN Organizations org ON org.Name = j.OrgName
        JOIN Users u ON u.Email = j.PosterEmail
        JOIN @JobTypes jt ON jt.Type = j.JobType
        JOIN @WorkTypes wt ON wt.Type = j.WorkplaceType
        LEFT JOIN Jobs exist ON exist.Title = j.Title AND exist.OrganizationID = org.OrganizationID
        WHERE exist.JobID IS NULL AND j.rn = @RowNum;

        SET @RowNum = @RowNum + 1;
    END TRY
    BEGIN CATCH
        SET @ErrorMsg = 'Error on row ' + CAST(@RowNum AS NVARCHAR(10)) + ': ' + ERROR_MESSAGE();
        THROW 50001, @ErrorMsg, 1;
    END CATCH;
END;

-- Attach skills for testing
DECLARE @SkillJs INT = (SELECT TOP 1 SkillID FROM Skills WHERE Name='JavaScript');
DECLARE @SkillPy INT = (SELECT TOP 1 SkillID FROM Skills WHERE Name='Python');
DECLARE @SkillSql INT = (SELECT TOP 1 SkillID FROM Skills WHERE Name='SQL');
DECLARE @SkillNursing INT = (SELECT TOP 1 SkillID FROM Skills WHERE Name='Nursing');
DECLARE @SkillUnity INT = (SELECT TOP 1 SkillID FROM Skills WHERE Name='Unity');
IF @SkillJs IS NOT NULL
BEGIN
    INSERT INTO JobSkills (JobID, SkillID, IsRequired)
    SELECT j.JobID, @SkillJs, 1
    FROM Jobs j
    WHERE j.Title LIKE '%Software Engineer%' OR j.Title LIKE '%Frontend%' OR j.Title LIKE '%Full Stack%'
        AND NOT EXISTS (SELECT 1 FROM JobSkills x WHERE x.JobID=j.JobID AND x.SkillID=@SkillJs);
END
IF @SkillPy IS NOT NULL
BEGIN
    INSERT INTO JobSkills (JobID, SkillID, IsRequired)
    SELECT j.JobID, @SkillPy, 0
    FROM Jobs j
    WHERE j.Title LIKE '%Data%' OR j.Title LIKE '%AI%'
        AND NOT EXISTS (SELECT 1 FROM JobSkills x WHERE x.JobID=j.JobID AND x.SkillID=@SkillPy);
END
IF @SkillSql IS NOT NULL
BEGIN
    INSERT INTO JobSkills (JobID, SkillID, IsRequired)
    SELECT j.JobID, @SkillSql, 1
    FROM Jobs j
    WHERE j.Title LIKE '%Analyst%' OR j.Title LIKE '%Data%'
        AND NOT EXISTS (SELECT 1 FROM JobSkills x WHERE x.JobID=j.JobID AND x.SkillID=@SkillSql);
END
IF @SkillNursing IS NOT NULL
BEGIN
    INSERT INTO JobSkills (JobID, SkillID, IsRequired)
    SELECT j.JobID, @SkillNursing, 1
    FROM Jobs j
    WHERE j.Title LIKE '%Nurse%' OR j.Title LIKE '%Healthcare%' OR j.Title LIKE '%Physician%'
        AND NOT EXISTS (SELECT 1 FROM JobSkills x WHERE x.JobID=j.JobID AND x.SkillID=@SkillNursing);
END
IF @SkillUnity IS NOT NULL
BEGIN
    INSERT INTO JobSkills (JobID, SkillID, IsRequired)
    SELECT j.JobID, @SkillUnity, 1
    FROM Jobs j
    WHERE j.Title LIKE '%Game%'
        AND NOT EXISTS (SELECT 1 FROM JobSkills x WHERE x.JobID=j.JobID AND x.SkillID=@SkillUnity);
END

-- Summary
SELECT COUNT(*) AS JobCount FROM Jobs WHERE Status='Published' AND (ExpiresAt IS NULL OR ExpiresAt > SYSDATETIMEOFFSET()) AND IsArchived=0;
"@

try {
    $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $sql -QueryTimeout 180
    Write-Host "Enhanced seed completed. Published jobs count:" $($result.JobCount) -ForegroundColor Green
    Write-Host "Ready for unit testing of /api/search/jobs." -ForegroundColor Cyan
}
catch {
    Write-Error "Seeding failed: $($_.Exception.Message)"
    exit 1
}