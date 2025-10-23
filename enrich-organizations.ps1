# ================================================================
# Automated Organization Enrichment Script
# ================================================================
# Automatically enriches ALL organizations in RefOpen database
# Fetches missing data from public APIs without user interaction
# ================================================================

param(
    [string]$ConnectionString = "Server=refopen-sqlserver-ci.database.windows.net;Database=refopen-sql-db;User ID=sqladmin;Password=RefOpen@2024!Secure;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;",
    [string]$ClearbitApiKey = "",
    [int]$BatchSize = 50,
    [int]$ApiRateLimitDelayMs = 2000,
    [switch]$DryRun,
    [switch]$OnlyMissingData,
    [switch]$SkipLogos,
    [switch]$SkipWebsites,
    [switch]$SkipLinkedIn
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " AUTOMATED ORGANIZATION ENRICHMENT                             ?" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN MODE - No database changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# ================================================================
# Install Required Modules
# ================================================================
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer -Force

# ================================================================
# PUBLIC API FUNCTIONS
# ================================================================

function Get-ClearbitLogo {
    param([string]$Domain)
    
    if ([string]::IsNullOrEmpty($Domain)) { return $null }
    
    try {
        $cleanDomain = $Domain -replace 'https?://', '' -replace 'www\.', '' -replace '/$', ''
        $logoUrl = "https://logo.clearbit.com/$cleanDomain"
        
        $response = Invoke-WebRequest -Uri $logoUrl -Method Head -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            return $logoUrl
        }
    } catch {
        # Logo not found
    }
    
    return $null
}

function Get-ClearbitCompanyInfo {
    param(
        [string]$Domain,
        [string]$ApiKey
    )
    
    if ([string]::IsNullOrEmpty($Domain) -or [string]::IsNullOrEmpty($ApiKey)) { 
        return $null 
    }
    
    try {
        $cleanDomain = $Domain -replace 'https?://', '' -replace 'www\.', '' -replace '/$', ''
        $url = "https://company.clearbit.com/v2/companies/find?domain=$cleanDomain"
        
        $headers = @{
            "Authorization" = "Bearer $ApiKey"
        }
        
        $response = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 10
        
        $location = if ($response.location) {
            "$($response.location.city), $($response.location.country)"
        } else { $null }
        
        $employeeCount = if ($response.metrics.employees) {
            "$($response.metrics.employees) employees"
        } else { $null }
        
        return @{
            Name = $response.name
            Domain = $response.domain
            Logo = $response.logo
            Description = $response.description
            FoundedYear = $response.foundedYear
            Industry = $response.category.industry
            Sector = $response.category.sector
            EmployeeCount = $employeeCount
            Location = $location
            City = $response.location.city
            State = $response.location.state
            Country = $response.location.country
            LinkedIn = if ($response.linkedin.handle) { "https://www.linkedin.com/company/$($response.linkedin.handle)" } else { $null }
        }
    } catch {
        # API error or company not found
        return $null
    }
}

function Get-CompanyWebsiteFromSearch {
    param([string]$CompanyName)
    
    if ([string]::IsNullOrEmpty($CompanyName)) { return $null }
    
    try {
        $searchTerm = [System.Web.HttpUtility]::UrlEncode($CompanyName)
        $url = "https://api.duckduckgo.com/?q=$searchTerm&format=json&no_html=1&skip_disambig=1"
        
        $response = Invoke-RestMethod -Uri $url -TimeoutSec 10
        
        if ($response.AbstractURL) {
            $uri = [System.Uri]$response.AbstractURL
            $domain = $uri.Host -replace 'www\.', ''
            
            return @{
                Website = "https://$domain"
                Description = $response.AbstractText
            }
        }
    } catch {
        # Search failed
    }
    
    return $null
}

function Get-LinkedInUrl {
    param([string]$CompanyName)
    
    if ([string]::IsNullOrEmpty($CompanyName)) { return $null }
    
    $sanitized = $CompanyName.ToLower() `
        -replace '[^a-z0-9\s]', '' `
        -replace '\s+', '-' `
        -replace '-+', '-' `
        -replace '^-|-$', ''
    
    return "https://www.linkedin.com/company/$sanitized"
}

# ================================================================
# Database Operations
# ================================================================

function Get-OrganizationsToEnrich {
    param(
        [string]$ConnectionString,
        [bool]$OnlyMissing
    )
    
    $query = if ($OnlyMissing) {
        @"
SELECT 
    OrganizationID,
    Name,
    Website,
    LogoURL,
    LinkedInProfile,
    Description,
    Industry,
    Headquarters
FROM Organizations
WHERE IsActive = 1
  AND (
    Website IS NULL OR 
    LogoURL IS NULL OR 
    LinkedInProfile IS NULL OR
    Description IS NULL OR
    Industry IS NULL
  )
ORDER BY CreatedAt DESC
"@
    } else {
        @"
SELECT 
    OrganizationID,
    Name,
    Website,
    LogoURL,
    LinkedInProfile,
    Description,
    Industry,
    Headquarters
FROM Organizations
WHERE IsActive = 1
ORDER BY CreatedAt DESC
"@
    }
    
    return Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $query -QueryTimeout 60
}

function Update-OrganizationData {
    param(
        [string]$ConnectionString,
        [int]$OrganizationID,
        [hashtable]$Data
    )
    
    $updateParts = @()
    $parameters = @{}
    
    if ($Data.Website) {
        $updateParts += "Website = @Website"
        $parameters['Website'] = $Data.Website
    }
    
    if ($Data.LogoURL) {
        $updateParts += "LogoURL = @LogoURL"
        $parameters['LogoURL'] = $Data.LogoURL
    }
    
    if ($Data.LinkedInProfile) {
        $updateParts += "LinkedInProfile = @LinkedInProfile"
        $parameters['LinkedInProfile'] = $Data.LinkedInProfile
    }
    
    if ($Data.Description) {
        $updateParts += "Description = @Description"
        $parameters['Description'] = $Data.Description
    }
    
    if ($Data.Industry) {
        $updateParts += "Industry = @Industry"
        $parameters['Industry'] = $Data.Industry
    }
    
    if ($Data.Headquarters) {
        $updateParts += "Headquarters = @Headquarters"
        $parameters['Headquarters'] = $Data.Headquarters
    }
    
    if ($Data.EstablishedDate) {
        $updateParts += "EstablishedDate = @EstablishedDate"
        $parameters['EstablishedDate'] = $Data.EstablishedDate
    }
    
    if ($Data.Size) {
        $updateParts += "Size = @Size"
        $parameters['Size'] = $Data.Size
    }
    
    if ($updateParts.Count -eq 0) {
        return $false
    }
    
    $updateParts += "UpdatedAt = GETUTCDATE()"
    
    $query = @"
UPDATE Organizations
SET $($updateParts -join ', ')
WHERE OrganizationID = $OrganizationID
"@
    
    $connection = New-Object System.Data.SqlClient.SqlConnection($ConnectionString)
    $command = $connection.CreateCommand()
    $command.CommandText = $query
    $command.CommandTimeout = 30
    
    foreach ($key in $parameters.Keys) {
        $command.Parameters.AddWithValue("@$key", $parameters[$key]) | Out-Null
    }
    
    try {
        $connection.Open()
        $command.ExecuteNonQuery() | Out-Null
        $connection.Close()
        return $true
    } catch {
        Write-Error "Database update failed: $($_.Exception.Message)"
        return $false
    } finally {
        if ($connection.State -eq 'Open') {
            $connection.Close()
        }
    }
}

# ================================================================
# Main Enrichment Logic
# ================================================================

function Enrich-Organization {
    param(
        [PSCustomObject]$Organization,
        [string]$ClearbitApiKey,
        [bool]$SkipLogos,
        [bool]$SkipWebsites,
        [bool]$SkipLinkedIn
    )
    
    $updates = @{}
    $enrichmentCount = 0
    
    # 1. Find website if missing
    if ([string]::IsNullOrEmpty($Organization.Website) -and -not $SkipWebsites) {
        Write-Host "      ?Searching for website..." -ForegroundColor Gray
        Start-Sleep -Milliseconds $ApiRateLimitDelayMs
        
        $searchResult = Get-CompanyWebsiteFromSearch -CompanyName $Organization.Name
        if ($searchResult -and $searchResult.Website) {
            $updates.Website = $searchResult.Website
            Write-Host "         Found: $($searchResult.Website)" -ForegroundColor Green
            $enrichmentCount++
            
            # Use description if we don't have one
            if ([string]::IsNullOrEmpty($Organization.Description) -and $searchResult.Description) {
                $updates.Description = $searchResult.Description
            }
        }
    }
    
    $websiteToUse = if ($updates.Website) { $updates.Website } else { $Organization.Website }
    
    # 2. Get logo if missing
    if ([string]::IsNullOrEmpty($Organization.LogoURL) -and -not $SkipLogos -and $websiteToUse) {
        Write-Host "      ?Fetching logo..." -ForegroundColor Gray
        
        $logo = Get-ClearbitLogo -Domain $websiteToUse
        if ($logo) {
            $updates.LogoURL = $logo
            Write-Host "         Found: Logo" -ForegroundColor Green
            $enrichmentCount++
        }
    }
    
    # 3. Get comprehensive data from Clearbit if API key provided
    if ($websiteToUse -and -not [string]::IsNullOrEmpty($ClearbitApiKey)) {
        Write-Host "      ?Fetching company data..." -ForegroundColor Gray
        Start-Sleep -Milliseconds $ApiRateLimitDelayMs
        
        $clearbitData = Get-ClearbitCompanyInfo -Domain $websiteToUse -ApiKey $ClearbitApiKey
        
        if ($clearbitData) {
            if ([string]::IsNullOrEmpty($Organization.Description) -and $clearbitData.Description) {
                $updates.Description = $clearbitData.Description
                $enrichmentCount++
            }
            
            if ([string]::IsNullOrEmpty($Organization.Industry) -and $clearbitData.Industry) {
                $updates.Industry = $clearbitData.Industry
                $enrichmentCount++
            }
            
            if ([string]::IsNullOrEmpty($Organization.Headquarters) -and $clearbitData.Location) {
                $updates.Headquarters = $clearbitData.Location
                $enrichmentCount++
            }
            
            if ($clearbitData.FoundedYear) {
                $updates.EstablishedDate = [datetime]::Parse("$($clearbitData.FoundedYear)-01-01")
                $enrichmentCount++
            }
            
            if ($clearbitData.EmployeeCount) {
                $updates.Size = $clearbitData.EmployeeCount
                $enrichmentCount++
            }
            
            if ([string]::IsNullOrEmpty($Organization.LinkedInProfile) -and $clearbitData.LinkedIn) {
                $updates.LinkedInProfile = $clearbitData.LinkedIn
                $enrichmentCount++
            }
            
            # Better logo from Clearbit
            if ([string]::IsNullOrEmpty($Organization.LogoURL) -and $clearbitData.Logo) {
                $updates.LogoURL = $clearbitData.Logo
                $enrichmentCount++
            }
            
            if ($enrichmentCount -gt 0) {
                Write-Host "         Found: $enrichmentCount fields" -ForegroundColor Green
            }
        }
    }
    
    # 4. Generate LinkedIn URL if missing
    if ([string]::IsNullOrEmpty($Organization.LinkedInProfile) -and -not $SkipLinkedIn -and [string]::IsNullOrEmpty($updates.LinkedIn)) {
        $updates.LinkedInProfile = Get-LinkedInUrl -CompanyName $Organization.Name
        Write-Host "         ? Generated: LinkedIn URL" -ForegroundColor Cyan
        $enrichmentCount++
    }
    
    return @{
        Updates = $updates
        Count = $enrichmentCount
    }
}

# ================================================================
# Main Execution
# ================================================================

Write-Host "Step 1: Fetching Organizations from Database" -ForegroundColor Cyan

$organizations = Get-OrganizationsToEnrich -ConnectionString $ConnectionString -OnlyMissing $OnlyMissingData

Write-Host "   Found $($organizations.Count) organizations to enrich" -ForegroundColor Green
Write-Host ""

if ($organizations.Count -eq 0) {
    Write-Host "All organizations are already enriched!" -ForegroundColor Green
    exit 0
}

Write-Host "Step 2: Enriching Organizations" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "   ?DRY RUN - Showing first 5 organizations:" -ForegroundColor Yellow
    $organizations | Select-Object -First 5 | ForEach-Object {
        Write-Host "      � $($_.Name)" -ForegroundColor Gray
        Write-Host "        Missing: $(if (!$_.Website) { 'Website ' })$(if (!$_.LogoURL) { 'Logo ' })$(if (!$_.LinkedInProfile) { 'LinkedIn' })" -ForegroundColor DarkGray
    }
    Write-Host ""
    Write-Host "   ? Run without -DryRun to perform actual enrichment" -ForegroundColor Cyan
    exit 0
}

$enrichedCount = 0
$skippedCount = 0
$errorCount = 0
$totalFieldsEnriched = 0

$batchNumber = 1
$totalBatches = [Math]::Ceiling($organizations.Count / $BatchSize)

for ($i = 0; $i -lt $organizations.Count; $i += $BatchSize) {
    Write-Host "   ?Processing Batch $batchNumber of $totalBatches" -ForegroundColor Yellow
    Write-Host ""
    
    $batch = $organizations[$i..[Math]::Min($i + $BatchSize - 1, $organizations.Count - 1)]
    
    foreach ($org in $batch) {
        try {
            Write-Host "      ?$($org.Name)" -ForegroundColor White
            
            # Enrich the organization
            $result = Enrich-Organization `
                -Organization $org `
                -ClearbitApiKey $ClearbitApiKey `
                -SkipLogos $SkipLogos `
                -SkipWebsites $SkipWebsites `
                -SkipLinkedIn $SkipLinkedIn
            
            if ($result.Count -eq 0) {
                Write-Host "         ? No enrichment needed" -ForegroundColor Yellow
                $skippedCount++
            } else {
                # Update database
                $updated = Update-OrganizationData `
                    -ConnectionString $ConnectionString `
                    -OrganizationID $org.OrganizationID `
                    -Data $result.Updates
                
                if ($updated) {
                    Write-Host "         Updated $($result.Count) fields in database" -ForegroundColor Green
                    $enrichedCount++
                    $totalFieldsEnriched += $result.Count
                }
            }
            
        } catch {
            Write-Host "         Error: $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
        }
    }
    
    Write-Host ""
    $batchNumber++
}

# ================================================================
# Summary
# ================================================================

Write-Host "==================================================================" -ForegroundColor Green
Write-Host " ENRICHMENT SUMMARY                                            ?" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""

Write-Host "Statistics:" -ForegroundColor Cyan
Write-Host "   Organizations enriched: $enrichedCount" -ForegroundColor Green
Write-Host "   ?Total fields updated: $totalFieldsEnriched" -ForegroundColor White
Write-Host "   ? Skipped (no updates): $skippedCount" -ForegroundColor Yellow
if ($errorCount -gt 0) {
    Write-Host "   Errors: $errorCount" -ForegroundColor Red
}
Write-Host "   ?Total processed: $($organizations.Count)" -ForegroundColor White

# Get enrichment statistics
$stats = Invoke-Sqlcmd -ConnectionString $ConnectionString -Query @"
SELECT 
    COUNT(*) as Total,
    SUM(CASE WHEN LogoURL IS NOT NULL THEN 1 ELSE 0 END) as WithLogos,
    SUM(CASE WHEN Website IS NOT NULL THEN 1 ELSE 0 END) as WithWebsites,
    SUM(CASE WHEN LinkedInProfile IS NOT NULL THEN 1 ELSE 0 END) as WithLinkedIn,
    SUM(CASE WHEN Description IS NOT NULL THEN 1 ELSE 0 END) as WithDescription,
    SUM(CASE WHEN Industry IS NOT NULL THEN 1 ELSE 0 END) as WithIndustry
FROM Organizations
WHERE IsActive = 1
"@ -QueryTimeout 30

Write-Host ""
Write-Host "Database Status:" -ForegroundColor Cyan
Write-Host "   Total Organizations: $($stats.Total)" -ForegroundColor White
Write-Host "   With Logos: $($stats.WithLogos) ($([math]::Round($stats.WithLogos/$stats.Total*100, 1))%)" -ForegroundColor White
Write-Host "   With Websites: $($stats.WithWebsites) ($([math]::Round($stats.WithWebsites/$stats.Total*100, 1))%)" -ForegroundColor White
Write-Host "   With LinkedIn: $($stats.WithLinkedIn) ($([math]::Round($stats.WithLinkedIn/$stats.Total*100, 1))%)" -ForegroundColor White
Write-Host "   With Description: $($stats.WithDescription) ($([math]::Round($stats.WithDescription/$stats.Total*100, 1))%)" -ForegroundColor White
Write-Host "   With Industry: $($stats.WithIndustry) ($([math]::Round($stats.WithIndustry/$stats.Total*100, 1))%)" -ForegroundColor White

Write-Host ""
Write-Host "Enrichment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "   � Test API: Invoke-RestMethod https://refopen-api-func.azurewebsites.net/api/reference/organizations" -ForegroundColor White
Write-Host "   � Run again with -OnlyMissingData to fill remaining gaps" -ForegroundColor White
Write-Host "   � Add Clearbit API key for full enrichment" -ForegroundColor White
Write-Host ""
