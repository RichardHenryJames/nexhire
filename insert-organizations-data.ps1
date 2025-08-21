#!/usr/bin/env pwsh

# NexHire Organizations Data Insert Script (IDEMPOTENT) - CORRECTED SCHEMA
# Populates the Organizations table with real-world company data
# Safe to run multiple times - won't create duplicates

Write-Host "NexHire Organizations Data Insert Script - CORRECTED (IDEMPOTENT)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# Azure SQL Database connection parameters
$serverName = "nexhire-sql-srv.database.windows.net"
$databaseName = "nexhire-sql-db"
$username = "sqladmin"
$password = "P@ssw0rd1234!"

# Build connection string
$connectionString = "Server=tcp:$serverName,1433;Initial Catalog=$databaseName;Persist Security Info=False;User ID=$username;Password=$password;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

Write-Host "`nTesting database connection..." -ForegroundColor Yellow

try {
    # Test connection
    $testQuery = "SELECT COUNT(*) as TableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Organizations'"
    $testResult = Invoke-Sqlcmd -ConnectionString $connectionString -Query $testQuery -ErrorAction Stop
    
    if ($testResult.TableCount -gt 0) {
        Write-Host "? Database connection successful" -ForegroundColor Green
        Write-Host "? Organizations table exists" -ForegroundColor Green
    } else {
        Write-Host "? Organizations table not found" -ForegroundColor Red
        Write-Host "Please deploy the database schema first" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "? Database connection failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`nChecking existing data..." -ForegroundColor Yellow

try {
    $countQuery = "SELECT COUNT(*) as OrgCount FROM Organizations WHERE IsActive = 1"
    $countResult = Invoke-Sqlcmd -ConnectionString $connectionString -Query $countQuery
    $existingCount = $countResult.OrgCount
    
    Write-Host "Current organizations in database: $existingCount" -ForegroundColor White
    
    if ($existingCount -gt 30) {
        Write-Host "Organizations data already exists. Using MERGE to add only new records..." -ForegroundColor Yellow
    } else {
        Write-Host "Adding comprehensive organizations data..." -ForegroundColor Green
    }
} catch {
    Write-Host "Could not check existing data: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`nProcessing organizations data (IDEMPOTENT - CORRECTED SCHEMA)..." -ForegroundColor Green

$insertScript = @"
-- NexHire Organizations Data Insert Script (IDEMPOTENT - CORRECTED SCHEMA)
-- Uses MERGE to prevent duplicates with correct column names

BEGIN TRANSACTION;

-- Insert/Update organizations using MERGE to prevent duplicates
-- Using actual database schema: Name, Type, Industry, Size, Website, LinkedInProfile, Description, LogoURL, VerificationStatus, EstablishedDate
MERGE Organizations AS target
USING (VALUES
    -- Major Tech Companies
    ('Google LLC', 'Corporation', 'Technology', 'Enterprise', 'https://www.google.com', 'https://www.linkedin.com/company/google', 
     'Multinational technology company specializing in Internet-related services and products', NULL, 'Verified', '1998-09-04'),

    ('Microsoft Corporation', 'Corporation', 'Technology', 'Enterprise', 'https://www.microsoft.com', 'https://www.linkedin.com/company/microsoft', 
     'Multinational technology corporation developing, manufacturing, licensing, supporting and selling computer software, consumer electronics, personal computers, and related services', NULL, 'Verified', '1975-04-04'),

    ('Apple Inc.', 'Corporation', 'Technology', 'Enterprise', 'https://www.apple.com', 'https://www.linkedin.com/company/apple', 
     'Multinational technology company that designs, develops, and sells consumer electronics, computer software, and online services', NULL, 'Verified', '1976-04-01'),

    ('Amazon.com Inc.', 'Corporation', 'E-commerce', 'Enterprise', 'https://www.amazon.com', 'https://www.linkedin.com/company/amazon', 
     'Multinational technology company focusing on e-commerce, cloud computing, digital streaming, and artificial intelligence', NULL, 'Verified', '1994-07-05'),

    ('Meta Platforms Inc.', 'Corporation', 'Technology', 'Enterprise', 'https://www.meta.com', 'https://www.linkedin.com/company/meta', 
     'Social media and technology company, parent of Facebook, Instagram, WhatsApp, and Oculus', NULL, 'Verified', '2004-02-04'),

    ('Tesla Inc.', 'Corporation', 'Automotive', 'Large', 'https://www.tesla.com', 'https://www.linkedin.com/company/tesla-motors', 
     'Electric vehicle and clean energy company', NULL, 'Verified', '2003-07-01'),

    ('Netflix Inc.', 'Corporation', 'Entertainment', 'Large', 'https://www.netflix.com', 'https://www.linkedin.com/company/netflix', 
     'Streaming entertainment service with TV series and films across a wide variety of genres and languages', NULL, 'Verified', '1997-08-29'),

    ('Spotify Technology S.A.', 'Corporation', 'Entertainment', 'Medium', 'https://www.spotify.com', 'https://www.linkedin.com/company/spotify', 
     'Audio streaming and media services provider', NULL, 'Verified', '2006-04-23'),

    ('Airbnb Inc.', 'Corporation', 'Travel', 'Medium', 'https://www.airbnb.com', 'https://www.linkedin.com/company/airbnb', 
     'Online marketplace for lodging, primarily homestays for vacation rentals, and tourism activities', NULL, 'Verified', '2008-08-01'),

    ('Uber Technologies Inc.', 'Corporation', 'Transportation', 'Large', 'https://www.uber.com', 'https://www.linkedin.com/company/uber-com', 
     'Mobility as a service provider offering ride-hailing, food delivery, package delivery, couriers, freight transportation, and electric bicycle and motorized scooter rental', NULL, 'Verified', '2009-03-01'),

    -- Financial Services
    ('JPMorgan Chase & Co.', 'Corporation', 'Finance', 'Enterprise', 'https://www.jpmorganchase.com', 'https://www.linkedin.com/company/jpmorganchase', 
     'Multinational investment bank and financial services holding company', NULL, 'Verified', '2000-12-01'),

    ('Goldman Sachs Group Inc.', 'Corporation', 'Finance', 'Large', 'https://www.goldmansachs.com', 'https://www.linkedin.com/company/goldman-sachs', 
     'Multinational investment bank and financial services company', NULL, 'Verified', '1869-01-01'),

    ('Bank of America Corporation', 'Corporation', 'Finance', 'Enterprise', 'https://www.bankofamerica.com', 'https://www.linkedin.com/company/bank-of-america', 
     'Multinational investment bank and financial services holding company', NULL, 'Verified', '1998-09-30'),

    ('Wells Fargo & Company', 'Corporation', 'Finance', 'Enterprise', 'https://www.wellsfargo.com', 'https://www.linkedin.com/company/wells-fargo', 
     'Multinational financial services company', NULL, 'Verified', '1852-03-18'),

    -- Healthcare & Pharmaceuticals
    ('Johnson & Johnson', 'Corporation', 'Healthcare', 'Enterprise', 'https://www.jnj.com', 'https://www.linkedin.com/company/johnson-&-johnson', 
     'Multinational corporation that develops medical devices, pharmaceuticals, and consumer packaged goods', NULL, 'Verified', '1886-01-01'),

    ('Pfizer Inc.', 'Corporation', 'Healthcare', 'Large', 'https://www.pfizer.com', 'https://www.linkedin.com/company/pfizer', 
     'Multinational pharmaceutical and biotechnology corporation', NULL, 'Verified', '1849-01-01'),

    ('UnitedHealth Group Inc.', 'Corporation', 'Healthcare', 'Enterprise', 'https://www.unitedhealthgroup.com', 'https://www.linkedin.com/company/unitedhealthgroup', 
     'Diversified health care company', NULL, 'Verified', '1977-01-01'),

    -- Consulting & Professional Services
    ('McKinsey & Company', 'Partnership', 'Consulting', 'Large', 'https://www.mckinsey.com', 'https://www.linkedin.com/company/mckinsey', 
     'Global management consulting firm', NULL, 'Verified', '1926-01-01'),

    ('Deloitte', 'Partnership', 'Consulting', 'Enterprise', 'https://www.deloitte.com', 'https://www.linkedin.com/company/deloitte', 
     'Multinational professional services network', NULL, 'Verified', '1845-01-01'),

    ('PwC', 'Partnership', 'Consulting', 'Enterprise', 'https://www.pwc.com', 'https://www.linkedin.com/company/pwc', 
     'Multinational professional services network', NULL, 'Verified', '1849-01-01'),

    ('Ernst & Young', 'Partnership', 'Consulting', 'Enterprise', 'https://www.ey.com', 'https://www.linkedin.com/company/ernst-&-young', 
     'Multinational professional services firm', NULL, 'Verified', '1989-07-01'),

    ('Accenture plc', 'Corporation', 'Consulting', 'Enterprise', 'https://www.accenture.com', 'https://www.linkedin.com/company/accenture', 
     'Multinational professional services company', NULL, 'Verified', '1989-01-01'),

    -- Retail & Consumer
    ('Walmart Inc.', 'Corporation', 'Retail', 'Enterprise', 'https://www.walmart.com', 'https://www.linkedin.com/company/walmart', 
     'Multinational retail corporation', NULL, 'Verified', '1962-07-02'),

    ('The Home Depot Inc.', 'Corporation', 'Retail', 'Enterprise', 'https://www.homedepot.com', 'https://www.linkedin.com/company/the-home-depot', 
     'Home improvement retail chain', NULL, 'Verified', '1978-06-22'),

    ('Target Corporation', 'Corporation', 'Retail', 'Large', 'https://www.target.com', 'https://www.linkedin.com/company/target', 
     'General merchandise retailer', NULL, 'Verified', '1902-06-24'),

    -- Manufacturing & Industrial
    ('General Electric Company', 'Corporation', 'Manufacturing', 'Enterprise', 'https://www.ge.com', 'https://www.linkedin.com/company/general-electric', 
     'Multinational conglomerate', NULL, 'Verified', '1892-04-15'),

    ('Ford Motor Company', 'Corporation', 'Automotive', 'Enterprise', 'https://www.ford.com', 'https://www.linkedin.com/company/ford-motor-company', 
     'Multinational automaker', NULL, 'Verified', '1903-06-16'),

    ('General Motors Company', 'Corporation', 'Automotive', 'Enterprise', 'https://www.gm.com', 'https://www.linkedin.com/company/general-motors', 
     'Multinational automotive manufacturing company', NULL, 'Verified', '1908-09-16'),

    -- Startups & Emerging Companies
    ('Stripe Inc.', 'Corporation', 'Fintech', 'Medium', 'https://www.stripe.com', 'https://www.linkedin.com/company/stripe', 
     'Financial services and software as a service company', NULL, 'Verified', '2010-01-01'),

    ('Slack Technologies', 'Corporation', 'Technology', 'Medium', 'https://www.slack.com', 'https://www.linkedin.com/company/tiny-speck-inc', 
     'Business communication platform', NULL, 'Verified', '2009-08-01'),

    ('Zoom Video Communications', 'Corporation', 'Technology', 'Medium', 'https://www.zoom.us', 'https://www.linkedin.com/company/zoom-video-communications', 
     'Video communications company', NULL, 'Verified', '2011-04-01'),

    -- International Companies
    ('SAP SE', 'Corporation', 'Technology', 'Enterprise', 'https://www.sap.com', 'https://www.linkedin.com/company/sap', 
     'Multinational software corporation', NULL, 'Verified', '1972-04-01'),

    ('Nestl� S.A.', 'Corporation', 'Food & Beverage', 'Enterprise', 'https://www.nestle.com', 'https://www.linkedin.com/company/nestle', 
     'Multinational food and drink processing conglomerate', NULL, 'Verified', '1866-01-01'),

    ('Toyota Motor Corporation', 'Corporation', 'Automotive', 'Enterprise', 'https://www.toyota.com', 'https://www.linkedin.com/company/toyota', 
     'Multinational automotive manufacturer', NULL, 'Verified', '1937-08-28'),

    ('Samsung Electronics', 'Corporation', 'Technology', 'Enterprise', 'https://www.samsung.com', 'https://www.linkedin.com/company/samsung-electronics', 
     'Multinational electronics company', NULL, 'Verified', '1969-01-13'),

    -- Indian Companies
    ('Tata Consultancy Services', 'Corporation', 'Technology', 'Enterprise', 'https://www.tcs.com', 'https://www.linkedin.com/company/tata-consultancy-services', 
     'Multinational information technology services and consulting company', NULL, 'Verified', '1968-04-01'),

    ('Infosys Limited', 'Corporation', 'Technology', 'Large', 'https://www.infosys.com', 'https://www.linkedin.com/company/infosys', 
     'Multinational corporation providing business consulting, information technology and outsourcing services', NULL, 'Verified', '1981-07-02'),

    ('Wipro Limited', 'Corporation', 'Technology', 'Large', 'https://www.wipro.com', 'https://www.linkedin.com/company/wipro', 
     'Multinational corporation providing information technology, consulting and business process services', NULL, 'Verified', '1945-12-29'),

    -- Government & Non-Profit
    ('United Nations', 'International Organization', 'Government', 'Enterprise', 'https://www.un.org', 'https://www.linkedin.com/company/united-nations', 
     'International organization maintaining international peace and security', NULL, 'Verified', '1945-10-24'),

    ('World Health Organization', 'International Organization', 'Healthcare', 'Large', 'https://www.who.int', 'https://www.linkedin.com/company/world-health-organization', 
     'Specialized agency of the United Nations responsible for international public health', NULL, 'Verified', '1948-04-07'),

    -- Educational Institutions
    ('Harvard University', 'Educational Institution', 'Education', 'Large', 'https://www.harvard.edu', 'https://www.linkedin.com/school/harvard-university', 
     'Private Ivy League research university', NULL, 'Verified', '1636-09-08'),

    ('Stanford University', 'Educational Institution', 'Education', 'Large', 'https://www.stanford.edu', 'https://www.linkedin.com/school/stanford-university', 
     'Private research university', NULL, 'Verified', '1885-10-01'),

    ('Massachusetts Institute of Technology', 'Educational Institution', 'Education', 'Medium', 'https://www.mit.edu', 'https://www.linkedin.com/school/mit', 
     'Private research university', NULL, 'Verified', '1861-04-10'),

    -- Small to Medium Companies
    ('Buffer', 'Corporation', 'Technology', 'Small', 'https://www.buffer.com', 'https://www.linkedin.com/company/buffer', 
     'Social media management platform', NULL, 'Pending', '2010-10-30'),

    ('Basecamp', 'Corporation', 'Technology', 'Small', 'https://www.basecamp.com', 'https://www.linkedin.com/company/basecamp', 
     'Project management and team collaboration software', NULL, 'Pending', '1999-01-01'),

    ('Mailchimp', 'Corporation', 'Technology', 'Medium', 'https://www.mailchimp.com', 'https://www.linkedin.com/company/mailchimp', 
     'Marketing automation platform and email marketing service', NULL, 'Verified', '2001-01-01'),

    ('Shopify Inc.', 'Corporation', 'E-commerce', 'Large', 'https://www.shopify.com', 'https://www.linkedin.com/company/shopify', 
     'Multinational e-commerce company', NULL, 'Verified', '2006-01-01'),

    ('Square Inc.', 'Corporation', 'Fintech', 'Medium', 'https://www.squareup.com', 'https://www.linkedin.com/company/square', 
     'Financial services, merchant services aggregator, and mobile payment company', NULL, 'Verified', '2009-02-01'),

    -- Remote-First Companies
    ('GitLab Inc.', 'Corporation', 'Technology', 'Medium', 'https://www.gitlab.com', 'https://www.linkedin.com/company/gitlab-com', 
     'Web-based DevOps lifecycle tool', NULL, 'Verified', '2011-01-01'),

    ('Automattic Inc.', 'Corporation', 'Technology', 'Medium', 'https://www.automattic.com', 'https://www.linkedin.com/company/automattic', 
     'Web development corporation behind WordPress.com', NULL, 'Verified', '2005-08-01'),

    ('InVision', 'Corporation', 'Technology', 'Medium', 'https://www.invisionapp.com', 'https://www.linkedin.com/company/invision', 
     'Digital product design platform', NULL, 'Verified', '2011-01-01')
) AS source (Name, Type, Industry, Size, Website, LinkedInProfile, Description, LogoURL, VerificationStatus, EstablishedDate)
ON target.Name = source.Name
WHEN NOT MATCHED THEN
    INSERT (Name, Type, Industry, Size, Website, LinkedInProfile, Description, LogoURL, VerificationStatus, EstablishedDate, IsActive, CreatedAt, UpdatedAt)
    VALUES (source.Name, source.Type, source.Industry, source.Size, source.Website, source.LinkedInProfile, source.Description, source.LogoURL, source.VerificationStatus, source.EstablishedDate, 1, GETUTCDATE(), GETUTCDATE())
WHEN MATCHED THEN
    UPDATE SET 
        Type = source.Type,
        Industry = source.Industry,
        Size = source.Size,
        Website = source.Website,
        LinkedInProfile = source.LinkedInProfile,
        Description = source.Description,
        VerificationStatus = source.VerificationStatus,
        EstablishedDate = source.EstablishedDate,
        UpdatedAt = GETUTCDATE(),
        IsActive = 1;

COMMIT TRANSACTION;

-- Verify the insert/update
SELECT 
    'Insert/Update completed successfully!' as Status,
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
    COUNT(*) as CompanyCount,
    STRING_AGG(Name, ', ') as SampleCompanies
FROM Organizations 
WHERE IsActive = 1
GROUP BY Industry
ORDER BY CompanyCount DESC;
"@

Write-Host "`nExecuting organizations data script..." -ForegroundColor Yellow

try {
    # Execute the insert script
    $result = Invoke-Sqlcmd -ConnectionString $connectionString -Query $insertScript -ErrorAction Stop
    
    Write-Host "? Organizations data processed successfully!" -ForegroundColor Green
    
    # Display results
    if ($result) {
        Write-Host "`nProcessing Summary:" -ForegroundColor Cyan
        $summary = $result | Where-Object { $_.Status -eq 'Insert/Update completed successfully!' }
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
    Write-Host "? Error executing script: $($_.Exception.Message)" -ForegroundColor Red
    
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
        Write-Host "? API endpoint working!" -ForegroundColor Green
        Write-Host "API returned $($response.data.Count) organizations" -ForegroundColor White
        
        # Show a few sample organizations
        $sampleOrgs = $response.data | Select-Object -First 5
        Write-Host "`nSample organizations from API:" -ForegroundColor Cyan
        foreach ($org in $sampleOrgs) {
            Write-Host "� $($org.name) - $($org.industry) ($($org.size))" -ForegroundColor White
        }
    } else {
        Write-Host "API endpoint returned unexpected response" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Could not test API endpoint: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "API may need time to update or deploy" -ForegroundColor Gray
}

Write-Host "`nORGANIZATIONS DATA SETUP COMPLETE!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

Write-Host "`n? What was accomplished:" -ForegroundColor Cyan
Write-Host "� Processed 50+ real-world organizations" -ForegroundColor White
Write-Host "� Multiple company sizes: Small, Medium, Large, Enterprise" -ForegroundColor White
Write-Host "� Global companies from various industries" -ForegroundColor White
Write-Host "� Complete with websites, LinkedIn profiles, and descriptions" -ForegroundColor White
Write-Host "� Industry diversity: Technology, Finance, Healthcare, etc." -ForegroundColor White
Write-Host "� IDEMPOTENT: Safe to run multiple times without duplicates" -ForegroundColor White
Write-Host "� ? SCHEMA CORRECTED: Uses actual database column names" -ForegroundColor White

Write-Host "`nSchema Corrections Made:" -ForegroundColor Yellow
Write-Host "� ? OrganizationSize ? Size" -ForegroundColor White
Write-Host "� ? Location ? Removed (not in schema)" -ForegroundColor White
Write-Host "� ? Added LinkedInProfile field" -ForegroundColor White
Write-Host "� ? Added LogoURL field" -ForegroundColor White
Write-Host "� ? Added VerificationStatus field" -ForegroundColor White
Write-Host "� ? Added EstablishedDate field" -ForegroundColor White

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Deploy the updated backend with new API endpoints" -ForegroundColor White
Write-Host "2. Test the frontend registration flow" -ForegroundColor White
Write-Host "3. ? Verify company selection dropdown works" -ForegroundColor White

Write-Host "`nPress Enter to exit..." -ForegroundColor Gray
Read-Host