import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography, borderRadius, styles } from '../../styles/theme';
import GoogleSignInButton from '../../components/GoogleSignInButton';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const { login, loginWithGoogle, loading, error, googleAuthAvailable } = useAuth();

  const validateForm = () => {
    const newErrors = {};
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setFormLoading(true);
    const result = await login(email, password);
    setFormLoading(false);
    
    if (!result.success) {
      Alert.alert(
        'Login Failed', 
        result.error || 'Please check your credentials and try again.',
        [{ text: 'OK' }]
      );
    }
    // If successful, navigation will happen automatically via auth context
  };

  // ?? NEW: Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      
      console.log('?? Login screen: Starting Google Sign-In...');
      
      const result = await loginWithGoogle();
      
      if (result.success) {
        console.log('? Google login successful');
        // Navigation handled by auth context
      } else if (result.cancelled) {
        console.log('?? User cancelled Google Sign-In');
        // Do nothing - user cancelled
      } else if (result.needsConfig) {
        Alert.alert(
          'Google Sign-In Not Available',
          'Google Sign-In is not configured yet. Please use email and password to sign in.',
          [{ text: 'OK' }]
        );
      } else if (result.needsRegistration) {
        console.log('?? New Google user needs registration');
        
        Alert.alert(
          'Account Not Found',
          `No account found for ${result.googleUser?.email}. Would you like to create a new account?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Create Account', 
              onPress: () => {
                // Navigate to user type selection with Google user info
                navigation.navigate('UserTypeSelection', {
                  googleUser: result.googleUser,
                  fromGoogleAuth: true
                });
              }
            }
          ]
        );
      } else {
        console.error('? Google Sign-In failed:', result.error);
        Alert.alert(
          'Sign-In Failed',
          result.error || 'Google Sign-In failed. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('? Google Sign-In error:', error);
      Alert.alert(
        'Sign-In Error',
        error.message || 'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRegisterNavigation = () => {
    navigation.navigate('Register');
  };

  const isSubmitDisabled = formLoading || loading || !email || !password;

  return (
    <SafeAreaView style={screenStyles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={screenStyles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={screenStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={screenStyles.header}>
            <View style={screenStyles.logoContainer}>
              <Ionicons name="briefcase" size={64} color={colors.primary} />
            </View>
            <Text style={screenStyles.title}>Welcome Back!</Text>
            <Text style={screenStyles.subtitle}>
              Sign in to continue your job search journey
            </Text>
          </View>

          {/* ?? NEW: Google Sign-In Section */}
          {googleAuthAvailable && (
            <>
              <View style={screenStyles.googleSection}>
                <GoogleSignInButton
                  onPress={handleGoogleSignIn}
                  loading={googleLoading}
                  disabled={formLoading || loading}
                />
              </View>

              <View style={screenStyles.divider}>
                <View style={screenStyles.dividerLine} />
                <Text style={screenStyles.dividerText}>or</Text>
                <View style={screenStyles.dividerLine} />
              </View>
            </>
          )}

          {/* Login Form */}
          <View style={screenStyles.form}>
            {/* Email Input */}
            <View style={screenStyles.inputGroup}>
              <Text style={screenStyles.label}>Email Address</Text>
              <View style={[
                screenStyles.inputContainer,
                errors.email && screenStyles.inputError
              ]}>
                <Ionicons 
                  name="mail-outline" 
                  size={20} 
                  color={colors.gray400} 
                  style={screenStyles.inputIcon}
                />
                <TextInput
                  style={screenStyles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.gray400}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                />
              </View>
              {errors.email && (
                <Text style={screenStyles.errorText}>{errors.email}</Text>
              )}
            </View>

            {/* Password Input */}
            <View style={screenStyles.inputGroup}>
              <Text style={screenStyles.label}>Password</Text>
              <View style={[
                screenStyles.inputContainer,
                errors.password && screenStyles.inputError
              ]}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color={colors.gray400} 
                  style={screenStyles.inputIcon}
                />
                <TextInput
                  style={screenStyles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.gray400}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={screenStyles.eyeIcon}
                >
                  <Ionicons 
                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color={colors.gray400} 
                  />
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text style={screenStyles.errorText}>{errors.password}</Text>
              )}
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                screenStyles.loginButton,
                isSubmitDisabled && screenStyles.buttonDisabled
              ]}
              onPress={handleLogin}
              disabled={isSubmitDisabled}
            >
              {formLoading || loading ? (
                <View style={screenStyles.loadingContainer}>
                  <Ionicons name="reload-outline" size={20} color={colors.white} />
                  <Text style={[screenStyles.loginButtonText, { marginLeft: spacing.xs }]}>
                    Signing In...
                  </Text>
                </View>
              ) : (
                <Text style={screenStyles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Error Message */}
            {error && (
              <View style={screenStyles.globalErrorContainer}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={screenStyles.globalError}>{error}</Text>
              </View>
            )}
          </View>

          {/* Register Link */}
          <View style={screenStyles.footer}>
            <Text style={screenStyles.footerText}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity onPress={handleRegisterNavigation}>
              <Text style={screenStyles.linkText}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Test Credentials (for development) */}
          {__DEV__ && (
            <View style={screenStyles.devHelper}>
              <Text style={screenStyles.devHelperTitle}>Quick Test (Dev Mode)</Text>
              <TouchableOpacity
                onPress={() => {
                  setEmail('test@nexhire.com');
                  setPassword('password123');
                }}
                style={screenStyles.devButton}
              >
                <Text style={screenStyles.devButtonText}>Fill Test Credentials</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  container: {
    ...styles.safeArea,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoContainer: {
    marginBottom: spacing.md,
  },
  title: {
    ...styles.heading1,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...styles.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  // ?? NEW: Google Sign-In styles
  googleSection: {
    marginBottom: spacing.lg,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray300,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    color: colors.gray500,
    fontSize: typography.sizes.sm,
  },
  form: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...styles.body,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
    color: colors.textPrimary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inputIcon: {
    marginLeft: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  eyeIcon: {
    padding: spacing.sm,
  },
  errorText: {
    ...styles.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  loginButton: {
    ...styles.button,
    ...styles.buttonPrimary,
    marginTop: spacing.md,
  },
  buttonDisabled: {
    ...styles.buttonDisabled,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginButtonText: {
    ...styles.textButton,
  },
  globalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.gray50,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  globalError: {
    ...styles.bodySmall,
    color: colors.danger,
    marginLeft: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    ...styles.body,
    color: colors.textSecondary,
  },
  linkText: {
    ...styles.body,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  // Development helper styles
  devHelper: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  devHelperTitle: {
    ...styles.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  devButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.gray300,
    borderRadius: borderRadius.sm,
  },
  devButtonText: {
    ...styles.caption,
    color: colors.textPrimary,
  },
});