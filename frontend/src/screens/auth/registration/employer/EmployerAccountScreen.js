import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../contexts/ThemeContext';
import { typography } from '../../../../styles/theme';
import { authDarkColors } from '../../../../styles/authDarkColors';
import useResponsive from '../../../../hooks/useResponsive';
import refopenAPI from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { frontendConfig } from '../../../../config/appConfig';
import DatePicker from '../../../../components/DatePicker';
import { showToast } from '../../../../components/Toast';

export default function EmployerAccountScreen({ navigation, route }) {
  const colors = authDarkColors; // Always use dark colors for auth screens
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const { 
    employerType = 'startup', 
    selectedCompany, 
    employerDetails,
    fromGoogleAuth,
    skipEmailPassword
  } = route.params || {};
  
  const { user, pendingGoogleAuth, register, clearPendingGoogleAuth } = useAuth();

  // Check if this is a Google user
  const isGoogleUser = fromGoogleAuth || pendingGoogleAuth;
  const googleUser = pendingGoogleAuth?.user;

  const [firstName, setFirstName] = useState(user?.FirstName || '');
  const [lastName, setLastName] = useState(user?.LastName || '');
  const [email, setEmail] = useState(user?.Email || '');
  const [phone, setPhone] = useState(user?.Phone || '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState(''); // 🎁 NEW: Referral code
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState('');

  // EMAIL VERIFICATION STATE (non-Google users)
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerificationId, setEmailVerificationId] = useState(null);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [verifiedEmail, setVerifiedEmail] = useState('');

  // Pre-populate Google user data
  useEffect(() => {
    if (isGoogleUser && googleUser) {
      
      setFirstName(googleUser.given_name || googleUser.name?.split(' ')[0] || '');
      setLastName(googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '');
      setEmail(googleUser.email || '');
      // No password needed for Google users
      setPassword('google-oauth-user');
      setConfirmPassword('google-oauth-user');
    }
  }, [isGoogleUser, googleUser]);

  // ===== EMAIL VERIFICATION HANDLERS =====
  useEffect(() => {
    if (email !== verifiedEmail && emailVerified) {
      setEmailVerified(false);
      setEmailVerificationId(null);
      setShowOtpInput(false);
      setOtpCode('');
    }
  }, [email]);

  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  const handleSendOTP = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }
    setOtpLoading(true);
    try {
      const result = await refopenAPI.sendRegistrationEmailOTP(trimmedEmail);
      if (result.success) {
        setShowOtpInput(true);
        setOtpCooldown(60);
        showToast('Verification code sent! Check your inbox.', 'success');
      } else {
        const msg = result.error || result.message || 'Failed to send code';
        if (msg.includes('already exists')) {
          showToast('Account already exists. Please sign in.', 'info');
          navigation.navigate('Login');
        } else {
          showToast(msg, 'error');
        }
      }
    } catch (e) {
      showToast('Failed to send verification code', 'error');
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
      const trimmedEmail = email.trim().toLowerCase();
      const result = await refopenAPI.verifyRegistrationEmailOTP(trimmedEmail, otpCode);
      if (result.success && result.data?.verificationId) {
        setEmailVerified(true);
        setEmailVerificationId(result.data.verificationId);
        setVerifiedEmail(trimmedEmail);
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

  const validate = () => {
    if (!firstName.trim() || !lastName.trim()) return 'First name and last name are required';
    if (!email.trim()) return 'Email is required';
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    
    // Email must be verified for non-Google users
    if (!isGoogleUser && !emailVerified) return 'Please verify your email address first';
    
    // Skip password validation for Google users and already authenticated users
    if (!refopenAPI.token && !isGoogleUser) {
      if (!password || password.length < 6) return 'Password must be at least 6 characters';
      if (password !== confirmPassword) return 'Passwords do not match';
    }
    if (!termsAccepted) return 'You must accept the Terms of Service and Privacy Policy';
    return null;
  };

  const onSubmit = async () => {
    const err = validate();
    if (err) {
      showToast(err, 'error');
      return;
    }

    try {
      setSubmitting(true);

      const organizationPayload = {
        organizationName: selectedCompany?.name || employerDetails?.organizationName || 'My Organization',
        organizationIndustry: selectedCompany?.industry || 'Technology',
        organizationSize: selectedCompany?.size || 'Small',
        organizationType: employerType === 'freelancer' ? 'Individual' : 'Company',
        jobTitle: employerDetails?.jobTitle || 'Hiring Manager',
        department: employerDetails?.department || 'Human Resources',
      };

      // Only add optional fields if they have values
      if (selectedCompany?.website && selectedCompany.website.trim()) {
        organizationPayload.organizationWebsite = selectedCompany.website.trim();
      }
      if (employerDetails?.linkedInProfile && employerDetails.linkedInProfile.trim()) {
        organizationPayload.linkedInProfile = employerDetails.linkedInProfile.trim();
      }
      if (employerDetails?.bio && employerDetails.bio.trim()) {
        organizationPayload.bio = employerDetails.bio.trim();
      }

      // Handle Google users vs regular users differently
      if (isGoogleUser && pendingGoogleAuth) {
        
        // Prepare comprehensive registration data for Google user
        const registrationData = {
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          userType: 'Employer',
          ...(phone && { phone: phone.trim() }),
          ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
          ...(referralCode && { referralCode: referralCode.trim() }), // 🎁 NEW: Add referral code
          ...(emailVerificationId && { emailVerificationId }), // Email OTP verification proof
          termsAccepted: true,
          termsVersion: frontendConfig.legal.termsVersion,
          privacyPolicyVersion: frontendConfig.legal.privacyPolicyVersion,
          
          // Add Google OAuth data
          googleAuth: {
            googleId: googleUser.id,
            accessToken: pendingGoogleAuth.accessToken,
            idToken: pendingGoogleAuth.idToken,
            verified: googleUser.verified_email,
            picture: googleUser.picture,
            locale: googleUser.locale,
          },
          
          // Add organization data
          ...organizationPayload,
        };

        const result = await register(registrationData);
        
        if (result.success) {
          // FIXED: Clear pending Google auth and let AuthContext handle navigation
          clearPendingGoogleAuth();
          // Navigation will be handled automatically by AuthContext when isAuthenticated becomes true
          return;
        } else {
          // ✅ NEW: Check if error is "User already exists"
          const errorMessage = result.error || 'Google registration failed';
          
          if (errorMessage.includes('already exists') || errorMessage.includes('Conflict')) {
            
            // Clear any pending Google auth data
            clearPendingGoogleAuth();
            
            showToast('Account already exists. Please sign in.', 'info');
            navigation.navigate('Login');
            return;
          }
          
          throw new Error(errorMessage);
        }
      }

      // Original flow for non-Google users
      if (!refopenAPI.token) {
        const payload = {
          email: email.trim().toLowerCase(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          userType: 'Employer',
          ...(phone && { phone: phone.trim() }),
          ...(dateOfBirth && { dateOfBirth }),
          ...(referralCode && { referralCode: referralCode.trim() }), // 🎁 NEW: Add referral code
          ...(emailVerificationId && { emailVerificationId }), // Email OTP verification proof
          termsAccepted: true,
          termsVersion: frontendConfig.legal.termsVersion,
          privacyPolicyVersion: frontendConfig.legal.privacyPolicyVersion,
          ...organizationPayload,
        };

        const reg = await refopenAPI.register(payload);
        if (!reg?.success) {
          // ✅ NEW: Check if error is "User already exists"
          const errorMessage = reg?.error || 'Registration failed';
          
          if (errorMessage.includes('already exists') || errorMessage.includes('Conflict')) {
            
            showToast('Account already exists. Please sign in.', 'info');
            navigation.navigate('Login');
            return;
          }
          
          throw new Error(errorMessage);
        }

        // Auto-login
        const login = await refopenAPI.login(email.trim().toLowerCase(), password);
        if (!login?.success) throw new Error(login?.error || 'Login failed');

        // AuthContext will handle navigation when isAuthenticated becomes true
        return;
      }

      // If already authenticated, best-effort: initialize employer profile if backend supports it, fallback to profile update
      try {
        const res = await refopenAPI.initializeEmployerProfile(organizationPayload);
        if (!res?.success) throw new Error(res?.error || 'Init failed');
      } catch (_) {
        // Fallback: at least update basic profile
        await refopenAPI.updateProfile({ firstName, lastName, phone });
      }

      // AuthContext will handle navigation when onboarding is complete
    } catch (e) {
      console.error('Employer account creation error:', e);
      
      // ✅ NEW: Also handle caught errors for "already exists"
      const errorMessage = e.message || 'Failed to complete setup';
      
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
    } finally { setSubmitting(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.innerContainer}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 20 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingVertical: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
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
                Creating employer account for
              </Text>
              <Text style={styles.googleUserName}>{googleUser.name}</Text>
              <Text style={styles.googleUserEmail}>{googleUser.email}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          </View>
        )}

        <Text style={styles.title}>
          {isGoogleUser ? 'Complete Your Employer Account' : 'Create your employer account'}
        </Text>
        <Text style={styles.subtitle}>
          {isGoogleUser 
            ? 'Just a few more details to finish your profile'
            : 'We\'ll set up your user and organization'
          }
        </Text>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1, marginRight: 6 }]}> 
            <Text style={styles.label}>
              First Name <Text style={styles.required}>*</Text>
              {isGoogleUser && <Text style={styles.prefilledLabel}> ✓ Pre-filled</Text>}
            </Text>
            <TextInput 
              style={[styles.input, isGoogleUser && styles.inputPrefilled]} 
              value={firstName} 
              onChangeText={setFirstName}
              editable={true}
              placeholder="Enter first name"
              placeholderTextColor={colors.gray400}
            />
          </View>
          <View style={[styles.field, { flex: 1, marginLeft: 6 }]}> 
            <Text style={styles.label}>
              Last Name <Text style={styles.required}>*</Text>
              {isGoogleUser && <Text style={styles.prefilledLabel}> ✓ Pre-filled</Text>}
            </Text>
            <TextInput 
              style={[styles.input, isGoogleUser && styles.inputPrefilled]} 
              value={lastName} 
              onChangeText={setLastName}
              editable={true}
              placeholder="Enter last name"
              placeholderTextColor={colors.gray400}
            />
          </View>
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>
            Email Address <Text style={styles.required}>*</Text>
            {isGoogleUser && <Text style={styles.prefilledLabel}> ✓ Pre-filled</Text>}
          </Text>
          <TextInput 
            style={[styles.input, isGoogleUser && styles.inputPrefilled]} 
            value={email} 
            onChangeText={setEmail} 
            autoCapitalize="none"
            editable={true}
            placeholder="Enter email address"
            placeholderTextColor={colors.gray400}
          />
        </View>

        {/* EMAIL VERIFICATION for non-Google users */}
        {!isGoogleUser && (
          <View style={styles.emailVerifyContainer}>
            {emailVerified ? (
              <View style={styles.emailVerifiedBadge}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.emailVerifiedText}>Email verified</Text>
              </View>
            ) : !showOtpInput ? (
              <TouchableOpacity
                style={[
                  styles.verifyEmailButton,
                  (!email.trim() || otpLoading) && styles.verifyEmailButtonDisabled
                ]}
                onPress={handleSendOTP}
                disabled={!email.trim() || otpLoading}
              >
                {otpLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="mail-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.verifyEmailButtonText}>Verify Email</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
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
          </View>
        )}

        {/* 🎁 NEW: Referral Code Input (Optional) */}
        <View style={styles.field}>
          <Text style={styles.label}>Referral Code (Optional)</Text>
          <View style={styles.referralCodeContainer}>
            <Ionicons name="gift-outline" size={20} color={colors.primary} style={styles.referralCodeIcon} />
            <TextInput
              style={[styles.input, styles.referralCodeInput]}
              placeholder="Enter referral code"
              placeholderTextColor={colors.gray400}
              value={referralCode}
              onChangeText={(text) => {
                // Convert to uppercase and remove spaces
                const cleanCode = text.toUpperCase().replace(/\s/g, '');
                setReferralCode(cleanCode);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
            />
          </View>
          <View style={styles.referralCodeHint}>
            <Ionicons name="information-circle-outline" size={14} color={colors.success} />
            <Text style={styles.referralCodeHintText}>
              Have a referral code? Get ₹25 bonus when you sign up!
            </Text>
          </View>
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>Phone Number</Text>
          <TextInput 
            style={styles.input} 
            value={phone} 
            onChangeText={setPhone}
            placeholder="Enter phone number"
            placeholderTextColor={colors.gray400}
            keyboardType="phone-pad"
          />
        </View>

        {/* ✅ Wrapped in field container with matching button style */}
        <View style={styles.field}> 
          <Text style={styles.label}>Date of Birth</Text>
          <DatePicker
            value={dateOfBirth}
            onChange={(date) => setDateOfBirth(date)}
            placeholder="Select your date of birth"
            maximumDate={new Date()}
            noMargin={true}
            buttonStyle={{ padding: 12 }} // ✅ Match input padding to make same height
            colors={colors}
          />
        </View>

        {/* Only show password fields for non-Google users and unauthenticated users */}
        {!refopenAPI.token && !isGoogleUser && (
          <>
            <View style={styles.field}> 
              <Text style={styles.label}>Password</Text>
              <TextInput 
                style={styles.input} 
                value={password} 
                onChangeText={setPassword} 
                secureTextEntry
                placeholder="Enter password (min 6 characters)"
                placeholderTextColor={colors.gray400}
              />
            </View>
            <View style={styles.field}> 
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput 
                style={styles.input} 
                value={confirmPassword} 
                onChangeText={setConfirmPassword} 
                secureTextEntry
                placeholder="Confirm your password"
                placeholderTextColor={colors.gray400}
              />
            </View>
          </>
        )}

        {/* Organization Summary */}
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Organization Details</Text>
          <View style={styles.summaryItem}>
            <Ionicons name="business" size={16} color={colors.primary} />
            <Text style={styles.summaryText}>
              {selectedCompany?.name || 'My Organization'}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="briefcase" size={16} color={colors.primary} />
            <Text style={styles.summaryText}>
              {employerDetails?.jobTitle || 'Hiring Manager'} · {employerDetails?.department || 'Human Resources'}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="construct" size={16} color={colors.primary} />
            <Text style={styles.summaryText}>
              {employerType === 'freelancer' ? 'Individual/Freelancer' : 'Company'}
            </Text>
          </View>
        </View>

        {/* Terms & Privacy Policy Consent */}
        <View style={styles.consentContainer}>
          <TouchableOpacity
            style={styles.consentCheckboxRow}
            onPress={() => {
              setTermsAccepted(!termsAccepted);
              if (termsError) setTermsError('');
            }}
            activeOpacity={0.7}
          >
            <View style={[
              styles.consentCheckbox,
              termsAccepted && styles.consentCheckboxChecked,
              termsError && styles.consentCheckboxError,
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
          {termsError ? (
            <Text style={styles.consentErrorText}>{termsError}</Text>
          ) : null}
        </View>

        <TouchableOpacity 
          style={[styles.primaryBtn, (submitting || !termsAccepted) && { opacity: 0.7 }]} 
          disabled={submitting} 
          onPress={onSubmit}
        >
          <Text style={styles.primaryBtnText}>
            {submitting 
              ? (isGoogleUser ? 'Completing Profile...' : 'Creating Account...') 
              : (isGoogleUser ? 'Complete Profile' : 'Finish Setup')
            }
          </Text>
          <Ionicons name="checkmark" size={18} color={colors.white} />
        </TouchableOpacity>
      </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  innerContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 600 : '100%',
    flex: 1,
  },
  scroll: { 
    flex: 1 
  },
  row: { 
    flexDirection: 'row' 
  },
  // Google user info styles
  googleUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 16,
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
    marginTop: 8 
  },
  subtitle: { 
    color: colors.gray600, 
    marginTop: 6, 
    marginBottom: 16 
  },
  field: { 
    marginTop: 12 
  },
  label: { 
    color: colors.gray600, 
    marginBottom: 6,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  required: {
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
    padding: 12, 
    color: colors.text,
    fontSize: typography.sizes.md,
  },
  inputPrefilled: {
    backgroundColor: colors.success + '08',
    borderColor: colors.success,
    borderWidth: 1.5,
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
  // EMAIL VERIFICATION styles
  emailVerifyContainer: {
    marginTop: -4,
    marginBottom: 12,
  },
  emailVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  emailVerifiedText: {
    fontSize: typography.sizes.sm,
    color: colors.success,
    fontWeight: typography.weights.semiBold,
    marginLeft: 6,
  },
  verifyEmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  verifyEmailButtonDisabled: {
    opacity: 0.5,
  },
  verifyEmailButtonText: {
    color: '#fff',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semiBold,
  },
  otpSection: {
    backgroundColor: colors.surface + '80',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  otpLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray300,
    marginBottom: 10,
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  otpInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: typography.weights.bold,
    letterSpacing: 8,
    color: colors.text,
    textAlign: 'center',
  },
  verifyOtpButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  resendText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    textAlign: 'center',
  },
  summaryContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
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
  primaryBtn: { 
    marginTop: 24, 
    backgroundColor: colors.primary, 
    borderRadius: 10, 
    paddingVertical: 14, 
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 8 
  },
  primaryBtnText: { 
    color: colors.white, 
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.md,
  },
  // DatePicker styles
  datePicker: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInput: {
    flex: 1,
    padding: 0,
    borderWidth: 0,
    alignItems: 'flex-start',
  },
  dateText: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  placeholderText: {
    color: colors.gray500,
    fontSize: typography.sizes.md,
  },
  // Welcome Bonus Banner styles
  welcomeBonusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  welcomeBonusIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  welcomeBonusContent: {
    flex: 1,
  },
  welcomeBonusTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: '#22C55E',
    marginBottom: 4,
  },
  welcomeBonusText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  welcomeBonusAmount: {
    fontWeight: typography.weights.bold,
    color: '#FFD700',
    fontSize: typography.sizes.md,
  },
  welcomeBonusSubtext: {
    fontSize: typography.sizes.xs,
    color: colors.gray400,
    marginTop: 2,
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
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    backgroundColor: 'transparent',
  },
  consentCheckboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  consentCheckboxError: {
    borderColor: colors.danger || '#EF4444',
  },
  consentText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    lineHeight: 20,
  },
  consentLink: {
    color: colors.primary,
    fontWeight: typography.weights.semibold || '600',
    textDecorationLine: 'underline',
  },
  consentErrorText: {
    fontSize: typography.sizes.xs,
    color: colors.danger || '#EF4444',
    marginTop: 6,
    marginLeft: 32,
  },
});
