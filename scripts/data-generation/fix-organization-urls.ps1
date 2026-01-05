# ================================================================
# Fix Incorrect Wikipedia URLs in Organizations
# ================================================================

param(
    [string]$ConnectionString = $env:DB_CONNECTION_STRING,
    [string]$KeyVaultName = "refopen-keyvault-prod"
)

# Auto-load credentials from Key Vault if not provided
if (-not $ConnectionString) {
    Write-Host "🔐 Loading credentials from Azure Key Vault..." -ForegroundColor Cyan
    $ConnectionString = az keyvault secret show --vault-name $KeyVaultName --name "DbConnectionString" --query "value" -o tsv 2>$null
    if (-not $ConnectionString) {
        Write-Error "Failed to load credentials. Ensure you're logged in: az login"
        exit 1
    }
    Write-Host "✅ Credentials loaded from Key Vault" -ForegroundColor Green
}

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " FIXING INCORRECT ORGANIZATION DATA" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

Import-Module SqlServer -Force

# Find organizations with Wikipedia URLs
$query = @"
SELECT 
    OrganizationID,
    Name,
    Website,
    LogoURL
FROM Organizations
WHERE Website LIKE '%wikipedia%' 
   OR Website LIKE '%wikimedia%'
   OR LogoURL LIKE '%wikipedia%'
"@

Write-Host "Step 1: Finding organizations with incorrect data..." -ForegroundColor Cyan
$incorrectOrgs = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $query

Write-Host "   Found $($incorrectOrgs.Count) organizations with Wikipedia URLs" -ForegroundColor Yellow
Write-Host ""

if ($incorrectOrgs.Count -eq 0) {
  Write-Host "? No incorrect data found!" -ForegroundColor Green
    exit 0
}

Write-Host "Step 2: Cleaning up incorrect data..." -ForegroundColor Cyan
Write-Host ""

$cleanedCount = 0

foreach ($org in $incorrectOrgs) {
    Write-Host "   ? $($org.Name)" -ForegroundColor White
    
    $updateQuery = @"
UPDATE Organizations
SET 
    Website = NULL,
    LogoURL = NULL,
    UpdatedAt = GETUTCDATE()
WHERE OrganizationID = $($org.OrganizationID)
"@
    
    try {
        Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $updateQuery -QueryTimeout 30
        Write-Host "      ? Cleared incorrect URLs" -ForegroundColor Green
        $cleanedCount++
    } catch {
        Write-Host "      ? Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " CLEANUP SUMMARY" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "   Organizations cleaned: $cleanedCount" -ForegroundColor Green
Write-Host "   Incorrect URLs removed: $($cleanedCount * 2) (Website + Logo)" -ForegroundColor White
Write-Host ""
Write-Host "? Cleanup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Run: .\enrich-organizations.ps1 -OnlyMissingData" -ForegroundColor White
Write-Host "      (This will re-fetch correct websites)" -ForegroundColor Gray
Write-Host ""

