# Test Resume Delete Functionality
# Uses the test-user from test-user.json

param(
    [string]$Action = "list", # Options: list, delete, all
    [string]$ResumeId = ""
)

# Load test user data
$testData = Get-Content "test-user.json" | ConvertFrom-Json

$API_BASE = $testData.apiBaseUrl
$JWT_TOKEN = $testData.testData.jwtToken
$USER_ID = $testData.testData.userId

Write-Host "??? === RESUME DELETE FUNCTIONALITY TEST ===" -ForegroundColor Blue
Write-Host "?? User: $($testData.testUser.email)" -ForegroundColor Cyan
Write-Host "?? User ID: $USER_ID" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "Authorization" = "Bearer $JWT_TOKEN"
    "Content-Type" = "application/json"
    "Accept" = "application/json"
}

function Get-UserResumes {
    Write-Host "?? Getting current resumes..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "$API_BASE/users/resumes" -Method GET -Headers $headers
        
        if ($response.success) {
            Write-Host "? Found $($response.data.Count) resumes:" -ForegroundColor Green
            $response.data | ForEach-Object {
                $isPrimary = if ($_.IsPrimary) { "? PRIMARY" } else { "   SECONDARY" }
                Write-Host "   $isPrimary | ID: $($_.ResumeID) | Label: $($_.ResumeLabel)" -ForegroundColor White
            }
            return $response.data
        } else {
            Write-Host "? Failed to get resumes: $($response.error)" -ForegroundColor Red
            return @()
        }
    } catch {
        Write-Host "? Error getting resumes: $($_.Exception.Message)" -ForegroundColor Red
        return @()
    }
}

function Delete-Resume {
    param([string]$ResumeId)
    
    Write-Host "??? Deleting resume: $ResumeId" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "$API_BASE/users/resume/$ResumeId" -Method DELETE -Headers $headers
        
        if ($response.success) {
            Write-Host "? Resume deleted successfully!" -ForegroundColor Green
            Write-Host "   Message: $($response.message)" -ForegroundColor Green
            return $true
        } else {
            Write-Host "? Failed to delete resume: $($response.error)" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "? Error deleting resume: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        return $false
    }
}

# Execute based on action
switch ($Action.ToLower()) {
    "list" {
        Get-UserResumes
    }
    
    "delete" {
        if (-not $ResumeId) {
            Write-Host "? ResumeId parameter required for delete action" -ForegroundColor Red
            Write-Host "Usage: .\test-resume-delete.ps1 -Action delete -ResumeId 'your-resume-id'" -ForegroundColor Yellow
            exit 1
        }
        
        Write-Host "?? Current resumes before deletion:" -ForegroundColor Cyan
        $beforeResumes = Get-UserResumes
        Write-Host ""
        
        $deleteResult = Delete-Resume -ResumeId $ResumeId
        Write-Host ""
        
        if ($deleteResult) {
            Write-Host "?? Resumes after deletion:" -ForegroundColor Cyan
            $afterResumes = Get-UserResumes
            
            Write-Host ""
            Write-Host "?? Summary:" -ForegroundColor Blue
            Write-Host "   Before: $($beforeResumes.Count) resumes" -ForegroundColor White
            Write-Host "   After:  $($afterResumes.Count) resumes" -ForegroundColor White
            Write-Host "   Deleted: $(($beforeResumes.Count - $afterResumes.Count)) resume(s)" -ForegroundColor Green
        }
    }
    
    "all" {
        Write-Host "?? Running comprehensive delete tests..." -ForegroundColor Magenta
        Write-Host ""
        
        # Step 1: List current resumes
        Write-Host "?? Step 1: List current resumes" -ForegroundColor Yellow
        $resumes = Get-UserResumes
        
        if ($resumes.Count -eq 0) {
            Write-Host "? No resumes found to test deletion" -ForegroundColor Red
            exit 1
        }
        
        Write-Host ""
        
        # Step 2: Test deleting a non-primary resume (if available)
        $nonPrimaryResume = $resumes | Where-Object { -not $_.IsPrimary } | Select-Object -First 1
        
        if ($nonPrimaryResume) {
            Write-Host "?? Step 2: Delete non-primary resume" -ForegroundColor Yellow
            Write-Host "   Target: $($nonPrimaryResume.ResumeLabel) (ID: $($nonPrimaryResume.ResumeID))" -ForegroundColor Cyan
            
            $deleteResult = Delete-Resume -ResumeId $nonPrimaryResume.ResumeID
            
            if ($deleteResult) {
                Write-Host "? Non-primary resume deletion: SUCCESS" -ForegroundColor Green
            } else {
                Write-Host "? Non-primary resume deletion: FAILED" -ForegroundColor Red
            }
            Write-Host ""
            
            # Check results
            Write-Host "?? Verification: List resumes after deletion" -ForegroundColor Yellow
            $updatedResumes = Get-UserResumes
            Write-Host ""
        } else {
            Write-Host "?? Step 2: No non-primary resumes available for testing" -ForegroundColor Yellow
            Write-Host ""
        }
        
        # Step 3: Test deleting last resume (should fail)
        Write-Host "?? Step 3: Test delete last resume (should fail)" -ForegroundColor Yellow
        $currentResumes = Get-UserResumes
        
        if ($currentResumes.Count -eq 1) {
            Write-Host "   Attempting to delete last resume: $($currentResumes[0].ResumeLabel)" -ForegroundColor Cyan
            
            $deleteResult = Delete-Resume -ResumeId $currentResumes[0].ResumeID
            
            if (-not $deleteResult) {
                Write-Host "? Last resume deletion correctly prevented: SUCCESS" -ForegroundColor Green
            } else {
                Write-Host "? Last resume deletion should have been prevented: FAILED" -ForegroundColor Red
            }
        } else {
            Write-Host "   Multiple resumes still exist, skipping last resume test" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "?? Delete functionality tests completed!" -ForegroundColor Magenta
    }
    
    default {
        Write-Host "? Invalid action: $Action" -ForegroundColor Red
        Write-Host "Valid actions: list, delete, all" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Examples:" -ForegroundColor Cyan
        Write-Host "  .\test-resume-delete.ps1 -Action list" -ForegroundColor White
        Write-Host "  .\test-resume-delete.ps1 -Action delete -ResumeId 'resume-id-here'" -ForegroundColor White
        Write-Host "  .\test-resume-delete.ps1 -Action all" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "?? Test completed at $(Get-Date)" -ForegroundColor Blue