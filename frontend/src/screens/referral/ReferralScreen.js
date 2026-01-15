import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import refopenAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { typography } from '../../styles/theme';
import useResponsive from '../../hooks/useResponsive';
import ViewReferralRequestModal from '../../components/ViewReferralRequestModal';
import { showToast } from '../../components/Toast';

export default function ReferralScreen({ navigation }) {
  const { user, userId, isVerifiedReferrer, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Two tabs: 'open' and 'closed'
  const [activeTab, setActiveTab] = useState('open');
  const [openRequests, setOpenRequests] = useState([]);
  const [closedRequests, setClosedRequests] = useState([]);
  const [stats, setStats] = useState({ pendingCount: 0 });

  // Proof upload modal state
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Current verified company (for Post Job button)
  const [currentVerifiedCompany, setCurrentVerifiedCompany] = useState(null);
  
  // Draft jobs count (for Publish Jobs button)
  const [draftJobsCount, setDraftJobsCount] = useState(0);

  // ✅ Handle non-verified referrers - show verification prompt only in Open tab
  // They can still see the Closed tab to view past referrals they received
  const isNotVerifiedReferrer = !authLoading && !isVerifiedReferrer;

  // Refresh data when screen is focused (always reloads from any page)
  useFocusEffect(
    useCallback(() => {
      // Load data for all users - verified referrers get open requests, all users can see closed
      loadData();
    }, [])
  );

  // Define which statuses belong to which tab
  const OPEN_STATUSES = ['Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed'];
  const CLOSED_STATUSES = ['ProofUploaded', 'Completed', 'Verified', 'Unverified'];

  // Load user's current verified company from work experiences
  const loadCurrentCompany = async () => {
    try {
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

  // Load draft jobs count using dashboard-stats API
  const loadDraftJobsCount = async () => {
    try {
      console.log('📊 Loading draft jobs count from dashboard-stats...');
      const result = await refopenAPI.apiCall('/users/dashboard-stats');
      console.log('📊 Dashboard stats result:', result);
      if (result.success && result.data) {
        const count = result.data.draftJobs || 0;
        console.log('✅ Draft jobs count:', count);
        setDraftJobsCount(count);
      } else {
        console.log('❌ Dashboard stats failed:', result?.error);
      }
    } catch (error) {
      console.error('Error loading draft jobs count:', error);
    }
  };

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    setLoadingRequests(true);
    try {
      // Load stats, requests, current company, and draft jobs in parallel
      await Promise.all([
        loadStats(),
        loadAllRequests(),
        loadCurrentCompany(),
        loadDraftJobsCount()
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
        const open = allRequests.filter(r => OPEN_STATUSES.includes(r.Status));
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
      } else {
        throw new Error(result.error || 'Failed to submit referral');
      }
    } catch (error) {
      console.error('❌ Proof submission failed:', error);
      showToast('Failed to submit referral. Please try again.', 'error');
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
        return colors.gray600;
      case 'NotifiedToReferrers':
        return '#10B981'; // Green - notified
      case 'Viewed':
        return '#3B82F6'; // Blue
      case 'Claimed':
        return '#F59E0B'; // Amber
      case 'ProofUploaded':
        return '#8B5CF6'; // Purple
      case 'Completed':
        return colors.success;
      case 'Verified':
        return '#ffd700';
      case 'Unverified':
        return '#ef4444'; // Red - not verified
      case 'Cancelled':
        return colors.danger;
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
      default:
        return 'help-outline';
    }
  };

  const renderRequestToMeCard = (request) => {
    // ? NEW: Determine if this is an external or internal referral
    const isExternalJob = !!request.ExtJobID;
    const isInternalJob = !!request.JobID && !request.ExtJobID;

    // Confirmed from backend `/referral/available` response (ReferralService.getAvailableRequests)
    const applicantUserId = request.ApplicantUserID ?? null;
    const applicantName = request.ApplicantName || 'Job Seeker';
    const applicantPhotoUrl = request.ApplicantProfilePictureURL ?? null;
    
    // For internal jobs, make the card clickable
    const CardWrapper = isInternalJob ? TouchableOpacity : View;
    const cardWrapperProps = isInternalJob 
      ? { 
          onPress: () => {
            // Pass fromReferralRequest parameter to hide action buttons
            navigation.navigate('JobDetails', { 
              jobId: request.JobID,
              fromReferralRequest: true // Hide Apply/Ask Referral buttons
            });
          },
          activeOpacity: 0.7
        }
      : {};
    
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
      const avatarColors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1'];
      if (!name) return avatarColors[0];
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      return avatarColors[Math.abs(hash) % avatarColors.length];
    };

    const initials = getInitials(applicantName);
    const avatarColor = getAvatarColor(applicantName);
    
    return (
      <CardWrapper key={request.RequestID} style={styles.requestCard} {...cardWrapperProps}>
        <View style={styles.requestHeader}>
          {/* Person Avatar - Clickable to open profile */}
          <TouchableOpacity 
            style={styles.avatarContainer}
            activeOpacity={applicantUserId ? 0.7 : 1}
            disabled={!applicantUserId}
            onPress={() =>
              applicantUserId
                ? navigation.navigate('ViewProfile', {
                    userId: applicantUserId,
                    userName: applicantName,
                  })
                : undefined
            }
          >
            {applicantPhotoUrl ? (
              <Image
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
            {/* Person Name - Primary */}
            <TouchableOpacity
              activeOpacity={applicantUserId ? 0.7 : 1}
              disabled={!applicantUserId}
              onPress={() =>
                applicantUserId
                  ? navigation.navigate('ViewProfile', {
                      userId: applicantUserId,
                      userName: applicantName,
                    })
                  : undefined
              }
            >
              <Text style={styles.applicantNamePrimary} numberOfLines={1}>
                {applicantName}
              </Text>
            </TouchableOpacity>
            
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
                {formatDate(request.RequestedAt)}
              </Text>
            </View>

            {/* Quick Actions Row - Resume left, View/Continue right */}
            <View style={styles.quickActionsRow}>
              {/* Resume Button */}
              <TouchableOpacity
                style={[styles.quickActionBtn, { backgroundColor: colors.primary + '15' }]}
                onPress={() => {
                  const resumeUrl = request.ResumeURL;
                  if (resumeUrl) {
                    if (Platform.OS === 'web') {
                      window.open(resumeUrl, '_blank');
                    } else {
                      Linking.openURL(resumeUrl).catch(() => {
                        showToast('Could not open resume', 'error');
                      });
                    }
                  } else {
                    showToast('Resume not available', 'error');
                  }
                }}
              >
                <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                <Text style={[styles.quickActionText, { color: colors.primary }]}>Resume</Text>
              </TouchableOpacity>

              {/* Spacer */}
              <View style={{ flex: 1 }} />

              {/* View/Continue Button - Open tab */}
              {activeTab === 'open' && (
                <>
                  {(request.AssignedReferrerUserID || request.AssignedReferrerID) && 
                   ((request.AssignedReferrerUserID || '').toLowerCase() === (userId || '').toLowerCase() || 
                    (request.AssignedReferrerID || '').toLowerCase() === (userId || '').toLowerCase()) ? (
                    <TouchableOpacity 
                      style={[styles.viewRequestBtn, { backgroundColor: colors.success }]}
                      onPress={() => handleViewRequest(request)}
                    >
                      <Text style={[styles.viewRequestText, { marginLeft: 0 }]}>Next</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.viewRequestBtn}
                      onPress={() => handleViewRequest(request)}
                    >
                      <Text style={[styles.viewRequestText, { marginLeft: 0 }]}>View</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* View Proof Button - Closed tab */}
              {activeTab === 'closed' && request.ProofFileURL && (
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
                  <Ionicons name="eye" size={14} color="#fff" />
                  <Text style={styles.viewRequestText}>View Proof</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Verified Badge */}
          {request.Status === 'Verified' && (
            <View style={styles.verifiedBadgeCorner}>
              <Ionicons name="trophy" size={14} color="#F59E0B" />
            </View>
          )}
        </View>
      </CardWrapper>
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
      >
        {requestsToMe.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name={activeTab === 'open' ? "people-outline" : "checkmark-done-outline"} size={64} color={colors.gray400} />
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Referral Requests</Text>
          </View>
          <View style={styles.headerButtons}>
            {isVerifiedReferrer && currentVerifiedCompany && (
              <TouchableOpacity 
                style={styles.postJobButton}
                onPress={() => navigation.navigate('PostReferralJob', {
                  organizationId: currentVerifiedCompany.organizationId
                })}
              >
                <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                <Text style={styles.postJobButtonText}>Post Job</Text>
              </TouchableOpacity>
            )}
            {isVerifiedReferrer && currentVerifiedCompany && (
              <TouchableOpacity 
                style={styles.publishJobButton}
                onPress={() => navigation.navigate('EmployerJobs')}
              >
                <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                <Text style={styles.postJobButtonText}>Publish Jobs{draftJobsCount > 0 ? ` (${draftJobsCount})` : ''}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Open/Closed Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'open' && styles.activeTab]}
            onPress={() => setActiveTab('open')}
          >
            <Ionicons 
              name="folder-open-outline" 
              size={18} 
              color={activeTab === 'open' ? colors.primary : colors.gray500} 
            />
            <Text style={[styles.tabText, activeTab === 'open' && styles.activeTabText]}>
              Open ({openRequests.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'closed' && styles.activeTab]}
            onPress={() => setActiveTab('closed')}
          >
            <Ionicons 
              name="checkmark-done-outline" 
              size={18} 
              color={activeTab === 'closed' ? colors.primary : colors.gray500} 
            />
            <Text style={[styles.tabText, activeTab === 'closed' && styles.activeTabText]}>
              Closed ({closedRequests.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {renderTabContent()}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  publishJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  postJobButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  // Open/Closed Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.gray500,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
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
    padding: 12,
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
  avatarContainer: {
    marginRight: 12,
  },
  personAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.gray100,
  },
  personAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
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
    marginRight: 8,
  },
  applicantNamePrimary: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  wantsReferralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 4,
  },
  wantsReferralText: {
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
    fontSize: typography.sizes.xs,
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