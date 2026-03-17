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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import refopenAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import VerifyReferralModal from '../../components/modals/VerifyReferralModal';
import useResponsive from '../../hooks/useResponsive';
import useWebInfiniteScroll from '../../hooks/useWebInfiniteScroll';
import { typography } from '../../styles/theme';
import { showToast } from '../../components/Toast';

export default function MyReferralRequestsScreen({ route }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, hasMore: true });
  const isLoadingMoreRef = useRef(false);

  const [showProofViewer, setShowProofViewer] = useState(false);
  const [viewingProof, setViewingProof] = useState(null);
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'action'); // 'action' | 'progress' | 'closed'

  const [verifyTarget, setVerifyTarget] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadMyRequests();
    }, [user])
  );

  const loadMyRequests = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await refopenAPI.getMyReferralRequests(1, pagination.pageSize);
      if (result.success) {
        const requests = result.data?.requests || [];
        setMyRequests(requests);
        const total = result.data?.total || result.total || 0;
        const hasMore = requests.length === pagination.pageSize && requests.length < total;
        setPagination(prev => ({ ...prev, page: 1, hasMore }));
      } else {
        setMyRequests([]);
        setPagination(prev => ({ ...prev, hasMore: false }));
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
    // Match the same logic as actionRequests filter
    const ACTION_CHECK = ['ProofUploaded', 'Completed'];
    const hasAction = myRequests.some(r =>
      (ACTION_CHECK.includes(r.Status) && !r.OpenToAnyCompany) ||
      (ACTION_CHECK.includes(r.Status) && r.OpenToAnyCompany && (r.PendingVerificationCount || 0) > 0)
    );
    if (hasAction) {
      setActiveTab('action');
    } else {
      setActiveTab('progress');
    }
  }, [loading, myRequests]);

  // Load more referral requests (next page)
  const loadMoreRequests = useCallback(async () => {
    if (loading || loadingMore || !pagination.hasMore) return;
    if (isLoadingMoreRef.current) return;

    const nextPage = pagination.page + 1;
    try {
      isLoadingMoreRef.current = true;
      setLoadingMore(true);
      const result = await refopenAPI.getMyReferralRequests(nextPage, pagination.pageSize);
      if (result.success) {
        const newRequests = result.data?.requests || [];
        if (newRequests.length > 0) {
          setMyRequests(prev => [...prev, ...newRequests]);
        }
        const hasMore = newRequests.length === pagination.pageSize;
        setPagination(prev => ({ ...prev, page: nextPage, hasMore }));
      }
    } catch (error) {
      console.error('Error loading more referral requests:', error);
    } finally {
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, [loading, loadingMore, pagination]);

  // Infinite scroll handler
  const onScrollNearEnd = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent || {};
    if (!contentOffset || !contentSize || !layoutMeasurement) return;
    if (loading || loadingMore || !pagination.hasMore) return;
    const threshold = 160;
    const isNearEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - threshold;
    if (isNearEnd) {
      loadMoreRequests();
    }
  }, [loading, loadingMore, pagination.hasMore, loadMoreRequests]);

  // Web infinite scroll: IntersectionObserver watches sentinel at bottom of list
  const webSentinelRef = useWebInfiniteScroll({
    loading,
    loadingMore,
    hasMore: pagination.hasMore,
    loadMore: loadMoreRequests,
  });

  // Auto-load more if content doesn't fill the viewport after initial load
  useEffect(() => {
    if (!loading && !loadingMore && pagination.hasMore && myRequests.length > 0 && myRequests.length <= pagination.pageSize) {
      // Small delay to let layout settle
      const timer = setTimeout(() => {
        if (pagination.hasMore && !isLoadingMoreRef.current) {
          loadMoreRequests();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, myRequests.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => {
    setRefreshing(true);
    setPagination(prev => ({ ...prev, page: 1, hasMore: true }));
    await loadMyRequests();
    setRefreshing(false);
  };

  // Split requests into 3 categories: Action Needed / In Progress / Closed
  const ACTION_STATUSES = ['ProofUploaded', 'Completed']; // Seeker needs to verify
  const IN_PROGRESS_STATUSES = ['Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed'];
  const CLOSED_STATUSES = ['Verified', 'Unverified', 'Refunded', 'Cancelled', 'Expired'];

  const actionRequests = useMemo(() => myRequests.filter(r => {
    // Completed/ProofUploaded with pending verification children (open-to-any)
    if (ACTION_STATUSES.includes(r.Status) && r.OpenToAnyCompany && r.PendingVerificationCount > 0) return true;
    // Completed/ProofUploaded for targeted (non open-to-any) requests
    if (ACTION_STATUSES.includes(r.Status) && !r.OpenToAnyCompany) return true;
    return false;
  }), [myRequests]);

  const progressRequests = useMemo(() => myRequests.filter(r => {
    if (IN_PROGRESS_STATUSES.includes(r.Status)) return true;
    // Open-to-any Completed but all children already verified — nothing to do, but not truly closed
    // Open-to-any Completed but all children already verified → closed
    return false;
  }), [myRequests]);

  const closedRequests = useMemo(() => myRequests.filter(r => {
    if (CLOSED_STATUSES.includes(r.Status)) return true;
    // Open-to-any Completed with no pending verifications → all done
    if (r.OpenToAnyCompany && ACTION_STATUSES.includes(r.Status) && (r.PendingVerificationCount || 0) === 0) return true;
    return false;
  }), [myRequests]);

  const filteredRequests = activeTab === 'action' ? actionRequests 
    : activeTab === 'progress' ? progressRequests 
    : closedRequests;

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';

    const date = new Date(dateString);
    const dateOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    const timeOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };

    return `${date.toLocaleDateString('en-US', dateOptions)} at ${date.toLocaleTimeString('en-US', timeOptions)}`;
  };

  // Calculate remaining time from ExpiryTime
  const getExpiryInfo = (request) => {
    if (!['Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed'].includes(request.Status)) return null;
    const expiryDate = request.ExpiryTime 
      ? new Date(request.ExpiryTime) 
      : new Date(new Date(request.RequestedAt).getTime() + 14 * 24 * 60 * 60 * 1000); // fallback 14 days
    const now = new Date();
    const diffMs = expiryDate - now;
    if (diffMs <= 0) return { text: 'Expiring soon', color: colors.error };
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (diffDays > 3) return null; // Only show when 3 days or less remain
    if (diffDays >= 1) return { text: `${diffDays}d ${diffHours}h left`, color: colors.warning };
    return { text: `${diffHours}h left`, color: colors.error };
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

  const handleVerifyReferral = async (requestId) => {
    const request = myRequests.find((r) => r.RequestID === requestId);
    setVerifyTarget({ requestId, request });
  };

  const performVerifyReferral = async (requestId, verified) => {
    try {
      const result = await refopenAPI.verifyReferralCompletion(requestId, verified);
      if (result.success) {
        const newStatus = verified ? 'Verified' : 'Unverified';
        showToast(
          verified
            ? 'Referral verified!'
            : 'Marked as unverified. A support ticket has been created — our team will review within 2 working days.',
          verified ? 'success' : 'info'
        );
        setMyRequests((prev) =>
          prev.map((r) =>
            r.RequestID === requestId
              ? { ...r, Status: newStatus, VerifiedByApplicant: verified ? 1 : 0 }
              : r
          )
        );
        loadMyRequests();
      } else {
        showToast('Failed to verify referral. Please try again.', 'error');
      }
    } catch (e) {
      console.error('Verify error:', e);
      showToast('Failed to verify referral. Please try again.', 'error');
    }
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
        <View style={styles.requestHeader}>
          {/* Company Logo */}
          <View style={styles.logoContainer}>
            {isOpenToAny ? (
              <View style={[styles.logoPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="globe-outline" size={20} color={colors.primary} />
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

          <View style={styles.requestInfo}>
            <Text style={styles.companyNamePrimary} numberOfLines={1}>
              {companyName}
            </Text>

            <View style={styles.forJobRow}>
              <Text style={styles.forJobText}>for </Text>
              <Text style={styles.jobTitleBold} numberOfLines={1}>
                {request.JobTitle || 'Job Title'}
              </Text>
            </View>

            <View style={styles.metaRow}>
              {isInternalJob && (
                <>
                  <Text style={[styles.jobTypePill, { color: colors.primary }]}>Internal</Text>
                  <Text style={styles.metaDot}>•</Text>
                </>
              )}
              {isExternalJob && (
                <>
                  <Text style={[styles.jobTypePill, { color: colors.accent }]}>External</Text>
                  <Text style={styles.metaDot}>•</Text>
                </>
              )}
              <Text style={styles.timeAgo}>
                {formatDate(request.RequestedAt)}
              </Text>
              {(() => {
                const expiry = getExpiryInfo(request);
                if (!expiry) return null;
                return (
                  <>
                    <Text style={styles.metaDot}>•</Text>
                    <Ionicons name="timer-outline" size={12} color={expiry.color} />
                    <Text style={{ fontSize: 11, color: expiry.color, fontWeight: '600', marginLeft: 2 }}>{expiry.text}</Text>
                  </>
                );
              })()}
            </View>

            {request.OpenToAnyCompany && request.MinSalary ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="cash-outline" size={12} color={colors.success} style={{ marginRight: 4 }} />
                <Text style={{ color: colors.success, fontSize: 12, fontWeight: '500' }}>
                  Min {request.SalaryCurrency === 'USD' ? '$' : '₹'}{request.MinSalary?.toLocaleString()}{request.SalaryPeriod === 'Annual' ? '/yr' : '/mo'}
                </Text>
              </View>
            ) : null}

            {/* Child referral count badge */}
            {request.ChildReferralCount > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.success }}>
                  {request.ChildReferralCount} referral{request.ChildReferralCount > 1 ? 's' : ''} received
                </Text>
              </View>
            )}
          </View>

          {/* Status icon - top right */}
          <View
            style={[styles.statusIconBtn, { backgroundColor: getStatusColor(request.Status) + '18' }]}
          >
            <Ionicons
              name={getStatusIcon(request.Status)}
              size={16}
              color={getStatusColor(request.Status)}
            />
          </View>
        </View>

        {/* Verify button — only when there's something to verify */}
        {(request.Status === 'Completed' || request.Status === 'ProofUploaded') &&
         (!request.OpenToAnyCompany || (request.PendingVerificationCount || 0) > 0) && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.success + '10', borderWidth: 1, borderColor: colors.success + '30', alignSelf: 'flex-end' }}
            onPress={(e) => { e.stopPropagation?.(); handleVerifyReferral(request.RequestID); }}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.success }}>Verify Referral</Text>
          </TouchableOpacity>
        )}
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
              { key: 'action', label: 'Action', count: actionRequests.length, color: actionRequests.length > 0 ? colors.error : colors.primary },
              { key: 'progress', label: 'In Progress', count: progressRequests.length, color: colors.primary },
              { key: 'closed', label: 'Closed', count: closedRequests.length, color: colors.textSecondary },
            ].map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === tab.key && { color: tab.color, fontWeight: '700' },
                ]}>
                  {tab.label}{tab.count > 0 ? ` (${tab.count})` : ''}
                </Text>
                {activeTab === tab.key && <View style={[styles.tabIndicator, { backgroundColor: tab.color }]} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onScroll={onScrollNearEnd}
          scrollEventThrottle={16}
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
          {filteredRequests.map(renderMyRequestCard)}
          {loadingMore && (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: 14 }}>Loading more requests...</Text>
            </View>
          )}
          {Platform.OS === 'web' && pagination.hasMore && (
            <View ref={webSentinelRef} style={{ height: 1, width: '100%' }} />
          )}
          </>
        )}
      </ScrollView>
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

      {/* Verification Confirmation Modal */}
      <VerifyReferralModal
        visible={!!verifyTarget}
        jobTitle={verifyTarget?.request?.JobTitle}
        proofFileURL={verifyTarget?.request?.ProofFileURL}
        proofDescription={verifyTarget?.request?.ProofDescription}
        onClose={() => setVerifyTarget(null)}
        onVerify={(verified) => {
          const requestId = verifyTarget?.requestId;
          setVerifyTarget(null);
          if (requestId != null) performVerifyReferral(requestId, verified);
        }}
      />
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
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200 || colors.border,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  logoContainer: {
    marginTop: 2,
  },
  companyLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitials: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  requestInfo: {
    flex: 1,
  },
  companyNamePrimary: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  forJobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 4,
  },
  forJobText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  jobTitleBold: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  jobTypePill: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  metaDot: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  timeAgo: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 6,
    marginLeft: 52,
    gap: 6,
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
