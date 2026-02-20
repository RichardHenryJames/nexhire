/**
 * SwipeableTabView — Wraps tab screen content to enable swipe gestures between tabs.
 *
 * Swipe left  → navigate to next tab
 * Swipe right → navigate to previous tab
 *
 * Uses react-native-gesture-handler PanGestureHandler for reliable gesture detection.
 * Only triggers on clearly horizontal swipes. Vertical scroll is not affected.
 */
import React, { useCallback } from 'react';
import { Animated, Platform } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useNavigation, useNavigationState } from '@react-navigation/native';

const SWIPE_DISTANCE = 50; // Minimum horizontal distance to trigger
const VELOCITY_THRESHOLD = 400; // Or high velocity swipe

export default function SwipeableTabView({ children }) {
  // Skip on web — web has no finger swipe
  if (Platform.OS === 'web') return <>{children}</>;

  const navigation = useNavigation();

  // Get current tab index and tab route names from navigation state
  const tabIndex = useNavigationState(state => state.index);
  const routeNames = useNavigationState(state => state.routeNames);

  const onHandlerStateChange = useCallback(({ nativeEvent }) => {
    if (nativeEvent.state !== State.END) return;

    const { translationX, translationY, velocityX } = nativeEvent;

    // Ignore if vertical component is dominant (user is scrolling content)
    if (Math.abs(translationY) > Math.abs(translationX)) return;

    const hasDistance = Math.abs(translationX) > SWIPE_DISTANCE;
    const hasVelocity = Math.abs(velocityX) > VELOCITY_THRESHOLD;
    if (!hasDistance && !hasVelocity) return;

    // Swipe left (negative) → next tab
    if (translationX < 0 && tabIndex < routeNames.length - 1) {
      navigation.navigate(routeNames[tabIndex + 1]);
      return;
    }

    // Swipe right (positive) → previous tab
    if (translationX > 0 && tabIndex > 0) {
      navigation.navigate(routeNames[tabIndex - 1]);
    }
  }, [tabIndex, routeNames, navigation]);

  return (
    <PanGestureHandler
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-25, 25]}
      failOffsetY={[-12, 12]}
    >
      <Animated.View style={{ flex: 1 }}>
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
}
