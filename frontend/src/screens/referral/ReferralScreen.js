import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import refopenAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography } from '../../styles/theme';
import ReferralProofModal from '../../components/ReferralProofModal';
import { showToast } from '../../components/Toast';

export default function ReferralScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestsToMe, setRequestsToMe] = useState([]);
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

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await Promise.all([
        loadRequestsToMe(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRequestsToMe = async () => {
    try {
      const result = await refopenAPI.getAvailableReferralRequests(1, 50);
      if (result.success) {
        setRequestsToMe(result.data?.requests || []);
      }
    } catch (error) {
      console.error('Error loading requests to me:', error);
      setRequestsToMe([]);
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
    await loadData();
    setRefreshing(false);
  };

  // NEW: Enhanced claim request with immediate proof upload
  const handleClaimRequest = async (request) => {
    try {
      
      // Open proof modal instead of immediate claim
      setSelectedRequest(request);
      setShowProofModal(true);
      
    } catch (error) {
      console.error('Error initiating claim:', error);
      Alert.alert('Error', error.message || 'Failed to initiate claim');
    }
  };

  // NEW: Handle proof submission with claim
  const handleProofSubmission = async (proofData) => {
    if (!selectedRequest) return;

    try {
      
      // Use the new enhanced API that combines claim + proof
      const result = await refopenAPI.claimReferralRequestWithProof(
        selectedRequest.RequestID,
        proofData
      );
      
      if (result.success) {
        
        // Update UI: move request from "Requests To Me" to "My Referrer Requests"
        setRequestsToMe(prev => prev.filter(r => r.RequestID !== selectedRequest.RequestID));
        
        // Close modal
        setShowProofModal(false);
        setSelectedRequest(null);
        
        // Refresh data
        await loadData();
        
        showToast('Referral claimed and proof submitted successfully!', 'success');
      } else {
        throw new Error(result.error || 'Failed to claim request');
      }
    } catch (error) {
      console.error('? Proof submission failed:', error);
      Alert.alert('Error', error.message || 'Failed to submit proof');
    }
  };

  // OLD: Simple proof submission for already claimed requests
  const handleSubmitProof = (request) => {
    setSelectedRequest(request);
    setShowProofModal(true);
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
      case 'Claimed':
        return colors.primary;
      case 'Completed':
        return colors.success;
      case 'Verified':
        return '#ffd700';
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
      case 'Claimed':
        return 'checkmark-circle-outline';
      case 'Completed':
        return 'checkmark-circle';
      case 'Verified':
        return 'trophy-outline';
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
                  <Ionicons name="arrow-forward-circle-outline" size={10} color="#3B82F6" />
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

            <TouchableOpacity
              style={styles.requesterRow}
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
              <Text
                style={styles.requesterName}
                numberOfLines={1}
              >
                {applicantName}
              </Text>
            </TouchableOpacity>

            <View style={styles.timestampRow}>
              <Ionicons name="time-outline" size={14} color={colors.gray500} />
              <Text style={styles.requestDate}>
                {formatDate(request.RequestedAt)}
              </Text>
            </View>
          </View>

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
              {request.Status || 'Pending'}
            </Text>
          </View>
        </View>
        
        <View style={styles.requestActions}>
          {request.Status === 'Pending' && (
            <>
              <TouchableOpacity 
                style={styles.referBtn}
                onPress={() => handleClaimRequest(request)}
              >
                <Ionicons name="people" size={16} color="#fff" />
                <Text style={styles.referText}>Refer Now</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.dismissBtn}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </>
          )}
          
          {request.Status === 'Claimed' && (
            <TouchableOpacity 
              style={styles.proofBtn}
              onPress={() => handleSubmitProof(request)}
            >
              <Ionicons name="camera" size={16} color="#fff" />
              <Text style={styles.proofText}>Submit Proof</Text>
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

    return (
      <ScrollView 
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.tabDescription}>
          Referral requests where you can help others and earn rewards
        </Text>
        
        {requestsToMe.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={colors.gray400} />
            <Text style={styles.emptyTitle}>No Referral Opportunities</Text>
            <Text style={styles.emptyText}>
              No referral requests are available for your current companies. 
              Make sure your work experience is up to date.
            </Text>
          </View>
        ) : (
          requestsToMe.map(renderRequestToMeCard)
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
    <View style={styles.headerLeft}>
 <Text style={styles.headerTitle}>Referral requests to me</Text>
   <Text style={styles.headerSubtitle}>
      Incoming referral requests
   </Text>
 </View>
      </View>

      {/* Tab Content */}
      {renderTabContent()}

      {/* NEW: Proof Upload Modal */}
      <ReferralProofModal
        visible={showProofModal}
        onClose={() => {
          setShowProofModal(false);
          setSelectedRequest(null);
        }}
        onSubmit={handleProofSubmission}
        referralRequest={selectedRequest}
        jobTitle={selectedRequest?.JobTitle}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.textPrimary,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
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
    paddingVertical: 12, // Reduced from 16
    paddingHorizontal: 8, // Reduced from 12
    position: 'relative',
  },
  activeTabButton: {
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
  },
  tabButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.gray600,
  },
  activeTabButtonText: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  tabBadge: {
    backgroundColor: colors.gray400,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6, // Reduced from 8
    minWidth: 18, // Reduced from 20
    alignItems: 'center',
  },
  notificationBadge: {
    backgroundColor: colors.danger,
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
    padding: 32, // Reduced from 40
  },
  loadingText: {
    marginTop: 10, // Reduced from 12
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  tabContent: {
    flex: 1,
    padding: 12, // Reduced from 16
  },
  tabDescription: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 12, // Reduced from 16
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48, // Reduced from 60
    paddingHorizontal: 32, // Reduced from 40
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 12, // Reduced from 16
    marginBottom: 6, // Reduced from 8
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 20, // Reduced from 22
  },
  requestCard: {
    backgroundColor: colors.surface,
    padding: 12, // Reduced from 16
    marginBottom: 10, // Reduced from 12
    borderRadius: 10, // Reduced from 12
    shadowColor: '#000',
    shadowOpacity: 0.04, // Reduced from 0.05
    shadowRadius: 6, // Reduced from 8
    shadowOffset: { width: 0, height: 1 }, // Reduced from height: 2
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10, // Reduced from 12
  },
  logoContainer: {
    marginRight: 10, // Reduced from 12
    marginTop: 0, // Reduced from 2
  },
  companyLogo: {
    width: 42, // Reduced from 48
    height: 42, // Reduced from 48
    borderRadius: 8, // Reduced from 10
    backgroundColor: colors.gray100,
  },
  logoPlaceholder: {
    width: 42, // Reduced from 48
    height: 42, // Reduced from 48
    borderRadius: 8, // Reduced from 10
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestInfo: {
    flex: 1,
    marginRight: 8, // Reduced from 12
  },
  jobTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 2, // Reduced from 4
    lineHeight: 18, // Added for better compactness
  },
  companyName: {
    fontSize: typography.sizes.sm, // Reduced from md
    color: colors.gray700,
    marginBottom: 4, // Reduced from 6
    lineHeight: 16, // Added for better compactness
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2, // Reduced from 4
  },
  seekerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2, // Reduced from 4
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
    color: colors.gray500,
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
    fontSize: typography.sizes.xs, // Reduced from sm
    color: colors.primary,
    marginLeft: 4,
    fontWeight: typography.weights.medium,
    lineHeight: 14, // Added for better compactness
  },
  requestDate: {
    fontSize: typography.sizes.xs, // Reduced from sm
    color: colors.gray500,
    marginLeft: 4,
    lineHeight: 14, // Added for better compactness
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6, // Reduced from 8
    paddingVertical: 3, // Reduced from 4
    backgroundColor: colors.gray100,
    borderRadius: 10, // Reduced from 12
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginLeft: 3, // Reduced from 4
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6, // Reduced from 8
  },
  viewProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, // Reduced from 12
    paddingVertical: 6, // Reduced from 8
    backgroundColor: colors.primary + '20',
    borderRadius: 6,
  },
  viewProofText: {
    fontSize: typography.sizes.xs, // Reduced from sm
    color: colors.primary,
    marginLeft: 4,
    fontWeight: typography.weights.medium,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, // Reduced from 12
    paddingVertical: 6, // Reduced from 8
    backgroundColor: colors.danger + '20',
    borderRadius: 6,
  },
  cancelText: {
    fontSize: typography.sizes.xs, // Reduced from sm
    color: colors.danger,
    marginLeft: 4,
    fontWeight: typography.weights.medium,
  },
  referBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12, // Reduced from 16
    paddingVertical: 6, // Reduced from 8
    backgroundColor: colors.success,
    borderRadius: 6,
  },
  referText: {
    fontSize: typography.sizes.xs, // Reduced from sm
    color: colors.white,
    marginLeft: 4,
    fontWeight: typography.weights.bold,
  },
  dismissBtn: {
    paddingHorizontal: 10, // Reduced from 12
    paddingVertical: 6, // Reduced from 8
    backgroundColor: colors.gray200,
    borderRadius: 6,
  },
  dismissText: {
    fontSize: typography.sizes.xs, // Reduced from sm
    color: colors.gray600,
    fontWeight: typography.weights.medium,
  },
  proofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12, // Reduced from 16
    paddingVertical: 6, // Reduced from 8
    backgroundColor: '#ff6600',
    borderRadius: 6,
  },
  proofText: {
    fontSize: typography.sizes.xs, // Reduced from sm
    color: colors.white,
    marginLeft: 4,
    fontWeight: typography.weights.bold,
  },
  referrerName: {
    fontSize: typography.sizes.xs, // Reduced from sm
    color: colors.success,
    fontWeight: typography.weights.medium,
    marginLeft: 4,
    lineHeight: 14, // Added for better compactness
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, // Reduced from 12
    paddingVertical: 6, // Reduced from 8
    backgroundColor: colors.success,
    borderRadius: 6,
    marginLeft: 6, // Reduced from 8
  },
  verifyText: {
    fontSize: typography.sizes.xs, // Reduced from sm
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
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
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
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 28,
  },
  jobTitleInModal: {
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
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
    color: colors.gray700,
    fontSize: 16,
    fontWeight: typography.weights.semibold,
  },
  cancelReqBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  cancelReqBtnText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: typography.weights.bold,
  },
  
  // ? NEW: Job Type Badge Styles
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
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  internalBadgeText: {
    fontSize: typography.sizes.xxs,
    color: '#3B82F6',
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.3,
  },
  
  // ? NEW: External Job ID Row
  externalJobIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: '#F9FAFB',
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
  
  // ? NEW: Tap Hint for Internal Jobs
  clickHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#EFF6FF',
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