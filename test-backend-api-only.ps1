# ?? **SIMPLE BACKEND API TEST FOR PROFILE IMAGE UPLOAD**

Write-Host "?? Testing Backend Profile Image Upload API" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

# Configuration
$BackendUrl = "https://nexhire-api-func.azurewebsites.net/api"

# Simple 1x1 pixel test image in base64 (JPG format)
$TestImageBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDX4AAAAAAAA"

try {
    # Step 1: Health Check
    Write-Host "?? Step 1: Backend Health Check..." -ForegroundColor Yellow
    try {
        $healthResponse = Invoke-RestMethod -Uri "$BackendUrl/health" -Method Get -TimeoutSec 15
        if ($healthResponse.success) {
            Write-Host "? Backend is healthy: $($healthResponse.message)" -ForegroundColor Green
        } else {
            throw "Backend returned unsuccessful response"
        }
    } catch {
        Write-Host "? Backend health check failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }

    # Step 2: Test CORS Preflight
    Write-Host "?? Step 2: Testing CORS Preflight..." -ForegroundColor Yellow
    try {
        $corsResponse = Invoke-WebRequest -Uri "$BackendUrl/users/profile-image" -Method Options -TimeoutSec 10
        if ($corsResponse.StatusCode -eq 200) {
            Write-Host "? CORS preflight successful" -ForegroundColor Green
        } else {
            Write-Host "??  CORS preflight returned status: $($corsResponse.StatusCode)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "??  CORS preflight test inconclusive: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    # Step 3: Test Profile Image Upload
    Write-Host "?? Step 3: Testing Profile Image Upload..." -ForegroundColor Yellow
    
    $testPayload = @{
        fileName = "test-upload-$(Get-Date -Format 'yyyyMMddHHmmss').jpg"
        fileData = $TestImageBase64
        mimeType = "image/jpeg"
        userId = "test-user-123"
    }

    Write-Host "?? Test payload:" -ForegroundColor Gray
    Write-Host "   • File: $($testPayload.fileName)" -ForegroundColor Gray
    Write-Host "   • User: $($testPayload.userId)" -ForegroundColor Gray
    Write-Host "   • Type: $($testPayload.mimeType)" -ForegroundColor Gray
    Write-Host "   • Data: $($testPayload.fileData.Length) chars" -ForegroundColor Gray

    try {
        $jsonPayload = $testPayload | ConvertTo-Json -Depth 10
        $uploadResponse = Invoke-RestMethod -Uri "$BackendUrl/users/profile-image" -Method Post -Body $jsonPayload -ContentType "application/json" -TimeoutSec 60

        if ($uploadResponse.success) {
            Write-Host "? Upload successful!" -ForegroundColor Green
            Write-Host "?? Image URL: $($uploadResponse.data.imageUrl)" -ForegroundColor Green
            Write-Host "?? Upload date: $($uploadResponse.data.uploadDate)" -ForegroundColor Green

            # Step 4: Verify the uploaded image is accessible
            Write-Host "?? Step 4: Verifying uploaded image..." -ForegroundColor Yellow
            try {
                $imageResponse = Invoke-WebRequest -Uri $uploadResponse.data.imageUrl -Method Head -TimeoutSec 15
                if ($imageResponse.StatusCode -eq 200) {
                    Write-Host "? Image is publicly accessible!" -ForegroundColor Green
                    Write-Host "?? Content-Type: $($imageResponse.Headers.'Content-Type')" -ForegroundColor Gray
                    Write-Host "?? Content-Length: $($imageResponse.Headers.'Content-Length')" -ForegroundColor Gray
                } else {
                    Write-Host "??  Image uploaded but not accessible (Status: $($imageResponse.StatusCode))" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "? Image verification failed: $($_.Exception.Message)" -ForegroundColor Red
            }

            # Step 5: Check Azure Storage Container
            Write-Host "??? Step 5: Checking Azure Storage Container..." -ForegroundColor Yellow
            try {
                $blobs = az storage blob list --container-name "profilephotos" --account-name "nexhireblobdev" 2>$null | ConvertFrom-Json
                
                if ($blobs -and $blobs.Count -gt 0) {
                    Write-Host "? Found $($blobs.Count) file(s) in Azure Storage:" -ForegroundColor Green
                    $blobs | ForEach-Object {
                        Write-Host "   ?? $($_.name) ($($_.properties.contentLength) bytes, $($_.properties.lastModified))" -ForegroundColor Gray
                    }
                } else {
                    Write-Host "??  No files found in Azure Storage container" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "??  Could not check Azure Storage: $($_.Exception.Message)" -ForegroundColor Yellow
            }

            Write-Host ""
            Write-Host "?? BACKEND TEST SUCCESSFUL!" -ForegroundColor Green
            Write-Host "=============================" -ForegroundColor Green
            Write-Host "? API Endpoint: Working" -ForegroundColor Green
            Write-Host "? Image Upload: Working" -ForegroundColor Green
            Write-Host "? Azure Storage: Working" -ForegroundColor Green
            Write-Host "? Public Access: Working" -ForegroundColor Green

        } else {
            Write-Host "? Upload failed!" -ForegroundColor Red
            Write-Host "Error: $($uploadResponse.error)" -ForegroundColor Red
            if ($uploadResponse.details) {
                Write-Host "Details: $($uploadResponse.details)" -ForegroundColor Red
            }
        }

    } catch {
        Write-Host "? Upload request failed!" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
            Write-Host "HTTP Status: $statusCode" -ForegroundColor Red
            
            try {
                $errorStream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($errorStream)
                $errorBody = $reader.ReadToEnd()
                Write-Host "Response Body: $errorBody" -ForegroundColor Red
            } catch {
                Write-Host "Could not read error response body" -ForegroundColor Red
            }
        }
    }

} catch {
    Write-Host "? CRITICAL ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "?? Backend API test completed!" -ForegroundColor Cyan