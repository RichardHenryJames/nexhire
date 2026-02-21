import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePricing } from '../../contexts/PricingContext';
import useResponsive from '../../hooks/useResponsive';
import refopenAPI from '../../services/api';
import JobCard from '../../components/jobs/JobCard';
import WalletRechargeModal from '../../components/WalletRechargeModal';
import { typography } from '../../styles/theme';
import { showToast } from '../../components/Toast';

// Assets
const AILogo = require('../../../assets/ai_logo.png');

export default function AIRecommendedJobsScreen({ navigation }) {
  const { user, isJobSeeker } = useAuth();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const { pricing } = usePricing(); // 💰 DB-driven pricing
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  
  const [loading, setLoading] = useState(true);
  const [aiJobs, setAiJobs] = useState([]);
  const [error, setError] = useState(null);
  const [primaryResume, setPrimaryResume] = useState(null);
  const primaryResumeLoadedRef = useRef(false);
  const [referredJobIds, setReferredJobIds] = useState(new Set());
  const [referralRequestingIds, setReferralRequestingIds] = useState(new Set());
  const [appliedIds, setAppliedIds] = useState(new Set());

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalData, setWalletModalData] = useState({ currentBalance: 0, requiredAmount: pricing.referralRequestCost, note: '' });

  // Load primary resume once
  const loadPrimaryResume = useCallback(async () => {
    if (!user || !isJobSeeker) return;
    if (primaryResumeLoadedRef.current && primaryResume) return;
    try {
      const profile = await refopenAPI.getApplicantProfile(user.UserID || user.userId || user.id || user.sub);
      if (profile?.success) {
        const resumes = profile.data?.resumes || [];
        const primary = resumes.find(r => r.IsPrimary) || resumes[0];
        if (primary) setPrimaryResume(primary);
      }
    } catch (e) {
      // silent
    } finally {
      primaryResumeLoadedRef.current = true;
    }
  }, [user, isJobSeeker, primaryResume]);

  useEffect(() => { loadPrimaryResume(); }, [loadPrimaryResume]);

  // Load referred jobs on mount
  useEffect(() => {
    if (!user || !isJobSeeker) return;
    
    (async () => {
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
    })();
  }, [user, isJobSeeker]);

  useEffect(() => {
    loadAllAIJobs();
  }, []);

  const loadAllAIJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const userId = user?.UserID || user?.userId || user?.id;
      
      if (!userId) {
        setError({ type: 'auth', message: 'User not found. Please login again.' });
        setLoading(false);
        return;
      }

      // Call the backend API that deducts wallet balance and returns AI jobs
      const result = await refopenAPI.getAIRecommendedJobs(50);
      
      if (result.success && result.data) {
        // Randomize the jobs array using Fisher-Yates shuffle
        const shuffledJobs = [...result.data];
        for (let i = shuffledJobs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledJobs[i], shuffledJobs[j]] = [shuffledJobs[j], shuffledJobs[i]];
        }
        setAiJobs(shuffledJobs);
        setError(null);
      } else {
        setError({ type: 'no-data', message: result.message || 'No jobs found' });
        setAiJobs([]);
      }
    } catch (error) {
      // Handle insufficient balance error
      if (error.message?.includes('Insufficient') || error.message?.includes('balance')) {
        setError({ type: 'insufficient-balance', message: `You need ₹${pricing.aiJobsCost} in your wallet to access AI-recommended jobs.` });
      } else if (error.message?.includes('404') || error.message?.includes('not found')) {
        // Hard refresh - redirect to home if context lost
        Alert.alert('Session Lost', 'Redirecting to home screen...', [
          { text: 'OK', onPress: () => navigation.navigate('Home') }
        ]);
      } else {
        setError({ type: 'error', message: 'Failed to load AI recommendations. Please try again.' });
      }
      setAiJobs([]);
    } finally {
      setLoading(false);
    }
  };

  // Quick apply with resume
  const quickApply = useCallback(async (job, resumeId) => {
    const id = job.JobID || job.id;
    try {
      const applicationData = { 
        jobID: id, 
        coverLetter: `I am very interested in the ${job.Title} position and believe my skills and experience make me a great candidate for this role.`, 
        resumeId 
      };
      const res = await refopenAPI.applyForJob(applicationData);
      if (res?.success) {
        setAppliedIds(prev => { const n = new Set(prev); n.add(id); return n; });
        setAiJobs(prev => prev.filter(j => (j.JobID || j.id) !== id)); // Remove from list
        showToast('Application submitted successfully!', 'success');
      } else {
        showToast('Failed to submit application. Please try again.', 'error');
      }
    } catch (e) {
      showToast('Failed to submit application. Please try again.', 'error');
    }
  }, []);

  // Handle Apply button - exactly like JobsScreen
  const handleApply = useCallback(async (job) => {
    if (!job) return;
    if (!user) {
      Alert.alert('Login Required', 'Please login to apply for jobs', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Auth') }
      ]);
      return;
    }
    if (!isJobSeeker) {
      showToast('Only job seekers can apply for positions', 'error');
      return;
    }
    // Check for primary resume and quick apply
    if (!primaryResumeLoadedRef.current) await loadPrimaryResume();
    if (primaryResume?.ResumeID) { 
      await quickApply(job, primaryResume.ResumeID); 
      return; 
    }
    // No resume - navigate to job application screen
    navigation.navigate('JobApplication', { jobId: job.JobID });
  }, [user, isJobSeeker, navigation, primaryResume, loadPrimaryResume, quickApply]);

  // Quick referral with resume
  const quickReferral = useCallback(async (job, resumeId) => {
    const id = job.JobID || job.id;
    try {
      setReferralRequestingIds(prev => new Set([...prev, id])); // Mark requesting
      const res = await refopenAPI.createReferralRequest({
        jobID: id,
        extJobID: null,
        resumeID: resumeId
      });
      if (res?.success) {
        setReferredJobIds(prev => new Set([...prev, id])); // Mark as referred
        const amountHeld = res.data?.amountHeld || res.data?.amountDeducted || pricing.referralRequestCost;
        const availableBalance = res.data?.availableBalanceAfter;

        let message = 'Referral sent! You\'ll only be charged when someone refers you.';
        if (availableBalance !== undefined) {
          message = `Referral sent! ₹${amountHeld} held. Available: ₹${availableBalance.toFixed(2)}`;
        }

        showToast(message, 'success');
      } else {
        if (res.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
          const availableBalance = res.data?.availableBalance || res.data?.currentBalance || 0;
          Alert.alert(
            'Insufficient Balance',
            `You need ₹${pricing.referralRequestCost} available to request a referral.\n\nYour available balance: ₹${availableBalance.toFixed(2)}`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Recharge Wallet', onPress: () => navigation.navigate('Wallet') }
            ]
          );
        } else {
          showToast('Failed to send referral request. Please try again.', 'error');
        }
      }
    } catch (e) {
      console.error('Quick referral error:', e);
      showToast('Failed to send referral request. Please try again.', 'error');
    } finally {
      setReferralRequestingIds(prev => { const n = new Set(prev); n.delete(id); return n; }); // Remove requesting state
    }
  }, [navigation]);

  // Handle Ask Referral button - exactly like JobsScreen
  const handleAskReferral = useCallback(async (job) => {
    
    if (!job) return;
    if (!user) {
      if (Platform.OS === 'web') {
        if (window.confirm('Please login to ask for referrals.\n\nWould you like to login now?')) {
          navigation.navigate('Auth');
        }
        return;
      }
      Alert.alert('Login Required', 'Please login to ask for referrals', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Auth') }
      ]);
      return;
    }
    if (!isJobSeeker) {
      showToast('Only job seekers can ask for referrals', 'error');
      return;
    }

    const jobId = job.JobID || job.id;

    // Check if already referred
    if (referredJobIds.has(jobId)) {
      if (Platform.OS === 'web') {
        if (window.confirm('You have already requested a referral for this job.\n\nWould you like to view your referrals?')) {
          navigation.navigate('Referrals');
        }
        return;
      }
      Alert.alert('Already Requested', 'You have already requested a referral for this job', [
        { text: 'View Referrals', onPress: () => navigation.navigate('Referrals') },
        { text: 'OK' }
      ]);
      return;
    }

    // Check wallet balance
    try {
      const walletBalance = await refopenAPI.getWalletBalance();

      if (walletBalance?.success) {
        const balance = walletBalance.data?.balance || 0;

        if (balance < pricing.referralRequestCost) {
          setWalletModalData({
            currentBalance: balance,
            requiredAmount: pricing.referralRequestCost,
            note: 'Recharge your wallet to ask for a referral.',
          });
          setShowWalletModal(true);
          return;
        }

      } else {
        showToast('Unable to check wallet balance. Please try again.', 'error');
        return;
      }
    } catch (e) {
      console.error('Failed to check wallet balance:', e);
      showToast('Unable to check wallet balance. Please try again.', 'error');
      return;
    }

    // If user has primary resume, quick referral
    if (!primaryResumeLoadedRef.current) await loadPrimaryResume();
    if (primaryResume?.ResumeID) {
      await quickReferral(job, primaryResume.ResumeID);
      return;
    }

    // No resume - navigate to CreateReferralRequest
    navigation.navigate('CreateReferralRequest', { 
      jobId: jobId,
      job: job 
    });
  }, [user, isJobSeeker, navigation, primaryResume, loadPrimaryResume, quickReferral]);

  return (
    <View style={{ flex: 1 }}>
      {/* AI Premium Header - Modern indigo/violet gradient matching new design system */}
      <LinearGradient
        colors={['#030712', '#0F172A', '#1E1B4B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerFixed}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              // Smart back navigation - check if we have navigation history
              const navState = navigation.getState();
              const routes = navState?.routes || [];
              const currentIndex = navState?.index || 0;
              
              // If we have more than 1 route in the stack, go back normally
              if (routes.length > 1 && currentIndex > 0) {
                navigation.goBack();
              } else {
                // Hard refresh scenario - navigate to Home
                navigation.navigate('Main', {
                  screen: 'MainTabs',
                  params: {
                    screen: 'Home'
                  }
                });
              }
            }} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerIcon}>
              <Image source={AILogo} style={{ width: 24, height: 24 }} resizeMode="contain" />
            </View>
            <View>
              <Text style={styles.headerTitle}>AI Recommended Jobs</Text>
              <Text style={styles.headerSubtitle}>{aiJobs.length > 0 ? `${aiJobs.length} AI-matched jobs for you` : 'AI-matched jobs for you'}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <WalletRechargeModal
        visible={showWalletModal}
        currentBalance={walletModalData.currentBalance}
        requiredAmount={walletModalData.requiredAmount}
        contextType="ai-jobs"
        itemName={walletModalData.note}
        onAddMoney={() => {
          setShowWalletModal(false);
          navigation.navigate('WalletRecharge');
        }}
        onCancel={() => setShowWalletModal(false)}
      />

      <View style={styles.container}>
        <View style={styles.innerContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading AI recommendations...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <View style={[styles.errorIconContainer, error.type === 'insufficient-balance' && styles.warningIconContainer]}>
              <Ionicons 
                name={error.type === 'insufficient-balance' ? 'wallet-outline' : 'alert-circle-outline'} 
                size={48} 
                color={error.type === 'insufficient-balance' ? colors.warning : colors.danger} 
              />
            </View>
            <Text style={styles.errorTitle}>
              {error.type === 'insufficient-balance' ? 'Insufficient Balance' : 'Something Went Wrong'}
            </Text>
            <Text style={styles.errorMessage}>{error.message}</Text>
            <View style={styles.errorButtons}>
              <TouchableOpacity 
                style={styles.errorSecondaryButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.errorSecondaryButtonText}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.errorPrimaryButton, error.type === 'insufficient-balance' && styles.rechargeButton]}
                onPress={() => {
                  if (error.type === 'insufficient-balance') {
                    navigation.navigate('Wallet');
                  } else {
                    loadAllAIJobs();
                  }
                }}
              >
                <Text style={styles.errorPrimaryButtonText}>
                  {error.type === 'insufficient-balance' ? 'Recharge Wallet' : 'Try Again'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : aiJobs.length > 0 ? (
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Job Cards with working handlers */}
            {aiJobs.map((job, index) => {
              const jobKey = job.JobID || job.id;
              const isReferred = referredJobIds.has(jobKey);
              const isReferralRequesting = referralRequestingIds.has(jobKey);
              
              return (
                <JobCard 
                  key={job.JobID || index} 
                  job={job}
                  onPress={() => navigation.navigate('JobDetails', { jobId: job.JobID })}
                  onApply={() => handleApply(job)}
                  onAskReferral={isReferred || isReferralRequesting ? null : () => handleAskReferral(job)}
                  hideSave={true}
                  isReferred={isReferred}
                  isReferralRequesting={isReferralRequesting}
                  currentUserId={user?.UserID}
                />
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={colors.gray400} />
            <Text style={styles.emptyTitle}>No Matches Found</Text>
            <Text style={styles.emptyText}>
              Update your profile with more skills and experience for better recommendations.
            </Text>
            <TouchableOpacity 
              style={styles.updateProfileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.updateProfileButtonText}>Update Profile</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
container: {
  flex: 1,
  backgroundColor: '#030712',
  ...(Platform.OS === 'web' && responsive.isDesktop ? {
    alignItems: 'center',
  } : {}),
},
innerContainer: {
  width: '100%',
  maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 900 : '100%',
  flex: 1,
  ...(Platform.OS === 'web' ? { overflow: 'hidden' } : {}),
},
headerFixed: {
  paddingVertical: 12,
  position: Platform.OS === 'web' ? 'sticky' : 'relative',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10000,
  elevation: 10,
},
header: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 12,
},
backButton: {
  marginRight: 16,
},
headerTitleContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99,102,241,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
headerTitle: {
  fontSize: typography.sizes.lg,
  fontWeight: typography.weights.bold,
  color: colors.white,
},
headerSubtitle: {
  fontSize: typography.sizes.xs,
  color: 'rgba(255, 255, 255, 0.9)',
},
loadingContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 20,
},
loadingText: {
  marginTop: 16,
  fontSize: typography.sizes.md,
  color: colors.gray600,
},
scrollView: {
  flex: 1,
  ...(Platform.OS === 'web' ? { overflow: 'auto' } : {}),
},
scrollContent: {
  padding: 12,
},
emptyState: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
},
errorContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
},
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.danger + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  warningIconContainer: {
    backgroundColor: colors.warning + '15',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    paddingHorizontal: 20,
  },
  errorSecondaryButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  errorSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  errorPrimaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rechargeButton: {
    backgroundColor: colors.warning,
  },
  errorPrimaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  emptyTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  updateProfileButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  updateProfileButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
