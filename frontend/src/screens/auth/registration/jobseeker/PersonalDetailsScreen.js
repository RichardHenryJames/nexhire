import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../contexts/AuthContext';
import { colors, typography } from '../../../../styles/theme';
import refopenAPI from '../../../../services/api';
import DatePicker from '../../../../components/DatePicker';

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
  const { register, pendingGoogleAuth, clearPendingGoogleAuth } = useAuth();
  
  // 🔧 DEBUG: Log when component mounts
  console.log('📱 PersonalDetailsScreen mounted!');
  console.log('📍 Route params:', route?.params);
  
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
    skippedSteps = false, // 🔧 NEW: Check if user skipped from UserTypeSelection
  } = routeParams;

  console.log('🔧 PersonalDetailsScreen config:', {
    userType,
    experienceType,
    fromGoogleAuth,
    skippedSteps,
    hasWorkData: !!workExperienceData,
    workDataType: Array.isArray(workExperienceData) ? 'array' : typeof workExperienceData,
    workDataCount: Array.isArray(workExperienceData) ? workExperienceData.length : (workExperienceData ? 1 : 0),
    hasEducationData: !!educationData,
    hasJobPreferences: !!jobPreferences
  });

  // 🔧 Check if this is a Google user
  const isGoogleUser = fromGoogleAuth || pendingGoogleAuth;
  const googleUser = pendingGoogleAuth?.user;

  console.log('👤 Google user status:', {
    isGoogleUser,
    hasGoogleUser: !!googleUser,
    googleUserEmail: googleUser?.email
  });

  // NEW: Guard against hard refresh with lost Google data
  useEffect(() => {
    if (fromGoogleAuth && !pendingGoogleAuth && !googleUser) {
      console.warn('⚠️ Hard refresh detected with lost Google data - redirecting to login');
      
      // 🔧 For web: Use window.location for reliable redirect
      if (typeof window !== 'undefined') {
        console.log('🌐 Using window.location redirect for web');
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

  // NEW: Organization picker state
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgQuery, setOrgQuery] = useState('');
  const debouncedOrgQuery = useDebounce(orgQuery, 300);
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [manualOrgMode, setManualOrgMode] = useState(false);

  // Pre-populate Google user data
  useEffect(() => {
    if (isGoogleUser && googleUser) {
      console.log('🔧 Pre-populating Google user data:', googleUser);
      
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
      console.log('🔧 Pre-filling current company from work experience:', currentExp);
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
        const res = await refopenAPI.getOrganizations(debouncedOrgQuery || '');
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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    return password.length >= 8;
  };

  const validatePhoneNumber = (phone) => {
    if (!phone) return true; // Optional field
    const phoneRegex = /^\+?[\d\s\-()]+$/;
    return phoneRegex.test(phone);
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before continuing');
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
        console.log('🔧 Creating work experience from skip flow company data');
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

      // COMPREHENSIVE LOGGING FOR DEBUGGING
      console.log('=== REGISTRATION PAYLOAD DEBUG ===');
      console.log('Is Google User:', isGoogleUser);
      console.log('Email:', registrationData.email);
      console.log('User Type:', registrationData.userType);
      console.log('Experience Type:', registrationData.experienceType);
      console.log('Has Google Auth Data:', !!registrationData.googleAuth);
      console.log('Skipped Steps:', skippedSteps);
      console.log('Current Company:', formData.currentCompany);
      console.log('Organization ID:', formData.organizationId);
      
      if (registrationData.workExperienceData) {
        console.log('Work Experience Data (Array):', JSON.stringify(registrationData.workExperienceData, null, 2));
        console.log('Work Experience Count:', registrationData.workExperienceData.length);
      }
      
      if (educationData) {
        console.log('Education Data:', educationData);
      }
      
      if (jobPreferences) {
        console.log('Job Preferences:', jobPreferences);
      }
      
      console.log('Complete Registration Payload:', JSON.stringify(registrationData, null, 2));
      console.log('=== END REGISTRATION PAYLOAD DEBUG ===');

      const result = await register(registrationData);
      
      if (result.success) {
        Alert.alert(
          'Success', 
          isGoogleUser 
            ? 'Your Google account has been linked successfully! Welcome to RefOpen!'
            : 'Account created successfully! Welcome to RefOpen!',
          [
            { 
              text: 'Get Started', 
              onPress: () => {
                // FIXED: No manual navigation needed!
                // The AuthContext will automatically handle navigation
                // when isAuthenticated becomes true after successful registration
                console.log('🔧 Registration successful, AuthContext will handle navigation automatically');
              }
            }
          ]
        );

        // Clear pending Google auth data
        if (isGoogleUser) {
          console.log('🔧 Clearing pending Google auth data after successful registration');
          clearPendingGoogleAuth();
        }
      } else {
        // ✅ NEW: Check if error is "User already exists"
        const errorMessage = result.error || 'Unable to create account. Please try again.';
        
        if (errorMessage.includes('already exists') || errorMessage.includes('Conflict')) {
          console.log('⚠️ User already exists error - clearing auth data and redirecting to login');
          
          // Clear any pending Google auth data
          if (isGoogleUser) {
            clearPendingGoogleAuth();
          }
          
          Alert.alert(
            'Account Already Exists', 
            `An account with ${formData.email} already exists. Would you like to sign in instead?`,
            [
              { 
                text: 'Cancel', 
                style: 'cancel'
              },
              { 
                text: 'Sign In', 
                onPress: () => {
                  // Navigate to login screen
                  if (typeof window !== 'undefined') {
                    // For web
                    window.location.href = '/login';
                  } else {
                    // For native
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'Login' }],
                    });
                  }
                }
              }
            ]
          );
        } else {
          Alert.alert('Registration Failed', errorMessage);
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      // ✅ NEW: Also handle caught errors for "already exists"
      const errorMessage = error.message || 'Registration failed. Please try again.';
      
      if (errorMessage.includes('already exists') || errorMessage.includes('Conflict')) {
        console.log('⚠️ User already exists error (caught) - clearing auth data and redirecting to login');
        
        // Clear any pending Google auth data
        if (isGoogleUser) {
          clearPendingGoogleAuth();
        }
        
        Alert.alert(
          'Account Already Exists', 
          `An account with ${formData.email} already exists. Would you like to sign in instead?`,
          [
            { 
              text: 'Cancel', 
              style: 'cancel'
            },
            { 
              text: 'Sign In', 
              onPress: () => {
                // Navigate to login screen
                if (typeof window !== 'undefined') {
                  // For web
                  window.location.href = '/login';
                } else {
                  // For native
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', errorMessage);
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
      </Text>
      <TouchableOpacity style={styles.selectionButton} onPress={openOrgModal}>
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
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            
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

            {renderInput('email', 'Email Address', false, 'email-address', true, isGoogleUser)}
            
            {/* 🎁 NEW: Referral Code Input (Optional) */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Referral Code (Optional)
              </Text>
              <View style={styles.referralCodeContainer}>
                <Ionicons name="gift-outline" size={20} color={colors.primary} style={styles.referralCodeIcon} />
                <TextInput
                  style={[styles.input, styles.referralCodeInput, errors.referralCode && styles.inputError]}
                  placeholder="Enter referral code"
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
                  Have a referral code? Get ₹50 bonus when you sign up!
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
            />
            
            {renderInput('location', 'Current Location', false, 'default')}

            {/* NEW: Current Company Dropdown - ONLY show if NOT already captured AND for experienced professionals */}
            {(() => {
              // Don't show for students
              if (userType !== 'JobSeeker' || experienceType === 'Student') return null;

              // Check if current company already captured from work experience flow
              const experiences = Array.isArray(workExperienceData) 
                ? workExperienceData 
                : (workExperienceData ? [workExperienceData] : []);
              
              const hasCurrentCompany = experiences.some(exp => exp.isCurrentPosition && exp.companyName);

              // Only show for skip flow users (no work experience data) OR if company field is being filled
              if (!hasCurrentCompany || formData.currentCompany) {
                return <OrgPickerButton />;
              }

              return null;
            })()}

            {/* NEW: Show jobTitle and startDate fields only when company is selected */}
            {userType === 'JobSeeker' && experienceType !== 'Student' && (formData.currentCompany || formData.organizationId) && (
              <>
                <View style={styles.companyFieldsNotice}>
                  <Ionicons name="information-circle" size={16} color={colors.primary} />
                  <Text style={styles.companyFieldsNoticeText}>
                    Please provide your role details at {formData.currentCompany}
                  </Text>
                </View>
                
                {renderInput('jobTitle', 'Job Title', false, 'default', true)}
                
                {/* ✅ REPLACED: DatePicker for start date */}
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
                />
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

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.buttonDisabled]}
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
              value={orgQuery}
              onChangeText={setOrgQuery}
              autoCapitalize="words"
            />
            {manualOrgMode ? (
              <TouchableOpacity
                onPress={() => {
                  const name = (orgQuery || '').trim();
                  if (!name) { Alert.alert('Enter company name', 'Type your company name above'); return; }
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
                    {item.website && (
                      <Text style={[styles.modalItemText, { color: colors.gray600, fontSize: typography.sizes.sm }]}
                      >
                        {item.website}
                      </Text>
                    )}
                    {item.industry && (
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
      </Modal>
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
    paddingTop: 20,
  },
  header: {
    marginBottom: 24, // CHANGED: Reduced from 32 to 24
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 16,
  },
  // 🔧 Google user info styles
  googleUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 20,
    backgroundColor: colors.success + '10',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.success,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  googleUserAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
    borderWidth: 2,
    borderColor: colors.success,
  },
  googleUserTextContainer: {
    flex: 1,
  },
  googleUserWelcome: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.success,
    marginBottom: 4,
  },
  googleUserName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  googleUserEmail: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 4,
  },
  googleUserNote: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    fontStyle: 'italic',
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    marginBottom: 24,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20, // CHANGED: Reduced from 24 to 20
    paddingTop: 24, // CHANGED: Reduced from 32 to 24
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray600,
  },
  requiredAsterisk: {
    color: colors.danger,
    fontWeight: typography.weights.bold,
  },
  prefilledLabel: {
    color: colors.success,
    fontWeight: typography.weights.normal,
    fontSize: typography.sizes.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  inputPrefilled: {
    backgroundColor: colors.success + '08', // Very light green background
    borderColor: colors.success,
    borderWidth: 1.5,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    marginTop: 4,
  },
  // 🎁 NEW: Referral code styles
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
    paddingLeft: 40, // Make room for the icon
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  referralCodeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: colors.success + '10',
    padding: 8,
    borderRadius: 6,
  },
  referralCodeHintText: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    marginLeft: 6,
    flex: 1,
  },
  selectionButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionValue: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  selectionPlaceholder: {
    color: colors.gray500,
  },
  genderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  genderButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  genderButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genderButtonText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
    textAlign: 'center',
    fontWeight: typography.weights.medium,
  },
  genderButtonTextActive: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
  companyFieldsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info + '10',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  companyFieldsNoticeText: {
    fontSize: typography.sizes.sm,
    color: colors.info,
    marginLeft: 8,
  },
  summaryContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    marginTop: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    marginLeft: 8,
  },
  registerButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerButtonText: {
    fontSize: typography.sizes.md,
    color: colors.white,
    fontWeight: typography.weights.bold,
    marginRight: 8,
  },
  buttonDisabled: {
    backgroundColor: colors.gray400,
  },
  loginButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
  },
  modalItem: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemText: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  companyLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  companyLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
});