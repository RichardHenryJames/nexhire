# Force Create Build - Bypass CLI Bug
# This uses Expo's REST API directly

$projectId = "fd95890b-34f4-4da8-a4ca-bc95684b279f"

Write-Host "?? Starting build via Expo API..." -ForegroundColor Cyan
Write-Host ""

# Get Expo session token
Write-Host "?? Getting your Expo session token..." -ForegroundColor Yellow
$token = eas config --print-json | ConvertFrom-Json | Select-Object -ExpandProperty sessionToken

if (-not $token) {
    Write-Host "? Not logged in. Logging in..." -ForegroundColor Red
    eas login
}

Write-Host ""
Write-Host "?? Triggering Android build..." -ForegroundColor Cyan

# Navigate to project directory
Set-Location "C:\Users\parimalkumar\Desktop\Projects\nexhire\frontend"

# Use eas-cli directly with project ID
eas build --platform android --profile preview --no-wait --id $projectId

Write-Host ""
Write-Host "? Build triggered! Check status at:" -ForegroundColor Green
Write-Host "   https://expo.dev/accounts/parimalkumar/projects/refopen/builds" -ForegroundColor Blue
