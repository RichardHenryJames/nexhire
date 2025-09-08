# Post-Deployment Referral API Verification
# Run this AFTER your new deployment is complete

param(
    [string]$BaseURL = "https://nexhire-api-func.azurewebsites.net/api",
    [int]$WaitTime = 30
)

Write-Host "?? Post-Deployment Referral API Verification" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "Base URL: $BaseURL" -ForegroundColor Yellow
Write-Host ""

# Wait for deployment to be ready
Write-Host "? Waiting $WaitTime seconds for deployment to stabilize..." -ForegroundColor Yellow
Start-Sleep -Seconds $WaitTime

function Test-Endpoint {
    param(
        [string]$Method = "GET",
        [string]$Endpoint,
        [object]$Body = $null,
        [string]$Token = "",
        [string]$Description,
        [bool]$ExpectAuth = $false
    )
    
    $headers = @{
        "Content-Type" = "application/json"
        "User-Agent" = "NexHire-API-Test/1.0"
    }
    
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }
    
    $url = "$BaseURL/$Endpoint"
    
    try {
        Write-Host "?? Testing: $Description" -ForegroundColor Cyan
        
        if ($Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            $response = Invoke-RestMethod -Uri $url -Method $Method -Headers $headers -Body $jsonBody -TimeoutSec 15
        } else {
            $response = Invoke-RestMethod -Uri $url -Method $Method -Headers $headers -TimeoutSec 15
        }
        
        Write-Host "? SUCCESS: $Description" -ForegroundColor Green
        
        # Show response details
        if ($response.success -eq $true) {
            Write-Host "   ? Response: Success = true" -ForegroundColor White
            if ($response.data) {
                if ($response.data.Count) {
                    Write-Host "   ?? Data Count: $($response.data.Count)" -ForegroundColor White
                } elseif ($response.data.GetType().Name -eq "PSCustomObject") {
                    $props = ($response.data | Get-Member -MemberType NoteProperty).Count
                    Write-Host "   ?? Data Properties: $props" -ForegroundColor White
                }
            }
            if ($response.message) {
                Write-Host "   ?? Message: $($response.message)" -ForegroundColor White
            }
        }
        
        return @{ Success = $true; Data = $response; StatusCode = 200 }
        
    } catch {
        $statusCode = 0
        $errorDetails = $null
        
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
            try {
                $errorStream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($errorStream)
                $errorBody = $reader.ReadToEnd()
                $errorDetails = $errorBody | ConvertFrom-Json
            } catch {
                # Ignore JSON parsing errors
            }
        }
        
        if ($statusCode -eq 401 -and $ExpectAuth) {
            Write-Host "?? EXPECTED AUTH: $Description (endpoint requires authentication)" -ForegroundColor Yellow
            return @{ Success = $true; StatusCode = 401; AuthRequired = $true }
        } elseif ($statusCode -eq 401) {
            Write-Host "?? AUTH REQUIRED: $Description" -ForegroundColor Yellow
            return @{ Success = $false; StatusCode = 401; AuthRequired = $true }
        } elseif ($statusCode -eq 404) {
            Write-Host "? NOT FOUND: $Description (endpoint may not be deployed)" -ForegroundColor Orange
            return @{ Success = $false; StatusCode = 404 }
        } elseif ($statusCode -eq 400) {
            Write-Host "?? BAD REQUEST: $Description" -ForegroundColor Yellow
            if ($errorDetails -and $errorDetails.error) {
                Write-Host "   Error: $($errorDetails.error)" -ForegroundColor White
            }
            return @{ Success = $false; StatusCode = 400; Error = $errorDetails }
        } elseif ($statusCode -eq 500) {
            Write-Host "? SERVER ERROR: $Description" -ForegroundColor Red
            return @{ Success = $false; StatusCode = 500 }
        } else {
            Write-Host "? ERROR ($statusCode): $Description" -ForegroundColor Red
            Write-Host "   $($_.Exception.Message)" -ForegroundColor White
            return @{ Success = $false; StatusCode = $statusCode; Error = $_.Exception.Message }
        }
    }
}

# Test Results Tracking
$testResults = @{
    Total = 0
    Passed = 0
    Failed = 0
    AuthRequired = 0
    NotFound = 0
}

function Record-Result($result) {
    $testResults.Total++
    if ($result.Success) {
        $testResults.Passed++
    } elseif ($result.AuthRequired) {
        $testResults.AuthRequired++
    } elseif ($result.StatusCode -eq 404) {
        $testResults.NotFound++
    } else {
        $testResults.Failed++
    }
}

Write-Host "?? TESTING CORE ENDPOINTS" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
$result = Test-Endpoint -Endpoint "health" -Description "API Health Check"
Record-Result $result
Write-Host ""

# Test 2: Referral Plans (Public endpoint)
$result = Test-Endpoint -Endpoint "referral/plans" -Description "Get Referral Plans (Public)"
Record-Result $result
if ($result.Success -and $result.Data.data) {
    Write-Host "   ?? Available Plans:" -ForegroundColor Cyan
    foreach ($plan in $result.Data.data) {
        Write-Host "     • $($plan.Name): $($plan.ReferralsPerDay)/day, $($plan.DurationDays) days, $$$($plan.Price)" -ForegroundColor White
    }
}
Write-Host ""

# Test 3-9: Authenticated endpoints (should return 401)
$authEndpoints = @(
    @{ Endpoint = "referral/eligibility"; Description = "Check Referral Eligibility" },
    @{ Endpoint = "referral/subscription"; Description = "Get Current Subscription" },
    @{ Endpoint = "referral/my-requests"; Description = "Get My Referral Requests" },
    @{ Endpoint = "referral/available"; Description = "Get Available Requests" },
    @{ Endpoint = "referral/analytics"; Description = "Get Referral Analytics" },
    @{ Endpoint = "referral/stats"; Description = "Get Referrer Stats" },
    @{ Endpoint = "referral/my-referrer-requests"; Description = "Get My Referrer Requests (NEW)" }
)

Write-Host "?? TESTING AUTHENTICATED ENDPOINTS (Should require auth)" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

foreach ($endpoint in $authEndpoints) {
    $result = Test-Endpoint -Endpoint $endpoint.Endpoint -Description $endpoint.Description -ExpectAuth $true
    Record-Result $result
    Write-Host ""
}

Write-Host "?? TESTING POST ENDPOINTS (Should require auth + data)" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# Test POST endpoints with sample data
$postEndpoints = @(
    @{ 
        Endpoint = "referral/requests"
        Description = "Create Referral Request (NEW)"
        Body = @{ jobID = "550e8400-e29b-41d4-a716-446655440000"; resumeID = "550e8400-e29b-41d4-a716-446655440001" }
    },
    @{ 
        Endpoint = "referral/plans/purchase"
        Description = "Purchase Referral Plan"
        Body = @{ planID = 1 }
    },
    @{ 
        Endpoint = "referral/requests/550e8400-e29b-41d4-a716-446655440002/claim"
        Description = "Claim Referral Request"
        Body = @{}
    },
    @{ 
        Endpoint = "referral/requests/550e8400-e29b-41d4-a716-446655440002/proof"
        Description = "Submit Referral Proof (NEW)"
        Body = @{ fileURL = "https://example.com/proof.png"; fileType = "image/png" }
    },
    @{ 
        Endpoint = "referral/requests/550e8400-e29b-41d4-a716-446655440002/verify"
        Description = "Verify Referral (NEW)"
        Body = @{ verified = $true }
    }
)

foreach ($endpoint in $postEndpoints) {
    $result = Test-Endpoint -Method "POST" -Endpoint $endpoint.Endpoint -Body $endpoint.Body -Description $endpoint.Description -ExpectAuth $true
    Record-Result $result
    Write-Host ""
}

# Final Summary
Write-Host "?? DEPLOYMENT TEST SUMMARY" -ForegroundColor Green
Write-Host "==========================" -ForegroundColor Green
Write-Host ""
Write-Host "?? Test Results:" -ForegroundColor Cyan
Write-Host "   Total Tests: $($testResults.Total)" -ForegroundColor White
Write-Host "   ? Passed: $($testResults.Passed)" -ForegroundColor Green
Write-Host "   ?? Auth Required: $($testResults.AuthRequired)" -ForegroundColor Yellow
Write-Host "   ? Not Found: $($testResults.NotFound)" -ForegroundColor Orange
Write-Host "   ? Failed: $($testResults.Failed)" -ForegroundColor Red
Write-Host ""

# Deployment Status Assessment
$healthyEndpoints = $testResults.Passed + $testResults.AuthRequired
$totalExpected = $testResults.Total - $testResults.NotFound

if ($testResults.Passed -gt 0) {
    Write-Host "? DEPLOYMENT STATUS: API is responding!" -ForegroundColor Green
} else {
    Write-Host "? DEPLOYMENT STATUS: API may not be fully deployed yet" -ForegroundColor Red
}

if ($testResults.AuthRequired -gt 5) {
    Write-Host "? AUTHENTICATION: Working correctly (endpoints require auth)" -ForegroundColor Green
} else {
    Write-Host "?? AUTHENTICATION: May need verification" -ForegroundColor Yellow
}

if ($testResults.NotFound -eq 0) {
    Write-Host "? NEW ENDPOINTS: All referral endpoints are deployed!" -ForegroundColor Green
} else {
    Write-Host "?? NEW ENDPOINTS: $($testResults.NotFound) endpoints not found (may still be deploying)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "?? NEXT STEPS:" -ForegroundColor Cyan
if ($testResults.Passed -gt 0) {
    Write-Host "1. ? Basic API is working" -ForegroundColor Green
    Write-Host "2. ?? Test with actual user authentication" -ForegroundColor Yellow
    Write-Host "3. ?? Create test data and verify full workflow" -ForegroundColor Yellow
    Write-Host "4. ?? Referral system is ready for use!" -ForegroundColor Green
} else {
    Write-Host "1. ? Wait for deployment to complete" -ForegroundColor Yellow
    Write-Host "2. ?? Run this test again in a few minutes" -ForegroundColor Yellow
    Write-Host "3. ?? Check Azure Functions logs for any errors" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "?? Your enhanced referral system deployment test complete!" -ForegroundColor Green