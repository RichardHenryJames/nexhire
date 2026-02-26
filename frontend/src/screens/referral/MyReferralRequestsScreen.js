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
import { getReferralCostForJob } from '../../utils/pricingUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import { showToast } from '../../components/Toast';
import { usePricing } from '../../contexts/PricingContext';

export default function MyReferralRequestsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { pricing } = usePricing();
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

  const [cancelTarget, setCancelTarget] = useState(null);
  const [feeTableExpanded, setFeeTableExpanded] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [expandedMessages, setExpandedMessages] = useState(new Set());

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
        return colors.gray500;
      case 'NotifiedToReferrers':
        return colors.primary; // Blue - notified
      case 'Viewed':
        return colors.primary; // Blue - someone viewed it
      case 'Claimed':
        return '#F59E0B'; // Amber - being worked on
      case 'ProofUploaded':
        return '#8B5CF6'; // Purple - proof submitted
      case 'Completed':
        return colors.success;
      case 'Verified':
        return '#ffd700';
      case 'Unverified':
        return '#ef4444'; // Red - not verified
      case 'Refunded':
        return '#10B981'; // Green - money returned
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

  const getStatusLabel = (status) => {
    switch (status) {
      case 'Pending':
        return 'Waiting for referrer';
      case 'NotifiedToReferrers':
        return 'Broadcasted';
      case 'Viewed':
        return 'Viewed by referrer';
      case 'Claimed':
        return 'Being referred';
      case 'ProofUploaded':
        return 'Referral submitted';
      case 'Completed':
        return 'Completed';
      case 'Verified':
        return 'Verified';
      case 'Unverified':
        return 'Unverified';
      case 'Refunded':
        return 'Refunded ✓';
      case 'Cancelled':
        return 'Cancelled';
      case 'Expired':
        return 'Expired (no referrer)';
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
            ? 'Referral verified! Referrer has been rewarded.'
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

  const handleCancelRequest = async (requestId) => {
    const request = myRequests.find((r) => r.RequestID === requestId);
    setFeeTableExpanded(false);
    setCancelTarget({ requestId, request });
  };

  const performCancelRequest = async (requestId) => {
    try {
      const res = await refopenAPI.cancelReferralRequest(requestId);

      if (res.success) {
        setMyRequests((prev) =>
          prev.map((r) =>
            r.RequestID === requestId ? { ...r, Status: 'Cancelled' } : r
          )
        );
        showToast('Request withdrawn. Hold amount released to wallet.', 'success');
      } else {
        console.error('Cancel request failed:', res.error);
        showToast('Failed to cancel. Please try again.', 'error');
      }
    } catch (e) {
      console.error('Cancel request error:', e);
      showToast('Failed to cancel. Please try again.', 'error');
    }
  };

  const handleViewTracking = (request) => {
    navigation.navigate('ReferralTracking', { 
      requestId: request.RequestID,
      request: request
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
        '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B',
        '#10B981', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1'
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

    return (
      <View key={request.RequestID} style={styles.requestCard}>
        <View style={styles.requestHeader}>
          {/* Company Logo - clickable to org screen */}
          <TouchableOpacity 
            style={styles.logoContainer}
            onPress={() => {
              if (!isOpenToAny && request.OrganizationID) {
                navigation.navigate('OrganizationDetails', { 
                  organizationId: request.OrganizationID 
                });
              }
            }}
          >
            {isOpenToAny ? (
              <View style={[styles.logoPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="globe-outline" size={24} color={colors.primary} />
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
          </TouchableOpacity>

          <View style={styles.requestInfo}>
            {/* Company Name - Primary */}
            <TouchableOpacity 
              onPress={() => {
                if (!isOpenToAny && request.OrganizationID) {
                  navigation.navigate('OrganizationDetails', { 
                    organizationId: request.OrganizationID 
                  });
                }
              }}
            >
              <Text style={styles.companyNamePrimary} numberOfLines={1}>
                {companyName}
              </Text>
            </TouchableOpacity>

            {/* "for [Job Title]" row */}
            <View style={styles.forJobRow}>
              <Text style={styles.forJobText}>for </Text>
              <Text style={styles.jobTitleBold} numberOfLines={1}>
                {request.JobTitle || 'Job Title'}
              </Text>
            </View>

            {/* Meta Row: Internal/External • Date */}
            <View style={styles.metaRow}>
              {isInternalJob && (
                <>
                  <Text style={[styles.jobTypePill, { color: colors.primary }]}>Internal</Text>
                  <Text style={styles.metaDot}>•</Text>
                </>
              )}
              {isExternalJob && (
                <>
                  <Text style={[styles.jobTypePill, { color: '#8B5CF6' }]}>External</Text>
                  <Text style={styles.metaDot}>•</Text>
                </>
              )}
              <Text style={styles.timeAgo}>
                {formatDate(request.RequestedAt)}
              </Text>
            </View>

            {/* Salary row - separate line */}
            {request.OpenToAnyCompany && request.MinSalary ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="cash-outline" size={12} color="#10B981" style={{ marginRight: 4 }} />
                <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '500' }}>
                  Min {request.SalaryCurrency === 'USD' ? '$' : '₹'}{request.MinSalary?.toLocaleString()}{request.SalaryPeriod === 'Annual' ? '/yr' : '/mo'}
                </Text>
              </View>
            ) : null}

          </View>

          {/* Status icon - top right */}
          <TouchableOpacity
            style={[styles.statusIconBtn, { backgroundColor: getStatusColor(request.Status) + '18' }]}
            onPress={() => showToast(getStatusLabel(request.Status), 'info')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={getStatusIcon(request.Status)}
              size={16}
              color={getStatusColor(request.Status)}
            />
          </TouchableOpacity>
        </View>

        {/* Seeker Message - collapsible */}
        {request.ReferralMessage ? (
          <TouchableOpacity
            style={styles.seekerMessageRow}
            onPress={() => {
              setExpandedMessages(prev => {
                const next = new Set(prev);
                if (next.has(request.RequestID)) next.delete(request.RequestID);
                else next.add(request.RequestID);
                return next;
              });
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.gray400} style={{ marginRight: 4, marginTop: 1 }} />
            <Text
              style={styles.seekerMessageText}
              numberOfLines={expandedMessages.has(request.RequestID) ? undefined : 1}
            >
              {request.ReferralMessage}
            </Text>
            {request.ReferralMessage.length > 50 && (
              <Text style={styles.seekerMessageToggle}>
                {expandedMessages.has(request.RequestID) ? 'less' : 'more'}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}

        {/* Status + Track Button Row - full width */}
        <View style={styles.bottomRow}>
          {/* Withdraw Button - only for open statuses (not Claimed - someone is working on it) */}
          {['Pending', 'NotifiedToReferrers', 'Viewed'].includes(request.Status) && (
            <TouchableOpacity 
              style={styles.withdrawBtn}
              onPress={() => handleCancelRequest(request.RequestID)}
            >
              <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
              <Text style={styles.withdrawBtnText}>Withdraw</Text>
            </TouchableOpacity>
          )}

          {/* Verify Button - show when referrer completed (ProofUploaded/Completed) and not yet verified */}
          {['ProofUploaded', 'Completed'].includes(request.Status) && !request.VerifiedByApplicant && (
            <TouchableOpacity 
              style={styles.verifyBtn}
              onPress={() => handleVerifyReferral(request.RequestID)}
            >
              <Ionicons name="checkmark-circle-outline" size={14} color="#FFFFFF" />
              <Text style={styles.verifyBtnText}>Verify</Text>
            </TouchableOpacity>
          )}

          {/* Track Button */}
          <TouchableOpacity 
            style={styles.trackBtn}
            onPress={() => handleViewTracking(request)}
          >
            <Text style={styles.trackBtnText}>Track</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="My Referral Requests" fallbackTab="Home" />
      <View style={styles.innerContainer}>
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
        ) : (
          <>
          {myRequests.map(renderMyRequestCard)}
          {loadingMore && (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: 14 }}>Loading more requests...</Text>
            </View>
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
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 40, right: 20, zIndex: 10 }}
              onPress={() => setShowProofViewer(false)}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <Image
              source={{ uri: viewingProof.ProofFileURL }}
              style={{ flex: 1, resizeMode: 'contain' }}
            />
            <View style={{ padding: 16, backgroundColor: 'rgba(0,0,0,0.6)' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>
                Proof Description
              </Text>
              <Text style={{ color: '#fff' }}>
                {viewingProof.ProofDescription || 'No description provided'}
              </Text>
            </View>
          </View>
        </Modal>
      )}

      <Modal
        visible={!!cancelTarget}
        transparent
        onRequestClose={() => setCancelTarget(null)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setCancelTarget(null)}>
          <Pressable style={styles.confirmBox} onPress={() => {}}>
            <View style={styles.confirmHeader}>
              <View style={styles.confirmIconContainer}>
                <Ionicons name="warning" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.confirmTitle}>Withdraw Referral Request</Text>
            </View>

            <Text style={styles.confirmMessage}>
              Are you sure you want to withdraw your referral request for{' '}
              <Text style={styles.jobTitleInModal}>
                {cancelTarget?.request?.JobTitle || 'this job'}
              </Text>
              ?
            </Text>

            {(() => {
              const hoursElapsed = cancelTarget?.request?.RequestedAt
                ? (Date.now() - new Date(cancelTarget.request.RequestedAt).getTime()) / (1000 * 60 * 60)
                : 999;
              const currentTier = hoursElapsed < 1 ? 0 : hoursElapsed <= 24 ? 1 : 2;
              const heldAmount = cancelTarget?.request?.OpenToAnyCompany ? pricing.openToAnyReferralCost : getReferralCostForJob(cancelTarget?.request || {}, pricing);
              const tiers = [
                { label: 'Within 1 hour', fee: '₹0 (Free)', color: '#10B981' },
                { label: '1 – 24 hours', fee: '₹10', color: '#F59E0B' },
                { label: 'After 24 hours', fee: '₹20', color: '#EF4444' },
              ];
              return (
                <View style={styles.feeTableContainer}>
                  <Text style={styles.feeTableNote}>
                    {currentTier === 0
                      ? '✅ You are within the free cancellation window. Full amount will be released.'
                      : `A ${tiers[currentTier].fee} fee will be deducted. Remaining ₹${heldAmount - (currentTier === 1 ? 10 : 20)} released to wallet.`
                    }
                  </Text>
                  <TouchableOpacity
                    style={styles.feeTableToggle}
                    onPress={() => setFeeTableExpanded(!feeTableExpanded)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pricetag-outline" size={13} color={colors.gray500} />
                    <Text style={styles.feeTableToggleText}>Cancellation Fee Schedule</Text>
                    <Ionicons
                      name={feeTableExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.gray500}
                    />
                  </TouchableOpacity>
                  {feeTableExpanded && (
                    <View style={styles.feeTable}>
                      <View style={styles.feeTableHeaderRow}>
                        <Text style={[styles.feeTableHeaderCell, { flex: 1 }]}>Time Since Request</Text>
                        <Text style={[styles.feeTableHeaderCell, { flex: 1, textAlign: 'right' }]}>Fee</Text>
                      </View>
                      {tiers.map((tier, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.feeTableRow,
                            currentTier === idx && styles.feeTableRowActive,
                            idx === tiers.length - 1 && { borderBottomWidth: 0 },
                          ]}
                        >
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {currentTier === idx && (
                              <Ionicons name="arrow-forward-circle" size={14} color={tier.color} />
                            )}
                            <Text style={[
                              styles.feeTableCell,
                              currentTier === idx && { fontWeight: '700', color: colors.textPrimary },
                            ]}>{tier.label}</Text>
                          </View>
                          <Text style={[
                            styles.feeTableCell,
                            { flex: 1, textAlign: 'right', color: tier.color, fontWeight: '600' },
                            currentTier === idx && { fontWeight: '700' },
                          ]}>{tier.fee}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={styles.feeAutoRefundTip}>
                    <Ionicons name="information-circle" size={14} color={colors.primary} />
                    <Text style={styles.feeAutoRefundText}>
                      Your ₹{heldAmount} is fully refundable if no referral is made within 2 weeks.
                    </Text>
                  </View>
                </View>
              );
            })()}

            <Text style={[styles.confirmMessage, { marginBottom: 16, marginTop: 4, fontSize: 11 }]}>
              This action cannot be undone.
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.keepBtn]}
                onPress={() => setCancelTarget(null)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color="#10B981"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.keepBtnText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.cancelReqBtn]}
                onPress={() => {
                  const requestId = cancelTarget?.requestId;
                  setCancelTarget(null);
                  if (requestId != null) performCancelRequest(requestId);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color="#dc2626"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.cancelReqBtnText}>Withdraw</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Verification Confirmation Modal */}
      <Modal
        visible={!!verifyTarget}
        transparent
        onRequestClose={() => setVerifyTarget(null)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setVerifyTarget(null)}>
          <Pressable style={styles.confirmBox} onPress={() => {}}>
            <View style={styles.confirmHeader}>
              <View style={[styles.confirmIconContainer, styles.verifyIconContainer]}>
                <Ionicons name="checkmark-done-circle" size={24} color={colors.primary} />
              </View>
              <Text style={styles.confirmTitle}>Verify Referral</Text>
            </View>

            <Text style={styles.confirmMessage}>
              Has the referrer successfully referred you for{' '}
              <Text style={styles.jobTitleInModal}>
                {verifyTarget?.request?.JobTitle || 'this job'}
              </Text>
              ?{'\n\n'}Please confirm whether you received a legitimate referral from this person.
            </Text>

            {/* Referral Proof Section — compact */}
            {(verifyTarget?.request?.ProofDescription || verifyTarget?.request?.ProofFileURL) && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10, marginBottom: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Referral Proof</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {verifyTarget?.request?.ProofDescription && (
                    <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 8, padding: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Ionicons name="chatbubble-outline" size={12} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '600', marginLeft: 4 }}>Message</Text>
                      </View>
                      <Text style={{ color: colors.text, fontSize: 12, fontStyle: 'italic', lineHeight: 16 }} numberOfLines={3}>
                        "{verifyTarget.request.ProofDescription}"
                      </Text>
                    </View>
                  )}
                  {verifyTarget?.request?.ProofFileURL && (
                    <TouchableOpacity
                      style={{ flex: verifyTarget?.request?.ProofDescription ? 0 : 1, backgroundColor: '#007AFF10', borderRadius: 8, padding: 8, alignItems: 'center', justifyContent: 'center', minWidth: 80 }}
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          window.open(verifyTarget.request.ProofFileURL, '_blank');
                        } else {
                          Linking.openURL(verifyTarget.request.ProofFileURL);
                        }
                      }}
                    >
                      <Ionicons name="document-attach" size={20} color="#007AFF" />
                      <Text style={{ color: '#007AFF', fontSize: 10, fontWeight: '600', marginTop: 4, textAlign: 'center' }}>View Proof</Text>
                      <Ionicons name="open-outline" size={12} color="#007AFF" style={{ marginTop: 2 }} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            <View style={styles.verifyInfoBox}>
              <Ionicons name="information-circle" size={18} color={colors.primaryLight} />
              <Text style={styles.verifyInfoText}>
                Your feedback helps us verify authentic referrers and improve the platform for everyone.
              </Text>
            </View>

            {/* Dispute Warning */}
            <View style={{
              backgroundColor: '#F59E0B' + '0D',
              borderColor: '#F59E0B' + '35',
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Ionicons name="warning" size={15} color="#F59E0B" />
                <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 12, marginLeft: 6 }}>Before clicking 'No'</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 12, lineHeight: 18 }}>
                This will raise a dispute. Our team will review the proof and respond within 2 working days. If found invalid, you'll get a full refund.
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, backgroundColor: colors.surface, borderRadius: 6, padding: 8 }}>
                <Text style={{ fontSize: 13, marginRight: 6 }}>💡</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 16, flex: 1 }}>
                  Some companies don't send confirmation emails. Check your <Text style={{ fontWeight: '700', color: colors.text }}>Spam</Text> or <Text style={{ fontWeight: '700', color: colors.text }}>Junk</Text> folder before disputing.
                </Text>
              </View>
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.noBtn]}
                onPress={() => {
                  const requestId = verifyTarget?.requestId;
                  setVerifyTarget(null);
                  if (requestId != null) performVerifyReferral(requestId, false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={colors.danger}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.noBtnText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.yesBtn]}
                onPress={() => {
                  const requestId = verifyTarget?.requestId;
                  setVerifyTarget(null);
                  if (requestId != null) performVerifyReferral(requestId, true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.white}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.yesBtnText}>Yes</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingHorizontal: 8,
    paddingTop: 12,
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
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  logoContainer: {
    marginRight: 12,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.gray100,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitials: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
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
    justifyContent: 'flex-end',
    marginTop: 6,
    gap: 8,
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
    borderColor: '#EF4444',
    gap: 4,
  },
  withdrawBtnText: {
    fontSize: typography.sizes.xs,
    color: '#EF4444',
    fontWeight: typography.weights.semibold,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#10B981',
    borderRadius: 6,
    gap: 4,
  },
  verifyBtnText: {
    fontSize: typography.sizes.xs,
    color: '#FFFFFF',
    fontWeight: typography.weights.semibold,
  },
  viewProofCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#8B5CF620',
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#8B5CF640',
  },
  viewProofCardBtnText: {
    fontSize: typography.sizes.xs,
    color: '#8B5CF6',
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
    backgroundColor: colors.primaryLight || '#F3E8FF',
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
    backgroundColor: colors.warningLight || '#FFFBEB',
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
    backgroundColor: (colors.primaryLight || '#EEF2FF') + '40',
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
    backgroundColor: (colors.primaryLight || '#EEF2FF') + '30',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: (colors.primary || '#6366F1') + '20',
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
    backgroundColor: colors.dangerLight || '#FEE2E2',
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
    color: '#6ee7b7',
  },
  referrerMessageText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary || '#a3e635',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  viewProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  viewProofBtnText: {
    color: '#007AFF',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  noBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  noBtnText: {
    color: '#f87171',
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
