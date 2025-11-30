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
      this.logConfigStatus();
    }
  }

  getClientId() {
    try {
      const platform = this.getCurrentPlatform();
      const config = frontendConfig.getGoogleOAuthConfig(platform);
      return config.clientId;
    } catch (error) {
      console.warn('Google OAuth configuration error:', error.message);
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
  }

  async signIn() {
    try {
      
      // Check if feature is enabled
      if (!frontendConfig.isFeatureEnabled('googleSignIn')) {
        console.warn('Google Sign-In feature is disabled');
        return {
          success: false,
          error: 'Google Sign-In feature is disabled in configuration',
          featureDisabled: true
        };
      }
      
      // Check if Google OAuth is configured
      if (!this.isConfigured()) {
        console.warn('Google OAuth not configured - using demo mode');
        return {
          success: false,
          error: 'Google Sign-In not configured yet. Please set up OAuth credentials.',
          needsConfig: true
        };
      }

      const clientId = this.getClientId();

      // Create redirect URI
      const redirectUri = AuthSession.makeRedirectUri({ 
        scheme: undefined,
        useProxy: false
      });


      // Manual OAuth URL construction without PKCE
      const authParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'token', // Implicit flow
        scope: 'openid profile email',
        prompt: 'select_account',
        state: Math.random().toString(36).substring(2, 15), // Random state for security
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;
      

      // FIXED: Use WebBrowser.openAuthSessionAsync instead of AuthSession.startAsync
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);


      if (result.type === 'success') {
        
        // Parse tokens from the URL
        let accessToken, idToken;
        
        if (result.url) {
          // Extract tokens from URL fragment or query parameters
          const urlParts = result.url.split('#')[1] || result.url.split('?')[1];
          if (urlParts) {
            const params = new URLSearchParams(urlParts);
            accessToken = params.get('access_token');
            idToken = params.get('id_token');
          }
        }
        
        if (!accessToken) {
          console.error('No access token in result URL:', result.url);
          throw new Error('No access token received from Google');
        }

        
        const userInfo = await this.getUserInfo(accessToken);
        

        return {
          success: true,
          data: {
            accessToken: accessToken,
            refreshToken: null, // Implicit flow doesn't provide refresh tokens
            idToken: idToken,
            user: userInfo,
          }
        };
      } else if (result.type === 'cancel') {
        return { 
          success: false, 
          error: 'User cancelled', 
          cancelled: true 
        };
      } else if (result.type === 'dismiss') {
        return { 
          success: false, 
          error: 'Authentication popup was closed', 
          dismissed: true 
        };
      } else {
        console.error('Google authentication failed:', result);
        throw new Error(result.error?.message || `Authentication failed: ${result.type}`);
      }
    } catch (error) {
      console.error('Google Sign-In error:', error);
      return { 
        success: false, 
        error: error.message || 'Google Sign-In failed'
      };
    }
  }

  async getUserInfo(accessToken) {
    
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Failed to fetch user info:', data);
      throw new Error('Failed to fetch user info');
    }
    
    
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
      
      if (accessToken) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
          method: 'POST',
        });
      }
      
      return { success: true };
    } catch (error) {
      console.warn('Could not revoke Google tokens:', error);
      // Don't throw error - local logout should still work
      return { 
        success: true, 
        warning: 'Could not revoke Google tokens'
      };
    }
  }

  // ?Development helper - returns mock Google user for testing
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