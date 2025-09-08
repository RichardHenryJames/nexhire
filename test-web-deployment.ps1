# ?? Web Deployment Verification Script
# Tests if the updated frontend code is actually deployed

Write-Host "?? WEB DEPLOYMENT VERIFICATION" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green
Write-Host ""

Write-Host "?? Checking local files vs deployed code..." -ForegroundColor Yellow
Write-Host ""

# Check if our debug code exists in the local files
$jobDetailsContent = Get-Content "frontend\src\screens\jobs\JobDetailsScreen.js" -Raw
$modalContent = Get-Content "frontend\src\components\ResumeUploadModal.js" -Raw

Write-Host "? Local File Checks:" -ForegroundColor Green
if ($jobDetailsContent -match "NEW handleApply called") {
    Write-Host "   ? JobDetailsScreen has debug code" -ForegroundColor Green
} else {
    Write-Host "   ? JobDetailsScreen missing debug code" -ForegroundColor Red
}

if ($modalContent -match "ResumeUploadModal rendered") {
    Write-Host "   ? ResumeUploadModal has debug code" -ForegroundColor Green
} else {
    Write-Host "   ? ResumeUploadModal missing debug code" -ForegroundColor Red
}

if ($jobDetailsContent -match "setShowResumeModal\(true\)") {
    Write-Host "   ? JobDetailsScreen calls setShowResumeModal(true)" -ForegroundColor Green
} else {
    Write-Host "   ? JobDetailsScreen missing modal trigger" -ForegroundColor Red
}

Write-Host ""
Write-Host "?? TEST INSTRUCTIONS:" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open web browser and navigate to your job details page" -ForegroundColor White
Write-Host "2. Open browser Developer Tools (F12)" -ForegroundColor White
Write-Host "3. Go to Console tab" -ForegroundColor White
Write-Host "4. Click the 'Apply Now' button" -ForegroundColor White
Write-Host ""
Write-Host "?? EXPECTED RESULTS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "If deployment worked, you should see:" -ForegroundColor White
Write-Host "   1. Alert: 'New code is working! Modal should appear now.'" -ForegroundColor Green
Write-Host "   2. Console: '?? NEW handleApply called - code is updated!'" -ForegroundColor Green
Write-Host "   3. Console: '?? Setting showResumeModal to true...'" -ForegroundColor Green
Write-Host "   4. Console: '?? ResumeUploadModal rendered with visible: true'" -ForegroundColor Green
Write-Host "   5. Modal should appear on screen" -ForegroundColor Green
Write-Host ""
Write-Host "If deployment failed, you'll see:" -ForegroundColor White
Write-Host "   1. Old error: 'No resume found. Please upload a resume before applying.'" -ForegroundColor Red
Write-Host "   2. No debug messages in console" -ForegroundColor Red
Write-Host ""
Write-Host "?? TROUBLESHOOTING:" -ForegroundColor Magenta
Write-Host ""
Write-Host "If you see old behavior:" -ForegroundColor White
Write-Host "   1. Try hard refresh: Ctrl+Shift+R" -ForegroundColor White
Write-Host "   2. Try incognito/private window" -ForegroundColor White
Write-Host "   3. Check if deployment completed successfully" -ForegroundColor White
Write-Host "   4. Verify build logs for errors" -ForegroundColor White
Write-Host ""
Write-Host "?? Ready to test! Click Apply Now and report what you see." -ForegroundColor Green