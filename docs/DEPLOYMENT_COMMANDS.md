# ?? NexHire Deployment Commands Reference

## ?? **Quick Commands**

### **Frontend Deployment**
```powershell
# From project root
cd frontend
.\deployfe.ps1                # Deploy to production
.\deployfe.ps1 dev             # Deploy to development  
.\deployfe.ps1 staging         # Deploy to staging
```

### **Backend Deployment**
```powershell
# From project root
.\deploy-backend.ps1           # Deploy to production
.\deploy-backend.ps1 dev       # Deploy to development
.\deploy-backend.ps1 staging   # Deploy to staging
```

### **Unified Deployment** (Recommended)
```powershell
# From project root
.\deploy.ps1                           # Deploy both to production
.\deploy.ps1 -Environment staging      # Deploy both to staging
.\deploy.ps1 -Component frontend -Environment dev  # Frontend only to dev
.\deploy.ps1 -Component backend -Environment prod  # Backend only to prod
```

## ?? **Environment Management**

### **Switch Environments Before Deployment**
```powershell
# Switch both frontend and backend
.\manage-env.ps1 dev           # Development environment
.\manage-env.ps1 staging       # Staging environment  
.\manage-env.ps1 prod          # Production environment

# Check current status
.\manage-env.ps1 -Status
```

### **Environment-Specific URLs**

| Environment | Frontend URL | Backend URL |
|-------------|--------------|-------------|
| **Development** | Local build | `http://localhost:7071/api` |
| **Staging** | `https://nexhire-frontend-staging.azurestaticapps.net` | `https://nexhire-api-staging.azurewebsites.net/api` |
| **Production** | `https://nexhire-frontend-web.azurestaticapps.net` | `https://nexhire-api-func.azurewebsites.net/api` |

## ?? **Complete Deployment Workflows**

### **?? Development Deployment**
```powershell
# 1. Switch to development environment
.\manage-env.ps1 dev

# 2. Deploy backend for development testing
.\deploy-backend.ps1 dev

# 3. Test locally or deploy frontend
cd frontend
npm run dev  # Run locally
# OR
.\deployfe.ps1 dev  # Deploy to Azure
```

### **?? Staging Deployment**
```powershell
# 1. Switch to staging environment  
.\manage-env.ps1 staging

# 2. Deploy both components
.\deploy.ps1 -Environment staging

# 3. Test staging deployment
.\deploy.ps1 -Status
```

### **?? Production Deployment**
```powershell
# 1. Switch to production environment
.\manage-env.ps1 prod

# 2. Deploy with full build and testing
.\deploy.ps1

# 3. Verify deployment
.\deploy.ps1 -Status
```

## ? **Quick Deployment Options**

### **Skip Build (Faster)**
```powershell
# Skip build step (use existing build)
.\deploy.ps1 -SkipBuild

# Backend only, skip build and testing
.\deploy-backend.ps1 prod -SkipBuild -SkipTest
```

### **Component-Specific Deployments**
```powershell
# Frontend only
.\deploy.ps1 -Component frontend

# Backend only  
.\deploy.ps1 -Component backend

# Specific environment + component
.\deploy.ps1 -Component frontend -Environment staging
```

## ?? **Status & Testing**

### **Check Deployment Status**
```powershell
# Overall deployment status
.\deploy.ps1 -Status

# Environment configuration status
.\manage-env.ps1 -Status

# Frontend environment status  
cd frontend && npm run env:status
```

### **Test Deployed APIs**
```powershell
# Test health endpoint
curl https://nexhire-api-func.azurewebsites.net/api/health

# Test countries API
curl https://nexhire-api-func.azurewebsites.net/api/reference/countries
```

## ??? **Troubleshooting Common Issues**

### **? "Environment file not found"**
```powershell
# Check available environments
.\manage-env.ps1 -List

# Create missing environment files if needed
.\manage-env.ps1 -Status
```

### **? "Azure login required"**
```powershell
# Login to Azure
az login

# Check current subscription
az account show

# Set correct subscription
az account set --subscription "44027c71-593a-4d51-977b-ab0604cb76eb"
```

### **? "Build failed"**
```powershell
# For frontend
cd frontend
npm install
npm run build:prod

# For backend  
npm install
npm run build
```

### **? "Deployment token failed"**
```powershell
# Check Azure resources exist
az staticwebapp list --query "[].{name:name,resourceGroup:resourceGroupName}"
az functionapp list --query "[].{name:name,resourceGroup:resourceGroupName}"
```

## ?? **Pre-Deployment Checklist**

### **Before Production Deployment:**
- [ ] ? All tests passing
- [ ] ? Environment files configured  
- [ ] ? Live keys updated in `.env.prod`
- [ ] ? Database schema updated
- [ ] ? Azure resources provisioned
- [ ] ? Staging deployment tested

### **After Deployment:**
- [ ] ? Health endpoints responding
- [ ] ? Frontend loading correctly
- [ ] ? Google Sign-In working
- [ ] ? Payment system functional
- [ ] ? Database connectivity verified

## ?? **Most Common Commands**

```powershell
# Quick development cycle
.\manage-env.ps1 dev && .\deploy-backend.ps1 dev

# Quick staging test
.\manage-env.ps1 staging && .\deploy.ps1 -Environment staging

# Production deployment
.\manage-env.ps1 prod && .\deploy.ps1

# Check everything is working
.\deploy.ps1 -Status
```

---

?? **Your deployment system is now ready!** Use these commands to deploy NexHire to any environment with confidence! ??