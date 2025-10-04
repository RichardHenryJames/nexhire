import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import nexhireAPI from '../../services/api';
import { colors, typography } from '../../styles/theme';
import { showToast } from '../../components/Toast';

export default function AskReferralScreen({ navigation }) {
  const { user, isJobSeeker } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [eligibility, setEligibility] = useState(null);

  // NEW: Company/Organization state
  const [companies, setCompanies] = useState([]);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    jobId: '', // Add Job ID field
    jobTitle: '',
    jobUrl: '',
    referralMessage: '', // CHANGED: Replace jobDescription with referralMessage
    selectedResumeId: '',
  });

  const [errors, setErrors] = useState({});
  const [referralEligibility, setReferralEligibility] = useState({
    isEligible: true,
    dailyQuotaRemaining: 5,
    hasActiveSubscription: false,
    reason: null,
    currentPlan: null // ? NEW: Add current plan info
  }); // NEW: Add referral eligibility state

  // ? FIX: Ensure navigation header is properly configured on mount and doesn't disappear after hard refresh
  useEffect(() => {
    navigation.setOptions({
      title: 'Ask for Referral',
      headerStyle: {
        backgroundColor: colors.surface,
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      },
      headerTitleStyle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.text,
      },
      headerLeft: () => (
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text || colors.textPrimary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Load initial data
  useEffect(() => {
    console.log('AskReferralScreen: Component mounted');
    loadResumes();
    loadCompanies();
    loadReferralEligibility(); // NEW: Load referral eligibility on mount
  }, []);

  // Debug useEffect to log form state changes
  useEffect(() => {
    console.log('Form data updated:', {
      jobId: formData.jobId,
      jobTitle: formData.jobTitle,
      selectedResumeId: formData.selectedResumeId,
      referralMessage: formData.referralMessage?.length || 0,
    });
  }, [formData]);

  useEffect(() => {
    if (selectedCompany) {
      console.log('Selected company:', selectedCompany.name, selectedCompany.id);
    }
  }, [selectedCompany]);

  const loadResumes = async () => {
    setLoading(true);
    try {
      // Load user's resumes
      const resumesRes = await nexhireAPI.getUserResumes();
      if (resumesRes?.success && resumesRes.data) {
        const resumeList = resumesRes.data || [];
        setResumes(resumeList);
        
        // Auto-select primary resume if available
        const primaryResume = resumeList.find(r => r?.IsPrimary);
        if (primaryResume?.ResumeID) {
          setFormData(prev => ({ ...prev, selectedResumeId: primaryResume.ResumeID }));
        }
      } else {
        setResumes([]);
      }
    } catch (error) {
      console.error('Error loading resumes:', error);
      setResumes([]);
      Alert.alert('Error', 'Failed to load resumes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      // Use the same method that works in profile screen
      const result = await nexhireAPI.getOrganizations(''); // Empty string for no search filter
      console.log('Organizations API response:', result);
      
      if (result?.success && result.data && Array.isArray(result.data)) {
        // The API service already handles the mapping, so we can use the data directly
        console.log('Using mapped organizations from API service:', result.data.length, 'items');
        setCompanies(result.data);
      } else {
        console.error('API call failed or returned invalid data:', result);
        setCompanies([]);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
      setCompanies([]);
    }
  };

  // NEW: Load referral eligibility
  const loadReferralEligibility = async () => {
    try {
      const result = await nexhireAPI.checkReferralEligibility();
      if (result?.success) {
        // ? ENHANCED: Include current plan information
        const eligibilityData = {
          ...result.data,
          currentPlan: result.data.currentPlan || result.data.planName || (result.data.hasActiveSubscription ? 'Premium Plan' : 'Free Plan')
        };
        setReferralEligibility(eligibilityData);
      }
    } catch (error) {
      console.error('Failed to load referral eligibility:', error);
    }
  };

  const validateForm = () => {
    console.log('Validating form...');
    const newErrors = {};

    // Check company selection
    if (!selectedCompany) {
      console.log('? Company not selected');
      newErrors.company = 'Company selection is required';
    } else {
      console.log('? Company selected:', selectedCompany.name);
    }

    // Check job ID
    if (!formData.jobId || !formData.jobId.trim()) {
      console.log('? Job ID missing');
      newErrors.jobId = 'Job ID is required';
    } else {
      console.log('? Job ID provided:', formData.jobId);
    }

    // Check job title
    if (!formData.jobTitle || !formData.jobTitle.trim()) {
      console.log('? Job title missing');
      newErrors.jobTitle = 'Job title is required';
    } else {
      console.log('? Job title provided:', formData.jobTitle);
    }

    // Check resume selection
    if (!formData.selectedResumeId) {
      console.log('? Resume not selected');
      newErrors.resume = 'Please select a resume';
    } else {
      console.log('? Resume selected:', formData.selectedResumeId);
    }

    // Validate URL format if provided
    if (formData.jobUrl && formData.jobUrl.trim()) {
      try {
        new URL(formData.jobUrl);
        console.log('? Valid URL provided');
      } catch {
        console.log('? Invalid URL format');
        newErrors.jobUrl = 'Please enter a valid URL';
      }
    }

    const errorCount = Object.keys(newErrors).length;
    console.log(`Validation complete. Errors found: ${errorCount}`);
    if (errorCount > 0) {
      console.log('? Validation errors:', newErrors);
    }

    setErrors(newErrors);
    return errorCount === 0;
  };

  const handleSubmit = async () => {
    console.log('Submit button clicked');
    
    try {
      setSubmitting(true);
      
      // Check quota before validation
      if (referralEligibility.dailyQuotaRemaining === 0) {
        Alert.alert(
          'Quota Exceeded',
          'You have used all your daily referral requests. Please upgrade your plan to continue.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: handleUpgradeClick }
          ]
        );
        return;
      }
      
      console.log('Starting form validation...');
      // Validate form
      if (!validateForm()) {
        console.log('? Form validation failed');
        return;
      }
      console.log('? Form validation passed');

      console.log('Preparing request data...');

      // ? NEW SCHEMA: Send extJobID (external) with jobID as null
      const requestData = {
        jobID: null, // Explicitly null for external referrals
        extJobID: formData.jobId, // External job identifier (STRING)
        resumeID: formData.selectedResumeId,
        jobTitle: formData.jobTitle,
        companyName: selectedCompany.name,
        organizationId: selectedCompany.id.toString(),
        jobUrl: formData.jobUrl || undefined,
        referralMessage: formData.referralMessage || undefined,
      };

      console.log('Submitting external referral request:', requestData);

      const result = await nexhireAPI.createReferralRequest(requestData);
      console.log('API Response:', result);

      if (result?.success) {
        console.log('? Referral request submitted successfully');
        showToast('Referral request submitted successfully!', 'success');

        // Update eligibility after successful submission
        setReferralEligibility(prev => ({
          ...prev,
          dailyQuotaRemaining: Math.max(0, prev.dailyQuotaRemaining - 1),
          isEligible: prev.dailyQuotaRemaining > 1
        }));

        // Reset form
        resetForm();
        
        // Navigate back or to success screen
        navigation.goBack();
      } else {
        const errorMessage = result?.error || result?.message || 'Failed to submit referral request';
        console.error('? API returned error:', errorMessage);
        Alert.alert('Request Failed', errorMessage);
      }
    } catch (error) {
      console.error('? Error in handleSubmit:', error);
      const errorMessage = error?.message || 'An unexpected error occurred. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      console.log('Resetting submitting state');
      setSubmitting(false);
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleCompanySelect = (company) => {
    setSelectedCompany(company);
    setFormData(prev => ({ ...prev, companyName: company.name }));

    // Close modal after selection
    setShowCompanyModal(false);
  };

  const handleCompanySearch = async (searchTerm) => {
    setCompanySearchTerm(searchTerm);
    // For now, just filter the existing companies list
    // In the future, we could implement server-side search
  };

  const resetForm = () => {
    setFormData({
      jobId: '',
      jobTitle: '',
      jobUrl: '',
      referralMessage: '',
      selectedResumeId: '',
    });
    setSelectedCompany(null);
    setErrors({});
  };

  // NEW: Handle upgrade banner click
  const handleUpgradeClick = () => {
    navigation.navigate('ReferralPlans');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your data...</Text>
      </View>
    );
  }

  if (!isJobSeeker) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="lock-closed" size={64} color={colors.gray400} />
        <Text style={styles.errorTitle}>Access Restricted</Text>
        <Text style={styles.errorText}>Only job seekers can request referrals.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Eligibility Status */}
        {eligibility && (
          <View style={[
            styles.eligibilityCard,
            { backgroundColor: eligibility.isEligible ? colors.success + '20' : colors.warning + '20' }
          ]}>
            <Ionicons 
              name={eligibility.isEligible ? "checkmark-circle" : "warning"} 
              size={20} 
              color={eligibility.isEligible ? colors.success : colors.warning} 
            />
            <View style={styles.eligibilityContent}>
              <Text style={[
                styles.eligibilityText,
                { color: eligibility.isEligible ? colors.success : colors.warning }
              ]}>
                {eligibility.isEligible 
                  ? `${eligibility.dailyQuotaRemaining} referral requests remaining today`
                  : eligibility.reason || 'Not eligible for referrals'
                }
              </Text>
              {eligibility.hasActiveSubscription && (
                <Text style={styles.subscriptionText}>
                  {eligibility.hasActiveSubscription ? 'Premium Plan Active' : 'Free Plan (5/day)'}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ? IMPROVED: Enhanced Quota Status Banner with actual plan name and better spacing */}
        {referralEligibility.dailyQuotaRemaining !== undefined && (
          <View style={[
            styles.quotaBanner,
            referralEligibility.dailyQuotaRemaining === 0 ? styles.quotaBannerWarning : styles.quotaBannerSuccess
          ]}>
            {referralEligibility.dailyQuotaRemaining === 0 ? (
              <TouchableOpacity 
                style={styles.quotaBannerContent}
                onPress={handleUpgradeClick}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="warning" 
                  size={20} 
                  color={colors.warning} 
                  style={styles.quotaBannerIcon}
                />
                <Text style={[styles.quotaBannerText, styles.quotaBannerWarningText]}>
                  {referralEligibility.currentPlan 
                    ? `${referralEligibility.currentPlan} daily quota exceeded. Upgrade for more requests.`
                    : 'Daily free quota (5) exceeded. Upgrade for unlimited requests.'
                  }
                </Text>
                <Ionicons 
                  name="chevron-forward" 
                  size={16} 
                  color={colors.warning} 
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.quotaBannerContent}>
                <Ionicons 
                  name="checkmark-circle" 
                  size={20} 
                  color={colors.success} 
                  style={styles.quotaBannerIcon}
                />
                <Text style={[styles.quotaBannerText, styles.quotaBannerSuccessText]}>
                  {referralEligibility.currentPlan 
                    ? `${referralEligibility.currentPlan}: ${referralEligibility.dailyQuotaRemaining} requests remaining today`
                    : `${referralEligibility.dailyQuotaRemaining} free referral requests remaining today`
                  }
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ? IMPROVED: More compelling and catchy description */}
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>🚀 Boost Your Job Application Success Rate</Text>
          <Text style={styles.introText}>
            Get referred by current employees and increase your chances of landing your dream job by up to 5x! Our platform connects you with professionals who can advocate for your skills and help you stand out from hundreds of other applicants.
          </Text>
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitItem}>
              <Ionicons name="trending-up" size={16} color={colors.success} />
              <Text style={styles.benefitText}>5x higher interview rate</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="people" size={16} color={colors.primary} />
              <Text style={styles.benefitText}>Skip the ATS black hole</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="flash" size={16} color={colors.warning} />
              <Text style={styles.benefitText}>Faster hiring process</Text>
            </View>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Company Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Company <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.companySelector, errors.company && styles.inputError]}
              onPress={() => setShowCompanyModal(true)}
            >
              <Text style={[
                styles.companySelectorText,
                !selectedCompany && styles.companySelectorPlaceholder
              ]}>
                {selectedCompany?.name || 'Select company'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.gray500} />
            </TouchableOpacity>
            {errors.company && (
              <Text style={styles.errorText}>{errors.company}</Text>
            )}
          </View>

          {/* Job ID */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Job ID <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.jobId && styles.inputError]}
              placeholder="e.g., job-12345, REQ-2024-001, or external job identifier"
              value={formData.jobId}
              onChangeText={(value) => updateFormData('jobId', value)}
              maxLength={100}
            />
            {errors.jobId && (
              <Text style={styles.errorText}>{errors.jobId}</Text>
            )}
            <Text style={styles.helperText}>
              Enter the job ID or reference number from the company's job posting
            </Text>
          </View>

          {/* Job Title */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Job Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.jobTitle && styles.inputError]}
              placeholder="e.g., Senior Software Engineer, Product Manager"
              value={formData.jobTitle}
              onChangeText={(value) => updateFormData('jobTitle', value)}
              maxLength={200}
            />
            {errors.jobTitle && (
              <Text style={styles.errorText}>{errors.jobTitle}</Text>
            )}
          </View>

          {/* Job URL (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Job URL (Optional)</Text>
            <TextInput
              style={[styles.input, errors.jobUrl && styles.inputError]}
              placeholder="https://careers.company.com/job/12345"
              value={formData.jobUrl}
              onChangeText={(value) => updateFormData('jobUrl', value)}
              keyboardType="url"
              autoCapitalize="none"
            />
            {errors.jobUrl && (
              <Text style={styles.errorText}>{errors.jobUrl}</Text>
            )}
          </View>

          {/* Referral Message */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Referral Message</Text>
            <TextInput
              style={[styles.textArea, errors.referralMessage && styles.inputError]}
              placeholder="Tell the referrer about yourself and why you're interested in this role... 
              
Example: 'Hi! I'm a software engineer with 3 years experience in React/Node.js. I'm really excited about this role because it aligns with my passion for building scalable web applications. I'd be grateful for any referral help!'"
              value={formData.referralMessage}
              onChangeText={(value) => updateFormData('referralMessage', value)}
              multiline
              numberOfLines={4}
              maxLength={1000}
              textAlignVertical="top"
            />
            {errors.referralMessage && (
              <Text style={styles.errorText}>{errors.referralMessage}</Text>
            )}
            <Text style={styles.helperText}>
              Optional: Help referrers understand your background and interest in the role (max 1000 characters)
            </Text>
          </View>

          {/* Resume Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Select Resume <Text style={styles.required}>*</Text>
            </Text>
            
            {resumes.length === 0 ? (
              <View style={styles.noResumeContainer}>
                <Ionicons name="document-outline" size={24} color={colors.gray400} />
                <Text style={styles.noResumeText}>No resumes found</Text>
                <TouchableOpacity
                  style={styles.uploadResumeButton}
                  onPress={() => navigation.navigate('Profile')}
                >
                  <Text style={styles.uploadResumeText}>Upload Resume</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.resumeList}>
                {resumes.map((resume) => (
                  <TouchableOpacity
                    key={resume.ResumeID}
                    style={[
                      styles.resumeItem,
                      formData.selectedResumeId === resume.ResumeID && styles.resumeItemSelected
                    ]}
                    onPress={() => updateFormData('selectedResumeId', resume.ResumeID)}
                  >
                    <View style={styles.resumeItemContent}>
                      <Ionicons 
                        name="document-text" 
                        size={20} 
                        color={formData.selectedResumeId === resume.ResumeID ? colors.primary : colors.gray500} 
                      />
                      <View style={styles.resumeDetails}>
                        <Text style={[
                          styles.resumeLabel,
                          formData.selectedResumeId === resume.ResumeID && styles.resumeLabelSelected
                        ]}>
                          {resume.ResumeLabel}
                        </Text>
                        {resume.IsPrimary && (
                          <Text style={styles.primaryBadge}>Primary</Text>
                        )}
                      </View>
                    </View>
                    <View style={[
                      styles.radioButton,
                      formData.selectedResumeId === resume.ResumeID && styles.radioButtonSelected
                    ]}>
                      {formData.selectedResumeId === resume.ResumeID && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            {errors.resume && (
              <Text style={styles.errorText}>{errors.resume}</Text>
            )}
          </View>
        </View>

        {/* Enhanced Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>How our referral system works:</Text>
            <Text style={styles.infoText}>
              1. Submit your request with job details{'\n'}
              2. Employees get notified and can review your profile{'\n'}
              3. They refer you internally and earn rewards{'\n'}
              4. You get fast-tracked in the hiring process{'\n'}
              5. Land the job with insider advocacy!
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (submitting || referralEligibility.dailyQuotaRemaining === 0) && styles.submitButtonDisabled
          ]}
          onPress={() => {
            console.log('Submit button pressed');
            console.log('Submitting state:', submitting);
            console.log('Quota remaining:', referralEligibility.dailyQuotaRemaining);
            handleSubmit();
          }}
          disabled={submitting || referralEligibility.dailyQuotaRemaining === 0}
        >
          <Text style={[
            styles.submitButtonText,
            (submitting || referralEligibility.dailyQuotaRemaining === 0) && styles.submitButtonTextDisabled
          ]}>
            {submitting ? 'Submitting...' : 
             referralEligibility.dailyQuotaRemaining === 0 ? 'Quota Exceeded - Upgrade Required' :
             'Ask Referral'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* NEW: Company Selection Modal */}
      <Modal
        visible={showCompanyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCompanyModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Company</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCompanyModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.gray600} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.gray500} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search companies..."
              value={companySearchTerm}
              onChangeText={setCompanySearchTerm}
              placeholderTextColor={colors.gray500}
            />
          </View>

          {loadingCompanies ? (
            <View style={styles.modalLoadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.modalLoadingText}>Loading companies...</Text>
            </View>
          ) : (
            <FlatList
              data={companies.filter(company =>
                company.name?.toLowerCase()?.includes(companySearchTerm.toLowerCase()) ||
                (company.industry && company.industry.toLowerCase().includes(companySearchTerm.toLowerCase()))
              )}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.companyItem}
                  onPress={() => {
                    setSelectedCompany(item);
                    setShowCompanyModal(false);
                    setCompanySearchTerm('');
                    // Clear company error if set
                    if (errors.company) {
                      setErrors(prev => ({ ...prev, company: null }));
                    }
                  }}
                >
                  <View style={styles.companyInfo}>
                    <Text style={styles.companyName}>{item.name}</Text>
                    {item.industry && (
                      <Text style={styles.companyIndustry}>{item.industry}</Text>
                    )}
                  </View>
                  {item.id === 999999 && (
                    <Ionicons name="add-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Ionicons name="business" size={48} color={colors.gray400} />
                  <Text style={styles.emptyText}>
                    {companySearchTerm ? 'No companies found' : 'No companies available'}
                  </Text>
                  {companySearchTerm && (
                    <Text style={styles.emptySubtext}>
                      Try searching with different keywords
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginTop: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  
  // ? ADDED: Header button style for navigation
  headerButton: {
    padding: 8,
  },
  
  // ? IMPROVED: Enhanced intro section styles with better spacing and visual appeal
  introSection: {
    paddingHorizontal: 20,
    paddingTop: 20, // ? INCREASED: Better spacing from header/quota banner
    paddingBottom: 16,
    backgroundColor: colors.surface,
    marginBottom: 8, // ? ADDED: Space between intro and form
  },
  introTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  introText: {
    fontSize: typography.sizes.md,
    color: colors.gray700,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  
  // ? NEW: Benefits container styles
  benefitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  benefitText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    marginLeft: 6,
  },
  
  eligibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 12, // ? REDUCED: Less space to quota banner
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eligibilityContent: {
    flex: 1,
    marginLeft: 12,
  },
  eligibilityText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  subscriptionText: {
    fontSize: typography.sizes.xs,
    color: colors.gray600,
    marginTop: 2,
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  required: {
    color: colors.danger,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  inputError: {
    borderColor: colors.danger,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    minHeight: 100,
  },
  charCount: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    textAlign: 'right',
    marginTop: 4,
  },
  noResumeContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.gray100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  noResumeText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginTop: 8,
    marginBottom: 12,
  },
  uploadResumeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  uploadResumeText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  resumeList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  resumeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resumeItemSelected: {
    backgroundColor: colors.primary + '10',
  },
  resumeItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  resumeDetails: {
    flex: 1,
    marginLeft: 12,
  },
  resumeLabel: {
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  resumeLabelSelected: {
    color: colors.primary,
  },
  primaryBadge: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontWeight: typography.weights.bold,
    marginTop: 2,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: colors.primary,
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: 16,
    padding: 16,
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: 4,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  bottomContainer: {
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  submitButtonTextDisabled: {
    color: colors.gray500,
  },
  // NEW: Company selector styles
  companySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.white,
  },
  companySelectorText: {
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    flex: 1,
  },
  companySelectorPlaceholder: {
    color: colors.gray500,
  },
  // NEW: Company modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  modalCloseButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
  },
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 12,
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  companyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  companyIndustry: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 4,
  },
  helperText: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    marginTop: 4,
  },
  // ? IMPROVED: Enhanced quota banner styles with better spacing
  quotaBanner: {
    marginHorizontal: 16,
    marginTop: 8, // ? REDUCED: Better spacing from header
    marginBottom: 8, // ? REDUCED: Better spacing to intro section
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  quotaBannerSuccess: {
    backgroundColor: colors.success + '15',
    borderColor: colors.success + '30',
  },
  quotaBannerWarning: {
    backgroundColor: colors.warning + '15',
    borderColor: colors.warning + '30',
  },
  quotaBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  quotaBannerIcon: {
    marginRight: 12,
  },
  quotaBannerText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    lineHeight: 18, // ? ADDED: Better line height for readability
  },
  quotaBannerSuccessText: {
    color: colors.success,
  },
  quotaBannerWarningText: {
    color: colors.warning,
  },
});