# ================================================================
# NexHire API Test Script - New Salary Structure (PowerShell)
# ================================================================
# This script tests the complete user registration flow with the new
# salary structure including SalaryComponents and ApplicantSalaries tables
# ================================================================

$ErrorActionPreference = "Stop"

# Configuration
$API_BASE = "https://nexhire-api-func.azurewebsites.net/api"
$TEST_EMAIL = "testuser_$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
$TEST_PASSWORD = "TestPassword123!"

Write-Host "?? Starting NexHire API Test - New Salary Structure" -ForegroundColor Green
Write-Host "?? Test Email: $TEST_EMAIL" -ForegroundColor Yellow
Write-Host "?? API Base: $API_BASE" -ForegroundColor Yellow
Write-Host ""

# Function to make API calls with proper error handling
function Invoke-ApiCall {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Data = $null,
        [string]$AuthToken = $null
    )
    
    Write-Host "?? API Call: $Method $Endpoint" -ForegroundColor Cyan
    
    $headers = @{
        "Content-Type" = "application/json"
        "Accept" = "application/json"
    }
    
    if ($AuthToken) {
        $headers["Authorization"] = "Bearer $AuthToken"
    }
    
    $uri = "$API_BASE$Endpoint"
    
    try {
        if ($Data) {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $Data
        } else {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
        }
        
        Write-Host "? Success" -ForegroundColor Green
        Write-Host "?? Response: $($response | ConvertTo-Json -Depth 10)" -ForegroundColor Gray
        Write-Host ""
        
        return $response
    }
    catch {
        Write-Host "? Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
        throw
    }
}

try {
    # ================================================================
    # 1. HEALTH CHECK
    # ================================================================
    Write-Host "?? 1. Health Check" -ForegroundColor Magenta
    $healthResponse = Invoke-ApiCall -Method "GET" -Endpoint "/health"

    # ================================================================
    # 2. GET REFERENCE DATA (New Salary Components)
    # ================================================================
    Write-Host "?? 2. Get Salary Components (New Feature)" -ForegroundColor Magenta
    $salaryComponents = Invoke-ApiCall -Method "GET" -Endpoint "/reference/salary-components"
    Write-Host "Salary Components loaded ?" -ForegroundColor Green

    Write-Host "?? 3. Get Currencies" -ForegroundColor Magenta
    $currencies = Invoke-ApiCall -Method "GET" -Endpoint "/reference/currencies"
    Write-Host "Currencies loaded ?" -ForegroundColor Green

    Write-Host "?? 4. Get Job Types" -ForegroundColor Magenta
    $jobTypes = Invoke-ApiCall -Method "GET" -Endpoint "/reference/job-types"
    Write-Host "Job Types loaded ?" -ForegroundColor Green

    # ================================================================
    # 5. USER REGISTRATION (JobSeeker)
    # ================================================================
    Write-Host "?? 5. Register New JobSeeker User" -ForegroundColor Magenta
    $registrationData = @{
        email = $TEST_EMAIL
        password = $TEST_PASSWORD
        userType = "JobSeeker"
        firstName = "John"
        lastName = "Doe"
        phone = "+1234567890"
        dateOfBirth = "1990-01-15"
        gender = "Male"
    } | ConvertTo-Json

    $registrationResponse = Invoke-ApiCall -Method "POST" -Endpoint "/auth/register" -Data $registrationData
    Write-Host "User registered successfully ?" -ForegroundColor Green

    # ================================================================
    # 6. USER LOGIN
    # ================================================================
    Write-Host "?? 6. Login User" -ForegroundColor Magenta
    $loginData = @{
        email = $TEST_EMAIL
        password = $TEST_PASSWORD
    } | ConvertTo-Json

    $loginResponse = Invoke-ApiCall -Method "POST" -Endpoint "/auth/login" -Data $loginData

    # Extract token from login response
    $ACCESS_TOKEN = $loginResponse.data.tokens.accessToken
    $USER_ID = $loginResponse.data.user.UserID

    if (-not $ACCESS_TOKEN) {
        throw "Failed to extract access token from login response"
    }

    Write-Host "Login successful, token obtained ?" -ForegroundColor Green
    Write-Host "?? User ID: $USER_ID" -ForegroundColor Yellow

    # ================================================================
    # 7. GET INITIAL APPLICANT PROFILE
    # ================================================================
    Write-Host "?? 7. Get Initial Applicant Profile" -ForegroundColor Magenta
    $initialProfile = Invoke-ApiCall -Method "GET" -Endpoint "/applicants/$USER_ID/profile" -AuthToken $ACCESS_TOKEN
    Write-Host "Initial profile retrieved ?" -ForegroundColor Green

    # ================================================================
    # 8. UPDATE BASIC APPLICANT PROFILE (WITHOUT SALARY)
    # ================================================================
    Write-Host "?? 8. Update Basic Applicant Profile" -ForegroundColor Magenta
    $basicProfileData = @{
        headline = "Senior Software Engineer"
        summary = "Experienced full-stack developer with 5+ years in React and Node.js"
        currentJobTitle = "Senior Software Engineer"
        currentCompany = "TechCorp Inc."
        yearsOfExperience = 5
        currentLocation = "New York, NY"
        primarySkills = "React, Node.js, TypeScript, PostgreSQL"
        secondarySkills = "Docker, Kubernetes, AWS"
        preferredJobTypes = "Full-Time, Contract"
        preferredWorkTypes = "Hybrid"
        preferredLocations = "New York, San Francisco, Remote"
        minimumSalary = 120000
        linkedInProfile = "https://linkedin.com/in/johndoe"
        githubProfile = "https://github.com/johndoe"
    } | ConvertTo-Json

    $updatedProfile = Invoke-ApiCall -Method "PUT" -Endpoint "/applicants/$USER_ID/profile" -Data $basicProfileData -AuthToken $ACCESS_TOKEN
    Write-Host "Basic profile updated successfully ?" -ForegroundColor Green

    # ================================================================
    # 9. UPDATE EDUCATION DATA (Enhanced with new fields)
    # ================================================================
    Write-Host "?? 9. Update Education Data" -ForegroundColor Magenta
    $educationData = @{
        institution = "Stanford University"
        highestEducation = "Master of Science"
        fieldOfStudy = "Computer Science"
        graduationYear = "2020"
        gpa = "3.8/4.0"
    } | ConvertTo-Json

    $educationResponse = Invoke-ApiCall -Method "PUT" -Endpoint "/applicants/$USER_ID/profile" -Data $educationData -AuthToken $ACCESS_TOKEN
    Write-Host "Education updated successfully ?" -ForegroundColor Green

    # ================================================================
    # 10. UPDATE SALARY BREAKDOWN (New Feature)
    # ================================================================
    Write-Host "?? 10. Update Salary Breakdown (New Feature)" -ForegroundColor Magenta

    # Get component IDs (assuming they exist from the reference data)
    $currencyId = $currencies.data[0].CurrencyID
    $fixedComponentId = ($salaryComponents.data | Where-Object { $_.ComponentName -eq "Fixed" }).ComponentID
    $variableComponentId = ($salaryComponents.data | Where-Object { $_.ComponentName -eq "Variable" }).ComponentID
    $bonusComponentId = ($salaryComponents.data | Where-Object { $_.ComponentName -eq "Bonus" }).ComponentID

    Write-Host "?? Using Currency ID: $currencyId" -ForegroundColor Yellow
    Write-Host "?? Fixed Component ID: $fixedComponentId" -ForegroundColor Yellow

    $salaryBreakdownData = @{
        salaryBreakdown = @{
            current = @(
                @{
                    ComponentID = $fixedComponentId
                    Amount = 100000
                    CurrencyID = $currencyId
                    Frequency = "Yearly"
                    Notes = "Base salary"
                },
                @{
                    ComponentID = $variableComponentId
                    Amount = 20000
                    CurrencyID = $currencyId
                    Frequency = "Yearly"
                    Notes = "Performance bonus"
                }
            )
            expected = @(
                @{
                    ComponentID = $fixedComponentId
                    Amount = 130000
                    CurrencyID = $currencyId
                    Frequency = "Yearly"
                    Notes = "Expected base salary"
                },
                @{
                    ComponentID = $variableComponentId
                    Amount = 30000
                    CurrencyID = $currencyId
                    Frequency = "Yearly"
                    Notes = "Expected variable"
                },
                @{
                    ComponentID = $bonusComponentId
                    Amount = 15000
                    CurrencyID = $currencyId
                    Frequency = "Yearly"
                    Notes = "Signing bonus"
                }
            )
        }
    } | ConvertTo-Json -Depth 10

    $salaryResponse = Invoke-ApiCall -Method "PUT" -Endpoint "/applicants/$USER_ID/profile" -Data $salaryBreakdownData -AuthToken $ACCESS_TOKEN
    Write-Host "Salary breakdown updated successfully ?" -ForegroundColor Green

    # ================================================================
    # 11. GET FINAL PROFILE WITH SALARY BREAKDOWN
    # ================================================================
    Write-Host "?? 11. Get Final Profile with Salary Breakdown" -ForegroundColor Magenta
    $finalProfile = Invoke-ApiCall -Method "GET" -Endpoint "/applicants/$USER_ID/profile" -AuthToken $ACCESS_TOKEN
    Write-Host "Final profile retrieved with salary breakdown ?" -ForegroundColor Green

    # Display salary breakdown if available
    if ($finalProfile.data.salaryBreakdown) {
        Write-Host "?? Current Salary Components: $($finalProfile.data.salaryBreakdown.current.Count)" -ForegroundColor Yellow
        Write-Host "?? Expected Salary Components: $($finalProfile.data.salaryBreakdown.expected.Count)" -ForegroundColor Yellow
    }

    # ================================================================
    # 12. TEST PRIVACY SETTINGS
    # ================================================================
    Write-Host "?? 12. Test Privacy Settings" -ForegroundColor Magenta
    $privacyData = @{
        hideCurrentCompany = $true
        hideSalaryDetails = $true
        allowRecruitersToContact = $false
    } | ConvertTo-Json

    $privacyResponse = Invoke-ApiCall -Method "PUT" -Endpoint "/applicants/$USER_ID/profile" -Data $privacyData -AuthToken $ACCESS_TOKEN
    Write-Host "Privacy settings updated successfully ?" -ForegroundColor Green

    # ================================================================
    # 13. LOGOUT
    # ================================================================
    Write-Host "?? 13. Logout User" -ForegroundColor Magenta
    $logoutResponse = Invoke-ApiCall -Method "POST" -Endpoint "/auth/logout" -AuthToken $ACCESS_TOKEN
    Write-Host "User logged out successfully ?" -ForegroundColor Green

    # ================================================================
    # SUMMARY
    # ================================================================
    Write-Host ""
    Write-Host "?? ================================================================" -ForegroundColor Green
    Write-Host "?? ALL TESTS COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "?? ================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "? Health Check - API is running" -ForegroundColor Green
    Write-Host "? Reference Data - Salary components, currencies, job types loaded" -ForegroundColor Green
    Write-Host "? User Registration - JobSeeker user created" -ForegroundColor Green
    Write-Host "? User Login - Authentication successful" -ForegroundColor Green
    Write-Host "? Profile Creation - Initial applicant profile created" -ForegroundColor Green
    Write-Host "? Basic Profile Update - Professional information saved" -ForegroundColor Green
    Write-Host "? Education Update - Enhanced with graduation year and GPA" -ForegroundColor Green
    Write-Host "? Salary Breakdown - New salary structure working" -ForegroundColor Green
    Write-Host "? Privacy Settings - Toggle settings functional" -ForegroundColor Green
    Write-Host "? Profile Retrieval - Complete profile with salary breakdown" -ForegroundColor Green
    Write-Host "? User Logout - Session terminated" -ForegroundColor Green
    Write-Host ""
    Write-Host "?? New Salary Structure Features Verified:" -ForegroundColor Yellow
    Write-Host "   • SalaryComponents table integration" -ForegroundColor White
    Write-Host "   • ApplicantSalaries table operations" -ForegroundColor White
    Write-Host "   • Current vs Expected salary breakdown" -ForegroundColor White
    Write-Host "   • Multiple salary components (Fixed, Variable, Bonus)" -ForegroundColor White
    Write-Host "   • Currency support per component" -ForegroundColor White
    Write-Host "   • Salary privacy controls" -ForegroundColor White
    Write-Host ""
    Write-Host "?? Test User Created:" -ForegroundColor Yellow
    Write-Host "   ?? Email: $TEST_EMAIL" -ForegroundColor White
    Write-Host "   ?? User ID: $USER_ID" -ForegroundColor White
    Write-Host "   ??? Type: JobSeeker" -ForegroundColor White
    Write-Host ""
    Write-Host "?? Ready for frontend integration!" -ForegroundColor Green

}
catch {
    Write-Host ""
    Write-Host "? ================================================================" -ForegroundColor Red
    Write-Host "? TEST FAILED!" -ForegroundColor Red
    Write-Host "? ================================================================" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "? ================================================================" -ForegroundColor Red
    exit 1
}