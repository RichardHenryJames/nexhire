# Database Performance & Optimization Guide

## Overview

This guide covers performance optimization strategies, indexing, query tuning, and best practices for the NexHire database.

## Database Configuration

### Azure SQL Database Tier
- **Development**: Basic (5 DTU)
- **Production**: Standard S3 (100 DTU) or Premium for high load

### Connection Pooling

```typescript
// src/config/database.ts
import { ConnectionPool } from 'mssql'

const poolConfig = {
  max: 50,           // Maximum connections
  min: 10,           // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeout: 15000,
  requestTimeout: 15000
}

export const pool = new ConnectionPool(poolConfig)
```

## Indexing Strategy

### Jobs Table Indexes

```sql
-- Primary key (clustered)
CREATE CLUSTERED INDEX PK_jobs ON jobs(id)

-- Search and filtering
CREATE NONCLUSTERED INDEX idx_jobs_title ON jobs(title) 
  INCLUDE (organization_id, location, salary_min, salary_max)

CREATE NONCLUSTERED INDEX idx_jobs_org ON jobs(organization_id)
  INCLUDE (title, location, posted_date, is_active)

CREATE NONCLUSTERED INDEX idx_jobs_location ON jobs(location)
  WHERE is_active = 1

CREATE NONCLUSTERED INDEX idx_jobs_posted ON jobs(posted_date DESC)
  WHERE is_active = 1

-- Full-text search
CREATE FULLTEXT INDEX ON jobs(title, description)
  KEY INDEX PK_jobs

-- Composite index for common queries
CREATE NONCLUSTERED INDEX idx_jobs_search ON jobs(
  is_active, posted_date DESC, organization_id
) INCLUDE (title, location, salary_min, salary_max)
```

### Users Table Indexes

```sql
CREATE NONCLUSTERED INDEX idx_users_email ON users(email)

CREATE NONCLUSTERED INDEX idx_users_firebase ON users(firebase_uid)

CREATE NONCLUSTERED INDEX idx_users_created ON users(created_at DESC)
```

### Referrals Table Indexes

```sql
CREATE NONCLUSTERED INDEX idx_referrals_job ON referrals(job_id)
  INCLUDE (seeker_id, referrer_id, status)

CREATE NONCLUSTERED INDEX idx_referrals_seeker ON referrals(seeker_id, status)
  INCLUDE (job_id, created_at)

CREATE NONCLUSTERED INDEX idx_referrals_referrer ON referrals(referrer_id, status)
  INCLUDE (job_id, created_at)

CREATE NONCLUSTERED INDEX idx_referrals_status ON referrals(status, created_at DESC)
```

### Organizations Table Indexes

```sql
CREATE NONCLUSTERED INDEX idx_orgs_name ON organizations(name)

CREATE NONCLUSTERED INDEX idx_orgs_fortune500 ON organizations(is_fortune_500)
  WHERE is_fortune_500 = 1

CREATE FULLTEXT INDEX ON organizations(name, description)
  KEY INDEX PK_organizations
```

## Query Optimization

### Example 1: Job Search with Filters

**Before (Slow)**:
```sql
SELECT * FROM jobs
WHERE is_active = 1
  AND location LIKE '%San Francisco%'
  AND title LIKE '%Engineer%'
ORDER BY posted_date DESC
```

**After (Optimized)**:
```sql
-- Use indexed columns and INCLUDE clause
SELECT 
  j.id, j.title, j.location, j.salary_min, j.salary_max,
  j.posted_date, o.name as company_name, o.logo as company_logo
FROM jobs j
INNER JOIN organizations o ON j.organization_id = o.id
WHERE j.is_active = 1
  AND j.location = 'San Francisco, CA'  -- Exact match
  AND CONTAINS(j.title, '"Engineer*"')   -- Full-text search
ORDER BY j.posted_date DESC
OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY
```

### Example 2: Get User with Work Experience

**Before (N+1 Query)**:
```typescript
// Fetches user, then makes separate query for work experience
const user = await getUser(userId)
const workExp = await getWorkExperience(userId)
```

**After (Single Query with JOIN)**:
```sql
SELECT 
  u.*, 
  we.id as exp_id, we.company, we.title as job_title,
  we.start_date, we.end_date, we.description
FROM users u
LEFT JOIN work_experience we ON u.id = we.user_id
WHERE u.id = @userId
```

### Example 3: Referral Dashboard

**Optimized Query**:
```sql
WITH referral_stats AS (
  SELECT 
    r.referrer_id,
    COUNT(*) as total_referrals,
    SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) as successful,
    AVG(DATEDIFF(day, r.created_at, r.updated_at)) as avg_response_time
  FROM referrals r
  WHERE r.referrer_id = @userId
  GROUP BY r.referrer_id
)
SELECT 
  r.id, r.job_id, r.status, r.created_at,
  j.title, j.location,
  o.name as company_name,
  u.display_name as seeker_name,
  rs.total_referrals, rs.successful, rs.avg_response_time
FROM referrals r
INNER JOIN jobs j ON r.job_id = j.id
INNER JOIN organizations o ON j.organization_id = o.id
INNER JOIN users u ON r.seeker_id = u.id
CROSS APPLY referral_stats rs
WHERE r.referrer_id = @userId
ORDER BY r.created_at DESC
```

## Performance Monitoring

### Query Performance Script

```sql
-- Find slow queries
SELECT 
  qs.execution_count,
  SUBSTRING(qt.text, (qs.statement_start_offset/2)+1,
    ((CASE qs.statement_end_offset
      WHEN -1 THEN DATALENGTH(qt.text)
      ELSE qs.statement_end_offset
    END - qs.statement_start_offset)/2) + 1) AS statement_text,
  qs.total_elapsed_time / 1000000.0 AS total_elapsed_time_sec,
  qs.total_elapsed_time / qs.execution_count / 1000000.0 AS avg_elapsed_time_sec,
  qs.total_logical_reads / qs.execution_count AS avg_logical_reads,
  qs.last_execution_time
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt
WHERE qt.text LIKE '%jobs%' OR qt.text LIKE '%referrals%'
ORDER BY qs.total_elapsed_time DESC
```

### Index Usage Statistics

```sql
-- Find unused indexes
SELECT 
  OBJECT_NAME(i.object_id) AS table_name,
  i.name AS index_name,
  i.type_desc,
  us.user_seeks,
  us.user_scans,
  us.user_lookups,
  us.user_updates
FROM sys.indexes i
LEFT JOIN sys.dm_db_index_usage_stats us 
  ON i.object_id = us.object_id AND i.index_id = us.index_id
WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
  AND i.type_desc != 'HEAP'
ORDER BY us.user_seeks + us.user_scans + us.user_lookups ASC
```

### Missing Indexes

```sql
-- Find missing indexes suggested by SQL Server
SELECT 
  CONVERT(decimal(18,2), migs.avg_total_user_cost * migs.avg_user_impact * 
    (migs.user_seeks + migs.user_scans)) AS improvement_measure,
  'CREATE INDEX idx_' + 
    REPLACE(REPLACE(REPLACE(mid.equality_columns, ', ', '_'), '[', ''), ']', '') +
    ' ON ' + mid.statement + ' (' + ISNULL(mid.equality_columns, '') +
    CASE WHEN mid.inequality_columns IS NOT NULL 
      THEN CASE WHEN mid.equality_columns IS NOT NULL THEN ',' ELSE '' END + 
        mid.inequality_columns 
      ELSE '' 
    END + ')' +
    CASE WHEN mid.included_columns IS NOT NULL 
      THEN ' INCLUDE (' + mid.included_columns + ')' 
      ELSE '' 
    END AS create_index_statement,
  migs.user_seeks,
  migs.user_scans,
  migs.avg_total_user_cost,
  migs.avg_user_impact
FROM sys.dm_db_missing_index_groups mig
INNER JOIN sys.dm_db_missing_index_group_stats migs 
  ON migs.group_handle = mig.index_group_handle
INNER JOIN sys.dm_db_missing_index_details mid 
  ON mig.index_handle = mid.index_handle
ORDER BY improvement_measure DESC
```

## Caching Strategy

### Application-Level Caching

```typescript
// src/utils/cache.ts
import NodeCache from 'node-cache'

// Cache for 5 minutes
const jobCache = new NodeCache({ stdTTL: 300 })

export async function getCachedJob(jobId: number) {
  const cacheKey = `job:${jobId}`
  
  let job = jobCache.get(cacheKey)
  if (job) return job
  
  job = await fetchJobFromDatabase(jobId)
  jobCache.set(cacheKey, job)
  
  return job
}

// Invalidate cache on update
export async function updateJob(jobId: number, data: any) {
  await updateJobInDatabase(jobId, data)
  jobCache.del(`job:${jobId}`)
}
```

### Redis Caching

```typescript
// src/config/redis.ts
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_CONNECTION_STRING)

export async function getCachedData(key: string): Promise<any> {
  const cached = await redis.get(key)
  return cached ? JSON.parse(cached) : null
}

export async function setCachedData(
  key: string, 
  data: any, 
  ttl: number = 300
): Promise<void> {
  await redis.setex(key, ttl, JSON.stringify(data))
}

// Example usage for job search
export async function searchJobs(filters: any) {
  const cacheKey = `jobs:search:${JSON.stringify(filters)}`
  
  let results = await getCachedData(cacheKey)
  if (results) return results
  
  results = await executeJobSearch(filters)
  await setCachedData(cacheKey, results, 300) // 5 minutes
  
  return results
}
```

## Database Partitioning

### Partition Jobs by Date

```sql
-- Create partition function
CREATE PARTITION FUNCTION pf_jobs_by_date (DATETIME)
AS RANGE RIGHT FOR VALUES (
  '2024-01-01', '2024-04-01', '2024-07-01', '2024-10-01',
  '2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01'
)

-- Create partition scheme
CREATE PARTITION SCHEME ps_jobs_by_date
AS PARTITION pf_jobs_by_date
ALL TO ([PRIMARY])

-- Create partitioned table
CREATE TABLE jobs_partitioned (
  id INT IDENTITY(1,1),
  title NVARCHAR(500),
  posted_date DATETIME NOT NULL,
  -- other columns...
  CONSTRAINT PK_jobs_partitioned PRIMARY KEY (id, posted_date)
) ON ps_jobs_by_date(posted_date)
```

## Archival Strategy

### Archive Old Jobs

```sql
-- Create archive table (same schema as jobs)
CREATE TABLE jobs_archive (
  -- same schema as jobs table
)

-- Archive jobs older than 6 months
INSERT INTO jobs_archive
SELECT * FROM jobs
WHERE posted_date < DATEADD(MONTH, -6, GETDATE())
  AND is_active = 0

-- Delete archived jobs
DELETE FROM jobs
WHERE posted_date < DATEADD(MONTH, -6, GETDATE())
  AND is_active = 0
  AND id IN (SELECT id FROM jobs_archive)
```

### Automated Archival Script

```powershell
# test-job-archival.ps1
param(
    [int]$MonthsOld = 6,
    [string]$Environment = "prod"
)

$config = Get-Content "env-config.$Environment.json" | ConvertFrom-Json

Write-Host "Archiving jobs older than $MonthsOld months..." -ForegroundColor Yellow

# Archive inactive jobs
$archiveQuery = @"
BEGIN TRANSACTION
  INSERT INTO jobs_archive
  SELECT * FROM jobs
  WHERE posted_date < DATEADD(MONTH, -$MonthsOld, GETDATE())
    AND is_active = 0
    AND id NOT IN (SELECT job_id FROM referrals WHERE status IN ('pending', 'accepted'))
  
  DELETE FROM jobs
  WHERE posted_date < DATEADD(MONTH, -$MonthsOld, GETDATE())
    AND is_active = 0
    AND id IN (SELECT id FROM jobs_archive)
COMMIT TRANSACTION
"@

Invoke-Sqlcmd -Query $archiveQuery -ConnectionString $config.connectionString

Write-Host "Archival completed!" -ForegroundColor Green
```

## Statistics Maintenance

```sql
-- Update statistics for better query plans
UPDATE STATISTICS jobs WITH FULLSCAN
UPDATE STATISTICS referrals WITH FULLSCAN
UPDATE STATISTICS users WITH FULLSCAN
UPDATE STATISTICS organizations WITH FULLSCAN

-- Auto-update statistics (recommended setting)
ALTER DATABASE nexhire SET AUTO_UPDATE_STATISTICS ON
ALTER DATABASE nexhire SET AUTO_UPDATE_STATISTICS_ASYNC ON
```

## Maintenance Scripts

### Rebuild Indexes

```sql
-- rebuild-all-indexes.ps1 equivalent SQL
DECLARE @TableName NVARCHAR(255)
DECLARE @IndexName NVARCHAR(255)
DECLARE @SQL NVARCHAR(MAX)

DECLARE index_cursor CURSOR FOR
SELECT 
  t.name AS TableName,
  i.name AS IndexName
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE i.type > 0  -- Exclude heaps
  AND i.name IS NOT NULL
  AND t.is_ms_shipped = 0

OPEN index_cursor
FETCH NEXT FROM index_cursor INTO @TableName, @IndexName

WHILE @@FETCH_STATUS = 0
BEGIN
  SET @SQL = 'ALTER INDEX ' + @IndexName + ' ON ' + @TableName + ' REBUILD'
  
  PRINT 'Rebuilding ' + @TableName + '.' + @IndexName
  EXEC sp_executesql @SQL
  
  FETCH NEXT FROM index_cursor INTO @TableName, @IndexName
END

CLOSE index_cursor
DEALLOCATE index_cursor
```

### Performance Diagnostics

```powershell
# diagnose-performance.ps1
param([string]$Environment = "prod")

$config = Get-Content "env-config.$Environment.json" | ConvertFrom-Json

Write-Host "Running performance diagnostics..." -ForegroundColor Yellow

# Check database size
$sizeQuery = @"
SELECT 
  DB_NAME() as DatabaseName,
  SUM(size * 8.0 / 1024 / 1024) as SizeGB,
  SUM(CASE WHEN type = 0 THEN size * 8.0 / 1024 / 1024 ELSE 0 END) as DataSizeGB,
  SUM(CASE WHEN type = 1 THEN size * 8.0 / 1024 / 1024 ELSE 0 END) as LogSizeGB
FROM sys.master_files
WHERE database_id = DB_ID()
"@

$sizeResult = Invoke-Sqlcmd -Query $sizeQuery -ConnectionString $config.connectionString
Write-Host "Database Size: $($sizeResult.SizeGB) GB" -ForegroundColor Cyan

# Check table sizes
$tableSizeQuery = @"
SELECT 
  t.NAME AS TableName,
  p.rows AS RowCounts,
  SUM(a.total_pages) * 8 / 1024 AS TotalSpaceMB,
  SUM(a.used_pages) * 8 / 1024 AS UsedSpaceMB
FROM sys.tables t
INNER JOIN sys.indexes i ON t.OBJECT_ID = i.object_id
INNER JOIN sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id
INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
WHERE t.is_ms_shipped = 0
GROUP BY t.Name, p.Rows
ORDER BY SUM(a.total_pages) DESC
"@

$tableSizes = Invoke-Sqlcmd -Query $tableSizeQuery -ConnectionString $config.connectionString
$tableSizes | Format-Table -AutoSize

# Check for blocking
$blockingQuery = @"
SELECT 
  blocked.session_id as blocked_session,
  blocking.session_id as blocking_session,
  blocked_text.text as blocked_query,
  blocking_text.text as blocking_query
FROM sys.dm_exec_requests blocked
INNER JOIN sys.dm_exec_requests blocking ON blocked.blocking_session_id = blocking.session_id
CROSS APPLY sys.dm_exec_sql_text(blocked.sql_handle) blocked_text
CROSS APPLY sys.dm_exec_sql_text(blocking.sql_handle) blocking_text
"@

Write-Host "`nChecking for blocking..." -ForegroundColor Yellow
$blocking = Invoke-Sqlcmd -Query $blockingQuery -ConnectionString $config.connectionString
if ($blocking) {
  $blocking | Format-Table -AutoSize
} else {
  Write-Host "No blocking detected" -ForegroundColor Green
}
```

## Connection String Optimization

```typescript
// Optimized connection string
const connectionString = `
  Server=${server};
  Database=${database};
  User Id=${user};
  Password=${password};
  Encrypt=true;
  TrustServerCertificate=false;
  Connection Timeout=30;
  Max Pool Size=100;
  Min Pool Size=10;
  MultipleActiveResultSets=true;
  Application Name=NexHire-API;
`
```

## Best Practices

### 1. Query Best Practices
- Use parameterized queries to prevent SQL injection
- Select only needed columns (avoid SELECT *)
- Use appropriate JOIN types
- Leverage indexes with WHERE clauses
- Use OFFSET/FETCH for pagination instead of SKIP/TAKE

### 2. Index Best Practices
- Create indexes on frequently queried columns
- Use covering indexes (INCLUDE clause) for better performance
- Avoid over-indexing (impacts write performance)
- Monitor and remove unused indexes
- Keep index fragmentation below 30%

### 3. Transaction Best Practices
- Keep transactions short
- Use appropriate isolation levels
- Avoid long-running transactions
- Use read committed snapshot isolation for better concurrency

### 4. Connection Best Practices
- Use connection pooling
- Close connections properly
- Handle connection failures gracefully
- Monitor connection pool statistics

### 5. Monitoring Best Practices
- Set up alerts for slow queries (>5 seconds)
- Monitor DTU/CPU usage
- Track query execution statistics
- Regular index maintenance
- Monitor deadlocks and blocking

## Performance Testing

```typescript
// Load testing script
import { performance } from 'perf_hooks'

async function benchmarkJobSearch() {
  const iterations = 1000
  const times: number[] = []
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await searchJobs({ location: 'San Francisco', jobType: 'full-time' })
    const end = performance.now()
    times.push(end - start)
  }
  
  const avg = times.reduce((a, b) => a + b) / times.length
  const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)]
  
  console.log(`Average: ${avg.toFixed(2)}ms`)
  console.log(`P95: ${p95.toFixed(2)}ms`)
}
```

---

**Last Updated**: December 5, 2025
