/**
 * TabHeader — Shared header component for bottom tab screens
 * 
 * Used by: HomeScreen, AskReferralScreen, ServicesScreen, NotificationsScreen
 * 
 * Props:
 *  - title: string (center title text, e.g. "Career Tools", "Notifications")
 *  - centerContent: ReactNode (custom center content, overrides title — e.g. search bar)
 *  - rightContent: ReactNode (custom right content, overrides default messages button)
 *  - subtitle: ReactNode (below title, e.g. "Mark all read" link)
 *  - gradient: string[] (gradient colors, e.g. ['#2563EB','#1D4ED8']. If null, uses solid surface bg)
 *  - showMessages: boolean (show messages button on right, default true)
 *  - showWallet: boolean (show wallet balance badge before messages)
 *  - walletBalance: number|null
 *  - onProfilePress: function (override profile press, default opens slider)
 *  - navigation: navigation object (optional, falls back to useNavigation)
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Platform,
} from 'react-native';
import CachedImage from './CachedImage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useUnreadMessages } from '../contexts/UnreadMessagesContext';
import ProfileSlider from './ProfileSlider';
import { HEADER_CONTAINER_BASE, HEADER_TITLE } from './headerStyles';

export default function TabHeader({
  title,
  centerContent,
  rightContent,
  subtitle,
  gradient,
  showMessages = true,
  showWallet = false,
  walletBalance = null,
  onProfilePress,
  onProfileSliderOpen,
  navigation: navProp = null,
}) {
  const navigation = navProp || useNavigation();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [profileSliderVisible, setProfileSliderVisible] = useState(false);
  const { unreadCount: unreadMessageCount, refreshUnreadCount } = useUnreadMessages();

  // ⚡ Left-edge swipe to open ProfileSlider (like LinkedIn)
  const edgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dx > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 40 || gs.vx > 0.5) {
          if (onProfileSliderOpen) onProfileSliderOpen();
          setProfileSliderVisible(true);
        }
      },
    })
  ).current;

  const profilePhotoUrl = user?.ProfilePictureURL || user?.profilePictureURL || user?.picture || null;

  // ⚡ Message badge updates via polling in UnreadMessagesContext (10s interval)
  // No focus listener needed — polling handles it globally.

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      // Notify parent to abort heavy API calls (ProfileSlider needs network priority)
      if (onProfileSliderOpen) onProfileSliderOpen();
      setProfileSliderVisible(true);
    }
  };

  const isGradient = gradient && gradient.length >= 2;
  const useWhiteTheme = isGradient && !isDark;

  // Colors adapt: white on gradient (light mode), theme colors on solid/dark
  const iconColor = useWhiteTheme ? '#FFFFFF' : colors.primary;
  const textColor = useWhiteTheme ? '#FFFFFF' : colors.text;
  const profileBorderColor = useWhiteTheme ? 'rgba(255,255,255,0.5)' : colors.primary;
  const profilePlaceholderBg = useWhiteTheme ? 'rgba(255,255,255,0.2)' : colors.primary;
  const personIconColor = useWhiteTheme ? '#fff' : '#fff';
  const btnBg = useWhiteTheme ? 'rgba(255,255,255,0.15)' : colors.primary + '15';
  const badgeBorderColor = useWhiteTheme ? gradient[0] : colors.surface;

  // Determine gradient colors (dark mode forces surface color even if gradient passed)
  const gradientColors = isGradient
    ? (isDark ? [colors.surface, colors.surface] : gradient)
    : [colors.surface, colors.surface];

  const headerContent = (
    <View style={styles.headerRow}>
      {/* Left: Profile avatar */}
      <TouchableOpacity activeOpacity={0.8} onPress={handleProfilePress}>
        {profilePhotoUrl ? (
          <CachedImage
            source={{ uri: profilePhotoUrl }}
            style={[styles.profilePic, { borderColor: profileBorderColor }]}
          />
        ) : (
          <View style={[styles.profilePicPlaceholder, { backgroundColor: profilePlaceholderBg }]}>
            <Ionicons name="person" size={20} color={personIconColor} />
          </View>
        )}
      </TouchableOpacity>

      {/* Center */}
      <View style={[styles.center, centerContent ? { alignItems: 'stretch' } : null]}>
        {centerContent || (
          <>
            <Text style={[styles.title, { color: textColor }]}>{title}</Text>
            {subtitle}
          </>
        )}
      </View>

      {/* Right */}
      {rightContent || (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {showWallet && walletBalance !== null && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Wallet')}
              activeOpacity={0.7}
              style={styles.walletBadge}
            >
              <Ionicons name="wallet-outline" size={16} color="#10B981" />
              <Text style={styles.walletText}>₹{walletBalance}</Text>
            </TouchableOpacity>
          )}
          {showMessages && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Messages')}
              activeOpacity={0.7}
              style={[styles.messagesButton, { backgroundColor: btnBg }]}
            >
              <Ionicons name="chatbubbles-outline" size={22} color={iconColor} />
              {unreadMessageCount > 0 && (
                <View style={[styles.messagesBadge, { borderColor: badgeBorderColor }]}>
                  <Text style={styles.messagesBadgeText}>
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <>
      {isGradient ? (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.container, isDark && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
        >
          {headerContent}
        </LinearGradient>
      ) : (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {headerContent}
        </View>
      )}

      {/* ⚡ Left-edge swipe zone — invisible, captures right-swipe to open ProfileSlider */}
      {Platform.OS !== 'web' && (
        <View
          {...edgePanResponder.panHandlers}
          style={styles.edgeSwipeZone}
        />
      )}

      {/* Profile Slider — shared, no need to add in each screen */}
      <ProfileSlider
        visible={profileSliderVisible}
        onClose={() => setProfileSliderVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  edgeSwipeZone: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 20, // 20px invisible strip on left edge
    zIndex: 100,
  },
  container: {
    ...HEADER_CONTAINER_BASE,
    alignSelf: 'stretch',
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
  },
  profilePicPlaceholder: {
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
    ...HEADER_TITLE,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981' + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 4,
  },
  walletText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 3,
  },
  messagesButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  messagesBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  messagesBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
