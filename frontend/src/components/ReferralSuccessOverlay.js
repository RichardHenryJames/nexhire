import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
  Image,
  TouchableOpacity,
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
 * User must manually close via the X button.
 */
export default function ReferralSuccessOverlay({
  visible,
  onComplete,
  companyName = '',
  broadcastTime = null, // Time in seconds (e.g., 2.3)
  isOpenToAny = false,
}) {
  const { colors, isDarkMode } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDarkMode), [colors, isDarkMode]);
  
  // Animations
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(20)).current;
  const broadcastOpacity = useRef(new Animated.Value(0)).current;
  const broadcastTranslateY = useRef(new Animated.Value(15)).current;
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
      logoOpacity.setValue(0);
      logoScale.setValue(0.5);
      checkScale.setValue(0);
      checkOpacity.setValue(0);
      titleOpacity.setValue(0);
      titleTranslateY.setValue(30);
      subtitleOpacity.setValue(0);
      subtitleTranslateY.setValue(20);
      broadcastOpacity.setValue(0);
      broadcastTranslateY.setValue(15);

      // Start animations sequence
      Animated.sequence([
        // Logo animation first
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            friction: 6,
            useNativeDriver: true,
          }),
        ]),
        // Check mark animation
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
        // Broadcast time animation
        Animated.parallel([
          Animated.timing(broadcastOpacity, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.spring(broadcastTranslateY, {
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

      // No auto-dismiss - user closes manually
    }
  }, [visible]);

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

        {/* Close Button at Top Right */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onComplete}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={28} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

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
          {/* RefOpen Logo at Top - using refopen-logo.png (532x131, 51KB) */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image
              source={require('../../assets/refopen-logo.png')}
              style={styles.logo}
              resizeMode="contain"
              fadeDuration={0}
            />
          </Animated.View>

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
            <Text style={styles.title}>
              {isOpenToAny
                ? 'Your request is live! Referrers will reach out when they find a match 🎉'
                : `Referral request sent to employees of ${companyName || 'the company'} 🎉`}
            </Text>
          </Animated.View>

          {/* Broadcast Time */}
          <Animated.View
            style={[
              styles.broadcastContainer,
              {
                opacity: broadcastOpacity,
                transform: [{ translateY: broadcastTranslateY }],
              },
            ]}
          >
            <Text style={styles.broadcastText}>
              Broadcast completed in <Text style={styles.broadcastTimeBold}>{broadcastTime ? broadcastTime.toFixed(1) : '2.0'} Sec</Text>
            </Text>
            <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFD700" style={styles.lightningIcon} />
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
    closeButton: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : 40,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    contentContainer: {
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    logoContainer: {
      marginBottom: 20,
    },
    logo: {
      width: 160,  // refopen-logo.png is 532x131, aspect ratio ~4:1
      height: 40,
    },
    checkCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      marginBottom: 24,
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
      width: 100,
      height: 100,
      borderRadius: 50,
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
      fontSize: 22,
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 20,
      paddingHorizontal: 10,
      lineHeight: 30,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    broadcastContainer: {
    },
    broadcastContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 215, 0, 0.15)',
      borderRadius: 20,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: 'rgba(255, 215, 0, 0.3)',
    },
    broadcastText: {
      fontSize: 15,
      fontWeight: '500',
      color: 'rgba(255, 255, 255, 0.9)',
    },
    broadcastTimeBold: {
      fontWeight: '800',
      color: '#FFFFFF',
    },
    lightningIcon: {
      marginLeft: 6,
    },
  });
