import React, { useState, useEffect, useRef } from 'react';
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
  Image,
  Animated,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { spacing, typography, borderRadius, styles as themeStyles } from '../../styles/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { authDarkColors } from '../../styles/authDarkColors';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import useResponsive from '../../hooks/useResponsive';

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

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loginError, setLoginError] = useState(''); // State for login error message
  
  const { login, loginWithGoogle, loading, error, clearError, googleAuthAvailable, isAuthenticated, handlePostLoginRedirect, checkAuthState } = useAuth();
  const responsive = useResponsive();
  const { isMobile, isDesktop, isTablet } = responsive;
  const colors = authDarkColors; // Always use dark colors for auth screens
  const screenStyles = React.useMemo(() => createScreenStyles(colors, themeStyles, responsive), [colors, responsive]);

  // Check auth state when screen mounts or comes into focus
  useEffect(() => {
    // Re-check auth state when screen mounts (handles case where logged in on another tab)
    checkAuthState();
  }, []);

  // Redirect to home if already authenticated (after loading completes)
  useEffect(() => {
    if (!loading && isAuthenticated) {
      // Check if there's a pending redirect first
      const hasRedirect = handlePostLoginRedirect();
      if (!hasRedirect) {
        // No pending redirect, go to main screen
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }
    }
  }, [loading, isAuthenticated, navigation, handlePostLoginRedirect]);

  // FIXED: Clear error state when screen mounts or comes into focus
  useEffect(() => {
    setLoginError(''); // Clear local login error on mount
    clearError();
    
    // Also clear when screen comes into focus
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setLoginError(''); // Clear local login error on focus
      clearError();
      // Re-check auth state when screen comes into focus
      checkAuthState();
    });
    
    return () => {
      unsubscribeFocus();
    };
  }, [navigation, clearError, checkAuthState]);

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

    setLoginError(''); // Clear previous error
    setFormLoading(true);
    const result = await login(email, password);
    setFormLoading(false);
    
    if (!result.success) {
      const errorMessage = result.error || 'Please check your credentials and try again.';
      setLoginError(errorMessage); // Set error to display on UI
      
      // Also show alert for mobile
      if (Platform.OS !== 'web') {
        Alert.alert('Login Failed', errorMessage, [{ text: 'OK' }]);
      }
    }
    // If successful, navigation will happen automatically via auth context
  };

  // FIXED: Handle Google Sign-In with automatic navigation for new users
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      
      
      const result = await loginWithGoogle();
      
      if (result.success) {
        
        // Navigation handled by auth context automatically
      } else if (result.cancelled) {
        
        // Do nothing - user cancelled
      } else if (result.dismissed) {
        
        // Do nothing - user dismissed
      } else if (result.needsConfig) {
        Alert.alert(
          'Google Sign-In Not Available',
          'Google Sign-In is not configured yet. Please use email and password to sign in.',
          [{ text: 'OK' }]
        );
      } else if (result.needsRegistration) {
        
        
        // FIXED: No manual navigation needed!
        // The AuthContext has set pendingGoogleAuth state
        // AppNavigator will automatically detect hasPendingGoogleAuth and navigate to UserTypeSelection
        
        // Optional: Show a brief success message that registration is starting
        // But don't block with an Alert - let the automatic navigation happen
        
        
      } else {
        console.error('? Google Sign-In failed:', result.error);
        Alert.alert(
          'Sign-In Failed',
          result.error || 'Google Sign-In failed. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Google Sign-In error:', error);
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
    // For email/password sign up start the Job Seeker registration flow
    // directly at the experience type selection screen (skip user type)
    navigation.navigate('JobSeekerFlow', {
      screen: 'ExperienceTypeSelection',
      params: {
        userType: 'JobSeeker',
        fromGoogleAuth: false,
        googleUser: null,
      },
    });
  };

  const isSubmitDisabled = formLoading || loading || !email || !password;

  return (
    <View style={screenStyles.mainContainer}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={Platform.OS === 'web' ? screenStyles.webBackground : StyleSheet.absoluteFill}
      />
      
      {/* Floating Particles */}
      <FloatingParticle delay={0} style={screenStyles.floatingParticle} />
      <FloatingParticle delay={1000} style={screenStyles.floatingParticle} />
      <FloatingParticle delay={2000} style={screenStyles.floatingParticle} />
      
      {/* Bottom Decoration */}
      <View style={screenStyles.bottomDecoration}>
        <View style={screenStyles.decorationCircle1} />
        <View style={screenStyles.decorationCircle2} />
        <View style={screenStyles.decorationCircle3} />
      </View>

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
            <View style={screenStyles.card}>
              {/* Header */}
              <View style={screenStyles.header}>
            <Image
              source={require('../../../assets/refopen-logo.png')}
              style={screenStyles.logoImage}
              resizeMode="contain"
            />

            <Text style={screenStyles.title}>India's Leading Job & Referral Platform</Text>
            <Text style={screenStyles.subtitle}>Apply • Hire • Refer • Earn Rewards</Text>
          </View>


          {/* NEW: Google Sign-In Section */}
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
                  color="rgba(255, 255, 255, 0.8)" 
                  style={screenStyles.inputIcon}
                />
                <TextInput
                  style={screenStyles.input}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors(prev => ({ ...prev, email: null }));
                  }}
                  placeholder="Enter your email"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
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
                  color="rgba(255, 255, 255, 0.8)" 
                  style={screenStyles.inputIcon}
                />
                <TextInput
                  style={screenStyles.input}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors(prev => ({ ...prev, password: null }));
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
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
                    color="rgba(255, 255, 255, 0.8)" 
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
                  <Ionicons name="reload-outline" size={20} color={colors.primary} />
                  <Text style={[screenStyles.loginButtonText, { marginLeft: spacing.xs }]}>
                    Signing In...
                  </Text>
                </View>
              ) : (
                <Text style={screenStyles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Error Message - FIXED: Show loginError or context error */}
            {(loginError || error) && (
              <View style={screenStyles.globalErrorContainer}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={screenStyles.globalError}>{loginError || error}</Text>
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
                  setEmail('test@refopen.com');
                  setPassword('password123');
                }}
                style={screenStyles.devButton}
              >
                <Text style={screenStyles.devButtonText}>Fill Test Credentials</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* About Link */}
          <TouchableOpacity 
            style={screenStyles.aboutLink}
            onPress={() => navigation.navigate('AboutUs')}
          >
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
            <Text style={screenStyles.aboutLinkText}>About RefOpen</Text>
          </TouchableOpacity>
        </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const createScreenStyles = (colors, themeStyles, responsive = {}) => {
  const { isMobile = true, isDesktop = false, isTablet = false } = responsive;
  
  return StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#0F172A', // Dark fallback for web
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
  card: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.xl,
    padding: isMobile ? spacing.lg : spacing.xl,
    marginHorizontal: isMobile ? spacing.md : 'auto',
    marginVertical: spacing.xl,
    maxWidth: isDesktop ? 480 : '100%',
    width: isDesktop ? 480 : '100%',
    alignSelf: 'center',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    alignItems: isDesktop ? 'center' : 'stretch',
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
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoImage: {
    width: 280,
    height: 80,
    marginBottom: 12,
    tintColor: colors.white,
  },
  title: {
    fontSize: typography.sizes.lg,
    color: colors.white + 'E6',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: typography.weights.bold,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.white + 'B3',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: typography.weights.regular,
    letterSpacing: 1,
  },
  // NEW: Google Sign-In styles
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
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    marginHorizontal: spacing.md,
    color: 'rgba(255, 255, 255, 0.8)',
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
    ...themeStyles.body,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
    color: colors.white,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  inputIcon: {
    marginLeft: spacing.sm,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    fontSize: typography.sizes.base,
    color: colors.white,
  },
  eyeIcon: {
    padding: spacing.sm,
  },
  errorText: {
    ...themeStyles.caption,
    color: '#FFD700', // Gold/Yellow for errors on blue background
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonDisabled: {
    backgroundColor: '#f1f3f4',
    borderColor: '#e8eaed',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: '#3c4043',
    fontFamily: 'Roboto, sans-serif',
  },
  globalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  globalError: {
    ...themeStyles.bodySmall,
    color: '#FFD700',
    marginLeft: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    ...themeStyles.body,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  linkText: {
    ...themeStyles.body,
    color: colors.white,
    fontWeight: typography.weights.bold,
    textDecorationLine: 'underline',
  },
  // Development helper styles
  devHelper: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  devHelperTitle: {
    ...themeStyles.bodySmall,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: spacing.sm,
  },
  devButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.sm,
  },
  devButtonText: {
    ...themeStyles.caption,
    color: colors.white,
  },
  aboutLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  aboutLinkText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
});
};