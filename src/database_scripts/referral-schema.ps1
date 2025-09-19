# NexHire Referral Schema Deployment Script (Extension)

param(
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host "?? Setting up NexHire Database Schema..." -ForegroundColor Green

# Install SqlServer module if not present
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "?? Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer -Force

# Database Schema SQL for Referral System
$referralSchemaSQL = @"
-- Referral Plans: defines daily quota, duration (1,7,30,90,180,9999 for lifetime)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferralPlans')
BEGIN
    CREATE TABLE ReferralPlans (
        PlanID INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        ReferralsPerDay INT NOT NULL,          -- daily referral limit granted by this plan
        DurationDays INT NOT NULL,             -- e.g. 1=day, 7=week, 30=month, 9999=lifetime
        Price DECIMAL(10,2) NOT NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE()
    );
END

-- ApplicantReferralSubscriptions: tracks applicant subscriptions to plans
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApplicantReferralSubscriptions')
BEGIN
    CREATE TABLE ApplicantReferralSubscriptions (
        SubscriptionID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ApplicantID UNIQUEIDENTIFIER NOT NULL,
        PlanID INT NOT NULL,
        StartDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        EndDate DATETIME2 NOT NULL,            -- calculated as StartDate + DurationDays
        PaymentID NVARCHAR(100) NULL,
        IsActive BIT DEFAULT 1,
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID),
        FOREIGN KEY (PlanID) REFERENCES ReferralPlans(PlanID)
    );
END

-- ReferralRequests: seeker requests referral, later picked by an eligible referrer
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferralRequests')
BEGIN
    CREATE TABLE ReferralRequests (
        RequestID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        JobID UNIQUEIDENTIFIER NULL,
        ApplicantID UNIQUEIDENTIFIER NOT NULL, -- seeker
        ResumeID UNIQUEIDENTIFIER NOT NULL,
        Status NVARCHAR(50) DEFAULT 'Pending', -- Pending, Claimed, Completed, Verified
        RequestedAt DATETIME2 DEFAULT GETUTCDATE(),
        AssignedReferrerID UNIQUEIDENTIFIER NULL, -- initially null until someone claims
        ReferredAt DATETIME2 NULL,
        VerifiedByApplicant BIT DEFAULT 0, -- seeker can confirm referral was real
        ExtJobID NVARCHAR(100),
        ReferralMessage NVARCHAR(1000),
        OrganizationID INT NULL,
        FOREIGN KEY (JobID) REFERENCES Jobs(JobID),
        FOREIGN KEY (ApplicantID) REFERENCES Applicants(ApplicantID),
        FOREIGN KEY (ResumeID) REFERENCES ApplicantResumes(ResumeID),
        FOREIGN KEY (AssignedReferrerID) REFERENCES Applicants(ApplicantID),
        FOREIGN KEY (OrganizationID) REFERENCES Organizations(OrganizationID),
        CONSTRAINT UQ_Referral UNIQUE (JobID, ApplicantID)
    );
END

-- ReferralProofs: referrer uploads proof of referral (screenshot, etc.)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferralProofs')
BEGIN
    CREATE TABLE ReferralProofs (
        ProofID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        RequestID UNIQUEIDENTIFIER NOT NULL,
        ReferrerID UNIQUEIDENTIFIER NOT NULL,
        FileURL NVARCHAR(1000) NOT NULL, -- blob/file URL
        FileType NVARCHAR(50),
        Description NVARCHAR(200),
        SubmittedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (RequestID) REFERENCES ReferralRequests(RequestID),
        FOREIGN KEY (ReferrerID) REFERENCES Applicants(ApplicantID)
    );
END

-- ReferralRewards: reward points granted to referrer after completion/verification
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferralRewards')
BEGIN
    CREATE TABLE ReferralRewards (
        RewardID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        ReferrerID UNIQUEIDENTIFIER NOT NULL,
        RequestID UNIQUEIDENTIFIER NOT NULL,
        PointsEarned INT NOT NULL DEFAULT 10, -- configurable reward
        PointsType NVARCHAR(50) DEFAULT 'Referral', -- e.g. Referral, Bonus, etc.
        AwardedAt DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (ReferrerID) REFERENCES Applicants(ApplicantID),
        FOREIGN KEY (RequestID) REFERENCES ReferralRequests(RequestID)
    );
END

-- ReferrerStats: badge counts for efficient notification display
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReferrerStats')
BEGIN
    CREATE TABLE ReferrerStats (
        ReferrerID UNIQUEIDENTIFIER PRIMARY KEY,
        PendingCount INT DEFAULT 0,
        LastUpdated DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (ReferrerID) REFERENCES Applicants(ApplicantID)
    );
END

-- Add ReferralPoints column to Applicants table if it doesn't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Applicants' AND COLUMN_NAME = 'ReferralPoints')
BEGIN
    ALTER TABLE Applicants ADD ReferralPoints INT DEFAULT 0;
    PRINT '? Added ReferralPoints column to Applicants table';
END
ELSE
BEGIN
    PRINT '? ReferralPoints column already exists in Applicants table';
END

"@

# Insert reference plans
$referralReferenceSQL = @"
-- Insert Default Referral Plans
IF NOT EXISTS (SELECT 1 FROM ReferralPlans WHERE Name = 'Free Daily')
BEGIN
    INSERT INTO ReferralPlans (Name, ReferralsPerDay, DurationDays, Price)
    VALUES ('Free Daily', 5, 0, 0.00); -- free quota 5/day, unlimited duration
    PRINT '? Inserted Free Daily plan';
END;

IF NOT EXISTS (SELECT 1 FROM ReferralPlans WHERE Name = 'Weekly Boost')
BEGIN
    INSERT INTO ReferralPlans (Name, ReferralsPerDay, DurationDays, Price)
    VALUES ('Weekly Boost', 10, 7, 4.99);
    PRINT '? Inserted Weekly Boost plan';
END;

IF NOT EXISTS (SELECT 1 FROM ReferralPlans WHERE Name = 'Monthly Pro')
BEGIN
    INSERT INTO ReferralPlans (Name, ReferralsPerDay, DurationDays, Price)
    VALUES ('Monthly Pro', 15, 30, 14.99);
    PRINT '? Inserted Monthly Pro plan';
END;

IF NOT EXISTS (SELECT 1 FROM ReferralPlans WHERE Name = 'Quarterly Elite')
BEGIN
    INSERT INTO ReferralPlans (Name, ReferralsPerDay, DurationDays, Price)
    VALUES ('Quarterly Elite', 18, 90, 39.99);
    PRINT '? Inserted Quarterly Elite plan';
END;

IF NOT EXISTS (SELECT 1 FROM ReferralPlans WHERE Name = 'Semi-Annual Premium')
BEGIN
    INSERT INTO ReferralPlans (Name, ReferralsPerDay, DurationDays, Price)
    VALUES ('Semi-Annual Premium', 20, 180, 69.99);
    PRINT '? Inserted Semi-Annual Premium plan';
END;

IF NOT EXISTS (SELECT 1 FROM ReferralPlans WHERE Name = 'Lifetime Unlimited')
BEGIN
    INSERT INTO ReferralPlans (Name, ReferralsPerDay, DurationDays, Price)
    VALUES ('Lifetime Unlimited', 25, 9999, 199.99);
    PRINT '? Inserted Lifetime Unlimited plan';
END;
"@

# Create indexes if not exists
$referralIndexesSQL = @"
-- ApplicantReferralSubscriptions
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Subscriptions_Applicant_Active')
    CREATE INDEX IX_Subscriptions_Applicant_Active
    ON ApplicantReferralSubscriptions (ApplicantID, IsActive, EndDate) INCLUDE (PlanID, StartDate, PaymentID);

-- ReferralRequests (core access patterns)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReferralRequests_Applicant_Status_RequestedAt')
    CREATE INDEX IX_ReferralRequests_Applicant_Status_RequestedAt ON ReferralRequests (ApplicantID, Status, RequestedAt DESC) INCLUDE (JobID, AssignedReferrerID, ReferredAt);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReferralRequests_AssignedReferrer_Status_RequestedAt')
    CREATE INDEX IX_ReferralRequests_AssignedReferrer_Status_RequestedAt ON ReferralRequests (AssignedReferrerID, Status, RequestedAt DESC) INCLUDE (JobID, ApplicantID, ReferredAt);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReferralRequests_Job_Status_RequestedAt')
    CREATE INDEX IX_ReferralRequests_Job_Status_RequestedAt ON ReferralRequests (JobID, Status, RequestedAt DESC) INCLUDE (ApplicantID, AssignedReferrerID, ReferredAt);

-- Lightweight single column fallbacks (only if composites missing earlier versions)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReferralRequests_Status')
    CREATE INDEX IX_ReferralRequests_Status ON ReferralRequests (Status);

-- ReferralProofs
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReferralProofs_Request')
    CREATE INDEX IX_ReferralProofs_Request ON ReferralProofs (RequestID) INCLUDE (ReferrerID, SubmittedAt);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReferralProofs_Referrer_SubmittedAt')
    CREATE INDEX IX_ReferralProofs_Referrer_SubmittedAt ON ReferralProofs (ReferrerID, SubmittedAt DESC) INCLUDE (RequestID);

-- ReferralRewards (fix incorrect PointsType name previously typed as PointType)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReferralRewards_Referrer_AwardedAt')
    CREATE INDEX IX_ReferralRewards_Referrer_AwardedAt ON ReferralRewards (ReferrerID, AwardedAt DESC) INCLUDE (RequestID, PointsEarned, PointsType);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReferralRewards_Request')
    CREATE INDEX IX_ReferralRewards_Request ON ReferralRewards (RequestID) INCLUDE (ReferrerID, PointsEarned, AwardedAt);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReferralRewards_PointsType')
    CREATE INDEX IX_ReferralRewards_PointsType ON ReferralRewards (PointsType) INCLUDE (ReferrerID, PointsEarned, AwardedAt);

-- ReferrerStats
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ReferrerStats_PendingCount')
    CREATE INDEX IX_ReferrerStats_PendingCount ON ReferrerStats (PendingCount DESC) INCLUDE (LastUpdated);

PRINT '? All referral indexes created/verified successfully';
"@

try {
    Write-Host "??? Creating referral schema..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $referralSchemaSQL -QueryTimeout 120
    Write-Host "? Referral schema created successfully" -ForegroundColor Green

    Write-Host "?? Inserting referral reference data..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $referralReferenceSQL -QueryTimeout 60
    Write-Host "? Referral reference data inserted successfully" -ForegroundColor Green

    Write-Host "?? Creating indexes..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $referralIndexesSQL -QueryTimeout 120
    Write-Host "? Indexes created successfully" -ForegroundColor Green

    Write-Host "?? Referral system setup completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "?? REFERRAL SYSTEM SUMMARY:" -ForegroundColor Cyan
    Write-Host "- ? 6 Referral Plans (Free Daily to Lifetime Unlimited)" -ForegroundColor White
    Write-Host "- ? 5 Core Tables (Plans, Subscriptions, Requests, Proofs, Rewards)" -ForegroundColor White
    Write-Host "- ? Badge System with ReferrerStats" -ForegroundColor White
    Write-Host "- ? Points System with ReferralPoints in Applicants" -ForegroundColor White
    Write-Host "- ? Complete workflow: Request ? Claim ? Proof ? Verify ? Rewards" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Error "? Referral schema setup failed: $($_.Exception.Message)"
    exit 1
}
