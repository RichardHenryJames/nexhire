param(
    [string]$Environment = "dev",  # dev, staging, production
    [string]$Message = ""          # OTA update message
)

$ErrorActionPreference = "Stop"

Write-Host "=== RefOpen OTA App Update ===" -ForegroundColor Cyan

# Normalize environment
$normalizedEnv = switch ($Environment.ToLower()) {
    { $_ -in @("dev", "development", "staging", "preview") } { "dev" }
    { $_ -in @("prod", "production") } { "prod" }
    default { "dev" }
}

# Safety: Production deployments must be from master branch
if ($normalizedEnv -eq "prod") {
    $currentBranch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
    if ($currentBranch -ne "master") {
        Write-Host ""
        Write-Host "❌ BLOCKED: Production deployment must be from 'master' branch!" -ForegroundColor Red
        Write-Host "   Current branch: $currentBranch" -ForegroundColor Yellow
        Write-Host "   Switch to master first: git checkout master" -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
    Write-Host "✅ Branch check: master" -ForegroundColor Green
}

# Map environment to EAS branch and env file
$config = switch ($normalizedEnv) {
    "dev" {
        @{
            Branch = "preview"
            EnvFile = ".env.dev"
            AppEnv = "staging"
            Label = "Staging (Dev API)"
            ApiTarget = "refopen-api-func-dev"
        }
    }
    "prod" {
        @{
            Branch = "production"
            EnvFile = ".env.prod"
            AppEnv = "production"
            Label = "Production"
            ApiTarget = "refopen-api-func"
        }
    }
}

# Default message
if (-not $Message) {
    $Message = "OTA update - $($config.Label)"
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "        OTA UPDATE CONFIGURATION                        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target:      $($config.Label)" -ForegroundColor $(if ($normalizedEnv -eq "prod") { "Red" } else { "Green" })
Write-Host "EAS Branch:  $($config.Branch)" -ForegroundColor White
Write-Host "Env File:    $($config.EnvFile)" -ForegroundColor White
Write-Host "APP_ENV:     $($config.AppEnv)" -ForegroundColor White
Write-Host "API Target:  $($config.ApiTarget)" -ForegroundColor White
Write-Host "Message:     $Message" -ForegroundColor White
Write-Host ""

# Production safety check
if ($normalizedEnv -eq "prod") {
    Write-Host "⚠️  WARNING: You are about to OTA update the PRODUCTION app!" -ForegroundColor Red
    $confirm = Read-Host "Type 'yes' to confirm"
    if ($confirm -ne "yes") {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Switch to frontend directory
Set-Location "frontend"

# Step 1: Copy correct .env file
Write-Host "`nSwitching to $($config.EnvFile)..." -ForegroundColor Yellow
if (Test-Path $config.EnvFile) {
    Copy-Item $config.EnvFile ".env" -Force
    Write-Host "✅ Copied $($config.EnvFile) -> .env" -ForegroundColor Green
    
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "EXPO_PUBLIC_API_URL=(.+)") {
        Write-Host "   API URL: $($matches[1].Trim())" -ForegroundColor Gray
    }
    if ($envContent -match "EXPO_PUBLIC_APP_ENV=(.+)") {
        Write-Host "   App Env: $($matches[1].Trim())" -ForegroundColor Gray
    }
} else {
    Write-Error "❌ $($config.EnvFile) not found!"
    exit 1
}

# Step 2: Set environment variables for EAS
$env:EXPO_PUBLIC_APP_ENV = $config.AppEnv

# Step 3: Run EAS update
Write-Host "`nRunning OTA update..." -ForegroundColor Yellow
Write-Host "   Branch: $($config.Branch)" -ForegroundColor White
Write-Host "   Message: $Message" -ForegroundColor White
Write-Host ""

npx eas update --branch $config.Branch --message $Message

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ OTA update failed!"
    Set-Location ..
    exit 1
}

# Step 4: Restore .env to prod (safe default)
Copy-Item ".env.prod" ".env" -Force
Write-Host "`n✅ Restored .env back to production (safe default)" -ForegroundColor Green

Set-Location ..

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "        OTA UPDATE COMPLETED SUCCESSFULLY               " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target:  $($config.Label)" -ForegroundColor Green
Write-Host "Branch:  $($config.Branch)" -ForegroundColor White
Write-Host "Message: $Message" -ForegroundColor White
Write-Host ""
Write-Host "The app will auto-update on next launch." -ForegroundColor Gray
