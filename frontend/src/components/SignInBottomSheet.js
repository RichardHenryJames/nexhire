/**
 * SignInBottomSheet — Reusable floating sign-in prompt
 * 
 * Shows a fixed bottom sheet with Google Sign-In for non-logged-in users.
 * Auto-appears after a configurable delay. Dismissible.
 * 
 * Usage:
 *   <SignInBottomSheet 
 *     title="Sign in to create your resume"
 *     subtitle="Save your work and access premium templates"
 *     delayMs={2000}
 *   />
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import GoogleSignInButton from './GoogleSignInButton';

export default function SignInBottomSheet({
  title = 'Sign in for a better experience',
  subtitle = 'Track your progress and get personalized recommendations',
  delayMs = 2000,
}) {
  const { user, loginWithGoogle, googleAuthAvailable } = useAuth();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  // Auto-show after delay for non-logged-in users
  useEffect(() => {
    if (!user && googleAuthAvailable) {
      const timer = setTimeout(() => {
        setVisible(true);
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }).start();
      }, delayMs);
      return () => clearTimeout(timer);
    }
  }, [user, googleAuthAvailable, anim, delayMs]);

  const dismiss = useCallback(() => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [anim]);

  const handleSignIn = useCallback(async () => {
    try {
      setLoading(true);
      const result = await loginWithGoogle({ skipRedirect: true });
      if (result?.success) {
        dismiss();
      }
    } catch (err) {
      // Error handled by auth context
    } finally {
      setLoading(false);
    }
  }, [loginWithGoogle, dismiss]);

  if (!visible || user) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.surface },
        {
          transform: [{
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [300, 0],
            }),
          }],
          opacity: anim,
        },
      ]}
    >
      <TouchableOpacity style={styles.dismissBtn} onPress={dismiss}>
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Ionicons name="person-circle-outline" size={40} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

        <GoogleSignInButton
          onPress={handleSignIn}
          loading={loading}
          style={styles.googleBtn}
        />

        <TouchableOpacity onPress={dismiss}>
          <Text style={[styles.dismissText, { color: colors.textSecondary }]}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 1000,
  },
  dismissBtn: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  googleBtn: {
    width: '100%',
    marginBottom: 12,
  },
  dismissText: {
    fontSize: 14,
    paddingVertical: 8,
  },
});
