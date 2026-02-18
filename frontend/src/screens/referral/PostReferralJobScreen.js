import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import refopenAPI from '../../services/api';
import { showToast } from '../../components/Toast';
import { typography } from '../../styles/theme';
import SubScreenHeader from '../../components/SubScreenHeader';

/**
 * PostReferralJobScreen - Simplified job posting for verified referrers
 * 
 * This screen allows verified referrers to post jobs they want to refer candidates to.
 * It's a simplified version of CreateJobScreen with only relevant fields.
 * Jobs are created in Draft status initially.
 * 
 * Fields captured:
 * - Job Title (required)
 * - Department (required)
 * - Job Type (Full-time, Part-time, etc.)
 * - Description (required)
 * - Workplace Type (Remote/On-site/Hybrid)
 * - Location (City)
 * - Experience Range (Min-Max years)
 * - Salary Range (optional)
 * 
 * Company is pre-selected from the user's verified current work experience.
 */
export default function PostReferralJobScreen({ navigation, route }) {
  const { user, isVerifiedReferrer } = useAuth();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // Get organizationId from navigation params (URL: /PostReferralJob/:organizationId)
  const organizationId = route?.params?.organizationId;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [errors, setErrors] = useState({});
  
  // Company data fetched from organizationId
  const [company, setCompany] = useState(null);

  // Reference data
  const [jobTypes, setJobTypes] = useState([]);
  const [workplaceTypes, setWorkplaceTypes] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  // Modals
  const [showJobTypeModal, setShowJobTypeModal] = useState(false);
  const [showWorkplaceModal, setShowWorkplaceModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState('');

  // Form data - simplified fields for referrer job posting
  // Company info is pre-populated from organizationId
  const [jobData, setJobData] = useState({
    title: '',
    externalJobId: '', // Company's internal job ID for tracking
    jobTypeID: null,
    jobTypeName: '',
    department: '',
    description: '',
    workplaceType: '',
    city: '',
    experienceMin: '',
    experienceMax: '',
    salaryRangeMin: '',
    salaryRangeMax: '',
    currencyID: null,
    currencyCode: 'INR',
    // Company info will be set after fetching
    organizationId: organizationId || null,
    companyName: '',
  });

  useEffect(() => {
    loadReferenceData();
  }, []);

  // Fetch organization details when organizationId is available
  useEffect(() => {
    if (organizationId) {
      loadOrganizationDetails();
    }
  }, [organizationId]);

  const loadOrganizationDetails = async () => {
    try {
      const result = await refopenAPI.getOrganizationById(organizationId);
      if (result?.success && result.data) {
        const org = result.data;
        setCompany({
          organizationId: org.OrganizationID || org.organizationId,
          companyName: org.Name || org.name,
        });
        setJobData(prev => ({
          ...prev,
          organizationId: org.OrganizationID || org.organizationId,
          companyName: org.Name || org.name,
        }));
      }
    } catch (e) {
      console.error('Failed to load organization:', e);
    }
  };

  const loadReferenceData = async () => {
    try {
      const [refData, currRes] = await Promise.all([
        refopenAPI.getBulkReferenceMetadata(['JobType', 'WorkplaceType', 'Department']),
        refopenAPI.getCurrencies(),
      ]);

      // JobType
      if (refData?.success && refData.data?.JobType) {
        const transformedJobTypes = refData.data.JobType.map(item => ({
          JobTypeID: item.ReferenceID,
          Type: item.Value,
        }));
        setJobTypes(transformedJobTypes);
        // Default to first job type
        if (transformedJobTypes.length > 0) {
          setJobData(prev => ({
            ...prev,
            jobTypeID: transformedJobTypes[0].JobTypeID,
            jobTypeName: transformedJobTypes[0].Type,
          }));
        }
      }

      // WorkplaceType
      if (refData?.success && refData.data?.WorkplaceType) {
        const transformedWorkplaceTypes = refData.data.WorkplaceType.map(item => ({
          WorkplaceTypeID: item.ReferenceID,
          Type: item.Value,
        }));
        setWorkplaceTypes(transformedWorkplaceTypes);
        // Default to first
        if (transformedWorkplaceTypes.length > 0) {
          setJobData(prev => ({ ...prev, workplaceType: transformedWorkplaceTypes[0].Type }));
        }
      }

      // Department
      if (refData?.success && refData.data?.Department) {
        const values = refData.data.Department
          .map(item => item?.Value)
          .filter(Boolean)
          .map(v => String(v));
        const uniqueSorted = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
        setDepartmentOptions(uniqueSorted);
      }

      // Currencies
      if (currRes?.success) {
        const sorted = [...currRes.data].sort((a, b) => a.Code.localeCompare(b.Code));
        setCurrencies(sorted);
        const inr = sorted.find(c => c.Code === 'INR');
        if (inr) {
          setJobData(prev => ({ ...prev, currencyID: inr.CurrencyID, currencyCode: 'INR' }));
        } else if (sorted.length > 0) {
          setJobData(prev => ({ ...prev, currencyID: sorted[0].CurrencyID, currencyCode: sorted[0].Code }));
        }
      }
    } catch (e) {
      console.error('Failed to load reference data:', e);
    } finally {
      setLoadingData(false);
    }
  };

  const validateForm = () => {
    const v = {};
    // Company is required (should come from verified work experience)
    if (!jobData.companyName?.trim()) v.company = 'Company is required';
    if (!jobData.externalJobId?.trim()) v.externalJobId = 'Job ID is required (min 2 characters)';
    else if (jobData.externalJobId.trim().length < 2) v.externalJobId = 'Job ID must be at least 2 characters';
    if (!jobData.title.trim()) v.title = 'Job title is required (min 5 characters)';
    else if (jobData.title.length < 5) v.title = `Job title must be at least 5 characters (${jobData.title.length}/5)`;
    if (!jobData.department?.trim()) v.department = 'Department is required';
    if (!jobData.description.trim()) v.description = 'Description is required (min 20 characters)';
    else if (jobData.description.length < 20) v.description = `Description must be at least 20 characters (${jobData.description.length}/20)`;
    
    if (jobData.salaryRangeMin && jobData.salaryRangeMax) {
      const min = parseFloat(jobData.salaryRangeMin);
      const max = parseFloat(jobData.salaryRangeMax);
      if (!isNaN(min) && !isNaN(max) && min >= max) {
        v.salaryRange = 'Max salary must be greater than min';
      }
    }

    if (jobData.experienceMin && jobData.experienceMax) {
      const min = parseInt(jobData.experienceMin);
      const max = parseInt(jobData.experienceMax);
      if (!isNaN(min) && !isNaN(max) && min > max) {
        v.experience = 'Max experience must be >= min';
      }
    }

    setErrors(v);
    return Object.keys(v).length === 0;
  };

  const handleSubmit = async (publishImmediately = false) => {
    if (!validateForm()) {
      showToast('Please fix the errors before submitting', 'error');
      return;
    }

    // Use organizationId from URL params directly (more reliable than state)
    const orgId = organizationId || jobData.organizationId;
    if (!orgId) {
      showToast('Organization ID is missing. Please try again.', 'error');
      return;
    }

    setLoading(true);
    try {
      const isRemote = jobData.workplaceType?.toLowerCase() === 'remote';
      
      // Build payload - status depends on publishImmediately flag
      const payload = {
        title: jobData.title.trim(),
        externalJobID: jobData.externalJobId.trim(), // Company's internal job ID
        jobTypeID: parseInt(jobData.jobTypeID),
        department: jobData.department.trim(),
        description: jobData.description.trim(),
        workplaceType: jobData.workplaceType,
        isRemote,
        city: jobData.city?.trim() || undefined,
        experienceMin: jobData.experienceMin ? parseInt(jobData.experienceMin) : undefined,
        experienceMax: jobData.experienceMax ? parseInt(jobData.experienceMax) : undefined,
        salaryRangeMin: jobData.salaryRangeMin ? parseFloat(jobData.salaryRangeMin) : undefined,
        salaryRangeMax: jobData.salaryRangeMax ? parseFloat(jobData.salaryRangeMax) : undefined,
        currencyID: jobData.currencyID ? parseInt(jobData.currencyID) : undefined,
        salaryPeriod: 'Annual',
        visibility: 'Public',
        status: publishImmediately ? 'Open' : 'Draft', // ✅ Open if publishing, Draft otherwise
        // Mark as referrer-posted job with organization from verified work experience
        postedByReferrer: true,
        organizationID: parseInt(orgId),
      };

      console.log('📤 PostReferralJob payload:', JSON.stringify(payload, null, 2));

      const result = await refopenAPI.createJob(payload);

      if (result.success) {
        const msg = publishImmediately 
          ? 'Job published successfully!' 
          : 'Job saved as draft!';
        showToast(msg, 'success');
        // Navigate to EmployerJobs screen to see draft/published jobs
        try {
          navigation.reset({ index: 0, routes: [{ name: 'EmployerJobs' }] });
        } catch {
          navigation.navigate('EmployerJobs');
        }
      } else {
        // Show backend validation errors inline if available
        const errorMessage = result.error || result.message || 'Failed to post job';
        
        // Try to parse backend validation errors and show them inline
        if (result.errors && typeof result.errors === 'object') {
          const backendErrors = {};
          Object.keys(result.errors).forEach(key => {
            const fieldKey = key.charAt(0).toLowerCase() + key.slice(1); // Convert to camelCase
            backendErrors[fieldKey] = result.errors[key];
          });
          setErrors(prev => ({ ...prev, ...backendErrors }));
        }
        
        // Also show alert with the error message
        showToast(errorMessage, 'error');
      }
    } catch (e) {
      console.error('Post job error:', e);
      showToast(e?.message || 'Failed to post job', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (key, label, placeholder, opts = {}) => {
    const { required = false, multiline = false, keyboardType = 'default', maxLength } = opts;
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
        <TextInput
          style={[styles.input, multiline && styles.textArea, errors[key] && styles.inputError]}
          value={jobData[key] ? String(jobData[key]) : ''}
          placeholder={placeholder}
          placeholderTextColor={colors.gray400}
          onChangeText={t => {
            setJobData(prev => ({ ...prev, [key]: t }));
            if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
          }}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          keyboardType={keyboardType}
          maxLength={maxLength}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {errors[key] && <Text style={styles.errorText}>{errors[key]}</Text>}
      </View>
    );
  };

  const renderSelect = (key, label, value, onPress, opts = {}) => {
    const { required = false } = opts;
    const hasError = Boolean(errors[key]);
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
        <TouchableOpacity
          style={[styles.selectInput, hasError && styles.inputError]}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={[styles.selectInputText, !value && styles.selectPlaceholder]}>
            {value || `Select ${label}`}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.gray500} />
        </TouchableOpacity>
        {hasError && <Text style={styles.errorText}>{errors[key]}</Text>}
      </View>
    );
  };

  const filteredDepartments = departmentSearch.trim()
    ? departmentOptions.filter(d => d.toLowerCase().includes(departmentSearch.toLowerCase()))
    : departmentOptions;

  if (loadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Post Job" fallbackTab="Home" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.infoBannerText}>
            Post a job you want to refer candidates to. Jobs are created in draft mode and will be reviewed.
          </Text>
        </View>

        {/* Company (from verified work experience) */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>
            Company <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={styles.companyField}>
            <Ionicons name="business" size={20} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.companyName}>{jobData.companyName}</Text>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>
          <Text style={styles.companyHint}>
            This is your current verified company. Jobs will be posted under this company.
          </Text>
        </View>

        {/* External Job ID - Company's internal job ID */}
        {renderInput('externalJobId', 'Job ID', 'e.g. JOB-2024-001, REQ12345', {
          required: true,
          maxLength: 100,
        })}
        <Text style={[styles.companyHint, { marginTop: -12, marginBottom: 16 }]}>
          Your company's internal job ID (from HR system, ATS, etc.). Helps track referrals.
        </Text>

        {/* Job Title */}
        {renderInput('title', 'Job Title', 'e.g. Software Engineer', { required: true })}

        {/* Job Type */}
        {renderSelect('jobType', 'Job Type', jobData.jobTypeName, () => setShowJobTypeModal(true))}

        {/* Department */}
        {renderSelect('department', 'Department', jobData.department, () => setShowDepartmentModal(true), { required: true })}

        {/* Description */}
        {renderInput('description', 'Job Description', 'Describe the role, responsibilities, and requirements...', {
          required: true,
          multiline: true,
        })}

        {/* Workplace Type */}
        {renderSelect('workplaceType', 'Workplace Type', jobData.workplaceType, () => setShowWorkplaceModal(true))}

        {/* Location */}
        {renderInput('city', 'City / Location', 'e.g. Bangalore, Mumbai, Remote')}

        {/* Experience Range */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Experience (years)</Text>
          <View style={styles.rowInputs}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={jobData.experienceMin}
              placeholder="Min"
              placeholderTextColor={colors.gray400}
              keyboardType="numeric"
              onChangeText={t => setJobData(prev => ({ ...prev, experienceMin: t }))}
            />
            <Text style={styles.toText}>to</Text>
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={jobData.experienceMax}
              placeholder="Max"
              placeholderTextColor={colors.gray400}
              keyboardType="numeric"
              onChangeText={t => setJobData(prev => ({ ...prev, experienceMax: t }))}
            />
          </View>
          {errors.experience && <Text style={styles.errorText}>{errors.experience}</Text>}
        </View>

        {/* Salary Range (Optional) */}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Salary Range (optional, Annual)</Text>
          <View style={styles.rowInputs}>
            <TouchableOpacity
              style={[styles.currencyButton]}
              onPress={() => setShowCurrencyModal(true)}
            >
              <Text style={styles.currencyText}>{jobData.currencyCode}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.gray500} />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, styles.salaryInput]}
              value={jobData.salaryRangeMin}
              placeholder="Min"
              placeholderTextColor={colors.gray400}
              keyboardType="numeric"
              onChangeText={t => setJobData(prev => ({ ...prev, salaryRangeMin: t }))}
            />
            <Text style={styles.toText}>-</Text>
            <TextInput
              style={[styles.input, styles.salaryInput]}
              value={jobData.salaryRangeMax}
              placeholder="Max"
              placeholderTextColor={colors.gray400}
              keyboardType="numeric"
              onChangeText={t => setJobData(prev => ({ ...prev, salaryRangeMax: t }))}
            />
          </View>
          {errors.salaryRange && <Text style={styles.errorText}>{errors.salaryRange}</Text>}
        </View>

        {/* Save Draft Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={() => handleSubmit(false)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Save Draft</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Job Type Modal */}
      <Modal visible={showJobTypeModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowJobTypeModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Job Type</Text>
            <FlatList
              data={jobTypes}
              keyExtractor={item => String(item.JobTypeID)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    jobData.jobTypeID === item.JobTypeID && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setJobData(prev => ({
                      ...prev,
                      jobTypeID: item.JobTypeID,
                      jobTypeName: item.Type,
                    }));
                    setShowJobTypeModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      jobData.jobTypeID === item.JobTypeID && styles.modalItemTextSelected,
                    ]}
                  >
                    {item.Type}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Workplace Type Modal */}
      <Modal visible={showWorkplaceModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowWorkplaceModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Workplace Type</Text>
            <FlatList
              data={workplaceTypes}
              keyExtractor={item => String(item.WorkplaceTypeID)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    jobData.workplaceType === item.Type && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setJobData(prev => ({ ...prev, workplaceType: item.Type }));
                    setShowWorkplaceModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      jobData.workplaceType === item.Type && styles.modalItemTextSelected,
                    ]}
                  >
                    {item.Type}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Department Modal */}
      <Modal visible={showDepartmentModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDepartmentModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Department</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search departments..."
              placeholderTextColor={colors.gray400}
              value={departmentSearch}
              onChangeText={setDepartmentSearch}
            />
            <FlatList
              data={filteredDepartments}
              keyExtractor={item => item}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    jobData.department === item && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setJobData(prev => ({ ...prev, department: item }));
                    setDepartmentSearch('');
                    setShowDepartmentModal(false);
                    if (errors.department) setErrors(prev => ({ ...prev, department: null }));
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      jobData.department === item && styles.modalItemTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Currency Modal */}
      <Modal visible={showCurrencyModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCurrencyModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Currency</Text>
            <FlatList
              data={currencies}
              keyExtractor={item => String(item.CurrencyID)}
              style={styles.modalList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    jobData.currencyID === item.CurrencyID && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setJobData(prev => ({
                      ...prev,
                      currencyID: item.CurrencyID,
                      currencyCode: item.Code,
                    }));
                    setShowCurrencyModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      jobData.currencyID === item.CurrencyID && styles.modalItemTextSelected,
                    ]}
                  >
                    {item.Code} - {item.Name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (colors, responsive = {}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      ...(Platform.OS === 'web' && responsive.isDesktop
        ? { alignItems: 'center' }
        : {}),
    },
    scrollView: {
      flex: 1,
      width: '100%',
      maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 900 : '100%',
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 12,
      color: colors.gray500,
      fontSize: typography.sizes?.md || 16,
    },
    infoBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      borderRadius: 8,
      marginBottom: 20,
      gap: 8,
    },
    infoBannerText: {
      flex: 1,
      color: colors.gray500,
      fontSize: typography.sizes?.sm || 14,
      lineHeight: 20,
    },
    fieldContainer: {
      marginBottom: 16,
    },
    fieldLabel: {
      fontSize: typography.sizes?.sm || 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
    },
    requiredStar: {
      color: colors.error || colors.danger,
    },
    companyField: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      padding: 12,
    },
    companyName: {
      flex: 1,
      fontSize: typography.sizes?.md || 16,
      fontWeight: '600',
      color: colors.text,
    },
    verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.successLight || (colors.success + '15'),
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    verifiedText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.success,
      marginLeft: 4,
    },
    companyHint: {
      fontSize: 12,
      color: colors.gray500,
      marginTop: 4,
      fontStyle: 'italic',
    },
    required: {
      color: colors.error || colors.danger,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: typography.sizes?.md || 16,
      color: colors.text,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    inputError: {
      borderColor: colors.error || colors.danger,
    },
    errorText: {
      color: colors.error || colors.danger,
      fontSize: typography.sizes?.xs || 12,
      marginTop: 4,
    },
    selectInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    selectInputText: {
      fontSize: typography.sizes?.md || 16,
      color: colors.text,
    },
    selectPlaceholder: {
      color: colors.gray400,
    },
    rowInputs: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    halfInput: {
      flex: 1,
      minWidth: 0,
    },
    salaryInput: {
      flex: 1,
      minWidth: 0,
    },
    toText: {
      color: colors.gray500,
      fontSize: typography.sizes?.sm || 14,
    },
    currencyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 10,
      gap: 4,
    },
    currencyText: {
      fontSize: typography.sizes?.sm || 14,
      color: colors.text,
      fontWeight: '600',
    },
    actionContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
    },
    draftButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    draftButtonText: {
      color: colors.primary,
      fontSize: typography.sizes?.md || 16,
      fontWeight: '600',
    },
    publishButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    publishButtonText: {
      color: '#FFFFFF',
      fontSize: typography.sizes?.md || 16,
      fontWeight: '600',
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 24,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: typography.sizes?.md || 16,
      fontWeight: '600',
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      width: '100%',
      maxWidth: 400,
      maxHeight: '70%',
    },
    modalTitle: {
      fontSize: typography.sizes?.lg || 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    modalList: {
      maxHeight: 300,
    },
    modalItem: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalItemSelected: {
      backgroundColor: colors.surface,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    modalItemText: {
      fontSize: typography.sizes?.md || 16,
      color: colors.text,
    },
    modalItemTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    modalItemTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    searchInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      marginBottom: 8,
      fontSize: typography.sizes?.sm || 14,
      color: colors.text,
    },
  });
