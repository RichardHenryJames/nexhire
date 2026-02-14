import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * ModalToast - A toast component designed to work inside modals
 * Unlike the global Toast, this one is controlled via props and renders within its parent
 */
const ModalToast = ({ visible, message, type = 'success', duration = 2500, onHide }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimeout = useRef(null);

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      if (onHide) onHide();
    });
  }, [anim, onHide]);

  useEffect(() => {
    if (visible) {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start(() => {
        hideTimeout.current = setTimeout(() => hide(), duration);
      });
    } else {
      anim.setValue(0);
    }

    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [visible, duration, anim, hide]);

  if (!visible) return null;

  const bg = type === 'error' 
    ? (colors.error || colors.danger) 
    : type === 'warning' 
      ? colors.warning 
      : colors.success;

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      <Animated.View 
        style={[
          styles.toast,
          {
            backgroundColor: bg, 
            opacity: anim, 
            transform: [{
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })
            }]
          }
        ]}
      >
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  wrapper: { 
    position: 'absolute', 
    top: 60, 
    left: 0, 
    right: 0, 
    alignItems: 'center', 
    zIndex: 9999 
  },
  toast: { 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 24, 
    maxWidth: '90%', 
    shadowColor: colors.shadow, 
    shadowOpacity: 0.2, 
    shadowRadius: 6, 
    elevation: 4 
  },
  text: { 
    color: colors.textInverse || '#FFFFFF', 
    fontSize: typography.sizes?.sm || 14, 
    fontWeight: typography.weights?.medium || '500',
    textAlign: 'center'
  }
});

export default ModalToast;
