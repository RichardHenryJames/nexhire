import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';

// ?? THEME CONFIGURATION
const lightTheme = {
  // Primary colors
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDark: '#1D4ED8',
  
  // Surface colors
  surface: '#FFFFFF',
  background: '#F9FAFB',
  card: '#FFFFFF',
  
  // Text colors
  text: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  
  // Status colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Neutral colors
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  
  // Border colors
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  
  // Shadow colors
  shadow: '#000000',
  
  // Overlay colors
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
};

const darkTheme = {
  // Primary colors
  primary: '#60A5FA',
  primaryLight: '#93C5FD',
  primaryDark: '#3B82F6',
  
  // Surface colors
  surface: '#1F2937',
  background: '#111827',
  card: '#1F2937',
  
  // Text colors
  text: '#F9FAFB',
  textSecondary: '#D1D5DB',
  textMuted: '#9CA3AF',
  
  // Status colors
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',
  
  // Neutral colors
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#1F2937',
  gray100: '#374151',
  gray200: '#4B5563',
  gray300: '#6B7280',
  gray400: '#9CA3AF',
  gray500: '#D1D5DB',
  gray600: '#E5E7EB',
  gray700: '#F3F4F6',
  gray800: '#F9FAFB',
  gray900: '#FFFFFF',
  
  // Border colors
  border: '#374151',
  borderLight: '#4B5563',
  
  // Shadow colors
  shadow: '#000000',
  
  // Overlay colors
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
};

// ?? THEME CONTEXT
const ThemeContext = createContext({
  theme: 'light',
  colors: lightTheme,
  toggleTheme: () => {},
  isDark: false,
});

// ?? THEME PROVIDER
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    // Listen to system theme changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setTheme(colorScheme || 'light');
    });

    // Set initial theme
    const initialTheme = Appearance.getColorScheme() || 'light';
    setTheme(initialTheme);

    return () => subscription?.remove();
  }, []);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const isDark = theme === 'dark';
  const colors = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{
      theme,
      colors,
      toggleTheme,
      isDark,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ?? THEME HOOK
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;