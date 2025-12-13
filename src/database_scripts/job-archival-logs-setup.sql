-- ========================================================================
-- JOB ARCHIVAL LOGS TABLE - Complete Setup (Create or Update)
-- ========================================================================
--
-- This script creates the JobArchiveLogs table for tracking automated
-- job archival operations (jobs older than 30 days moved to blob storage)
--
-- Usage:
--   Run this script on your Azure SQL Database to set up job archival logging
--
-- Author: RefOpen Team
-- Last Updated: 2024
-- ========================================================================

SET NOCOUNT ON;

-- ========================================================================
-- STEP 1: Create JobArchiveLogs table if it doesn't exist
-- ========================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JobArchiveLogs')
BEGIN
    PRINT '?? Creating JobArchiveLogs table...';

    CREATE TABLE JobArchiveLogs (
        LogID INT IDENTITY(1,1) PRIMARY KEY,
        RunID NVARCHAR(50) NOT NULL,
        StartTime DATETIME2 NOT NULL,
        EndTime DATETIME2 NOT NULL,
        DaysOld INT NOT NULL,
        TotalJobsFound INT NOT NULL DEFAULT 0,
        TotalJobsArchived INT NOT NULL DEFAULT 0,
        TotalJobsDeleted INT NOT NULL DEFAULT 0,
        Success BIT NOT NULL DEFAULT 0,
        ErrorCount INT NOT NULL DEFAULT 0,
        Errors NVARCHAR(MAX) NULL,
        ArchivedJobIDs NVARCHAR(MAX) NULL,
        DurationSeconds INT NOT NULL DEFAULT 0,
        TriggerType NVARCHAR(50) NOT NULL DEFAULT 'Manual',
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        
        CONSTRAINT CK_JobArchiveLogs_DaysOld CHECK (DaysOld > 0 AND DaysOld <= 365),
        CONSTRAINT CK_JobArchiveLogs_Counts CHECK (
            TotalJobsArchived <= TotalJobsFound AND 
            TotalJobsDeleted <= TotalJobsArchived
        )
    );

    PRINT '? JobArchiveLogs table created successfully';
END
ELSE
BEGIN
    PRINT '?? JobArchiveLogs table already exists';
END;

-- ========================================================================
-- STEP 2: Create performance indexes
-- ========================================================================

-- Index for faster queries on TriggerType and StartTime
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_JobArchiveLogs_TriggerType_StartTime'
      AND object_id = OBJECT_ID('JobArchiveLogs')
)
BEGIN
    PRINT '?? Creating performance index (TriggerType, StartTime)...';
    CREATE NONCLUSTERED INDEX IX_JobArchiveLogs_TriggerType_StartTime
    ON JobArchiveLogs (TriggerType, StartTime DESC)
    INCLUDE (Success, TotalJobsArchived, TotalJobsDeleted);
    PRINT '? Created index IX_JobArchiveLogs_TriggerType_StartTime';
END
ELSE
BEGIN
    PRINT '?? Index IX_JobArchiveLogs_TriggerType_StartTime already exists';
END;

-- Index for faster RunId lookups
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_JobArchiveLogs_RunID'
      AND object_id = OBJECT_ID('JobArchiveLogs')
)
BEGIN
    PRINT '?? Creating RunID index...';
    CREATE NONCLUSTERED INDEX IX_JobArchiveLogs_RunID
    ON JobArchiveLogs (RunID);
    PRINT '? Created index IX_JobArchiveLogs_RunID';
END
ELSE
BEGIN
    PRINT '?? Index IX_JobArchiveLogs_RunID already exists';
END;

-- Index for Success status queries
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_JobArchiveLogs_Success_StartTime'
      AND object_id = OBJECT_ID('JobArchiveLogs')
)
BEGIN
    PRINT '?? Creating Success status index...';
    CREATE NONCLUSTERED INDEX IX_JobArchiveLogs_Success_StartTime
    ON JobArchiveLogs (Success, StartTime DESC);
    PRINT '? Created index IX_JobArchiveLogs_Success_StartTime';
END
ELSE
BEGIN
    PRINT '?? Index IX_JobArchiveLogs_Success_StartTime already exists';
END;

-- ========================================================================
-- STEP 3: Display table structure
-- ========================================================================

PRINT '';
PRINT '??===============================================================';
PRINT '?? JOB ARCHIVAL LOGS TABLE STRUCTURE';
PRINT '??===============================================================';
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
WHERE TABLE_NAME = 'JobArchiveLogs'
ORDER BY ORDINAL_POSITION;

-- ========================================================================
-- STEP 4: Display summary statistics
-- ========================================================================

DECLARE @TotalRuns INT;
DECLARE @ManualRuns INT;
DECLARE @TimerRuns INT;
DECLARE @SuccessRate DECIMAL(5,2);
DECLARE @TotalArchived INT;
DECLARE @TotalDeleted INT;

SELECT @TotalRuns = COUNT(*) FROM JobArchiveLogs;
SELECT @ManualRuns = COUNT(*) FROM JobArchiveLogs WHERE TriggerType = 'Manual';
SELECT @TimerRuns = COUNT(*) FROM JobArchiveLogs WHERE TriggerType = 'TimerTrigger';
SELECT @SuccessRate = CASE
    WHEN COUNT(*) > 0 THEN CAST(SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2))
    ELSE 0
END FROM JobArchiveLogs;
SELECT @TotalArchived = ISNULL(SUM(TotalJobsArchived), 0) FROM JobArchiveLogs;
SELECT @TotalDeleted = ISNULL(SUM(TotalJobsDeleted), 0) FROM JobArchiveLogs;

PRINT '';
PRINT '??===============================================================';
PRINT '?? JOB ARCHIVAL STATISTICS';
PRINT '??===============================================================';
PRINT '';
PRINT '   Total Archival Runs:      ' + CAST(@TotalRuns AS VARCHAR(10));
PRINT '   Manual Triggers:          ' + CAST(@ManualRuns AS VARCHAR(10));
PRINT '   Timer Triggers:           ' + CAST(@TimerRuns AS VARCHAR(10));
PRINT '   Success Rate:             ' + CAST(@SuccessRate AS VARCHAR(10)) + '%';
PRINT '   Total Jobs Archived:      ' + CAST(@TotalArchived AS VARCHAR(10));
PRINT '   Total Jobs Deleted (SQL): ' + CAST(@TotalDeleted AS VARCHAR(10));
PRINT '';

-- ========================================================================
-- STEP 5: Display recent archival runs (if any)
-- ========================================================================

IF @TotalRuns > 0
BEGIN
    PRINT '??===============================================================';
    PRINT '?? RECENT ARCHIVAL RUNS (Last 5)';
    PRINT '??===============================================================';
    PRINT '';

    SELECT TOP 5
        RunID,
        TriggerType,
        CASE WHEN Success = 1 THEN '?' ELSE '?' END AS Status,
        DaysOld,
        TotalJobsFound AS Found,
        TotalJobsArchived AS Archived,
        TotalJobsDeleted AS Deleted,
        DurationSeconds AS [Duration(s)],
        FORMAT(StartTime, 'yyyy-MM-dd HH:mm:ss') AS StartTime,
        CASE WHEN ErrorCount > 0 THEN '?? ' + CAST(ErrorCount AS VARCHAR) + ' errors' ELSE '? No errors' END AS Errors
    FROM JobArchiveLogs
    ORDER BY StartTime DESC;
END
ELSE
BEGIN
    PRINT '??===============================================================';
    PRINT '?? No archival runs recorded yet';
    PRINT '??===============================================================';
END;

-- ========================================================================
-- STEP 6: Create helpful views (optional)
-- ========================================================================

-- View for quick monitoring
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'vw_RecentArchivalSummary')
BEGIN
    PRINT '?? Creating monitoring view...';
    EXEC('
    CREATE VIEW vw_RecentArchivalSummary AS
    SELECT
        LogID,
        RunID,
        TriggerType,
        Success,
        DaysOld,
        TotalJobsFound,
        TotalJobsArchived,
        TotalJobsDeleted,
        DurationSeconds,
        CASE 
            WHEN ErrorCount = 0 THEN ''No Errors''
            ELSE CAST(ErrorCount AS VARCHAR) + '' Errors''
        END AS ErrorStatus,
        StartTime,
        EndTime
    FROM JobArchiveLogs
    ');
    PRINT '? Created view vw_RecentArchivalSummary';
END;

-- ========================================================================
-- FINAL MESSAGE
-- ========================================================================

PRINT '';
PRINT '??===============================================================';
PRINT '?? JOB ARCHIVAL LOGS TABLE SETUP COMPLETED SUCCESSFULLY';
PRINT '??===============================================================';
PRINT '';
PRINT '?? Next Steps:';
PRINT '   1. Ensure Azure Storage container "archived-jobs" exists';
PRINT '   2. Deploy Azure Function with Timer Trigger (runs daily at midnight)';
PRINT '   3. Monitor archival operations in this table';
PRINT '   4. View archived jobs in Azure Blob Storage: archived-jobs container';
PRINT '';
PRINT '?? Useful Monitoring Queries:';
PRINT '';
PRINT '-- Recent archival runs:';
PRINT 'SELECT TOP 10 * FROM JobArchiveLogs ORDER BY StartTime DESC;';
PRINT '';
PRINT '-- Success rate by trigger type:';
PRINT 'SELECT TriggerType, ';
PRINT '       COUNT(*) AS TotalRuns,';
PRINT '       SUM(CASE WHEN Success=1 THEN 1 ELSE 0 END) AS Successful,';
PRINT '       SUM(TotalJobsArchived) AS TotalArchived,';
PRINT '       SUM(TotalJobsDeleted) AS TotalDeleted';
PRINT 'FROM JobArchiveLogs GROUP BY TriggerType;';
PRINT '';
PRINT '-- Average archival performance:';
PRINT 'SELECT ';
PRINT '    AVG(DurationSeconds) AS AvgDurationSeconds,';
PRINT '    AVG(TotalJobsArchived) AS AvgJobsPerRun,';
PRINT '    MAX(TotalJobsArchived) AS MaxJobsInOneRun';
PRINT 'FROM JobArchiveLogs WHERE Success = 1;';
PRINT '';
PRINT '-- Check for failures:';
PRINT 'SELECT RunID, StartTime, ErrorCount, Errors ';
PRINT 'FROM JobArchiveLogs ';
PRINT 'WHERE Success = 0 OR ErrorCount > 0 ';
PRINT 'ORDER BY StartTime DESC;';
PRINT '';
PRINT '-- Use the convenience view:';
PRINT 'SELECT * FROM vw_RecentArchivalSummary ORDER BY StartTime DESC;';
PRINT '';

SET NOCOUNT OFF;

