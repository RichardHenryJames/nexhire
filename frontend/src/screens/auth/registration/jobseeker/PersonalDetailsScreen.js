import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../contexts/AuthContext';
import { colors, typography } from '../../../../styles/theme';

export default function PersonalDetailsScreen({ navigation, route }) {
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

  const { register } = useAuth();
  const { userType, experienceType, educationData, jobPreferences } = route.params;

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
      // Prepare comprehensive registration data
      const registrationData = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        userType: userType,
        ...(formData.phone && { phone: formData.phone.trim() }),
        ...(formData.dateOfBirth && { dateOfBirth: new Date(formData.dateOfBirth) }),
        ...(formData.gender && { gender: formData.gender }),
        
        // Include all the collected data for profile completion
        experienceType,
        ...(educationData && { educationData }),
        ...(jobPreferences && { jobPreferences }),
        ...(formData.location && { location: formData.location.trim() }),
      };

      console.log('Registration data:', registrationData);

      const result = await register(registrationData);
      
      if (result.success) {
        Alert.alert(
          'Success', 
          'Account created successfully! Welcome to NexHire!', 
          [
            { 
              text: 'Get Started', 
              onPress: () => {
                // Navigate to the main app
                // The AuthContext will handle navigation automatically
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
    required = false
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {placeholder} {required && '*'}
      </Text>
      <TextInput
        style={[styles.input, errors[key] && styles.inputError]}
        placeholder={`Enter ${placeholder.toLowerCase()}`}
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
            
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Just a few more details and you're all set!
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                {renderInput('firstName', 'First Name', false, 'default', true)}
              </View>
              <View style={styles.halfInput}>
                {renderInput('lastName', 'Last Name', false, 'default', true)}
              </View>
            </View>

            {renderInput('email', 'Email Address', false, 'email-address', true)}
            {renderInput('password', 'Password (8+ characters)', true, 'default', true)}
            {renderInput('confirmPassword', 'Confirm Password', true, 'default', true)}
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
                <View style={styles.summaryItem}>
                  <Ionicons name="briefcase" size={16} color={colors.primary} />
                  <Text style={styles.summaryText}>
                    {jobPreferences.preferredJobTypes.map(jt => jt.Type).join(', ')}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Ionicons name="location" size={16} color={colors.primary} />
                  <Text style={styles.summaryText}>
                    {jobPreferences.workplaceType === 'remote' ? 'Remote' : 
                     jobPreferences.workplaceType === 'hybrid' ? 'Hybrid' : 'On-site'} work
                  </Text>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.registerButtonText}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
            {!loading && <Ionicons name="checkmark" size={20} color={colors.white} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>
              Already have an account? Sign In
            </Text>
          </TouchableOpacity>
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
  input: {
    backgroundColor: colors.surface,
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