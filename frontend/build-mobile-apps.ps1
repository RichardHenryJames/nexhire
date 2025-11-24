# RefOpen Mobile App Build Script (PowerShell)
# This script automates the process of building Android and iOS apps

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("android", "ios", "both", "production-android", "production-ios")]
    [string]$Platform = "menu"
)

Write-Host "?? RefOpen Mobile App Builder" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the frontend directory
if (-not (Test-Path "package.json")) {
    Write-Host "? Error: Must be run from the frontend directory" -ForegroundColor Red
    Write-Host "Run: cd frontend; .\build-mobile-apps.ps1" -ForegroundColor Yellow
    exit 1
}

# Function to check if command exists
function Test-Command {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Check prerequisites
Write-Host "?? Checking prerequisites..." -ForegroundColor Cyan

if (-not (Test-Command "node")) {
    Write-Host "? Node.js is not installed" -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org" -ForegroundColor Yellow
    exit 1
}
$nodeVersion = node --version
Write-Host "? Node.js installed: $nodeVersion" -ForegroundColor Green

if (-not (Test-Command "npm")) {
    Write-Host "? npm is not installed" -ForegroundColor Red
    exit 1
}
$npmVersion = npm --version
Write-Host "? npm installed: $npmVersion" -ForegroundColor Green

# Check if EAS CLI is installed
if (-not (Test-Command "eas")) {
    Write-Host "??  EAS CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g eas-cli
    Write-Host "? EAS CLI installed" -ForegroundColor Green
} else {
    $easVersion = eas --version
    Write-Host "? EAS CLI installed: $easVersion" -ForegroundColor Green
}

# Function to build
function Start-Build {
    param([string]$BuildPlatform, [string]$Profile)
    
  Write-Host ""
    Write-Host "?? Starting build for $BuildPlatform ($Profile profile)..." -ForegroundColor Cyan
    
    try {
        eas build --platform $BuildPlatform --profile $Profile
        Write-Host ""
     Write-Host "? Build complete for $BuildPlatform!" -ForegroundColor Green
 } catch {
        Write-Host ""
        Write-Host "? Build failed: $_" -ForegroundColor Red
        exit 1
    }
}

# Interactive menu if no platform specified
if ($Platform -eq "menu") {
    Write-Host ""
    Write-Host "?? What would you like to build?" -ForegroundColor Cyan
    Write-Host "1) Android APK (Preview)" -ForegroundColor White
  Write-Host "2) iOS App (Preview)" -ForegroundColor White
    Write-Host "3) Both (Android + iOS)" -ForegroundColor White
    Write-Host "4) Production Android" -ForegroundColor White
    Write-Host "5) Production iOS" -ForegroundColor White
    Write-Host "6) Exit" -ForegroundColor White
Write-Host ""
    
 $choice = Read-Host "Enter your choice (1-6)"
    
  switch ($choice) {
        "1" {
 Start-Build -BuildPlatform "android" -Profile "preview"
        }
        "2" {
  Start-Build -BuildPlatform "ios" -Profile "preview"
      }
        "3" {
         Start-Build -BuildPlatform "all" -Profile "preview"
        }
        "4" {
     Start-Build -BuildPlatform "android" -Profile "production"
      }
        "5" {
            Start-Build -BuildPlatform "ios" -Profile "production"
        }
        "6" {
   Write-Host "?? Goodbye!" -ForegroundColor Cyan
    exit 0
        }
        default {
         Write-Host "? Invalid choice" -ForegroundColor Red
            exit 1
        }
    }
} else {
    # Direct platform specified via parameter
    switch ($Platform) {
   "android" {
      Start-Build -BuildPlatform "android" -Profile "preview"
        }
      "ios" {
            Start-Build -BuildPlatform "ios" -Profile "preview"
        }
        "both" {
      Start-Build -BuildPlatform "all" -Profile "preview"
     }
        "production-android" {
 Start-Build -BuildPlatform "android" -Profile "production"
      }
        "production-ios" {
    Start-Build -BuildPlatform "ios" -Profile "production"
        }
    }
}

Write-Host ""
Write-Host "?? Build process complete!" -ForegroundColor Green
Write-Host ""
Write-Host "?? Next steps:" -ForegroundColor Cyan
Write-Host "1. Check your Expo dashboard for build status" -ForegroundColor White
Write-Host "2. Download the build when ready" -ForegroundColor White
Write-Host "3. Install on your device" -ForegroundColor White
Write-Host ""
Write-Host "?? Expo Dashboard: https://expo.dev" -ForegroundColor Cyan
