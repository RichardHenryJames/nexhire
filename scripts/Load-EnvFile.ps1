# ================================================================
# Load Environment Variables from .env.prod file
# ================================================================
# Usage: . .\scripts\Load-EnvFile.ps1
# Then run your script: .\setup-database.ps1
# ================================================================

param(
    [string]$EnvFile = ".env.prod",
    [switch]$Verbose
)

$envPath = Join-Path $PSScriptRoot "..\$EnvFile"
if (-not (Test-Path $envPath)) {
    $envPath = Join-Path (Get-Location) $EnvFile
}

if (-not (Test-Path $envPath)) {
    Write-Error "❌ Environment file not found: $EnvFile"
    Write-Host "Expected at: $envPath" -ForegroundColor Yellow
    exit 1
}

Write-Host "📂 Loading environment from: $envPath" -ForegroundColor Cyan

$loaded = 0
Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    
    # Skip comments and empty lines
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    
    # Skip Key Vault references (they don't work locally)
    if ($line -match "@Microsoft\.KeyVault") {
        if ($Verbose) {
            Write-Host "⏭️ Skipping Key Vault ref: $($line.Split('=')[0])" -ForegroundColor DarkGray
        }
        return
    }
    
    # Parse KEY=VALUE
    if ($line -match "^([^=]+)=(.*)$") {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        
        # Remove quotes if present
        $value = $value -replace '^["'']|["'']$', ''
        
        # Set environment variable
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
        $loaded++
        
        if ($Verbose) {
            $displayValue = if ($key -match "PASSWORD|SECRET|KEY|CONNECTION") { "****" } else { $value.Substring(0, [Math]::Min(50, $value.Length)) }
            Write-Host "  ✅ $key = $displayValue" -ForegroundColor Gray
        }
    }
}

Write-Host "✅ Loaded $loaded environment variables" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  NOTE: Key Vault references are skipped when loading locally." -ForegroundColor Yellow
Write-Host "    For secrets, use: . .\scripts\Load-DbCredentials.ps1" -ForegroundColor Yellow
Write-Host ""
