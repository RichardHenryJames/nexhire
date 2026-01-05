# ============================================================================
# JOB ARCHIVAL MANUAL TEST
# ============================================================================
# Tests the job archival API endpoint
# Requirements: Admin credentials (admin@refopen.com)
# Usage: .\test-job-archival.ps1
# ============================================================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "    JOB ARCHIVAL MANUAL TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Login
Write-Host "`n1. Logging in..." -ForegroundColor Yellow

# Get admin password from Key Vault
$AdminPassword = az keyvault secret show --vault-name "refopen-keyvault-prod" --name "AdminPassword" --query "value" -o tsv 2>$null
if (-not $AdminPassword) {
    $AdminPassword = Read-Host "Enter admin password" -AsSecureString | ConvertFrom-SecureString -AsPlainText
}

$loginData = @{
    email = "admin@refopen.com"
    password = $AdminPassword
}
$loginJson = $loginData | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "https://refopen-api-func.azurewebsites.net/api/auth/login" `
        -Method POST `
        -Body $loginJson `
        -ContentType "application/json" `
        -UseBasicParsing

    $loginResult = $loginResponse.Content | ConvertFrom-Json
    
    if ($loginResult.success -and $loginResult.data.tokens.accessToken) {
        $token = $loginResult.data.tokens.accessToken
        Write-Host "SUCCESS! Login successful" -ForegroundColor Green
        Write-Host "User: $($loginResult.data.user.Email)" -ForegroundColor Gray
        Write-Host "Type: $($loginResult.data.user.UserType)" -ForegroundColor Gray
        Write-Host "Token: $($token.Substring(0,50))..." -ForegroundColor Gray
    } else {
        Write-Host "ERROR: No token in response" -ForegroundColor Red
        Write-Host "Response: $($loginResponse.Content)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Login failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Step 2: Trigger Archival
Write-Host "`n2. Triggering job archival (60 days, batch 100)..." -ForegroundColor Yellow

$archiveData = @{
    daysOld = 60
}
$archiveJson = $archiveData | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
}

try {
    $archiveResponse = Invoke-WebRequest -Uri "https://refopen-api-func.azurewebsites.net/api/jobs/archive/trigger" `
        -Method POST `
        -Body $archiveJson `
        -ContentType "application/json" `
        -Headers $headers `
        -UseBasicParsing

    $result = $archiveResponse.Content | ConvertFrom-Json

    Write-Host "`nRESULTS:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Success: $($result.success)" -ForegroundColor $(if($result.success){"Green"}else{"Red"})
    Write-Host "Message: $($result.message)" -ForegroundColor White

    if ($result.data) {
        Write-Host "`nStatistics:" -ForegroundColor Yellow
        Write-Host "  Jobs Found: $($result.data.totalJobsFound)"
        Write-Host "  Successfully Archived: $($result.data.totalJobsArchived)" -ForegroundColor Green
        Write-Host "  Deleted from SQL: $($result.data.totalJobsDeleted)" -ForegroundColor Green
        
        if ($result.data.errors -and $result.data.errors.Count -gt 0) {
            Write-Host "`nErrors ($($result.data.errors.Count)):" -ForegroundColor Red
            $result.data.errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
        }
        
        if ($result.data.archivedJobIds -and $result.data.archivedJobIds.Count -gt 0) {
            Write-Host "`nArchived Job IDs (showing first 5):" -ForegroundColor Cyan
            $result.data.archivedJobIds | Select-Object -First 5 | ForEach-Object { Write-Host "  � $_" -ForegroundColor Gray }
            if ($result.data.archivedJobIds.Count -gt 5) {
                Write-Host "  ... and $($result.data.archivedJobIds.Count - 5) more" -ForegroundColor Gray
            }
        }
    }
    Write-Host "========================================" -ForegroundColor Cyan
} catch {
    Write-Host "`nERROR: Archival failed" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
        Write-Host "Status Code: $statusCode" -ForegroundColor Red
        
        # Try to get error response body
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $reader.BaseStream.Position = 0
            $responseBody = $reader.ReadToEnd()
            Write-Host "`nError Response:" -ForegroundColor Yellow
            Write-Host $responseBody -ForegroundColor Yellow
        } catch {}
        
        if ($statusCode -eq 403) {
            Write-Host "`nPossible causes:" -ForegroundColor Yellow
            Write-Host "  - User is not an Admin" -ForegroundColor Yellow
            Write-Host "  - Token is invalid or expired" -ForegroundColor Yellow
        } elseif ($statusCode -eq 500) {
            Write-Host "`nPossible causes:" -ForegroundColor Yellow
            Write-Host "  - Azure Storage connection not configured" -ForegroundColor Yellow
            Write-Host "  - Database connection issue" -ForegroundColor Yellow
            Write-Host "  - Service internal error" -ForegroundColor Yellow
        }
    }
}

Write-Host "`nTest Complete!" -ForegroundColor Green
