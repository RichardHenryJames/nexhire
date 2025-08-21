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

# Set app settings to enable remote build (Oryx)
Write-Host "Configuring Function App for remote build..." -ForegroundColor Yellow
az functionapp config appsettings set `
  --name $FunctionAppName `
  --resource-group $ResourceGroup `
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true ENABLE_ORYX_BUILD=true WEBSITE_RUN_FROM_PACKAGE=1 `
  | Out-Null

# Quick dependency install if missing (omit dev deps to speed up)
if (-not (Test-Path "node_modules")) {
  Write-Host "Installing production dependencies (omit dev)..." -ForegroundColor Yellow
  npm ci --omit=dev
}

# Prefer remote build to avoid local build hangs
Write-Host "Publishing with remote build..." -ForegroundColor Green
# --typescript informs language; --build remote avoids local tsc and uses Kudu/Oryx
func azure functionapp publish $FunctionAppName --typescript --build remote --publish-local-settings -y

Write-Host "Deployment finished. Logs saved to: $logFile" -ForegroundColor Green
Write-Host "API base: https://$FunctionAppName.azurewebsites.net/api" -ForegroundColor Cyan

try { Stop-Transcript | Out-Null } catch {}