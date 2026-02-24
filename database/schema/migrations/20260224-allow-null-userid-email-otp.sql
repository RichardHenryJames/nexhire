-- Migration: Allow NULL UserID in EmailVerificationOTPs
-- Reason: Registration email verification happens BEFORE user exists,
--         so UserID must be nullable for Purpose = 'REGISTRATION_EMAIL_VERIFICATION'
-- Date: 2026-02-24

-- 1. Drop the FK constraint first
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_EmailVerificationOTPs_Users')
BEGIN
    ALTER TABLE EmailVerificationOTPs DROP CONSTRAINT FK_EmailVerificationOTPs_Users;
    PRINT 'Dropped FK_EmailVerificationOTPs_Users';
END
GO

-- 2. ALTER column to allow NULL
ALTER TABLE EmailVerificationOTPs ALTER COLUMN UserID UNIQUEIDENTIFIER NULL;
PRINT 'UserID is now nullable';
GO

-- 3. Re-add the FK but only for non-NULL values
ALTER TABLE EmailVerificationOTPs ADD CONSTRAINT FK_EmailVerificationOTPs_Users
    FOREIGN KEY (UserID) REFERENCES Users(UserID);
PRINT 'Re-added FK (allows NULL, validates non-NULL values)';
GO
