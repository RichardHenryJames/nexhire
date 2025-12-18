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
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { typography } from '../../styles/theme';
import { useTheme } from '../../contexts/ThemeContext';
import DatePicker from '../../components/DatePicker';

const { width, height } = Dimensions.get('window');

// Floating particle component for background effect
function FloatingParticle({ delay, style }) {
  const translateY = useRef(new Animated.Value(height)).current;
  const translateX = useRef(new Animated.Value(Math.random() * width)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 8000 + Math.random() * 4000,
          delay,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 1000,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1000,
            delay: 6000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY }, { translateX }],
          opacity,
        },
      ]}
    />
  );
}

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
    inviteCode: '', // ?? NEW: Invite code for bonus
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const { register } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

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
        ...(formData.inviteCode && { inviteCode: formData.inviteCode.trim() }), // ?? NEW: Add invite code
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
        placeholderTextColor="rgba(255, 255, 255, 0.6)"
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
    <View style={styles.mainContainer}>
      <LinearGradient
        colors={isDark ? [colors.background, colors.surface, colors.background] : [colors.primaryLight, colors.primary, colors.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={Platform.OS === 'web' ? styles.webBackground : StyleSheet.absoluteFill}
      />
      
      {/* Floating Particles */}
      <FloatingParticle delay={0} style={styles.floatingParticle} />
      <FloatingParticle delay={1000} style={styles.floatingParticle} />
      <FloatingParticle delay={2000} style={styles.floatingParticle} />
      
      {/* Bottom Decoration */}
      <View style={styles.bottomDecoration}>
        <View style={styles.decorationCircle1} />
        <View style={styles.decorationCircle2} />
        <View style={styles.decorationCircle3} />
      </View>

      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join RefOpen to find your dream job or hire top talent</Text>

          {/* Required Fields */}
          {renderInput('firstName', 'First Name', 'e.g., John', false, 'default', false, true)}
          {renderInput('lastName', 'Last Name', 'e.g., Doe', false, 'default', false, true)}
          {renderInput('email', 'Email Address', 'e.g., john.doe@example.com', false, 'email-address', false, true)}
          
          {/* ?? NEW: Invite Code Input (Optional) */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Invite Code (Optional)
            </Text>
            <View style={styles.inviteCodeContainer}>
              <Ionicons name="gift-outline" size={20} color="rgba(255, 255, 255, 0.8)" style={styles.inviteCodeIcon} />
              <TextInput
                style={[styles.input, styles.inviteCodeInput, errors.inviteCode && styles.inputError]}
                placeholder="Enter invite code"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={formData.inviteCode}
                onChangeText={(text) => {
                  // Convert to uppercase and remove spaces
                  const cleanCode = text.toUpperCase().replace(/\s/g, '');
                  setFormData({ ...formData, inviteCode: cleanCode });
                  if (errors.inviteCode) {
                    setErrors({ ...errors, inviteCode: null });
                  }
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
              />
            </View>
            {errors.inviteCode && (
              <Text style={styles.errorText}>{errors.inviteCode}</Text>
            )}
            <View style={styles.inviteCodeHint}>
              <Ionicons name="information-circle-outline" size={14} color="#4ADE80" />
              <Text style={styles.inviteCodeHintText}>
                Have an invite code? Get ₹50 bonus when you sign up!
              </Text>
            </View>
          </View>
          
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
            labelStyle={{ color: colors.white }}
            requiredStyle={{ color: '#FFD700' }}
            textColor={colors.white}
            placeholderTextColor="rgba(255, 255, 255, 0.6)"
            iconColor="rgba(255, 255, 255, 0.8)"
            placeholderIconColor="rgba(255, 255, 255, 0.6)"
            pickerTextColor={colors.white}
            errorTextStyle={{ color: '#FFD700', fontWeight: '600' }}
            buttonStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: 8,
              padding: 16,
            }}
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
            onPress={() => {
              // Always navigate to Login screen directly (handles hard refresh)
              navigation.navigate('Login');
            }}
          >
            <Text style={styles.linkText}>
              Already have an account? Sign In
            </Text>
          </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  webBackground: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    marginTop: 40,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    marginHorizontal: 20,
    marginVertical: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  form: {
    padding: 20,
    paddingTop: 40,
  },
  floatingParticle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
    zIndex: 1,
  },
  bottomDecoration: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    zIndex: 0,
  },
  decorationCircle1: {
    position: 'absolute',
    bottom: -80,
    right: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.white + '12',
    borderWidth: 1,
    borderColor: colors.white + '20',
  },
  decorationCircle2: {
    position: 'absolute',
    bottom: -120,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: colors.white + '08',
    borderWidth: 1,
    borderColor: colors.white + '15',
  },
  decorationCircle3: {
    position: 'absolute',
    bottom: 50,
    right: 30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.white + '10',
    borderWidth: 2,
    borderColor: colors.white + '25',
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.white,
    marginTop: 20,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.white,
    marginBottom: 8,
  },
  required: {
    color: '#FFD700',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    padding: 16,
    fontSize: typography.sizes.md,
    color: colors.white,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  errorText: {
    color: '#FFD700',
    fontSize: typography.sizes.sm,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '600',
  },
  // ?? NEW: Invite code styles
  inviteCodeContainer: {
    position: 'relative',
  },
  inviteCodeIcon: {
    position: 'absolute',
    left: 12,
    top: 16,
    zIndex: 1,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  inviteCodeInput: {
    paddingLeft: 40, // Make room for the icon
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  inviteCodeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    padding: 8,
    borderRadius: 6,
  },
  inviteCodeHintText: {
    fontSize: typography.sizes.xs,
    color: '#4ADE80',
    marginLeft: 6,
    flex: 1,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.white,
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
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  userTypeButtonActive: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  userTypeButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.white,
  },
  userTypeButtonTextActive: {
    color: colors.primary,
  },
  datePicker: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    padding: 16,
    fontSize: typography.sizes.md,
    color: colors.white,
  },
  dateInput: {
    borderWidth: 0,
    alignItems: 'flex-start',
    paddingLeft: 0,
  },
  dateText: {
    fontSize: typography.sizes.md,
    color: colors.white,
  },
  placeholderText: {
    color: 'rgba(255, 255, 255, 0.6)',
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
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  genderButtonActive: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  genderButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.white,
  },
  genderButtonTextActive: {
    color: colors.primary,
  },
  button: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  buttonText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  linkButton: {
    alignItems: 'center',
    padding: 12,
  },
  linkText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    textDecorationLine: 'underline',
  },
});