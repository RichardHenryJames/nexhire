import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import nexhireAPI from '../../services/api';
import ResumeUploadModal from '../../components/ResumeUploadModal';
import { showToast } from '../../components/Toast';
import { colors, typography } from '../../styles/theme';

export default function ApplicationsScreen({ navigation }) {
  const { isEmployer, isJobSeeker, user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // NEW: Referral state management
  const [referredJobIds, setReferredJobIds] = useState(new Set());
  const [referralEligibility, setReferralEligibility] = useState({
    isEligible: true,
    dailyQuotaRemaining: 5,
    hasActiveSubscription: false,
    reason: null
  });
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [pendingJobForApplication, setPendingJobForApplication] = useState(null);
  const [referralMode, setReferralMode] = useState(false);
  const [primaryResume, setPrimaryResume] = useState(null);
  // Web withdraw confirmation state
  const [withdrawTarget, setWithdrawTarget] = useState(null);

  useEffect(() => {
    console.log('?? ApplicationsScreen mounted - console.log is working!');
    fetchApplications();
    loadReferralData();
    loadPrimaryResume();
  }, [],);

  const fetchApplications = async (resetPage = false) => {
    try {
      const currentPage = resetPage ? 1 : pagination.page;
      setLoading(resetPage);

      console.log('?? FETCHING APPLICATIONS DEBUG - START');
      console.log('?? Current page:', currentPage);
      console.log('?? Page size:', pagination.pageSize);

      let result;
      if (isJobSeeker) {
        // Get job seeker's own applications
        result = await nexhireAPI.getMyApplications(currentPage, pagination.pageSize);
        console.log('?? API result:', JSON.stringify(result, null, 2));
      } else {
        // For employers, we'd need to get applications for their jobs
        // This would require a different API call or job-specific applications
        result = { success: true, data: [], meta: { total: 0, totalPages: 0 } };
      }

      if (result.success) {
        console.log('?? Applications data:', result.data);
        console.log('?? Status IDs found:', result.data?.map(app => ({ id: app.ApplicationID, status: app.StatusID, title: app.JobTitle })));
        
        const newApplications = resetPage ? result.data : [...applications, ...result.data];
        setApplications(newApplications);
        
        if (result.meta) {
          setPagination({
            page: result.meta.page || currentPage,
            pageSize: result.meta.pageSize || pagination.pageSize,
            total: result.meta.total || 0,
            totalPages: result.meta.totalPages || 0,
          });
        }
      } else {
        console.error('Failed to fetch applications:', result.error);
      }
      
      console.log('?? FETCHING APPLICATIONS DEBUG - END');
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load referral data
  const loadReferralData = async () => {
    if (!user || !isJobSeeker) return;
    try {
      const [referralRes, eligibilityRes] = await Promise.all([
        nexhireAPI.getMyReferralRequests(1, 500),
        nexhireAPI.checkReferralEligibility()
      ]);
      
      if (referralRes?.success && referralRes.data?.requests) {
        const ids = new Set(referralRes.data.requests.map(r => r.JobID));
        setReferredJobIds(ids);
      }
      
      if (eligibilityRes?.success) {
        setReferralEligibility(eligibilityRes.data);
      }
    } catch (e) {
      console.warn('Failed to load referral data:', e.message);
    }
  };

  // Load primary resume
  const loadPrimaryResume = async () => {
    if (!user || !isJobSeeker) return;
    try {
      const profile = await nexhireAPI.getApplicantProfile(user.userId || user.id || user.sub || user.UserID);
      if (profile?.success) {
        const resumes = profile.data?.resumes || [];
        const primary = resumes.find(r => r.IsPrimary) || resumes[0];
        if (primary) setPrimaryResume(primary);
      }
    } catch (e) {
      console.warn('Failed to load primary resume:', e.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReferralData(); // Refresh referral data too
    await fetchApplications(true);
  };

  const loadMoreApplications = () => {
    if (!loading && pagination.page < pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
      fetchApplications(false);
    }
  };

  const getStatusColor = (statusId) => {
    // Map status IDs to colors based on typical application statuses
    switch (statusId) {
      case 1: // Submitted/Pending
        return colors.warning;
      case 2: // Under Review
        return colors.primary;
      case 3: // Interview Scheduled
        return colors.info;
      case 4: // Offer Extended
        return colors.success;
      case 5: // Hired
        return colors.success;
      case 6: // Rejected
        return colors.danger;
      default:
        return colors.gray500;
    }
  };

  const getStatusText = (statusId) => {
    switch (statusId) {
      case 1:
        return 'Submitted';
      case 2:
        return 'Under Review';
      case 3:
        return 'Interview';
      case 4:
        return 'Offer Extended';
      case 5:
        return 'Hired';
      case 6:
        return 'Rejected';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date not available';
    return new Date(dateString).toLocaleDateString();
  };

  const formatSalary = (amount, currencyCode = 'USD') => {
    if (!amount) return 'Not specified';
    return `$${amount.toLocaleString()} ${currencyCode}`;
  };

  // NEW: Ask Referral handler (similar to JobsScreen)
  const handleAskReferral = async (job) => {
    if (!job) return;
    if (!user) {
      Alert.alert('Login Required', 'Please login to ask for referrals', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Auth') }
      ]);
      return;
    }
    if (!isJobSeeker) {
      Alert.alert('Access Denied', 'Only job seekers can ask for referrals');
      return;
    }

    const jobId = job.JobID || job.id;

    // Check if already referred
    if (referredJobIds.has(jobId)) {
      Alert.alert('Already Requested', 'You have already requested a referral for this job', [
        { text: 'View Referrals', onPress: () => navigation.navigate('Referrals') },
        { text: 'OK' }
      ]);
      return;
    }

    // Check eligibility
    try {
      const freshEligibility = await nexhireAPI.checkReferralEligibility();
      if (freshEligibility?.success) {
        const eligibilityData = freshEligibility.data;
        if (!eligibilityData.isEligible) {
          if (eligibilityData.dailyQuotaRemaining === 0) {
            showSubscriptionModal(eligibilityData.reason, eligibilityData.hasActiveSubscription);
            return;
          }
          Alert.alert('Referral Limit Reached', eligibilityData.reason || 'You have reached your daily referral limit');
          return;
        }
        setReferralEligibility(eligibilityData);
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to check referral quota. Please try again.');
      return;
    }

    // If user has primary resume, create referral directly
    if (primaryResume?.ResumeID) {
      await quickReferral(job, primaryResume.ResumeID);
      return;
    }
    
    // Otherwise show resume modal
    setReferralMode(true);
    setPendingJobForApplication(job);
    setShowResumeModal(true);
  };

  // Quick referral with primary resume
  const quickReferral = async (job, resumeId) => {
    const id = job.JobID || job.id;
    try {
      const res = await nexhireAPI.createReferralRequest(id, resumeId);
      if (res?.success) {
        setReferredJobIds(prev => new Set([...prev, id]));
        setReferralEligibility(prev => ({ ...prev, dailyQuotaRemaining: Math.max(0, prev.dailyQuotaRemaining - 1) }));
        showToast('Referral request sent', 'success');
      } else {
        Alert.alert('Request Failed', res.error || res.message || 'Failed to send referral request');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to send referral request');
    }
  };

  // Subscription modal handler
  const showSubscriptionModal = (reasonOverride = null, hasActiveSubscription = false) => {
    const exhaustedMsg = reasonOverride || `You've used all referral requests allowed in your current plan today.`;
    const body = hasActiveSubscription
      ? `${exhaustedMsg}\n\nUpgrade your plan to increase daily referral limit and continue boosting your job search.`
      : `You've used all 5 free referral requests for today!\n\nUpgrade to continue making referral requests and boost your job search.`;

    if (Platform.OS === 'web') {
      navigation.navigate('ReferralPlans');
      return;
    }
    
    Alert.alert(
      '?? Upgrade Required',
      body,
      [
        { text: 'Maybe Later', style: 'cancel' },
        { 
          text: 'View Plans', 
          onPress: () => {
            try {
              navigation.navigate('ReferralPlans');
            } catch (navError) {
              Alert.alert('Navigation Error', 'Unable to open plans. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Resume selected handler
  const handleResumeSelected = async (resumeData) => {
    if (!pendingJobForApplication) return;
    const job = pendingJobForApplication;
    const id = job.JobID || job.id;
    
    try {
      setShowResumeModal(false);
      if (referralMode) {
        const res = await nexhireAPI.createReferralRequest(id, resumeData.ResumeID);
        if (res?.success) {
          setReferredJobIds(prev => new Set([...prev, id]));
          setReferralEligibility(prev => ({
            ...prev,
            dailyQuotaRemaining: Math.max(0, prev.dailyQuotaRemaining - 1),
            isEligible: prev.dailyQuotaRemaining > 1
          }));
          showToast('Referral request sent successfully', 'success');
        } else {
          Alert.alert('Request Failed', res.error || res.message || 'Failed to send referral request');
        }
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Operation failed');
    } finally {
      setPendingJobForApplication(null);
      setReferralMode(false);
    }
  };

  // NEW: Handle withdraw application
  const handleWithdrawApplication = (application) => {
    console.log('?? Withdraw pressed for application:', application?.ApplicationID, 'status:', application?.StatusID);
    console.log('?? FULL APPLICATION DATA:', JSON.stringify(application, null, 2));

    if (Platform.OS === 'web') {
      // Use custom modal (RN Alert unreliable on web for multi-button)
      setWithdrawTarget(application);
      return;
    }
    Alert.alert(
      'Withdraw Application',
      `Are you sure you want to withdraw your application for ${application.JobTitle || 'this job'}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => console.log('?? User cancelled withdrawal') },
        { text: 'Withdraw', style: 'destructive', onPress: () => { console.log('?? User confirmed withdrawal, calling withdrawApplication...'); withdrawApplication(application); } }
      ]
    );
  };

  // Withdraw application function
  const withdrawApplication = async (application) => {
    try {
      console.log('?? Withdrawing application ID:', application.ApplicationID);
      console.log('?? Application object:', JSON.stringify(application, null, 2));
      
      // Add a simple alert to confirm the function is being called
      console.log('?? About to call API...');
      const res = await nexhireAPI.withdrawApplication(application.ApplicationID);
      console.log('?? API call completed');
      console.log('? Withdraw API response:', res);
      
      if (res.success) {
        console.log('? Success response received, updating UI...');
        // Remove the application from the list
        setApplications(prevApplications => 
          prevApplications.filter(app => app.ApplicationID !== application.ApplicationID)
        );
        
        // Update pagination total
        setPagination(prev => ({
          ...prev,
          total: Math.max(prev.total - 1, 0)
        }));
        
        showToast('Application withdrawn successfully', 'success');
        console.log('? UI updated successfully');
      } else {
        console.log('? Error response:', res.error || res.message);
        Alert.alert('Withdrawal Failed', res.error || res.message || 'Failed to withdraw application');
      }
    } catch (error) {
      console.log('? Exception caught:', error);
      console.error('Withdraw application error:', error);
      Alert.alert('Error', error.message || 'Failed to withdraw application');
    }
  };

  const ApplicationCard = ({ application }) => (
    <TouchableOpacity 
      style={styles.applicationCard}
      onPress={() => {
        // Navigate to job details or application details
        if (application.JobID) {
          navigation.navigate('JobDetails', { jobId: application.JobID });
        }
      }}
    >
      <View style={styles.applicationHeader}>
        <Text style={styles.jobTitle} numberOfLines={2}>
          {application.JobTitle || `Job ID: ${application.JobID}`}
        </Text>
        <View style={[
          styles.statusBadge, 
          { backgroundColor: getStatusColor(application.StatusID) + '20' }
        ]}>
          <Text style={[
            styles.statusText, 
            { color: getStatusColor(application.StatusID) }
          ]}>
            {getStatusText(application.StatusID)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.companyName}>
        {application.CompanyName || 'Company Name'}
      </Text>
      
      <View style={styles.applicationDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar" size={16} color={colors.gray500} />
          <Text style={styles.detailText}>
            Applied: {formatDate(application.SubmittedAt)}
          </Text>
        </View>
        
        {application.ExpectedSalary && (
          <View style={styles.detailItem}>
            <Ionicons name="cash" size={16} color={colors.gray500} />
            <Text style={styles.detailText}>
              Expected: {formatSalary(application.ExpectedSalary, application.CurrencyCode)}
            </Text>
          </View>
        )}

        {application.AvailableFromDate && (
          <View style={styles.detailItem}>
            <Ionicons name="time" size={16} color={colors.gray500} />
            <Text style={styles.detailText}>
              Available: {formatDate(application.AvailableFromDate)}
            </Text>
          </View>
        )}
      </View>

      {application.CoverLetter && (
        <Text style={styles.coverLetterPreview} numberOfLines={2}>
          {application.CoverLetter}
        </Text>
      )}

      <View style={styles.applicationActions}>
        {application.StatusID === 1 && ( // If pending, allow withdrawal
          <TouchableOpacity 
            style={styles.withdrawButton}
            onPress={() => handleWithdrawApplication(application)}
          >
            <Text style={styles.withdrawButtonText}>Withdraw</Text>
          </TouchableOpacity>
        )}
        {/* NEW: Ask Referral / Referred button instead of View Details */}
        {isJobSeeker && (() => {
          const isReferred = referredJobIds.has(application.JobID);
          return isReferred ? (
            <View style={styles.referredPill}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.referredText}>Referred</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.referralButton}
              onPress={() => handleAskReferral(application)}
            >
              <Ionicons name="people-outline" size={16} color="#ff6600" />
              <Text style={styles.referralText}>Ask Referral</Text>
            </TouchableOpacity>
          );
        })()}
      </View>
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons 
        name={isEmployer ? "people-outline" : "document-text-outline"} 
        size={64} 
        color={colors.gray400} 
      />
      <Text style={styles.emptyStateTitle}>
        {isEmployer ? 'No Applications Yet' : 'No Applications Found'}
      </Text>
      <Text style={styles.emptyStateText}>
        {isEmployer 
          ? 'Applications will appear here when candidates apply to your jobs.'
          : 'Start applying to jobs to track your applications here.'
        }
      </Text>
      {!isEmployer && (
        <TouchableOpacity 
          style={styles.browseJobsButton}
          onPress={() => {
            // Navigate to jobs screen
            navigation.navigate('Jobs');
          }}
        >
          <Text style={styles.browseJobsButtonText}>Browse Jobs</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const LoadingFooter = () => (
    loading && pagination.page > 1 ? (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading more applications...</Text>
      </View>
    ) : null
  );

  if (loading && pagination.page === 1) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading applications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isEmployer ? 'Job Applications' : 'My Applications'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {pagination.total} {pagination.total === 1 ? 'application' : 'applications'}
        </Text>
      </View>

      {/* Applications List */}
      <FlatList
        data={applications}
        renderItem={({ item }) => <ApplicationCard application={item} />}
        keyExtractor={(item) => item.ApplicationID}
        contentContainerStyle={applications.length === 0 ? styles.emptyContainer : styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMoreApplications}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={<EmptyState />}
        ListFooterComponent={<LoadingFooter />}
        showsVerticalScrollIndicator={false}
      />

      {/* NEW: Resume Upload Modal */}
      <ResumeUploadModal
        visible={showResumeModal}
        onClose={() => {
          setShowResumeModal(false);
          setPendingJobForApplication(null);
          setReferralMode(false);
        }}
        onResumeSelected={handleResumeSelected}
        user={user}
        jobTitle={pendingJobForApplication?.JobTitle || pendingJobForApplication?.Title}
      />

      {/* Custom Withdraw Confirmation (web only) */}
      {withdrawTarget && (
        <View style={styles.confirmOverlay} pointerEvents="auto">
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Withdraw Application</Text>
            <Text style={styles.confirmMessage} numberOfLines={4}>
              Are you sure you want to withdraw your application for {withdrawTarget.JobTitle || 'this job'}? This action cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.confirmBtn, styles.cancelBtn]} onPress={() => { console.log('?? Cancel withdraw (web modal)'); setWithdrawTarget(null); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, styles.dangerBtn]} onPress={() => { console.log('?? Confirm withdraw (web modal)'); const target = withdrawTarget; setWithdrawTarget(null); withdrawApplication(target); }}>
                <Text style={styles.dangerBtnText}>Withdraw</Text>
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
  header: {
    padding: 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
  },
  applicationCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  jobTitle: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  companyName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.gray700,
    marginBottom: 12,
  },
  applicationDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginLeft: 6,
  },
  coverLetterPreview: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 18,
  },
  applicationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  withdrawButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  withdrawButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    fontWeight: typography.weights.medium,
  },
  // NEW: Referral button styles
  referralButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ff6600',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  referralText: {
    fontSize: typography.sizes.sm,
    color: '#ff6600',
    fontWeight: typography.weights.medium,
  },
  // NEW: Referred status pill
  referredPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  referredText: {
    fontSize: typography.sizes.sm,
    color: '#10b981',
    fontWeight: typography.weights.medium,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  browseJobsButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  browseJobsButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  // Withdraw confirm styles (web)
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 999,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: colors.text,
  },
  confirmMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray600,
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelBtn: {
    backgroundColor: '#fff',
    borderColor: colors.border,
  },
  dangerBtn: {
    backgroundColor: '#fee2e2',
    borderColor: '#dc2626',
  },
  cancelBtnText: {
    color: colors.gray700,
    fontSize: 14,
    fontWeight: '600',
  },
  dangerBtnText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700',
  },
});