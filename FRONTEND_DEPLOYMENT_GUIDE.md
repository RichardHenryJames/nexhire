#  NexHire Frontend Deployment Guide

##  **Deployment Status: READY FOR DEPLOYMENT**

Your **NexHire Universal React Native Frontend** is ready to be deployed to Azure Static Web Apps!

### **? What's Ready:**
-  **Universal Architecture** - Expo React Native + Web build system
-  **API Integration** - Connected to your deployed backend
-  **Design System** - Complete UI components and styling
-  **Authentication** - JWT token management with secure storage
-  **Navigation** - Role-based navigation structure
-  **Environment Config** - Production environment setup

---

##  **Prerequisites**

Before deployment, ensure you have:

- ? **Azure CLI** installed
- ? **Node.js v18+** installed  
- ? **Azure subscription** access
- ? **NexHire Azure Static Web App** already created
- ? **PowerShell** (Windows) or compatible shell

### **Quick Prerequisites Check:**
```powershell
# Check Azure CLI
az --version

# Check Node.js
node --version

# Login to Azure
az login

# Verify Static Web App exists
az staticwebapp show --name "nexhire-frontend-web" --resource-group "nexhire-dev-rg"
```

---

##  **Deployment Options**

### **Option 1: Full Deployment Script (Recommended)**
```powershell
# Run the comprehensive deployment script
.\deploy-frontend.ps1
```

**This script will:**
- ? Validate environment and prerequisites
- ? Install/update dependencies
- ? Configure production environment
- ? Build React Native Web app with Expo
- ? Deploy to Azure Static Web App
- ? Configure routing and settings
- ? Test deployment and verify functionality

### **Option 2: Quick Deployment**
```powershell
# For rapid deployments during development
.\deploy-frontend-quick.ps1
```

### **Option 3: Manual Step-by-Step**
```powershell
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Build for web
npm run build:web

# Deploy to Azure
npm run deploy:azure
```

### **Option 4: Using Package Scripts**
```powershell
cd frontend

# Build and deploy in one command
npm run deploy:web

# Or separate steps
npm run build:web
swa deploy --app-location . --output-location web-build
```

---

##  **Your Deployed URLs**

After successful deployment:

### **Production Frontend:**
```
https://nexhire-frontend-web.azurestaticapps.net
```

### **API Backend (Already Working):**
```
https://nexhire-api-func.azurewebsites.net/api
```

---

##  **Testing Your Deployment**

### **Automated Testing:**
```powershell
# Run comprehensive frontend tests
.\test-frontend.ps1

# Save test results
.\test-frontend.ps1 -SaveResults

# Verbose output
.\test-frontend.ps1 -Verbose

# Test specific URL
.\test-frontend.ps1 -BaseUrl "https://your-custom-domain.com"
```

### **Manual Testing Checklist:**
- [ ] **Homepage loads** - Check main page displays
- [ ] **Authentication** - Test login/register flows
- [ ] **Navigation** - Verify tab and stack navigation
- [ ] **API Integration** - Confirm backend connectivity
- [ ] **Responsive Design** - Test on different screen sizes
- [ ] **Performance** - Check load times and responsiveness

---

##  **Configuration Files**

### **Environment Variables:**
The deployment script automatically creates `.env` with:
```env
EXPO_PUBLIC_API_URL=https://nexhire-api-func.azurewebsites.net/api
EXPO_PUBLIC_APP_NAME=NexHire
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_VERSION=1.0.0
```

### **Static Web App Configuration:**
Auto-generated `staticwebapp.config.json`:
```json
{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous"]
    },
    {
      "route": "/*",
      "serve": "/index.html",
      "statusCode": 200
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html"
  }
}
```

---

##  **Build Output**

### **What Gets Built:**
-  **React Native Web App** - Optimized for browsers
-  **Static Assets** - CSS, JS, images, fonts
-  **HTML Shell** - Single page application structure
-  **Service Worker** - For PWA capabilities (if enabled)
-  **Manifest** - App metadata and icons

### **Build Optimization:**
- **Code Splitting** - Automatic chunk splitting
- **Tree Shaking** - Remove unused code
- **Minification** - Compressed JS/CSS
- **Asset Optimization** - Optimized images and fonts

---

##  **Advanced Configuration**

### **Custom Domain Setup:**
```powershell
# Add custom domain to Static Web App
az staticwebapp hostname set \
  --name "nexhire-frontend-web" \
  --resource-group "nexhire-dev-rg" \
  --hostname "app.nexhire.com"
```

### **Environment-Specific Deployments:**
```powershell
# Deploy to staging
.\deploy-frontend.ps1 -StaticAppName "nexhire-frontend-staging"

# Deploy to production
.\deploy-frontend.ps1 -StaticAppName "nexhire-frontend-web"
```

### **Custom Build Configuration:**
```javascript
// app.config.js for advanced Expo configuration
export default {
  expo: {
    name: "NexHire",
    slug: "nexhire",
    platforms: ["ios", "android", "web"],
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png"
    }
  }
};
```

---

##  **Troubleshooting**

### **Common Issues:**

#### ** Build Fails**
```powershell
# Clear cache and rebuild
cd frontend
rm -rf node_modules web-build
npm install
npm run build:web
```

#### ** Deployment Fails**
```powershell
# Check Azure CLI login
az account show

# Verify Static Web App exists
az staticwebapp show --name "nexhire-frontend-web" --resource-group "nexhire-dev-rg"

# Manual deployment
az staticwebapp deploy --source ./web-build
```

#### ** API Connection Issues**
- Verify CORS settings in backend
- Check environment variables
- Test API endpoints manually

#### ** App Not Loading**
- Check browser console for errors
- Verify all assets are deployed
- Test with different browsers

### **Debug Commands:**
```powershell
# View Static Web App logs
az staticwebapp show --name "nexhire-frontend-web" --resource-group "nexhire-dev-rg"

# Check deployment status
swa --version

# Preview build locally
cd frontend
npm run preview
```

---

##  **Performance Optimization**

### **Already Implemented:**
- ? **Code Splitting** - Automatic by Expo/Metro
- ? **Asset Optimization** - Images and fonts optimized
- ? **Gzip Compression** - Automatic by Azure Static Web Apps
- ? **CDN Distribution** - Global content delivery
- ? **Caching Headers** - Optimal cache policies

### **Additional Optimizations:**
```powershell
# Analyze bundle size
cd frontend
npm run analyze

# Test performance
npm run test:frontend
```

---

##  **CI/CD Pipeline Setup**

### **GitHub Actions Integration:**
Your Azure Static Web App can auto-deploy from GitHub:

1. **Connect Repository** - Link GitHub repo in Azure Portal
2. **Automatic Builds** - Triggers on push to main branch
3. **Branch Deployments** - Preview deployments for PRs

### **Manual Trigger:**
```powershell
# Deploy from any branch
git push origin main

# Or manual deployment
.\deploy-frontend.ps1
```

---

##  **Deployment Checklist**

### **Pre-Deployment:**
- [ ] Backend APIs are working
- [ ] Environment variables configured
- [ ] All dependencies installed
- [ ] Build completes successfully
- [ ] Local testing passes

### **Deployment:**
- [ ] Run deployment script
- [ ] Verify build output
- [ ] Check deployment logs
- [ ] Test deployed application

### **Post-Deployment:**
- [ ] Functional testing complete
- [ ] Performance testing passed
- [ ] Security headers verified
- [ ] CORS configuration working
- [ ] API integration confirmed

---

##  **What's Next**

### **Immediate (Post-Deployment):**
1. **Test Core Features** - Login, navigation, API calls
2. **Performance Check** - Load times and responsiveness
3. **Browser Compatibility** - Test on different browsers
4. **Mobile Testing** - Responsive design verification

### **Short Term (Next Week):**
1. **Additional Screens** - Implement remaining screens
2. **Error Handling** - Better error messages and states
3. **Loading States** - Skeleton screens and spinners
4. **Form Validation** - Enhanced validation feedback

### **Long Term (Next Month):**
1. **PWA Features** - Offline support, push notifications
2. **Performance Monitoring** - Application Insights integration
3. **User Analytics** - Usage tracking and metrics
4. **Custom Domain** - Professional domain setup

---

##  **Ready to Deploy!**

Your **NexHire Frontend** is ready for deployment with:

? **Universal React Native App** - Web, iOS, Android ready  
? **Production Build System** - Optimized for performance  
? **Azure Integration** - Static Web App deployment  
? **API Connectivity** - Backend integration complete  
? **Testing Suite** - Automated testing scripts  
? **CI/CD Ready** - Deployment automation prepared  

### **Deploy Now:**
```powershell
.\deploy-frontend.ps1
```

**Your NexHire job platform frontend will be live in minutes!** 