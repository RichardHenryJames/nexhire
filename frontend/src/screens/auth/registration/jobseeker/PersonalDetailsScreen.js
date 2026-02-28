import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Image,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../contexts/AuthContext';
import { frontendConfig } from '../../../../config/appConfig';
import { useTheme } from '../../../../contexts/ThemeContext';
import { typography } from '../../../../styles/theme';
import { authDarkColors } from '../../../../styles/authDarkColors';
import useResponsive from '../../../../hooks/useResponsive';
import refopenAPI from '../../../../services/api';
import DatePicker from '../../../../components/DatePicker';
import { showToast } from '../../../../components/Toast';
import RegistrationWrapper from '../../../../components/auth/RegistrationWrapper';

// Debounce hook for search
const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
};

export default function PersonalDetailsScreen({ navigation, route }) {
  const colors = authDarkColors; // Always use dark colors for auth screens
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const { register, pendingGoogleAuth, clearPendingGoogleAuth } = useAuth();
  
  // 🔧 Add safety checks for route params
  const routeParams = route?.params || {};
  const { 
    userType = 'JobSeeker', 
    experienceType = 'Student', 
    workExperienceData = null, // 🔧 Can be single object or array now
    educationData = null, 
    jobPreferences = null, 
    fromGoogleAuth = false, 
    skipEmailPassword = false,
    skippedSteps = false, // Check if user skipped steps
  } = routeParams;

  // 🔧 Check if this is a Google user
  const isGoogleUser = fromGoogleAuth || pendingGoogleAuth;
  const googleUser = pendingGoogleAuth?.user;

  // NEW: Guard against hard refresh with lost Google data
  useEffect(() => {
    if (fromGoogleAuth && !pendingGoogleAuth && !googleUser) {
      console.warn('⚠️ Hard refresh detected with lost Google data - redirecting to login');
      
      // 🔧 For web: Use window.location for reliable redirect
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
        return;
      }
      
      // For native: Use navigation reset
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }, 100);
    }
  }, [fromGoogleAuth, pendingGoogleAuth, googleUser, navigation]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    location: '',
    currentCompany: '', // Company name (for display and fallback)
    organizationId: null, // NEW: Organization ID from database
    jobTitle: '', // NEW: Job title (required when company is selected)
    startDate: '', // NEW: Start date (required when company is selected)
    referralCode: '', // 🎁 NEW: Referral code for bonus
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [termsAccepted, setTermsAccepted] = useState(false);

  // EMAIL VERIFICATION STATE (non-Google users)
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerificationId, setEmailVerificationId] = useState(null);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [verifiedEmail, setVerifiedEmail] = useState(''); // track which email was verified

  // NEW: Organization picker state
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgQuery, setOrgQuery] = useState('');
  const debouncedOrgQuery = useDebounce(orgQuery, 300);
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [manualOrgMode, setManualOrgMode] = useState(false);

  // NEW: Job title dropdown state
  const [jobRoles, setJobRoles] = useState([]);
  const [loadingJobRoles, setLoadingJobRoles] = useState(false);
  const [showJobTitleDropdown, setShowJobTitleDropdown] = useState(false);
  const [jobTitleSearch, setJobTitleSearch] = useState('');

  // 🎁 NEW: Welcome bonus amount from pricing API
  const [welcomeBonus, setWelcomeBonus] = useState(50); // Default fallback

  // Fetch welcome bonus from pricing API
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const result = await refopenAPI.getPricing();
        if (result.success && result.data?.welcomeBonus) {
          setWelcomeBonus(result.data.welcomeBonus);
        }
      } catch (error) {
        console.warn('Failed to fetch pricing:', error);
      }
    };
    fetchPricing();
  }, []);

  // Pre-populate Google user data
  useEffect(() => {
    if (isGoogleUser && googleUser) {
      
      setFormData(prev => ({
        ...prev,
        firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || '',
        lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '',
        email: googleUser.email || '',
        // No password needed for Google users
        password: 'google-oauth-user',
        confirmPassword: 'google-oauth-user',
      }));
    }
  }, [isGoogleUser, googleUser]);

  // NEW: Load job roles from ReferenceMetadata
  useEffect(() => {
    const loadJobRoles = async () => {
      try {
        setLoadingJobRoles(true);
        const response = await refopenAPI.getReferenceMetadata('JobRole');
        if (response.success && Array.isArray(response.data)) {
          const sorted = response.data.sort((a, b) => 
            (a.Value || '').localeCompare(b.Value || '')
          );
          setJobRoles(sorted);
        }
      } catch (error) {
        console.error('Error loading job roles:', error);
      } finally {
        setLoadingJobRoles(false);
      }
    };
    loadJobRoles();
  }, []);

  // NEW: Pre-populate current company from work experience data
  useEffect(() => {
    // Only for experienced professionals, NOT students
    if (experienceType === 'Student') return;

    // Check if we have work experience data with current position
    const experiences = Array.isArray(workExperienceData) 
      ? workExperienceData 
      : (workExperienceData ? [workExperienceData] : []);

    const currentExp = experiences.find(exp => exp.isCurrentPosition);
    
    if (currentExp && currentExp.companyName) {
      setFormData(prev => ({
        ...prev,
        currentCompany: currentExp.companyName || '',
        organizationId: currentExp.organizationId || null,
        jobTitle: currentExp.jobTitle || '',
        startDate: currentExp.startDate || '',
      }));
    }
  }, [workExperienceData, experienceType]);

  // NEW: Debounced organization search
  useEffect(() => {
    const search = async () => {
      if (!showOrgModal || manualOrgMode) return;
      try {
        setOrgLoading(true);
        const res = await refopenAPI.getOrganizations(debouncedOrgQuery || '', null); // No limit
        const raw = (res && res.success && Array.isArray(res.data)) ? res.data : [];
        // Apply client-side filter for better UX
        const filtered = applyOrgFilter(raw, debouncedOrgQuery);
        setOrgResults(filtered);
      } catch (e) {
        console.error('Organization search error:', e);
        setOrgResults([]);
      } finally {
        setOrgLoading(false);
      }
    };
    search();
  }, [debouncedOrgQuery, showOrgModal, manualOrgMode]);

  // NEW: Organization filter helper
  const applyOrgFilter = (list, q) => {
    if (!Array.isArray(list)) return [];
    if (!q || !q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter(o =>
      (o.name && o.name.toLowerCase().includes(s)) ||
      (o.website && o.website.toLowerCase().includes(s)) ||
      (o.industry && o.industry.toLowerCase().includes(s))
    );
  };

  // NEW: Organization modal handlers
  const openOrgModal = () => {
    setShowOrgModal(true);
    setManualOrgMode(false);
    if (orgResults.length === 0) setOrgQuery('');
  };

  const closeOrgModal = () => setShowOrgModal(false);

  const handleSelectOrganization = (org) => {
    if (org.id === 999999) {
      setFormData(prev => ({
        ...prev,
        organizationId: null,
        currentCompany: '',
        jobTitle: '', // Clear job title when company is deselected
        startDate: '', // Clear start date when company is deselected
      }));
      // Clear errors for these fields
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.jobTitle;
        delete newErrors.startDate;
        return newErrors;
      });
    } else {
      setFormData(prev => ({
        ...prev,
        organizationId: org.id,
        currentCompany: org.name
      }));
    }
    closeOrgModal();
  };

  // Validation functions
  const validateEmail = (email) => {
    // Validates: user@domain.tld where TLD is 2-6 letters
    // Also supports subdomains like user@mail.domain.com
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(email)) return false;
    // Reject common typos: .comm .conn .coom .orgg etc.
    const tld = email.split('.').pop().toLowerCase();
    const validTLDs = ['com','org','net','edu','gov','io','in','co','uk','us','info','biz','dev','app','ai','me','xyz','tech','online','site','ac','mil'];
    // Allow any 2-3 letter TLD (country codes) + known longer TLDs
    return tld.length <= 3 || validTLDs.includes(tld);
  };

  const validatePassword = (password) => {
    return password.length >= 8;
  };

  const validatePhoneNumber = (phone) => {
    if (!phone) return true; // Optional field
    const phoneRegex = /^\+?[\d\s\-()]+$/;
    return phoneRegex.test(phone);
  };

  // ===== EMAIL VERIFICATION HANDLERS =====
  // Reset verification when email changes
  useEffect(() => {
    if (formData.email !== verifiedEmail && emailVerified) {
      setEmailVerified(false);
      setEmailVerificationId(null);
      setShowOtpInput(false);
      setOtpCode('');
    }
  }, [formData.email]);

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  const handleSendOTP = async () => {
    const email = formData.email.trim().toLowerCase();
    if (!email || !validateEmail(email)) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
      return;
    }
    setOtpLoading(true);
    try {
      const result = await refopenAPI.sendRegistrationEmailOTP(email);
      if (result.success) {
        setShowOtpInput(true);
        setOtpCooldown(60);
        showToast('Verification code sent! Check your inbox.', 'success');
      } else {
        const msg = result.error || result.message || 'Failed to send code';
        if (msg.includes('already exists')) {
          setErrors(prev => ({ ...prev, email: 'Account already exists. Please sign in.' }));
        } else {
          showToast(msg, 'error');
        }
      }
    } catch (e) {
      const msg = e?.data?.message || e?.data?.error || e?.message || 'Failed to send verification code';
      if (msg.includes('already exists')) {
        setErrors(prev => ({ ...prev, email: 'Account already exists. Please sign in.' }));
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 4) {
      showToast('Please enter the 4-digit code', 'error');
      return;
    }
    setOtpLoading(true);
    try {
      const email = formData.email.trim().toLowerCase();
      const result = await refopenAPI.verifyRegistrationEmailOTP(email, otpCode);
      if (result.success && result.data?.verificationId) {
        setEmailVerified(true);
        setEmailVerificationId(result.data.verificationId);
        setVerifiedEmail(email);
        setShowOtpInput(false);
        showToast('Email verified! ✓', 'success');
      } else {
        showToast(result.message || 'Invalid code', 'error');
      }
    } catch (e) {
      showToast('Verification failed', 'error');
    } finally {
      setOtpLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required field validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Skip password validation for Google users
    if (!isGoogleUser) {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (!validatePassword(formData.password)) {
        newErrors.password = 'Password must be at least 8 characters';
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    // NEW: Current Company is mandatory for Experienced professionals
    if (userType === 'JobSeeker' && experienceType === 'Experienced') {
      // Check if company already captured from work experience flow
      const experiences = Array.isArray(workExperienceData) 
        ? workExperienceData 
      : (workExperienceData ? [workExperienceData] : []);
      
      const hasCurrentCompany = experiences.some(exp => exp.isCurrentPosition && exp.companyName);
      
   // If no company from work experience, it's mandatory in this form
      if (!hasCurrentCompany && !formData.currentCompany && !formData.organizationId) {
      newErrors.currentCompany = 'Current company is required for experienced professionals';
      }
    }

    // NEW: Validate jobTitle and startDate when company is selected
    if (formData.currentCompany || formData.organizationId) {
   if (!formData.jobTitle.trim()) {
newErrors.jobTitle = 'Job title is required when company is selected';
    }
      if (!formData.startDate.trim()) {
 newErrors.startDate = 'Start date is required when company is selected';
      } else {
 // Validate date format (YYYY-MM-DD)
 const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(formData.startDate)) {
   newErrors.startDate = 'Please use YYYY-MM-DD format';
        } else {
          const startDate = new Date(formData.startDate);
          const today = new Date();
     if (startDate > today) {
       newErrors.startDate = 'Start date cannot be in the future';
          }
    }
   }
    }

    // Optional field validations
    if (formData.phone && !validatePhoneNumber(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (formData.dateOfBirth) {
      const dob = new Date(formData.dateOfBirth);
   const today = new Date();
      if (dob >= today) {
 newErrors.dateOfBirth = 'Date of birth must be in the past';
      }
    }

    // Email verification is mandatory
    if (!isGoogleUser && !emailVerified) {
      newErrors.email = 'Please verify your email address before registering';
    }

    // Terms & Conditions acceptance is mandatory
    if (!termsAccepted) {
      newErrors.termsAccepted = 'You must accept the Terms of Service and Privacy Policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      if (!isGoogleUser && !emailVerified) {
        showToast('Please verify your email address first', 'error');
      } else {
        showToast('Please fix the errors before continuing', 'error');
      }
      return;
    }

    setLoading(true);
    try {
      // Prepare registration data for Google vs regular users
      const registrationData = {
        email: formData.email.trim().toLowerCase(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        userType: userType,
        ...(formData.phone && { phone: formData.phone.trim() }),
        ...(formData.dateOfBirth && { dateOfBirth: new Date(formData.dateOfBirth) }),
        ...(formData.gender && { gender: formData.gender }),
        ...(formData.location && { location: formData.location.trim() }),
        ...(formData.referralCode && { referralCode: formData.referralCode.trim() }), // 🎁 NEW: Add referral code
        ...(emailVerificationId && { emailVerificationId }), // Email OTP verification proof
        termsAccepted: true, // User has accepted T&C checkbox
        termsVersion: frontendConfig.legal.termsVersion,
        privacyPolicyVersion: frontendConfig.legal.privacyPolicyVersion,
        
        // Include all the collected data for profile completion
        experienceType,
      };

      // 🔧 NEW: Handle workExperienceData as array
      if (workExperienceData) {
        if (Array.isArray(workExperienceData)) {
          // Multiple work experiences from WorkExperienceScreen
          registrationData.workExperienceData = workExperienceData;
        } else {
          // Single work experience (legacy or skip flow)
          registrationData.workExperienceData = [workExperienceData];
        }
      }

      // 🔧 NEW: If user filled current company in skip flow, create workExperienceData
      // BUT only for experienced professionals, NOT for students
      if (skippedSteps && experienceType !== 'Student' && (formData.currentCompany || formData.organizationId)) {
        const skipFlowWorkExp = {
          companyName: formData.currentCompany?.trim() || null,
          organizationId: formData.organizationId || null,
          jobTitle: formData.jobTitle?.trim() || 'Professional', // Use actual job title from form
          startDate: formData.startDate?.trim() || new Date().toISOString().split('T')[0], // Use actual start date
          endDate: null, // Currently working
          isCurrentPosition: true,
        };

        // Add to existing array or create new one
        if (registrationData.workExperienceData) {
          registrationData.workExperienceData.push(skipFlowWorkExp);
        } else {
          registrationData.workExperienceData = [skipFlowWorkExp];
        }
      }

      // Add education and job preferences
      if (educationData) {
        registrationData.educationData = educationData;
      }
      if (jobPreferences) {
        registrationData.jobPreferences = jobPreferences;
      }

      // Add password only for non-Google users
      if (!isGoogleUser) {
        registrationData.password = formData.password;
      }

      // Add Google OAuth data if applicable
      if (isGoogleUser && pendingGoogleAuth) {
        registrationData.googleAuth = {
          googleId: googleUser.id,
          accessToken: pendingGoogleAuth.accessToken,
          idToken: pendingGoogleAuth.idToken,
          verified: googleUser.verified_email,
          picture: googleUser.picture,
          locale: googleUser.locale,
        };
      }

      const result = await register(registrationData);
      
      if (result.success) {
        // Clear pending Google auth data
        if (isGoogleUser) {
          clearPendingGoogleAuth();
        }
        // AuthContext automatically navigates to home when isAuthenticated becomes true
      } else {
        // ✅ NEW: Check if error is "User already exists"
        const errorMessage = result.error || 'Unable to create account. Please try again.';
        
        if (errorMessage.includes('already exists') || errorMessage.includes('Conflict')) {
          
          // Clear any pending Google auth data
          if (isGoogleUser) {
            clearPendingGoogleAuth();
          }
          
          showToast('Account already exists. Please sign in.', 'info');
          navigation.navigate('Login');
        } else {
          showToast(errorMessage, 'error');
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      // ✅ NEW: Also handle caught errors for "already exists"
      const errorMessage = error.message || 'Registration failed. Please try again.';
      
      if (errorMessage.includes('already exists') || errorMessage.includes('Conflict')) {
        
        // Clear any pending Google auth data
        if (isGoogleUser) {
          clearPendingGoogleAuth();
        }
        
        showToast('Account already exists. Please sign in.', 'info');
        navigation.navigate('Login');
      } else {
        showToast(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    key,
    placeholder,
    secureTextEntry = false,
    keyboardType = 'default',
    required = false,
    prefilled = false // NEW: Changed from "disabled" to "prefilled" to indicate it's editable
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {placeholder} {required && <Text style={styles.requiredAsterisk}>*</Text>}
        {prefilled && (
          <Text style={styles.prefilledLabel}> ✓ Pre-filled</Text>
        )}
      </Text>
      <TextInput
        style={[
          styles.input, 
          errors[key] && styles.inputError,
          prefilled && styles.inputPrefilled
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.gray400}
        value={formData[key]}
        onChangeText={(text) => {
          setFormData({ ...formData, [key]: text });
          if (errors[key]) {
            setErrors({ ...errors, [key]: null });
          }
        }}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={key === 'email' ? 'none' : 'words'}
        autoCorrect={false}
        editable={true} // CHANGED: Always editable now
        selectTextOnFocus={true} // CHANGED: Always allow text selection
      />
      {errors[key] && <Text style={styles.errorText}>{errors[key]}</Text>}
    </View>
  );

  const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

  // NEW: Organization Picker Button
  const OrgPickerButton = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        Current Company {skippedSteps && '(for referrals)'}
        {/* NEW: Show asterisk for experienced professionals */}
    {userType === 'JobSeeker' && experienceType === 'Experienced' && (
          <Text style={styles.requiredAsterisk}> *</Text>
        )}
      </Text>
      <TouchableOpacity style={[
styles.selectionButton,
        errors.currentCompany && styles.inputError
      ]} onPress={openOrgModal}>
        {formData.currentCompany ? (
          <View style={styles.companySelectorContent}>
       {formData.organizationId && (
     <View style={styles.companySelectorLogoPlaceholder}>
      <Ionicons name="business" size={16} color={colors.gray400} />
       </View>
            )}
            <Text style={styles.selectionValue}>
     {formData.currentCompany}
   </Text>
 </View>
        ) : (
       <Text style={[styles.selectionValue, styles.selectionPlaceholder]}>
        Select or search company
          </Text>
)}
        <Ionicons name="chevron-down" size={20} color={colors.gray500} />
      </TouchableOpacity>
      {errors.currentCompany && (
        <Text style={styles.errorText}>{errors.currentCompany}</Text>
      )}
    </View>
  );

  return (
    <RegistrationWrapper
      currentStep={4}
      totalSteps={4}
      stepLabel="Create your account"
      onBack={() => navigation.goBack()}
    >
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.header}>
            
            {/* Show Google user info if applicable */}
            {isGoogleUser && googleUser && (
              <View style={styles.googleUserInfo}>
                {googleUser.picture && (
                  <Image 
                    source={{ uri: googleUser.picture }} 
                    style={styles.googleUserAvatar}
                  />
                )}
                <View style={styles.googleUserTextContainer}>
                  <Text style={styles.googleUserWelcome}>
                    ✅ Google Account Connected
                  </Text>
                  <Text style={styles.googleUserName}>{googleUser.name}</Text>
                  <Text style={styles.googleUserEmail}>{googleUser.email}</Text>
                  <Text style={styles.googleUserNote}>
                    Your basic info has been pre-filled from Google
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              </View>
            )}
            
            <Text style={styles.title}>
              {isGoogleUser ? 'Complete Your Profile' : 'Create your account'}
            </Text>
            <Text style={styles.subtitle}>
              {isGoogleUser 
                ? 'Just a few more details and you\'re all set!'
                : 'Just a few more details and you\'re all set!'
              }
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                {renderInput('firstName', 'First Name', false, 'default', true, isGoogleUser)}
              </View>
              <View style={styles.halfInput}>
                {renderInput('lastName', 'Last Name', false, 'default', true, isGoogleUser)}
              </View>
            </View>

            {/* Email field with inline verify button */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Email Address <Text style={styles.requiredAsterisk}>*</Text>
                {isGoogleUser && <Text style={styles.prefilledLabel}> ✓ Pre-filled</Text>}
              </Text>
              <View style={styles.emailRow}>
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1 },
                    errors.email && styles.inputError,
                    isGoogleUser && styles.inputPrefilled,
                    emailVerified && { borderColor: colors.success, borderWidth: 1.5 },
                  ]}
                  placeholder="Email Address"
                  placeholderTextColor={colors.gray400}
                  value={formData.email}
                  onChangeText={(text) => {
                    setFormData({ ...formData, email: text });
                    if (errors.email) setErrors({ ...errors, email: null });
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={true}
                />
                {!isGoogleUser && !showOtpInput && (
                  emailVerified ? (
                    <View style={styles.emailVerifiedInline}>
                      <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.verifyEmailButtonInline,
                        (!validateEmail(formData.email.trim()) || otpLoading) && styles.verifyEmailButtonDisabled
                      ]}
                      onPress={handleSendOTP}
                      disabled={!validateEmail(formData.email.trim()) || otpLoading}
                    >
                      {otpLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.verifyEmailButtonText}>Verify</Text>
                      )}
                    </TouchableOpacity>
                  )
                )}
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>
            
            {/* EMAIL VERIFICATION OTP input */}
            {!isGoogleUser && showOtpInput && !emailVerified && (
                  <View style={styles.otpSection}>
                    <Text style={styles.otpLabel}>Enter the 4-digit code sent to your email</Text>
                    <View style={styles.otpRow}>
                      <TextInput
                        style={styles.otpInput}
                        placeholder="0000"
                        placeholderTextColor={colors.gray500}
                        value={otpCode}
                        onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 4))}
                        keyboardType="number-pad"
                        maxLength={4}
                        autoFocus={true}
                      />
                      <TouchableOpacity
                        style={[
                          styles.verifyOtpButton,
                          (otpCode.length !== 4 || otpLoading) && styles.verifyEmailButtonDisabled
                        ]}
                        onPress={handleVerifyOTP}
                        disabled={otpCode.length !== 4 || otpLoading}
                      >
                        {otpLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.verifyEmailButtonText}>Verify</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={handleSendOTP}
                      disabled={otpCooldown > 0 || otpLoading}
                      style={{ marginTop: 8 }}
                    >
                      <Text style={[styles.resendText, otpCooldown > 0 && { color: colors.gray500 }]}>
                        {otpCooldown > 0 ? `Resend code in ${otpCooldown}s` : 'Resend code'}
                      </Text>
                    </TouchableOpacity>
                  </View>
            )}

            {/* 🎁 NEW: Invite Code Input (Optional) */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Invite Code (Optional)
              </Text>
              <View style={styles.referralCodeContainer}>
                <Ionicons name="gift-outline" size={20} color={colors.primary} style={styles.referralCodeIcon} />
                <TextInput
                  style={[styles.input, styles.referralCodeInput, errors.referralCode && styles.inputError]}
                  placeholder="Enter invite code"
                  placeholderTextColor={colors.gray400}
                  value={formData.referralCode}
                  onChangeText={(text) => {
                    // Convert to uppercase and remove spaces
                    const cleanCode = text.toUpperCase().replace(/\s/g, '');
                    setFormData({ ...formData, referralCode: cleanCode });
                    if (errors.referralCode) {
                      setErrors({ ...errors, referralCode: null });
                    }
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
                />
              </View>
              {errors.referralCode && (
                <Text style={styles.errorText}>{errors.referralCode}</Text>
              )}
              <View style={styles.referralCodeHint}>
                <Ionicons name="information-circle-outline" size={14} color={colors.success} />
                <Text style={styles.referralCodeHintText}>
                  Have an invite code? Get ₹25 bonus when you sign up!
                </Text>
              </View>
            </View>
            
            {/* Only show password fields for non-Google users */}
            {!isGoogleUser && (
              <>
                {renderInput('password', 'Password (8+ characters)', true, 'default', true)}
                {renderInput('confirmPassword', 'Confirm Password', true, 'default', true)}
              </>
            )}
            
            {renderInput('phone', 'Phone Number', false, 'phone-pad')}
            
            {/* ✅ REPLACED: DatePicker instead of manual input */}
            <DatePicker
              label="Date of Birth"
              value={formData.dateOfBirth}
              onChange={(date) => {
                setFormData({ ...formData, dateOfBirth: date });
                if (errors.dateOfBirth) {
                  setErrors({ ...errors, dateOfBirth: null });
                }
              }}
              placeholder="Select your date of birth"
              maximumDate={new Date()} // Can't be born in the future
              error={errors.dateOfBirth}
              colors={colors}
            />
            
            {renderInput('location', 'Current Location', false, 'default')}

            {/* NEW: Current Company Dropdown - Always show for experienced professionals */}
            {(() => {
            // Don't show for students
              if (userType !== 'JobSeeker' || experienceType === 'Student') return null;

  // For experienced professionals, always show the field
       // It will be pre-filled if coming from work experience flow
         return <OrgPickerButton />;
       })()}

            {/* NEW: Show jobTitle and startDate fields only when company is selected */
            userType === 'JobSeeker' && experienceType !== 'Student' && (formData.currentCompany || formData.organizationId) && (
              <>
                <View style={styles.companyFieldsNotice}>
                  <Ionicons name="information-circle" size={16} color={colors.info} />
                  <Text style={styles.companyFieldsNoticeText}>
                    Please provide your role details at {formData.currentCompany}
                  </Text>
                </View>
                
                {/* Job Title with searchable dropdown */}
                <View style={[styles.inputContainer, { position: 'relative', zIndex: 1000 }]}>
                  <Text style={styles.inputLabel}>
                    Job Title <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input, 
                      errors.jobTitle && styles.inputError
                    ]}
                    placeholder="e.g., Software Engineer, Marketing Manager"
                    placeholderTextColor={colors.gray400}
                    value={jobTitleSearch || formData.jobTitle}
                    onChangeText={(text) => {
                      setJobTitleSearch(text);
                      setFormData({ ...formData, jobTitle: text });
                      setShowJobTitleDropdown(text.length > 0);
                      if (errors.jobTitle) {
                        setErrors({ ...errors, jobTitle: null });
                      }
                    }}
                    onFocus={() => {
                      if (formData.jobTitle) {
                        setJobTitleSearch('');
                      }
                    }}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                  {showJobTitleDropdown && jobTitleSearch.length > 0 && (
                    <View style={styles.dropdownContainer}>
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
                                  setFormData({ ...formData, jobTitle: role.Value });
                                  setJobTitleSearch('');
                                  setShowJobTitleDropdown(false);
                                  if (errors.jobTitle) {
                                    setErrors({ ...errors, jobTitle: null });
                                  }
                                }}
                              >
                                <Text style={styles.dropdownItemText}>{role.Value}</Text>
                              </TouchableOpacity>
                            ))
                          }
                          {jobRoles.filter(role => role.Value && role.Value.toLowerCase().includes(jobTitleSearch.toLowerCase())).length === 0 && (
                            <View style={styles.dropdownEmpty}>
                              <Text style={styles.dropdownEmptyText}>No matches - keep typing</Text>
                            </View>
                          )}
                        </ScrollView>
                      )}
                    </View>
                  )}
                  {errors.jobTitle && <Text style={styles.errorText}>{errors.jobTitle}</Text>}
                </View>
                
                {/* ✅ REPLACED: DatePicker for start date */}
                <View style={{ position: 'relative', zIndex: 1 }}>
                  <DatePicker
                    label="Start Date"
                    value={formData.startDate}
                    onChange={(date) => {
                      setFormData({ ...formData, startDate: date });
                      if (errors.startDate) {
                        setErrors({ ...errors, startDate: null });
                      }
                    }}
                    placeholder="Select start date"
                    maximumDate={new Date()} // Can't start in the future
                    required={true}
                    error={errors.startDate}
                    colors={colors}
                  />
                </View>
              </>
            )}

            {/* Gender Selection */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Gender (Optional)</Text>
              <View style={styles.genderContainer}>
                {genderOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.genderButton,
                      formData.gender === option && styles.genderButtonActive
                    ]}
                    onPress={() => setFormData({ ...formData, gender: option })}
                  >
                    <Text style={[
                      styles.genderButtonText,
                      formData.gender === option && styles.genderButtonTextActive
                    ]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Summary of selections */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Your Profile Summary</Text>
            <View style={styles.summaryItem}>
              <Ionicons name="person" size={16} color={colors.primary} />
              <Text style={styles.summaryText}>
                {experienceType === 'Student' ? 'Student' : 'Experienced Professional'}
              </Text>
            </View>
            
            {/* 🔧 FIXED: Show current company if filled - ONLY for experienced professionals */}
            {experienceType !== 'Student' && formData.currentCompany && (
              <View style={styles.summaryItem}>
                <Ionicons name="business" size={16} color={colors.primary} />
                <Text style={styles.summaryText}>
                  {formData.jobTitle ? `${formData.jobTitle} at ${formData.currentCompany}` : `Currently at ${formData.currentCompany}`}
                </Text>
              </View>
            )}
            
            {/* 🔧 IMPROVED: Show ALL work experiences (handle both array and single object) */}
            {(() => {
              // Normalize to array
              const experiences = Array.isArray(workExperienceData) 
                ? workExperienceData 
                : (workExperienceData ? [workExperienceData] : []);

              return experiences.map((exp, index) => {
                if (!exp.companyName && !exp.jobTitle) return null;
                
                return (
                  <React.Fragment key={index}>
                    <View style={styles.summaryItem}>
                      <Ionicons name="briefcase" size={16} color={colors.primary} />
                      <Text style={styles.summaryText}>
                        {(exp.jobTitle || 'Professional')} at {exp.companyName || 'Company'}
                        {exp.isCurrentPosition ? ' (Current)' : ' (Previous)'}
                      </Text>
                    </View>
                    {exp.startDate && (
                      <View style={styles.summaryItem}>
                        <Ionicons name="calendar" size={16} color={colors.primary} />
                        <Text style={styles.summaryText}>
                          {exp.startDate}
                          {exp.endDate ? ` - ${exp.endDate}` : ' - Present'}
                        </Text>
                      </View>
                    )}
                    {exp.workArrangement && (
                      <View style={styles.summaryItem}>
                        <Ionicons name="business" size={16} color={colors.primary} />
                        <Text style={styles.summaryText}>
                          {exp.workArrangement} • {exp.jobType || 'Full-time'}
                        </Text>
                      </View>
                    )}
                  </React.Fragment>
                );
              });
            })()}
            
            {educationData && (
              <>
                <View style={styles.summaryItem}>
                  <Ionicons name="school" size={16} color={colors.primary} />
                  <Text style={styles.summaryText}>
                    {educationData.college?.name || educationData.customCollege}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Ionicons name="library" size={16} color={colors.primary} />
                  <Text style={styles.summaryText}>
                    {educationData.degreeType} in {educationData.fieldOfStudy}
                  </Text>
                </View>
              </>
            )}
            
            {jobPreferences && (
              <>
                {/* 🔧 Add null check for preferredJobTypes array */}
                {jobPreferences.preferredJobTypes && Array.isArray(jobPreferences.preferredJobTypes) && jobPreferences.preferredJobTypes.length > 0 && (
                  <View style={styles.summaryItem}>
                    <Ionicons name="briefcase" size={16} color={colors.primary} />
                    <Text style={styles.summaryText}>
                      {jobPreferences.preferredJobTypes.map(jt => jt?.Type || jt).filter(Boolean).join(', ')}
                    </Text>
                  </View>
                )}
                
                {/* 🔧 Add null check for workplaceType */}
                {jobPreferences.workplaceType && (
                  <View style={styles.summaryItem}>
                    <Ionicons name="location" size={16} color={colors.primary} />
                    <Text style={styles.summaryText}>
                      {jobPreferences.workplaceType === 'remote' ? 'Remote' : 
                       jobPreferences.workplaceType === 'hybrid' ? 'Hybrid' : 'On-site'} work
                    </Text>
                  </View>
                )}
                
                {/* 🔧 Add null check for preferredLocations */}
                {jobPreferences.preferredLocations && Array.isArray(jobPreferences.preferredLocations) && jobPreferences.preferredLocations.length > 0 && (
                  <View style={styles.summaryItem}>
                    <Ionicons name="map" size={16} color={colors.primary} />
                    <Text style={styles.summaryText}>
                      Locations: {jobPreferences.preferredLocations.map(loc => loc?.name || loc).filter(Boolean).join(', ')}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Terms & Privacy Policy Consent */}
          <View style={styles.consentContainer}>
            <TouchableOpacity
              style={styles.consentCheckboxRow}
              onPress={() => {
                setTermsAccepted(!termsAccepted);
                if (errors.termsAccepted) {
                  setErrors(prev => ({ ...prev, termsAccepted: null }));
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[
                styles.consentCheckbox,
                termsAccepted && styles.consentCheckboxChecked,
                errors.termsAccepted && styles.consentCheckboxError,
              ]}>
                {termsAccepted && (
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                )}
              </View>
              <Text style={styles.consentText}>
                I agree to the{' '}
                <Text
                  style={styles.consentLink}
                  onPress={(e) => {
                    e.stopPropagation && e.stopPropagation();
                    navigation.navigate('Terms');
                  }}
                >
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text
                  style={styles.consentLink}
                  onPress={(e) => {
                    e.stopPropagation && e.stopPropagation();
                    navigation.navigate('PrivacyPolicy');
                  }}
                >
                  Privacy Policy
                </Text>
              </Text>
            </TouchableOpacity>
            {errors.termsAccepted && (
              <Text style={styles.consentErrorText}>{errors.termsAccepted}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.registerButton, (loading || !termsAccepted) && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.registerButtonText}>
              {loading 
                ? (isGoogleUser ? 'Completing Profile...' : 'Creating Account...') 
                : (isGoogleUser ? 'Complete Profile' : 'Create Account')
              }
            </Text>
            {!loading && <Ionicons name="checkmark" size={20} color={colors.white} />}
          </TouchableOpacity>

          {/* Only show login link for non-Google users */}
          {!isGoogleUser && (
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginButtonText}>
                Already have an account? Sign In
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* NEW: COMPANY PICKER MODAL (similar to WorkExperienceScreen) */}
      <Modal
        visible={showOrgModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOrgModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalInnerContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowOrgModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Company</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="search" size={18} color={colors.gray600} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder={manualOrgMode ? 'Enter company name' : 'Search companies...'}
              placeholderTextColor={colors.gray400}
              value={orgQuery}
              onChangeText={setOrgQuery}
              autoCapitalize="words"
            />
            {manualOrgMode ? (
              <TouchableOpacity
                onPress={() => {
                  const name = (orgQuery || '').trim();
                  if (!name) { showToast('Type your company name above', 'error'); return; }
                  setFormData(prev => ({
                    ...prev,
                    organizationId: null,
                    currentCompany: name,
                    // Keep jobTitle and startDate so user can fill them
                  }));
                  setShowOrgModal(false);
                }}
              >
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              </TouchableOpacity>
            ) : (orgLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <TouchableOpacity onPress={() => setOrgQuery(orgQuery)}>
                <Ionicons name="refresh" size={18} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Manual toggle */}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}
            onPress={() => setManualOrgMode(v => !v)}
          >
            <Ionicons name={manualOrgMode ? 'checkbox-outline' : 'square-outline'} size={18} color={colors.primary} />
            <Text style={{ color: colors.text, marginLeft: 8 }}>My company is not listed</Text>
          </TouchableOpacity>

          {!manualOrgMode && (
            <FlatList
              data={orgResults}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectOrganization(item)}>
                  {/* Company Logo */}
                  {item.logoURL ? (
                    <Image
                      source={{ uri: item.logoURL }}
                      style={styles.companyLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.companyLogoPlaceholder}>
                      <Ionicons name="business" size={20} color={colors.gray400} />
                    </View>
                  )}
                  
                  <View style={styles.companyInfo}>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    {item.industry && item.industry !== 'Other' && (
                      <Text style={[styles.modalItemText, { color: colors.gray500, fontSize: typography.sizes.xs }]}>
                        {item.industry}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.gray500} />
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews
              windowSize={8}
            />
          )}
          </View>
        </View>
      </Modal>
    </RegistrationWrapper>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 8,
  },
  header: {
    marginBottom: 20,
  },
  // Google user info card
  googleUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  googleUserAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  googleUserTextContainer: {
    flex: 1,
  },
  googleUserWelcome: {
    fontSize: 13,
    fontWeight: '700',
    color: '#22C55E',
    marginBottom: 4,
  },
  googleUserName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 2,
  },
  googleUserEmail: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  googleUserNote: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginBottom: 24,
    lineHeight: 22,
  },
  form: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 0,
    paddingTop: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  halfInput: {
    flex: 1,
    marginRight: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requiredAsterisk: {
    color: '#EF4444',
    fontWeight: '700',
  },
  prefilledLabel: {
    color: '#22C55E',
    fontWeight: '400',
    fontSize: 11,
    textTransform: 'none',
  },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#F1F5F9',
  },
  inputPrefilled: {
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
    borderWidth: 1,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 4,
  },
  // Referral code styles
  referralCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  referralCodeIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  referralCodeInput: {
    flex: 1,
    paddingLeft: 40,
    fontWeight: '700',
    letterSpacing: 1,
  },
  referralCodeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.15)',
  },
  referralCodeHintText: {
    fontSize: 12,
    color: '#22C55E',
    marginLeft: 6,
    flex: 1,
  },
  // Email verification styles
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emailVerifiedInline: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  verifyEmailButtonInline: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emailVerifyContainer: {
    marginTop: -8,
    marginBottom: 12,
  },
  emailVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  emailVerifiedText: {
    fontSize: 13,
    color: '#22C55E',
    fontWeight: '600',
    marginLeft: 6,
  },
  verifyEmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  verifyEmailButtonDisabled: {
    opacity: 0.5,
  },
  verifyEmailButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  otpSection: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  otpLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 10,
    textAlign: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  otpInput: {
    flex: 1,
    maxWidth: 160,
    minWidth: 130,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 6,
    color: '#F1F5F9',
    textAlign: 'center',
  },
  verifyOtpButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  resendText: {
    fontSize: 13,
    color: '#3B82F6',
    textAlign: 'center',
  },
  // Welcome Bonus Banner
  welcomeBonusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  welcomeBonusIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  welcomeBonusContent: {
    flex: 1,
  },
  welcomeBonusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#22C55E',
    marginBottom: 4,
  },
  welcomeBonusText: {
    fontSize: 13,
    color: '#F1F5F9',
    lineHeight: 20,
  },
  welcomeBonusAmount: {
    fontWeight: '700',
    color: '#FFD700',
    fontSize: 15,
  },
  welcomeBonusSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  selectionButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionValue: {
    fontSize: 15,
    color: '#F1F5F9',
  },
  selectionPlaceholder: {
    color: '#64748B',
  },
  genderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  genderButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  genderButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3B82F6',
  },
  genderButtonText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '500',
  },
  genderButtonTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  companyFieldsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  companyFieldsNoticeText: {
    fontSize: 13,
    color: '#3B82F6',
    marginLeft: 8,
  },
  summaryContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 24,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryText: {
    fontSize: 15,
    color: '#F1F5F9',
    marginLeft: 8,
  },
  registerButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  registerButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    marginRight: 8,
  },
  buttonDisabled: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
  },
  loginButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 14,
    color: '#3B82F6',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0F172A',
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      paddingTop: 0,
      zIndex: 9999,
    } : {}),
  },
  modalInnerContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      flex: 'none',
      width: '100%',
      maxWidth: 600,
      height: '80vh',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      borderWidth: 1,
      borderColor: 'rgba(148, 163, 184, 0.1)',
    } : {}),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
    textAlign: 'center',
  },
  modalItem: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.08)',
  },
  modalItemText: {
    fontSize: 15,
    color: '#F1F5F9',
  },
  companyLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  companyLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyInfo: {
    flex: 1,
  },
  companySelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  companySelectorLogoPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Job title dropdown styles
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 250,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
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
    borderBottomColor: 'rgba(148, 163, 184, 0.08)',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#F1F5F9',
  },
  dropdownEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    fontSize: 14,
    color: '#64748B',
    fontStyle: 'italic',
  },
  // Terms & Conditions consent styles
  consentContainer: {
    marginTop: 20,
    marginBottom: 4,
  },
  consentCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  consentCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  consentCheckboxChecked: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  consentCheckboxError: {
    borderColor: '#EF4444',
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 20,
  },
  consentLink: {
    color: '#3B82F6',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  consentErrorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 32,
  },
});