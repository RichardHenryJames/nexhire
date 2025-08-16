# First install required extension if not already installed
az extension add --name application-insights --yes --only-show-errors

# Create Resource Group
$RG_NAME="nexhire-dev-rg"
# Changed to West US 2 which supports all services we need
$LOCATION="westus2"
az group create --name $RG_NAME --location $LOCATION

# 1. Create Static Web App (Free tier)
az staticwebapp create `
  --name "nexhire-frontend-web" `
  --resource-group $RG_NAME `
  --location $LOCATION `
  --sku "Free"

# 2. Create Storage Account for Function App and Blob
$STORAGE_NAME="nexhirefuncdevst"
az storage account create `
  --name $STORAGE_NAME `
  --resource-group $RG_NAME `
  --location $LOCATION `
  --sku "Standard_LRS"

# Wait for storage account to be ready
Write-Host "Waiting for storage account to be fully provisioned..."
Start-Sleep -Seconds 30

# 3. Create Function App (Consumption Plan)
az functionapp create `
  --name "nexhire-api-func" `
  --resource-group $RG_NAME `
  --storage-account $STORAGE_NAME `
  --consumption-plan-location $LOCATION `
  --runtime "node" `
  --runtime-version "20" `
  --functions-version "4"

# 4. Create SQL Server
az sql server create `
  --name "nexhire-sql-srv" `
  --resource-group $RG_NAME `
  --location $LOCATION `
  --admin-user "sqladmin" `
  --admin-password "P@ssw0rd1234!"

# Wait for SQL Server to be ready
Write-Host "Waiting for SQL Server to be fully provisioned..."
Start-Sleep -Seconds 30

# 5. Create SQL Database (Basic tier)
az sql db create `
  --name "nexhire-sql-db" `
  --resource-group $RG_NAME `
  --server "nexhire-sql-srv" `
  --service-objective "Basic"

# 6. Create Blob Storage
$BLOB_STORAGE="nexhireblobdev"
az storage account create `
  --name $BLOB_STORAGE `
  --resource-group $RG_NAME `
  --location $LOCATION `
  --sku "Standard_LRS" `
  --kind "StorageV2"

# 7. Create Cognitive Search (Free tier)
az search service create `
  --name "nexhire-search" `
  --resource-group $RG_NAME `
  --location $LOCATION `
  --sku "free"

# 8. Create Application Insights
az config set extension.dynamic_install_allow_preview=true
az monitor app-insights component create `
  --app "nexhire-monitor" `
  --location $LOCATION `
  --resource-group $RG_NAME `
  --application-type "web"

Write-Host "Deployment completed! Please create Azure AD B2C tenant manually through Azure Portal"
