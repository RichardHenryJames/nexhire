/**
 * Cross-platform secure storage utility
 * Uses expo-secure-store on iOS/Android for sensitive data (tokens)
 * Falls back to AsyncStorage on web (SecureStore not supported on web)
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let SecureStore = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

/**
 * Store a value securely
 * On mobile: uses expo-secure-store (encrypted keychain/keystore)
 * On web: uses AsyncStorage (localStorage wrapper)
 *
 * @param {string} key - Storage key
 * @param {string} value - Value to store
 */
export async function secureSet(key, value) {
  try {
    if (Platform.OS !== 'web' && SecureStore) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  } catch (error) {
    console.error(`secureSet failed for key "${key}":`, error);
    // Fallback to AsyncStorage if SecureStore fails (e.g. value too large)
    try {
      await AsyncStorage.setItem(key, value);
    } catch (fallbackError) {
      console.error('secureSet fallback also failed:', fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Retrieve a value from secure storage
 *
 * @param {string} key - Storage key
 * @returns {Promise<string|null>} - The stored value or null
 */
export async function secureGet(key) {
  try {
    if (Platform.OS !== 'web' && SecureStore) {
      return await SecureStore.getItemAsync(key);
    }
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.warn(`secureGet failed for key "${key}":`, error);
    // Fallback to AsyncStorage
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

/**
 * Remove a value from secure storage
 *
 * @param {string} key - Storage key
 */
export async function secureRemove(key) {
  try {
    if (Platform.OS !== 'web' && SecureStore) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch (error) {
    console.warn(`secureRemove failed for key "${key}":`, error);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Silent fail
    }
  }
}

/**
 * Store multiple key-value pairs securely
 *
 * @param {Array<[string, string]>} pairs - Array of [key, value] pairs
 */
export async function secureMultiSet(pairs) {
  if (Platform.OS !== 'web' && SecureStore) {
    await Promise.all(pairs.map(([key, value]) => secureSet(key, value)));
  } else {
    await AsyncStorage.multiSet(pairs);
  }
}
