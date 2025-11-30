#!/usr/bin/env pwsh
# Diagnose database performance issues

Write-Host "`n==== DATABASE PERFORMANCE DIAGNOSTICS ====`n" -ForegroundColor Cyan

$server = "refopen-sqlserver-ci.database.windows.net"
$database = "refopen-sql-db"
$username = "sqladmin"
$password = "RefOpen@2024!Secure"

# Test 1: Check index fragmentation
Write-Host "1. Checking index fragmentation on Jobs table..." -ForegroundColor Yellow
$fragQuery = @"
SELECT TOP 10
    i.name AS IndexName,
    CAST(ips.avg_fragmentation_in_percent AS DECIMAL(5,2)) as FragmentationPct,
    ips.page_count as Pages,
    CASE 
        WHEN ips.avg_fragmentation_in_percent > 30 THEN 'REBUILD'
        WHEN ips.avg_fragmentation_in_percent > 10 THEN 'REORGANIZE'
        ELSE 'OK'
    END AS Recommendation
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('Jobs'), NULL, NULL, 'SAMPLED') ips
INNER JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE i.name IS NOT NULL AND ips.page_count > 100
ORDER BY ips.avg_fragmentation_in_percent DESC
"@

sqlcmd -S $server -d $database -U $username -P $password -Q $fragQuery -s "," -W -h -1

# Test 2: Check statistics freshness
Write-Host "`n2. Checking statistics age (top 10 oldest)..." -ForegroundColor Yellow
$statsQuery = @"
SELECT TOP 10
    s.name AS StatName,
    CONVERT(VARCHAR(20), sp.last_updated, 120) AS LastUpdated,
    DATEDIFF(DAY, sp.last_updated, GETDATE()) AS DaysOld,
    sp.rows AS RowCount,
    sp.modification_counter AS Changes
FROM sys.stats s
CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
WHERE OBJECT_NAME(s.object_id) = 'Jobs'
ORDER BY sp.last_updated ASC
"@

sqlcmd -S $server -d $database -U $username -P $password -Q $statsQuery -s "," -W -h -1

# Test 3: Run test query with actual execution plan
Write-Host "`n3. Testing slow complex query with execution plan..." -ForegroundColor Yellow
$testQuery = @"
SET STATISTICS TIME ON;
SET STATISTICS IO ON;

DECLARE @cutoffDate DATETIME = DATEADD(day, -30, GETDATE());

SELECT COUNT(*) as total
FROM Jobs j
INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
WHERE j.Status = 'Published'
    AND j.WorkplaceTypeID IN (3)
    AND j.JobTypeID IN (1, 2)
    AND (j.Location LIKE '%Bangalore%' OR j.City LIKE '%Bangalore%' OR j.Country LIKE '%Bangalore%')
    AND (j.ExperienceMax IS NULL OR j.ExperienceMax >= 2)
    AND (j.ExperienceMin IS NULL OR j.ExperienceMin <= 5)
    AND j.PublishedAt >= @cutoffDate
OPTION (RECOMPILE);
"@

sqlcmd -S $server -d $database -U $username -P $password -Q $testQuery

# Test 4: Check for missing indexes
Write-Host "`n4. Checking for missing indexes on Jobs table..." -ForegroundColor Yellow
$missingIdxQuery = @"
SELECT TOP 5
    CAST(migs.avg_total_user_cost * migs.avg_user_impact * (migs.user_seeks + migs.user_scans) AS DECIMAL(10,2)) AS Impact,
    mid.equality_columns AS EqualityColumns,
    mid.inequality_columns AS InequalityColumns,
    mid.included_columns AS IncludedColumns,
    migs.user_seeks AS Seeks,
    migs.user_scans AS Scans
FROM sys.dm_db_missing_index_groups mig
INNER JOIN sys.dm_db_missing_index_group_stats migs ON mig.index_group_handle = migs.group_handle
INNER JOIN sys.dm_db_missing_index_details mid ON mig.index_handle = mid.index_handle
WHERE OBJECT_NAME(mid.object_id) = 'Jobs'
ORDER BY Impact DESC
"@

sqlcmd -S $server -d $database -U $username -P $password -Q $missingIdxQuery -s "," -W -h -1

Write-Host "`n==== DIAGNOSTICS COMPLETE ====`n" -ForegroundColor Green
