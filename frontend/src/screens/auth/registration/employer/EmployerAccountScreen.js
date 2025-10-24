import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Alert,
  Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../../styles/theme';
import refopenAPI from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import DatePicker from '../../../../components/DatePicker';

export default function EmployerAccountScreen({ navigation, route }) {
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
  const [submitting, setSubmitting] = useState(false);

  // Pre-populate Google user data
  useEffect(() => {
    if (isGoogleUser && googleUser) {
      console.log('Pre-populating Google user data for employer:', googleUser);
      
      setFirstName(googleUser.given_name || googleUser.name?.split(' ')[0] || '');
      setLastName(googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '');
      setEmail(googleUser.email || '');
      // No password needed for Google users
      setPassword('google-oauth-user');
      setConfirmPassword('google-oauth-user');
    }
  }, [isGoogleUser, googleUser]);

  const validate = () => {
    if (!firstName.trim() || !lastName.trim()) return 'First name and last name are required';
    if (!email.trim()) return 'Email is required';
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    
    // Skip password validation for Google users and already authenticated users
    if (!refopenAPI.token && !isGoogleUser) {
      if (!password || password.length < 6) return 'Password must be at least 6 characters';
      if (password !== confirmPassword) return 'Passwords do not match';
    }
    return null;
  };

  const onSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Validation', err);
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
        console.log('Completing Google employer registration...');
        
        // Prepare comprehensive registration data for Google user
        const registrationData = {
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          userType: 'Employer',
          ...(phone && { phone: phone.trim() }),
          ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
          
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

        console.log('Google employer registration payload:', JSON.stringify(registrationData, null, 2));

        const result = await register(registrationData);
        
        if (result.success) {
          // FIXED: Clear pending Google auth and let AuthContext handle navigation
          console.log('🔧 Employer registration successful, clearing Google auth and letting AuthContext handle navigation');
          clearPendingGoogleAuth();
          // Navigation will be handled automatically by AuthContext when isAuthenticated becomes true
          return;
        } else {
          // ✅ NEW: Check if error is "User already exists"
          const errorMessage = result.error || 'Google registration failed';
          
          if (errorMessage.includes('already exists') || errorMessage.includes('Conflict')) {
            console.log('⚠️ User already exists error - clearing auth data and redirecting to login');
            
            // Clear any pending Google auth data
            clearPendingGoogleAuth();
            
            Alert.alert(
              'Account Already Exists', 
              `An account with ${email} already exists. Would you like to sign in instead?`,
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
          ...organizationPayload,
        };

        const reg = await refopenAPI.register(payload);
        if (!reg?.success) {
          // ✅ NEW: Check if error is "User already exists"
          const errorMessage = reg?.error || 'Registration failed';
          
          if (errorMessage.includes('already exists') || errorMessage.includes('Conflict')) {
            console.log('⚠️ User already exists error - redirecting to login');
            
            Alert.alert(
              'Account Already Exists', 
              `An account with ${email} already exists. Would you like to sign in instead?`,
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
            return;
          }
          
          throw new Error(errorMessage);
        }

        // Auto-login
        const login = await refopenAPI.login(email.trim().toLowerCase(), password);
        if (!login?.success) throw new Error(login?.error || 'Login failed');

        Alert.alert('Welcome', 'Your employer account is ready.', [
          { text: 'Continue', onPress: () => navigation.replace('Main') }
        ]);
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

      Alert.alert('All set!', 'Employer onboarding steps completed.', [
        { text: 'Continue', onPress: () => navigation.replace('Main') }
      ]);
    } catch (e) {
      console.error('Employer account creation error:', e);
      
      // ✅ NEW: Also handle caught errors for "already exists"
      const errorMessage = e.message || 'Failed to complete setup';
      
      if (errorMessage.includes('already exists') || errorMessage.includes('Conflict')) {
        console.log('⚠️ User already exists error (caught) - clearing auth data and redirecting to login');
        
        // Clear any pending Google auth data
        if (isGoogleUser) {
          clearPendingGoogleAuth();
        }
        
        Alert.alert(
          'Account Already Exists', 
          `An account with ${email} already exists. Would you like to sign in instead?`,
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
    } finally { setSubmitting(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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

        <TouchableOpacity 
          style={[styles.primaryBtn, submitting && { opacity: 0.7 }]} 
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
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
});
