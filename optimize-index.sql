-- Create Full-Text Catalog if not exists (for text searches)
IF NOT EXISTS (SELECT * FROM sys.fulltext_catalogs WHERE name = 'JobsFullTextCatalog')
BEGIN
    CREATE FULLTEXT CATALOG JobsFullTextCatalog AS DEFAULT;
    PRINT 'Full-Text Catalog created: JobsFullTextCatalog';
END

-- Create a new non-clustered unique index on JobID for full-text key (if not exists)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_JobID_FullTextKey' AND object_id = OBJECT_ID('Jobs'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_Jobs_JobID_FullTextKey
    ON Jobs (JobID);
    PRINT 'Unique Index created: IX_Jobs_JobID_FullTextKey';
END

-- Create Full-Text Index on Jobs table for Title, Description, Tags (if not exists) using the new index
IF NOT EXISTS (SELECT * FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('Jobs'))
BEGIN
    CREATE FULLTEXT INDEX ON Jobs (Title, Description, Tags)
    KEY INDEX IX_Jobs_JobID_FullTextKey ON JobsFullTextCatalog
    WITH CHANGE_TRACKING AUTO;
    PRINT 'Full-Text Index created on Jobs table using IX_Jobs_JobID_FullTextKey';
END

-- Composite Index for Status + Date sorting + Search coverage (primary for searchJobs/getJobs)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_Status_FullText_Search' AND object_id = OBJECT_ID('Jobs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_Status_FullText_Search
    ON Jobs (Status, PublishedAt, CreatedAt)
    INCLUDE (Title, Description, Tags, Location, City, Country, Department, JobTypeID, WorkplaceTypeID, IsRemote, OrganizationID)
    WHERE Status = 'Published';  -- Filtered for common case
    PRINT 'Index created: IX_Jobs_Status_FullText_Search';
END

-- Index for Organization joins and active filter
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_Organization_Active' AND object_id = OBJECT_ID('Jobs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_Organization_Active
    ON Jobs (OrganizationID)
    INCLUDE (Status, PublishedAt, CreatedAt)
    WHERE Status = 'Published';  -- Filtered
    PRINT 'Index created: IX_Jobs_Organization_Active';
END

-- Index for Experience and Salary range filters
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_Experience_Salary' AND object_id = OBJECT_ID('Jobs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_Experience_Salary
    ON Jobs (ExperienceMin, ExperienceMax, SalaryRangeMin, SalaryRangeMax)
    INCLUDE (Status, JobTypeID, IsRemote);
    PRINT 'Index created: IX_Jobs_Experience_Salary';
END

-- Additional supporting indexes for equality filters
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_JobTypeID' AND object_id = OBJECT_ID('Jobs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_JobTypeID ON Jobs (JobTypeID) INCLUDE (Status, PublishedAt);
    PRINT 'Index created: IX_Jobs_JobTypeID';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_WorkplaceTypeID' AND object_id = OBJECT_ID('Jobs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_WorkplaceTypeID ON Jobs (WorkplaceTypeID) INCLUDE (Status, PublishedAt);
    PRINT 'Index created: IX_Jobs_WorkplaceTypeID';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_CurrencyID' AND object_id = OBJECT_ID('Jobs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_CurrencyID ON Jobs (CurrencyID) INCLUDE (Status, PublishedAt);
    PRINT 'Index created: IX_Jobs_CurrencyID';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Jobs_IsRemote' AND object_id = OBJECT_ID('Jobs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Jobs_IsRemote ON Jobs (IsRemote) INCLUDE (Status, PublishedAt);
    PRINT 'Index created: IX_Jobs_IsRemote';
END

-- Existing indexes remain unchanged...

-- Index for JobApplications subquery in excludeUserApplications
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_JobApplications_JobID_Applicant_Status' AND object_id = OBJECT_ID('JobApplications'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_JobApplications_JobID_Applicant_Status
    ON JobApplications (JobID, ApplicantID, StatusID);
    PRINT 'Index created: IX_JobApplications_JobID_Applicant_Status';
END

PRINT 'All optimizations applied. Monitor usage with: SELECT * FROM sys.dm_db_index_usage_stats WHERE object_id IN (OBJECT_ID(''Jobs''), OBJECT_ID(''JobApplications''));';

