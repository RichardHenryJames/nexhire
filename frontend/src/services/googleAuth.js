import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { frontendConfig } from '../config/appConfig';

// Complete web browser auth session (required for Google auth redirect)
WebBrowser.maybeCompleteAuthSession();

/**
 * GoogleAuthService — utility layer for Google OAuth.
 *
 * The actual sign-in flow is handled by the `Google.useAuthRequest()` hook
 * inside AuthProvider (see AuthContext.js).  This service provides:
 *   • client-ID helpers  (getClientId / getClientIds / isConfigured)
 *   • user-info fetching (getUserInfo)
 *   • sign-out / token revocation
 *   • dev helpers (getMockGoogleUser, getDiagnostics)
 */
class GoogleAuthService {
  constructor() {
    if (frontendConfig.shouldLog('debug')) {
      this.logConfigStatus();
    }
  }

  // --------------- client-id helpers ---------------

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

  /**
   * Return all three platform client IDs for Google.useAuthRequest().
   */
  getClientIds() {
    const google = frontendConfig.config.google;
    return {
      webClientId: google.webClientId || undefined,
      androidClientId: google.androidClientId || undefined,
      iosClientId: google.iosClientId || undefined,
    };
  }

  getCurrentPlatform() {
    if (Platform.OS === 'web') return 'web';
    if (Platform.OS === 'android') return 'android';
    if (Platform.OS === 'ios') return 'ios';
    return 'web';
  }

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
    console.log('[GoogleAuth] config:', summary);
  }

  // --------------- user info ---------------

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