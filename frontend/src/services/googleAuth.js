import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { frontendConfig } from '../config/appConfig';

// Complete web browser auth session
WebBrowser.maybeCompleteAuthSession();

class GoogleAuthService {
  constructor() {
    this.discovery = {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    };
    
    // Log configuration status on initialization
    if (frontendConfig.shouldLog('debug')) {
      console.log('?? Google Auth Service initialized');
      this.logConfigStatus();
    }
  }

  getClientId() {
    try {
      const platform = this.getCurrentPlatform();
      const config = frontendConfig.getGoogleOAuthConfig(platform);
      return config.clientId;
    } catch (error) {
      console.warn('?? Google OAuth configuration error:', error.message);
      return null;
    }
  }

  getCurrentPlatform() {
    if (Platform.OS === 'web') return 'web';
    if (Platform.OS === 'android') return 'android';
    if (Platform.OS === 'ios') return 'ios';
    return 'web'; // fallback
  }

  // Check if Google OAuth is properly configured
  isConfigured() {
    const clientId = this.getClientId();
    return clientId && !clientId.includes('YOUR_') && !clientId.includes('_HERE');
  }

  logConfigStatus() {
    const summary = {
      platform: this.getCurrentPlatform(),
      configured: this.isConfigured(),
      clientId: this.getClientId()?.substring(0, 20) + '...',
      featureEnabled: frontendConfig.isFeatureEnabled('googleSignIn'),
    };
    console.log('?? Google OAuth Status:', summary);
  }

  async signIn() {
    try {
      console.log('?? Starting Google Sign-In flow...');
      console.log('?? Platform:', this.getCurrentPlatform());
      
      // Check if feature is enabled
      if (!frontendConfig.isFeatureEnabled('googleSignIn')) {
        console.warn('?? Google Sign-In feature is disabled');
        return {
          success: false,
          error: 'Google Sign-In feature is disabled in configuration',
          featureDisabled: true
        };
      }
      
      // Check if Google OAuth is configured
      if (!this.isConfigured()) {
        console.warn('?? Google OAuth not configured - using demo mode');
        return {
          success: false,
          error: 'Google Sign-In not configured yet. Please set up OAuth credentials.',
          needsConfig: true
        };
      }

      const clientId = this.getClientId();
      console.log('?? Using client ID configuration for:', this.getCurrentPlatform());

      // Create auth request
      const request = new AuthSession.AuthRequest({
        clientId,
        scopes: ['openid', 'profile', 'email'],
        redirectUri: AuthSession.makeRedirectUri({ 
          scheme: 'com.nexhire.app',
          useProxy: true 
        }),
        responseType: AuthSession.ResponseType.Code,
        additionalParameters: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      });

      console.log('?? Auth request created, prompting user...');
      const result = await request.promptAsync(this.discovery);

      console.log('?? Auth result type:', result.type);

      if (result.type === 'success') {
        console.log('? Google authorization successful, exchanging code for tokens...');
        
        const tokenResult = await this.exchangeCodeForTokens(
          result.params.code,
          request.redirectUri
        );

        console.log('? Token exchange successful');
        
        const userInfo = await this.getUserInfo(tokenResult.access_token);
        
        console.log('? User info retrieved:', {
          email: userInfo.email,
          name: userInfo.name,
          verified: userInfo.verified_email
        });

        return {
          success: true,
          data: {
            accessToken: tokenResult.access_token,
            refreshToken: tokenResult.refresh_token,
            idToken: tokenResult.id_token,
            user: userInfo,
          }
        };
      } else if (result.type === 'cancel') {
        console.log('?? User cancelled Google Sign-In');
        return { 
          success: false, 
          error: 'User cancelled', 
          cancelled: true 
        };
      } else {
        console.error('? Google authentication failed:', result);
        throw new Error(result.error?.message || 'Google authentication failed');
      }
    } catch (error) {
      console.error('? Google Sign-In error:', error);
      return { 
        success: false, 
        error: error.message || 'Google Sign-In failed'
      };
    }
  }

  async exchangeCodeForTokens(code, redirectUri) {
    const clientId = this.getClientId();
    
    console.log('?? Exchanging authorization code for tokens...');
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('? Token exchange failed:', data);
      throw new Error(data.error_description || 'Token exchange failed');
    }
    
    console.log('? Token exchange successful');
    return data;
  }

  async getUserInfo(accessToken) {
    console.log('?? Fetching user info from Google...');
    
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('? Failed to fetch user info:', data);
      throw new Error('Failed to fetch user info');
    }
    
    console.log('? User info fetched successfully');
    
    return {
      id: data.id,
      email: data.email,
      verified_email: data.verified_email,
      name: data.name,
      given_name: data.given_name,
      family_name: data.family_name,
      picture: data.picture,
      locale: data.locale,
    };
  }

  async signOut(accessToken) {
    try {
      console.log('?? Revoking Google tokens...');
      
      if (accessToken) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
          method: 'POST',
        });
        console.log('? Google tokens revoked');
      }
      
      return { success: true };
    } catch (error) {
      console.warn('?? Could not revoke Google tokens:', error);
      // Don't throw error - local logout should still work
      return { 
        success: true, 
        warning: 'Could not revoke Google tokens'
      };
    }
  }

  // ??? Development helper - returns mock Google user for testing
  getMockGoogleUser() {
    if (!frontendConfig.isDevelopment()) {
      throw new Error('Mock users only available in development');
    }

    return {
      success: true,
      data: {
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        idToken: 'mock_id_token',
        user: {
          id: '123456789',
          email: 'testuser@gmail.com',
          verified_email: true,
          name: 'Test User',
          given_name: 'Test',
          family_name: 'User',
          picture: 'https://via.placeholder.com/96',
          locale: 'en',
        }
      }
    };
  }

  // Configuration diagnostics
  getDiagnostics() {
    return {
      platform: this.getCurrentPlatform(),
      configured: this.isConfigured(),
      featureEnabled: frontendConfig.isFeatureEnabled('googleSignIn'),
      clientId: this.getClientId()?.substring(0, 20) + '...',
      environment: frontendConfig.app.env,
      config: frontendConfig.google,
    };
  }
}

export default new GoogleAuthService();