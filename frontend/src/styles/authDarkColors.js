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
  background: '#0F172A',
  backgroundMid: '#131D32',        // subtle gradient mid-stop
  surface: '#1E293B',
  surfaceElevated: '#334155',
  card: '#1E293B',

  /* ── Glass / blur helpers ───────────────────────── */
  glass: 'rgba(30, 41, 59, 0.7)',
  glassBorder: 'rgba(148, 163, 184, 0.12)',

  /* ── Text ───────────────────────────────────────── */
  text: '#F1F5F9',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textLight: '#64748B',
  textInverse: '#0F172A',
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

  /* ── Neutral — slate scale ──────────────────────── */
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#1E293B',
  gray100: '#334155',
  gray200: '#475569',
  gray300: '#64748B',
  gray400: '#94A3B8',
  gray500: '#CBD5E1',
  gray600: '#E2E8F0',
  gray700: '#F1F5F9',
  gray800: '#F8FAFC',
  gray900: '#FFFFFF',

  /* ── Borders ────────────────────────────────────── */
  border: 'rgba(148, 163, 184, 0.12)',
  borderLight: 'rgba(148, 163, 184, 0.2)',
  borderSubtle: 'rgba(148, 163, 184, 0.15)',
  borderThin: 'rgba(148, 163, 184, 0.1)',
  borderFaint: 'rgba(148, 163, 184, 0.08)',
  borderMedium: 'rgba(148, 163, 184, 0.3)',
  borderFocus: 'rgba(59, 130, 246, 0.5)',

  /* ── Overlays ───────────────────────────────────── */
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(255, 255, 255, 0.1)',
  overlayMedium: 'rgba(255, 255, 255, 0.2)',

  /* ── Surface overlays (dark) ────────────────────── */
  surfaceOverlay: 'rgba(30, 41, 59, 0.4)',
  surfaceOverlayDark: 'rgba(30, 41, 59, 0.8)',
  backgroundOverlay: 'rgba(15, 23, 42, 0.8)',

  /* ── Inputs ─────────────────────────────────────── */
  inputBackground: 'rgba(30, 41, 59, 0.6)',
  inputBackgroundFocus: 'rgba(30, 41, 59, 0.9)',
  inputBackgroundLight: 'rgba(255, 255, 255, 0.08)',
  placeholder: 'rgba(255, 255, 255, 0.5)',

  /* ── Text helpers ───────────────────────────────── */
  textSubtle: 'rgba(255, 255, 255, 0.7)',

  /* ── Primary glow variants ──────────────────────── */
  primaryGlowStrong: 'rgba(59, 130, 246, 0.2)',

  /* ── Gradient presets (arrays for LinearGradient) ── */
  gradientBackground: ['#0F172A', '#131D32', '#0F172A'],
};

export default authDarkColors;
