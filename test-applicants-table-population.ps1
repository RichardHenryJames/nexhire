# Complete Applicants Table Population Test
# Tests step-by-step registration and profile updates to verify all fields are populated

param(
    [string]$BaseUrl = "https://nexhire-api-func.azurewebsites.net/api",
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host "?? === COMPLETE APPLICANTS TABLE POPULATION TEST ===" -ForegroundColor Green

# Install required modules
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

$testEmail = "complete.test.$(Get-Date -Format 'yyyyMMddHHmmss')@nexhire.test"
$testPassword = "TestPassword123!"

Write-Host "?? Test Email: $testEmail" -ForegroundColor Cyan

# Step 1: Basic Registration (backend supports this)
Write-Host "`n?? STEP 1: Basic User Registration" -ForegroundColor Yellow

$basicRegistration = @{
    email = $testEmail
    password = $testPassword
    firstName = "Complete"
    lastName = "TestUser"
    userType = "JobSeeker"
    phone = "+1234567890"
    dateOfBirth = "1995-01-15T00:00:00.000Z"
    gender = "Male"
} | ConvertTo-Json

try {
    $regResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/register" -Method POST -Body $basicRegistration -ContentType "application/json"
    Write-Host "? Basic registration successful" -ForegroundColor Green
    Write-Host "User ID: $($regResponse.data.UserID)" -ForegroundColor Cyan
} catch {
    Write-Host "? Registration failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Login to get authentication token
Write-Host "`n?? STEP 2: Login to Get Authentication Token" -ForegroundColor Yellow

$loginData = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $accessToken = $loginResponse.data.tokens.accessToken
    $userId = $loginResponse.data.user.UserID
    Write-Host "? Login successful" -ForegroundColor Green
    Write-Host "User ID: $userId" -ForegroundColor Cyan
    Write-Host "Access Token: $($accessToken.Substring(0, 50))..." -ForegroundColor Cyan
} catch {
    Write-Host "? Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

# Step 3: Check initial Applicants table state
Write-Host "`n?? STEP 3: Check Initial Applicants Table State" -ForegroundColor Yellow

try {
    $initialQuery = @"
SELECT 
    ApplicantID, UserID, Institution, HighestEducation, FieldOfStudy,
    CurrentJobTitle, CurrentCompany, YearsOfExperience, PrimarySkills, SecondarySkills,
    Summary, PreferredJobTypes, PreferredWorkTypes, PreferredLocations, Nationality,
    CurrentLocation, LinkedInProfile, GithubProfile, Languages, Certifications,
    ProfileCompleteness, IsOpenToWork, ImmediatelyAvailable, WillingToRelocate
FROM Applicants 
WHERE UserID = '$userId'
"@

    $initialResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $initialQuery
    
    if ($initialResult) {
        Write-Host "? Initial applicant record found" -ForegroundColor Green
        Write-Host "Initial Profile Completeness: $($initialResult.ProfileCompleteness)%" -ForegroundColor Cyan
        
        $initialNullCount = 0
        foreach ($prop in $initialResult.PSObject.Properties) {
            if ($prop.Value -eq $null -or $prop.Value -eq '' -or ($prop.Value -eq 0 -and $prop.Name -ne 'ProfileCompleteness')) {
                $initialNullCount++
            }
        }
        Write-Host "Initial NULL fields: $initialNullCount" -ForegroundColor Red
    } else {
        Write-Host "? No initial applicant record found!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "? Database check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 4: Update Education Data
Write-Host "`n?? STEP 4: Update Education Data" -ForegroundColor Yellow

$educationData = @{
    college = @{
        id = 1
        name = "Indian Institute of Technology Delhi"
        type = "University"
        country = "India"
        state = "Delhi"
        website = "https://www.iitd.ac.in"
    }
    customCollege = ""
    degreeType = "Bachelor's Degree in Computer Science"
    fieldOfStudy = "Computer Science and Engineering"
    yearInCollege = "Recently Graduated (0-1 year)"
    selectedCountry = "India"
} | ConvertTo-Json -Depth 3

try {
    $eduResponse = Invoke-RestMethod -Uri "$BaseUrl/users/education" -Method PUT -Body $educationData -Headers $headers
    Write-Host "? Education data updated successfully" -ForegroundColor Green
    Write-Host ($eduResponse | ConvertTo-Json -Depth 2) -ForegroundColor Gray
} catch {
    Write-Host "? Education update failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Error details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# Step 5: Update Work Experience via Applicant Profile
Write-Host "`n?? STEP 5: Update Work Experience via Applicant Profile" -ForegroundColor Yellow

$workExperienceData = @{
    currentJobTitle = "Senior Software Engineer"
    currentCompany = "Tech Innovations Pvt Ltd"
    yearsOfExperience = 5
    headline = "Experienced Full-Stack Developer"
    summary = "Senior software engineer with 5+ years of experience in web development, specializing in React, Node.js, and cloud technologies. Proven track record of delivering scalable applications and leading development teams."
    primarySkills = "JavaScript, React, Node.js, Python, TypeScript, AWS"
    secondarySkills = "Docker, Kubernetes, GraphQL, MongoDB, PostgreSQL, Redis"
    currentLocation = "Bangalore, Karnataka, India"
    nationality = "Indian"
    linkedInProfile = "https://linkedin.com/in/complete-test-user"
    githubProfile = "https://github.com/complete-test-user"
    languages = "English (Fluent), Hindi (Native), Kannada (Conversational)"
    certifications = "AWS Certified Developer Associate, MongoDB Certified Developer, React Professional Certificate"
    immediatelyAvailable = $false
    willingToRelocate = $true
} | ConvertTo-Json -Depth 3

try {
    $workResponse = Invoke-RestMethod -Uri "$BaseUrl/applicants/$userId/profile" -Method PUT -Body $workExperienceData -Headers $headers
    Write-Host "? Work experience updated successfully" -ForegroundColor Green
    Write-Host ($workResponse | ConvertTo-Json -Depth 2) -ForegroundColor Gray
} catch {
    Write-Host "? Work experience update failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Error details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# Step 6: Update Job Preferences
Write-Host "`n?? STEP 6: Update Job Preferences" -ForegroundColor Yellow

$jobPreferencesData = @{
    preferredJobTypes = @(
        @{ JobTypeID = 9; Type = "Full-time" },
        @{ JobTypeID = 3; Type = "Contract" }
    )
    workplaceType = "hybrid"
    preferredLocations = "Bangalore, Mumbai, Pune, Hyderabad"
} | ConvertTo-Json -Depth 3

try {
    $jobPrefResponse = Invoke-RestMethod -Uri "$BaseUrl/users/job-preferences" -Method PUT -Body $jobPreferencesData -Headers $headers
    Write-Host "? Job preferences updated successfully" -ForegroundColor Green
    Write-Host ($jobPrefResponse | ConvertTo-Json -Depth 2) -ForegroundColor Gray
} catch {
    Write-Host "? Job preferences update failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Error details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

# Step 7: Wait and check final database state
Write-Host "`n?? STEP 7: Check Final Applicants Table Population" -ForegroundColor Yellow
Write-Host "? Waiting 2 seconds for database updates..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $finalResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $initialQuery
    
    if ($finalResult) {
        Write-Host "? Final applicant record retrieved" -ForegroundColor Green
        
        # Compare initial vs final state
        $finalNullCount = 0
        $populatedFields = @()
        $stillNullFields = @()
        
        foreach ($prop in $finalResult.PSObject.Properties) {
            if ($prop.Value -eq $null -or $prop.Value -eq '' -or ($prop.Value -eq 0 -and $prop.Name -ne 'ProfileCompleteness')) {
                $finalNullCount++
                $stillNullFields += $prop.Name
            } else {
                $populatedFields += $prop.Name
            }
        }
        
        Write-Host "`n?? FINAL RESULTS:" -ForegroundColor Cyan
        Write-Host "Final Profile Completeness: $($finalResult.ProfileCompleteness)%" -ForegroundColor Cyan
        Write-Host "Total Fields: $($finalResult.PSObject.Properties.Count)" -ForegroundColor Cyan
        Write-Host "Populated Fields: $($populatedFields.Count)" -ForegroundColor Green
        Write-Host "NULL Fields: $($stillNullFields.Count)" -ForegroundColor Red
        Write-Host "Population Rate: $([math]::Round(($populatedFields.Count / $finalResult.PSObject.Properties.Count) * 100, 1))%" -ForegroundColor Yellow
        
        Write-Host "`n? POPULATED FIELDS:" -ForegroundColor Green
        foreach ($field in $populatedFields) {
            $value = $finalResult.$field
            if ($value.ToString().Length -gt 50) {
                $displayValue = $value.ToString().Substring(0, 50) + "..."
            } else {
                $displayValue = $value
            }
            Write-Host "  $field`: $displayValue" -ForegroundColor Green
        }
        
        Write-Host "`n? STILL NULL FIELDS:" -ForegroundColor Red
        foreach ($field in $stillNullFields) {
            Write-Host "  $field" -ForegroundColor Red
        }
        
        # Test specific critical mappings
        Write-Host "`n?? CRITICAL FIELD VERIFICATION:" -ForegroundColor Cyan
        $criticalMappings = @{
            "Institution" = @{ expected = "Indian Institute of Technology Delhi"; actual = $finalResult.Institution }
            "HighestEducation" = @{ expected = "Bachelor's Degree"; actual = $finalResult.HighestEducation }
            "FieldOfStudy" = @{ expected = "Computer Science"; actual = $finalResult.FieldOfStudy }
            "CurrentJobTitle" = @{ expected = "Senior Software Engineer"; actual = $finalResult.CurrentJobTitle }
            "CurrentCompany" = @{ expected = "Tech Innovations"; actual = $finalResult.CurrentCompany }
            "YearsOfExperience" = @{ expected = 5; actual = $finalResult.YearsOfExperience }
            "PrimarySkills" = @{ expected = "JavaScript"; actual = $finalResult.PrimarySkills }
            "PreferredJobTypes" = @{ expected = "Full-time"; actual = $finalResult.PreferredJobTypes }
            "PreferredWorkTypes" = @{ expected = "Hybrid"; actual = $finalResult.PreferredWorkTypes }
            "PreferredLocations" = @{ expected = "Bangalore"; actual = $finalResult.PreferredLocations }
            "Nationality" = @{ expected = "Indian"; actual = $finalResult.Nationality }
            "LinkedInProfile" = @{ expected = "linkedin.com"; actual = $finalResult.LinkedInProfile }
        }
        
        $passedMappings = 0
        foreach ($fieldName in $criticalMappings.Keys) {
            $mapping = $criticalMappings[$fieldName]
            $expected = $mapping.expected
            $actual = $mapping.actual
            
            $passed = $false
            if ($actual -ne $null -and $actual -ne '') {
                if ($expected -is [string] -and $actual.ToString().Contains($expected)) {
                    $passed = $true
                } elseif ($expected -is [int] -and $actual -eq $expected) {
                    $passed = $true
                }
            }
            
            if ($passed) {
                Write-Host "  ? $fieldName`: $actual" -ForegroundColor Green
                $passedMappings++
            } else {
                Write-Host "  ? $fieldName`: Expected '$expected', Got '$actual'" -ForegroundColor Red
            }
        }
        
        $mappingSuccessRate = [math]::Round(($passedMappings / $criticalMappings.Count) * 100, 1)
        Write-Host "`n?? CRITICAL MAPPING SUCCESS RATE: $passedMappings/$($criticalMappings.Count) ($mappingSuccessRate%)" -ForegroundColor Cyan
        
        if ($mappingSuccessRate -ge 80) {
            Write-Host "?? EXCELLENT - Field mapping is working correctly!" -ForegroundColor Green
        } elseif ($mappingSuccessRate -ge 60) {
            Write-Host "?? GOOD - Most mappings work, some need fixes" -ForegroundColor Yellow
        } else {
            Write-Host "? POOR - Field mapping needs significant work" -ForegroundColor Red
        }
        
    } else {
        Write-Host "? No final applicant record found!" -ForegroundColor Red
    }
} catch {
    Write-Host "? Final database check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n?? === TEST SUMMARY ===" -ForegroundColor Green
Write-Host "?? Test User: $testEmail" -ForegroundColor Cyan
Write-Host "?? User ID: $userId" -ForegroundColor Cyan
Write-Host "?? API Base: $BaseUrl" -ForegroundColor Cyan
Write-Host "`n?? This test verifies step-by-step API calls to populate the Applicants table" -ForegroundColor Yellow