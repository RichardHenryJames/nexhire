import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ActivityIndicator, Switch, ScrollView, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';
import { typography } from '../../styles/theme';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import DatePicker from '../DatePicker';
import VerifiedReferrerOverlay from '../VerifiedReferrerOverlay';

// Helper hook for debouncing
const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
};

// Helper functions
const getId = (item) => item?.WorkExperienceID || item?.WorkExperienceId || item?.id || item?.ID;

const toNumberOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

const toIntOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

const normalizeString = (v) => {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) {
    const last = [...v].reverse().find(x => typeof x === 'string' && x.trim().length > 0);
    return last ? last.trim() : null;
  }
  return typeof v === 'string' ? v.trim() : String(v);
};

const coerceOrgId = (val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

// Company email verification helpers
const extractDomainFromEmail = (email) => {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1]?.toLowerCase();
};

const normalizeCompanyName = (name) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, '');
};

const getSuggestedDomain = (companyName) => {
  if (!companyName) return 'company.com';
  let normalized = normalizeCompanyName(companyName);
  const suffixes = ['inc', 'llc', 'ltd', 'pvtltd', 'pvt', 'corp', 'corporation', 'limited', 'company', 'technologies', 'tech', 'software', 'solutions', 'services', 'group', 'india', 'global'];
  suffixes.forEach(suffix => {
    normalized = normalized.replace(new RegExp(suffix + '$', 'i'), '');
  });
  return normalized ? `${normalized}.com` : 'company.com';
};

const isValidCompanyEmail = (email, companyName) => {
  if (!email || !companyName) return false;
  const domain = extractDomainFromEmail(email);
  if (!domain) return false;
  const domainParts = domain.split('.');
  const domainCompany = domainParts[0];
  let normalizedCompany = normalizeCompanyName(companyName);
  const suffixes = ['inc', 'llc', 'ltd', 'pvtltd', 'pvt', 'corp', 'corporation', 'limited', 'company', 'technologies', 'tech', 'software', 'solutions', 'services', 'group', 'india', 'global'];
  suffixes.forEach(suffix => {
    normalizedCompany = normalizedCompany.replace(new RegExp(suffix + '$', 'i'), '');
  });
  return domainCompany === normalizedCompany || 
         normalizedCompany.startsWith(domainCompany) ||
         (normalizedCompany.length >= 3 && domain.split('.').some(part => part === normalizedCompany));
};

const shouldHideCurrentToggle = (startDate, existingWorkExperiences, excludeWorkExperienceId = null) => {
  if (!startDate) return false;
  const currentExp = existingWorkExperiences.find(exp => {
    const expId = getId(exp);
    const isCurrent = exp.IsCurrent === 1 || exp.IsCurrent === true || (!exp.EndDate && !exp.endDate);
    return isCurrent && (!excludeWorkExperienceId || expId !== excludeWorkExperienceId);
  });
  if (!currentExp) return false;
  const newStartDate = new Date(startDate);
  const existingStartDate = new Date(currentExp.StartDate || currentExp.startDate);
  return newStartDate <= existingStartDate;
};

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Temporary'];
const SALARY_FREQUENCIES = ['Annual', 'Monthly', 'Weekly', 'Daily', 'Hourly'];

/**
 * AddWorkExperienceModal - Reusable modal for adding/editing work experience
 * 
 * Props:
 * - visible: boolean - whether modal is visible
 * - onClose: () => void - callback when modal is closed
 * - onSave: (workExp) => void - callback when work experience is saved
 * - editingItem: object | null - existing work experience to edit, or null for new
 * - existingExperiences: array - list of existing work experiences (for validation)
 * - showVerification: boolean - whether to show email verification section
 * - onVerificationComplete: (companyName) => void - callback when verification is complete
 */
export default function AddWorkExperienceModal({
  visible,
  onClose,
  onSave,
  editingItem = null,
  existingExperiences = [],
  showVerification = false,
  onVerificationComplete,
}) {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // Form state
  const [form, setForm] = useState({
    jobTitle: '',
    organizationId: null,
    companyName: '',
    department: '',
    employmentType: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    location: '',
    country: '',
    description: '',
    skills: '',
    achievements: '',
    salary: '',
    currencyId: null,
    salaryFrequency: '',
  });

  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Job Title dropdown
  const [showJobTitleDropdown, setShowJobTitleDropdown] = useState(false);
  const [jobTitleSearch, setJobTitleSearch] = useState('');
  const [jobRoles, setJobRoles] = useState([]);
  const [loadingJobRoles, setLoadingJobRoles] = useState(false);

  // Department dropdown
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [departments, setDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  // Organization search
  const [orgQuery, setOrgQuery] = useState('');
  const debouncedOrgQuery = useDebounce(orgQuery, 300);
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [showOrgPicker, setShowOrgPicker] = useState(false);

  // Currencies
  const [currencies, setCurrencies] = useState([]);

  // Email verification state
  const [companyEmail, setCompanyEmail] = useState('');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [useCustomDomain, setUseCustomDomain] = useState(false);
  const [emailDomainValid, setEmailDomainValid] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [userLevelVerified, setUserLevelVerified] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const otpInputRefs = useRef([]);

  // Verified Referrer Overlay
  const [showVerifiedOverlay, setShowVerifiedOverlay] = useState(false);
  const [verifiedCompanyName, setVerifiedCompanyName] = useState('');

  const suggestedDomain = getSuggestedDomain(form.companyName);

  // Reset form when modal opens/closes or editingItem changes
  useEffect(() => {
    if (visible) {
      if (editingItem) {
        setForm({
          jobTitle: editingItem.JobTitle || editingItem.jobTitle || '',
          organizationId: editingItem.OrganizationID || editingItem.organizationId || null,
          companyName: editingItem.CompanyName || editingItem.OrganizationName || '',
          department: editingItem.Department || '',
          employmentType: editingItem.EmploymentType || '',
          startDate: editingItem.StartDate || '',
          endDate: editingItem.EndDate || '',
          isCurrent: editingItem.IsCurrent === 1 || editingItem.IsCurrent === true,
          location: editingItem.Location || '',
          country: editingItem.Country || '',
          description: editingItem.Description || '',
          skills: editingItem.Skills || '',
          achievements: editingItem.Achievements || '',
          salary: editingItem.Salary?.toString() || '',
          currencyId: editingItem.CurrencyID || null,
          salaryFrequency: editingItem.SalaryFrequency || '',
        });
        setUserLevelVerified(editingItem.CompanyEmailVerified === 1 || editingItem.CompanyEmailVerified === true);
        setCompanyEmail(editingItem.CompanyEmail || '');
      } else {
        // Reset to empty form for new entry
        setForm({
          jobTitle: '',
          organizationId: null,
          companyName: '',
          department: '',
          employmentType: '',
          startDate: '',
          endDate: '',
          isCurrent: true, // Default to current for new entries
          location: '',
          country: '',
          description: '',
          skills: '',
          achievements: '',
          salary: '',
          currencyId: null,
          salaryFrequency: '',
        });
        setUserLevelVerified(false);
        setCompanyEmail('');
      }
      setValidationErrors({});
      setJobTitleSearch('');
      setDepartmentSearch('');
      setOrgQuery('');
      setShowOtpInput(false);
      setOtp(['', '', '', '']);
      setVerificationError('');
      setEmailPrefix('');
      setEmailDomainValid(false);
    }
  }, [visible, editingItem]);

  // Load reference data
  useEffect(() => {
    if (visible) {
      loadReferenceData();
    }
  }, [visible]);

  const loadReferenceData = async () => {
    try {
      setLoadingJobRoles(true);
      setLoadingDepartments(true);
      // Use bulk API call like original WorkExperienceSection
      const [bulkRes, currRes] = await Promise.all([
        refopenAPI.getBulkReferenceMetadata(['JobRole', 'Department']),
        refopenAPI.getCurrencies(),
      ]);
      
      if (bulkRes?.success && bulkRes.data) {
        // JobRoles
        if (Array.isArray(bulkRes.data.JobRole)) {
          const sortedRoles = bulkRes.data.JobRole.sort((a, b) =>
            (a.Value || '').localeCompare(b.Value || '')
          );
          setJobRoles(sortedRoles);
        }
        // Departments
        if (Array.isArray(bulkRes.data.Department)) {
          const sortedDepts = bulkRes.data.Department.sort((a, b) =>
            (a.Value || '').localeCompare(b.Value || '')
          );
          setDepartments(sortedDepts);
        }
      }
      
      if (currRes?.success) setCurrencies(currRes.data || []);
    } catch (e) {
      console.warn('Failed to load reference data:', e);
    } finally {
      setLoadingJobRoles(false);
      setLoadingDepartments(false);
    }
  };

  // Organization search
  useEffect(() => {
    if (debouncedOrgQuery.length >= 2) {
      searchOrganizations(debouncedOrgQuery);
    } else {
      setOrgResults([]);
    }
  }, [debouncedOrgQuery]);

  const searchOrganizations = async (query) => {
    setOrgLoading(true);
    try {
      const res = await refopenAPI.getOrganizations(query, 15);
      if (res.success) {
        setOrgResults(res.data || []);
      }
    } catch (e) {
      console.warn('Org search failed:', e);
    } finally {
      setOrgLoading(false);
    }
  };

  // Validation
  const excludeId = editingItem ? getId(editingItem) : null;
  const hideCurrentToggle = shouldHideCurrentToggle(form.startDate, existingExperiences, excludeId);
  const endDateRequired = !form.isCurrent || hideCurrentToggle;

  const handleStartDateChange = (date) => {
    setForm(prev => ({
      ...prev,
      startDate: date,
      isCurrent: shouldHideCurrentToggle(date, existingExperiences, excludeId) ? false : prev.isCurrent
    }));
  };

  // Email verification handlers
  const handleEmailPrefixChange = (prefix) => {
    const cleanPrefix = prefix.replace(/@.*$/, '');
    setEmailPrefix(cleanPrefix);
    const fullEmail = cleanPrefix ? `${cleanPrefix}@${suggestedDomain}` : '';
    setCompanyEmail(fullEmail);
    setVerificationError('');
    setEmailDomainValid(cleanPrefix.length > 0);
  };

  const handleCompanyEmailChange = (email) => {
    setCompanyEmail(email);
    setVerificationError('');
    if (email.includes('@')) {
      const prefix = email.split('@')[0];
      setEmailPrefix(prefix);
    }
    const valid = isValidCompanyEmail(email, form.companyName);
    setEmailDomainValid(valid);
  };

  const handleSendOtp = async () => {
    const emailToSend = useCustomDomain 
      ? companyEmail 
      : (emailPrefix ? `${emailPrefix}@${suggestedDomain}` : companyEmail);
    
    if (!emailToSend || !emailDomainValid) {
      setVerificationError('Please enter a valid company email');
      return;
    }
    
    const workExpId = editingItem ? getId(editingItem) : null;
    if (!workExpId) {
      setVerificationError('Please save the work experience first, then verify your email');
      return;
    }

    setShowOtpInput(true);
    setOtp(['', '', '', '']);
    setSendingOtp(true);
    setVerificationError('');
    
    try {
      const response = await refopenAPI.sendCompanyEmailOTP(workExpId, emailToSend);
      if (response.success) {
        Alert.alert('Success', `OTP sent to ${response.data?.email || emailToSend}`);
      } else {
        setVerificationError(response.message || 'Failed to send OTP');
        setShowOtpInput(false);
      }
    } catch (error) {
      setVerificationError(error.message || 'Failed to send OTP');
      setShowOtpInput(false);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpChange = (value, index) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    const newOtp = [...otp];
    newOtp[index] = numericValue.slice(-1);
    setOtp(newOtp);
    setVerificationError('');
    if (numericValue && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 4) {
      setVerificationError('Please enter complete 4-digit OTP');
      return;
    }

    const workExpId = editingItem ? getId(editingItem) : null;
    if (!workExpId) {
      setVerificationError('Invalid work experience');
      return;
    }

    try {
      setVerifyingOtp(true);
      setVerificationError('');
      const response = await refopenAPI.verifyCompanyEmailOTP(workExpId, otpCode);
      
      if (response.success) {
        setEmailVerified(true);
        setUserLevelVerified(true);
        setShowOtpInput(false);
        const compName = form.companyName || editingItem?.CompanyName || editingItem?.OrganizationName || 'your company';
        setVerifiedCompanyName(compName);
        setShowVerifiedOverlay(true);
        if (onVerificationComplete) {
          onVerificationComplete(compName);
        }
      } else {
        setVerificationError(response.message || 'Verification failed');
        if (response.data?.remainingAttempts !== undefined) {
          setVerificationError(`${response.message} (${response.data.remainingAttempts} attempts left)`);
        }
      }
    } catch (error) {
      setVerificationError(error.message || 'Verification failed');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Save form
  const saveForm = async () => {
    const errors = {};
    if (!form.jobTitle?.trim()) errors.jobTitle = 'Job title is required';
    if (!form.startDate) errors.startDate = 'Start date is required';
    if (endDateRequired && !form.endDate) errors.endDate = 'End date is required';
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      errors.endDate = 'End date must be after start date';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      const firstMsg = errors.jobTitle || errors.startDate || errors.endDate;
      if (firstMsg) {
        Alert.alert('Validation', firstMsg);
      }
      return;
    }
    
    try {
      setSaving(true);
      const payload = {
        jobTitle: normalizeString(form.jobTitle),
        companyName: normalizeString(form.companyName),
        organizationId: coerceOrgId(form.organizationId),
        department: normalizeString(form.department),
        employmentType: normalizeString(form.employmentType),
        startDate: normalizeString(form.startDate),
        endDate: form.isCurrent ? null : normalizeString(form.endDate),
        isCurrent: !!form.isCurrent,
        location: normalizeString(form.location),
        country: normalizeString(form.country),
        description: normalizeString(form.description),
        skills: normalizeString(form.skills),
        achievements: normalizeString(form.achievements),
        salary: toNumberOrNull(form.salary),
        currencyId: toIntOrNull(form.currencyId),
        salaryFrequency: normalizeString(form.salaryFrequency),
      };

      let result;
      if (editingItem) {
        const id = getId(editingItem);
        if (!id) throw new Error('Invalid experience id');
        result = await refopenAPI.updateWorkExperienceById(id, payload);
      } else {
        result = await refopenAPI.createWorkExperience(payload);
      }
      
      if (!result?.success) throw new Error(result?.error || 'Save failed');
      
      Alert.alert('Success', `Work experience ${editingItem ? 'updated' : 'added'} successfully`);
      
      if (onSave) {
        onSave(result.data || payload);
      }
      onClose();
    } catch (e) {
      console.error('[WorkExp] Save error:', e);
      Alert.alert('Error', e?.message || 'Failed to save work experience');
    } finally {
      setSaving(false);
    }
  };

  const renderPickerRow = (label, value, options, onSelect) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inlineChoices}>
        {options.map(opt => (
          <TouchableOpacity key={opt} style={[styles.choicePill, value === opt && styles.choicePillActive]} onPress={() => onSelect(opt)}>
            <Text style={[styles.choicePillText, value === opt && styles.choicePillTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalInner}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Work Experience' : 'Add Work Experience'}</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Job Title *</Text>
              <View style={{ position: 'relative', zIndex: 1000 }}>
                <TextInput
                  style={[styles.input, validationErrors.jobTitle && styles.errorInput]}
                  value={jobTitleSearch || form.jobTitle}
                  onChangeText={(t) => { 
                    setJobTitleSearch(t);
                    setShowJobTitleDropdown(t.length > 0);
                    setForm({ ...form, jobTitle: t }); 
                    if (validationErrors.jobTitle) setValidationErrors(v => ({ ...v, jobTitle: undefined })); 
                  }}
                  onFocus={() => {
                    if (form.jobTitle) setJobTitleSearch('');
                  }}
                  placeholder="e.g., Software Engineer"
                  placeholderTextColor={colors.gray400}
                  autoCapitalize="words"
                />
                {showJobTitleDropdown && jobTitleSearch.length > 0 && (
                  <View style={styles.jobTitleDropdown}>
                    {loadingJobRoles ? (
                      <View style={styles.dropdownLoading}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    ) : (
                      <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
                        {jobRoles
                          .filter(role => role.Value && role.Value.toLowerCase().includes(jobTitleSearch.toLowerCase()))
                          .slice(0, 15)
                          .map((role) => (
                            <TouchableOpacity
                              key={role.ReferenceID}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setForm({ ...form, jobTitle: role.Value });
                                setJobTitleSearch('');
                                setShowJobTitleDropdown(false);
                                if (validationErrors.jobTitle) setValidationErrors(v => ({ ...v, jobTitle: undefined }));
                              }}
                            >
                              <Text style={styles.dropdownItemText}>{role.Value}</Text>
                            </TouchableOpacity>
                          ))
                        }
                        {jobRoles.filter(role => role.Value && role.Value.toLowerCase().includes(jobTitleSearch.toLowerCase())).length === 0 && (
                          <View style={styles.dropdownEmpty}>
                            <Text style={styles.dropdownEmptyText}>No matches - type your own</Text>
                          </View>
                        )}
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>
              {validationErrors.jobTitle ? <Text style={styles.validationText}>{validationErrors.jobTitle}</Text> : null}

              {/* Company picker */}
              <Text style={styles.label}>Company</Text>
              <View style={{ position: 'relative', zIndex: 999 }}>
                <TouchableOpacity style={styles.input} onPress={() => setShowOrgPicker(true)} activeOpacity={0.8}>
                  <TextInput
                    style={styles.companyInput}
                    value={orgQuery || form.companyName}
                    onChangeText={(t) => { 
                      setOrgQuery(t);
                      setForm({ ...form, companyName: t, organizationId: null }); 
                    }}
                    onFocus={() => {
                      if (form.companyName) setOrgQuery('');
                      setShowOrgPicker(true);
                    }}
                    placeholder="e.g., Google, Microsoft"
                    placeholderTextColor={colors.gray400}
                    autoCapitalize="words"
                  />
                  <Ionicons name={showOrgPicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.gray500} />
                </TouchableOpacity>
                {showOrgPicker && (
                  <View style={styles.jobTitleDropdown}>
                    {orgLoading ? (
                      <View style={styles.dropdownLoading}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    ) : (
                      <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
                        {orgResults.slice(0, 15).map((org) => (
                          <TouchableOpacity
                            key={org.id}
                            style={styles.orgDropdownItem}
                            onPress={() => {
                              setForm({ ...form, organizationId: org.id, companyName: org.name });
                              setOrgQuery('');
                              setShowOrgPicker(false);
                            }}
                          >
                            {org.logoURL ? (
                              <Image source={{ uri: org.logoURL }} style={styles.orgLogoSmall} />
                            ) : (
                              <View style={styles.orgLogoPlaceholderSmall}>
                                <Ionicons name="business" size={14} color={colors.gray400} />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.dropdownItemText}>{org.name}</Text>
                              {org.industry && org.industry !== 'Other' && (
                                <Text style={styles.orgMetaSmall}>{org.industry}</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                        {orgResults.length === 0 && orgQuery.length > 0 && (
                          <View style={styles.dropdownEmpty}>
                            <Text style={styles.dropdownEmptyText}>No matches - your entry will be used</Text>
                          </View>
                        )}
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>

              {/* Email Verification Section - Only show for current jobs when editing and showVerification is true */}
              {showVerification && editingItem && form.companyName && form.isCurrent && (
                <View style={styles.verificationSection}>
                  {!(editingItem.IsCurrent === 1 || editingItem.IsCurrent === true) || 
                   (form.companyName?.toLowerCase().trim() !== (editingItem.CompanyName || '').toLowerCase().trim()) ? (
                    <View style={styles.saveFirstContainer}>
                      <Ionicons name="information-circle" size={20} color={colors.warning} />
                      <Text style={[styles.verificationSubtitle, { color: colors.warning, marginLeft: 8 }]}>
                        Please save your changes first before verifying your company email.
                      </Text>
                    </View>
                  ) : userLevelVerified ? (
                    <View style={styles.verifiedContainer}>
                      <Ionicons name="shield-checkmark" size={22} color="#10B981" />
                      <View style={styles.verifiedTextContainer}>
                        <Text style={styles.verifiedText}>Verified Employee</Text>
                        <Text style={styles.verifiedEmail}>{companyEmail || editingItem?.CompanyEmail}</Text>
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={styles.verificationHeader}>
                        <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                        <Text style={styles.verificationTitle}>Verify as Company Employee</Text>
                      </View>
                      <Text style={styles.verificationSubtitle}>
                        Verify your company email to become a verified referrer and earn rewards.
                      </Text>
                      <View style={styles.emailInputRow}>
                        {useCustomDomain ? (
                          <TextInput
                            style={[styles.emailInput, emailDomainValid && styles.emailInputValid]}
                            value={companyEmail}
                            onChangeText={handleCompanyEmailChange}
                            placeholder={`your.name@${suggestedDomain}`}
                            placeholderTextColor={colors.gray400}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            editable={!showOtpInput}
                          />
                        ) : (
                          <View style={[styles.emailInputContainer, emailDomainValid && styles.emailInputValid]}>
                            <TextInput
                              style={styles.emailPrefixInput}
                              value={emailPrefix}
                              onChangeText={handleEmailPrefixChange}
                              placeholder="your.name"
                              placeholderTextColor={colors.gray400}
                              keyboardType="email-address"
                              autoCapitalize="none"
                              editable={!showOtpInput}
                            />
                            <Text style={styles.emailDomainSuffix}>@{suggestedDomain}</Text>
                          </View>
                        )}
                        {!showOtpInput && (
                          <TouchableOpacity
                            style={[styles.verifyButton, (!emailDomainValid || sendingOtp) && styles.verifyButtonDisabled]}
                            onPress={handleSendOtp}
                            disabled={!emailDomainValid || sendingOtp}
                          >
                            {sendingOtp ? (
                              <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                              <Text style={styles.verifyButtonText}>Verify</Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                      {!showOtpInput && (
                        <TouchableOpacity onPress={() => { setUseCustomDomain(!useCustomDomain); setCompanyEmail(''); setEmailPrefix(''); setEmailDomainValid(false); }}>
                          <Text style={styles.differentDomainLink}>
                            {useCustomDomain ? `Use @${suggestedDomain}` : 'Use different email domain?'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {showOtpInput && (
                        <View style={styles.otpSection}>
                          <Text style={styles.otpLabel}>Enter 4-digit verification code</Text>
                          <View style={styles.otpInputContainer}>
                            {[0, 1, 2, 3].map((index) => (
                              <TextInput
                                key={index}
                                ref={(ref) => otpInputRefs.current[index] = ref}
                                style={styles.otpInput}
                                value={otp[index]}
                                onChangeText={(value) => handleOtpChange(value, index)}
                                onKeyPress={(e) => handleOtpKeyPress(e, index)}
                                keyboardType="number-pad"
                                maxLength={1}
                                selectTextOnFocus
                              />
                            ))}
                          </View>
                          <View style={styles.otpActions}>
                            <TouchableOpacity style={styles.resendButton} onPress={handleSendOtp} disabled={sendingOtp}>
                              <Text style={styles.resendButtonText}>Resend Code</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.submitOtpButton, (otp.join('').length !== 4 || verifyingOtp) && styles.submitOtpButtonDisabled]}
                              onPress={handleVerifyOtp}
                              disabled={otp.join('').length !== 4 || verifyingOtp}
                            >
                              {verifyingOtp ? (
                                <ActivityIndicator size="small" color={colors.white} />
                              ) : (
                                <Text style={styles.submitOtpButtonText}>Submit</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                      {verificationError ? <Text style={styles.verificationError}>{verificationError}</Text> : null}
                    </>
                  )}
                </View>
              )}

              {/* Department */}
              <Text style={styles.label}>Department</Text>
              <View style={{ position: 'relative', zIndex: 998 }}>
                <TextInput
                  style={styles.input}
                  value={departmentSearch || form.department}
                  onChangeText={(t) => { 
                    setDepartmentSearch(t);
                    setShowDepartmentDropdown(t.length > 0);
                    setForm({ ...form, department: t }); 
                  }}
                  onFocus={() => {
                    if (form.department) setDepartmentSearch('');
                    setShowDepartmentDropdown(true);
                  }}
                  placeholder="e.g., Engineering"
                  placeholderTextColor={colors.gray400}
                />
                {showDepartmentDropdown && (departmentSearch.length > 0 || departments.length > 0) && (
                  <View style={styles.jobTitleDropdown}>
                    {loadingDepartments ? (
                      <View style={styles.dropdownLoading}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    ) : (
                      <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
                        {departments
                          .filter(dept => !departmentSearch || dept.Value?.toLowerCase().includes(departmentSearch.toLowerCase()))
                          .slice(0, 15)
                          .map((dept) => (
                            <TouchableOpacity
                              key={dept.ReferenceID}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setForm({ ...form, department: dept.Value });
                                setDepartmentSearch('');
                                setShowDepartmentDropdown(false);
                              }}
                            >
                              <Text style={styles.dropdownItemText}>{dept.Value}</Text>
                            </TouchableOpacity>
                          ))
                        }
                        {departments.filter(dept => !departmentSearch || dept.Value?.toLowerCase().includes(departmentSearch.toLowerCase())).length === 0 && (
                          <View style={styles.dropdownEmpty}>
                            <Text style={styles.dropdownEmptyText}>No matches - type your own</Text>
                          </View>
                        )}
                      </ScrollView>
                    )}
                  </View>
                )}
              </View>

              {renderPickerRow('Employment Type', form.employmentType, EMPLOYMENT_TYPES, (val) => setForm({ ...form, employmentType: val }))}

              <DatePicker
                label="Start Date"
                value={form.startDate}
                onChange={(date) => {
                  handleStartDateChange(date);
                  if (validationErrors.startDate) setValidationErrors(v => ({ ...v, startDate: undefined }));
                }}
                placeholder="Select start date"
                required
                maximumDate={new Date()}
                error={validationErrors.startDate}
              />

              {!hideCurrentToggle && (
                <View style={styles.rowBetween}>
                  <Text style={styles.label}>Currently Working</Text>
                  <Switch value={!!form.isCurrent} onValueChange={(v) => setForm({ ...form, isCurrent: v, endDate: v ? '' : form.endDate })} />
                </View>
              )}

              {hideCurrentToggle && (
                <View style={styles.infoContainer}>
                  <Ionicons name="information-circle" size={16} color={colors.warning || '#F59E0B'} />
                  <Text style={styles.infoText}>Cannot mark as current - you have a newer current position</Text>
                </View>
              )}

              {!form.isCurrent && (
                <DatePicker
                  label="End Date"
                  value={form.endDate}
                  onChange={(date) => {
                    setForm({ ...form, endDate: date }); 
                    if (validationErrors.endDate) setValidationErrors(v => ({ ...v, endDate: undefined })); 
                  }}
                  placeholder="Select end date"
                  required={endDateRequired}
                  minimumDate={form.startDate ? new Date(form.startDate) : undefined}
                  maximumDate={new Date()}
                  error={validationErrors.endDate}
                />
              )}

              <Text style={styles.label}>Location</Text>
              <TextInput 
                style={styles.input} 
                value={form.location} 
                onChangeText={(t) => setForm({ ...form, location: t })} 
                placeholder="City, State" 
                placeholderTextColor={colors.gray400}
              />
              
              <Text style={styles.label}>Country</Text>
              <TextInput 
                style={styles.input} 
                value={form.country} 
                onChangeText={(t) => setForm({ ...form, country: t })} 
                placeholder="Country" 
                placeholderTextColor={colors.gray400}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput 
                style={[styles.input, styles.multiline]} 
                value={form.description} 
                onChangeText={(t) => setForm({ ...form, description: t })} 
                placeholder="Role responsibilities, tech stack, etc." 
                placeholderTextColor={colors.gray400}
                multiline 
                numberOfLines={4} 
              />

              <Text style={styles.label}>Skills</Text>
              <TextInput 
                style={[styles.input, styles.multiline]} 
                value={form.skills} 
                onChangeText={(t) => setForm({ ...form, skills: t })} 
                placeholder="Comma separated e.g., React, Node.js, SQL" 
                placeholderTextColor={colors.gray400}
                multiline 
                numberOfLines={3} 
              />

              <Text style={styles.label}>Achievements</Text>
              <TextInput 
                style={[styles.input, styles.multiline]} 
                value={form.achievements} 
                onChangeText={(t) => setForm({ ...form, achievements: t })} 
                placeholder="Key accomplishments" 
                placeholderTextColor={colors.gray400}
                multiline 
                numberOfLines={3} 
              />

              <Text style={styles.label}>Salary</Text>
              <TextInput 
                style={styles.input} 
                value={form.salary} 
                onChangeText={(t) => setForm({ ...form, salary: t })} 
                placeholder="e.g., 120000" 
                placeholderTextColor={colors.gray400}
                keyboardType="numeric" 
              />

              <Text style={styles.label}>Currency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={styles.inlineChoices}>
                  {(currencies || []).map((c) => (
                    <TouchableOpacity key={c.CurrencyID} style={[styles.choicePill, form.currencyId === c.CurrencyID && styles.choicePillActive]} onPress={() => setForm({ ...form, currencyId: c.CurrencyID })}>
                      <Text style={[styles.choicePillText, form.currencyId === c.CurrencyID && styles.choicePillTextActive]}>
                        {c.Code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {renderPickerRow('Salary Frequency', form.salaryFrequency, SALARY_FREQUENCIES, (val) => setForm({ ...form, salaryFrequency: val }))}

              {/* Footer actions */}
              <View style={styles.modalFooterActions}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={onClose} disabled={saving}>
                  <Ionicons name="close" size={16} color={colors.gray600} />
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveButton} onPress={saving ? undefined : saveForm} disabled={saving}>
                  <Ionicons name={saving ? 'hourglass' : 'save-outline'} size={16} color={colors.white} />
                  <Text style={styles.modalSaveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <VerifiedReferrerOverlay
        visible={showVerifiedOverlay}
        onClose={() => setShowVerifiedOverlay(false)}
        companyName={verifiedCompanyName}
      />
    </>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalInner: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
  },
  formScroll: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    fontSize: typography.sizes?.sm || 14,
    fontWeight: typography.weights?.medium || '500',
    color: colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: typography.sizes?.md || 16,
    color: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorInput: {
    borderColor: colors.danger || '#FF3B30',
  },
  companyInput: {
    flex: 1,
    fontSize: typography.sizes?.md || 16,
    color: colors.text,
    padding: 0,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  validationText: {
    color: colors.danger || '#FF3B30',
    fontSize: typography.sizes?.xs || 12,
    marginTop: 4,
  },
  jobTitleDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.surface || '#fff',
    borderWidth: 1,
    borderColor: colors.border || '#e0e0e0',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 250,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  dropdownScroll: {
    maxHeight: 250,
  },
  orgMetaSmall: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.gray500,
    marginTop: 2,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemText: {
    fontSize: typography.sizes?.md || 16,
    color: colors.text,
  },
  dropdownLoading: {
    padding: 16,
    alignItems: 'center',
  },
  dropdownEmpty: {
    padding: 12,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    color: colors.gray500,
    fontSize: typography.sizes?.sm || 14,
  },
  orgDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  orgLogoSmall: {
    width: 28,
    height: 28,
    borderRadius: 4,
  },
  orgLogoPlaceholderSmall: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choicePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choicePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choicePillText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.text,
  },
  choicePillTextActive: {
    color: colors.white,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: (colors.warning || '#F59E0B') + '15',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: typography.sizes?.sm || 14,
    color: colors.warning || '#F59E0B',
  },
  modalFooterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalCancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelButtonText: {
    color: colors.gray600,
    fontSize: typography.sizes?.sm || 14,
    fontWeight: typography.weights?.medium || '500',
  },
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  modalSaveButtonText: {
    color: colors.white,
    fontSize: typography.sizes?.sm || 14,
    fontWeight: typography.weights?.medium || '500',
  },
  // Verification styles
  verificationSection: {
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: colors.gray50 || '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  verificationTitle: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.semibold || '600',
    color: colors.text,
  },
  verificationSubtitle: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600,
    marginBottom: 16,
    lineHeight: 20,
  },
  saveFirstContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: (colors.warning || '#F59E0B') + '15',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  verifiedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  verifiedTextContainer: {
    flex: 1,
  },
  verifiedText: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.semibold || '600',
    color: '#065F46',
  },
  verifiedEmail: {
    fontSize: typography.sizes?.sm || 14,
    color: '#047857',
    marginTop: 2,
  },
  emailInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emailInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  emailPrefixInput: {
    flex: 1,
    minWidth: 80,
    padding: 12,
    fontSize: typography.sizes?.md || 16,
    color: colors.text,
  },
  emailDomainSuffix: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray500,
    backgroundColor: colors.gray100 || '#F3F4F6',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  emailInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: typography.sizes?.md || 16,
    color: colors.text,
  },
  emailInputValid: {
    borderColor: '#10B981',
    borderWidth: 2,
  },
  verifyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    backgroundColor: colors.gray400,
  },
  verifyButtonText: {
    color: colors.white,
    fontWeight: typography.weights?.semibold || '600',
    fontSize: typography.sizes?.sm || 14,
  },
  differentDomainLink: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.primary,
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  otpSection: {
    marginTop: 16,
  },
  otpLabel: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray700 || '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  otpInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  otpInput: {
    width: 50,
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 10,
    fontSize: 24,
    fontWeight: typography.weights?.bold || 'bold',
    textAlign: 'center',
    color: colors.text,
  },
  otpActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resendButton: {
    padding: 8,
  },
  resendButtonText: {
    color: colors.primary,
    fontSize: typography.sizes?.sm || 14,
  },
  submitOtpButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitOtpButtonDisabled: {
    backgroundColor: colors.gray400,
  },
  submitOtpButtonText: {
    color: colors.white,
    fontWeight: typography.weights?.semibold || '600',
    fontSize: typography.sizes?.sm || 14,
  },
  verificationError: {
    color: colors.danger || '#E53E3E',
    fontSize: typography.sizes?.sm || 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
