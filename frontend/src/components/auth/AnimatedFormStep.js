import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authDarkColors } from '../../styles/authDarkColors';

const defaultColors = authDarkColors;

/**
 * AnimatedFormStep — Progressive reveal wrapper for form fields.
 *
 * Accepts optional `colors` prop for theme-aware screens (e.g. Ask Referral).
 * Falls back to authDarkColors for auth/registration screens.
 */
export default function AnimatedFormStep({
  visible = false,
  question,
  helpText,
  completed = false,
  skippable = false,
  onSkip,
  children,
  onLayout,
  style,
  colors: themeColors,
}) {
  const c = themeColors || defaultColors;

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(32)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (visible && !hasAnimated.current) {
      hasAnimated.current = true;
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }),
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
        ]).start();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { opacity, transform: [{ translateY }] }, style]}
      onLayout={onLayout}
    >
      {question && (
        <View style={styles.questionRow}>
          <View style={styles.questionLeft}>
            <Text style={[styles.question, { color: c.text || c.textPrimary || '#E0E0E0' }]}>{question}</Text>
          </View>
          {completed && (
            <View style={[styles.checkBadge, { backgroundColor: c.success || '#22C55E' }]}>
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
          )}
        </View>
      )}

      {helpText && <Text style={[styles.helpText, { color: c.textSecondary || c.textMuted || '#9D9D9D' }]}>{helpText}</Text>}

      <View style={styles.fieldWrap}>{children}</View>

      {skippable && !completed && onSkip && (
        <TouchableOpacity style={styles.skipRow} onPress={onSkip} activeOpacity={0.7}>
          <Text style={[styles.skipText, { color: c.textMuted || '#6E6E6E' }]}>I'll add this later</Text>
          <Ionicons name="arrow-forward" size={14} color={c.textMuted || '#6E6E6E'} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
    position: 'relative',
    overflow: 'visible',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  questionLeft: {
    flex: 1,
  },
  question: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  helpText: {
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 19,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  fieldWrap: {
    marginTop: 4,
  },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
