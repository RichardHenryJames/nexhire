# ================================================================
# Automated Organization Enrichment Script
# ================================================================
# Automatically enriches ALL organizations in RefOpen database
# Fetches missing data from public APIs without user interaction
# NO SUMMARY DOCUMENTS OR .MD FILES ARE CREATED
# ================================================================

param(
    [string]$ConnectionString = $env:DB_CONNECTION_STRING,
    [string]$KeyVaultName = "refopen-keyvault-prod",
    [string]$ClearbitApiKey = "",
    [int]$BatchSize = 50,
    [int]$ApiRateLimitDelayMs = 2000,
    [switch]$DryRun,
    [switch]$OnlyMissingData,
    [switch]$SkipLogos,
  [switch]$SkipWebsites,
    [switch]$SkipLinkedIn
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

$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " AUTOMATED ORGANIZATION ENRICHMENT" -ForegroundColor Cyan
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

  if ([string]::IsNullOrEmpty($Domain)) {
      return $null
}

  try {
      # Clean the domain properly
      $cleanDomain = $Domain -replace '^https?://', '' -replace '^www\.', '' -replace '/$', '' -replace '/.*$', ''

      # ✅ PREVENTION: Skip Wikipedia, LinkedIn, and other invalid domains
      if ($cleanDomain -match 'wikipedia\.org|wikimedia\.org|wiki\.|linkedin\.com|facebook\.com|twitter\.com|instagram\.com') {
          Write-Host "         ⚠️ Skipping social media/wiki domain: $cleanDomain" -ForegroundColor Yellow
          return $null
      }

    # Skip if domain is invalid
      $domainPattern = '^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
      if ($cleanDomain -notmatch $domainPattern) {
          return $null
      }

        # 🔄 UPDATED: Use Google's favicon API instead of Clearbit (blocked in India)
        # Google's high-res favicon API works globally
        $logoUrl = "https://www.google.com/s2/favicons?domain=$cleanDomain&sz=128"

     # Test if logo exists
        $response = Invoke-WebRequest -Uri $logoUrl -Method Head -TimeoutSec 5 -ErrorAction SilentlyContinue
   if ($response.StatusCode -eq 200) {
  return $logoUrl
    }
    } catch {
        # Logo not found or error occurred
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
   $cleanDomain = $Domain -replace '^https?://', '' -replace '^www\.', '' -replace '/$', '' -replace '/.*$', ''
        $url = "https://company.clearbit.com/v2/companies/find?domain=$cleanDomain"

    $headers = @{
            "Authorization" = "Bearer $ApiKey"
        }

        $response = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 10 -ErrorAction Stop

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

function Search-CompanyWebsite {
    param([string]$CompanyName)

    if ([string]::IsNullOrEmpty($CompanyName)) {
    return $null
 }

    try {
     # Try Google search approach (using DuckDuckGo as it doesn't require API key)
        Add-Type -AssemblyName System.Web
        $searchTerm = [System.Web.HttpUtility]::UrlEncode("$CompanyName official website")
        $url = "https://html.duckduckgo.com/html/?q=$searchTerm"

        $response = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -ErrorAction Stop

        # Try to extract first result URL
        if ($response.Content -match 'uddg=([^"&]+)') {
    $website = [System.Web.HttpUtility]::UrlDecode($matches[1])

            # ✅ PREVENTION: Skip Wikipedia and LinkedIn URLs
            if ($website -match 'wikipedia\.org|wikimedia\.org|wiki\.|linkedin\.com|facebook\.com|twitter\.com') {
                Write-Host "         ⚠️ Skipping social media/wiki website for $CompanyName" -ForegroundColor Yellow
                return $null
            }

            # Validate it's a proper URL
            if ($website -match '^https?://') {
      $uri = [System.Uri]$website
  return "https://$($uri.Host)"
          }
        }
} catch {
        # Search failed
    }

 # Fallback: Try common domain patterns
    $companySlug = $CompanyName.ToLower() -replace '\s+', '' -replace '[^a-z0-9]', ''
    
    # ✅ PREVENTION: Don't try to validate social media company names
    if ($companySlug -match 'linkedin|facebook|twitter|instagram|wikipedia|wiki') {
        Write-Host "         ⚠️ Skipping social media company name: $CompanyName" -ForegroundColor Yellow
        return $null
    }
    
    $possibleDomains = @(
      "https://www.$companySlug.com",
"https://www.$companySlug.io",
        "https://www.$companySlug.co"
    )

    foreach ($domain in $possibleDomains) {
        try {
  $test = Invoke-WebRequest -Uri $domain -Method Head -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($test.StatusCode -eq 200) {
                return $domain
       }
        } catch {
            continue
        }
    }

    return $null
}

function Get-LinkedInUrl {
    param([string]$CompanyName)

  if ([string]::IsNullOrEmpty($CompanyName)) {
        return $null
    }

    # Generate LinkedIn company URL
    $companySlug = $CompanyName.ToLower() -replace '\s+', '-' -replace '[^a-z0-9\-]', ''
    return "https://www.linkedin.com/company/$companySlug"
}

# 🛡️ NEW: Validate if website URL matches company name
function Test-WebsiteMatchesCompany {
    param(
        [string]$WebsiteUrl,
        [string]$CompanyName
    )

    if ([string]::IsNullOrEmpty($WebsiteUrl) -or [string]::IsNullOrEmpty($CompanyName)) {
        return $false
    }

    try {
        $uri = [System.Uri]$WebsiteUrl
        $hostname = $uri.Host.ToLower() -replace '^www\.', ''
        
        # ❌ Block search engines and wrong domains
        $blockedDomains = @('duckduckgo.com', 'google.com', 'bing.com', 'yahoo.com')
        if ($blockedDomains -contains $hostname) {
            Write-Host "         ⚠️ Blocked search engine domain: $hostname" -ForegroundColor Yellow
            return $false
        }
        
        # ✅ Validate domain matches company name
        $companySlug = $CompanyName.ToLower() -replace '[^a-z0-9]', ''
        $domainSlug = $hostname -replace '\.(com|io|co|net|org|ai|app)$', '' -replace '[^a-z0-9]', ''
        
        # Check if domain contains at least first 4 chars of company name
        $minMatchLength = [Math]::Min($companySlug.Length, 4)
        $hasMatch = $domainSlug.Contains($companySlug.Substring(0, $minMatchLength)) -or 
                    $companySlug.Contains($domainSlug.Substring(0, [Math]::Min($domainSlug.Length, 4)))
        
        if (-not $hasMatch -and $companySlug.Length -gt 3) {
            Write-Host "         ⚠️ Domain '$hostname' doesn't match company '$CompanyName'" -ForegroundColor Yellow
            return $false
        }
        
        return $true
    } catch {
        return $false
    }
}

function Get-LinkedInUrl {
    param([string]$CompanyName)

  if ([string]::IsNullOrEmpty($CompanyName)) {
        return $null
    }

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

    # ✅ OPTIMIZED: Always filter to only organizations with missing data
    # No need to iterate over fully enriched organizations
    # 🛡️ TIER PROTECTION: Elite AND Premium orgs are EXCLUDED (manually curated, 100% data)
    $query = @"
SELECT
    OrganizationID,
    Name,
    Website,
    LogoURL,
    LinkedInProfile,
    Description,
    Industry,
    Headquarters,
    ISNULL(Tier, 'Standard') as Tier
FROM Organizations
WHERE IsActive = 1
  AND ISNULL(Tier, 'Standard') NOT IN ('Elite', 'Premium')
  AND (
    Website IS NULL OR Website = '' OR
    LogoURL IS NULL OR LogoURL = '' OR
    LinkedInProfile IS NULL OR LinkedInProfile = '' OR
    Description IS NULL OR Description = '' OR
    Industry IS NULL OR Industry = ''
  )
ORDER BY CreatedAt DESC
"@

    return Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $query -QueryTimeout 60
}

function Update-OrganizationData {
    param(
        [string]$ConnectionString,
        [int]$OrganizationID,
    [hashtable]$Data
    )

    $updateParts = @()
    $parameters = @()
    $paramIndex = 0

    if ($Data.Website) {
        $updateParts += "Website = @param$paramIndex"
        $parameters += @{ Name = "@param$paramIndex"; Value = $Data.Website; SqlDbType = [System.Data.SqlDbType]::NVarChar }
 $paramIndex++
    }

    if ($Data.LogoURL) {
        $updateParts += "LogoURL = @param$paramIndex"
        $parameters += @{ Name = "@param$paramIndex"; Value = $Data.LogoURL; SqlDbType = [System.Data.SqlDbType]::NVarChar }
        $paramIndex++
    }

    if ($Data.LinkedInProfile) {
     $updateParts += "LinkedInProfile = @param$paramIndex"
        $parameters += @{ Name = "@param$paramIndex"; Value = $Data.LinkedInProfile; SqlDbType = [System.Data.SqlDbType]::NVarChar }
        $paramIndex++
    }

    if ($Data.Description) {
        $updateParts += "Description = @param$paramIndex"
        $parameters += @{ Name = "@param$paramIndex"; Value = $Data.Description; SqlDbType = [System.Data.SqlDbType]::NVarChar }
        $paramIndex++
    }

    if ($Data.Industry) {
        $updateParts += "Industry = @param$paramIndex"
$parameters += @{ Name = "@param$paramIndex"; Value = $Data.Industry; SqlDbType = [System.Data.SqlDbType]::NVarChar }
        $paramIndex++
    }

    if ($Data.Headquarters) {
      $updateParts += "Headquarters = @param$paramIndex"
        $parameters += @{ Name = "@param$paramIndex"; Value = $Data.Headquarters; SqlDbType = [System.Data.SqlDbType]::NVarChar }
        $paramIndex++
    }

    if ($Data.EstablishedDate) {
     $updateParts += "EstablishedDate = @param$paramIndex"
        $parameters += @{ Name = "@param$paramIndex"; Value = $Data.EstablishedDate; SqlDbType = [System.Data.SqlDbType]::Date }
        $paramIndex++
    }

    if ($Data.Size) {
    $updateParts += "Size = @param$paramIndex"
        $parameters += @{ Name = "@param$paramIndex"; Value = $Data.Size; SqlDbType = [System.Data.SqlDbType]::NVarChar }
        $paramIndex++
    }

    if ($updateParts.Count -eq 0) {
        return $false
    }

  $updateParts += "UpdatedAt = GETUTCDATE()"

    $query = @"
UPDATE Organizations
SET $($updateParts -join ', ')
WHERE OrganizationID = @orgId
"@

    try {
        $connection = New-Object System.Data.SqlClient.SqlConnection($ConnectionString)
        $command = $connection.CreateCommand()
        $command.CommandText = $query
        $command.CommandTimeout = 30

        # Add parameters
        foreach ($param in $parameters) {
  $sqlParam = $command.Parameters.Add($param.Name, $param.SqlDbType)
          $sqlParam.Value = $param.Value
 }

  # Add organization ID parameter
        $orgParam = $command.Parameters.Add("@orgId", [System.Data.SqlDbType]::Int)
        $orgParam.Value = $OrganizationID

        $connection.Open()
        $rowsAffected = $command.ExecuteNonQuery()
        $connection.Close()

    return $rowsAffected -gt 0
    } catch {
      Write-Host "   ❌ Database update failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    } finally {
if ($connection -and $connection.State -eq 'Open') {
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
        Write-Host "      🔍 Searching for website..." -ForegroundColor Gray

        $website = Search-CompanyWebsite -CompanyName $Organization.Name
        if ($website) {
            # ✅ NEW: Validate website matches company name before saving
            if (Test-WebsiteMatchesCompany -WebsiteUrl $website -CompanyName $Organization.Name) {
                $updates.Website = $website
                Write-Host "         ✅ Found: $website" -ForegroundColor Green
                $enrichmentCount++
            } else {
                Write-Host "         ❌ Rejected mismatched website: $website" -ForegroundColor Red
            }
        }

        Start-Sleep -Milliseconds $ApiRateLimitDelayMs
    }

    $websiteToUse = if ($updates.Website) { $updates.Website } else { $Organization.Website }

    # 2. Get logo if missing and we have a website
    if ([string]::IsNullOrEmpty($Organization.LogoURL) -and -not $SkipLogos -and $websiteToUse) {
        Write-Host "      🎨 Fetching logo..." -ForegroundColor Gray

        $logo = Get-ClearbitLogo -Domain $websiteToUse

        if ($logo) {
            $updates.LogoURL = $logo
            Write-Host "         ✅ Found: $logo" -ForegroundColor Green
            $enrichmentCount++
        } else {
            Write-Host "         ℹ️ No logo found" -ForegroundColor Yellow
        }

        Start-Sleep -Milliseconds 500
    }

    # 3. Get comprehensive data from Clearbit if API key provided AND we need data
    $needsClearbitData = ([string]::IsNullOrEmpty($Organization.Description) -or 
                          [string]::IsNullOrEmpty($Organization.Industry) -or 
                          [string]::IsNullOrEmpty($Organization.Headquarters) -or
                          [string]::IsNullOrEmpty($Organization.LinkedInProfile))
    
    if ($websiteToUse -and -not [string]::IsNullOrEmpty($ClearbitApiKey) -and $needsClearbitData) {
   Write-Host "      📊 Fetching company data from Clearbit..." -ForegroundColor Gray
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
           try {
        $updates.EstablishedDate = [datetime]::Parse("$($clearbitData.FoundedYear)-01-01")
   $enrichmentCount++
 } catch {
        # Invalid date
     }
            }

        if ($clearbitData.EmployeeCount) {
      $updates.Size = $clearbitData.EmployeeCount
    $enrichmentCount++
    }

      if ([string]::IsNullOrEmpty($Organization.LinkedInProfile) -and $clearbitData.LinkedIn) {
                $updates.LinkedInProfile = $clearbitData.LinkedIn
       $enrichmentCount++
   }

            # Better logo from Clearbit if we don't have one yet
            if ([string]::IsNullOrEmpty($Organization.LogoURL) -and [string]::IsNullOrEmpty($updates.LogoURL) -and $clearbitData.Logo) {
       $updates.LogoURL = $clearbitData.Logo
                $enrichmentCount++
}

            if ($enrichmentCount -gt 0) {
  Write-Host "         ✅ Found: $enrichmentCount fields from Clearbit" -ForegroundColor Green
 } else {
       Write-Host "         ℹ️ No new data from Clearbit" -ForegroundColor Yellow
            }
        }
    }

    # 4. Generate LinkedIn URL if missing
    if ([string]::IsNullOrEmpty($Organization.LinkedInProfile) -and [string]::IsNullOrEmpty($updates.LinkedInProfile) -and -not $SkipLinkedIn) {
    $updates.LinkedInProfile = Get-LinkedInUrl -CompanyName $Organization.Name
        Write-Host "    🔗 Generated: LinkedIn URL" -ForegroundColor Cyan
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

Write-Host " Found $($organizations.Count) organizations to enrich" -ForegroundColor Green
Write-Host ""

if ($organizations.Count -eq 0) {
    Write-Host "✅ All organizations are already enriched!" -ForegroundColor Green
    exit 0
}

Write-Host "Step 2: Enriching Organizations" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "   ⚠️ DRY RUN - Showing first 5 organizations:" -ForegroundColor Yellow
    $organizations | Select-Object -First 5 | ForEach-Object {
        Write-Host "      • $($_.Name)" -ForegroundColor Gray
      $missing = @()
    if ([string]::IsNullOrWhiteSpace($_.Website)) { $missing += "Website" }
        if ([string]::IsNullOrWhiteSpace($_.LogoURL)) { $missing += "Logo" }
     if ([string]::IsNullOrWhiteSpace($_.LinkedInProfile)) { $missing += "LinkedIn" }
        if ($missing.Count -gt 0) {
    Write-Host "        Missing: $($missing -join ', ')" -ForegroundColor DarkGray
   } else {
       Write-Host "        All data present" -ForegroundColor Green
  }
    }
    Write-Host ""
    Write-Host "   ➡️ Run without -DryRun to perform actual enrichment" -ForegroundColor Cyan
    exit 0
}

$enrichedCount = 0
$skippedCount = 0
$errorCount = 0
$totalFieldsEnriched = 0

$batchNumber = 1
$totalBatches = [Math]::Ceiling($organizations.Count / $BatchSize)

for ($i = 0; $i -lt $organizations.Count; $i += $BatchSize) {
  Write-Host "   📦 Processing Batch $batchNumber of $totalBatches" -ForegroundColor Yellow
    Write-Host ""

  $batch = $organizations[$i..[Math]::Min($i + $BatchSize - 1, $organizations.Count - 1)]

    foreach ($org in $batch) {
        try {
            # ✅ SMART SKIP: Check if organization needs enrichment
            $needsEnrichment = $false
            $missingFields = @()
            
            if ([string]::IsNullOrWhiteSpace($org.Website) -and -not $SkipWebsites) { 
                $needsEnrichment = $true
                $missingFields += "Website"
            }
            if ([string]::IsNullOrWhiteSpace($org.LogoURL) -and -not $SkipLogos) { 
                $needsEnrichment = $true
                $missingFields += "Logo"
            }
            if ([string]::IsNullOrWhiteSpace($org.LinkedInProfile) -and -not $SkipLinkedIn) { 
                $needsEnrichment = $true
                $missingFields += "LinkedIn"
            }
            if ([string]::IsNullOrWhiteSpace($org.Description)) { 
                $needsEnrichment = $true
                $missingFields += "Description"
            }
            if ([string]::IsNullOrWhiteSpace($org.Industry)) { 
                $needsEnrichment = $true
                $missingFields += "Industry"
            }
            
            if (-not $needsEnrichment) {
                Write-Host "      ⏭️ $($org.Name) - Already complete, skipping" -ForegroundColor DarkGray
                $skippedCount++
                continue
            }
            
            Write-Host "      🏢 $($org.Name)" -ForegroundColor White
            Write-Host "         Missing: $($missingFields -join ', ')" -ForegroundColor DarkGray

      # Enrich the organization
          $result = Enrich-Organization `
           -Organization $org `
           -ClearbitApiKey $ClearbitApiKey `
  -SkipLogos $SkipLogos `
        -SkipWebsites $SkipWebsites `
       -SkipLinkedIn $SkipLinkedIn

            if ($result.Count -eq 0) {
    Write-Host "         ℹ️ No enrichment needed" -ForegroundColor Yellow
        $skippedCount++
            } else {
                # Update database
     $updated = Update-OrganizationData `
        -ConnectionString $ConnectionString `
         -OrganizationID $org.OrganizationID `
       -Data $result.Updates

              if ($updated) {
          Write-Host "         ✅ Updated $($result.Count) fields in database" -ForegroundColor Green
           $enrichedCount++
         $totalFieldsEnriched += $result.Count
          } else {
        Write-Host "    ⚠️ Database update returned no changes" -ForegroundColor Yellow
      }
      }

        } catch {
            Write-Host "         ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
 $errorCount++
        }
    }

    Write-Host ""
    $batchNumber++
}

# ================================================================
# Summary (Console output only - NO FILES CREATED)
# ================================================================

Write-Host "==================================================================" -ForegroundColor Green
Write-Host " ENRICHMENT SUMMARY" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""

Write-Host "Statistics:" -ForegroundColor Cyan
Write-Host "   ✅ Organizations enriched: $enrichedCount" -ForegroundColor Green
Write-Host " 📊 Total fields updated: $totalFieldsEnriched" -ForegroundColor White
Write-Host "   ⏭️ Skipped (no updates): $skippedCount" -ForegroundColor Yellow
if ($errorCount -gt 0) {
    Write-Host "   ❌ Errors: $errorCount" -ForegroundColor Red
}
Write-Host "   📝 Total processed: $($organizations.Count)" -ForegroundColor White

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
Write-Host "✅ Enrichment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host " 🔍 Test API: Invoke-RestMethod https://refopen-api-func.azurewebsites.net/api/reference/organizations" -ForegroundColor White
Write-Host "   🔄 Run again with -OnlyMissingData to fill remaining gaps" -ForegroundColor White
if ([string]::IsNullOrEmpty($ClearbitApiKey)) {
    Write-Host "   🔑 Add Clearbit API key for full enrichment: -ClearbitApiKey 'your-key'" -ForegroundColor White
}
Write-Host ""