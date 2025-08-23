# Simple Backend Test
$testEmail = "simple.$(Get-Date -Format 'HHmmss')@test.com"

# Test just basic registration without extra data
$basicData = @{
    email = $testEmail
    password = "Test123!"
    firstName = "Test"
    lastName = "User"
    userType = "JobSeeker"
} | ConvertTo-Json

Write-Host "Testing basic registration with: $basicData"

try {
    $response = Invoke-RestMethod -Uri "https://nexhire-api-func.azurewebsites.net/api/auth/register" -Method POST -Body $basicData -ContentType "application/json"
    Write-Host "? Basic registration works: $($response | ConvertTo-Json)"
} catch {
    Write-Host "? Basic registration failed: $($_.Exception.Message)"
    if ($_.ErrorDetails.Message) {
        Write-Host "Error details: $($_.ErrorDetails.Message)"
    }
}