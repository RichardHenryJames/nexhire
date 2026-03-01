import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_PREFERENCE_KEY = 'themePreference';

// THEME CONFIGURATION
const lightTheme = {
  // ── Primary ──────────────────────────────────────
  primary: '#2563EB',
  primaryLight: '#3B82F6',
  primaryDark: '#1D4ED8',

  // ── Accent (purple / violet) ─────────────────────
  accent: '#7C3AED',
  accentLight: '#A78BFA',
  accentDark: '#6D28D9',

  // ── Surfaces ─────────────────────────────────────
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  background: '#F4F2EE',
  card: '#FFFFFF',

  // ── Text ─────────────────────────────────────────
  text: '#191919',
  textPrimary: '#191919',
  textSecondary: '#666666',
  textMuted: '#999999',
  textLight: '#999999',
  textInverse: '#FFFFFF',

  // ── Status — success ─────────────────────────────
  success: '#10B981',
  successLight: '#34D399',
  successDark: '#059669',
  successBg: '#ECFDF5',
  successBorder: 'rgba(16, 185, 129, 0.3)',

  // ── Status — warning ─────────────────────────────
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  warningDark: '#D97706',
  warningBg: '#FFFBEB',
  warningBorder: 'rgba(245, 158, 11, 0.3)',

  // ── Status — error / danger ──────────────────────
  error: '#EF4444',
  danger: '#EF4444',
  dangerLight: '#F87171',
  dangerDark: '#DC2626',
  errorBg: '#FEE2E2',
  errorBorder: 'rgba(239, 68, 68, 0.3)',

  // ── Status — info ────────────────────────────────
  info: '#3B82F6',
  infoBg: '#EFF6FF',

  // ── Special ──────────────────────────────────────
  gold: '#B8860B',
  orange: '#FF9500',
  orangeBg: '#FFF4E6',
  indigo: '#6366F1',
  indigoBg: '#EEF2FF',
  cyan: '#06B6D4',
  cyanLight: '#22D3EE',
  rose: '#F43F5E',
  roseLight: '#FB7185',
  pink: '#EC4899',

  // ── Neutral — gray scale ─────────────────────────
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

  // ── Borders ──────────────────────────────────────
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  borderSubtle: 'rgba(0, 0, 0, 0.08)',

  // ── Inputs ───────────────────────────────────────
  inputBackground: '#F3F4F6',

  // ── Shadow ───────────────────────────────────────
  shadow: '#000000',

  // ── Overlays ─────────────────────────────────────
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',

  // ── Accent backgrounds ──────────────────────────
  accentBg: '#EDE9FE',
  primaryBg: '#EFF6FF',
};

const darkTheme = {
  // ── Primary ──────────────────────────────────────
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDark: '#2563EB',

  // ── Accent (purple / violet) ─────────────────────
  accent: '#8B5CF6',
  accentLight: '#A78BFA',
  accentDark: '#7C3AED',

  // ── Surfaces (VS Code-inspired soft dark) ───────
  surface: '#252526',
  surfaceElevated: '#2D2D2D',
  background: '#1E1E1E',
  card: '#252526',

  // ── Text ─────────────────────────────────────────
  text: '#E0E0E0',
  textPrimary: '#E0E0E0',
  textSecondary: '#9D9D9D',
  textMuted: '#6E6E6E',
  textLight: '#6E6E6E',
  textInverse: '#1E1E1E',

  // ── Status — success ─────────────────────────────
  success: '#10B981',
  successLight: '#34D399',
  successDark: '#059669',
  successBg: 'rgba(16, 185, 129, 0.12)',
  successBorder: 'rgba(16, 185, 129, 0.3)',

  // ── Status — warning ─────────────────────────────
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  warningDark: '#D97706',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  warningBorder: 'rgba(245, 158, 11, 0.3)',

  // ── Status — error / danger ──────────────────────
  error: '#EF4444',
  danger: '#EF4444',
  dangerLight: '#F87171',
  dangerDark: '#DC2626',
  errorBg: 'rgba(239, 68, 68, 0.12)',
  errorBorder: 'rgba(239, 68, 68, 0.3)',

  // ── Status — info ────────────────────────────────
  info: '#38BDF8',
  infoBg: 'rgba(56, 189, 248, 0.12)',

  // ── Special ──────────────────────────────────────
  gold: '#FFD700',
  orange: '#FF9500',
  orangeBg: 'rgba(255, 149, 0, 0.12)',
  indigo: '#6366F1',
  indigoBg: 'rgba(99, 102, 241, 0.12)',
  cyan: '#06B6D4',
  cyanLight: '#22D3EE',
  rose: '#F43F5E',
  roseLight: '#FB7185',
  pink: '#EC4899',

  // ── Neutral — soft dark scale ─────────────────────
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#252526',
  gray100: '#2D2D2D',
  gray200: '#3C3C3C',
  gray300: '#4E4E4E',
  gray400: '#6E6E6E',
  gray500: '#9D9D9D',
  gray600: '#BBBBBB',
  gray700: '#D4D4D4',
  gray800: '#E8E8E8',
  gray900: '#F5F5F5',

  // ── Borders ──────────────────────────────────────
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.14)',
  borderSubtle: 'rgba(255, 255, 255, 0.05)',

  // ── Inputs ───────────────────────────────────────
  inputBackground: '#3C3C3C',

  // ── Shadow ───────────────────────────────────────
  shadow: '#000000',

  // ── Overlays ─────────────────────────────────────
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',

  // ── Accent backgrounds ──────────────────────────
  accentBg: 'rgba(139, 92, 246, 0.12)',
  primaryBg: 'rgba(59, 130, 246, 0.12)',
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

export { darkTheme };
export default ThemeContext;