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

  // ?? NEW: Company/Organization state
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
    referralMessage: '', // ?? CHANGED: Replace jobDescription with referralMessage
    selectedResumeId: '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load user's resumes, eligibility, and companies
      const [resumesRes, eligibilityRes, companiesRes] = await Promise.all([
        nexhireAPI.getUserResumes(),
        nexhireAPI.checkReferralEligibility(),
        nexhireAPI.getOrganizations()
      ]);

      if (resumesRes.success) {
        const resumeList = resumesRes.data || [];
        setResumes(resumeList);
        
        // Auto-select primary resume if available
        const primaryResume = resumeList.find(r => r.IsPrimary);
        if (primaryResume) {
          setFormData(prev => ({ ...prev, selectedResumeId: primaryResume.ResumeID }));
        }
      }

      if (eligibilityRes.success) {
        setEligibility(eligibilityRes.data);
      }

      if (companiesRes.success) {
        setCompanies(companiesRes.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!selectedCompany) {
      newErrors.company = 'Company selection is required';
    }

    if (!formData.jobId.trim()) {
      newErrors.jobId = 'Job ID is required';
    }

    if (!formData.jobTitle.trim()) {
      newErrors.jobTitle = 'Job title is required';
    }

    if (!formData.selectedResumeId) {
      newErrors.resume = 'Please select a resume';
    }

    // Validate URL format if provided
    if (formData.jobUrl.trim()) {
      try {
        new URL(formData.jobUrl);
      } catch {
        newErrors.jobUrl = 'Please enter a valid URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      showToast('Please fix the errors above', 'error');
      return;
    }

    if (!eligibility?.isEligible) {
      Alert.alert('Not Eligible', eligibility?.reason || 'You are not eligible for referrals');
      return;
    }

    setSubmitting(true);
    try {
      const requestData = {
        jobID: formData.jobId, // Use the Job ID from form instead of generating one
        resumeID: formData.selectedResumeId,
        referralType: 'external',
        jobTitle: formData.jobTitle,
        companyName: selectedCompany.name,
        organizationId: selectedCompany.id.toString(), // ?? NEW: Include organization ID
        jobUrl: formData.jobUrl || undefined,
        referralMessage: formData.referralMessage || undefined, // ?? CHANGED: Use referralMessage instead of jobDescription
      };

      console.log('?? Submitting external referral request:', requestData);

      const result = await nexhireAPI.createReferralRequest(requestData);

      if (result.success) {
        showToast('Referral request submitted successfully!', 'success');
        
        // Navigate back to referrals screen to show the new request
        navigation.navigate('Referrals');
      } else {
        throw new Error(result.error || 'Failed to submit referral request');
      }
    } catch (error) {
      console.error('Error submitting referral request:', error);
      Alert.alert('Error', error.message || 'Failed to submit referral request');
    } finally {
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
    if (searchTerm.trim().length === 0) {
      setCompanies([]);
      return;
    }

    setLoadingCompanies(true);
    try {
      const response = await nexhireAPI.searchCompanies(searchTerm.trim());
      if (response.success) {
        setCompanies(response.data);
      } else {
        showToast(response.error || 'Failed to load companies', 'error');
      }
    } catch (error) {
      console.error('Error searching companies:', error);
      showToast('Failed to load companies. Please try again.', 'error');
    } finally {
      setLoadingCompanies(false);
    }
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Ask for Referral</Text>
          <Text style={styles.subtitle}>
            Request referrals for jobs you found on company career portals
          </Text>
        </View>

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
                {selectedCompany ? selectedCompany.name : 'Select company'}
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

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>How it works:</Text>
            <Text style={styles.infoText}>
              1. Submit your referral request{'\n'}
              2. Employees from the company will see your request{'\n'}
              3. They can help refer you and earn reward points{'\n'}
              4. You'll be notified when someone helps you
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!eligibility?.isEligible || submitting || resumes.length === 0) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!eligibility?.isEligible || submitting || resumes.length === 0}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="paper-plane" size={20} color={colors.white} />
              <Text style={styles.submitButtonText}>Submit Referral Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ?? NEW: Company Selection Modal */}
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
                company.name.toLowerCase().includes(companySearchTerm.toLowerCase()) ||
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
  header: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
  },
  eligibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
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
    backgroundColor: colors.gray400,
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  // ?? NEW: Company selector styles
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
  // ?? NEW: Company modal styles
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
});