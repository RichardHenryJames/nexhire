# Quick URL Endpoint Tester
# Tests multiple URL patterns to find the correct endpoint structure

Write-Host "?? Testing NexHire API URL Patterns" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

$baseUrl = "https://nexhire-api-func.azurewebsites.net"

# Test different URL patterns
$urlPatterns = @(
    "$baseUrl/api/reference/job-types",
    "$baseUrl/reference/job-types", 
    "$baseUrl/api/reference-job-types",
    "$baseUrl/reference-job-types"
)

foreach ($url in $urlPatterns) {
    Write-Host "`n?? Testing: $url" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 15
        Write-Host "   ? SUCCESS! Status: $($response.StatusCode)" -ForegroundColor Green
        
        $content = $response.Content | ConvertFrom-Json
        if ($content.data) {
            Write-Host "   ?? Data received: $($content.data.Count) items" -ForegroundColor Cyan
        }
        
        Write-Host "   ?? WORKING URL: $url" -ForegroundColor Magenta
        break
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   ? Failed: HTTP $statusCode" -ForegroundColor Red
    }
}

Write-Host "`n?? Function App Info:" -ForegroundColor Cyan
Write-Host "Base URL: $baseUrl" -ForegroundColor White

Write-Host "`n?? If none work, try these commands:" -ForegroundColor Yellow
Write-Host "1. Check Function App status:" -ForegroundColor White
Write-Host "   az functionapp show --name nexhire-api-func --resource-group nexhire-dev-rg --query 'state'" -ForegroundColor Gray
Write-Host "2. List all functions:" -ForegroundColor White
Write-Host "   az functionapp function list --name nexhire-api-func --resource-group nexhire-dev-rg" -ForegroundColor Gray
Write-Host "3. Test Function App health:" -ForegroundColor White
Write-Host "   curl -X GET `"$baseUrl`"" -ForegroundColor Gray