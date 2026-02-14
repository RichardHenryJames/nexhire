/**
 * NotificationBell Component
 * Bell icon with badge + dropdown panel for in-app notifications
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { colors as brandColors } from '../../styles/theme';
import { useNavigation } from '@react-navigation/native';
import refopenAPI from '../../services/api';

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

export default function NotificationBell() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [showPanel, setShowPanel] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pollRef = useRef(null);

  // Poll for unread count every 30 seconds
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await refopenAPI.apiCall('/notifications/unread-count');
      if (res.success) {
        setUnreadCount(res.data?.count || 0);
      }
    } catch (e) {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    pollRef.current = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchUnreadCount]);

  // Fetch notifications when panel opens
  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await refopenAPI.apiCall(`/notifications?page=${pageNum}&pageSize=15`);
      if (res.success) {
        const items = res.data?.notifications || [];
        if (append) {
          setNotifications(prev => [...prev, ...items]);
        } else {
          setNotifications(items);
        }
        setHasMore(pageNum < (res.data?.totalPages || 1));
        setPage(pageNum);
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const handleOpen = () => {
    setShowPanel(true);
    fetchNotifications(1);
  };

  const handleClose = () => {
    setShowPanel(false);
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

  const handleNotificationPress = async (notification) => {
    // Mark as read
    if (!notification.IsRead) {
      try {
        await refopenAPI.apiCall(`/notifications/${notification.NotificationID}/read`, { method: 'PATCH' });
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n => 
          n.NotificationID === notification.NotificationID ? { ...n, IsRead: true } : n
        ));
      } catch (e) {}
    }

    // Navigate based on actionUrl
    handleClose();
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

  const loadMore = () => {
    if (hasMore && !loadingMore) {
      fetchNotifications(page + 1, true);
    }
  };

  const renderNotification = (item) => {
    const iconName = ICON_MAP[item.Icon] || 'notifications';
    const typeColor = TYPE_COLORS[item.NotificationType] || colors.primary;

    return (
      <TouchableOpacity
        key={item.NotificationID}
        onPress={() => handleNotificationPress(item)}
        style={{
          flexDirection: 'row',
          padding: 14,
          backgroundColor: item.IsRead ? 'transparent' : typeColor + '08',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: typeColor + '20',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
          marginTop: 2,
        }}>
          <Ionicons name={iconName} size={18} color={typeColor} />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <Text style={{
            color: colors.text,
            fontSize: 14,
            fontWeight: item.IsRead ? '400' : '600',
            marginBottom: 3,
          }} numberOfLines={2}>
            {item.Title}
          </Text>
          <Text style={{
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 18,
          }} numberOfLines={2}>
            {item.Body}
          </Text>
          <Text style={{
            color: colors.textSecondary,
            fontSize: 11,
            marginTop: 4,
          }}>
            {timeAgo(item.CreatedAt)}
          </Text>

          {/* Action buttons for referral notifications */}
          {['referral_submitted', 'referral_verify_reminder'].includes(item.NotificationType) && (
            <View style={{ marginTop: 6, flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#10B981',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 5,
                  gap: 4,
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={12} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Verify Now</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Unread dot */}
        {!item.IsRead && (
          <View style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: typeColor,
            marginTop: 6,
            marginLeft: 8,
          }} />
        )}
      </TouchableOpacity>
    );
  };

  // Panel content
  const panelContent = (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: 12,
      maxHeight: 500,
      width: Platform.OS === 'web' ? 380 : Dimensions.get('window').width - 32,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
          🔔 Notifications
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                Mark all read
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Ionicons name="notifications-off-outline" size={40} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 12 }}>
            No notifications yet
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ maxHeight: 420 }}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
            if (isBottom) loadMore();
          }}
          scrollEventThrottle={200}
        >
          {notifications.map(renderNotification)}
          {loadingMore && (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );

  return (
    <>
      {/* Bell Icon */}
      <TouchableOpacity
        onPress={handleOpen}
        activeOpacity={0.7}
        style={{ padding: 6, marginRight: 4 }}
      >
        <Ionicons 
          name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} 
          size={24} 
          color={unreadCount > 0 ? '#F59E0B' : colors.primary} 
        />
        {unreadCount > 0 && (
          <View style={{
            position: 'absolute',
            top: 2,
            right: 0,
            backgroundColor: '#EF4444',
            borderRadius: 10,
            minWidth: 18,
            height: 18,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 4,
          }}>
            <Text style={{
              color: '#fff',
              fontSize: 10,
              fontWeight: '700',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Notification Panel - Modal for proper overlay */}
      <Modal
        visible={showPanel}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-start',
            alignItems: Platform.OS === 'web' ? 'flex-end' : 'center',
            paddingTop: Platform.OS === 'web' ? 60 : 100,
            paddingRight: Platform.OS === 'web' ? 80 : 0,
            paddingHorizontal: Platform.OS === 'web' ? 0 : 16,
          }}
          activeOpacity={1}
          onPress={handleClose}
        >
          <TouchableOpacity activeOpacity={1}>
            {panelContent}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
