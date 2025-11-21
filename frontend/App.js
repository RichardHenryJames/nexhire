import React, { useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/contexts/AuthContext';
import { JobProvider } from './src/contexts/JobContext';
import AppNavigator, { linking } from './src/navigation/AppNavigator';
import { ToastHost } from './src/components/Toast';
import { colors } from './src/styles/theme';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = React.useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make any API calls you need to do here
        console.log('[App] Initializing...');
        // Immediately mark as ready - no unnecessary delays
        setAppIsReady(true);
      } catch (e) {
        console.error('[App] Error during initialization:', e);
        // Still mark as ready to prevent infinite loading
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // This tells the splash screen to hide immediately
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <AuthProvider>
        <JobProvider>
          <NavigationContainer linking={linking}>
            <StatusBar style="light" backgroundColor={colors.primary} />
            <AppNavigator />
            {/* Global toast overlay */}
            <ToastHost />
          </NavigationContainer>
        </JobProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}