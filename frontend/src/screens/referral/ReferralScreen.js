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
  Modal,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import nexhireAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography } from '../../styles/theme';
import ReferralProofModal from '../../components/ReferralProofModal';
import { showToast } from '../../components/Toast';

export default function ReferralScreen({ navigation }) {
  const { user, isJobSeeker } = useAuth();
  const [activeTab, setActiveTab] = useState(0); // 0: My Requests, 1: Requests To Me
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [requestsToMe, setRequestsToMe] = useState([]);
  const [stats, setStats] = useState({ pendingCount: 0 });

  // Proof upload modal state
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // NEW: Proof viewer modal state
  const [showProofViewer, setShowProofViewer] = useState(false);
  const [viewingProof, setViewingProof] = useState(null);

  // NEW: Cancel confirmation modal state
  const [cancelTarget, setCancelTarget] = useState(null);

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
        loadMyRequests(),
        loadRequestsToMe(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMyRequests = async () => {
    try {
      const result = await nexhireAPI.getMyReferralRequests(1, 50);
      if (result.success) {
        setMyRequests(result.data?.requests || []);
      }
    } catch (error) {
      console.error('Error loading my requests:', error);
      setMyRequests([]);
    }
  };

  const loadRequestsToMe = async () => {
    try {
      const result = await nexhireAPI.getAvailableReferralRequests(1, 50);
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
      const result = await nexhireAPI.getReferrerStats();
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

  const handleCancelRequest = async (requestId) => {
    console.log('?? Cancel button clicked for request:', requestId);
    
    // Find the request object for better UX
    const request = myRequests.find(r => r.RequestID === requestId);
    
    if (Platform.OS === 'web') {
      // Use custom modal for web (RN Alert unreliable on web)
      setCancelTarget({ requestId, request });
      return;
    }
    
    Alert.alert(
      'Cancel Referral Request',
      `Are you sure you want to cancel your referral request for ${request?.JobTitle || 'this job'}? This action cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => performCancelRequest(requestId)
        }
      ]
    );
  };

  // Separate function to perform the actual cancellation
  const performCancelRequest = async (requestId) => {
    console.log('?? User confirmed cancellation for request:', requestId);
    try {
      console.log('?? Making API call to cancel request...');
      const res = await nexhireAPI.cancelReferralRequest(requestId);
      console.log('?? API response:', res);
      
      if (res.success) {
        console.log('? Cancel request successful');
        // Optimistic update
        setMyRequests(prev => prev.map(r => r.RequestID === requestId ? { ...r, Status: 'Cancelled' } : r));
        showToast('Referral request cancelled','success');
      } else {
        console.error('? Cancel request failed:', res.error);
        Alert.alert('Error', res.error || 'Failed to cancel');
      }
    } catch (e) {
      console.error('? Cancel request error:', e);
      Alert.alert('Error', e.message || 'Failed to cancel');
    }
  };

  // NEW: Enhanced claim request with immediate proof upload
  const handleClaimRequest = async (request) => {
    try {
      console.log('?? Claiming request with proof:', request.RequestID);
      
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
      console.log('?? Submitting proof with claim:', proofData);
      
      // Use the new enhanced API that combines claim + proof
      const result = await nexhireAPI.claimReferralRequestWithProof(
        selectedRequest.RequestID,
        proofData
      );
      
      if (result.success) {
        console.log('? Claim with proof successful');
        
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

  // NEW: View proof of referral
  const handleViewProof = (request) => {
    console.log('?? View Proof pressed for request:', request.RequestID, 'Status:', request.Status, 'ProofURL:', request.ProofFileURL);
    if (!request.ProofFileURL) {
      Alert.alert('No Proof', 'Referrer has not uploaded proof yet');
      return;
    }
    setViewingProof(request);
    setShowProofViewer(true);
  };

  const handleVerifyReferral = async (requestId) => {
    console.log('? Verify pressed for request:', requestId);
    try {
      const result = await nexhireAPI.verifyReferralCompletion(requestId, true);
      console.log('? Verify API result:', result);
      if (result.success) {
        showToast('Referral verified', 'success');
        // Optimistically update local state so button disappears without full reload
        setMyRequests(prev => prev.map(r => r.RequestID === requestId ? { ...r, Status: 'Verified', VerifiedByApplicant: 1 } : r));
        // Also refresh in background
        loadMyRequests();
      } else {
        Alert.alert('Error', result.error || 'Failed to verify referral');
      }
    } catch (e) {
      console.error('? Verify error:', e);
      Alert.alert('Error', e.message || 'Failed to verify referral');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return colors.gray500;
      case 'Claimed': return colors.primary;
      case 'Completed': return colors.success;
      case 'Verified': return '#ffd700'; // Gold
      case 'Cancelled': return colors.danger;
      default: return colors.gray500;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return 'time-outline';
      case 'Claimed': return 'checkmark-circle-outline';
      case 'Completed': return 'checkmark-circle';
      case 'Verified': return 'trophy';
      case 'Cancelled': return 'close-circle';
      default: return 'help-outline';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const renderMyRequestCard = (request) => (
    <View key={request.RequestID} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestInfo}>
          <Text style={styles.jobTitle} numberOfLines={1}>
            {request.JobTitle || 'Job Title'}
          </Text>
          <Text style={styles.companyName} numberOfLines={1}>
            {request.CompanyName || 'Company'}
          </Text>
          <Text style={styles.requestDate}>
            Requested on {formatDate(request.RequestedAt)}
          </Text>
          {request.ReferrerName && (
            <Text style={styles.referrerName}>
              Referred by {request.ReferrerName}
            </Text>
          )}
        </View>
        <View style={styles.statusBadge}>
          <Ionicons 
            name={getStatusIcon(request.Status)} 
            size={16} 
            color={getStatusColor(request.Status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(request.Status) }]}
            numberOfLines={1}
          >
            {request.Status}
          </Text>
        </View>
      </View>
      
      <View style={styles.requestActions}>
        {request.Status === 'Completed' && (
          <>
            <TouchableOpacity style={styles.viewProofBtn} onPress={() => handleViewProof(request)}>
              <Ionicons name="eye-outline" size={16} color={colors.primary} />
              <Text style={styles.viewProofText}>View Proof</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.verifyBtn} onPress={() => handleVerifyReferral(request.RequestID)}>
              <Ionicons name="checkmark-done" size={16} color={colors.white} />
              <Text style={styles.verifyText}>Verify</Text>
            </TouchableOpacity>
          </>
        )}
        {request.Status === 'Verified' && request.ProofFileURL && (
          <TouchableOpacity style={styles.viewProofBtn} onPress={() => handleViewProof(request)}>
            <Ionicons name="eye-outline" size={16} color={colors.primary} />
            <Text style={styles.viewProofText}>View Proof</Text>
          </TouchableOpacity>
        )}
        
        {request.Status === 'Pending' && (
          <TouchableOpacity 
            style={styles.cancelBtn}
            onPress={() => handleCancelRequest(request.RequestID)}
          >
            <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderRequestToMeCard = (request) => (
    <View key={request.RequestID} style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestInfo}>
          <Text style={styles.jobTitle} numberOfLines={1}>
            {request.JobTitle || 'Job Title'}
          </Text>
          <Text style={styles.companyName} numberOfLines={1}>
            {request.CompanyName || 'Company'}
          </Text>
          <Text style={styles.seekerInfo}>
            Requested by {request.ApplicantName || 'Job Seeker'}
          </Text>
          <Text style={styles.requestDate}>
            {formatDate(request.RequestedAt)}
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
    </View>
  );

  const renderTabContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading referral data...</Text>
        </View>
      );
    }

    if (activeTab === 0) {
      // My Requests Tab
      return (
        <ScrollView 
          style={styles.tabContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.tabDescription}>
            Referral requests you have asked for
          </Text>
          
          {myRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={64} color={colors.gray400} />
              <Text style={styles.emptyTitle}>No Referral Requests</Text>
              <Text style={styles.emptyText}>
                You haven't requested any referrals yet. Find jobs and click "Ask Referral" to get started.
              </Text>
            </View>
          ) : (
            myRequests.map(renderMyRequestCard)
          )}
        </ScrollView>
      );
    } else {
      // Requests To Me Tab
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
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Referrals</Text>
        <Text style={styles.headerSubtitle}>
          Connect job seekers with opportunities
        </Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 0 && styles.activeTabButton
          ]}
          onPress={() => setActiveTab(0)}
        >
          <Text style={[
            styles.tabButtonText,
            activeTab === 0 && styles.activeTabButtonText
          ]}>
            My Requests
          </Text>
          {myRequests.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{myRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 1 && styles.activeTabButton
          ]}
          onPress={() => setActiveTab(1)}
        >
          <Text style={[
            styles.tabButtonText,
            activeTab === 1 && styles.activeTabButtonText
          ]}>
            Requests To Me
          </Text>
          {stats.pendingCount > 0 && (
            <View style={[styles.tabBadge, styles.notificationBadge]}>
              <Text style={styles.tabBadgeText}>{stats.pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
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

      {/* Proof Viewer Modal */}
      {showProofViewer && viewingProof && (
        <Modal visible={showProofViewer} animationType="slide" onRequestClose={() => setShowProofViewer(false)}>
          <View style={{ flex:1, backgroundColor:'#000' }}>
            <TouchableOpacity style={{ position:'absolute', top:40, right:20, zIndex:10 }} onPress={() => setShowProofViewer(false)}>
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: viewingProof.ProofFileURL }} style={{ flex:1, resizeMode:'contain' }} />
            <View style={{ padding:16, backgroundColor:'rgba(0,0,0,0.6)' }}>
              <Text style={{ color:'#fff', fontWeight:'bold', marginBottom:8 }}>Proof Description</Text>
              <Text style={{ color:'#fff' }}>{viewingProof.ProofDescription || 'No description provided'}</Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Cancel Referral Confirmation Modal */}
      {cancelTarget && (
        <View style={styles.confirmOverlay} pointerEvents="auto">
          <View style={styles.confirmBox}>
            <View style={styles.confirmHeader}>
              <View style={styles.confirmIconContainer}>
                <Ionicons name="warning" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.confirmTitle}>Cancel Referral Request</Text>
            </View>
            
            <Text style={styles.confirmMessage}>
              Are you sure you want to cancel your referral request for{' '}
              <Text style={styles.jobTitleInModal}>{cancelTarget.request?.JobTitle || 'this job'}</Text>?
              {'\n\n'}This action cannot be undone and you'll need to create a new request if you change your mind.
            </Text>
            
            <View style={styles.confirmActions}>
              <TouchableOpacity 
                style={[styles.confirmBtn, styles.keepBtn]} 
                onPress={() => {
                  console.log('Keep request (web modal)');
                  setCancelTarget(null);
                }}
              >
                <Text style={styles.keepBtnText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmBtn, styles.cancelReqBtn]} 
                onPress={() => {
                  console.log('Confirm cancel (web modal)');
                  const requestId = cancelTarget.requestId;
                  setCancelTarget(null);
                  performCancelRequest(requestId);
                }}
              >
                <Ionicons name="close-circle" size={16} color="#dc2626" style={{ marginRight: 6 }} />
                <Text style={styles.cancelReqBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: typography.sizes.md,
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
    paddingVertical: 16,
    paddingHorizontal: 12,
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
    marginLeft: 8,
    minWidth: 20,
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
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  tabDescription: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
  },
  requestCard: {
    backgroundColor: colors.surface,
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
    marginRight: 12,
  },
  jobTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  companyName: {
    fontSize: typography.sizes.md,
    color: colors.gray700,
    marginBottom: 4,
  },
  seekerInfo: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    marginBottom: 4,
  },
  requestDate: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.gray100,
    borderRadius: 12,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginLeft: 4,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  viewProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primary + '20',
    borderRadius: 6,
  },
  viewProofText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: typography.weights.medium,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.danger + '20',
    borderRadius: 6,
  },
  cancelText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginLeft: 4,
    fontWeight: typography.weights.medium,
  },
  referBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.success,
    borderRadius: 6,
  },
  referText: {
    fontSize: typography.sizes.sm,
    color: colors.white,
    marginLeft: 4,
    fontWeight: typography.weights.bold,
  },
  dismissBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.gray200,
    borderRadius: 6,
  },
  dismissText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    fontWeight: typography.weights.medium,
  },
  proofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ff6600',
    borderRadius: 6,
  },
  proofText: {
    fontSize: typography.sizes.sm,
    color: colors.white,
    marginLeft: 4,
    fontWeight: typography.weights.bold,
  },
  referrerName: {
    fontSize: typography.sizes.sm,
    color: colors.success,
    fontWeight: typography.weights.medium,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.success,
    borderRadius: 6,
    marginLeft: 8,
  },
  verifyText: {
    fontSize: typography.sizes.sm,
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
});