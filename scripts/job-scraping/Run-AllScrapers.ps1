<#
.SYNOPSIS
    Run All Job Scraper Scripts

.DESCRIPTION
    This script runs all three job scraper scripts in sequence:
    1. job-scraper.ps1
    2. Manage-JobScraper.ps1 -Action trigger
    3. job-scraper-manager.ps1 -Action trigger

.EXAMPLE
  .\Run-AllScrapers.ps1
#>

Write-Host @"

=================================================================
                    Run All Job Scrapers
=================================================================

"@ -ForegroundColor Cyan

$totalJobsAdded = 0
$totalExecutionTime = 0
$scriptsRun = 0
$errors = @()

# ============================================================================
# SCRIPT 1: job-scraper.ps1
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  [1]  Running: job-scraper.ps1" -ForegroundColor Yellow
Write-Host "==============================================================" -ForegroundColor Cyan

try {
    $script1Start = Get-Date

    & ".\job-scraper.ps1"

    $script1End = Get-Date
    $script1Duration = ($script1End - $script1Start).TotalSeconds

    Write-Host "`n✔ Script 1 completed in $([math]::Round($script1Duration, 2))s" -ForegroundColor Green
    $totalExecutionTime += $script1Duration
    $scriptsRun++

} catch {
    Write-Host "`n✖ Script 1 failed: $($_.Exception.Message)" -ForegroundColor Red
    $errors += "job-scraper.ps1: $($_.Exception.Message)"
}

Start-Sleep -Seconds 3

# ============================================================================
# SCRIPT 2: Manage-JobScraper.ps1 -Action trigger
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  [2]  Running: Manage-JobScraper.ps1 -Action trigger" -ForegroundColor Yellow
Write-Host "==============================================================" -ForegroundColor Cyan

try {
    $script2Start = Get-Date

    & ".\Manage-JobScraper.ps1" -Action trigger

    $script2End = Get-Date
    $script2Duration = ($script2End - $script2Start).TotalSeconds

    Write-Host "`n✔ Script 2 completed in $([math]::Round($script2Duration, 2))s" -ForegroundColor Green
    $totalExecutionTime += $script2Duration
    $scriptsRun++

} catch {
    Write-Host "`n✖ Script 2 failed: $($_.Exception.Message)" -ForegroundColor Red
    $errors += "Manage-JobScraper.ps1: $($_.Exception.Message)"
}

Start-Sleep -Seconds 3

# ============================================================================
# SCRIPT 3: job-scraper-manager.ps1 -Action trigger
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  [3]  Running: job-scraper-manager.ps1 -Action trigger" -ForegroundColor Yellow
Write-Host "==============================================================" -ForegroundColor Cyan

try {
    $script3Start = Get-Date

    & ".\job-scraper-manager.ps1" -Action trigger

    $script3End = Get-Date
    $script3Duration = ($script3End - $script3Start).TotalSeconds

    Write-Host "`n✔ Script 3 completed in $([math]::Round($script3Duration, 2))s" -ForegroundColor Green
    $totalExecutionTime += $script3Duration
    $scriptsRun++

} catch {
    Write-Host "`n✖ Script 3 failed: $($_.Exception.Message)" -ForegroundColor Red
    $errors += "job-scraper-manager.ps1: $($_.Exception.Message)"
}

# ============================================================================
# FINAL SUMMARY
# ============================================================================

Write-Host "`n" -NoNewline
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  🧾 FINAL SUMMARY" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan

Write-Host "`n📊 Execution Summary:" -ForegroundColor White
Write-Host "   Scripts Run: $scriptsRun / 3" -ForegroundColor $(if ($scriptsRun -eq 3) { "Green" } else { "Yellow" })
Write-Host "   Total Time: $([math]::Round($totalExecutionTime, 2)) seconds" -ForegroundColor White
Write-Host "   Average Time: $([math]::Round($totalExecutionTime / [math]::Max($scriptsRun, 1), 2)) seconds per script" -ForegroundColor White

if ($errors.Count -gt 0) {
    Write-Host "`n⚠️  Errors Encountered:" -ForegroundColor Yellow
    $errors | ForEach-Object {
        Write-Host "   - $_" -ForegroundColor Red
    }
} else {
    Write-Host "`n✅ All scripts completed successfully!" -ForegroundColor Green
}

Write-Host "`n💡 Tip: Check your database for new jobs!" -ForegroundColor Cyan
Write-Host "   Run: .\Manage-JobScraper.ps1 -Action stats" -ForegroundColor Gray

Write-Host "`n" -NoNewline
