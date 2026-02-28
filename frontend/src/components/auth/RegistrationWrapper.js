import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { authDarkColors } from '../../styles/authDarkColors';
import { typography } from '../../styles/theme';
import useResponsive from '../../hooks/useResponsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * RegistrationWrapper - Premium wrapper for all registration screens
 * Provides: gradient background, step progress, back nav, trust footer, fade-in
 */
export default function RegistrationWrapper({
  children,
  currentStep = 1,
  totalSteps = 4,
  onBack,
  stepLabel = '',
  showTrustBadge = true,
  showProgress = true,
}) {
  const colors = authDarkColors;
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // Subtle fade-in on mount
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const progress = totalSteps > 0 ? currentStep / totalSteps : 0;

  return (
    <View style={styles.root}>
      {/* Gradient background */}
      <LinearGradient
        colors={['#0F172A', '#131D32', '#0F172A']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Decorative accent orbs */}
      <View style={styles.orbTopRight} pointerEvents="none" />
      <View style={styles.orbBottomLeft} pointerEvents="none" />

      {/* Top navigation bar */}
      <View style={styles.topNav}>
        {onBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#94A3B8" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}

        {showProgress && totalSteps > 1 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progress * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {stepLabel || `Step ${currentStep} of ${totalSteps}`}
            </Text>
          </View>
        )}

        <View style={{ width: 40 }} />
      </View>

      {/* Animated content */}
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {children}
      </Animated.View>

      {/* Trust footer */}
      {showTrustBadge && (
        <View style={styles.trustFooter}>
          <Ionicons name="shield-checkmark" size={14} color="#64748B" />
          <Text style={styles.trustText}>
            Your data is encrypted & secure
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors, responsive = {}) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#0F172A',
      overflow: 'hidden',
    },
    orbTopRight: {
      position: 'absolute',
      top: -60,
      right: -60,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: 'rgba(59, 130, 246, 0.06)',
    },
    orbBottomLeft: {
      position: 'absolute',
      bottom: -60,
      left: -60,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: 'rgba(139, 92, 246, 0.05)',
    },
    topNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'web' ? 20 : 12,
      paddingBottom: 8,
      zIndex: 10,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: 'rgba(148, 163, 184, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressContainer: {
      flex: 1,
      alignItems: 'center',
      marginHorizontal: 16,
    },
    progressTrack: {
      width: '100%',
      maxWidth: 200,
      height: 4,
      backgroundColor: 'rgba(148, 163, 184, 0.15)',
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#3B82F6',
      borderRadius: 2,
    },
    progressText: {
      fontSize: 11,
      color: '#64748B',
      marginTop: 4,
      fontWeight: '500',
      letterSpacing: 0.3,
    },
    contentWrapper: {
      flex: 1,
    },
    trustFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 6,
    },
    trustText: {
      fontSize: 11,
      color: '#64748B',
      fontWeight: '500',
      letterSpacing: 0.2,
    },
  });
