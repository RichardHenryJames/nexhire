import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import refopenAPI from '../../services/api';
// import messagingApi from '../../services/messagingApi'; // commented out with message button
import { useAuth } from '../../contexts/AuthContext';
import useResponsive from '../../hooks/useResponsive';
import { useTheme } from '../../contexts/ThemeContext';
import { typography } from '../../styles/theme';
import { showToast } from '../../components/Toast';
import SubScreenHeader from '../../components/SubScreenHeader';
import WalletRechargeModal from '../../components/WalletRechargeModal';
import VerifyReferralModal from '../../components/modals/VerifyReferralModal';
import { usePricing } from '../../contexts/PricingContext';
import { getReferralCostForJob } from '../../utils/pricingUtils';

/**
 * ReferralTrackingScreen - Shows detailed tracking/history of a referral request
 * Beautiful timeline UI with status updates
 */
export default function ReferralTrackingScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const responsive = useResponsive();
  const isDesktopWeb = Platform.OS === 'web' && responsive.isDesktop;
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const { requestId, request: initialRequest } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [request, setRequest] = useState(initialRequest || null);
  const [history, setHistory] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(initialRequest?.Status || 'Pending');
  // const [messagingReferrer, setMessagingReferrer] = useState(false);
  // const [referrerConversation, setReferrerConversation] = useState(null); // Conversation with referrer if exists
  // const [referrerUserIds, setReferrerUserIds] = useState([]); // All referrers who interacted with this request
  const [messageExpanded, setMessageExpanded] = useState(false);
  const { pricing } = usePricing();
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [feeTableExpanded, setFeeTableExpanded] = useState(false);

  // Convert to Open state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertData, setConvertData] = useState({ minSalary: '', salaryCurrency: 'INR', salaryPeriod: 'Annual', preferredLocations: '' });
  const [converting, setConverting] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalData, setWalletModalData] = useState({ currentBalance: 0, requiredAmount: 0 });

  // Child referrals (for open-to-any)
  const [childReferrals, setChildReferrals] = useState([]);
  const [verifyChildTarget, setVerifyChildTarget] = useState(null); // { requestId, child }

  const canWithdraw = ['Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed'].includes(currentStatus);

  // --- Message referrer button commented out ---
  // const handleMessageReferrer = async () => {
  //   const hasUnread = referrerConversation?.TotalUnreadFromReferrers > 0 || referrerConversation?.UnreadCount > 0;
  //   if (hasUnread && referrerConversation) {
  //     navigation.navigate('Chat', {
  //       conversationId: referrerConversation.ConversationID,
  //       otherUserName: referrerConversation.OtherUserName || 'Referrer',
  //       otherUserId: referrerConversation.OtherUserID,
  //       referralContext: { requestId, jobTitle: request?.JobTitle, companyName: request?.CompanyName, isReferrer: false }
  //     });
  //   } else {
  //     navigation.navigate('Messages');
  //   }
  // };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      const res = await refopenAPI.cancelReferralRequest(requestId);
      if (res.success) {
        setCurrentStatus('Cancelled');
        setRequest(prev => prev ? { ...prev, Status: 'Cancelled' } : prev);
        showToast('Request withdrawn. Hold amount released to wallet.', 'success');
        setShowWithdrawConfirm(false);
        loadHistory(); // Refresh timeline
      } else {
        showToast('Failed to withdraw. Please try again.', 'error');
      }
    } catch (e) {
      showToast('Failed to withdraw. Please try again.', 'error');
    } finally {
      setWithdrawing(false);
      setShowWithdrawConfirm(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (requestId) {
        loadHistory();
      }
    }, [requestId])
  );

  // --- checkReferrerConversations commented out ---
  // const checkReferrerConversations = async (referrerIds) => { ... };

  const loadHistory = async () => {
    if (!requestId) return;

    setLoading(true);
    try {
      const result = await refopenAPI.getReferralStatusHistory(requestId);
      if (result.success && result.data) {
        setHistory(result.data.history || []);
        setCurrentStatus(result.data.currentStatus || request?.Status || 'Pending');
        setChildReferrals(result.data.childReferrals || []);
        
        // Update request data from API (fixes hard refresh issue)
        if (result.data.request) {
          setRequest(prev => ({
            ...prev,
            ...result.data.request,
          }));
        }
        
        // Get referrer IDs - use from history first, fallback to AssignedReferrerUserID
        let referrerIds = result.data.referrerUserIds || [];
        
        // Fallback: if no referrerIds but we have AssignedReferrerUserID, use that
        if (referrerIds.length === 0 && result.data.request?.AssignedReferrerUserID) {
          referrerIds = [result.data.request.AssignedReferrerUserID];
        }
        
        // setReferrerUserIds(referrerIds);
        
        // Check conversations with these referrers (commented out)
        // if (referrerIds.length > 0) {
        //   checkReferrerConversations(referrerIds);
        // }
      }
    } catch (error) {
      console.error('Error loading referral history:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    return `${date.toLocaleDateString('en-US', dateOptions)} at ${date.toLocaleTimeString('en-US', timeOptions)}`;
  };

  const getStatusConfig = (status) => {
    const configs = {
      'Pending': {
        color: colors.gray500,
        icon: 'time-outline',
        label: 'Request Created',
        description: 'Your referral request has been submitted',
      },
      'NotifiedToReferrers': {
        color: colors.primary,
        icon: 'notifications-outline',
        label: 'Visible to Referrers',
        description: 'Your request is now live and visible to referrers',
      },
      'Viewed': {
        color: colors.primary,
        icon: 'eye-outline',
        label: 'Viewed by Referrer',
        description: 'Referrers are reviewing your request',
      },
      'Claimed': {
        color: colors.warning,
        icon: 'hand-left-outline',
        label: 'Claimed by Referrer',
        description: 'A referrer is working on your referral',
      },
      'ProofUploaded': {
        color: colors.accent,
        icon: 'document-attach-outline',
        label: 'Proof Submitted',
        description: 'Referrer has submitted proof of referral',
      },
      'Completed': {
        color: colors.success,
        icon: 'checkmark-circle',
        label: 'Referral Completed',
        description: 'Your referral has been completed',
      },
      'Verified': {
        color: colors.gold,
        icon: 'trophy',
        label: 'Verified',
        description: 'You have verified the referral',
      },
      'Cancelled': {
        color: colors.danger,
        icon: 'close-circle',
        label: 'Cancelled',
        description: 'This referral request was cancelled',
      },
      'Unverified': {
        color: colors.warning,
        icon: 'alert-circle',
        label: 'Dispute Raised',
        description: 'Referral marked as unverified — under review',
      },
      'Expired': {
        color: colors.gray400,
        icon: 'time-outline',
        label: 'Expired',
        description: 'Request expired',
      },
      'Refunded': {
        color: colors.success,
        icon: 'arrow-undo-circle',
        label: 'Refunded',
        description: 'Amount has been refunded to your wallet',
      },
    };
    return configs[status] || configs['Pending'];
  };

  const handleOpenJobLink = () => {
    const jobUrl = request?.JobURL || request?.ExternalLogoURL;
    if (jobUrl) {
      Linking.openURL(jobUrl);
    }
  };

  const renderHeader = () => {
    if (!request) return null;

    const statusConfig = getStatusConfig(currentStatus);

    return (
      <View style={styles.headerCard}>
        {/* Job Info */}
        <View style={styles.jobSection}>
          <View style={styles.logoContainer}>
            {request.OpenToAnyCompany ? (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="globe-outline" size={28} color={colors.primary} />
              </View>
            ) : request.OrganizationLogo ? (
              <Image
                source={{ uri: request.OrganizationLogo }}
                style={styles.companyLogo}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="business-outline" size={28} color={colors.gray500} />
              </View>
            )}
          </View>
          <View style={styles.jobInfo}>
            <Text style={styles.jobTitle} numberOfLines={2}>
              {request.JobTitle || 'Job Title'}
            </Text>
            <Text style={styles.companyName}>
              {request.OpenToAnyCompany ? 'Any Company' : (request.CompanyName || 'Company')}
            </Text>
            {request.OpenToAnyCompany && request.MinSalary ? (
              <Text style={{ color: colors.success, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                {request.SalaryCurrency === 'USD' ? '$' : '₹'}{request.MinSalary?.toLocaleString()}{request.SalaryPeriod === 'Annual' ? '/yr' : '/mo'} min
              </Text>
            ) : null}
            {request.JobURL && (
              <TouchableOpacity 
                style={styles.linkButton}
                onPress={handleOpenJobLink}
              >
                <Ionicons name="open-outline" size={14} color={colors.primary} />
                <Text style={styles.linkText}>View Job</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Current Status Badge */}
        <View style={[styles.currentStatusBadge, { backgroundColor: statusConfig.color + '20' }]}>
          <Ionicons name={statusConfig.icon} size={20} color={statusConfig.color} />
          <View style={styles.statusInfo}>
            <Text style={[styles.currentStatusLabel, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
            <Text style={styles.currentStatusDesc}>
              {statusConfig.description}
            </Text>
          </View>
        </View>

        {/* Live View Count + Upgrade Nudge */}
        {['Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed'].includes(currentStatus) && history.some(h => h.status === 'Viewed') && (() => {
          // Use first view date (not request creation) as the inflation start point
          const viewedEvents = history.filter(h => h.status === 'Viewed');
          const realViewCount = viewedEvents.length;
          const firstViewAt = viewedEvents.length > 0
            ? new Date(viewedEvents[viewedEvents.length - 1].createdAt).getTime()
            : Date.now();
          const elapsed = Math.max(0, Date.now() - firstViewAt);
          const seed = requestId ? requestId.charCodeAt(0) + requestId.charCodeAt(requestId.length - 1) : 42;
          const fullDays = Math.floor(elapsed / (24 * 60 * 60 * 1000));

          // Same TOD curve as timeline
          const HOURLY_RATE = [.3,.2,.2,.1,.1,.2,.5,1.2,2.0,3.0,3.8,4.2,4.5,4.3,4.0,3.5,3.0,2.5,2.0,1.5,1.0,.7,.5,.4];
          const CUM = HOURLY_RATE.reduce((acc, v) => { acc.push((acc.length ? acc[acc.length - 1] : 0) + v); return acc; }, []);
          const DAY_TOTAL = CUM[CUM.length - 1];
          const hr = new Date().getHours();
          const mn = new Date().getMinutes();
          const todayFrac = ((hr > 0 ? CUM[hr - 1] : 0) + HOURLY_RATE[hr] * (mn / 60)) / DAY_TOTAL;

          const isOTA = request?.OpenToAnyCompany;
          const t = request?.OrganizationTier || 'Standard';
          let m = 0.25;
          if (isOTA) m = 1;
          else if (t === 'Elite') m = 0.29;
          else if (t === 'Premium') m = 0.33;
          const daily = (8 + (seed % 10)) * m;
          let views = Math.max(realViewCount, Math.round(realViewCount + (daily * fullDays + daily * todayFrac) * (0.6 + 0.4 * Math.sin(seed))));
          if (!isOTA) views = Math.min(views, 99);
          const viewText = views > 99 ? '99+' : String(views);

          return (
            <View style={{ marginTop: 4, marginBottom: 4 }}>
              {/* View count bar */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '08', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, gap: 8 }}>
                <Ionicons name="eye" size={18} color={colors.primary} />
                <Text style={{ flex: 1, fontSize: 13, color: colors.text }}>
                  <Text style={{ fontWeight: '700', color: colors.primary }}>{viewText}</Text> referrers have viewed your request
                </Text>
              </View>

              {/* Upgrade nudge — only for specific company with 10+ views */}
              {!isOTA && views >= 10 && (
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.success + '08', borderRadius: 10, padding: 12, marginTop: 6, gap: 8, borderWidth: 1, borderColor: colors.success + '20' }}
                  onPress={() => setShowConvertModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trending-up" size={18} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.success }}>🚀 Go Open — Get referred by multiple companies</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{Math.round(views / m)}+ referrers are waiting. Upgrade for just ₹{Math.max(0, (pricing.openToAnyReferralCost || 249) - getReferralCostForJob(request || {}, pricing))} more</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.success} />
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {/* Seeker Message - collapsible */}
        {request.ReferralMessage ? (
          <TouchableOpacity
            style={styles.seekerMessageRow}
            onPress={() => setMessageExpanded(prev => !prev)}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.gray400} style={{ marginRight: 6, marginTop: 1 }} />
            <Text
              style={styles.seekerMessageText}
              numberOfLines={messageExpanded ? undefined : 1}
            >
              {request.ReferralMessage}
            </Text>
            {request.ReferralMessage.length > 50 && (
              <Text style={styles.seekerMessageToggle}>
                {messageExpanded ? 'less' : 'more'}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}

        {/* Request Date */}
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.gray500} />
          <Text style={styles.dateText}>
            Requested on {formatDate(request.RequestedAt)}
          </Text>
        </View>

        {/* Expiry Countdown */}
        {['Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed'].includes(currentStatus) && (() => {
          const expiryDate = request?.ExpiryTime
            ? new Date(request.ExpiryTime)
            : new Date(new Date(request.RequestedAt).getTime() + 14 * 24 * 60 * 60 * 1000);
          const diffMs = expiryDate - new Date();
          if (diffMs <= 0) return null;
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const expiryColor = diffDays > 3 ? colors.success : diffDays >= 1 ? colors.warning : colors.error;
          const expiryText = diffDays >= 1 ? `${diffDays}d ${diffHours}h remaining` : `${diffHours}h remaining`;
          return (
            <View style={[styles.dateRow, { marginTop: 4 }]}>
              <Ionicons name="timer-outline" size={16} color={expiryColor} />
              <Text style={[styles.dateText, { color: expiryColor, fontWeight: '600' }]}>
                Expires: {expiryText}
              </Text>
            </View>
          );
        })()}

        {/* Message Referrer Button - commented out */}
      </View>
    );
  };

  const renderTimeline = () => {
    if (history.length === 0) {
      return (
        <View style={styles.emptyHistory}>
          <Ionicons name="time-outline" size={48} color={colors.gray400} />
          <Text style={styles.emptyHistoryText}>No activity yet</Text>
          <Text style={styles.emptyHistorySubtext}>
            Updates will appear here as your referral progresses
          </Text>
        </View>
      );
    }

    return (
      <View>
        {/* Referrals Received section - shows for both open-to-any children AND normal completed referrals */}
        {(() => {
          // Build referral entries: children for open-to-any, or parent itself for normal
          let referralEntries = childReferrals.length > 0 ? childReferrals : [];
          
          // For normal (non-open) requests that are Completed/ProofUploaded/Verified, show the parent as the entry
          if (referralEntries.length === 0 && !request?.OpenToAnyCompany && 
              ['Completed', 'ProofUploaded', 'Verified', 'Unverified'].includes(currentStatus)) {
            // Get proof from the history's ProofUploaded entry message, or from request data
            const proofEntry = history.find(h => h.status === 'ProofUploaded' || h.status === 'Completed');
            referralEntries = [{
              RequestID: request?.RequestID,
              Status: currentStatus,
              ReferredAt: request?.ReferredAt || request?.RequestedAt,
              CompanyName: request?.CompanyName,
              ReferrerName: request?.AssignedReferrerName,
              ProofFileURL: request?.ProofFileURL || null,
              ProofDescription: request?.ProofDescription || proofEntry?.statusMessage || null,
            }];
          }

          if (referralEntries.length === 0) return null;

          return (
            <View style={[styles.timelineContainer, { marginBottom: 0 }]}>
              <Text style={styles.sectionTitle}>Referrals Received ({referralEntries.length})</Text>
              {referralEntries.map((child, idx) => (
              <View key={child.RequestID} style={{
                paddingVertical: 12, borderBottomWidth: idx < childReferrals.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: child.Status === 'Verified' ? colors.success + '20' : child.Status === 'Completed' ? colors.primary + '20' : colors.gray200,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Ionicons
                      name={child.Status === 'Verified' ? 'checkmark-circle' : child.Status === 'Completed' ? 'time' : 'ellipse'}
                      size={18}
                      color={child.Status === 'Verified' ? colors.success : child.Status === 'Completed' ? colors.primary : colors.gray400}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                      {child.CompanyName || 'Unknown Company'}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {child.Status} • {child.ReferredAt ? formatDate(child.ReferredAt) : ''}
                    </Text>
                  </View>
                  <View style={{
                    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                    backgroundColor: child.Status === 'Verified' ? colors.success + '15' : colors.primary + '15',
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: child.Status === 'Verified' ? colors.success : colors.primary }}>
                      {child.Status}
                    </Text>
                  </View>
                </View>
                {/* Action buttons for child */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginLeft: 48 }}>
                  {child.ProofFileURL && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: colors.primary + '10', borderWidth: 1, borderColor: colors.primary + '30' }}
                      onPress={() => { if (Platform.OS === 'web') window.open(child.ProofFileURL, '_blank'); else Linking.openURL(child.ProofFileURL); }}
                    >
                      <Ionicons name="image-outline" size={14} color={colors.primary} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>View Proof</Text>
                    </TouchableOpacity>
                  )}
                  {child.Status === 'Completed' && (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: colors.success + '10', borderWidth: 1, borderColor: colors.success + '30' }}
                      onPress={() => setVerifyChildTarget({ requestId: child.RequestID, child })}
                    >
                      <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.success }}>Verify</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
          );
        })()}

      <View style={styles.timelineContainer}>
        <Text style={styles.sectionTitle}>Activity Timeline</Text>
        
        {(() => {
          // Collapse ALL "Viewed" entries into one with count, placed at last view's position
          // Only show inflated views for active requests (not cancelled/completed/verified/expired)
          const activeStatuses = ['Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed'];
          const isActive = activeStatuses.includes(currentStatus);

          let viewedCount = 0;
          let lastViewedItem = null;
          const nonViewItems = [];

          for (const item of history) {
            if (item.status === 'Viewed') {
              viewedCount++;
              lastViewedItem = item;
            } else {
              nonViewItems.push(item);
            }
          }

          // Build final list: insert collapsed view entry at the right chronological spot
          const collapsed = [...nonViewItems];
          if (lastViewedItem && viewedCount > 0) {
            let displayCount = viewedCount; // Default: real count

            // Only inflate for active requests
            if (isActive) {
              // Use first view date (not request creation) as inflation start
              const firstViewedItem = history.filter(h => h.status === 'Viewed').pop();
              const firstViewAt = firstViewedItem ? new Date(firstViewedItem.createdAt).getTime() : Date.now();
              const now = Date.now();
              const elapsed = Math.max(0, now - firstViewAt);

              // Deterministic seed from requestId — unique per request
              const seed = requestId ? requestId.charCodeAt(0) + requestId.charCodeAt(requestId.length - 1) : 42;

              // Time-of-day activity curve (same pattern as EngagementHub)
              // Low at night, peaks 11am-3pm, dips evening
              const TOD = [.08,.06,.05,.04,.04,.06,.12,.25,.45,.65,.82,.95,1.0,.98,.95,.88,.78,.65,.50,.38,.28,.20,.14,.10];
              // Cumulative hourly weights — sum = views accumulated so far today
              const HOURLY_RATE = [.3,.2,.2,.1,.1,.2,.5,1.2,2.0,3.0,3.8,4.2,4.5,4.3,4.0,3.5,3.0,2.5,2.0,1.5,1.0,.7,.5,.4];
              const CUM = HOURLY_RATE.reduce((acc, v) => { acc.push((acc.length ? acc[acc.length - 1] : 0) + v); return acc; }, []);
              const DAY_TOTAL = CUM[CUM.length - 1];

              // Calculate total accumulated views using cumulative curve per day
              const fullDays = Math.floor(elapsed / (24 * 60 * 60 * 1000));
              const currentHr = new Date().getHours();
              const currentMin = new Date().getMinutes();
              const todayCumFraction = ((currentHr > 0 ? CUM[currentHr - 1] : 0) + HOURLY_RATE[currentHr] * (currentMin / 60)) / DAY_TOTAL;

              // Tier-based view multiplier — Open gets most, Elite less, Standard least
              const isOpenToAny = request?.OpenToAnyCompany;
              const tier = request?.OrganizationTier || 'Standard';
              let multiplier = 0.25; // Standard: 1/4x
              if (isOpenToAny) multiplier = 1;        // Open to Any: 1x (base)
              else if (tier === 'Elite') multiplier = 0.29;   // Elite: ~1/3.5x
              else if (tier === 'Premium') multiplier = 0.33; // Premium: 1/3x

              const dailyTarget = (8 + (seed % 10)) * multiplier;
              // Full days contribute full daily target, current day contributes proportionally based on TOD curve
              const totalViews = dailyTarget * fullDays + dailyTarget * todayCumFraction;
              displayCount = Math.max(viewedCount, Math.round(viewedCount + totalViews * (0.6 + 0.4 * Math.sin(seed))));

              // Cap: specific always ≤99, open can go higher but caps at 99+
              if (!isOpenToAny) displayCount = Math.min(displayCount, 99);
            }

            // Cap display text: after 99, show 99+
            const displayText = displayCount > 99 ? '99+' : String(displayCount);

            // Milestone message
            let milestone = null;
            if (isActive && request?.OpenToAnyCompany) {
              // Only show milestones for open-to-any (numbers are higher)
              if (displayCount >= 99) milestone = '🔥 High demand — 99+ referrers have seen your request!';
              else if (displayCount >= 50) milestone = '📈 Gaining traction — 50+ referrers have viewed your request';
              else if (displayCount >= 25) milestone = '👀 Getting noticed — 25+ referrers have seen your request';
            } else if (isActive) {
              // Specific company milestones (lower thresholds)
              if (displayCount >= 50) milestone = '📈 Gaining traction — 50+ referrers have viewed your request';
              else if (displayCount >= 20) milestone = '👀 Getting noticed — 20+ referrers have seen your request';
            }

            // Find insert position
            const viewTime = new Date(lastViewedItem.createdAt).getTime();
            let insertIdx = 0;
            for (let i = 0; i < collapsed.length; i++) {
              if (new Date(collapsed[i].createdAt).getTime() <= viewTime) {
                insertIdx = i + 1;
              }
            }
            collapsed.splice(insertIdx, 0, {
              ...lastViewedItem,
              statusMessage: milestone || (displayCount > 1 ? `Viewed by ${displayText} referrers` : null),
              _viewCount: displayCount,
              _viewText: displayText,
            });
          }

          // For resolved requests, only show final outcome entries (not intermediate steps)
          const resolvedStatuses = ['Completed', 'Verified', 'Unverified', 'Cancelled', 'Expired', 'Refunded'];
          const finalEntryStatuses = ['Completed', 'Verified', 'Unverified', 'Cancelled', 'Expired', 'Refunded'];
          const finalList = resolvedStatuses.includes(currentStatus) 
            ? collapsed.filter(item => finalEntryStatuses.includes(item.status))
            : collapsed;

          return finalList;
        })().map((item, index, arr) => {
          const config = getStatusConfig(item.status);
          const isLast = index === arr.length - 1;
          const isFirst = index === 0;

          return (
            <View key={item.historyId || index} style={styles.timelineItem}>
              {/* Timeline Line */}
              <View style={styles.timelineLine}>
                <View 
                  style={[
                    styles.timelineDot, 
                    { backgroundColor: config.color },
                    isFirst && styles.timelineDotFirst
                  ]} 
                />
                {!isLast && (
                  <View style={[styles.timelineConnector, { backgroundColor: colors.border }]} />
                )}
              </View>

              {/* Content */}
              <View style={[styles.timelineContent, isLast && styles.timelineContentLast]}>
                <View style={styles.timelineHeader}>
                  <View style={[styles.statusIconBg, { backgroundColor: config.color + '20' }]}>
                    <Ionicons name={config.icon} size={16} color={config.color} />
                  </View>
                  <View style={styles.timelineTextContainer}>
                    <Text style={[styles.timelineStatus, { color: config.color }]}>
                      {config.label}{item._viewCount > 1 ? ` (${item._viewText || item._viewCount}×)` : ''}
                    </Text>
                    <Text style={styles.timelineDate}>
                      {item._viewCount > 1 ? 'Updated just now' : formatDate(item.createdAt)}
                    </Text>
                  </View>
                </View>

                {item.actorName && (
                  <View style={styles.actorRow}>
                    <Ionicons name="person-outline" size={14} color={colors.gray500} />
                    <Text style={styles.actorText}>
                      by {request?.OpenToAnyCompany ? 'a' : (request?.CompanyName || 'Company')} Referrer
                    </Text>
                  </View>
                )}

                {item.statusMessage && (
                  <Text style={styles.timelineMessage}>
                    "{item.statusMessage}"
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
      </View>
    );
  };

  if (loading && !request) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading tracking info...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubScreenHeader 
        title="Referral Tracking" 
        directBack="MyReferralRequests"
        rightContent={isDesktopWeb && canWithdraw ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.withdrawActionBtn, { paddingVertical: 6, paddingHorizontal: 12 }]}
              onPress={() => setShowWithdrawConfirm(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={15} color={colors.white} />
              <Text style={[styles.actionBtnText, { fontSize: 12 }]}>Withdraw</Text>
            </TouchableOpacity>
            {!request?.OpenToAnyCompany && (
              <TouchableOpacity
                style={[styles.convertOpenBtn, { paddingVertical: 6, paddingHorizontal: 12 }]}
                onPress={() => setShowConvertModal(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="globe-outline" size={15} color={colors.white} />
                <Text style={[styles.actionBtnText, { fontSize: 12 }]}>Convert to Open</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      />

      {/* Action buttons bar below header — mobile only */}
      {!isDesktopWeb && canWithdraw && (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.withdrawActionBtn}
            onPress={() => setShowWithdrawConfirm(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.white} />
            <Text style={styles.actionBtnText}>Withdraw</Text>
          </TouchableOpacity>
          {!request?.OpenToAnyCompany && (
            <TouchableOpacity
              style={styles.convertOpenBtn}
              onPress={() => setShowConvertModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="globe-outline" size={18} color={colors.white} />
              <Text style={styles.actionBtnText}>Convert to Open</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.innerContainer}>
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {renderHeader()}
          {renderTimeline()}
          
          {/* Help Section */}
          <View style={styles.helpSection}>
            <Ionicons name="information-circle-outline" size={20} color={colors.gray500} />
            <Text style={styles.helpText}>
              Pull down to refresh and see the latest updates on your referral request.
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Withdraw Confirmation Modal — same as MyReferralRequestsScreen */}
      <Modal
        visible={showWithdrawConfirm}
        transparent
        onRequestClose={() => setShowWithdrawConfirm(false)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setShowWithdrawConfirm(false)}>
          <Pressable style={styles.confirmBox} onPress={() => {}}>
            <View style={styles.confirmHeader}>
              <View style={styles.confirmIconContainer}>
                <Ionicons name="warning" size={24} color={colors.warning} />
              </View>
              <Text style={styles.confirmTitle}>Withdraw Referral Request</Text>
            </View>

            <Text style={styles.confirmMessage}>
              Are you sure you want to withdraw your referral request for{' '}
              <Text style={styles.jobTitleInModal}>
                {request?.JobTitle || 'this job'}
              </Text>
              ?
            </Text>

            {(() => {
              const hoursElapsed = request?.RequestedAt
                ? (Date.now() - new Date(request.RequestedAt).getTime()) / (1000 * 60 * 60)
                : 999;
              const currentTier = hoursElapsed < 1 ? 0 : hoursElapsed <= 24 ? 1 : 2;
              const heldAmount = request?.OpenToAnyCompany ? pricing.openToAnyReferralCost : getReferralCostForJob(request || {}, pricing);
              const tiers = [
                { label: 'Within 1 hour', fee: '₹0 (Free)', color: colors.success },
                { label: '1 – 24 hours', fee: '₹10', color: colors.warning },
                { label: 'After 24 hours', fee: '₹20', color: colors.error },
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
                      Your ₹{heldAmount} is fully refundable if no referral is made before expiry ({request?.ExpiryTime ? new Date(request.ExpiryTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '14 days'}).
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
                onPress={() => setShowWithdrawConfirm(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginRight: 6 }} />
                <Text style={styles.keepBtnText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.cancelReqBtn]}
                onPress={() => {
                  setShowWithdrawConfirm(false);
                  handleWithdraw();
                }}
                disabled={withdrawing}
                activeOpacity={0.8}
              >
                {withdrawing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={16} color={colors.white} style={{ marginRight: 6 }} />
                    <Text style={styles.cancelReqBtnText}>Withdraw</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Convert to Open Modal */}
      <Modal
        visible={showConvertModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConvertModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="globe-outline" size={24} color={colors.primary} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginLeft: 10, flex: 1 }}>Go Open — Reach Every Company</Text>
              <TouchableOpacity onPress={() => setShowConvertModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 }}>
              Your request for "{request?.JobTitle}" will be sent to referrers at 500+ companies. Multiple referrers can refer you — you only pay once.
            </Text>

            {/* Pricing Breakdown */}
            {(() => {
              const currentHold = getReferralCostForJob(request || {}, pricing);
              const openCost = pricing.openToAnyReferralCost || 249;
              const delta = Math.max(0, openCost - currentHold);
              return (
                <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Current hold</Text>
                    <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>₹{currentHold}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Open to Any price</Text>
                    <Text style={{ fontSize: 13, color: colors.text, fontWeight: '600' }}>₹{openCost}</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 14, color: delta > 0 ? colors.warning : colors.success, fontWeight: '700' }}>
                      {delta > 0 ? 'Additional hold' : 'No extra hold'}
                    </Text>
                    <Text style={{ fontSize: 14, color: delta > 0 ? colors.warning : colors.success, fontWeight: '700' }}>
                      {delta > 0 ? `₹${delta}` : 'Free'}
                    </Text>
                  </View>
                </View>
              );
            })()}

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 6 }}>
              <Ionicons name="shield-checkmark" size={16} color={colors.success} />
              <Text style={{ fontSize: 13, color: colors.success, fontWeight: '600' }}>Full refund if no one refers you</Text>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Set a minimum salary</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, overflow: 'hidden', marginBottom: 12 }}>
              <TouchableOpacity
                style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.primary + '12', borderRightWidth: 1, borderRightColor: colors.border }}
                onPress={() => setConvertData(p => ({ ...p, salaryCurrency: p.salaryCurrency === 'INR' ? 'USD' : 'INR' }))}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.primary }}>
                  {convertData.salaryCurrency === 'INR' ? '₹' : '$'}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: colors.text }}
                value={convertData.minSalary}
                onChangeText={(t) => setConvertData(p => ({ ...p, minSalary: t.replace(/[^0-9]/g, '') }))}
                placeholder={convertData.salaryCurrency === 'INR' ? '15,00,000' : '120,000'}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                maxLength={10}
              />
              <TouchableOpacity
                style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.primary + '12', borderLeftWidth: 1, borderLeftColor: colors.border }}
                onPress={() => setConvertData(p => ({ ...p, salaryPeriod: p.salaryPeriod === 'Annual' ? 'Monthly' : 'Annual' }))}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
                  {convertData.salaryPeriod === 'Annual' ? '/yr' : '/mo'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Preferred work locations</Text>
            <TextInput
              style={{ borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14, backgroundColor: colors.background, color: colors.text, borderColor: colors.border, marginBottom: 20 }}
              value={convertData.preferredLocations}
              onChangeText={(t) => setConvertData(p => ({ ...p, preferredLocations: t }))}
              placeholder="e.g. Bangalore, Hyderabad"
              placeholderTextColor={colors.textMuted}
            />

            <TouchableOpacity
              style={{ backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center' }}
              onPress={async () => {
                setConverting(true);
                try {
                  const result = await refopenAPI.convertReferralToOpen(requestId, {
                    minSalary: convertData.minSalary ? parseFloat(convertData.minSalary) : undefined,
                    salaryCurrency: convertData.salaryCurrency,
                    salaryPeriod: convertData.salaryPeriod,
                    preferredLocations: convertData.preferredLocations || undefined,
                  });
                  if (result?.success) {
                    showToast(result.data?.message || result.message || 'Upgraded to Open!', 'success');
                    setShowConvertModal(false);
                    setConvertData({ minSalary: '', salaryCurrency: 'INR', salaryPeriod: 'Annual', preferredLocations: '' });
                    onRefresh();
                  } else {
                    const errMsg = result?.error || result?.data?.error || '';
                    if (errMsg.toLowerCase().includes('insufficient')) {
                      const currentHold = getReferralCostForJob(request || {}, pricing);
                      const openCost = pricing.openToAnyReferralCost || 249;
                      const delta = Math.max(0, openCost - currentHold);
                      setShowConvertModal(false);
                      setWalletModalData({ currentBalance: 0, requiredAmount: delta });
                      setShowWalletModal(true);
                    } else {
                      showToast(errMsg || 'Failed to convert', 'error');
                    }
                  }
                } catch (error) {
                  const errMsg = error?.message || error?.error || 'Failed to convert';
                  if (errMsg.toLowerCase().includes('insufficient')) {
                    const currentHold = getReferralCostForJob(request || {}, pricing);
                    const openCost = pricing.openToAnyReferralCost || 249;
                    const delta = Math.max(0, openCost - currentHold);
                    setShowConvertModal(false);
                    setWalletModalData({ currentBalance: 0, requiredAmount: delta });
                    setShowWalletModal(true);
                  } else {
                    showToast(errMsg, 'error');
                  }
                } finally {
                  setConverting(false);
                }
              }}
              disabled={converting}
              activeOpacity={0.8}
            >
              {converting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={{ color: colors.white, fontSize: 15, fontWeight: '700' }}>
                  {(() => {
                    const h = getReferralCostForJob(request || {}, pricing);
                    const o = pricing.openToAnyReferralCost || 249;
                    const d = Math.max(0, o - h);
                    return d > 0 ? `Go Open for ₹${d}` : 'Go Open — Free Upgrade';
                  })()}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Wallet Recharge Modal - shown when insufficient balance for upgrade */}
      <WalletRechargeModal
        visible={showWalletModal}
        currentBalance={walletModalData.currentBalance}
        requiredAmount={walletModalData.requiredAmount}
        onAddMoney={() => {
          setShowWalletModal(false);
          navigation.navigate('WalletRecharge');
        }}
        onCancel={() => setShowWalletModal(false)}
      />

      {/* Verify Child Referral Confirmation Modal */}
      <VerifyReferralModal
        visible={!!verifyChildTarget}
        jobTitle={request?.JobTitle}
        companyName={verifyChildTarget?.child?.CompanyName}
        proofFileURL={verifyChildTarget?.child?.ProofFileURL}
        proofDescription={verifyChildTarget?.child?.ProofDescription}
        onClose={() => setVerifyChildTarget(null)}
        onVerify={async (verified) => {
          const rid = verifyChildTarget?.requestId;
          setVerifyChildTarget(null);
          try {
            const result = await refopenAPI.verifyReferralCompletion(rid, verified);
            if (verified) {
              if (result?.success) { showToast('Referral verified! 🎉', 'success'); onRefresh(); }
              else showToast(result?.error || 'Failed to verify', 'error');
            } else {
              showToast('Dispute raised. Our team will review.', 'info');
              onRefresh();
            }
          } catch (e) { showToast(e.message || 'Failed', 'error'); }
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Header Card
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  jobSection: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  logoContainer: {
    marginRight: 12,
  },
  companyLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  companyName: {
    fontSize: typography.sizes.md,
    color: colors.gray700,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  linkText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },

  // Current Status
  currentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  statusInfo: {
    flex: 1,
  },
  currentStatusLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  currentStatusDesc: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
  },
  seekerMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border || colors.gray100,
  },
  seekerMessageText: {
    flex: 1,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.gray400,
    lineHeight: 18,
  },
  seekerMessageToggle: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    marginLeft: 6,
    marginTop: 1,
  },

  // Timeline
  timelineContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
  },
  timelineLine: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  timelineDotFirst: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 2,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 24,
  },
  timelineContentLast: {
    paddingBottom: 0,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineTextContainer: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  timelineDate: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    marginTop: 2,
  },
  actorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  actorText: {
    fontSize: typography.sizes.xs,
    color: colors.gray600,
  },
  // Message referrer button at top of card
  messageReferrerBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  messageBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageReferrerTextTop: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
  unreadBadge: {
    backgroundColor: colors.error,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  unreadBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  timelineMessage: {
    fontSize: typography.sizes.sm,
    color: colors.gray700,
    fontStyle: 'italic',
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },

  // Empty State
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyHistoryText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptyHistorySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
  },

  // Help Section
  helpSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: colors.gray100,
    borderRadius: 12,
    marginBottom: 32,
    gap: 10,
  },
  helpText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    lineHeight: 20,
  },
  // Action buttons bar below header
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  withdrawActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  convertOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  // Withdraw confirmation modal — matches MyReferralRequestsScreen
  confirmOverlay: {
    ...Platform.select({
      web: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 },
      default: { flex: 1 },
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
  jobTitleInModal: {
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
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
    backgroundColor: colors.error,
  },
  cancelReqBtnText: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
});
