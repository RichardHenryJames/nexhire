# Quick Build Script - Run this to trigger build via CLI
Write-Host "?? Triggering Android Build..." -ForegroundColor Cyan

Set-Location "C:\Users\parimalkumar\Desktop\Projects\nexhire\frontend"

# Make sure you're logged in
$whoami = eas whoami 2>&1
if ($whoami -match "Not logged in") {
    Write-Host "Please login first:" -ForegroundColor Yellow
    eas login
}

Write-Host ""
Write-Host "Starting build..." -ForegroundColor Green
Write-Host "This will use the latest commit from 'app' branch" -ForegroundColor White
Write-Host ""

# Trigger build
eas build --platform android --profile preview --non-interactive

Write-Host ""
Write-Host "? Build submitted!" -ForegroundColor Green
Write-Host "Check status at: https://expo.dev/accounts/parimalkumar/projects/refopen/builds" -ForegroundColor Cyan
