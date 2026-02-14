-- Migration: Add Terms & Conditions consent tracking
-- Date: 2026-02-08
-- Description: Adds consent columns to Users table and creates UserConsentLog audit table

-- 1. Add consent columns to Users table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'TermsAcceptedAt')
BEGIN
    ALTER TABLE Users ADD TermsAcceptedAt DATETIME2(7) NULL;
    PRINT 'Added TermsAcceptedAt column to Users table';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'TermsVersion')
BEGIN
    ALTER TABLE Users ADD TermsVersion NVARCHAR(20) NULL;
    PRINT 'Added TermsVersion column to Users table';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PrivacyPolicyAcceptedAt')
BEGIN
    ALTER TABLE Users ADD PrivacyPolicyAcceptedAt DATETIME2(7) NULL;
    PRINT 'Added PrivacyPolicyAcceptedAt column to Users table';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PrivacyPolicyVersion')
BEGIN
    ALTER TABLE Users ADD PrivacyPolicyVersion NVARCHAR(20) NULL;
    PRINT 'Added PrivacyPolicyVersion column to Users table';
END
GO

-- 2. Create UserConsentLog audit table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID('UserConsentLog') AND type = 'U')
BEGIN
    CREATE TABLE UserConsentLog (
        ConsentLogID INT IDENTITY(1,1) NOT NULL,
        UserID UNIQUEIDENTIFIER NOT NULL,
        ConsentType NVARCHAR(50) NOT NULL,       -- 'TERMS', 'PRIVACY_POLICY', 'MARKETING'
        Version NVARCHAR(20) NOT NULL,            -- e.g., 'v1.0'
        AcceptedAt DATETIME2(7) NOT NULL DEFAULT (GETUTCDATE()),
        IPAddress NVARCHAR(45) NULL,              -- IPv4 or IPv6
        UserAgent NVARCHAR(500) NULL,             -- Browser/app user agent
        CONSTRAINT PK_UserConsentLog PRIMARY KEY (ConsentLogID),
        CONSTRAINT FK_UserConsentLog_Users FOREIGN KEY (UserID) REFERENCES Users(UserID)
    );
    PRINT 'Created UserConsentLog table';
END
GO

-- 3. Add indexes for efficient lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserConsentLog_UserID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserConsentLog_UserID ON UserConsentLog(UserID);
    PRINT 'Created index IX_UserConsentLog_UserID';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserConsentLog_ConsentType')
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserConsentLog_ConsentType ON UserConsentLog(UserID, ConsentType, Version);
    PRINT 'Created index IX_UserConsentLog_ConsentType';
END
GO

PRINT 'Migration 20260208-add-terms-consent completed successfully';
