import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { typography } from '../styles/theme';
import { authDarkColors } from '../styles/authDarkColors';

const { width, height } = Dimensions.get('window');

// Floating particle component for background effect
function FloatingParticle({ delay, style }) {
  const translateY = useRef(new Animated.Value(height)).current;
  const translateX = useRef(new Animated.Value(Math.random() * width)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 8000 + Math.random() * 4000,
          delay,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 1000,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1000,
            delay: 6000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY }, { translateX }],
          opacity,
        },
      ]}
    />
  );
}

// Individual loading dot component
function LoadingDot({ delay, style }) {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.2,
            duration: 600,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 600,
            delay,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.5,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    />
  );
}

export default function LoadingScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const colors = authDarkColors; // Always use dark colors for auth screens
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    // Initial fade in animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation for the logo
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    // Shimmer effect for loading bar
    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    );

    // Floating animation
    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();
    shimmerAnimation.start();
    floatAnimation.start();

    return () => {
      pulseAnimation.stop();
      shimmerAnimation.stop();
      floatAnimation.stop();
    };
  }, []);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <View style={styles.container}>
      {/* Modern Gradient Background - Always dark for auth screens */}
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />
      
      {/* Floating Particles */}
      <FloatingParticle delay={0} style={styles.floatingParticle} />
      <FloatingParticle delay={1000} style={styles.floatingParticle} />
      <FloatingParticle delay={2000} style={styles.floatingParticle} />
      
      {/* Main Content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }, { translateY }],
          },
        ]}
      >
        {/* Logo directly without circular container */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Image
            source={require('../../assets/refopen-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Tagline */}
        <Text style={styles.tagline}>Your next career opportunity awaits</Text>

        {/* Modern Loading Progress Bar */}
        <View style={styles.loadingBarContainer}>
          <View style={styles.loadingBar}>
            <Animated.View
              style={[
                styles.loadingBarFill,
                {
                  opacity: shimmerAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.5, 1, 0.5],
                  }),
                },
              ]}
            />
          </View>
        </View>

        {/* Loading Dots */}
        <View style={styles.loadingContainer}>
          <View style={styles.loadingDots}>
            <LoadingDot delay={0} style={styles.loadingDot} />
            <LoadingDot delay={200} style={styles.loadingDot} />
            <LoadingDot delay={400} style={styles.loadingDot} />
          </View>
          <Text style={styles.loadingText}>Setting up your experience...</Text>
        </View>
      </Animated.View>

      {/* Modern Bottom Decoration */}
      <View style={styles.bottomDecoration}>
        <View style={styles.decorationCircle1} />
        <View style={styles.decorationCircle2} />
        <View style={styles.decorationCircle3} />
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0F172A', // Dark fallback for web
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    alignItems: 'center',
    zIndex: 2,
    paddingHorizontal: 20,
  },
  logoContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  logoImage: {
    width: 240,
    height: 68,
    tintColor: colors.white,
  },
  tagline: {
    fontSize: typography.sizes.lg,
    color: colors.white + 'E6',
    textAlign: 'center',
    marginBottom: 60,
    maxWidth: 320,
    lineHeight: 26,
    fontWeight: typography.weights.medium,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  loadingBarContainer: {
    width: 200,
    marginBottom: 40,
  },
  loadingBar: {
    width: '100%',
    height: 4,
    backgroundColor: colors.white + '30',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingBarFill: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: 2,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'center',
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.white,
    marginHorizontal: 6,
    shadowColor: colors.white,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.white + 'D9',
    textAlign: 'center',
    fontWeight: typography.weights.medium,
    letterSpacing: 0.5,
  },
  floatingParticle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
    zIndex: 1,
  },
  bottomDecoration: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    zIndex: 0,
  },
  decorationCircle1: {
    position: 'absolute',
    bottom: -80,
    right: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.white + '12',
    borderWidth: 1,
    borderColor: colors.white + '20',
  },
  decorationCircle2: {
    position: 'absolute',
    bottom: -120,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: colors.white + '08',
    borderWidth: 1,
    borderColor: colors.white + '15',
  },
  decorationCircle3: {
    position: 'absolute',
    bottom: 50,
    right: 30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.white + '10',
    borderWidth: 2,
    borderColor: colors.white + '25',
  },
});