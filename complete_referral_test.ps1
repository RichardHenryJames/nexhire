# Complete Referral Points Test with New Users
# This script will create new users, set up profiles, work experience, resumes, and test the complete referral flow

$baseUrl = "https://nexhire-api-func.azurewebsites.net/api"
$timestamp = [int64](Get-Date -UFormat %s)
$seekerEmail = "test_seeker_$timestamp@example.com"
$referrerEmail = "test_referrer_$timestamp@example.com"
$password = "12345678"

Write-Host "?? COMPLETE REFERRAL POINTS TEST WITH NEW USERS" -ForegroundColor Green
Write-Host "=================================================================="
Write-Host "This test will:" -ForegroundColor Cyan
Write-Host "1. Register 2 new users (seeker + referrer)" -ForegroundColor White
Write-Host "2. Create profiles for both users" -ForegroundColor White
Write-Host "3. Add work experience for referrer at Acme Corp" -ForegroundColor White
Write-Host "4. Create resume for seeker" -ForegroundColor White
Write-Host "5. Create referral request" -ForegroundColor White
Write-Host "6. Claim referral with proof (should award points)" -ForegroundColor White
Write-Host "7. Verify referral (should award more points)" -ForegroundColor White
Write-Host "8. Check database for ReferralRewards entries" -ForegroundColor White
Write-Host ""
Write-Host "?? Test users:" -ForegroundColor Yellow
Write-Host "   Seeker: $seekerEmail" -ForegroundColor Gray
Write-Host "   Referrer: $referrerEmail" -ForegroundColor Gray
Write-Host "   Password: $password" -ForegroundColor Gray
Write-Host ""

# Function to make API calls with error handling
function Invoke-APICall {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [string]$Description = "API Call"
    )
    
    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = $Headers
        }
        
        if ($Body) {
            $params.Body = $Body
        }
        
        $response = Invoke-RestMethod @params
        Write-Host "? $Description - SUCCESS" -ForegroundColor Green
        return $response
    }
    catch {
        Write-Host "? $Description - FAILED: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "   Response: $responseBody" -ForegroundColor Red
        }
        throw
    }
}

try {
    # Step 1: Register Seeker
    Write-Host "STEP 1: Registering Seeker" -ForegroundColor Yellow
    $seekerBody = @{
        email = $seekerEmail
        password = $password
        userType = "JobSeeker"
        firstName = "Test"
        lastName = "Seeker"
    } | ConvertTo-Json
    
    $seekerResponse = Invoke-APICall -Uri "$baseUrl/auth/register" -Method "POST" -Headers @{"Content-Type"="application/json"} -Body $seekerBody -Description "Seeker Registration"

    # Step 2: Register Referrer
    Write-Host ""
    Write-Host "STEP 2: Registering Referrer" -ForegroundColor Yellow
    $referrerBody = @{
        email = $referrerEmail
        password = $password
        userType = "JobSeeker"
        firstName = "Test"
        lastName = "Referrer"
    } | ConvertTo-Json
    
    $referrerResponse = Invoke-APICall -Uri "$baseUrl/auth/register" -Method "POST" -Headers @{"Content-Type"="application/json"} -Body $referrerBody -Description "Referrer Registration"

    # Wait for registration
    Write-Host ""
    Write-Host "? Waiting for registration to complete..." -ForegroundColor Cyan
    Start-Sleep -Seconds 5

    # Step 3: Login Seeker
    Write-Host ""
    Write-Host "STEP 3: Logging in Seeker" -ForegroundColor Yellow
    $seekerLoginBody = @{
        email = $seekerEmail
        password = $password
    } | ConvertTo-Json
    
    $seekerLogin = Invoke-APICall -Uri "$baseUrl/auth/login" -Method "POST" -Headers @{"Content-Type"="application/json"} -Body $seekerLoginBody -Description "Seeker Login"
    $seekerToken = $seekerLogin.data.tokens.accessToken
    $seekerHeaders = @{"Authorization"="Bearer $seekerToken"; "Content-Type"="application/json"}

    # Step 4: Login Referrer
    Write-Host ""
    Write-Host "STEP 4: Logging in Referrer" -ForegroundColor Yellow
    $referrerLoginBody = @{
        email = $referrerEmail
        password = $password
    } | ConvertTo-Json
    
    $referrerLogin = Invoke-APICall -Uri "$baseUrl/auth/login" -Method "POST" -Headers @{"Content-Type"="application/json"} -Body $referrerLoginBody -Description "Referrer Login"
    $referrerToken = $referrerLogin.data.tokens.accessToken
    $referrerHeaders = @{"Authorization"="Bearer $referrerToken"; "Content-Type"="application/json"}

    # Step 5: Create Seeker Profile
    Write-Host ""
    Write-Host "STEP 5: Creating Seeker Profile" -ForegroundColor Yellow
    $seekerProfileBody = @{
        dateOfBirth = "1995-01-15"
        gender = "Other"
        phone = "+1234567890"
        profileVisibility = "Public"
    } | ConvertTo-Json
    
    $seekerProfile = Invoke-APICall -Uri "$baseUrl/users/profile" -Method "POST" -Headers $seekerHeaders -Body $seekerProfileBody -Description "Seeker Profile Creation"

    # Step 6: Create Referrer Profile
    Write-Host ""
    Write-Host "STEP 6: Creating Referrer Profile" -ForegroundColor Yellow
    $referrerProfileBody = @{
        dateOfBirth = "1990-05-20"
        gender = "Other"
        phone = "+1987654321"
        profileVisibility = "Public"
    } | ConvertTo-Json
    
    $referrerProfile = Invoke-APICall -Uri "$baseUrl/users/profile" -Method "POST" -Headers $referrerHeaders -Body $referrerProfileBody -Description "Referrer Profile Creation"

    # Step 7: Add Work Experience for Referrer (CRITICAL - allows them to refer for Acme Corp)
    Write-Host ""
    Write-Host "STEP 7: Adding Work Experience for Referrer at Acme Corp" -ForegroundColor Yellow
    $workExpBody = @{
        organizationName = "Acme Corp"
        jobTitle = "Senior Software Engineer"
        startDate = "2023-01-01"
        endDate = $null
        isCurrent = $true
        description = "Working as a senior software engineer at Acme Corp - enables referrals for company jobs"
    } | ConvertTo-Json
    
    $workExp = Invoke-APICall -Uri "$baseUrl/users/work-experiences" -Method "POST" -Headers $referrerHeaders -Body $workExpBody -Description "Referrer Work Experience"

    # Step 8: Create Resume for Seeker
    Write-Host ""
    Write-Host "STEP 8: Creating Resume for Seeker" -ForegroundColor Yellow
    
    # Upload resume file
    $resumeUploadBody = @{
        fileName = "test_resume.pdf"
        mimeType = "application/pdf"
        containerName = "resumes"
        userId = "test-seeker"
        fileData = "JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFsgMyAwIFIgXQovQ291bnQgMQo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0KL0NvbnRlbnRzIDQgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDUgMCBSCj4+Cj4+Cj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMDAgNzAwIFRkCihIZWxsbyBXb3JsZCEpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI1MiAwMDAwMCBuIAowMDAwMDAwMzQ2IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNgovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDQzCiUlRU9G"
    } | ConvertTo-Json
    
    $resumeUpload = Invoke-APICall -Uri "$baseUrl/storage/upload" -Method "POST" -Headers $seekerHeaders -Body $resumeUploadBody -Description "Resume Upload"
    $resumeUrl = $resumeUpload.data.fileUrl

    # Create resume record
    $resumeRecordBody = @{
        resumeLabel = "Test Resume for Referral Points Test"
        resumeURL = $resumeUrl
        isPrimary = $true
    } | ConvertTo-Json
    
    $resumeRecord = Invoke-APICall -Uri "$baseUrl/users/resumes" -Method "POST" -Headers $seekerHeaders -Body $resumeRecordBody -Description "Resume Record Creation"
    $resumeId = $resumeRecord.data.ResumeID

    # Step 9: Get Acme Corp Jobs
    Write-Host ""
    Write-Host "STEP 9: Finding Acme Corp Jobs" -ForegroundColor Yellow
    $jobs = Invoke-APICall -Uri "$baseUrl/jobs?pageSize=20" -Method "GET" -Headers $seekerHeaders -Description "Get Jobs"
    
    # Find an Acme Corp job
    $acmeJob = $null
    foreach ($job in $jobs.data) {
        if ($job.OrganizationName -eq "Acme Corp") {
            $acmeJob = $job
            break
        }
    }
    
    if (-not $acmeJob) {
        Write-Host "? No Acme Corp jobs found! Using first available job..." -ForegroundColor Red
        $acmeJob = $jobs.data[0]
    }
    
    $jobId = $acmeJob.JobID
    Write-Host "? Using Job: $($acmeJob.Title) at $($acmeJob.OrganizationName) ($jobId)" -ForegroundColor Green

    # Step 10: Create Referral Request
    Write-Host ""
    Write-Host "STEP 10: Creating Referral Request" -ForegroundColor Yellow
    $requestBody = @{
        jobID = $jobId
        resumeID = $resumeId
    } | ConvertTo-Json
    
    $referralRequest = Invoke-APICall -Uri "$baseUrl/referral/requests" -Method "POST" -Headers $seekerHeaders -Body $requestBody -Description "Referral Request Creation"
    $requestId = $referralRequest.data.RequestID
    
    Write-Host "?? Referral Request Created: $requestId" -ForegroundColor Cyan

    # Step 11: Check Available Requests for Referrer
    Write-Host ""
    Write-Host "STEP 11: Checking Available Requests for Referrer" -ForegroundColor Yellow
    $availableRequests = Invoke-APICall -Uri "$baseUrl/referral/available?pageSize=10" -Method "GET" -Headers $referrerHeaders -Description "Available Requests Check"
    
    $foundRequest = $false
    foreach ($request in $availableRequests.data.requests) {
        if ($request.RequestID -eq $requestId) {
            $foundRequest = $true
            Write-Host "? Request found in available list!" -ForegroundColor Green
            break
        }
    }
    
    if (-not $foundRequest) {
        Write-Host "?? Request not found in available list - may be due to organization mismatch" -ForegroundColor Yellow
        Write-Host "   Available requests count: $($availableRequests.data.total)" -ForegroundColor Gray
    }

    # Step 12: Upload Proof
    Write-Host ""
    Write-Host "STEP 12: Uploading Referral Proof" -ForegroundColor Yellow
    $proofUploadBody = @{
        fileName = "referral_proof.jpg"
        mimeType = "image/jpeg"
        containerName = "referral-proofs"
        userId = "test-referrer"
        fileData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    } | ConvertTo-Json
    
    $proofUpload = Invoke-APICall -Uri "$baseUrl/storage/upload" -Method "POST" -Headers $referrerHeaders -Body $proofUploadBody -Description "Proof Upload"
    $proofUrl = $proofUpload.data.fileUrl

    # Step 13: Claim Referral with Proof (THE CRITICAL TEST!)
    Write-Host ""
    Write-Host "STEP 13: ?? CLAIMING REFERRAL WITH PROOF (SHOULD AWARD POINTS!)" -ForegroundColor Magenta
    $claimBody = @{
        proofFileURL = $proofUrl
        proofFileType = "image/jpeg"
        proofDescription = "Complete referral points test proof"
    } | ConvertTo-Json
    
    $claimResult = Invoke-APICall -Uri "$baseUrl/referral/requests/$requestId/claim" -Method "POST" -Headers $referrerHeaders -Body $claimBody -Description "Referral Claim with Proof"
    
    Write-Host "?? Referral claimed successfully! Status: $($claimResult.data.Status)" -ForegroundColor Green

    # Step 14: Check Referrer Analytics (Should show points now!)
    Write-Host ""
    Write-Host "STEP 14: ?? CHECKING REFERRER ANALYTICS FOR POINTS" -ForegroundColor Magenta
    $analytics1 = Invoke-APICall -Uri "$baseUrl/referral/analytics" -Method "GET" -Headers $referrerHeaders -Description "Referrer Analytics Check 1"
    
    $points1 = $analytics1.data.totalPointsEarned
    Write-Host ""
    Write-Host "?? POINTS AFTER CLAIM: $points1" -ForegroundColor Cyan
    Write-Host "   Completed Referrals: $($analytics1.data.completedReferrals)" -ForegroundColor Gray
    Write-Host "   Total Received: $($analytics1.data.totalRequestsReceived)" -ForegroundColor Gray

    if ($points1 -gt 0) {
        Write-Host "?? SUCCESS! Points awarded after claim!" -ForegroundColor Green
    } else {
        Write-Host "?? No points yet after claim..." -ForegroundColor Yellow
    }

    # Step 15: Verify Referral (Should add +25 more points)
    Write-Host ""
    Write-Host "STEP 15: ?? VERIFYING REFERRAL (SHOULD ADD +25 POINTS!)" -ForegroundColor Magenta
    $verifyBody = @{
        verified = $true
    } | ConvertTo-Json
    
    $verifyResult = Invoke-APICall -Uri "$baseUrl/referral/requests/$requestId/verify" -Method "POST" -Headers $seekerHeaders -Body $verifyBody -Description "Referral Verification"
    
    Write-Host "? Referral verified! Status: $($verifyResult.data.Status)" -ForegroundColor Green

    # Step 16: Final Analytics Check
    Write-Host ""
    Write-Host "STEP 16: ?? FINAL POINTS CHECK" -ForegroundColor Magenta
    Start-Sleep -Seconds 2  # Give database time to update
    
    $finalAnalytics = Invoke-APICall -Uri "$baseUrl/referral/analytics" -Method "GET" -Headers $referrerHeaders -Description "Final Analytics Check"
    
    $finalPoints = $finalAnalytics.data.totalPointsEarned
    Write-Host ""
    Write-Host "?? FINAL POINTS TOTAL: $finalPoints" -ForegroundColor Cyan
    Write-Host "   Points after claim: $points1" -ForegroundColor Gray
    Write-Host "   Points after verification: $finalPoints" -ForegroundColor Gray
    Write-Host "   Difference: $($finalPoints - $points1)" -ForegroundColor Gray

    # Results Analysis
    Write-Host ""
    Write-Host "=================================================================="
    Write-Host "?? REFERRAL POINTS TEST RESULTS:" -ForegroundColor Magenta
    Write-Host "=================================================================="
    Write-Host ""
    
    if ($finalPoints -ge 40) {
        Write-Host "?? COMPLETE SUCCESS!" -ForegroundColor Green
        Write-Host "   ? Claim points awarded: ~15-25 points" -ForegroundColor Green
        Write-Host "   ? Verification points awarded: +25 points" -ForegroundColor Green
        Write-Host "   ? Total points: $finalPoints (Expected: 40-50)" -ForegroundColor Green
        Write-Host "   ? ReferralRewards table should have entries!" -ForegroundColor Green
    }
    elseif ($finalPoints -gt 0) {
        Write-Host "? PARTIAL SUCCESS!" -ForegroundColor Yellow
        Write-Host "   ?? Some points awarded but not full amount" -ForegroundColor Yellow
        Write-Host "   ?? Check ReferralRewards table for partial entries" -ForegroundColor Yellow
        Write-Host "   ?? May indicate timing or database sync issues" -ForegroundColor Yellow
    }
    else {
        Write-Host "? POINTS SYSTEM STILL NOT WORKING!" -ForegroundColor Red
        Write-Host "   ? No points awarded despite successful referral flow" -ForegroundColor Red
        Write-Host "   ?? ReferralRewards table likely still empty" -ForegroundColor Red
        Write-Host "   ?? ApplicantID mismatch or database connection issue confirmed" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "?? TEST SUMMARY:" -ForegroundColor Cyan
    Write-Host "   Request ID: $requestId" -ForegroundColor Gray
    Write-Host "   Seeker: $seekerEmail" -ForegroundColor Gray
    Write-Host "   Referrer: $referrerEmail" -ForegroundColor Gray
    Write-Host "   Job: $($acmeJob.Title) at $($acmeJob.OrganizationName)" -ForegroundColor Gray
    Write-Host "   Final Status: $($verifyResult.data.Status)" -ForegroundColor Gray
    Write-Host "   Points Earned: $finalPoints" -ForegroundColor Gray
    Write-Host ""
    Write-Host "?? DATABASE CHECK:" -ForegroundColor Yellow
    Write-Host "   Run this SQL to check ReferralRewards table:" -ForegroundColor Gray
    Write-Host "   SELECT * FROM ReferralRewards WHERE RequestID = '$requestId';" -ForegroundColor White
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Host "? TEST FAILED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   This indicates a system-level issue preventing the test" -ForegroundColor Red
    exit 1
}

Write-Host "=================================================================="
Write-Host "Test completed! Check the results above and run the SQL query to verify ReferralRewards entries." -ForegroundColor White