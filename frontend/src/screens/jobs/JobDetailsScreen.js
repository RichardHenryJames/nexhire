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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import nexhireAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography } from '../../styles/theme';
import ResumeUploadModal from '../../components/ResumeUploadModal';
import { showToast } from '../../components/Toast';

export default function JobDetailsScreen({ route, navigation }) {
  const { jobId } = route.params || {};
  const { user, isJobSeeker } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [referralMode, setReferralMode] = useState(false); // NEW
  // ? NEW: Referral tracking state
  const [hasReferred, setHasReferred] = useState(false);
  const [referralEligibility, setReferralEligibility] = useState({
    isEligible: true,
    dailyQuotaRemaining: 5,
    hasActiveSubscription: false,
    reason: null
  });
  const [primaryResume, setPrimaryResume] = useState(null);

  // Load job details and referral status
  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
      // ? NEW: Load referral status
      loadReferralStatus();
    } else {
      setLoading(false);
    }
  }, [jobId]);

  // Load primary resume once
  useEffect(() => {
    (async () => {
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
    })();
  }, [user, isJobSeeker]);

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

  // ? NEW: Load referral status for this job
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
    // ?? DEBUG: Check if new code is deployed
    console.log('?? NEW handleApply called - code is updated!');
    
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

  // NEW: Ask Referral handler
  const handleAskReferral = async () => {
    console.log('?? handleAskReferral called in JobDetailsScreen');
    
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
    
    // Check if already referred
    if (hasReferred) {
      Alert.alert('Already Requested', 'You have already requested a referral for this job', [
        { text: 'View Referrals', onPress: () => navigation.navigate('Referrals') },
        { text: 'OK' }
      ]);
      return;
    }
    
    // ? CRITICAL FIX: Always check real-time quota before proceeding
    try {
      console.log('?? Checking referral eligibility...');
      const freshEligibility = await nexhireAPI.checkReferralEligibility();
      console.log('?? Eligibility result:', freshEligibility);
      
      if (freshEligibility?.success) {
        const eligibilityData = freshEligibility.data;
        console.log('?? Eligibility data:', eligibilityData);
        
        if (!eligibilityData.isEligible) {
          console.log('? User not eligible, checking subscription status...');
          
          if (!eligibilityData.hasActiveSubscription && eligibilityData.dailyQuotaRemaining === 0) {
            console.log('?? Free quota exhausted - showing subscription modal');
            // ? FREE QUOTA EXHAUSTED: Show subscription modal
            showSubscriptionModal();
            return;
          } else {
            console.log('? Other eligibility issue:', eligibilityData.reason);
            Alert.alert('Referral Limit Reached', eligibilityData.reason || 'You have reached your daily referral limit');
            return;
          }
        }
        
        console.log('? User is eligible - proceeding with referral');
        // Update local state with fresh data
        setReferralEligibility(eligibilityData);
      }
    } catch (e) {
      console.error('?? Failed to check referral eligibility:', e);
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
    
    // setReferralMode(true);
    // setShowResumeModal(true);
    if (primaryResume?.ResumeID) {
      await quickReferral(primaryResume.ResumeID);
      return;
    }
    setReferralMode(true); setShowResumeModal(true);
  };

  // ? NEW: Subscription modal for quota exhausted users
  const showSubscriptionModal = useCallback(async () => {
    console.log('?? showSubscriptionModal called');
    console.log('?? Navigation object:', navigation);
    console.log('?? Available routes:', navigation.getState?.());
    
    // Direct navigation for web (RN Web Alert limitations)
    if (Platform.OS === 'web') {
      console.log('?? Web platform detected - navigating directly to ReferralPlans');
      navigation.navigate('ReferralPlans');
      return;
    }
    
    try {
      Alert.alert(
        '?? Upgrade Required',
        `You've used all 5 free referral requests for today!\n\nUpgrade to continue making referral requests and boost your job search.`,
        [
          { text: 'Maybe Later', style: 'cancel', onPress: () => console.log('?? User selected Maybe Later (details screen)') },
          { text: 'View Plans', onPress: () => {
              console.log('?? User selected View Plans - attempting navigation (details screen)...');
              try { navigation.navigate('ReferralPlans'); } catch (e) { console.error('?? Navigation error details screen:', e); }
            }
          }
        ]
      );
      // Fallback safety navigation after 3s if still not navigated
      setTimeout(() => {
        const state = navigation.getState?.();
        const currentRoute = state?.routes?.[state.index]?.name;
        if (currentRoute !== 'ReferralPlans' && referralEligibility.dailyQuotaRemaining === 0 && !referralEligibility.hasActiveSubscription) {
          console.log('?? Fallback navigation (details screen) to ReferralPlans');
          try { navigation.navigate('ReferralPlans'); } catch (e) { console.warn('Fallback navigation failed (details)', e); }
        }
      }, 3000);
    } catch (error) {
      console.error('?? Error showing subscription modal:', error);
      Alert.alert('Error', 'Failed to load subscription options. Please try again later.');
    }
  }, [navigation]);

  // ? NEW: Handle plan selection
  const handlePlanSelection = async (plan) => {
    console.log('?? Plan selected:', plan);
    
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
                '?? Subscription Successful!',
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

  const handleResumeSelected = async (resumeData) => {
    if (referralMode) {
      try {
        const res = await nexhireAPI.createReferralRequest(jobId, resumeData.ResumeID);
        if (res.success) {
          // ? NEW: Update local referral tracking
          setHasReferred(true);
          setReferralEligibility(prev => ({
            ...prev,
            dailyQuotaRemaining: Math.max(0, prev.dailyQuotaRemaining - 1),
            isEligible: prev.dailyQuotaRemaining > 1
          }));
          
          showToast('Referral request sent', 'success');
        } else {
          Alert.alert('Request Failed', res.error || res.message || 'Failed to send referral request');
        }
      } catch (e) {
        Alert.alert('Error', e.message || 'Failed to send referral request');
      } finally {
        setReferralMode(false);
        setShowResumeModal(false);
      }
      return; // skip normal apply flow
    }
    // existing application flow
    await submitApplication(resumeData.ResumeID);
  };

  const submitApplication = async (resumeId) => {
    setApplying(true);
    try {
      // Prepare application data according to backend JobApplicationRequest interface
      const applicationData = {
        jobID: jobId,
        coverLetter: `I am very interested in the ${job.Title} position and believe my skills and experience make me a great candidate for this role.`,
        expectedSalary: job.SalaryRangeMax || null,
        expectedCurrencyID: job.CurrencyID || null,
        availableFromDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      };

      // ? FIXED: Include ResumeID if provided (matches database schema)
      if (resumeId) {
        applicationData.resumeId = resumeId; // Use resumeId to match backend
      }

      const result = await nexhireAPI.applyForJob(applicationData);
      
      if (result.success) {
        setHasApplied(true);
        showToast('Application submitted', 'success');
      } else {
        // ? IMPROVED: Better error handling
        if (result.error?.includes('No resume found')) {
          // This shouldn't happen with the new flow, but just in case
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
      
      // ? IMPROVED: Handle resume-related errors specifically
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
    }
  };

  // Quick auto-apply using primary resume
  const quickApply = async (resumeId) => {
    try {
      const applicationData = {
        jobID: jobId,
        coverLetter: `I am very interested in the ${job.Title} position and believe my skills and experience make me a great candidate for this role.`,
        resumeId
      };
      const res = await nexhireAPI.applyForJob(applicationData);
      if (res?.success) {
        setHasApplied(true);
        showToast('Application submitted', 'success');
      } else {
        Alert.alert('Application Failed', res.error || res.message || 'Failed to submit application');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to submit application');
    }
  };

  const quickReferral = async (resumeId) => {
    try {
      const res = await nexhireAPI.createReferralRequest(jobId, resumeId);
      if (res?.success) {
        setHasReferred(true);
        setReferralEligibility(prev => ({ ...prev, dailyQuotaRemaining: Math.max(0, prev.dailyQuotaRemaining - 1) }));
        showToast('Referral request sent', 'success');
      } else {
        Alert.alert('Request Failed', res.error || res.message || 'Failed to send referral request');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to send referral request');
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
        <Text style={styles.title}>{job.Title}</Text>
        <Text style={styles.company}>{job.OrganizationName || 'Company Name'}</Text>
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
      </View>

      {/* Job Description */}
      {job.Description && (
        <Section
          title="Job Description"
          content={job.Description}
        />
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

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity style={styles.saveButton}>
          <Ionicons name="bookmark-outline" size={20} color={colors.primary} />
          <Text style={styles.saveButtonText}>Save Job</Text>
        </TouchableOpacity>
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
              {applying ? 'Applying...' : hasApplied ? 'Already Applied' : 'Apply Now'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ? NEW: Resume Upload Modal */}
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
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
  },
  company: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.medium,
    color: colors.gray700,
    marginBottom: 4,
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
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  saveButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    marginLeft: 8,
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
});