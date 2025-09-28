import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../contexts/AuthContext';
import { colors, typography } from '../../../../styles/theme';

export default function PersonalDetailsScreen({ navigation, route }) {
  const { register, pendingGoogleAuth } = useAuth();
  
  // ?? Add safety checks for route params
  const routeParams = route?.params || {};
  const { 
    userType = 'JobSeeker', 
    experienceType = 'Student', 
    workExperienceData = null, 
    educationData = null, 
    jobPreferences = null, 
    fromGoogleAuth = false, 
    skipEmailPassword = false 
  } = routeParams;

  // ?? Check if this is a Google user
  const isGoogleUser = fromGoogleAuth || pendingGoogleAuth;
  const googleUser = pendingGoogleAuth?.user;

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
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // ?? Pre-populate Google user data
  useEffect(() => {
    if (isGoogleUser && googleUser) {
      console.log('?? Pre-populating Google user data:', googleUser);
      
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

    // ?? Skip password validation for Google users
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
      // ?? Prepare registration data for Google vs regular users
      const registrationData = {
        email: formData.email.trim().toLowerCase(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        userType: userType,
        ...(formData.phone && { phone: formData.phone.trim() }),
        ...(formData.dateOfBirth && { dateOfBirth: new Date(formData.dateOfBirth) }),
        ...(formData.gender && { gender: formData.gender }),
        
        // Include all the collected data for profile completion
        experienceType,
        ...(workExperienceData && { workExperienceData }),
        ...(educationData && { educationData }),
        ...(jobPreferences && { jobPreferences }),
        ...(formData.location && { location: formData.location.trim() }),
      };

      // ?? Add password only for non-Google users
      if (!isGoogleUser) {
        registrationData.password = formData.password;
      }

      // ?? Add Google OAuth data if applicable
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

      // ?? COMPREHENSIVE LOGGING FOR DEBUGGING
      console.log('=== REGISTRATION PAYLOAD DEBUG ===');
      console.log('Is Google User:', isGoogleUser);
      console.log('Email:', registrationData.email);
      console.log('User Type:', registrationData.userType);
      console.log('Experience Type:', registrationData.experienceType);
      console.log('Has Google Auth Data:', !!registrationData.googleAuth);
      
      if (workExperienceData) {
        console.log('Work Experience Data:', {
          currentJobTitle: workExperienceData.currentJobTitle,
          currentCompany: workExperienceData.currentCompany,
          yearsOfExperience: workExperienceData.yearsOfExperience,
          primarySkills: workExperienceData.primarySkills,
          secondarySkills: workExperienceData.secondarySkills,
          summary: workExperienceData.summary,
          workArrangement: workExperienceData.workArrangement,
          jobType: workExperienceData.jobType
        });
      }
      
      if (educationData) {
        console.log('Education Data:', {
          college: educationData.college,
          customCollege: educationData.customCollege,
          degreeType: educationData.degreeType,
          fieldOfStudy: educationData.fieldOfStudy,
          yearInCollege: educationData.yearInCollege,
          selectedCountry: educationData.selectedCountry
        });
      }
      
      if (jobPreferences) {
        console.log('Job Preferences:', {
          preferredJobTypes: jobPreferences.preferredJobTypes,
          workplaceType: jobPreferences.workplaceType,
          preferredLocations: jobPreferences.preferredLocations
        });
      }
      
      console.log('Complete Registration Payload:', JSON.stringify(registrationData, null, 2));
      console.log('=== END REGISTRATION PAYLOAD DEBUG ===');

      const result = await register(registrationData);
      
      if (result.success) {
        Alert.alert(
          'Success', 
          isGoogleUser 
            ? 'Your Google account has been linked successfully! Welcome to NexHire!' 
            : 'Account created successfully! Welcome to NexHire!', 
          [
            { 
              text: 'Get Started', 
              onPress: () => {
                // ?? FIXED: No manual navigation needed!
                // The AuthContext will automatically handle navigation
                // when isAuthenticated becomes true after successful registration
                console.log('? Registration successful, AuthContext will handle navigation automatically');
              }
            }
          ]
        );
      } else {
        Alert.alert('Registration Failed', result.error || 'Unable to create account. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', error.message || 'Registration failed. Please try again.');
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
    disabled = false
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {placeholder} {required && '*'}
        {disabled && (
          <Text style={styles.disabledLabel}> - From Google Account</Text>
        )}
      </Text>
      <TextInput
        style={[
          styles.input, 
          errors[key] && styles.inputError,
          disabled && styles.inputDisabled
        ]}
        placeholder={disabled ? 'Pre-filled from Google' : `Enter ${placeholder.toLowerCase()}`}
        value={formData[key]}
        onChangeText={(text) => {
          if (!disabled) {
            setFormData({ ...formData, [key]: text });
            if (errors[key]) {
              setErrors({ ...errors, [key]: null });
            }
          }
        }}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={key === 'email' ? 'none' : 'words'}
        autoCorrect={false}
        editable={!disabled}
        selectTextOnFocus={!disabled}
      />
      {errors[key] && <Text style={styles.errorText}>{errors[key]}</Text>}
    </View>
  );

  const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

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
            
            {/* ?? Show Google user info if applicable */}
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
                    Completing profile for
                  </Text>
                  <Text style={styles.googleUserName}>{googleUser.name}</Text>
                  <Text style={styles.googleUserEmail}>{googleUser.email}</Text>
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
            
            {/* ?? Only show password fields for non-Google users */}
            {!isGoogleUser && (
              <>
                {renderInput('password', 'Password (8+ characters)', true, 'default', true)}
                {renderInput('confirmPassword', 'Confirm Password', true, 'default', true)}
              </>
            )}
            
            {renderInput('phone', 'Phone Number', false, 'phone-pad')}
            {renderInput('dateOfBirth', 'Date of Birth (YYYY-MM-DD)', false, 'numeric')}
            {renderInput('location', 'Current Location', false, 'default')}

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
            
            {workExperienceData && (
              <>
                <View style={styles.summaryItem}>
                  <Ionicons name="briefcase" size={16} color={colors.primary} />
                  <Text style={styles.summaryText}>
                    {workExperienceData.currentJobTitle} at {workExperienceData.currentCompany}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Ionicons name="time" size={16} color={colors.primary} />
                  <Text style={styles.summaryText}>
                    {workExperienceData.yearsOfExperience} experience
                  </Text>
                </View>
              </>
            )}
            
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
                {/* ?? Add null check for preferredJobTypes array */}
                {jobPreferences.preferredJobTypes && Array.isArray(jobPreferences.preferredJobTypes) && jobPreferences.preferredJobTypes.length > 0 && (
                  <View style={styles.summaryItem}>
                    <Ionicons name="briefcase" size={16} color={colors.primary} />
                    <Text style={styles.summaryText}>
                      {jobPreferences.preferredJobTypes.map(jt => jt?.Type || jt).filter(Boolean).join(', ')}
                    </Text>
                  </View>
                )}
                
                {/* ?? Add null check for workplaceType */}
                {jobPreferences.workplaceType && (
                  <View style={styles.summaryItem}>
                    <Ionicons name="location" size={16} color={colors.primary} />
                    <Text style={styles.summaryText}>
                      {jobPreferences.workplaceType === 'remote' ? 'Remote' : 
                       jobPreferences.workplaceType === 'hybrid' ? 'Hybrid' : 'On-site'} work
                    </Text>
                  </View>
                )}
                
                {/* ?? Add null check for preferredLocations */}
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
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 16,
  },
  // ?? Google user info styles
  googleUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.success,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  googleUserAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  googleUserTextContainer: {
    flex: 1,
  },
  googleUserWelcome: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 2,
  },
  googleUserName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  googleUserEmail: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    lineHeight: 22,
  },
  form: {
    gap: 20,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray600,
  },
  disabledLabel: {
    color: colors.success,
    fontWeight: typography.weights.normal,
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
  inputDisabled: {
    backgroundColor: colors.gray100,
    borderColor: colors.success,
    color: colors.gray700,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
  },
  genderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  genderButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  genderButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  genderButtonTextActive: {
    color: colors.white,
  },
  summaryContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  summaryText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    flex: 1,
  },
  registerButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: colors.gray400,
  },
  registerButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  loginButton: {
    alignItems: 'center',
    padding: 12,
  },
  loginButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
});