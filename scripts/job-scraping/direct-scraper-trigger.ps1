<#
.SYNOPSIS
    Trigger the Direct Career Site Scraper manually

.DESCRIPTION
    Logs in as admin, triggers the direct career scraper,
    and displays results. Use this after deploying the new scraper.

.EXAMPLE
    .\scripts\job-scraping\direct-scraper-trigger.ps1
#>

param(
    [string]$ApiBaseUrl = "https://refopen-api-func.azurewebsites.net/api",
    [string]$AdminEmail = "admin@refopen.com",
    [string]$AdminPassword
)

Write-Host "🎯 RefOpen Direct Career Site Scraper — Manual Trigger" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor DarkGray

# Step 1: Get admin password
if (-not $AdminPassword) {
    $AdminPassword = az keyvault secret show --vault-name "refopen-keyvault-prod" --name "AdminPassword" --query "value" -o tsv 2>$null
    if (-not $AdminPassword) {
        $AdminPassword = Read-Host "Enter admin password"
    }
}

# Step 2: Login
Write-Host "`n1️⃣  Logging in as $AdminEmail..." -ForegroundColor Yellow
$loginBody = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json
try {
    $loginResponse = Invoke-RestMethod -Uri "$ApiBaseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    if (-not $loginResponse.success) {
        Write-Host "❌ Login failed: $($loginResponse.error)" -ForegroundColor Red
        exit 1
    }
    $token = $loginResponse.data.tokens.accessToken
    Write-Host "✅ Login successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Login error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Step 3: Check config (optional)
Write-Host "`n2️⃣  Checking direct scraper config..." -ForegroundColor Yellow
try {
    $configResponse = Invoke-RestMethod -Uri "$ApiBaseUrl/jobs/scrape/direct/config" -Method GET -Headers $headers
    if ($configResponse.success) {
        $companies = $configResponse.data.companies | Where-Object { $_.enabled }
        Write-Host "✅ $($companies.Count) companies configured:" -ForegroundColor Green
        $companies | ForEach-Object {
            Write-Host "   📋 $($_.name) ($($_.ats)) — max $($_.maxJobs) jobs" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "⚠️  Could not get config: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 4: Trigger scraping
Write-Host "`n3️⃣  Triggering direct career scraping..." -ForegroundColor Yellow
Write-Host "⏳ This scrapes from company APIs (Workday, Greenhouse, etc.). May take 3-5 minutes..." -ForegroundColor Cyan

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $scrapeResponse = Invoke-RestMethod -Uri "$ApiBaseUrl/jobs/scrape/direct/trigger" -Method POST -Headers $headers -Body "{}" -TimeoutSec 600
    $stopwatch.Stop()

    if ($scrapeResponse.success) {
        Write-Host "`n🎉 Direct Career Scraping Completed!" -ForegroundColor Green
        Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor DarkGray
        Write-Host "   ✅ Jobs Added:        $($scrapeResponse.data.jobsAdded)" -ForegroundColor White
        Write-Host "   🏢 Companies Scraped: $($scrapeResponse.data.companiesScraped)" -ForegroundColor White
        Write-Host "   📊 Total Scraped:     $($scrapeResponse.data.totalJobsScraped)" -ForegroundColor White
        Write-Host "   ⏱️  Time:             $($scrapeResponse.data.executionTimeSeconds)s" -ForegroundColor White

        if ($scrapeResponse.data.companyBreakdown) {
            Write-Host "`n   📍 Per-Company Breakdown:" -ForegroundColor White
            $scrapeResponse.data.companyBreakdown.PSObject.Properties | Sort-Object Value -Descending | ForEach-Object {
                if ($_.Value -gt 0) {
                    Write-Host "     ✅ $($_.Name): $($_.Value) jobs" -ForegroundColor Gray
                } else {
                    Write-Host "     ⏭️  $($_.Name): 0 (all duplicates)" -ForegroundColor DarkGray
                }
            }
        }

        if ($scrapeResponse.data.aiEnrichment) {
            $enrich = $scrapeResponse.data.aiEnrichment
            if ($enrich.error) {
                Write-Host "`n   🤖 AI Enrichment: ⚠️  $($enrich.error)" -ForegroundColor Yellow
            } else {
                Write-Host "`n   🤖 AI Enrichment: $($enrich.enriched)/$($enrich.processed) enriched ($($enrich.timeSeconds)s)" -ForegroundColor Green
            }
        }

        if ($scrapeResponse.data.errors -and $scrapeResponse.data.errors.Count -gt 0) {
            Write-Host "`n   ⚠️  Errors:" -ForegroundColor Yellow
            $scrapeResponse.data.errors | ForEach-Object {
                Write-Host "     - $_" -ForegroundColor DarkYellow
            }
        }

        Write-Host "`n🎊 All jobs have DIRECT links to company career pages!" -ForegroundColor Green
    } else {
        Write-Host "❌ Scraping failed: $($scrapeResponse.error)" -ForegroundColor Red
    }
} catch {
    $stopwatch.Stop()
    $errorMessage = $_.Exception.Message
    if ($errorMessage -like "*timed out*") {
        Write-Host "⏰ Request timed out after $([math]::Round($stopwatch.Elapsed.TotalSeconds))s" -ForegroundColor Yellow
        Write-Host "   The scraper may still be running in the background." -ForegroundColor Cyan
    } else {
        Write-Host "❌ Error: $errorMessage" -ForegroundColor Red
    }
}

# Step 5: Show stats
Write-Host "`n4️⃣  Checking direct scraper stats..." -ForegroundColor Yellow
try {
    $statsResponse = Invoke-RestMethod -Uri "$ApiBaseUrl/jobs/scrape/direct/stats" -Method GET -Headers $headers
    if ($statsResponse.success) {
        Write-Host "   📊 Total direct jobs: $($statsResponse.data.summary.Total)" -ForegroundColor White
        Write-Host "   📈 Added last 24h:    $($statsResponse.data.summary.Last24h)" -ForegroundColor White
        if ($statsResponse.data.companies) {
            Write-Host "   🏢 Companies:" -ForegroundColor White
            $statsResponse.data.companies | ForEach-Object {
                Write-Host "     $($_.Company): $($_.JobCount) jobs (last: $($_.LastAdded.Substring(0, 10)))" -ForegroundColor Gray
            }
        }
    }
} catch {
    Write-Host "⚠️  Could not get stats: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "Done!" -ForegroundColor Green
