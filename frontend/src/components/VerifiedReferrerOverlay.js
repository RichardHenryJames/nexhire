import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

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
 * 🎉 Verified Referrer Overlay
 * Shows a beautiful animated success UI with confetti when user becomes a verified referrer.
 * Does NOT auto-close - user must press the close button.
 */
export default function VerifiedReferrerOverlay({
  visible,
  onClose,
  companyName = '',
}) {
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(colors, isDarkMode), [colors, isDarkMode]);
  
  // Animations
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(30)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  // Confetti colors - celebratory gold/green theme
  const confettiColors = [
    '#FFD700', '#FFA500', '#00c853', '#69f0ae', '#4CAF50',
    '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800',
    '#00BCD4', '#03A9F4', '#2196F3', '#9C27B0', '#E91E63',
  ];

  // Generate confetti particles
  const confettiParticles = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      delay: Math.random() * 800,
      startX: Math.random() * SCREEN_WIDTH,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      size: 8 + Math.random() * 12,
    }));
  }, []);

  // Generate sparkles
  const sparkles = useMemo(() => {
    const centerX = SCREEN_WIDTH / 2;
    const centerY = 140;
    return Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * 2 * Math.PI;
      const radius = 100 + Math.random() * 30;
      return {
        id: i,
        x: centerX + Math.cos(angle) * radius - 8,
        y: centerY + Math.sin(angle) * radius - 8,
        delay: i * 80,
      };
    });
  }, []);

  useEffect(() => {
    if (visible) {
      // Reset animations
      checkScale.setValue(0);
      checkOpacity.setValue(0);
      contentOpacity.setValue(0);
      contentTranslateY.setValue(30);

      // Start animations sequence
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
        // Content animation
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.spring(contentTranslateY, {
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
    }
  }, [visible]);

  if (!visible) return null;

  const benefits = [
    {
      icon: 'cash-multiple',
      title: 'Earn up to ₹100 per Referral',
      description: 'Get up to ₹100 credited to your wallet when you successfully refer someone',
      highlight: true,
    },
    {
      icon: 'account-check',
      title: 'Refer Qualified Candidates',
      description: 'Only refer candidates who match the job requirements to maintain your referrer rating',
    },
    {
      icon: 'star-shooting',
      title: 'Boost Your Engagement Score',
      description: 'Complete more referrals to increase your visibility and get matched with more requests',
    },
    {
      icon: 'trophy-award',
      title: 'Unlock Rewards & Badges',
      description: 'Earn exclusive badges and bonus rewards as you complete more successful referrals',
    },
    {
      icon: 'bell-ring',
      title: 'Get Notified First',
      description: 'Receive instant notifications when someone requests a referral at your company',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Gradient Background */}
        <LinearGradient
          colors={['#0d1117', '#161b22', '#1a2332']}
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

        {/* Close Button - Top Right */}
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Scrollable Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
                <Ionicons name="shield-checkmark" size={48} color="#FFFFFF" />
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Main Content */}
          <Animated.View
            style={[
              styles.contentContainer,
              {
                opacity: contentOpacity,
                transform: [{ translateY: contentTranslateY }],
              },
            ]}
          >
            {/* Title */}
            <Text style={styles.title}>You're a Verified Referrer! 🎉</Text>
            
            {/* Company Name */}
            <View style={styles.companyBadge}>
              <MaterialCommunityIcons name="office-building" size={20} color="#00c853" />
              <Text style={styles.companyText}>{companyName || 'Your Company'}</Text>
              <Ionicons name="checkmark-circle" size={18} color="#00c853" />
            </View>

            {/* Access Info */}
            <View style={styles.accessCard}>
              <View style={styles.accessIconContainer}>
                <Ionicons name="people" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.accessTextContainer}>
                <Text style={styles.accessTitle}>"Refer" Tab Unlocked</Text>
                <Text style={styles.accessSubtitle}>
                  You can now see and claim referral requests from job seekers at {companyName || 'your company'}
                </Text>
              </View>
            </View>

            {/* Benefits Section */}
            <Text style={styles.sectionTitle}>Your Referrer Benefits</Text>
            
            {benefits.map((benefit, index) => (
              <View 
                key={index} 
                style={[
                  styles.benefitCard,
                  benefit.highlight && styles.benefitCardHighlight
                ]}
              >
                <View style={[
                  styles.benefitIconContainer,
                  benefit.highlight && styles.benefitIconHighlight
                ]}>
                  <MaterialCommunityIcons 
                    name={benefit.icon} 
                    size={24} 
                    color={benefit.highlight ? '#FFD700' : '#00c853'} 
                  />
                </View>
                <View style={styles.benefitTextContainer}>
                  <Text style={[
                    styles.benefitTitle,
                    benefit.highlight && styles.benefitTitleHighlight
                  ]}>
                    {benefit.title}
                  </Text>
                  <Text style={styles.benefitDescription}>{benefit.description}</Text>
                </View>
              </View>
            ))}

            {/* Tips Section */}
            <View style={styles.tipsCard}>
              <View style={styles.tipsHeader}>
                <Ionicons name="bulb" size={22} color="#FFC107" />
                <Text style={styles.tipsTitle}>Pro Tips for Referrers</Text>
              </View>
              <View style={styles.tipItem}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>Review candidate's resume before referring to ensure quality matches</Text>
              </View>
              <View style={styles.tipItem}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>Respond to referral requests quickly to get more rewards</Text>
              </View>
              <View style={styles.tipItem}>
                <Text style={styles.tipBullet}>•</Text>
                <Text style={styles.tipText}>Add a personal note when submitting referrals to boost approval chances</Text>
              </View>
            </View>

            {/* CTA Button */}
            <TouchableOpacity 
              style={styles.ctaButton} 
              onPress={() => {
                onClose();
                // Navigate to Referral screen (useFocusEffect will auto-reload)
                navigation.navigate('Referral');
              }}
            >
              <LinearGradient
                colors={['#00c853', '#00e676']}
                style={styles.ctaGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.ctaText}>Start Referring & Earning!</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (colors, isDarkMode) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      overflow: 'hidden',
    },
    gradientBg: {
      ...StyleSheet.absoluteFillObject,
    },
    closeButton: {
      position: 'absolute',
      top: Platform.OS === 'web' ? 20 : 50,
      right: 20,
      zIndex: 100,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: Platform.OS === 'web' ? 60 : 90,
      paddingBottom: 40,
      paddingHorizontal: 24,
      alignItems: 'center',
    },
    checkCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      overflow: 'hidden',
      marginBottom: 24,
      shadowColor: '#00c853',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 10,
    },
    checkGradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkIconContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    contentContainer: {
      width: '100%',
      maxWidth: 500,
      alignItems: 'center',
    },
    title: {
      fontSize: 26,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 16,
    },
    companyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 200, 83, 0.15)',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 25,
      marginBottom: 24,
      gap: 8,
    },
    companyText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    accessCard: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 16,
      padding: 16,
      marginBottom: 28,
      width: '100%',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(0, 200, 83, 0.3)',
    },
    accessIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(0, 200, 83, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    accessTextContainer: {
      flex: 1,
    },
    accessTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: '#00e676',
      marginBottom: 4,
    },
    accessSubtitle: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.7)',
      lineHeight: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 16,
      alignSelf: 'flex-start',
    },
    benefitCard: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      width: '100%',
      alignItems: 'flex-start',
    },
    benefitCardHighlight: {
      backgroundColor: 'rgba(255, 215, 0, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255, 215, 0, 0.3)',
    },
    benefitIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0, 200, 83, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    benefitIconHighlight: {
      backgroundColor: 'rgba(255, 215, 0, 0.2)',
    },
    benefitTextContainer: {
      flex: 1,
    },
    benefitTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: 3,
    },
    benefitTitleHighlight: {
      color: '#FFD700',
    },
    benefitDescription: {
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.6)',
      lineHeight: 18,
    },
    tipsCard: {
      backgroundColor: 'rgba(255, 193, 7, 0.1)',
      borderRadius: 14,
      padding: 16,
      marginTop: 12,
      marginBottom: 24,
      width: '100%',
      borderWidth: 1,
      borderColor: 'rgba(255, 193, 7, 0.2)',
    },
    tipsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    tipsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFC107',
    },
    tipItem: {
      flexDirection: 'row',
      marginBottom: 8,
      paddingRight: 8,
    },
    tipBullet: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.5)',
      marginRight: 8,
      marginTop: 1,
    },
    tipText: {
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.7)',
      lineHeight: 19,
      flex: 1,
    },
    ctaButton: {
      width: '100%',
      borderRadius: 14,
      overflow: 'hidden',
      shadowColor: '#00c853',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    ctaGradient: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 16,
      gap: 10,
    },
    ctaText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
