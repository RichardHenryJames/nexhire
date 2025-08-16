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

-- Create Organizations table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Organizations')
BEGIN
    CREATE TABLE Organizations (
        OrganizationID uniqueidentifier PRIMARY KEY DEFAULT NEWID(),
        Name nvarchar(200) NOT NULL,
        Type nvarchar(50),
        Industry nvarchar(100),
        Size nvarchar(20),
        Website nvarchar(500),
        LinkedInProfile nvarchar(500),
        Description ntext,
        LogoURL nvarchar(1000),
        VerificationStatus nvarchar(50) DEFAULT 'Pending',
        EstablishedDate date,
        CreatedAt datetime2 DEFAULT GETUTCDATE(),
        UpdatedAt datetime2 DEFAULT GETUTCDATE(),
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
        ApplicantID uniqueidentifier PRIMARY KEY DEFAULT NEWID(),
        UserID uniqueidentifier NOT NULL,
        Nationality nvarchar(100),
        CurrentLocation nvarchar(200),
        PreferredLocations nvarchar(500),
        LinkedInProfile nvarchar(500),
        PortfolioURL nvarchar(500),
        GithubProfile nvarchar(500),
        Headline nvarchar(200),
        Summary ntext,
        CurrentJobTitle nvarchar(200),
        CurrentCompany nvarchar(200),
        YearsOfExperience int,
        PreferredJobTypes nvarchar(500),
        PreferredWorkTypes nvarchar(500),
        ExpectedSalaryMin decimal(15,2),
        ExpectedSalaryMax decimal(15,2),
        PreferredCurrency int,
        NoticePeriod int,
        ImmediatelyAvailable bit DEFAULT 0,
        WillingToRelocate bit DEFAULT 0,
        PreferredRoles ntext,
        PrimarySkills ntext,
        SecondarySkills ntext,
        Languages nvarchar(500),
        Certifications ntext,
        HighestEducation nvarchar(100),
        FieldOfStudy nvarchar(200),
        Education ntext,
        WorkExperience ntext,
        PrimaryResumeURL nvarchar(1000),
        AdditionalDocuments ntext,
        AllowRecruitersToContact bit DEFAULT 1,
        HideCurrentCompany bit DEFAULT 0,
        HideSalaryDetails bit DEFAULT 0,
        ProfileCompleteness int DEFAULT 0,
        IsOpenToWork bit DEFAULT 1,
        IsFeatured bit DEFAULT 0,
        FeaturedUntil datetime2,
        JobSearchStatus nvarchar(100),
        PreferredIndustries nvarchar(500),
        MinimumSalary decimal(15,2),
        PreferredCompanySize nvarchar(50),
        LastJobAppliedAt datetime2,
        SearchScore decimal(10,2),
        Tags nvarchar(500),
        FOREIGN KEY (UserID) REFERENCES Users(UserID),
        FOREIGN KEY (PreferredCurrency) REFERENCES Currencies(CurrencyID)
    );
END

-- Create Employers table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Employers')
BEGIN
    CREATE TABLE Employers (
        EmployerID uniqueidentifier PRIMARY KEY DEFAULT NEWID(),
        UserID uniqueidentifier NOT NULL,
        OrganizationID uniqueidentifier NOT NULL,
        JobTitle nvarchar(200),
        Department nvarchar(100),
        CanPostJobs bit DEFAULT 0,
        CanManageApplications bit DEFAULT 0,
        CanManageTeam bit DEFAULT 0,
        IsVerified bit DEFAULT 0,
        JoinedAt datetime2 DEFAULT GETUTCDATE(),
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
-- Insert Job Types
IF NOT EXISTS (SELECT * FROM JobTypes WHERE Type = 'Full-time')
BEGIN
    INSERT INTO JobTypes (Type, Description) VALUES
    ('Full-time', 'Full-time permanent position'),
    ('Part-time', 'Part-time position'),
    ('Contract', 'Contract-based position'),
    ('Freelance', 'Freelance work'),
    ('Internship', 'Internship position'),
    ('Temporary', 'Temporary position'),
    ('Remote', 'Remote work position'),
    ('Hybrid', 'Hybrid work arrangement');
END

-- Insert Currencies
IF NOT EXISTS (SELECT * FROM Currencies WHERE Code = 'USD')
BEGIN
    INSERT INTO Currencies (Code, Name, Symbol) VALUES
    ('USD', 'US Dollar', '$'),
    ('EUR', 'Euro', '�'),
    ('GBP', 'British Pound', '�'),
    ('INR', 'Indian Rupee', '?'),
    ('CAD', 'Canadian Dollar', 'C$'),
    ('AUD', 'Australian Dollar', 'A$'),
    ('JPY', 'Japanese Yen', '�'),
    ('CNY', 'Chinese Yuan', '�'),
    ('SGD', 'Singapore Dollar', 'S$'),
    ('AED', 'UAE Dirham', '?.?');
END

-- Insert Application Statuses
IF NOT EXISTS (SELECT * FROM ApplicationStatuses WHERE Status = 'Submitted')
BEGIN
    INSERT INTO ApplicationStatuses (Status, Description) VALUES
    ('Submitted', 'Application has been submitted'),
    ('Under Review', 'Application is being reviewed'),
    ('Shortlisted', 'Candidate has been shortlisted'),
    ('Interview Scheduled', 'Interview has been scheduled'),
    ('Interview Completed', 'Interview has been completed'),
    ('Rejected', 'Application has been rejected'),
    ('Offer Extended', 'Job offer has been extended'),
    ('Offer Accepted', 'Job offer has been accepted'),
    ('Offer Declined', 'Job offer has been declined'),
    ('Withdrawn', 'Application has been withdrawn');
END

-- Create a sample organization for testing
IF NOT EXISTS (SELECT * FROM Organizations WHERE Name = 'NexHire Demo Company')
BEGIN
    INSERT INTO Organizations (Name, Type, Industry, Size, Description, VerificationStatus, IsActive)
    VALUES 
    ('NexHire Demo Company', 'Technology', 'Software Development', '51-200', 'A demo company for testing NexHire platform', 'Verified', 1);
END
"@

try {
    Write-Host " Creating database schema..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $schemaSQL -QueryTimeout 120
    Write-Host "? Database schema created successfully" -ForegroundColor Green
    
    Write-Host " Inserting reference data..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $referenceDataSQL -QueryTimeout 60
    Write-Host "? Reference data inserted successfully" -ForegroundColor Green
    
    # Test the reference data endpoints
    Write-Host " Testing database setup..." -ForegroundColor Yellow
    $testJobTypes = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query "SELECT COUNT(*) as Count FROM JobTypes" -QueryTimeout 30
    $testCurrencies = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query "SELECT COUNT(*) as Count FROM Currencies" -QueryTimeout 30
    
    Write-Host "? Database setup completed successfully!" -ForegroundColor Green
    Write-Host "  � Job Types: $($testJobTypes.Count)" -ForegroundColor Cyan
    Write-Host "  � Currencies: $($testCurrencies.Count)" -ForegroundColor Cyan
    
} catch {
    Write-Error "? Database setup failed: $($_.Exception.Message)"
    exit 1
}

Write-Host ""
Write-Host " Database is ready for NexHire APIs!" -ForegroundColor Green
Write-Host "Now test your APIs: .\test-api.ps1 -BaseUrl 'https://nexhire-api-func.azurewebsites.net/api'" -ForegroundColor Cyan