# Build Android App Using Expo Website
# This bypasses the EAS CLI linking bug

Write-Host "?? Triggering Android Build via Expo Website..." -ForegroundColor Cyan
Write-Host ""
Write-Host "? Your project is ready:" -ForegroundColor Green
Write-Host "   Project: @parimalkumar/refopen" -ForegroundColor White
Write-Host "   ID: fd95890b-34f4-4da8-a4ca-bc95684b279f" -ForegroundColor White
Write-Host ""
Write-Host "?? To build your Android app:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1??  Open this link in your browser:" -ForegroundColor Yellow
Write-Host "   https://expo.dev/accounts/parimalkumar/projects/refopen/builds" -ForegroundColor Blue
Write-Host ""
Write-Host "2??  Click 'Create a build' button" -ForegroundColor Yellow
Write-Host ""
Write-Host "3??  Select:" -ForegroundColor Yellow
Write-Host "   • Platform: Android" -ForegroundColor White
Write-Host "   • Build profile: preview" -ForegroundColor White
Write-Host "   • Build type: APK" -ForegroundColor White
Write-Host ""
Write-Host "4??  Click 'Build' and wait 5-10 minutes" -ForegroundColor Yellow
Write-Host ""
Write-Host "5??  Download the APK when complete!" -ForegroundColor Yellow
Write-Host ""
Write-Host "?? Your app will be ready to install on any Android device!" -ForegroundColor Green
Write-Host ""

# Open the browser automatically
Start-Process "https://expo.dev/accounts/parimalkumar/projects/refopen/builds"
