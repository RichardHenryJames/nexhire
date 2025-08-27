# NexHire Database Schema Deployment Script
# This script creates all required database tables and populates reference data

param(
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host " Setting up NexHire Database Schema..." -ForegroundColor Green

# Install SqlServer module if not present
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host " Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

# Database Schema SQL
$schemaSQL = @"
-- Create JobTypes table (Reference Data)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JobTypes')
BEGIN
    CREATE TABLE JobTypes (
        JobTypeID int IDENTITY(1,1) PRIMARY KEY,
        Type nvarchar(100) NOT NULL,
        Description nvarchar(500),
        IsActive bit DEFAULT 1,
        CreatedAt datetime2 DEFAULT GETUTCDATE()
    );
END

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

-- Create ApplicationStatuses table (Reference Data)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicationStatuses')
BEGIN
    CREATE TABLE ApplicationStatuses (
        StatusID int IDENTITY(1,1) PRIMARY KEY,
        Status nvarchar(100) NOT NULL,
        Description nvarchar(500),
        IsActive bit DEFAULT 1,
        CreatedAt datetime2 DEFAULT GETUTCDATE()
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Organizations')
BEGIN
    CREATE TABLE Organizations (
        OrganizationID uniqueidentifier PRIMARY KEY DEFAULT NEWID(),
        Name nvarchar(200) NOT NULL,
        Type nvarchar(50), -- Pvt Ltd, Govt, NGO, Startup
        Industry nvarchar(100),
        Size nvarchar(20),
        Website nvarchar(500),
        LinkedInProfile nvarchar(500),
        Description nvarchar(max),
        LogoURL nvarchar(1000),
        VerificationStatus tinyint DEFAULT 0,  -- Changed from nvarchar(50)
                                               -- 0=Pending, 1=Verified, 2=Rejected
        VerifiedAt datetime2 NULL,             -- Added
        VerifiedBy uniqueidentifier NULL,      -- Added (FK to Users.UserID)
        EstablishedDate date,
        Headquarters nvarchar(255),            -- Added
        ContactEmail nvarchar(320),            -- Added
        ContactPhone nvarchar(20),             -- Added
        Rating decimal(3,2),                   -- Added (for reviews later)
        CreatedAt datetime2 DEFAULT GETUTCDATE(),
        UpdatedAt datetime2 DEFAULT GETUTCDATE(),
        CreatedBy uniqueidentifier NULL,       -- Added
        UpdatedBy uniqueidentifier NULL,       -- Added
        IsActive bit DEFAULT 1
    );
END


-- Create Users table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        UserID uniqueidentifier PRIMARY KEY DEFAULT NEWID(),
        Email nvarchar(320) UNIQUE NOT NULL,
        Password nvarchar(255) NOT NULL,
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
        CurrentJobTitle NVARCHAR(200),
        CurrentCompany NVARCHAR(200),
        YearsOfExperience INT,
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
        WorkExperience NTEXT,
        PrimaryResumeURL NVARCHAR(1000),
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
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (UserID) REFERENCES Users(UserID)
    );
END

-- ========================
-- SalaryComponents Table
-- (Static lookup table)
-- ========================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SalaryComponents')
BEGIN
    CREATE TABLE SalaryComponents (
        ComponentID INT PRIMARY KEY IDENTITY(1,1),
        ComponentName NVARCHAR(100) NOT NULL,  -- e.g. Fixed, Variable, Bonus, Stock
        ComponentType NVARCHAR(50) NOT NULL,   -- e.g. Recurring, OneTime, Equity
        IsActive BIT DEFAULT 1
    );

    -- Insert static salary component types
    INSERT INTO SalaryComponents (ComponentName, ComponentType) VALUES
    ('Fixed', 'Recurring'),
    ('Variable', 'Recurring'),
    ('Bonus', 'OneTime'),
    ('Stock', 'Equity');
END

-- ========================
-- ApplicantSalaries Table
-- (Normalized salary breakup)
-- ========================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicantSalaries')
BEGIN
    CREATE TABLE ApplicantSalaries (
        ApplicantSalaryID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        ComponentID INT NOT NULL,
        Amount DECIMAL(15,2) NOT NULL,
        CurrencyID INT NOT NULL,
        Frequency NVARCHAR(50) NULL,           -- e.g. Monthly, Yearly
        SalaryContext NVARCHAR(50) NOT NULL,   -- 'Current' or 'Expected'
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID),
        FOREIGN KEY (ComponentID) REFERENCES SalaryComponents(ComponentID),
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
    );
END

-- Create Employers table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Employers')
BEGIN
    CREATE TABLE Employers (
        EmployerID uniqueidentifier PRIMARY KEY DEFAULT NEWID(),
        UserID uniqueidentifier NOT NULL,
        OrganizationID uniqueidentifier NOT NULL,
        Role nvarchar(50) DEFAULT 'Recruiter', -- Added, instead of multiple flags
        IsVerified bit DEFAULT 0,
        JoinedAt datetime2 DEFAULT GETUTCDATE(),
        CreatedBy uniqueidentifier NULL,       -- Added
        UpdatedBy uniqueidentifier NULL,       -- Added
        FOREIGN KEY (UserID) REFERENCES Users(UserID),
        FOREIGN KEY (OrganizationID) REFERENCES Organizations(OrganizationID)
    );
END


-- Create Jobs table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Jobs')
BEGIN
    CREATE TABLE Jobs (
        JobID uniqueidentifier PRIMARY KEY DEFAULT NEWID(),
        OrganizationID uniqueidentifier NOT NULL,
        PostedByUserID uniqueidentifier NOT NULL,
        Title nvarchar(200) NOT NULL,
        JobTypeID int NOT NULL,
        Level nvarchar(50),
        Department nvarchar(100),
        Description ntext,
        Responsibilities ntext,
        Requirements ntext,
        PreferredQualifications ntext,
        BenefitsOffered ntext,
        Location nvarchar(200),
        Country nvarchar(100),
        State nvarchar(100),
        City nvarchar(100),
        PostalCode nvarchar(20),
        IsRemote bit DEFAULT 0,
        WorkplaceType nvarchar(50),
        RemoteRestrictions nvarchar(500),
        SalaryRangeMin decimal(15,2),
        SalaryRangeMax decimal(15,2),
        CurrencyID int,
        SalaryPeriod nvarchar(50),
        CompensationType nvarchar(50),
        BonusDetails nvarchar(500),
        EquityOffered nvarchar(100),
        ProjectDuration nvarchar(100),
        ProjectStartDate date,
        ProjectEndDate date,
        ProjectBudget decimal(15,2),
        ContractExtensionPossible bit,
        ContractConversionPossible bit,
        ExperienceMin int,
        ExperienceMax int,
        ExperienceLevel nvarchar(50),
        RequiredCertifications nvarchar(500),
        RequiredEducation nvarchar(200),
        Status nvarchar(50) DEFAULT 'Draft',
        Priority nvarchar(50) DEFAULT 'Normal',
        Visibility nvarchar(50) DEFAULT 'Public',
        ApplicationDeadline datetime2,
        TargetHiringDate datetime2,
        MaxApplications int,
        CurrentApplications int DEFAULT 0,
        InterviewStages nvarchar(500),
        InterviewProcess nvarchar(500),
        AssessmentRequired bit DEFAULT 0,
        AssessmentDetails ntext,
        PublishedAt datetime2,
        ExpiresAt datetime2,
        CreatedAt datetime2 DEFAULT GETUTCDATE(),
        UpdatedAt datetime2 DEFAULT GETUTCDATE(),
        LastBumpedAt datetime2,
        TimeZone nvarchar(100),
        Language nvarchar(50) DEFAULT 'English',
        Tags nvarchar(500),
        InternalNotes ntext,
        ExternalJobID nvarchar(100),
        SearchScore decimal(10,2),
        FeaturedUntil datetime2,
        FOREIGN KEY (OrganizationID) REFERENCES Organizations(OrganizationID),
        FOREIGN KEY (PostedByUserID) REFERENCES Users(UserID),
        FOREIGN KEY (JobTypeID) REFERENCES JobTypes(JobTypeID),
        FOREIGN KEY (CurrencyID) REFERENCES Currencies(CurrencyID)
    );
END

-- Create JobApplications table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JobApplications')
BEGIN
    CREATE TABLE JobApplications (
        ApplicationID uniqueidentifier PRIMARY KEY DEFAULT NEWID(),
        JobID uniqueidentifier NOT NULL,
        ApplicantID uniqueidentifier NOT NULL,
        ResumeURL nvarchar(1000),
        CoverLetter ntext,
        ExpectedSalary decimal(15,2),
        ExpectedCurrencyID int,
        AvailableFromDate date,
        StatusID int NOT NULL DEFAULT 1,
        SubmittedAt datetime2 DEFAULT GETUTCDATE(),
        LastUpdatedAt datetime2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (JobID) REFERENCES Jobs(JobID),
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID),
        FOREIGN KEY (ExpectedCurrencyID) REFERENCES Currencies(CurrencyID),
        FOREIGN KEY (StatusID) REFERENCES ApplicationStatuses(StatusID),
        UNIQUE(JobID, ApplicantID)
    );
END

-- Create ApplicationTracking table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicationTracking')
BEGIN
    CREATE TABLE ApplicationTracking (
        TrackingID uniqueidentifier PRIMARY KEY DEFAULT NEWID(),
        ApplicationID uniqueidentifier NOT NULL,
        StatusTypeID int,
        ScreeningScore decimal(5,2),
        ScreeningNotes ntext,
        InterviewStage int,
        NextInterviewDate datetime2,
        InterviewFeedback ntext,
        OfferStatus nvarchar(100),
        OfferedSalary decimal(15,2),
        OfferedCurrencyID int,
        OfferLetterURL nvarchar(1000),
        OfferExpiryDate datetime2,
        Notes ntext,
        LastUpdatedBy nvarchar(100),
        LastUpdatedAt datetime2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (ApplicationID) REFERENCES JobApplications(ApplicationID),
        FOREIGN KEY (OfferedCurrencyID) REFERENCES Currencies(CurrencyID)
    );
END
"@

# Reference Data SQL
$referenceDataSQL = @"

-- Insert Currencies
-- USD
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'USD')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive, ExchangeRate, LastRateUpdate, CreatedAt)
    VALUES ('USD', 'US Dollar', N'$', 1, 1.0000, GETDATE(), GETDATE());
END;

-- EUR
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'EUR')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive, ExchangeRate, LastRateUpdate, CreatedAt)
    VALUES ('EUR', 'Euro', N'€', 1, 0.8500, GETDATE(), GETDATE());
END;

-- GBP
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'GBP')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive, ExchangeRate, LastRateUpdate, CreatedAt)
    VALUES ('GBP', 'British Pound', N'£', 1, 0.7300, GETDATE(), GETDATE());
END;

-- INR
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'INR')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive, ExchangeRate, LastRateUpdate, CreatedAt)
    VALUES ('INR', 'Indian Rupee', N'₹', 1, 82.0000, GETDATE(), GETDATE());
END;

-- CAD
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'CAD')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive, ExchangeRate, LastRateUpdate, CreatedAt)
    VALUES ('CAD', 'Canadian Dollar', N'C$', 1, 1.2500, GETDATE(), GETDATE());
END;

-- AUD
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'AUD')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive, ExchangeRate, LastRateUpdate, CreatedAt)
    VALUES ('AUD', 'Australian Dollar', N'A$', 1, 1.3500, GETDATE(), GETDATE());
END;

-- JPY
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'JPY')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive, ExchangeRate, LastRateUpdate, CreatedAt)
    VALUES ('JPY', 'Japanese Yen', N'¥', 1, 110.0000, GETDATE(), GETDATE());
END;

-- CNY
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'CNY')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive, ExchangeRate, LastRateUpdate, CreatedAt)
    VALUES ('CNY', 'Chinese Yuan', N'¥', 1, 6.5000, GETDATE(), GETDATE());
END;

-- SGD
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'SGD')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive, ExchangeRate, LastRateUpdate, CreatedAt)
    VALUES ('SGD', 'Singapore Dollar', N'S$', 1, 1.3500, GETDATE(), GETDATE());
END;

-- AED
IF NOT EXISTS (SELECT 1 FROM Currencies WHERE Code = 'AED')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol, IsActive, ExchangeRate, LastRateUpdate, CreatedAt)
    VALUES ('AED', 'UAE Dirham', N'د.إ', 1, 3.6700, GETDATE(), GETDATE());
END;

-- Insert Job Types safely
IF NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Full-time')
    INSERT INTO JobTypes (Type, Description) VALUES ('Full-time', 'Full-time permanent position');

IF NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Part-time')
    INSERT INTO JobTypes (Type, Description) VALUES ('Part-time', 'Part-time position');

IF NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Contract')
    INSERT INTO JobTypes (Type, Description) VALUES ('Contract', 'Contract-based position');

IF NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Freelance')
    INSERT INTO JobTypes (Type, Description) VALUES ('Freelance', 'Freelance work');

IF NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Internship')
    INSERT INTO JobTypes (Type, Description) VALUES ('Internship', 'Internship position');

IF NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Temporary')
    INSERT INTO JobTypes (Type, Description) VALUES ('Temporary', 'Temporary position');

IF NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Remote')
    INSERT INTO JobTypes (Type, Description) VALUES ('Remote', 'Remote work position');

IF NOT EXISTS (SELECT 1 FROM JobTypes WHERE Type = 'Hybrid')
    INSERT INTO JobTypes (Type, Description) VALUES ('Hybrid', 'Hybrid work arrangement');

-- Insert Application Statuses safely
IF NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Submitted')
    INSERT INTO ApplicationStatuses (Status, Description) VALUES ('Submitted', 'Application has been submitted');

IF NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Under Review')
    INSERT INTO ApplicationStatuses (Status, Description) VALUES ('Under Review', 'Application is being reviewed');

IF NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Shortlisted')
    INSERT INTO ApplicationStatuses (Status, Description) VALUES ('Shortlisted', 'Candidate has been shortlisted');

IF NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Interview Scheduled')
    INSERT INTO ApplicationStatuses (Status, Description) VALUES ('Interview Scheduled', 'Interview has been scheduled');

IF NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Interview Completed')
    INSERT INTO ApplicationStatuses (Status, Description) VALUES ('Interview Completed', 'Interview has been completed');

IF NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Rejected')
    INSERT INTO ApplicationStatuses (Status, Description) VALUES ('Rejected', 'Application has been rejected');

IF NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Offer Extended')
    INSERT INTO ApplicationStatuses (Status, Description) VALUES ('Offer Extended', 'Job offer has been extended');

IF NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Offer Accepted')
    INSERT INTO ApplicationStatuses (Status, Description) VALUES ('Offer Accepted', 'Job offer has been accepted');

IF NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Offer Declined')
    INSERT INTO ApplicationStatuses (Status, Description) VALUES ('Offer Declined', 'Job offer has been declined');

IF NOT EXISTS (SELECT 1 FROM ApplicationStatuses WHERE Status = 'Withdrawn')
    INSERT INTO ApplicationStatuses (Status, Description) VALUES ('Withdrawn', 'Application has been withdrawn');

"@

try {
    Write-Host " Creating database schema..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $schemaSQL -QueryTimeout 120
    Write-Host "Database schema created successfully" -ForegroundColor Green
    
    Write-Host " Inserting reference data..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $referenceDataSQL -QueryTimeout 60
    Write-Host "Reference data inserted successfully" -ForegroundColor Green
    
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
Write-Host " Database is ready for NexHire APIs!" -ForegroundColor Green
Write-Host "Now test your APIs: .\test-api.ps1 -BaseUrl 'https://nexhire-api-func.azurewebsites.net/api'" -ForegroundColor Cyan