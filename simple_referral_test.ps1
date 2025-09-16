# Simplified Referral Points Test - Core Flow Only
# Focus on the essential referral flow to test points system

$baseUrl = "https://nexhire-api-func.azurewebsites.net/api"
$timestamp = [int64](Get-Date -UFormat %s)
$seekerEmail = "simple_seeker_$timestamp@example.com"
$referrerEmail = "simple_referrer_$timestamp@example.com"
$password = "12345678"

Write-Host "?? SIMPLIFIED REFERRAL POINTS TEST" -ForegroundColor Green
Write-Host "=========================================="
Write-Host "Testing ONLY the core referral flow to check points system"
Write-Host ""

# Function for API calls
function Invoke-SimpleAPI {
    param($Uri, $Method = "GET", $Headers = @{}, $Body = $null, $Description)
    try {
        $params = @{Uri = $Uri; Method = $Method; Headers = $Headers}
        if ($Body) { $params.Body = $Body }
        $response = Invoke-RestMethod @params
        Write-Host "? $Description" -ForegroundColor Green
        return $response
    }
    catch {
        Write-Host "? $Description - FAILED: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

try {
    # Register and login seeker
    Write-Host "1. Registering seeker..." -ForegroundColor Yellow
    $seekerRegBody = @{email = $seekerEmail; password = $password; userType = "JobSeeker"; firstName = "Test"; lastName = "Seeker"} | ConvertTo-Json
    Invoke-SimpleAPI -Uri "$baseUrl/auth/register" -Method "POST" -Headers @{"Content-Type"="application/json"} -Body $seekerRegBody -Description "Seeker Registration"
    
    Start-Sleep -Seconds 2
    
    $seekerLoginBody = @{email = $seekerEmail; password = $password} | ConvertTo-Json
    $seekerLogin = Invoke-SimpleAPI -Uri "$baseUrl/auth/login" -Method "POST" -Headers @{"Content-Type"="application/json"} -Body $seekerLoginBody -Description "Seeker Login"
    $seekerToken = $seekerLogin.data.tokens.accessToken
    $seekerHeaders = @{"Authorization"="Bearer $seekerToken"; "Content-Type"="application/json"}
    
    # Register and login referrer
    Write-Host ""
    Write-Host "2. Registering referrer..." -ForegroundColor Yellow
    $referrerRegBody = @{email = $referrerEmail; password = $password; userType = "JobSeeker"; firstName = "Test"; lastName = "Referrer"} | ConvertTo-Json
    Invoke-SimpleAPI -Uri "$baseUrl/auth/register" -Method "POST" -Headers @{"Content-Type"="application/json"} -Body $referrerRegBody -Description "Referrer Registration"
    
    Start-Sleep -Seconds 2
    
    $referrerLoginBody = @{email = $referrerEmail; password = $password} | ConvertTo-Json
    $referrerLogin = Invoke-SimpleAPI -Uri "$baseUrl/auth/login" -Method "POST" -Headers @{"Content-Type"="application/json"} -Body $referrerLoginBody -Description "Referrer Login"
    $referrerToken = $referrerLogin.data.tokens.accessToken
    $referrerHeaders = @{"Authorization"="Bearer $referrerToken"; "Content-Type"="application/json"}

    # Add work experience for referrer (critical step)
    Write-Host ""
    Write-Host "3. Adding work experience for referrer..." -ForegroundColor Yellow
    $workExpBody = @{
        organizationName = "Acme Corp"
        jobTitle = "Senior Developer"
        startDate = "2023-01-01"
        isCurrent = $true
        description = "Test work experience"
    } | ConvertTo-Json
    
    Invoke-SimpleAPI -Uri "$baseUrl/users/work-experiences" -Method "POST" -Headers $referrerHeaders -Body $workExpBody -Description "Work Experience Added"

    # Create resume for seeker
    Write-Host ""
    Write-Host "4. Creating resume for seeker..." -ForegroundColor Yellow
    
    # Upload file
    $resumeUploadBody = @{
        fileName = "test.pdf"
        mimeType = "application/pdf"
        containerName = "resumes"
        userId = "test"
        fileData = "JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFsgMyAwIFIgXQovQ291bnQgMQo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggMTMKPj4Kc3RyZWFtCkhlbGxvLCB3b3JsZCEKZW5kc3RyZWFtCmVuZG9iago="
    } | ConvertTo-Json
    
    $upload = Invoke-SimpleAPI -Uri "$baseUrl/storage/upload" -Method "POST" -Headers $seekerHeaders -Body $resumeUploadBody -Description "Resume Upload"
    
    # Create resume record  
    $resumeBody = @{
        resumeLabel = "Test Resume"
        resumeURL = $upload.data.fileUrl
        isPrimary = $true
    } | ConvertTo-Json
    
    $resume = Invoke-SimpleAPI -Uri "$baseUrl/users/resumes" -Method "POST" -Headers $seekerHeaders -Body $resumeBody -Description "Resume Creation"
    $resumeId = $resume.data.ResumeID

    # Get jobs and find Acme Corp job
    Write-Host ""
    Write-Host "5. Finding suitable job..." -ForegroundColor Yellow
    $jobs = Invoke-SimpleAPI -Uri "$baseUrl/jobs?pageSize=20" -Method "GET" -Headers $seekerHeaders -Description "Jobs Retrieved"
    
    $targetJob = $null
    foreach ($job in $jobs.data) {
        if ($job.OrganizationName -eq "Acme Corp") {
            $targetJob = $job
            break
        }
    }
    
    if (-not $targetJob) {
        Write-Host "?? No Acme Corp jobs found, using first job" -ForegroundColor Yellow
        $targetJob = $jobs.data[0]
    }
    
    Write-Host "   Using: $($targetJob.Title) at $($targetJob.OrganizationName)" -ForegroundColor Gray

    # Create referral request
    Write-Host ""
    Write-Host "6. Creating referral request..." -ForegroundColor Yellow
    $requestBody = @{jobID = $targetJob.JobID; resumeID = $resumeId} | ConvertTo-Json
    $request = Invoke-SimpleAPI -Uri "$baseUrl/referral/requests" -Method "POST" -Headers $seekerHeaders -Body $requestBody -Description "Referral Request Created"
    $requestId = $request.data.RequestID
    
    Write-Host "   Request ID: $requestId" -ForegroundColor Cyan

    # Upload proof
    Write-Host ""
    Write-Host "7. Uploading proof..." -ForegroundColor Yellow
    $proofUploadBody = @{
        fileName = "proof.jpg"
        mimeType = "image/jpeg"
        containerName = "referral-proofs"
        userId = "test"
        fileData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    } | ConvertTo-Json
    
    $proofUpload = Invoke-SimpleAPI -Uri "$baseUrl/storage/upload" -Method "POST" -Headers $referrerHeaders -Body $proofUploadBody -Description "Proof Upload"

    # ?? THE CRITICAL TEST: Claim with proof (should award points!)
    Write-Host ""
    Write-Host "8. ?? CLAIMING REFERRAL WITH PROOF..." -ForegroundColor Magenta
    $claimBody = @{
        proofFileURL = $proofUpload.data.fileUrl
        proofFileType = "image/jpeg"
        proofDescription = "Test proof"
    } | ConvertTo-Json
    
    $claim = Invoke-SimpleAPI -Uri "$baseUrl/referral/requests/$requestId/claim" -Method "POST" -Headers $referrerHeaders -Body $claimBody -Description "?? REFERRAL CLAIMED WITH PROOF"
    
    Write-Host "   Status: $($claim.data.Status)" -ForegroundColor Cyan

    # Check points after claim
    Write-Host ""
    Write-Host "9. ?? CHECKING POINTS AFTER CLAIM..." -ForegroundColor Magenta
    $analytics1 = Invoke-SimpleAPI -Uri "$baseUrl/referral/analytics" -Method "GET" -Headers $referrerHeaders -Description "Analytics After Claim"
    $pointsAfterClaim = $analytics1.data.totalPointsEarned
    
    Write-Host "   Points after claim: $pointsAfterClaim" -ForegroundColor Cyan

    # Verify referral (should add +25 points)
    Write-Host ""
    Write-Host "10. ?? VERIFYING REFERRAL..." -ForegroundColor Magenta
    $verifyBody = @{verified = $true} | ConvertTo-Json
    $verify = Invoke-SimpleAPI -Uri "$baseUrl/referral/requests/$requestId/verify" -Method "POST" -Headers $seekerHeaders -Body $verifyBody -Description "?? REFERRAL VERIFIED"
    
    Write-Host "   Status: $($verify.data.Status)" -ForegroundColor Cyan

    # Final points check
    Write-Host ""
    Write-Host "11. ?? FINAL POINTS CHECK..." -ForegroundColor Magenta
    Start-Sleep -Seconds 3
    $finalAnalytics = Invoke-SimpleAPI -Uri "$baseUrl/referral/analytics" -Method "GET" -Headers $referrerHeaders -Description "Final Analytics"
    $finalPoints = $finalAnalytics.data.totalPointsEarned
    
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "?? FINAL RESULTS:" -ForegroundColor Magenta
    Write-Host "=========================================="
    Write-Host "Points after claim: $pointsAfterClaim" -ForegroundColor White
    Write-Host "Points after verification: $finalPoints" -ForegroundColor White
    Write-Host "Points added by verification: $($finalPoints - $pointsAfterClaim)" -ForegroundColor White
    Write-Host ""
    
    if ($finalPoints -ge 40) {
        Write-Host "?? COMPLETE SUCCESS! Points system working!" -ForegroundColor Green
        Write-Host "Expected: 15-25 (claim) + 25 (verify) = 40-50 points" -ForegroundColor Green
        Write-Host "Actual: $finalPoints points" -ForegroundColor Green
    }
    elseif ($finalPoints -gt 0) {
        Write-Host "? PARTIAL SUCCESS! Some points awarded" -ForegroundColor Yellow
        Write-Host "Points system partially working but needs investigation" -ForegroundColor Yellow
    }
    else {
        Write-Host "? NO POINTS AWARDED! System still broken" -ForegroundColor Red
        Write-Host "ApplicantID mismatch or database issue confirmed" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "?? Database check SQL:" -ForegroundColor Yellow
    Write-Host "SELECT * FROM ReferralRewards WHERE RequestID = '$requestId';" -ForegroundColor White
    Write-Host ""
    Write-Host "Test users created:" -ForegroundColor Cyan
    Write-Host "Seeker: $seekerEmail / $password" -ForegroundColor Gray
    Write-Host "Referrer: $referrerEmail / $password" -ForegroundColor Gray
}
catch {
    Write-Host ""
    Write-Host "? TEST FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "=========================================="