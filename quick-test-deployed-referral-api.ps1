# Quick Referral API Test for Deployed System
# Tests existing deployed referral endpoints

param(
    [string]$BaseURL = "https://nexhire-api-func.azurewebsites.net/api"
)

Write-Host "?? Testing Deployed NexHire Referral APIs" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host "Base URL: $BaseURL" -ForegroundColor Yellow
Write-Host ""

# Helper function for API calls
function Test-API {
    param(
        [string]$Method = "GET",
        [string]$Endpoint,
        [object]$Body = $null,
        [string]$Token = "",
        [string]$Description
    )
    
    Write-Host "?? Testing: $Description" -ForegroundColor Cyan
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }
    
    $url = "$BaseURL/$Endpoint"
    
    try {
        if ($Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            $response = Invoke-RestMethod -Uri $url -Method $Method -Headers $headers -Body $jsonBody -TimeoutSec 30
        } else {
            $response = Invoke-RestMethod -Uri $url -Method $Method -Headers $headers -TimeoutSec 30
        }
        
        Write-Host "? SUCCESS: $Description" -ForegroundColor Green
        if ($response.data) {
            Write-Host "   Data: $($response.data.GetType().Name)" -ForegroundColor White
            if ($response.data.Count) {
                Write-Host "   Count: $($response.data.Count)" -ForegroundColor White
            }
        }
        return @{ Success = $true; Data = $response }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = $_.Exception.Message
        
        if ($statusCode -eq 401) {
            Write-Host "?? AUTH REQUIRED: $Description" -ForegroundColor Yellow
        } elseif ($statusCode -eq 404) {
            Write-Host "? NOT FOUND: $Description (may not be deployed yet)" -ForegroundColor Orange
        } elseif ($statusCode -eq 500) {
            Write-Host "? SERVER ERROR: $Description" -ForegroundColor Red
        } else {
            Write-Host "?? ERROR ($statusCode): $Description - $errorMessage" -ForegroundColor Red
        }
        
        return @{ Success = $false; Error = $errorMessage; StatusCode = $statusCode }
    }
}

# Test 1: Health Check
$health = Test-API -Endpoint "health" -Description "API Health Check"
Write-Host ""

# Test 2: Referral Plans (should work without auth)
$plans = Test-API -Endpoint "referral/plans" -Description "Get Referral Plans"
if ($plans.Success) {
    foreach ($plan in $plans.Data.data) {
        Write-Host "   ?? $($plan.Name): $($plan.ReferralsPerDay)/day for $($plan.DurationDays) days - $$$($plan.Price)" -ForegroundColor White
    }
}
Write-Host ""

# Test 3: Test login to get token for authenticated endpoints
Write-Host "?? Attempting to get auth token for further testing..." -ForegroundColor Cyan
$loginResult = Test-API -Method "POST" -Endpoint "auth/login" -Body @{
    email = "test@nexhire.com"
    password = "TestPassword123!"
} -Description "Test Login"

$testToken = ""
if ($loginResult.Success) {
    $testToken = $loginResult.Data.data.accessToken
    Write-Host "? Got auth token for testing" -ForegroundColor Green
} else {
    Write-Host "?? No auth token - will test public endpoints only" -ForegroundColor Yellow
}
Write-Host ""

# Test 4: Referral Eligibility (requires auth)
if ($testToken) {
    Test-API -Endpoint "referral/eligibility" -Token $testToken -Description "Check Referral Eligibility"
} else {
    Write-Host "?? Skipping eligibility check (requires auth)" -ForegroundColor Yellow
}
Write-Host ""

# Test 5: Current Subscription (requires auth)
if ($testToken) {
    Test-API -Endpoint "referral/subscription" -Token $testToken -Description "Get Current Subscription"
} else {
    Write-Host "?? Skipping subscription check (requires auth)" -ForegroundColor Yellow
}
Write-Host ""

# Test 6: My Referral Requests (requires auth)
if ($testToken) {
    Test-API -Endpoint "referral/my-requests" -Token $testToken -Description "Get My Referral Requests"
} else {
    Write-Host "?? Skipping my requests check (requires auth)" -ForegroundColor Yellow
}
Write-Host ""

# Test 7: Available Requests (requires auth)
if ($testToken) {
    Test-API -Endpoint "referral/available" -Token $testToken -Description "Get Available Referral Requests"
} else {
    Write-Host "?? Skipping available requests check (requires auth)" -ForegroundColor Yellow
}
Write-Host ""

# Test 8: Referral Analytics (requires auth)
if ($testToken) {
    $analytics = Test-API -Endpoint "referral/analytics" -Token $testToken -Description "Get Referral Analytics"
    if ($analytics.Success) {
        $data = $analytics.Data.data
        Write-Host "   ?? Requests Made: $($data.totalRequestsMade)" -ForegroundColor White
        Write-Host "   ?? Requests Received: $($data.totalRequestsReceived)" -ForegroundColor White
        Write-Host "   ?? Completed: $($data.completedReferrals)" -ForegroundColor White
        Write-Host "   ?? Points Earned: $($data.totalPointsEarned)" -ForegroundColor White
    }
} else {
    Write-Host "?? Skipping analytics check (requires auth)" -ForegroundColor Yellow
}
Write-Host ""

# Test 9: Referrer Stats (requires auth)
if ($testToken) {
    Test-API -Endpoint "referral/stats" -Token $testToken -Description "Get Referrer Badge Stats"
} else {
    Write-Host "?? Skipping stats check (requires auth)" -ForegroundColor Yellow
}
Write-Host ""

# Test 10: NEW ENDPOINTS - Test if proof submission endpoint exists
Write-Host "?? Testing NEW endpoints (may not be deployed yet)..." -ForegroundColor Magenta

if ($testToken) {
    # Test proof submission endpoint (should return 404 or 400 if not implemented)
    Test-API -Method "POST" -Endpoint "referral/requests/test-id/proof" -Body @{
        fileURL = "https://example.com/test.png"
        fileType = "image/png"
    } -Token $testToken -Description "Submit Referral Proof (NEW)"
} else {
    Write-Host "?? Skipping proof submission test (requires auth)" -ForegroundColor Yellow
}
Write-Host ""

if ($testToken) {
    # Test verification endpoint
    Test-API -Method "POST" -Endpoint "referral/requests/test-id/verify" -Body @{
        verified = $true
    } -Token $testToken -Description "Verify Referral (NEW)"
} else {
    Write-Host "?? Skipping verification test (requires auth)" -ForegroundColor Yellow
}
Write-Host ""

if ($testToken) {
    # Test my referrer requests endpoint
    Test-API -Endpoint "referral/my-referrer-requests" -Token $testToken -Description "Get My Referrer Requests (NEW)"
} else {
    Write-Host "?? Skipping referrer requests test (requires auth)" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "?? DEPLOYMENT TEST SUMMARY" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green
Write-Host ""
Write-Host "? CORE ENDPOINTS TESTED:" -ForegroundColor Cyan
Write-Host "  ?? GET /referral/plans" -ForegroundColor White
Write-Host "  ?? GET /referral/eligibility" -ForegroundColor White
Write-Host "  ?? GET /referral/subscription" -ForegroundColor White
Write-Host "  ?? GET /referral/my-requests" -ForegroundColor White
Write-Host "  ?? GET /referral/available" -ForegroundColor White
Write-Host "  ?? GET /referral/analytics" -ForegroundColor White
Write-Host "  ?? GET /referral/stats" -ForegroundColor White
Write-Host ""
Write-Host "?? NEW ENDPOINTS TESTED:" -ForegroundColor Magenta
Write-Host "  ?? POST /referral/requests/{id}/proof" -ForegroundColor White
Write-Host "  ?? POST /referral/requests/{id}/verify" -ForegroundColor White
Write-Host "  ????? GET /referral/my-referrer-requests" -ForegroundColor White
Write-Host ""

if ($testToken) {
    Write-Host "?? Authentication: Working" -ForegroundColor Green
} else {
    Write-Host "?? Authentication: Test account not available" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "?? Continue with your deployment - this gives you baseline API status!" -ForegroundColor Green