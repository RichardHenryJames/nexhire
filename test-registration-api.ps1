# NexHire Backend API Testing Script
# Tests registration flow and data population in Users and Applicants tables

param(
    [string]$BaseUrl = "https://nexhire-api-func.azurewebsites.net/api",
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host "=== NEXHIRE REGISTRATION API TESTING ===" -ForegroundColor Green

# Install required modules
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

# Test Data
$testEmail = "test.user.$(Get-Date -Format 'yyyyMMddHHmmss')@nexhire.test"
$testPassword = "TestPassword123!"

Write-Host "Test Email: $testEmail" -ForegroundColor Cyan

# Test 1: Register a Job Seeker
Write-Host "`n?? TEST 1: Job Seeker Registration" -ForegroundColor Yellow

$registrationData = @{
    email = $testEmail
    password = $testPassword
    firstName = "Test"
    lastName = "JobSeeker"
    userType = "JobSeeker"
    phone = "+1234567890"
    dateOfBirth = "1995-01-15T00:00:00.000Z"
    gender = "Other"
} | ConvertTo-Json

Write-Host "Registration Payload:" -ForegroundColor Cyan
Write-Host $registrationData -ForegroundColor Gray

try {
    $registrationResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/register" -Method POST -Body $registrationData -ContentType "application/json"
    Write-Host "? Registration Response:" -ForegroundColor Green
    Write-Host ($registrationResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
} catch {
    Write-Host "? Registration Failed:" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Status Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    Write-Host "Exception Message: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to get response content
    if ($_.ErrorDetails.Message) {
        Write-Host "Error Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    
    # Try to read response stream
    try {
        $streamReader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $streamReader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
        $streamReader.Close()
    } catch {
        Write-Host "Could not read response stream" -ForegroundColor Red
    }
    
    exit 1
}

# Test 2: Login to get tokens
Write-Host "`n?? TEST 2: Login and Get Tokens" -ForegroundColor Yellow

$loginData = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    Write-Host "? Login Response:" -ForegroundColor Green
    Write-Host ($loginResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
    
    $accessToken = $loginResponse.data.tokens.accessToken
    Write-Host "Access Token: $($accessToken.Substring(0, 50))..." -ForegroundColor Cyan
    
    $userId = $loginResponse.data.user.UserID
    Write-Host "User ID: $userId" -ForegroundColor Cyan
} catch {
    Write-Host "? Login Failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Test 3: Check Initial Database State
Write-Host "`n?? TEST 3: Check Initial Database State" -ForegroundColor Yellow

try {
    # Check Users table
    $userQuery = "SELECT UserID, Email, FirstName, LastName, UserType, Phone, Gender, DateOfBirth FROM Users WHERE UserID = '$userId'"
    $userResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $userQuery
    
    Write-Host "User Record:" -ForegroundColor Green
    $userResult | Format-Table -AutoSize
    
    # Check Applicants table
    $applicantQuery = "SELECT * FROM Applicants WHERE UserID = '$userId'"
    $applicantResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $applicantQuery
    
    Write-Host "Initial Applicant Record:" -ForegroundColor Green
    if ($applicantResult) {
        $applicantResult | Format-List
        Write-Host "Non-null fields count: $((($applicantResult | Get-Member -MemberType Properties).Name | ForEach-Object { if ($applicantResult.$_ -ne $null -and $applicantResult.$_ -ne '') { $_ } }).Count)" -ForegroundColor Cyan
    } else {
        Write-Host "? No applicant record found!" -ForegroundColor Red
    }
} catch {
    Write-Host "? Database check failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Test 4: Update Education Data
Write-Host "`n?? TEST 4: Update Education Data" -ForegroundColor Yellow

$educationData = @{
    college = @{
        id = 1
        name = "Test University"
        type = "University"
        country = "India"
        state = "Test State"
    }
    customCollege = ""
    degreeType = "Bachelor's Degree"
    fieldOfStudy = "Computer Science"
    yearInCollege = "Fourth Year (Senior)"
    selectedCountry = "India"
} | ConvertTo-Json -Depth 3

Write-Host "Education Payload:" -ForegroundColor Cyan
Write-Host $educationData -ForegroundColor Gray

try {
    $headers = @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    }
    
    $educationResponse = Invoke-RestMethod -Uri "$BaseUrl/users/education" -Method PUT -Body $educationData -Headers $headers
    Write-Host "? Education Update Response:" -ForegroundColor Green
    Write-Host ($educationResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
} catch {
    Write-Host "? Education Update Failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    # Check if response has more details
    if ($_.ErrorDetails.Message) {
        Write-Host "Error Details:" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
}

# Test 5: Update Work Experience (via Applicant Profile)
Write-Host "`n?? TEST 5: Update Work Experience Data" -ForegroundColor Yellow

$workExperienceData = @{
    currentJobTitle = "Software Engineer"
    currentCompany = "Test Corp"
    yearsOfExperience = 3
    primarySkills = "JavaScript, React, Node.js"
    secondarySkills = "Python, AWS, Docker"
    bio = "Experienced full-stack developer with 3 years of experience"
    preferredWorkTypes = "Remote"
    preferredJobTypes = "Full-time"
} | ConvertTo-Json -Depth 3

Write-Host "Work Experience Payload:" -ForegroundColor Cyan
Write-Host $workExperienceData -ForegroundColor Gray

try {
    $workResponse = Invoke-RestMethod -Uri "$BaseUrl/applicants/$userId/profile" -Method PUT -Body $workExperienceData -Headers $headers
    Write-Host "? Work Experience Update Response:" -ForegroundColor Green
    Write-Host ($workResponse | ConvertTo-Json -Depth 3) -ForegroundColor Gray
} catch {
    Write-Host "? Work Experience Update Failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Error Details:" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
}

# Test 6: Check Final Database State
Write-Host "`n?? TEST 6: Check Final Database State" -ForegroundColor Yellow

try {
    # Check updated Applicants table
    $finalApplicantResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $applicantQuery
    
    Write-Host "Final Applicant Record:" -ForegroundColor Green
    if ($finalApplicantResult) {
        $finalApplicantResult | Format-List
        
        # Count non-null fields
        $nonNullFields = ($finalApplicantResult | Get-Member -MemberType Properties).Name | ForEach-Object { 
            if ($finalApplicantResult.$_ -ne $null -and $finalApplicantResult.$_ -ne '') { 
                Write-Host "  ? ${_}: $($finalApplicantResult.$_)" -ForegroundColor Green
                $_
            } else {
                Write-Host "  ? ${_}: NULL" -ForegroundColor Red
            }
        }
        
        Write-Host "`n?? Total fields: $((($finalApplicantResult | Get-Member -MemberType Properties).Name).Count)" -ForegroundColor Cyan
        Write-Host "Non-null fields: $(($nonNullFields).Count)" -ForegroundColor Green
        Write-Host "Completion percentage: $([math]::Round((($nonNullFields).Count / (($finalApplicantResult | Get-Member -MemberType Properties).Name).Count) * 100, 2))%" -ForegroundColor Yellow
    } else {
        Write-Host "? Still no applicant record found!" -ForegroundColor Red
    }
} catch {
    Write-Host "? Final database check failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Test 7: Verify Specific Expected Fields
Write-Host "`n?? TEST 7: Verify Expected Field Population" -ForegroundColor Yellow

$expectedFields = @{
    "HighestEducation" = "Bachelor's Degree"
    "FieldOfStudy" = "Computer Science"
    "CurrentJobTitle" = "Software Engineer"
    "CurrentCompany" = "Test Corp"
    "YearsOfExperience" = 3
    "PrimarySkills" = "JavaScript, React, Node.js"
    "SecondarySkills" = "Python, AWS, Docker"
    "Summary" = "Experienced full-stack developer"
}

if ($finalApplicantResult) {
    Write-Host "Expected vs Actual Field Values:" -ForegroundColor Cyan
    foreach ($field in $expectedFields.Keys) {
        $expected = $expectedFields[$field]
        $actual = $finalApplicantResult.$field
        
        if ($actual -and $actual.ToString().Contains($expected.ToString())) {
            Write-Host "  ? ${field}: Expected '$expected' -> Got '$actual'" -ForegroundColor Green
        } else {
            Write-Host "  ? ${field}: Expected '$expected' -> Got '$actual'" -ForegroundColor Red
        }
    }
}

Write-Host "`n?? === TESTING COMPLETED ===" -ForegroundColor Green
Write-Host "Test user email: $testEmail" -ForegroundColor Cyan
Write-Host "Test user ID: $userId" -ForegroundColor Cyan