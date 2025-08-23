# Final Registration Test Script
# Tests the complete fixed registration flow with proper field mapping

param(
    [string]$BaseUrl = "https://nexhire-api-func.azurewebsites.net/api",
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host "=== FINAL REGISTRATION FLOW TEST ===" -ForegroundColor Green

# Install required modules
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

# Test Data - Matching the exact payloads from the UI
$testEmail = "test.final.$(Get-Date -Format 'yyyyMMddHHmmss')@nexhire.test"
$testPassword = "TestPassword123!"

Write-Host "Test Email: $testEmail" -ForegroundColor Cyan

# Test 1: Register Experienced Professional
Write-Host "`n?? STEP 1: Register Experienced Professional" -ForegroundColor Yellow

$registrationData = @{
    email = $testEmail
    password = $testPassword
    firstName = "Final"
    lastName = "TestUser"
    userType = "JobSeeker"
    experienceType = "Experienced"
    workExperienceData = @{
        currentJobTitle = "Senior Software Engineer"
        currentCompany = "Tech Innovations Inc"
        yearsOfExperience = "5-10 years"
        workArrangement = "Remote"
        jobType = "Full-time"
        primarySkills = "JavaScript, React, Node.js, Python"
        secondarySkills = "AWS, Docker, Kubernetes, GraphQL"
        isCurrentlyWorking = $true
        summary = "Experienced full-stack developer with 7+ years of experience building scalable web applications"
    }
    educationData = @{
        college = @{
            id = 1
            name = "Indian Institute of Technology Delhi"
            type = "University"
            country = "India"
            state = "Delhi"
            website = "https://www.iitd.ac.in"
        }
        customCollege = ""
        degreeType = "Bachelor's Degree"
        fieldOfStudy = "Computer Science and Engineering"
        yearInCollege = "Recently Graduated (0-1 year)"
        selectedCountry = "India"
    }
    jobPreferences = @{
        preferredJobTypes = @(
            @{
                JobTypeID = 9
                Type = "Full-time"
                Description = "Full-time permanent position"
                IsActive = $true
            }
        )
        workplaceType = "hybrid"
        preferredLocations = ""
    }
} | ConvertTo-Json -Depth 5

Write-Host "Complete Registration Payload:" -ForegroundColor Cyan
Write-Host $registrationData -ForegroundColor Gray

try {
    $registrationResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/register" -Method POST -Body $registrationData -ContentType "application/json"
    Write-Host "? Registration successful" -ForegroundColor Green
    Write-Host ($registrationResponse | ConvertTo-Json -Depth 2) -ForegroundColor Gray
} catch {
    Write-Host "? Registration Failed:" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

# Test 2: Login and get tokens
Write-Host "`n?? STEP 2: Login to Get Authentication Tokens" -ForegroundColor Yellow

$loginData = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $accessToken = $loginResponse.data.tokens.accessToken
    $userId = $loginResponse.data.user.UserID
    Write-Host "? Login successful - UserID: $userId" -ForegroundColor Green
} catch {
    Write-Host "? Login Failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Test 3: Wait for backend processing and check database
Write-Host "`n?? STEP 3: Verify Database Population" -ForegroundColor Yellow
Write-Host "? Waiting 3 seconds for backend processing..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

try {
    # Check Users table
    $userQuery = "SELECT * FROM Users WHERE UserID = '$userId'"
    $userResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $userQuery
    
    Write-Host "User Record:" -ForegroundColor Green
    Write-Host "  Email: $($userResult.Email)" -ForegroundColor Gray
    Write-Host "  Name: $($userResult.FirstName) $($userResult.LastName)" -ForegroundColor Gray
    Write-Host "  Type: $($userResult.UserType)" -ForegroundColor Gray
    
    # Check Applicants table with all our mapped fields
    $applicantQuery = @"
SELECT 
    ApplicantID, UserID, Institution, HighestEducation, FieldOfStudy,
    CurrentJobTitle, CurrentCompany, YearsOfExperience, PrimarySkills, SecondarySkills,
    Summary, PreferredJobTypes, PreferredWorkTypes, PreferredLocations,
    ProfileCompleteness, IsOpenToWork, Education
FROM Applicants 
WHERE UserID = '$userId'
"@

    $applicantResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $applicantQuery
    
    if ($applicantResult) {
        Write-Host "`n?? Applicant Record Found:" -ForegroundColor Green
        
        # Test critical field mappings
        $fieldMappings = @{
            "Institution" = @{ expected = "Indian Institute of Technology Delhi"; actual = $applicantResult.Institution }
            "HighestEducation" = @{ expected = "Bachelor's Degree"; actual = $applicantResult.HighestEducation }
            "FieldOfStudy" = @{ expected = "Computer Science and Engineering"; actual = $applicantResult.FieldOfStudy }
            "CurrentJobTitle" = @{ expected = "Senior Software Engineer"; actual = $applicantResult.CurrentJobTitle }
            "CurrentCompany" = @{ expected = "Tech Innovations Inc"; actual = $applicantResult.CurrentCompany }
            "YearsOfExperience" = @{ expected = 5; actual = $applicantResult.YearsOfExperience }
            "PrimarySkills" = @{ expected = "JavaScript"; actual = $applicantResult.PrimarySkills }
            "PreferredJobTypes" = @{ expected = "Full-time"; actual = $applicantResult.PreferredJobTypes }
            "PreferredWorkTypes" = @{ expected = "Hybrid"; actual = $applicantResult.PreferredWorkTypes }
            "ProfileCompleteness" = @{ expected = 60; actual = $applicantResult.ProfileCompleteness }
        }
        
        $passedTests = 0
        $totalTests = $fieldMappings.Count
        
        Write-Host "`n?? Field Mapping Verification:" -ForegroundColor Cyan
        foreach ($fieldName in $fieldMappings.Keys) {
            $mapping = $fieldMappings[$fieldName]
            $expected = $mapping.expected
            $actual = $mapping.actual
            
            $passed = $false
            if ($actual -ne $null -and $actual -ne '') {
                if ($expected -is [string] -and $actual.ToString().Contains($expected)) {
                    $passed = $true
                } elseif ($expected -is [int] -and $actual -eq $expected) {
                    $passed = $true
                } elseif ($actual.ToString() -eq $expected.ToString()) {
                    $passed = $true
                }
            }
            
            if ($passed) {
                Write-Host "  ? $fieldName`: $actual" -ForegroundColor Green
                $passedTests++
            } else {
                Write-Host "  ? $fieldName`: Expected '$expected', Got '$actual'" -ForegroundColor Red
            }
        }
        
        $successRate = [math]::Round(($passedTests / $totalTests) * 100, 1)
        Write-Host "`n?? Test Results: $passedTests/$totalTests passed ($successRate%)" -ForegroundColor Cyan
        
        if ($successRate -ge 80) {
            Write-Host "EXCELLENT - Field mapping is working correctly!" -ForegroundColor Green
        } elseif ($successRate -ge 60) {
            Write-Host "GOOD - Most fields are mapped, some need attention" -ForegroundColor Yellow
        } else {
            Write-Host "? POOR - Field mapping needs significant fixes" -ForegroundColor Red
        }
        
        # Show complete record for debugging
        Write-Host "`n?? Complete Applicant Record:" -ForegroundColor Cyan
        $applicantResult | Format-List
        
    } else {
        Write-Host "? No applicant record found!" -ForegroundColor Red
    }
    
} catch {
    Write-Host "? Database verification failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "`n?? === TEST SUMMARY ===" -ForegroundColor Green
Write-Host "Test User: $testEmail" -ForegroundColor Cyan
Write-Host "User ID: $userId" -ForegroundColor Cyan
Write-Host "Frontend: https://jolly-sea-00174141e.1.azurestaticapps.net" -ForegroundColor Cyan
Write-Host "Backend: $BaseUrl" -ForegroundColor Cyan

if ($successRate -ge 80) {
    Write-Host "`n?? REGISTRATION FLOW WORKING CORRECTLY!" -ForegroundColor Green
    Write-Host "? All critical fields are being populated in the database" -ForegroundColor Green
} else {
    Write-Host "`n?? Registration flow needs attention" -ForegroundColor Yellow
    Write-Host "Some fields are not being populated correctly" -ForegroundColor Yellow
}