/**
 * Cross-platform URL opener utility
 * Uses window.open on web, Linking.openURL on native (iOS/Android)
 * 
 * Replaces the repetitive pattern:
 *   if (Platform.OS === 'web') { window.open(url, '_blank'); }
 *   else { Linking.openURL(url); }
 */
import { Platform, Linking } from 'react-native';

/**
 * Open a URL in the default browser / external app
 * @param {string} url - The URL to open
 * @param {Object} [options] - Optional configuration
 * @param {Function} [options.onError] - Callback if opening fails
 * @returns {Promise<void>}
 */
export async function openURL(url, options = {}) {
  if (!url) return;

  try {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      await Linking.openURL(url);
    }
  } catch (error) {
    console.warn('Failed to open URL:', url, error);
    options.onError?.(error);
  }
}

/**
 * Navigate to a route on web (window.location.href) or via React Navigation on native
 * @param {string} webPath - The web path (e.g. '/login')
 * @param {object} navigation - React Navigation object
 * @param {string} screenName - Screen name for native navigation (e.g. 'Login')
 * @param {object} [resetConfig] - Optional navigation.reset config for native
 */
export function navigateWeb(webPath, navigation, screenName, resetConfig) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.href = webPath;
  } else if (resetConfig) {
    navigation.reset(resetConfig);
  } else {
    navigation.navigate(screenName);
  }
}

/**
 * Scroll to top — works on both web and native (with ScrollView ref)
 * @param {object} [scrollRef] - Optional ScrollView ref for native
 */
export function scrollToTop(scrollRef) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (scrollRef?.current?.scrollTo) {
    scrollRef.current.scrollTo({ x: 0, y: 0, animated: true });
  }
}
