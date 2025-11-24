# Build APK using local Gradle
# This is faster than using EAS if you have Android SDK installed
# It bypasses the need for EAS login and cloud queues

Write-Host "?? RefOpen Local APK Builder" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

# AUTO-DETECT LOCATION: Check if we need to move into 'frontend' folder
if (Test-Path "frontend") {
    Write-Host "?? Detected running from root, moving to frontend directory..." -ForegroundColor Yellow
    cd frontend
}

# Check if we're in the frontend directory (look for android folder)
if (-not (Test-Path "android")) {
    Write-Host "? Error: 'android' folder not found." -ForegroundColor Red
    Write-Host "Current location: $(Get-Location)" -ForegroundColor Yellow
    Write-Host "Please run: cd frontend" -ForegroundColor Yellow
    exit 1
}

# Navigate to android folder
cd android

# Clean previous builds
Write-Host "?? Cleaning previous builds..." -ForegroundColor Cyan
if (Test-Path "gradlew.bat") {
    .\gradlew.bat clean
} else {
    ./gradlew clean
}

# Build Debug APK
Write-Host "?? Building Debug APK..." -ForegroundColor Cyan
Write-Host "This may take a few minutes..." -ForegroundColor Yellow

if (Test-Path "gradlew.bat") {
    .\gradlew.bat assembleDebug
} else {
    ./gradlew assembleDebug
}

if ($?) {
    Write-Host ""
    Write-Host "? Build Successful!" -ForegroundColor Green
    
    # Find the APK
    $apkPath = "app/build/outputs/apk/debug/app-debug.apk"
    
    if (Test-Path $apkPath) {
        $fullPath = Resolve-Path $apkPath
        Write-Host "APK location: $fullPath" -ForegroundColor White
        
        # Copy to frontend root for easy access
        Copy-Item $apkPath ../refopen-debug.apk
        Write-Host "? Copied to frontend/refopen-debug.apk" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "To install on connected device:" -ForegroundColor Cyan
        Write-Host "adb install -r ../refopen-debug.apk" -ForegroundColor White
    } else {
        Write-Host "? Could not locate the generated APK file." -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "? Build Failed." -ForegroundColor Red
    Write-Host "Check the error log above." -ForegroundColor Yellow
}

# Return to original directory if we changed it
if (Test-Path "../frontend") {
    cd ..
}
cd ..
