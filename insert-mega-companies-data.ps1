#!/usr/bin/env pwsh

# NexHire MEGA Companies Data Insert Script - COMPATIBLE VERSION
# Works with all PowerShell versions and Invoke-Sqlcmd implementations
# Fetches from multiple open source APIs and populates real companies

Write-Host "NexHire MEGA Companies Data Insert Script - COMPATIBLE" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# Azure SQL Database connection parameters
$serverName = "nexhire-sql-srv.database.windows.net"
$databaseName = "nexhire-sql-db"
$username = "sqladmin"
$password = "P@ssw0rd1234!"

# Build connection string
$connectionString = "Server=tcp:$serverName,1433;Initial Catalog=$databaseName;Persist Security Info=False;User ID=$username;Password=$password;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

Write-Host "`nTesting database connection..." -ForegroundColor Yellow

try {
    $testQuery = "SELECT COUNT(*) as TableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Organizations'"
    $testResult = Invoke-Sqlcmd -ConnectionString $connectionString -Query $testQuery -ErrorAction Stop
    
    if ($testResult.TableCount -gt 0) {
        Write-Host "? Database connection successful" -ForegroundColor Green
    } else {
        Write-Host "? Organizations table not found" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "? Database connection failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`nFetching company data from multiple sources..." -ForegroundColor Green

# Function to fetch Fortune 500 companies
function Get-Fortune500Companies {
    Write-Host "Fetching Fortune 500 companies..." -ForegroundColor Yellow
    
    try {
        # Fortune 500 companies from GitHub dataset
        $fortuneUrl = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"
        $fortuneData = Invoke-RestMethod -Uri $fortuneUrl -TimeoutSec 30
        
        $companies = @()
        $fortuneData -split "`n" | Select-Object -Skip 1 | ForEach-Object {
            if ($_ -and $_.Trim() -ne "") {
                $fields = $_ -split ","
                if ($fields.Length -ge 3) {
                    $companies += @{
                        Name = $fields[1].Trim('"')
                        Industry = $fields[3].Trim('"')
                        Type = "Corporation"
                        Size = "Enterprise"
                        Website = if ($fields.Length -gt 7) { "https://" + $fields[7].Trim('"') } else { $null }
                        Source = "S&P 500"
                    }
                }
            }
        }
        
        Write-Host "? Fetched $($companies.Count) S&P 500 companies" -ForegroundColor Green
        return $companies
    } catch {
        Write-Host "Could not fetch Fortune 500 data: $($_.Exception.Message)" -ForegroundColor Yellow
        return @()
    }
}

# Function to get Indian companies from NSE/BSE
function Get-IndianCompanies {
    Write-Host "??Adding Indian companies..." -ForegroundColor Yellow
    
    # Curated list of major Indian companies
    $indianCompanies = @(
        @{ Name = "Reliance Industries Limited"; Industry = "Oil & Gas"; Type = "Corporation"; Size = "Enterprise"; Website = "https://www.ril.com" },
        @{ Name = "Tata Consultancy Services"; Industry = "Technology"; Type = "Corporation"; Size = "Enterprise"; Website = "https://www.tcs.com" },
        @{ Name = "HDFC Bank"; Industry = "Finance"; Type = "Corporation"; Size = "Enterprise"; Website = "https://www.hdfcbank.com" },
        @{ Name = "Infosys Limited"; Industry = "Technology"; Type = "Corporation"; Size = "Large"; Website = "https://www.infosys.com" },
        @{ Name = "ICICI Bank"; Industry = "Finance"; Type = "Corporation"; Size = "Enterprise"; Website = "https://www.icicibank.com" },
        @{ Name = "State Bank of India"; Industry = "Finance"; Type = "Government"; Size = "Enterprise"; Website = "https://www.sbi.co.in" },
        @{ Name = "Bharti Airtel"; Industry = "Telecommunications"; Type = "Corporation"; Size = "Large"; Website = "https://www.airtel.in" },
        @{ Name = "Wipro Limited"; Industry = "Technology"; Type = "Corporation"; Size = "Large"; Website = "https://www.wipro.com" },
        @{ Name = "HCL Technologies"; Industry = "Technology"; Type = "Corporation"; Size = "Large"; Website = "https://www.hcltech.com" },
        @{ Name = "Tech Mahindra"; Industry = "Technology"; Type = "Corporation"; Size = "Large"; Website = "https://www.techmahindra.com" },
        @{ Name = "Larsen & Toubro"; Industry = "Construction"; Type = "Corporation"; Size = "Large"; Website = "https://www.larsentoubro.com" },
        @{ Name = "Asian Paints"; Industry = "Manufacturing"; Type = "Corporation"; Size = "Large"; Website = "https://www.asianpaints.com" },
        @{ Name = "Bajaj Finance"; Industry = "Finance"; Type = "Corporation"; Size = "Large"; Website = "https://www.bajajfinserv.in" },
        @{ Name = "Maruti Suzuki"; Industry = "Automotive"; Type = "Corporation"; Size = "Large"; Website = "https://www.marutisuzuki.com" },
        @{ Name = "Titan Company"; Industry = "Consumer Goods"; Type = "Corporation"; Size = "Medium"; Website = "https://www.titan.co.in" },
        @{ Name = "Flipkart"; Industry = "E-commerce"; Type = "Corporation"; Size = "Large"; Website = "https://www.flipkart.com" },
        @{ Name = "Zomato"; Industry = "Food Delivery"; Type = "Corporation"; Size = "Medium"; Website = "https://www.zomato.com" },
        @{ Name = "Paytm"; Industry = "Fintech"; Type = "Corporation"; Size = "Medium"; Website = "https://www.paytm.com" },
        @{ Name = "BYJU'S"; Industry = "Education"; Type = "Corporation"; Size = "Medium"; Website = "https://byjus.com" },
        @{ Name = "Ola"; Industry = "Transportation"; Type = "Corporation"; Size = "Medium"; Website = "https://www.olacabs.com" },
        @{ Name = "Swiggy"; Industry = "Food Delivery"; Type = "Corporation"; Size = "Medium"; Website = "https://www.swiggy.com" },
        @{ Name = "PhonePe"; Industry = "Fintech"; Type = "Corporation"; Size = "Medium"; Website = "https://www.phonepe.com" },
        @{ Name = "Razorpay"; Industry = "Fintech"; Type = "Corporation"; Size = "Small"; Website = "https://razorpay.com" },
        @{ Name = "Freshworks"; Industry = "Technology"; Type = "Corporation"; Size = "Medium"; Website = "https://www.freshworks.com" },
        @{ Name = "Zoho Corporation"; Industry = "Technology"; Type = "Corporation"; Size = "Medium"; Website = "https://www.zoho.com" }
    )
    
    foreach ($company in $indianCompanies) {
        $company.Source = "India Major Companies"
    }
    
    Write-Host "? Added $($indianCompanies.Count) major Indian companies" -ForegroundColor Green
    return $indianCompanies
}

# Function to get global tech companies
function Get-GlobalTechCompanies {
    Write-Host "Adding global tech companies..." -ForegroundColor Yellow
    
    $techCompanies = @(
        @{ Name = "NVIDIA Corporation"; Industry = "Technology"; Type = "Corporation"; Size = "Large"; Website = "https://www.nvidia.com" },
        @{ Name = "Advanced Micro Devices"; Industry = "Technology"; Type = "Corporation"; Size = "Large"; Website = "https://www.amd.com" },
        @{ Name = "Intel Corporation"; Industry = "Technology"; Type = "Corporation"; Size = "Enterprise"; Website = "https://www.intel.com" },
        @{ Name = "Salesforce"; Industry = "Technology"; Type = "Corporation"; Size = "Large"; Website = "https://www.salesforce.com" },
        @{ Name = "Oracle Corporation"; Industry = "Technology"; Type = "Corporation"; Size = "Enterprise"; Website = "https://www.oracle.com" },
        @{ Name = "ServiceNow"; Industry = "Technology"; Type = "Corporation"; Size = "Large"; Website = "https://www.servicenow.com" },
        @{ Name = "Snowflake"; Industry = "Technology"; Type = "Corporation"; Size = "Medium"; Website = "https://www.snowflake.com" },
        @{ Name = "Databricks"; Industry = "Technology"; Type = "Corporation"; Size = "Medium"; Website = "https://www.databricks.com" },
        @{ Name = "Palantir"; Industry = "Technology"; Type = "Corporation"; Size = "Medium"; Website = "https://www.palantir.com" },
        @{ Name = "Coinbase"; Industry = "Fintech"; Type = "Corporation"; Size = "Medium"; Website = "https://www.coinbase.com" },
        @{ Name = "Block (Square)"; Industry = "Fintech"; Type = "Corporation"; Size = "Large"; Website = "https://www.block.xyz" },
        @{ Name = "Robinhood"; Industry = "Fintech"; Type = "Corporation"; Size = "Medium"; Website = "https://www.robinhood.com" },
        @{ Name = "Discord"; Industry = "Technology"; Type = "Corporation"; Size = "Medium"; Website = "https://www.discord.com" },
        @{ Name = "Twitch"; Industry = "Entertainment"; Type = "Corporation"; Size = "Medium"; Website = "https://www.twitch.tv" },
        @{ Name = "Canva"; Industry = "Technology"; Type = "Corporation"; Size = "Medium"; Website = "https://www.canva.com" },
        @{ Name = "Figma"; Industry = "Technology"; Type = "Corporation"; Size = "Small"; Website = "https://www.figma.com" },
        @{ Name = "Notion"; Industry = "Technology"; Type = "Corporation"; Size = "Small"; Website = "https://www.notion.so" },
        @{ Name = "Atlassian"; Industry = "Technology"; Type = "Corporation"; Size = "Large"; Website = "https://www.atlassian.com" },
        @{ Name = "MongoDB"; Industry = "Technology"; Type = "Corporation"; Size = "Medium"; Website = "https://www.mongodb.com" },
        @{ Name = "Elastic"; Industry = "Technology"; Type = "Corporation"; Size = "Medium"; Website = "https://www.elastic.co" }
    )
    
    foreach ($company in $techCompanies) {
        $company.Source = "Global Tech Companies"
    }
    
    Write-Host "? Added $($techCompanies.Count) global tech companies" -ForegroundColor Green
    return $techCompanies
}

# Collect all companies from different sources
$allCompanies = @()

# Add companies from different sources
$allCompanies += Get-Fortune500Companies
$allCompanies += Get-IndianCompanies
$allCompanies += Get-GlobalTechCompanies

Write-Host "`nTotal companies collected: $($allCompanies.Count)" -ForegroundColor Cyan

# Create batch insert script to avoid parameter issues
Write-Host "`nCreating batch insert script..." -ForegroundColor Green

$insertScript = @"
-- NexHire Mega Companies Batch Insert
-- Generated on $(Get-Date)

BEGIN TRANSACTION;

-- Use MERGE to prevent duplicates
MERGE Organizations AS target
USING (VALUES
"@

$insertedCount = 0
$batchSize = 100
$valuesList = @()

foreach ($company in $allCompanies) {
    if (-not $company.Name -or $company.Name.Trim() -eq "") {
        continue
    }
    
    # Escape single quotes in data
    $escapedName = $company.Name.Replace("'", "''")
    $escapedType = $company.Type.Replace("'", "''")
    $escapedIndustry = $company.Industry.Replace("'", "''")
    $escapedSize = $company.Size.Replace("'", "''")
    $escapedWebsite = if ($company.Website) { $company.Website.Replace("'", "''") } else { "" }
    $escapedSource = $company.Source.Replace("'", "''")
    
    $valuesList += "    ('$escapedName', '$escapedType', '$escapedIndustry', '$escapedSize', '$escapedWebsite', '', '$escapedSource', 'Pending')"
    $insertedCount++
    
    # Process in batches to avoid query size limits
    if ($valuesList.Count -ge $batchSize) {
        $insertScript += "`n" + ($valuesList -join ",`n")
        $insertScript += @"

) AS source (Name, Type, Industry, Size, Website, LinkedInProfile, Description, VerificationStatus)
ON target.Name = source.Name AND target.IsActive = 1
WHEN NOT MATCHED THEN
    INSERT (Name, Type, Industry, Size, Website, LinkedInProfile, Description, VerificationStatus, IsActive, CreatedAt, UpdatedAt)
    VALUES (source.Name, source.Type, source.Industry, source.Size, source.Website, source.LinkedInProfile, source.Description, source.VerificationStatus, 1, GETUTCDATE(), GETUTCDATE());

-- Next batch
MERGE Organizations AS target
USING (VALUES
"@
        $valuesList = @()
    }
}

# Process remaining companies
if ($valuesList.Count -gt 0) {
    $insertScript += "`n" + ($valuesList -join ",`n")
}

$insertScript += @"

) AS source (Name, Type, Industry, Size, Website, LinkedInProfile, Description, VerificationStatus)
ON target.Name = source.Name AND target.IsActive = 1
WHEN NOT MATCHED THEN
    INSERT (Name, Type, Industry, Size, Website, LinkedInProfile, Description, VerificationStatus, IsActive, CreatedAt, UpdatedAt)
    VALUES (source.Name, source.Type, source.Industry, source.Size, source.Website, source.LinkedInProfile, source.Description, source.VerificationStatus, 1, GETUTCDATE(), GETUTCDATE());

COMMIT TRANSACTION;

-- Verify the insert
SELECT 
    'Insert completed successfully!' as Status,
    COUNT(*) as TotalOrganizations,
    COUNT(CASE WHEN Size = 'Small' THEN 1 END) as SmallCompanies,
    COUNT(CASE WHEN Size = 'Medium' THEN 1 END) as MediumCompanies,
    COUNT(CASE WHEN Size = 'Large' THEN 1 END) as LargeCompanies,
    COUNT(CASE WHEN Size = 'Enterprise' THEN 1 END) as EnterpriseCompanies
FROM Organizations 
WHERE IsActive = 1;

-- Show industry breakdown
SELECT 
    Industry,
    COUNT(*) as CompanyCount
FROM Organizations 
WHERE IsActive = 1
GROUP BY Industry
ORDER BY CompanyCount DESC;
"@

Write-Host "Generated batch insert script with $insertedCount companies" -ForegroundColor White

Write-Host "`nExecuting batch insert..." -ForegroundColor Yellow

try {
    # Execute the batch insert script
    $result = Invoke-Sqlcmd -ConnectionString $connectionString -Query $insertScript -ErrorAction Stop
    
    Write-Host "? Companies data inserted successfully!" -ForegroundColor Green
    
    # Display results
    if ($result) {
        Write-Host "`nInsert Summary:" -ForegroundColor Cyan
        $summary = $result | Where-Object { $_.Status -eq 'Insert completed successfully!' }
        if ($summary) {
            Write-Host "Total Organizations: $($summary.TotalOrganizations)" -ForegroundColor White
            Write-Host "Small Companies: $($summary.SmallCompanies)" -ForegroundColor White
            Write-Host "Medium Companies: $($summary.MediumCompanies)" -ForegroundColor White
            Write-Host "Large Companies: $($summary.LargeCompanies)" -ForegroundColor White
            Write-Host "Enterprise Companies: $($summary.EnterpriseCompanies)" -ForegroundColor White
        }
        
        Write-Host "`nIndustry Breakdown:" -ForegroundColor Cyan
        $industries = $result | Where-Object { $_.Industry }
        foreach ($industry in $industries) {
            Write-Host "� $($industry.Industry): $($industry.CompanyCount) companies" -ForegroundColor White
        }
    }
    
} catch {
    Write-Host "? Error executing batch insert: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to rollback if in transaction
    try {
        Invoke-Sqlcmd -ConnectionString $connectionString -Query "IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION" -ErrorAction SilentlyContinue
        Write-Host "Transaction rolled back" -ForegroundColor Yellow
    } catch {
        # Ignore rollback errors
    }
    
    exit 1
}

Write-Host "`nTesting API endpoint..." -ForegroundColor Yellow

try {
    # Test the organizations API endpoint
    $apiUrl = "https://nexhire-api-func.azurewebsites.net/api/reference/organizations"
    Write-Host "Testing: $apiUrl" -ForegroundColor Gray
    
    $response = Invoke-RestMethod -Uri $apiUrl -Method GET -TimeoutSec 30
    
    if ($response.success -and $response.data) {
        if ($response.data.organizations) {
            $orgCount = $response.data.organizations.Count
        } else {
            $orgCount = $response.data.Count
        }
        
        Write-Host "? API endpoint working!" -ForegroundColor Green
        Write-Host "API returned $orgCount organizations" -ForegroundColor White
    } else {
        Write-Host "API endpoint returned unexpected response" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Could not test API endpoint: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "API may need time to update or deploy" -ForegroundColor Gray
}

Write-Host "`nMEGA COMPANIES DATABASE READY!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

Write-Host "`n? What was accomplished:" -ForegroundColor Cyan
Write-Host "� Processed $insertedCount companies from multiple sources" -ForegroundColor White
Write-Host "� Multiple company sizes: Small, Medium, Large, Enterprise" -ForegroundColor White
Write-Host "� Global companies from various industries" -ForegroundColor White
Write-Host "� Complete with websites and company details" -ForegroundColor White
Write-Host "� Industry diversity: Technology, Finance, Healthcare, etc." -ForegroundColor White
Write-Host "� MERGE statement prevents duplicates automatically" -ForegroundColor White
Write-Host "� ? COMPATIBLE: Works with all PowerShell versions" -ForegroundColor White

Write-Host "`nTechnical Approach:" -ForegroundColor Yellow
Write-Host "� ? Batch INSERT using MERGE statement" -ForegroundColor White
Write-Host "� ? No parameter binding issues" -ForegroundColor White
Write-Host "� ? Proper SQL escaping for data safety" -ForegroundColor White
Write-Host "� ? Transaction management for data integrity" -ForegroundColor White

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Deploy the updated backend API" -ForegroundColor White
Write-Host "2. Test the frontend registration flow" -ForegroundColor White
Write-Host "3. ? Verify company selection dropdown works" -ForegroundColor White

Write-Host "`nPress Enter to exit..." -ForegroundColor Gray
Read-Host