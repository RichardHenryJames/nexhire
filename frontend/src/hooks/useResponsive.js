import { useState, useEffect, useMemo } from 'react';
import { Dimensions, Platform } from 'react-native';

// Breakpoints (matching common CSS breakpoints)
export const BREAKPOINTS = {
  mobile: 0,       // 0 - 767px (phones)
  tablet: 768,     // 768 - 1023px (tablets)
  desktop: 1024,   // 1024 - 1279px (small desktops)
  largeDesktop: 1280, // 1280px+ (large screens)
};

// Maximum content width for desktop (prevents ultra-wide layouts)
export const MAX_CONTENT_WIDTH = 1200;
export const MAX_CARD_WIDTH = 600;

/**
 * Custom hook for responsive design
 * Returns device type, breakpoints, and responsive values
 */
export function useResponsive() {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;

  // Device type detection
  const isMobile = width < BREAKPOINTS.tablet;
  const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isLargeDesktop = width >= BREAKPOINTS.largeDesktop;
  const isWeb = Platform.OS === 'web';

  // For mobile web: don't scale down, use native mobile width
  const isMobileWeb = isWeb && isMobile;

  // Responsive sizing helpers
  const responsiveValue = useMemo(() => ({
    // Returns different values based on screen size
    // Usage: responsiveValue.get({ mobile: 16, tablet: 20, desktop: 24 })
    get: (values) => {
      if (isLargeDesktop && values.largeDesktop !== undefined) return values.largeDesktop;
      if (isDesktop && values.desktop !== undefined) return values.desktop;
      if (isTablet && values.tablet !== undefined) return values.tablet;
      return values.mobile ?? values.tablet ?? values.desktop;
    },
  }), [isMobile, isTablet, isDesktop, isLargeDesktop]);

  // Calculate content width for centered layouts
  const contentWidth = useMemo(() => {
    if (isMobile) return width;
    if (isTablet) return Math.min(width - 48, MAX_CONTENT_WIDTH);
    return Math.min(width - 96, MAX_CONTENT_WIDTH);
  }, [width, isMobile, isTablet]);

  // Calculate grid columns for card layouts
  const gridColumns = useMemo(() => {
    if (isMobile) return 1;
    if (isTablet) return 2;
    if (isDesktop && !isLargeDesktop) return 2;
    return 3;
  }, [isMobile, isTablet, isDesktop, isLargeDesktop]);

  // Card width for grid layouts
  const cardWidth = useMemo(() => {
    const padding = isMobile ? 16 : 24;
    const gap = isMobile ? 12 : 16;
    const availableWidth = contentWidth - (padding * 2);
    const cardW = (availableWidth - (gap * (gridColumns - 1))) / gridColumns;
    return Math.min(cardW, MAX_CARD_WIDTH);
  }, [contentWidth, gridColumns, isMobile]);

  // Stat card columns (2 on mobile, 4 on desktop)
  const statColumns = useMemo(() => {
    if (isMobile) return 2;
    if (isTablet) return 3;
    return 4;
  }, [isMobile, isTablet]);

  // Spacing multiplier for desktop
  const spacingMultiplier = useMemo(() => {
    if (isMobile) return 1;
    if (isTablet) return 1.25;
    return 1.5;
  }, [isMobile, isTablet]);

  // Font size multiplier for desktop (slightly larger text)
  const fontSizeMultiplier = useMemo(() => {
    if (isMobile) return 1;
    if (isTablet) return 1.05;
    return 1.1;
  }, [isMobile, isTablet]);

  return {
    // Dimensions
    width,
    height,
    contentWidth,
    cardWidth,

    // Device detection
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isWeb,
    isMobileWeb,

    // Layout helpers
    gridColumns,
    statColumns,
    spacingMultiplier,
    fontSizeMultiplier,

    // Utilities
    responsiveValue,

    // Breakpoints for reference
    breakpoints: BREAKPOINTS,
  };
}

/**
 * Helper function to create responsive styles
 * Usage: createResponsiveStyles(styles, { isMobile, isDesktop })
 */
export function createResponsiveStyles(baseStyles, responsive) {
  const { isMobile, isTablet, isDesktop, isLargeDesktop, isWeb } = responsive;

  return {
    ...baseStyles,
    // Override with responsive variants if they exist
    ...(isTablet && baseStyles._tablet),
    ...(isDesktop && baseStyles._desktop),
    ...(isLargeDesktop && baseStyles._largeDesktop),
    ...(isWeb && baseStyles._web),
    ...(isMobile && isWeb && baseStyles._mobileWeb),
  };
}

/**
 * Get responsive padding for containers
 */
export function getResponsivePadding(responsive) {
  const { isMobile, isTablet, isDesktop } = responsive;
  
  if (isMobile) return { paddingHorizontal: 16, paddingVertical: 16 };
  if (isTablet) return { paddingHorizontal: 24, paddingVertical: 20 };
  return { paddingHorizontal: 32, paddingVertical: 24 };
}

/**
 * Get responsive font sizes
 */
export function getResponsiveFontSize(baseSize, responsive) {
  const { fontSizeMultiplier } = responsive;
  return Math.round(baseSize * fontSizeMultiplier);
}

export default useResponsive;
