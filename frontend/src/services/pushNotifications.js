/**
 * Push Notification Service
 * 
 * Cross-platform push notification handler:
 * - iOS/Android: Uses expo-notifications for Expo Push Tokens
 * - Web: No-ops gracefully (web notifications use the in-app system)
 * 
 * Features:
 * - Permission request flow
 * - Expo Push Token registration
 * - Foreground notification handling
 * - Background notification response handling
 * - Deep link routing on notification tap
 * - Android notification channel setup
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = 'refopen_push_token';

/**
 * Check if push notifications are supported on this platform
 */
export function isPushSupported() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/**
 * Set up Android notification channel (required for Android 8+)
 * Must be called before any notifications are shown
 */
export async function setupNotificationChannel() {
  if (Platform.OS !== 'android') return;

  try {
    const Notifications = require('expo-notifications');
    await Notifications.setNotificationChannelAsync('default', {
      name: 'RefOpen Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
      sound: 'default',
    });

    // Referral-specific channel
    await Notifications.setNotificationChannelAsync('referrals', {
      name: 'Referral Updates',
      description: 'Notifications about your referral requests and status changes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
      sound: 'default',
    });

    // Message channel
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      description: 'New message notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250],
      lightColor: '#6366F1',
      sound: 'default',
    });

    // Wallet channel
    await Notifications.setNotificationChannelAsync('wallet', {
      name: 'Wallet & Payments',
      description: 'Payment confirmations and wallet updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  } catch (error) {
    console.warn('Failed to set up notification channels:', error);
  }
}

/**
 * Request notification permissions and get Expo Push Token
 * @returns {Promise<string|null>} The Expo Push Token or null if denied/unsupported
 */
export async function registerForPushNotifications() {
  if (!isPushSupported()) return null;

  try {
    const Notifications = require('expo-notifications');
    const Device = require('expo-device');
    const Constants = require('expo-constants');

    // Must be a physical device (emulators don't support push)
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check existing permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Get Expo Push Token
    const projectId = Constants.default?.expirationDate
      ? Constants.default?.manifest?.extra?.eas?.projectId
      : Constants.default?.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    const token = tokenData.data;
    console.log('Expo Push Token:', token);

    // Cache token locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    // Set up Android channels
    await setupNotificationChannel();

    return token;
  } catch (error) {
    console.error('Failed to register for push notifications:', error);
    return null;
  }
}

/**
 * Get the cached push token (if any)
 * @returns {Promise<string|null>}
 */
export async function getCachedPushToken() {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear the cached push token (e.g., on logout)
 */
export async function clearPushToken() {
  try {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/**
 * Configure how notifications are displayed when app is in foreground
 * Call this once during app startup
 */
export function configureForegroundHandler() {
  if (!isPushSupported()) return;

  try {
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (error) {
    console.warn('Failed to configure foreground handler:', error);
  }
}

/**
 * Handle notification tap — route to the correct screen
 * @param {object} response - The notification response from expo-notifications
 * @param {object} navigationRef - React Navigation ref
 */
export function handleNotificationResponse(response, navigationRef) {
  if (!response?.notification?.request?.content?.data) return;

  const data = response.notification.request.content.data;
  const nav = navigationRef?.current;
  if (!nav) return;

  try {
    // Route based on notification type
    switch (data.type) {
      case 'referral_update':
      case 'referral_status':
        if (data.requestId) {
          nav.navigate('ReferralTracking', { requestId: data.requestId });
        } else {
          nav.navigate('MyReferralRequests');
        }
        break;

      case 'new_message':
      case 'message':
        if (data.conversationId) {
          nav.navigate('Chat', { conversationId: data.conversationId });
        } else {
          nav.navigate('Messages');
        }
        break;

      case 'wallet_credit':
      case 'wallet_debit':
      case 'payment':
        nav.navigate('Wallet');
        break;

      case 'job_match':
      case 'new_job':
        if (data.jobId) {
          nav.navigate('JobDetails', { jobId: data.jobId });
        } else {
          nav.navigate('Main', { screen: 'MainTabs', params: { screen: 'Jobs' } });
        }
        break;

      case 'verification':
        nav.navigate('GetVerified');
        break;

      case 'profile_view':
        nav.navigate('ProfileViews');
        break;

      default:
        // Default: go to notifications tab
        nav.navigate('Main', { screen: 'MainTabs', params: { screen: 'Notifications' } });
        break;
    }
  } catch (error) {
    console.warn('Failed to handle notification navigation:', error);
  }
}

/**
 * Set up notification response listener (tap handler)
 * @param {object} navigationRef - React Navigation ref
 * @returns {Function} cleanup function to remove the listener
 */
export function setupNotificationResponseListener(navigationRef) {
  if (!isPushSupported()) return () => {};

  try {
    const Notifications = require('expo-notifications');

    // Handle notification taps when app is running
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response, navigationRef);
    });

    // Also check if app was opened from a notification (cold start)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationResponse(response, navigationRef);
      }
    });

    return () => subscription.remove();
  } catch (error) {
    console.warn('Failed to set up notification response listener:', error);
    return () => {};
  }
}

/**
 * Set up foreground notification received listener
 * Useful for updating badges, showing in-app alerts, etc.
 * @param {Function} callback - Called with the notification object
 * @returns {Function} cleanup function
 */
export function setupNotificationReceivedListener(callback) {
  if (!isPushSupported()) return () => {};

  try {
    const Notifications = require('expo-notifications');
    const subscription = Notifications.addNotificationReceivedListener(callback);
    return () => subscription.remove();
  } catch {
    return () => {};
  }
}

/**
 * Get the current badge count
 * @returns {Promise<number>}
 */
export async function getBadgeCount() {
  if (!isPushSupported()) return 0;
  try {
    const Notifications = require('expo-notifications');
    return await Notifications.getBadgeCountAsync();
  } catch {
    return 0;
  }
}

/**
 * Set the app badge count
 * @param {number} count
 */
export async function setBadgeCount(count) {
  if (!isPushSupported()) return;
  try {
    const Notifications = require('expo-notifications');
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // ignore
  }
}
