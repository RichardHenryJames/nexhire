import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import nexhireAPI from '../../services/api';
import { colors, typography } from '../../styles/theme';

export default function CreateJobScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [jobTypes, setJobTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [errors, setErrors] = useState({});
  
  // Job data state matching backend JobCreateRequest interface
  const [jobData, setJobData] = useState({
    title: '',
    jobTypeID: null,
    level: '',
    department: '',
    description: '',
    responsibilities: '',
    requirements: '',
    preferredQualifications: '',
    benefitsOffered: '',
    location: '',
    country: '',
    state: '',
    city: '',
    postalCode: '',
    isRemote: false,
    workplaceType: '',
    remoteRestrictions: '',
    salaryRangeMin: '',
    salaryRangeMax: '',
    currencyID: null,
    salaryPeriod: 'Annual',
    compensationType: 'Salary',
    bonusDetails: '',
    equityOffered: '',
    projectDuration: '',
    projectStartDate: '',
    projectEndDate: '',
    projectBudget: '',
    contractExtensionPossible: false,
    contractConversionPossible: false,
    experienceMin: '',
    experienceMax: '',
    experienceLevel: '',
    requiredCertifications: '',
    requiredEducation: '',
    priority: 'Normal',
    visibility: 'Public',
    applicationDeadline: '',
    targetHiringDate: '',
    maxApplications: '',
    interviewStages: '',
    interviewProcess: '',
    assessmentRequired: false,
    assessmentDetails: '',
    timeZone: '',
    language: 'English',
    tags: '',
    internalNotes: '',
  });

  useEffect(() => {
    loadReferenceData();
  }, []);

  const loadReferenceData = async () => {
    try {
      const [jobTypesResponse, currenciesResponse] = await Promise.all([
        nexhireAPI.getJobTypes(),
        nexhireAPI.getCurrencies(),
      ]);

      if (jobTypesResponse.success) {
        setJobTypes(jobTypesResponse.data);
        // Set default job type
        if (jobTypesResponse.data.length > 0) {
          setJobData(prev => ({ ...prev, jobTypeID: jobTypesResponse.data[0].JobTypeID }));
        }
      }

      if (currenciesResponse.success) {
        setCurrencies(currenciesResponse.data);
        // Set default currency (USD)
        const usdCurrency = currenciesResponse.data.find(c => c.Code === 'USD');
        if (usdCurrency) {
          setJobData(prev => ({ ...prev, currencyID: usdCurrency.CurrencyID }));
        }
      }
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  // Validation function matching backend schema
  const validateForm = () => {
    const newErrors = {};

    // Required fields according to backend validation
    if (!jobData.title.trim()) {
      newErrors.title = 'Job title is required';
    } else if (jobData.title.length < 5 || jobData.title.length > 200) {
      newErrors.title = 'Job title must be between 5 and 200 characters';
    }

    if (!jobData.jobTypeID) {
      newErrors.jobTypeID = 'Job type is required';
    }

    if (!jobData.description.trim()) {
      newErrors.description = 'Job description is required';
    } else if (jobData.description.length < 50) {
      newErrors.description = 'Job description must be at least 50 characters';
    }

    if (!jobData.requirements.trim()) {
      newErrors.requirements = 'Job requirements are required';
    } else if (jobData.requirements.length < 20) {
      newErrors.requirements = 'Job requirements must be at least 20 characters';
    }

    // Salary validation
    if (jobData.salaryRangeMin && jobData.salaryRangeMax) {
      const min = parseFloat(jobData.salaryRangeMin);
      const max = parseFloat(jobData.salaryRangeMax);
      if (min >= max) {
        newErrors.salaryRange = 'Maximum salary must be greater than minimum salary';
      }
    }

    // Date validations
    if (jobData.applicationDeadline) {
      const deadline = new Date(jobData.applicationDeadline);
      if (deadline <= new Date()) {
        newErrors.applicationDeadline = 'Application deadline must be in the future';
      }
    }

    if (jobData.targetHiringDate) {
      const hiringDate = new Date(jobData.targetHiringDate);
      if (hiringDate <= new Date()) {
        newErrors.targetHiringDate = 'Target hiring date must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateJob = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before submitting');
      return;
    }

    setLoading(true);
    try {
      // Prepare data according to backend JobCreateRequest interface
      const jobCreateData = {
        title: jobData.title.trim(),
        jobTypeID: parseInt(jobData.jobTypeID),
        ...(jobData.level && { level: jobData.level.trim() }),
        ...(jobData.department && { department: jobData.department.trim() }),
        description: jobData.description.trim(),
        ...(jobData.responsibilities && { responsibilities: jobData.responsibilities.trim() }),
        requirements: jobData.requirements.trim(),
        ...(jobData.preferredQualifications && { preferredQualifications: jobData.preferredQualifications.trim() }),
        ...(jobData.benefitsOffered && { benefitsOffered: jobData.benefitsOffered.trim() }),
        ...(jobData.location && { location: jobData.location.trim() }),
        ...(jobData.country && { country: jobData.country.trim() }),
        ...(jobData.state && { state: jobData.state.trim() }),
        ...(jobData.city && { city: jobData.city.trim() }),
        ...(jobData.postalCode && { postalCode: jobData.postalCode.trim() }),
        isRemote: jobData.isRemote,
        ...(jobData.workplaceType && { workplaceType: jobData.workplaceType }),
        ...(jobData.remoteRestrictions && { remoteRestrictions: jobData.remoteRestrictions.trim() }),
        ...(jobData.salaryRangeMin && { salaryRangeMin: parseFloat(jobData.salaryRangeMin) }),
        ...(jobData.salaryRangeMax && { salaryRangeMax: parseFloat(jobData.salaryRangeMax) }),
        ...(jobData.currencyID && { currencyID: parseInt(jobData.currencyID) }),
        ...(jobData.salaryPeriod && { salaryPeriod: jobData.salaryPeriod }),
        ...(jobData.compensationType && { compensationType: jobData.compensationType }),
        ...(jobData.bonusDetails && { bonusDetails: jobData.bonusDetails.trim() }),
        ...(jobData.equityOffered && { equityOffered: jobData.equityOffered.trim() }),
        ...(jobData.projectDuration && { projectDuration: jobData.projectDuration.trim() }),
        ...(jobData.projectStartDate && { projectStartDate: new Date(jobData.projectStartDate) }),
        ...(jobData.projectEndDate && { projectEndDate: new Date(jobData.projectEndDate) }),
        ...(jobData.projectBudget && { projectBudget: parseFloat(jobData.projectBudget) }),
        contractExtensionPossible: jobData.contractExtensionPossible,
        contractConversionPossible: jobData.contractConversionPossible,
        ...(jobData.experienceMin && { experienceMin: parseInt(jobData.experienceMin) }),
        ...(jobData.experienceMax && { experienceMax: parseInt(jobData.experienceMax) }),
        ...(jobData.experienceLevel && { experienceLevel: jobData.experienceLevel }),
        ...(jobData.requiredCertifications && { requiredCertifications: jobData.requiredCertifications.trim() }),
        ...(jobData.requiredEducation && { requiredEducation: jobData.requiredEducation.trim() }),
        priority: jobData.priority,
        visibility: jobData.visibility,
        ...(jobData.applicationDeadline && { applicationDeadline: new Date(jobData.applicationDeadline) }),
        ...(jobData.targetHiringDate && { targetHiringDate: new Date(jobData.targetHiringDate) }),
        ...(jobData.maxApplications && { maxApplications: parseInt(jobData.maxApplications) }),
        ...(jobData.interviewStages && { interviewStages: jobData.interviewStages.trim() }),
        ...(jobData.interviewProcess && { interviewProcess: jobData.interviewProcess.trim() }),
        assessmentRequired: jobData.assessmentRequired,
        ...(jobData.assessmentDetails && { assessmentDetails: jobData.assessmentDetails.trim() }),
        ...(jobData.timeZone && { timeZone: jobData.timeZone.trim() }),
        language: jobData.language,
        ...(jobData.tags && { tags: jobData.tags.trim() }),
        ...(jobData.internalNotes && { internalNotes: jobData.internalNotes.trim() }),
      };

      const result = await nexhireAPI.createJob(jobCreateData);
      
      if (result.success) {
        Alert.alert('Success', 'Job posted successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error', result.error || result.message || 'Failed to create job');
      }
    } catch (error) {
      console.error('Job creation error:', error);
      Alert.alert('Error', error.message || 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  const renderTextInput = (key, label, placeholder, options = {}) => {
    const { 
      required = false, 
      multiline = false, 
      keyboardType = 'default',
      maxLength = null 
    } = options;

    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
        <TextInput
          style={[styles.input, multiline && styles.textArea, errors[key] && styles.inputError]}
          placeholder={placeholder}
          value={jobData[key]?.toString() || ''}
          onChangeText={(text) => {
            setJobData({ ...jobData, [key]: text });
            if (errors[key]) {
              setErrors({ ...errors, [key]: null });
            }
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

  const renderPicker = (key, label, options, required = false) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <View style={styles.pickerContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.pickerButton,
              jobData[key] === option.value && styles.pickerButtonActive
            ]}
            onPress={() => {
              setJobData({ ...jobData, [key]: option.value });
              if (errors[key]) {
                setErrors({ ...errors, [key]: null });
              }
            }}
          >
            <Text style={[
              styles.pickerButtonText,
              jobData[key] === option.value && styles.pickerButtonTextActive
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {errors[key] && <Text style={styles.errorText}>{errors[key]}</Text>}
    </View>
  );

  const renderToggle = (key, label) => (
    <TouchableOpacity
      style={styles.toggleContainer}
      onPress={() => setJobData({ ...jobData, [key]: !jobData[key] })}
    >
      <View style={styles.toggleLeft}>
        <Ionicons 
          name={jobData[key] ? "checkmark-circle" : "ellipse-outline"} 
          size={24} 
          color={jobData[key] ? colors.primary : colors.gray400} 
        />
        <Text style={styles.toggleText}>{label}</Text>
      </View>
    </TouchableOpacity>
  );

  const workplaceTypes = [
    { value: 'On-site', label: 'On-site' },
    { value: 'Hybrid', label: 'Hybrid' },
    { value: 'Remote', label: 'Remote' },
  ];

  const experienceLevels = [
    { value: 'Entry', label: 'Entry Level' },
    { value: 'Mid', label: 'Mid Level' },
    { value: 'Senior', label: 'Senior Level' },
    { value: 'Lead', label: 'Lead' },
    { value: 'Executive', label: 'Executive' },
  ];

  const salaryPeriods = [
    { value: 'Annual', label: 'Annual' },
    { value: 'Monthly', label: 'Monthly' },
    { value: 'Hourly', label: 'Hourly' },
  ];

  const compensationTypes = [
    { value: 'Salary', label: 'Salary' },
    { value: 'Contract', label: 'Contract' },
    { value: 'Commission', label: 'Commission' },
  ];

  const priorities = [
    { value: 'Normal', label: 'Normal' },
    { value: 'High', label: 'High' },
    { value: 'Urgent', label: 'Urgent' },
  ];

  const visibilityOptions = [
    { value: 'Public', label: 'Public' },
    { value: 'Private', label: 'Private' },
    { value: 'Internal', label: 'Internal' },
  ];

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>Post a New Job</Text>
          <Text style={styles.subtitle}>Find the perfect candidate for your team</Text>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            {renderTextInput('title', 'Job Title', 'e.g. Senior React Native Developer', { required: true, maxLength: 200 })}
            
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Job Type <Text style={styles.required}>*</Text></Text>
              <View style={styles.pickerContainer}>
                {jobTypes.map((type) => (
                  <TouchableOpacity
                    key={type.JobTypeID}
                    style={[
                      styles.pickerButton,
                      jobData.jobTypeID === type.JobTypeID && styles.pickerButtonActive
                    ]}
                    onPress={() => {
                      setJobData({ ...jobData, jobTypeID: type.JobTypeID });
                      if (errors.jobTypeID) {
                        setErrors({ ...errors, jobTypeID: null });
                      }
                    }}
                  >
                    <Text style={[
                      styles.pickerButtonText,
                      jobData.jobTypeID === type.JobTypeID && styles.pickerButtonTextActive
                    ]}>
                      {type.Type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.jobTypeID && <Text style={styles.errorText}>{errors.jobTypeID}</Text>}
            </View>

            {renderTextInput('level', 'Level', 'e.g. Senior, Mid-level', { maxLength: 50 })}
            {renderTextInput('department', 'Department', 'e.g. Engineering, Marketing', { maxLength: 100 })}
          </View>

          {/* Job Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job Description</Text>
            
            {renderTextInput('description', 'Job Description', 'Describe the role, responsibilities, and what you\'re looking for...', { required: true, multiline: true })}
            {renderTextInput('responsibilities', 'Key Responsibilities', 'List the main responsibilities...', { multiline: true })}
            {renderTextInput('requirements', 'Requirements', 'List the required skills, experience, and qualifications...', { required: true, multiline: true })}
            {renderTextInput('preferredQualifications', 'Preferred Qualifications', 'Nice to have qualifications...', { multiline: true })}
            {renderTextInput('benefitsOffered', 'Benefits Offered', 'Health insurance, retirement plans, flexible hours, etc...', { multiline: true })}
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location & Work Type</Text>
            
            {renderTextInput('location', 'Location', 'e.g. San Francisco, CA', { maxLength: 200 })}
            {renderTextInput('country', 'Country', 'e.g. United States', { maxLength: 100 })}
            {renderTextInput('state', 'State/Province', 'e.g. California', { maxLength: 100 })}
            {renderTextInput('city', 'City', 'e.g. San Francisco', { maxLength: 100 })}
            {renderTextInput('postalCode', 'Postal Code', 'e.g. 94105', { maxLength: 20 })}

            {renderToggle('isRemote', 'Remote Work Available')}
            {renderPicker('workplaceType', 'Workplace Type', workplaceTypes)}
            
            {jobData.isRemote && (
              renderTextInput('remoteRestrictions', 'Remote Work Restrictions', 'e.g. Must be in US time zones', { maxLength: 200 })
            )}
          </View>

          {/* Compensation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compensation</Text>
            
            <View style={styles.salaryContainer}>
              {renderTextInput('salaryRangeMin', 'Minimum Salary', '80000', { keyboardType: 'numeric' })}
              {renderTextInput('salaryRangeMax', 'Maximum Salary', '120000', { keyboardType: 'numeric' })}
            </View>
            {errors.salaryRange && <Text style={styles.errorText}>{errors.salaryRange}</Text>}

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Currency</Text>
              <View style={styles.pickerContainer}>
                {currencies.slice(0, 6).map((currency) => (
                  <TouchableOpacity
                    key={currency.CurrencyID}
                    style={[
                      styles.pickerButton,
                      jobData.currencyID === currency.CurrencyID && styles.pickerButtonActive
                    ]}
                    onPress={() => setJobData({ ...jobData, currencyID: currency.CurrencyID })}
                  >
                    <Text style={[
                      styles.pickerButtonText,
                      jobData.currencyID === currency.CurrencyID && styles.pickerButtonTextActive
                    ]}>
                      {currency.Code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {renderPicker('salaryPeriod', 'Salary Period', salaryPeriods)}
            {renderPicker('compensationType', 'Compensation Type', compensationTypes)}

            {renderTextInput('bonusDetails', 'Bonus Details', 'Performance bonus, signing bonus, etc.', { maxLength: 300 })}
            {renderTextInput('equityOffered', 'Equity Offered', 'Stock options, RSUs, etc.', { maxLength: 100 })}
          </View>

          {/* Experience & Requirements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience & Requirements</Text>
            
            <View style={styles.experienceContainer}>
              {renderTextInput('experienceMin', 'Minimum Experience (Years)', '3', { keyboardType: 'numeric' })}
              {renderTextInput('experienceMax', 'Maximum Experience (Years)', '8', { keyboardType: 'numeric' })}
            </View>

            {renderPicker('experienceLevel', 'Experience Level', experienceLevels)}
            {renderTextInput('requiredCertifications', 'Required Certifications', 'AWS, Google Cloud, etc.', { maxLength: 100 })}
            {renderTextInput('requiredEducation', 'Required Education', 'Bachelor\'s degree in Computer Science or related field', { maxLength: 200 })}
          </View>

          {/* Job Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job Settings</Text>
            
            {renderPicker('priority', 'Priority', priorities)}
            {renderPicker('visibility', 'Visibility', visibilityOptions)}

            {renderTextInput('applicationDeadline', 'Application Deadline', 'YYYY-MM-DD', { keyboardType: 'numeric' })}
            {renderTextInput('targetHiringDate', 'Target Hiring Date', 'YYYY-MM-DD', { keyboardType: 'numeric' })}
            {renderTextInput('maxApplications', 'Maximum Applications', '100', { keyboardType: 'numeric' })}

            {renderToggle('assessmentRequired', 'Assessment Required')}
            
            {jobData.assessmentRequired && (
              renderTextInput('assessmentDetails', 'Assessment Details', 'Describe the assessment process...', { multiline: true })
            )}

            {renderTextInput('tags', 'Tags', 'react, javascript, remote', { maxLength: 100 })}
            {renderTextInput('internalNotes', 'Internal Notes', 'Notes for your team...', { multiline: true, maxLength: 100 })}
          </View>

          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.draftButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.draftButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.publishButton, loading && styles.buttonDisabled]}
              onPress={handleCreateJob}
              disabled={loading}
            >
              <Text style={styles.publishButtonText}>
                {loading ? 'Publishing...' : 'Publish Job'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    marginBottom: 32,
  },
  section: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: 8,
  },
  required: {
    color: colors.danger,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    marginTop: 4,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pickerButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  pickerButtonTextActive: {
    color: colors.white,
  },
  toggleContainer: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    marginLeft: 12,
  },
  salaryContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  experienceContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  draftButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  draftButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  publishButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  publishButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  buttonDisabled: {
    backgroundColor: colors.gray400,
  },
});