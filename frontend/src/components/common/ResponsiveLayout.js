import React from 'react';
import { View, StyleSheet, Platform, ScrollView } from 'react-native';
import { useResponsive, MAX_CONTENT_WIDTH } from '../../hooks/useResponsive';

/**
 * ResponsiveContainer - Wraps content with responsive layout
 * 
 * On desktop: Centers content with max-width and adds side margins
 * On mobile: Full width with standard padding
 * On mobile web: Prevents zoom-out, maintains mobile-friendly view
 */
export function ResponsiveContainer({ 
  children, 
  style, 
  maxWidth = MAX_CONTENT_WIDTH,
  noPadding = false,
  backgroundColor,
}) {
  const { isWeb, isDesktop, isTablet, isMobile, contentWidth, width } = useResponsive();

  // On mobile (including mobile web), use full width
  if (isMobile) {
    return (
      <View style={[styles.mobileContainer, backgroundColor && { backgroundColor }, style]}>
        {children}
      </View>
    );
  }

  // On tablet/desktop, center content with max width
  return (
    <View style={[
      styles.desktopWrapper,
      backgroundColor && { backgroundColor },
    ]}>
      <View style={[
        styles.desktopContent,
        { maxWidth, width: '100%' },
        !noPadding && styles.desktopPadding,
        style,
      ]}>
        {children}
      </View>
    </View>
  );
}

/**
 * ResponsiveScrollView - ScrollView with responsive container
 */
export function ResponsiveScrollView({ 
  children, 
  style, 
  contentContainerStyle,
  maxWidth = MAX_CONTENT_WIDTH,
  ...props 
}) {
  const { isDesktop, isTablet, isMobile } = useResponsive();

  if (isMobile) {
    return (
      <ScrollView 
        style={[styles.mobileContainer, style]}
        contentContainerStyle={contentContainerStyle}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <ScrollView 
      style={[styles.desktopScrollWrapper, style]}
      contentContainerStyle={[styles.desktopScrollContent, contentContainerStyle]}
      {...props}
    >
      <View style={[styles.desktopContent, { maxWidth }]}>
        {children}
      </View>
    </ScrollView>
  );
}

/**
 * ResponsiveGrid - Grid layout that adapts to screen size
 */
export function ResponsiveGrid({ 
  children, 
  style,
  gap = 16,
  minItemWidth = 300,
}) {
  const { width, isMobile, isTablet, isDesktop, gridColumns, contentWidth } = useResponsive();

  // Calculate actual columns based on content width
  const availableWidth = isMobile ? width - 32 : contentWidth - 64;
  const calculatedColumns = Math.max(1, Math.floor(availableWidth / minItemWidth));
  const columns = Math.min(calculatedColumns, 4); // Max 4 columns

  const gridStyle = Platform.OS === 'web' ? {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: gap,
    width: '100%',
  } : {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -gap / 2,
  };

  return (
    <View style={[gridStyle, style]}>
      {Platform.OS === 'web' 
        ? children 
        : React.Children.map(children, (child) => (
            <View style={{ 
              width: `${100 / columns}%`, 
              paddingHorizontal: gap / 2,
              marginBottom: gap,
            }}>
              {child}
            </View>
          ))
      }
    </View>
  );
}

/**
 * ResponsiveRow - Flex row that stacks on mobile
 */
export function ResponsiveRow({ 
  children, 
  style,
  gap = 16,
  stackOnMobile = true,
  stackOnTablet = false,
}) {
  const { isMobile, isTablet } = useResponsive();

  const shouldStack = (stackOnMobile && isMobile) || (stackOnTablet && isTablet);

  return (
    <View style={[
      styles.row,
      shouldStack && styles.column,
      { gap },
      style,
    ]}>
      {children}
    </View>
  );
}

/**
 * DesktopSidebar - Shows sidebar on desktop, hidden on mobile
 */
export function DesktopSidebar({ children, width = 280, style }) {
  const { isDesktop, isWeb } = useResponsive();

  if (!isDesktop || !isWeb) return null;

  return (
    <View style={[styles.sidebar, { width }, style]}>
      {children}
    </View>
  );
}

/**
 * HideOnMobile - Hides children on mobile screens
 */
export function HideOnMobile({ children }) {
  const { isMobile } = useResponsive();
  if (isMobile) return null;
  return <>{children}</>;
}

/**
 * HideOnDesktop - Hides children on desktop screens
 */
export function HideOnDesktop({ children }) {
  const { isDesktop } = useResponsive();
  if (isDesktop) return null;
  return <>{children}</>;
}

/**
 * MobileOnly - Shows children only on mobile
 */
export function MobileOnly({ children }) {
  const { isMobile } = useResponsive();
  if (!isMobile) return null;
  return <>{children}</>;
}

/**
 * DesktopOnly - Shows children only on desktop
 */
export function DesktopOnly({ children }) {
  const { isDesktop } = useResponsive();
  if (!isDesktop) return null;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  mobileContainer: {
    flex: 1,
    width: '100%',
  },
  desktopWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  desktopContent: {
    width: '100%',
    alignSelf: 'center',
  },
  desktopPadding: {
    paddingHorizontal: 24,
  },
  desktopScrollWrapper: {
    flex: 1,
    width: '100%',
  },
  desktopScrollContent: {
    alignItems: 'center',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  column: {
    flexDirection: 'column',
  },
  sidebar: {
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    height: '100%',
  },
});

export default ResponsiveContainer;
