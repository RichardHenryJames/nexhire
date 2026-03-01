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

  /* ── Surfaces ───────────────────────────────────── */
  background: '#09090B',
  backgroundMid: '#0E0E10',        // subtle gradient mid-stop
  surface: '#18181B',
  surfaceElevated: '#27272A',
  card: '#18181B',

  /* ── Glass / blur helpers ───────────────────────── */
  glass: 'rgba(24, 24, 27, 0.7)',
  glassBorder: 'rgba(161, 161, 170, 0.12)',

  /* ── Text ───────────────────────────────────────── */
  text: '#FAFAFA',
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  textLight: '#71717A',
  textInverse: '#09090B',
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

  /* ── Neutral — zinc scale ─────────────────────────── */
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#18181B',
  gray100: '#27272A',
  gray200: '#3F3F46',
  gray300: '#52525B',
  gray400: '#71717A',
  gray500: '#A1A1AA',
  gray600: '#D4D4D8',
  gray700: '#E4E4E7',
  gray800: '#F4F4F5',
  gray900: '#FAFAFA',

  /* ── Borders ────────────────────────────────────── */
  border: 'rgba(161, 161, 170, 0.12)',
  borderLight: 'rgba(161, 161, 170, 0.2)',
  borderSubtle: 'rgba(161, 161, 170, 0.15)',
  borderThin: 'rgba(161, 161, 170, 0.1)',
  borderFaint: 'rgba(161, 161, 170, 0.08)',
  borderMedium: 'rgba(161, 161, 170, 0.3)',
  borderFocus: 'rgba(59, 130, 246, 0.5)',

  /* ── Overlays ───────────────────────────────────── */
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(255, 255, 255, 0.1)',
  overlayMedium: 'rgba(255, 255, 255, 0.2)',

  /* ── Surface overlays (dark) ────────────────────── */
  surfaceOverlay: 'rgba(24, 24, 27, 0.4)',
  surfaceOverlayDark: 'rgba(24, 24, 27, 0.8)',
  backgroundOverlay: 'rgba(9, 9, 11, 0.8)',

  /* ── Inputs ─────────────────────────────────────── */
  inputBackground: 'rgba(24, 24, 27, 0.6)',
  inputBackgroundFocus: 'rgba(24, 24, 27, 0.9)',
  inputBackgroundLight: 'rgba(255, 255, 255, 0.08)',
  placeholder: 'rgba(255, 255, 255, 0.5)',

  /* ── Text helpers ───────────────────────────────── */
  textSubtle: 'rgba(255, 255, 255, 0.7)',

  /* ── Primary glow variants ──────────────────────── */
  primaryGlowStrong: 'rgba(59, 130, 246, 0.2)',

  /* ── Gradient presets (arrays for LinearGradient) ── */
  gradientBackground: ['#09090B', '#0E0E10', '#09090B'],
};

export default authDarkColors;
