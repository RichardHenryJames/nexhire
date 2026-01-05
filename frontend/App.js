import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { JobProvider } from './src/contexts/JobContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { PricingProvider } from './src/contexts/PricingContext';
import AppNavigator, { linking } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { ToastHost } from './src/components/Toast';

function ThemedAppRoot() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    // Always use dark background for web to match auth screens
    // Auth screens always use dark mode, so we use dark colors for consistency
    const darkBackground = '#0F172A'; // Same as auth screen gradient start
    const fallbackGradient = `linear-gradient(135deg, ${darkBackground}, #1E293B, ${darkBackground})`;

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

    // Hide scrollbars globally but allow scrolling
    const style = document.createElement('style');
    style.textContent = `
      * {
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE and Edge */
      }
      *::-webkit-scrollbar {
        display: none; /* Chrome, Safari, Opera */
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [colors, isDark]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <PricingProvider>
          <AuthProvider>
            <JobProvider>
              <NavigationContainer
                ref={navigationRef}
                linking={linking}
                documentTitle={{
                  formatter: (options, route) => {
                    const title = options?.title ?? route?.name;
                    if (!title || title === 'RefOpen') return 'RefOpen - Job Referral Platform';
                    if (title.includes('RefOpen')) return title;
                    return `${title} | RefOpen`;
                  },
                }}
              >
                <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
                <AppNavigator />
                {/* Global toast overlay */}
                <ToastHost />
              </NavigationContainer>
            </JobProvider>
          </AuthProvider>
        </PricingProvider>
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