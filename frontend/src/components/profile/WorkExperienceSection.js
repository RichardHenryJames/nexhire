import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, TextInput, Alert, ActivityIndicator, Switch, ScrollView, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';
import { typography } from '../../styles/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useEditing } from './ProfileSection';
import useResponsive from '../../hooks/useResponsive';
import DatePicker from '../DatePicker';
import VerifiedReferrerOverlay from '../VerifiedReferrerOverlay';

const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
};

const getId = (item) => item?.WorkExperienceID || item?.WorkExperienceId || item?.id || item?.ID;
const getCompanyText = (item) => item?.CompanyName || item?.OrganizationName || '';
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
    // Pick last non-empty string
    const last = [...v].reverse().find(x => typeof x === 'string' && x.trim().length > 0);
    return last ? last.trim() : null;
    }
  return typeof v === 'string' ? v.trim() : String(v);
};

// Helper functions for company email verification
const extractDomainFromEmail = (email) => {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1]?.toLowerCase();
};

const normalizeCompanyName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special chars
    .replace(/\s+/g, ''); // Remove spaces
};

// Get suggested company email domain based on company name
const getSuggestedDomain = (companyName) => {
  if (!companyName) return 'company.com';
  let normalized = normalizeCompanyName(companyName);
  // Remove common suffixes for cleaner domain
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
  
  // Extract company part from domain (before first dot)
  const domainParts = domain.split('.');
  const domainCompany = domainParts[0];
  
  // Normalize company name (remove spaces, special chars, common suffixes)
  let normalizedCompany = normalizeCompanyName(companyName);
  
  // Remove common company suffixes
  const suffixes = ['inc', 'llc', 'ltd', 'pvtltd', 'pvt', 'corp', 'corporation', 'limited', 'company', 'technologies', 'tech', 'software', 'solutions', 'services', 'group', 'india', 'global'];
  suffixes.forEach(suffix => {
    normalizedCompany = normalizedCompany.replace(new RegExp(suffix + '$', 'i'), '');
  });
  
  // Strict matching - domain must exactly match or company name must start with the domain
  // This prevents typos like "microsofty" passing for "microsoft"
  // e.g., "microsoft.com" is valid for "Microsoft" or "Microsoft Corporation"
  // e.g., "ms.com" is valid for "MS" but "microsofty.com" is NOT valid for "Microsoft"
  return domainCompany === normalizedCompany || 
         normalizedCompany.startsWith(domainCompany) ||
         (normalizedCompany.length >= 3 && domain.split('.').some(part => part === normalizedCompany));
};

// ? SMART WORK EXPERIENCE VALIDATION - Added validation functions
const shouldHideCurrentToggle = (startDate, existingWorkExperiences, excludeWorkExperienceId = null) => {
  if (!startDate) return false;
  
  // Find existing current work experience (excluding the one being edited)
  const currentExp = existingWorkExperiences.find(exp => {
    const expId = getId(exp);
    const isCurrent = exp.IsCurrent === 1 || exp.IsCurrent === true || (!exp.EndDate && !exp.endDate);
    return isCurrent && (!excludeWorkExperienceId || expId !== excludeWorkExperienceId);
  });
  
  if (!currentExp) return false;
  
  const newStartDate = new Date(startDate);
  const existingStartDate = new Date(currentExp.StartDate || currentExp.startDate);
  
  // Hide toggle if new start date is older than or equal to existing current
  return newStartDate <= existingStartDate;
};

const isEndDateRequired = (formData, existingWorkExperiences, excludeWorkExperienceId = null) => {
  // End date required if:
  // 1. Not marked as current, OR
  // 2. Currently Working toggle is hidden (older date)
  return !formData.isCurrent || shouldHideCurrentToggle(formData.startDate, existingWorkExperiences, excludeWorkExperienceId);
};

const ExperienceItem = ({ item, onEdit, onVerify, onDelete, editable, isLast, colors, styles, userIsVerifiedReferrer }) => {
  const start = item.StartDate || item.startDate;
  const end = item.EndDate || item.endDate;
  const isCurrent = item.IsCurrent || !end;
  const workExpVerified = item.CompanyEmailVerified === 1 || item.CompanyEmailVerified === true;
  
  // For current job: use user-level IsVerifiedReferrer
  // For historical jobs: use work experience level CompanyEmailVerified
  const isVerified = isCurrent ? userIsVerifiedReferrer : workExpVerified;
  
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };
  
  const startStr = formatDate(start);
  const endStr = isCurrent ? 'Present' : formatDate(end);
  const companyName = getCompanyText(item) || 'Company not set';
  const logoURL = item.LogoURL || item.logoURL || null;

  return (
    <View style={styles.timelineItemWrapper}>
      {/* Timeline connector */}
      <View style={styles.timelineConnector}>
        <View style={[styles.timelineDot, isCurrent && styles.timelineDotActive]}>
          {isCurrent && <View style={styles.timelineDotInner} />}
        </View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>

      {/* Content card */}
      <View style={styles.timelineCard}>
        <View style={styles.timelineCardHeader}>
          {/* Company logo */}
          <View style={styles.companyLogoContainer}>
            {logoURL ? (
              <Image source={{ uri: logoURL }} style={styles.companyLogo} />
            ) : (
              <View style={styles.companyLogoPlaceholder}>
                <Ionicons name="business" size={20} color={colors.gray400} />
              </View>
            )}
          </View>

          {/* Job info */}
          <View style={styles.timelineCardContent}>
            <Text style={styles.itemTitle}>{item.JobTitle || item.jobTitle || 'Untitled role'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.itemCompany}>{companyName}</Text>
              {isVerified ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                </View>
              ) : editable && (
                <TouchableOpacity 
                  style={styles.clickToVerifyBadge}
                  onPress={() => onVerify(item)}
                >
                  <Ionicons name="shield-outline" size={10} color={colors.primary} />
                  <Text style={[styles.clickToVerifyText, { color: colors.primary }]}>Click to Verify</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={12} color={colors.gray500} />
              <Text style={styles.itemDates}>{startStr} - {endStr}</Text>
              {isCurrent && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Current</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Actions */}
        {editable && (
          <View style={styles.timelineCardActions}>
            <TouchableOpacity onPress={() => onEdit(item)} style={styles.actionButton}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(item)} style={styles.actionButton}>
              <Ionicons name="trash-outline" size={18} color={colors.danger || '#FF3B30'} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

export default function WorkExperienceSection({ editing, showHeader = false, onLoadingChange }) {
  const ctxEditing = useEditing();
  const isEditing = typeof editing === 'boolean' ? editing : ctxEditing;
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  // validation state
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

  // Extended form fields
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
    reasonForLeaving: '',
    salary: '',
    currencyId: null,
    salaryFrequency: '',
    managerName: '',
    managerContact: '',
    canContact: false,
  });

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Company Email Verification state
  const [companyEmail, setCompanyEmail] = useState('');
  const [emailPrefix, setEmailPrefix] = useState(''); // Just the prefix before @
  const [useCustomDomain, setUseCustomDomain] = useState(false); // Toggle for full email input
  const [emailDomainValid, setEmailDomainValid] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false); // Work exp level verification
  const [userLevelVerified, setUserLevelVerified] = useState(false); // User level IsVerifiedReferrer
  const [verificationError, setVerificationError] = useState('');
  const [otpExpiryTime, setOtpExpiryTime] = useState(null);
  const otpInputRefs = useRef([]);

  // ✅ Verified Referrer Overlay state
  const [showVerifiedReferrerOverlay, setShowVerifiedReferrerOverlay] = useState(false);
  const [verifiedCompanyName, setVerifiedCompanyName] = useState('');

  // Organization search state
  const [orgQuery, setOrgQuery] = useState('');
  const debouncedOrgQuery = useDebounce(orgQuery, 300);
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [showOrgPicker, setShowOrgPicker] = useState(false);
  const [manualOrgMode, setManualOrgMode] = useState(false);

  // Currencies
  const [currencies, setCurrencies] = useState([]);

  const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Temporary'];
  const SALARY_FREQUENCIES = ['Annual', 'Monthly', 'Weekly', 'Daily', 'Hourly'];

  // ? SMART START DATE HANDLER - Auto-uncheck current if toggle should be hidden
  const handleStartDateChange = (date) => {
    const excludeId = editingItem ? getId(editingItem) : null;
    setForm(prev => ({
      ...prev,
      startDate: date,
      // Auto-uncheck "Currently Working" if it should be hidden
      isCurrent: shouldHideCurrentToggle(date, experiences, excludeId) ? false : prev.isCurrent
    }));
  };

  // Get suggested domain for current company
  const suggestedDomain = getSuggestedDomain(form.companyName);

  // Company Email Verification Handlers
  const handleEmailPrefixChange = (prefix) => {
    // Remove @ if user types it
    const cleanPrefix = prefix.replace(/@.*$/, '');
    setEmailPrefix(cleanPrefix);
    
    // Build full email with suggested domain
    const fullEmail = cleanPrefix ? `${cleanPrefix}@${suggestedDomain}` : '';
    setCompanyEmail(fullEmail);
    setVerificationError('');
    
    // Auto-validate since we're using the correct domain
    setEmailDomainValid(cleanPrefix.length > 0);
  };

  const handleCompanyEmailChange = (email) => {
    setCompanyEmail(email);
    setVerificationError('');
    
    // Extract prefix if user pastes full email
    if (email.includes('@')) {
      const prefix = email.split('@')[0];
      setEmailPrefix(prefix);
    }
    
    // Validate domain against company name
    const valid = isValidCompanyEmail(email, form.companyName);
    setEmailDomainValid(valid);
  };

  const handleSendOtp = async () => {
    // Build the email to send - if in prefix mode, construct it; otherwise use companyEmail directly
    const emailToSend = useCustomDomain 
      ? companyEmail 
      : (emailPrefix ? `${emailPrefix}@${suggestedDomain}` : companyEmail);
    
    if (!emailToSend || !emailDomainValid) {
      setVerificationError('Please enter a valid company email');
      return;
    }
    
    const workExpId = editingItem ? getId(editingItem) : null;
    if (!workExpId) {
      setVerificationError('Please save the work experience first, then edit it to verify your email');
      return;
    }

    // Show OTP input immediately for better UX
    setShowOtpInput(true);
    setOtp(['', '', '', '']);
    setSendingOtp(true);
    setVerificationError('');
    
    try {
      console.log('Sending OTP to:', emailToSend); // Debug log
      const response = await refopenAPI.sendCompanyEmailOTP(workExpId, emailToSend);
      
      if (response.success) {
        setOtpExpiryTime(Date.now() + (response.data?.expiresInMinutes || 10) * 60 * 1000);
        Alert.alert('Success', `OTP sent to ${response.data?.email || emailToSend}`);
      } else {
        setVerificationError(response.message || 'Failed to send OTP');
        setShowOtpInput(false); // Hide boxes on failure
      }
    } catch (error) {
      setVerificationError(error.message || 'Failed to send OTP');
      setShowOtpInput(false); // Hide boxes on failure
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpChange = (value, index) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    
    const newOtp = [...otp];
    newOtp[index] = numericValue.slice(-1); // Take only last character
    setOtp(newOtp);
    setVerificationError('');

    // Auto-focus next input
    if (numericValue && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    // Handle backspace - move to previous input
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
        setUserLevelVerified(true); // Also update user-level status
        setShowOtpInput(false);
        
        // ✅ Show the Verified Referrer Overlay instead of simple alert
        const companyName = form.companyName || editingItem?.CompanyName || editingItem?.OrganizationName || 'your company';
        setVerifiedCompanyName(companyName);
        setShowVerifiedReferrerOverlay(true);
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

  const resetVerificationState = () => {
    setCompanyEmail('');
    setEmailPrefix('');
    setEmailDomainValid(false);
    setShowOtpInput(false);
    setOtp(['', '', '', '']);
    setVerificationError('');
    setEmailVerified(false);
    setUserLevelVerified(false);
    setOtpExpiryTime(null);
    setUseCustomDomain(false);
  };

  const applyOrgFilter = (list, q) => {
    if (!Array.isArray(list)) return [];
    if (!q || !q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter(o =>
      (o.name && o.name.toLowerCase().includes(s))
    );
  };

  // Load both JobRole and Department in a single bulk API call
  const loadReferenceData = useCallback(async () => {
    try {
      setLoadingJobRoles(true);
      setLoadingDepartments(true);
      const response = await refopenAPI.getBulkReferenceMetadata(['JobRole', 'Department']);
      if (response.success && response.data) {
        // JobRoles
        if (Array.isArray(response.data.JobRole)) {
          const sortedRoles = response.data.JobRole.sort((a, b) => 
            (a.Value || '').localeCompare(b.Value || '')
          );
          setJobRoles(sortedRoles);
        }
        // Departments
        if (Array.isArray(response.data.Department)) {
          const sortedDepts = response.data.Department.sort((a, b) => 
            (a.Value || '').localeCompare(b.Value || '')
          );
          setDepartments(sortedDepts);
        }
      }
    } catch (error) {
      console.error('Error loading reference data:', error);
    } finally {
      setLoadingJobRoles(false);
      setLoadingDepartments(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (onLoadingChange) onLoadingChange(true);
      const [expRes, curRes, verifyRes] = await Promise.all([
        refopenAPI.getMyWorkExperiences(),
        refopenAPI.getCurrencies().catch(() => ({ success: false })),
        refopenAPI.getVerificationStatus().catch(() => ({ success: false }))
      ]);
      if (expRes && expRes.success) {
        setExperiences(Array.isArray(expRes.data) ? expRes.data : []);
      } else {
        setExperiences([]);
      }
      // Set user-level verification status
      if (verifyRes && verifyRes.success) {
        setUserLevelVerified(verifyRes.data?.isVerifiedReferrer || false);
      } else {
        setUserLevelVerified(false);
      }
      if (curRes && curRes.success) {
        setCurrencies(curRes.data);
      } else {
        setCurrencies([]);
      }
    } catch (e) {
      console.warn('Failed to load work experiences', e?.message);
      setExperiences([]);
    } finally {
      setLoading(false);
      if (onLoadingChange) onLoadingChange(false);
    }
  }, [onLoadingChange]);

  useEffect(() => { loadData(); }, [loadData]);

  // Set INR as default currency when currencies load and none selected
  useEffect(() => {
    if ((currencies || []).length > 0 && (form.currencyId === null || form.currencyId === undefined)) {
      const inr = currencies.find(c => c.Code === 'INR');
      if (inr) {
        setForm(prev => ({ ...prev, currencyId: inr.CurrencyID }));
      } else {
        setForm(prev => ({ ...prev, currencyId: currencies[0].CurrencyID }));
      }
    }
  }, [currencies]);

  // Debounced org search effect with local filtering fallback
  useEffect(() => {
    const search = async () => {
      try {
        setOrgLoading(true);
        // ?? OPTIMIZED: Fetch ALL organizations (no limit) - backend uses covering index
        const res = await refopenAPI.getOrganizations(debouncedOrgQuery || '');
        const raw = (res && res.success && Array.isArray(res.data)) ? res.data : [];
        setOrgResults(applyOrgFilter(raw, debouncedOrgQuery));
      } catch (e) {
        setOrgResults([]);
      } finally {
        setOrgLoading(false);
      }
    };
    if (showOrgPicker) search();
  }, [debouncedOrgQuery, showOrgPicker]);

  const resetForm = () => setForm({
    jobTitle: '', organizationId: null, companyName: '', department: '', employmentType: '', startDate: '', endDate: '', isCurrent: false, location: '', country: '', description: '', skills: '', achievements: '', reasonForLeaving: '', salary: '', currencyId: null, salaryFrequency: '', managerName: '', managerContact: '', canContact: false,
  });

  const openAdd = () => {
    setEditingItem(null);
    resetForm();
    setOrgQuery('');
    setOrgResults([]);
    setManualOrgMode(false);
    setShowOrgPicker(false);
    setJobTitleSearch('');
    setShowJobTitleDropdown(false);
    setDepartmentSearch('');
    setShowDepartmentDropdown(false);
    setShowModal(true);
    loadReferenceData();
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      jobTitle: item.JobTitle || item.jobTitle || '',
      organizationId: item.OrganizationID || item.organizationId || null,
      companyName: getCompanyText(item) || '',
      department: item.Department || '',
      employmentType: item.EmploymentType || '',
      startDate: (item.StartDate || item.startDate) ? new Date(item.StartDate || item.startDate).toISOString().split('T')[0] : '',
      endDate: (item.EndDate || item.endDate) ? new Date(item.EndDate || item.endDate).toISOString().split('T')[0] : '',
      isCurrent: item.IsCurrent === 1 || item.IsCurrent === true || (!item.EndDate),
      location: item.Location || '',
      country: item.Country || '',
      description: item.Description || '',
      skills: item.Skills || '',
      achievements: item.Achievements || '',
      reasonForLeaving: item.ReasonForLeaving || '',
      salary: item.Salary?.toString?.() || '',
      currencyId: item.CurrencyID || null,
      salaryFrequency: item.SalaryFrequency || '',
      managerName: item.ManagerName || '',
      managerContact: item.ManagerContact || '',
      canContact: item.CanContact === 1 || item.CanContact === true,
    });
    setOrgQuery('');
    setOrgResults([]);
    setManualOrgMode(false);
    setShowOrgPicker(false);
    setJobTitleSearch('');
    setShowJobTitleDropdown(false);
    
    // Reset and load verification state
    resetVerificationState();
    if (item.CompanyEmail) {
      setCompanyEmail(item.CompanyEmail);
      // Extract prefix for the prefix input
      if (item.CompanyEmail.includes('@')) {
        setEmailPrefix(item.CompanyEmail.split('@')[0]);
      }
      setEmailDomainValid(true);
    }
    if (item.CompanyEmailVerified) {
      setEmailVerified(true);
    }
    
    // Fetch user-level verification status for current jobs
    const isCurrent = item.IsCurrent === 1 || item.IsCurrent === true || (!item.EndDate);
    if (isCurrent) {
      refopenAPI.getVerificationStatus().then(res => {
        if (res.success) {
          setUserLevelVerified(res.data?.isVerifiedReferrer || false);
        }
      }).catch(() => setUserLevelVerified(false));
    }
    
    setShowModal(true);
    loadReferenceData();
  };

  const handleDeletePress = (item) => { setPendingDelete(item); setShowDeleteModal(true); };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = getId(pendingDelete);
    if (!id) { setShowDeleteModal(false); setPendingDelete(null); Alert.alert('Error', 'Invalid experience id'); return; }
    try {
      setDeleting(true);
      const res = await refopenAPI.deleteWorkExperience(id);
      if (!res?.success) throw new Error(res?.error || 'Delete failed');
      setShowDeleteModal(false); setPendingDelete(null);
      await loadData();
    } catch (e) {
      setShowDeleteModal(false); setPendingDelete(null);
      Alert.alert('Error', e?.message || 'Failed to delete');
    } finally { setDeleting(false); }
  };

  const pickOrg = (org) => {
    if (org.id === 999999) {
      setForm((prev) => ({ ...prev, organizationId: null }));
    } else {
      setForm((prev) => ({ ...prev, organizationId: org.id, companyName: org.name }));
    }
    setShowOrgPicker(false);
  };

  const coerceOrgId = (val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return Number.isNaN(val) ? null : val;
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? null : n;
  };

  const saveForm = async () => {
    const errors = {};
    if (!form.jobTitle || !normalizeString(form.jobTitle)) {
      errors.jobTitle = 'Job title is required';
    }
    if (!form.startDate || !normalizeString(form.startDate)) {
      errors.startDate = 'Start date is required';
    }
    
    // ? SMART VALIDATION - Check if end date is required
    const excludeId = editingItem ? getId(editingItem) : null;
    if (isEndDateRequired(form, experiences, excludeId) && !form.endDate) {
      errors.endDate = 'End date required for non-current position';
    }
    
    setValidationErrors(errors);
    if (Object.keys(errors).length) {
      // Web Alert fallback (RN Web Alert sometimes silent)
      const firstMsg = errors.jobTitle || errors.startDate || errors.endDate;
      if (firstMsg) {
        try { Alert.alert('Validation', firstMsg); } catch(_) { /* noop */ }
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
        reasonForLeaving: normalizeString(form.reasonForLeaving),
        salary: toNumberOrNull(form.salary),
        currencyId: toIntOrNull(form.currencyId),
        salaryFrequency: normalizeString(form.salaryFrequency),
        managerName: normalizeString(form.managerName),
        managerContact: normalizeString(form.managerContact),
        canContact: !!form.canContact,
      };
      if (editingItem) {
        const id = getId(editingItem);
        if (!id) throw new Error('Invalid experience id');
        const res = await refopenAPI.updateWorkExperienceById(id, payload);
        if (!res?.success) throw new Error(res?.error || 'Update failed');
      } else {
        const res = await refopenAPI.createWorkExperience(payload);
        if (!res?.success) throw new Error(res?.error || 'Create failed');
      }
      await loadData();
      Alert.alert('Success', `Work experience ${editingItem ? 'updated' : 'added'} successfully`);
      setShowModal(false);
    } catch (e) {
      console.error('[WorkExp] Save error:', e);
      Alert.alert('Error', e?.message || 'Failed to save work experience');
    } finally { setSaving(false); }
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No work experiences added yet</Text>
      {isEditing && (
        <TouchableOpacity style={styles.addButton} onPress={openAdd}>
          <Ionicons name="add" size={16} color={colors.white} />
          <Text style={styles.addButtonText}>Add Work Experience</Text>
        </TouchableOpacity>
      )}
    </View>
  );

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

  // derive a safe, valid list and flag
  const validExperiences = Array.isArray(experiences) ? experiences.filter((e) => !!getId(e)) : [];
  const hasExperiences = validExperiences.length > 0;

  // ? CHECK IF TOGGLE SHOULD BE HIDDEN
  const excludeId = editingItem ? getId(editingItem) : null;
  const hideCurrentToggle = shouldHideCurrentToggle(form.startDate, experiences, excludeId);
  const endDateRequired = isEndDateRequired(form, experiences, excludeId);

  return (
    <View style={[styles.sectionContainer, showHeader && { marginBottom: 24 }]}>
      {isEditing && hasExperiences && (
        <View style={styles.inlineHeader}>
          <TouchableOpacity style={styles.inlineAddButton} onPress={openAdd}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.inlineAddText}>Add Work Experience</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={validExperiences}
        keyExtractor={(item, index) => String(getId(item) ?? `idx-${index}`)}
        renderItem={({ item, index }) => (
          <ExperienceItem
            item={item}
            editable={isEditing}
            onEdit={openEdit}
            onVerify={openEdit}
            onDelete={handleDeletePress}
            isLast={index === validExperiences.length - 1}
            colors={colors}
            styles={styles}
            userIsVerifiedReferrer={userLevelVerified}
          />
        )}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={!hasExperiences ? { flexGrow: 1 } : null}
      />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalInner}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Work Experience' : 'Add Work Experience'}</Text>
              {/* Removed Save button from header */}
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
                  if (form.jobTitle) {
                    setJobTitleSearch('');
                  }
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

            {/* Company picker - shows dropdown on focus, filter as you type */}
            <Text style={styles.label}>Company</Text>
            <View style={{ position: 'relative', zIndex: 999 }}>
              <TouchableOpacity 
                style={styles.input}
                onPress={() => setShowOrgPicker(true)}
                activeOpacity={0.8}
              >
                <TextInput
                  style={styles.companyInput}
                  value={orgQuery || form.companyName}
                  onChangeText={(t) => { 
                    setOrgQuery(t);
                    setForm({ ...form, companyName: t, organizationId: null }); 
                  }}
                  onFocus={() => {
                    if (form.companyName) {
                      setOrgQuery('');
                    }
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

            {/* Company Email Verification Section - Only for current jobs */}
            {editingItem && form.companyName && form.isCurrent && (
              <View style={styles.verificationSection}>
                {/* Check if database also has IsCurrent = true AND company hasn't changed, otherwise user needs to save first */}
                {!(editingItem.IsCurrent === 1 || editingItem.IsCurrent === true) || 
                 (form.companyName?.toLowerCase().trim() !== (editingItem.CompanyName || '').toLowerCase().trim()) ? (
                  <View style={styles.saveFirstContainer}>
                    <Ionicons name="information-circle" size={20} color={colors.warning} />
                    <Text style={[styles.verificationSubtitle, { color: colors.warning, marginLeft: 8 }]}>
                      {form.companyName?.toLowerCase().trim() !== (editingItem.CompanyName || '').toLowerCase().trim()
                        ? 'You changed the company. Please save first before verifying your email.'
                        : 'Please save your changes first before verifying your company email.'}
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
                    {/* Email Input - Either prefix with domain OR full email */}
                    <View style={styles.emailInputRow}>
                      {useCustomDomain ? (
                        <TextInput
                          style={[
                            styles.emailInput,
                            emailDomainValid && styles.emailInputValid,
                            companyEmail && !emailDomainValid && styles.emailInputInvalid
                          ]}
                          value={companyEmail}
                          onChangeText={handleCompanyEmailChange}
                          placeholder={`your.name@${suggestedDomain}`}
                          placeholderTextColor={colors.gray400}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={!showOtpInput}
                        />
                      ) : (
                        <View style={[
                          styles.emailInputContainer,
                          emailDomainValid && styles.emailInputValid,
                          emailPrefix && !emailDomainValid && styles.emailInputInvalid
                        ]}>
                          <TextInput
                            style={styles.emailPrefixInput}
                            value={emailPrefix}
                            onChangeText={handleEmailPrefixChange}
                            placeholder="your.name"
                            placeholderTextColor={colors.gray400}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!showOtpInput}
                          />
                          <Text style={styles.emailDomainSuffix}>@{suggestedDomain}</Text>
                        </View>
                      )}
                      {!showOtpInput && (
                        <TouchableOpacity
                          style={[
                            styles.verifyButton,
                            (!emailDomainValid || sendingOtp) && styles.verifyButtonDisabled
                          ]}
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

                    {/* Option to use different domain / switch back */}
                    {!showOtpInput && (
                      <TouchableOpacity 
                        onPress={() => {
                          setUseCustomDomain(!useCustomDomain);
                          // Reset email state when switching
                          setCompanyEmail('');
                          setEmailPrefix('');
                          setEmailDomainValid(false);
                        }}
                      >
                        <Text style={styles.differentDomainLink}>
                          {useCustomDomain ? `Use @${suggestedDomain}` : 'Use different email domain?'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Domain validation hint for custom domain */}
                    {useCustomDomain && companyEmail && !emailDomainValid && (
                      <Text style={styles.domainHint}>
                        Email domain should match your company ({form.companyName || 'company'})
                      </Text>
                    )}

                    {/* OTP Input Section */}
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
                          <TouchableOpacity
                            style={styles.resendButton}
                            onPress={handleSendOtp}
                            disabled={sendingOtp}
                          >
                            <Text style={styles.resendButtonText}>Resend Code</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[
                              styles.submitOtpButton,
                              (otp.join('').length !== 4 || verifyingOtp) && styles.submitOtpButtonDisabled
                            ]}
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

                    {/* Error message */}
                    {verificationError ? (
                      <Text style={styles.verificationError}>{verificationError}</Text>
                    ) : null}
                  </>
                )}
              </View>
            )}

            {/* Extended fields follow... */}
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
                  if (form.department) {
                    setDepartmentSearch('');
                  }
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

            {/* ? REPLACED: DatePicker for Start Date */}
            <DatePicker
              label="Start Date"
              value={form.startDate}
              onChange={(date) => {
                handleStartDateChange(date);
                if (validationErrors.startDate) setValidationErrors(v => ({ ...v, startDate: undefined }));
              }}
              placeholder="Select start date"
              required
              maximumDate={new Date()} // Can't start in the future
              error={validationErrors.startDate}
            />

            {/* ? SMART CURRENTLY WORKING TOGGLE - Hide when start date is older */}
            {!hideCurrentToggle && (
              <View style={styles.rowBetween}>
                <Text style={styles.label}>Currently Working</Text>
                <Switch value={!!form.isCurrent} onValueChange={(v) => setForm({ ...form, isCurrent: v, endDate: v ? '' : form.endDate })} />
              </View>
            )}

            {/* ? SHOW INFO MESSAGE WHEN TOGGLE IS HIDDEN */}
            {hideCurrentToggle && (
              <View style={styles.infoContainer}>
                <Ionicons name="information-circle" size={16} color={colors.warning || '#F59E0B'} />
                <Text style={styles.infoText}>
                  Cannot mark as current - you have a newer current position
                </Text>
              </View>
            )}

            {/* FIXED: Only show End Date field when NOT currently working */}
            {!form.isCurrent && (
              <>
                {/* ? REPLACED: DatePicker for End Date */}
                <DatePicker
                  label="End Date"
                  value={form.endDate}
                  onChange={(date) => {
                    setForm({ ...form, endDate: date }); 
                    if (validationErrors.endDate) setValidationErrors(v => ({ ...v, endDate: undefined })); 
                  }}
                  placeholder="Select end date"
                  required={endDateRequired}
                  minimumDate={form.startDate ? new Date(form.startDate) : undefined} // End must be after start
                  maximumDate={new Date()} // Can't end in the future
                  error={validationErrors.endDate}
                />
              </>
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

            <Text style={styles.label}>Reason for Leaving</Text>
            <TextInput 
              style={styles.input} 
              value={form.reasonForLeaving} 
              onChangeText={(t) => setForm({ ...form, reasonForLeaving: t })} 
              placeholder="Optional" 
              placeholderTextColor={colors.gray400}
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

            <Text style={styles.label}>Manager Name</Text>
            <TextInput 
              style={styles.input} 
              value={form.managerName} 
              onChangeText={(t) => setForm({ ...form, managerName: t })} 
              placeholder="Optional" 
              placeholderTextColor={colors.gray400}
            />
            
            <Text style={styles.label}>Manager Contact</Text>
            <TextInput 
              style={styles.input} 
              value={form.managerContact} 
              onChangeText={(t) => setForm({ ...form, managerContact: t })} 
              placeholder="Email/Phone" 
              placeholderTextColor={colors.gray400}
            />

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Recruiter can contact manager</Text>
              <Switch value={!!form.canContact} onValueChange={(v) => setForm({ ...form, canContact: v })} />
            </View>

            {/* Add footer actions at the end of ScrollView content */}
            <View style={styles.modalFooterActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowModal(false)}
                disabled={saving}
              >
                <Ionicons name="close" size={16} color={colors.gray600} />
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSaveButton}
                onPress={saving ? undefined : saveForm} 
                disabled={saving}
              >
                <Ionicons name={saving ? 'hourglass' : 'save-outline'} size={16} color={colors.white} />
                <Text style={styles.modalSaveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteModal} transparent onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Ionicons name="trash-outline" size={36} color={colors.danger} />
            <Text style={styles.confirmTitle}>Delete Work Experience</Text>
            <Text style={styles.confirmMessage}>This action cannot be undone.</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowDeleteModal(false)} disabled={deleting}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDelete} onPress={confirmDelete} disabled={deleting}>
                <Text style={styles.confirmDeleteText}>{deleting ? 'Deleting...' : 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ Verified Referrer Celebration Overlay */}
      <VerifiedReferrerOverlay
        visible={showVerifiedReferrerOverlay}
        onClose={() => setShowVerifiedReferrerOverlay(false)}
        companyName={verifiedCompanyName}
      />
    </View>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  sectionContainer: { marginHorizontal: 4 },
  inlineHeader: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  inlineAddButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, backgroundColor: colors.background },
  inlineAddText: { color: colors.primary, fontSize: typography.sizes?.sm || 14, fontWeight: typography.weights?.medium || '500' },
  
  // Timeline styles
  timelineItemWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineConnector: {
    width: 40,
    alignItems: 'center',
    paddingTop: 4,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gray300 || '#D1D5DB',
    borderWidth: 2,
    borderColor: colors.gray400 || '#9CA3AF',
    zIndex: 1,
  },
  timelineDotActive: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.gray300 || '#D1D5DB',
    marginTop: 4,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  timelineCardHeader: {
    flexDirection: 'row',
    padding: 12,
  },
  companyLogoContainer: {
    marginRight: 12,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.gray100,
  },
  companyLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.gray200 || '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineCardContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.semibold || '600',
    color: colors.text,
    marginBottom: 4,
  },
  itemCompany: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray700 || '#374151',
    marginBottom: 6,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemDates: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.gray500 || '#6B7280',
  },
  currentBadge: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights?.semibold || '600',
    color: '#047857',
  },
  verifiedBadge: {
    backgroundColor: '#ECFDF5',
    padding: 4,
    borderRadius: 10,
  },
  clickToVerifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  clickToVerifyText: {
    fontSize: 10,
    fontWeight: typography.weights?.semibold || '600',
  },
  timelineCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.gray50 || '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    padding: 6,
    borderRadius: 6,
  },
  iconButton: { padding: 8 },
  emptyContainer: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { color: colors.gray600, marginBottom: 8 },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: colors.white, marginLeft: 6 },
  modalContainer: { 
    flex: 1, 
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && responsive.isDesktop ? { alignItems: 'center' } : {}),
  },
  modalInner: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 700 : '100%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: typography.sizes?.lg || 18, fontWeight: typography.weights?.bold || 'bold', color: colors.text },
  // Removed saveButton style as it's now in footer
  formContainer: { padding: 20, paddingBottom: 40 },
  formScroll: { flex: 1 },
  label: { fontSize: typography.sizes?.sm || 14, color: colors.gray700 || '#374151', marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: typography.sizes?.md || 16, color: colors.text, marginBottom: 12, flexDirection: 'row', alignItems: 'center', outlineStyle: 'none' },
  companyInput: { flex: 1, fontSize: typography.sizes?.md || 16, color: colors.text, padding: 0, outlineStyle: 'none' },
  inputDisabled: { opacity: 0.6 },
  // ? ADDED STYLES FOR SMART VALIDATION
  errorInput: { 
    borderColor: colors.danger || '#E53E3E', 
    borderWidth: 2 
  },
  validationText: { color: colors.danger || '#E53E3E', marginTop: -8, marginBottom: 8, fontSize: 12 },
  infoContainer: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: '#92400E',
    fontSize: typography.sizes?.sm || 14,
    flex: 1,
  },
  manualEntryText: { color: colors.primary, fontSize: typography.sizes?.sm || 14 },
  // Simple pill choices
  inlineChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choicePill: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.background },
  choicePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choicePillText: { color: colors.text },
  choicePillTextActive: { color: colors.white },
  // Confirm modal styles
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: 16, padding: 20, alignItems: 'center' },
  confirmTitle: { fontSize: typography.sizes?.lg || 18, fontWeight: typography.weights?.bold || 'bold', color: colors.text, marginTop: 8, marginBottom: 6, textAlign: 'center' },
  confirmMessage: { fontSize: typography.sizes?.sm || 14, color: colors.gray600, textAlign: 'center', marginBottom: 16 },
  confirmButtons: { flexDirection: 'row', gap: 10, width: '100%' },
  confirmCancel: { flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmCancelText: { color: colors.text, fontSize: typography.sizes?.md || 16 },
  confirmDelete: { flex: 1, backgroundColor: colors.danger || '#FF3B30', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmDeleteText: { color: colors.white, fontSize: typography.sizes?.md || 16, fontWeight: typography.weights?.bold || 'bold' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  multiline: { height: 100, textAlignVertical: 'top' },
  manualToggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  // New footer styles
  modalFooterActions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1, 
    borderTopColor: colors.border || '#E5E7EB',
  },
  modalCancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border || '#E5E7EB',
    backgroundColor: colors.surface || '#FFFFFF',
  },
  modalCancelButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600 || '#6B7280',
    fontWeight: typography.weights?.medium || '500',
  },
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.primary || '#007AFF',
    minWidth: 100,
    justifyContent: 'center',
  },
  modalSaveButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.white || '#FFFFFF',
    fontWeight: typography.weights?.bold || 'bold',
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
  dropdownLoading: {
    padding: 20,
    alignItems: 'center',
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#f0f0f0',
    backgroundColor: colors.surface || '#fff',
  },
  dropdownItemText: {
    fontSize: 15,
    color: colors.text || '#333',
  },
  dropdownEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    fontSize: 14,
    color: colors.textMuted || '#999',
    fontStyle: 'italic',
  },
  orgDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#f0f0f0',
    backgroundColor: colors.surface || '#fff',
    gap: 10,
  },
  orgLogoSmall: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  orgLogoPlaceholderSmall: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.gray200 || '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgMetaSmall: {
    fontSize: 12,
    color: colors.gray500 || '#6B7280',
    marginTop: 2,
  },
  // Company Email Verification Styles
  verificationSection: {
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: colors.gray50 || '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border || '#E5E7EB',
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
    color: colors.gray600 || '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  emailInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
  },
  emailInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface || '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border || '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 0, // Allow shrinking
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
    color: colors.gray500 || '#6B7280',
    backgroundColor: colors.gray100 || '#F3F4F6',
    borderLeftWidth: 1,
    borderLeftColor: colors.border || '#E5E7EB',
    flexShrink: 0, // Don't shrink the domain
  },
  differentDomainLink: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.primary || '#6366F1',
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  emailInput: {
    flex: 1,
    backgroundColor: colors.surface || '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border || '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: typography.sizes?.md || 16,
    color: colors.text,
  },
  emailInputValid: {
    borderColor: '#10B981',
    borderWidth: 2,
  },
  emailInputInvalid: {
    borderColor: '#F59E0B',
    borderWidth: 1,
  },
  verifyButton: {
    backgroundColor: colors.primary || '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    backgroundColor: colors.gray400 || '#9CA3AF',
  },
  verifyButtonText: {
    color: colors.white || '#FFFFFF',
    fontWeight: typography.weights?.semibold || '600',
    fontSize: typography.sizes?.sm || 14,
  },
  domainHint: {
    fontSize: typography.sizes?.xs || 12,
    color: '#F59E0B',
    marginTop: 4,
    fontStyle: 'italic',
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
    backgroundColor: colors.surface || '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.border || '#E5E7EB',
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
    color: colors.primary || '#6366F1',
    fontSize: typography.sizes?.sm || 14,
  },
  submitOtpButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitOtpButtonDisabled: {
    backgroundColor: colors.gray400 || '#9CA3AF',
  },
  submitOtpButtonText: {
    color: colors.white || '#FFFFFF',
    fontWeight: typography.weights?.semibold || '600',
    fontSize: typography.sizes?.sm || 14,
  },
  saveFirstContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '15',
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
  verificationError: {
    color: colors.danger || '#E53E3E',
    fontSize: typography.sizes?.sm || 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
