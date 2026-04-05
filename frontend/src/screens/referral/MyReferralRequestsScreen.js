import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import refopenAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import { showToast } from '../../components/Toast';

export default function MyReferralRequestsScreen({ route }) {
  const { user, isAdmin } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myRequests, setMyRequests] = useState([]);

  const [showProofViewer, setShowProofViewer] = useState(false);
  const [viewingProof, setViewingProof] = useState(null);
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'action'); // 'action' | 'progress' | 'closed'
  const [showExpiredSection, setShowExpiredSection] = useState(false);

  // Swipe gesture to switch tabs
  const TABS = ['action', 'progress', 'closed'];
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTabSwitch = (direction) => {
    slideAnim.setValue(direction * 40);
    Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  const switchTab = (newTab) => {
    const oldIdx = TABS.indexOf(activeTab);
    const newIdx = TABS.indexOf(newTab);
    if (oldIdx !== newIdx) {
      animateTabSwitch(newIdx > oldIdx ? 1 : -1);
      setActiveTab(newTab);
    }
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
  };
  const handleTouchEnd = (e) => {
    const dx = e.nativeEvent.pageX - touchStartX.current;
    const dy = e.nativeEvent.pageY - touchStartY.current;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const idx = TABS.indexOf(activeTab);
      if (dx < 0 && idx < TABS.length - 1) switchTab(TABS[idx + 1]);
      if (dx > 0 && idx > 0) switchTab(TABS[idx - 1]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMyRequests();
    }, [user])
  );

  // Load ALL requests in one call (no pagination — max ~50 per user)
  const loadMyRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const result = await refopenAPI.getMyReferralRequests(1, 500);
      if (result.success) {
        setMyRequests(result.data?.requests || []);
      } else {
        setMyRequests([]);
      }
    } catch (error) {
      console.error('Error loading my referral requests:', error);
      setMyRequests([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-select the best tab on first load (only if no initialTab was passed)
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (loading || hasAutoSelected.current || myRequests.length === 0) return;
    if (route?.params?.initialTab) { hasAutoSelected.current = true; return; }
    hasAutoSelected.current = true;
    const ACTION_CHECK = ['ProofUploaded', 'Completed'];
    const hasAction = myRequests.some(r =>
      (ACTION_CHECK.includes(r.Status) && !r.OpenToAnyCompany) ||
      (ACTION_CHECK.includes(r.Status) && r.OpenToAnyCompany && (r.PendingVerificationCount || 0) > 0)
    );
    setActiveTab(hasAction ? 'action' : 'progress');
  }, [loading, myRequests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMyRequests();
    setRefreshing(false);
  };

  // Check if request is expiring soon (within 5 days) and has no referrer yet — show CTA to convert to open
  const isExpiringSoon = (request) => {
    if (!['Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed'].includes(request.Status)) return false;
    if (request.OpenToAnyCompany) return false; // Already open — no action possible
    const expiryDate = request.ExpiryTime 
      ? new Date(request.ExpiryTime) 
      : new Date(new Date(request.RequestedAt).getTime() + 14 * 24 * 60 * 60 * 1000);
    const diffMs = expiryDate - new Date();
    return diffMs > 0 && diffMs <= 5 * 24 * 60 * 60 * 1000; // within 5 days
  };

  // Split requests into 3 categories: Action Needed / In Progress / Closed
  const ACTION_STATUSES = ['ProofUploaded', 'Completed'];
  const IN_PROGRESS_STATUSES = ['Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed'];
  const CLOSED_STATUSES = ['Verified', 'Unverified', 'Refunded', 'Cancelled', 'Expired'];

  const actionRequests = useMemo(() => {
    const filtered = myRequests.filter(r => {
      // Completed/ProofUploaded with pending verification children (open-to-any)
      if (ACTION_STATUSES.includes(r.Status) && r.OpenToAnyCompany && r.PendingVerificationCount > 0) return true;
      // Completed/ProofUploaded for targeted (non open-to-any) requests
      if (ACTION_STATUSES.includes(r.Status) && !r.OpenToAnyCompany) return true;
      return false;
    });
    // Oldest first — most urgent to verify at top
    return filtered.sort((a, b) => new Date(a.RequestedAt) - new Date(b.RequestedAt));
  }, [myRequests]);

  const progressRequests = useMemo(() => {
    const filtered = myRequests.filter(r => {
      if (IN_PROGRESS_STATUSES.includes(r.Status)) return true;
      // Open-to-any Completed/ProofUploaded with no pending verifications:
      // Still active — can receive more referrals from other companies.
      // Keep in InProgress until expired/cancelled.
      if (r.OpenToAnyCompany && ACTION_STATUSES.includes(r.Status) && (r.PendingVerificationCount || 0) === 0) return true;
      return false;
    });
    // Sort: convert-to-open eligible (expiring soon) first, then by oldest first
    return filtered.sort((a, b) => {
      const aExpiring = isExpiringSoon(a) ? 0 : 1;
      const bExpiring = isExpiringSoon(b) ? 0 : 1;
      if (aExpiring !== bExpiring) return aExpiring - bExpiring;
      return new Date(a.RequestedAt) - new Date(b.RequestedAt);
    });
  }, [myRequests]);

  const closedRequests = useMemo(() => {
    const filtered = myRequests.filter(r => {
      // Only truly terminal statuses go to Closed
      if (CLOSED_STATUSES.includes(r.Status)) return true;
      return false;
    });
    // Newest first — most recent completions at top
    return filtered.sort((a, b) => new Date(b.RequestedAt) - new Date(a.RequestedAt));
  }, [myRequests]);

  const filteredRequests = activeTab === 'action' ? actionRequests 
    : activeTab === 'progress' ? progressRequests 
    : closedRequests;

  // Relative time helper: "2 hours ago", "3 days ago", etc.
  const getRelativeTime = (dateString) => {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
        return colors.gray500;
      case 'NotifiedToReferrers':
        return colors.primary; // Blue - notified
      case 'Viewed':
        return colors.primary; // Blue - someone viewed it
      case 'Claimed':
        return colors.warning; // Amber - being worked on
      case 'ProofUploaded':
        return colors.accent; // Purple - proof submitted
      case 'Completed':
        return colors.success;
      case 'Verified':
        return colors.gold;
      case 'Unverified':
        return colors.error; // Red - not verified
      case 'Refunded':
        return colors.success; // Green - money returned
      case 'Cancelled':
        return colors.danger;
      case 'Expired':
        return colors.gray400; // Gray - expired
      default:
        return colors.gray500;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending':
        return 'time-outline';
      case 'NotifiedToReferrers':
        return 'notifications-outline';
      case 'Viewed':
        return 'eye-outline';
      case 'Claimed':
        return 'person-circle-outline';
      case 'ProofUploaded':
        return 'document-attach-outline';
      case 'Completed':
        return 'checkmark-circle';
      case 'Verified':
        return 'trophy';
      case 'Unverified':
        return 'alert-circle';
      case 'Refunded':
        return 'wallet-outline';
      case 'Cancelled':
        return 'close-circle-outline';
      case 'Expired':
        return 'hourglass-outline';
      default:
        return 'help-outline';
    }
  };

  const getStatusLabel = (status, request) => {
    // Open-to-any: show dynamic label based on child activity
    if (request?.OpenToAnyCompany && IN_PROGRESS_STATUSES.includes(status)) {
      if (request.ChildReferralCount > 0) {
        return `${request.ChildReferralCount} referral${request.ChildReferralCount > 1 ? 's' : ''} in progress`;
      }
      return 'Searching across companies';
    }

    // Open-to-any Completed with all children verified
    if (request?.OpenToAnyCompany && status === 'Completed' && (request.PendingVerificationCount || 0) === 0) {
      return 'All referrals verified';
    }

    switch (status) {
      case 'Pending':
        return 'Searching for referrer';
      case 'NotifiedToReferrers':
        return 'Referrers notified';
      case 'Viewed':
        return 'Seen by referrer';
      case 'Claimed':
        return 'Referrer working on it';
      case 'ProofUploaded':
        return 'Verify referral';
      case 'Completed':
        return 'Verify referral';
      case 'Verified':
        return 'Referral confirmed ✓';
      case 'Unverified':
        return 'Under review';
      case 'Refunded':
        return 'Refunded to wallet';
      case 'Cancelled':
        return 'Cancelled by you';
      case 'Expired':
        return 'No referrer found';
      default:
        return status;
    }
  };

  const handleViewProof = (request) => {
    if (!request.ProofFileURL) {
      showToast('Referrer has not uploaded proof yet', 'info');
      return;
    }
    setViewingProof(request);
    setShowProofViewer(true);
  };

  const handleViewTracking = (request) => {
    navigation.navigate('ReferralTracking', { 
      requestId: request.RequestID,
      request: request,
      fromTab: activeTab,
    });
  };

  const renderMyRequestCard = (request) => {
    const isExternalJob = !!request.ExtJobID;
    const isInternalJob = !!request.JobID && !request.ExtJobID;

    // Get initials for company placeholder
    const getCompanyInitials = (name) => {
      if (!name) return 'CO';
      const words = name.split(' ');
      if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    };

    // Generate a color based on company name
    const getCompanyColor = (name) => {
      const colorPalette = [
        colors.indigo, colors.accent, colors.pink, colors.error, colors.warning,
        colors.success, colors.cyan, colors.cyan, colors.primary, colors.indigo
      ];
      if (!name) return colorPalette[0];
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colorPalette[Math.abs(hash) % colorPalette.length];
    };

    const companyName = request.OpenToAnyCompany ? 'Any Company' : (request.CompanyName || 'Company');
    const companyColor = getCompanyColor(companyName);
    const isOpenToAny = !!request.OpenToAnyCompany;
    const isExpiredOrRefunded = ['Expired', 'Refunded', 'Cancelled'].includes(request.Status);

    return (
      <TouchableOpacity
        key={request.RequestID}
        style={[styles.requestCard, isExpiredOrRefunded && { opacity: 0.5 }]}
        onPress={() => handleViewTracking(request)}
        activeOpacity={0.7}
      >
        {/* Main row: Logo + Info + Chevron */}
        <View style={styles.requestHeader}>
          {/* Company Logo */}
          <View style={styles.logoContainer}>
            {isOpenToAny ? (
              <View style={[styles.logoPlaceholder, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="globe-outline" size={22} color={colors.primary} />
              </View>
            ) : request.OrganizationLogo ? (
              <Image
                source={{ uri: request.OrganizationLogo }}
                style={styles.companyLogo}
                onError={() => {}}
              />
            ) : (
              <View style={[styles.logoPlaceholder, { backgroundColor: companyColor }]}>
                <Text style={styles.logoInitials}>{getCompanyInitials(companyName)}</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.requestInfo}>
            <Text style={styles.jobTitlePrimary} numberOfLines={1}>
              {request.JobTitle || 'Job Title'}
            </Text>
            <Text style={styles.companyNameSecondary} numberOfLines={1}>
              {companyName}
            </Text>
            {isAdmin && request.SeekerName && (
              <Text style={{ fontSize: 10, color: colors.cyan, fontWeight: '500' }} numberOfLines={1}>
                👤 {request.SeekerName}{request.SeekerEmail ? ` · ${request.SeekerEmail}` : ''}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <Text style={styles.timeAgo}>
                {getRelativeTime(request.RequestedAt)}
              </Text>
              {/* Status chips — comprehensive for all states */}
              {(() => {
                const s = request.Status;
                const isOpen = !!request.OpenToAnyCompany;
                const pvc = request.PendingVerificationCount || 0;
                const crc = request.ChildReferralCount || 0;
                const uvc = request.UnverifiedChildCount || 0;
                const vcc = request.VerifiedChildCount || 0;
                const chipStyle = (bg, color) => ({ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 });
                const chipText = (color) => ({ fontSize: 9, fontWeight: '600', color });

                // In Progress statuses
                if (s === 'Pending') return (
                  <View style={chipStyle(colors.warning + '15', colors.warning)}>
                    <Ionicons name="hourglass-outline" size={10} color={colors.warning} />
                    <Text style={chipText(colors.warning)}>Awaiting</Text>
                  </View>
                );
                if (s === 'NotifiedToReferrers') return (
                  <View style={chipStyle(colors.primary + '15', colors.primary)}>
                    <Ionicons name="radio-outline" size={10} color={colors.primary} />
                    <Text style={chipText(colors.primary)}>{isOpen ? 'Broadcasting' : 'Live'}</Text>
                  </View>
                );
                if (s === 'Viewed') return (
                  <View style={chipStyle(colors.cyan + '15', colors.cyan)}>
                    <Ionicons name="eye-outline" size={10} color={colors.cyan} />
                    <Text style={chipText(colors.cyan)}>Seen</Text>
                  </View>
                );
                if (s === 'Claimed') return (
                  <View style={chipStyle(colors.primary + '15', colors.primary)}>
                    <Ionicons name="hand-right-outline" size={10} color={colors.primary} />
                    <Text style={chipText(colors.primary)}>Claimed</Text>
                  </View>
                );
                // Action needed — referral done, needs confirmation
                if ((s === 'Completed' || s === 'ProofUploaded') && (pvc > 0 || !isOpen)) return (
                  <View style={chipStyle(colors.success + '15', colors.success)}>
                    <Ionicons name="checkmark-circle" size={10} color={colors.success} />
                    <Text style={chipText(colors.success)}>{isOpen && pvc > 1 ? `${pvc} referred` : 'Referred'}</Text>
                  </View>
                );
                // Open-to-any: has unverified (disputed) children
                if ((s === 'Completed' || s === 'ProofUploaded') && isOpen && pvc === 0 && uvc > 0) return (
                  <View style={chipStyle(colors.error + '15', colors.error)}>
                    <Ionicons name="alert-circle" size={10} color={colors.error} />
                    <Text style={chipText(colors.error)}>{uvc} disputed</Text>
                  </View>
                );
                // Open-to-any completed, all verified (no unverified)
                if ((s === 'Completed' || s === 'ProofUploaded') && isOpen && pvc === 0 && uvc === 0 && vcc > 0) return (
                  <View style={chipStyle(colors.success + '15', colors.success)}>
                    <Ionicons name="checkmark-done" size={10} color={colors.success} />
                    <Text style={chipText(colors.success)}>All done</Text>
                  </View>
                );
                // Closed statuses
                if (s === 'Verified') return (
                  <View style={chipStyle(colors.success + '15', colors.success)}>
                    <Ionicons name="checkmark-circle" size={10} color={colors.success} />
                    <Text style={chipText(colors.success)}>Confirmed</Text>
                  </View>
                );
                if (s === 'Unverified') return (
                  <View style={chipStyle(colors.error + '15', colors.error)}>
                    <Ionicons name="close-circle" size={10} color={colors.error} />
                    <Text style={chipText(colors.error)}>Disputed</Text>
                  </View>
                );
                if (s === 'Cancelled') return (
                  <View style={chipStyle(colors.textMuted + '20', colors.textMuted)}>
                    <Ionicons name="ban" size={10} color={colors.textMuted} />
                    <Text style={chipText(colors.textMuted)}>Cancelled</Text>
                  </View>
                );
                if (s === 'Expired') return (
                  <View style={chipStyle(colors.textMuted + '20', colors.textMuted)}>
                    <Ionicons name="time-outline" size={10} color={colors.textMuted} />
                    <Text style={chipText(colors.textMuted)}>Expired</Text>
                  </View>
                );
                if (s === 'Refunded') return (
                  <View style={chipStyle(colors.success + '15', colors.success)}>
                    <Ionicons name="wallet-outline" size={10} color={colors.success} />
                    <Text style={chipText(colors.success)}>Refunded</Text>
                  </View>
                );
                return null;
              })()}
              {/* Open-to-any: show child count if any */}
              {!!request.OpenToAnyCompany && (request.ChildReferralCount || 0) > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#8B5CF6' + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                  <Ionicons name="people-outline" size={10} color={'#8B5CF6'} />
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#8B5CF6' }}>{request.ChildReferralCount} {request.ChildReferralCount === 1 ? 'company' : 'companies'}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Chevron — with Verify prefix when action needed, Convert to Open when expiring */}
          {(request.Status === 'Completed' || request.Status === 'ProofUploaded') &&
           (!request.OpenToAnyCompany || (request.PendingVerificationCount || 0) > 0) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="checkmark-circle" size={14} color={colors.warning} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.warning }}>Confirm</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.warning} />
            </View>
          ) : isExpiringSoon(request) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="globe-outline" size={14} color={'#8B5CF6'} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#8B5CF6' }}>Go Open</Text>
              <Ionicons name="chevron-forward" size={16} color={'#8B5CF6'} />
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 4 }} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="My Referral Requests" directBack="Home" />
      <View style={styles.innerContainer}>
        {/* Tabs */}
        {!loading && myRequests.length > 0 && (
          <View style={styles.tabBar}>
            {[
              { key: 'action', label: 'Pending', count: actionRequests.length, color: actionRequests.length > 0 ? colors.error : colors.primary },
              { key: 'progress', label: 'In Progress', count: progressRequests.length, color: colors.primary },
              { key: 'closed', label: 'Closed', count: closedRequests.length, color: colors.textSecondary },
            ].map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => switchTab(tab.key)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[
                    styles.tabText,
                    activeTab === tab.key && { color: tab.color, fontWeight: '700' },
                  ]}>
                    {tab.label}
                  </Text>
                  {tab.count > 0 && (
                    <View style={{ backgroundColor: activeTab === tab.key ? tab.color : colors.textMuted + '40', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: activeTab === tab.key ? '#fff' : colors.textMuted }}>{tab.count}</Text>
                    </View>
                  )}
                </View>
                {activeTab === tab.key && <View style={[styles.tabIndicator, { backgroundColor: tab.color }]} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading referral requests...</Text>
          </View>
        ) : myRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color={colors.gray400} />
            <Text style={styles.emptyTitle}>No Referral Requests</Text>
            <Text style={styles.emptyText}>
              You haven't requested any referrals yet. Use "Ask Referral" to get
              started.
            </Text>
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name={activeTab === 'action' ? 'checkmark-circle-outline' : activeTab === 'progress' ? 'hourglass-outline' : 'archive-outline'} size={64} color={colors.gray400} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'action' ? 'All caught up! ✅' : activeTab === 'progress' ? 'No requests in progress' : 'No closed requests'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'action'
                ? 'No referrals need your attention right now.'
                : activeTab === 'progress'
                ? 'Your active referral requests will appear here.'
                : 'Verified, expired, or cancelled requests will appear here.'}
            </Text>
          </View>
        ) : (
          <>
          {activeTab === 'closed' ? (
            // Closed tab: split into active-closed (top) and expired/cancelled (collapsed bottom)
            (() => {
              const activeClosed = filteredRequests.filter(r => !['Expired', 'Refunded', 'Cancelled'].includes(r.Status));
              const expiredItems = filteredRequests.filter(r => ['Expired', 'Refunded', 'Cancelled'].includes(r.Status));
              return (
                <>
                  {activeClosed.map(renderMyRequestCard)}
                  {expiredItems.length > 0 && (
                    <>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 8, gap: 6 }}
                        onPress={() => setShowExpiredSection(!showExpiredSection)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={showExpiredSection ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                          {showExpiredSection ? 'Hide' : 'Show'} expired & cancelled ({expiredItems.length})
                        </Text>
                      </TouchableOpacity>
                      {showExpiredSection && expiredItems.map(renderMyRequestCard)}
                    </>
                  )}
                </>
              );
            })()
          ) : (
            filteredRequests.map(renderMyRequestCard)
          )}
          </>
        )}
      </ScrollView>
      </Animated.View>
      </View>

      {showProofViewer && viewingProof && (
        <Modal
          visible={showProofViewer}
          animationType="slide"
          onRequestClose={() => setShowProofViewer(false)}
        >
          <View style={{ flex: 1, backgroundColor: colors.black }}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 40, right: 20, zIndex: 10 }}
              onPress={() => setShowProofViewer(false)}
            >
              <Ionicons name="close" size={32} color={colors.white} />
            </TouchableOpacity>
            <Image
              source={{ uri: viewingProof.ProofFileURL }}
              style={{ flex: 1, resizeMode: 'contain' }}
            />
            <View style={{ padding: 16, backgroundColor: 'rgba(0,0,0,0.6)' }}>
              <Text style={{ color: colors.white, fontWeight: 'bold', marginBottom: 8 }}>
                Proof Description
              </Text>
              <Text style={{ color: colors.white }}>
                {viewingProof.ProofDescription || 'No description provided'}
              </Text>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  innerContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 900 : '100%',
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 3,
    borderRadius: 1.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  content: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 20,
  },

  requestCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoContainer: {},
  companyLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.gray100,
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  requestInfo: {
    flex: 1,
    gap: 2,
  },
  jobTitlePrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  companyNameSecondary: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  timeAgo: {
    fontSize: 12,
    color: colors.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginLeft: 56,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.warning + '12',
    alignSelf: 'flex-end',
  },
  actionHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 4,
  },
  statusPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.error,
    gap: 4,
  },
  withdrawBtnText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    fontWeight: typography.weights.semibold,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.success,
    borderRadius: 6,
    gap: 4,
  },
  verifyBtnText: {
    fontSize: typography.sizes.xs,
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
  viewProofCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.accentBg,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.accentBg,
  },
  viewProofCardBtnText: {
    fontSize: typography.sizes.xs,
    color: colors.accent,
    fontWeight: typography.weights.semibold,
  },
  seekerMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border || colors.gray100,
  },
  seekerMessageText: {
    flex: 1,
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.gray400,
    lineHeight: 16,
  },
  seekerMessageToggle: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    marginLeft: 4,
    marginTop: 1,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  trackBtnText: {
    fontSize: typography.sizes.xs,
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  // Keep old styles for backward compatibility (unused now)
  jobTypeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  jobTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    flexShrink: 1,
    lineHeight: 18,
  },
  externalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  externalBadgeText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  internalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  internalBadgeText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  companyName: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 16,
  },
  externalJobIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  externalJobIdText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    flexShrink: 1,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 6,
  },
  requestDate: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginLeft: 4,
    lineHeight: 14,
  },
  referrerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  referrerName: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontWeight: typography.weights.semibold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: colors.gray100,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginLeft: 3,
  },
  viewProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.primary + '20',
    borderRadius: 6,
    gap: 4,
  },

  confirmOverlay: {
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
      default: {
        flex: 1,
      },
    }),
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  confirmIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.warningLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  confirmMessage: {
    fontSize: typography.sizes.sm,
    color: colors.gray700,
    lineHeight: 20,
    marginBottom: 16,
  },
  feeTableContainer: {
    marginBottom: 12,
  },
  feeTableToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  feeTableToggleText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feeTable: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  feeTableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceHover || colors.gray100,
  },
  feeTableHeaderCell: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  feeTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  feeTableRowActive: {
    backgroundColor: (colors.primaryLight) + '40',
  },
  feeTableCell: {
    fontSize: typography.sizes.sm,
    color: colors.gray700,
  },
  feeTableNote: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    marginTop: 8,
    lineHeight: 16,
  },
  feeAutoRefundTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    padding: 10,
    backgroundColor: (colors.primaryLight) + '30',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: (colors.primary) + '20',
  },
  feeAutoRefundText: {
    flex: 1,
    fontSize: 11,
    color: colors.gray600 || colors.gray500,
    lineHeight: 16,
  },
  jobTitleInModal: {
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  confirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  keepBtn: {
    backgroundColor: colors.gray100,
  },
  keepBtnText: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  cancelReqBtn: {
    backgroundColor: colors.dangerLight,
  },
  cancelReqBtnText: {
    color: colors.danger,
    fontWeight: typography.weights.semibold,
  },
  trackingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  trackingHintText: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
  },

  // Verification modal styles
  verifyIconContainer: {
    backgroundColor: colors.primaryDark || 'rgba(59, 130, 246, 0.2)',
  },
  verifyInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  verifyInfoText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.primaryLight,
    lineHeight: 18,
  },
  referrerMessageBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  referrerMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  referrerMessageLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.successLight,
  },
  referrerMessageText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  viewProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  viewProofBtnText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  noBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  noBtnText: {
    color: colors.dangerLight,
    fontWeight: typography.weights.semibold,
  },
  yesBtn: {
    backgroundColor: colors.primary,
  },
  yesBtnText: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
});
