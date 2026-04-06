import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Linking,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import refopenAPI from '../../services/api';
import messagingApi from '../../services/messagingApi';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { typography } from '../../styles/theme';
import useResponsive from '../../hooks/useResponsive';
import ViewReferralRequestModal from '../../components/ViewReferralRequestModal';
import { showToast } from '../../components/Toast';
import { invalidateCache, CACHE_KEYS } from '../../utils/homeCache';
import ProfileSlider from '../../components/ProfileSlider';
import CachedImage from '../../components/CachedImage';
import SubScreenHeader from '../../components/SubScreenHeader';

export default function ReferralScreen({ navigation }) {
  const { user, userId, isVerifiedReferrer, isAdmin, currentWork, loading: authLoading, refreshVerificationStatus } = useAuth();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messagingUserId, setMessagingUserId] = useState(null); // Track which user we're messaging
  
  // Two tabs: 'open' and 'closed'
  const [activeTab, setActiveTab] = useState('open');
  const [openRequests, setOpenRequests] = useState([]);
  const [closedRequests, setClosedRequests] = useState([]);
  const [stats, setStats] = useState({ pendingCount: 0 });
  const [showExpiredSection, setShowExpiredSection] = useState(false);

  // Swipe gesture to switch tabs
  const SWIPE_TABS = ['open', 'closed'];
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTabSwitch = (direction) => {
    slideAnim.setValue(direction * 40);
    Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  const switchTab = (newTab) => {
    const oldIdx = SWIPE_TABS.indexOf(activeTab);
    const newIdx = SWIPE_TABS.indexOf(newTab);
    if (oldIdx !== newIdx) {
      animateTabSwitch(newIdx > oldIdx ? 1 : -1);
      setActiveTab(newTab);
    }
  };

  const handleSwipeStart = (e) => {
    swipeStartX.current = e.nativeEvent.pageX;
    swipeStartY.current = e.nativeEvent.pageY;
  };
  const handleSwipeEnd = (e) => {
    const dx = e.nativeEvent.pageX - swipeStartX.current;
    const dy = e.nativeEvent.pageY - swipeStartY.current;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const idx = SWIPE_TABS.indexOf(activeTab);
      if (dx < 0 && idx < SWIPE_TABS.length - 1) switchTab(SWIPE_TABS[idx + 1]);
      if (dx > 0 && idx > 0) switchTab(SWIPE_TABS[idx - 1]);
    }
  };

  // Proof upload modal state
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Current verified company (for Post Job button)
  const [currentVerifiedCompany, setCurrentVerifiedCompany] = useState(null);
  
  // Job counts (for My Jobs button visibility)
  const [draftJobsCount, setDraftJobsCount] = useState(0);
  const [publishedJobsCount, setPublishedJobsCount] = useState(0);
  const hasPostedJobs = draftJobsCount > 0 || publishedJobsCount > 0;

  // Profile slider state (same as HomeScreen)
  const [profileSliderVisible, setProfileSliderVisible] = useState(false);
  const profilePhotoUrl = user?.ProfilePictureURL || user?.profilePictureURL || user?.picture || null;

  // Messages unread count
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Referrer menu dropdown
  const [showMenu, setShowMenu] = useState(false);

  // ✅ Handle non-verified referrers - show verification prompt only in Open tab
  // They can still see the Closed tab to view past referrals they received
  // Admin users bypass this check entirely
  const isNotVerifiedReferrer = !authLoading && !isVerifiedReferrer && !isAdmin;

  // Refresh data when screen is focused (always reloads from any page)
  useFocusEffect(
    useCallback(() => {
      // Refresh verification status to get fresh data
      refreshVerificationStatus();
      // Load data for all users - verified referrers get open requests, all users can see closed
      loadData();
      // Fetch unread message count
      (async () => {
        try {
          const result = await messagingApi.getUnreadCount();
          if (result.success && result.data) {
            setUnreadMessageCount(result.data.TotalUnread || 0);
          }
        } catch (err) {
          setUnreadMessageCount(0);
        }
      })();
    }, [])
  );

  // Define which statuses belong to which tab
  // Expired shows in Closed tab since the referrer can no longer act on it
  const OPEN_STATUSES = ['Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed'];
  const CLOSED_STATUSES = ['ProofUploaded', 'Completed', 'Verified', 'Unverified', 'Refunded', 'Expired'];

  // Load user's current verified company from work experiences
  // Use cached currentWork from AuthContext for instant display, then refresh in background
  const loadCurrentCompany = async () => {
    try {
      // Use cached data first for instant display
      if (currentWork && currentWork.CompanyEmailVerified) {
        setCurrentVerifiedCompany({
          workExperienceId: currentWork.WorkExperienceID,
          organizationId: currentWork.OrganizationID,
          companyName: currentWork.CompanyName || currentWork.OrganizationName,
          department: currentWork.Department,
          jobTitle: currentWork.JobTitle,
        });
      }
      
      // Fetch fresh data in background
      const result = await refopenAPI.getMyWorkExperiences();
      if (result.success && result.data) {
        // Find current work experience that is verified
        const currentVerified = result.data.find(
          exp => exp.IsCurrent && exp.CompanyEmailVerified
        );
        if (currentVerified) {
          setCurrentVerifiedCompany({
            workExperienceId: currentVerified.WorkExperienceID,
            organizationId: currentVerified.OrganizationID,
            companyName: currentVerified.CompanyName || currentVerified.OrganizationName,
            department: currentVerified.Department,
            jobTitle: currentVerified.JobTitle,
          });
        } else {
          setCurrentVerifiedCompany(null);
        }
      }
    } catch (error) {
      console.error('Error loading current company:', error);
    }
  };

  // Load job counts (draft + published) using dashboard-stats API
  const loadJobCounts = async () => {
    try {
      const result = await refopenAPI.apiCall('/users/dashboard-stats');
      if (result.success && result.data) {
        setDraftJobsCount(result.data.draftJobs || 0);
        setPublishedJobsCount(result.data.activeJobs || 0);
      }
    } catch (error) {
      console.error('Error loading job counts:', error);
    }
  };

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    setLoadingRequests(true);
    try {
      // Load stats, requests, current company, and job counts in parallel
      await Promise.all([
        loadStats(),
        loadAllRequests(),
        loadCurrentCompany(),
        loadJobCounts()
      ]);
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
      setLoadingRequests(false);
    }
  };

  // Load open requests (from available API - filtered by current company)
  // and closed requests (from completed API - all completed referrals regardless of company)
  const loadAllRequests = async () => {
    try {
      // Fetch open and closed from separate APIs
      const [openResult, closedResult] = await Promise.all([
        refopenAPI.getAvailableReferralRequests(1, 100),
        refopenAPI.getCompletedReferrals(1, 100)
      ]);
      
      // Open tab: Filter from available requests (current company only)
      if (openResult.success) {
        const allRequests = openResult.data?.requests || [];
        // Filter to only show open statuses
        // OpenToAnyCompany parents in Completed state should still show as open
        // (they remain claimable by other referrers even after first claim)
        const open = allRequests.filter(r => 
          OPEN_STATUSES.includes(r.Status) || 
          (r.OpenToAnyCompany && r.Status === 'Completed')
        );
        setOpenRequests(open);
      } else {
        setOpenRequests([]);
      }
      
      // Closed tab: Use dedicated completed API (all completed referrals regardless of company)
      if (closedResult.success) {
        const closedData = closedResult.data?.requests || [];
        setClosedRequests(closedData);
      } else {
        setClosedRequests([]);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
      setOpenRequests([]);
      setClosedRequests([]);
    }
  };

  const loadStats = async () => {
    try {
      const result = await refopenAPI.getReferrerStats();
      if (result.success) {
        setStats(result.data || { pendingCount: 0 });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // On refresh, load stats first then requests
    await loadStats();
    await loadAllRequests();
    setRefreshing(false);
  };

  // Get current list based on active tab
  const requestsToMe = activeTab === 'open' ? openRequests : closedRequests;

  // NEW: Open View Request modal (logs Viewed status inside modal)
  const handleViewRequest = (request) => {
    setSelectedRequest(request);
    setShowProofModal(true);
  };

  // NEW: Handle proof submission with claim (called from ViewReferralRequestModal)
  const handleProofSubmission = async (proofData) => {
    if (!selectedRequest) return;

    try {
      // Use the new enhanced API that combines claim + proof
      const result = await refopenAPI.submitReferralWithProof(
        selectedRequest.RequestID,
        proofData
      );
      
      if (result.success) {
        // Close modal
        setShowProofModal(false);
        setSelectedRequest(null);
        
        // Refresh both lists (open and closed)
        await loadData();
        
        showToast('Referral submitted successfully! 🎉', 'success');
        invalidateCache(CACHE_KEYS.REFERRER_REQUESTS, CACHE_KEYS.WALLET_BALANCE);
      } else {
        throw new Error(result.error || 'Failed to submit referral');
      }
    } catch (error) {
      console.error('❌ Proof submission failed:', error);
      showToast('Failed to submit referral. Please try again.', 'error');
    }
  };

  // NEW: Handle messaging seeker (for reminding them to verify)
  const handleMessageSeeker = async (request) => {
    if (!request.ApplicantUserID) {
      showToast('Unable to message this user', 'error');
      return;
    }

    try {
      setMessagingUserId(request.ApplicantUserID);
      const result = await messagingApi.createConversation(request.ApplicantUserID);

      if (result.success) {
        navigation.navigate('Chat', {
          conversationId: result.data.ConversationID,
          otherUserName: request.ApplicantName || 'Job Seeker',
          otherUserId: request.ApplicantUserID,
          otherUserProfilePic: request.ApplicantProfilePictureURL,
        });
      } else {
        showToast('Failed to start conversation', 'error');
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      showToast('Failed to start conversation', 'error');
    } finally {
      setMessagingUserId(null);
    }
  };


  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    
    // Enhanced: Show both date and time up to hour (matching ApplicationsScreen)
    const date = new Date(dateString);
    const dateOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    const timeOptions = { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    };
    
    return `${date.toLocaleDateString('en-US', dateOptions)} at ${date.toLocaleTimeString('en-US', timeOptions)}`;
  };

  // Relative time for card display (matches MyReferralRequestsScreen)
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
        return colors.gray600;
      case 'NotifiedToReferrers':
        return colors.success; // Green - notified
      case 'Viewed':
        return colors.primary; // Blue
      case 'Claimed':
        return colors.warning; // Amber
      case 'ProofUploaded':
        return colors.accent; // Purple
      case 'Completed':
        return colors.success;
      case 'Verified':
        return colors.gold;
      case 'Unverified':
        return colors.error; // Red - not verified
      case 'Cancelled':
        return colors.danger;
      case 'Expired':
        return colors.gray400; // Gray - expired
      default:
        return colors.gray600;
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
        return 'hand-left-outline';
      case 'ProofUploaded':
        return 'document-attach-outline';
      case 'Completed':
        return 'checkmark-circle';
      case 'Verified':
        return 'trophy-outline';
      case 'Unverified':
        return 'alert-circle-outline';
      case 'Cancelled':
        return 'close-circle-outline';
      case 'Expired':
        return 'hourglass-outline';
      default:
        return 'help-outline';
    }
  };

  // Check if a referral request is expired 
  // ONLY check backend status - don't do client-side date check
  // This ensures "Expired" only shows when hold is actually released
  const isRequestExpired = (status) => {
    return status === 'Expired';
  };

  const renderRequestToMeCard = (request) => {
    // ? NEW: Determine if this is an external or internal referral
    const isExternalJob = !!request.ExtJobID;
    const isInternalJob = !!request.JobID && !request.ExtJobID;

    // Confirmed from backend `/referral/available` response (ReferralService.getAvailableRequests)
    const applicantUserId = request.ApplicantUserID ?? null;
    const applicantName = request.ApplicantName || 'Job Seeker';
    const applicantPhotoUrl = request.ApplicantProfilePictureURL ?? null;
    
    // Get initials for avatar
    const getInitials = (name) => {
      if (!name) return '?';
      const parts = name.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0][0].toUpperCase();
    };

    // Generate consistent color from name
    const getAvatarColor = (name) => {
      const avatarColors = [colors.accent, colors.primary, colors.success, colors.warning, colors.error, colors.pink, colors.indigo];
      if (!name) return avatarColors[0];
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      return avatarColors[Math.abs(hash) % avatarColors.length];
    };

    const initials = getInitials(applicantName);
    const avatarColor = getAvatarColor(applicantName);

    const isOpenTab = activeTab === 'open';
    const isInactive = ['Expired', 'Refunded'].includes(request.Status) || 
      (!isOpenTab && ['Completed', 'ProofUploaded'].includes(request.Status) && !request.ProofFileURL);
    
    return (
      <TouchableOpacity 
        key={request.RequestID} 
        style={[styles.requestCard, isInactive && { opacity: 0.5 }]}
        activeOpacity={isOpenTab ? 0.7 : 1}
        disabled={!isOpenTab}
        onPress={() => isOpenTab ? handleViewRequest(request) : undefined}
      >
        <View style={styles.requestHeader}>
          {/* Person Avatar - Clickable to open referral detail (same as card tap) */}
          <TouchableOpacity 
            style={styles.avatarContainer}
            activeOpacity={isOpenTab ? 0.7 : 1}
            disabled={!isOpenTab}
            onPress={() => isOpenTab ? handleViewRequest(request) : undefined}
          >
            {applicantPhotoUrl ? (
              <CachedImage
                source={{ uri: applicantPhotoUrl }}
                style={styles.personAvatar}
                onError={() => {}}
              />
            ) : (
              <View style={[styles.personAvatarPlaceholder, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.requestInfo}>
            {/* Person Name - Primary (not clickable) */}
            <Text style={styles.applicantNamePrimary} numberOfLines={1}>
              {applicantName}
            </Text>
            
            {/* "wants referral for Job Title" */}
            <View style={styles.wantsReferralRow}>
              <Text style={styles.wantsReferralText}>wants referral for </Text>
              <Text style={styles.jobTitleBold} numberOfLines={1}>
                {request.JobTitle || 'Job Title'}
              </Text>
            </View>

            {/* Company & Time Row */}
            <View style={styles.metaRow}>
              <Text style={styles.companyNameSmall} numberOfLines={1}>
                {request.CompanyName || 'Company'}
              </Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.timeAgo}>
                {activeTab === 'closed' && request.ReferredAt
                  ? getRelativeTime(request.ReferredAt)
                  : getRelativeTime(request.RequestedAt)}
              </Text>
            </View>

            {/* Quick Actions Row */}
            <View style={styles.quickActionsRow}>
              {/* Spacer */}
              <View style={{ flex: 1 }} />

              {/* Closed tab: View Proof + Remind Seeker (only when proof exists and seeker hasn't verified) */}
              {activeTab === 'closed' && ['ProofUploaded', 'Completed', 'Unverified'].includes(request.Status) && request.ProofFileURL && (
                <>
                  <TouchableOpacity 
                    style={[styles.viewRequestBtn, { backgroundColor: colors.success }]}
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        window.open(request.ProofFileURL, '_blank');
                      } else {
                        Linking.openURL(request.ProofFileURL);
                      }
                    }}
                  >
                    <Ionicons name="eye" size={14} color={colors.white} />
                    <Text style={styles.viewRequestText}>View Proof</Text>
                  </TouchableOpacity>
                  {request.ApplicantUserID && (
                    <TouchableOpacity 
                      style={[styles.viewRequestBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleMessageSeeker(request)}
                      disabled={messagingUserId === request.ApplicantUserID}
                    >
                      {messagingUserId === request.ApplicantUserID ? (
                        <ActivityIndicator size={12} color={colors.white} />
                      ) : (
                        <Ionicons name="chatbubble-outline" size={14} color={colors.white} />
                      )}
                      <Text style={styles.viewRequestText}>Remind Seeker</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>

          {/* Chevron — only on open tab (cards are clickable) */}
          {isOpenTab && (
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 4 }} />
          )}

          {/* Verified Badge */}
          {request.Status === 'Verified' && (
            <View style={styles.verifiedBadgeCorner}>
              <Ionicons name="trophy" size={14} color={colors.warning} />
            </View>
          )}

          {/* Unverified Badge */}
          {request.Status === 'Unverified' && (
            <View style={[styles.verifiedBadgeCorner, { backgroundColor: colors.errorBg, borderRadius: 8, padding: 4 }]}>
              <Ionicons name="alert-circle" size={14} color={colors.error} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTabContent = () => {
    if (loading || loadingRequests) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading referral requests...</Text>
        </View>
      );
    }

    const emptyMessage = activeTab === 'open' 
      ? 'No open referral requests are available for your current companies.'
      : 'No completed referrals yet.';
    
    const emptyTitle = activeTab === 'open' 
      ? 'No Open Requests'
      : 'No Completed Referrals';

    // For Open tab, show verification prompt if user is not verified
    if (activeTab === 'open' && isNotVerifiedReferrer) {
      return (
        <ScrollView 
          style={styles.tabContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onTouchStart={handleSwipeStart}
          onTouchEnd={handleSwipeEnd}
        >
          {renderVerificationPrompt()}
        </ScrollView>
      );
    }

    return (
      <ScrollView 
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
      >
        {requestsToMe.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name={activeTab === 'open' ? "people-outline" : "checkmark-done-outline"} size={64} color={colors.gray400} />
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        ) : activeTab === 'closed' ? (
          // Closed tab: split into active-closed (top) and expired/refunded (collapsed bottom)
          (() => {
            const activeClosed = requestsToMe.filter(r => !['Expired', 'Refunded'].includes(r.Status));
            const expiredItems = requestsToMe.filter(r => ['Expired', 'Refunded'].includes(r.Status));
            return (
              <>
                {activeClosed.map(renderRequestToMeCard)}
                {expiredItems.length > 0 && (
                  <>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 8, gap: 6 }}
                      onPress={() => setShowExpiredSection(!showExpiredSection)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={showExpiredSection ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                        {showExpiredSection ? 'Hide' : 'Show'} expired ({expiredItems.length})
                      </Text>
                    </TouchableOpacity>
                    {showExpiredSection && expiredItems.map(renderRequestToMeCard)}
                  </>
                )}
              </>
            );
          })()
        ) : (
          requestsToMe.map(renderRequestToMeCard)
        )}
      </ScrollView>
    );
  };

  // ✅ Show loading while auth is loading
  if (authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.emptyText, { marginTop: 16 }]}>Loading...</Text>
      </View>
    );
  }

  // Render verification prompt for Open tab when user is not verified
  const renderVerificationPrompt = () => (
    <View style={[styles.emptyState, { paddingVertical: 60 }]}>
      <Ionicons name="shield-checkmark-outline" size={64} color={colors.gray400} />
      <Text style={[styles.emptyTitle, { marginTop: 16 }]}>Verification Required</Text>
      <Text style={[styles.emptyText, { textAlign: 'center', paddingHorizontal: 32 }]}>
        To see and accept referral requests, you need to add your current work experience and get verified.
      </Text>
      <TouchableOpacity 
        style={[styles.claimButton, { marginTop: 24, paddingHorizontal: 32 }]}
        onPress={() => navigation.navigate('Profile')}
      >
        <Text style={styles.claimButtonText}>Go to Profile</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        <SubScreenHeader 
          title="Provide Referral" 
          fallbackTab="Home"
          rightContent={
            isVerifiedReferrer && currentVerifiedCompany ? (
              <TouchableOpacity 
                style={styles.menuIconBtn}
                onPress={() => setShowMenu(v => !v)}
                activeOpacity={0.7}
              >
                <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
              </TouchableOpacity>
            ) : null
          }
        />

        {/* Dropdown menu */}
        {showMenu && (
          <>
            <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)} />
            <View style={styles.menuDropdown}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('PostReferralJob', {
                    organizationId: currentVerifiedCompany.organizationId
                  });
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.primary }]}>Post Job</Text>
              </TouchableOpacity>
              {hasPostedJobs && (
                <TouchableOpacity 
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    navigation.navigate('EmployerJobs', {
                      initialTab: draftJobsCount > 0 ? 'draft' : 'published',
                      organizationId: currentVerifiedCompany.organizationId
                    });
                  }}
                >
                  <Ionicons name="briefcase-outline" size={20} color={colors.text} />
                  <Text style={styles.menuItemText}>
                    My Jobs{draftJobsCount > 0 ? ` (${draftJobsCount} draft)` : ''}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[styles.menuItem, { borderBottomWidth: 0 }]}
                onPress={() => {
                  setShowMenu(false);
                  navigation.navigate('Earnings');
                }}
              >
                <Ionicons name="cash-outline" size={20} color="#F59E0B" />
                <Text style={styles.menuItemText}>Earnings</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Open/Closed Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'open' && styles.activeTab]}
            onPress={() => switchTab('open')}
          >
            <Text style={[styles.tabText, activeTab === 'open' && styles.activeTabText]}>
              Open
            </Text>
            {activeTab === 'open' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'closed' && styles.activeTab]}
            onPress={() => switchTab('closed')}
          >
            <Text style={[styles.tabText, activeTab === 'closed' && styles.activeTabText]}>
              Closed
            </Text>
            {activeTab === 'closed' && <View style={[styles.tabIndicator, { backgroundColor: colors.textSecondary }]} />}
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
          {renderTabContent()}
        </Animated.View>

        {/* View Referral Request Modal with enhanced flow */}
        <ViewReferralRequestModal
          visible={showProofModal}
          onClose={() => {
            setShowProofModal(false);
            setSelectedRequest(null);
          }}
          onSubmit={handleProofSubmission}
          referralRequest={selectedRequest}
          jobTitle={selectedRequest?.JobTitle}
          currentUserId={userId}  // Pass current user's UserID to check if they claimed
        />
      </View>

      {/* LinkedIn-style Profile Slider */}
      <ProfileSlider
        visible={profileSliderVisible}
        onClose={() => setProfileSliderVisible(false)}
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
  headerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
    zIndex: 10000,
    elevation: 10,
    position: Platform.OS === 'web' ? 'sticky' : 'relative',
    top: 0,
  },
  headerProfilePic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  headerProfilePicPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  messagesButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  messagesBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  messagesBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  earningsHeaderBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(252, 211, 77, 0.12)',
  },
  menuIconBtn: {
    padding: 6,
    borderRadius: 20,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  menuDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 88 : 52,
    right: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 180,
    zIndex: 1000,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    }),
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuItemText: {
    color: colors.text,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  // Open/Closed Tabs
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  activeTab: {},
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.primary,
  },
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    position: 'relative',
  },
  activeTabButton: {
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
  },
  tabButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  activeTabButtonText: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  tabBadge: {
    backgroundColor: colors.gray300,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 18,
    alignItems: 'center',
  },
  notificationBadge: {
    backgroundColor: colors.error,
  },
  tabBadgeText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 10,
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  tabDescription: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  claimButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  claimButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  requestCard: {
    backgroundColor: colors.surface,
    padding: 16,
    marginBottom: 10,
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {},
  personAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.gray100,
  },
  personAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  logoContainer: {
    marginRight: 10,
    marginTop: 0,
  },
  companyLogo: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.gray100,
  },
  logoPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestInfo: {
    flex: 1,
    gap: 2,
  },
  applicantNamePrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  wantsReferralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 4,
  },
  wantsReferralText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  jobTitleBold: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  companyNameSmall: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    flexShrink: 1,
  },
  metaDot: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  timeAgo: {
    fontSize: 12,
    color: colors.textMuted,
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 4,
  },
  quickActionText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  verifiedBadgeCorner: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  jobTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
    lineHeight: 18,
  },
  companyName: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 16,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  viewResumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginLeft: 8,
  },
  viewResumeBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    marginLeft: 3,
  },
  seekerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  viewRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  viewRequestText: {
    fontSize: typography.sizes.xs,
    color: colors.white,
    marginLeft: 4,
    fontWeight: typography.weights.bold,
  },
  
  // Cancel Confirmation Modal Styles
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.warning + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  jobTitleInModal: {
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  keepBtn: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  keepBtnText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: typography.weights.semibold,
  },
  cancelReqBtn: {
    backgroundColor: colors.error + '15',
    borderWidth: 1,
    borderColor: colors.error,
  },
  cancelReqBtnText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: typography.weights.bold,
  },
});