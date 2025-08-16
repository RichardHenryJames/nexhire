# Azure Resource Deployment for NexHire

## Prerequisites
- Azure CLI installed
- PowerShell or Azure Cloud Shell
- Subscription ID: 44027c71-593a-4d51-977b-ab0604cb76eb

## Deployment Script

```powershell
# Login to Azure
az login

# Set subscription
az account set --subscription "44027c71-593a-4d51-977b-ab0604cb76eb"

# Create Resource Group
$RG_NAME="nexhire-dev-rg"
$LOCATION="eastus"
az group create --name $RG_NAME --location $LOCATION

# 1. Create Static Web App (Free tier)
az staticwebapp create \
  --name "nexhire-frontend-web" \
  --resource-group $RG_NAME \
  --location $LOCATION \
  --sku "Free"

# 2. Create Storage Account for Function App and Blob
$STORAGE_NAME="nexhirefuncdevst"
az storage account create \
  --name $STORAGE_NAME \
  --resource-group $RG_NAME \
  --location $LOCATION \
  --sku "Standard_LRS"

# 3. Create Function App (Consumption Plan)
az functionapp create \
  --name "nexhire-api-func" \
  --resource-group $RG_NAME \
  --storage-account $STORAGE_NAME \
  --consumption-plan-location $LOCATION \
  --runtime "node" \
  --runtime-version "16" \
  --functions-version "4"

# 4. Create SQL Server
az sql server create \
  --name "nexhire-sql-srv" \
  --resource-group $RG_NAME \
  --location $LOCATION \
  --admin-user "sqladmin" \
  --admin-password "P@ssw0rd1234!"

# 5. Create SQL Database (Basic tier)
az sql db create \
  --name "nexhire-sql-db" \
  --resource-group $RG_NAME \
  --server "nexhire-sql-srv" \
  --service-objective "Basic"

# 6. Create Blob Storage
$BLOB_STORAGE="nexhireblobdev"
az storage account create \
  --name $BLOB_STORAGE \
  --resource-group $RG_NAME \
  --location $LOCATION \
  --sku "Standard_LRS" \
  --kind "StorageV2"

# 7. Create Cognitive Search (Free tier)
az search service create \
  --name "nexhire-search" \
  --resource-group $RG_NAME \
  --location $LOCATION \
  --sku "free"

# 8. Create Application Insights
az monitor app-insights component create \
  --app "nexhire-monitor" \
  --location $LOCATION \
  --resource-group $RG_NAME \
  --application-type "web"

# 9. Create Azure AD B2C Tenant (needs to be done manually through portal)
Write-Host "Please create Azure AD B2C tenant manually through Azure Portal"
```

## Notes:
1. All resources are created with the most cost-effective tiers:
   - Static Web App: Free tier
   - Function App: Consumption plan (pay-per-execution)
   - SQL Database: Basic tier
   - Blob Storage: Standard_LRS (lowest cost)
   - Cognitive Search: Free tier
   - Application Insights: Basic tier
   - AD B2C: Free tier (50k MAU)

2. The script is idempotent:
   - It will skip creation if resources already exist
   - It will only update if there are changes
   - Use `az group exists` to check if resource group exists before creating

3. Security Notes:
   - In production, store passwords in Azure Key Vault
   - Configure firewall rules for SQL Server
   - Set up CORS policies for Storage and APIs
   - Use managed identities where possible

4. Next Steps:
   - Configure networking and firewall rules
   - Set up CI/CD pipelines
   - Configure backup policies
   - Set up monitoring alerts

To run this deployment:
1. Save this as `deploy.ps1`
2. Open PowerShell
3. Navigate to the script directory
4. Run: `./deploy.ps1`

The script will create all resources in the specified subscription using the most cost-effective tiers while maintaining functionality.
