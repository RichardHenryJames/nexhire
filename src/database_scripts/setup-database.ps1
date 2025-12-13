# RefOpen Database Schema Deployment Script
# This script creates all required database tables and populates reference data

param(
    [string]$ConnectionString = "Server=refopen-sqlserver-ci.database.windows.net;Database=refopen-sql-db;User ID=sqladmin;Password=RefOpen@2024!Secure;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host " Setting up RefOpen Database Schema..." -ForegroundColor Green

# Install SqlServer module if not present
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host " Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

# Database Schema SQL
$schemaSQL = @"
-- Create Currencies table (Reference Data)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Currencies')
BEGIN
    CREATE TABLE Currencies (
        CurrencyID int IDENTITY(1,1) PRIMARY KEY,
        Code nvarchar(3) NOT NULL,
        Name nvarchar(100) NOT NULL,
        Symbol nvarchar(10),
        IsActive bit DEFAULT 1,
        CreatedAt datetime2 DEFAULT GETUTCDATE()
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Organizations')
BEGIN
    CREATE TABLE Organizations (
        OrganizationID INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL UNIQUE,
        Type nvarchar(50), -- Pvt Ltd, Govt, NGO, Startup
        Industry nvarchar(100),
        Size nvarchar(20),
        Website nvarchar(500),
        LinkedInProfile nvarchar(500),
        Description nvarchar(max),
        LogoURL nvarchar(1000),
        VerificationStatus tinyint DEFAULT 0,  -- 0=Pending, 1=Verified, 2=Rejected
        VerifiedAt datetime2 NULL,
        VerifiedBy uniqueidentifier NULL,
        EstablishedDate date,
        Headquarters nvarchar(255),
        ContactEmail nvarchar(320),
        ContactPhone nvarchar(20),
        Rating decimal(3,2),
        CreatedAt datetime2 DEFAULT GETUTCDATE(),
        UpdatedAt datetime2 DEFAULT GETUTCDATE(),
        CreatedBy uniqueidentifier NULL,
        UpdatedBy uniqueidentifier NULL,
        IsActive bit DEFAULT 1
    );
END

-- Create Users table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        UserID uniqueidentifier PRIMARY KEY DEFAULT NEWID(),
        GoogleId NVARCHAR(100) NULL,
        Email nvarchar(320) UNIQUE NOT NULL,
        Password nvarchar(255) NOT NULL,
        LoginMethod NVARCHAR(50) NULL DEFAULT 'Password',
        GoogleAccessToken NVARCHAR(MAX) NULL,
        UserType nvarchar(50) NOT NULL,
        FirstName nvarchar(100) NOT NULL,
        LastName nvarchar(100) NOT NULL,
        Phone nvarchar(20),
        ProfilePictureURL nvarchar(1000),
        DateOfBirth date,
        Gender nvarchar(50),
        EmailVerified bit DEFAULT 0,
        PhoneVerified bit DEFAULT 0,
        LastLoginAt datetime2,
        LastActive datetime2,
        ProfileVisibility nvarchar(50) DEFAULT 'Public',
        CreatedAt datetime2 DEFAULT GETUTCDATE(),
        UpdatedAt datetime2 DEFAULT GETUTCDATE(),
        IsActive bit DEFAULT 1,
        TwoFactorEnabled bit DEFAULT 0,
        LoginAttempts int DEFAULT 0,
        AccountLockoutEnd datetime2
    );

CREATE INDEX IX_Users_GoogleId ON Users(GoogleId) WHERE GoogleId IS NOT NULL;
END

-- Create Applicants table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Applicants')
BEGIN
    CREATE TABLE Applicants (
        ApplicantID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        UserID UNIQUEIDENTIFIER NOT NULL,
        Nationality NVARCHAR(100),
        CurrentLocation NVARCHAR(200),
        PreferredLocations NVARCHAR(500),
        LinkedInProfile NVARCHAR(500),
        PortfolioURL NVARCHAR(500),
        GithubProfile NVARCHAR(500),
        Headline NVARCHAR(200),
        Summary NTEXT,
        CurrentJobTitle NVARCHAR(200) NULL,
        PreferredJobTypes NVARCHAR(500),
        PreferredWorkTypes NVARCHAR(500),
        NoticePeriod INT,
        ImmediatelyAvailable BIT DEFAULT 0,
        WillingToRelocate BIT DEFAULT 0,
        PreferredRoles NTEXT,
        PrimarySkills NTEXT,
        SecondarySkills NTEXT,
        Languages NVARCHAR(500),
        Certifications NTEXT,
        Institution NTEXT,
        HighestEducation NVARCHAR(100),
        FieldOfStudy NVARCHAR(200),
        GraduationYear NVARCHAR(4) NULL,
        GPA NVARCHAR(50) NULL,
        AdditionalDocuments NTEXT,
        AllowRecruitersToContact BIT DEFAULT 1,
        HideCurrentCompany BIT DEFAULT 0,
        HideSalaryDetails BIT DEFAULT 0,
        ProfileCompleteness INT DEFAULT 0,
        IsOpenToWork BIT DEFAULT 1,
        IsFeatured BIT DEFAULT 0,
        FeaturedUntil DATETIME2,
        JobSearchStatus NVARCHAR(100),
        PreferredIndustries NVARCHAR(500),
        MinimumSalary DECIMAL(15,2),
        PreferredCompanySize NVARCHAR(50),
        LastJobAppliedAt DATETIME2,
        SearchScore DECIMAL(10,2),
        Tags NVARCHAR(500),
        TotalExperienceMonths INT NULL,
        CurrentOrganizationID INT NULL,
        CurrentCompanyName NVARCHAR(200) NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        OpenToRefer BIT DEFAULT 0,
        ReferralPoints INT DEFAULT 0,
        FOREIGN KEY (UserID) REFERENCES Users(UserID),
        FOREIGN KEY (CurrentOrganizationID) REFERENCES Organizations(OrganizationID)
    );
END

-- Create ApplicantSalaries table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicantSalaries')
BEGIN
    CREATE TABLE ApplicantSalaries (
        ApplicantSalaryID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        ComponentID INT NOT NULL,
        Amount DECIMAL(18,2) NOT NULL,          -- precision chosen for money-like values
        CurrencyID INT NOT NULL,
        Frequency NVARCHAR(50) NULL,            -- optional, so nullable
        SalaryContext NVARCHAR(50) NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NULL DEFAULT SYSUTCDATETIME(),

        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID),
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
    );

    -- Optional index to speed up lookups by ApplicantID
    CREATE INDEX IX_ApplicantSalaries_ApplicantID ON ApplicantSalaries(ApplicantID);
END


-- Create SalaryComponents table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SalaryComponents')
BEGIN
    CREATE TABLE SalaryComponents (
        ComponentID INT NOT NULL PRIMARY KEY IDENTITY(1,1),
        ComponentName NVARCHAR(100) NOT NULL,
        ComponentType NVARCHAR(50) NOT NULL,   -- e.g., Recurring, OneTime, Equity
        IsActive BIT NULL                      -- optional field (1 = active, 0 = inactive)
    );

    -- Insert default seed data
    INSERT INTO SalaryComponents (ComponentName, ComponentType, IsActive)
    VALUES
        ('Fixed', 'Recurring', 1),
        ('Variable', 'Recurring', 1),
        ('Bonus', 'OneTime', 1),
        ('Stock', 'Equity', 1);
END


-- WorkExperiences table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkExperiences')
BEGIN
    CREATE TABLE WorkExperiences (
        WorkExperienceID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        OrganizationID INT NULL,
        CompanyName NVARCHAR(200) NULL,
        JobTitle NVARCHAR(200) NOT NULL,
        Department NVARCHAR(100) NULL,
        EmploymentType NVARCHAR(50) NULL,
        StartDate DATE NOT NULL,
        EndDate DATE NULL,
        IsCurrent BIT NULL,
        Location NVARCHAR(200) NULL,
        Country NVARCHAR(100) NULL,
        Description NTEXT NULL,
        Skills NVARCHAR(MAX) NULL,
        Achievements NTEXT NULL,
        ReasonForLeaving NVARCHAR(500) NULL,
        Salary DECIMAL(15,2) NULL,
        CurrencyID INT NULL,
        SalaryFrequency NVARCHAR(50) NULL,
        ManagerName NVARCHAR(200) NULL,
        ManagerContact NVARCHAR(200) NULL,
        CanContact BIT DEFAULT 0,
        VerificationStatus TINYINT DEFAULT 0,
        VerifiedAt DATETIME2 NULL,
        VerifiedBy UNIQUEIDENTIFIER NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        IsActive BIT DEFAULT 1,
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID),
        FOREIGN KEY (OrganizationID) REFERENCES Organizations(OrganizationID),
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
    );
END

-- Create Employers table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Employers')
BEGIN
    CREATE TABLE Employers (
        EmployerID uniqueidentifier PRIMARY KEY DEFAULT NEWID(),
        UserID uniqueidentifier NOT NULL,
        OrganizationID int NOT NULL,
        Role nvarchar(50) DEFAULT 'Recruiter',
        IsVerified bit DEFAULT 0,
        JoinedAt datetime2 DEFAULT GETUTCDATE(),
        CreatedBy uniqueidentifier NULL,
        UpdatedBy uniqueidentifier NULL,
        FOREIGN KEY (UserID) REFERENCES Users(UserID),
        FOREIGN KEY (OrganizationID) REFERENCES Organizations(OrganizationID)
    );
END

-- Create JobTypes table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JobTypes')
BEGIN
CREATE TABLE JobTypes (
    JobTypeID INT IDENTITY(1,1) PRIMARY KEY,
    Type NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX IDX_JobTypes_Type ON JobTypes (Type);
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkplaceTypes')
BEGIN
-- Create WorkplaceTypes table (New: Separates work arrangements)
CREATE TABLE WorkplaceTypes (
    WorkplaceTypeID INT IDENTITY(1,1) PRIMARY KEY,
    Type NVARCHAR(50) NOT NULL,
    Description NVARCHAR(200),
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX IDX_WorkplaceTypes_Type ON WorkplaceTypes (Type);
END

-- Create ApplicationStatuses table (Reference Data)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicationStatuses')
BEGIN
CREATE TABLE ApplicationStatuses (
    StatusID INT IDENTITY(1,1) PRIMARY KEY,
    Status NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX IDX_ApplicationStatuses_Status ON ApplicationStatuses (Status);
END

-- Create Jobs table
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Jobs')
    BEGIN
    CREATE TABLE Jobs (
        JobID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        OrganizationID INT NOT NULL,
        PostedByUserID UNIQUEIDENTIFIER NULL,
        ApplicationURL NVARCHAR(500) NULL,
        PostedByType TINYINT NOT NULL DEFAULT 0, -- 0=System, 1=User
        Title NVARCHAR(200) NOT NULL,
        JobTypeID INT NOT NULL,
        WorkplaceTypeID INT NOT NULL,
        Department NVARCHAR(100) NOT NULL,
        Description NVARCHAR(MAX) NOT NULL,
        Responsibilities NVARCHAR(MAX),
        BenefitsOffered NVARCHAR(MAX),
        Location NVARCHAR(200) NOT NULL,
        Country NVARCHAR(100),
        State NVARCHAR(100),
        City NVARCHAR(100),
        PostalCode NVARCHAR(20),
        IsRemote BIT DEFAULT 0,
        RemoteRestrictions NVARCHAR(500),
        SalaryRangeMin DECIMAL(15,2),
        SalaryRangeMax DECIMAL(15,2),
        CurrencyID INT,
        SalaryPeriod NVARCHAR(50),
        CompensationType NVARCHAR(50),
        BonusDetails NVARCHAR(500),
        EquityOffered NVARCHAR(100),
        ProjectDuration NVARCHAR(100),
        ProjectStartDate DATE,
        ProjectEndDate DATE,
        ProjectBudget DECIMAL(15,2),
        ContractExtensionPossible BIT,
        ContractConversionPossible BIT,
        ExperienceMin INT,
        ExperienceMax INT,
        RequiredEducation NVARCHAR(200),
        RequiredLanguages NVARCHAR(500),
        RequiredCertifications NVARCHAR(500),
        Status NVARCHAR(50) DEFAULT 'Draft',
        Priority NVARCHAR(50) DEFAULT 'Normal',
        Visibility NVARCHAR(50) DEFAULT 'Public',
        ApplicationDeadline DATETIMEOFFSET,
        TargetHiringDate DATETIMEOFFSET,
        MaxApplications INT,
        CurrentApplications INT DEFAULT 0,
        InterviewStages NVARCHAR(500),
        InterviewProcess NVARCHAR(500),
        AssessmentRequired BIT DEFAULT 0,
        AssessmentDetails NVARCHAR(MAX),
        PublishedAt DATETIMEOFFSET,
        ExpiresAt DATETIMEOFFSET,
        CreatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        LastBumpedAt DATETIMEOFFSET,
        TimeZone NVARCHAR(100),
        Tags NVARCHAR(1000),
        InternalNotes NVARCHAR(MAX),
        ExternalJobID NVARCHAR(100) NOT NULL,
        SearchScore DECIMAL(10,2),
        FeaturedUntil DATETIMEOFFSET,
        IsArchived BIT DEFAULT 0,
        ViewsCount INT DEFAULT 0,
        CONSTRAINT CHK_SalaryRange CHECK (SalaryRangeMin <= SalaryRangeMax AND SalaryRangeMin >= 0),
        CONSTRAINT CHK_Experience CHECK (ExperienceMin <= ExperienceMax AND ExperienceMin >= 0),
        CONSTRAINT CHK_ApplicationDeadline CHECK (ApplicationDeadline >= CreatedAt),
        FOREIGN KEY (OrganizationID) REFERENCES Organizations(OrganizationID),
        FOREIGN KEY (PostedByUserID) REFERENCES Users(UserID),
        FOREIGN KEY (JobTypeID) REFERENCES JobTypes(JobTypeID),
        FOREIGN KEY (WorkplaceTypeID) REFERENCES WorkplaceTypes(WorkplaceTypeID),
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID),
    );
CREATE INDEX IDX_Jobs_Search ON Jobs (Title, Location, Status, JobTypeID, WorkplaceTypeID);
END

-- New: ApplicantResumes table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicantResumes')
BEGIN
    CREATE TABLE ApplicantResumes (
        ResumeID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        ResumeLabel NVARCHAR(200) NOT NULL, -- e.g. "Tech Resume", "Managerial Resume"
        ResumeURL NVARCHAR(1000) NOT NULL,
        IsPrimary BIT DEFAULT 0, -- optional: mark default resume
        IsDeleted BIT NOT NULL DEFAULT 0,
        DeletedAt DATETIME NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID)
    );
    CREATE INDEX IDX_ApplicantResumes_ApplicantID ON ApplicantResumes(ApplicantID);
END


-- Create JobApplications table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JobApplications')
BEGIN
    CREATE TABLE JobApplications (
        ApplicationID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        JobID UNIQUEIDENTIFIER NOT NULL,
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        ResumeID UNIQUEIDENTIFIER NOT NULL, -- New: FK to ApplicantResumes
        CoverLetter NVARCHAR(MAX),
        ExpectedSalary DECIMAL(15,2),
        ExpectedCurrencyID INT,
        AvailableFromDate DATE,
        StatusID INT NOT NULL DEFAULT 1,
        SubmittedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        LastUpdatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        IsArchived BIT DEFAULT 0,
        CONSTRAINT CHK_ExpectedSalary CHECK (ExpectedSalary >= 0),
        FOREIGN KEY (JobID) REFERENCES Jobs(JobID),
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID),
        FOREIGN KEY (ResumeID) REFERENCES ApplicantResumes(ResumeID),
        FOREIGN KEY (ExpectedCurrencyID) REFERENCES Currencies(CurrencyID),
        FOREIGN KEY (StatusID) REFERENCES ApplicationStatuses(StatusID),
        UNIQUE(JobID, ApplicantID)
    );
    CREATE INDEX IDX_JobApplications_JobStatus ON JobApplications (JobID, StatusID);
    CREATE INDEX IDX_JobApplications_Applicant ON JobApplications (ApplicantID);
END

-- Create ApplicationAttachments table (New: Supports multiple attachments)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicationAttachments')
BEGIN
CREATE TABLE ApplicationAttachments (
    AttachmentID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ApplicationID UNIQUEIDENTIFIER NOT NULL,
    FileURL NVARCHAR(1000) NOT NULL,
    FileType NVARCHAR(50),
    FileDescription NVARCHAR(200),
    UploadedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
    FOREIGN KEY (ApplicationID) REFERENCES JobApplications(ApplicationID)
);
CREATE INDEX IDX_ApplicationAttachments_ApplicationID ON ApplicationAttachments (ApplicationID);
END

-- Create ApplicationTracking table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicationTracking')
BEGIN
CREATE TABLE ApplicationTracking (
    TrackingID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ApplicationID UNIQUEIDENTIFIER NOT NULL,
    StatusID INT NOT NULL,
    ScreeningScore DECIMAL(5,2),
    ScreeningNotes NVARCHAR(MAX),
    InterviewStage INT,
    NextInterviewDate DATETIMEOFFSET,
    InterviewFeedback NVARCHAR(MAX),
    OfferStatus NVARCHAR(100),
    OfferedSalary DECIMAL(15,2),
    OfferedCurrencyID INT,
    OfferLetterURL NVARCHAR(1000),
    OfferExpiryDate DATETIMEOFFSET,
    RejectionReason NVARCHAR(500),
    Notes NVARCHAR(MAX),
    LastUpdatedBy NVARCHAR(100),
    LastUpdatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
    FOREIGN KEY (ApplicationID) REFERENCES JobApplications(ApplicationID),
    FOREIGN KEY (OfferedCurrencyID) REFERENCES Currencies(CurrencyID),
    FOREIGN KEY (StatusID) REFERENCES ApplicationStatuses(StatusID)
);
CREATE INDEX IDX_ApplicationTracking_ApplicationID ON ApplicationTracking (ApplicationID);
END

-- Create SavedJobs table for bookmarks
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SavedJobs')
BEGIN
    CREATE TABLE SavedJobs (
        SavedJobID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        JobID UNIQUEIDENTIFIER NOT NULL,
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        SavedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
        FOREIGN KEY (JobID) REFERENCES Jobs(JobID),
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID),
        CONSTRAINT UQ_SavedJobs UNIQUE (JobID, ApplicantID)
    );
    CREATE INDEX IDX_SavedJobs_Applicant ON SavedJobs (ApplicantID, SavedAt DESC);
END

-- Payment Orders: tracks payment transactions for plans
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PaymentOrders')
BEGIN
    CREATE TABLE PaymentOrders (
        OrderID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ApplicantID UNIQUEIDENTIFIER NOT NULL, -- who is paying
        PlanID INT NOT NULL,                   -- must match ReferralPlans.PlanID type
        Amount DECIMAL(10,2) NOT NULL,
        Currency NVARCHAR(10) NOT NULL,
        Status NVARCHAR(50) DEFAULT 'Pending', -- Pending, Paid, Failed
        PaymentGateway NVARCHAR(50) NULL,      -- e.g. Razorpay, Stripe
        PaymentReference NVARCHAR(200) NULL,   -- gateway transaction id
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        PaidAt DATETIME2 NULL,
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID),
        FOREIGN KEY (PlanID) REFERENCES ReferralPlans(PlanID)
    );
END


-- 2. Payment Transactions Table - Complete transaction log
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='PaymentTransactions')
BEGIN
    CREATE TABLE PaymentTransactions (
        TransactionID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        UserID UNIQUEIDENTIFIER NOT NULL,
        PaymentID NVARCHAR(100) NULL, -- Razorpay payment ID
        OrderID NVARCHAR(100) NULL, -- Razorpay order ID
        Amount INT NOT NULL, -- Amount in paise
        Currency NVARCHAR(10) NOT NULL DEFAULT 'INR',
        Status NVARCHAR(20) NOT NULL, -- Success, Failed, Pending
        PaymentMethod NVARCHAR(50) NOT NULL DEFAULT 'Razorpay',
        ErrorMessage NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
    );
END

"@

# Reference Data SQL
$referenceDataSQL = @"

-- Insert Currencies
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'USD')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive)
    VALUES ('USD', 'US Dollar', N'$', 1);
END;
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'EUR')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive)
    VALUES ('EUR', 'Euro', N'€', 1);
END;
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'GBP')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive)
    VALUES ('GBP', 'British Pound', N'£', 1);
END;
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'INR')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive)
    VALUES ('INR', 'Indian Rupee', N'₹', 1);
END;
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'CAD')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive)
    VALUES ('CAD', 'Canadian Dollar', N'C$', 1);
END;
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'AUD')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive)
    VALUES ('AUD', 'Australian Dollar', N'A$', 1);
END;
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'JPY')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive)
    VALUES ('JPY', 'Japanese Yen', N'¥', 1);
END;
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'CNY')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive)
    VALUES ('CNY', 'Chinese Yuan', N'¥', 1);
END;
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'SGD')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive)
    VALUES ('SGD', 'Singapore Dollar', N'S$', 1);
END;
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'AED')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive)
    VALUES ('AED', 'UAE Dirham', N'د.إ', 1);
END;

-- JobTypes (No Remote/Hybrid, moved to WorkplaceTypes)
INSERT INTO JobTypes (Type, Description)
SELECT 'Full-time', 'Full-time permanent position' WHERE NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Full-time')
UNION SELECT 'Part-time', 'Part-time position' WHERE NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Part-time')
UNION SELECT 'Contract', 'Contract-based position' WHERE NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Contract')
UNION SELECT 'Freelance', 'Freelance work' WHERE NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Freelance')
UNION SELECT 'Internship', 'Internship position' WHERE NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Internship')
UNION SELECT 'Temporary', 'Temporary position' WHERE NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Temporary');

-- WorkplaceTypes
INSERT INTO WorkplaceTypes (Type, Description)
SELECT 'Onsite', 'In-office work' WHERE NOT EXISTS (SELECT 1 FROM WorkplaceTypes WHERE Type = 'Onsite')
UNION SELECT 'Remote', 'Fully remote' WHERE NOT EXISTS (SELECT 1 FROM WorkplaceTypes WHERE Type = 'Remote')
UNION SELECT 'Hybrid', 'Mix of onsite and remote' WHERE NOT EXISTS (SELECT 1 FROM WorkplaceTypes WHERE Type = 'Hybrid');

-- ApplicationStatuses
INSERT INTO ApplicationStatuses (Status, Description)
SELECT 'Submitted', 'Application has been submitted' WHERE NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Submitted')
UNION SELECT 'Under Review', 'Application is being reviewed' WHERE NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Under Review')
UNION SELECT 'Shortlisted', 'Candidate has been shortlisted' WHERE NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Shortlisted')
UNION SELECT 'Interview Scheduled', 'Interview has been scheduled' WHERE NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Interview Scheduled')
UNION SELECT 'Interview Completed', 'Interview has been completed' WHERE NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Interview Completed')
UNION SELECT 'Rejected', 'Application has been rejected' WHERE NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Rejected')
UNION SELECT 'Offer Extended', 'Job offer has been extended' WHERE NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Offer Extended')
UNION SELECT 'Offer Accepted', 'Job offer has been accepted' WHERE NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Offer Accepted')
UNION SELECT 'Offer Declined', 'Job offer has been declined' WHERE NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Offer Declined')
UNION SELECT 'Withdrawn', 'Application has been withdrawn' WHERE NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Withdrawn');

"@

# Essential indexes (added inline per request)
$indexesSQL = @"
PRINT 'Creating essential performance indexes (inline)';

-- Users
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Users_Email_IsActive')
    CREATE INDEX IX_Users_Email_IsActive ON Users(Email, IsActive) INCLUDE (UserID, Password, UserType, FirstName, LastName);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Users_LastActive')
    CREATE INDEX IX_Users_LastActive ON Users(LastActive DESC) INCLUDE (UserID, UserType, EmailVerified);

-- Applicants
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Applicants_UserID')
    CREATE INDEX IX_Applicants_UserID ON Applicants(UserID) INCLUDE (ApplicantID, ProfileCompleteness, IsOpenToWork, OpenToRefer);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Applicants_OpenToRefer_IsOpenToWork')
    CREATE INDEX IX_Applicants_OpenToRefer_IsOpenToWork ON Applicants(OpenToRefer, IsOpenToWork) INCLUDE (ApplicantID, CurrentOrganizationID);

-- Jobs
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Jobs_Status_JobType_Workplace_Location')
    CREATE INDEX IX_Jobs_Status_JobType_Workplace_Location ON Jobs(Status, JobTypeID, WorkplaceTypeID, Location, IsRemote) INCLUDE (JobID, Title, OrganizationID, CreatedAt, PublishedAt, SalaryRangeMin, SalaryRangeMax);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Jobs_PostedByUserID_Status_CreatedAt')
    CREATE INDEX IX_Jobs_PostedByUserID_Status_CreatedAt ON Jobs(PostedByUserID, Status, CreatedAt DESC) INCLUDE (JobID, Title, OrganizationID, CurrentApplications);

-- JobApplications
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_JobApplications_ApplicantID_StatusID')
    CREATE INDEX IX_JobApplications_ApplicantID_StatusID ON JobApplications(ApplicantID, StatusID) INCLUDE (ApplicationID, JobID, SubmittedAt);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_JobApplications_JobID_StatusID')
    CREATE INDEX IX_JobApplications_JobID_StatusID ON JobApplications(JobID, StatusID) INCLUDE (ApplicationID, ApplicantID, SubmittedAt);

-- Employers
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Employers_UserID_OrganizationID')
    CREATE INDEX IX_Employers_UserID_OrganizationID ON Employers(UserID, OrganizationID) INCLUDE (EmployerID, Role, IsVerified);

-- WorkExperiences
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_WorkExperiences_ApplicantID_IsCurrent')
    CREATE INDEX IX_WorkExperiences_ApplicantID_IsCurrent ON WorkExperiences(ApplicantID, IsCurrent) INCLUDE (OrganizationID, JobTitle, StartDate);

-- SavedJobs (extra covering index for frequency)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_SavedJobs_JobID')
    CREATE INDEX IX_SavedJobs_JobID ON SavedJobs(JobID) INCLUDE (ApplicantID, SavedAt);

PRINT 'Essential indexes created.';
"@

try {
    Write-Host " Creating database schema..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $schemaSQL -QueryTimeout 120
    Write-Host "Database schema created successfully" -ForegroundColor Green
    
    Write-Host " Inserting reference data..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $referenceDataSQL -QueryTimeout 60
    Write-Host "Reference data inserted successfully" -ForegroundColor Green

    Write-Host " Creating essential indexes..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $indexesSQL -QueryTimeout 180
    Write-Host "Essential indexes created successfully" -ForegroundColor Green
    
    # Test the reference data endpoints
    Write-Host " Testing database setup..." -ForegroundColor Yellow
    $testJobTypes = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query "SELECT COUNT(*) as Count FROM JobTypes" -QueryTimeout 30
    $testCurrencies = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query "SELECT COUNT(*) as Count FROM Currencies" -QueryTimeout 30
    
    Write-Host "Database setup completed successfully!" -ForegroundColor Green
    Write-Host "Job Types: $($testJobTypes.Count)" -ForegroundColor Cyan
    Write-Host "Currencies: $($testCurrencies.Count)" -ForegroundColor Cyan
    
} catch {
    Write-Error "Database setup failed: $($_.Exception.Message)"
    exit 1
}

Write-Host ""
Write-Host " Database is ready for RefOpen APIs!" -ForegroundColor Green
Write-Host "Now test your APIs: .\test-api.ps1 -BaseUrl 'https://refopen-api-func.azurewebsites.net/api'" -ForegroundColor Cyan