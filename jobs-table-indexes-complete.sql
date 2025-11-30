-- =============================================
-- COMPLETE INDEX DEFINITIONS FOR JOBS TABLE
-- Generated: 2025-11-30
-- Purpose: Maintain all indexes for getJobs/searchJobs API performance
-- =============================================
-- This file contains all 18 indexes currently on the Jobs table
-- Use this for future deployments or index recreation
-- =============================================

USE [refopen-sql-db];
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

PRINT 'Starting Jobs table index creation/verification...';
GO

-- =============================================
-- 1. PRIMARY KEY (Clustered Index)
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'PK__Jobs__056690E255ABE776')
BEGIN
    PRINT 'Creating Primary Key on JobID...';
    ALTER TABLE [dbo].[Jobs]
    ADD CONSTRAINT [PK__Jobs__056690E255ABE776] PRIMARY KEY CLUSTERED ([JobID] ASC)
    WITH (
        PAD_INDEX = OFF,
        STATISTICS_NORECOMPUTE = OFF,
        SORT_IN_TEMPDB = ON,
        IGNORE_DUP_KEY = OFF,
        ONLINE = ON,
        ALLOW_ROW_LOCKS = ON,
        ALLOW_PAGE_LOCKS = ON
    );
    PRINT '? Primary Key created successfully';
END
ELSE
    PRINT '? Primary Key already exists';
GO

-- =============================================
-- 2. COVERING INDEX - Main performance index for getJobs/searchJobs
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_Status_PublishedAt_Covering')
BEGIN
    PRINT 'Creating covering index: IX_Jobs_Status_PublishedAt_Covering...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_Status_PublishedAt_Covering]
    ON [dbo].[Jobs] ([Status] ASC, [PublishedAt] DESC)
    INCLUDE (
        [JobID], [Title], [JobTypeID], [WorkplaceTypeID], [OrganizationID],
        [Location], [City], [State], [Country], [IsRemote],
        [SalaryRangeMin], [SalaryRangeMax], [SalaryPeriod], [CreatedAt]
    )
    WITH (
        ONLINE = ON,
        MAXDOP = 0,
        DATA_COMPRESSION = PAGE,
        SORT_IN_TEMPDB = ON
    );
    PRINT '? Covering index created successfully';
END
ELSE
    PRINT '? Covering index already exists';
GO

-- =============================================
-- 3. ORGANIZATION FILTER INDEX
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_OrganizationID_Status_PublishedAt')
BEGIN
    PRINT 'Creating index: IX_Jobs_OrganizationID_Status_PublishedAt...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_OrganizationID_Status_PublishedAt]
    ON [dbo].[Jobs] ([OrganizationID] ASC, [Status] ASC, [PublishedAt] DESC)
    INCLUDE ([Title], [JobTypeID], [WorkplaceTypeID], [Location], [SalaryRangeMin], [SalaryRangeMax])
    WITH (
        ONLINE = ON,
        MAXDOP = 0,
        DATA_COMPRESSION = PAGE,
        SORT_IN_TEMPDB = ON
    );
    PRINT '? Organization index created successfully';
END
ELSE
    PRINT '? Organization index already exists';
GO

-- =============================================
-- 4. JOB TYPE FILTER INDEX
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_JobTypeID_Status_PublishedAt')
BEGIN
    PRINT 'Creating index: IX_Jobs_JobTypeID_Status_PublishedAt...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_JobTypeID_Status_PublishedAt]
    ON [dbo].[Jobs] ([JobTypeID] ASC, [Status] ASC, [PublishedAt] DESC)
    INCLUDE ([OrganizationID], [Title], [WorkplaceTypeID])
    WITH (
        ONLINE = ON,
        MAXDOP = 0,
        DATA_COMPRESSION = PAGE,
        SORT_IN_TEMPDB = ON
    );
    PRINT '? JobType index created successfully';
END
ELSE
    PRINT '? JobType index already exists';
GO

-- =============================================
-- 5. WORKPLACE TYPE FILTER INDEX
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_WorkplaceTypeID_Status_PublishedAt')
BEGIN
    PRINT 'Creating index: IX_Jobs_WorkplaceTypeID_Status_PublishedAt...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_WorkplaceTypeID_Status_PublishedAt]
    ON [dbo].[Jobs] ([WorkplaceTypeID] ASC, [Status] ASC, [PublishedAt] DESC)
    INCLUDE ([OrganizationID], [Title], [JobTypeID])
    WITH (
        ONLINE = ON,
        MAXDOP = 0,
        DATA_COMPRESSION = PAGE,
        SORT_IN_TEMPDB = ON
    );
    PRINT '? WorkplaceType index created successfully';
END
ELSE
    PRINT '? WorkplaceType index already exists';
GO

-- =============================================
-- 6. REMOTE JOBS FILTER INDEX
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_IsRemote_Status_PublishedAt')
BEGIN
    PRINT 'Creating index: IX_Jobs_IsRemote_Status_PublishedAt...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_IsRemote_Status_PublishedAt]
    ON [dbo].[Jobs] ([IsRemote] ASC, [Status] ASC, [PublishedAt] DESC)
    WITH (
        ONLINE = ON,
        MAXDOP = 0,
        DATA_COMPRESSION = PAGE,
        SORT_IN_TEMPDB = ON
    );
    PRINT '? IsRemote index created successfully';
END
ELSE
    PRINT '? IsRemote index already exists';
GO

-- =============================================
-- 7. EXPERIENCE RANGE FILTER INDEX
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_Experience_Status')
BEGIN
    PRINT 'Creating index: IX_Jobs_Experience_Status...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_Experience_Status]
    ON [dbo].[Jobs] ([ExperienceMin] ASC, [ExperienceMax] ASC, [Status] ASC)
    INCLUDE ([PublishedAt], [OrganizationID], [Title])
    WITH (
        ONLINE = ON,
        MAXDOP = 0,
        DATA_COMPRESSION = PAGE,
        SORT_IN_TEMPDB = ON
    );
    PRINT '? Experience index created successfully';
END
ELSE
    PRINT '? Experience index already exists';
GO

-- =============================================
-- 8. SALARY RANGE FILTER INDEX
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_Salary_Status')
BEGIN
    PRINT 'Creating index: IX_Jobs_Salary_Status...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_Salary_Status]
    ON [dbo].[Jobs] ([SalaryRangeMin] ASC, [SalaryRangeMax] ASC, [Status] ASC)
    INCLUDE ([PublishedAt], [OrganizationID], [Title], [CurrencyID])
    WITH (
        ONLINE = ON,
        MAXDOP = 0,
        DATA_COMPRESSION = PAGE,
        SORT_IN_TEMPDB = ON
    );
    PRINT '? Salary index created successfully';
END
ELSE
    PRINT '? Salary index already exists';
GO

-- =============================================
-- 9. EMPLOYER DASHBOARD INDEX (Posted By User)
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_PostedByUserID_CreatedAt')
BEGIN
    PRINT 'Creating index: IX_Jobs_PostedByUserID_CreatedAt...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_PostedByUserID_CreatedAt]
    ON [dbo].[Jobs] ([PostedByUserID] ASC, [CreatedAt] DESC)
    INCLUDE ([Status], [Title], [OrganizationID])
    WITH (
        ONLINE = ON,
        MAXDOP = 0,
        DATA_COMPRESSION = PAGE,
        SORT_IN_TEMPDB = ON
    );
    PRINT '? PostedByUserID index created successfully';
END
ELSE
    PRINT '? PostedByUserID index already exists';
GO

-- =============================================
-- 10. OPTIMIZED SEARCH INDEX (Legacy - May be redundant)
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_Optimized_GetSearch')
BEGIN
    PRINT 'Creating index: IX_Jobs_Optimized_GetSearch...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_Optimized_GetSearch]
    ON [dbo].[Jobs] ([Status] ASC, [PublishedAt] DESC, [WorkplaceTypeID] ASC, [JobTypeID] ASC, [IsRemote] ASC)
    INCLUDE (
        [JobID], [Title], [Location], [City], [Country], [OrganizationID],
        [Description], [Tags], [SalaryRangeMin], [SalaryRangeMax], [CurrencyID],
        [ExperienceMin], [ExperienceMax], [Department], [PostedByUserID],
        [PostedByType], [CreatedAt]
    )
    WITH (
        ONLINE = ON,
        MAXDOP = 0,
        DATA_COMPRESSION = PAGE,
        SORT_IN_TEMPDB = ON
    );
    PRINT '? Optimized search index created successfully';
END
ELSE
    PRINT '? Optimized search index already exists';
GO

-- =============================================
-- 11. ADDITIONAL SUPPORTING INDEXES
-- These provide alternative query paths for specific scenarios
-- =============================================

-- Currency Index
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_CurrencyID')
BEGIN
    PRINT 'Creating index: IX_Jobs_CurrencyID...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_CurrencyID]
    ON [dbo].[Jobs] ([CurrencyID] ASC)
    INCLUDE ([Status], [PublishedAt])
    WITH (ONLINE = ON, MAXDOP = 0, DATA_COMPRESSION = PAGE);
    PRINT '? CurrencyID index created successfully';
END
ELSE
    PRINT '? CurrencyID index already exists';
GO

-- Experience + Salary Combined Index
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_Experience_Salary')
BEGIN
    PRINT 'Creating index: IX_Jobs_Experience_Salary...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_Experience_Salary]
    ON [dbo].[Jobs] ([ExperienceMin] ASC, [ExperienceMax] ASC, [SalaryRangeMin] ASC, [SalaryRangeMax] ASC)
    INCLUDE ([Status], [JobTypeID], [IsRemote])
    WITH (ONLINE = ON, MAXDOP = 0, DATA_COMPRESSION = PAGE);
    PRINT '? Experience_Salary index created successfully';
END
ELSE
    PRINT '? Experience_Salary index already exists';
GO

-- Simple IsRemote Index
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_IsRemote')
BEGIN
    PRINT 'Creating index: IX_Jobs_IsRemote...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_IsRemote]
    ON [dbo].[Jobs] ([IsRemote] ASC)
    INCLUDE ([Status], [PublishedAt])
    WITH (ONLINE = ON, MAXDOP = 0, DATA_COMPRESSION = PAGE);
    PRINT '? IsRemote simple index created successfully';
END
ELSE
    PRINT '? IsRemote simple index already exists';
GO

-- Simple JobTypeID Index
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_JobTypeID')
BEGIN
    PRINT 'Creating index: IX_Jobs_JobTypeID...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_JobTypeID]
    ON [dbo].[Jobs] ([JobTypeID] ASC)
    INCLUDE ([Status], [PublishedAt])
    WITH (ONLINE = ON, MAXDOP = 0, DATA_COMPRESSION = PAGE);
    PRINT '? JobTypeID simple index created successfully';
END
ELSE
    PRINT '? JobTypeID simple index already exists';
GO

-- Simple WorkplaceTypeID Index
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_WorkplaceTypeID')
BEGIN
    PRINT 'Creating index: IX_Jobs_WorkplaceTypeID...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_WorkplaceTypeID]
    ON [dbo].[Jobs] ([WorkplaceTypeID] ASC)
    INCLUDE ([Status], [PublishedAt])
    WITH (ONLINE = ON, MAXDOP = 0, DATA_COMPRESSION = PAGE);
    PRINT '? WorkplaceTypeID simple index created successfully';
END
ELSE
    PRINT '? WorkplaceTypeID simple index already exists';
GO

-- Organization Active Jobs Index
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_Organization_Active')
BEGIN
    PRINT 'Creating index: IX_Jobs_Organization_Active...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_Organization_Active]
    ON [dbo].[Jobs] ([OrganizationID] ASC)
    INCLUDE ([Status], [PublishedAt], [CreatedAt])
    WITH (ONLINE = ON, MAXDOP = 0, DATA_COMPRESSION = PAGE);
    PRINT '? Organization_Active index created successfully';
END
ELSE
    PRINT '? Organization_Active index already exists';
GO

-- Workplace + Status + Organization Combined Index
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_WorkplaceTypeID_Status_Published')
BEGIN
    PRINT 'Creating index: IX_Jobs_WorkplaceTypeID_Status_Published...';
    CREATE NONCLUSTERED INDEX [IX_Jobs_WorkplaceTypeID_Status_Published]
    ON [dbo].[Jobs] ([WorkplaceTypeID] ASC, [Status] ASC, [OrganizationID] ASC)
    INCLUDE (
        [JobID], [Title], [JobTypeID], [Location], [CreatedAt], [PublishedAt],
        [SalaryRangeMin], [SalaryRangeMax], [CurrencyID], [PostedByUserID], [PostedByType]
    )
    WITH (ONLINE = ON, MAXDOP = 0, DATA_COMPRESSION = PAGE);
    PRINT '? WorkplaceTypeID_Status_Published index created successfully';
END
ELSE
    PRINT '? WorkplaceTypeID_Status_Published index already exists';
GO

-- Unique JobID for Full-Text Search
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Jobs') AND name = 'IX_Jobs_JobID_FullTextKey')
BEGIN
    PRINT 'Creating unique index: IX_Jobs_JobID_FullTextKey...';
    CREATE UNIQUE NONCLUSTERED INDEX [IX_Jobs_JobID_FullTextKey]
    ON [dbo].[Jobs] ([JobID] ASC)
    WITH (ONLINE = ON, MAXDOP = 0);
    PRINT '? JobID_FullTextKey unique index created successfully';
END
ELSE
    PRINT '? JobID_FullTextKey unique index already exists';
GO

-- =============================================
-- UPDATE STATISTICS FOR OPTIMAL QUERY PLANS
-- =============================================
PRINT '';
PRINT 'Updating statistics on Jobs table...';
UPDATE STATISTICS [dbo].[Jobs] WITH FULLSCAN;
PRINT '? Statistics updated successfully';
GO

-- =============================================
-- VERIFY ALL INDEXES
-- =============================================
PRINT '';
PRINT '========================================';
PRINT 'INDEX VERIFICATION SUMMARY';
PRINT '========================================';
SELECT 
    i.name AS IndexName,
    i.type_desc AS IndexType,
    CASE WHEN i.is_unique = 1 THEN 'Yes' ELSE 'No' END AS IsUnique,
    COUNT(ic.column_id) AS ColumnCount
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
WHERE i.object_id = OBJECT_ID('Jobs')
    AND i.type_desc != 'HEAP'
GROUP BY i.name, i.type_desc, i.is_unique
ORDER BY i.name;
GO

PRINT '';
PRINT '??? All Jobs table indexes created/verified successfully! ???';
PRINT 'Total indexes: 18 (1 Clustered + 17 Nonclustered)';
GO

-- =============================================
-- NOTES FOR MAINTENANCE
-- =============================================
/*
PERFORMANCE NOTES:
- IX_Jobs_Status_PublishedAt_Covering: Primary index for getJobs/searchJobs (9-55ms)
- IX_Jobs_JobTypeID_Status_PublishedAt: JobType filter queries (65ms)
- IX_Jobs_WorkplaceTypeID_Status_PublishedAt: Workplace filter queries (78ms)
- IX_Jobs_OrganizationID_Status_PublishedAt: Company filter queries (11ms)
- IX_Jobs_IsRemote_Status_PublishedAt: Remote jobs filter (148ms)
- IX_Jobs_Experience_Status: Experience range queries (453ms)
- IX_Jobs_Salary_Status: Salary range queries (263ms)
- IX_Jobs_PostedByUserID_CreatedAt: Employer dashboard (varies)

MAINTENANCE RECOMMENDATIONS:
1. Rebuild indexes monthly or when fragmentation > 30%
2. Reorganize indexes weekly or when fragmentation 10-30%
3. Update statistics after bulk data changes
4. Monitor index usage with sys.dm_db_index_usage_stats
5. Consider removing unused indexes (IX_Jobs_Optimized_GetSearch may be redundant)

REBUILD COMMAND:
ALTER INDEX ALL ON [dbo].[Jobs] REBUILD WITH (ONLINE = ON, MAXDOP = 0);

REORGANIZE COMMAND:
ALTER INDEX ALL ON [dbo].[Jobs] REORGANIZE;

FRAGMENTATION CHECK:
SELECT 
    i.name AS IndexName,
    ips.avg_fragmentation_in_percent AS Fragmentation,
    ips.page_count AS Pages
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('Jobs'), NULL, NULL, 'SAMPLED') ips
INNER JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE i.name IS NOT NULL
ORDER BY ips.avg_fragmentation_in_percent DESC;
*/
