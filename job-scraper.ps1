# Admin Job Scraper Test Script
Write-Host "?? Testing Admin Job Scraper API..." -ForegroundColor Green

# Step 1: Health Check
Write-Host "`n1?? Testing health check..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "https://nexhire-api-func.azurewebsites.net/api/jobs/scrape/ping" -Method GET
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
    $loginResponse = Invoke-RestMethod -Uri "https://nexhire-api-func.azurewebsites.net/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    
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

# Step 3: Trigger Job Scraping
Write-Host "`n3?? Triggering job scraping (this will take 1-3 minutes)..." -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

try {
    Write-Host "? Starting scraping process..." -ForegroundColor Cyan
    $scrapeResponse = Invoke-RestMethod -Uri "https://nexhire-api-func.azurewebsites.net/api/jobs/scrape/trigger" -Method POST -Headers $headers -Body "{}"
    
    if ($scrapeResponse.success) {
        Write-Host "? Job scraping completed successfully!" -ForegroundColor Green
        Write-Host "?? Results:" -ForegroundColor Cyan
        Write-Host "   • Jobs Added: $($scrapeResponse.data.jobsAdded)" -ForegroundColor White
        Write-Host "   • Total Scraped: $($scrapeResponse.data.totalJobsScraped)" -ForegroundColor White
        Write-Host "   • India Jobs: $($scrapeResponse.data.indiaJobsAdded)" -ForegroundColor White
        Write-Host "   • Execution Time: $($scrapeResponse.data.executionTimeSeconds)s" -ForegroundColor White
        
        if ($scrapeResponse.data.sourceBreakdown) {
            Write-Host "   • Source Breakdown:" -ForegroundColor White
            $scrapeResponse.data.sourceBreakdown.PSObject.Properties | ForEach-Object {
                Write-Host "     - $($_.Name): $($_.Value) jobs" -ForegroundColor Gray
            }
        }
        
        Write-Host "`n?? SUCCESS: $($scrapeResponse.data.jobsAdded) new jobs added to database!" -ForegroundColor Green
        
    } else {
        Write-Host "? Scraping failed: $($scrapeResponse.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "? Scraping error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

Write-Host "`n?? Test completed!" -ForegroundColor Green