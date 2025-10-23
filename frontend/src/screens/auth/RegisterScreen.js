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
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography } from '../../styles/theme';
import DatePicker from '../../components/DatePicker';

export default function RegisterScreen({ navigation }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    userType: 'JobSeeker',
    phone: '',
    dateOfBirth: '',
    gender: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const { register } = useAuth();

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
    } else if (formData.firstName.length > 100) {
      newErrors.firstName = 'First name must be less than 100 characters';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    } else if (formData.lastName.length > 100) {
      newErrors.lastName = 'Last name must be less than 100 characters';
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
      // Prepare data according to backend schema
      const registrationData = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        userType: formData.userType,
        ...(formData.phone && { phone: formData.phone.trim() }),
        ...(formData.dateOfBirth && { dateOfBirth: new Date(formData.dateOfBirth) }),
        ...(formData.gender && { gender: formData.gender }),
      };

      const result = await register(registrationData);
      
      if (result.success) {
        Alert.alert('Success', 'Account created successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
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
    label,
    placeholder,
    secureTextEntry = false,
    keyboardType = 'default',
    multiline = false,
    required = false
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[styles.input, errors[key] && styles.inputError]}
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
        multiline={multiline}
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
        <View style={styles.form}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join NexHire to find your dream job or hire top talent</Text>

          {/* Required Fields */}
          {renderInput('firstName', 'First Name', 'e.g., John', false, 'default', false, true)}
          {renderInput('lastName', 'Last Name', 'e.g., Doe', false, 'default', false, true)}
          {renderInput('email', 'Email Address', 'e.g., john.doe@example.com', false, 'email-address', false, true)}
          {renderInput('password', 'Password', 'Minimum 8 characters', true, 'default', false, true)}
          {renderInput('confirmPassword', 'Confirm Password', 'Re-enter your password', true, 'default', false, true)}

          {/* User Type Selection */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              I am a: <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.userTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.userTypeButton,
                  formData.userType === 'JobSeeker' && styles.userTypeButtonActive
                ]}
                onPress={() => setFormData({ ...formData, userType: 'JobSeeker' })}
              >
                <Text style={[
                  styles.userTypeButtonText,
                  formData.userType === 'JobSeeker' && styles.userTypeButtonTextActive
                ]}>
                  Job Seeker
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.userTypeButton,
                  formData.userType === 'Employer' && styles.userTypeButtonActive
                ]}
                onPress={() => setFormData({ ...formData, userType: 'Employer' })}
              >
                <Text style={[
                  styles.userTypeButtonText,
                  formData.userType === 'Employer' && styles.userTypeButtonTextActive
                ]}>
                  Employer
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Optional Fields */}
          <Text style={styles.sectionTitle}>Optional Information</Text>
          
          {renderInput('phone', 'Phone Number', 'e.g., +1234567890', false, 'phone-pad', false, false)}

          {/* ? REPLACED: DatePicker instead of manual input */}
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

          {/* Gender Selection */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Gender (Optional)</Text>
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

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.linkText}>
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
  form: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginTop: 20,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray700,
    marginBottom: 8,
  },
  required: {
    color: colors.danger,
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
    marginTop: 4,
    marginLeft: 4,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: 12,
  },
  userTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  userTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  userTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  userTypeButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  userTypeButtonTextActive: {
    color: colors.white,
  },
  datePicker: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  dateInput: {
    borderWidth: 0,
    alignItems: 'flex-start',
    paddingLeft: 0,
  },
  dateText: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  placeholderText: {
    color: colors.gray400,
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
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: colors.gray400,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  linkButton: {
    alignItems: 'center',
    padding: 12,
  },
  linkText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
});