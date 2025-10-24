# Admin Job Scraper Test Script
Write-Host "?? Testing Admin Job Scraper API..." -ForegroundColor Green

# Step 1: Health Check
Write-Host "`n1?? Testing health check..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "https://refopen-api-func.azurewebsites.net/api/jobs/scrape/ping" -Method GET
    Write-Host "? Health check passed: $($healthResponse.message)" -ForegroundColor Green
} catch {
    Write-Host "? Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Admin Login
Write-Host "`n2?? Logging in as admin..." -ForegroundColor Yellow
$loginBody = @{
    email = "jobadmin@gmail.com"
    password = "12345678"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "https://refopen-api-func.azurewebsites.net/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.success) {
        $adminToken = $loginResponse.data.tokens.accessToken
        Write-Host "? Login successful! Token: $($adminToken.Substring(0, 20))..." -ForegroundColor Green
    } else {
        Write-Host "? Login failed: $($loginResponse.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "? Login error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Check Current Stats Before Scraping
Write-Host "`n3?? Checking current job stats..." -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

try {
    $statsResponse = Invoke-RestMethod -Uri "https://refopen-api-func.azurewebsites.net/api/jobs/scrape/stats" -Method GET -Headers $headers
    $beforeCount = $statsResponse.data.summary.TotalScrapedJobs
    Write-Host "? Current total jobs: $beforeCount" -ForegroundColor Green
    Write-Host "   ?? Jobs last 24h: $($statsResponse.data.summary.JobsLast24h)" -ForegroundColor Gray
    Write-Host "   ???? India jobs: $($statsResponse.data.summary.TotalIndiaJobs)" -ForegroundColor Gray
} catch {
    Write-Host "??  Could not get current stats: $($_.Exception.Message)" -ForegroundColor Yellow
    $beforeCount = 0
}

# Step 4: Trigger Job Scraping with Timeout Handling
Write-Host "`n4?? Triggering job scraping (Azure Functions has 10 minute timeout)..." -ForegroundColor Yellow
Write-Host "?? Note: Enhanced scraper processes 800+ jobs, may take 5-10 minutes..." -ForegroundColor Cyan

try {
    Write-Host "?? Starting scraping process..." -ForegroundColor Cyan
    
    # Use longer timeout for the enhanced scraper
    $scrapeResponse = Invoke-RestMethod -Uri "https://refopen-api-func.azurewebsites.net/api/jobs/scrape/trigger" -Method POST -Headers $headers -Body "{}" -TimeoutSec 600
    
    if ($scrapeResponse.success) {
        Write-Host "?? Job scraping completed successfully!" -ForegroundColor Green
        Write-Host "?? Results:" -ForegroundColor Cyan
        Write-Host "   ? Jobs Added: $($scrapeResponse.data.jobsAdded)" -ForegroundColor White
        Write-Host "   ?? Total Scraped: $($scrapeResponse.data.totalJobsScraped)" -ForegroundColor White
        Write-Host "   ???? India Jobs: $($scrapeResponse.data.indiaJobsAdded)" -ForegroundColor White
        Write-Host "   ??  Execution Time: $($scrapeResponse.data.executionTimeSeconds)s" -ForegroundColor White
        
        if ($scrapeResponse.data.sourceBreakdown) {
            Write-Host "   ?? Source Breakdown:" -ForegroundColor White
            $scrapeResponse.data.sourceBreakdown.PSObject.Properties | ForEach-Object {
                Write-Host "     - $($_.Name): $($_.Value) jobs" -ForegroundColor Gray
            }
        }
        
        Write-Host "`n?? SUCCESS: $($scrapeResponse.data.jobsAdded) new jobs added to database!" -ForegroundColor Green
        
    } else {
        Write-Host "? Scraping failed: $($scrapeResponse.error)" -ForegroundColor Red
    }
} catch {
    $errorMessage = $_.Exception.Message
    
    if ($errorMessage -like "*timed out*" -or $errorMessage -like "*timeout*") {
        Write-Host "? Request timed out - This is normal for the enhanced scraper!" -ForegroundColor Yellow
        Write-Host "   ?? The scraper is processing 800+ jobs which takes time." -ForegroundColor Cyan
        Write-Host "   ?? Let's check if jobs were actually added..." -ForegroundColor Cyan
        
        # Wait a moment then check stats
        Start-Sleep -Seconds 10
        
        try {
            $afterStatsResponse = Invoke-RestMethod -Uri "https://refopen-api-func.azurewebsites.net/api/jobs/scrape/stats" -Method GET -Headers $headers
            $afterCount = $afterStatsResponse.data.summary.TotalScrapedJobs
            $jobsAdded = $afterCount - $beforeCount
            
            if ($jobsAdded -gt 0) {
                Write-Host "? SUCCESS: $jobsAdded jobs were actually added!" -ForegroundColor Green
                Write-Host "   ?? Total jobs now: $afterCount (was $beforeCount)" -ForegroundColor White
                Write-Host "   ?? Scraper is working despite timeout" -ForegroundColor Green
            } else {
                Write-Host "? No new jobs added - scraper may have failed" -ForegroundColor Red
            }
        } catch {
            Write-Host "??  Could not verify results: $($_.Exception.Message)" -ForegroundColor Yellow
        }
        
    } else {
        Write-Host "? Scraping error: $errorMessage" -ForegroundColor Red
        if ($_.Exception.Response) {
            Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
    }
}

# Step 5: Final Status Check
Write-Host "`n5?? Final health check..." -ForegroundColor Yellow
try {
    $finalHealthResponse = Invoke-RestMethod -Uri "https://refopen-api-func.azurewebsites.net/api/jobs/scrape/health" -Method GET
    Write-Host "? Scraper Status: $($finalHealthResponse.data.status)" -ForegroundColor Green
    Write-Host "   ?? Total scraped jobs: $($finalHealthResponse.data.totalScrapedJobs)" -ForegroundColor White
    Write-Host "   ?? Jobs last 24h: $($finalHealthResponse.data.jobsLast24h)" -ForegroundColor White
    Write-Host "   ???? India jobs: $($finalHealthResponse.data.indiaJobs)" -ForegroundColor White
    Write-Host "   ?? Active sources: $($finalHealthResponse.data.activeSources -join ', ')" -ForegroundColor White
} catch {
    Write-Host "??  Final health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n?? Test completed!" -ForegroundColor Green
Write-Host ""
Write-Host "?? About Azure Functions Timeout:" -ForegroundColor Yellow
Write-Host "   � Enhanced scraper processes 800+ jobs (vs 150 before)" -ForegroundColor Gray
Write-Host "   � Azure Functions timeout after 10 minutes" -ForegroundColor Gray
Write-Host "   � Scraper may continue running in background" -ForegroundColor Gray
Write-Host "   � Check stats periodically to see progress" -ForegroundColor Gray