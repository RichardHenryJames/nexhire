import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { frontendConfig } from '../config/appConfig';

// Complete web browser auth session (required for Google auth redirect)
WebBrowser.maybeCompleteAuthSession();

/**
 * GoogleAuthService
 *
 * Handles Google OAuth sign-in on all platforms:
 *   • Web:     implicit flow (token in URL fragment) — works directly
 *   • Native:  authorization-code + PKCE flow through refopen.com redirect page.
 *              Google redirects to https://www.refopen.com/google-auth-callback.html?code=...
 *              That HTML page deep-links back into the app: com.refopen.app://auth/callback?code=...
 *              The app then exchanges the code for tokens using PKCE (no client secret needed).
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
      return { success: false, error: `Google Sign-In failed: ${error.message || error}` };
    }
  }

  // Web: implicit flow — tokens come in #fragment, no server intermediary needed
  async _signInWeb(clientId) {
    const redirectUri = AuthSession.makeRedirectUri({ scheme: undefined });

    const authParams = this._buildQueryString({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: 'openid profile email',
      prompt: 'select_account',
      state: Math.random().toString(36).substring(2, 15),
    });

    const authUrl = `${this.discovery.authorizationEndpoint}?${authParams}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success') {
      const urlParts = result.url.split('#')[1] || result.url.split('?')[1];
      const params = this._parseQueryString(urlParts);
      const accessToken = params['access_token'];
      const idToken = params['id_token'];
      if (!accessToken) throw new Error('No access token received from Google');

      const userInfo = await this.getUserInfo(accessToken);
      return {
        success: true,
        data: { accessToken, refreshToken: null, idToken, user: userInfo },
      };
    }
    return this._handleNonSuccess(result);
  }

  // Native: implicit flow through refopen.com redirect page
  // Flow: App → Chrome → Google OAuth → refopen.com/google-auth-callback.html#access_token=...
  //        → HTML page reads fragment, deep-links back: scheme://auth/callback?access_token=...&id_token=...
  async _signInNative(clientId) {
    const redirectUri = 'https://www.refopen.com/google-auth-callback.html';
    const appScheme = Constants.expoConfig?.scheme || 'com.refopen.app';

    // Encode app scheme in state so the HTML page knows where to deep-link
    const statePayload = JSON.stringify({
      nonce: Math.random().toString(36).substring(2, 15),
      scheme: appScheme,
    });
    const stateEncoded = this._base64UrlEncode(statePayload);

    const authParams = this._buildQueryString({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token id_token',
      scope: 'openid profile email',
      prompt: 'select_account',
      state: stateEncoded,
      nonce: Math.random().toString(36).substring(2, 15),
    });

    const authUrl = `${this.discovery.authorizationEndpoint}?${authParams}`;
    const expectedPrefix = `${appScheme}://auth/callback`;

    console.log('[GoogleAuth] Redirect via:', redirectUri);
    console.log('[GoogleAuth] Listening for deep link:', expectedPrefix);

    // Set up Linking listener as fallback for Android deep link
    let deepLinkUrl = null;
    const linkingPromise = new Promise((resolve) => {
      const handler = (event) => {
        const url = event.url || event;
        if (url && url.startsWith(expectedPrefix)) {
          console.log('[GoogleAuth] Caught deep link via Linking:', url);
          deepLinkUrl = url;
          resolve(url);
        }
      };
      const subscription = Linking.addEventListener('url', handler);
      this._linkingCleanup = () => { subscription?.remove?.(); };
      setTimeout(() => resolve(null), 120000);
    });

    // Open browser
    const result = await WebBrowser.openAuthSessionAsync(authUrl, expectedPrefix);
    console.log('[GoogleAuth] openAuthSessionAsync result:', result.type);

    let authCallbackUrl = null;

    if (result.type === 'success' && result.url) {
      authCallbackUrl = result.url;
    } else if (result.type === 'dismiss' || result.type === 'cancel') {
      console.log('[GoogleAuth] Custom Tab closed, waiting for Linking fallback...');
      const linkedUrl = deepLinkUrl || await Promise.race([
        linkingPromise,
        new Promise((r) => setTimeout(() => r(null), 3000)),
      ]);
      if (linkedUrl) {
        authCallbackUrl = linkedUrl;
      } else {
        this._linkingCleanup?.();
        if (result.type === 'cancel') return { success: false, error: 'User cancelled', cancelled: true };
        return { success: false, error: 'Authentication popup was closed', dismissed: true };
      }
    } else {
      this._linkingCleanup?.();
      return this._handleNonSuccess(result);
    }

    this._linkingCleanup?.();

    // The HTML page passes tokens as query params:
    // scheme://auth/callback?access_token=...&id_token=...&state=...
    const queryString = authCallbackUrl.split('?')[1];
    const params = this._parseQueryString(queryString);
    const accessToken = params['access_token'];
    const idToken = params['id_token'];

    if (!accessToken) {
      console.error('[GoogleAuth] No access_token in redirect URL:', authCallbackUrl);
      throw new Error('No access token received from Google');
    }

    console.log('[GoogleAuth] Got access token, fetching user info...');
    const userInfo = await this.getUserInfo(accessToken);

    return {
      success: true,
      data: {
        accessToken,
        refreshToken: null,
        idToken: idToken || null,
        user: userInfo,
      },
    };
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
    // Use manual base64url encoding (btoa may not be available in Hermes)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < randomBytes.length; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
    return result;
  }

  async _generateCodeChallenge(verifier) {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  _base64UrlEncode(str) {
    // Manual base64url encoding that works in Hermes
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i];
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      result += chars[b0 >> 2];
      result += chars[((b0 & 3) << 4) | (b1 >> 4)];
      result += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '';
      result += i + 2 < bytes.length ? chars[b2 & 63] : '';
    }
    // Convert to base64url
    return result.replace(/\+/g, '-').replace(/\//g, '_');
  }

  // Hermes-safe query string helpers (URLSearchParams is not fully implemented in Hermes)
  _buildQueryString(params) {
    return Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  _parseQueryString(qs) {
    const result = {};
    if (!qs) return result;
    qs.split('&').forEach((pair) => {
      const [key, ...rest] = pair.split('=');
      if (key) result[decodeURIComponent(key)] = decodeURIComponent(rest.join('='));
    });
    return result;
  }

  async _exchangeCodeForTokens(code, codeVerifier, redirectUri, clientId) {
    const response = await fetch(this.discovery.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: this._buildQueryString({
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
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