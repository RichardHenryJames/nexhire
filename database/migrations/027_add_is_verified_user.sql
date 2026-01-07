-- ================================================================
-- Migration: Add IsVerifiedUser Flag
-- ================================================================
-- Purpose: Add a permanent "Verified User" flag that remains true
--          once a user has verified *any* company email, even if
--          they change jobs later.
-- ================================================================

-- ================================================================
-- 1. Add IsVerifiedUser column to Users table
-- ================================================================
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'IsVerifiedUser'
)
BEGIN
    ALTER TABLE Users ADD IsVerifiedUser BIT NOT NULL DEFAULT 0;
    PRINT '✅ Added IsVerifiedUser column to Users table';
    
    -- Backfill: Set IsVerifiedUser = 1 for any user who has verified a company email in the past
    UPDATE Users
    SET IsVerifiedUser = 1
    WHERE UserID IN (
        SELECT DISTINCT u.UserID
        FROM Users u
        JOIN Applicants a ON u.UserID = a.UserID
        JOIN WorkExperiences we ON a.ApplicantID = we.ApplicantID
        WHERE we.CompanyEmailVerified = 1
    );
    PRINT '✅ Backfilled IsVerifiedUser based on historical verification data';
    
    -- Also include anyone currently marked as IsVerifiedReferrer (just in case)
    UPDATE Users
    SET IsVerifiedUser = 1
    WHERE IsVerifiedReferrer = 1;

END
ELSE
BEGIN
    PRINT '⏭️ IsVerifiedUser column already exists in Users table';
END
GO
