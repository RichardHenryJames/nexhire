-- ============================================================================
-- Migration: Add External Job Fields to ReferralRequests Table
-- Description: Add JobTitle and JobURL columns for external referrals
-- Date: 2025-01-XX
-- ============================================================================

-- Add JobTitle column (nullable, for external referrals)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('ReferralRequests') 
    AND name = 'JobTitle'
)
BEGIN
    ALTER TABLE ReferralRequests
    ADD JobTitle NVARCHAR(200) NULL;
    
    PRINT '? Added JobTitle column to ReferralRequests table';
END
ELSE
BEGIN
    PRINT '?? JobTitle column already exists in ReferralRequests table';
END
GO

-- Add JobURL column (nullable, for external referrals)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('ReferralRequests') 
    AND name = 'JobURL'
)
BEGIN
    ALTER TABLE ReferralRequests
    ADD JobURL NVARCHAR(500) NULL;
    
    PRINT '? Added JobURL column to ReferralRequests table';
END
ELSE
BEGIN
    PRINT '?? JobURL column already exists in ReferralRequests table';
END
GO

-- Add index on JobTitle for search performance (optional but recommended)
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_ReferralRequests_JobTitle' 
    AND object_id = OBJECT_ID('ReferralRequests')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_ReferralRequests_JobTitle
    ON ReferralRequests(JobTitle)
    WHERE JobTitle IS NOT NULL;
    
    PRINT '? Created index on JobTitle column';
END
GO

-- Verify the changes
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ReferralRequests'
AND COLUMN_NAME IN ('JobTitle', 'JobURL', 'ExtJobID', 'OrganizationID')
ORDER BY ORDINAL_POSITION;
GO

PRINT '';
PRINT '============================================================================';
PRINT 'Migration completed successfully!';
PRINT '============================================================================';
PRINT '';
PRINT 'Summary:';
PRINT '  - JobTitle column added (NVARCHAR(200), nullable)';
PRINT '  - JobURL column added (NVARCHAR(500), nullable)';
PRINT '  - Index created on JobTitle for search performance';
PRINT '';
PRINT 'Usage:';
PRINT '  - For EXTERNAL referrals: Store job title and URL directly in these columns';
PRINT '  - For INTERNAL referrals: These columns remain NULL (job data comes from Jobs table)';
PRINT '  - Company name is derived from OrganizationID (no need to store separately)';
PRINT '';
GO
