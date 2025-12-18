import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { JobProvider } from './src/contexts/JobContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import AppNavigator, { linking } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { ToastHost } from './src/components/Toast';

function ThemedAppRoot() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    // Match the auth/loading background so any uncovered area
    // doesn't show as a different color on web.
    const fallbackGradient = isDark
      ? `linear-gradient(135deg, ${colors.background}, ${colors.surface}, ${colors.background})`
      : `linear-gradient(135deg, ${colors.primaryLight}, ${colors.primary}, ${colors.primaryLight})`;

    document.documentElement.style.background = fallbackGradient;
    document.body.style.background = fallbackGradient;
    document.documentElement.style.minHeight = '100vh';
    document.body.style.minHeight = '100vh';
    document.body.style.margin = '0';

    const root = document.getElementById('root');
    if (root) {
      root.style.minHeight = '100vh';
      root.style.background = fallbackGradient;
    }
  }, [colors, isDark]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <AuthProvider>
          <JobProvider>
            <NavigationContainer ref={navigationRef} linking={linking}>
              <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
              <AppNavigator />
              {/* Global toast overlay */}
              <ToastHost />
            </NavigationContainer>
          </JobProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedAppRoot />
    </ThemeProvider>
  );
}