# CORS Configuration Fix Guide

## Problem
Browser blocks API requests with error:
```
Access to fetch at 'https://refopen-api-func.azurewebsites.net/api/...' 
has been blocked by CORS policy: Response to preflight request doesn't pass 
access control check: No 'Access-Control-Allow-Origin' header is present on 
the requested resource.
```

## Solution: Configure CORS in Azure Function App

### Method 1: Azure Portal (Easiest)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Function App: **refopen-api-func**
3. In the left menu, select **CORS** (under API section)
4. Add the following allowed origins:
   - `http://localhost:19006` (Expo web dev)
   - `http://localhost:3000` (Alternative dev port)
   - `http://localhost:8081` (Expo mobile dev)
   - `https://refopen.com` (Production - if applicable)
   - `https://www.refopen.com` (Production with www)

5. **IMPORTANT:** Remove the wildcard `*` if present (it doesn't work with credentials)
6. Enable **Access-Control-Allow-Credentials**: Check the box
7. Click **Save**

### Method 2: Azure CLI

```bash
# Set CORS allowed origins
az functionapp cors add \
  --name refopen-api-func \
  --resource-group <your-resource-group> \
  --allowed-origins http://localhost:19006 http://localhost:3000 http://localhost:8081

# Enable credentials
az functionapp config appsettings set \
  --name refopen-api-func \
  --resource-group <your-resource-group> \
  --settings "CORS_CREDENTIALS=true"
```

### Method 3: Add CORS to host.json (Backend Code)

If you have access to the backend code, add this to `host.json`:

```json
{
  "version": "2.0",
  "extensions": {
    "http": {
      "routePrefix": "api",
      "cors": {
        "allowedOrigins": [
          "http://localhost:19006",
          "http://localhost:3000",
          "http://localhost:8081",
          "https://refopen.com"
        ],
        "supportCredentials": true
      }
    }
  }
}
```

## Quick Test After Configuration

1. Clear browser cache (Ctrl+Shift+Delete)
2. Restart your Expo dev server: `npm start`
3. Refresh the browser
4. Check if API calls succeed

## Troubleshooting

### Still seeing CORS errors?

1. **Check browser console** for the exact error message
2. **Verify origins match exactly** - no trailing slashes, correct protocol (http vs https)
3. **Clear browser cache** - old CORS responses may be cached
4. **Check Azure Function logs** - there might be backend errors

### Preflight requests failing?

The browser sends OPTIONS requests before actual requests. Azure Functions should automatically handle these, but verify:

1. Check if OPTIONS requests return 200 status
2. Verify these headers are present:
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`
   - `Access-Control-Allow-Headers`
   - `Access-Control-Allow-Credentials`

### Development vs Production

For development, you can temporarily use a **CORS proxy** (NOT recommended for production):

```javascript
// TEMPORARY DEV WORKAROUND ONLY
const DEV_PROXY = 'https://cors-anywhere.herokuapp.com/';
const API_URL = __DEV__ 
  ? DEV_PROXY + 'https://refopen-api-func.azurewebsites.net/api'
  : 'https://refopen-api-func.azurewebsites.net/api';
```

**?? WARNING:** This is only for testing! Never use CORS proxies in production.

## Backend Code Fix (If You Control Backend)

If you have access to the backend Azure Functions code, add CORS headers to all responses:

```javascript
// Add to every Azure Function response
context.res = {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  },
  body: { /* your response data */ }
};

// Handle OPTIONS preflight
if (req.method === 'OPTIONS') {
  context.res = {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400'
    },
    body: ''
  };
  return;
}
```

## Expected Behavior After Fix

? Browser console shows successful API calls
? No CORS errors in console
? Data loads correctly in your app
? Network tab shows 200 status codes with CORS headers

## Need More Help?

- Check Azure Function App logs in Azure Portal
- Use browser Network tab to inspect request/response headers
- Share specific error messages for targeted help
