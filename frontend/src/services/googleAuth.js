import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
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

      // Generate redirect URI using the app's custom scheme.
      // The auth.expo.io proxy is deprecated in SDK 49+ and no longer works,
      // so we use AuthSession.makeRedirectUri() which generates a scheme-based
      // URI for native (e.g. com.refopen.app://auth/callback) and an HTTPS
      // URI for web.
      const scheme = Constants.expoConfig?.scheme;
      const redirectUri = AuthSession.makeRedirectUri({
        scheme,
        path: 'auth/callback',
      });

      console.log('Google OAuth redirect URI:', redirectUri);

      if (Platform.OS === 'web') {
        // Web: implicit flow (already works)
        return await this._signInWeb(clientId, redirectUri);
      } else {
        // Native (Android/iOS): authorization code flow with PKCE
        // PKCE allows Google to accept custom-scheme redirect URIs
        return await this._signInNative(clientId, redirectUri);
      }
    } catch (error) {
      console.error('Google Sign-In error:', error);
      return { 
        success: false, 
        error: "Not your fault! We're working on it. Try again soon. ✨"
      };
    }
  }

  // Web: implicit flow (unchanged, already works)
  async _signInWeb(clientId, redirectUri) {
    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: 'openid profile email',
      prompt: 'select_account',
      state: Math.random().toString(36).substring(2, 15),
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success') {
      let accessToken, idToken;

      if (result.url) {
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
          accessToken,
          refreshToken: null,
          idToken,
          user: userInfo,
        }
      };
    } else if (result.type === 'cancel') {
      return { success: false, error: 'User cancelled', cancelled: true };
    } else if (result.type === 'dismiss') {
      return { success: false, error: 'Authentication popup was closed', dismissed: true };
    } else {
      console.error('Google authentication failed:', result);
      throw new Error(result.error?.message || `Authentication failed: ${result.type}`);
    }
  }

  // Native: authorization code flow with PKCE (replaces broken auth.expo.io proxy)
  async _signInNative(clientId, redirectUri) {
    // Generate PKCE code verifier and challenge
    const codeVerifier = this._generateCodeVerifier();
    const codeChallenge = await this._generateCodeChallenge(codeVerifier);

    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      prompt: 'select_account',
      state: Math.random().toString(36).substring(2, 15),
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;

    // No useProxy — that flag is deprecated in SDK 49+
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success') {
      // Extract authorization code from the redirect URL
      let code;
      if (result.url) {
        // The code comes as a query parameter: scheme://auth/callback?code=...
        const queryString = result.url.split('?')[1];
        if (queryString) {
          const params = new URLSearchParams(queryString);
          code = params.get('code');
        }
      }

      if (!code) {
        console.error('No authorization code in result URL:', result.url);
        throw new Error('No authorization code received from Google');
      }

      // Exchange the authorization code for tokens
      const tokens = await this._exchangeCodeForTokens(code, codeVerifier, redirectUri, clientId);
      const userInfo = await this.getUserInfo(tokens.access_token);

      return {
        success: true,
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          idToken: tokens.id_token || null,
          user: userInfo,
        }
      };
    } else if (result.type === 'cancel') {
      return { success: false, error: 'User cancelled', cancelled: true };
    } else if (result.type === 'dismiss') {
      return { success: false, error: 'Authentication popup was closed', dismissed: true };
    } else {
      console.error('Google authentication failed:', result);
      throw new Error(result.error?.message || `Authentication failed: ${result.type}`);
    }
  }

  // PKCE helpers
  _generateCodeVerifier() {
    const randomBytes = Crypto.getRandomBytes(32);
    // Convert to base64url
    const base64 = btoa(String.fromCharCode(...new Uint8Array(randomBytes)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async _generateCodeChallenge(verifier) {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    // Convert base64 to base64url
    return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async _exchangeCodeForTokens(code, codeVerifier, redirectUri, clientId) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        code: code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Token exchange failed:', data);
      throw new Error(data.error_description || 'Failed to exchange authorization code for tokens');
    }

    return data;
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