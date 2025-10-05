/**
 * ?? Environment Loader for Backend
 * Automatically loads the correct environment configuration at runtime
 */

import * as fs from 'fs';
import * as path from 'path';

class BackendEnvironmentLoader {
  private currentEnv: string;
  private configLoaded: boolean = false;

  constructor() {
    this.currentEnv = this.determineEnvironment();
    this.loadEnvironment();
  }

  private determineEnvironment(): string {
    // Priority order:
    // 1. NODE_ENV environment variable
    // 2. NEXHIRE_ENV environment variable  
    // 3. Command line arguments
    // 4. Azure Functions environment detection
    // 5. Default to development

    if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
      return process.env.NODE_ENV;
    }

    if (process.env.NEXHIRE_ENV) {
      return process.env.NEXHIRE_ENV;
    }

    // Azure Functions detection
    if (process.env.AZURE_FUNCTIONS_ENVIRONMENT) {
      return 'production';
    }

    if (process.env.WEBSITE_SITE_NAME) {
      // Azure App Service detection
      const siteName = process.env.WEBSITE_SITE_NAME.toLowerCase();
      if (siteName.includes('staging') || siteName.includes('test')) {
        return 'staging';
      }
      return 'production';
    }

    // Command line detection
    const args = process.argv.join(' ');
    if (args.includes('--env=production') || args.includes('--prod')) {
      return 'production';
    }
    if (args.includes('--env=staging') || args.includes('--staging')) {
      return 'staging';
    }

    return 'development';
  }

  private loadEnvironment(): void {
    console.log(`Backend loading ${this.currentEnv} environment configuration`);

    const envFile = `.env.${this.currentEnv}`;
    const envPath = path.resolve(process.cwd(), envFile);

    try {
      if (fs.existsSync(envPath)) {
        // Load the environment-specific file
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envVars = this.parseEnvFile(envContent);
        
        // Set environment variables (only if not already set)
        Object.entries(envVars).forEach(([key, value]) => {
          if (!process.env[key]) {
            process.env[key] = value;
          }
        });

        console.log(`Loaded environment configuration from ${envFile}`);
        this.configLoaded = true;
      } else {
        console.warn(`Environment file ${envFile} not found, using process.env defaults`);
      }
    } catch (error) {
      console.error(`Error loading environment file ${envFile}:`, error);
    }

    this.validateConfiguration();
  }

  private parseEnvFile(content: string): Record<string, string> {
    const envVars: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse KEY=VALUE format
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();
        
        // Remove quotes if present
        const cleanValue = value.replace(/^['"]|['"]$/g, '');
        envVars[key] = cleanValue;
      }
    }

    return envVars;
  }

  private validateConfiguration(): void {
    const requiredVars = [
      'DB_SERVER',
      'DB_NAME', 
      'DB_USER',
      'DB_PASSWORD',
      'JWT_SECRET'
    ];

    const missing = requiredVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error(`Missing required environment variables: ${missing.join(', ')}`);
      if (this.isProduction()) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      }
    } else {
      console.log(`Backend environment configuration validated for ${this.currentEnv}`);
    }

    // Warn about placeholder values in production
    if (this.isProduction()) {
      const placeholderKeys = Object.keys(process.env).filter(key => {
        const value = process.env[key] || '';
        return value.includes('YOUR_') || value.includes('CHANGE_THIS') || value.includes('_HERE');
      });

      if (placeholderKeys.length > 0) {
        console.error(`Production environment has placeholder values: ${placeholderKeys.join(', ')}`);
      }
    }
  }

  public getEnvironment(): string {
    return this.currentEnv;
  }

  public isDevelopment(): boolean {
    return this.currentEnv === 'development';
  }

  public isStaging(): boolean {
    return this.currentEnv === 'staging';
  }

  public isProduction(): boolean {
    return this.currentEnv === 'production';
  }

  public isConfigLoaded(): boolean {
    return this.configLoaded;
  }

  // Get configuration summary for debugging
  public getConfigSummary() {
    return {
      environment: this.currentEnv,
      configLoaded: this.configLoaded,
      hasDatabase: !!(process.env.DB_SERVER && process.env.DB_NAME),
      hasJWT: !!process.env.JWT_SECRET,
      hasRazorpay: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      hasGoogleOAuth: !!process.env.GOOGLE_CLIENT_ID_WEB,
      hasAzureStorage: !!process.env.AZURE_STORAGE_CONNECTION_STRING,
      azureFunctions: !!process.env.AZURE_FUNCTIONS_ENVIRONMENT,
      websiteName: process.env.WEBSITE_SITE_NAME,
    };
  }
}

// Export singleton instance
export const backendEnvLoader = new BackendEnvironmentLoader();
export default backendEnvLoader;