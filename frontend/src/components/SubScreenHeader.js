/**
 * SubScreenHeader — Shared header for sub-screens (non-tab screens)
 * 
 * Used by: SavedJobs, Applications, MyReferralRequests, Messages,
 *          Settings, Wallet, ProfileViews, ShareEarn, BecomeReferrer,
 *          WalletTransactions, WalletRecharge, WithdrawalRequests,
 *          AdminSocialShare, AdminVerifications, GetVerified, etc.
 * 
 * Back behavior (3 tiers, mutually exclusive):
 *   1. onBack        — Full override. If set, only this runs.
 *   2. directBack    — Always navigate directly to this screen name.
 *                      No goBack(), no fallbackTab. Use for non-tab parents
 *                      like 'Wallet' that aren't in MainTabs.
 *   3. Default       — goBack() if history exists, else fallbackTab (MainTabs).
 * 
 * Features:
 * - Left: Back arrow (or close icon)
 * - Center: Title (static or dynamic), or custom centerContent
 * - Optional subtitle below title
 * - Right: Optional custom content
 * - Consistent styling with TabHeader (shared headerStyles)
 * - No border (matches TabHeader)
 * - Sticky on web
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { HEADER_CONTAINER_BASE, HEADER_TITLE, HEADER_BACK_BUTTON } from './headerStyles';

export default function SubScreenHeader({
  title = '',                        // Center title text
  centerContent = null,             // Custom center content (overrides title)
  subtitle = null,                  // Optional subtitle below title
  icon = 'arrow-back',              // Left icon: 'arrow-back' or 'close'
  fallbackTab = 'Home',             // Fallback tab when can't go back (via MainTabs)
  directBack = null,                // Always navigate to this screen (skip goBack & fallbackTab)
  onBack = null,                    // Override back behavior entirely
  rightContent = null,              // Custom right-side content (buttons, badges)
  navigation: navProp = null,       // Optional navigation prop (fallback to useNavigation)
}) {
  const nav = navProp || useNavigation();
  const { colors } = useTheme();
  const { isDesktop } = useResponsive();
  const isDesktopWeb = Platform.OS === 'web' && isDesktop;

  // Map screen names to human-readable breadcrumb labels
  const SCREEN_LABELS = {
    Home: 'Home', Jobs: 'Jobs', AskReferral: 'Ask Referral', Services: 'Services',
    Notifications: 'Notifications', Profile: 'Profile', Wallet: 'Wallet',
    MyReferralRequests: 'My Referral Requests', Referral: 'Provide Referral',
    WalletRecharge: 'Recharge', ShareEarn: 'Social Share', Settings: 'Settings',
    Earnings: 'Earnings', Applications: 'Applications', SavedJobs: 'Saved Jobs',
    Messages: 'Messages', Support: 'Help & Support', BecomeReferrer: 'Become Referrer',
    ProfileViews: 'Profile Views', PromoCodes: 'Promo Codes',
  };

  // Map screen names to URL paths for Ctrl+Click new-tab support
  const SCREEN_URLS = {
    Home: '/', Jobs: '/jobs', AskReferral: '/ask-for-referral', Services: '/services',
    Notifications: '/notifications', Profile: '/profile', Wallet: '/wallet',
    MyReferralRequests: '/referrals/my-requests', Referral: '/provide-referral',
    WalletRecharge: '/wallet/recharge', WalletTransactions: '/wallet/transactions',
    WalletHolds: '/wallet/holds', SubmitPayment: '/wallet/submit-payment',
    WithdrawalRequests: '/wallet/withdrawals', PromoCodes: '/promo-codes',
    ShareEarn: '/share-earn', Settings: '/settings', Earnings: '/earnings',
    Applications: '/applications', SavedJobs: '/saved-jobs', Messages: '/messages',
    Support: '/support', BecomeReferrer: '/become-referrer', ProfileViews: '/ProfileViews',
  };

  const parentScreen = directBack || fallbackTab;
  const parentLabel = SCREEN_LABELS[parentScreen] || parentScreen;
  const parentUrl = SCREEN_URLS[parentScreen] || null;

  const handleBack = () => {
    // Tier 1: Full override
    if (onBack) {
      onBack();
      return;
    }
    // Tier 2: Direct navigate (non-tab parent, e.g. 'Wallet')
    if (directBack) {
      const TAB_SCREENS = ['Home', 'Jobs', 'AskReferral', 'Services', 'Notifications', 'Profile', 'CreateJob', 'ActionCenter', 'Admin'];
      if (TAB_SCREENS.includes(directBack)) {
        nav.navigate('Main', { screen: 'MainTabs', params: { screen: directBack } });
      } else {
        nav.navigate(directBack);
      }
      return;
    }
    // Tier 3: goBack if history, else fallback to tab
    const state = nav.getState();
    const routes = state?.routes || [];
    const currentIndex = state?.index || 0;
    if (routes.length > 1 && currentIndex > 0) {
      nav.goBack();
    } else {
      nav.navigate('Main', { screen: 'MainTabs', params: { screen: fallbackTab } });
    }
  };

  // Handle breadcrumb click — Ctrl/Cmd+Click opens in new tab on web
  const handleBreadcrumbClick = (e) => {
    if (Platform.OS === 'web' && parentUrl && (e?.ctrlKey || e?.metaKey)) {
      e?.preventDefault?.();
      window.open(parentUrl, '_blank');
      return;
    }
    handleBack();
  };

  // Desktop: breadcrumb-style header
  if (isDesktopWeb) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }, styles.containerDesktop]}>
        {/* Breadcrumb navigation */}
        <View style={styles.breadcrumbRow}>
          <TouchableOpacity onPress={handleBreadcrumbClick} style={styles.breadcrumbLink} activeOpacity={0.7}>
            <Text style={[styles.breadcrumbText, { color: colors.primary }]}>{parentLabel}</Text>
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={14} color={colors.gray400} style={{ marginHorizontal: 4 }} />
          <Text style={[styles.breadcrumbCurrent, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        </View>

        {/* Right: Custom content */}
        <View style={styles.right}>
          {rightContent || null}
        </View>
      </View>
    );
  }

  // Mobile: standard back + centered title
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        onPress={handleBack}
        activeOpacity={0.7}
        style={styles.backButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name={icon} size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={[styles.center, centerContent ? { alignItems: 'stretch' } : null]}>
        {centerContent || (
          <>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle}
          </>
        )}
      </View>

      <View style={styles.right}>
        {rightContent || <View style={styles.spacer} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    width: '100%',
    ...HEADER_CONTAINER_BASE,
  },
  containerDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  breadcrumbLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingRight: 2,
  },
  breadcrumbText: {
    fontSize: 14,
    fontWeight: '500',
  },
  breadcrumbCurrent: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  backButton: {
    ...HEADER_BACK_BUTTON,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...HEADER_TITLE,
  },
  right: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  spacer: {
    width: 40,
  },
});
