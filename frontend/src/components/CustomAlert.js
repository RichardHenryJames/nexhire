import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const AlertContext = createContext(null);

/**
 * Beautiful custom alert - replaces ugly native Alert.alert
 * 
 * Usage:
 *   const { showAlert, showConfirm } = useCustomAlert();
 *   
 *   showAlert({ title: 'Error', message: 'Something went wrong', icon: 'alert-circle' });
 *   
 *   showConfirm({
 *     title: 'Delete Message',
 *     message: 'Are you sure?',
 *     icon: 'trash-outline',
 *     iconColor: '#EF4444',
 *     confirmText: 'Delete',
 *     confirmStyle: 'destructive',
 *     onConfirm: () => deleteMessage(),
 *   });
 *   
 *   // Multiple buttons:
 *   showAlert({
 *     title: 'Choose Photo',
 *     message: 'Select source',
 *     buttons: [
 *       { text: 'Camera', icon: 'camera', onPress: openCamera },
 *       { text: 'Gallery', icon: 'images', onPress: openGallery },
 *       { text: 'Cancel', style: 'cancel' },
 *     ],
 *   });
 */

export function AlertProvider({ children }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  const show = useCallback((cfg) => {
    setConfig(cfg);
    setVisible(true);
  }, []);

  const hide = useCallback((callback) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      setConfig({});
      callback?.();
    });
  }, [fadeAnim, scaleAnim]);

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.85);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const showAlert = useCallback((cfg) => {
    show({
      ...cfg,
      buttons: cfg.buttons || [{ text: cfg.dismissText || 'OK', onPress: cfg.onDismiss }],
    });
  }, [show]);

  const showConfirm = useCallback((cfg) => {
    const buttons = [];
    buttons.push({
      text: cfg.cancelText || 'Cancel',
      style: 'cancel',
      onPress: cfg.onCancel,
    });
    buttons.push({
      text: cfg.confirmText || 'Confirm',
      style: cfg.confirmStyle || 'default',
      icon: cfg.confirmIcon,
      onPress: cfg.onConfirm,
    });
    show({ ...cfg, buttons });
  }, [show]);

  const { title, message, icon, iconColor, buttons = [] } = config;

  // Icon defaults based on context
  const getIconDefaults = () => {
    if (icon) return { name: icon, color: iconColor || colors.primary };
    if (buttons.some(b => b.style === 'destructive')) return { name: 'alert-circle', color: '#EF4444' };
    return { name: 'information-circle', color: colors.primary };
  };

  const iconDefaults = getIconDefaults();

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => hide()}
      >
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={() => hide()} />
          <Animated.View
            style={[
              styles.container,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border + '40',
                transform: [{ scale: scaleAnim }],
                opacity: fadeAnim,
              },
            ]}
          >
            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: iconDefaults.color + '15' }]}>
              <Ionicons name={iconDefaults.name} size={28} color={iconDefaults.color} />
            </View>

            {/* Title */}
            {title && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}

            {/* Message */}
            {message && <Text style={[styles.message, { color: colors.gray500 }]}>{message}</Text>}

            {/* Buttons */}
            <View style={styles.buttonsContainer}>
              {buttons.map((btn, idx) => {
                const isCancel = btn.style === 'cancel';
                const isDestructive = btn.style === 'destructive';
                const isLast = idx === buttons.length - 1;
                const isPrimary = !isCancel && !isDestructive && isLast;

                let bgColor = colors.gray100;
                let textColor = colors.text;
                if (isDestructive) {
                  bgColor = '#EF444415';
                  textColor = '#EF4444';
                } else if (isPrimary || (!isCancel && buttons.length <= 2 && idx > 0)) {
                  bgColor = colors.primary;
                  textColor = '#FFFFFF';
                } else if (isCancel) {
                  bgColor = 'transparent';
                  textColor = colors.gray500;
                }

                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.7}
                    style={[
                      styles.button,
                      {
                        backgroundColor: bgColor,
                        borderWidth: isCancel ? 1 : 0,
                        borderColor: colors.border,
                        flex: buttons.length <= 2 ? 1 : undefined,
                        width: buttons.length > 2 ? '100%' : undefined,
                      },
                    ]}
                    onPress={() => hide(btn.onPress)}
                  >
                    {btn.icon && (
                      <Ionicons
                        name={btn.icon}
                        size={16}
                        color={textColor}
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Text
                      style={[
                        styles.buttonText,
                        {
                          color: textColor,
                          fontWeight: isCancel ? '500' : '600',
                        },
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </AlertContext.Provider>
  );
}

export function useCustomAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    // Fallback for components outside AlertProvider
    return {
      showAlert: (cfg) => {
        if (Platform.OS === 'web') {
          window.alert(`${cfg.title || ''}\n${cfg.message || ''}`);
          cfg.onDismiss?.();
        }
      },
      showConfirm: (cfg) => {
        if (Platform.OS === 'web') {
          const result = window.confirm(`${cfg.title || ''}\n${cfg.message || ''}`);
          result ? cfg.onConfirm?.() : cfg.onCancel?.();
        }
      },
    };
  }
  return context;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    width: Math.min(SCREEN_WIDTH - 48, 340),
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    minHeight: 42,
  },
  buttonText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
