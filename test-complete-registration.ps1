# NexHire Applicants Table Data Verification Script
# Tests complete registration flow and verifies all data is saved to Applicants table

param(
    [string]$BaseUrl = "https://nexhire-api-func.azurewebsites.net/api",
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host "=== COMPREHENSIVE APPLICANTS TABLE DATA TEST ===" -ForegroundColor Green

# Install required modules
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

# Test Data - Complete Registration Flow
$testEmail = "test.complete.$(Get-Date -Format 'yyyyMMddHHmmss')@nexhire.test"
$testPassword = "TestPassword123!"

Write-Host "Test Email: $testEmail" -ForegroundColor Cyan

# Step 1: Register User
Write-Host "`n?? STEP 1: Register Job Seeker User" -ForegroundColor Yellow

$registrationData = @{
    email = $testEmail
    password = $testPassword
    firstName = "Complete"
    lastName = "TestUser"
    userType = "JobSeeker"
    phone = "+1234567890"
    dateOfBirth = "1995-01-15T00:00:00.000Z"
    gender = "Male"
} | ConvertTo-Json

Write-Host "Registration Payload:" -ForegroundColor Cyan
Write-Host $registrationData -ForegroundColor Gray

try {
    $registrationResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/register" -Method POST -Body $registrationData -ContentType "application/json"
    Write-Host "? Registration successful" -ForegroundColor Green
    Write-Host ($registrationResponse | ConvertTo-Json -Depth 2) -ForegroundColor Gray
} catch {
    Write-Host "? Registration Failed:" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

# Step 2: Login
Write-Host "`n?? STEP 2: Login and Get Access Token" -ForegroundColor Yellow

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

# Step 3: Check Initial Applicants Table State
Write-Host "`n?? STEP 3: Check Initial Applicants Table State" -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

try {
    # Get all columns from Applicants table for this user
    $initialQuery = @"
SELECT 
    ApplicantID, UserID, Nationality, CurrentLocation, PreferredLocations, LinkedInProfile, 
    PrimaryResumeURL, AdditionalDocuments, GithubProfile, HighestEducation, FieldOfStudy, 
    Institution, Headline, Summary, CurrentJobTitle, CurrentCompany, CurrentSalary, 
    CurrentSalaryUnit, CurrentCurrencyID, YearsOfExperience, NoticePeriod, TotalWorkExperience,
    PreferredJobTypes, PreferredWorkTypes, ExpectedSalaryMin, ExpectedSalaryMax, 
    ExpectedSalaryUnit, ImmediatelyAvailable, WillingToRelocate, PreferredRoles,
    PrimarySkills, SecondarySkills, Languages, Certifications, WorkExperience,
    AllowRecruitersToContact, HideCurrentCompany, HideSalaryDetails, ProfileCompleteness,
    IsOpenToWork, IsFeatured, FeaturedUntil, JobSearchStatus, PreferredIndustries,
    PreferredMinimumSalary, LastJobAppliedAt, SearchScore, Tags
FROM Applicants 
WHERE UserID = '$userId'
"@

    $initialResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $initialQuery
    
    if ($initialResult) {
        Write-Host "? Initial Applicant Record Found:" -ForegroundColor Green
        $initialNullCount = 0
        $initialPopulatedCount = 0
        
        foreach ($property in $initialResult.PSObject.Properties) {
            if ($property.Value -eq $null -or $property.Value -eq '' -or $property.Value -eq 0) {
                $initialNullCount++
                Write-Host "  ? $($property.Name): NULL/Empty" -ForegroundColor Red
            } else {
                $initialPopulatedCount++
                Write-Host "  ? $($property.Name): $($property.Value)" -ForegroundColor Green
            }
        }
        
        Write-Host "Initial State - Populated: $initialPopulatedCount, NULL/Empty: $initialNullCount" -ForegroundColor Cyan
    } else {
        Write-Host "? No applicant record found!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "? Database check failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Step 4: Update Education Data (Test Complete Education Structure)
Write-Host "`n?? STEP 4: Update Education Data with Complete Structure" -ForegroundColor Yellow

$educationData = @{
    college = @{
        id = 1
        name = "Indian Institute of Technology Delhi"
        type = "University"
        country = "India"
        state = "Delhi"
        city = "New Delhi"
        website = "https://www.iitd.ac.in"
        establishedYear = 1961
    }
    customCollege = ""
    degreeType = "Bachelor's Degree in Computer Science"
    fieldOfStudy = "Computer Science and Engineering"
    yearInCollege = "Recently Graduated (0-1 year)"
    selectedCountry = "India"
} | ConvertTo-Json -Depth 4

Write-Host "Complete Education Payload:" -ForegroundColor Cyan
Write-Host $educationData -ForegroundColor Gray

try {
    $educationResponse = Invoke-RestMethod -Uri "$BaseUrl/users/education" -Method PUT -Body $educationData -Headers $headers
    Write-Host "? Education update successful" -ForegroundColor Green
    Write-Host ($educationResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
} catch {
    Write-Host "? Education Update Failed:" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# Step 5: Update Work Experience via Applicant Profile
Write-Host "`n?? STEP 5: Update Work Experience via Applicant Profile" -ForegroundColor Yellow

$workExperienceData = @{
    currentJobTitle = "Senior Software Engineer"
    currentCompany = "Tech Innovation Corp"
    yearsOfExperience = 5
    headline = "Experienced Full-Stack Developer"
    summary = "Senior software engineer with 5+ years of experience in web development, specializing in React, Node.js, and cloud technologies. Proven track record of delivering scalable applications."
    primarySkills = "JavaScript, React, Node.js, Python, AWS, Docker, Kubernetes"
    secondarySkills = "GraphQL, TypeScript, MongoDB, PostgreSQL, Redis, Microservices"
    preferredJobTypes = "Full-time, Contract"
    preferredWorkTypes = "Remote, Hybrid"
    currentLocation = "Bangalore, India"
    preferredLocations = "Bangalore, Mumbai, Remote"
    nationality = "Indian"
    expectedSalaryMin = 1500000
    expectedSalaryMax = 2000000
    currentSalary = 1800000
    noticePeriod = 30
    willingToRelocate = true
    immediatelyAvailable = false
    linkedInProfile = "https://linkedin.com/in/test-user"
    githubProfile = "https://github.com/test-user"
    languages = "English (Fluent), Hindi (Native)"
    certifications = "AWS Certified Developer, React Certified"
} | ConvertTo-Json -Depth 3

Write-Host "Complete Work Experience Payload:" -ForegroundColor Cyan
Write-Host $workExperienceData -ForegroundColor Gray

try {
    $workResponse = Invoke-RestMethod -Uri "$BaseUrl/applicants/$userId/profile" -Method PUT -Body $workExperienceData -Headers $headers
    Write-Host "? Work experience update successful" -ForegroundColor Green
    Write-Host ($workResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
} catch {
    Write-Host "? Work Experience Update Failed:" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# Step 6: Check Final Applicants Table State
Write-Host "`n?? STEP 6: Check Final Applicants Table State" -ForegroundColor Yellow

try {
    $finalResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $initialQuery
    
    if ($finalResult) {
        Write-Host "? Final Applicant Record:" -ForegroundColor Green
        $finalNullCount = 0
        $finalPopulatedCount = 0
        $changedFields = @()
        
        foreach ($property in $finalResult.PSObject.Properties) {
            $fieldName = $property.Name
            $finalValue = $property.Value
            $initialValue = $initialResult.$fieldName
            
            if ($finalValue -eq $null -or $finalValue -eq '' -or $finalValue -eq 0) {
                $finalNullCount++
                Write-Host "  ? $fieldName: NULL/Empty" -ForegroundColor Red
            } else {
                $finalPopulatedCount++
                if ($initialValue -ne $finalValue) {
                    $changedFields += $fieldName
                    Write-Host "  ?? $fieldName: $finalValue (CHANGED)" -ForegroundColor Yellow
                } else {
                    Write-Host "  ? $fieldName: $finalValue" -ForegroundColor Green
                }
            }
        }
        
        Write-Host "`n?? Final State Summary:" -ForegroundColor Cyan
        Write-Host "  ?? Total Fields: $($finalResult.PSObject.Properties.Count)" -ForegroundColor Cyan
        Write-Host "  ? Populated Fields: $finalPopulatedCount (was $initialPopulatedCount)" -ForegroundColor Green
        Write-Host "  ? NULL/Empty Fields: $finalNullCount (was $initialNullCount)" -ForegroundColor Red
        Write-Host "  ?? Changed Fields: $($changedFields.Count)" -ForegroundColor Yellow
        Write-Host "  ?? Completion: $([math]::Round(($finalPopulatedCount / $finalResult.PSObject.Properties.Count) * 100, 1))%" -ForegroundColor Cyan
        
        if ($changedFields.Count -gt 0) {
            Write-Host "`n?? Fields that changed:" -ForegroundColor Yellow
            foreach ($field in $changedFields) {
                Write-Host "  - $field" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "? No final applicant record found!" -ForegroundColor Red
    }
} catch {
    Write-Host "? Final database check failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Step 7: Verify Specific Critical Fields
Write-Host "`n?? STEP 7: Verify Critical Field Population" -ForegroundColor Yellow

$criticalFields = @{
    "HighestEducation" = "Bachelor's Degree in Computer Science"
    "FieldOfStudy" = "Computer Science and Engineering" 
    "Institution" = "Indian Institute of Technology Delhi"
    "CurrentJobTitle" = "Senior Software Engineer"
    "CurrentCompany" = "Tech Innovation Corp"
    "YearsOfExperience" = 5
    "PrimarySkills" = "JavaScript"
    "SecondarySkills" = "GraphQL"
    "Summary" = "Senior software engineer"
    "CurrentLocation" = "Bangalore"
    "Nationality" = "Indian"
    "LinkedInProfile" = "linkedin.com"
    "GithubProfile" = "github.com"
}

if ($finalResult) {
    Write-Host "Critical Field Verification:" -ForegroundColor Cyan
    $passedTests = 0
    $totalTests = $criticalFields.Count
    
    foreach ($field in $criticalFields.Keys) {
        $expected = $criticalFields[$field]
        $actual = $finalResult.$field
        
        if ($actual -and $actual.ToString().Contains($expected.ToString())) {
            Write-Host "  ? $field: PASS - Contains '$expected'" -ForegroundColor Green
            $passedTests++
        } else {
            Write-Host "  ? $field: FAIL - Expected '$expected', Got '$actual'" -ForegroundColor Red
        }
    }
    
    $successRate = [math]::Round(($passedTests / $totalTests) * 100, 1)
    Write-Host "`n?? Test Results: $passedTests/$totalTests passed ($successRate%)" -ForegroundColor Cyan
    
    if ($successRate -ge 80) {
        Write-Host "EXCELLENT - Most critical fields are populated!" -ForegroundColor Green
    } elseif ($successRate -ge 60) {
        Write-Host "GOOD - Some critical fields need attention" -ForegroundColor Yellow
    } else {
        Write-Host "? POOR - Many critical fields are missing" -ForegroundColor Red
    }
}

# Step 8: Raw SQL Verification Query
Write-Host "`n?? STEP 8: Raw SQL Verification" -ForegroundColor Yellow

$verificationQuery = @"
-- Complete verification query
SELECT 
    'Users Table' as TableName,
    u.UserID,
    u.Email,
    u.FirstName + ' ' + u.LastName as FullName,
    u.UserType,
    u.Phone,
    u.Gender,
    u.DateOfBirth
FROM Users u 
WHERE u.UserID = '$userId'

UNION ALL

SELECT 
    'Applicants Table' as TableName,
    a.UserID,
    ISNULL(a.HighestEducation, 'NULL') as Education,
    ISNULL(a.FieldOfStudy, 'NULL') as Field,
    ISNULL(a.CurrentJobTitle, 'NULL') as JobTitle,
    ISNULL(a.CurrentCompany, 'NULL') as Company,
    ISNULL(CAST(a.YearsOfExperience as varchar), 'NULL') as Experience,
    CAST(a.ProfileCompleteness as varchar) + '%' as Completeness
FROM Applicants a 
WHERE a.UserID = '$userId'
"@

try {
    $verificationResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $verificationQuery
    Write-Host "SQL Verification Results:" -ForegroundColor Green
    $verificationResult | Format-Table -AutoSize
} catch {
    Write-Host "? SQL verification failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "`n?? === COMPREHENSIVE TEST COMPLETED ===" -ForegroundColor Green
Write-Host "Test User: $testEmail" -ForegroundColor Cyan
Write-Host "User ID: $userId" -ForegroundColor Cyan
Write-Host "Frontend URL: https://jolly-sea-00174141e.1.azurestaticapps.net" -ForegroundColor Cyan
Write-Host "`n?? Next: Test the frontend registration with this same data structure" -ForegroundColor Yellow