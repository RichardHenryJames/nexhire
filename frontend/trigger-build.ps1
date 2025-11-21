#!/usr/bin/env pwsh

# Direct Expo API Build Trigger
# This bypasses the broken EAS CLI

Write-Host "?? Triggering build via Expo API..." -ForegroundColor Cyan

# Your project details
$projectId = "fd95890b-34f4-4da8-a4ca-bc95684b279f"
$username = "parimalkumar"
$projectSlug = "refopen"

Write-Host ""
Write-Host "?? Project: @$username/$projectSlug" -ForegroundColor White
Write-Host "?? Project ID: $projectId" -ForegroundColor White
Write-Host ""

# Get auth token
Write-Host "?? Getting authentication token..." -ForegroundColor Yellow
$authToken = eas whoami --json 2>$null | ConvertFrom-Json | Select-Object -ExpandProperty sessionToken

if (-not $authToken) {
    Write-Host "? Not authenticated. Please run: eas login" -ForegroundColor Red
    exit 1
}

Write-Host "? Authenticated as $username" -ForegroundColor Green
Write-Host ""

# Build request
Write-Host "?? Creating build request..." -ForegroundColor Yellow

$buildData = @{
    platform = "android"
    projectId = $projectId
  gitCommitHash = (git -C "C:\Users\parimalkumar\Desktop\Projects\nexhire" rev-parse HEAD)
    buildProfile = "preview"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $authToken"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod `
 -Uri "https://api.expo.dev/v2/builds" `
        -Method POST `
        -Headers $headers `
        -Body $buildData
    
    Write-Host ""
    Write-Host "? BUILD STARTED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "?? Build URL:" -ForegroundColor Cyan
    Write-Host "   https://expo.dev/accounts/$username/projects/$projectSlug/builds/$($response.id)" -ForegroundColor Blue
    Write-Host ""
    Write-Host "??  Estimated time: 5-10 minutes" -ForegroundColor Yellow
    Write-Host ""
 
    Start-Process "https://expo.dev/accounts/$username/projects/$projectSlug/builds"
    
} catch {
    Write-Host ""
    Write-Host "? API call failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "?? Please use the web interface:" -ForegroundColor Yellow
    Write-Host " https://expo.dev/accounts/$username/projects/$projectSlug/builds" -ForegroundColor Blue
    Write-Host ""
    Write-Host "?? Manual steps:" -ForegroundColor Cyan
    Write-Host "   1. Click in the center area of the page" -ForegroundColor White
    Write-Host "   2. Or look for 'New build' button" -ForegroundColor White
    Write-Host "   3. Select: Android, preview profile" -ForegroundColor White
    Write-Host "   4. Click 'Build'" -ForegroundColor White
}
