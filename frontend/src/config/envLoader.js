/**
 * Environment Loader for Frontend
 * Automatically loads the correct environment configuration at runtime
 */

class EnvironmentLoader {
  constructor() {
    this.currentEnv = this.determineEnvironment();
    this.loadEnvironment();
  }

  determineEnvironment() {
    // Priority order for environment determination:
    // 1. Explicit NODE_ENV or EXPO_ENV
    // 2. Build command detection  
    // 3. URL detection (for web)
    // 4. Default to development

    const nodeEnv = process.env.NODE_ENV;
    const expoEnv = process.env.EXPO_ENV;
    
    // Explicit environment variable
    if (expoEnv) return expoEnv;
    if (nodeEnv && nodeEnv !== 'development') return nodeEnv;

    // URL-based detection for web
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      if (hostname.includes('refopen.com') || hostname.includes('refopen.app')) {
        return 'production';
      }
      
      if (hostname.includes('staging') || hostname.includes('test')) {
        return 'staging';
      }
      
      if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        return 'development';
      }
    }

    // Command detection (for build scripts)
    const argv = process.argv.join(' ');
    if (argv.includes('--env production') || argv.includes('--prod')) {
      return 'production';
    }
    if (argv.includes('--env staging') || argv.includes('--staging')) {
      return 'staging';
    }

    // Default
    return 'development';
  }

  loadEnvironment() {
    console.log(`Loading ${this.currentEnv} environment configuration`);
    
    // This is conceptual - in practice, you'd copy the right .env file
    // or use a build process to select the environment
    
    const configs = {
      development: {
        EXPO_PUBLIC_APP_ENV: 'development',
        EXPO_PUBLIC_API_URL: 'http://localhost:7071/api',
        EXPO_PUBLIC_DEBUG: 'true',
        EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB: '179542785325-ava51t8ercmv4vg6aef1ftn9rqef6pis.apps.googleusercontent.com',
        EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID: '179542785325-ava51t8ercmv4vg6aef1ftn9rqef6pis.apps.googleusercontent.com',
        EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS: '179542785325-c1mhgrhu0mhmjj896h6c7ateuucmp2nc.apps.googleusercontent.com',
        EXPO_PUBLIC_RAZORPAY_KEY_ID: 'rzp_test_RHBUKjg4k9qx4J',
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'refopen-123',
      },
      
      staging: {
        EXPO_PUBLIC_APP_ENV: 'staging',
        EXPO_PUBLIC_API_URL: 'https://refopen-api-staging.azurewebsites.net/api',
        EXPO_PUBLIC_DEBUG: 'true',
        EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB: '179542785325-ava51t8ercmv4vg6aef1ftn9rqef6pis.apps.googleusercontent.com',
        EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID: '179542785325-ava51t8ercmv4vg6aef1ftn9rqef6pis.apps.googleusercontent.com',
        EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS: '179542785325-c1mhgrhu0mhmjj896h6c7ateuucmp2nc.apps.googleusercontent.com',
        EXPO_PUBLIC_RAZORPAY_KEY_ID: 'rzp_test_RHBUKjg4k9qx4J',
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'refopen-123',
      },
      
      production: {
        EXPO_PUBLIC_APP_ENV: 'production',
        EXPO_PUBLIC_API_URL: 'https://refopen-api-func.azurewebsites.net/api',
        EXPO_PUBLIC_DEBUG: 'false',
        EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB: '179542785325-ava51t8ercmv4vg6aef1ftn9rqef6pis.apps.googleusercontent.com',
        EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID: '179542785325-ava51t8ercmv4vg6aef1ftn9rqef6pis.apps.googleusercontent.com',
        EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS: '179542785325-c1mhgrhu0mhmjj896h6c7ateuucmp2nc.apps.googleusercontent.com',
        EXPO_PUBLIC_RAZORPAY_KEY_ID: 'rzp_live_RHBIO2dq7CFGiW',
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'refopen-123',
      }
    };

    this.config = configs[this.currentEnv] || configs.development;
    this.validateConfig();
  }

  validateConfig() {
    const requiredKeys = [
      'EXPO_PUBLIC_API_URL',
      'EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB',
      'EXPO_PUBLIC_RAZORPAY_KEY_ID'
    ];

    const missing = requiredKeys.filter(key => !this.config[key]);
    
    if (missing.length > 0) {
      console.error(`? Missing required config keys: ${missing.join(', ')}`);
    } else {
      console.log(`? Environment configuration validated for ${this.currentEnv}`);
    }
  }

  get(key) {
    // First try to get from actual process.env (from .env files)
    if (process.env[key]) {
      return process.env[key];
    }
    
    // Fallback to our runtime config
    return this.config[key];
  }

  getEnvironment() {
    return this.currentEnv;
  }

  isDevelopment() {
    return this.currentEnv === 'development';
  }

  isStaging() {
    return this.currentEnv === 'staging';
  }

  isProduction() {
    return this.currentEnv === 'production';
  }

  // Get all config for debugging
  getAll() {
    return {
      environment: this.currentEnv,
      config: this.config,
      processEnv: {
        NODE_ENV: process.env.NODE_ENV,
        EXPO_ENV: process.env.EXPO_ENV,
        EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
      }
    };
  }
}

// Export singleton instance
export const envLoader = new EnvironmentLoader();
export default envLoader;