-- =============================================
-- Migration: 030_create_daily_job_email_logs.sql
-- Description: Creates DailyJobEmailLogs table for tracking daily job recommendation emails
-- Created: 2026-01-07
-- =============================================

-- Create DailyJobEmailLogs table if not exists
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DailyJobEmailLogs')
BEGIN
    CREATE TABLE DailyJobEmailLogs (
        LogID INT IDENTITY(1,1) PRIMARY KEY,
        ExecutionID NVARCHAR(100) NOT NULL,
        StartTime DATETIME2 NOT NULL,
        EndTime DATETIME2 NOT NULL,
        DurationSeconds INT,
        TotalUsers INT NOT NULL DEFAULT 0,
        EmailsSent INT NOT NULL DEFAULT 0,
        EmailsFailed INT NOT NULL DEFAULT 0,
        Errors NVARCHAR(MAX),
        TriggerType NVARCHAR(50) NOT NULL DEFAULT 'Manual',
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    
    -- Index for querying by start time (most recent first)
    CREATE INDEX IX_DailyJobEmailLogs_StartTime ON DailyJobEmailLogs(StartTime DESC);
    
    -- Index for querying by trigger type
    CREATE INDEX IX_DailyJobEmailLogs_TriggerType ON DailyJobEmailLogs(TriggerType);
    
    PRINT '✅ Table DailyJobEmailLogs created successfully';
END
ELSE
BEGIN
    PRINT '⏭️ Table DailyJobEmailLogs already exists - skipping';
END
GO

-- Verify table creation
SELECT 
    t.name AS TableName,
    c.name AS ColumnName,
    ty.name AS DataType,
    c.max_length AS MaxLength,
    c.is_nullable AS IsNullable
FROM sys.tables t
INNER JOIN sys.columns c ON t.object_id = c.object_id
INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
WHERE t.name = 'DailyJobEmailLogs'
ORDER BY c.column_id;
GO
