import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  Image,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import refopenAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import { usePricing } from '../../contexts/PricingContext';
import { typography } from '../../styles/theme';
import ResumeUploadModal from '../../components/ResumeUploadModal';
import WalletRechargeModal from '../../components/WalletRechargeModal';
import ConfirmPurchaseModal from '../../components/ConfirmPurchaseModal';
import ReferralSuccessOverlay from '../../components/ReferralSuccessOverlay';
import { showToast } from '../../components/Toast';
import useResponsive from '../../hooks/useResponsive';
import { ResponsiveContainer } from '../../components/common/ResponsiveLayout';

export default function JobDetailsScreen({ route, navigation }) {
const { jobId, fromReferralRequest } = route.params || {};
  const { user, isJobSeeker, isEmployer } = useAuth();
  const { colors } = useTheme();
  const { pricing } = usePricing(); // 💰 DB-driven pricing
  const responsive = useResponsive();
  const { isMobile, isDesktop, isTablet, contentWidth } = responsive;
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const { width } = useWindowDimensions();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  
  // PostedByType: 0 = Scraped, 1 = Employer posted, 2 = Referrer posted
  // For referrer-posted jobs, hide Apply button and show Ask Referral only
  const isReferrerPosted = job?.PostedByType === 2;
  
  // Hide Ask Referral button if current user is the one who posted this job
  const isOwnPostedJob = user?.UserID && job?.PostedByUserID && user.UserID === job.PostedByUserID;
  
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [referralMode, setReferralMode] = useState(false);
  const [hasReferred, setHasReferred] = useState(false);
  const [primaryResume, setPrimaryResume] = useState(null);
  const [referralMessage, setReferralMessage] = useState('');
  const [showReferralMessageInput, setShowReferralMessageInput] = useState(true);
  const [coverLetter, setCoverLetter] = useState('');
  const [showCoverLetterMessageInput, setShowCoverLetterMessageInput] = useState(true);
  const [referralRequesting, setReferralRequesting] = useState(false);
  
  // 💎 NEW: Beautiful wallet modal state
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalData, setWalletModalData] = useState({ currentBalance: 0, requiredAmount: pricing.referralRequestCost });
  
  // 💎 NEW: Referral confirmation modal state
  const [showReferralConfirmModal, setShowReferralConfirmModal] = useState(false);
  const [referralConfirmData, setReferralConfirmData] = useState({ currentBalance: 0, requiredAmount: pricing.referralRequestCost });

  // 🎉 NEW: Referral success overlay state
  const [showReferralSuccessOverlay, setShowReferralSuccessOverlay] = useState(false);
  const [referralCompanyName, setReferralCompanyName] = useState('');
  const [referralBroadcastTime, setReferralBroadcastTime] = useState(null);
  const [pendingReferralSuccess, setPendingReferralSuccess] = useState(false);

  // 💎 NEW: Publish confirmation modal state
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState(false);
  const [publishConfirmData, setPublishConfirmData] = useState({ currentBalance: 0, requiredAmount: pricing.jobPublishCost });

  // Initialize default cover letter when job loads (only once)
  // Removed default text - user should write their own cover letter

  // Helper builder for cover letter
  const buildCoverLetter = useCallback(() => {
    const fallback = job?.Title
      ? `I am very interested in the ${job.Title} position and believe my skills and experience make me a great candidate for this role.`
      : 'I am very interested in this position and believe my skills and experience make me a great candidate.';
    const custom = coverLetter.trim();
    return custom.length ? custom : fallback;
  }, [coverLetter, job?.Title]);

  // Load job details and referral status
  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
      loadReferralStatus();
      checkSavedStatus();
    } else {
      setLoading(false);
    }
  }, [jobId]);

  // Load primary resume once
  const loadPrimaryResume = useCallback(async () => {
    if (user && isJobSeeker) {
      try {
        const profile = await refopenAPI.getApplicantProfile(user.userId || user.id || user.sub || user.UserID);
        if (profile?.success) {
          const resumes = profile.data?.resumes || [];
          const primary = resumes.find(r => r.IsPrimary) || resumes[0];
          if (primary) setPrimaryResume(primary);
        }
      } catch {}
    }
  }, [user, isJobSeeker]);

  useEffect(() => { loadPrimaryResume(); }, [loadPrimaryResume]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      const result = await refopenAPI.getJobById(jobId);
      
      if (result.success) {
        setJob(result.data);
        // Check if user has already applied (if authenticated)
        if (user && isJobSeeker) {
          checkApplicationStatus();
        }
      } else {
        showToast('Job not found', 'error');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      showToast('Failed to load job details', 'error');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const checkApplicationStatus = async () => {
    try {
      // Check if user has already applied by getting their applications
      const result = await refopenAPI.getMyApplications(1, 100);
      if (result.success) {
        const hasAppliedToJob = result.data.some(app => app.JobID === jobId);
        setHasApplied(hasAppliedToJob);
      }
    } catch (error) {
      console.error('Error checking application status:', error);
    }
  };

  // Check if job is saved
  const checkSavedStatus = async () => {
    if (!user || !isJobSeeker) return;
    try {
      const result = await refopenAPI.getMySavedJobs(1, 100);
      if (result.success) {
        const isJobSaved = result.data.some(savedJob => savedJob.JobID === jobId);
        setIsSaved(isJobSaved);
      }
    } catch (error) {
      console.error('Error checking saved status:', error);
    }
  };

  const loadReferralStatus = async () => {
    if (!user || !isJobSeeker || !jobId) return;
    
    try {
      const referralRes = await refopenAPI.getMyReferralRequests(1, 100);
      
      if (referralRes?.success && referralRes.data?.requests) {
        const hasReferred = referralRes.data.requests.some(r => r.JobID === jobId && r.Status !== 'Cancelled' && r.Status !== 'Expired');
        setHasReferred(hasReferred);
      }
    } catch (error) {
      console.warn('Failed to load referral status:', error.message);
    }
  };

  const handleApply = async () => {
    
    if (!user) {
      showToast('Please login to apply for jobs', 'info');
      navigation.navigate('Auth');
      return;
    }

    if (!isJobSeeker) {
      showToast('Only job seekers can apply for positions', 'error');
      return;
    }

    if (hasApplied) {
      showToast('You have already applied for this position', 'error');
      return;
    }

    setReferralMode(false); // ensure apply flow
    // Auto-apply if primary resume exists
    if (primaryResume?.ResumeID) {
      await quickApply(primaryResume.ResumeID);
      return;
    }
    setShowResumeModal(true);
  };

  const handleAskReferral = async () => {
    
    if (!user) {
      showToast('Please login to ask for referrals', 'info');
      navigation.navigate('Auth');
      return;
    }
    if (!isJobSeeker) {
      showToast('Only job seekers can ask for referrals', 'error');
      return;
    }
    
    if (hasReferred) {
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
    
    // ✅ Check wallet balance and show confirmation modal
    // NOW USES availableBalance (balance minus holds)
    try {
      const walletBalance = await refopenAPI.getWalletBalance();
      
      if (walletBalance?.success) {
        // Use availableBalance for hold-based payment system
        const availableBalance = walletBalance.data?.availableBalance ?? walletBalance.data?.balance ?? 0;
        const holdAmount = walletBalance.data?.holdAmount ?? 0;
        
        // Show confirmation modal (works for both sufficient and insufficient balance)
        setReferralConfirmData({ 
          currentBalance: availableBalance, // Use available, not total
          requiredAmount: pricing.referralRequestCost,
          holdAmount: holdAmount // Pass hold info for display
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
  };

  // ✅ NEW: Handle referral confirmation proceed
  const handleReferralConfirmProceed = async () => {
    setShowReferralConfirmModal(false);
    
    // Check if balance is insufficient
    if (referralConfirmData.currentBalance < referralConfirmData.requiredAmount) {
      // Show recharge modal
      setWalletModalData({ 
        currentBalance: referralConfirmData.currentBalance, 
        requiredAmount: referralConfirmData.requiredAmount 
      });
      setShowWalletModal(true);
      return;
    }
    
    // Double-check no existing request
    try {
      const existing = await refopenAPI.getMyReferralRequests(1, 100);
      if (existing.success && existing.data?.requests) {
        const already = existing.data.requests.some(r => r.JobID === jobId && r.Status !== 'Cancelled' && r.Status !== 'Expired');
        if (already) {
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
      }
    } catch (e) { console.warn('Referral pre-check failed:', e.message); }
    
    // Proceed with referral request
    if (primaryResume?.ResumeID) {
      await quickReferral(primaryResume.ResumeID);
      return;
    }
    setReferralMode(true); 
    setShowResumeModal(true);
  };

  // REQUIREMENT 2: Refresh page after resume submission to reload primary resume
  const handleResumeSelected = async (resumeData) => {
    if (referralMode) {
      const startTime = Date.now(); // Track start time for broadcast duration
      try {
        setReferralRequesting(true);
        const res = await refopenAPI.createReferralRequest({
          jobID: jobId,
          extJobID: null,
          resumeID: resumeData.ResumeID,
          referralMessage: referralMessage.trim() || undefined
        });
        if (res.success) {
          // Calculate broadcast time
          const broadcastTime = (Date.now() - startTime) / 1000;
          
          // 🎉 Store pending - will mark as referred when overlay closes
          setPendingReferralSuccess(true);
          
          // 🎉 Show fullscreen success overlay for 1 second
          setReferralCompanyName(job?.OrganizationName || '');
          setReferralBroadcastTime(broadcastTime);
          setShowReferralSuccessOverlay(true);
          
          const amountHeld = res.data?.amountHeld || res.data?.amountDeducted || pricing.referralRequestCost;
          const availableBalance = res.data?.availableBalanceAfter;
          
          let message = 'Referral request sent! Amount held until referral is completed.';
          if (availableBalance !== undefined) {
            message = `Referral request sent! ₹${amountHeld} held. Available: ₹${availableBalance.toFixed(2)}`;
          }
          
          showToast(message, 'success');
          setReferralMessage('');
          setShowReferralMessageInput(false);
          
          // 🔧 FIXED: Set the resume directly so next referral doesn't ask for upload
          setPrimaryResume(resumeData);
          await loadPrimaryResume();
        } else {
          // Handle insufficient balance error
          if (res.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
            const currentBalance = res.data?.currentBalance || 0;
            const requiredAmount = res.data?.requiredAmount || pricing.referralRequestCost;
            
            // 💎 NEW: Show beautiful modal instead of ugly alert
            setWalletModalData({ currentBalance, requiredAmount });
            setShowWalletModal(true);
          } else {
            showToast('Failed to send referral request. Please try again.', 'error');
          }
        }
      } catch (e) {
        console.error('Referral request error:', e);
        showToast('Failed to send referral request. Please try again.', 'error');
      } finally {
        setReferralMode(false);
        setShowResumeModal(false);
        setReferralRequesting(false);
      }
      return;
    }
    
    // 🔧 REQUIREMENT 2: Reload primary resume after application submission
    await submitApplication(resumeData.ResumeID);
    await loadPrimaryResume();
  };

  const submitApplication = async (resumeId) => {
    setApplying(true);
    try {
      const applicationData = {
        jobID: jobId,
        coverLetter: buildCoverLetter(), // 🆕 NEW: Use custom cover letter
        expectedSalary: job.SalaryRangeMax || null,
        expectedCurrencyID: job.CurrencyID || null,
        availableFromDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      };

      if (resumeId) {
        applicationData.resumeId = resumeId;
      }

      const result = await refopenAPI.applyForJob(applicationData);
      
      if (result.success) {
        setHasApplied(true);
        showToast('Application submitted', 'success');
        
        // 🔧 REQUIREMENT 1: Redirect to Jobs screen with appliedJobId for proper refresh
        setTimeout(() => {
          navigation.navigate('Jobs', { 
            activeTab: 'openings', 
            successMessage: `Application submitted for ${job.Title}`,
            appliedJobId: jobId // 🔧 NEW: Pass jobId so JobsScreen can remove it from list
          });
        }, 1500); // Small delay to show toast
        
      } else {
        if (result.error?.includes('No resume found')) {
          Alert.alert(
            'Resume Required', 
            'A resume is required to apply for jobs. Please upload one and try again.',
            [
              { text: 'Upload Resume', onPress: () => setShowResumeModal(true) },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        } else {
          showToast('Failed to submit application. Please try again.', 'error');
        }
      }
    } catch (error) {
      console.error('Application error:', error);
      
      if (error.message?.includes('No resume found')) {
        Alert.alert(
          'Resume Required', 
          'A resume is required to apply for jobs. Please upload one and try again.',
          [
            { text: 'Upload Resume', onPress: () => setShowResumeModal(true) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      } else {
        showToast('Failed to submit application. Please try again.', 'error');
      }
    } finally {
      setApplying(false);
      setShowResumeModal(false);
    }
  };

  // Quick auto-apply using primary resume
  const quickApply = async (resumeId) => {
    try {
      const applicationData = {
        jobID: jobId,
        coverLetter: buildCoverLetter(), // 🆕 NEW: Use custom cover letter
        resumeId
      };
      const res = await refopenAPI.applyForJob(applicationData);
      if (res?.success) {
        setHasApplied(true);
        showToast('Application submitted', 'success');
        
        // 🔧 REQUIREMENT 1: Redirect to Jobs screen with appliedJobId for proper refresh
        setTimeout(() => {
          navigation.navigate('Jobs', { 
            activeTab: 'openings', 
            successMessage: `Application submitted for ${job.Title}`,
            appliedJobId: jobId // 🔧 NEW: Pass jobId so JobsScreen can remove it from list
          });
        }, 1500);
        
      } else {
        showToast('Failed to submit application. Please try again.', 'error');
      }
    } catch (e) {
      showToast('Failed to submit application. Please try again.', 'error');
    }
  };

  const quickReferral = async (resumeId) => {
    const startTime = Date.now(); // Track start time for broadcast duration
    try {
      setReferralRequesting(true);
      const res = await refopenAPI.createReferralRequest({
        jobID: jobId,
        extJobID: null,
        resumeID: resumeId,
        referralMessage: referralMessage.trim() || undefined
      });
      if (res?.success) {
        // Calculate broadcast time
        const broadcastTime = (Date.now() - startTime) / 1000;
        
        // 🎉 Store pending - will mark as referred when overlay closes
        setPendingReferralSuccess(true);
        
        // 🎉 Show fullscreen success overlay for 1 second
        setReferralCompanyName(job?.OrganizationName || '');
        setReferralBroadcastTime(broadcastTime);
        setShowReferralSuccessOverlay(true);
        
        const amountHeld = res.data?.amountHeld || res.data?.amountDeducted || pricing.referralRequestCost;
        const availableBalance = res.data?.availableBalanceAfter;
        
        let message = 'Referral sent! You\'ll only be charged when someone refers you.';
        if (availableBalance !== undefined) {
          message += `\n\n₹${amountHeld} held (not charged yet).\nAvailable: ₹${availableBalance.toFixed(2)}`;
        }
        
        showToast(message, 'success');
        setReferralMessage('');
        setShowReferralMessageInput(false);
      } else {
        // Handle insufficient balance error
        if (res.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
          const currentBalance = res.data?.currentBalance || 0;
          const requiredAmount = res.data?.requiredAmount || pricing.referralRequestCost;
          
          // 💎 NEW: Show beautiful modal instead of ugly alert
          setWalletModalData({ currentBalance, requiredAmount });
          setShowWalletModal(true);
        } else {
          showToast('Failed to send referral request. Please try again.', 'error');
        }
      }
    } catch (e) {
      console.error('Quick referral error:', e);
      showToast('Failed to send referral request. Please try again.', 'error');
    } finally {
      setReferralRequesting(false);
    }
  };

  // REQUIREMENT 4: Implement save/unsave functionality
  const handleSaveJob = async () => {
    if (!user || !isJobSeeker) {
      Alert.alert('Login Required', 'Please login to save jobs', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Auth') }
      ]);
      return;
    }

    try {
      if (isSaved) {
        // Unsave the job
        const result = await refopenAPI.unsaveJob(jobId);
        if (result.success) {
          setIsSaved(false);
          showToast('Job removed from saved', 'success');
        } else {
          showToast('Failed to remove job from saved', 'error');
        }
      } else {
        // Save the job
        const result = await refopenAPI.saveJob(jobId);
        if (result.success) {
          setIsSaved(true);
          showToast('Job saved successfully', 'success');
        } else {
          showToast('Failed to save job', 'error');
        }
      }
    } catch (error) {
      console.error('Save/Unsave error:', error);
      showToast('Failed to update saved status. Please try again.', 'error');
    }
  };

  // ✅ NEW: Handle publish job for employers
  const handlePublishJob = async () => {
    if (!job?.JobID) {
      return;
    }

    const PUBLISH_JOB_FEE = pricing.jobPublishCost; // Dynamic from DB (default: ₹0 — free)

    try {
      // Check wallet balance
      const walletBalance = await refopenAPI.getWalletBalance();
      
      if (walletBalance?.success) {
        const balance = walletBalance.data?.balance || 0;
        
        // Show confirmation modal (works for both sufficient and insufficient balance)
        setPublishConfirmData({ currentBalance: balance, requiredAmount: PUBLISH_JOB_FEE });
        setShowPublishConfirmModal(true);
      } else {
        console.error('Failed to check wallet balance:', walletBalance?.error);
        showToast('Unable to check wallet balance', 'error');
      }
    } catch (error) {
      console.error('Failed to check wallet balance:', error);
      showToast('Unable to check wallet balance', 'error');
    }
  };

  const handlePublishConfirmProceed = async () => {
    setShowPublishConfirmModal(false);
    const { currentBalance, requiredAmount } = publishConfirmData;

    // Double check balance
    if (currentBalance < requiredAmount) {
      setWalletModalData({ currentBalance, requiredAmount });
      setShowWalletModal(true);
      return;
    }

    try {
      setPublishing(true);
      const result = await refopenAPI.publishJob(job.JobID);

      if (result.success) {
        showToast('Job published successfully!', 'success');
        setJob(prevJob => ({ ...prevJob, Status: 'Published' }));
        setTimeout(() => {
          navigation.navigate('MainTabs', {
            screen: 'Jobs',
            params: {
              switchToTab: 'published',
              publishedJobId: job.JobID,
              successMessage: `${job.Title} has been published successfully!`
            }
          });
        }, 1500);
        return;
      }

      const message = result?.error || result?.message || 'Failed to publish job';
      showToast(message, 'error');
    } catch (error) {
      const message = error?.message || 'Failed to publish job';
      showToast(message, 'error');
    } finally {
      setPublishing(false);
    }
  };

  const formatSalary = () => {
    if (job.SalaryRangeMin && job.SalaryRangeMax) {
      const currency = job.CurrencyCode || 'USD';
      const period = job.SalaryPeriod || 'Annual';
      return `$${job.SalaryRangeMin?.toLocaleString()} - $${job.SalaryRangeMax?.toLocaleString()} ${currency} ${period}`;
    }
    return 'Salary not specified';
  };

  const formatLocation = () => {
    const locationParts = [];
    if (job.City) locationParts.push(job.City);
    if (job.State) locationParts.push(job.State);
    if (job.Country) locationParts.push(job.Country);
    
    let location = locationParts.join(', ') || job.Location || 'Location not specified';
    
    if (job.IsRemote) {
      location += ' (Remote)';
    } else if (job.WorkplaceType) {
      location += ` (${job.WorkplaceType})`;
    }
    
    return location;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString();
  };

  // ✅ NEW: Helper functions for external job information
  const getJobSourceInfo = () => {
    if (!job.ExternalJobID) return 'RefOpen';
    
    const source = job.ExternalJobID.split('_')[0];
    const sourceMap = {
      'remoteok': 'RemoteOK',
      'adzuna': 'Adzuna',
      'weworkremotely': 'WeWorkRemotely',
      'hackernews': 'Hacker News',
      'naukri': 'Naukri.com'
    };
    
    return sourceMap[source.toLowerCase()] || 'External Job Board';
  };

  const getJobSourceName = () => {
    if (!job.ExternalJobID) return 'Job Board';
    return getJobSourceInfo();
  };

  const parseJobTags = () => {
    if (!job.Tags) return [];
    
    // Job source identifiers that should NOT be shown as skills
    const sourcePatterns = [
      /^Adzuna/i,           // Adzuna_IN, Adzuna_US, etc.
      /^RemoteOK/i,         // RemoteOK
      /^WeWorkRemotely/i,   // WeWorkRemotely
      /^HackerNews/i,       // HackerNews
      /^LinkedIn/i,         // LinkedIn
      /^Indeed/i,           // Indeed
      /^Glassdoor/i,        // Glassdoor
    ];
    
    // Job types and workplace types to filter out
    const nonSkillTags = ['Full-time', 'Part-time', 'Contract', 'Remote', 'Onsite', 'Hybrid', 'Internship', 'Freelance', 'Temporary'];
    
    // Split by comma and clean up tags
    return job.Tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .filter(tag => !nonSkillTags.includes(tag))
      .filter(tag => !sourcePatterns.some(pattern => pattern.test(tag)))
      .slice(0, 10); // Limit to 10 tags
  };

  // Clean up truncated descriptions - if ends with "..." cut back to last full stop
  const cleanDescription = (description) => {
    if (!description) return '';
    
    let cleaned = description.trim();
    
    // Check if description ends with truncation indicators
    if (cleaned.endsWith('...') || cleaned.endsWith('…') || cleaned.endsWith('a...') || cleaned.endsWith('a…')) {
      // Remove the truncation marker
      cleaned = cleaned.replace(/\.{3}$|…$/, '').trim();
      
      // Find the last full stop (sentence end)
      const lastPeriod = cleaned.lastIndexOf('.');
      const lastExclamation = cleaned.lastIndexOf('!');
      const lastQuestion = cleaned.lastIndexOf('?');
      
      // Get the position of the last sentence-ending punctuation
      const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
      
      if (lastSentenceEnd > 0) {
        // Cut at the last complete sentence
        cleaned = cleaned.substring(0, lastSentenceEnd + 1);
      }
    }
    
    return cleaned;
  };

  const openExternalApplication = () => {
    if (!job.ApplicationURL) return;
    
    // For React Native, you'd use Linking.openURL
    // For web, we can use window.open
    if (Platform.OS === 'web') {
      window.open(job.ApplicationURL, '_blank');
    } else {
      // For mobile
      import('react-native').then(({ Linking }) => {
        Linking.openURL(job.ApplicationURL);
      });
    }
  };

  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  const Section = ({ title, content, list = null }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {content && <Text style={styles.sectionContent}>{content}</Text>}
      {list && list.map((item, index) => (
        <View key={index} style={styles.listItem}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );

  // Custom renderer for list items to add bullet points
  const customRenderers = {
    li: ({ TDefaultRenderer, ...props }) => {
      return (
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Text style={{ 
            fontSize: typography.sizes.md, 
            color: colors.text,
            marginRight: 8,
            lineHeight: 22,
          }}>
            •
          </Text>
          <View style={{ flex: 1 }}>
            <TDefaultRenderer {...props} />
          </View>
        </View>
      );
    },
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading job details...</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.danger} />
        <Text style={styles.errorTitle}>Job Not Found</Text>
        <Text style={styles.errorText}>The job you're looking for could not be found.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Parse lists from text fields
  const requirementsList = job.Requirements 
    ? job.Requirements.split('\n').filter(req => req.trim().length > 0)
    : [];
  const benefitsList = job.BenefitsOffered 
    ? job.BenefitsOffered.split('\n').filter(benefit => benefit.trim().length > 0)
    : [];
  const responsibilitiesList = job.Responsibilities 
    ? job.Responsibilities.split('\n').filter(resp => resp.trim().length > 0)
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubScreenHeader
        title="Job Details"
        fallbackTab="Jobs"
        rightContent={(!hasApplied && !isEmployer) ? (
          <TouchableOpacity onPress={handleSaveJob} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={24} color={isSaved ? colors.primary : colors.text} />
          </TouchableOpacity>
        ) : null}
      />
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <ResponsiveContainer style={styles.contentWrapper}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.companyHeader}>
          {/* 🏢 Company Logo and Details */}
          <View style={styles.companyInfo}>
            <TouchableOpacity 
              onPress={() => {
                if (job.OrganizationID) {
                  navigation.navigate('OrganizationDetails', { 
                    organizationId: job.OrganizationID 
                  });
                }
              }}
              activeOpacity={0.7}
            >
              {job.OrganizationLogo ? (
                <Image 
                  source={{ uri: job.OrganizationLogo }} 
                  style={styles.companyLogo}
                  onError={() => {}}
                />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="business-outline" size={32} color={colors.textSecondary} />
                </View>
              )}
            </TouchableOpacity>
            
            <View style={styles.companyDetails}>
              <Text style={styles.title}>{job.Title}</Text>
              <TouchableOpacity 
                onPress={() => {
                  if (job.OrganizationID) {
                    navigation.navigate('OrganizationDetails', { 
                      organizationId: job.OrganizationID 
                    });
                  }
                }}
              >
                <Text style={[styles.company, { textDecorationLine: 'underline' }]}>
                  {job.OrganizationName || 'Company Name'}
                </Text>
              </TouchableOpacity>
              
              {/* Company Links Container */}
              <View style={styles.companyLinksContainer}>
                {/* 🌐 Website URL Link */}
                {job.OrganizationWebsite && (
                  <TouchableOpacity 
                    style={styles.websiteButton}
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        window.open(job.OrganizationWebsite, '_blank');
                      } else {
                        import('react-native').then(({ Linking }) => {
                          Linking.openURL(job.OrganizationWebsite);
                        });
                      }
                    }}
                  >
                    <Ionicons name="globe-outline" size={16} color={colors.primary} />
                    <Text style={styles.websiteText}>Visit Website</Text>
                  </TouchableOpacity>
                )}

                {/* 💼 LinkedIn Profile Link */}
                {job.OrganizationLinkedIn && (
                  <TouchableOpacity 
                    style={styles.linkedinButton}
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        window.open(job.OrganizationLinkedIn, '_blank');
                      } else {
                        import('react-native').then(({ Linking }) => {
                          Linking.openURL(job.OrganizationLinkedIn);
                        });
                      }
                    }}
                  >
                    <Ionicons name="logo-linkedin" size={16} color={colors.primary} />
                    <Text style={styles.linkedinText}>LinkedIn Profile</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
        
        {/* Status tags - Experience Required added here */}
        <View style={styles.tagsContainer}>
          <Text style={styles.tag}>{job.JobTypeName || 'Full-time'}</Text>
          {(job.ExperienceMin != null || job.ExperienceMax != null) && (
            <Text style={[styles.tag, styles.experienceTag]}>
              {job.ExperienceMin != null && job.ExperienceMax != null
                ? `${job.ExperienceMin}-${job.ExperienceMax} yrs exp`
                : job.ExperienceMin != null
                  ? `${job.ExperienceMin}+ yrs exp`
                  : `0-${job.ExperienceMax} yrs exp`}
            </Text>
          )}
          {job.IsRemote && (
            <Text style={[styles.tag, styles.remoteTag]}>Remote</Text>
          )}
          <Text style={[styles.tag, styles.statusTag]}>{job.Status || 'Active'}</Text>
        </View>
      </View>

      {/* Quick Info */}
      <View style={styles.infoSection}>
        <InfoRow
          icon="location"
          label="Location"
          value={formatLocation()}
        />
        <InfoRow
          icon="briefcase"
          label="Job Type"
          value={job.JobTypeName || 'Full-time'
          }
        />
        <InfoRow
          icon="time"
          label="Posted"
          value={formatDate(job.PublishedAt || job.CreatedAt)}
        />
        <InfoRow
          icon="calendar"
          label="Application Deadline"
          value={formatDate(job.ApplicationDeadline)}
        />
        {(job.ExperienceMin != null || job.ExperienceMax != null) && (
          <InfoRow
            icon="school"
            label="Experience Required"
            value={`${job.ExperienceMin || 0}-${job.ExperienceMax || '+'} years`}
          />
        )}
        <InfoRow
          icon="cash"
          label="Salary"
          value={formatSalary()}
        />
      </View>

      {/* ✅ NEW: Job Tags Section - Only show if there are valid skills after filtering */}
      {job.Tags && parseJobTags().length > 0 && (
        <View style={styles.jobTagsSection}>
          <Text style={styles.jobTagsSectionTitle}>Skills & Technologies</Text>
          <View style={styles.jobTagsContainer}>
            {parseJobTags().map((tag, index) => (
              <View key={index} style={styles.jobTag}>
                <Text style={styles.jobTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Job Description - FIXED HTML RENDERING */}
      {job.Description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Description</Text>
          <RenderHtml
            contentWidth={width}
            source={{ html: cleanDescription(job.Description) }}
            renderers={customRenderers}
            tagsStyles={{
              body: {
                fontSize: typography.sizes.md,
                color: colors.text,
                lineHeight: 22,
              },
              p: {
                marginBottom: 8,
                fontSize: typography.sizes.md,
                color: colors.text,
                lineHeight: 22,
              },
              h1: {
                fontSize: typography.sizes.xl,
                fontWeight: typography.weights.bold,
                color: colors.text,
                marginBottom: 8,
                marginTop: 4,
              },
              h2: {
                fontSize: typography.sizes.lg,
                fontWeight: typography.weights.bold,
                color: colors.text,
                marginBottom: 6,
                marginTop: 4,
              },
              h3: {
                fontSize: typography.sizes.md,
                fontWeight: typography.weights.bold,
                color: colors.text,
                marginBottom: 6,
                marginTop: 4,
              },
              ul: {
                marginBottom: 8,
                marginTop: 4,
                paddingLeft: 0,
              },
              ol: {
                marginBottom: 8,
                marginTop: 4,
              },
              li: {
                fontSize: typography.sizes.md,
                color: colors.text,
                lineHeight: 22,
              },
              strong: {
                fontWeight: typography.weights.bold,
              },
              em: {
                fontStyle: 'italic',
              },
              a: {
                color: colors.primary,
                textDecorationLine: 'underline',
              },
            }}
            defaultTextProps={{
              selectable: true,
            }}
          />
        </View>
      )}

      {/* Responsibilities */}
      {responsibilitiesList.length > 0 && (
        <Section
          title="Key Responsibilities"
          list={responsibilitiesList}
        />
      )}

      {/* Requirements */}
      {requirementsList.length > 0 && (
        <Section
          title="Requirements"
          list={requirementsList}
        />
      )}

      {/* Preferred Qualifications */}
      {job.PreferredQualifications && (
        <Section
          title="Preferred Qualifications"
          content={job.PreferredQualifications}
        />
      )}

      {/* Benefits */}
      {benefitsList.length > 0 && (
        <Section
          title="Benefits"
          list={benefitsList}
        />
      )}

      {/* Additional Information */}
      {(job.RequiredEducation || job.RequiredCertifications) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Requirements</Text>
          {job.RequiredEducation && (
            <View style={styles.additionalInfo}>
              <Text style={styles.additionalLabel}>Education:</Text>
              <Text style={styles.additionalValue}>{job.RequiredEducation}</Text>
            </View>
          )}
          {job.RequiredCertifications && (
            <View style={styles.additionalInfo}>
              <Text style={styles.additionalLabel}>Certifications:</Text>
              <Text style={styles.additionalValue}>{job.RequiredCertifications}</Text>
            </View>
          )}
        </View>
      )}

      {/* 🆕 MOVED: Referral Message Section - now appears ABOVE action buttons */}
      {/* Show for job seekers OR public users (not logged in), but NOT for own posted jobs */}
      {(isJobSeeker || !user) && !hasReferred && !isOwnPostedJob && (
        <View style={styles.referralMessageSection}>
          {!showReferralMessageInput ? (
            // Collapsed state - just show button to expand
            <TouchableOpacity
              style={styles.addMessageButton}
              onPress={() => setShowReferralMessageInput(true)}
            >
              <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
              <Text style={styles.addMessageButtonText}>Add referral message (optional)</Text>
              <Ionicons name="chevron-down" size={16} color={colors.gray500} />
            </TouchableOpacity>
          ) : (
            // Expanded state - show input and collapse button
            <>
              <View style={styles.messageHeader}>
                <Text style={styles.referralMessageLabel}>Message to Referrer</Text>
                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => {
                    setShowReferralMessageInput(false);
                    setReferralMessage(''); // Clear message when collapsed
                  }}
                >
                  <Ionicons name="chevron-up" size={16} color={colors.gray500} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.referralMessageInput}
                placeholder="Tell referrer what makes you the ideal fit..."
                value={referralMessage}
                onChangeText={setReferralMessage}
                multiline
                numberOfLines={4}
                maxLength={1000}
                textAlignVertical="top"
              />
              <View style={styles.messageFooter}>
                <Text style={styles.referralMessageHint}>
                  (max 1000 characters)
                </Text>
                <Text style={styles.characterCount}>
                  {referralMessage.length}/1000
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* 🆕 NEW: Cover Letter Section - appears before action buttons */}
      {/* Show for job seekers OR public users (not logged in), but hide for referrer-posted jobs */}
      {(isJobSeeker || !user) && !hasApplied && !isReferrerPosted && (
        <View style={styles.coverLetterSection}>
          {!showCoverLetterMessageInput ? (
            // Collapsed state - show button to expand
            <TouchableOpacity
              style={styles.addMessageButton}
              onPress={() => setShowCoverLetterMessageInput(true)}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <Text style={styles.addMessageButtonText}>
                {coverLetter ? 'Edit cover letter' : 'Add cover letter (optional)'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.gray500} />
            </TouchableOpacity>
          ) : (
            // Expanded state - show input and collapse button
            <>
              <View style={styles.messageHeader}>
                <Text style={styles.referralMessageLabel}>Cover Letter</Text>
                <TouchableOpacity
                  style={styles.collapseButton}
                  onPress={() => setShowCoverLetterMessageInput(false)}
                >
                  <Ionicons name="chevron-up" size={16} color={colors.gray500} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.coverLetterInput}
                placeholder="Tell job poster what makes you the ideal fit..."
                value={coverLetter}
                onChangeText={setCoverLetter}
                multiline
                numberOfLines={8}
                maxLength={2000}
                textAlignVertical="top"
              />
              <View style={styles.messageFooter}>
                <Text style={styles.referralMessageHint}>
                  Personalize to highlight relevant achievements
                </Text>
                <Text style={styles.characterCount}>
                  {coverLetter.length}/2000
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Action Buttons - REMOVED Save Job button since it's in the header */}
      {/* Hide buttons when navigating from ReferralScreen "Requests To Me" tab OR when job is archived */}
      {!fromReferralRequest && !job.IsArchived && (
        <View style={styles.actionContainer}>        
          {/* Show Ask Referral for job seekers OR public users, but NOT if they posted this job */}
          {(isJobSeeker || !user) && !isOwnPostedJob && (
            <TouchableOpacity 
              style={[
                styles.referralButton,
                hasReferred && styles.referralButtonReferred,
                referralRequesting && styles.referralButtonDisabled
              ]}
              onPress={(hasReferred || referralRequesting) ? null : handleAskReferral}
              disabled={hasReferred || referralRequesting}
            >
              <Ionicons 
                name={hasReferred ? "checkmark-circle" : referralRequesting ? "time-outline" : "people-outline"} 
                size={hasReferred ? 24 : 20} 
                color={hasReferred ? "#10b981" : referralRequesting ? colors.warning : colors.warning} 
              />
              {!hasReferred && (
                <Text style={[
                  styles.referralButtonText, 
                  referralRequesting && { color: colors.warning }
                ]}>
                  {referralRequesting ? 'Requesting' : "Ask Referral"}
                </Text>
              )}
            </TouchableOpacity>
          )}
          
          {/* Apply button - hide for referrer-posted jobs (they should use Ask Referral instead) */}
          {/* Show for job seekers OR public users */}
          {(isJobSeeker || !user) && !isReferrerPosted && (
            <TouchableOpacity 
              style={[

                styles.applyButton, 
                (hasApplied || applying) && styles.applyButtonDisabled
              ]} 
              onPress={handleApply}
              disabled={hasApplied || applying}
            >
              {applying && <ActivityIndicator size="small" color={colors.white} />}
              <Text style={styles.applyButtonText}>
                {applying ? 'Applying...' : hasApplied ? 'Applied' : 'Apply Now'}
              </Text>
            </TouchableOpacity>
          )}
        
          {/* ✅ NEW: Publish button for employers viewing draft jobs */}
          {isEmployer && job.Status === 'Draft' && (
            <TouchableOpacity
              style={[

                styles.publishButton,
                publishing && styles.publishButtonDisabled
              ]}
              onPress={handlePublishJob}
              disabled={publishing}
            >
              {publishing ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={20} color={colors.white} />
              )}
              <Text style={styles.publishButtonText}>
                {publishing ? 'Publishing...' : pricing.jobPublishCost > 0 ? `Publish Job (₹${pricing.jobPublishCost})` : 'Publish Job (Free)'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Show archived job notice */}
      {job.IsArchived && (
        <View style={styles.archivedNotice}>
          <Ionicons name="archive-outline" size={24} color={colors.gray600} />
          <Text style={styles.archivedNoticeText}>This job has been archived and is no longer accepting applications</Text>
        </View>
      )}
      
      {/* Resume Upload Modal */}
      <ResumeUploadModal
        visible={showResumeModal}
        onClose={() => { setShowResumeModal(false); setReferralMode(false); }}
        onResumeSelected={handleResumeSelected}
        user={user}
        jobTitle={job?.Title}
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
        itemName={job?.Title || 'this job'}
        onProceed={handleReferralConfirmProceed}
        onAddMoney={() => {
          setShowReferralConfirmModal(false);
          navigation.navigate('WalletRecharge');
        }}
        onCancel={() => setShowReferralConfirmModal(false)}
      />

      {/* Publish Confirmation Modal */}
      <ConfirmPurchaseModal
        visible={showPublishConfirmModal}
        currentBalance={publishConfirmData.currentBalance}
        requiredAmount={publishConfirmData.requiredAmount}
        contextType="publish-job"
        itemName={job?.Title || 'this job'}
        onProceed={handlePublishConfirmProceed}
        onCancel={() => setShowPublishConfirmModal(false)}
        onAddMoney={() => {
          setShowPublishConfirmModal(false);
          setWalletModalData({ 
            currentBalance: publishConfirmData.currentBalance, 
            requiredAmount: publishConfirmData.requiredAmount 
          });
          setShowWalletModal(true);
        }}
      />

      {/* 🎉 Referral Success Overlay */}
      <ReferralSuccessOverlay
        visible={showReferralSuccessOverlay}
        onComplete={() => {
          setShowReferralSuccessOverlay(false);
          // ✅ Now mark as referred after overlay closes
          if (pendingReferralSuccess) {
            setHasReferred(true);
            setPendingReferralSuccess(false);
          }
        }}
        duration={3500}
        companyName={referralCompanyName}
        broadcastTime={referralBroadcastTime}
      />
      </ResponsiveContainer>
    </ScrollView>
    </View>
  );
}

const createStyles = (colors, responsive = {}) => {
  const { isMobile = true, isDesktop = false, isTablet = false, contentWidth = 400 } = responsive;
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: isDesktop ? 'center' : 'stretch',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: isDesktop ? 900 : '100%',
    paddingHorizontal: isMobile ? 0 : 24,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: colors.background,
  },
  errorTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  header: {
    padding: isMobile ? 20 : 32,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...(isDesktop && {
      borderRadius: 12,
      marginTop: 16,
      marginHorizontal: 0,
      borderWidth: 1,
    }),
  },
  companyHeader: {
    marginBottom: 16,
  },
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  companyLogo: {
    width: isMobile ? 60 : 80,
    height: isMobile ? 60 : 80,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    marginRight: 16,
  },
  logoPlaceholder: {
    width: isMobile ? 60 : 80,
    height: isMobile ? 60 : 80,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  companyDetails: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  company: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  companyLinksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  websiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  websiteText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    marginLeft: 6,
  },
  linkedinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.primary + '10',
    borderRadius: 16,
  },
  linkedinText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
    marginLeft: 6,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  experienceTag: {
    color: colors.success,
    backgroundColor: colors.success + '20',
  },
  remoteTag: {
    color: colors.warning,
    backgroundColor: colors.warning + '20',
  },
  statusTag: {
    color: colors.textSecondary,
    backgroundColor: colors.gray100,
  },
  infoSection: {
    padding: 20,
    backgroundColor: colors.surface,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  section: {
    padding: isMobile ? 20 : 32,
    backgroundColor: colors.surface,
    marginTop: 8,
    ...(isDesktop && {
      borderRadius: 12,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.border,
    }),
  },
  sectionTitle: {
    fontSize: isDesktop ? typography.sizes.xl : typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 16,
  },
  sectionContent: {
    fontSize: typography.sizes.md,
    color: colors.text,
    lineHeight: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  listText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  additionalInfo: {
    marginBottom: 12,
  },
  additionalLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  additionalValue: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  applyButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  applyButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  referralButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.warning + '15'
  },
  referralButtonText: {
    color: colors.warning,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginLeft: 8,
  },
  referralButtonDisabled: {
    opacity: 0.7,
    backgroundColor: colors.gray100,
    borderColor: colors.gray300,
  },
  referralButtonReferred: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981',
    paddingHorizontal: 12,
    minWidth: 44,
  },
  headerButton: {
    padding: 8,
  },
  referralMessageSection: {
    margin: 20,
    marginBottom: 8,
  },
  addMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addMessageButtonText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.primary,
    marginLeft: 12,
    fontWeight: typography.weights.medium,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  collapseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.gray100,
  },
  referralMessageLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  referralMessageInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: typography.sizes.md,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 120,
    maxHeight: 160,
    textAlignVertical: 'top',
  },
  coverLetterSection: {
    margin: 20,
    marginTop: 0,
    marginBottom: 8,
  },
  coverLetterInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: typography.sizes.md,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 160,
    maxHeight: 260,
    textAlignVertical: 'top',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  referralMessageHint: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    flex: 1,
  },
  characterCount: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  jobTagsSection: {
    padding: 20,
    backgroundColor: colors.surface,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  jobTagsSectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 12,
  },
  jobTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  jobTag: {
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  jobTagText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  publishButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
  },
  publishButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  publishButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginLeft: 8,
  },
  archivedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.gray100,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  archivedNoticeText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
});
};