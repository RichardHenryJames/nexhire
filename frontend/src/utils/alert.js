/**
 * Cross-platform alert utility
 * Uses Alert.alert on native, window.confirm/window.alert on web
 * Provides a unified API across all platforms
 */
import { Alert, Platform } from 'react-native';

/**
 * Show a confirmation dialog across all platforms
 * 
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {Function} onConfirm - Callback when user confirms
 * @param {Function} [onCancel] - Optional callback when user cancels
 * @param {Object} [options] - Optional config
 * @param {string} [options.confirmText='OK'] - Confirm button text
 * @param {string} [options.cancelText='Cancel'] - Cancel button text
 */
export function showConfirm(title, message, onConfirm, onCancel, options = {}) {
  const { confirmText = 'OK', cancelText = 'Cancel' } = options;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const result = window.confirm(`${title}\n\n${message}`);
    if (result) {
      onConfirm?.();
    } else {
      onCancel?.();
    }
  } else {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: onCancel },
        { text: confirmText, onPress: onConfirm },
      ],
      { cancelable: true }
    );
  }
}

/**
 * Show an informational alert across all platforms
 * 
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {Function} [onDismiss] - Optional callback when dismissed
 */
export function showAlert(title, message, onDismiss) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    onDismiss?.();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: onDismiss }]);
  }
}
