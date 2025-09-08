# Ultra-Quick Referral API Status Check
# Minimal test with short timeouts to check deployed API status

param(
    [string]$BaseURL = "https://nexhire-api-func.azurewebsites.net/api"
)

Write-Host "? Quick API Status Check" -ForegroundColor Green
Write-Host "Base URL: $BaseURL" -ForegroundColor Yellow
Write-Host ""

function Quick-Test {
    param([string]$Endpoint, [string]$Name)
    
    try {
        Write-Host "?? $Name..." -NoNewline
        $response = Invoke-RestMethod -Uri "$BaseURL/$Endpoint" -Method GET -TimeoutSec 10
        Write-Host " ? OK" -ForegroundColor Green
        return $true
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 401) {
            Write-Host " ?? AUTH" -ForegroundColor Yellow
        } elseif ($status -eq 404) {
            Write-Host " ? 404" -ForegroundColor Orange  
        } else {
            Write-Host " ? ERROR" -ForegroundColor Red
        }
        return $false
    }
}

# Quick status checks
$results = @{}
$results.health = Quick-Test "health" "Health Check"
$results.plans = Quick-Test "referral/plans" "Referral Plans"
$results.eligibility = Quick-Test "referral/eligibility" "Eligibility (should need auth)"
$results.analytics = Quick-Test "referral/analytics" "Analytics (should need auth)"

Write-Host ""
Write-Host "?? QUICK STATUS:" -ForegroundColor Cyan

if ($results.health) {
    Write-Host "? API is responding" -ForegroundColor Green
} else {
    Write-Host "? API not responding - may be cold start or deployment issue" -ForegroundColor Red
}

if ($results.plans) {
    Write-Host "? Referral plans endpoint working" -ForegroundColor Green
} else {
    Write-Host "? Referral plans not deployed yet" -ForegroundColor Red
}

Write-Host ""
Write-Host "?? While you deploy new version, the API might be warming up..." -ForegroundColor Yellow
Write-Host "?? Your new deployment should include the proof/verification endpoints!" -ForegroundColor Green