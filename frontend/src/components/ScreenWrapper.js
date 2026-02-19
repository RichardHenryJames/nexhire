/**
 * ScreenWrapper — Universal screen container for native + web
 *
 * Provides:
 * - SafeAreaView on native (top + bottom insets via react-native-safe-area-context)
 * - KeyboardAvoidingView on iOS (behavior="padding") when `withKeyboard` is true
 * - Consistent background from theme
 * - Flex:1 container ready for scrollable or non-scrollable children
 *
 * Usage:
 *   <ScreenWrapper>               // plain safe-area wrapper
 *   <ScreenWrapper withKeyboard>  // + KeyboardAvoidingView on iOS
 */

import React from 'react';
import { View, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

export default function ScreenWrapper({ children, withKeyboard = false, style, edges }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // By default pad top on native; bottom is handled by tab-bar or child padding
  const safeStyle = Platform.OS !== 'web'
    ? { paddingTop: edges?.includes('top') === false ? 0 : insets.top }
    : {};

  const containerStyle = [
    styles.container,
    { backgroundColor: colors.background },
    safeStyle,
    style,
  ];

  if (withKeyboard && Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={containerStyle}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
