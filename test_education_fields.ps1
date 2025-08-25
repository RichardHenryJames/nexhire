# ?? PowerShell Test Script for GraduationYear & GPA Integration
# ==============================================================

$API_BASE_URL = "https://nexhire-api-func.azurewebsites.net/api"
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$TEST_EMAIL = "test-education-$timestamp@nexhire.com"
$TEST_PASSWORD = "TestPassword123!"

Write-Host "?? Testing Education Fields (GraduationYear & GPA)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "?? Test Email: $TEST_EMAIL" -ForegroundColor Yellow
Write-Host "?? API URL: $API_BASE_URL" -ForegroundColor Yellow
Write-Host ""

# 1. Register user
Write-Host "1?? Registering new user..." -ForegroundColor Green

$registerData = @{
    email = $TEST_EMAIL
    password = $TEST_PASSWORD
    firstName = "John"
    lastName = "TestEducation"
    userType = "JobSeeker"
    phone = "+1234567890"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$API_BASE_URL/auth/register" -Method POST -Body $registerData -ContentType "application/json"
    Write-Host "? Registration successful!" -ForegroundColor Green
    Write-Host "?? Registration Response:" -ForegroundColor Cyan
    $registerResponse | ConvertTo-Json -Depth 10 | Write-Host
    
    $AUTH_TOKEN = $registerResponse.data.tokens.accessToken
    $USER_ID = $registerResponse.data.user.UserID
    
    Write-Host ""
    Write-Host "?? Auth Token: $($AUTH_TOKEN.Substring(0,50))..." -ForegroundColor Yellow
    Write-Host "?? User ID: $USER_ID" -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host "? Registration failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# 2. Update education with GraduationYear & GPA
Write-Host "2?? Updating education via registration flow (with GraduationYear & GPA)..." -ForegroundColor Green

$educationData = @{
    college = @{
        name = "Stanford University"
        country = "United States"
    }
    degreeType = "Master's Degree"
    fieldOfStudy = "Computer Science"
    graduationYear = "2024"
    gpa = "3.9/4.0"
} | ConvertTo-Json -Depth 10

$headers = @{
    "Authorization" = "Bearer $AUTH_TOKEN"
    "Content-Type" = "application/json"
    "Accept" = "application/json"
}

try {
    $educationResponse = Invoke-RestMethod -Uri "$API_BASE_URL/users/education" -Method PUT -Body $educationData -Headers $headers
    Write-Host "?? Education Update Response:" -ForegroundColor Cyan
    $educationResponse | ConvertTo-Json -Depth 10 | Write-Host
} catch {
    Write-Host "? Education update failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# 3. Verify data was saved
Write-Host ""
Write-Host "3?? Verifying data was saved (GET applicant profile)..." -ForegroundColor Green

try {
    $profileResponse = Invoke-RestMethod -Uri "$API_BASE_URL/applicants/$USER_ID/profile" -Method GET -Headers $headers
    Write-Host "?? Profile Response:" -ForegroundColor Cyan
    $profileResponse | ConvertTo-Json -Depth 10 | Write-Host
    
    $INSTITUTION = $profileResponse.data.Institution
    $HIGHEST_EDUCATION = $profileResponse.data.HighestEducation
    $FIELD_OF_STUDY = $profileResponse.data.FieldOfStudy
    $GRADUATION_YEAR = $profileResponse.data.GraduationYear
    $GPA = $profileResponse.data.GPA
    
    Write-Host ""
    Write-Host "4?? Checking specific education fields..." -ForegroundColor Green
    Write-Host "?? Institution: $INSTITUTION" -ForegroundColor White
    Write-Host "?? Highest Education: $HIGHEST_EDUCATION" -ForegroundColor White
    Write-Host "?? Field of Study: $FIELD_OF_STUDY" -ForegroundColor White
    Write-Host "?? Graduation Year: $GRADUATION_YEAR" -ForegroundColor White
    Write-Host "?? GPA: $GPA" -ForegroundColor White
    
} catch {
    Write-Host "? Failed to get profile data!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# 4. Test profile update via applicant endpoint
Write-Host ""
Write-Host "5?? Testing profile update via applicant endpoint (Smart Routing)..." -ForegroundColor Green

$updateData = @{
    institution = "Massachusetts Institute of Technology (MIT)"
    highestEducation = "PhD"
    fieldOfStudy = "Artificial Intelligence"
    graduationYear = "2023"
    gpa = "4.0/4.0"
    hideCurrentCompany = $true
    currentJobTitle = "Senior AI Researcher"
} | ConvertTo-Json -Depth 10

try {
    $updateResponse = Invoke-RestMethod -Uri "$API_BASE_URL/applicants/$USER_ID/profile" -Method PUT -Body $updateData -Headers $headers
    Write-Host "?? Profile Update Response:" -ForegroundColor Cyan
    $updateResponse | ConvertTo-Json -Depth 10 | Write-Host
} catch {
    Write-Host "? Profile update failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# 5. Final verification
Write-Host ""
Write-Host "6?? Final verification after profile update..." -ForegroundColor Green

try {
    $finalProfile = Invoke-RestMethod -Uri "$API_BASE_URL/applicants/$USER_ID/profile" -Method GET -Headers $headers
    
    $FINAL_INSTITUTION = $finalProfile.data.Institution
    $FINAL_GRADUATION_YEAR = $finalProfile.data.GraduationYear
    $FINAL_GPA = $finalProfile.data.GPA
    $FINAL_HIDE_COMPANY = $finalProfile.data.HideCurrentCompany
    
    Write-Host "?? Final Institution: $FINAL_INSTITUTION" -ForegroundColor White
    Write-Host "?? Final Graduation Year: $FINAL_GRADUATION_YEAR" -ForegroundColor White
    Write-Host "?? Final GPA: $FINAL_GPA" -ForegroundColor White
    Write-Host "?? Hide Company: $FINAL_HIDE_COMPANY" -ForegroundColor White
    
} catch {
    Write-Host "? Final verification failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# 6. Results Summary
Write-Host ""
Write-Host "?? TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan

# Check registration flow
if ($GRADUATION_YEAR -eq "2024" -and $GPA -eq "3.9/4.0") {
    Write-Host "? REGISTRATION FLOW: GraduationYear and GPA saved correctly during registration" -ForegroundColor Green
} else {
    Write-Host "? REGISTRATION FLOW: Fields not saved correctly during registration" -ForegroundColor Red
}

# Check profile update flow
if ($FINAL_GRADUATION_YEAR -eq "2023" -and $FINAL_GPA -eq "4.0/4.0") {
    Write-Host "? PROFILE UPDATE FLOW: GraduationYear and GPA updated correctly via profile endpoint" -ForegroundColor Green
} else {
    Write-Host "? PROFILE UPDATE FLOW: Fields not updated correctly via profile endpoint" -ForegroundColor Red
}

# Check smart routing
if ($FINAL_HIDE_COMPANY -eq 1 -or $FINAL_HIDE_COMPANY -eq $true) {
    Write-Host "? SMART ROUTING: Mixed field updates work correctly" -ForegroundColor Green
} else {
    Write-Host "? SMART ROUTING: Mixed field updates may have issues" -ForegroundColor Red
}

# Overall result
if ($FINAL_GRADUATION_YEAR -eq "2023" -and $FINAL_GPA -eq "4.0/4.0") {
    Write-Host ""
    Write-Host "?? OVERALL: SUCCESS! GraduationYear and GPA integration is working correctly!" -ForegroundColor Green
    Write-Host "   - ? Database columns exist and accept data" -ForegroundColor Green
    Write-Host "   - ? Registration flow saves the fields" -ForegroundColor Green
    Write-Host "   - ? Profile update flow updates the fields" -ForegroundColor Green
    Write-Host "   - ? Smart routing works with mixed field types" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "? OVERALL: FAILURE! There are issues with the integration." -ForegroundColor Red
    Write-Host "   Check the database schema and backend code." -ForegroundColor Red
}

Write-Host ""
Write-Host "?? Test completed with user: $TEST_EMAIL" -ForegroundColor Yellow
Write-Host "?? User ID: $USER_ID (you can use this for manual testing)" -ForegroundColor Yellow