<#
.SYNOPSIS
    Cleanup duplicate organizations in the RefOpen database using smart normalization

.DESCRIPTION
    This script:
    1. Reads all active organizations from the database
    2. Groups them by normalized name (using the same logic as job-scraper)
    3. For each group of duplicates, keeps the "best" organization (most complete data)
    4. Updates all references (Jobs, Applications, etc.) to point to the canonical organization
    5. Marks duplicate organizations as inactive or deletes them

.PARAMETER ConnectionString
    SQL Server connection string

.PARAMETER DryRun
    If specified, shows what would be done without making changes

.PARAMETER KeepStrategy
    Strategy for choosing which organization to keep:
    - "Oldest": Keep the oldest organization (default)
    - "MostComplete": Keep the one with most fields populated
    - "MostJobs": Keep the one with most associated jobs

.PARAMETER DeleteDuplicates
    If specified, deletes duplicate organizations instead of marking inactive

.EXAMPLE
    .\cleanup-duplicate-organizations.ps1 -ConnectionString "Server=..." -DryRun
    
.EXAMPLE
    .\cleanup-duplicate-organizations.ps1 -ConnectionString "Server=..." -KeepStrategy "MostComplete"
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$ConnectionString = $env:DB_CONNECTION_STRING,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("Oldest", "MostComplete", "MostJobs")]
    [string]$KeepStrategy = "MostComplete",
    
    [Parameter(Mandatory=$false)]
    [switch]$DeleteDuplicates
)

$ErrorActionPreference = "Continue"

# Import Fortune 500 module
$modulePath = Join-Path $PSScriptRoot "Fortune500Companies.psm1"
Import-Module $modulePath -Force

# Import SQL Server module
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "??  SqlServer module not found. Installing..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer

# Color output functions
function Write-Success { param($Message) Write-Host "? $Message" -ForegroundColor Green }
function Write-Info { param($Message) Write-Host "??  $Message" -ForegroundColor Cyan }
function Write-Warning { param($Message) Write-Host "??  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "? $Message" -ForegroundColor Red }
function Write-Step { param($Message) Write-Host "`n?? $Message" -ForegroundColor Blue }

# Normalization function (matches TypeScript implementation)
function Normalize-CompanyName {
    param([string]$rawName)
    
    if ([string]::IsNullOrWhiteSpace($rawName)) {
        return ""
    }
    
    $original = $rawName.Trim()
    $normalized = $original.ToLower()
    
    # Define brand patterns (check against original)
    $brandPatterns = @(
        '^\d{1,3}[a-z]{2,8}$',      # 360bet, 99acres, 1mg
        '^\d+x\d+',                  # 24x7services
        '^\d{1,2}[A-Z][a-z]+',       # 7Eleven
        '^[0-9]{1,2}[A-Z]+$',        # 3M, 4U
        '^\d+/\d+'                   # 24/7
    )
    
    $isBrandName = $false
    foreach ($pattern in $brandPatterns) {
        if ($original -match $pattern) {
            $isBrandName = $true
            break
        }
    }
    
    # Remove office codes and location-specific suffixes
    $normalized = $normalized -replace '\s*-\s*[a-z]\d+$', '' # Remove "- A19", "- B52"
    $normalized = $normalized -replace '\s*-\s*(hyderabad|bangalore|mumbai|chennai|delhi|pune|gurgaon|noida)$', ''
    $normalized = $normalized -replace '\s*-\s*(us|usa|uk|india)$', ''
    
    # Remove generic organizational terms
    $genericTerms = @(
        'development center', 'development centre', 'dev center', 'dev centre',
        'data center', 'data centre', 'data services',
        'research center', 'research centre',
        'manufacturing enterprises',
        'retail operations'
    )
    
    foreach ($term in $genericTerms) {
        $pattern = '\s+' + ($term -replace '\s+', '\s+')
        $normalized = $normalized -replace $pattern, ''
    }
    
    # Remove noise words
    $noiseWords = @(
        'private limited', 'pvt ltd', 'pvt. ltd', 'pvt ltd.', 'pvt. ltd.',
        'private ltd', 'private', 'pvt', 'limited', 'ltd',
        'incorporated', 'corporation', 'corp', 'inc',
        'llc', 'l.l.c', 'l.l.c.', 'company', 'co',
        'technologies', 'technology', 'tech', 'software', 'systems',
        'services', 'solutions', 'group', 'international', 'global',
        'india', 'usa', 'uk', 'us'
    )
    
    foreach ($noise in $noiseWords) {
        $pattern = [regex]::Escape($noise) + '$'
        $normalized = $normalized -replace "\s+$pattern", ''
    }
    
    # Remove punctuation
    $normalized = $normalized -replace '[^\w\s]', ''
    
    # Smart leading number removal (skip if brand name)
    if (-not $isBrandName) {
        # Remove "2100 Microsoft" -> "microsoft"
        $normalized = $normalized -replace '^\d+\s+', ''
        
        # Remove "2100Microsoft" -> "microsoft"
        if ($normalized -match '^(\d{4,})([a-z]+)') {
            $normalized = $matches[2]
        } elseif ($normalized -match '^(\d{1,3})([a-z]{4,})') {
            $normalized = $matches[2]
        }
    }
    
    # Token filtering
    $tokens = $normalized -split '\s+' | Where-Object {
        $_.Length -ge 2 -and $noiseWords -notcontains $_.ToLower()
    }
    
    $normalized = ($tokens -join ' ').Trim() -replace '\s+', ' '
    
    # Final safety check
    if ([string]::IsNullOrWhiteSpace($normalized) -or $normalized.Length -lt 2) {
        $normalized = $original.ToLower() -replace '[^\w\s]', '' -replace '\s+', ' '
        $normalized = $normalized.Trim()
    }
    
    return $normalized
}

# Calculate completeness score
function Get-OrganizationScore {
    param($org)
    
    $score = 0
    if (-not [string]::IsNullOrWhiteSpace($org.LogoURL)) { $score += 10 }
    if (-not [string]::IsNullOrWhiteSpace($org.Website)) { $score += 10 }
    if (-not [string]::IsNullOrWhiteSpace($org.Industry)) { $score += 5 }
    if (-not [string]::IsNullOrWhiteSpace($org.Description)) { $score += 5 }
    if (-not [string]::IsNullOrWhiteSpace($org.LinkedInProfile)) { $score += 5 }
    if (-not [string]::IsNullOrWhiteSpace($org.Size)) { $score += 3 }
    
    return $score
}

# Main execution
try {
    Write-Host "`n??????????????????????????????????????????????????????????????" -ForegroundColor Cyan
    Write-Host "?   ?? Organization Deduplication & Cleanup Script          ?" -ForegroundColor Cyan
    Write-Host "??????????????????????????????????????????????????????????????`n" -ForegroundColor Cyan
    
    if ($DryRun) {
        Write-Warning "DRY RUN MODE - No changes will be made to the database"
    }
    
    Write-Info "Keep Strategy: $KeepStrategy"
    Write-Info "Connection: $($ConnectionString.Substring(0, [Math]::Min(50, $ConnectionString.Length)))..."
    
    # Step 1: Fetch all organizations (including inactive to properly consolidate)
    Write-Step "Fetching all organizations (active + inactive)..."
    
    $query = @"
SELECT 
    OrganizationID,
    Name,
    Type,
    Industry,
    Size,
    Description,
    LogoURL,
    Website,
    LinkedInProfile,
    CreatedAt,
    IsActive,
    IsFortune500,
    (SELECT COUNT(*) FROM Jobs WHERE OrganizationID = Organizations.OrganizationID) AS JobCount
FROM Organizations
ORDER BY Name
"@
    
    $organizations = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $query -QueryTimeout 60
    $activeCount = ($organizations | Where-Object { $_.IsActive -eq $true }).Count
    $inactiveCount = ($organizations | Where-Object { $_.IsActive -eq $false }).Count
    Write-Success "Found $($organizations.Count) organizations ($activeCount active, $inactiveCount inactive)"
    
    # Step 2: Group by normalized name WITH Fortune 500 canonical matching
    Write-Step "Grouping organizations by normalized name (with Fortune 500 matching)..."
    
    $groupedOrgs = @{}
    $normalizedMap = @{}
    $fortune500Map = @{}
    
    foreach ($org in $organizations) {
        # Check Fortune 500 first
        $fortune500Match = Find-Fortune500Match -CompanyName $org.Name
        
        if ($fortune500Match) {
            # Use Fortune 500 canonical name as the grouping key
            $groupKey = $fortune500Match.CanonicalName.ToLower()
            $fortune500Map[$org.OrganizationID] = $fortune500Match
            Write-Host "  ? Fortune 500: '$($org.Name)' ? '$($fortune500Match.CanonicalName)'" -ForegroundColor Green
        }
        else {
            # Use normalized name for non-Fortune 500 companies
            $groupKey = Normalize-CompanyName -rawName $org.Name
        }
        
        $normalizedMap[$org.OrganizationID] = $groupKey
        
        if (-not $groupedOrgs.ContainsKey($groupKey)) {
            $groupedOrgs[$groupKey] = @()
        }
        $groupedOrgs[$groupKey] += $org
    }
    
    # Step 3: Find duplicates
    Write-Step "Identifying duplicate groups..."
    
    $duplicateGroups = $groupedOrgs.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 }
    $duplicateCount = ($duplicateGroups | Measure-Object).Count
    
    if ($duplicateCount -eq 0) {
        Write-Success "No duplicate organizations found! Database is clean."
        exit 0
    }
    
    Write-Warning "Found $duplicateCount duplicate groups affecting $($duplicateGroups | ForEach-Object { $_.Value.Count } | Measure-Object -Sum).Sum organizations"
    
    # Step 4: Process each duplicate group
    Write-Step "Processing duplicate groups..."
    
    $totalMerged = 0
    $totalJobsUpdated = 0
    $totalOrgsDeactivated = 0
    
    foreach ($group in $duplicateGroups) {
        $normalizedName = $group.Key
        $duplicates = $group.Value
        
        Write-Host "`n???????????????????????????????????????????????????" -ForegroundColor DarkGray
        Write-Info "Processing: '$normalizedName' ($($duplicates.Count) duplicates)"
        
        # Display all duplicates
        foreach ($dup in $duplicates) {
            Write-Host "  � ID: $($dup.OrganizationID) | Name: '$($dup.Name)' | Jobs: $($dup.JobCount) | Score: $(Get-OrganizationScore $dup)" -ForegroundColor Gray
        }
        
        # Choose canonical organization based on strategy
        # PRIORITY 1: Fortune 500 companies always win
        $fortune500Orgs = $duplicates | Where-Object { $fortune500Map.ContainsKey($_.OrganizationID) }
        
        if ($fortune500Orgs) {
            # Get the Fortune 500 canonical name
            $f500Info = $fortune500Map[($fortune500Orgs | Select-Object -First 1).OrganizationID]
            $fortune500CanonicalName = $f500Info.CanonicalName
            
            # Check if any org already has the EXACT Fortune 500 canonical name
            $exactMatch = $fortune500Orgs | Where-Object { $_.Name -eq $fortune500CanonicalName } | Select-Object -First 1
            
            if ($exactMatch) {
                # Perfect! We have an org with the exact canonical name
                # Prefer active over inactive
                $canonical = if ($exactMatch.IsActive) { $exactMatch } else { $exactMatch }
                Write-Success "? Keeping Fortune 500 (Exact Match): ID $($canonical.OrganizationID) - '$($canonical.Name)' [$(if($canonical.IsActive){'Active'}else{'Inactive'})]"
            }
            else {
                # Choose based on: Active status first, then shortest name
                $canonical = $fortune500Orgs | Sort-Object @{Expression={-[int]$_.IsActive}; Ascending=$true}, @{Expression={$_.Name.Length}; Ascending=$true} | Select-Object -First 1
                Write-Success "? Keeping Fortune 500: ID $($canonical.OrganizationID) - '$($canonical.Name)' [$(if($canonical.IsActive){'Active'}else{'Inactive'})] ? Will rename to '$($fortune500CanonicalName)'"
            }
        }
        else {
            # Apply normal strategy for non-Fortune 500 companies
            $canonical = switch ($KeepStrategy) {
                "Oldest" {
                    $duplicates | Sort-Object @{Expression={-[int]$_.IsActive}; Ascending=$true}, CreatedAt | Select-Object -First 1
                }
                "MostComplete" {
                    $duplicates | Sort-Object @{Expression={-[int]$_.IsActive}; Ascending=$true}, @{Expression={Get-OrganizationScore $_}; Descending=$true}, @{Expression={$_.Name.Length}; Ascending=$true} | Select-Object -First 1
                }
                "MostJobs" {
                    $duplicates | Sort-Object @{Expression={-[int]$_.IsActive}; Ascending=$true}, @{Expression={$_.JobCount}; Descending=$true}, @{Expression={$_.Name.Length}; Ascending=$true} | Select-Object -First 1
                }
            }
            Write-Success "? Keeping: ID $($canonical.OrganizationID) - '$($canonical.Name)' [$(if($canonical.IsActive){'Active'}else{'Inactive'})] (Score: $(Get-OrganizationScore $canonical), Jobs: $($canonical.JobCount))"
        }
        
        # Get duplicates to merge (excluding canonical)
        $toMerge = $duplicates | Where-Object { $_.OrganizationID -ne $canonical.OrganizationID }
        
        foreach ($dup in $toMerge) {
            Write-Host "  ? Merging ID $($dup.OrganizationID) into canonical..." -ForegroundColor Yellow
            
            if (-not $DryRun) {
                # Check if we need to update canonical name to Fortune 500 name
                $updateCanonicalName = ""
                if ($fortune500Map.ContainsKey($canonical.OrganizationID)) {
                    $f500 = $fortune500Map[$canonical.OrganizationID]
                    
                    # Always ensure canonical org is active and has IsFortune500 = 1
                    $activateCanonical = ""
                    if (-not $canonical.IsActive) {
                        $activateCanonical = @"
-- Reactivate canonical Fortune 500 organization
UPDATE Organizations
SET IsActive = 1,
    IsFortune500 = 1,
    Industry = '$($f500.Industry)',
    UpdatedAt = GETUTCDATE()
WHERE OrganizationID = $($canonical.OrganizationID);

"@
                        Write-Host "  ?? Will reactivate canonical org '$($canonical.Name)'" -ForegroundColor Cyan
                    }
                    
                    if ($canonical.Name -ne $f500.CanonicalName) {
                        # Check if canonical name already exists in another org
                        $nameCheckQuery = "SELECT COUNT(*) AS cnt FROM Organizations WHERE Name = '$($f500.CanonicalName)' AND OrganizationID != $($canonical.OrganizationID)"
                        $nameCheck = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $nameCheckQuery
                        
                        if ($nameCheck.cnt -eq 0) {
                            $updateCanonicalName = @"
$activateCanonical
-- Update canonical organization to Fortune 500 name
UPDATE Organizations
SET Name = '$($f500.CanonicalName)',
    IsFortune500 = 1,
    Industry = '$($f500.Industry)',
    UpdatedAt = GETUTCDATE()
WHERE OrganizationID = $($canonical.OrganizationID);

"@
                            Write-Host "  ?? Will update to Fortune 500 canonical name: '$($f500.CanonicalName)'" -ForegroundColor Cyan
                        }
                        else {
                            Write-Host "  ??  Canonical name '$($f500.CanonicalName)' already exists, skipping rename" -ForegroundColor Yellow
                            $updateCanonicalName = $activateCanonical
                        }
                    }
                    else {
                        $updateCanonicalName = $activateCanonical
                    }
                }
                elseif (-not $canonical.IsActive) {
                    # Non-Fortune 500 but inactive - reactivate it
                    $updateCanonicalName = @"
-- Reactivate canonical organization
UPDATE Organizations
SET IsActive = 1,
    UpdatedAt = GETUTCDATE()
WHERE OrganizationID = $($canonical.OrganizationID);

"@
                    Write-Host "  ?? Will reactivate canonical org '$($canonical.Name)'" -ForegroundColor Cyan
                }
                
                # Start transaction for this merge
                $mergeQuery = @"
BEGIN TRANSACTION;

$updateCanonicalName

-- Update Jobs table
UPDATE Jobs 
SET OrganizationID = $($canonical.OrganizationID),
    UpdatedAt = GETUTCDATE()
WHERE OrganizationID = $($dup.OrganizationID);

DECLARE @jobsUpdated INT = @@ROWCOUNT;

-- Update ReferralRequests table (no UpdatedAt column)
IF OBJECT_ID('ReferralRequests', 'U') IS NOT NULL
BEGIN
    UPDATE ReferralRequests 
    SET OrganizationID = $($canonical.OrganizationID)
    WHERE OrganizationID = $($dup.OrganizationID);
END

-- Update Applicants table (CurrentOrganizationID)
IF OBJECT_ID('Applicants', 'U') IS NOT NULL
BEGIN
    UPDATE Applicants 
    SET CurrentOrganizationID = $($canonical.OrganizationID),
        UpdatedAt = GETUTCDATE()
    WHERE CurrentOrganizationID = $($dup.OrganizationID);
END

-- Update WorkExperiences table
IF OBJECT_ID('WorkExperiences', 'U') IS NOT NULL
BEGIN
    UPDATE WorkExperiences 
    SET OrganizationID = $($canonical.OrganizationID),
        UpdatedAt = GETUTCDATE()
    WHERE OrganizationID = $($dup.OrganizationID);
END

-- Update Employers table (no UpdatedAt column)
IF OBJECT_ID('Employers', 'U') IS NOT NULL
BEGIN
    UPDATE Employers 
    SET OrganizationID = $($canonical.OrganizationID)
    WHERE OrganizationID = $($dup.OrganizationID);
END

-- Mark duplicate as inactive or delete
$(if ($DeleteDuplicates) {
    "DELETE FROM Organizations WHERE OrganizationID = $($dup.OrganizationID);"
} else {
    "UPDATE Organizations SET IsActive = 0, UpdatedAt = GETUTCDATE() WHERE OrganizationID = $($dup.OrganizationID);"
})

SELECT @jobsUpdated AS JobsUpdated;

COMMIT TRANSACTION;
"@
                
                try {
                    $result = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $mergeQuery -QueryTimeout 120
                    $jobsUpdated = $result.JobsUpdated
                    $totalJobsUpdated += $jobsUpdated
                    $totalOrgsDeactivated++
                    Write-Success "  ? Merged successfully ($jobsUpdated jobs updated)"
                }
                catch {
                    Write-Error "  ? Failed to merge: $($_.Exception.Message)"
                }
            }
            else {
                Write-Host "  [DRY RUN] Would merge and update $($dup.JobCount) jobs" -ForegroundColor DarkYellow
                $totalJobsUpdated += $dup.JobCount
                $totalOrgsDeactivated++
            }
        }
        
        $totalMerged++
    }
    
    # Step 5: Summary
    Write-Host "`n??????????????????????????????????????????????????????????????" -ForegroundColor Green
    Write-Host "?                   ?? Cleanup Summary                       ?" -ForegroundColor Green
    Write-Host "??????????????????????????????????????????????????????????????`n" -ForegroundColor Green
    
    Write-Host "  Duplicate Groups Processed:    $totalMerged" -ForegroundColor White
    Write-Host "  Organizations Merged:          $totalOrgsDeactivated" -ForegroundColor White
    Write-Host "  Jobs Updated:                  $totalJobsUpdated" -ForegroundColor White
    Write-Host "  Action Taken:                  $(if ($DeleteDuplicates) { 'Deleted' } else { 'Marked Inactive' })" -ForegroundColor White
    
    if ($DryRun) {
        Write-Host "`n??  DRY RUN: No actual changes were made" -ForegroundColor Yellow
        Write-Host "Run without -DryRun flag to apply changes`n" -ForegroundColor Yellow
    }
    else {
        Write-Host "`n? Cleanup completed successfully!`n" -ForegroundColor Green
        
        # Optional: Show remaining organization count
        $remainingQuery = "SELECT COUNT(*) AS Count FROM Organizations WHERE IsActive = 1"
        $remaining = (Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $remainingQuery).Count
        Write-Info "Active organizations remaining: $remaining"
    }
    
}
catch {
    Write-Error "Script failed with error: $($_.Exception.Message)"
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}
