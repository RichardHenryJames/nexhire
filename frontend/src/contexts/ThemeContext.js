import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_PREFERENCE_KEY = 'themePreference';

// THEME CONFIGURATION
const lightTheme = {
  // Primary colors (RefOpen blue)
  primary: '#2563EB',
  primaryLight: '#3B82F6',
  primaryDark: '#1D4ED8',
  
  // Surface colors (LinkedIn-style: warm whites)
  surface: '#FFFFFF',
  background: '#F4F2EE',
  card: '#FFFFFF',
  
  // Text colors (LinkedIn-style: near-black + neutral grays)
  text: '#191919',
  textPrimary: '#191919',
  textSecondary: '#666666',
  textMuted: 'rgba(0, 0, 0, 0.6)',
  textLight: 'rgba(0, 0, 0, 0.4)',
  textInverse: '#FFFFFF',
  
  // Status colors (LinkedIn-style: deeper, muted)
  success: '#057642',
  warning: '#E7A33E',
  error: '#CC1016',
  danger: '#CC1016',
  info: '#2563EB',
  
  // Neutral colors (LinkedIn-style warm gray scale)
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F4F2EE',
  gray100: '#EDE9E4',
  gray200: '#E0DFDC',
  gray300: '#CCCCCC',
  gray400: '#999999',
  gray500: '#666666',
  gray600: '#474747',
  gray700: '#333333',
  gray800: '#1F1F1F',
  gray900: '#191919',
  
  // Border colors (LinkedIn-style: warm borders)
  border: '#E0DFDC',
  borderLight: '#EDE9E4',
  
  // Input colors (LinkedIn-style: subtle blue tint)
  inputBackground: '#EDF3F8',
  
  // Shadow colors
  shadow: '#000000',
  
  // Overlay colors
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};

const darkTheme = {
  // Primary colors (RefOpen blue, lighter for dark backgrounds)
  primary: '#60A5FA',
  primaryLight: '#93C5FD',
  primaryDark: '#3B82F6',
  
  // Surface colors (LinkedIn-style: warm dark grays)
  surface: '#1D2226',
  background: '#1B1F23',
  card: '#1D2226',
  
  // Text colors (LinkedIn-style: slightly transparent whites)
  text: 'rgba(255, 255, 255, 0.9)',
  textPrimary: 'rgba(255, 255, 255, 0.9)',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  textMuted: 'rgba(255, 255, 255, 0.45)',
  textLight: 'rgba(255, 255, 255, 0.45)',
  textInverse: '#1D2226',
  
  // Status colors (softer for dark backgrounds)
  success: '#44B254',
  warning: '#F5C75D',
  error: '#F5564E',
  danger: '#F5564E',
  info: '#60A5FA',
  
  // Neutral colors (LinkedIn-style warm gray scale)
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#1D2226',
  gray100: '#283338',
  gray200: '#38434F',
  gray300: '#56687A',
  gray400: '#86929E',
  gray500: '#B0B7BE',
  gray600: '#D0D4D8',
  gray700: '#E8EAED',
  gray800: '#F3F4F6',
  gray900: '#FFFFFF',
  
  // Border colors (LinkedIn-style: subtle warm borders)
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.16)',
  
  // Input colors
  inputBackground: '#283338',
  
  // Shadow colors
  shadow: '#000000',
  
  // Overlay colors
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
};

// THEME CONTEXT
const ThemeContext = createContext({
  theme: 'light',
  preference: 'system',
  colors: lightTheme,
  toggleTheme: () => {},
  setPreference: () => {},
  isDark: false,
});

// THEME PROVIDER
export const ThemeProvider = ({ children }) => {
  const [preference, setPreferenceState] = useState('system'); // 'system' | 'light' | 'dark'
  const [theme, setTheme] = useState('light'); // effective theme

  useEffect(() => {
    let subscription;

    const init = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
        if (stored === 'light' || stored === 'dark') {
          setPreferenceState(stored);
          setTheme(stored);
        } else {
          setPreferenceState('system');
          const initialTheme = Appearance.getColorScheme() || 'light';
          setTheme(initialTheme);
        }
      } catch (e) {
        setPreferenceState('system');
        const initialTheme = Appearance.getColorScheme() || 'light';
        setTheme(initialTheme);
      }

      subscription = Appearance.addChangeListener(({ colorScheme }) => {
        // Only follow system if user hasn't explicitly chosen a theme.
        setPreferenceState(prevPref => {
          if (prevPref !== 'system') return prevPref;
          setTheme(colorScheme || 'light');
          return prevPref;
        });
      });
    };

    init();

    return () => subscription?.remove?.();
  }, []);

  useEffect(() => {
    if (preference === 'system') {
      const system = Appearance.getColorScheme() || 'light';
      setTheme(system);
    } else {
      setTheme(preference);
    }
  }, [preference]);

  const setPreference = async (nextPreference) => {
    const normalized = nextPreference === 'dark' ? 'dark' : nextPreference === 'light' ? 'light' : 'system';
    setPreferenceState(normalized);
    try {
      if (normalized === 'system') {
        await AsyncStorage.removeItem(THEME_PREFERENCE_KEY);
      } else {
        await AsyncStorage.setItem(THEME_PREFERENCE_KEY, normalized);
      }
    } catch (e) {
      // ignore persistence errors
    }
  };

  const toggleTheme = () => {
    // Toggle based on current effective theme, not preference
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setPreference(newTheme);
  };

  const isDark = theme === 'dark';
  const colors = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{
      theme,
      preference,
      colors,
      toggleTheme,
      setPreference,
      isDark,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

// THEME HOOK
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;