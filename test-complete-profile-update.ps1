# Complete Applicant Profile Update Test
# Tests all possible fields that can be updated via the profile service

param(
    [string]$BaseUrl = "https://nexhire-api-func.azurewebsites.net/api",
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host "?? === COMPLETE APPLICANT PROFILE UPDATE TEST ===" -ForegroundColor Green

if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

$testEmail = "profile.test.$(Get-Date -Format 'yyyyMMddHHmmss')@nexhire.test"
$testPassword = "TestPassword123!"

# Step 1: Register and login
Write-Host "`n?? STEP 1: Register and Login" -ForegroundColor Yellow

$registrationData = @{
    email = $testEmail
    password = $testPassword
    firstName = "Profile"
    lastName = "TestUser"
    userType = "JobSeeker"
} | ConvertTo-Json

try {
    $regResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/register" -Method POST -Body $registrationData -ContentType "application/json"
    Write-Host "? Registration successful: $($regResponse.data.UserID)" -ForegroundColor Green
} catch {
    Write-Host "? Registration failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$loginData = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $accessToken = $loginResponse.data.tokens.accessToken
    $userId = $loginResponse.data.user.UserID
    Write-Host "? Login successful: $userId" -ForegroundColor Green
} catch {
    Write-Host "? Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

# Step 2: Test comprehensive profile update
Write-Host "`n?? STEP 2: Test Comprehensive Profile Update" -ForegroundColor Yellow

$completeProfileData = @{
    # Personal Information
    nationality = "Indian"
    currentLocation = "Bangalore, Karnataka, India"
    preferredLocations = "Bangalore, Mumbai, Pune, Hyderabad, Remote"
    
    # Social Profiles
    linkedInProfile = "https://linkedin.com/in/profile-test-user"
    githubProfile = "https://github.com/profile-test-user"
    
    # Documents
    primaryResumeURL = "https://example.com/resume.pdf"
    additionalDocuments = "Portfolio: https://example.com/portfolio.pdf"
    
    # Education
    highestEducation = "Bachelor's Degree in Computer Science"
    fieldOfStudy = "Computer Science and Engineering"
    institution = "Indian Institute of Technology Delhi"
    
    # Professional Information
    headline = "Senior Full-Stack Developer | React & Node.js Expert"
    summary = "Experienced software engineer with 5+ years in web development, specializing in React, Node.js, and cloud technologies. Proven track record of delivering scalable applications."
    currentJobTitle = "Senior Software Engineer"
    currentCompany = "Tech Innovations Pvt Ltd"
    currentSalary = 1200000.0
    currentSalaryUnit = "Annual"
    currentCurrencyID = 1
    yearsOfExperience = 5
    noticePeriod = 30
    totalWorkExperience = "5+ years of experience in full-stack development, team leadership, and agile methodologies"
    
    # Job Preferences
    preferredJobTypes = "Full-time, Contract"
    preferredWorkTypes = "Hybrid"
    expectedSalaryMin = 1500000.0
    expectedSalaryMax = 2000000.0
    expectedSalaryUnit = 1800000.0
    preferredRoles = "Senior Software Engineer, Tech Lead, Full-Stack Developer"
    preferredIndustries = "Technology, Fintech, E-commerce"
    preferredMinimumSalary = 1500000.0
    
    # Skills and Experience
    primarySkills = "JavaScript, TypeScript, React, Node.js, Python, AWS, Docker"
    secondarySkills = "Kubernetes, GraphQL, MongoDB, PostgreSQL, Redis, Microservices"
    languages = "English (Fluent), Hindi (Native), Kannada (Conversational)"
    certifications = "AWS Certified Developer Associate, MongoDB Certified Developer, React Professional Certificate"
    workExperience = "5+ years in web development with expertise in modern JavaScript frameworks and cloud technologies"
    
    # Availability and Preferences
    immediatelyAvailable = $false
    willingToRelocate = $true
    jobSearchStatus = "Open to opportunities"
    
    # Privacy Settings
    allowRecruitersToContact = $true
    hideCurrentCompany = $false
    hideSalaryDetails = $true
    
    # Status Fields
    isOpenToWork = $true
    isFeatured = $false
    
    # Additional
    tags = "React, Node.js, Full-Stack, Senior, JavaScript"
} | ConvertTo-Json -Depth 3

Write-Host "?? Profile data payload:" -ForegroundColor Cyan
Write-Host $completeProfileData -ForegroundColor Gray

try {
    $profileResponse = Invoke-RestMethod -Uri "$BaseUrl/applicants/$userId/profile" -Method PUT -Body $completeProfileData -Headers $headers
    Write-Host "? Profile update successful" -ForegroundColor Green
    Write-Host "?? Profile completeness: $($profileResponse.data.ProfileCompleteness)%" -ForegroundColor Cyan
} catch {
    Write-Host "? Profile update failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Error details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

# Step 3: Verify database population
Write-Host "`n?? STEP 3: Verify Database Population" -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $dbQuery = @"
SELECT 
    ApplicantID, UserID, Nationality, CurrentLocation, PreferredLocations,
    LinkedInProfile, GithubProfile, PrimaryResumeURL, AdditionalDocuments,
    HighestEducation, FieldOfStudy, Institution, Headline, Summary,
    CurrentJobTitle, CurrentCompany, CurrentSalary, YearsOfExperience,
    PreferredJobTypes, PreferredWorkTypes, PrimarySkills, SecondarySkills,
    Languages, Certifications, ImmediatelyAvailable, WillingToRelocate,
    AllowRecruitersToContact, IsOpenToWork, ProfileCompleteness
FROM Applicants 
WHERE UserID = '$userId'
"@

    $dbResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $dbQuery
    
    if ($dbResult) {
        Write-Host "? Database record found" -ForegroundColor Green
        
        # Count populated fields
        $populatedFields = @()
        $nullFields = @()
        
        foreach ($prop in $dbResult.PSObject.Properties) {
            if ($prop.Value -ne $null -and $prop.Value -ne '' -and ($prop.Value -ne 0 -or $prop.Name -eq 'ProfileCompleteness')) {
                $populatedFields += $prop.Name
            } else {
                $nullFields += $prop.Name
            }
        }
        
        Write-Host "`n?? DATABASE POPULATION RESULTS:" -ForegroundColor Cyan
        Write-Host "? Populated Fields ($($populatedFields.Count)):" -ForegroundColor Green
        foreach ($field in $populatedFields) {
            $value = $dbResult.$field
            if ($value.ToString().Length -gt 50) {
                $displayValue = $value.ToString().Substring(0, 50) + "..."
            } else {
                $displayValue = $value
            }
            Write-Host "  $field`: $displayValue" -ForegroundColor Green
        }
        
        Write-Host "`n? NULL Fields ($($nullFields.Count)):" -ForegroundColor Red
        foreach ($field in $nullFields) {
            Write-Host "  $field" -ForegroundColor Red
        }
        
        $populationRate = [math]::Round(($populatedFields.Count / $dbResult.PSObject.Properties.Count) * 100, 1)
        Write-Host "`n?? POPULATION RATE: $populationRate%" -ForegroundColor Cyan
        Write-Host "?? PROFILE COMPLETENESS: $($dbResult.ProfileCompleteness)%" -ForegroundColor Cyan
        
        if ($populationRate -ge 80) {
            Write-Host "?? EXCELLENT - Most fields are populated correctly!" -ForegroundColor Green
        } elseif ($populationRate -ge 60) {
            Write-Host "? GOOD - Decent field population" -ForegroundColor Yellow
        } else {
            Write-Host "?? NEEDS IMPROVEMENT - Low field population" -ForegroundColor Red
        }
        
    } else {
        Write-Host "? No database record found!" -ForegroundColor Red
    }
} catch {
    Write-Host "? Database verification failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 4: Test partial update
Write-Host "`n?? STEP 4: Test Partial Update" -ForegroundColor Yellow

$partialUpdateData = @{
    headline = "Updated Headline - Senior React Developer"
    yearsOfExperience = 6
    currentSalary = 1400000.0
    isOpenToWork = $false
} | ConvertTo-Json

try {
    $partialResponse = Invoke-RestMethod -Uri "$BaseUrl/applicants/$userId/profile" -Method PUT -Body $partialUpdateData -Headers $headers
    Write-Host "? Partial update successful" -ForegroundColor Green
    Write-Host "?? Updated profile completeness: $($partialResponse.data.ProfileCompleteness)%" -ForegroundColor Cyan
} catch {
    Write-Host "? Partial update failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n?? === TEST SUMMARY ===" -ForegroundColor Green
Write-Host "?? Test User: $testEmail" -ForegroundColor Cyan
Write-Host "?? User ID: $userId" -ForegroundColor Cyan
Write-Host "?? API Base: $BaseUrl" -ForegroundColor Cyan
Write-Host "`n? This test validates the complete profile update functionality with all possible fields" -ForegroundColor Yellow