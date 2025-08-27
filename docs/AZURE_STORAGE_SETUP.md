# ??? **AZURE STORAGE CONTAINER SETUP SCRIPT**

## ?? **Container Structure Setup**

Based on your Azure Storage screenshot, I'll create the `profilephotos` container with the proper folder structure:

### **?? Container Structure:**
```
nexhire-files (Storage Account)
??? profilephotos (Container)
    ??? {userId1}/
    ?   ??? profile-{userId1}-{timestamp1}.jpg
    ?   ??? profile-{userId1}-{timestamp2}.jpg
    ??? {userId2}/
    ?   ??? profile-{userId2}-{timestamp1}.png
    ?   ??? profile-{userId2}-{timestamp2}.jpg
    ??? {userId3}/
        ??? profile-{userId3}-{timestamp1}.jpg
```

## ?? **Setup Instructions:**

### **1. Create Container via Azure Portal:**
1. Go to your `nexhire-files` storage account
2. Navigate to "Containers" section  
3. Click "Add Directory" ? "Add Container"
4. Name: `profilephotos`
5. Public access level: **Blob** (for public read access to profile images)

### **2. Configure CORS (Required for web uploads):**
```json
{
  "allowedOrigins": ["*"],
  "allowedMethods": ["GET", "POST", "PUT", "OPTIONS"],
  "allowedHeaders": ["*"],
  "exposedHeaders": ["*"],
  "maxAgeInSeconds": 3600
}
```

### **3. Set Environment Variable:**
```bash
# Add to Azure Functions App Settings:
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=nexhireblobdev;AccountKey=YOUR_KEY_HERE;EndpointSuffix=core.windows.net"
```

## ?? **PowerShell Setup Script:**

```powershell
# Azure Storage Container Setup Script
param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName = "nexhire-dev-rg",
    
    [Parameter(Mandatory=$true)]
    [string]$StorageAccountName = "nexhireblobdev",
    
    [Parameter(Mandatory=$false)]
    [string]$ContainerName = "profilephotos"
)

Write-Host "??? Setting up Azure Storage Container for Profile Photos..." -ForegroundColor Cyan

try {
    # Login to Azure (if not already logged in)
    Write-Host "?? Checking Azure login status..." -ForegroundColor Yellow
    $context = az account show 2>$null | ConvertFrom-Json
    if (-not $context) {
        Write-Host "Please login to Azure first:" -ForegroundColor Red
        az login
    }

    # Check if storage account exists
    Write-Host "?? Checking storage account: $StorageAccountName..." -ForegroundColor Yellow
    $storageAccount = az storage account show --name $StorageAccountName --resource-group $ResourceGroupName 2>$null | ConvertFrom-Json
    
    if (-not $storageAccount) {
        Write-Host "? Storage account not found. Creating..." -ForegroundColor Red
        
        # Create storage account
        az storage account create `
            --name $StorageAccountName `
            --resource-group $ResourceGroupName `
            --location "East US" `
            --sku "Standard_LRS" `
            --kind "StorageV2" `
            --access-tier "Hot"
            
        Write-Host "? Storage account created successfully" -ForegroundColor Green
    } else {
        Write-Host "? Storage account exists" -ForegroundColor Green
    }

    # Get storage account key
    Write-Host "?? Getting storage account key..." -ForegroundColor Yellow
    $storageKey = az storage account keys list --account-name $StorageAccountName --resource-group $ResourceGroupName --query "[0].value" --output tsv

    # Create container
    Write-Host "?? Creating container: $ContainerName..." -ForegroundColor Yellow
    az storage container create `
        --name $ContainerName `
        --account-name $StorageAccountName `
        --account-key $storageKey `
        --public-access blob

    Write-Host "? Container created with public blob access" -ForegroundColor Green

    # Set CORS rules
    Write-Host "?? Setting CORS rules..." -ForegroundColor Yellow
    az storage cors add `
        --services b `
        --methods GET POST PUT OPTIONS `
        --origins "*" `
        --allowed-headers "*" `
        --exposed-headers "*" `
        --max-age 3600 `
        --account-name $StorageAccountName `
        --account-key $storageKey

    Write-Host "? CORS rules configured" -ForegroundColor Green

    # Generate connection string
    $connectionString = "DefaultEndpointsProtocol=https;AccountName=$StorageAccountName;AccountKey=$storageKey;EndpointSuffix=core.windows.net"
    
    Write-Host "" -ForegroundColor White
    Write-Host "?? Azure Storage Setup Complete!" -ForegroundColor Green
    Write-Host "" -ForegroundColor White
    Write-Host "?? Configuration Details:" -ForegroundColor Cyan
    Write-Host "   Storage Account: $StorageAccountName" -ForegroundColor White
    Write-Host "   Container: $ContainerName" -ForegroundColor White
    Write-Host "   Public Access: Enabled for blobs" -ForegroundColor White
    Write-Host "   CORS: Configured for web access" -ForegroundColor White
    Write-Host "" -ForegroundColor White
    Write-Host "?? Environment Variable to Add:" -ForegroundColor Yellow
    Write-Host "   AZURE_STORAGE_CONNECTION_STRING=" -ForegroundColor White -NoNewline
    Write-Host $connectionString -ForegroundColor Green
    Write-Host "" -ForegroundColor White
    Write-Host "?? Container URL:" -ForegroundColor Yellow
    Write-Host "   https://$StorageAccountName.blob.core.windows.net/$ContainerName" -ForegroundColor Green
    Write-Host "" -ForegroundColor White

    # Test upload (optional)
    $testUpload = Read-Host "Would you like to test upload functionality? (y/n)"
    if ($testUpload -eq "y" -or $testUpload -eq "Y") {
        Write-Host "?? Testing upload functionality..." -ForegroundColor Yellow
        
        # Create a small test file
        $testFile = "test-upload-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
        "Test upload from setup script - $(Get-Date)" | Out-File -FilePath $testFile
        
        # Upload test file
        az storage blob upload `
            --file $testFile `
            --name "test/$testFile" `
            --container-name $ContainerName `
            --account-name $StorageAccountName `
            --account-key $storageKey
            
        $testUrl = "https://$StorageAccountName.blob.core.windows.net/$ContainerName/test/$testFile"
        Write-Host "? Test upload successful!" -ForegroundColor Green
        Write-Host "   Test file URL: $testUrl" -ForegroundColor Green
        
        # Clean up test file
        Remove-Item $testFile -Force
        
        # Delete test blob
        az storage blob delete `
            --name "test/$testFile" `
            --container-name $ContainerName `
            --account-name $StorageAccountName `
            --account-key $storageKey
            
        Write-Host "?? Test file cleaned up" -ForegroundColor Yellow
    }

} catch {
    Write-Host "? Error during setup: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "?? Setup complete! Your Azure Storage is ready for profile image uploads." -ForegroundColor Green
```

## ?? **Manual Setup via Azure Portal:**

### **Step 1: Access Your Storage Account**
1. Go to Azure Portal ? Storage Accounts
2. Select `nexhireblobdev` (from your screenshot)

### **Step 2: Create Container**
1. Click "Containers" in left menu
2. Click "+ Container"
3. Name: `profilephotos`
4. Public access level: **Blob**
5. Click "Create"

### **Step 3: Configure CORS**
1. In storage account, go to "Settings" ? "Resource sharing (CORS)"
2. Select "Blob service" tab
3. Add new rule:
   - Allowed origins: `*`
   - Allowed methods: `GET,POST,PUT,OPTIONS`
   - Allowed headers: `*`
   - Exposed headers: `*`
   - Max age: `3600`
4. Click "Save"

### **Step 4: Get Connection String**
1. Go to "Security + networking" ? "Access keys"
2. Copy "Connection string" for key1
3. Add to Azure Functions environment variables

## ?? **Expected Container Structure After Setup:**

```
?? profilephotos/
??? ?? user123/
?   ??? ?? profile-user123-1677789012345.jpg
?   ??? ?? profile-user123-1677789123456.png
??? ?? user456/
?   ??? ?? profile-user456-1677789234567.jpg
??? ?? user789/
    ??? ?? profile-user789-1677789345678.jpg
```

## ? **Verification Steps:**

1. **Container exists** ?
2. **Public blob access enabled** ?
3. **CORS configured** ?
4. **Connection string in Functions app** ?
5. **Backend endpoint deployed** ?

## ?? **Usage:**

Once setup is complete, the frontend can upload images via:

```javascript
POST /api/users/profile-image
{
  "fileName": "profile.jpg",
  "fileData": "base64EncodedImageData...",
  "mimeType": "image/jpeg",
  "userId": "123"
}
```

**Response:**
```javascript
{
  "success": true,
  "data": {
    "imageUrl": "https://nexhireblobdev.blob.core.windows.net/profilephotos/123/profile-123-1677789012345.jpg"
  }
}
```