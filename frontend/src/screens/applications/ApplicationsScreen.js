import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import { usePricing } from '../../contexts/PricingContext';
import refopenAPI from '../../services/api';
import { getReferralCostForJob } from '../../utils/pricingUtils';
import ResumeUploadModal from '../../components/ResumeUploadModal';
import WalletRechargeModal from '../../components/WalletRechargeModal';
import ConfirmPurchaseModal from '../../components/ConfirmPurchaseModal';
import ReferralSuccessOverlay from '../../components/ReferralSuccessOverlay';
import AdCard from '../../components/ads/AdCard';
import { showToast } from '../../components/Toast';
import { useCustomAlert } from '../../components/CustomAlert';
import { invalidateCache, CACHE_KEYS } from '../../utils/homeCache';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';

// Ad configuration - Google AdSense
const AD_CONFIG = {
  enabled: true,                              // Toggle ads on/off
  frequency: 5,                               // Show ad after every N application cards
};

export default function ApplicationsScreen({ navigation }) {
  const { isEmployer, isJobSeeker, user } = useAuth();
  const { colors } = useTheme();
  const { pricing } = usePricing(); // 💰 DB-driven pricing
  const responsive = useResponsive();
  const { showConfirm } = useCustomAlert();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  
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
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [pendingJobForApplication, setPendingJobForApplication] = useState(null);
  const [referralMode, setReferralMode] = useState(false);
  const [primaryResume, setPrimaryResume] = useState(null);
  // Web withdraw confirmation state
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  // Optimistic withdraw rollback store: ApplicationID -> { application, index }
  const optimisticWithdrawRollbackRef = useRef(new Map());

  // 💎 NEW: Referral confirmation modal state (match Jobs/JobDetails)
  const [showReferralConfirmModal, setShowReferralConfirmModal] = useState(false);
  const [referralConfirmData, setReferralConfirmData] = useState({
    currentBalance: 0,
    requiredAmount: pricing.referralRequestCost,
    jobTitle: 'this job',
    job: null,
  });

  // 💎 NEW: Beautiful wallet modal state
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalData, setWalletModalData] = useState({ currentBalance: 0, requiredAmount: pricing.referralRequestCost });

  // 💰 Tier-based cost helper
  const getJobTierCost = (job) => getReferralCostForJob(job, pricing);

  // 🎉 NEW: Referral success overlay state
  const [showReferralSuccessOverlay, setShowReferralSuccessOverlay] = useState(false);
  const [referralCompanyName, setReferralCompanyName] = useState('');
  const [referralBroadcastTime, setReferralBroadcastTime] = useState(null);
  const [pendingReferralJobId, setPendingReferralJobId] = useState(null);

  // Mount effect: Initial load
  useEffect(() => {
    fetchApplications();
    loadReferralData();
    loadPrimaryResume();
  }, []); // Fixed: was <></> which is invalid syntax

  // Auto-refresh: Add focus listener to refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchApplications(true); // Reset page and refresh
      loadReferralData(); // Also refresh referral data
    });

    return unsubscribe;
  }, [navigation]);

  const fetchApplications = async (resetPage = false) => {
    try {
      const currentPage = resetPage ? 1 : pagination.page;
      setLoading(resetPage);

      let result;
      if (isJobSeeker) {
        // API call: Get job seeker's own applications from backend
        result = await refopenAPI.getMyApplications(currentPage, pagination.pageSize);
      } else {
        // For employers, we'd need to get applications for their jobs
        // This would require a different API call or job-specific applications
        result = { success: true, data: [], meta: { total: 0, totalPages: 0 } };
      }

      if (result.success) {
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
      const referralRes = await refopenAPI.getMyReferralRequests(1, 500);
      
      if (referralRes?.success && referralRes.data?.requests) {
        const activeRequests = referralRes.data.requests.filter(r => r.Status !== 'Cancelled' && r.Status !== 'Expired');
        const ids = new Set(activeRequests.map(r => r.JobID));
        setReferredJobIds(ids);
      }
    } catch (e) {
      console.warn('Failed to load referral data:', e.message);
    }
  };

  // Load primary resume
  const loadPrimaryResume = async () => {
    if (!user || !isJobSeeker) return;
    try {
      const profile = await refopenAPI.getApplicantProfile(user.UserID || user.userId || user.id || user.sub);
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
    await fetchApplications(true); // Reset page and fetch fresh data
  };

  const loadMoreApplications = () => {
    // Fix infinite scroll: Only load more if we haven't reached the end
    if (!loading && !refreshing && pagination.page < pagination.totalPages && applications.length < pagination.total) {
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
    
    // Fix: Show both date and time instead of just date
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

  const formatSalary = (amount, currencyCode = 'USD') => {
    if (!amount) return 'Not specified';
    return `$${amount.toLocaleString()} ${currencyCode}`;
  };

  // NEW: Ask Referral handler (similar to JobsScreen)
  const handleAskReferral = async (job) => {
    if (!job) return;
    if (!user) {
      navigation.navigate('Auth');
      return;
    }
    if (!isJobSeeker) {
      showToast('Only job seekers can ask for referrals', 'error');
      return;
    }

    const jobId = job.JobID || job.id;

    // Check if already referred
    if (referredJobIds.has(jobId)) {
      showToast('Already requested a referral for this job', 'info');
      return;
    }

    // ✅ Check wallet balance
    try {
      const walletBalance = await refopenAPI.getWalletBalance();

      if (walletBalance?.success) {
        const balance = walletBalance.data?.balance || 0;

        // ✅ Match Jobs/JobDetails: always show the same confirmation popup
        setReferralConfirmData({
          currentBalance: balance,
          requiredAmount: getJobTierCost(job),
          jobTitle: job.JobTitle || job.Title || 'this job',
          companyName: job.OrganizationName || job.CompanyName || '',
          job,
        });
        setShowReferralConfirmModal(true);
        return;

      } else {
        console.error('Failed to check wallet balance:', walletBalance.error);
        showToast('Unable to check wallet balance. Please try again.', 'error');
        return;
      }
    } catch (e) {
      console.error('Failed to check wallet balance:', e);
      showToast('Unable to check wallet balance. Please try again.', 'error');
      return;
    }

    // NOTE: Remaining steps happen on confirmation modal proceed.
  };

  // Enhanced resume selected handler
  const handleResumeSelected = async (resumeData) => {
    if (!pendingJobForApplication) return;
    const job = pendingJobForApplication;
    const id = job.JobID || job.id;
    const startTime = Date.now(); // Track start time for broadcast duration
    
    try {
      setShowResumeModal(false);
      if (referralMode) {
        const res = await refopenAPI.createReferralRequest({
          jobID: id,
          extJobID: null,
          resumeID: resumeData.ResumeID
        });
        if (res?.success) {
          // Calculate broadcast time
          const broadcastTime = (Date.now() - startTime) / 1000;
          
          // 🎉 Store pending - will mark as referred when overlay closes
          setPendingReferralJobId(id);
          
          // 🎉 Show fullscreen success overlay for 1 second
          setReferralCompanyName(referralConfirmData.companyName || '');
          setReferralBroadcastTime(broadcastTime);
          setShowReferralSuccessOverlay(true);
          
          const amountHeld = res.data?.amountHeld || res.data?.amountDeducted || getJobTierCost(referralConfirmData.job || {});
          const availableBalance = res.data?.availableBalanceAfter;
          
          let message = 'Referral request sent! Amount held until referral is completed.';
          if (availableBalance !== undefined) {
            message = `Referral sent! ₹${amountHeld} held. Available: ₹${availableBalance.toFixed(2)}`;
          }
          
          showToast(message, 'success');
          invalidateCache(CACHE_KEYS.REFERRER_REQUESTS, CACHE_KEYS.WALLET_BALANCE, CACHE_KEYS.DASHBOARD_STATS);
          
          // 🔧 FIXED: Set the resume directly so next referral doesn't ask for upload
          setPrimaryResume(resumeData);
          await loadPrimaryResume();
        } else {
          // Handle insufficient balance error
          if (res.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
            const availableBalance = res.data?.availableBalance || res.data?.currentBalance || 0;
            const requiredAmount = res.data?.requiredAmount || getJobTierCost(referralConfirmData.job || {});
            
            // 💎 NEW: Show beautiful modal instead of ugly alert
            setWalletModalData({ currentBalance: availableBalance, requiredAmount });
            setShowWalletModal(true);
          } else {
            showToast('Failed to send referral request. Please try again.', 'error');
          }
        }
      }
    } catch (e) {
      console.error('Referral error', e);
      showToast('Operation failed. Please try again.', 'error');
    } finally {
      setPendingJobForApplication(null);
      setReferralMode(false);
    }
  };

  // Enhanced quick referral
  const quickReferral = async (job, resumeId) => {
    const id = job.JobID || job.id;
    const startTime = Date.now(); // Track start time for broadcast duration
    try {
      const res = await refopenAPI.createReferralRequest({
        jobID: id,
        extJobID: null,
        resumeID: resumeId
      });
      if (res?.success) {
        // Calculate broadcast time
        const broadcastTime = (Date.now() - startTime) / 1000;
        
        // 🎉 Store pending - will mark as referred when overlay closes
        setPendingReferralJobId(id);
        
        // 🎉 Show fullscreen success overlay for 1 second
        setReferralCompanyName(job.OrganizationName || job.CompanyName || '');
        setReferralBroadcastTime(broadcastTime);
        setShowReferralSuccessOverlay(true);
        
        const amountDeducted = res.data?.amountDeducted || 39;
        const balanceAfter = res.data?.walletBalanceAfter;
        
        let message = 'Referral request sent to verified employees who can refer!';
        if (balanceAfter !== undefined) {
          message = `Referral sent to verified employees! ₹${amountDeducted} deducted. Balance: ₹${balanceAfter.toFixed(2)}`;
        }
        
        showToast(message, 'success');
        invalidateCache(CACHE_KEYS.REFERRER_REQUESTS, CACHE_KEYS.WALLET_BALANCE, CACHE_KEYS.DASHBOARD_STATS);
      } else {
        // Handle insufficient balance error
        if (res.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
          const currentBalance = res.data?.currentBalance || 0;
          const requiredAmount = res.data?.requiredAmount || getJobTierCost(referralConfirmData.job || {});
          
          // 💎 NEW: Show beautiful modal instead of ugly alert
          setWalletModalData({ currentBalance, requiredAmount });
          setShowWalletModal(true);
        } else {
          showToast('Failed to send referral request. Please try again.', 'error');
        }
      }
    } catch (e) {
      showToast('Failed to send referral request. Please try again.', 'error');
    }
  };

  // Web withdrawal confirmation logic
  const handleWithdrawApplication = (application) => {
    if (Platform.OS === 'web') {
      // Use custom modal (RN Alert unreliable on web for multi-button)
      setWithdrawTarget(application);
      return;
    }
    showConfirm({
      title: 'Withdraw Application',
      message: `Are you sure you want to withdraw your application for ${application.JobTitle || 'this job'}? This action cannot be undone.`,
      icon: 'close-circle',
      iconColor: '#EF4444',
      confirmText: 'Withdraw',
      confirmStyle: 'destructive',
      onConfirm: () => withdrawApplication(application),
    });
  };

  // Withdraw application function with immediate optimistic UI update
  const withdrawApplication = async (application) => {
    if (!application?.ApplicationID) return;

    const applicationId = application.ApplicationID;
    let wasRemoved = false;
    let removedIndex = -1;

    // 🔥 OPTIMISTIC UI UPDATE: Remove from list immediately (before API call)
    setApplications((prevApplications) => {
      const idx = prevApplications.findIndex(
        (app) => app.ApplicationID === applicationId
      );
      
      if (idx === -1) {
        console.warn('Application not found in list:', applicationId);
        return prevApplications;
      }

      removedIndex = idx;
      wasRemoved = true;

      // Store for rollback in case API fails
      optimisticWithdrawRollbackRef.current.set(applicationId, {
        application: prevApplications[idx],
        index: idx,
      });

      // Create new array without the removed item
      const newApplications = [...prevApplications];
      newApplications.splice(idx, 1);
      
      return newApplications;
    });

    // 🔥 OPTIMISTIC UI UPDATE: Decrement count immediately
    setPagination((prev) => {
      const newTotal = Math.max((prev.total || 0) - 1, 0);
      return {
        ...prev,
        total: newTotal,
      };
    });

    // Now make the API call
    try {
      const res = await refopenAPI.withdrawApplication(applicationId);
      
      if (res.success) {
        // Success! Clear rollback data
        optimisticWithdrawRollbackRef.current.delete(applicationId);
        showToast('Application withdrawn successfully', 'success');
        invalidateCache(CACHE_KEYS.RECENT_APPLICATIONS, CACHE_KEYS.DASHBOARD_STATS);
      } else {
        console.error('❌ Withdraw API error:', res.error || res.message);
        throw new Error(res.error || res.message || 'Failed to withdraw application');
      }
    } catch (error) {
      console.error('❌ Withdraw application error:', error);

      // 🔄 ROLLBACK: Restore the application to the list
      const rollback = optimisticWithdrawRollbackRef.current.get(applicationId);
      optimisticWithdrawRollbackRef.current.delete(applicationId);
      
      if (rollback?.application) {
        setApplications((prev) => {
          // Double-check it's not already in the list
          if (prev.some((a) => a.ApplicationID === applicationId)) {
            return prev;
          }
          
          const next = [...prev];
          const insertAt =
            typeof rollback.index === 'number' &&
            rollback.index >= 0 &&
            rollback.index <= next.length
              ? rollback.index
              : next.length;
          next.splice(insertAt, 0, rollback.application);
          
          return next;
        });
        
        setPagination((prev) => {
          const newTotal = (prev.total || 0) + 1;
          return { ...prev, total: newTotal };
        });
      } else if (wasRemoved) {
        // Fallback: if we removed but didn't capture rollback, refetch everything
        fetchApplications(true);
      }

      showToast('Failed to withdraw application. Please try again.', 'error');
    }
  };

  // EmptyState component that was missing
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
            navigation.navigate('Jobs');
          }}
        >
          <Text style={styles.browseJobsButtonText}>Browse Jobs</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const ApplicationCard = ({ application }) => {
    return (
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
          <View style={styles.jobInfo}>
            {/* Company Logo */}
            <View style={styles.logoContainer}>
              {application.OrganizationLogo ? (
                <Image 
                  source={{ uri: application.OrganizationLogo }} 
                  style={styles.companyLogo}
                  onError={() => {}}
                />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="business-outline" size={24} color="#666" />
                </View>
              )}
            </View>
            
            {/* Job Title and Company */}
            <View style={styles.jobDetails}>
              <Text style={styles.jobTitle} numberOfLines={2}>
                {application.JobTitle || `Job ID: ${application.JobID}`}
              </Text>
              <Text style={styles.companyName}>
                {application.CompanyName || 'Company Name'}
              </Text>
              
              {/* Website & LinkedIn Links - Icons only, same line */}
              {(application.OrganizationWebsite || application.OrganizationLinkedIn) && (
                <View style={styles.socialLinksRow}>
                  {application.OrganizationWebsite && (
                    <TouchableOpacity 
                      style={styles.socialIconButton}
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          window.open(application.OrganizationWebsite, '_blank');
                        } else {
                          import('react-native').then(({ Linking }) => {
                            Linking.openURL(application.OrganizationWebsite);
                          });
                        }
                      }}
                    >
                      <Ionicons name="globe-outline" size={18} color="#0066cc" />
                    </TouchableOpacity>
                  )}
                  
                  {application.OrganizationLinkedIn && (
                    <TouchableOpacity 
                      style={styles.socialIconButton}
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          window.open(application.OrganizationLinkedIn, '_blank');
                        } else {
                          import('react-native').then(({ Linking }) => {
                            Linking.openURL(application.OrganizationLinkedIn);
                          });
                        }
                      }}
                    >
                      <Ionicons name="logo-linkedin" size={18} color="#0077b5" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
          
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

        {/* Job Type Display similar to JobsScreen */}
        {application.JobTypeName && (
          <View style={styles.jobTypeContainer}>
            <View style={styles.jobTypeTag}>
              <Text style={styles.jobTypeText}>{application.JobTypeName}</Text>
            </View>
          </View>
        )}
        
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

        {/* Application Actions section - SAME AS BEFORE */}
        <View style={styles.applicationActions}>
          {application.StatusID === 1 && ( // If pending, allow withdrawal
            <TouchableOpacity 
              style={styles.withdrawButton}
              onPress={() => handleWithdrawApplication(application)}
            >
              <Text style={styles.withdrawButtonText}>Withdraw</Text>
            </TouchableOpacity>
          )}
          
          {/* Ask Referral / Referred button styling */}
          {isJobSeeker && (() => {
            const isReferred = referredJobIds.has(application.JobID);
            return isReferred ? (
              <View style={styles.referredPill}>
                <Ionicons name="checkmark-circle" size={22} color="#10b981" />
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.referralButton}
                onPress={() => handleAskReferral(application)}
              >
                <Ionicons name="people-outline" size={16} color={colors.warning} />
                <Text style={styles.referralText}>Ask Referral</Text>
              </TouchableOpacity>
            );
          })()}
        </View>
      </TouchableOpacity>
    );
  };

  const LoadingFooter = () => {
    // Better loading footer with completion status
    if (loading && pagination.page > 1) {
      return (
        <View style={styles.loadingFooter}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading more applications...</Text>
        </View>
      );
    }
    
    // Show completion message when all applications are loaded
    if (applications.length > 0 && applications.length >= pagination.total) {
      return (
        <View style={styles.completionFooter}>
          <Text style={styles.completionText}>
            All {pagination.total} {pagination.total === 1 ? 'application' : 'applications'} loaded
          </Text>
        </View>
      );
    }
    
    return null;
  };

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
      <SubScreenHeader
        title={pagination.total > 0 ? `${isEmployer ? 'Job Applications' : 'My Applications'} (${pagination.total})` : (isEmployer ? 'Job Applications' : 'My Applications')}
        fallbackTab="Jobs"
      />
      <View style={styles.innerContainer}>
        {/* Info banner - showing last 2 weeks */}
        {applications.length > 0 && (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.infoBannerText}>Showing applications from last 2 weeks</Text>
          </View>
        )}
        
        {/* Applications List */}
        <FlatList
          style={{ flex: 1 }}
          data={applications}
          renderItem={({ item, index }) => (
            <>
              <ApplicationCard application={item} />
              {/* Insert ad after every N applications */}
              {AD_CONFIG.enabled && (index + 1) % AD_CONFIG.frequency === 0 && index < applications.length - 1 && (
                <View style={{ marginBottom: 12 }}>
                  <AdCard variant="applications" />
                </View>
              )}
            </>
          )}
          keyExtractor={(item) => item.ApplicationID}
          contentContainerStyle={applications.length === 0 ? styles.emptyContainer : styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMoreApplications}
          onEndReachedThreshold={0.2}
          ListEmptyComponent={<EmptyState />}
          ListFooterComponent={<LoadingFooter />}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS !== 'web'}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      </View>

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

      {/* 💎 NEW: Beautiful Wallet Recharge Modal */}
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

      {/* Referral Confirmation Modal */}
      <ConfirmPurchaseModal
        visible={showReferralConfirmModal}
        currentBalance={referralConfirmData.currentBalance}
        requiredAmount={referralConfirmData.requiredAmount}
        contextType="referral"
        itemName={referralConfirmData.jobTitle}
        onProceed={async () => {
          setShowReferralConfirmModal(false);

          const job = referralConfirmData.job;
          if (!job) {
            showToast('Job not found. Please try again.', 'error');
            return;
          }

          // Safety: if balance is insufficient, route to wallet recharge
          if ((referralConfirmData.currentBalance || 0) < (referralConfirmData.requiredAmount || getJobTierCost(referralConfirmData.job || {}))) {
            navigation.navigate('WalletRecharge');
            return;
          }

          const jobId = job.JobID || job.id;

          // Double-check no existing request (race condition safety)
          try {
            const existing = await refopenAPI.getMyReferralRequests(1, 100);
            if (existing.success && existing.data?.requests) {
              const already = existing.data.requests.some(r => r.JobID === jobId && r.Status !== 'Cancelled' && r.Status !== 'Expired');
              if (already) {
                showToast('Already requested a referral for this job', 'info');
                return;
              }
            }
          } catch (e) {
            console.warn('Referral pre-check failed:', e.message);
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
        }}
        onAddMoney={() => {
          setShowReferralConfirmModal(false);
          navigation.navigate('WalletRecharge');
        }}
        onCancel={() => setShowReferralConfirmModal(false)}
      />

      {/* 🎉 Referral Success Overlay */}
      <ReferralSuccessOverlay
        visible={showReferralSuccessOverlay}
        onComplete={() => {
          setShowReferralSuccessOverlay(false);
          // ✅ Now mark as referred after overlay closes
          if (pendingReferralJobId) {
            setReferredJobIds(prev => new Set([...prev, pendingReferralJobId]));
            setPendingReferralJobId(null);
          }
        }}
        duration={3500}
        companyName={referralCompanyName}
        broadcastTime={referralBroadcastTime}
      />

      {/* Custom Withdraw Confirmation (web only) */}
      <Modal
        visible={!!withdrawTarget}
        transparent
        onRequestClose={() => setWithdrawTarget(null)}
      >
        <Pressable
          style={styles.confirmOverlay}
          onPress={() => setWithdrawTarget(null)}
        >
          <Pressable style={styles.confirmBox} onPress={() => {}}>
            <Text style={styles.confirmTitle}>Withdraw Application</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to withdraw your application for{' '}
              <Text style={{ fontWeight: typography.weights.bold, color: colors.text }}>
                {withdrawTarget?.JobTitle || 'this job'}
              </Text>
              ? This action cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.cancelBtn]}
                onPress={() => setWithdrawTarget(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.dangerBtn]}
                onPress={() => {
                  const target = withdrawTarget;
                  setWithdrawTarget(null);
                  if (target) withdrawApplication(target);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.dangerBtnText}>Withdraw</Text>
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
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoBannerText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  applicationCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: colors.shadow,
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
  jobInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  logoContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  jobDetails: {
    flex: 1,
  },
  jobTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
    lineHeight: 22,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  companyName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  socialLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  socialIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Job Type Display Styles (matching JobsScreen)
  jobTypeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  jobTypeTag: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  jobTypeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.primary,
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
    color: colors.textSecondary,
    marginLeft: 6,
  },
  coverLetterPreview: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 18,
  },
  // Application Actions (matching JobsScreen)
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
    borderColor: colors.error,
  },
  withdrawButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    fontWeight: typography.weights.medium,
  },
  // MATCH JobsScreen: Referral button styles (exact match)
  referralButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.warning + '15',
    gap: 4,
  },
  referralText: {
    color: colors.warning,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  // MATCH JobsScreen: Referred status pill (exact match)
  referredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success,
    minWidth: 36,
  },
  // Empty state styles
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
    color: colors.textSecondary,
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
  completionFooter: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  completionText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  // Withdraw confirm styles (web)
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
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 999,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: colors.shadow,
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
    color: colors.textSecondary,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  dangerBtn: {
    backgroundColor: colors.error + '15',
    borderColor: colors.error,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  dangerBtnText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
});