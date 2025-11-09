<#
.SYNOPSIS
    Add Performance Indexes to RefOpen Database

.DESCRIPTION
    Runs the performance optimization script to add indexes for faster /jobs API response.

.EXAMPLE
    .\Add-PerformanceIndexes.ps1
#>

$ConnectionString = "Server=tcp:refopen-sqlserver-ci.database.windows.net,1433;Initial Catalog=refopen-sql-db;User ID=sqladmin;Password=RefOpen@2024!Secure;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

Write-Host @"
====================================================================
                 RefOpen - Add Performance Indexes
====================================================================
"@ -ForegroundColor Cyan

Write-Host "Current Issue:" -ForegroundColor Yellow
Write-Host " - /jobs API timing out (30 seconds)" -ForegroundColor White
Write-Host " - 1,650+ jobs causing slow queries" -ForegroundColor White
Write-Host " - Missing indexes on frequently queried columns" -ForegroundColor White

Write-Host "`nProposed Solution:" -ForegroundColor Yellow
Write-Host " - Add 13 optimized indexes" -ForegroundColor White
Write-Host " - Update statistics" -ForegroundColor White
Write-Host " - Expected: Up to 60x faster queries" -ForegroundColor Green

Write-Host "`nThis operation will take approximately 1–2 minutes..." -ForegroundColor Cyan
Write-Host ""

$confirm = Read-Host "Continue? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Operation cancelled." -ForegroundColor Red
    exit
}

try {
    Write-Host "`nLoading SQL script..." -ForegroundColor Yellow
    $sqlScript = Get-Content ".\src\database_scripts\add-performance-indexes.sql" -Raw

    Write-Host "Connecting to database..." -ForegroundColor Yellow

    # Execute the script
    Write-Host "Creating indexes..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $sqlScript -QueryTimeout 300 -Verbose

    Write-Host "`nIndexes created successfully!" -ForegroundColor Green

    Write-Host "`nTesting query performance..." -ForegroundColor Yellow

    # Test query
    $testQuery = @"
SELECT TOP 20
    j.JobID,
    j.Title,
    j.Location,
    o.Name AS OrganizationName
FROM Jobs j
INNER JOIN Organizations o ON j.OrganizationID = o.OrganizationID
WHERE j.Status = 'Published' AND o.IsActive = 1
ORDER BY j.PublishedAt DESC, j.CreatedAt DESC;
"@

    $startTime = Get-Date
    $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $testQuery -QueryTimeout 10
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalMilliseconds

    Write-Host ("Test query completed in {0} ms" -f [math]::Round($duration, 2)) -ForegroundColor Green
    Write-Host ("Retrieved {0} jobs" -f $result.Count) -ForegroundColor White

    if ($duration -lt 1000) {
        Write-Host "`nExcellent! Query performance is optimal." -ForegroundColor Green
    } elseif ($duration -lt 5000) {
        Write-Host "`nGood! Query performance is acceptable." -ForegroundColor Yellow
    } else {
        Write-Host "`nWarning: Query still slow; additional optimization may be required." -ForegroundColor Red
    }

    Write-Host "`nNext Steps:" -ForegroundColor Cyan
    Write-Host "  1. Test your /jobs API endpoint." -ForegroundColor White
    Write-Host "  2. Monitor API response time in the console." -ForegroundColor White
    Write-Host "  3. If still slow, run: UPDATE STATISTICS Jobs WITH FULLSCAN;" -ForegroundColor White

} catch {
    Write-Host ("`nError: {0}" -f $_.Exception.Message) -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}

Write-Host "`n"
