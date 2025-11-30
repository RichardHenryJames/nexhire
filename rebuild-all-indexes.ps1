#!/usr/bin/env pwsh
# Rebuild all fragmented indexes on Jobs table

Write-Host "`n==== REBUILDING FRAGMENTED INDEXES ====`n" -ForegroundColor Cyan

$server = "refopen-sqlserver-ci.database.windows.net"
$database = "refopen-sql-db"
$username = "sqladmin"
$password = "RefOpen@2024!Secure"

# Get all indexes that need rebuilding (>10% fragmentation)
$getIndexesQuery = @"
SELECT i.name AS IndexName
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('Jobs'), NULL, NULL, 'SAMPLED') ips
INNER JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE i.name IS NOT NULL 
    AND ips.avg_fragmentation_in_percent > 10
    AND ips.page_count > 100
ORDER BY ips.avg_fragmentation_in_percent DESC
"@

Write-Host "Fetching list of fragmented indexes..." -ForegroundColor Yellow
$indexes = sqlcmd -S $server -d $database -U $username -P $password -Q $getIndexesQuery -h -1 -W | Where-Object { $_.Trim() -ne "" }

if ($indexes) {
    Write-Host "Found $($indexes.Count) indexes to rebuild`n" -ForegroundColor Green
    
    foreach ($indexName in $indexes) {
        $idx = $indexName.Trim()
        if ($idx) {
            Write-Host "Rebuilding: $idx..." -ForegroundColor Cyan
            
            $rebuildQuery = @"
ALTER INDEX [$idx] ON [dbo].[Jobs] 
REBUILD WITH (
    ONLINE = ON,
    MAXDOP = 0,
    SORT_IN_TEMPDB = ON,
    DATA_COMPRESSION = PAGE
);
SELECT 'Rebuilt: $idx' AS Result;
"@
            
            try {
                $result = sqlcmd -S $server -d $database -U $username -P $password -Q $rebuildQuery -h -1 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  ? Success!" -ForegroundColor Green
                } else {
                    Write-Host "  ? Failed: $result" -ForegroundColor Red
                }
            } catch {
                Write-Host "  ? Error: $_" -ForegroundColor Red
            }
            
            Start-Sleep -Milliseconds 500
        }
    }
    
    # Update statistics after rebuilding
    Write-Host "`nUpdating statistics..." -ForegroundColor Yellow
    $updateStatsQuery = "UPDATE STATISTICS [dbo].[Jobs] WITH FULLSCAN; SELECT 'Statistics updated' AS Result;"
    sqlcmd -S $server -d $database -U $username -P $password -Q $updateStatsQuery -h -1
    
    Write-Host "`n? Index rebuild complete!" -ForegroundColor Green
    
    # Verify fragmentation after rebuild
    Write-Host "`nVerifying fragmentation levels..." -ForegroundColor Yellow
    $verifyQuery = @"
SELECT TOP 10
    i.name AS IndexName,
    CAST(ips.avg_fragmentation_in_percent AS DECIMAL(5,2)) as FragmentationPct,
    ips.page_count as Pages
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('Jobs'), NULL, NULL, 'SAMPLED') ips
INNER JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE i.name IS NOT NULL
ORDER BY ips.avg_fragmentation_in_percent DESC
"@
    
    sqlcmd -S $server -d $database -U $username -P $password -Q $verifyQuery -s "," -W -h -1
    
} else {
    Write-Host "No indexes found needing rebuild." -ForegroundColor Green
}

Write-Host "`n==== REBUILD COMPLETE ====`n" -ForegroundColor Green
Write-Host "Next step: Run 'node test-jobs-sql-performance.js' to verify improved performance" -ForegroundColor Cyan
