import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

/**
 * 🎉 Referral Success Overlay — GPay/PhonePe style
 * Fast green tick animation → text → done. No confetti, no particles.
 */
export default function ReferralSuccessOverlay({
  visible,
  onComplete,
  companyName = '',
  broadcastTime = null,
  isOpenToAny = false,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const circleScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0.3)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(15)).current;
  const ringScale = useRef(new Animated.Value(0.8)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset
      overlayOpacity.setValue(0);
      circleScale.setValue(0);
      checkOpacity.setValue(0);
      checkScale.setValue(0.3);
      textOpacity.setValue(0);
      textTranslateY.setValue(15);
      ringScale.setValue(0.8);
      ringOpacity.setValue(0);

      // Fast sequence — total ~700ms
      Animated.sequence([
        // 1. Overlay fade in (100ms)
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: Platform.OS !== 'web',
        }),
        // 2. Green circle + ring burst + checkmark (300ms)
        Animated.parallel([
          Animated.spring(circleScale, {
            toValue: 1,
            friction: 5,
            tension: 100,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.sequence([
            Animated.delay(100),
            Animated.parallel([
              Animated.spring(checkScale, {
                toValue: 1,
                friction: 4,
                tension: 120,
                useNativeDriver: Platform.OS !== 'web',
              }),
              Animated.timing(checkOpacity, {
                toValue: 1,
                duration: 150,
                useNativeDriver: Platform.OS !== 'web',
              }),
            ]),
          ]),
          // Ring burst effect
          Animated.parallel([
            Animated.timing(ringScale, {
              toValue: 1.6,
              duration: 400,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.sequence([
              Animated.timing(ringOpacity, {
                toValue: 0.6,
                duration: 150,
                useNativeDriver: Platform.OS !== 'web',
              }),
              Animated.timing(ringOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: Platform.OS !== 'web',
              }),
            ]),
          ]),
        ]),
        // 3. Text slide up (200ms)
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.spring(textTranslateY, {
            toValue: 0,
            friction: 8,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const successMessage = isOpenToAny
    ? 'Broadcast to all company referrers'
    : `Referrers at ${companyName || 'the company'} will be notified`;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onComplete} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        <View style={styles.center}>
          {/* Ring burst */}
          <Animated.View style={[styles.ring, {
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          }]} />

          {/* Green circle with checkmark */}
          <Animated.View style={[styles.circle, { transform: [{ scale: circleScale }] }]}>
            <Animated.View style={{ opacity: checkOpacity, transform: [{ scale: checkScale }] }}>
              <Ionicons name="checkmark-sharp" size={52} color="#FFFFFF" />
            </Animated.View>
          </Animated.View>

          {/* Text */}
          <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textTranslateY }], alignItems: 'center', marginTop: 28 }}>
            <Text style={styles.title}>Referral Request Sent!</Text>
            <Text style={styles.subtitle}>{successMessage}</Text>
            {broadcastTime && (
              <View style={styles.timeBadge}>
                <Ionicons name="flash" size={14} color="#FFD700" />
                <Text style={styles.timeText}>
                  Broadcast in {broadcastTime.toFixed(1)}s
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#22C55E',
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20 },
      android: { elevation: 12 },
      web: { boxShadow: '0 0 40px rgba(34, 197, 94, 0.5)' },
    }),
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 16,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,215,0,0.12)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
});
