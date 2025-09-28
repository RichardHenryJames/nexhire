import 'dotenv/config';

export default ({ config }) => {
  // Load environment variables from .env file
  const env = process.env.EXPO_PUBLIC_APP_ENV || 'development';
  
  console.log(`?? Expo Config: Loading configuration for ${env} environment`);
  
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

  return {
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
    extra: {
      // Explicitly pass environment variables to the app
      appEnv: process.env.EXPO_PUBLIC_APP_ENV || 'development',
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://nexhire-api-func.azurewebsites.net/api',
      googleClientIdWeb: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '',
      googleClientIdAndroid: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '',
      googleClientIdIos: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '',
      razorpayKeyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '',
      featureGoogleSignin: process.env.EXPO_PUBLIC_FEATURE_GOOGLE_SIGNIN === 'true',
    }
  };
};