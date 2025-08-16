# ================================================================
# NexHire Frontend Testing Script
# ================================================================
# Tests the deployed frontend application functionality

param(
    [string]$BaseUrl = "https://nexhire-frontend-web.azurestaticapps.net",
    [switch]$SaveResults,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

Write-Host " NexHire Frontend Testing" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan

# Test results array
$testResults = @()

# Helper function to run tests
function Test-Endpoint {
    param($Name, $Url, $Method = "GET", $ExpectedStatus = 200, $Headers = @{})
    
    $startTime = Get-Date
    
    try {
        if ($Verbose) {
            Write-Host " Testing: $Name" -ForegroundColor Blue
        }
        
        $response = Invoke-WebRequest -Uri $Url -Method $Method -Headers $Headers -UseBasicParsing -TimeoutSec 30
        $endTime = Get-Date
        $responseTime = ($endTime - $startTime).TotalMilliseconds
        
        $success = $response.StatusCode -eq $ExpectedStatus
        $status = if ($success) { "? PASS" } else { "? FAIL" }
        
        Write-Host "$status $Name ($($response.StatusCode)) - $([math]::Round($responseTime))ms" -ForegroundColor $(if ($success) { "Green" } else { "Red" })
        
        return @{
            Name = $Name
            Url = $Url
            Method = $Method
            ExpectedStatus = $ExpectedStatus
            ActualStatus = $response.StatusCode
            Success = $success
            ResponseTime = [math]::Round($responseTime)
            Error = $null
        }
    }
    catch {
        $endTime = Get-Date
        $responseTime = ($endTime - $startTime).TotalMilliseconds
        
        Write-Host "? FAIL $Name - Error: $($_.Exception.Message)" -ForegroundColor Red
        
        return @{
            Name = $Name
            Url = $Url
            Method = $Method
            ExpectedStatus = $ExpectedStatus
            ActualStatus = $null
            Success = $false
            ResponseTime = [math]::Round($responseTime)
            Error = $_.Exception.Message
        }
    }
}

Write-Host " Testing Frontend Application at: $BaseUrl" -ForegroundColor Yellow
Write-Host ""

# ================================================================
# Frontend Application Tests
# ================================================================

Write-Host " Frontend Application Tests:" -ForegroundColor Yellow

# Test 1: Homepage loads
$testResults += Test-Endpoint -Name "Homepage Load" -Url $BaseUrl

# Test 2: Check if it's a React app (look for React in response)
try {
    $homeResponse = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec 30
    if ($homeResponse.Content -match "react|React|expo|Expo") {
        Write-Host "? PASS React/Expo App Detected" -ForegroundColor Green
        $testResults += @{
            Name = "React/Expo App Detection"
            Success = $true
            Error = $null
        }
    } else {
        Write-Host "? FAIL React/Expo App Not Detected" -ForegroundColor Red
        $testResults += @{
            Name = "React/Expo App Detection"
            Success = $false
            Error = "React/Expo not found in response"
        }
    }
} catch {
    Write-Host "? FAIL React/Expo App Detection - Error: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{
        Name = "React/Expo App Detection"
        Success = $false
        Error = $_.Exception.Message
    }
}

# Test 3: Static assets (check if CSS/JS files are accessible)
$testResults += Test-Endpoint -Name "Static Assets" -Url "$BaseUrl/static/js/bundle.js" -ExpectedStatus 200

# Test 4: Manifest file
$testResults += Test-Endpoint -Name "App Manifest" -Url "$BaseUrl/manifest.json" -ExpectedStatus 200

# Test 5: Favicon
$testResults += Test-Endpoint -Name "Favicon" -Url "$BaseUrl/favicon.ico" -ExpectedStatus 200

# ================================================================
# API Integration Tests (from frontend perspective)
# ================================================================

Write-Host ""
Write-Host " API Integration Tests:" -ForegroundColor Yellow

# Test API endpoints that the frontend would call
$apiBaseUrl = "https://nexhire-api-func.azurewebsites.net/api"

# Test 1: Job Types (public endpoint)
$testResults += Test-Endpoint -Name "API - Job Types" -Url "$apiBaseUrl/reference/job-types"

# Test 2: Currencies (public endpoint)  
$testResults += Test-Endpoint -Name "API - Currencies" -Url "$apiBaseUrl/reference/currencies"

# Test 3: CORS preflight (important for web frontend)
try {
    $corsHeaders = @{
        "Origin" = $BaseUrl
        "Access-Control-Request-Method" = "POST"
        "Access-Control-Request-Headers" = "Content-Type,Authorization"
    }
    $corsResponse = Invoke-WebRequest -Uri "$apiBaseUrl/auth/login" -Method OPTIONS -Headers $corsHeaders -UseBasicParsing -TimeoutSec 10
    
    if ($corsResponse.Headers["Access-Control-Allow-Origin"]) {
        Write-Host "? PASS CORS Configuration" -ForegroundColor Green
        $testResults += @{
            Name = "CORS Configuration"
            Success = $true
            Error = $null
        }
    } else {
        Write-Host "? FAIL CORS Configuration" -ForegroundColor Red
        $testResults += @{
            Name = "CORS Configuration"
            Success = $false
            Error = "CORS headers not found"
        }
    }
} catch {
    Write-Host "? FAIL CORS Configuration - Error: $($_.Exception.Message)" -ForegroundColor Red
    $testResults += @{
        Name = "CORS Configuration"
        Success = $false
        Error = $_.Exception.Message
    }
}

# ================================================================
# Performance Tests
# ================================================================

Write-Host ""
Write-Host "? Performance Tests:" -ForegroundColor Yellow

# Test homepage load time
$pageLoadTimes = @()
for ($i = 1; $i -le 3; $i++) {
    $startTime = Get-Date
    try {
        Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec 30 | Out-Null
        $endTime = Get-Date
        $loadTime = ($endTime - $startTime).TotalMilliseconds
        $pageLoadTimes += $loadTime
    } catch {
        $pageLoadTimes += 9999
    }
}

$avgLoadTime = ($pageLoadTimes | Measure-Object -Average).Average
$loadTimeStatus = if ($avgLoadTime -lt 3000) { "? PASS" } else { "  SLOW" }
Write-Host "$loadTimeStatus Average Load Time: $([math]::Round($avgLoadTime))ms" -ForegroundColor $(if ($avgLoadTime -lt 3000) { "Green" } else { "Yellow" })

# ================================================================
# Security Tests
# ================================================================

Write-Host ""
Write-Host " Security Tests:" -ForegroundColor Yellow

# Test HTTPS redirect
$testResults += Test-Endpoint -Name "HTTPS Enforcement" -Url $BaseUrl.Replace("https://", "http://") -ExpectedStatus 301

# Test security headers
try {
    $securityResponse = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec 30
    $securityHeaders = @(
        "X-Content-Type-Options",
        "X-Frame-Options", 
        "X-XSS-Protection"
    )
    
    $securityScore = 0
    foreach ($header in $securityHeaders) {
        if ($securityResponse.Headers[$header]) {
            $securityScore++
        }
    }
    
    $securityStatus = if ($securityScore -ge 2) { "? PASS" } else { "  PARTIAL" }
    Write-Host "$securityStatus Security Headers: $securityScore/$($securityHeaders.Count)" -ForegroundColor $(if ($securityScore -ge 2) { "Green" } else { "Yellow" })
} catch {
    Write-Host "? FAIL Security Headers Test" -ForegroundColor Red
}

# ================================================================
# Results Summary
# ================================================================

Write-Host ""
Write-Host " Test Results Summary:" -ForegroundColor Yellow
Write-Host "========================" -ForegroundColor Yellow

$totalTests = $testResults.Count
$passedTests = ($testResults | Where-Object { $_.Success -eq $true }).Count
$failedTests = $totalTests - $passedTests
$successRate = if ($totalTests -gt 0) { [math]::Round(($passedTests / $totalTests) * 100, 1) } else { 0 }

Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor $(if ($failedTests -eq 0) { "Green" } else { "Red" })
Write-Host "Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) { "Green" } elseif ($successRate -ge 60) { "Yellow" } else { "Red" })

# Average response time
$validResponseTimes = $testResults | Where-Object { $_.ResponseTime -ne $null -and $_.ResponseTime -lt 9999 }
if ($validResponseTimes.Count -gt 0) {
    $avgResponseTime = ($validResponseTimes | Measure-Object -Property ResponseTime -Average).Average
    Write-Host "Average Response Time: $([math]::Round($avgResponseTime))ms" -ForegroundColor White
}

# ================================================================
# Detailed Results
# ================================================================

if ($Verbose) {
    Write-Host ""
    Write-Host " Detailed Results:" -ForegroundColor Yellow
    
    foreach ($result in $testResults) {
        $status = if ($result.Success) { "?" } else { "?" }
        Write-Host "$status $($result.Name)" -ForegroundColor $(if ($result.Success) { "Green" } else { "Red" })
        
        if ($result.ResponseTime) {
            Write-Host "   Response Time: $($result.ResponseTime)ms" -ForegroundColor Gray
        }
        
        if ($result.Error) {
            Write-Host "   Error: $($result.Error)" -ForegroundColor Red
        }
        
        if ($result.Url) {
            Write-Host "   URL: $($result.Url)" -ForegroundColor Gray
        }
        
        Write-Host ""
    }
}

# ================================================================
# Save Results
# ================================================================

if ($SaveResults) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $resultsFile = "nexhire-frontend-test-$timestamp.json"
    
    $testReport = @{
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        BaseUrl = $BaseUrl
        TotalTests = $totalTests
        PassedTests = $passedTests
        FailedTests = $failedTests
        SuccessRate = $successRate
        AverageLoadTime = $avgLoadTime
        Results = $testResults
    }
    
    $testReport | ConvertTo-Json -Depth 5 | Set-Content $resultsFile
    Write-Host ""
    Write-Host " Results saved to: $resultsFile" -ForegroundColor Blue
}

# ================================================================
# Recommendations
# ================================================================

Write-Host ""
Write-Host " Recommendations:" -ForegroundColor Yellow

if ($failedTests -gt 0) {
    Write-Host "� Fix failing tests before production deployment" -ForegroundColor Red
}

if ($avgLoadTime -gt 3000) {
    Write-Host "� Optimize application performance (target < 3 seconds)" -ForegroundColor Yellow
}

if ($successRate -lt 80) {
    Write-Host "� Investigate failed tests and resolve issues" -ForegroundColor Red
}

if ($successRate -ge 90) {
    Write-Host "� Excellent! Frontend is production-ready ?" -ForegroundColor Green
}

Write-Host ""
Write-Host " Frontend URL: $BaseUrl" -ForegroundColor Cyan
Write-Host " API Backend: $apiBaseUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host " Frontend testing complete!" -ForegroundColor Green