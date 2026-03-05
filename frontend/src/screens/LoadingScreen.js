import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Image,
  Platform,
} from 'react-native';
import { authDarkColors } from '../styles/authDarkColors';

/**
 * LoadingScreen — Minimal, professional splash
 * Inspired by: Stripe, Linear, Notion, Slack
 * 
 * Just logo + subtle fade-in + thin sliding progress bar. Nothing else.
 */

// Thin sliding progress indicator
function SlideProgress({ colors }) {
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={{ width: 120, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
      <Animated.View
        style={{
          width: '40%',
          height: '100%',
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.7)',
          transform: [{
            translateX: translateX.interpolate({
              inputRange: [0, 1],
              outputRange: [-48, 120],
            }),
          }],
        }}
      />
    </View>
  );
}

export default function LoadingScreen() {
  const colors = authDarkColors;
  const styles = useMemo(() => createStyles(colors), []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        {Platform.OS === 'web' ? (
          <Image
            source={{ uri: '/refopen-logo.png' }}
            style={styles.logo}
            resizeMode="contain"
          />
        ) : (
          <Image
            source={require('../../assets/refopen-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        )}
        <SlideProgress colors={colors} />
      </Animated.View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  logo: {
    width: 180,
    height: 50,
    tintColor: '#FFFFFF',
    marginBottom: 40,
  },
});