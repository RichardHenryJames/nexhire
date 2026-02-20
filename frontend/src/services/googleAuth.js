import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { frontendConfig } from '../config/appConfig';

// Complete web browser auth session (required for Google auth redirect)
WebBrowser.maybeCompleteAuthSession();

/**
 * GoogleAuthService
 *
 * Handles Google OAuth sign-in on all platforms:
 *   • Web:     implicit flow (token in URL fragment) — works with Web client ID
 *   • Native:  authorization-code + PKCE flow through auth.expo.io proxy —
 *              uses the Web client ID because expo-auth-session is browser-based.
 *              The auth.expo.io proxy relays the ?code= query param back to the
 *              app via deep link (com.refopen.app://expo-auth-session?code=...).
 *
 * IMPORTANT: The original code used response_type=token (implicit) on native,
 * which broke auth.expo.io because tokens arrive in the URL #fragment which
 * the server never receives. Authorization-code flow puts the code in the
 * ?query string, which auth.expo.io CAN relay.
 */
class GoogleAuthService {
  constructor() {
    this.discovery = {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    };

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

  // --------------- sign-in ---------------

  async signIn() {
    try {
      if (!frontendConfig.isFeatureEnabled('googleSignIn')) {
        return { success: false, error: 'Google Sign-In feature is disabled', featureDisabled: true };
      }
      if (!this.isConfigured()) {
        return { success: false, error: 'Google Sign-In not configured yet.', needsConfig: true };
      }

      // Always use the Web client ID — expo-auth-session is browser-based on all platforms
      const clientId = frontendConfig.config.google.webClientId;

      if (Platform.OS === 'web') {
        return await this._signInWeb(clientId);
      } else {
        return await this._signInNative(clientId);
      }
    } catch (error) {
      console.error('Google Sign-In error:', error);
      return { success: false, error: "Not your fault! We're working on it. Try again soon. ✨" };
    }
  }

  // Web: implicit flow — tokens come in #fragment, no server intermediary needed
  async _signInWeb(clientId) {
    const redirectUri = AuthSession.makeRedirectUri({ scheme: undefined });

    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: 'openid profile email',
      prompt: 'select_account',
      state: Math.random().toString(36).substring(2, 15),
    });

    const authUrl = `${this.discovery.authorizationEndpoint}?${authParams.toString()}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success') {
      const urlParts = result.url.split('#')[1] || result.url.split('?')[1];
      const params = urlParts ? new URLSearchParams(urlParts) : new URLSearchParams();
      const accessToken = params.get('access_token');
      const idToken = params.get('id_token');
      if (!accessToken) throw new Error('No access token received from Google');

      const userInfo = await this.getUserInfo(accessToken);
      return {
        success: true,
        data: { accessToken, refreshToken: null, idToken, user: userInfo },
      };
    }
    return this._handleNonSuccess(result);
  }

  // Native: authorization-code + PKCE through auth.expo.io
  // auth.expo.io receives ?code=... (query string) and deep-links back to the app
  async _signInNative(clientId) {
    // The auth.expo.io proxy URL (already registered as an HTTPS redirect URI
    // in the Web-type Google OAuth client)
    const proxyRedirectUri = `https://auth.expo.io/@${Constants.expoConfig?.owner || 'parimalkumar'}/${Constants.expoConfig?.slug || 'refopen'}`;

    // The app's deep link scheme — auth.expo.io redirects here
    const appScheme = Constants.expoConfig?.scheme || 'com.refopen.app';

    // Generate PKCE code verifier + challenge
    const codeVerifier = this._generateCodeVerifier();
    const codeChallenge = await this._generateCodeChallenge(codeVerifier);

    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: proxyRedirectUri,        // HTTPS URL registered in Google Console
      response_type: 'code',                 // Auth-code flow (NOT implicit!)
      scope: 'openid profile email',
      prompt: 'select_account',
      state: Math.random().toString(36).substring(2, 15),
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    const authUrl = `${this.discovery.authorizationEndpoint}?${authParams.toString()}`;

    console.log('[GoogleAuth] Native redirect via:', proxyRedirectUri);
    console.log('[GoogleAuth] Listening for deep link:', `${appScheme}://`);

    // Open browser — listen for the deep link from auth.expo.io (NOT the proxy URL)
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      `${appScheme}://`
      // No useProxy flag — deprecated in SDK 49+
    );

    if (result.type === 'success') {
      // auth.expo.io deep-links: com.refopen.app://expo-auth-session?code=...&state=...
      const queryString = result.url.split('?')[1];
      const params = queryString ? new URLSearchParams(queryString) : new URLSearchParams();
      const code = params.get('code');

      if (!code) {
        console.error('[GoogleAuth] No code in redirect URL:', result.url);
        throw new Error('No authorization code received from Google');
      }

      // Exchange the code for tokens
      const tokens = await this._exchangeCodeForTokens(code, codeVerifier, proxyRedirectUri, clientId);
      const userInfo = await this.getUserInfo(tokens.access_token);

      return {
        success: true,
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || null,
          idToken: tokens.id_token || null,
          user: userInfo,
        },
      };
    }
    return this._handleNonSuccess(result);
  }

  _handleNonSuccess(result) {
    if (result.type === 'cancel') return { success: false, error: 'User cancelled', cancelled: true };
    if (result.type === 'dismiss') return { success: false, error: 'Authentication popup was closed', dismissed: true };
    console.error('Google authentication failed:', result);
    throw new Error(result.error?.message || `Authentication failed: ${result.type}`);
  }

  // --------------- PKCE helpers ---------------

  _generateCodeVerifier() {
    const randomBytes = Crypto.getRandomBytes(32);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(randomBytes)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async _generateCodeChallenge(verifier) {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async _exchangeCodeForTokens(code, codeVerifier, redirectUri, clientId) {
    const response = await fetch(this.discovery.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('[GoogleAuth] Token exchange failed:', data);
      throw new Error(data.error_description || 'Failed to exchange authorization code');
    }
    return data;
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