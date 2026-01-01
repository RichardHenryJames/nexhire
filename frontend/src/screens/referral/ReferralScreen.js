import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
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
  const { user, userId } = useAuth();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Two tabs: 'open' and 'closed'
  const [activeTab, setActiveTab] = useState('open');
  const [openRequests, setOpenRequests] = useState([]);
  const [closedRequests, setClosedRequests] = useState([]);
  const [stats, setStats] = useState({ pendingCount: 0 });

  // Proof upload modal state
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Define which statuses belong to which tab
  const OPEN_STATUSES = ['Pending', 'NotifiedToReferrers', 'Viewed', 'Claimed'];
  const CLOSED_STATUSES = ['ProofUploaded', 'Completed', 'Verified', 'Unverified'];

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Load stats first (quick) - show UI faster
      await loadStats();
      
      // Then lazy load the requests (heavier calls)
      loadAllRequests(); // Don't await - let it load in background
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
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
      
      console.log('=== REFERRAL REQUESTS ===');
      
      // Open tab: Filter from available requests (current company only)
      if (openResult.success) {
        const allRequests = openResult.data?.requests || [];
        // Filter to only show open statuses
        const open = allRequests.filter(r => OPEN_STATUSES.includes(r.Status));
        console.log('Open requests:', open.length);
        setOpenRequests(open);
      } else {
        setOpenRequests([]);
      }
      
      // Closed tab: Use dedicated completed API (all completed referrals regardless of company)
      if (closedResult.success) {
        const closedData = closedResult.data?.requests || [];
        console.log('Closed requests from completed API:', closedData.length);
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
      Alert.alert('Error', error.message || 'Failed to submit referral');
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
    
    return (
      <CardWrapper key={request.RequestID} style={styles.requestCard} {...cardWrapperProps}>
        <View style={styles.requestHeader}>
          {/* Company Logo */}
          <View style={styles.logoContainer}>
            {request.OrganizationLogo ? (
              <Image
                source={{ uri: request.OrganizationLogo }}
                style={styles.companyLogo}
                onError={() => {}}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="business-outline" size={24} color={colors.gray500} />
              </View>
            )}
          </View>

          <View style={styles.requestInfo}>
            {/* ? NEW: Job Type Badge */}
            <View style={styles.jobTypeBadgeContainer}>
              <Text style={styles.jobTitle} numberOfLines={1}>
                {request.JobTitle || 'Job Title'}
              </Text>
              {isExternalJob && (
                <View style={styles.externalBadge}>
                  <Ionicons name="open-outline" size={10} color="#8B5CF6" />
                  <Text style={styles.externalBadgeText}>External</Text>
                </View>
              )}
              {isInternalJob && (
                <View style={styles.internalBadge}>
                  <Ionicons name="checkmark-circle-outline" size={10} color="#10B981" />
                  <Text style={styles.internalBadgeText}>Internal</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.companyName} numberOfLines={1}>
              {request.CompanyName || 'Company'}
            </Text>
            
            {/* ? NEW: Show External Job ID for external referrals */}
            {isExternalJob && request.ExtJobID && (
              <View style={styles.externalJobIdRow}>
                <Ionicons name="link-outline" size={14} color="#8B5CF6" />
                <Text style={styles.externalJobIdText} numberOfLines={1}>
                  Job ID: {request.ExtJobID}
                </Text>
              </View>
            )}

            <View style={styles.requesterRow}>
              <Text style={styles.requesterPrefix}>Requested by</Text>
              {applicantPhotoUrl ? (
                <Image
                  source={{ uri: applicantPhotoUrl }}
                  style={styles.requesterAvatar}
                  onError={() => {}}
                />
              ) : (
                <View style={styles.requesterAvatarPlaceholder}>
                  <Ionicons name="person" size={14} color={colors.gray500} />
                </View>
              )}
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
                <Text
                  style={styles.requesterName}
                  numberOfLines={1}
                >
                  {applicantName}
                </Text>
              </TouchableOpacity>
              
              {/* Inline View Resume Button */}
              <TouchableOpacity
                style={[styles.viewResumeBtn, { backgroundColor: colors.primary + '15' }]}
                onPress={() => {
                  const resumeUrl = request.ResumeURL;
                  console.log('Resume clicked, ResumeURL:', resumeUrl, 'ResumeID:', request.ResumeID);
                  if (resumeUrl) {
                    if (Platform.OS === 'web') {
                      window.open(resumeUrl, '_blank');
                    } else {
                      Linking.openURL(resumeUrl).catch(() => {
                        Alert.alert('Error', 'Could not open resume');
                      });
                    }
                  } else {
                    showToast('Resume not available', 'error');
                  }
                }}
              >
                <Ionicons name="document-text-outline" size={12} color={colors.primary} />
                <Text style={[styles.viewResumeBtnText, { color: colors.primary }]}>Resume</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timestampRow}>
              <Ionicons name="time-outline" size={14} color={colors.gray500} />
              <Text style={styles.requestDate}>
                {formatDate(request.RequestedAt)}
              </Text>
            </View>
          </View>

          {/* Only show status badge when Verified */}
          {request.Status === 'Verified' && (
            <View style={[styles.statusBadge, { backgroundColor: colors.gray100 }]}
            >
              <Ionicons
                name={getStatusIcon(request.Status)}
                size={14}
                color={getStatusColor(request.Status)}
              />
              <Text
                style={[styles.statusText, { color: getStatusColor(request.Status) }]}
                numberOfLines={1}
              >
                {request.Status}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.requestActions}>
          {/* Show different buttons based on who claimed the request */}
          {activeTab === 'open' && (
            <>
              {/* Check if current user claimed this request - API returns AssignedReferrerUserID */}
              {(request.AssignedReferrerUserID || request.AssignedReferrerID) && 
               ((request.AssignedReferrerUserID || '').toLowerCase() === (userId || '').toLowerCase() || 
                (request.AssignedReferrerID || '').toLowerCase() === (userId || '').toLowerCase()) ? (
                // Current user claimed - show Continue button
                <TouchableOpacity 
                  style={[styles.viewRequestBtn, { backgroundColor: colors.success }]}
                  onPress={() => handleViewRequest(request)}
                >
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                  <Text style={styles.viewRequestText}>Continue</Text>
                </TouchableOpacity>
              ) : (
                // Not claimed by current user - show View Request button
                <TouchableOpacity 
                  style={styles.viewRequestBtn}
                  onPress={() => handleViewRequest(request)}
                >
                  <Ionicons name="eye" size={16} color="#fff" />
                  <Text style={styles.viewRequestText}>View Request</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          
          {/* Show View Proof for closed statuses */}
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
              <Ionicons name="eye" size={16} color="#fff" />
              <Text style={styles.viewRequestText}>View Proof</Text>
            </TouchableOpacity>
          )}
        </View>
      </CardWrapper>
    );
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading referral data...</Text>
        </View>
      );
    }

    const emptyMessage = activeTab === 'open' 
      ? 'No open referral requests are available for your current companies.'
      : 'No completed referrals yet.';
    
    const emptyTitle = activeTab === 'open' 
      ? 'No Open Requests'
      : 'No Completed Referrals';

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

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Referral Requests</Text>
            <Text style={styles.headerSubtitle}>
              Help others get referred and earn rewards
            </Text>
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
    marginBottom: 10,
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
  requesterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
    maxWidth: '100%',
  },
  requesterAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  requesterAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  requesterPrefix: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  requesterName: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    flexShrink: 1,
    textDecorationLine: 'underline',
  },
  referrerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  seekerInfo: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: typography.weights.medium,
    lineHeight: 14,
  },
  requestDate: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginLeft: 4,
    lineHeight: 14,
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
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  viewProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.primary + '20',
    borderRadius: 6,
  },
  viewProofText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: typography.weights.medium,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.error + '20',
    borderRadius: 6,
  },
  cancelText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    marginLeft: 4,
    fontWeight: typography.weights.medium,
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
  referBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.success,
    borderRadius: 6,
  },
  referText: {
    fontSize: typography.sizes.xs,
    color: colors.white,
    marginLeft: 4,
    fontWeight: typography.weights.bold,
  },
  dismissBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.gray100,
    borderRadius: 6,
  },
  dismissText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  proofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.warning,
    borderRadius: 6,
  },
  proofText: {
    fontSize: typography.sizes.xs,
    color: colors.white,
    marginLeft: 4,
    fontWeight: typography.weights.bold,
  },
  referrerName: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontWeight: typography.weights.medium,
    marginLeft: 4,
    lineHeight: 14,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.success,
    borderRadius: 6,
    marginLeft: 6,
  },
  verifyText: {
    fontSize: typography.sizes.xs,
    color: colors.white,
    marginLeft: 4,
    fontWeight: typography.weights.medium,
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
  
  // Job Type Badge Styles
  jobTypeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  externalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  externalBadgeText: {
    fontSize: typography.sizes.xxs,
    color: '#8B5CF6',
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.3,
  },
  internalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98120',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  internalBadgeText: {
    fontSize: typography.sizes.xxs,
    color: '#10B981',
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.3,
  },
  
  // External Job ID Row
  externalJobIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: colors.gray50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  externalJobIdText: {
    fontSize: typography.sizes.xs,
    color: '#8B5CF6',
    marginLeft: 4,
    fontWeight: typography.weights.medium,
    letterSpacing: 0.2,
  },
  
  // Tap Hint for Internal Jobs
  clickHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    marginBottom: 10,
  },
  clickHintText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: typography.weights.medium,
    fontStyle: 'italic',
  },
});