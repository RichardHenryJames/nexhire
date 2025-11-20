-- ========================================================================
-- SCRAPING LOGS TABLE - Complete Setup (Create or Update)
-- ========================================================================
--
-- This script handles both scenarios:
-- 1. Creates the ScrapingLogs table if it doesn't exist (with all columns)
-- 2. Updates existing table by adding missing columns (TriggerType, WasPastDue)
--
-- Usage:
--   Run this script on your Azure SQL Database to set up job scraping logging
--
-- Author: RefOpen Team
-- Last Updated: 2024
-- ========================================================================

SET NOCOUNT ON;

-- ========================================================================
-- STEP 1: Create table if it doesn't exist
-- ========================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ScrapingLogs')
BEGIN
    PRINT '⚙️ Creating ScrapingLogs table...';

    CREATE TABLE ScrapingLogs (
        LogId BIGINT IDENTITY(1,1) PRIMARY KEY,
        RunId NVARCHAR(100) NOT NULL,
        StartTime DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        EndTime DATETIMEOFFSET NULL,
        Success BIT NOT NULL DEFAULT 0,
        JobsAdded INT NOT NULL DEFAULT 0,
        IndiaJobs INT NOT NULL DEFAULT 0,
        TotalScraped INT NOT NULL DEFAULT 0,
        Sources NVARCHAR(MAX) NULL,
        ErrorCount INT NOT NULL DEFAULT 0,
        Errors NVARCHAR(MAX) NULL,
        TriggerType NVARCHAR(50) NOT NULL DEFAULT 'Manual',
        WasPastDue BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
    );

    PRINT '✅ ScrapingLogs table created successfully';
END
ELSE
BEGIN
    PRINT 'ℹ️ ScrapingLogs table already exists';
END;

-- ========================================================================
-- STEP 2: Add missing columns to existing table (if needed)
-- ========================================================================

-- Add TriggerType column if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('ScrapingLogs')
      AND name = 'TriggerType'
)
BEGIN
    PRINT '🧩 Adding TriggerType column...';
    ALTER TABLE ScrapingLogs
    ADD TriggerType NVARCHAR(50) NOT NULL DEFAULT 'Manual';
    PRINT '✅ Added TriggerType column';
END
ELSE
BEGIN
    PRINT 'ℹ️ TriggerType column already exists';
END;

-- Add WasPastDue column if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('ScrapingLogs')
      AND name = 'WasPastDue'
)
BEGIN
    PRINT '🧩 Adding WasPastDue column...';
    ALTER TABLE ScrapingLogs
    ADD WasPastDue BIT NOT NULL DEFAULT 0;
    PRINT '✅ Added WasPastDue column';
END
ELSE
BEGIN
    PRINT 'ℹ️ WasPastDue column already exists';
END;

-- ========================================================================
-- STEP 3: Create performance indexes
-- ========================================================================

-- Index for faster queries on TriggerType and StartTime
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_ScrapingLogs_TriggerType_StartTime'
      AND object_id = OBJECT_ID('ScrapingLogs')
)
BEGIN
    PRINT '⚙️ Creating performance index (TriggerType, StartTime)...';
    CREATE NONCLUSTERED INDEX IX_ScrapingLogs_TriggerType_StartTime
    ON ScrapingLogs (TriggerType, StartTime DESC)
    INCLUDE (Success, JobsAdded, TotalScraped);
    PRINT '✅ Created index IX_ScrapingLogs_TriggerType_StartTime';
END
ELSE
BEGIN
    PRINT 'ℹ️ Index IX_ScrapingLogs_TriggerType_StartTime already exists';
END;

-- Index for faster RunId lookups
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_ScrapingLogs_RunId'
      AND object_id = OBJECT_ID('ScrapingLogs')
)
BEGIN
    PRINT '⚙️ Creating RunId index...';
    CREATE NONCLUSTERED INDEX IX_ScrapingLogs_RunId
    ON ScrapingLogs (RunId);
    PRINT '✅ Created index IX_ScrapingLogs_RunId';
END
ELSE
BEGIN
    PRINT 'ℹ️ Index IX_ScrapingLogs_RunId already exists';
END;

-- ========================================================================
-- STEP 4: Display table structure
-- ========================================================================

PRINT '';
PRINT '📘===============================================================';
PRINT '📘 SCRAPING LOGS TABLE STRUCTURE';
PRINT '📘===============================================================';
PRINT '';

SELECT
    ORDINAL_POSITION AS [#],
    COLUMN_NAME AS [Column],
    DATA_TYPE AS [Type],
    CASE
        WHEN CHARACTER_MAXIMUM_LENGTH = -1 THEN 'MAX'
        WHEN CHARACTER_MAXIMUM_LENGTH IS NOT NULL THEN CAST(CHARACTER_MAXIMUM_LENGTH AS VARCHAR(10))
        ELSE ''
    END AS [Size],
    IS_NULLABLE AS [Nullable],
    ISNULL(COLUMN_DEFAULT, '') AS [Default]
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ScrapingLogs'
ORDER BY ORDINAL_POSITION;

-- ========================================================================
-- STEP 5: Display summary statistics
-- ========================================================================

DECLARE @TotalLogs INT;
DECLARE @ManualLogs INT;
DECLARE @TimerLogs INT;
DECLARE @SuccessRate DECIMAL(5,2);

SELECT @TotalLogs = COUNT(*) FROM ScrapingLogs;
SELECT @ManualLogs = COUNT(*) FROM ScrapingLogs WHERE TriggerType = 'Manual';
SELECT @TimerLogs = COUNT(*) FROM ScrapingLogs WHERE TriggerType = 'TimerTrigger';
SELECT @SuccessRate = CASE
    WHEN COUNT(*) > 0 THEN CAST(SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2))
    ELSE 0
END FROM ScrapingLogs;

PRINT '';
PRINT '📊===============================================================';
PRINT '📊 SCRAPING LOGS STATISTICS';
PRINT '📊===============================================================';
PRINT '';
PRINT '   Total Log Entries:   ' + CAST(@TotalLogs AS VARCHAR(10));
PRINT '   Manual Triggers:     ' + CAST(@ManualLogs AS VARCHAR(10));
PRINT '   Timer Triggers:      ' + CAST(@TimerLogs AS VARCHAR(10));
PRINT '   Success Rate:        ' + CAST(@SuccessRate AS VARCHAR(10)) + '%';
PRINT '';

-- ========================================================================
-- STEP 6: Display recent scraping runs (if any)
-- ========================================================================

IF @TotalLogs > 0
BEGIN
    PRINT '📅===============================================================';
    PRINT '📅 RECENT SCRAPING RUNS (Last 5)';
    PRINT '📅===============================================================';
    PRINT '';

    SELECT TOP 5
        RunId,
        TriggerType,
        CASE WHEN Success = 1 THEN '✅' ELSE '❌' END AS Status,
        JobsAdded,
        TotalScraped,
        IndiaJobs,
        CASE WHEN WasPastDue = 1 THEN '⚠️' ELSE '🕐' END AS OnTime,
        DATEDIFF(SECOND, StartTime, EndTime) AS DurationSec,
        FORMAT(StartTime, 'yyyy-MM-dd HH:mm:ss') AS StartTime
    FROM ScrapingLogs
    ORDER BY StartTime DESC;
END
ELSE
BEGIN
    PRINT 'ℹ️===============================================================';
    PRINT 'ℹ️ No scraping runs recorded yet';
    PRINT 'ℹ️===============================================================';
END;

-- ========================================================================
-- FINAL MESSAGE
-- ========================================================================

PRINT '';
PRINT '🚀===============================================================';
PRINT '🚀 SCRAPING LOGS TABLE SETUP COMPLETED SUCCESSFULLY';
PRINT '🚀===============================================================';
PRINT '';
PRINT '👉 Next Steps:';
PRINT '   1. Deploy your Azure Function with Timer Trigger';
PRINT '   2. Monitor executions in this table';
PRINT '   3. Use provided queries for monitoring (see below)';
PRINT '';
PRINT '📈 Useful Monitoring Queries:';
PRINT '';
PRINT '-- Recent executions:';
PRINT 'SELECT TOP 10 * FROM ScrapingLogs ORDER BY StartTime DESC;';
PRINT '';
PRINT '-- Success rate by trigger type:';
PRINT 'SELECT TriggerType, COUNT(*) AS Total, ';
PRINT '       SUM(CASE WHEN Success=1 THEN 1 ELSE 0 END) AS Successful';
PRINT 'FROM ScrapingLogs GROUP BY TriggerType;';
PRINT '';
PRINT '-- Average execution time:';
PRINT 'SELECT AVG(DATEDIFF(SECOND, StartTime, EndTime)) AS AvgSeconds';
PRINT 'FROM ScrapingLogs WHERE Success = 1;';
PRINT '';

SET NOCOUNT OFF;
