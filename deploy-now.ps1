# Quick one-liner deployment script
# Usage: .\deploy-now.ps1

Write-Host "? NEXHIRE INSTANT DEPLOY" -ForegroundColor Cyan

# Build and create package
npm run build
$zip = "nexhire-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
Compress-Archive -Path "dist\*","package.json","host.json" -DestinationPath $zip

# Upload to storage
$url = az storage blob upload --account-name nexhirefuncdevst --container-name deployments --name $zip --file $zip --overwrite --output tsv --query url

# Update function app
az functionapp config appsettings set --name nexhire-api-func --resource-group nexhire-rg --settings "WEBSITE_RUN_FROM_PACKAGE=$url" | Out-Null

# Restart
az functionapp restart --name nexhire-api-func --resource-group nexhire-rg | Out-Null

Write-Host "? Deployed! Health: https://nexhire-api-func.azurewebsites.net/api/health" -ForegroundColor Green
Write-Host "?? Countries: https://nexhire-api-func.azurewebsites.net/api/reference/countries" -ForegroundColor Green

# Cleanup
Remove-Item $zip