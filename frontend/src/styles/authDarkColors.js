// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RefOpen Design System — Premium Dark Palette
// Always dark regardless of system theme.
// Single source of truth for all auth / registration
// screens AND future dark-mode app surfaces.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const authDarkColors = {

  /* ── Primary ────────────────────────────────────── */
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDark: '#2563EB',
  primaryGlow: 'rgba(59, 130, 246, 0.15)',
  primaryGlowSubtle: 'rgba(59, 130, 246, 0.06)',
  primaryGlowFaint: 'rgba(59, 130, 246, 0.05)',

  /* ── Accent (purple) ────────────────────────────── */
  accent: '#8B5CF6',
  accentLight: '#A78BFA',
  accentGlow: 'rgba(139, 92, 246, 0.12)',
  accentGlowSubtle: 'rgba(139, 92, 246, 0.04)',

  /* ── Surfaces (VS Code-inspired soft dark) ─────── */
  background: '#1E1E1E',
  backgroundMid: '#222222',        // subtle gradient mid-stop
  surface: '#252526',
  surfaceElevated: '#2D2D2D',
  card: '#252526',

  /* ── Glass / blur helpers ───────────────────────── */
  glass: 'rgba(37, 37, 38, 0.7)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',

  /* ── Text ───────────────────────────────────────── */
  text: '#E0E0E0',
  textPrimary: '#E0E0E0',
  textSecondary: '#9D9D9D',
  textMuted: '#6E6E6E',
  textLight: '#6E6E6E',
  textInverse: '#1E1E1E',
  textBright: 'rgba(255, 255, 255, 0.9)',
  textDimmed: 'rgba(255, 255, 255, 0.6)',
  textShadow: 'rgba(0, 0, 0, 0.2)',

  /* ── Icons ──────────────────────────────────────── */
  icon: 'rgba(255, 255, 255, 0.8)',
  iconMuted: 'rgba(255, 255, 255, 0.5)',

  /* ── Status — success ───────────────────────────── */
  success: '#22C55E',
  successDark: '#10B981',
  successGlow: 'rgba(34, 197, 94, 0.15)',
  successGlowSubtle: 'rgba(34, 197, 94, 0.08)',
  successBorder: 'rgba(34, 197, 94, 0.2)',
  successBorderStrong: 'rgba(34, 197, 94, 0.35)',

  /* ── Status — warning ───────────────────────────── */
  warning: '#F59E0B',
  warningLight: '#fbbf24',
  warningGlow: 'rgba(245, 158, 11, 0.15)',
  warningBackground: 'rgba(245, 158, 11, 0.2)',
  warningBorder: 'rgba(245, 158, 11, 0.5)',

  /* ── Status — error / danger ────────────────────── */
  error: '#EF4444',
  danger: '#EF4444',
  dangerLight: '#F87171',
  dangerGlow: 'rgba(239, 68, 68, 0.1)',
  dangerBorder: 'rgba(239, 68, 68, 0.25)',

  /* ── Status — info ──────────────────────────────── */
  info: '#38BDF8',

  /* ── Special ────────────────────────────────────── */
  gold: '#FFD700',
  goldGlow: 'rgba(255, 215, 0, 0.15)',

  /* ── Neutral — soft dark scale ───────────────────── */
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

  /* ── Borders ────────────────────────────────────── */
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.14)',
  borderSubtle: 'rgba(255, 255, 255, 0.1)',
  borderThin: 'rgba(255, 255, 255, 0.06)',
  borderFaint: 'rgba(255, 255, 255, 0.04)',
  borderMedium: 'rgba(255, 255, 255, 0.2)',
  borderFocus: 'rgba(59, 130, 246, 0.5)',

  /* ── Overlays ───────────────────────────────────── */
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(255, 255, 255, 0.1)',
  overlayMedium: 'rgba(255, 255, 255, 0.2)',

  /* ── Surface overlays (dark) ────────────────────── */
  surfaceOverlay: 'rgba(37, 37, 38, 0.4)',
  surfaceOverlayDark: 'rgba(37, 37, 38, 0.8)',
  backgroundOverlay: 'rgba(30, 30, 30, 0.8)',

  /* ── Inputs ─────────────────────────────────────── */
  inputBackground: '#3C3C3C',
  inputBackgroundFocus: '#454545',
  inputBackgroundLight: 'rgba(255, 255, 255, 0.08)',
  placeholder: 'rgba(255, 255, 255, 0.5)',

  /* ── Text helpers ───────────────────────────────── */
  textSubtle: 'rgba(255, 255, 255, 0.7)',

  /* ── Primary glow variants ──────────────────────── */
  primaryGlowStrong: 'rgba(59, 130, 246, 0.2)',

  /* ── Step indicator ─────────────────────────────── */
  stepCompleted: '#22C55E',
  stepActive: '#3B82F6',
  stepUpcoming: 'rgba(255, 255, 255, 0.12)',
  stepLine: 'rgba(255, 255, 255, 0.08)',
  stepLineCompleted: 'rgba(34, 197, 94, 0.5)',
  stepLineActive: 'rgba(59, 130, 246, 0.3)',

  /* ── Enhanced card ──────────────────────────────── */
  cardGlow: 'rgba(59, 130, 246, 0.08)',
  cardGlowBorder: 'rgba(59, 130, 246, 0.25)',
  cardHover: 'rgba(255, 255, 255, 0.03)',

  /* ── Gradient presets (arrays for LinearGradient) ── */
  gradientBackground: ['#1E1E1E', '#222222', '#1E1E1E'],
};

export default authDarkColors;
