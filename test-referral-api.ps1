# NexHire Referral System API Test Script
# Tests all referral endpoints and functionality

param(
    [string]$BaseUrl = "https://nexhire-api-func.azurewebsites.net/api",
    [string]$TestUserEmail = "testuser@example.com",
    [string]$TestUserPassword = "TestPassword123!",
    [switch]$Verbose = $false
)

Write-Host "?? Testing NexHire Referral System API" -ForegroundColor Green
Write-Host "Base URL: $BaseUrl" -ForegroundColor Cyan

# Global variables
$Global:AuthToken = $null
$Global:TestJobId = $null
$Global:TestResumeId = $null
$Global:TestRequestId = $null

# Helper function to make API calls
function Invoke-ApiCall {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [hashtable]$Headers = @{}
    )
    
    $uri = "$BaseUrl$Endpoint"
    $requestHeaders = @{
        'Content-Type' = 'application/json'
        'Accept' = 'application/json'
    }
    
    if ($Global:AuthToken) {
        $requestHeaders['Authorization'] = "Bearer $Global:AuthToken"
    }
    
    # Merge additional headers
    foreach ($key in $Headers.Keys) {
        $requestHeaders[$key] = $Headers[$key]
    }
    
    try {
        $params = @{
            Uri = $uri
            Method = $Method
            Headers = $requestHeaders
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        if ($Verbose) {
            Write-Host "?? $Method $uri" -ForegroundColor Yellow
            if ($Body) {
                Write-Host "?? Body: $($params.Body)" -ForegroundColor Gray
            }
        }
        
        $response = Invoke-RestMethod @params
        
        if ($Verbose) {
            Write-Host "?? Response: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
        }
        
        return $response
    }
    catch {
        Write-Host "? Error calling $Method $uri`: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "?? Error Response: $responseBody" -ForegroundColor Red
        }
        return $null
    }
}

# Test 1: Authentication (Login)
Write-Host "`n?? Test 1: Authentication" -ForegroundColor Blue

$loginResponse = Invoke-ApiCall -Method POST -Endpoint "/auth/login" -Body @{
    email = $TestUserEmail
    password = $TestUserPassword
}

if ($loginResponse -and $loginResponse.success) {
    $Global:AuthToken = $loginResponse.data.accessToken
    Write-Host "? Authentication successful" -ForegroundColor Green
} else {
    Write-Host "? Authentication failed - creating test user or check credentials" -ForegroundColor Red
    return
}

# Test 2: Get Referral Plans
Write-Host "`n?? Test 2: Get Referral Plans" -ForegroundColor Blue

$plansResponse = Invoke-ApiCall -Method GET -Endpoint "/referral/plans"

if ($plansResponse -and $plansResponse.success) {
    Write-Host "? Retrieved $($plansResponse.data.Count) referral plans" -ForegroundColor Green
    $plansResponse.data | ForEach-Object {
        Write-Host "   - $($_.Name): $($_.ReferralsPerDay)/day, $($_.DurationDays) days, $$$($_.Price)" -ForegroundColor Cyan
    }
} else {
    Write-Host "? Failed to get referral plans" -ForegroundColor Red
}

# Test 3: Check Referral Eligibility
Write-Host "`n?? Test 3: Check Referral Eligibility" -ForegroundColor Blue

$eligibilityResponse = Invoke-ApiCall -Method GET -Endpoint "/referral/eligibility"

if ($eligibilityResponse -and $eligibilityResponse.success) {
    $eligibility = $eligibilityResponse.data
    Write-Host "? Eligibility checked" -ForegroundColor Green
    Write-Host "   - Eligible: $($eligibility.isEligible)" -ForegroundColor Cyan
    Write-Host "   - Has Subscription: $($eligibility.hasActiveSubscription)" -ForegroundColor Cyan
    Write-Host "   - Daily Quota Remaining: $($eligibility.dailyQuotaRemaining)" -ForegroundColor Cyan
    Write-Host "   - Can Refer: $($eligibility.canRefer)" -ForegroundColor Cyan
    if ($eligibility.reason) {
        Write-Host "   - Reason: $($eligibility.reason)" -ForegroundColor Yellow
    }
} else {
    Write-Host "? Failed to check eligibility" -ForegroundColor Red
}

# Test 4: Get Current Subscription
Write-Host "`n?? Test 4: Get Current Subscription" -ForegroundColor Blue

$subscriptionResponse = Invoke-ApiCall -Method GET -Endpoint "/referral/subscription"

if ($subscriptionResponse -and $subscriptionResponse.success) {
    if ($subscriptionResponse.data) {
        $sub = $subscriptionResponse.data
        Write-Host "? Current subscription: $($sub.PlanName)" -ForegroundColor Green
        Write-Host "   - Referrals per day: $($sub.ReferralsPerDay)" -ForegroundColor Cyan
        Write-Host "   - End date: $($sub.EndDate)" -ForegroundColor Cyan
    } else {
        Write-Host "?? No active subscription (using free tier)" -ForegroundColor Yellow
    }
} else {
    Write-Host "? Failed to get subscription" -ForegroundColor Red
}

# Test 5: Get Available Jobs (to create referral request)
Write-Host "`n?? Test 5: Get Available Jobs" -ForegroundColor Blue

$jobsResponse = Invoke-ApiCall -Method GET -Endpoint "/jobs?page=1&pageSize=5"

if ($jobsResponse -and $jobsResponse.success -and $jobsResponse.data.Count -gt 0) {
    $Global:TestJobId = $jobsResponse.data[0].JobID
    Write-Host "? Found test job: $($jobsResponse.data[0].Title)" -ForegroundColor Green
    Write-Host "   - Job ID: $Global:TestJobId" -ForegroundColor Cyan
} else {
    Write-Host "? No jobs found for testing" -ForegroundColor Red
    return
}

# Test 6: Get User Resumes
Write-Host "`n?? Test 6: Get User Resumes" -ForegroundColor Blue

$resumesResponse = Invoke-ApiCall -Method GET -Endpoint "/users/resumes"

if ($resumesResponse -and $resumesResponse.success -and $resumesResponse.data.Count -gt 0) {
    $Global:TestResumeId = $resumesResponse.data[0].ResumeID
    Write-Host "? Found test resume: $($resumesResponse.data[0].ResumeLabel)" -ForegroundColor Green
    Write-Host "   - Resume ID: $Global:TestResumeId" -ForegroundColor Cyan
} else {
    Write-Host "? No resumes found - user needs to upload a resume first" -ForegroundColor Red
    return
}

# Test 7: Create Referral Request
Write-Host "`n?? Test 7: Create Referral Request" -ForegroundColor Blue

$createRequestResponse = Invoke-ApiCall -Method POST -Endpoint "/referral/requests" -Body @{
    jobID = $Global:TestJobId
    resumeID = $Global:TestResumeId
}

if ($createRequestResponse -and $createRequestResponse.success) {
    $Global:TestRequestId = $createRequestResponse.data.RequestID
    Write-Host "? Referral request created successfully" -ForegroundColor Green
    Write-Host "   - Request ID: $Global:TestRequestId" -ForegroundColor Cyan
    Write-Host "   - Status: $($createRequestResponse.data.Status)" -ForegroundColor Cyan
} else {
    Write-Host "? Failed to create referral request" -ForegroundColor Red
    if ($createRequestResponse.message) {
        Write-Host "   - Error: $($createRequestResponse.message)" -ForegroundColor Red
    }
}

# Test 8: Get My Referral Requests
Write-Host "`n?? Test 8: Get My Referral Requests" -ForegroundColor Blue

$myRequestsResponse = Invoke-ApiCall -Method GET -Endpoint "/referral/my-requests?page=1&pageSize=10"

if ($myRequestsResponse -and $myRequestsResponse.success) {
    Write-Host "? Retrieved $($myRequestsResponse.data.requests.Count) of $($myRequestsResponse.data.total) requests" -ForegroundColor Green
    $myRequestsResponse.data.requests | ForEach-Object {
        Write-Host "   - $($_.JobTitle) at $($_.CompanyName) [$($_.Status)]" -ForegroundColor Cyan
    }
} else {
    Write-Host "? Failed to get my requests" -ForegroundColor Red
}

# Test 9: Get Available Requests (as referrer)
Write-Host "`n?? Test 9: Get Available Requests" -ForegroundColor Blue

$availableResponse = Invoke-ApiCall -Method GET -Endpoint "/referral/available?page=1&pageSize=10"

if ($availableResponse -and $availableResponse.success) {
    Write-Host "? Retrieved $($availableResponse.data.requests.Count) available requests" -ForegroundColor Green
    $availableResponse.data.requests | ForEach-Object {
        Write-Host "   - $($_.JobTitle) at $($_.CompanyName) by $($_.ApplicantName)" -ForegroundColor Cyan
    }
} else {
    Write-Host "?? No available requests (user may not be eligible to refer)" -ForegroundColor Yellow
}

# Test 10: Get Referral Analytics
Write-Host "`n?? Test 10: Get Referral Analytics" -ForegroundColor Blue

$analyticsResponse = Invoke-ApiCall -Method GET -Endpoint "/referral/analytics"

if ($analyticsResponse -and $analyticsResponse.success) {
    $analytics = $analyticsResponse.data
    Write-Host "? Analytics retrieved" -ForegroundColor Green
    Write-Host "   - Total Requests Made: $($analytics.totalRequestsMade)" -ForegroundColor Cyan
    Write-Host "   - Total Requests Received: $($analytics.totalRequestsReceived)" -ForegroundColor Cyan
    Write-Host "   - Completed Referrals: $($analytics.completedReferrals)" -ForegroundColor Cyan
    Write-Host "   - Pending Requests: $($analytics.pendingRequests)" -ForegroundColor Cyan
    Write-Host "   - Total Points Earned: $($analytics.totalPointsEarned)" -ForegroundColor Cyan
    Write-Host "   - Daily Quota Used: $($analytics.dailyQuotaUsed)/$($analytics.dailyQuotaLimit)" -ForegroundColor Cyan
} else {
    Write-Host "? Failed to get analytics" -ForegroundColor Red
}

# Test 11: Get Referrer Stats (Badge Counts)
Write-Host "`n?? Test 11: Get Referrer Stats" -ForegroundColor Blue

$statsResponse = Invoke-ApiCall -Method GET -Endpoint "/referral/stats"

if ($statsResponse -and $statsResponse.success) {
    $stats = $statsResponse.data
    Write-Host "? Referrer stats retrieved" -ForegroundColor Green
    Write-Host "   - Pending Count: $($stats.PendingCount)" -ForegroundColor Cyan
    Write-Host "   - Last Updated: $($stats.LastUpdated)" -ForegroundColor Cyan
} else {
    Write-Host "? Failed to get referrer stats" -ForegroundColor Red
}

# Test 12: Purchase Referral Plan (Optional - commented out to avoid charges)
Write-Host "`n?? Test 12: Purchase Referral Plan (Skipped)" -ForegroundColor Blue
Write-Host "?? Plan purchase test skipped to avoid charges. Uncomment to test." -ForegroundColor Yellow

<#
if ($plansResponse -and $plansResponse.data.Count -gt 0) {
    $testPlan = $plansResponse.data | Where-Object { $_.Name -eq "Weekly Boost" } | Select-Object -First 1
    if ($testPlan) {
        $purchaseResponse = Invoke-ApiCall -Method POST -Endpoint "/referral/plans/purchase" -Body @{
            planID = $testPlan.PlanID
            paymentToken = "test-payment-token"
        }
        
        if ($purchaseResponse -and $purchaseResponse.success) {
            Write-Host "? Plan purchased successfully" -ForegroundColor Green
        } else {
            Write-Host "? Failed to purchase plan" -ForegroundColor Red
        }
    }
}
#>

# Test 13: Health Check
Write-Host "`n?? Test 13: Health Check" -ForegroundColor Blue

$healthResponse = Invoke-ApiCall -Method GET -Endpoint "/health"

if ($healthResponse -and $healthResponse.success) {
    Write-Host "? API is healthy" -ForegroundColor Green
    Write-Host "   - Message: $($healthResponse.message)" -ForegroundColor Cyan
    Write-Host "   - Timestamp: $($healthResponse.timestamp)" -ForegroundColor Cyan
} else {
    Write-Host "? Health check failed" -ForegroundColor Red
}

# Summary
Write-Host "`n?? Test Summary" -ForegroundColor Magenta
Write-Host "===================" -ForegroundColor Magenta
Write-Host "Base URL: $BaseUrl" -ForegroundColor White
Write-Host "Test User: $TestUserEmail" -ForegroundColor White

# Fixed ternary operator syntax for PowerShell
if ($Global:AuthToken) {
    Write-Host "Auth Token: ? Valid" -ForegroundColor Green
} else {
    Write-Host "Auth Token: ? Invalid" -ForegroundColor Red
}

Write-Host "Test Job ID: $Global:TestJobId" -ForegroundColor White
Write-Host "Test Resume ID: $Global:TestResumeId" -ForegroundColor White
Write-Host "Test Request ID: $Global:TestRequestId" -ForegroundColor White

Write-Host "`n?? Referral System API Testing Complete!" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Test plan purchases with real payment integration" -ForegroundColor White
Write-Host "2. Test referral claiming workflow" -ForegroundColor White  
Write-Host "3. Test proof submission and verification" -ForegroundColor White
Write-Host "4. Test notification system" -ForegroundColor White
Write-Host "5. Load test with multiple concurrent users" -ForegroundColor White

# Save test results
$testResults = @{
    TestDate = Get-Date
    BaseUrl = $BaseUrl
    TestUser = $TestUserEmail
    AuthToken = $Global:AuthToken
    TestJobId = $Global:TestJobId
    TestResumeId = $Global:TestResumeId
    TestRequestId = $Global:TestRequestId
}

$testResults | ConvertTo-Json -Depth 3 | Out-File "referral-test-results.json" -Encoding UTF8
Write-Host "`n?? Test results saved to referral-test-results.json" -ForegroundColor Cyan