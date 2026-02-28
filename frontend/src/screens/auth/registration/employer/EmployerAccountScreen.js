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
import { useTheme } from '../../../../contexts/ThemeContext';
import { typography } from '../../../../styles/theme';
import { authDarkColors } from '../../../../styles/authDarkColors';
import useResponsive from '../../../../hooks/useResponsive';
import refopenAPI from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { frontendConfig } from '../../../../config/appConfig';
import DatePicker from '../../../../components/DatePicker';
import { showToast } from '../../../../components/Toast';
import RegistrationWrapper from '../../../../components/auth/RegistrationWrapper';

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
      const msg = e?.data?.message || e?.data?.error || e?.message || 'Failed to send verification code';
      if (msg.includes('already exists')) {
        showToast('Account already exists. Please sign in.', 'info');
        navigation.navigate('Login');
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
    <RegistrationWrapper currentStep={4} totalSteps={4} stepLabel="Create your account" onBack={() => navigation.goBack()}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 24 }}>
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
          <View style={styles.emailRow}>
            <TextInput 
              style={[
                styles.input,
                { flex: 1 },
                isGoogleUser && styles.inputPrefilled,
                emailVerified && { borderColor: colors.success, borderWidth: 1.5 },
              ]} 
              value={email} 
              onChangeText={setEmail} 
              autoCapitalize="none"
              editable={true}
              placeholder="Enter email address"
              placeholderTextColor={colors.gray400}
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
                    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || otpLoading) && styles.verifyEmailButtonDisabled
                  ]}
                  onPress={handleSendOTP}
                  disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || otpLoading}
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
        </View>

        {/* EMAIL VERIFICATION OTP input */}
        {!isGoogleUser && showOtpInput && !emailVerified && (
          <View style={styles.emailVerifyContainer}>
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
    </RegistrationWrapper>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  scroll: { flex: 1 },
  row: { flexDirection: 'row' },
  // Google user info styles
  googleUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(34, 197, 94, 0.2)',
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
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 2,
  },
  googleUserName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 2,
  },
  googleUserEmail: {
    fontSize: 13,
    color: '#64748B',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    lineHeight: 22,
    marginBottom: 24,
  },
  field: { marginTop: 16 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
    fontWeight: '700',
  },
  prefilledLabel: {
    color: '#22C55E',
    fontWeight: '400',
    fontSize: 11,
  },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 12,
    padding: 14,
    color: '#F1F5F9',
    fontSize: 15,
  },
  inputPrefilled: {
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderWidth: 1.5,
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
    padding: 8,
    borderRadius: 8,
  },
  referralCodeHintText: {
    fontSize: 11,
    color: '#22C55E',
    marginLeft: 6,
    flex: 1,
  },
  // EMAIL VERIFICATION styles
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
    marginTop: -4,
    marginBottom: 12,
  },
  emailVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
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
    color: '#FFFFFF',
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
  summaryContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  summaryText: {
    fontSize: 13,
    color: '#94A3B8',
    flex: 1,
  },
  primaryBtn: {
    marginTop: 28,
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  // DatePicker styles
  datePicker: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 12,
    padding: 14,
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
    fontSize: 15,
    color: '#F1F5F9',
  },
  placeholderText: {
    color: '#64748B',
    fontSize: 15,
  },
  // Welcome Bonus Banner styles
  welcomeBonusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  welcomeBonusIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
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
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    backgroundColor: 'transparent',
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
    fontSize: 11,
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 32,
  },
});
