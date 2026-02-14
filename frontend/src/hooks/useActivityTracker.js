/**
 * useActivityTracker Hook
 * Automatically tracks screen views and user activity
 */

import { useEffect, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import refopenAPI from '../services/api';

// Generate a unique session ID
const generateSessionId = () => {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get or create session ID
const getSessionId = async () => {
  try {
    let sessionId = await AsyncStorage.getItem('refopen_session_id');
    const sessionTime = await AsyncStorage.getItem('refopen_session_time');
    
    // Create new session if none exists or if last activity was more than 30 mins ago
    const thirtyMinsAgo = Date.now() - (30 * 60 * 1000);
    if (!sessionId || !sessionTime || parseInt(sessionTime) < thirtyMinsAgo) {
      sessionId = generateSessionId();
      await AsyncStorage.setItem('refopen_session_id', sessionId);
    }
    
    // Update session time
    await AsyncStorage.setItem('refopen_session_time', Date.now().toString());
    
    return sessionId;
  } catch (error) {
    console.error('Error getting session ID:', error);
    return generateSessionId();
  }
};

// Detect device type
const getDeviceType = () => {
  if (Platform.OS === 'web') {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }
  return Platform.OS === 'ios' || Platform.OS === 'android' ? 'mobile' : 'unknown';
};

// Get platform name
const getPlatform = () => {
  if (Platform.OS === 'web') return 'web';
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'unknown';
};

// Get browser info (web only)
const getBrowser = () => {
  if (Platform.OS !== 'web') return null;
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  return 'Other';
};

/**
 * Hook to track screen views automatically
 * Usage: Add to each screen or wrap in navigation container
 */
export const useActivityTracker = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const currentActivityId = useRef(null);
  const previousScreen = useRef(null);
  const appState = useRef(AppState.currentState);

  // Log screen view
  const logScreenView = useCallback(async (screenName, referrerScreen = null) => {
    try {
      const token = await AsyncStorage.getItem('refopen_token');
      if (!token) return; // Don't track if not logged in

      const sessionId = await getSessionId();
      
      const response = await refopenAPI.apiCall('/activity/log', {
        method: 'POST',
        body: JSON.stringify({
          screenName,
          action: 'view',
          sessionId,
          platform: getPlatform(),
          deviceType: getDeviceType(),
          browser: getBrowser(),
          referrerScreen
        })
      });

      if (response.success && response.data?.activityId) {
        currentActivityId.current = response.data.activityId;
      }
    } catch (error) {
      // Silently fail - don't interrupt user experience
      console.debug('Activity tracking error:', error);
    }
  }, []);

  // Log screen exit
  const logScreenExit = useCallback(async () => {
    try {
      if (!currentActivityId.current) return;

      const token = await AsyncStorage.getItem('refopen_token');
      if (!token) return;

      await refopenAPI.apiCall('/activity/exit', {
        method: 'POST',
        body: JSON.stringify({
          activityId: currentActivityId.current
        })
      });

      currentActivityId.current = null;
    } catch (error) {
      console.debug('Activity exit tracking error:', error);
    }
  }, []);

  // Track screen changes
  useEffect(() => {
    const screenName = route.name;
    
    // Log exit for previous screen
    if (previousScreen.current && previousScreen.current !== screenName) {
      logScreenExit();
    }

    // Log view for current screen
    logScreenView(screenName, previousScreen.current);
    previousScreen.current = screenName;

    // Cleanup on unmount
    return () => {
      logScreenExit();
    };
  }, [route.name, logScreenView, logScreenExit]);

  // Track app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/active/) && nextAppState === 'background') {
        // App going to background - log exit
        logScreenExit();
      } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App coming to foreground - log new view
        logScreenView(route.name, null);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [route.name, logScreenView, logScreenExit]);

  // Return manual tracking functions for custom actions
  return {
    logAction: async (action, actionDetails = null) => {
      try {
        const token = await AsyncStorage.getItem('refopen_token');
        if (!token) return;

        const sessionId = await getSessionId();

        await refopenAPI.apiCall('/activity/log', {
          method: 'POST',
          body: JSON.stringify({
            screenName: route.name,
            action,
            actionDetails,
            sessionId,
            platform: getPlatform(),
            deviceType: getDeviceType(),
            browser: getBrowser()
          })
        });
      } catch (error) {
        console.debug('Action tracking error:', error);
      }
    }
  };
};

/**
 * Higher-order component to wrap screens with activity tracking
 */
export const withActivityTracking = (WrappedComponent) => {
  return function ActivityTrackedComponent(props) {
    useActivityTracker();
    return <WrappedComponent {...props} />;
  };
};

/**
 * Simple hook for screens that just need basic tracking
 * Usage: useScreenTracking(); // at top of component
 */
export const useScreenTracking = () => {
  const route = useRoute();
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;

    const trackScreen = async () => {
      try {
        const token = await AsyncStorage.getItem('refopen_token');
        if (!token) return;

        const sessionId = await getSessionId();

        await refopenAPI.apiCall('/activity/log', {
          method: 'POST',
          body: JSON.stringify({
            screenName: route.name,
            action: 'view',
            sessionId,
            platform: getPlatform(),
            deviceType: getDeviceType(),
            browser: getBrowser()
          })
        });
      } catch (error) {
        // Silent fail
      }
    };

    trackScreen();
  }, [route.name]);
};

export default useActivityTracker;
