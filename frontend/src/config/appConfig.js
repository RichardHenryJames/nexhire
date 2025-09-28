/**
 * ?? Frontend Configuration Service
 * Centralized configuration management for NexHire frontend
 * FIXED: Robust fallback when Constants.expoConfig.extra is not available
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
    // DEBUGGING: Let's see what's available
    console.log('?? DEBUGGING Configuration Sources:');
    console.log('  Constants.expoConfig:', !!Constants.expoConfig);
    console.log('  Constants.expoConfig.extra:', !!Constants.expoConfig?.extra);
    console.log('  typeof Constants.expoConfig?.extra:', typeof Constants.expoConfig?.extra);
    console.log('  process.env keys:', Object.keys(process.env).filter(k => k.startsWith('EXPO_PUBLIC')));
    
    const extra = Constants.expoConfig?.extra;
    if (extra && typeof extra === 'object') {
      console.log('  extra keys:', Object.keys(extra));
      console.log('  extra.appEnv:', extra.appEnv);
      console.log('  extra.googleClientIdWeb length:', extra.googleClientIdWeb?.length || 0);
    } else {
      console.log('  ? extra is not available or not an object');
    }

    // ROBUST FALLBACK: If extra is not available, assume production and use hardcoded values
    const hasValidExtra = extra && typeof extra === 'object' && Object.keys(extra).length > 0;
    const shouldForceProd = !hasValidExtra && typeof window !== 'undefined'; // Browser environment
    
    if (shouldForceProd) {
      console.log('?? FALLBACK: Constants.expoConfig.extra not available, forcing production configuration');
    }

    const getEnvVar = (extraKey, processEnvKey, defaultValue = '', prodFallback = '') => {
      if (shouldForceProd) return prodFallback || defaultValue;
      
      const extraValue = extra?.[extraKey];
      const processValue = process.env[processEnvKey];
      
      console.log(`  getEnvVar(${extraKey}): extra=${extraValue || 'null'}, process=${processValue || 'null'}`);
      
      return extraValue || processValue || defaultValue;
    };

    const getBooleanEnvVar = (extraKey, processEnvKey, defaultValue = false, prodFallback = true) => {
      if (shouldForceProd) return prodFallback;
      
      const value = extra?.[extraKey] ?? process.env[processEnvKey];
      console.log(`  getBooleanEnvVar(${extraKey}): value=${value}, defaultValue=${defaultValue}`);
      
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
        baseUrl: getEnvVar('apiUrl', 'EXPO_PUBLIC_API_URL', 'https://nexhire-api-func.azurewebsites.net/api'),
        timeout: parseInt(getEnvVar('apiTimeout', 'EXPO_PUBLIC_API_TIMEOUT', '30000')),
        debug: shouldForceProd ? false : getBooleanEnvVar('apiDebug', 'EXPO_PUBLIC_API_DEBUG', true, false),
      },

      google: {
        // PRODUCTION FALLBACK VALUES - When extra config is not available
        webClientId: shouldForceProd 
          ? '179542785325-ava51t8ercmv4vg6aef1ftn9rqef6pis.apps.googleusercontent.com'
          : getEnvVar('googleClientIdWeb', 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB', '', '179542785325-ava51t8ercmv4vg6aef1ftn9rqef6pis.apps.googleusercontent.com'),
        androidClientId: shouldForceProd
          ? '179542785325-ava51t8ercmv4vg6aef1ftn9rqef6pis.apps.googleusercontent.com'
          : getEnvVar('googleClientIdAndroid', 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID', '', '179542785325-ava51t8ercmv4vg6aef1ftn9rqef6pis.apps.googleusercontent.com'),
        iosClientId: shouldForceProd
          ? '179542785325-c1mhgrhu0mhmjj896h6c7ateuucmp2nc.apps.googleusercontent.com'
          : getEnvVar('googleClientIdIos', 'EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS', '', '179542785325-c1mhgrhu0mhmjj896h6c7ateuucmp2nc.apps.googleusercontent.com'),
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
        isProduction: shouldForceProd ? true : getEnvVar('razorpayKeyId', 'EXPO_PUBLIC_RAZORPAY_KEY_ID', 'rzp_test_RHBUKjg4k9qx4J').startsWith('rzp_live_'),
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

    console.log('?? Final Configuration:', {
      environment: config.app.env,
      googleClientIdSet: !!config.google.webClientId,
      shouldForceProd,
      hasValidExtra
    });

    return config;
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