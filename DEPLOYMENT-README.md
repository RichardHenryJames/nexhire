# NexHire Backend Deployment

## ? Working Deployment Script

**`deploy-backend.ps1`** - This is the verified working deployment script that successfully deploys your countries API with proper flag emojis.

### Quick Start
```powershell
.\deploy-backend.ps1
```

### What it does:
- ? Deploys all 31 Azure Functions
- ? Countries API with proper flag emojis (???? ???? ????)
- ? Tests deployment automatically
- ? Shows real-time status

### Live Endpoints:
- **Health**: https://nexhire-api-func.azurewebsites.net/api/health
- **Countries**: https://nexhire-api-func.azurewebsites.net/api/reference/countries

### Package Optimization Achieved:
- **Before**: 1.36 GB node_modules with dev tools
- **After**: Clean production deployment
- **Result**: Fast, reliable deployments

### Frontend Integration:
Your frontend should now display proper flag emojis instead of broken characters for all countries!

---
*Last tested and verified working: 2025-08-24*