/**
 * ?? Frontend Configuration Service
 * Centralized configuration management for NexHire frontend
 * PROPER SOLUTION: Uses Constants.expoConfig for reliable environment variables
 */

import Constants from 'expo-constants';

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
    // PROPER FIX: Use Constants.expoConfig.extra for reliable environment variables
    const extra = Constants.expoConfig?.extra || {};
    
    // Fallback to process.env for development
    const getEnvVar = (extraKey, processEnvKey, defaultValue = '') => {
      return extra[extraKey] || process.env[processEnvKey] || defaultValue;
    };

    const getBooleanEnvVar = (extraKey, processEnvKey, defaultValue = false) => {
      const value = extra[extraKey] ?? process.env[processEnvKey];
      if (value === undefined || value === null) return defaultValue;
      return value === true || value === 'true';
    };

    return {
      app: {
        env: getEnvVar('appEnv', 'EXPO_PUBLIC_APP_ENV', 'development'),
        version: getEnvVar('appVersion', 'EXPO_PUBLIC_APP_VERSION', '1.0.0'),
        debug: getBooleanEnvVar('debug', 'EXPO_PUBLIC_DEBUG', true),
      },

      api: {
        baseUrl: getEnvVar('apiUrl', 'EXPO_PUBLIC_API_URL', 'https://nexhire-api-func.azurewebsites.net/api'),
        timeout: parseInt(getEnvVar('apiTimeout', 'EXPO_PUBLIC_API_TIMEOUT', '30000')),
        debug: getBooleanEnvVar('apiDebug', 'EXPO_PUBLIC_API_DEBUG', true),
      },

      google: {
        webClientId: getEnvVar('googleClientIdWeb', 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB'),
        androidClientId: getEnvVar('googleClientIdAndroid', 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID'),
        iosClientId: getEnvVar('googleClientIdIos', 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS'),
        firebase: {
          projectId: getEnvVar('firebaseProjectId', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'nexhire-123'),
          webAppId: getEnvVar('firebaseWebAppId', 'EXPO_PUBLIC_FIREBASE_WEB_APP_ID'),
          androidAppId: getEnvVar('firebaseAndroidAppId', 'EXPO_PUBLIC_FIREBASE_ANDROID_APP_ID'),
          iosAppId: getEnvVar('firebaseIosAppId', 'EXPO_PUBLIC_FIREBASE_IOS_APP_ID'),
        },
      },

      razorpay: {
        keyId: getEnvVar('razorpayKeyId', 'EXPO_PUBLIC_RAZORPAY_KEY_ID', 'rzp_test_RHBUKjg4k9qx4J'),
        isProduction: getEnvVar('razorpayKeyId', 'EXPO_PUBLIC_RAZORPAY_KEY_ID', 'rzp_test_RHBUKjg4k9qx4J').startsWith('rzp_live_'),
      },

      features: {
        googleSignIn: getBooleanEnvVar('featureGoogleSignin', 'EXPO_PUBLIC_FEATURE_GOOGLE_SIGNIN', true),
        razorpayPayments: getBooleanEnvVar('featureRazorpayPayments', 'EXPO_PUBLIC_FEATURE_RAZORPAY_PAYMENTS', true),
        referralSystem: getBooleanEnvVar('featureReferralSystem', 'EXPO_PUBLIC_FEATURE_REFERRAL_SYSTEM', true),
        jobScraping: getBooleanEnvVar('featureJobScraping', 'EXPO_PUBLIC_FEATURE_JOB_SCRAPING', true),
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
        devMenu: getBooleanEnvVar('devMenu', 'EXPO_PUBLIC_DEV_MENU', true),
        debugLogs: getBooleanEnvVar('debugLogs', 'EXPO_PUBLIC_DEBUG_LOGS', true),
        logLevel: getEnvVar('logLevel', 'EXPO_PUBLIC_LOG_LEVEL', 'debug'),
      },
    };
  }

  validateConfiguration() {
    const warnings = [];
    const errors = [];

    // API validation
    if (!this.config.api.baseUrl) {
      errors.push('API base URL is required');
    }

    // Google OAuth validation
    if (this.config.features.googleSignIn) {
      if (!this.config.google.webClientId) {
        warnings.push('Google OAuth Web Client ID not configured - Google Sign-In will be disabled');
      }
      if (!this.config.google.androidClientId) {
        warnings.push('Google OAuth Android Client ID not configured');
      }
      if (!this.config.google.iosClientId) {
        warnings.push('Google OAuth iOS Client ID not configured');
      }
    }

    // Razorpay validation
    if (this.config.features.razorpayPayments) {
      if (!this.config.razorpay.keyId) {
        warnings.push('Razorpay Key ID not configured - Payments will be disabled');
      }
    }

    // Log warnings
    warnings.forEach(warning => {
      console.warn(`?? ${warning}`);
    });

    // Throw errors
    if (errors.length > 0) {
      throw new Error(`Frontend configuration validation failed:\n${errors.join('\n')}`);
    }

    console.log(`? Frontend configuration loaded for ${this.config.app.env} environment`);
    
    // Debug: Log configuration sources
    if (this.config.development.debugLogs) {
      console.log('?? Config sources:', {
        expoConfigExtra: !!Constants.expoConfig?.extra,
        processEnv: !!process.env.EXPO_PUBLIC_APP_ENV,
        googleWebClientId: !!this.config.google.webClientId,
        environment: this.config.app.env
      });
    }
  }

  // Public getters
  get app() { return this.config.app; }
  get api() { return this.config.api; }
  get google() { return this.config.google; }
  get razorpay() { return this.config.razorpay; }
  get features() { return this.config.features; }
  get analytics() { return this.config.analytics; }
  get external() { return this.config.external; }
  get development() { return this.config.development; }

  // Helper methods
  isDevelopment() {
    return this.config.app.env === 'development';
  }

  isProduction() {
    return this.config.app.env === 'production';
  }

  isFeatureEnabled(feature) {
    return this.config.features[feature];
  }

  shouldLog(level) {
    if (!this.config.development.debugLogs) return false;
    
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.development.logLevel);
    const messageLevel = levels.indexOf(level);
    
    return messageLevel >= configLevel;
  }

  // Service-specific configuration
  getGoogleOAuthConfig(platform) {
    if (!this.isFeatureEnabled('googleSignIn')) {
      throw new Error('Google Sign-In feature is disabled');
    }

    const clientIds = {
      web: this.config.google.webClientId,
      android: this.config.google.androidClientId,
      ios: this.config.google.iosClientId,
    };

    const clientId = clientIds[platform];
    if (!clientId) {
      throw new Error(`Google OAuth client ID not configured for ${platform}`);
    }

    return { clientId };
  }

  getRazorpayConfig() {
    if (!this.isFeatureEnabled('razorpayPayments')) {
      throw new Error('Razorpay payments feature is disabled');
    }

    return {
      key: this.config.razorpay.keyId,
      isProduction: this.config.razorpay.isProduction,
    };
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

  // Configuration summary for debugging
  getConfigSummary() {
    return {
      environment: this.config.app.env,
      version: this.config.app.version,
      features: this.config.features,
      api: {
        baseUrl: this.config.api.baseUrl,
        timeout: this.config.api.timeout,
      },
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

  // Debug helper
  logConfig() {
    if (this.shouldLog('debug')) {
      console.log('?? Frontend Configuration:', this.getConfigSummary());
    }
  }
}

// Initialize static property
FrontendConfigService.instance = null;

// Export singleton instance
export const frontendConfig = FrontendConfigService.getInstance();
export default frontendConfig;