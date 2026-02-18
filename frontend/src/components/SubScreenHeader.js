/**
 * SubScreenHeader — Shared header for sub-screens (non-tab screens)
 * 
 * Used by: SavedJobs, Applications, MyReferralRequests, Messages,
 *          Settings, Wallet, ProfileViews, ShareEarn, BecomeReferrer,
 *          WalletTransactions, WalletRecharge, WithdrawalRequests, etc.
 * 
 * Features:
 * - Left: Back arrow (or close icon)
 * - Center: Title (static or dynamic)
 * - Right: Optional custom content
 * - Smart back: goBack if possible, else navigate to fallback tab
 * - Consistent styling with TabHeader
 * - No border (matches TabHeader)
 * - Sticky on web
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';

export default function SubScreenHeader({
  title = '',                        // Center title text
  icon = 'arrow-back',              // Left icon: 'arrow-back' or 'close'
  fallbackTab = 'Home',             // Fallback tab when can't go back
  onBack = null,                    // Override back behavior entirely
  rightContent = null,              // Custom right-side content (buttons, badges)
  navigation: navProp = null,       // Optional navigation prop (fallback to useNavigation)
}) {
  const nav = navProp || useNavigation();
  const { colors } = useTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
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

      {/* Center: Title */}
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
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
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    paddingBottom: 12,
    gap: 8,
    zIndex: 10000,
    elevation: 10,
    ...(Platform.OS === 'web' ? { position: 'sticky', top: 0 } : {}),
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  right: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  spacer: {
    width: 40,
  },
});
