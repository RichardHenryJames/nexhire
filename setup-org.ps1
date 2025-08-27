param(
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

# Correct base URL
$apiBase = "https://api.opencorporates.com/v0.4/companies/search"
$page = 1
$perPage = 50
$maxPages = 3   # limit for testing

while ($page -le $maxPages) {
    Write-Host "Fetching companies (Page $page)..." -ForegroundColor Yellow

    # Build proper query string
    $url = "$apiBase?per_page=$perPage&page=$page&q=tech"  # 'q' is required (search term)

    try {
        $response = Invoke-RestMethod -Uri $url -Method Get
    } catch {
        Write-Host "❌ API call failed on page $page: $($_.Exception.Message)" -ForegroundColor Red
        break
    }

    # Loop companies
    foreach ($companyObj in $response.results.companies) {
        $c = $companyObj.company

        $Name         = ($c.name -replace "'", "''")
        $Industry     = ($c.industry_code -replace "'", "''")
        $Website      = ($c.website -replace "'", "''")
        $EstDate      = $c.incorporation_date
        $Headquarters = ($c.registered_address_in_full -replace "'", "''")
        $Country      = $c.jurisdiction_code
        $Status       = 0  # Pending verification

        $sql = @"
INSERT INTO Organizations (Name, Industry, Website, EstablishedDate, Headquarters, VerificationStatus, CreatedAt, UpdatedAt)
VALUES ('$Name', '$Industry', '$Website', '$EstDate', '$Headquarters', $Status, GETUTCDATE(), GETUTCDATE());
"@

        try {
            Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $sql -QueryTimeout 30
            Write-Host "✅ Inserted: $Name" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ Failed to insert $Name - $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    $page++
    Start-Sleep -Seconds 1
}
