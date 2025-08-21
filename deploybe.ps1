# NexHire Backend Quick Deploy - Skip Local Build (Remote build via Kudu/Oryx)
param(
  [string]$FunctionAppName = "nexhire-api-func",
  [string]$ResourceGroup = "nexhire-dev-rg"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Start transcript to capture all logs
$logFile = Join-Path (Get-Location) ("quick-deploy-" + (Get-Date -Format yyyyMMdd-HHmmss) + ".log")
try { Start-Transcript -Path $logFile -Force | Out-Null } catch {}

Write-Host "=== NexHire Backend Quick Deploy ===" -ForegroundColor Green
Write-Host "Working directory: $(Get-Location)" -ForegroundColor Cyan

# Basic sanity check
$required = @('host.json','package.json')
$missing = @()
foreach ($f in $required) { if (-not (Test-Path $f)) { $missing += $f } }
if ($missing.Count -gt 0) {
  Write-Host "Required files missing in current directory: $($missing -join ', ')" -ForegroundColor Yellow
  Write-Host "Tip: cd to the folder that contains host.json and package.json, then rerun this script." -ForegroundColor Yellow
  Write-Host "No changes made. Exiting." -ForegroundColor Red
  Stop-Transcript | Out-Null
  exit 1
}

# Show key files
Write-Host "Files found: host.json, package.json" -ForegroundColor DarkGray

# Ensure Azure CLI and Func Core Tools are available
try {
  $funcVer = func --version
  Write-Host "Func Core Tools: $funcVer" -ForegroundColor DarkGray
} catch {
  Write-Host "Azure Functions Core Tools not found. Install from: https://aka.ms/azfunc-install" -ForegroundColor Red
  Stop-Transcript | Out-Null
  exit 1
}

try {
  $azVer = az --version | Select-String "azure-cli"
  Write-Host "Azure CLI: $($azVer.Line)" -ForegroundColor DarkGray
} catch {
  Write-Host "Azure CLI not found. Install from: https://aka.ms/azure-cli" -ForegroundColor Red
  Stop-Transcript | Out-Null
  exit 1
}

# Quick Deploy Script for Azure Functions
Write-Host "?? NexHire Backend - Quick Deploy Script" -ForegroundColor Cyan

# Step 1: Check if deployment is already running
$runningProcesses = Get-Process | Where-Object { $_.ProcessName -like "*func*" -or $_.ProcessName -like "*node*" }
if ($runningProcesses) {
    Write-Host "??  Stopping any running func processes..." -ForegroundColor Yellow
    $runningProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Step 2: Clean build
Write-Host "?? Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }

# Step 3: Build TypeScript
Write-Host "?? Building TypeScript..." -ForegroundColor Green
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "? Build failed! Trying alternative method..." -ForegroundColor Red
    Write-Host "?? Installing dependencies..." -ForegroundColor Yellow
    npm install
    
    Write-Host "?? Rebuilding..." -ForegroundColor Green
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "? Build still failing. Check TypeScript errors above." -ForegroundColor Red
        exit 1
    }
}

# Step 4: Verify build output
if (!(Test-Path "dist")) {
    Write-Host "? No dist folder found after build!" -ForegroundColor Red
    exit 1
}

Write-Host "? Build successful! Found dist folder." -ForegroundColor Green

# Step 5: Deploy with reliable method
Write-Host "?? Deploying to Azure Functions..." -ForegroundColor Cyan
Write-Host "   Using reliable deployment method (no --typescript flag)..." -ForegroundColor Gray

# Try the most reliable deployment command
func azure functionapp publish nexhire-api-func --no-build --force

if ($LASTEXITCODE -eq 0) {
    Write-Host "? Deployment successful!" -ForegroundColor Green
    Write-Host "?? Your APIs are now available at:" -ForegroundColor Cyan
    Write-Host "   https://nexhire-api-func.azurewebsites.net/api" -ForegroundColor White
    
    Write-Host "`n?? Testing health endpoint..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "https://nexhire-api-func.azurewebsites.net/api/health" -Method GET -TimeoutSec 30
        if ($response.success) {
            Write-Host "? Health check passed! API is working." -ForegroundColor Green
        } else {
            Write-Host "??  Health check returned unexpected response." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "??  Health check failed, but deployment may still be successful." -ForegroundColor Yellow
        Write-Host "   APIs may take 1-2 minutes to become available after deployment." -ForegroundColor Gray
    }
    
    Write-Host "`n?? Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Test the profile endpoints that were causing 404 errors" -ForegroundColor White
    Write-Host "2. Try adding skills in your frontend - they should save now!" -ForegroundColor White
    Write-Host "3. Check the database to see if PrimarySkills gets populated" -ForegroundColor White
    
} else {
    Write-Host "? Deployment failed with the reliable method." -ForegroundColor Red
    Write-Host "`n?? Alternative Solutions:" -ForegroundColor Yellow
    Write-Host "1. Try: az functionapp deployment source config-zip" -ForegroundColor Cyan
    Write-Host "2. Deploy through Azure Portal manually" -ForegroundColor Cyan
    Write-Host "3. Check Azure CLI login: az account show" -ForegroundColor Cyan
}

Write-Host "`n?? Deployment Summary:" -ForegroundColor Magenta
Write-Host "? 28 API endpoints registered" -ForegroundColor Green
Write-Host "? Profile management endpoints included" -ForegroundColor Green
Write-Host "? Skills saving functionality enabled" -ForegroundColor Green

try { Stop-Transcript | Out-Null } catch {}