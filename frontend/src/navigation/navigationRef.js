import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const navigationRef = createNavigationContainerRef();

// Key for storing the redirect path after login
const REDIRECT_AFTER_LOGIN_KEY = 'refopen_redirect_after_login';

/**
 * Get the current navigation state to restore after login
 */
export function getCurrentRouteState() {
  if (!navigationRef.isReady()) return null;

  const state = navigationRef.getRootState();
  if (!state) return null;

  // Extract the current route path
  const getActiveRoute = (state) => {
    if (!state || !state.routes) return null;
    const route = state.routes[state.index];
    if (route.state) {
      return getActiveRoute(route.state);
    }
    return { name: route.name, params: route.params };
  };

  return getActiveRoute(state);
}

/**
 * Save the current route to restore after login
 */
export async function saveRedirectRoute() {
  try {
    const currentRoute = getCurrentRouteState();
    if (currentRoute && currentRoute.name !== 'Login' && currentRoute.name !== 'Register') {
      // Get full navigation state for deep restoration
      const state = navigationRef.getRootState();
      await AsyncStorage.setItem(REDIRECT_AFTER_LOGIN_KEY, JSON.stringify({
        route: currentRoute,
        fullState: state,
        timestamp: Date.now(),
      }));
    }
  } catch (error) {
    console.error('Failed to save redirect route:', error);
  }
}

/**
 * Get and clear the saved redirect route
 */
export async function getAndClearRedirectRoute() {
  try {
    const saved = await AsyncStorage.getItem(REDIRECT_AFTER_LOGIN_KEY);
    if (saved) {
      await AsyncStorage.removeItem(REDIRECT_AFTER_LOGIN_KEY);
      const parsed = JSON.parse(saved);
      
      // Only use if saved within the last 30 minutes
      const thirtyMinutes = 30 * 60 * 1000;
      if (Date.now() - parsed.timestamp < thirtyMinutes) {
        return parsed;
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to get redirect route:', error);
    return null;
  }
}

/**
 * Navigate to a saved route after login
 */
export function navigateToRoute(routeData) {
  if (!navigationRef.isReady() || !routeData) return false;

  try {
    const { route } = routeData;
    if (route && route.name) {
      // Navigate to Main first, then to the specific screen
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'Main',
              state: {
                routes: [
                  { name: 'MainTabs' },
                  { name: route.name, params: route.params },
                ],
                index: 1,
              },
            },
          ],
        })
      );
      return true;
    }
  } catch (error) {
    console.error('Failed to navigate to saved route:', error);
  }
  return false;
}

export function resetToLogin() {
  if (!navigationRef.isReady()) return;

  // Save current route before resetting to login
  saveRedirectRoute();

  navigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'Auth', params: { screen: 'Login' } }],
    })
  );
}
