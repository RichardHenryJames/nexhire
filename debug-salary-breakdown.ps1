# ================================================================
# Salary Breakdown Debugging Script - Isolated Test
# ================================================================
# This script specifically tests the salary breakdown functionality
# to identify and fix the 500 error
# ================================================================

$ErrorActionPreference = "Stop"

# Configuration
$API_BASE = "https://nexhire-api-func.azurewebsites.net/api"
$TEST_EMAIL = "salarytest_$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
$TEST_PASSWORD = "TestPassword123!"

Write-Host "?? Debugging Salary Breakdown Feature" -ForegroundColor Yellow
Write-Host "?? Test Email: $TEST_EMAIL" -ForegroundColor Gray
Write-Host ""

# Function to make API calls
function Invoke-ApiCall {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Data = $null,
        [string]$AuthToken = $null,
        [bool]$ShowFullResponse = $false
    )
    
    Write-Host "?? $Method $Endpoint" -ForegroundColor Cyan
    
    $headers = @{
        "Content-Type" = "application/json"
        "Accept" = "application/json"
    }
    
    if ($AuthToken) {
        $headers["Authorization"] = "Bearer $AuthToken"
    }
    
    $uri = "$API_BASE$Endpoint"
    
    try {
        if ($Data) {
            Write-Host "?? Request Data:" -ForegroundColor Gray
            Write-Host $Data -ForegroundColor Gray
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $Data
        } else {
            $response = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
        }
        
        Write-Host "? Success" -ForegroundColor Green
        if ($ShowFullResponse) {
            Write-Host "?? Full Response:" -ForegroundColor Gray
            Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor Gray
        }
        return $response
    }
    catch {
        Write-Host "? Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "?? Error Response:" -ForegroundColor Red
        
        # Try to get more details about the error
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseText = $reader.ReadToEnd()
            Write-Host $responseText -ForegroundColor Red
            $reader.Close()
        }
        throw
    }
}

try {
    Write-Host "?? Step 1: Setup Test User" -ForegroundColor Magenta
    
    # Register and login user
    $registrationData = @{
        email = $TEST_EMAIL
        password = $TEST_PASSWORD
        userType = "JobSeeker"
        firstName = "Salary"
        lastName = "Tester"
        phone = "+1234567890"
        dateOfBirth = "1990-01-01"
        gender = "Other"
    } | ConvertTo-Json

    $regResponse = Invoke-ApiCall -Method "POST" -Endpoint "/auth/register" -Data $registrationData
    Write-Host "? User registered" -ForegroundColor Green

    $loginData = @{
        email = $TEST_EMAIL
        password = $TEST_PASSWORD
    } | ConvertTo-Json

    $loginResponse = Invoke-ApiCall -Method "POST" -Endpoint "/auth/login" -Data $loginData
    $ACCESS_TOKEN = $loginResponse.data.tokens.accessToken
    $USER_ID = $loginResponse.data.user.UserID

    Write-Host "? User logged in: $USER_ID" -ForegroundColor Green

    Write-Host ""
    Write-Host "?? Step 2: Get Reference Data" -ForegroundColor Magenta
    
    $salaryComponents = Invoke-ApiCall -Method "GET" -Endpoint "/reference/salary-components"
    $currencies = Invoke-ApiCall -Method "GET" -Endpoint "/reference/currencies"
    
    Write-Host "? Salary Components: $($salaryComponents.data.Count)" -ForegroundColor Green
    Write-Host "? Currencies: $($currencies.data.Count)" -ForegroundColor Green
    
    # Get component IDs
    $fixedComponentId = ($salaryComponents.data | Where-Object { $_.ComponentName -eq "Fixed" }).ComponentID
    $variableComponentId = ($salaryComponents.data | Where-Object { $_.ComponentName -eq "Variable" }).ComponentID
    $currencyId = $currencies.data[0].CurrencyID

    Write-Host "?? Fixed Component ID: $fixedComponentId" -ForegroundColor Yellow
    Write-Host "?? Variable Component ID: $variableComponentId" -ForegroundColor Yellow
    Write-Host "?? Currency ID: $currencyId" -ForegroundColor Yellow

    Write-Host ""
    Write-Host "?? Step 3: Get Initial Profile" -ForegroundColor Magenta
    
    $initialProfile = Invoke-ApiCall -Method "GET" -Endpoint "/applicants/$USER_ID/profile" -AuthToken $ACCESS_TOKEN
    Write-Host "? Initial profile retrieved" -ForegroundColor Green
    Write-Host "?? ApplicantID: $($initialProfile.data.ApplicantID)" -ForegroundColor Yellow

    Write-Host ""
    Write-Host "?? Step 4: Test Simple Salary Breakdown" -ForegroundColor Magenta
    
    # Start with a very simple salary breakdown
    $simpleSalaryData = @{
        salaryBreakdown = @{
            current = @(
                @{
                    ComponentID = [int]$fixedComponentId
                    Amount = [decimal]50000
                    CurrencyID = [int]$currencyId
                    Frequency = "Yearly"
                    Notes = "Simple test"
                }
            )
            expected = @()
        }
    } | ConvertTo-Json -Depth 10

    Write-Host "?? Testing simple salary breakdown..." -ForegroundColor Yellow
    Write-Host "?? Payload:" -ForegroundColor Gray
    Write-Host $simpleSalaryData -ForegroundColor Gray

    try {
        $salaryResponse = Invoke-ApiCall -Method "PUT" -Endpoint "/applicants/$USER_ID/profile" -Data $simpleSalaryData -AuthToken $ACCESS_TOKEN -ShowFullResponse $true
        Write-Host "? Simple salary breakdown successful!" -ForegroundColor Green
    } catch {
        Write-Host "? Simple salary breakdown failed" -ForegroundColor Red
        Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "?? Step 5: Test Complex Salary Breakdown" -ForegroundColor Magenta
    
    # Test with both current and expected
    $complexSalaryData = @{
        salaryBreakdown = @{
            current = @(
                @{
                    ComponentID = [int]$fixedComponentId
                    Amount = [decimal]80000
                    CurrencyID = [int]$currencyId
                    Frequency = "Yearly"
                    Notes = "Current base salary"
                },
                @{
                    ComponentID = [int]$variableComponentId
                    Amount = [decimal]10000
                    CurrencyID = [int]$currencyId
                    Frequency = "Yearly"
                    Notes = "Current bonus"
                }
            )
            expected = @(
                @{
                    ComponentID = [int]$fixedComponentId
                    Amount = [decimal]100000
                    CurrencyID = [int]$currencyId
                    Frequency = "Yearly"
                    Notes = "Expected base"
                }
            )
        }
    } | ConvertTo-Json -Depth 10

    Write-Host "?? Testing complex salary breakdown..." -ForegroundColor Yellow
    
    try {
        $complexResponse = Invoke-ApiCall -Method "PUT" -Endpoint "/applicants/$USER_ID/profile" -Data $complexSalaryData -AuthToken $ACCESS_TOKEN -ShowFullResponse $true
        Write-Host "? Complex salary breakdown successful!" -ForegroundColor Green
    } catch {
        Write-Host "? Complex salary breakdown failed" -ForegroundColor Red
        Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "?? Step 6: Verify Final Profile" -ForegroundColor Magenta
    
    $finalProfile = Invoke-ApiCall -Method "GET" -Endpoint "/applicants/$USER_ID/profile" -AuthToken $ACCESS_TOKEN -ShowFullResponse $true
    
    if ($finalProfile.data.salaryBreakdown) {
        Write-Host "? Salary breakdown retrieved:" -ForegroundColor Green
        Write-Host "   Current components: $($finalProfile.data.salaryBreakdown.current.Count)" -ForegroundColor White
        Write-Host "   Expected components: $($finalProfile.data.salaryBreakdown.expected.Count)" -ForegroundColor White
    } else {
        Write-Host "? No salary breakdown in final profile" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "?? Salary Breakdown Debug Complete" -ForegroundColor Green

} catch {
    Write-Host ""
    Write-Host "? Salary Breakdown Debug Failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}