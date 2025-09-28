# ?? NexHire Environment Manager
# Manage both frontend and backend environments easily

param(
    [string]$Environment = "",
    [string]$Component = "both", # frontend, backend, or both
    [switch]$Status,
    [switch]$Validate,
    [switch]$List
)

Write-Host "?? NexHire Environment Manager" -ForegroundColor Green
Write-Host ""

# Define valid environments
$ValidEnvs = @("dev", "development", "staging", "prod", "production")

function Show-Usage {
    Write-Host "?? Usage Examples:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  # Switch both frontend and backend to development"
    Write-Host "  .\manage-env.ps1 dev" -ForegroundColor White
    Write-Host ""
    Write-Host "  # Switch only frontend to staging"
    Write-Host "  .\manage-env.ps1 staging -Component frontend" -ForegroundColor White
    Write-Host ""
    Write-Host "  # Show environment status"
    Write-Host "  .\manage-env.ps1 -Status" -ForegroundColor White
    Write-Host ""
    Write-Host "  # List all available environments"
    Write-Host "  .\manage-env.ps1 -List" -ForegroundColor White
    Write-Host ""
    Write-Host "?? Valid Environments: dev, staging, prod" -ForegroundColor Cyan
    Write-Host "?? Valid Components: frontend, backend, both" -ForegroundColor Cyan
}

function Get-EnvironmentFiles {
    $frontendFiles = @{
        "dev" = "frontend/.env.dev"
        "staging" = "frontend/.env.staging" 
        "prod" = "frontend/.env.prod"
        "current" = "frontend/.env"
    }
    
    $backendFiles = @{
        "dev" = ".env.dev"
        "staging" = ".env.staging"
        "prod" = ".env.prod" 
        "current" = ".env"
    }
    
    return @{
        "frontend" = $frontendFiles
        "backend" = $backendFiles
    }
}

function Show-EnvironmentStatus {
    Write-Host "?? Environment Status:" -ForegroundColor Cyan
    Write-Host ""
    
    $files = Get-EnvironmentFiles
    
    # Frontend status
    Write-Host "??? Frontend:" -ForegroundColor Yellow
    foreach ($env in @("dev", "staging", "prod", "current")) {
        $file = $files.frontend[$env]
        $exists = Test-Path $file
        $status = if ($exists) { "?" } else { "?" }
        $label = if ($env -eq "current") { "$env (.env)" } else { $env }
        
        Write-Host "  $label`: $status $file" -ForegroundColor $(if ($exists) { "Green" } else { "Red" })
        
        if ($exists -and $env -eq "current") {
            try {
                $content = Get-Content $file -Raw -ErrorAction Stop
                if ($content -match "EXPO_PUBLIC_APP_ENV=(.+)") {
                    $currentEnv = $matches[1].Trim()
                    Write-Host "    Environment: $currentEnv" -ForegroundColor Gray
                }
                if ($content -match "EXPO_PUBLIC_API_URL=(.+)") {
                    $apiUrl = $matches[1].Trim()
                    Write-Host "    API URL: $apiUrl" -ForegroundColor Gray
                }
            } catch {
                Write-Host "    Could not read file content" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
    
    # Backend status  
    Write-Host "?? Backend:" -ForegroundColor Yellow
    foreach ($env in @("dev", "staging", "prod", "current")) {
        $file = $files.backend[$env]
        $exists = Test-Path $file
        $status = if ($exists) { "?" } else { "?" }
        $label = if ($env -eq "current") { "$env (.env)" } else { $env }
        
        Write-Host "  $label`: $status $file" -ForegroundColor $(if ($exists) { "Green" } else { "Red" })
        
        if ($exists -and $env -eq "current") {
            try {
                $content = Get-Content $file -Raw -ErrorAction Stop
                if ($content -match "NEXHIRE_ENV=(.+)") {
                    $currentEnv = $matches[1].Trim()
                    Write-Host "    Environment: $currentEnv" -ForegroundColor Gray
                }
                if ($content -match "DB_SERVER=(.+)") {
                    $dbServer = $matches[1].Trim()
                    Write-Host "    Database: $dbServer" -ForegroundColor Gray
                }
            } catch {
                Write-Host "    Could not read file content" -ForegroundColor Red
            }
        }
    }
}

function Switch-Environment {
    param(
        [string]$TargetEnv,
        [string]$Component
    )
    
    # Normalize environment name
    $normalizedEnv = switch ($TargetEnv.ToLower()) {
        { $_ -in @("dev", "development") } { "dev" }
        "staging" { "staging" }
        { $_ -in @("prod", "production") } { "prod" }
        default { $TargetEnv }
    }
    
    if ($normalizedEnv -notin @("dev", "staging", "prod")) {
        Write-Host "? Invalid environment: $TargetEnv" -ForegroundColor Red
        Write-Host "Valid environments: dev, staging, prod" -ForegroundColor Yellow
        return
    }
    
    $files = Get-EnvironmentFiles
    
    Write-Host "?? Switching to $normalizedEnv environment..." -ForegroundColor Green
    Write-Host ""
    
    # Switch frontend
    if ($Component -in @("frontend", "both")) {
        $sourceFile = $files.frontend[$normalizedEnv]
        $targetFile = $files.frontend["current"]
        
        if (Test-Path $sourceFile) {
            # Backup current .env
            if (Test-Path $targetFile) {
                $timestamp = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
                $backupFile = "frontend/.env.backup.$timestamp"
                Copy-Item $targetFile $backupFile -Force
                Write-Host "?? Frontend: Backed up current .env to $backupFile" -ForegroundColor Yellow
            }
            
            Copy-Item $sourceFile $targetFile -Force
            Write-Host "? Frontend: Switched to $normalizedEnv ($sourceFile ? $targetFile)" -ForegroundColor Green
        } else {
            Write-Host "? Frontend: Environment file not found: $sourceFile" -ForegroundColor Red
        }
    }
    
    # Switch backend
    if ($Component -in @("backend", "both")) {
        $sourceFile = $files.backend[$normalizedEnv]
        $targetFile = $files.backend["current"]
        
        if (Test-Path $sourceFile) {
            # Backup current .env
            if (Test-Path $targetFile) {
                $timestamp = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
                $backupFile = ".env.backup.$timestamp"
                Copy-Item $targetFile $backupFile -Force
                Write-Host "?? Backend: Backed up current .env to $backupFile" -ForegroundColor Yellow
            }
            
            Copy-Item $sourceFile $targetFile -Force
            Write-Host "? Backend: Switched to $normalizedEnv ($sourceFile ? $targetFile)" -ForegroundColor Green
        } else {
            Write-Host "? Backend: Environment file not found: $sourceFile" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "?? Environment switch completed!" -ForegroundColor Green
    Write-Host ""
    
    # Show current status
    Show-EnvironmentStatus
}

function Show-AvailableEnvironments {
    Write-Host "?? Available Environments:" -ForegroundColor Cyan
    Write-Host ""
    
    $envDescriptions = @{
        "dev" = "Development environment (localhost, debug enabled, test keys)"
        "staging" = "Staging environment (staging server, debug enabled, test keys)"  
        "prod" = "Production environment (live server, debug disabled, live keys)"
    }
    
    foreach ($env in @("dev", "staging", "prod")) {
        Write-Host "?? $env" -ForegroundColor Green
        Write-Host "  $($envDescriptions[$env])" -ForegroundColor Gray
        
        # Check if files exist
        $frontendFile = "frontend/.env.$env"
        $backendFile = ".env.$env"
        $frontendExists = Test-Path $frontendFile
        $backendExists = Test-Path $backendFile
        
        Write-Host "  Frontend: $(if ($frontendExists) { '?' } else { '?' }) $frontendFile" -ForegroundColor $(if ($frontendExists) { 'Green' } else { 'Red' })
        Write-Host "  Backend:  $(if ($backendExists) { '?' } else { '?' }) $backendFile" -ForegroundColor $(if ($backendExists) { 'Green' } else { 'Red' })
        Write-Host ""
    }
}

# Main script logic
if ($Status) {
    Show-EnvironmentStatus
} elseif ($List) {
    Show-AvailableEnvironments
} elseif ($Environment -ne "") {
    if ($Environment -notin $ValidEnvs) {
        Write-Host "? Invalid environment: $Environment" -ForegroundColor Red
        Write-Host "Valid environments: $($ValidEnvs -join ', ')" -ForegroundColor Yellow
        Write-Host ""
        Show-Usage
        exit 1
    }
    
    Switch-Environment -TargetEnv $Environment -Component $Component
} else {
    Show-Usage
    Write-Host ""
    Show-EnvironmentStatus
}

Write-Host ""
Write-Host "?? Quick Commands:" -ForegroundColor Yellow
Write-Host "  .\manage-env.ps1 dev              # Switch to development"
Write-Host "  .\manage-env.ps1 staging          # Switch to staging" 
Write-Host "  .\manage-env.ps1 prod             # Switch to production"
Write-Host "  .\manage-env.ps1 -Status          # Show current status"