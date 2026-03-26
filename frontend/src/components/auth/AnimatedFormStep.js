import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authDarkColors } from '../../styles/authDarkColors';

const colors = authDarkColors;

/**
 * AnimatedFormStep — Progressive reveal wrapper for registration form fields.
 *
 * Shows a single form question at a time with a smooth spring entrance animation.
 * Completed fields display a subtle green checkmark.
 *
 * Usage:
 *   <AnimatedFormStep visible={step >= 2} question="What's your degree?" completed={!!degreeType}>
 *     <DegreeSelector ... />
 *   </AnimatedFormStep>
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
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(32)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (visible && !hasAnimated.current) {
      hasAnimated.current = true;

      // Small delay so the user sees the entrance
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.spring(opacity, {
            toValue: 1,
            useNativeDriver: true,
            tension: 60,
            friction: 10,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 60,
            friction: 10,
          }),
        ]).start();
      }, 120);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ translateY }] },
        style,
      ]}
      onLayout={onLayout}
    >
      {/* Question header */}
      {question && (
        <View style={styles.questionRow}>
          <View style={styles.questionLeft}>
            <Text style={styles.question}>{question}</Text>
          </View>
          {completed && (
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
          )}
        </View>
      )}

      {/* Contextual help */}
      {helpText && <Text style={styles.helpText}>{helpText}</Text>}

      {/* The actual input / selector */}
      <View style={styles.fieldWrap}>{children}</View>

      {/* Optional skip link */}
      {skippable && !completed && onSkip && (
        <TouchableOpacity style={styles.skipRow} onPress={onSkip} activeOpacity={0.7}>
          <Text style={styles.skipText}>I'll add this later</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
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
    color: colors.text,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  helpText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 19,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success,
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
    color: colors.textMuted,
    fontWeight: '500',
  },
});
