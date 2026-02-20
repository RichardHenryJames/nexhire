/**
 * NotificationsScreen - Full screen notification list for bottom tab
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Animated,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import refopenAPI from '../services/api';
import TabHeader from '../components/TabHeader';
import { colors as brandColors } from '../styles/theme';

const TYPE_COLORS = {
  message_received: brandColors.primary,
  referral_request_new: '#8B5CF6',
  referral_claimed: '#10B981',
  referral_submitted: '#8B5CF6',
  referral_verified: '#10B981',
  referral_rejected: '#EF4444',
  referral_cancelled: '#EF4444',
  referral_expired: '#F59E0B',
  referral_verify_reminder: '#F59E0B',
  social_share_approved: '#10B981',
  social_share_rejected: '#EF4444',
  withdrawal_approved: '#10B981',
  withdrawal_rejected: '#EF4444',
  wallet_credited: '#10B981',
  wallet_debited: '#F59E0B',
  manual_payment_approved: '#10B981',
  manual_payment_rejected: '#EF4444',
  support_reply: brandColors.primary,
  profile_viewed: '#8B5CF6',
  welcome: brandColors.primary,
};

const ICON_MAP = {
  chatbubbles: 'chatbubbles',
  'person-add': 'person-add',
  'checkmark-circle': 'checkmark-circle',
  'checkmark-done-circle': 'checkmark-done-circle',
  wallet: 'wallet',
  megaphone: 'megaphone',
  cash: 'cash',
  'close-circle': 'close-circle',
  time: 'time',
  'help-circle': 'help-circle',
  eye: 'eye',
};

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1 && !append) setLoading(true);
    else if (append) setLoadingMore(true);

    try {
      const res = await refopenAPI.apiCall(`/notifications?page=${pageNum}&pageSize=20`);
      if (res.success) {
        const items = res.data?.notifications || [];
        if (append) {
          setNotifications(prev => [...prev, ...items]);
        } else {
          setNotifications(items);
        }
        setHasMore(pageNum < (res.data?.totalPages || 1));
        setPage(pageNum);
        setUnreadCount(items.filter(n => !n.IsRead).length + (append ? unreadCount : 0));
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  // Load notifications on mount
  useEffect(() => {
    fetchNotifications(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ⚡ No focus listener — data loads on mount, pull-to-refresh for updates. Zero work on tab switch = instant.

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications(1);
  };

  const handleMarkAllRead = async () => {
    try {
      await refopenAPI.apiCall('/notifications/read-all', { method: 'PATCH' });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  const deleteAnims = useRef({}).current;

  const getDeleteAnim = (id) => {
    if (!deleteAnims[id]) {
      deleteAnims[id] = {
        opacity: new Animated.Value(1),
        scale: new Animated.Value(1),
        height: new Animated.Value(1),
      };
    }
    return deleteAnims[id];
  };

  const handleDeleteNotification = async (notificationId) => {
    const anim = getDeleteAnim(notificationId);
    // Snap/fade-out animation
    Animated.parallel([
      Animated.timing(anim.opacity, { toValue: 0, duration: 250, useNativeDriver: false }),
      Animated.timing(anim.scale, { toValue: 0.85, duration: 250, useNativeDriver: false }),
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(anim.height, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]),
    ]).start(() => {
      setNotifications(prev => prev.filter(n => n.NotificationID !== notificationId));
      delete deleteAnims[notificationId];
    });
    try {
      await refopenAPI.apiCall(`/notifications/${notificationId}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to delete notification:', e);
    }
  };

  const handleNotificationPress = async (notification) => {
    if (!notification.IsRead) {
      try {
        await refopenAPI.apiCall(`/notifications/${notification.NotificationID}/read`, { method: 'PATCH' });
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n =>
          n.NotificationID === notification.NotificationID ? { ...n, IsRead: true } : n
        ));
      } catch (e) {}
    }

    const url = notification.ActionURL;
    if (!url) return;

    if (url.startsWith('/Messages')) {
      navigation.navigate('Messages');
    } else if (url.startsWith('/referrals/my-requests')) {
      navigation.navigate('MyReferralRequests');
    } else if (url.startsWith('/referrals')) {
      navigation.navigate('MainTabs', { screen: 'Referrals' });
    } else if (url.startsWith('/wallet')) {
      navigation.navigate('WalletFromHome');
    } else if (url.startsWith('/support')) {
      navigation.navigate('SupportFromHome');
    } else if (url.startsWith('/profile-views')) {
      navigation.navigate('ProfileViews');
    } else if (url.startsWith('/SocialShareSubmit')) {
      navigation.navigate('SocialShareSubmit', { platform: url.split('platform=')[1] });
    }
  };

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 60;
    if (isBottom && hasMore && !loadingMore) {
      fetchNotifications(page + 1, true);
    }
  };



  const renderNotification = (item) => {
    const iconName = ICON_MAP[item.Icon] || 'notifications';
    const typeColor = TYPE_COLORS[item.NotificationType] || colors.primary;
    const hasActionButtons = ['referral_submitted', 'referral_verify_reminder'].includes(item.NotificationType);

    // Navigate to My Referral Requests to verify (popup there has View Proof)
    const handleVerifyNow = (e) => {
      if (e?.stopPropagation) e.stopPropagation();
      if (!item.IsRead) {
        refopenAPI.apiCall(`/notifications/${item.NotificationID}/read`, { method: 'PATCH' }).catch(() => {});
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n =>
          n.NotificationID === item.NotificationID ? { ...n, IsRead: true } : n
        ));
      }
      navigation.navigate('MyReferralRequests');
    };

    const notificationContent = (
      <Pressable
        key={item.NotificationID}
        onPress={() => !hasActionButtons && handleNotificationPress(item)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          padding: 16,
          backgroundColor: item.IsRead ? colors.surface : typeColor + '08',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          opacity: pressed && !hasActionButtons ? 0.7 : 1,
        })}
      >
        <Pressable
          onPress={() => handleNotificationPress(item)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: typeColor + '20',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 14,
            marginTop: 2,
          }}
        >
          <Ionicons name={iconName} size={20} color={typeColor} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Pressable onPress={() => handleNotificationPress(item)}>
            <Text style={{
              color: colors.text,
              fontSize: 15,
              fontWeight: item.IsRead ? '400' : '600',
              marginBottom: 4,
            }} numberOfLines={2}>
              {item.Title}
            </Text>
            <Text style={{
              color: colors.textSecondary,
              fontSize: 14,
              lineHeight: 20,
            }} numberOfLines={3}>
              {item.Body}
            </Text>
            <Text style={{
              color: colors.textSecondary,
              fontSize: 12,
              marginTop: 6,
            }}>
              {timeAgo(item.CreatedAt)}
            </Text>
          </Pressable>

          {/* Verify Now button for referral notifications */}
          {hasActionButtons && (
            <View style={{ marginTop: 8, flexDirection: 'row' }}>
              <Pressable
                onPress={handleVerifyNow}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: pressed ? '#059669' : '#10B981',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  gap: 4,
                })}
              >
                <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Verify Now</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Right side: unread dot + delete button */}
        <View style={{ alignItems: 'center', gap: 8, paddingTop: 2 }}>
          {!item.IsRead && (
            <View style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: typeColor,
            }} />
          )}
          <Pressable
            onPress={(e) => {
              if (e?.stopPropagation) e.stopPropagation();
              handleDeleteNotification(item.NotificationID);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 4 }}
          >
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      </Pressable>
    );

    const anim = getDeleteAnim(item.NotificationID);
    return (
      <Animated.View
        key={item.NotificationID}
        style={{
          opacity: anim.opacity,
          transform: [{ scale: anim.scale }],
          maxHeight: anim.height.interpolate({ inputRange: [0, 1], outputRange: [0, 500] }),
          overflow: 'hidden',
        }}
      >
        {notificationContent}
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, ...(Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}) }}>
      {/* Header: Profile + Notifications + Messages */}
      <TabHeader
        title="Notifications"
        navigation={navigation}
        subtitle={unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600', marginTop: 2 }}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 }}>
            No notifications yet
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
            You'll see notifications about referrals, messages, payments, and more here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
          onScroll={handleScroll}
          scrollEventThrottle={200}
          showsVerticalScrollIndicator={true}
          refreshControl={
            Platform.OS !== 'web' ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
        >
          {notifications.map(renderNotification)}
          {loadingMore && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
