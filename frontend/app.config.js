import 'dotenv/config';

export default ({ config }) => {
  // Determine environment
  const env = process.env.EXPO_PUBLIC_APP_ENV || 'development';

  // Environment-specific app metadata
  const environmentConfig = {
    development: {
      name: 'RefOpen (Dev)',
      scheme: 'com.refopen.app.dev',
    },
    staging: {
      name: 'RefOpen (Staging)',
      scheme: 'com.refopen.app.staging',
    },
    production: {
      name: 'RefOpen',
      scheme: 'com.refopen.app',
    }
  };

  const currentEnvConfig = environmentConfig[env] || environmentConfig.development;

  // Helper: safe boolean conversion
  const toBool = (value, defaultValue = false) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return ['true', '1', 'yes'].includes(lower);
    }
    return defaultValue;
  };

  // Extra runtime config for app
  const extraConfig = {
    appEnv: env,
    appVersion: '1.0.0',
    debug: env !== 'production',

    // API
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://refopen-api-func.azurewebsites.net/api',
    apiTimeout: process.env.EXPO_PUBLIC_API_TIMEOUT || '30000',
    apiDebug: env !== 'production',

    // Google OAuth
    googleClientIdWeb: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '',
    googleClientIdAndroid: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '',
    googleClientIdIos: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '',

    // Firebase
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'refopen-123',
    firebaseWebAppId: process.env.EXPO_PUBLIC_FIREBASE_WEB_APP_ID || '',
    firebaseAndroidAppId: process.env.EXPO_PUBLIC_FIREBASE_ANDROID_APP_ID || '',
    firebaseIosAppId: process.env.EXPO_PUBLIC_FIREBASE_IOS_APP_ID || '',

    // Razorpay
    razorpayKeyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '',

    // Feature flags
    featureGoogleSignin: toBool(process.env.EXPO_PUBLIC_FEATURE_GOOGLE_SIGNIN, true),
    featureRazorpayPayments: toBool(process.env.EXPO_PUBLIC_FEATURE_RAZORPAY_PAYMENTS, true),
    featureReferralSystem: toBool(process.env.EXPO_PUBLIC_FEATURE_REFERRAL_SYSTEM, true),
    featureJobScraping: toBool(process.env.EXPO_PUBLIC_FEATURE_JOB_SCRAPING, true),

    // Dev settings
    devMenu: env === 'development',
    debugLogs: env === 'development',
    logLevel: env === 'production' ? 'error' : 'debug',
  };

  // Final Expo config
  return {
    ...config,
    name: currentEnvConfig.name,
    slug: 'refopen',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    scheme: currentEnvConfig.scheme,
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: currentEnvConfig.scheme,
    },
    android: {
      package: currentEnvConfig.scheme,
      intentFilters: [
        {
          action: 'VIEW',
          data: [
            { scheme: 'https', host: 'refopen.com' },
            { scheme: 'https', host: 'www.refopen.com' },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      bundler: 'metro',
    },
    plugins: ['expo-router'],
    experiments: {
      typedRoutes: true,
    },
    extra: extraConfig, // Exposed to app at runtime
  };
};
