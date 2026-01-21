import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius } from '../../styles/theme';
import { authDarkColors } from '../../styles/authDarkColors';
import useResponsive from '../../hooks/useResponsive';
import { showToast } from '../../components/Toast';
import API from '../../services/api';

export default function ResetPasswordScreen({ navigation, route }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [tokenError, setTokenError] = useState('');

  const colors = authDarkColors;
  const responsive = useResponsive();
  const { isDesktop } = responsive;

  // Get token from route params or URL
  const token = route?.params?.token || getTokenFromURL();

  // Scroll to top on mount (for web)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, []);

  function getTokenFromURL() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('token');
    }
    return null;
  }

  useEffect(() => {
    if (!token) {
      setTokenError('Invalid or missing reset token. Please request a new password reset link.');
    }
  }, [token]);

  const validateForm = () => {
    const newErrors = {};

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const response = await API.apiCall('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      if (response.success) {
        setSuccess(true);
        showToast('Password reset successfully!', 'success');
      } else {
        const errorMsg = response.error || response.message || 'Failed to reset password';
        if (errorMsg.includes('expired') || errorMsg.includes('invalid')) {
          setTokenError(errorMsg);
        } else {
          showToast(errorMsg, 'error');
        }
      }
    } catch (err) {
      console.error('Reset password error:', err);
      showToast('Failed to reset password. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/login';
    } else {
      navigation.navigate('Login');
    }
  };

  const handleRequestNewLink = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/forgot-password';
    } else {
      navigation.navigate('ForgotPassword');
    }
  };

  // Token error screen
  if (tokenError) {
    return (
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.card, isDesktop && styles.cardDesktop]}>
            <View style={styles.errorContainer}>
              <View style={styles.errorIconContainer}>
                <Ionicons name="warning-outline" size={48} color="#EF4444" />
              </View>
              <Text style={styles.errorTitle}>Invalid Reset Link</Text>
              <Text style={styles.errorMessage}>{tokenError}</Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRequestNewLink}
              >
                <Text style={styles.primaryButtonText}>Request New Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleGoToLogin}
              >
                <Ionicons name="arrow-back" size={18} color={colors.primary} />
                <Text style={styles.linkButtonText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Success screen
  if (success) {
    return (
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.card, isDesktop && styles.cardDesktop]}>
            <View style={styles.successContainer}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={64} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Password Reset!</Text>
              <Text style={styles.successMessage}>
                Your password has been successfully reset. You can now log in with your new password.
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleGoToLogin}
              >
                <Text style={styles.primaryButtonText}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0F172A', '#1E293B', '#0F172A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardContainer}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.card, isDesktop && styles.cardDesktop]}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.iconContainer}>
                  <Ionicons name="key-outline" size={40} color={colors.primary} />
                </View>
                <Text style={styles.title}>Create New Password</Text>
                <Text style={styles.subtitle}>
                  Your new password must be at least 8 characters long.
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                {/* New Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={[styles.inputContainer, errors.password && styles.inputError]}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="rgba(255, 255, 255, 0.8)"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                      }}
                      placeholder="Enter new password"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      editable={!loading}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color="rgba(255, 255, 255, 0.8)"
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.password ? (
                    <Text style={styles.fieldError}>{errors.password}</Text>
                  ) : null}
                </View>

                {/* Confirm Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={[styles.inputContainer, errors.confirmPassword && styles.inputError]}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="rgba(255, 255, 255, 0.8)"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: null }));
                      }}
                      placeholder="Confirm new password"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      editable={!loading}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color="rgba(255, 255, 255, 0.8)"
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.confirmPassword ? (
                    <Text style={styles.fieldError}>{errors.confirmPassword}</Text>
                  ) : null}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#3c4043" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>Reset Password</Text>
                  )}
                </TouchableOpacity>

                {/* Back to Login */}
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={handleGoToLogin}
                >
                  <Ionicons name="arrow-back" size={18} color={colors.primary} />
                  <Text style={styles.linkButtonText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 40,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  cardDesktop: {
    padding: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: '#ffffff',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.md,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: typography.sizes.base,
    color: '#ffffff',
  },
  eyeIcon: {
    padding: spacing.xs,
  },
  fieldError: {
    fontSize: typography.sizes.sm,
    color: '#EF4444',
    marginTop: spacing.xs,
  },
  submitButton: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    backgroundColor: '#f1f3f4',
  },
  submitButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: '#3c4043',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: 6,
  },
  linkButtonText: {
    fontSize: typography.sizes.base,
    color: '#3B82F6',
    fontWeight: typography.weights.medium,
  },
  // Success styles
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  successIconContainer: {
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: '#ffffff',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: typography.sizes.base,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: '#ffffff',
  },
  // Error styles
  errorContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  errorIconContainer: {
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: '#ffffff',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: typography.sizes.base,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});
