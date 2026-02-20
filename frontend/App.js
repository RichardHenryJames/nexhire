// gesture-handler MUST be the very first import for @react-navigation/stack on native
import 'react-native-gesture-handler';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Platform, View, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { JobProvider } from './src/contexts/JobContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { PricingProvider } from './src/contexts/PricingContext';
import { UnreadMessagesProvider } from './src/contexts/UnreadMessagesContext';
import AppNavigator, { linking } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { ToastHost } from './src/components/Toast';
import TermsConsentModal from './src/components/modals/TermsConsentModal';
import refopenAPI from './src/services/api';
import { frontendConfig } from './src/config/appConfig';
import {
  configureForegroundHandler,
  setupNotificationResponseListener,
  registerForPushNotifications,
} from './src/services/pushNotifications';

// Activity Tracking Helper Functions
const generateSessionId = () => `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getSessionId = async () => {
  try {
    let sessionId = await AsyncStorage.getItem('refopen_session_id');
    const sessionTime = await AsyncStorage.getItem('refopen_session_time');
    const thirtyMinsAgo = Date.now() - (30 * 60 * 1000);
    if (!sessionId || !sessionTime || parseInt(sessionTime) < thirtyMinsAgo) {
      sessionId = generateSessionId();
      await AsyncStorage.setItem('refopen_session_id', sessionId);
    }
    await AsyncStorage.setItem('refopen_session_time', Date.now().toString());
    return sessionId;
  } catch (error) {
    return generateSessionId();
  }
};

const getDeviceInfo = () => {
  const platform = Platform.OS === 'web' ? 'web' : Platform.OS;
  let deviceType = 'mobile';
  let browser = null;
  
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const width = window.innerWidth;
    deviceType = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
    const ua = navigator.userAgent;
    browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : 
              ua.includes('Safari') ? 'Safari' : ua.includes('Edge') ? 'Edge' : 'Other';
  }
  
  return { platform, deviceType, browser };
};

/**
 * ConsentGate — Shows a blocking modal when the user's accepted T&C/Privacy version
 * is older than the current required version. DPDPA 2023 compliance.
 */
function ConsentGate() {
  const { user, isAuthenticated, checkAuthState } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const requiredTerms = frontendConfig.legal.termsVersion;
  const requiredPrivacy = frontendConfig.legal.privacyPolicyVersion;

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setShowModal(false);
      return;
    }
    // Compare user's accepted version vs current required version
    const userTerms = user.TermsVersion || null;
    const userPrivacy = user.PrivacyPolicyVersion || null;
    const needsReConsent = userTerms !== requiredTerms || userPrivacy !== requiredPrivacy;
    setShowModal(needsReConsent);
  }, [isAuthenticated, user, requiredTerms, requiredPrivacy]);

  const handleAccept = async () => {
    try {
      setAccepting(true);
      const result = await refopenAPI.acceptTerms(requiredTerms, requiredPrivacy);
      if (result.success) {
        // Refresh user profile so the new versions are reflected
        await checkAuthState();
        setShowModal(false);
      }
    } catch (error) {
      console.error('Failed to accept terms:', error);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <TermsConsentModal
      visible={showModal}
      onAccept={handleAccept}
      loading={accepting}
    />
  );
}

function ThemedAppRoot() {
  const { colors, isDark } = useTheme();
  const routeNameRef = useRef();
  const currentActivityIdRef = useRef(null);
  const appState = useRef(AppState.currentState);

  // Build navigation theme to prevent white flash on screen transitions
  const navigationTheme = React.useMemo(() => ({
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface || colors.background,
      border: colors.border || '#E0E0E0',
      text: colors.textPrimary || colors.text,
    },
  }), [isDark, colors]);

  // Track screen view
  const trackScreenView = useCallback(async (screenName, previousScreen = null) => {
    try {
      const token = await AsyncStorage.getItem('refopen_token');
      if (!token) return; // Don't track if not logged in

      const sessionId = await getSessionId();
      const { platform, deviceType, browser } = getDeviceInfo();

      const response = await refopenAPI.apiCall('/activity/log', {
        method: 'POST',
        body: JSON.stringify({
          screenName,
          action: 'view',
          sessionId,
          platform,
          deviceType,
          browser,
          referrerScreen: previousScreen
        })
      });

      if (response.success && response.data?.activityId) {
        currentActivityIdRef.current = response.data.activityId;
      }
    } catch (error) {
      // Silent fail - don't interrupt user experience
      console.debug('Activity tracking:', error.message);
    }
  }, []);

  // Track screen exit (to calculate duration)
  const trackScreenExit = useCallback(async () => {
    try {
      if (!currentActivityIdRef.current) return;
      const token = await AsyncStorage.getItem('refopen_token');
      if (!token) return;

      await refopenAPI.apiCall('/activity/exit', {
        method: 'POST',
        body: JSON.stringify({ activityId: currentActivityIdRef.current })
      });
      currentActivityIdRef.current = null;
    } catch (error) {
      // Silent fail
    }
  }, []);

  // Handle navigation state changes
  const onNavigationStateChange = useCallback(async () => {
    const previousRouteName = routeNameRef.current;
    const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;

    if (previousRouteName !== currentRouteName && currentRouteName) {
      // Log exit for previous screen
      await trackScreenExit();
      // Log view for new screen
      await trackScreenView(currentRouteName, previousRouteName);
    }

    routeNameRef.current = currentRouteName;
  }, [trackScreenView, trackScreenExit]);

  // Track app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async nextAppState => {
      const currentRoute = navigationRef.current?.getCurrentRoute()?.name;
      
      if (appState.current.match(/active/) && nextAppState === 'background') {
        // App going to background - log exit
        await trackScreenExit();
      } else if (appState.current.match(/inactive|background/) && nextAppState === 'active' && currentRoute) {
        // App coming to foreground - log new view
        await trackScreenView(currentRoute, null);
      }
      appState.current = nextAppState;
    });

    return () => subscription?.remove();
  }, [trackScreenView, trackScreenExit]);

  // Set up push notifications on native (foreground handler + tap routing)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Configure how notifications display when app is in foreground
    configureForegroundHandler();

    // Set up notification tap handler (routes to correct screen)
    const cleanup = setupNotificationResponseListener(navigationRef);

    return cleanup;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    // Always use dark background for web to match auth screens
    // Auth screens always use dark mode, so we use dark colors for consistency
    const darkBackground = '#0F172A'; // Same as auth screen gradient start
    const fallbackGradient = `linear-gradient(135deg, ${darkBackground}, #1E293B, ${darkBackground})`;

    document.documentElement.style.background = fallbackGradient;
    document.body.style.background = fallbackGradient;
    // Use dvh (dynamic viewport height) to account for mobile browser chrome
    // (address bar, bottom navigation). Falls back to vh for older browsers.
    document.documentElement.style.height = '100dvh';
    document.documentElement.style.minHeight = '100dvh';
    document.body.style.height = '100dvh';
    document.body.style.minHeight = '100dvh';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';

    const root = document.getElementById('root');
    if (root) {
      root.style.height = '100dvh';
      root.style.minHeight = '100dvh';
      root.style.background = fallbackGradient;
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
    }

    // Hide scrollbars globally but allow scrolling inside scroll containers
    const style = document.createElement('style');
    style.textContent = `
      @supports not (height: 100dvh) {
        html, body, #root { height: 100vh !important; min-height: 100vh !important; }
      }
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
            <UnreadMessagesProvider>
            <JobProvider>
              <NavigationContainer
                ref={navigationRef}
                theme={navigationTheme}
                linking={linking}
                onStateChange={onNavigationStateChange}
                onReady={() => {
                  routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
                  if (routeNameRef.current) {
                    trackScreenView(routeNameRef.current, null);
                  }
                }}
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
                <ConsentGate />
                <ToastHost />
              </NavigationContainer>
            </JobProvider>
            </UnreadMessagesProvider>
          </AuthProvider>
        </PricingProvider>
      </SafeAreaProvider>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ThemedAppRoot />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}