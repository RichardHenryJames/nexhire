import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * AnimatedSection — Staggered entrance wrapper for form sections.
 *
 * Wraps any content with a timed fade-in + slide-up animation.
 * Use the `delay` prop to stagger multiple sections:
 *
 *   <AnimatedSection delay={0}><Header /></AnimatedSection>
 *   <AnimatedSection delay={150}><NameFields /></AnimatedSection>
 *   <AnimatedSection delay={300}><EmailField /></AnimatedSection>
 */
export default function AnimatedSection({ children, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 9,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
