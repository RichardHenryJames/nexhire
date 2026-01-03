-- ================================================================
-- Migration: Add Verified Referrer Feature
-- ================================================================
-- Purpose: Allow employees to verify themselves as referrers by
--          confirming their company email with OTP
-- 
-- Tables Modified:
-- 1. Users - Add IsVerifiedReferrer flag
-- 2. WorkExperiences - Add CompanyEmail and CompanyEmailVerified
-- 3. New Table: EmailVerificationOTPs - Store OTPs for verification
-- ================================================================

-- ================================================================
-- 1. Add IsVerifiedReferrer column to Users table
-- ================================================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'IsVerifiedReferrer'
)
BEGIN
    ALTER TABLE Users ADD IsVerifiedReferrer BIT NOT NULL DEFAULT 0;
    PRINT '✅ Added IsVerifiedReferrer column to Users table';
END
ELSE
BEGIN
    PRINT '⏭️ IsVerifiedReferrer column already exists in Users table';
END
GO

-- ================================================================
-- 2. Add CompanyEmail and CompanyEmailVerified to WorkExperiences
-- ================================================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'WorkExperiences' AND COLUMN_NAME = 'CompanyEmail'
)
BEGIN
    ALTER TABLE WorkExperiences ADD CompanyEmail NVARCHAR(255) NULL;
    PRINT '✅ Added CompanyEmail column to WorkExperiences table';
END
ELSE
BEGIN
    PRINT '⏭️ CompanyEmail column already exists in WorkExperiences table';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'WorkExperiences' AND COLUMN_NAME = 'CompanyEmailVerified'
)
BEGIN
    ALTER TABLE WorkExperiences ADD CompanyEmailVerified BIT NOT NULL DEFAULT 0;
    PRINT '✅ Added CompanyEmailVerified column to WorkExperiences table';
END
ELSE
BEGIN
    PRINT '⏭️ CompanyEmailVerified column already exists in WorkExperiences table';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'WorkExperiences' AND COLUMN_NAME = 'CompanyEmailVerifiedAt'
)
BEGIN
    ALTER TABLE WorkExperiences ADD CompanyEmailVerifiedAt DATETIME2 NULL;
    PRINT '✅ Added CompanyEmailVerifiedAt column to WorkExperiences table';
END
ELSE
BEGIN
    PRINT '⏭️ CompanyEmailVerifiedAt column already exists in WorkExperiences table';
END
GO

-- ================================================================
-- 3. Create EmailVerificationOTPs table for storing OTPs
-- ================================================================
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EmailVerificationOTPs')
BEGIN
    CREATE TABLE EmailVerificationOTPs (
        OTPID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        UserID UNIQUEIDENTIFIER NOT NULL,
        WorkExperienceID UNIQUEIDENTIFIER NOT NULL,
        Email NVARCHAR(255) NOT NULL,
        OTPCode CHAR(4) NOT NULL,
        Purpose NVARCHAR(50) NOT NULL DEFAULT 'COMPANY_EMAIL_VERIFICATION',
        IsUsed BIT NOT NULL DEFAULT 0,
        ExpiresAt DATETIME2 NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UsedAt DATETIME2 NULL,
        AttemptCount INT NOT NULL DEFAULT 0,
        MaxAttempts INT NOT NULL DEFAULT 3,
        
        -- Foreign Keys
        CONSTRAINT FK_EmailVerificationOTPs_Users FOREIGN KEY (UserID) 
            REFERENCES Users(UserID) ON DELETE CASCADE,
        CONSTRAINT FK_EmailVerificationOTPs_WorkExperiences FOREIGN KEY (WorkExperienceID) 
            REFERENCES WorkExperiences(WorkExperienceID) ON DELETE CASCADE
    );
    
    -- Index for faster lookups
    CREATE INDEX IX_EmailVerificationOTPs_UserID ON EmailVerificationOTPs(UserID);
    CREATE INDEX IX_EmailVerificationOTPs_Email ON EmailVerificationOTPs(Email);
    CREATE INDEX IX_EmailVerificationOTPs_ExpiresAt ON EmailVerificationOTPs(ExpiresAt);
    
    PRINT '✅ Created EmailVerificationOTPs table';
END
ELSE
BEGIN
    PRINT '⏭️ EmailVerificationOTPs table already exists';
END
GO

-- ================================================================
-- 4. Create index on Users.IsVerifiedReferrer for faster filtering
-- ================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_Users_IsVerifiedReferrer' AND object_id = OBJECT_ID('Users')
)
BEGIN
    CREATE INDEX IX_Users_IsVerifiedReferrer ON Users(IsVerifiedReferrer);
    PRINT '✅ Created index IX_Users_IsVerifiedReferrer';
END
GO

-- ================================================================
-- 5. Create index on WorkExperiences for current job lookup
-- ================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_WorkExperiences_ApplicantID_IsCurrent' AND object_id = OBJECT_ID('WorkExperiences')
)
BEGIN
    CREATE INDEX IX_WorkExperiences_ApplicantID_IsCurrent 
    ON WorkExperiences(ApplicantID, IsCurrent) 
    INCLUDE (CompanyEmail, CompanyEmailVerified, OrganizationID);
    PRINT '✅ Created index IX_WorkExperiences_ApplicantID_IsCurrent';
END
GO

-- ================================================================
-- Summary
-- ================================================================
PRINT '';
PRINT '================================================================';
PRINT '✅ VERIFIED REFERRER MIGRATION COMPLETED';
PRINT '================================================================';
PRINT '';
PRINT 'New Columns Added:';
PRINT '  - Users.IsVerifiedReferrer (BIT, DEFAULT 0)';
PRINT '  - WorkExperiences.CompanyEmail (NVARCHAR(255))';
PRINT '  - WorkExperiences.CompanyEmailVerified (BIT, DEFAULT 0)';
PRINT '  - WorkExperiences.CompanyEmailVerifiedAt (DATETIME2)';
PRINT '';
PRINT 'New Table Created:';
PRINT '  - EmailVerificationOTPs (stores OTPs for email verification)';
PRINT '';
PRINT 'Business Logic:';
PRINT '  1. User adds company email to current work experience';
PRINT '  2. System sends 4-digit OTP to company email';
PRINT '  3. User verifies OTP within 10 minutes';
PRINT '  4. CompanyEmailVerified = 1, IsVerifiedReferrer = 1';
PRINT '  5. If user adds NEW work experience, IsVerifiedReferrer = 0';
PRINT '     (must re-verify with new company email)';
PRINT '================================================================';
