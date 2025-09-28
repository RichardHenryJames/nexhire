import 'dotenv/config';

export default ({ config }) => {
  // Load environment variables from .env file
  const env = process.env.EXPO_PUBLIC_APP_ENV || 'development';
  
  console.log(`?? Expo Config: Loading configuration for ${env} environment`);
  
  // Debug: Log key environment variables
  console.log(`?? Debug - Environment Variables:`);
  console.log(`  EXPO_PUBLIC_APP_ENV: ${process.env.EXPO_PUBLIC_APP_ENV}`);
  console.log(`  EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB: ${process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ? 'SET' : 'NOT SET'}`);
  console.log(`  EXPO_PUBLIC_FEATURE_GOOGLE_SIGNIN: ${process.env.EXPO_PUBLIC_FEATURE_GOOGLE_SIGNIN}`);
  
  // Environment-specific configuration
  const environmentConfig = {
    development: {
      name: 'NexHire (Dev)',
      scheme: 'com.nexhire.app.dev',
    },
    staging: {
      name: 'NexHire (Staging)',
      scheme: 'com.nexhire.app.staging',
    },
    production: {
      name: 'NexHire',
      scheme: 'com.nexhire.app',
    }
  };

  const currentEnvConfig = environmentConfig[env] || environmentConfig.development;

  // Helper function for boolean conversion
  const toBool = (value, defaultValue = false) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'yes';
    }
    return defaultValue;
  };

  // PROPER FIX: Ensure configuration is available at runtime
  const extraConfig = {
    // Explicitly pass environment variables to the app
    appEnv: env,
    appVersion: '1.0.0',
    debug: env !== 'production',
    
    // API Configuration
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://nexhire-api-func.azurewebsites.net/api',
    apiTimeout: process.env.EXPO_PUBLIC_API_TIMEOUT || '30000',
    apiDebug: env !== 'production',
    
    // Google OAuth Configuration - CRITICAL: These must be strings, not empty
    googleClientIdWeb: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '',
    googleClientIdAndroid: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '',
    googleClientIdIos: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '',
    
    // Firebase Configuration
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'nexhire-123',
    firebaseWebAppId: process.env.EXPO_PUBLIC_FIREBASE_WEB_APP_ID || '',
    firebaseAndroidAppId: process.env.EXPO_PUBLIC_FIREBASE_ANDROID_APP_ID || '',
    firebaseIosAppId: process.env.EXPO_PUBLIC_FIREBASE_IOS_APP_ID || '',
    
    // Razorpay Configuration
    razorpayKeyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '',
    
    // Feature Flags
    featureGoogleSignin: toBool(process.env.EXPO_PUBLIC_FEATURE_GOOGLE_SIGNIN, true),
    featureRazorpayPayments: toBool(process.env.EXPO_PUBLIC_FEATURE_RAZORPAY_PAYMENTS, true),
    featureReferralSystem: toBool(process.env.EXPO_PUBLIC_FEATURE_REFERRAL_SYSTEM, true),
    featureJobScraping: toBool(process.env.EXPO_PUBLIC_FEATURE_JOB_SCRAPING, true),
    
    // Development Settings
    devMenu: env === 'development',
    debugLogs: env === 'development',
    logLevel: env === 'production' ? 'error' : 'debug',
  };

  // Debug: Log what's being passed through extra
  console.log(`?? Extra Config Being Passed:`);
  console.log(`  appEnv: ${extraConfig.appEnv}`);
  console.log(`  googleClientIdWeb: ${extraConfig.googleClientIdWeb ? 'SET' : 'NOT SET'}`);
  console.log(`  featureGoogleSignin: ${extraConfig.featureGoogleSignin}`);
  
  // CRITICAL: Log the actual values being embedded
  console.log(`?? ACTUAL VALUES (for debugging):`);
  console.log(`  googleClientIdWeb length: ${extraConfig.googleClientIdWeb?.length || 0}`);
  if (extraConfig.googleClientIdWeb) {
    console.log(`  googleClientIdWeb preview: ${extraConfig.googleClientIdWeb.substring(0, 30)}...`);
  }

  const finalConfig = {
    ...config,
    name: currentEnvConfig.name,
    slug: 'nexhire',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    scheme: currentEnvConfig.scheme,
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: currentEnvConfig.scheme
    },
    android: {
      package: currentEnvConfig.scheme,
      intentFilters: [
        {
          action: 'VIEW',
          data: [
            {
              scheme: 'https',
              host: 'nexhire.com'
            },
            {
              scheme: 'https',
              host: 'www.nexhire.com'
            }
          ],
          category: ['BROWSABLE', 'DEFAULT']
        }
      ]
    },
    web: {
      bundler: 'metro'
    },
    plugins: ['expo-router'],
    experiments: {
      typedRoutes: true
    },
    extra: extraConfig  // ? This should be available at runtime
  };

  console.log(`?? Final config.extra keys:`, Object.keys(finalConfig.extra));
  
  return finalConfig;
};