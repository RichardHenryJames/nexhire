# Simple Registration Test
param(
    [string]$BaseUrl = "https://nexhire-api-func.azurewebsites.net/api",
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

Write-Host "?? SIMPLE REGISTRATION TEST" -ForegroundColor Green

# Import SQL module
Import-Module SqlServer -Force

$testEmail = "simple.test.$(Get-Date -Format 'yyyyMMddHHmmss')@nexhire.test"
Write-Host "?? Test Email: $testEmail" -ForegroundColor Cyan

# Register user
$registrationData = @{
    email = $testEmail
    password = "TestPassword123!"
    firstName = "Simple"
    lastName = "Test"
    userType = "JobSeeker"
} | ConvertTo-Json

Write-Host "`n?? Registering user..." -ForegroundColor Yellow
try {
    $regResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/register" -Method POST -Body $registrationData -ContentType "application/json"
    Write-Host "? Registration successful" -ForegroundColor Green
} catch {
    Write-Host "? Registration failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Login
$loginData = @{
    email = $testEmail
    password = "TestPassword123!"
} | ConvertTo-Json

Write-Host "`n?? Logging in..." -ForegroundColor Yellow
try {
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $userId = $loginResponse.data.user.UserID
    $token = $loginResponse.data.tokens.accessToken
    Write-Host "? Login successful - UserID: $userId" -ForegroundColor Green
} catch {
    Write-Host "? Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Check database
Write-Host "`n?? Checking database..." -ForegroundColor Yellow
try {
    $userQuery = "SELECT * FROM Users WHERE UserID = '$userId'"
    $userResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $userQuery
    
    $applicantQuery = "SELECT * FROM Applicants WHERE UserID = '$userId'"
    $applicantResult = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $applicantQuery
    
    Write-Host "?? User Record:" -ForegroundColor Green
    Write-Host "  Email: $($userResult.Email)" -ForegroundColor Gray
    Write-Host "  Name: $($userResult.FirstName) $($userResult.LastName)" -ForegroundColor Gray
    Write-Host "  Type: $($userResult.UserType)" -ForegroundColor Gray
    
    if ($applicantResult) {
        Write-Host "`n?? Applicant Record Found:" -ForegroundColor Green
        Write-Host "  ApplicantID: $($applicantResult.ApplicantID)" -ForegroundColor Gray
        Write-Host "  ProfileCompleteness: $($applicantResult.ProfileCompleteness)%" -ForegroundColor Gray
        Write-Host "  IsOpenToWork: $($applicantResult.IsOpenToWork)" -ForegroundColor Gray
        
        # Count non-null fields
        $nullFields = 0
        $populatedFields = 0
        foreach ($prop in $applicantResult.PSObject.Properties) {
            if ($null -eq $prop.Value -or $prop.Value -eq '' -or $prop.Value -eq 0) {
                $nullFields++
            } else {
                $populatedFields++
            }
        }
        Write-Host "  Populated fields: $populatedFields" -ForegroundColor Green
        Write-Host "  NULL fields: $nullFields" -ForegroundColor Red
    } else {
        Write-Host "? No applicant record found!" -ForegroundColor Red
    }
    
} catch {
    Write-Host "? Database check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n?? Simple test completed" -ForegroundColor Green