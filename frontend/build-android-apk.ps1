# RefOpen Android APK Build Script
# Automates the process of building a local Android APK

$ErrorActionPreference = "Stop"

Write-Host "?? RefOpen Android APK Builder" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the frontend directory
if (-not (Test-Path "package.json")) {
    Write-Host "? Error: Must be run from the frontend directory" -ForegroundColor Red
    exit 1
}

# Check prerequisites
Write-Host "?? Checking prerequisites..." -ForegroundColor Cyan

# Check for EAS CLI
if (-not (Get-Command "eas" -ErrorAction SilentlyContinue)) {
    Write-Host "??  EAS CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g eas-cli
    if (-not $?) {
        Write-Host "? Failed to install EAS CLI" -ForegroundColor Red
        exit 1
    }
}

# Build APK
Write-Host "?? Starting Android APK build..." -ForegroundColor Cyan
Write-Host "This will create a standalone APK file you can install on your device." -ForegroundColor Yellow
Write-Host ""

try {
    # Using 'preview' profile which is configured for APK generation in eas.json
    eas build --platform android --profile preview --local
    
    Write-Host ""
    Write-Host "? Build process completed!" -ForegroundColor Green
    Write-Host "Check the output above for the location of your APK file." -ForegroundColor White
} catch {
    Write-Host ""
    Write-Host "? Build failed: $_" -ForegroundColor Red
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "1. Docker not running (required for local builds)" -ForegroundColor White
    Write-Host "2. Java/Android SDK configuration issues" -ForegroundColor White
    Write-Host ""
    Write-Host "Trying cloud build instead..." -ForegroundColor Cyan
    
    $response = Read-Host "Do you want to try a cloud build? (y/n)"
    if ($response -eq "y") {
        eas build --platform android --profile preview
    }
}
