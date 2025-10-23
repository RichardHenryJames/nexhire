/**
 * Frontend Configuration Service
 * Centralized configuration management for NexHire frontend
 * Provides robust fallback when Constants.expoConfig.extra is not available
 */

import Constants from 'expo-constants';

const ENABLE_CONFIG_LOGS = process.env.SHOW_CONFIG_LOGS === 'true';

class FrontendConfigService {
  constructor() {
    if (FrontendConfigService.instance) {
      return FrontendConfigService.instance;
    }

    this.config = this.loadConfiguration();
    this.validateConfiguration();

    FrontendConfigService.instance = this;
  }

  static getInstance() {
    if (!FrontendConfigService.instance) {
      FrontendConfigService.instance = new FrontendConfigService();
    }
    return FrontendConfigService.instance;
  }

  loadConfiguration() {
    const extra = Constants.expoConfig?.extra;
    const hasValidExtra = extra && typeof extra === 'object' && Object.keys(extra).length > 0;
    const shouldForceProd = !hasValidExtra && typeof window !== 'undefined';

    const getEnvVar = (extraKey, processEnvKey, defaultValue = '', prodFallback = '') => {
      if (shouldForceProd) return prodFallback || defaultValue;
      return extra?.[extraKey] || process.env[processEnvKey] || defaultValue;
    };

    const getBooleanEnvVar = (extraKey, processEnvKey, defaultValue = false, prodFallback = true) => {
      if (shouldForceProd) return prodFallback;
      const value = extra?.[extraKey] ?? process.env[processEnvKey];
      if (value === undefined || value === null) return defaultValue;
      return value === true || value === 'true';
    };

    const config = {
      app: {
        env: shouldForceProd ? 'production' : getEnvVar('appEnv', 'EXPO_PUBLIC_APP_ENV', 'development'),
        version: getEnvVar('appVersion', 'EXPO_PUBLIC_APP_VERSION', '1.0.0'),
        debug: shouldForceProd ? false : getBooleanEnvVar('debug', 'EXPO_PUBLIC_DEBUG', true, false),
      },

      api: {
        baseUrl: getEnvVar('apiUrl', 'EXPO_PUBLIC_API_URL', 'https://refopen-api-func.azurewebsites.net/api'),
        timeout: parseInt(getEnvVar('apiTimeout', 'EXPO_PUBLIC_API_TIMEOUT', '30000')),
        debug: shouldForceProd ? false : getBooleanEnvVar('apiDebug', 'EXPO_PUBLIC_API_DEBUG', true, false),
      },

      google: {
        webClientId: shouldForceProd
          ? '179542785325-ava51t8ercmv4vg6aef1ftn9rqef6pis.apps.googleusercontent.com'
          : getEnvVar('googleClientIdWeb', 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB'),
        androidClientId: shouldForceProd
          ? '179542785325-ava51t8ercmv4vg6aef1ftn9rqef6pis.apps.googleusercontent.com'
          : getEnvVar('googleClientIdAndroid', 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID'),
        iosClientId: shouldForceProd
          ? '179542785325-c1mhgrhu0mhmjj896h6c7ateuucmp2nc.apps.googleusercontent.com'
          : getEnvVar('googleClientIdIos', 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS'),
        firebase: {
          projectId: getEnvVar('firebaseProjectId', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'nexhire-123'),
          webAppId: getEnvVar('firebaseWebAppId', 'EXPO_PUBLIC_FIREBASE_WEB_APP_ID'),
          androidAppId: getEnvVar('firebaseAndroidAppId', 'EXPO_PUBLIC_FIREBASE_ANDROID_APP_ID'),
          iosAppId: getEnvVar('firebaseIosAppId', 'EXPO_PUBLIC_FIREBASE_IOS_APP_ID'),
        },
      },

      razorpay: {
        keyId: shouldForceProd
          ? 'rzp_live_RHBIO2dq7CFGiW'
          : getEnvVar('razorpayKeyId', 'EXPO_PUBLIC_RAZORPAY_KEY_ID', 'rzp_test_RHBUKjg4k9qx4J', 'rzp_live_RHBIO2dq7CFGiW'),
        isProduction: shouldForceProd
          ? true
          : getEnvVar('razorpayKeyId', 'EXPO_PUBLIC_RAZORPAY_KEY_ID', 'rzp_test_RHBUKjg4k9qx4J').startsWith('rzp_live_'),
      },

      features: {
        googleSignIn: shouldForceProd ? true : getBooleanEnvVar('featureGoogleSignin', 'EXPO_PUBLIC_FEATURE_GOOGLE_SIGNIN', true),
        razorpayPayments: shouldForceProd ? true : getBooleanEnvVar('featureRazorpayPayments', 'EXPO_PUBLIC_FEATURE_RAZORPAY_PAYMENTS', true),
        referralSystem: shouldForceProd ? true : getBooleanEnvVar('featureReferralSystem', 'EXPO_PUBLIC_FEATURE_REFERRAL_SYSTEM', true),
        jobScraping: shouldForceProd ? true : getBooleanEnvVar('featureJobScraping', 'EXPO_PUBLIC_FEATURE_JOB_SCRAPING', true),
      },

      analytics: {
        googleAnalyticsId: getEnvVar('gaId', 'EXPO_PUBLIC_GA_MEASUREMENT_ID'),
        sentryDsn: getEnvVar('sentryDsn', 'EXPO_PUBLIC_SENTRY_DSN'),
      },

      external: {
        linkedinClientId: getEnvVar('linkedinClientId', 'EXPO_PUBLIC_LINKEDIN_CLIENT_ID'),
        githubClientId: getEnvVar('githubClientId', 'EXPO_PUBLIC_GITHUB_CLIENT_ID'),
      },

      development: {
        devMenu: shouldForceProd ? false : getBooleanEnvVar('devMenu', 'EXPO_PUBLIC_DEV_MENU', true, false),
        debugLogs: shouldForceProd ? false : getBooleanEnvVar('debugLogs', 'EXPO_PUBLIC_DEBUG_LOGS', true, false),
        logLevel: shouldForceProd ? 'error' : getEnvVar('logLevel', 'EXPO_PUBLIC_LOG_LEVEL', 'debug', 'error'),
      },
    };

    if (ENABLE_CONFIG_LOGS) {
      console.log('FrontendConfig Debug:', { config, shouldForceProd, hasValidExtra });
    }

    return config;
  }

  validateConfiguration() {
    const warnings = [];
    const errors = [];

    if (!this.config.api.baseUrl) {
      errors.push('API base URL is required');
    }

    if (this.config.features.googleSignIn) {
      if (!this.config.google.webClientId) warnings.push('Google OAuth Web Client ID not configured');
      if (!this.config.google.androidClientId) warnings.push('Google OAuth Android Client ID not configured');
      if (!this.config.google.iosClientId) warnings.push('Google OAuth iOS Client ID not configured');
    }

    if (this.config.features.razorpayPayments && !this.config.razorpay.keyId) {
      warnings.push('Razorpay Key ID not configured - Payments will be disabled');
    }

    warnings.forEach(warning => console.warn(`⚠️ ${warning}`));

    if (errors.length > 0) {
      throw new Error(`Frontend configuration validation failed:\n${errors.join('\n')}`);
    }

    console.log(`✅ Frontend configuration loaded for ${this.config.app.env} environment`);
  }

  // --- Getters ---
  get app() { return this.config.app; }
  get api() { return this.config.api; }
  get google() { return this.config.google; }
  get razorpay() { return this.config.razorpay; }
  get features() { return this.config.features; }
  get analytics() { return this.config.analytics; }
  get external() { return this.config.external; }
  get development() { return this.config.development; }

  // Helpers
  isDevelopment() { return this.config.app.env === 'development'; }
  isProduction() { return this.config.app.env === 'production'; }
  isFeatureEnabled(feature) { return this.config.features[feature]; }

  shouldLog(level) {
    if (!this.config.development.debugLogs) return false;
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.config.development.logLevel);
  }

  // Config summaries
  getGoogleOAuthConfig(platform) {
    if (!this.isFeatureEnabled('googleSignIn')) {
      throw new Error('Google Sign-In feature is disabled');
    }
    const clientIds = {
      web: this.config.google.webClientId,
      android: this.config.google.androidClientId,
      ios: this.config.google.iosClientId,
    };
    if (!clientIds[platform]) {
      throw new Error(`Google OAuth client ID not configured for ${platform}`);
    }
    return { clientId: clientIds[platform] };
  }

  getRazorpayConfig() {
    if (!this.isFeatureEnabled('razorpayPayments')) {
      throw new Error('Razorpay payments feature is disabled');
    }
    return { key: this.config.razorpay.keyId, isProduction: this.config.razorpay.isProduction };
  }

  getApiConfig() {
    return {
      baseURL: this.config.api.baseUrl,
      timeout: this.config.api.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-App-Version': this.config.app.version,
        'X-App-Environment': this.config.app.env,
      },
    };
  }

  getConfigSummary() {
    return {
      environment: this.config.app.env,
      version: this.config.app.version,
      features: this.config.features,
      api: { baseUrl: this.config.api.baseUrl, timeout: this.config.api.timeout },
      services: {
        googleOAuth: {
          web: !!this.config.google.webClientId,
          android: !!this.config.google.androidClientId,
          ios: !!this.config.google.iosClientId,
        },
        razorpay: !!this.config.razorpay.keyId,
        analytics: !!this.config.analytics.googleAnalyticsId,
      },
    };
  }

  logConfig() {
    if (this.shouldLog('debug')) {
      console.log('Frontend Configuration:', this.getConfigSummary());
    }
  }
}

// Singleton instance
FrontendConfigService.instance = null;
export const frontendConfig = FrontendConfigService.getInstance();
export default frontendConfig;
