import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../contexts/AuthContext';
import { frontendConfig } from '../../../../config/appConfig';
import { authDarkColors } from '../../../../styles/authDarkColors';
import useResponsive from '../../../../hooks/useResponsive';
import { showToast } from '../../../../components/Toast';
import RegistrationWrapper from '../../../../components/auth/RegistrationWrapper';
import AnimatedSection from '../../../../components/auth/AnimatedSection';

export default function PersonalDetailsScreen({ navigation, route }) {
  const colors = authDarkColors;
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const { register, pendingGoogleAuth, clearPendingGoogleAuth, pendingLinkedInAuth, clearPendingLinkedInAuth } = useAuth();

  const routeParams = route?.params || {};
  const {
    userType = 'JobSeeker',
    experienceType = 'Student',
    totalSteps = 3,
    workExperienceData = null,
    educationData = null,
    fromGoogleAuth = false,
    fromLinkedInAuth = false,
    skippedSteps = false,
  } = routeParams;

  const isGoogleUser = fromGoogleAuth || !!pendingGoogleAuth;
  const isLinkedInUser = fromLinkedInAuth || !!pendingLinkedInAuth;
  const isSocialUser = isGoogleUser || isLinkedInUser;
  const googleUser = pendingGoogleAuth?.user;

  // Guard against hard refresh with lost Google data
  useEffect(() => {
    if (fromGoogleAuth && !pendingGoogleAuth && !googleUser) {
      if (typeof window !== 'undefined') { window.location.href = '/login'; return; }
      setTimeout(() => { navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }, 100);
    }
    if (fromLinkedInAuth && !pendingLinkedInAuth) {
      if (typeof window !== 'undefined') { window.location.href = '/login'; return; }
      setTimeout(() => { navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }, 100);
    }
  }, [fromGoogleAuth, pendingGoogleAuth, googleUser, fromLinkedInAuth, pendingLinkedInAuth, navigation]);

  // ─── Form state (slim: name + email + password + terms) ─────
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Pre-populate Google user data
  useEffect(() => {
    if (isGoogleUser && googleUser) {
      setFormData((prev) => ({
        ...prev,
        firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || '',
        lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '',
        email: googleUser.email || '',
        password: 'google-oauth-user',
        confirmPassword: 'google-oauth-user',
      }));
    }
    // For LinkedIn users, pre-fill dummy passwords (server does code exchange, no password needed)
    if (isLinkedInUser && !isGoogleUser) {
      setFormData((prev) => ({
        ...prev,
        password: 'linkedin-oauth-user',
        confirmPassword: 'linkedin-oauth-user',
      }));
    }
  }, [isSocialUser, isGoogleUser, isLinkedInUser, googleUser]);

  // ─── Validation ──────────────────────────────────────────────
  const validateEmail = (email) => {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!re.test(email)) return false;
    const tld = email.split('.').pop().toLowerCase();
    const valid = ['com','org','net','edu','gov','io','in','co','uk','us','info','dev','app','ai','me','xyz','tech','ac'];
    return tld.length <= 3 || valid.includes(tld);
  };

  const validateForm = () => {
    const e = {};
    if (!formData.firstName.trim()) e.firstName = 'First name is required';
    else if (formData.firstName.length < 2) e.firstName = 'Min 2 characters';
    if (!formData.lastName.trim()) e.lastName = 'Last name is required';
    else if (formData.lastName.length < 2) e.lastName = 'Min 2 characters';
    if (!formData.email.trim()) e.email = 'Email is required';
    else if (!validateEmail(formData.email)) e.email = 'Please enter a valid email';
    if (!isSocialUser) {
      if (!formData.password) e.password = 'Password is required';
      else if (formData.password.length < 8) e.password = 'Min 8 characters';
      if (!formData.confirmPassword) e.confirmPassword = 'Confirm your password';
      else if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Passwords don\'t match';
    }
    if (!termsAccepted) e.termsAccepted = 'You must accept Terms & Privacy Policy';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ─── Register ────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!validateForm()) { showToast('Please fix the errors', 'error'); return; }

    setLoading(true);
    try {
      const registrationData = {
        email: formData.email.trim().toLowerCase(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        userType,
        experienceType,
        termsAccepted: true,
        termsVersion: frontendConfig.legal.termsVersion,
        privacyPolicyVersion: frontendConfig.legal.privacyPolicyVersion,
      };

      if (workExperienceData) {
        registrationData.workExperienceData = Array.isArray(workExperienceData) ? workExperienceData : [workExperienceData];
      }
      if (educationData) {
        registrationData.educationData = educationData;
      }
      if (!isSocialUser) {
        registrationData.password = formData.password;
      }
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
      if (isLinkedInUser && pendingLinkedInAuth) {
        registrationData.linkedInAuth = {
          code: pendingLinkedInAuth.code,
          redirectUri: pendingLinkedInAuth.redirectUri,
        };
      }

      const result = await register(registrationData);

      if (result.success) {
        if (isGoogleUser) clearPendingGoogleAuth();
        if (isLinkedInUser) clearPendingLinkedInAuth();
      } else {
        const msg = result.error || 'Unable to create account.';
        if (msg.includes('already exists') || msg.includes('Conflict')) {
          if (isGoogleUser) clearPendingGoogleAuth();
          if (isLinkedInUser) clearPendingLinkedInAuth();
          showToast('Account already exists. Please sign in.', 'info');
          navigation.navigate('Login');
        } else {
          showToast(msg, 'error');
        }
      }
    } catch (error) {
      const msg = error.message || 'Registration failed.';
      if (msg.includes('already exists') || msg.includes('Conflict')) {
        if (isGoogleUser) clearPendingGoogleAuth();
        if (isLinkedInUser) clearPendingLinkedInAuth();
        showToast('Account already exists. Please sign in.', 'info');
        navigation.navigate('Login');
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: null }));
  };

  // Step number: always the last step
  const stepNumber = totalSteps;

  return (
    <RegistrationWrapper
      currentStep={stepNumber}
      totalSteps={totalSteps}
      stepLabel="Create account"
      onBack={() => navigation.goBack()}
    >
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <AnimatedSection delay={0}>
            <View style={styles.header}>
              {/* Google user card */}
              {isGoogleUser && googleUser && (
                <View style={styles.googleCard}>
                  {googleUser.picture && (
                    <Image source={{ uri: googleUser.picture }} style={styles.googleAvatar} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.googleLabel}>Google Connected</Text>
                    <Text style={styles.googleName}>{googleUser.name}</Text>
                    <Text style={styles.googleEmail}>{googleUser.email}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                </View>
              )}

              <Text style={styles.emoji}>🚀</Text>
              <Text style={styles.title}>
                {isGoogleUser ? 'Almost there!' : 'Create your account'}
              </Text>
              <Text style={styles.subtitle}>
                {isGoogleUser ? 'Just confirm your name and you\'re in' : 'Just a few details and you\'re all set'}
              </Text>
            </View>
          </AnimatedSection>

          <AnimatedSection delay={150}>
            {/* Name row */}
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>First Name <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.input, errors.firstName && styles.inputError]}
                  placeholder="First Name"
                  placeholderTextColor={colors.gray400}
                  value={formData.firstName}
                  onChangeText={(t) => updateField('firstName', t)}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>Last Name <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.input, errors.lastName && styles.inputError]}
                  placeholder="Last Name"
                  placeholderTextColor={colors.gray400}
                  value={formData.lastName}
                  onChangeText={(t) => updateField('lastName', t)}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
              </View>
            </View>

            {/* Email */}
            <View style={styles.fieldContainer}>
              <Text style={styles.inputLabel}>
                Email <Text style={styles.required}>*</Text>
                {isGoogleUser && <Text style={styles.prefilledBadge}> ✓ Google</Text>}
              </Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="you@email.com"
                placeholderTextColor={colors.gray400}
                value={formData.email}
                onChangeText={(t) => updateField('email', t)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Password — hidden for Google users */}
            {!isGoogleUser && (
              <>
                <View style={styles.fieldContainer}>
                  <Text style={styles.inputLabel}>Password <Text style={styles.required}>*</Text></Text>
                  <View style={styles.passwordWrap}>
                    <TextInput
                      style={[styles.input, { flex: 1, paddingRight: 48 }, errors.password && styles.inputError]}
                      placeholder="8+ characters"
                      placeholderTextColor={colors.gray400}
                      value={formData.password}
                      onChangeText={(t) => updateField('password', t)}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.gray400} />
                    </TouchableOpacity>
                  </View>
                  {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.inputLabel}>Confirm Password <Text style={styles.required}>*</Text></Text>
                  <TextInput
                    style={[styles.input, errors.confirmPassword && styles.inputError]}
                    placeholder="Re-type password"
                    placeholderTextColor={colors.gray400}
                    value={formData.confirmPassword}
                    onChangeText={(t) => updateField('confirmPassword', t)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                </View>
              </>
            )}
          </AnimatedSection>

          <AnimatedSection delay={300}>
            {/* Terms */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => {
                setTermsAccepted(!termsAccepted);
                if (errors.termsAccepted) setErrors((prev) => ({ ...prev, termsAccepted: null }));
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked, errors.termsAccepted && styles.checkboxError]}>
                {termsAccepted && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink} onPress={() => navigation.navigate('Terms')}>Terms</Text>
                {' '}and{' '}
                <Text style={styles.termsLink} onPress={() => navigation.navigate('PrivacyPolicy')}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>
            {errors.termsAccepted && <Text style={[styles.errorText, { marginLeft: 32 }]}>{errors.termsAccepted}</Text>}

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.registerButton, (loading || !termsAccepted) && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Text style={styles.registerButtonText}>
                    {isGoogleUser ? 'Complete Signup' : 'Create Account'}
                  </Text>
                  <Ionicons name="checkmark" size={20} color={colors.white} />
                </>
              )}
            </TouchableOpacity>

            {/* Login link */}
            {!isGoogleUser && (
              <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLinkText}>Already have an account? <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign In</Text></Text>
              </TouchableOpacity>
            )}
          </AnimatedSection>
        </View>
      </ScrollView>
    </RegistrationWrapper>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const createStyles = (colors, responsive = {}) =>
  StyleSheet.create({
    scrollContainer: { flex: 1 },
    content: {
      width: '100%',
      maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 520 : '100%',
      padding: 24, paddingTop: 8, alignSelf: 'center',
    },
    header: { marginBottom: 28 },
    emoji: { fontSize: 36, marginBottom: 12 },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.4, marginBottom: 6 },
    subtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 8 },

    googleCard: {
      flexDirection: 'row', alignItems: 'center', marginBottom: 20,
      padding: 14, backgroundColor: colors.successGlowSubtle,
      borderRadius: 14, borderWidth: 1, borderColor: colors.successBorder,
    },
    googleAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, borderWidth: 2, borderColor: colors.successBorderStrong },
    googleLabel: { fontSize: 10, fontWeight: '700', color: colors.success, textTransform: 'uppercase', letterSpacing: 0.5 },
    googleName: { fontSize: 14, fontWeight: '700', color: colors.text },
    googleEmail: { fontSize: 12, color: colors.textSecondary },

    row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    halfInput: { flex: 1 },
    fieldContainer: { marginBottom: 16 },
    inputLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    required: { color: colors.error, fontWeight: '700' },
    prefilledBadge: { color: colors.success, fontWeight: '400', fontSize: 10, textTransform: 'none' },
    input: {
      backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, padding: 16, fontSize: 15, color: colors.text,
    },
    inputError: { borderColor: colors.error },
    errorText: { color: colors.error, fontSize: 12, marginTop: 4 },
    passwordWrap: { position: 'relative' },
    eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },

    termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8, marginBottom: 4 },
    checkbox: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderMedium,
      alignItems: 'center', justifyContent: 'center', marginTop: 1, backgroundColor: colors.inputBackground,
    },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkboxError: { borderColor: colors.error },
    termsText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
    termsLink: { color: colors.primary, fontWeight: '600', textDecorationLine: 'underline' },

    registerButton: {
      backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 18, paddingHorizontal: 24, borderRadius: 16, gap: 8, marginTop: 20,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
    },
    registerButtonDisabled: { backgroundColor: colors.surfaceElevated, shadowOpacity: 0, elevation: 0 },
    registerButtonText: { color: colors.white, fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
    loginLink: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
    loginLinkText: { fontSize: 14, color: colors.textSecondary },
  });
