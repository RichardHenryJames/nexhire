import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import refopenAPI from '../../services/api';
import JobCard from '../../components/jobs/JobCard';
import { colors, typography } from '../../styles/theme';

export default function AIRecommendedJobsScreen({ navigation }) {
  const { user, isJobSeeker } = useAuth();
  const [loading, setLoading] = useState(true);
  const [aiJobs, setAiJobs] = useState([]);
  const [error, setError] = useState(null);
  const [primaryResume, setPrimaryResume] = useState(null);
  const primaryResumeLoadedRef = useRef(false);
  const [referredJobIds, setReferredJobIds] = useState(new Set());
  const [referralRequestingIds, setReferralRequestingIds] = useState(new Set());
  const [appliedIds, setAppliedIds] = useState(new Set());

  // Load primary resume once
  const loadPrimaryResume = useCallback(async () => {
    if (!user || !isJobSeeker) return;
    if (primaryResumeLoadedRef.current && primaryResume) return;
    try {
      const profile = await refopenAPI.getApplicantProfile(user.userId || user.id || user.sub || user.UserID);
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
          const ids = new Set(referralRes.data.requests.map(r => r.JobID));
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

      // Call the backend API that deducts ₹100 and returns AI jobs
      const result = await refopenAPI.getAIRecommendedJobs(50);
      
      if (result.success && result.data) {
        setAiJobs(result.data);
        setError(null);
      } else {
        setError({ type: 'no-data', message: result.message || 'No jobs found' });
        setAiJobs([]);
      }
    } catch (error) {
      // Handle insufficient balance error
      if (error.message?.includes('Insufficient') || error.message?.includes('balance')) {
        setError({ type: 'insufficient-balance', message: 'You need ₹100 in your wallet to access AI-recommended jobs.' });
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
        Alert.alert('Success', 'Application submitted successfully!');
      } else {
        Alert.alert('Application Failed', res.error || res.message || 'Failed to submit application');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to submit application');
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
      Alert.alert('Access Denied', 'Only job seekers can apply for positions');
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
        const amountDeducted = res.data?.amountDeducted || 50;
        const balanceAfter = res.data?.walletBalanceAfter;

        let message = 'Referral request sent successfully!';
        if (balanceAfter !== undefined) {
          message = `Referral sent! ₹${amountDeducted} deducted. Balance: ₹${balanceAfter.toFixed(2)}`;
        }

        Alert.alert('Success', message);
      } else {
        if (res.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
          const currentBalance = res.data?.currentBalance || 0;
          Alert.alert(
            'Insufficient Balance',
            `You need ₹50 to ask for a referral.\n\nYour current balance: ₹${currentBalance.toFixed(2)}`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Recharge Wallet', onPress: () => navigation.navigate('Wallet') }
            ]
          );
        } else {
          Alert.alert('Request Failed', res.error || res.message || 'Failed to send referral request');
        }
      }
    } catch (e) {
      console.error('Quick referral error:', e);
      Alert.alert('Error', e.message || 'Failed to send referral request');
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
      Alert.alert('Access Denied', 'Only job seekers can ask for referrals');
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

        if (balance < 50) {
          if (Platform.OS === 'web') {
            if (window.confirm(`Insufficient wallet balance. You need ₹50 to ask for a referral.\n\nYour current balance: ₹${balance.toFixed(2)}\n\nWould you like to recharge?`)) {
              navigation.navigate('Wallet');
            }
            return;
          }
          Alert.alert(
            'Insufficient Balance',
            `You need ₹50 to ask for a referral.\n\nYour current balance: ₹${balance.toFixed(2)}`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Recharge Wallet', onPress: () => navigation.navigate('Wallet') }
            ]
          );
          return;
        }

      } else {
        Alert.alert('Error', 'Unable to check wallet balance. Please try again.');
        return;
      }
    } catch (e) {
      console.error('Failed to check wallet balance:', e);
      Alert.alert('Error', 'Unable to check wallet balance. Please try again.');
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
    <View style={styles.container}>
      {/* AI Gradient Header - Fixed */}
      <LinearGradient
        colors={['#1a1a1a', '#2d2d2d', '#404040']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientHeaderFixed}
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
              <Ionicons name="bulb-outline" size={20} color="#FFD700" />
            </View>
            <View>
              <Text style={styles.headerTitle}>AI Recommended Jobs</Text>
              <Text style={styles.headerSubtitle}>50 AI-matched jobs for you</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a', // Dark theme
  },
  gradientHeaderFixed: {
    paddingTop: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
    marginTop: 100, // Space for fixed header
  },
  loadingText: {
    marginTop: 16,
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  scrollView: {
    flex: 1,
    marginTop: 100, // Space for fixed header
  },
  scrollContent: {
    padding: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginTop: 100, // Space for fixed header
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginTop: 100, // Space for fixed header
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
