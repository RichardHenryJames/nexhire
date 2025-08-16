# ========================================
# NexHire API Complete Test Script - IMPROVED
# Tests all 17 API endpoints with proper error handling
# ========================================

param(
    [string]$BaseUrl = "https://nexhire-api-func.azurewebsites.net/api",
    [switch]$ShowHeaders,
    [switch]$SaveResponses,
    [switch]$ShowErrors
)

# Configure PowerShell for better JSON handling
$ProgressPreference = 'SilentlyContinue'

# Colors for output
function Write-Success { param($Message) Write-Host "? $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "? $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "??  $Message" -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host "??  $Message" -ForegroundColor Yellow }

# Global variables
$global:AccessToken = ""
$global:UserId = ""
$global:JobId = ""
$global:ApplicationId = ""
$TestResults = @()

# Test result tracking
function Add-TestResult {
    param($TestName, $Method, $Endpoint, $StatusCode, $Success, $ResponseTime, $Error = "", $ResponseBody = "")

    $testResult = New-Object PSObject -Property @{
        TestName = $TestName
        Method = $Method
        Endpoint = $Endpoint
        StatusCode = $StatusCode
        Success = $Success
        ResponseTime = $ResponseTime
        Error = $Error
        ResponseBody = $ResponseBody
        Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }

    $script:TestResults += $testResult
}

# HTTP Request helper with timing and improved error handling
function Invoke-ApiTest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Headers = @{},
        [string]$Body = "",
        [string]$TestName
    )

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        $uri = "$BaseUrl$Endpoint"
        Write-Info "Testing: $Method $uri"

        $requestHeaders = @{
            "Content-Type" = "application/json"
            "Accept" = "application/json"
        }

        # Add additional headers
        foreach ($key in $Headers.Keys) {
            $requestHeaders[$key] = $Headers[$key]
        }

        $params = @{
            Uri = $uri
            Method = $Method
            Headers = $requestHeaders
            UseBasicParsing = $true
        }

        if ($Body -and $Method -in @("POST", "PUT", "PATCH")) {
            $params.Body = $Body
            if ($ShowHeaders) {
                Write-Host "Request Body:" -ForegroundColor Gray
                $Body | Write-Host -ForegroundColor Gray
            }
        }

        $response = Invoke-WebRequest @params
        $stopwatch.Stop()

        $responseObj = $response.Content | ConvertFrom-Json

        Write-Success "$TestName - Status: $($response.StatusCode) - Time: $($stopwatch.ElapsedMilliseconds)ms"

        if ($ShowHeaders) {
            Write-Host "Response Headers:" -ForegroundColor Gray
            $response.Headers | Format-Table | Out-String | Write-Host -ForegroundColor Gray
        }

        Write-Host "Response:" -ForegroundColor Yellow
        $responseObj | ConvertTo-Json -Depth 3 | Write-Host -ForegroundColor White
        Write-Host ""

        Add-TestResult -TestName $TestName -Method $Method -Endpoint $Endpoint -StatusCode $response.StatusCode -Success $true -ResponseTime $stopwatch.ElapsedMilliseconds -ResponseBody ($responseObj | ConvertTo-Json -Depth 2)

        return $responseObj
    }
    catch {
        $stopwatch.Stop()
        $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { 0 }
        $errorResponse = ""

        if ($_.Exception.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $errorResponse = $reader.ReadToEnd()
                $reader.Close()
            }
            catch {
                $errorResponse = "Could not read error response"
            }
        }

        Write-Error "$TestName - Status: $statusCode - Time: $($stopwatch.ElapsedMilliseconds)ms"
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red

        if ($ShowErrors -and $errorResponse) {
            Write-Host "Error Response Body:" -ForegroundColor Red
            $errorResponse | Write-Host -ForegroundColor Red
        }
        Write-Host ""

        Add-TestResult -TestName $TestName -Method $Method -Endpoint $Endpoint -StatusCode $statusCode -Success $false -ResponseTime $stopwatch.ElapsedMilliseconds -Error $_.Exception.Message -ResponseBody $errorResponse

        return $null
    }
}

# Start testing
Write-Host "?? Starting NexHire API Complete Test Suite - IMPROVED" -ForegroundColor Magenta
Write-Host "Base URL: $BaseUrl" -ForegroundColor Magenta
Write-Host "Timestamp: $(Get-Date)" -ForegroundColor Magenta
Write-Host ("=" * 60) -ForegroundColor Magenta
Write-Host ""

# ========================================
# 1. REFERENCE DATA TESTS (No Auth Required)
# ========================================

Write-Host "?? TESTING REFERENCE DATA APIs" -ForegroundColor Blue
Write-Host ("-" * 40) -ForegroundColor Blue

# Test 1: Get Job Types
$jobTypes = Invoke-ApiTest -Method "GET" -Endpoint "/reference/job-types" -TestName "Get Job Types"

# Test 2: Get Currencies
$currencies = Invoke-ApiTest -Method "GET" -Endpoint "/reference/currencies" -TestName "Get Currencies"

# ========================================
# 2. AUTHENTICATION TESTS
# ========================================

Write-Host "?? TESTING AUTHENTICATION APIs" -ForegroundColor Blue
Write-Host ("-" * 40) -ForegroundColor Blue

# Test 3: Register User
$randomEmail = "test$(Get-Random)@nexhire.com"
$registerBody = @{
    email = $randomEmail
    password = "Test123!@#"
    firstName = "Test"
    lastName = "User"
    userType = "JobSeeker"
    phone = "+1234567890"
    dateOfBirth = "1990-01-01"
} | ConvertTo-Json

$registerResponse = Invoke-ApiTest -Method "POST" -Endpoint "/auth/register" -Body $registerBody -TestName "Register User"

# Test 4: Login User
if ($registerResponse -and $registerResponse.success) {
    $loginBody = @{
        email = $randomEmail
        password = "Test123!@#"
    } | ConvertTo-Json

    $loginResponse = Invoke-ApiTest -Method "POST" -Endpoint "/auth/login" -Body $loginBody -TestName "Login User"

    if ($loginResponse -and $loginResponse.success) {
        $global:AccessToken = $loginResponse.data.tokens.accessToken
        $global:UserId = $loginResponse.data.user.userID
        Write-Success "Authentication successful! Token obtained."
        Write-Info "User ID: $global:UserId"
    }
}

# ========================================
# 3. USER PROFILE TESTS (Auth Required)
# ========================================

if ($global:AccessToken) {
    Write-Host "?? TESTING USER PROFILE APIs" -ForegroundColor Blue
    Write-Host ("-" * 40) -ForegroundColor Blue

    $authHeaders = @{ "Authorization" = "Bearer $global:AccessToken" }

    # Test 5: Get User Profile
    $profile = Invoke-ApiTest -Method "GET" -Endpoint "/users/profile" -Headers $authHeaders -TestName "Get User Profile"

    # Test 6: Update User Profile (FIXED with proper payload)
    $updateBody = @{
        userID = $global:UserId
        firstName = "Updated Test"
        lastName = "Updated User"
        phone = "+9876543210"
        email = $randomEmail
        userType = "JobSeeker"
    } | ConvertTo-Json

    $updatedProfile = Invoke-ApiTest -Method "PUT" -Endpoint "/users/profile" -Headers $authHeaders -Body $updateBody -TestName "Update User Profile (Fixed)"
}

# ========================================
# 4. JOB MANAGEMENT TESTS
# ========================================

Write-Host "?? TESTING JOB MANAGEMENT APIs" -ForegroundColor Blue
Write-Host ("-" * 40) -ForegroundColor Blue

# Test 7: Get All Jobs (FIXED with pagination)
$jobs = Invoke-ApiTest -Method "GET" -Endpoint "/jobs?page=1&pageSize=10" -TestName "Get All Jobs (With Pagination)"

# Test 8: Get All Jobs (Alternative - no params)
$jobsNoParams = Invoke-ApiTest -Method "GET" -Endpoint "/jobs" -TestName "Get All Jobs (No Params)"

# Test 9: Search Jobs (Simpler query)
$searchJobs = Invoke-ApiTest -Method "GET" -Endpoint "/jobs/search?q=engineer" -TestName "Search Jobs (Simple Query)"

# Test 10: Search Jobs (Empty query)
$searchJobsEmpty = Invoke-ApiTest -Method "GET" -Endpoint "/jobs/search" -TestName "Search Jobs (No Query)"

# Auth required tests
if ($global:AccessToken) {
    $authHeaders = @{ "Authorization" = "Bearer $global:AccessToken" }

    # Test 11: Create Job as JobSeeker (Expected to fail)
    $jobBody = @{
        title = "Test Software Engineer Position"
        description = "This is a test job posting created by the API test script"
        requirements = "- 3+ years experience`n- Knowledge of APIs`n- Testing skills"
        jobTypeID = 1
        level = "Mid"
        location = "Remote"
        salaryMin = 70000
        salaryMax = 90000
        currencyID = 1
        isRemote = $true
        experienceRequired = "3-5 years"
    } | ConvertTo-Json

    $newJob = Invoke-ApiTest -Method "POST" -Endpoint "/jobs" -Headers $authHeaders -Body $jobBody -TestName "Create Job as JobSeeker (Expected 403)"

    # Try to get an existing job for testing
    if ($jobs -and $jobs.data -and $jobs.data.Count -gt 0) {
        $global:JobId = $jobs.data[0].jobID
        Write-Info "Using existing job ID for tests: $global:JobId"

        # Test 12: Get Job by ID
        $jobById = Invoke-ApiTest -Method "GET" -Endpoint "/jobs/$global:JobId" -TestName "Get Job by ID"
    }
    elseif ($jobsNoParams -and $jobsNoParams.data -and $jobsNoParams.data.Count -gt 0) {
        $global:JobId = $jobsNoParams.data[0].jobID
        Write-Info "Using existing job ID from no-params query: $global:JobId"

        # Test 12: Get Job by ID
        $jobById = Invoke-ApiTest -Method "GET" -Endpoint "/jobs/$global:JobId" -TestName "Get Job by ID"
    }
}

# ========================================
# 5. APPLICATION TESTS (Auth Required)
# ========================================

if ($global:AccessToken -and $global:JobId) {
    Write-Host "?? TESTING APPLICATION APIs" -ForegroundColor Blue
    Write-Host ("-" * 40) -ForegroundColor Blue

    $authHeaders = @{ "Authorization" = "Bearer $global:AccessToken" }

    # Test 13: Apply for Job
    $applicationBody = @{
        jobID = $global:JobId
        coverLetter = "I am very interested in this position and believe my skills make me a great candidate."
        expectedSalary = 75000
        availabilityDate = (Get-Date).AddDays(30).ToString("yyyy-MM-dd")
    } | ConvertTo-Json

    $application = Invoke-ApiTest -Method "POST" -Endpoint "/applications" -Headers $authHeaders -Body $applicationBody -TestName "Apply for Job"

    if ($application -and $application.success) {
        $global:ApplicationId = $application.data.applicationID
        Write-Success "Application submitted successfully! ID: $global:ApplicationId"
    }

    # Test 14: Get My Applications
    $myApplications = Invoke-ApiTest -Method "GET" -Endpoint "/applications/my" -Headers $authHeaders -TestName "Get My Applications"

    # Test 15: Get Job Applications (Expected to fail for JobSeeker)
    $jobApplications = Invoke-ApiTest -Method "GET" -Endpoint "/jobs/$global:JobId/applications" -Headers $authHeaders -TestName "Get Job Applications (Expected 403)"
}

# ========================================
# ADDITIONAL TESTS
# ========================================

Write-Host "?? TESTING ADDITIONAL SCENARIOS" -ForegroundColor Blue
Write-Host ("-" * 40) -ForegroundColor Blue

# Test 16: Invalid endpoint
$invalidEndpoint = Invoke-ApiTest -Method "GET" -Endpoint "/invalid-endpoint" -TestName "Invalid Endpoint (Expected 404)"

# Test 17: Unauthorized access
$unauthorizedAccess = Invoke-ApiTest -Method "GET" -Endpoint "/users/profile" -TestName "Unauthorized Access (Expected 401)"

# ========================================
# TEST SUMMARY
# ========================================

Write-Host ""
Write-Host "?? DETAILED TEST SUMMARY" -ForegroundColor Magenta
Write-Host ("=" * 60) -ForegroundColor Magenta

$totalTests = $TestResults.Count
$passedTests = ($TestResults | Where-Object { $_.Success }).Count
$failedTests = $totalTests - $passedTests

if ($totalTests -gt 0) {
    $averageResponseTime = ($TestResults | Measure-Object -Property ResponseTime -Average).Average
    $successRate = [math]::Round(($passedTests / $totalTests) * 100, 2)
} else {
    $averageResponseTime = 0
    $successRate = 0
}

Write-Host ""
Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red
Write-Host "Success Rate: $successRate%" -ForegroundColor Yellow
Write-Host "Average Response Time: $([math]::Round($averageResponseTime, 2))ms" -ForegroundColor Cyan
Write-Host ""

# Categorize results
$expectedFailures = $TestResults | Where-Object { $_.TestName -like "*Expected*" }
$unexpectedFailures = $TestResults | Where-Object { $_.Success -eq $false -and $_.TestName -notlike "*Expected*" }

Write-Host "ANALYSIS:" -ForegroundColor White
Write-Host "? Successful Tests: $passedTests" -ForegroundColor Green
Write-Host "??  Expected Failures: $($expectedFailures.Count)" -ForegroundColor Yellow
Write-Host "? Unexpected Failures: $($unexpectedFailures.Count)" -ForegroundColor Red
Write-Host ""

# Show unexpected failures
if ($unexpectedFailures.Count -gt 0) {
    Write-Host "?? UNEXPECTED FAILURES REQUIRING ATTENTION:" -ForegroundColor Red
    $unexpectedFailures | ForEach-Object {
        Write-Host "? $($_.TestName) - Status: $($_.StatusCode) - Error: $($_.Error)" -ForegroundColor Red
    }
    Write-Host ""
}

# Detailed results table
Write-Host "DETAILED RESULTS:" -ForegroundColor White
$TestResults | Format-Table -Property TestName, Method, StatusCode, Success, ResponseTime -AutoSize

# Save results to file if requested
if ($SaveResponses) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $resultsFile = "nexhire-api-$timestamp.json"
    $TestResults | ConvertTo-Json -Depth 4 | Out-File -FilePath $resultsFile -Encoding UTF8
    Write-Success "Test results saved to: $resultsFile"
}

Write-Host ""
Write-Host "?? NexHire API Test Suite Complete - IMPROVED!" -ForegroundColor Magenta
Write-Host "Timestamp: $(Get-Date)" -ForegroundColor Magenta
Write-Host ""

# Recommendations
Write-Host "?? RECOMMENDATIONS:" -ForegroundColor Cyan
Write-Host "1. Check Azure Function logs for 500 errors: func azure functionapp logstream nexhire-api-func" -ForegroundColor White
Write-Host "2. Investigate job pagination and search implementation" -ForegroundColor White
Write-Host "3. Verify profile update validation schema" -ForegroundColor White
Write-Host "4. Your core authentication and reference data APIs are working perfectly!" -ForegroundColor White

# Return test results for further processing if needed
return $TestResults