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
 *  - navigation: navigation object
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import ProfileSlider from './ProfileSlider';
import refopenAPI from '../services/api';

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
  navigation,
}) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [profileSliderVisible, setProfileSliderVisible] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const profilePhotoUrl = user?.ProfilePictureURL || user?.profilePictureURL || user?.picture || null;

  // Fetch unread messages on focus
  useFocusEffect(
    useCallback(() => {
      if (showMessages) {
        (async () => {
          try {
            const res = await refopenAPI.apiCall('/messages/unread-count');
            if (res.success) setUnreadMessageCount(res.data?.count || 0);
          } catch (e) {}
        })();
      }
    }, [showMessages])
  );

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
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
          <Image
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
        <View style={[styles.container, { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          {headerContent}
        </View>
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
  container: {
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    paddingBottom: 12,
    zIndex: 10000,
    elevation: 10,
    ...(Platform.OS === 'web' ? { position: 'sticky', top: 0 } : {}),
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
    fontSize: 18,
    fontWeight: '700',
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
