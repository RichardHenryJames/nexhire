# Quick API Diagnostic Script
# Tests the exact API endpoints and shows detailed error information

Write-Host " NexHire API Diagnostic Test" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green

$baseUrl = "https://nexhire-api-func.azurewebsites.net"

# Test endpoints with detailed error handling
$endpoints = @(
    @{ Name = "Job Types"; Url = "$baseUrl/api/reference/job-types" },
    @{ Name = "Currencies"; Url = "$baseUrl/api/reference/currencies" },
    @{ Name = "Jobs List"; Url = "$baseUrl/api/jobs" }
)

foreach ($endpoint in $endpoints) {
    Write-Host "`n Testing: $($endpoint.Name)" -ForegroundColor Yellow
    Write-Host "   URL: $($endpoint.Url)" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $endpoint.Url -Method GET -TimeoutSec 30
        Write-Host "   ? Status: $($response.StatusCode)" -ForegroundColor Green
        
        $content = $response.Content | ConvertFrom-Json
        if ($content.success -eq $true) {
            Write-Host "   ? Response: SUCCESS" -ForegroundColor Green
            if ($content.data) {
                Write-Host "    Data Count: $($content.data.Count)" -ForegroundColor Cyan
            }
        } else {
            Write-Host "   ? Response: FAILED" -ForegroundColor Red
            Write-Host "   Error: $($content.error)" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "   ? HTTP Error: $($_.Exception.Message)" -ForegroundColor Red
        
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode
            Write-Host "   Status Code: $statusCode" -ForegroundColor Red
            
            try {
                $errorStream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($errorStream)
                $errorBody = $reader.ReadToEnd()
                Write-Host "   Error Body: $errorBody" -ForegroundColor Red
            }
            catch {
                Write-Host "   Could not read error details" -ForegroundColor Yellow
            }
        }
    }
}

Write-Host "`n Troubleshooting Commands:" -ForegroundColor Cyan
Write-Host "1. Check Function App logs:" -ForegroundColor White
Write-Host "   func azure functionapp logstream nexhire-api-func" -ForegroundColor Gray
Write-Host "`n2. Check database connection:" -ForegroundColor White
Write-Host "   Invoke-Sqlcmd -ConnectionString `"Server=nexhire-sql-srv.database.windows.net;Database=nexhire-sql-db;User ID=sqladmin;Password=P@ssw0rd1234!;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;`" -Query `"SELECT COUNT(*) as Count FROM JobTypes`"" -ForegroundColor Gray
Write-Host "`n3. Check Function App settings:" -ForegroundColor White
Write-Host "   az functionapp config appsettings list --name nexhire-api-func --resource-group nexhire-dev-rg" -ForegroundColor Gray