# ================================================================
# Update Organization Logos from Clearbit to Google Favicons
# ================================================================
# Clearbit logo API is blocked in India. This script updates all
# existing logo URLs from Clearbit to Google's favicon API.
# ================================================================

param(
    [string]$ConnectionString = "Server=refopen-sqlserver-ci.database.windows.net;Database=refopen-sql-db;User ID=sqladmin;Password=RefOpen@2024!Secure;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " UPDATE ORGANIZATION LOGOS (Clearbit → Google Favicons)" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN MODE - No database changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# Install/Import SqlServer module
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

# ================================================================
# Step 1: Get all orgs with Clearbit logos
# ================================================================
Write-Host "📊 Fetching organizations with Clearbit logos..." -ForegroundColor Yellow

$query = @"
SELECT OrganizationID, Name, LogoURL, Website
FROM Organizations 
WHERE LogoURL LIKE '%logo.clearbit.com%'
  AND IsActive = 1
ORDER BY Name
"@

try {
    $orgs = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $query -QueryTimeout 120
    Write-Host "✅ Found $($orgs.Count) organizations with Clearbit logos" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to fetch organizations: $_" -ForegroundColor Red
    exit 1
}

if ($orgs.Count -eq 0) {
    Write-Host "✅ No Clearbit logos found - nothing to update!" -ForegroundColor Green
    exit 0
}

# ================================================================
# Step 2: Update each logo URL
# ================================================================
Write-Host ""
Write-Host "🔄 Converting Clearbit logos to Google favicons..." -ForegroundColor Yellow
Write-Host ""

$updated = 0
$failed = 0

foreach ($org in $orgs) {
    $orgId = $org.OrganizationID
    $orgName = $org.Name
    $oldLogoUrl = $org.LogoURL
    $website = $org.Website
    
    # Extract domain from Clearbit URL: https://logo.clearbit.com/amazon.com -> amazon.com
    $domain = $null
    if ($oldLogoUrl -match 'logo\.clearbit\.com/([^/\?]+)') {
        $domain = $matches[1]
    }
    
    if (-not $domain) {
        Write-Host "  ⚠️ [$orgName] Could not extract domain from: $oldLogoUrl" -ForegroundColor Yellow
        $failed++
        continue
    }
    
    # Generate new Google favicon URL (128px)
    $newLogoUrl = "https://www.google.com/s2/favicons?domain=$domain&sz=128"
    
    Write-Host "  🔄 [$orgName] $domain" -ForegroundColor Cyan
    Write-Host "     Old: $oldLogoUrl" -ForegroundColor DarkGray
    Write-Host "     New: $newLogoUrl" -ForegroundColor Green
    
    if (-not $DryRun) {
        try {
            # Escape single quotes in URL
            $escapedLogoUrl = $newLogoUrl -replace "'", "''"
            $updateQuery = "UPDATE Organizations SET LogoURL = '$escapedLogoUrl', UpdatedAt = GETUTCDATE() WHERE OrganizationID = $orgId"
            Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $updateQuery -QueryTimeout 30
            $updated++
        } catch {
            Write-Host "     ❌ Failed to update: $_" -ForegroundColor Red
            $failed++
        }
    } else {
        $updated++
    }
}

# ================================================================
# Summary
# ================================================================
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " SUMMARY" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "  Would update: $updated logos" -ForegroundColor Yellow
} else {
    Write-Host "  ✅ Updated: $updated logos" -ForegroundColor Green
}

if ($failed -gt 0) {
    Write-Host "  ❌ Failed: $failed" -ForegroundColor Red
}

Write-Host ""
Write-Host "Done! Google favicons work globally (no geo-blocking)." -ForegroundColor Green
