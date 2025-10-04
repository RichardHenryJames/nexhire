import React, { useState, useEffect, useCallback } from 'react';
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
import nexhireAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography } from '../../styles/theme';
import ResumeUploadModal from '../../components/ResumeUploadModal';
import { showToast } from '../../components/Toast';

export default function JobDetailsScreen({ route, navigation }) {
  const { jobId } = route.params || {};
  const { user, isJobSeeker } = useAuth();
  const { width } = useWindowDimensions();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [referralMode, setReferralMode] = useState(false);
  const [hasReferred, setHasReferred] = useState(false);
  const [referralEligibility, setReferralEligibility] = useState({ isEligible: true, dailyQuotaRemaining: 5, hasActiveSubscription: false, reason: null });
  const [primaryResume, setPrimaryResume] = useState(null);
  const [referralMessage, setReferralMessage] = useState('');
  const [showReferralMessageInput, setShowReferralMessageInput] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [showCoverLetterMessageInput, setShowCoverLetterMessageInput] = useState(false);

  // Initialize default cover letter when job loads (only once)
  useEffect(() => {
    if (job?.Title && !coverLetter) {
      setCoverLetter(`I am very interested in the ${job.Title} position and believe my skills and experience make me a great candidate for this role.`);
    }
  }, [job?.Title]);

  // Helper builder for cover letter
  const buildCoverLetter = useCallback(() => {
    const fallback = job?.Title
      ? `I am very interested in the ${job.Title} position and believe my skills and experience make me a great candidate for this role.`
      : 'I am very interested in this position and believe my skills and experience make me a great candidate.';
    const custom = coverLetter.trim();
    return custom.length ? custom : fallback;
  }, [coverLetter, job?.Title]);

  // Add navigation header with back button
  useEffect(() => {
    navigation.setOptions({
      title: 'Job Details',
      headerStyle: { backgroundColor: colors.surface, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
      headerTitleStyle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text },
      headerLeft: () => (
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity style={styles.headerButton} onPress={handleSaveJob} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={24} color={isSaved ? colors.primary : colors.text} />
        </TouchableOpacity>
      )
    });
  }, [navigation, isSaved]);

  // Load job details and referral status
  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
      loadReferralStatus();
      checkSavedStatus(); // Check if job is saved
    } else {
      setLoading(false);
    }
  }, [jobId]);

  // Load primary resume once
  const loadPrimaryResume = useCallback(async () => {
    if (user && isJobSeeker) {
      try {
        const profile = await nexhireAPI.getApplicantProfile(user.userId || user.id || user.sub || user.UserID);
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
      const result = await nexhireAPI.getJobById(jobId);
      
      if (result.success) {
        setJob(result.data);
        // Check if user has already applied (if authenticated)
        if (user && isJobSeeker) {
          checkApplicationStatus();
        }
      } else {
        Alert.alert('Error', 'Job not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      Alert.alert('Error', 'Failed to load job details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const checkApplicationStatus = async () => {
    try {
      // Check if user has already applied by getting their applications
      const result = await nexhireAPI.getMyApplications(1, 100);
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
      const result = await nexhireAPI.getMySavedJobs(1, 100);
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
      const [referralRes, eligibilityRes] = await Promise.all([
        nexhireAPI.getMyReferralRequests(1, 100),
        nexhireAPI.checkReferralEligibility()
      ]);
      
      if (referralRes?.success && referralRes.data?.requests) {
        const hasReferred = referralRes.data.requests.some(r => r.JobID === jobId);
        setHasReferred(hasReferred);
      }
      
      if (eligibilityRes?.success) {
        setReferralEligibility(eligibilityRes.data);
      }
    } catch (error) {
      console.warn('Failed to load referral status:', error.message);
    }
  };

  const handleApply = async () => {
    console.log('NEW handleApply called - code is updated!');
    
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

    if (hasApplied) {
      Alert.alert('Already Applied', 'You have already applied for this position');
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
    console.log('handleAskReferral called in JobDetailsScreen');
    
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
    
    if (hasReferred) {
      Alert.alert('Already Requested', 'You have already requested a referral for this job', [
        { text: 'View Referrals', onPress: () => navigation.navigate('Referrals') },
        { text: 'OK' }
      ]);
      return;
    }
    
    // REQUIREMENT 3: Check real-time eligibility and show subscription modal
    try {
      console.log('Checking referral eligibility...');
      const freshEligibility = await nexhireAPI.checkReferralEligibility();
      console.log('Eligibility result:', freshEligibility);
      
      if (freshEligibility?.success) {
        const eligibilityData = freshEligibility.data;
        console.log('Eligibility data:', eligibilityData);
        
        if (!eligibilityData.isEligible) {
          console.log('? User not eligible, checking subscription status...');
          // Show upgrade modal whenever daily quota hits zero, even if user already has a plan (prompt higher tier)
          if (eligibilityData.dailyQuotaRemaining === 0) {
            showSubscriptionModal(eligibilityData.reason, eligibilityData.hasActiveSubscription);
            return;
          }
          console.log('? Other eligibility issue:', eligibilityData.reason);
          Alert.alert('Referral Limit Reached', eligibilityData.reason || 'You have reached your daily referral limit');
          return;
        }
        
        console.log('? User is eligible - proceeding with referral');
        setReferralEligibility(eligibilityData);
      }
    } catch (e) {
      console.error('Failed to check referral eligibility:', e);
      Alert.alert('Error', 'Unable to check referral quota. Please try again.');
      return;
    }
    
    // Double-check no existing request
    try {
      const existing = await nexhireAPI.getMyReferralRequests(1, 100);
      if (existing.success && existing.data?.requests) {
        const already = existing.data.requests.some(r => r.JobID === jobId);
        if (already) {
          Alert.alert('Already Requested', 'You have already requested a referral for this job', [
            { text: 'View Referrals', onPress: () => navigation.navigate('Referrals') },
            { text: 'OK' }
          ]);
          return;
        }
      }
    } catch (e) { console.warn('Referral pre-check failed:', e.message); }
    
    if (primaryResume?.ResumeID) {
      await quickReferral(primaryResume.ResumeID);
      return;
    }
    setReferralMode(true); setShowResumeModal(true);
  };

  // REQUIREMENT 3: Improved subscription modal with better logic
  const showSubscriptionModal = useCallback(async (reasonOverride = null, hasActiveSubscription = false) => {
    console.log('showSubscriptionModal called in JobDetailsScreen');
    console.log('Navigation object:', navigation);
    console.log('Available routes:', navigation.getState?.());
    
    // On web, Alert only supports a single OK button (RN Web polyfill). Navigate directly.
    const exhaustedMsg = reasonOverride || `You've used all referral requests allowed in your current plan today.`;
    const body = hasActiveSubscription
      ? `${exhaustedMsg}\n\nUpgrade your plan to increase daily referral limit and continue boosting your job search.`
      : `You've used all 5 free referral requests for today!\n\nUpgrade to continue making referral requests and boost your job search.`;

    if (Platform.OS === 'web') {
      console.log('Web platform detected - navigating directly to ReferralPlans');
      navigation.navigate('ReferralPlans');
      return;
    }
    
    try {
      Alert.alert(
        'Upgrade Required',
        body,
        [
          { 
            text: 'Maybe Later', 
            style: 'cancel',
            onPress: () => console.log('User selected Maybe Later')
          },
          { 
            text: 'View Plans', 
            onPress: () => {
              console.log('User selected View Plans - attempting navigation...');
              try {
                navigation.navigate('ReferralPlans');
                console.log('Navigation successful!');
              } catch (navError) {
                console.error('Navigation error:', navError);
                Alert.alert('Navigation Error', 'Unable to open plans. Please try again.');
              }
            }
          }
        ]
      );
      // Fallback: ensure navigation if user does not pick (defensive � some platforms auto-dismiss custom buttons)
      setTimeout(() => {
        const state = navigation.getState?.();
        const currentRoute = state?.routes?.[state.index]?.name;
        if (currentRoute !== 'ReferralPlans' && referralEligibility.dailyQuotaRemaining === 0) {
          console.log('Fallback navigation to ReferralPlans after Alert timeout');
            try { navigation.navigate('ReferralPlans'); } catch (e) { console.warn('Fallback navigation failed', e); }
        }
      }, 3000);
    } catch (error) {
      console.error('Error showing subscription modal:', error);
      Alert.alert('Error', 'Failed to load subscription options. Please try again later.');
    }
  }, [navigation, referralEligibility]);

  const handlePlanSelection = async (plan) => {
    console.log('Plan selected:', plan);
    
    Alert.alert(
      'Confirm Subscription',
      `Subscribe to ${plan.Name} for $${plan.Price}/month?\n\nThis will give you unlimited referral requests!`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Subscribe Now', 
          onPress: async () => {
            try {
              // For demo - simulate successful purchase
              Alert.alert(
                'Subscription Successful!',
                `Welcome to ${plan.Name}! You now have unlimited referral requests.`,
                [
                  { 
                    text: 'Start Referring!', 
                    onPress: async () => {
                      // Refresh eligibility after "purchase"
                      const eligibilityRes = await nexhireAPI.checkReferralEligibility();
                      if (eligibilityRes?.success) {
                        setReferralEligibility(eligibilityRes.data);
                      }
                    }
                  }
                ]
              );
              
              // TODO: Implement real payment processing
              // const purchaseResult = await nexhireAPI.purchaseReferralPlan(plan.PlanID);
              
            } catch (error) {
              Alert.alert('Purchase Failed', error.message || 'Failed to purchase subscription');
            }
          }
        }
      ]
    );
  };

  // REQUIREMENT 2: Refresh page after resume submission to reload primary resume
  const handleResumeSelected = async (resumeData) => {
    if (referralMode) {
      try {
        // ✅ NEW SCHEMA: Send jobID (internal) with extJobID as null
        const res = await nexhireAPI.createReferralRequest({
          jobID: jobId,  // Internal job ID (UNIQUEIDENTIFIER)
          extJobID: null, // Explicitly null for internal referrals
          resumeID: resumeData.ResumeID,
          referralMessage: referralMessage.trim() || undefined // 🆕 NEW: Include referral message
        });
        if (res.success) {
          setHasReferred(true);
          setReferralEligibility(prev => ({
            ...prev,
            dailyQuotaRemaining: Math.max(0, prev.dailyQuotaRemaining - 1),
            isEligible: prev.dailyQuotaRemaining > 1
          }));
          
          showToast('Referral request sent', 'success');
          // 🆕 NEW: Clear and collapse message section after successful submission
          setReferralMessage('');
          setShowReferralMessageInput(false);
          
          // 🔧 REQUIREMENT 2: Reload primary resume after submission
          await loadPrimaryResume();
        } else {
          Alert.alert('Request Failed', res.error || res.message || 'Failed to send referral request');
        }
      } catch (e) {
        Alert.alert('Error', e.message || 'Failed to send referral request');
      } finally {
        setReferralMode(false);
        setShowResumeModal(false);
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

      const result = await nexhireAPI.applyForJob(applicationData);
      
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
          Alert.alert('Application Failed', result.error || result.message || 'Failed to submit application');
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
        Alert.alert('Error', error.message || 'Failed to submit application');
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
      const res = await nexhireAPI.applyForJob(applicationData);
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
        Alert.alert('Application Failed', res.error || res.message || 'Failed to submit application');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to submit application');
    }
  };

  const quickReferral = async (resumeId) => {
    try {
      // ✅ NEW SCHEMA: Send jobID (internal) with extJobID as null
      const res = await nexhireAPI.createReferralRequest({
        jobID: jobId,  // Internal job ID (UNIQUEIDENTIFIER)
        extJobID: null, // Explicitly null for internal referrals
        resumeID: resumeId,
        referralMessage: referralMessage.trim() || undefined // 🆕 NEW: Include referral message
      });
      if (res?.success) {
        setHasReferred(true);
        setReferralEligibility(prev => ({ ...prev, dailyQuotaRemaining: Math.max(0, prev.dailyQuotaRemaining - 1) }));
        showToast('Referral request sent', 'success');
        // 🆕 NEW: Clear and collapse message section after successful submission
        setReferralMessage('');
        setShowReferralMessageInput(false);
      } else {
        Alert.alert('Request Failed', res.error || res.message || 'Failed to send referral request');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to send referral request');
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
        const result = await nexhireAPI.unsaveJob(jobId);
        if (result.success) {
          setIsSaved(false);
          showToast('Job removed from saved', 'success');
        } else {
          Alert.alert('Error', 'Failed to remove job from saved');
        }
      } else {
        // Save the job
        const result = await nexhireAPI.saveJob(jobId);
        if (result.success) {
          setIsSaved(true);
          showToast('Job saved successfully', 'success');
        } else {
          Alert.alert('Error', 'Failed to save job');
        }
      }
    } catch (error) {
      console.error('Save/Unsave error:', error);
      Alert.alert('Error', error.message || 'Failed to update saved status');
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
    if (!job.ExternalJobID) return 'NexHire';
    
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
    
    // Split by comma and clean up tags
    return job.Tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .filter(tag => !['Full-time', 'Part-time', 'Contract', 'Remote', 'Onsite', 'Hybrid'].includes(tag))
      .slice(0, 10); // Limit to 10 tags
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
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.companyHeader}>
          {/* 🏢 Company Logo and Details */}
          <View style={styles.companyInfo}>
            {job.OrganizationLogo ? (
              <Image 
                source={{ uri: job.OrganizationLogo }} 
                style={styles.companyLogo}
                onError={() => console.log('Company logo load error for:', job.OrganizationName)}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="business-outline" size={32} color="#666" />
              </View>
            )}
            
            <View style={styles.companyDetails}>
              <Text style={styles.title}>{job.Title}</Text>
              <Text style={styles.company}>{job.OrganizationName || 'Company Name'}</Text>
              
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
                    <Ionicons name="globe-outline" size={16} color="#0066cc" />
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
                    <Ionicons name="logo-linkedin" size={16} color="#0066cc" />
                    <Text style={styles.linkedinText}>LinkedIn Profile</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
        
        <Text style={styles.salary}>{formatSalary()}</Text>
        
        {/* Status tags */}
        <View style={styles.tagsContainer}>
          <Text style={styles.tag}>{job.JobTypeName || 'Full-time'}</Text>
          {job.ExperienceLevel && (
            <Text style={[styles.tag, styles.experienceTag]}>{job.ExperienceLevel}</Text>
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
          value={formatDate(job.CreatedAt || job.PublishedAt)}
        />
        <InfoRow
          icon="calendar"
          label="Application Deadline"
          value={formatDate(job.ApplicationDeadline)}
        />
        {job.ExperienceMin || job.ExperienceMax ? (
          <InfoRow
            icon="school"
            label="Experience Required"
            value={`${job.ExperienceMin || 0}-${job.ExperienceMax || '+'} years`}
          />
        ) : null}
        {/* ✅ NEW: Show job source information */}
        {job.ExternalJobID && (
          <InfoRow
            icon="globe-outline"
            label="Job Source"
            value={getJobSourceInfo()}
          />
        )}
      </View>

      {/* ✅ NEW: External Application Section */}
      {job.ApplicationURL && (
        <View style={styles.externalApplicationSection}>
          <View style={styles.externalApplicationHeader}>
            <Ionicons name="link" size={20} color={colors.primary} />
            <Text style={styles.externalApplicationTitle}>
              Apply Directly on {getJobSourceName()}
            </Text>
          </View>
          <Text style={styles.externalApplicationDescription}>
            This job was posted on {getJobSourceName()}. You can apply directly on their platform for the most up-to-date application process.
          </Text>
          <TouchableOpacity
            style={styles.externalApplicationButton}
            onPress={() => openExternalApplication()}
          >
            <Ionicons name="open-outline" size={20} color={colors.white} />
            <Text style={styles.externalApplicationButtonText}>
              Apply on {getJobSourceName()}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ✅ NEW: Job Tags Section */}
      {job.Tags && (
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
            source={{ html: job.Description }}
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
      {isJobSeeker && !hasReferred && (
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
                placeholder="Tell them why you're interested in this role and your background...

Example: 'Hi! I'm a software engineer with 3 years experience in React/Node.js. I'm really excited about this role because it aligns perfectly with my career goals. I'd be grateful for any referral help!'"
                value={referralMessage}
                onChangeText={setReferralMessage}
                multiline
                numberOfLines={4}
                maxLength={1000}
                textAlignVertical="top"
              />
              <View style={styles.messageFooter}>
                <Text style={styles.referralMessageHint}>
                  Help referrers understand your interest and background
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
      {isJobSeeker && !hasApplied && (
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
                placeholder="Write a personalized cover letter to stand out...

Highlight your relevant experience, skills, and why you're excited about this specific role and company."
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
      <View style={styles.actionContainer}>        
        {isJobSeeker && (
          <TouchableOpacity 
            style={[
              styles.referralButton,
              hasReferred && styles.referralButtonDisabled
            ]}
            onPress={hasReferred ? null : handleAskReferral}
            disabled={hasReferred}
          >
            <Ionicons 
              name={hasReferred ? "checkmark-circle" : "people-outline"} 
              size={20} 
              color={hasReferred ? "#10b981" : colors.warning} 
            />
            <Text style={[
              styles.referralButtonText, 
              hasReferred && { color: "#10b981" }
            ]}>
              {hasReferred ? "Referred" : "Ask Referral"}
            </Text>
          </TouchableOpacity>
        )}
        
        {isJobSeeker && (
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
      </View>
      
      {/* Resume Upload Modal */}
      <ResumeUploadModal
        visible={showResumeModal}
        onClose={() => { setShowResumeModal(false); setReferralMode(false); }}
        onResumeSelected={handleResumeSelected}
        user={user}
        jobTitle={job?.Title}
      />
    </ScrollView>
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
    color: colors.gray600,
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
    padding: 20,
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
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    marginRight: 16,
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
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
    backgroundColor: '#e8f4fd',
    borderRadius: 16,
  },
  websiteText: {
    fontSize: typography.sizes.sm,
    color: '#0066cc',
    fontWeight: typography.weights.medium,
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
  salary: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: 12,
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
    color: colors.gray600,
    backgroundColor: colors.gray200,
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
    color: colors.gray600,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  section: {
    padding: 20,
    backgroundColor: colors.surface,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
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
    color: colors.gray600,
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
    flex: 2,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyButtonDisabled: {
    backgroundColor: colors.gray400,
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
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  headerButton: {
    padding: 8,
  },
  // 🆕 MOVED: Referral message styles - updated margin since now above buttons
  referralMessageSection: {
    margin: 20,
    marginBottom: 8, // Reduced margin since action buttons come after this
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
  // 🆕 NEW: Cover letter section styles
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
    color: colors.gray500,
    flex: 1,
  },
  characterCount: {
    fontSize: typography.sizes.sm,
    color: colors.gray400,
    fontWeight: typography.weights.medium,
  },
  // ✅ NEW: External application styles
  externalApplicationSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: 8,
  },
  externalApplicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  externalApplicationTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginLeft: 8,
  },
  externalApplicationDescription: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 12,
  },
  externalApplicationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  externalApplicationButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    marginLeft: 8,
  },
  // ✅ NEW: Job tags styles
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
});