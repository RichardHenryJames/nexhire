/**
 * ?? Unified Configuration Service
 * Centralized configuration management for all RefOpen services
 */

interface AppConfig {
  // Application
  app: {
    env: string;
    version: string;
    debug: boolean;
  };

  // Database
  database: {
    server: string;
    name: string;
    user: string;
    password: string;
    connectionString: string;
    encrypt: boolean;
    trustServerCertificate: boolean;
    connectionTimeout: number;
  };

  // Authentication & Security
  auth: {
    jwtSecret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    bcryptSaltRounds: number;
  };

  // Google OAuth
  google: {
    webClientId: string;
    androidClientId: string;
    iosClientId: string;
    firebase: {
      projectId: string;
      webAppId: string;
      androidAppId: string;
      iosAppId: string;
    };
  };

  // Razorpay Payments
  razorpay: {
    keyId: string;
    keySecret: string;
    webhookSecret: string;
    isProduction: boolean;
  };

  // Azure Services
  azure: {
    storage: {
      accountName: string;
      accountKey: string;
      connectionString: string;
      containers: {
        resumes: string;
        profileImages: string;
        documents: string;
      };
    };
    appInsights: {
      instrumentationKey: string;
    };
  };

  // External Services
  external: {
    sendgrid: {
      apiKey: string;
      fromEmail: string;
      fromName: string;
    };
    linkedin: {
      clientId: string;
      clientSecret: string;
    };
    github: {
      clientId: string;
      clientSecret: string;
    };
  };

  // Feature Flags
  features: {
    referralSystem: boolean;
    googleSignIn: boolean;
    paymentSystem: boolean;
    jobScraping: boolean;
  };

  // API Settings
  api: {
    corsAllowedOrigins: string[];
    rateLimitMaxRequests: number;
    rateLimitWindowMs: number;
  };
}

class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadConfiguration(): AppConfig {
    return {
      app: {
        env: process.env.RefOpen_ENV || 'development',
        version: process.env.RefOpen_VERSION || '1.0.0',
        debug: process.env.RefOpen_DEBUG === 'true',
      },

      database: {
        server: process.env.DB_SERVER || 'refopen-sql-srv.database.windows.net',
        name: process.env.DB_NAME || 'refopen-sql-db',
        user: process.env.DB_USER || 'sqladmin',
        password: process.env.DB_PASSWORD || 'P@ssw0rd1234!',
        connectionString: process.env.DB_CONNECTION_STRING || this.buildConnectionString(),
        encrypt: process.env.DB_ENCRYPT !== 'false',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30'),
      },

      auth: {
        jwtSecret: process.env.JWT_SECRET || 'your-super-secret-development-key',
        accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
        refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
        bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12'),
      },

      google: {
        webClientId: process.env.GOOGLE_CLIENT_ID_WEB || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '',
        androidClientId: process.env.GOOGLE_CLIENT_ID_ANDROID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '',
        iosClientId: process.env.GOOGLE_CLIENT_ID_IOS || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '',
        firebase: {
          projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'refopen-123',
          webAppId: process.env.EXPO_PUBLIC_FIREBASE_WEB_APP_ID || '',
          androidAppId: process.env.EXPO_PUBLIC_FIREBASE_ANDROID_APP_ID || '',
          iosAppId: process.env.EXPO_PUBLIC_FIREBASE_IOS_APP_ID || '',
        },
      },

      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_RHBUKjg4k9qx4J',
        keySecret: process.env.RAZORPAY_KEY_SECRET || 'IGx3G02rEoPHqS32Jk70DfGW',
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
        isProduction: process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live_') || false,
      },

      azure: {
        storage: {
          accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || 'refopenstorage',
          accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY || '',
          connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
          containers: {
            resumes: process.env.AZURE_STORAGE_CONTAINER_RESUMES || 'resumes',
            profileImages: process.env.AZURE_STORAGE_CONTAINER_PROFILE_IMAGES || 'profile-images',
            documents: process.env.AZURE_STORAGE_CONTAINER_DOCUMENTS || 'documents',
          },
        },
        appInsights: {
          instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY || '',
        },
      },

      external: {
        sendgrid: {
          apiKey: process.env.SENDGRID_API_KEY || '',
          fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@refopen.com',
          fromName: process.env.SENDGRID_FROM_NAME || 'RefOpen',
        },
        linkedin: {
          clientId: process.env.LINKEDIN_CLIENT_ID || '',
          clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
        },
        github: {
          clientId: process.env.GITHUB_CLIENT_ID || '',
          clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        },
      },

      features: {
        referralSystem: process.env.FEATURE_FLAG_REFERRAL_SYSTEM !== 'false',
        googleSignIn: process.env.FEATURE_FLAG_GOOGLE_SIGNIN !== 'false',
        paymentSystem: process.env.FEATURE_FLAG_PAYMENT_SYSTEM !== 'false',
        jobScraping: process.env.FEATURE_FLAG_JOB_SCRAPING !== 'false',
      },

      api: {
        corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:19006').split(','),
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
      },
    };
  }

  private buildConnectionString(): string {
    const { server, name, user, password, encrypt, trustServerCertificate, connectionTimeout } = this.config?.database || {};
    return `Server=${server};Database=${name};User ID=${user};Password=${password};Encrypt=${encrypt};TrustServerCertificate=${trustServerCertificate};Connection Timeout=${connectionTimeout};`;
  }

  private validateConfiguration(): void {
    const errors: string[] = [];

    // Required configurations
    if (!this.config.auth.jwtSecret || this.config.auth.jwtSecret === 'your-super-secret-development-key') {
      if (this.config.app.env === 'production') {
        errors.push('JWT_SECRET must be set for production');
      }
    }

    if (!this.config.database.password) {
      errors.push('Database password is required');
    }

    // Google OAuth validation
    if (this.config.features.googleSignIn) {
      if (!this.config.google.webClientId) {
        console.warn('Google OAuth Web Client ID not configured - Google Sign-In will be disabled');
      }
    }

    // Razorpay validation
    if (this.config.features.paymentSystem) {
      if (!this.config.razorpay.keyId || !this.config.razorpay.keySecret) {
        console.warn('Razorpay credentials not configured - Payment system will be disabled');
      }
    }

    // Azure Storage validation
    if (!this.config.azure.storage.accountKey && !this.config.azure.storage.connectionString) {
      console.warn('Azure Storage not configured - File uploads will be disabled');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    console.log(`Configuration loaded for ${this.config.app.env} environment`);
  }

  // Public getters for different service configurations
  public get app() { return this.config.app; }
  public get database() { return this.config.database; }
  public get auth() { return this.config.auth; }
  public get google() { return this.config.google; }
  public get razorpay() { return this.config.razorpay; }
  public get azure() { return this.config.azure; }
  public get external() { return this.config.external; }
  public get features() { return this.config.features; }
  public get api() { return this.config.api; }

  // Helper methods
  public isDevelopment(): boolean {
    return this.config.app.env === 'development';
  }

  public isProduction(): boolean {
    return this.config.app.env === 'production';
  }

  public isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
    return this.config.features[feature];
  }

  // Get configuration for specific services
  public getDatabaseConnectionString(): string {
    return this.config.database.connectionString;
  }

  public getRazorpayConfig() {
    if (!this.isFeatureEnabled('paymentSystem')) {
      throw new Error('Payment system is disabled');
    }
    return {
      key_id: this.config.razorpay.keyId,
      key_secret: this.config.razorpay.keySecret,
    };
  }

  public getGoogleOAuthClientId(platform: 'web' | 'android' | 'ios'): string {
    if (!this.isFeatureEnabled('googleSignIn')) {
      throw new Error('Google Sign-In is disabled');
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

    return clientId;
  }

  public getAzureStorageConfig() {
    return {
      connectionString: this.config.azure.storage.connectionString,
      accountName: this.config.azure.storage.accountName,
      containers: this.config.azure.storage.containers,
    };
  }

  // Configuration summary for debugging
  public getConfigSummary() {
    return {
      environment: this.config.app.env,
      version: this.config.app.version,
      features: this.config.features,
      database: {
        server: this.config.database.server,
        name: this.config.database.name,
      },
      services: {
        googleOAuth: !!this.config.google.webClientId,
        razorpay: !!this.config.razorpay.keyId,
        azureStorage: !!this.config.azure.storage.connectionString,
        sendgrid: !!this.config.external.sendgrid.apiKey,
      },
    };
  }
}

// Export singleton instance
export const config = ConfigService.getInstance();

// Export types for use in other files
export type { AppConfig };
export default config;