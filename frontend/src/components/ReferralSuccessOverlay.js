import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Confetti particle component
const ConfettiParticle = ({ delay, startX, color, size = 12 }) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const duration = 2500 + Math.random() * 1000;
    
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT + 100,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: (Math.random() - 0.5) * 150,
          duration: duration / 2,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: (Math.random() - 0.5) * 100,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(rotate, {
        toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration,
        delay: delay + duration * 0.7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const spin = rotate.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: 0,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? size / 2 : 2,
        transform: [{ translateY }, { translateX }, { rotate: spin }],
        opacity,
      }}
    />
  );
};

// Sparkle component
const Sparkle = ({ delay, x, y }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 400,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 400,
            delay,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: [{ scale }],
        opacity,
      }}
    >
      <FontAwesome5 name="star" size={16} color="#FFD700" />
    </Animated.View>
  );
};

/**
 * 🎉 Referral Success Overlay
 * Shows a beautiful animated success UI with confetti and celebratory visuals
 * as a visual confirmation that the referral request was sent successfully.
 */
export default function ReferralSuccessOverlay({
  visible,
  onComplete,
  duration = 3500,
  companyName = '',
}) {
  const { colors, isDarkMode } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDarkMode), [colors, isDarkMode]);
  
  // Animations
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(20)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  // Confetti colors
  const confettiColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8B500', '#FF69B4', '#00CED1', '#FF7F50', '#9370DB',
  ];

  // Generate confetti particles
  const confettiParticles = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      delay: Math.random() * 500,
      startX: Math.random() * SCREEN_WIDTH,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      size: 8 + Math.random() * 10,
    }));
  }, []);

  // Generate sparkles
  const sparkles = useMemo(() => {
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2 - 50;
    return Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * 2 * Math.PI;
      const radius = 120 + Math.random() * 40;
      return {
        id: i,
        x: centerX + Math.cos(angle) * radius - 8,
        y: centerY + Math.sin(angle) * radius - 8,
        delay: i * 100,
      };
    });
  }, []);

  useEffect(() => {
    if (visible) {
      // Reset animations
      checkScale.setValue(0);
      checkOpacity.setValue(0);
      titleOpacity.setValue(0);
      titleTranslateY.setValue(30);
      subtitleOpacity.setValue(0);
      subtitleTranslateY.setValue(20);

      // Start animations sequence - simplified for faster text display
      Animated.sequence([
        // Check mark animation first
        Animated.parallel([
          Animated.spring(checkScale, {
            toValue: 1,
            friction: 4,
            tension: 50,
            useNativeDriver: true,
          }),
          Animated.timing(checkOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        // Title animation - immediately after checkmark
        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(titleTranslateY, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
        // Subtitle animation
        Animated.parallel([
          Animated.timing(subtitleOpacity, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.spring(subtitleTranslateY, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Pulse animation for check circle
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.08,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Auto-dismiss
      const timer = setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, onComplete]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        {/* Gradient Background - Dark elegant theme */}
        <LinearGradient
          colors={['#0d1117', '#161b22', '#21262d']}
          style={styles.gradientBg}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Confetti */}
        {confettiParticles.map((particle) => (
          <ConfettiParticle
            key={particle.id}
            delay={particle.delay}
            startX={particle.startX}
            color={particle.color}
            size={particle.size}
          />
        ))}

        {/* Sparkles */}
        {sparkles.map((sparkle) => (
          <Sparkle
            key={sparkle.id}
            delay={sparkle.delay}
            x={sparkle.x}
            y={sparkle.y}
          />
        ))}

        {/* Main Content */}
        <View style={styles.contentContainer}>
          {/* Check Circle */}
          <Animated.View
            style={[
              styles.checkCircle,
              {
                transform: [{ scale: Animated.multiply(checkScale, pulseScale) }],
                opacity: checkOpacity,
              },
            ]}
          >
            <LinearGradient
              colors={['#00c853', '#69f0ae']}
              style={styles.checkGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.checkIconContainer}>
                <Ionicons name="checkmark" size={56} color="#FFFFFF" />
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Title */}
          <Animated.View
            style={{
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            }}
          >
            <Text style={styles.title}>Referral Sent! 🎉</Text>
          </Animated.View>

          {/* Subtitle */}
          <Animated.View
            style={{
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleTranslateY }],
            }}
          >
            <Text style={styles.subtitle}>
              Referral request sent to employees
            </Text>
            <Text style={styles.companyText}>
              of {companyName || 'the company'}
            </Text>
          </Animated.View>

          {/* Bottom icons */}
          <Animated.View
            style={[
              styles.iconsRow,
              { opacity: subtitleOpacity },
            ]}
          >
            <View style={styles.iconItem}>
              <MaterialCommunityIcons name="email-fast" size={28} color="#FFFFFF" />
              <Text style={styles.iconText}>Sent</Text>
            </View>
            <View style={styles.iconDivider} />
            <View style={styles.iconItem}>
              <MaterialCommunityIcons name="account-group" size={28} color="#FFFFFF" />
              <Text style={styles.iconText}>All Employees</Text>
            </View>
            <View style={styles.iconDivider} />
            <View style={styles.iconItem}>
              <MaterialCommunityIcons name="bell-ring" size={28} color="#FFFFFF" />
              <Text style={styles.iconText}>Notified</Text>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    gradientBg: {
      ...StyleSheet.absoluteFillObject,
    },
    contentContainer: {
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    checkCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      marginBottom: 30,
      ...Platform.select({
        ios: {
          shadowColor: '#00c853',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
        },
        android: {
          elevation: 15,
        },
        web: {
          boxShadow: '0 8px 30px rgba(0, 200, 83, 0.5)',
        },
      }),
    },
    checkGradient: {
      width: 120,
      height: 120,
      borderRadius: 60,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkIconContainer: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 32,
      fontWeight: '800',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 12,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    subtitle: {
      fontSize: 18,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.95)',
      textAlign: 'center',
      marginBottom: 4,
    },
    companyText: {
      fontSize: 17,
      fontWeight: '500',
      color: '#4ECDC4',
      textAlign: 'center',
      marginBottom: 12,
    },
    subSubtitle: {
      fontSize: 14,
      fontWeight: '400',
      color: 'rgba(255, 255, 255, 0.7)',
      textAlign: 'center',
      marginBottom: 40,
    },
    iconsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      borderRadius: 20,
      paddingVertical: 16,
      paddingHorizontal: 24,
      marginTop: 10,
    },
    iconItem: {
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    iconText: {
      fontSize: 12,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.9)',
      marginTop: 6,
    },
    iconDivider: {
      width: 1,
      height: 40,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
  });
