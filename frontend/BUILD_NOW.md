# ?? **BUILD YOUR REFOPEN MOBILE APPS NOW!**

## ? **Super Quick Start (2 Minutes)**

### **Windows Users (Easiest):**

```powershell
# 1. Open PowerShell in the project directory
cd C:\Users\parimalkumar\Desktop\Projects\nexhire\frontend

# 2. Run the automated build script
.\build-mobile-apps.ps1

# 3. Follow the menu prompts!
```

### **Mac/Linux Users:**

```bash
# 1. Open Terminal in the project directory
cd ~/Projects/nexhire/frontend

# 2. Make script executable
chmod +x build-mobile-apps.sh

# 3. Run the script
./build-mobile-apps.sh

# 4. Follow the menu prompts!
```

---

## ?? **What You'll Get**

After building, you'll have:

- ? **Android APK** - Install directly on any Android device
- ? **iOS IPA** - Distribute via TestFlight or App Store
- ? **Download Links** - Expo provides secure download links
- ? **QR Codes** - Easy installation on test devices

---

## ?? **Step-by-Step: First Time Setup**

### **1. Install Prerequisites** (One-time only)

```bash
# Check Node.js version (need 20+)
node --version

# If not installed, download from: https://nodejs.org

# Install EAS CLI globally
npm install -g eas-cli
```

### **2. Create Expo Account** (Free, one-time)

1. Go to [expo.dev](https://expo.dev)
2. Click "Sign Up"
3. Create free account
4. Verify email

### **3. Login via CLI**

```bash
cd frontend
eas login
# Enter your Expo credentials
```

### **4. Configure Project** (One-time)

```bash
# This initializes EAS for your project
eas build:configure

# Answer the prompts:
# - Select your project or create new
# - Choose build profiles
```

### **5. Build Your Apps!**

```bash
# Build Android APK (5-10 minutes)
npm run build:android

# Build iOS App (10-15 minutes)
npm run build:ios

# Build Both (15-20 minutes total)
npm run build:mobile
```

---

## ?? **All Available Build Commands**

```bash
# Android Commands
npm run build:android              # Preview APK (for testing)
npm run build:android:production   # Production APK (for Play Store)

# iOS Commands
npm run build:ios           # Preview build (for testing)
npm run build:ios:production       # Production build (for App Store)

# Build Both Platforms
npm run build:mobile     # Both preview builds
npm run build:mobile:production    # Both production builds

# Development Build
eas build --platform android --profile development
```

---

## ?? **After Build Completes**

### **For Android:**

1. **Check Expo Dashboard:**
   - Go to [expo.dev/accounts/YOUR_USERNAME/projects/refopen/builds](https://expo.dev)
   - Find your latest build
   - Download the APK

2. **Install on Android Device:**
   - **Method 1:** Email APK to yourself, open on phone
   - **Method 2:** Use USB cable, transfer APK
   - **Method 3:** Scan QR code from Expo dashboard
   
3. **Enable Installation:**
   - Settings ? Security ? Enable "Unknown Sources"
   - Tap the APK to install

### **For iOS:**

1. **Download IPA from Expo:**
   - Go to Expo dashboard
   - Download the `.ipa` file

2. **Distribute Options:**
   - **TestFlight:** Upload to App Store Connect ? Internal/External Testing
   - **Ad-hoc:** Install on registered devices
   - **Enterprise:** If you have enterprise certificate

---

## ?? **Important Configuration**

### **App Identifiers** (Already configured in `app.json`)

```json
{
  "android": {
    "package": "com.refopen.app"
  },
  "ios": {
    "bundleIdentifier": "com.refopen.app"
  }
}
```

### **App Icons & Splash Screens**

Place your assets in `frontend/assets/`:

- `icon.png` - App icon (1024x1024px)
- `adaptive-icon.png` - Android adaptive icon (1024x1024px)
- `splash.png` - Splash screen (1242x2436px)
- `favicon.png` - Web favicon (48x48px)

---

## ?? **Troubleshooting**

### **Build Failed?**

1. **Check Build Logs:**
   ```bash
   eas build:list
   eas build:view [BUILD_ID]
   ```

2. **Common Fixes:**
   ```bash
   # Update EAS CLI
   npm install -g eas-cli@latest
 
   # Clear cache
   cd frontend
   rm -rf node_modules
   npm install
   
   # Try again
   npm run build:android
   ```

### **Can't Login to EAS?**

```bash
# Logout and login again
eas logout
eas login
```

### **APK Won't Install?**

- Enable "Install from Unknown Sources"
- Check Android version (minimum: Android 7.0)
- Re-download APK (might be corrupted)

### **iOS Build Issues?**

- Ensure Apple Developer account is active ($99/year)
- Check Bundle Identifier matches App Store Connect
- Verify provisioning profiles are valid

---

## ?? **Build Profiles Explained**

### **Preview** (Default for testing)
- ? Quick builds
- ? APK for Android (easy distribution)
- ? Internal distribution
- ? Good for beta testing

### **Production** (For app stores)
- ? Optimized builds
- ? Minified code
- ? Ready for store submission
- ? Full production configuration

### **Development** (For active development)
- ? Development client
- ? Fast rebuilds
- ? Hot reload support
- ? Debugging tools

---

## ?? **Success Checklist**

After building, verify:

- [ ] APK/IPA downloads successfully
- [ ] App installs on test device
- [ ] Login works
- [ ] Messaging works
- [ ] Navigation works
- [ ] Images load correctly
- [ ] No crashes or errors

---

## ?? **Distribution Options**

### **Android:**

1. **Direct APK Distribution:**
   - Email to users
   - Host on website
   - Share via cloud storage

2. **Google Play Store:**
   ```bash
   # Build production
   npm run build:android:production
   
   # Submit (requires Google Play Developer account)
   eas submit --platform android
   ```

3. **Internal Testing:**
   - Upload to Play Console
   - Create Internal Testing track
   - Invite testers via email

### **iOS:**

1. **TestFlight (Recommended for testing):**
   - Upload IPA to App Store Connect
   - Add internal/external testers
   - Distribute beta builds

2. **App Store:**
   ```bash
   # Build production
   npm run build:ios:production
   
   # Submit (requires Apple Developer account)
   eas submit --platform ios
   ```

---

## ?? **Need Help?**

- **Expo Documentation:** [docs.expo.dev/build](https://docs.expo.dev/build)
- **EAS Build Guide:** [docs.expo.dev/build/introduction](https://docs.expo.dev/build/introduction)
- **Community Forum:** [forums.expo.dev](https://forums.expo.dev)
- **GitHub Issues:** [github.com/expo/expo/issues](https://github.com/expo/expo/issues)

---

## ?? **Pro Tips**

1. **Test on Web First:**
   ```bash
   npm run web
   # Opens in browser - test features quickly
   ```

2. **Use Development Builds for Faster Testing:**
   ```bash
 eas build --platform android --profile development
   # Installs dev client with hot reload
   ```

3. **Monitor Build Status:**
   ```bash
   eas build:list
# Shows all your builds and their status
   ```

4. **Auto-Update Your App:**
   - Use Expo's OTA (Over-The-Air) updates
   - Update without resubmitting to stores
   - [docs.expo.dev/eas-update](https://docs.expo.dev/eas-update)

---

## ?? **Quick Links**

- **Expo Dashboard:** [expo.dev](https://expo.dev)
- **Your Builds:** [expo.dev/accounts/YOUR_USERNAME/projects/refopen/builds](https://expo.dev)
- **EAS Documentation:** [docs.expo.dev/eas](https://docs.expo.dev/eas)

---

**?? You're all set! Build your apps and start testing!** ??

**Questions? Run the PowerShell script for an interactive build experience:**
```powershell
cd frontend
.\build-mobile-apps.ps1
```
