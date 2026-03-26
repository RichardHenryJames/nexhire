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
import useResponsive from '../../hooks/useResponsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * RegistrationWrapper — Premium wrapper for all registration screens.
 *
 * Features:
 *   • Gradient dark background with decorative orbs
 *   • Step dot indicator with connecting lines & pulse on current step
 *   • Fade-in content entrance
 *   • Desktop: floating card with subtle shadow
 *   • Trust footer badge
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

  // ── Content fade-in ────────────────────────────────────
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

  // ── Pulse ring for current step dot ─────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
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
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={styles.root}>
      {/* Gradient background */}
      <LinearGradient
        colors={colors.gradientBackground}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Decorative accent orbs */}
      <View style={styles.orbTopRight} pointerEvents="none" />
      <View style={styles.orbBottomLeft} pointerEvents="none" />

      {/* ── Top navigation bar ─────────────────────────── */}
      <View style={styles.topNav}>
        {onBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}

        {/* ── Step dot indicator ──────────────────────── */}
        {showProgress && totalSteps > 1 && (
          <View style={styles.stepIndicator}>
            <View style={styles.stepsRow}>
              {Array.from({ length: totalSteps }, (_, i) => {
                const stepNum = i + 1;
                const isCompleted = stepNum < currentStep;
                const isCurrent = stepNum === currentStep;

                return (
                  <React.Fragment key={i}>
                    {/* Connecting line */}
                    {i > 0 && (
                      <View
                        style={[
                          styles.stepLine,
                          isCompleted && styles.stepLineCompleted,
                          isCurrent && styles.stepLineActive,
                        ]}
                      />
                    )}

                    {/* Dot */}
                    {isCurrent ? (
                      <View style={styles.stepDotCurrentWrap}>
                        {/* Animated pulse ring */}
                        <Animated.View
                          style={[
                            styles.stepPulseRing,
                            { transform: [{ scale: pulseAnim }] },
                          ]}
                        />
                        <View style={[styles.stepDot, styles.stepDotCurrent]}>
                          <Text style={styles.stepDotTextCurrent}>{stepNum}</Text>
                        </View>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.stepDot,
                          isCompleted && styles.stepDotCompleted,
                        ]}
                      >
                        {isCompleted ? (
                          <Ionicons name="checkmark" size={13} color="#fff" />
                        ) : (
                          <Text style={styles.stepDotText}>{stepNum}</Text>
                        )}
                      </View>
                    )}
                  </React.Fragment>
                );
              })}
            </View>

            {/* Current step label */}
            {stepLabel ? (
              <Text style={styles.stepLabelText}>{stepLabel}</Text>
            ) : null}
          </View>
        )}

        <View style={{ width: 40 }} />
      </View>

      {/* ── Animated content ───────────────────────────── */}
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Desktop: wrap in a floating card */}
        {Platform.OS === 'web' && responsive.isDesktop ? (
          <View style={styles.desktopCardOuter}>
            <View style={styles.desktopCard}>{children}</View>
          </View>
        ) : (
          children
        )}
      </Animated.View>

      {/* ── Trust footer ───────────────────────────────── */}
      {showTrustBadge && (
        <View style={styles.trustFooter}>
          <Ionicons name="shield-checkmark" size={14} color={colors.textMuted} />
          <Text style={styles.trustText}>
            Your data is encrypted & secure
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const createStyles = (colors, responsive = {}) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },

    /* ── Decorative orbs ──────────────── */
    orbTopRight: {
      position: 'absolute',
      top: -60,
      right: -60,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: colors.primaryGlowSubtle,
    },
    orbBottomLeft: {
      position: 'absolute',
      bottom: -60,
      left: -60,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: colors.accentGlowSubtle,
    },

    /* ── Top nav ──────────────────────── */
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
      backgroundColor: colors.overlayLight,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* ── Step dot indicator ────────────── */
    stepIndicator: {
      flex: 1,
      alignItems: 'center',
      marginHorizontal: 16,
    },
    stepsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.stepUpcoming,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    stepDotCompleted: {
      backgroundColor: colors.stepCompleted,
      borderColor: colors.stepCompleted,
    },
    stepDotCurrent: {
      backgroundColor: colors.stepActive,
      borderColor: colors.stepActive,
    },
    stepDotCurrentWrap: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepPulseRing: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    stepDotText: {
      fontSize: 12,
      fontWeight: '700',
      color: 'rgba(255, 255, 255, 0.35)',
    },
    stepDotTextCurrent: {
      fontSize: 12,
      fontWeight: '700',
      color: '#fff',
    },
    stepLine: {
      width: 24,
      height: 2,
      backgroundColor: colors.stepLine,
      marginHorizontal: 4,
      borderRadius: 1,
    },
    stepLineCompleted: {
      backgroundColor: colors.stepLineCompleted,
    },
    stepLineActive: {
      backgroundColor: colors.stepLineActive,
    },
    stepLabelText: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 6,
      fontWeight: '500',
      letterSpacing: 0.3,
    },

    /* ── Content ──────────────────────── */
    contentWrapper: {
      flex: 1,
    },
    desktopCardOuter: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
    },
    desktopCard: {
      flex: 1,
      width: '100%',
      maxWidth: 640,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? { boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }
        : {}),
    },

    /* ── Trust footer ─────────────────── */
    trustFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 6,
    },
    trustText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '500',
      letterSpacing: 0.2,
    },
  });
