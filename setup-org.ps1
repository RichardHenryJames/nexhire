param(
    [string]$ConnectionString = "Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
)

# Base API (do not include ? here)
$apiBase = "https://api.opencorporates.com/v0.4/companies/search"
$page = 1
$perPage = 50
$maxPages = 3   # increase later once tested

while ($page -le $maxPages) {
    # Construct URL properly
    $url = "$apiBase?q=tech&per_page=$perPage&page=$page"
    Write-Host "Fetching companies (Page $page)..." -ForegroundColor Yellow
    Write-Host "🔎 URL: $url" -ForegroundColor Cyan

    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
    } catch {
        Write-Host "❌ API call failed on page $page : $(${_.Exception.Message})" -ForegroundColor Red
        break
    }

    # Ensure we got companies
    if (-not $response.results.companies) {
        Write-Host "⚠️ No companies found on page $page" -ForegroundColor DarkYellow
        break
    }

    foreach ($companyObj in $response.results.companies) {
        $c = $companyObj.company

        # Sanitize values for SQL
        $Name         = ($c.name -replace "'", "''")
        $Industry     = ($c.industry_code -replace "'", "''")
        $Website      = ($c.website -replace "'", "''")
        $EstDate      = $c.incorporation_date
        $Headquarters = ($c.registered_address_in_full -replace "'", "''")
        $Country      = $c.jurisdiction_code
        $Status       = 'Pending'  # default

        # SQL insert statement
        $sql = @"
INSERT INTO Organizations (Name, Industry, Website, EstablishedDate, VerificationStatus, CreatedAt, UpdatedAt, IsActive)
VALUES ('$Name', '$Industry', '$Website', '$EstDate', '$Status', GETUTCDATE(), GETUTCDATE(), 1);
"@

        try {
            Invoke-Sqlcmd -ConnectionString $ConnectionString -Query $sql -QueryTimeout 30
            Write-Host "✅ Inserted: $Name" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ Failed to insert $Name - $(${_.Exception.Message})" -ForegroundColor Red
        }
    }

    $page++
    Start-Sleep -Seconds 1  # prevent rate limit
}
