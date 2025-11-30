-- Add Fortune 500 column to Organizations table
-- This marks organizations that are Fortune 500 companies

USE [refopen-sql-db];
GO

-- Check if column already exists
IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Organizations' 
    AND COLUMN_NAME = 'IsFortune500'
)
BEGIN
    ALTER TABLE Organizations
    ADD IsFortune500 BIT NOT NULL DEFAULT 0;
    
    PRINT '? Added IsFortune500 column to Organizations table';
END
ELSE
BEGIN
    PRINT '??  IsFortune500 column already exists';
END
GO

-- Add index for better query performance
IF NOT EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'IX_Organizations_IsFortune500' 
    AND object_id = OBJECT_ID('Organizations')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Organizations_IsFortune500
    ON Organizations(IsFortune500)
    INCLUDE (Name, OrganizationID);
    
    PRINT '? Added index on IsFortune500 column';
END
ELSE
BEGIN
    PRINT '??  Index already exists';
END
GO

-- Show current state
SELECT 
    COUNT(*) AS TotalOrganizations,
    SUM(CASE WHEN IsFortune500 = 1 THEN 1 ELSE 0 END) AS Fortune500Count
FROM Organizations
WHERE IsActive = 1;
GO
