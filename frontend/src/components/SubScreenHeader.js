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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
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

  const handleBack = () => {
    // Tier 1: Full override
    if (onBack) {
      onBack();
      return;
    }
    // Tier 2: Direct navigate (non-tab parent, e.g. 'Wallet')
    // Handles both tab screens (Home, Jobs, Profile etc.) and stack screens (Wallet)
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Left: Back/Close button */}
      <TouchableOpacity
        onPress={handleBack}
        activeOpacity={0.7}
        style={styles.backButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name={icon} size={24} color={colors.text} />
      </TouchableOpacity>

      {/* Center: Custom content or Title + optional subtitle */}
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

      {/* Right: Custom content or empty spacer */}
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
    ...HEADER_CONTAINER_BASE,
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
