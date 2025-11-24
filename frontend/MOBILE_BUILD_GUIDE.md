# ?? RefOpen Mobile Apps - Quick Start Guide

This guide will help you build native Android and iOS apps for RefOpen.

## ?? Prerequisites

Before you begin, ensure you have:

- ? **Node.js 20+** installed ([Download](https://nodejs.org))
- ? **npm** (comes with Node.js)
- ? **Expo account** (create free at [expo.dev](https://expo.dev))

## ?? Quick Start (5 Minutes)

### **Option 1: Using PowerShell Script (Windows - Easiest)**

```powershell
# Navigate to frontend folder
cd frontend

# Run the build script
.\build-mobile-apps.ps1

# Follow the interactive prompts
```

### **Option 2: Using Bash Script (Mac/Linux)**

```bash
# Navigate to frontend folder
cd frontend

# Make script executable
chmod +x build-mobile-apps.sh

# Run the build script
./build-mobile-apps.sh

# Follow the interactive prompts
```

### **Option 3: Manual Commands**

```bash
# Navigate to frontend
cd frontend

# Install dependencies (if not done)
npm install

# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS (first time only)
eas build:configure

# Build Android APK
eas build --platform android --profile preview

# Build iOS App
eas build --platform ios --profile preview

# Build both
eas build --platform all --profile preview
```

## ?? Build Profiles

We have 3 build profiles configured:

### **1. Development** (For testing during development)
```bash
eas build --platform android --profile development
```
- Includes development client
- Fast builds
- For internal testing

### **2. Preview** (For testing before release)
```bash
eas build --platform android --profile preview
```
- APK for Android (easier distribution)
- Ad-hoc distribution for iOS
- For beta testing

### **3. Production** (For app stores)
```bash
eas build --platform android --profile production
```
- Optimized builds
- Ready for Google Play / App Store
- Full production configuration

## ?? Android Specific

### **Download & Install APK**

1. **Build the APK:**
   ```bash
   eas build --platform android --profile preview
   ```

2. **Download:** You'll get a link like:
   ```
   https://expo.dev/accounts/yourname/projects/refopen/builds/...
   ```

3. **Transfer to Android device:**
   - Via USB
   - Email the APK to yourself
   - Use cloud storage (Google Drive, Dropbox)

4. **Install:**
   - Open the APK on your Android device
   - Enable "Install from Unknown Sources" if prompted
   - Tap "Install"

### **Google Play Store Submission**

```bash
# Build production APK
eas build --platform android --profile production

# Submit to Google Play (requires setup)
eas submit --platform android
```

## ?? iOS Specific

### **TestFlight Distribution**

1. **Build iOS app:**
   ```bash
   eas build --platform ios --profile preview
   ```

2. **The build will be uploaded to your Expo account**

3. **Download the `.ipa` file**

4. **Install via TestFlight:**
   - Submit to App Store Connect
   - Distribute via TestFlight

### **App Store Submission**

```bash
# Build production iOS app
eas build --platform ios --profile production

# Submit to App Store (requires setup)
eas submit --platform ios
```

**Note:** iOS builds require:
- Apple Developer Account ($99/year)
- Valid Bundle Identifier
- App Store Connect app created

## ?? Configuration

### **Update App Information**

Edit `frontend/app.json`:

```json
{
  "expo": {
    "name": "Your App Name",
    "slug": "your-app-slug",
    "version": "1.0.0",
    "android": {
      "package": "com.yourcompany.yourapp"
    },
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp"
    }
  }
}
```

### **Update Build Configuration**

Edit `frontend/eas.json` to customize build settings.

## ?? Test Your App

### **Test on Web First**
```bash
cd frontend
npm run web
```

### **Test on Android Emulator**
```bash
# Requires Android Studio installed
npm run android
```

### **Test on iOS Simulator**
```bash
# Requires Xcode (macOS only)
npm run ios
```

## ?? Troubleshooting

### **Build Failed**

1. **Check EAS CLI version:**
   ```bash
   eas --version
   # Update if needed:
   npm install -g eas-cli@latest
   ```

2. **Clear cache:**
   ```bash
   cd frontend
   rm -rf node_modules
   npm install
   ```

3. **Check build logs:**
   - Go to [expo.dev/accounts/yourname/projects/refopen/builds](https://expo.dev)
   - Click on the failed build
   - Review error logs

### **Login Issues**

```bash
# Logout and login again
eas logout
eas login
```

### **Android APK not installing**

1. Enable "Install from Unknown Sources" in Android settings
2. Check if APK is corrupted (re-download)
3. Try different transfer method

### **iOS Build Issues**

1. **Bundle Identifier mismatch:**
   - Check `app.json` matches App Store Connect
   
2. **Provisioning Profile:**
   - Ensure Apple Developer account is properly configured
   - Check certificates are valid

## ?? Build Status

Check your builds at: [https://expo.dev](https://expo.dev)

## ?? Getting Help

- **Expo Documentation:** [docs.expo.dev](https://docs.expo.dev)
- **EAS Build Docs:** [docs.expo.dev/build/introduction](https://docs.expo.dev/build/introduction)
- **Community Forum:** [forums.expo.dev](https://forums.expo.dev)

## ?? Success!

Once your build completes:

1. ? **Download** the APK/IPA from Expo dashboard
2. ? **Install** on your device
3. ? **Test** all features
4. ? **Share** with your team for testing

---

## ?? Quick Reference Commands

```bash
# Install dependencies
cd frontend && npm install

# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build Android Preview
eas build --platform android --profile preview

# Build iOS Preview
eas build --platform ios --profile preview

# Build Production
eas build --platform android --profile production
eas build --platform ios --profile production

# Check build status
eas build:list

# View build details
eas build:view [build-id]
```

---

**Built with ?? by RefOpen Team**
