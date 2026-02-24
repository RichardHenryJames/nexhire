/**
 * Cross-platform clipboard utility
 * Uses navigator.clipboard on web, expo-clipboard on native (iOS/Android)
 */
import { Platform } from 'react-native';

/**
 * Copy text to clipboard across all platforms
 * @param {string} text - The text to copy
 * @returns {Promise<boolean>} - Whether the copy was successful
 */
export async function copyToClipboard(text) {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      return false;
    }

    // Native: use expo-clipboard
    const Clipboard = require('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch (error) {
    console.warn('Clipboard copy failed:', error);
    return false;
  }
}

/**
 * Read text from clipboard across all platforms
 * @returns {Promise<string|null>} - The clipboard text or null
 */
export async function readFromClipboard() {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        return await navigator.clipboard.readText();
      }
      return null;
    }

    const Clipboard = require('expo-clipboard');
    return await Clipboard.getStringAsync();
  } catch (error) {
    console.warn('Clipboard read failed:', error);
    return null;
  }
}
