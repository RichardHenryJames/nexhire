# ?? NexHire Documentation & Scripts Cleanup
# Removes redundant documentation and script files

param(
    [switch]$DryRun,
    [switch]$Force
)

Write-Host "?? NexHire Documentation & Scripts Cleanup" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

# Define redundant files to remove
$filesToRemove = @(
    # Redundant documentation (replaced by comprehensive guides)
    "docs/GOOGLE_SIGNIN_SETUP.md",
    "docs/FIREBASE_GOOGLE_SETUP.md", 
    "docs/GOOGLE_SIGNIN_COMPLETE.md",
    "docs/CONFIGURATION_GUIDE.md",
    "docs/CLEANUP_SUMMARY.md",
    
    # Redundant scripts (functionality moved to main scripts)
    "setup-env.ps1",
    "frontend/scripts/switch-env.js",
    "frontend/scripts/env-status.js",
    
    # Redundant deployment scripts (unified in main deploy scripts)
    "deployfe.ps1",  # Root level (duplicate of frontend/deployfe.ps1)
    
    # This cleanup script itself (after running)
    "cleanup-env.ps1"
)

# Essential files to keep
$filesToKeep = @(
    # Core documentation
    "docs/MULTI_ENVIRONMENT_GUIDE.md",      # Main environment guide
    "docs/DEPLOYMENT_COMMANDS.md",          # Deployment reference
    
    # Core management scripts
    "manage-env.ps1",                       # Environment switcher
    "deploy.ps1",                           # Main deployment script
    "deploy-backend.ps1",                   # Backend deployment
    "frontend/deployfe.ps1",                # Frontend deployment
    
    # Database scripts
    "database_scripts/google-oauth-schema-update.sql",
    "database_scripts/update-google-oauth.ps1"
)

function Get-FileSize {
    param([string]$FilePath)
    try {
        $file = Get-Item $FilePath -ErrorAction Stop
        return [math]::Round($file.Length / 1KB, 2)
    } catch {
        return 0
    }
}

function Show-CleanupPlan {
    Write-Host "?? Cleanup Plan - Removing Redundant Files:" -ForegroundColor Yellow
    Write-Host ""
    
    $totalSizeSaved = 0
    $filesFound = 0
    
    # Documentation files to remove
    Write-Host "?? Documentation Files to Remove:" -ForegroundColor Red
    foreach ($file in $filesToRemove) {
        if ($file -like "docs/*" -and (Test-Path $file)) {
            $size = Get-FileSize $file
            $totalSizeSaved += $size
            $filesFound++
            Write-Host "  ? $file ($size KB) - Replaced by MULTI_ENVIRONMENT_GUIDE.md" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "??? Script Files to Remove:" -ForegroundColor Red
    foreach ($file in $filesToRemove) {
        if ($file -like "*.ps1" -or $file -like "*.js") {
            if (Test-Path $file) {
                $size = Get-FileSize $file
                $totalSizeSaved += $size
                $filesFound++
                
                $reason = switch ($file) {
                    "setup-env.ps1" { "Functionality moved to manage-env.ps1" }
                    "frontend/scripts/switch-env.js" { "Replaced by PowerShell scripts" }
                    "frontend/scripts/env-status.js" { "Functionality in manage-env.ps1" }
                    "deployfe.ps1" { "Duplicate of frontend/deployfe.ps1" }
                    "cleanup-env.ps1" { "One-time cleanup script" }
                    default { "Redundant functionality" }
                }
                
                Write-Host "  ? $file ($size KB) - $reason" -ForegroundColor Red
            }
        }
    }
    
    if ($filesFound -eq 0) {
        Write-Host "  ? No redundant files found - workspace is already clean!" -ForegroundColor Green
        return $false
    }
    
    Write-Host ""
    Write-Host "?? Cleanup Summary:" -ForegroundColor Cyan
    Write-Host "  Files to remove: $filesFound" -ForegroundColor White
    Write-Host "  Space to save: $totalSizeSaved KB" -ForegroundColor White
    
    Write-Host ""
    Write-Host "? Essential Files to Keep:" -ForegroundColor Green
    foreach ($file in $filesToKeep) {
        if (Test-Path $file) {
            $size = Get-FileSize $file
            Write-Host "  ? $file ($size KB)" -ForegroundColor Green
        }
    }
    
    return $true
}

function Remove-RedundantFiles {
    Write-Host "??? Removing redundant files..." -ForegroundColor Yellow
    Write-Host ""
    
    $removedCount = 0
    $totalSizeSaved = 0
    
    foreach ($file in $filesToRemove) {
        if (Test-Path $file) {
            try {
                $size = Get-FileSize $file
                Remove-Item $file -Force
                Write-Host "  ? Removed: $file" -ForegroundColor Green
                $removedCount++
                $totalSizeSaved += $size
            } catch {
                Write-Host "  ? Failed to remove: $file - $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
    Write-Host "?? Cleanup completed!" -ForegroundColor Green
    Write-Host "  Files removed: $removedCount" -ForegroundColor White
    Write-Host "  Space saved: $totalSizeSaved KB" -ForegroundColor White
}

function Show-PostCleanupStatus {
    Write-Host ""
    Write-Host "?? Post-Cleanup Workspace Status:" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "?? Documentation (Essential Only):" -ForegroundColor Green
    $docs = @(
        "docs/MULTI_ENVIRONMENT_GUIDE.md",
        "docs/DEPLOYMENT_COMMANDS.md"
    )
    
    foreach ($doc in $docs) {
        $exists = Test-Path $doc
        $status = if ($exists) { "?" } else { "?" }
        $color = if ($exists) { "Green" } else { "Red" }
        Write-Host "  $status $doc" -ForegroundColor $color
    }
    
    Write-Host ""
    Write-Host "??? Scripts (Essential Only):" -ForegroundColor Green
    $scripts = @(
        "manage-env.ps1",
        "deploy.ps1", 
        "deploy-backend.ps1",
        "frontend/deployfe.ps1"
    )
    
    foreach ($script in $scripts) {
        $exists = Test-Path $script
        $status = if ($exists) { "?" } else { "?" }
        $color = if ($exists) { "Green" } else { "Red" }
        Write-Host "  $status $script" -ForegroundColor $color
    }
    
    Write-Host ""
    Write-Host "??? Database Scripts:" -ForegroundColor Green
    $dbScripts = @(
        "database_scripts/google-oauth-schema-update.sql",
        "database_scripts/update-google-oauth.ps1"
    )
    
    foreach ($script in $dbScripts) {
        $exists = Test-Path $script
        $status = if ($exists) { "?" } else { "?" }
        $color = if ($exists) { "Green" } else { "Red" }
        Write-Host "  $status $script" -ForegroundColor $color
    }
    
    Write-Host ""
    Write-Host "?? Your streamlined workspace:" -ForegroundColor Green
    Write-Host "  • 2 essential documentation files" -ForegroundColor White
    Write-Host "  • 4 core management/deployment scripts" -ForegroundColor White
    Write-Host "  • 2 database scripts" -ForegroundColor White
    Write-Host "  • All environment files preserved" -ForegroundColor White
}

# Main execution
if ($DryRun) {
    Write-Host "?? DRY RUN MODE - No files will be deleted" -ForegroundColor Yellow
    Write-Host ""
    $hasFilesToRemove = Show-CleanupPlan
    
    if ($hasFilesToRemove) {
        Write-Host ""
        Write-Host "?? To actually remove these files, run:" -ForegroundColor Yellow
        Write-Host "  .\cleanup-docs.ps1" -ForegroundColor White
        Write-Host "  .\cleanup-docs.ps1 -Force  # Skip confirmation" -ForegroundColor White
    }
} else {
    $hasFilesToRemove = Show-CleanupPlan
    
    if (-not $hasFilesToRemove) {
        exit 0
    }
    
    if (-not $Force) {
        Write-Host ""
        Write-Host "??  This will remove redundant documentation and scripts." -ForegroundColor Yellow
        Write-Host "All essential functionality is preserved in the remaining files." -ForegroundColor Yellow
        Write-Host ""
        $confirm = Read-Host "Do you want to proceed with cleanup? (y/N)"
        if ($confirm -notlike "y*") {
            Write-Host "? Cleanup cancelled by user" -ForegroundColor Yellow
            exit 0
        }
    }
    
    Write-Host ""
    Remove-RedundantFiles
    Show-PostCleanupStatus
    
    Write-Host ""
    Write-Host "?? Your streamlined commands:" -ForegroundColor Yellow
    Write-Host "  Environment: .\manage-env.ps1 dev|staging|prod" -ForegroundColor White
    Write-Host "  Deploy: .\deploy.ps1 -Environment staging" -ForegroundColor White
    Write-Host "  Documentation: docs/MULTI_ENVIRONMENT_GUIDE.md" -ForegroundColor White
}