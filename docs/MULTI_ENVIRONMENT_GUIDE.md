# ?? Multi-Environment Configuration Guide

## ?? **Overview**

RefOpen now supports clean, simple multi-environment configuration with separate files for each environment that are automatically switched at runtime.

## ??? **Environment Files Structure**

```
refopen/
??? ?? Frontend Environments
?   ??? frontend/.env.dev        # Development environment
?   ??? frontend/.env.staging    # Staging environment  
?   ??? frontend/.env.prod       # Production environment
?   ??? frontend/.env            # ?? Active environment (auto-switched)
?
??? ?? Backend Environments  
?   ??? .env.dev                 # Development environment
?   ??? .env.staging             # Staging environment
?   ??? .env.prod                # Production environment
?   ??? .env                     # ?? Active environment (auto-switched)
?
??? ?? Environment Loaders
?   ??? frontend/src/config/envLoader.js   # Frontend runtime detection
?   ??? src/config/envLoader.ts            # Backend runtime detection
?
??? ?? Management Scripts
    ??? manage-env.ps1                     # ??? Main environment switcher
    ??? frontend/scripts/switch-env.js     # Frontend-only switcher
    ??? frontend/scripts/env-status.js     # Status checker
```

## ?? **Simple Environment Switching**

### **Method 1: PowerShell Script (Recommended)**
```powershell
# Switch both frontend and backend
.\manage-env.ps1 dev         # Development
.\manage-env.ps1 staging     # Staging  
.\manage-env.ps1 prod        # Production

# Switch only frontend or backend
.\manage-env.ps1 dev -Component frontend
.\manage-env.ps1 prod -Component backend

# Check status
.\manage-env.ps1 -Status
```

### **Method 2: NPM Scripts (Frontend Only)**
```bash
# Development
npm run dev
npm run dev:web
npm run dev:android

# Staging  
npm run staging
npm run staging:web
npm run staging:build

# Production
npm run prod
npm run prod:web  
npm run prod:build

# Environment management
npm run env:switch dev
npm run env:status
```

### **Method 3: Manual Copy**
```bash
# Frontend
cp frontend/.env.dev frontend/.env      # Development
cp frontend/.env.staging frontend/.env  # Staging
cp frontend/.env.prod frontend/.env     # Production

# Backend
cp .env.dev .env        # Development
cp .env.staging .env    # Staging  
cp .env.prod .env       # Production
```

## ?? **Environment Configurations**

### **Development Environment**
- **API URL**: `http://localhost:7071/api` (local development)
- **Debug**: `true` 
- **Razorpay**: Test keys
- **Database**: Development database
- **Features**: All enabled for testing

### **Staging Environment**  
- **API URL**: `https://refopen-api-staging.azurewebsites.net/api`
- **Debug**: `true` (for debugging staging issues)
- **Razorpay**: Test keys
- **Database**: Staging database
- **Features**: All enabled (production-like testing)

### **Production Environment**
- **API URL**: `https://refopen-api-func.azurewebsites.net/api`
- **Debug**: `false`
- **Razorpay**: Live keys 
- **Database**: Production database
- **Features**: All enabled (live system)

## ?? **Your Current Configuration**

### **? All Environment Files Created:**

| Environment | Frontend File | Backend File | Status |
|-------------|---------------|--------------|--------|
| Development | `frontend/.env.dev` | `.env.dev` | ? Ready |
| Staging | `frontend/.env.staging` | `.env.staging` | ? Ready |
| Production | `frontend/.env.prod` | `.env.prod` | ? Ready |
| **Active** | `frontend/.env` | `.env` | ? **Currently: Development** |

### **? All Your Keys Configured:**
- **Google OAuth**: All client IDs for Web/Android/iOS
- **Firebase**: Project ID and all app IDs
- **Razorpay**: Test keys (production keys ready to replace)
- **Database**: Connection strings configured
- **API Endpoints**: All environment URLs set

## ??? **Development Workflow**

### **Daily Development:**
```powershell
# Start development
.\manage-env.ps1 dev
cd frontend && npm run dev

# Switch to test against staging API
.\manage-env.ps1 staging -Component frontend
npm run staging:web

# Deploy to production
.\manage-env.ps1 prod
npm run prod:build
```

### **Build & Deploy:**
```bash
# Build for each environment
npm run build:dev      # Development build
npm run build:staging  # Staging build  
npm run build:prod     # Production build
```

## ?? **Runtime Environment Detection**

The environment loaders automatically detect the current environment:

### **Frontend Detection (envLoader.js):**
1. `EXPO_ENV` environment variable
2. `NODE_ENV` environment variable  
3. URL hostname (production domains)
4. Build command flags
5. Default: development

### **Backend Detection (envLoader.ts):**
1. `NODE_ENV` environment variable
2. `RefOpen_ENV` environment variable
3. Azure Functions environment
4. Azure App Service detection
5. Command line arguments
6. Default: development

## ?? **Environment Status Commands**

```powershell
# Check all environment files
.\manage-env.ps1 -Status

# List available environments  
.\manage-env.ps1 -List

# Frontend-specific status
cd frontend && npm run env:status
```

## ?? **Security & Best Practices**

### **? What's Safe in Each Environment:**
- **Development**: Debug enabled, test keys, local APIs
- **Staging**: Debug enabled, test keys, staging APIs  
- **Production**: Debug disabled, live keys, production APIs

### **? Automatic Safeguards:**
- Production environment validates no placeholder values
- Live keys only in production environment files
- Debug automatically disabled in production
- Environment validation on startup

### **? Key Management:**
- **Test Keys**: Safe to commit (already in dev/staging)
- **Live Keys**: Replace placeholders in `.env.prod` only
- **Secrets**: Use Azure Key Vault for production secrets

## ?? **Quick Start Guide**

### **1. Current Setup (Ready to Use)**
```powershell
# You're currently in development environment
.\manage-env.ps1 -Status  # Check current status
cd frontend && npm run dev  # Start development
```

### **2. Test Staging Environment**  
```powershell
.\manage-env.ps1 staging  # Switch to staging
cd frontend && npm run staging:web  # Test with staging API
```

### **3. Prepare for Production**
```powershell
# Update production keys in .env.prod (replace YOUR_LIVE_KEY_HERE)
.\manage-env.ps1 prod  # Switch to production
npm run prod:build  # Build for production
```

## ?? **No More Configuration Confusion!**

### **? Before (Complex):**
- Multiple config files to manage
- Manual environment switching
- Easy to use wrong environment
- Scattered environment variables

### **? After (Simple):**
- **3 files per component**: `.env.dev`, `.env.staging`, `.env.prod`
- **1 command**: `.\manage-env.ps1 <environment>`
- **Automatic detection**: Runtime environment detection
- **All keys in one place**: Each environment file has everything

---

?? **Your multi-environment system is complete and ready!** 

**Next Steps:**
1. `.\manage-env.ps1 -Status` - Check current configuration
2. `cd frontend && npm run dev` - Start development  
3. `.\manage-env.ps1 staging` - Test staging when ready
4. Update live keys in `.env.prod` when ready for production

No more juggling multiple config files - just simple environment switching! ??