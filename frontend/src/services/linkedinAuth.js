import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { frontendConfig } from '../config/appConfig';

WebBrowser.maybeCompleteAuthSession();

/**
 * LinkedInAuthService
 *
 * Handles LinkedIn Sign-In using OpenID Connect (authorization code flow).
 * LinkedIn requires server-side code exchange (needs client_secret),
 * so we get the auth code on the frontend and send it to our backend.
 *
 * Flow:
 *   Web:    Open LinkedIn OAuth → redirect back with ?code=... → send code to backend
 *   Native: Open LinkedIn OAuth → linkedin-auth-callback.html → deep link with ?code=... → send code to backend
 */
class LinkedInAuthService {
  constructor() {
    this.discovery = {
      authorizationEndpoint: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
    };
  }

  getClientId() {
    try {
      return frontendConfig.config?.linkedin?.clientId || null;
    } catch (error) {
      console.warn('LinkedIn config error:', error.message);
      return null;
    }
  }

  isConfigured() {
    const clientId = this.getClientId();
    return clientId && !clientId.includes('YOUR_') && clientId.length > 5;
  }

  async signIn() {
    try {
      if (!frontendConfig.isFeatureEnabled('linkedInSignIn')) {
        return { success: false, error: 'LinkedIn Sign-In is disabled', featureDisabled: true };
      }
      if (!this.isConfigured()) {
        return { success: false, error: 'LinkedIn Sign-In not configured', needsConfig: true };
      }

      const clientId = this.getClientId();

      if (Platform.OS === 'web') {
        return await this._signInWeb(clientId);
      } else {
        return await this._signInNative(clientId);
      }
    } catch (error) {
      console.error('LinkedIn Sign-In error:', error);
      return { success: false, error: `LinkedIn Sign-In failed: ${error.message || error}` };
    }
  }

  // Web: authorization code flow — LinkedIn redirects with ?code=...
  async _signInWeb(clientId) {
    const redirectUri = AuthSession.makeRedirectUri({ scheme: undefined });
    console.log('[LinkedInAuth] redirect_uri =', redirectUri);
    const state = Math.random().toString(36).substring(2, 15);

    const authParams = this._buildQueryString({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      state,
    });

    const authUrl = `${this.discovery.authorizationEndpoint}?${authParams}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success') {
      const url = result.url;
      const params = this._parseQueryString(url.split('?')[1]);
      const code = params['code'];
      const returnedState = params['state'];

      if (!code) throw new Error('No authorization code received from LinkedIn');
      if (returnedState !== state) throw new Error('State mismatch — possible CSRF attack');

      return {
        success: true,
        data: { code, redirectUri },
      };
    }
    return this._handleNonSuccess(result);
  }

  // Native: auth code flow through redirect HTML page
  async _signInNative(clientId) {
    const appEnv = Constants.expoConfig?.extra?.appEnv || 'production';
    const redirectUri = appEnv === 'production'
      ? 'https://www.refopen.com/linkedin-auth-callback.html'
      : 'https://thankful-pebble-07c889000.1.azurestaticapps.net/linkedin-auth-callback.html';
    const appScheme = Constants.expoConfig?.scheme || 'com.refopen.app';

    const statePayload = JSON.stringify({
      nonce: Math.random().toString(36).substring(2, 15),
      scheme: appScheme,
    });
    const stateEncoded = this._base64UrlEncode(statePayload);

    const authParams = this._buildQueryString({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      state: stateEncoded,
    });

    const authUrl = `${this.discovery.authorizationEndpoint}?${authParams}`;
    const expectedPrefix = `${appScheme}://auth/linkedin-callback`;

    // Set up Linking listener as fallback for Android deep link
    let deepLinkUrl = null;
    const linkingPromise = new Promise((resolve) => {
      const handler = (event) => {
        const url = event.url || event;
        if (url && url.startsWith(expectedPrefix)) {
          deepLinkUrl = url;
          resolve(url);
        }
      };
      const subscription = Linking.addEventListener('url', handler);
      this._linkingCleanup = () => { subscription?.remove?.(); };
      setTimeout(() => resolve(null), 120000);
    });

    const result = await WebBrowser.openAuthSessionAsync(authUrl, expectedPrefix);

    let authCallbackUrl = null;

    if (result.type === 'success' && result.url) {
      authCallbackUrl = result.url;
    } else if (result.type === 'dismiss' || result.type === 'cancel') {
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

    // Extract code from callback URL
    const queryString = authCallbackUrl.split('?')[1];
    const params = this._parseQueryString(queryString);
    const code = params['code'];

    if (!code) {
      console.error('[LinkedInAuth] No code in redirect URL:', authCallbackUrl);
      throw new Error('No authorization code received from LinkedIn');
    }

    return {
      success: true,
      data: { code, redirectUri },
    };
  }

  _handleNonSuccess(result) {
    if (result.type === 'cancel') return { success: false, error: 'User cancelled', cancelled: true };
    if (result.type === 'dismiss') return { success: false, error: 'Authentication popup was closed', dismissed: true };
    throw new Error(result.error?.message || `Authentication failed: ${result.type}`);
  }

  // ─── Helpers ───

  _base64UrlEncode(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    const bytes = [];
    for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      result += chars[b0 >> 2];
      result += chars[((b0 & 3) << 4) | (b1 >> 4)];
      result += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '';
      result += i + 2 < bytes.length ? chars[b2 & 63] : '';
    }
    return result.replace(/\+/g, '-').replace(/\//g, '_');
  }

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
}

export default new LinkedInAuthService();
