import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TextInput,
  Modal,
  Animated,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import refopenAPI from '../../services/api';
import { getReferralCostForJob } from '../../utils/pricingUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import CachedImage from '../../components/CachedImage';
import ScreenWrapper from '../../components/ScreenWrapper';
import { invalidateCache, CACHE_KEYS } from '../../utils/homeCache';
import { usePricing } from '../../contexts/PricingContext';
import { typography } from '../../styles/theme';
import ResumeUploadModal from '../../components/ResumeUploadModal';
import WalletRechargeModal from '../../components/WalletRechargeModal';
import ConfirmPurchaseModal from '../../components/ConfirmPurchaseModal';
import ReferralSuccessOverlay from '../../components/ReferralSuccessOverlay';
import { showToast } from '../../components/Toast';
import { useCustomAlert } from '../../components/CustomAlert';
import useResponsive from '../../hooks/useResponsive';
import { ResponsiveContainer } from '../../components/common/ResponsiveLayout';

export default function JobDetailsScreen({ route, navigation, hideHeader = false }) {
const { jobId, fromReferralRequest } = route.params || {};
  const { user, isJobSeeker, isEmployer } = useAuth();
  const { colors } = useTheme();
  const { pricing } = usePricing(); // 💰 DB-driven pricing
  const responsive = useResponsive();
  const { isMobile, isDesktop, isTablet, contentWidth } = responsive;
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const { showConfirm } = useCustomAlert();
  const { width } = useWindowDimensions();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  
  // Sticky header scroll tracking
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const headerCardHeight = useRef(0);
  const handleScroll = useCallback((event) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const shouldShow = scrollY > (headerCardHeight.current || 200);
    setShowStickyHeader(shouldShow);
  }, []);
  const handleHeaderLayout = useCallback((event) => {
    headerCardHeight.current = event.nativeEvent.layout.height;
  }, []);

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
  const [showReferralMessageModal, setShowReferralMessageModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [coverLetterError, setCoverLetterError] = useState('');
  const [showCoverLetterModal, setShowCoverLetterModal] = useState(false);
  const [referralRequesting, setReferralRequesting] = useState(false);
  
  // 💎 NEW: Beautiful wallet modal state
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalData, setWalletModalData] = useState({ currentBalance: 0, requiredAmount: pricing.referralRequestCost });
  
  // 💎 NEW: Referral confirmation modal state
  const [showReferralConfirmModal, setShowReferralConfirmModal] = useState(false);
  const [referralConfirmData, setReferralConfirmData] = useState({ currentBalance: 0, requiredAmount: pricing.referralRequestCost });

  // 💰 Tier-based referral cost (updates when job loads)
  const tierCost = job ? getReferralCostForJob(job, pricing) : pricing.referralRequestCost;

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
        const profile = await refopenAPI.getApplicantProfile(user.UserID || user.userId || user.id || user.sub);
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
        const hasReferred = referralRes.data.requests.some(r => r.JobID === jobId && !['Cancelled', 'Expired', 'Refunded'].includes(r.Status));
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
      showToast('Already requested a referral for this job', 'info');
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
          requiredAmount: tierCost,
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
        const already = existing.data.requests.some(r => r.JobID === jobId && !['Cancelled', 'Expired', 'Refunded'].includes(r.Status));
        if (already) {
          showToast('Already requested a referral for this job', 'info');
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
          
          const amountHeld = res.data?.amountHeld || res.data?.amountDeducted || tierCost;
          const availableBalance = res.data?.availableBalanceAfter;
          
          let message = 'Referral request sent! Amount held until referral is completed.';
          if (availableBalance !== undefined) {
            message = `Referral request sent! ₹${amountHeld} held. Available: ₹${availableBalance.toFixed(2)}`;
          }
          
          showToast(message, 'success');
          setReferralMessage('');
          
          // 🔧 FIXED: Set the resume directly so next referral doesn't ask for upload
          setPrimaryResume(resumeData);
          await loadPrimaryResume();
        } else {
          // Handle insufficient balance error
          if (res.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
            const currentBalance = res.data?.currentBalance || 0;
            const requiredAmount = res.data?.requiredAmount || tierCost;
            
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
        invalidateCache(CACHE_KEYS.RECENT_APPLICATIONS, CACHE_KEYS.DASHBOARD_STATS, CACHE_KEYS.JOBS_LIST);
        setTimeout(() => {
          navigation.navigate('Jobs', { 
            activeTab: 'openings', 
            successMessage: `Application submitted for ${job.Title}`,
            appliedJobId: jobId // 🔧 NEW: Pass jobId so JobsScreen can remove it from list
          });
        }, 1500); // Small delay to show toast
        
      } else {
        if (result.error?.includes('No resume found')) {
          showConfirm({
            title: 'Resume Required',
            message: 'A resume is required to apply for jobs. Please upload one and try again.',
            icon: 'document-text-outline',
            confirmText: 'Upload Resume',
            onConfirm: () => setShowResumeModal(true),
          });
        } else {
          showToast('Failed to submit application. Please try again.', 'error');
        }
      }
    } catch (error) {
      console.error('Application error:', error);
      
      if (error.message?.includes('No resume found')) {
        showConfirm({
          title: 'Resume Required',
          message: 'A resume is required to apply for jobs. Please upload one and try again.',
          icon: 'document-text-outline',
          confirmText: 'Upload Resume',
          onConfirm: () => setShowResumeModal(true),
        });
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
        invalidateCache(CACHE_KEYS.RECENT_APPLICATIONS, CACHE_KEYS.DASHBOARD_STATS, CACHE_KEYS.JOBS_LIST);
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
        invalidateCache(CACHE_KEYS.REFERRER_REQUESTS, CACHE_KEYS.WALLET_BALANCE, CACHE_KEYS.DASHBOARD_STATS);
        setPendingReferralSuccess(true);
        
        // 🎉 Show fullscreen success overlay for 1 second
        setReferralCompanyName(job?.OrganizationName || '');
        setReferralBroadcastTime(broadcastTime);
        setShowReferralSuccessOverlay(true);
        
        const amountHeld = res.data?.amountHeld || res.data?.amountDeducted || tierCost;
        const availableBalance = res.data?.availableBalanceAfter;
        
        let message = 'Referral sent! You\'ll only be charged when someone refers you.';
        if (availableBalance !== undefined) {
          message += `\n\n₹${amountHeld} held (not charged yet).\nAvailable: ₹${availableBalance.toFixed(2)}`;
        }
        
        showToast(message, 'success');
        setReferralMessage('');
      } else {
        // Handle insufficient balance error
        if (res.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
          const currentBalance = res.data?.currentBalance || 0;
          const requiredAmount = res.data?.requiredAmount || tierCost;
          
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
      navigation.navigate('Auth');
      return;
    }

    try {
      if (isSaved) {
        // Unsave the job
        const result = await refopenAPI.unsaveJob(jobId);
        if (result.success) {
          setIsSaved(false);
          showToast('Job removed from saved', 'success');
          invalidateCache(CACHE_KEYS.JOBS_SAVED_IDS);
        } else {
          showToast('Failed to remove job from saved', 'error');
        }
      } else {
        // Save the job
        const result = await refopenAPI.saveJob(jobId);
        if (result.success) {
          setIsSaved(true);
          showToast('Job saved successfully', 'success');
          invalidateCache(CACHE_KEYS.JOBS_SAVED_IDS);
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
        invalidateCache(CACHE_KEYS.DASHBOARD_STATS, CACHE_KEYS.JOBS_LIST, CACHE_KEYS.RECENT_JOBS);
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
    // Prefer Location field (has city+area from scraper), fallback to City/State/Country
    let location = job.Location;
    if (!location) {
      const locationParts = [];
      if (job.City) locationParts.push(job.City);
      if (job.State) locationParts.push(job.State);
      if (job.Country) locationParts.push(job.Country);
      location = locationParts.join(', ') || 'Location not specified';
    }
    
    if (job.IsRemote) {
      location += ' (Remote)';
    } else if (job.WorkplaceType) {
      location += ` (${job.WorkplaceType})`;
    }
    
    return location;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    const d = new Date(dateString);
    const now = new Date();
    const h = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    if (h < 1) return 'Just posted';
    if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    const w = Math.floor(days / 7);
    if (w < 4) return `${w} ${w === 1 ? 'week' : 'weeks'} ago`;
    const m = Math.floor(days / 30);
    if (m < 12) return `${m} ${m === 1 ? 'month' : 'months'} ago`;
    return d.toLocaleDateString();
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

  // Clean up truncated descriptions and convert markdown to HTML
  const cleanDescription = (description) => {
    if (!description) return '';
    
    let cleaned = description.trim();
    
    // Check if description ends with truncation indicators
    if (cleaned.endsWith('...') || cleaned.endsWith('…') || cleaned.endsWith('a...') || cleaned.endsWith('a…')) {
      cleaned = cleaned.replace(/\.{3}$|…$/, '').trim();
      const lastPeriod = cleaned.lastIndexOf('.');
      const lastExclamation = cleaned.lastIndexOf('!');
      const lastQuestion = cleaned.lastIndexOf('?');
      const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
      if (lastSentenceEnd > 0) {
        cleaned = cleaned.substring(0, lastSentenceEnd + 1);
      }
    }
    
    // If it's already HTML (contains tags), return as-is
    if (/<[a-z][\s\S]*>/i.test(cleaned)) return cleaned;
    
    // Convert markdown-style text to HTML
    // **bold** → <strong>bold</strong>
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Convert bullet points: • text → <li>text</li>
    // Split by bullet markers and wrap in list
    const bulletPattern = /(?:^|\s)(?:•|▪|▸|►|→|‣|-)\s*/;
    if (bulletPattern.test(cleaned)) {
      const parts = cleaned.split(/(?:•|▪|▸|►|→|‣)\s*/);
      const intro = parts[0]?.trim();
      const bullets = parts.slice(1).filter(b => b.trim());
      
      if (bullets.length > 0) {
        cleaned = (intro ? `<p>${intro}</p>` : '') + 
          '<ul>' + bullets.map(b => `<li>${b.trim()}</li>`).join('') + '</ul>';
      }
    }
    
    // Convert newlines to <br> if no HTML structure was added
    if (!cleaned.includes('<ul>') && !cleaned.includes('<p>')) {
      cleaned = cleaned.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>');
      cleaned = `<p>${cleaned}</p>`;
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
    <ScreenWrapper withKeyboard={!hideHeader}>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {!hideHeader && (
        <SubScreenHeader
          title="Job Details"
          fallbackTab="Jobs"
          rightContent={(!hasApplied && !isEmployer) ? (
            <TouchableOpacity onPress={handleSaveJob} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={24} color={isSaved ? colors.primary : colors.text} />
            </TouchableOpacity>
          ) : null}
        />
      )}

      {/* Sticky Header Bar — appears when scrolling past header card */}
      {showStickyHeader && (
        <View style={styles.stickyHeader}>
          <ResponsiveContainer style={styles.stickyHeaderInner}>
            <View style={styles.stickyHeaderLeft}>
              <Text style={styles.stickyHeaderTitle} numberOfLines={1}>{job?.Title}</Text>
              <Text style={styles.stickyHeaderSub} numberOfLines={1}>
                {job?.OrganizationName}{formatLocation() !== 'Location not specified' ? ` · ${formatLocation()}` : ''}
              </Text>
            </View>
            <View style={styles.stickyHeaderActions}>
              {!fromReferralRequest && !job?.IsArchived && (
                <>
                  {(isJobSeeker || !user) && !isOwnPostedJob && (
                    <TouchableOpacity
                      style={[styles.stickyApplyBtn, hasReferred && { backgroundColor: colors.success }, (referralRequesting) && styles.stickyApplyBtnDisabled]}
                      onPress={(hasReferred || referralRequesting) ? null : () => setShowReferralMessageModal(true)}
                      disabled={hasReferred || referralRequesting}
                    >
                      {referralRequesting ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Ionicons name={hasReferred ? 'checkmark-circle' : 'people-outline'} size={16} color={colors.white} />
                      )}
                      <Text style={styles.stickyApplyBtnText}>
                        {referralRequesting ? 'Requesting...' : hasReferred ? 'Requested' : 'Ask Referral'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {!hasApplied && !isEmployer && (
                    <TouchableOpacity
                      style={styles.stickySaveBtn}
                      onPress={handleSaveJob}
                    >
                      <Text style={styles.stickySaveBtnText}>{isSaved ? 'Saved' : 'Save'}</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </ResponsiveContainer>
        </View>
      )}

    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      onScroll={handleScroll}
      scrollEventThrottle={16}
    >
      <ResponsiveContainer style={styles.contentWrapper}>
      {/* Header */}
      <View style={styles.header} onLayout={handleHeaderLayout}>
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
                <CachedImage 
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                
                {/* Inline icon links */}
                {job.OrganizationWebsite && (
                  <TouchableOpacity 
                    onPress={() => { if (Platform.OS === 'web') window.open(job.OrganizationWebsite, '_blank'); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="globe-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
                {job.OrganizationLinkedIn && (
                  <TouchableOpacity 
                    onPress={() => { if (Platform.OS === 'web') window.open(job.OrganizationLinkedIn, '_blank'); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="logo-linkedin" size={16} color="#0A66C2" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Location + Posted ago — inline like LinkedIn */}
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                {formatLocation()}
                {(job.PublishedAt || job.CreatedAt) ? ` · ${formatDate(job.PublishedAt || job.CreatedAt)}` : ''}
                {job.ApplicationDeadline ? ` · Deadline: ${formatDate(job.ApplicationDeadline)}` : ''}
              </Text>
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
        </View>

        {/* Action Buttons — LinkedIn style */}
        {!fromReferralRequest && !job.IsArchived && (
          <View style={styles.headerActions}>
            {/* Primary: Ask Referral — filled blue */}
            {(isJobSeeker || !user) && !isOwnPostedJob && (
              <TouchableOpacity 
                style={[
                  styles.btnApply,
                  hasReferred && { backgroundColor: colors.success },
                  referralRequesting && styles.btnApplyDisabled
                ]}
                onPress={(hasReferred || referralRequesting) ? null : () => setShowReferralMessageModal(true)}
                disabled={hasReferred || referralRequesting}
              >
                {referralRequesting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons 
                    name={hasReferred ? 'checkmark-circle' : 'people-outline'} 
                    size={16} 
                    color={colors.white} 
                  />
                )}
                <Text style={styles.btnApplyText}>
                  {referralRequesting ? 'Requesting...' : hasReferred ? 'Requested' : 'Ask Referral'}
                </Text>
              </TouchableOpacity>
            )}
            {/* Apply — outlined with icon */}
            {(isJobSeeker || !user) && !isReferrerPosted && (
              <TouchableOpacity 
                style={[
                  styles.btnOutlined,
                  hasApplied && styles.btnOutlinedSuccess,
                  applying && styles.btnOutlinedDisabled
                ]} 
                onPress={(hasApplied || applying) ? null : () => setShowCoverLetterModal(true)}
                disabled={hasApplied || applying}
              >
                {applying ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons 
                    name={hasApplied ? 'checkmark-circle' : 'paper-plane-outline'} 
                    size={16} 
                    color={hasApplied ? colors.success : colors.text} 
                  />
                )}
                <Text style={[
                  styles.btnOutlinedText,
                  hasApplied && { color: colors.success },
                  applying && { color: colors.gray400 }
                ]}>
                  {applying ? 'Applying...' : hasApplied ? 'Applied' : 'Apply'}
                </Text>
              </TouchableOpacity>
            )}
            {/* Save — outlined */}
            {!hasApplied && !isEmployer && (
              <TouchableOpacity
                style={[styles.btnOutlined, isSaved && styles.btnOutlinedActive]}
                onPress={handleSaveJob}
              >
                <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={16} color={isSaved ? colors.primary : colors.text} />
                <Text style={[styles.btnOutlinedText, isSaved && { color: colors.primary }]}>
                  {isSaved ? 'Saved' : 'Save'}
                </Text>
              </TouchableOpacity>
            )}
            {/* Publish button for employers */}
            {isEmployer && job.Status === 'Draft' && (
              <TouchableOpacity
                style={[styles.btnApply, { backgroundColor: colors.success }, publishing && styles.btnApplyDisabled]}
                onPress={handlePublishJob}
                disabled={publishing}
              >
                {publishing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={16} color={colors.white} />
                )}
                <Text style={styles.btnApplyText}>
                  {publishing ? 'Publishing...' : pricing.jobPublishCost > 0 ? `Publish (₹${pricing.jobPublishCost})` : 'Publish (Free)'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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

      {/* About Company — only show for F500 companies with description */}
      {job.OrganizationIsFortune500 && job.OrganizationDescription && job.OrganizationDescription.length > 20 && (
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text style={styles.sectionTitle}>About {job.OrganizationName || 'Company'}</Text>
          </View>
          {job.OrganizationIndustry && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <Ionicons name="business-outline" size={13} color={colors.textSecondary} />
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{job.OrganizationIndustry}</Text>
            </View>
          )}
          <Text style={{ fontSize: 13, color: colors.text, lineHeight: 20 }}>
            {job.OrganizationDescription}
          </Text>
        </View>
      )}


      
      {/* Show archived job notice */}
      {job.IsArchived && (
        <View style={styles.archivedNotice}>
          <Ionicons name="archive-outline" size={24} color={colors.gray600} />
          <Text style={styles.archivedNoticeText}>This job has been archived and is no longer accepting applications</Text>
        </View>
      )}
      
      {/* Referral Message Modal */}
      <Modal
        visible={showReferralMessageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReferralMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Message to Referrer</Text>
              <TouchableOpacity onPress={() => setShowReferralMessageModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Add a personal note to increase your chances (optional)
            </Text>
            <TextInput
              style={[styles.modalTextInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Tell the referrer what makes you the ideal fit..."
              placeholderTextColor={colors.textSecondary}
              value={referralMessage}
              onChangeText={setReferralMessage}
              multiline
              numberOfLines={5}
              maxLength={1000}
              textAlignVertical="top"
            />
            <Text style={[styles.modalCharCount, { color: colors.textSecondary }]}>
              {referralMessage.length}/1000
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { borderColor: colors.border }]}
                onPress={() => setShowReferralMessageModal(false)}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowReferralMessageModal(false);
                  handleAskReferral();
                }}
              >
                <Ionicons name="people-outline" size={18} color={colors.white} />
                <Text style={styles.modalPrimaryBtnText}>Ask Referral</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cover Letter Modal */}
      <Modal
        visible={showCoverLetterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCoverLetterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Cover Letter</Text>
              <TouchableOpacity onPress={() => setShowCoverLetterModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Personalize your application to stand out (optional)
            </Text>
            <TextInput
              style={[styles.modalTextInput, { color: colors.text, borderColor: coverLetterError ? colors.error : colors.border, backgroundColor: colors.background, minHeight: 160 }]}
              placeholder="Highlight your relevant skills and achievements..."
              placeholderTextColor={colors.textSecondary}
              value={coverLetter}
              onChangeText={(text) => { setCoverLetter(text); setCoverLetterError(''); }}
              multiline
              numberOfLines={8}
              maxLength={2000}
              textAlignVertical="top"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              {coverLetterError ? (
                <Text style={{ fontSize: 12, color: colors.error, flex: 1 }}>{coverLetterError}</Text>
              ) : (
                <Text style={[styles.modalCharCount, { color: colors.textSecondary }]}>
                  {coverLetter.length > 0 && coverLetter.length < 20 ? `${20 - coverLetter.length} more chars needed` : 'Min 20 chars if provided'}
                </Text>
              )}
              <Text style={[styles.modalCharCount, { color: colors.textSecondary }]}>
                {coverLetter.length}/2000
              </Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { borderColor: colors.border }]}
                onPress={() => setShowCoverLetterModal(false)}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  const trimmed = coverLetter.trim();
                  if (trimmed.length > 0 && trimmed.length < 20) {
                    setCoverLetterError('Cover letter must be at least 20 characters. Leave empty to skip.');
                    return;
                  }
                  setShowCoverLetterModal(false);
                  handleApply();
                }}
              >
                <Ionicons name="paper-plane-outline" size={18} color={colors.white} />
                <Text style={styles.modalPrimaryBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    </ScreenWrapper>
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
  // Sticky header bar
  stickyHeader: {
    position: Platform.OS === 'web' ? 'sticky' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: isMobile ? 16 : 24,
  },
  stickyHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: isDesktop ? 900 : '100%',
    width: '100%',
    alignSelf: 'center',
  },
  stickyHeaderLeft: {
    flex: 1,
    marginRight: 16,
  },
  stickyHeaderTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  stickyHeaderSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stickyHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stickyApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  stickyApplyBtnDisabled: {
    backgroundColor: colors.gray300,
  },
  stickyApplyBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  stickySaveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stickySaveBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  // Header card
  header: {
    padding: isMobile ? 20 : 24,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  btnApply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    minWidth: 90,
    justifyContent: 'center',
  },
  btnApplyDisabled: {
    backgroundColor: colors.gray300,
  },
  btnApplyText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  btnOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    minWidth: 80,
    justifyContent: 'center',
  },
  btnOutlinedText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  btnOutlinedSuccess: {
    borderColor: colors.success,
    backgroundColor: colors.success + '10',
  },
  btnOutlinedDisabled: {
    borderColor: colors.gray300,
    backgroundColor: colors.gray100,
  },
  btnOutlinedActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
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
    padding: isMobile ? 20 : 24,
    backgroundColor: colors.surface,
    marginTop: 8,
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
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  applyButtonDisabled: {
    backgroundColor: colors.gray300,
    borderColor: colors.gray300,
  },
  applyButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  referralButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 0,
    backgroundColor: colors.primary,
  },
  referralButtonText: {
    color: colors.white,
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
    borderColor: colors.success,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 16,
    padding: 24,
    ...(Platform.OS === 'web' ? { boxShadow: '0 8px 32px rgba(0,0,0,0.2)' } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 32,
      elevation: 10,
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  modalSubtitle: {
    fontSize: typography.sizes.sm,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: typography.sizes.md,
    minHeight: 120,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  modalCharCount: {
    fontSize: typography.sizes.xs,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalSecondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  modalSecondaryBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
};