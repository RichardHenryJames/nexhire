-- ============================================================================
-- Reference Metadata System (Idempotent Version)
-- Stores all static reference data: Job Roles, Skills, Technologies, etc.
-- Safe to run multiple times
-- ============================================================================

PRINT '============================================================================';
PRINT 'Starting Reference Metadata Setup (Idempotent)';
PRINT '============================================================================';

-- Create ReferenceMetadata table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferenceMetadata')
BEGIN
    CREATE TABLE ReferenceMetadata (
        ReferenceID INT IDENTITY(1,1) PRIMARY KEY,
        RefType NVARCHAR(50) NOT NULL,
        Value NVARCHAR(200) NOT NULL,
        Category NVARCHAR(100) NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE()
    );
    PRINT '? ReferenceMetadata table created';
END
ELSE
BEGIN
    PRINT '? ReferenceMetadata table already exists';
END
GO

-- Create Indexes (idempotent with proper checks)
PRINT 'Creating indexes...';

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferenceMetadata_RefType' AND object_id = OBJECT_ID('ReferenceMetadata'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferenceMetadata_RefType 
    ON ReferenceMetadata(RefType, IsActive) 
    INCLUDE (ReferenceID, Value, Category, Description);
    PRINT '? Index IX_ReferenceMetadata_RefType created';
END
ELSE PRINT '? Index IX_ReferenceMetadata_RefType already exists';

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferenceMetadata_Category' AND object_id = OBJECT_ID('ReferenceMetadata'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferenceMetadata_Category 
    ON ReferenceMetadata(Category, IsActive) 
    WHERE Category IS NOT NULL;
    PRINT '? Index IX_ReferenceMetadata_Category created';
END
ELSE PRINT '? Index IX_ReferenceMetadata_Category already exists';

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferenceMetadata_RefType_Value' AND object_id = OBJECT_ID('ReferenceMetadata'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_ReferenceMetadata_RefType_Value 
    ON ReferenceMetadata(RefType, Value);
    PRINT '? Unique Index IX_ReferenceMetadata_RefType_Value created';
END
ELSE PRINT '? Unique Index IX_ReferenceMetadata_RefType_Value already exists';

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ReferenceMetadata_Value' AND object_id = OBJECT_ID('ReferenceMetadata'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferenceMetadata_Value 
    ON ReferenceMetadata(Value);
    PRINT '? Index IX_ReferenceMetadata_Value created';
END
ELSE PRINT '? Index IX_ReferenceMetadata_Value already exists';
GO

PRINT '';
PRINT 'Populating reference data...';
PRINT '-----------------------------------------------------------';

-- Create temporary table for bulk inserts
IF OBJECT_ID('tempdb..#RefData') IS NOT NULL DROP TABLE #RefData;
CREATE TABLE #RefData (
    RefType NVARCHAR(50),
    Value NVARCHAR(200),
    Category NVARCHAR(100),
    Description NVARCHAR(500)
);

-- ============================================================================
-- JOB ROLES
-- ============================================================================
PRINT 'Inserting Job Roles...';

INSERT INTO #RefData (RefType, Value, Category, Description) VALUES
-- Software Engineering
('JobRole', 'Software Engineer', 'Software Engineering', 'General software development role'),
('JobRole', 'Software Engineer I', 'Software Engineering', 'Entry-level software engineer'),
('JobRole', 'Software Engineer II', 'Software Engineering', 'Mid-level software engineer'),
('JobRole', 'Software Engineer III', 'Software Engineering', 'Senior-level software engineer'),
('JobRole', 'Senior Software Engineer', 'Software Engineering', 'Experienced software developer'),
('JobRole', 'Staff Software Engineer', 'Software Engineering', 'Senior technical contributor'),
('JobRole', 'Principal Software Engineer', 'Software Engineering', 'Technical expert and leader'),
('JobRole', 'Distinguished Engineer', 'Software Engineering', 'Top-level technical authority'),
('JobRole', 'Lead Software Engineer', 'Software Engineering', 'Team lead for engineering projects'),
('JobRole', 'Software Architect', 'Software Engineering', 'Designs software systems architecture'),
('JobRole', 'Solutions Architect', 'Software Engineering', 'Designs end-to-end technical solutions'),
('JobRole', 'Enterprise Architect', 'Software Engineering', 'Enterprise-level architecture planning'),
-- Frontend
('JobRole', 'Frontend Engineer', 'Frontend Development', 'Develops user interfaces'),
('JobRole', 'Senior Frontend Engineer', 'Frontend Development', 'Experienced frontend developer'),
('JobRole', 'Frontend Developer', 'Frontend Development', 'Builds web application interfaces'),
('JobRole', 'Senior Frontend Developer', 'Frontend Development', 'Senior UI developer'),
('JobRole', 'UI Engineer', 'Frontend Development', 'User interface specialist'),
('JobRole', 'React Developer', 'Frontend Development', 'React.js specialist'),
('JobRole', 'Angular Developer', 'Frontend Development', 'Angular framework specialist'),
('JobRole', 'Vue.js Developer', 'Frontend Development', 'Vue.js framework specialist'),
('JobRole', 'JavaScript Developer', 'Frontend Development', 'JavaScript specialist'),
-- Backend
('JobRole', 'Backend Engineer', 'Backend Development', 'Server-side application developer'),
('JobRole', 'Senior Backend Engineer', 'Backend Development', 'Experienced backend developer'),
('JobRole', 'Backend Developer', 'Backend Development', 'Builds server-side logic'),
('JobRole', 'Senior Backend Developer', 'Backend Development', 'Senior server-side developer'),
('JobRole', 'API Developer', 'Backend Development', 'API design and development specialist'),
('JobRole', 'Java Developer', 'Backend Development', 'Java programming specialist'),
('JobRole', 'Python Developer', 'Backend Development', 'Python programming specialist'),
('JobRole', 'Node.js Developer', 'Backend Development', 'Node.js specialist'),
('.NET Developer', 'Backend Development', 'Backend Development', '.NET framework specialist'),
('JobRole', 'Go Developer', 'Backend Development', 'Golang programming specialist'),
('JobRole', 'Ruby Developer', 'Backend Development', 'Ruby programming specialist'),
('JobRole', 'PHP Developer', 'Backend Development', 'PHP programming specialist'),
-- Full Stack
('JobRole', 'Full Stack Engineer', 'Full Stack Development', 'Frontend and backend developer'),
('JobRole', 'Senior Full Stack Engineer', 'Full Stack Development', 'Experienced full stack developer'),
('JobRole', 'Full Stack Developer', 'Full Stack Development', 'End-to-end application developer'),
('JobRole', 'Senior Full Stack Developer', 'Full Stack Development', 'Senior end-to-end developer'),
('JobRole', 'MEAN Stack Developer', 'Full Stack Development', 'MongoDB, Express, Angular, Node specialist'),
('JobRole', 'MERN Stack Developer', 'Full Stack Development', 'MongoDB, Express, React, Node specialist'),
-- Mobile
('JobRole', 'Mobile Engineer', 'Mobile Development', 'Mobile application developer'),
('JobRole', 'Senior Mobile Engineer', 'Mobile Development', 'Experienced mobile developer'),
('JobRole', 'iOS Developer', 'Mobile Development', 'iOS application developer'),
('JobRole', 'Senior iOS Developer', 'Mobile Development', 'Senior iOS developer'),
('JobRole', 'Android Developer', 'Mobile Development', 'Android application developer'),
('JobRole', 'Senior Android Developer', 'Mobile Development', 'Senior Android developer'),
('JobRole', 'React Native Developer', 'Mobile Development', 'React Native specialist'),
('JobRole', 'Flutter Developer', 'Mobile Development', 'Flutter framework specialist'),
('JobRole', 'Mobile Application Developer', 'Mobile Development', 'General mobile app developer'),
-- Data
('JobRole', 'Data Engineer', 'Data Engineering', 'Builds data pipelines and infrastructure'),
('JobRole', 'Senior Data Engineer', 'Data Engineering', 'Experienced data engineer'),
('JobRole', 'Data Scientist', 'Data Science', 'Analyzes data and builds ML models'),
('JobRole', 'Senior Data Scientist', 'Data Science', 'Experienced data scientist'),
('JobRole', 'Lead Data Scientist', 'Data Science', 'Leads data science projects'),
('JobRole', 'Data Analyst', 'Data Analytics', 'Analyzes and interprets data'),
('JobRole', 'Senior Data Analyst', 'Data Analytics', 'Experienced data analyst'),
('JobRole', 'Business Intelligence Analyst', 'Data Analytics', 'BI and reporting specialist'),
('JobRole', 'Machine Learning Engineer', 'Machine Learning', 'ML model development and deployment'),
('JobRole', 'Senior Machine Learning Engineer', 'Machine Learning', 'Experienced ML engineer'),
('JobRole', 'AI Engineer', 'Artificial Intelligence', 'AI systems developer'),
('JobRole', 'ML Ops Engineer', 'Machine Learning', 'ML operations and deployment specialist'),
('JobRole', 'Data Architect', 'Data Engineering', 'Designs data architecture'),
-- DevOps & Cloud
('JobRole', 'DevOps Engineer', 'DevOps', 'Development and operations automation'),
('JobRole', 'Senior DevOps Engineer', 'DevOps', 'Experienced DevOps engineer'),
('JobRole', 'Cloud Engineer', 'Cloud Computing', 'Cloud infrastructure specialist'),
('JobRole', 'Senior Cloud Engineer', 'Cloud Computing', 'Experienced cloud engineer'),
('JobRole', 'AWS Engineer', 'Cloud Computing', 'Amazon Web Services specialist'),
('JobRole', 'Azure Engineer', 'Cloud Computing', 'Microsoft Azure specialist'),
('JobRole', 'GCP Engineer', 'Cloud Computing', 'Google Cloud Platform specialist'),
('JobRole', 'Cloud Architect', 'Cloud Computing', 'Designs cloud solutions'),
('JobRole', 'Site Reliability Engineer', 'DevOps', 'SRE - maintains system reliability'),
('JobRole', 'Senior Site Reliability Engineer', 'DevOps', 'Experienced SRE'),
('JobRole', 'Platform Engineer', 'DevOps', 'Builds and maintains platforms'),
('JobRole', 'Infrastructure Engineer', 'Infrastructure', 'IT infrastructure specialist'),
('JobRole', 'Release Engineer', 'DevOps', 'Manages software releases'),
-- QA & Testing
('JobRole', 'QA Engineer', 'Quality Assurance', 'Quality assurance specialist'),
('JobRole', 'Senior QA Engineer', 'Quality Assurance', 'Experienced QA engineer'),
('JobRole', 'Test Engineer', 'Testing', 'Software testing specialist'),
('JobRole', 'Senior Test Engineer', 'Testing', 'Experienced test engineer'),
('JobRole', 'Automation Test Engineer', 'Testing', 'Test automation specialist'),
('JobRole', 'SDET', 'Testing', 'Software Development Engineer in Test'),
('JobRole', 'Senior SDET', 'Testing', 'Senior test automation engineer'),
('JobRole', 'QA Analyst', 'Quality Assurance', 'Quality analysis specialist'),
('JobRole', 'Performance Test Engineer', 'Testing', 'Performance testing specialist'),
('JobRole', 'Security Test Engineer', 'Testing', 'Security testing specialist'),
-- Security
('JobRole', 'Security Engineer', 'Cybersecurity', 'Information security specialist'),
('JobRole', 'Senior Security Engineer', 'Cybersecurity', 'Experienced security engineer'),
('JobRole', 'Cybersecurity Analyst', 'Cybersecurity', 'Analyzes security threats'),
('JobRole', 'Information Security Analyst', 'Cybersecurity', 'InfoSec specialist'),
('JobRole', 'Security Architect', 'Cybersecurity', 'Designs security architecture'),
('JobRole', 'Penetration Tester', 'Cybersecurity', 'Ethical hacking specialist'),
('JobRole', 'Security Operations Analyst', 'Cybersecurity', 'SOC analyst'),
('JobRole', 'Application Security Engineer', 'Cybersecurity', 'AppSec specialist'),
('JobRole', 'Cloud Security Engineer', 'Cybersecurity', 'Cloud security specialist'),
-- Database
('JobRole', 'Database Administrator', 'Database', 'Manages databases'),
('JobRole', 'Senior Database Administrator', 'Database', 'Experienced DBA'),
('JobRole', 'Database Engineer', 'Database', 'Database systems engineer'),
('JobRole', 'SQL Developer', 'Database', 'SQL specialist'),
('JobRole', 'Database Architect', 'Database', 'Designs database systems'),
-- Design
('JobRole', 'UI Designer', 'Design', 'User interface designer'),
('JobRole', 'Senior UI Designer', 'Design', 'Experienced UI designer'),
('JobRole', 'UX Designer', 'Design', 'User experience designer'),
('JobRole', 'Senior UX Designer', 'Design', 'Experienced UX designer'),
('JobRole', 'UI/UX Designer', 'Design', 'Combined UI and UX designer'),
('JobRole', 'Product Designer', 'Design', 'Product-focused designer'),
('JobRole', 'Senior Product Designer', 'Design', 'Experienced product designer'),
('JobRole', 'Visual Designer', 'Design', 'Visual design specialist'),
('JobRole', 'Interaction Designer', 'Design', 'Interaction design specialist'),
('JobRole', 'UX Researcher', 'Design', 'User experience research specialist'),
-- Product & Project Management
('JobRole', 'Product Manager', 'Product Management', 'Manages product development'),
('JobRole', 'Senior Product Manager', 'Product Management', 'Experienced product manager'),
('JobRole', 'Technical Product Manager', 'Product Management', 'Technical PM'),
('JobRole', 'Product Owner', 'Product Management', 'Agile product owner'),
('JobRole', 'Associate Product Manager', 'Product Management', 'Entry-level PM'),
('JobRole', 'Group Product Manager', 'Product Management', 'Manages multiple PMs'),
('JobRole', 'Director of Product', 'Product Management', 'Product leadership role'),
('JobRole', 'VP of Product', 'Product Management', 'Executive product leadership'),
('JobRole', 'Project Manager', 'Project Management', 'Manages projects'),
('JobRole', 'Senior Project Manager', 'Project Management', 'Experienced project manager'),
('JobRole', 'Technical Project Manager', 'Project Management', 'Technical PM'),
('JobRole', 'Program Manager', 'Project Management', 'Manages multiple projects'),
('JobRole', 'Senior Program Manager', 'Project Management', 'Experienced program manager'),
('JobRole', 'Scrum Master', 'Agile', 'Agile scrum facilitator'),
('JobRole', 'Agile Coach', 'Agile', 'Agile methodology coach'),
-- Engineering Management
('JobRole', 'Engineering Manager', 'Management', 'Manages engineering teams'),
('JobRole', 'Senior Engineering Manager', 'Management', 'Experienced engineering manager'),
('JobRole', 'Director of Engineering', 'Management', 'Engineering leadership'),
('JobRole', 'VP of Engineering', 'Management', 'Executive engineering leadership'),
('JobRole', 'CTO', 'Management', 'Chief Technology Officer'),
('JobRole', 'Head of Engineering', 'Management', 'Engineering department head'),
('JobRole', 'Technical Lead', 'Management', 'Technical team lead'),
('JobRole', 'Team Lead', 'Management', 'Team leadership role'),
-- Business & Consulting
('JobRole', 'Business Analyst', 'Business Analysis', 'Analyzes business requirements'),
('JobRole', 'Senior Business Analyst', 'Business Analysis', 'Experienced business analyst'),
('JobRole', 'Systems Analyst', 'Business Analysis', 'Systems analysis specialist'),
('JobRole', 'IT Consultant', 'Consulting', 'IT consulting professional'),
('JobRole', 'Technical Consultant', 'Consulting', 'Technical consulting specialist'),
('JobRole', 'Management Consultant', 'Consulting', 'Business management consultant'),
-- Support & Operations
('JobRole', 'Technical Support Engineer', 'Support', 'Technical support specialist'),
('JobRole', 'Customer Support Engineer', 'Support', 'Customer-facing support'),
('JobRole', 'IT Support Specialist', 'Support', 'IT help desk specialist'),
('JobRole', 'System Administrator', 'Operations', 'System administration specialist'),
('JobRole', 'Network Engineer', 'Networking', 'Network infrastructure specialist'),
('JobRole', 'Network Administrator', 'Networking', 'Network management specialist'),
-- Specialized
('JobRole', 'Blockchain Developer', 'Blockchain', 'Blockchain technology specialist'),
('JobRole', 'Embedded Systems Engineer', 'Embedded Systems', 'Embedded software developer'),
('JobRole', 'IoT Engineer', 'IoT', 'Internet of Things specialist'),
('JobRole', 'Game Developer', 'Gaming', 'Video game developer'),
('JobRole', 'Unity Developer', 'Gaming', 'Unity game engine specialist'),
('JobRole', 'AR/VR Developer', 'AR/VR', 'Augmented/Virtual reality developer'),
('JobRole', 'Computer Vision Engineer', 'Computer Vision', 'Computer vision specialist'),
('JobRole', 'NLP Engineer', 'Natural Language Processing', 'NLP specialist'),
('JobRole', 'Robotics Engineer', 'Robotics', 'Robotics specialist');

-- Merge Job Roles
MERGE ReferenceMetadata AS target
USING #RefData AS source
ON target.RefType = source.RefType AND target.Value = source.Value
WHEN NOT MATCHED THEN
    INSERT (RefType, Value, Category, Description)
    VALUES (source.RefType, source.Value, source.Category, source.Description);

DECLARE @JobRoleCount INT = (SELECT COUNT(*) FROM #RefData WHERE RefType = 'JobRole');
PRINT '? ' + CAST(@JobRoleCount AS NVARCHAR(10)) + ' Job Roles processed';

-- Clear temp table
TRUNCATE TABLE #RefData;

-- ============================================================================
-- SKILLS & TECHNOLOGIES
-- ============================================================================
PRINT 'Inserting Skills & Technologies...';

INSERT INTO #RefData (RefType, Value, Category, Description) VALUES
-- Programming Languages
('Skill', 'JavaScript', 'Programming Language', 'Popular web programming language'),
('Skill', 'Python', 'Programming Language', 'Versatile programming language'),
('Skill', 'Java', 'Programming Language', 'Enterprise programming language'),
('Skill', 'C++', 'Programming Language', 'High-performance programming'),
('Skill', 'C#', 'Programming Language', 'Microsoft .NET language'),
('Skill', 'C', 'Programming Language', 'Low-level programming language'),
('Skill', 'TypeScript', 'Programming Language', 'Typed JavaScript superset'),
('Skill', 'Go', 'Programming Language', 'Google programming language'),
('Skill', 'Rust', 'Programming Language', 'Systems programming language'),
('Skill', 'Swift', 'Programming Language', 'iOS programming language'),
('Skill', 'Kotlin', 'Programming Language', 'Android programming language'),
('Skill', 'Ruby', 'Programming Language', 'Dynamic programming language'),
('Skill', 'PHP', 'Programming Language', 'Web development language'),
('Skill', 'R', 'Programming Language', 'Statistical programming'),
('Skill', 'Scala', 'Programming Language', 'JVM functional language'),
('Skill', 'Perl', 'Programming Language', 'Scripting language'),
('Skill', 'Dart', 'Programming Language', 'Flutter programming language'),
('Skill', 'Objective-C', 'Programming Language', 'iOS legacy language'),
('Skill', 'MATLAB', 'Programming Language', 'Mathematical computing'),
('Skill', 'Groovy', 'Programming Language', 'JVM scripting language'),
-- Frontend
('Skill', 'React', 'Frontend Framework', 'Facebook UI library'),
('Skill', 'React.js', 'Frontend Framework', 'Facebook UI library'),
('Skill', 'Angular', 'Frontend Framework', 'Google framework'),
('Skill', 'Vue.js', 'Frontend Framework', 'Progressive framework'),
('Skill', 'Next.js', 'Frontend Framework', 'React framework'),
('Skill', 'Nuxt.js', 'Frontend Framework', 'Vue framework'),
('Skill', 'Svelte', 'Frontend Framework', 'Compiler framework'),
('Skill', 'jQuery', 'Frontend Library', 'JavaScript library'),
('Skill', 'HTML', 'Frontend', 'Markup language'),
('Skill', 'HTML5', 'Frontend', 'Modern HTML'),
('Skill', 'CSS', 'Frontend', 'Styling language'),
('Skill', 'CSS3', 'Frontend', 'Modern CSS'),
('Skill', 'SASS', 'Frontend', 'CSS preprocessor'),
('Skill', 'SCSS', 'Frontend', 'CSS preprocessor'),
('Skill', 'LESS', 'Frontend', 'CSS preprocessor'),
('Skill', 'Tailwind CSS', 'Frontend', 'Utility-first CSS'),
('Skill', 'Bootstrap', 'Frontend', 'CSS framework'),
('Skill', 'Material-UI', 'Frontend', 'React UI framework'),
('Skill', 'Ant Design', 'Frontend', 'React UI framework'),
('Skill', 'Webpack', 'Frontend Build', 'Module bundler'),
('Skill', 'Vite', 'Frontend Build', 'Build tool'),
('Skill', 'Babel', 'Frontend Build', 'JavaScript compiler'),
-- Backend
('Skill', 'Node.js', 'Backend', 'JavaScript runtime'),
('Skill', 'Express.js', 'Backend Framework', 'Node.js framework'),
('Skill', 'Django', 'Backend Framework', 'Python framework'),
('Skill', 'Flask', 'Backend Framework', 'Python microframework'),
('Skill', 'FastAPI', 'Backend Framework', 'Python async framework'),
('Skill', 'Spring Boot', 'Backend Framework', 'Java framework'),
('Skill', 'Spring', 'Backend Framework', 'Java framework'),
('Skill', 'ASP.NET', 'Backend Framework', '.NET framework'),
('Skill', '.NET Core', 'Backend Framework', '.NET framework'),
('Skill', 'Ruby on Rails', 'Backend Framework', 'Ruby framework'),
('Skill', 'Laravel', 'Backend Framework', 'PHP framework'),
('Skill', 'Symfony', 'Backend Framework', 'PHP framework'),
('Skill', 'NestJS', 'Backend Framework', 'Node.js framework'),
('Skill', 'Fastify', 'Backend Framework', 'Node.js framework'),
('Skill', 'Koa', 'Backend Framework', 'Node.js framework'),
('Skill', 'Gin', 'Backend Framework', 'Go framework'),
('Skill', 'Echo', 'Backend Framework', 'Go framework'),
('Skill', 'gRPC', 'Backend', 'RPC framework'),
('Skill', 'GraphQL', 'Backend', 'Query language'),
('Skill', 'REST API', 'Backend', 'API design'),
('Skill', 'RESTful API', 'Backend', 'API design'),
('Skill', 'Microservices', 'Backend Architecture', 'Architecture pattern'),
-- Mobile
('Skill', 'React Native', 'Mobile', 'Cross-platform framework'),
('Skill', 'Flutter', 'Mobile', 'Cross-platform framework'),
('Skill', 'iOS Development', 'Mobile', 'iOS platform'),
('Skill', 'Android Development', 'Mobile', 'Android platform'),
('Skill', 'SwiftUI', 'Mobile', 'iOS UI framework'),
('Skill', 'Jetpack Compose', 'Mobile', 'Android UI framework'),
('Skill', 'Xamarin', 'Mobile', 'Cross-platform framework'),
('Skill', 'Ionic', 'Mobile', 'Hybrid mobile framework'),
-- Databases
('Skill', 'SQL', 'Database', 'Query language'),
('Skill', 'MySQL', 'Database', 'Relational database'),
('Skill', 'PostgreSQL', 'Database', 'Advanced relational database'),
('Skill', 'MongoDB', 'Database', 'NoSQL document database'),
('Skill', 'Redis', 'Database', 'In-memory data store'),
('Skill', 'Oracle Database', 'Database', 'Enterprise database'),
('Skill', 'Microsoft SQL Server', 'Database', 'Microsoft database'),
('Skill', 'SQLite', 'Database', 'Embedded database'),
('Skill', 'Cassandra', 'Database', 'NoSQL distributed database'),
('Skill', 'DynamoDB', 'Database', 'AWS NoSQL database'),
('Skill', 'Elasticsearch', 'Database', 'Search engine'),
('Skill', 'CouchDB', 'Database', 'NoSQL database'),
('Skill', 'Neo4j', 'Database', 'Graph database'),
('Skill', 'MariaDB', 'Database', 'MySQL fork'),
('Skill', 'Firebase', 'Database', 'Google backend service'),
-- Cloud
('Skill', 'AWS', 'Cloud Platform', 'Amazon Web Services'),
('Skill', 'Amazon Web Services', 'Cloud Platform', 'AWS'),
('Skill', 'Azure', 'Cloud Platform', 'Microsoft Azure'),
('Skill', 'Microsoft Azure', 'Cloud Platform', 'Azure'),
('Skill', 'Google Cloud Platform', 'Cloud Platform', 'GCP'),
('Skill', 'GCP', 'Cloud Platform', 'Google Cloud'),
('Skill', 'AWS Lambda', 'Cloud Service', 'Serverless compute'),
('Skill', 'AWS EC2', 'Cloud Service', 'Virtual servers'),
('Skill', 'AWS S3', 'Cloud Service', 'Object storage'),
('Skill', 'Azure Functions', 'Cloud Service', 'Serverless compute'),
('Skill', 'Google Cloud Functions', 'Cloud Service', 'Serverless compute'),
('Skill', 'Heroku', 'Cloud Platform', 'PaaS platform'),
('Skill', 'DigitalOcean', 'Cloud Platform', 'Cloud provider'),
('Skill', 'Vercel', 'Cloud Platform', 'Frontend hosting'),
('Skill', 'Netlify', 'Cloud Platform', 'Frontend hosting'),
-- DevOps
('Skill', 'Docker', 'DevOps', 'Containerization'),
('Skill', 'Kubernetes', 'DevOps', 'Container orchestration'),
('Skill', 'Jenkins', 'CI/CD', 'Automation server'),
('Skill', 'GitLab CI/CD', 'CI/CD', 'GitLab automation'),
('Skill', 'GitHub Actions', 'CI/CD', 'GitHub automation'),
('Skill', 'CircleCI', 'CI/CD', 'CI/CD platform'),
('Skill', 'Travis CI', 'CI/CD', 'CI/CD service'),
('Skill', 'Terraform', 'Infrastructure as Code', 'IaC tool'),
('Skill', 'Ansible', 'Configuration Management', 'Automation tool'),
('Skill', 'Chef', 'Configuration Management', 'Automation platform'),
('Skill', 'Puppet', 'Configuration Management', 'Automation software'),
('Skill', 'Vagrant', 'DevOps', 'Development environments'),
('Skill', 'Nginx', 'DevOps', 'Web server'),
('Skill', 'Apache', 'DevOps', 'Web server'),
('Skill', 'Linux', 'Operating System', 'Unix-like OS'),
('Skill', 'Unix', 'Operating System', 'Operating system'),
('Skill', 'Bash', 'Scripting', 'Shell scripting'),
('Skill', 'Shell Scripting', 'Scripting', 'Command-line scripting'),
('Skill', 'PowerShell', 'Scripting', 'Windows scripting'),
-- Data Science & ML
('Skill', 'Machine Learning', 'Data Science', 'ML techniques'),
('Skill', 'Deep Learning', 'Data Science', 'Neural networks'),
('Skill', 'TensorFlow', 'ML Framework', 'Google ML framework'),
('Skill', 'PyTorch', 'ML Framework', 'Facebook ML framework'),
('Skill', 'Keras', 'ML Framework', 'High-level neural networks'),
('Skill', 'scikit-learn', 'ML Library', 'Python ML library'),
('Skill', 'Pandas', 'Data Analysis', 'Python data library'),
('Skill', 'NumPy', 'Data Analysis', 'Numerical computing'),
('Skill', 'Matplotlib', 'Data Visualization', 'Python plotting'),
('Skill', 'Seaborn', 'Data Visualization', 'Statistical visualization'),
('Skill', 'Tableau', 'Data Visualization', 'BI tool'),
('Skill', 'Power BI', 'Data Visualization', 'Microsoft BI tool'),
('Skill', 'Apache Spark', 'Big Data', 'Data processing'),
('Skill', 'Hadoop', 'Big Data', 'Distributed storage'),
('Skill', 'Kafka', 'Big Data', 'Stream processing'),
('Skill', 'Airflow', 'Data Engineering', 'Workflow management'),
('Skill', 'Databricks', 'Data Platform', 'Analytics platform'),
('Skill', 'Snowflake', 'Data Warehouse', 'Cloud data warehouse'),
('Skill', 'Data Mining', 'Data Science', 'Data extraction'),
('Skill', 'Statistical Analysis', 'Data Science', 'Statistics'),
('Skill', 'Natural Language Processing', 'AI', 'NLP'),
('Skill', 'Computer Vision', 'AI', 'Image processing'),
('Skill', 'Neural Networks', 'AI', 'Deep learning models'),
-- Testing
('Skill', 'Selenium', 'Testing', 'Test automation'),
('Skill', 'Jest', 'Testing', 'JavaScript testing'),
('Skill', 'Mocha', 'Testing', 'JavaScript testing'),
('Skill', 'Cypress', 'Testing', 'E2E testing'),
('Skill', 'Playwright', 'Testing', 'Browser automation'),
('Skill', 'JUnit', 'Testing', 'Java testing'),
('Skill', 'pytest', 'Testing', 'Python testing'),
('Skill', 'TestNG', 'Testing', 'Testing framework'),
('Skill', 'Postman', 'Testing', 'API testing'),
('Skill', 'JMeter', 'Testing', 'Performance testing'),
('Skill', 'LoadRunner', 'Testing', 'Performance testing'),
('Skill', 'Appium', 'Testing', 'Mobile testing'),
('Skill', 'Test Automation', 'Testing', 'Automated testing'),
('Skill', 'Unit Testing', 'Testing', 'Unit tests'),
('Skill', 'Integration Testing', 'Testing', 'Integration tests'),
('Skill', 'End-to-End Testing', 'Testing', 'E2E tests'),
-- Version Control
('Skill', 'Git', 'Version Control', 'Version control system'),
('Skill', 'GitHub', 'Version Control', 'Git hosting'),
('Skill', 'GitLab', 'Version Control', 'Git platform'),
('Skill', 'Bitbucket', 'Version Control', 'Git repository'),
('Skill', 'SVN', 'Version Control', 'Apache Subversion'),
('Skill', 'Mercurial', 'Version Control', 'Version control'),
-- Security
('Skill', 'Cybersecurity', 'Security', 'Information security'),
('Skill', 'Network Security', 'Security', 'Network protection'),
('Skill', 'Application Security', 'Security', 'AppSec'),
('Skill', 'Penetration Testing', 'Security', 'Ethical hacking'),
('Skill', 'Security Auditing', 'Security', 'Security assessment'),
('Skill', 'OWASP', 'Security', 'Security standards'),
('Skill', 'Encryption', 'Security', 'Data encryption'),
('Skill', 'OAuth', 'Security', 'Authorization framework'),
('Skill', 'JWT', 'Security', 'JSON Web Tokens'),
('Skill', 'SSL/TLS', 'Security', 'Secure communication'),
-- Methodologies
('Skill', 'Agile', 'Methodology', 'Agile development'),
('Skill', 'Scrum', 'Methodology', 'Scrum framework'),
('Skill', 'Kanban', 'Methodology', 'Kanban method'),
('Skill', 'Waterfall', 'Methodology', 'Traditional SDLC'),
('Skill', 'DevOps', 'Methodology', 'DevOps practices'),
('Skill', 'CI/CD', 'Methodology', 'Continuous integration/delivery'),
('Skill', 'Test-Driven Development', 'Methodology', 'TDD'),
('Skill', 'Behavior-Driven Development', 'Methodology', 'BDD'),
('Skill', 'Domain-Driven Design', 'Methodology', 'DDD'),
-- Soft Skills
('Skill', 'Communication', 'Soft Skill', 'Effective communication'),
('Skill', 'Leadership', 'Soft Skill', 'Team leadership'),
('Skill', 'Problem Solving', 'Soft Skill', 'Analytical thinking'),
('Skill', 'Team Collaboration', 'Soft Skill', 'Teamwork'),
('Skill', 'Time Management', 'Soft Skill', 'Productivity'),
('Skill', 'Critical Thinking', 'Soft Skill', 'Analytical skills'),
('Skill', 'Mentoring', 'Soft Skill', 'Coaching others'),
('Skill', 'Presentation', 'Soft Skill', 'Public speaking'),
('Skill', 'Project Management', 'Soft Skill', 'Managing projects'),
('Skill', 'Stakeholder Management', 'Soft Skill', 'Managing relationships');

-- Merge Skills
MERGE ReferenceMetadata AS target
USING #RefData AS source
ON target.RefType = source.RefType AND target.Value = source.Value
WHEN NOT MATCHED THEN
    INSERT (RefType, Value, Category, Description)
    VALUES (source.RefType, source.Value, source.Category, source.Description);

DECLARE @SkillCount INT = (SELECT COUNT(*) FROM #RefData WHERE RefType = 'Skill');
PRINT '? ' + CAST(@SkillCount AS NVARCHAR(10)) + ' Skills processed';

-- Clear temp table
TRUNCATE TABLE #RefData;

-- ============================================================================
-- CERTIFICATIONS
-- ============================================================================
PRINT 'Inserting Certifications...';

INSERT INTO #RefData (RefType, Value, Category, Description) VALUES
('Certification', 'AWS Certified Solutions Architect', 'Cloud', 'AWS architecture certification'),
('Certification', 'AWS Certified Developer', 'Cloud', 'AWS developer certification'),
('Certification', 'AWS Certified DevOps Engineer', 'Cloud', 'AWS DevOps certification'),
('Certification', 'Microsoft Azure Administrator', 'Cloud', 'Azure admin certification'),
('Certification', 'Microsoft Azure Developer', 'Cloud', 'Azure developer certification'),
('Certification', 'Google Cloud Professional', 'Cloud', 'GCP certification'),
('Certification', 'CISSP', 'Security', 'Security professional certification'),
('Certification', 'CEH', 'Security', 'Ethical hacker certification'),
('Certification', 'CompTIA Security+', 'Security', 'Security fundamentals'),
('Certification', 'CISM', 'Security', 'Security manager certification'),
('Certification', 'PMP', 'Project Management', 'Project management professional'),
('Certification', 'Scrum Master', 'Agile', 'Certified Scrum Master'),
('Certification', 'Product Owner', 'Agile', 'Certified Product Owner'),
('Certification', 'Oracle Certified Java Programmer', 'Programming', 'Java certification'),
('Certification', 'Microsoft Certified', 'Programming', '.NET certification'),
('Certification', 'Certified Data Scientist', 'Data Science', 'Data science certification'),
('Certification', 'Tableau Certified', 'Data Visualization', 'Tableau certification');

MERGE ReferenceMetadata AS target
USING #RefData AS source
ON target.RefType = source.RefType AND target.Value = source.Value
WHEN NOT MATCHED THEN
    INSERT (RefType, Value, Category, Description)
    VALUES (source.RefType, source.Value, source.Category, source.Description);

DECLARE @CertCount INT = (SELECT COUNT(*) FROM #RefData WHERE RefType = 'Certification');
PRINT '? ' + CAST(@CertCount AS NVARCHAR(10)) + ' Certifications processed';

TRUNCATE TABLE #RefData;

-- ============================================================================
-- JOB TYPES (from JobTypes table)
-- ============================================================================
PRINT 'Inserting Job Types...';

INSERT INTO #RefData (RefType, Value, Category, Description) VALUES
('JobType', 'Full-time', 'Employment Type', 'Full-time permanent position'),
('JobType', 'Part-time', 'Employment Type', 'Part-time position'),
('JobType', 'Contract', 'Employment Type', 'Contract-based position'),
('JobType', 'Freelance', 'Employment Type', 'Freelance work'),
('JobType', 'Internship', 'Employment Type', 'Internship position'),
('JobType', 'Temporary', 'Employment Type', 'Temporary position');

MERGE ReferenceMetadata AS target
USING #RefData AS source
ON target.RefType = source.RefType AND target.Value = source.Value
WHEN NOT MATCHED THEN
    INSERT (RefType, Value, Category, Description)
    VALUES (source.RefType, source.Value, source.Category, source.Description);

DECLARE @JobTypeCount INT = (SELECT COUNT(*) FROM #RefData WHERE RefType = 'JobType');
PRINT '? ' + CAST(@JobTypeCount AS NVARCHAR(10)) + ' Job Types processed';

TRUNCATE TABLE #RefData;

-- ============================================================================
-- WORKPLACE TYPES (from WorkplaceTypes table)
-- ============================================================================
PRINT 'Inserting Workplace Types...';

INSERT INTO #RefData (RefType, Value, Category, Description) VALUES
('WorkplaceType', 'Onsite', 'Work Arrangement', 'In-office work'),
('WorkplaceType', 'Remote', 'Work Arrangement', 'Fully remote'),
('WorkplaceType', 'Hybrid', 'Work Arrangement', 'Mix of onsite and remote');

MERGE ReferenceMetadata AS target
USING #RefData AS source
ON target.RefType = source.RefType AND target.Value = source.Value
WHEN NOT MATCHED THEN
    INSERT (RefType, Value, Category, Description)
    VALUES (source.RefType, source.Value, source.Category, source.Description);

DECLARE @WorkplaceTypeCount INT = (SELECT COUNT(*) FROM #RefData WHERE RefType = 'WorkplaceType');
PRINT '? ' + CAST(@WorkplaceTypeCount AS NVARCHAR(10)) + ' Workplace Types processed';

TRUNCATE TABLE #RefData;

-- ============================================================================
-- INDUSTRIES
-- ============================================================================
PRINT 'Inserting Industries...';

INSERT INTO #RefData (RefType, Value, Category, Description) VALUES
('Industry', 'Technology', NULL, 'IT and software industry'),
('Industry', 'Finance', NULL, 'Financial services'),
('Industry', 'Healthcare', NULL, 'Healthcare and medical'),
('Industry', 'E-commerce', NULL, 'Online retail'),
('Industry', 'Education', NULL, 'Educational services'),
('Industry', 'Consulting', NULL, 'Business consulting'),
('Industry', 'Manufacturing', NULL, 'Production industry'),
('Industry', 'Retail', NULL, 'Retail business'),
('Industry', 'Telecommunications', NULL, 'Telecom industry'),
('Industry', 'Media & Entertainment', NULL, 'Media industry'),
('Industry', 'Automotive', NULL, 'Automobile industry'),
('Industry', 'Energy', NULL, 'Energy sector'),
('Industry', 'Real Estate', NULL, 'Property industry'),
('Industry', 'Travel & Hospitality', NULL, 'Travel industry'),
('Industry', 'Insurance', NULL, 'Insurance sector'),
('Industry', 'Banking', NULL, 'Banking sector'),
('Industry', 'Logistics', NULL, 'Supply chain & logistics'),
('Industry', 'Gaming', NULL, 'Video game industry'),
('Industry', 'Biotechnology', NULL, 'Biotech industry'),
('Industry', 'Aerospace', NULL, 'Aerospace industry');

MERGE ReferenceMetadata AS target
USING #RefData AS source
ON target.RefType = source.RefType AND target.Value = source.Value
WHEN NOT MATCHED THEN
    INSERT (RefType, Value, Category, Description)
    VALUES (source.RefType, source.Value, source.Category, source.Description);

DECLARE @IndustryCount INT = (SELECT COUNT(*) FROM #RefData WHERE RefType = 'Industry');
PRINT '? ' + CAST(@IndustryCount AS NVARCHAR(10)) + ' Industries processed';

TRUNCATE TABLE #RefData;

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================
PRINT 'Inserting Departments...';

INSERT INTO #RefData (RefType, Value, Category, Description) VALUES
('Department', 'Engineering', NULL, 'Software engineering department'),
('Department', 'Product', NULL, 'Product management'),
('Department', 'Design', NULL, 'Design team'),
('Department', 'Data Science', NULL, 'Data and analytics'),
('Department', 'DevOps', NULL, 'DevOps and infrastructure'),
('Department', 'Quality Assurance', NULL, 'QA and testing'),
('Department', 'Security', NULL, 'Information security'),
('Department', 'IT Operations', NULL, 'IT operations'),
('Department', 'Research & Development', NULL, 'R&D'),
('Department', 'Customer Support', NULL, 'Customer service'),
('Department', 'Sales', NULL, 'Sales department'),
('Department', 'Marketing', NULL, 'Marketing team'),
('Department', 'Human Resources', NULL, 'HR department'),
('Department', 'Finance', NULL, 'Finance department'),
('Department', 'Legal', NULL, 'Legal department'),
('Department', 'Operations', NULL, 'Business operations'),
('Department', 'Consulting', NULL, 'Consulting services');

MERGE ReferenceMetadata AS target
USING #RefData AS source
ON target.RefType = source.RefType AND target.Value = source.Value
WHEN NOT MATCHED THEN
    INSERT (RefType, Value, Category, Description)
    VALUES (source.RefType, source.Value, source.Category, source.Description);

DECLARE @DeptCount INT = (SELECT COUNT(*) FROM #RefData WHERE RefType = 'Department');
PRINT '? ' + CAST(@DeptCount AS NVARCHAR(10)) + ' Departments processed';

-- Cleanup
DROP TABLE #RefData;

PRINT '';
PRINT '============================================================================';
PRINT 'Reference Metadata Setup Complete!';
PRINT '============================================================================';
PRINT '';
SELECT RefType, COUNT(*) as Count 
FROM ReferenceMetadata 
WHERE IsActive = 1
GROUP BY RefType 
ORDER BY RefType;
PRINT '';
DECLARE @TotalCount INT = (SELECT COUNT(*) FROM ReferenceMetadata WHERE IsActive = 1);
PRINT 'Total Active Records: ' + CAST(@TotalCount AS NVARCHAR(10));
PRINT '';
PRINT '? All reference data is ready for use!';
GO
