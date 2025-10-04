import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLinkTo } from '@react-navigation/native';
import { useAuth } from '../../../contexts/AuthContext';
import { colors, typography } from '../../../styles/theme';

export default function UserTypeSelectionScreen({ navigation, route }) {
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false); // 🔧 NEW: State for confirmation
  const linkTo = useLinkTo(); // 🔧 NEW: Web-compatible navigation hook
  
  // 🔧 IMPROVED: Get Google user info from multiple sources
  const { hasPendingGoogleAuth, pendingGoogleAuth } = useAuth();
  
  // Check route params first, then fallback to context
  const routeGoogleUser = route?.params?.googleUser;
  const routeFromGoogleAuth = route?.params?.fromGoogleAuth;
  
  const googleUser = routeGoogleUser || pendingGoogleAuth?.user;
  const fromGoogleAuth = routeFromGoogleAuth || hasPendingGoogleAuth;

  console.log('🔍 UserTypeSelection state:', {
    hasRouteParams: !!route?.params,
    hasGoogleUser: !!googleUser,
    fromGoogleAuth,
    hasPendingGoogleAuth,
    googleUserEmail: googleUser?.email
  });

  // ?? NEW: Guard against hard refresh with lost Google data
  useEffect(() => {
    if (fromGoogleAuth && !pendingGoogleAuth && !googleUser) {
      console.warn('⚠️ Hard refresh detected with lost Google data - redirecting to login');
      
      // Silent immediate redirect
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }, [fromGoogleAuth, pendingGoogleAuth, googleUser, navigation]);

  // Show welcome message for Google users
  useEffect(() => {
    if (googleUser && fromGoogleAuth) {
      console.log('👋 Google user detected:', googleUser.name || googleUser.email);
    }
  }, [googleUser, fromGoogleAuth]);

  const handleContinue = async () => {
    if (!selectedType) {
      Alert.alert('Selection Required', 'Please select whether you are looking for jobs or hiring talent');
      return;
    }

    // ?? FIXED: Don't complete Google registration here!
    // Just navigate to the registration flow like regular users
    // The PersonalDetailsScreen will handle the actual registration with Google auth data
    
    if (selectedType === 'JobSeeker') {
      navigation.navigate('JobSeekerFlow', { 
        screen: 'ExperienceTypeSelection',
        params: { 
          userType: 'JobSeeker',
          fromGoogleAuth: fromGoogleAuth,
          googleUser: googleUser
        }
      });
    } else {
      navigation.navigate('EmployerFlow', { 
        screen: 'EmployerTypeSelection',
        params: { 
          userType: 'Employer',
          fromGoogleAuth: fromGoogleAuth,
          googleUser: googleUser
        }
      });
    }
  };

  // ?? NEW: Handle Skip to final screen - WEB COMPATIBLE VERSION with useLinkTo fallback
  const handleSkipToFinal = () => {
    console.log('🔧 Skip button clicked, selectedType:', selectedType);
    
    if (!selectedType) {
      // 🔧 For web: Use window.confirm instead of Alert
      if (typeof window !== 'undefined' && window.confirm) {
        window.confirm('Please select whether you\'re looking for jobs or hiring talent first.');
      } else {
        Alert.alert('Selection Required', 'Please select your user type first');
      }
      return;
    }

    console.log('✅ Navigating to final screen for:', selectedType);
    
    try {
      if (selectedType === 'JobSeeker') {
        console.log('📍 Attempting navigation to PersonalDetailsScreenDirect');
        
        const params = {
          userType: 'JobSeeker',
          fromGoogleAuth: fromGoogleAuth,
          googleUser: googleUser,
          skippedSteps: true,
          experienceType: 'Unknown',
        };
        
        // 🔧 TRY METHOD 1: Standard navigation
        navigation.navigate('PersonalDetailsScreenDirect', params);
        
        // 🔧 TRY METHOD 2: Use linkTo as fallback for web (after small delay)
        setTimeout(() => {
          try {
            // Encode params as URL query string
            const queryParams = new URLSearchParams({
              userType: 'JobSeeker',
              fromGoogleAuth: fromGoogleAuth.toString(),
              skippedSteps: 'true',
              experienceType: 'Unknown',
            }).toString();
            
            linkTo(`/register/complete-profile?${queryParams}`);
            console.log('🌐 Web navigation fallback triggered');
          } catch (linkError) {
            console.warn('Link navigation failed:', linkError);
          }
        }, 100);
        
        console.log('✅ Navigation dispatched');
      } else {
        console.log('📍 Attempting navigation to EmployerAccountScreenDirect');
        
        navigation.navigate('EmployerAccountScreenDirect', {
          userType: 'Employer',
          fromGoogleAuth: fromGoogleAuth,
          googleUser: googleUser,
          skippedSteps: true,
          employerType: 'company',
        });
        
        // 🔧 Web fallback
        setTimeout(() => {
          try {
            const queryParams = new URLSearchParams({
              userType: 'Employer',
              fromGoogleAuth: fromGoogleAuth.toString(),
              skippedSteps: 'true',
              employerType: 'company',
            }).toString();
            
            linkTo(`/register/complete-employer?${queryParams}`);
            console.log('🌐 Web navigation fallback triggered');
          } catch (linkError) {
            console.warn('Link navigation failed:', linkError);
          }
        }, 100);
        
        console.log('✅ Navigation dispatched');
      }
    } catch (error) {
      console.error('💥 Navigation error:', error);
    }
  };

  const UserTypeCard = ({ type, title, subtitle, icon, description }) => (
    <TouchableOpacity
      style={[
        styles.card,
        selectedType === type && styles.cardSelected
      ]}
      onPress={() => setSelectedType(type)}
      disabled={loading}
    >
      <View style={styles.cardHeader}>
        <Ionicons 
          name={icon} 
          size={48} 
          color={selectedType === type ? colors.primary : colors.gray500} 
        />
        <View style={styles.cardTitleContainer}>
          <Text style={[
            styles.cardTitle,
            selectedType === type && styles.cardTitleSelected
          ]}>
            {title}
          </Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        {selectedType === type && (
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
        )}
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          {/* ?? NEW: Show Google user info if available */}
          {googleUser && (
            <View style={styles.googleUserInfo}>
              {googleUser.picture && (
                <Image 
                  source={{ uri: googleUser.picture }} 
                  style={styles.googleUserAvatar}
                />
              )}
              <View style={styles.googleUserTextContainer}>
                <Text style={styles.googleUserWelcome}>
                  ✅ Google Account Connected
                </Text>
                <Text style={styles.googleUserName}>{googleUser.name}</Text>
                <Text style={styles.googleUserEmail}>{googleUser.email}</Text>
                <Text style={styles.googleUserNote}>
                  Your basic info has been captured from Google
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            </View>
          )}
          
          <Text style={styles.title}>
            {googleUser ? 'Complete Your Profile' : 'Welcome to NexHire!'}
          </Text>
          <Text style={styles.subtitle}>
            {googleUser 
              ? 'Let us know what you\'re looking for to personalize your experience'
              : 'Let\'s get started by understanding what you\'re looking for'
            }
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          <UserTypeCard
            type="JobSeeker"
            title="I'm looking for jobs"
            subtitle="Job Seeker"
            icon="search"
            description="Find your dream job, explore opportunities, and advance your career"
          />

          <UserTypeCard
            type="Employer"
            title="I'm hiring talent"
            subtitle="Employer"
            icon="business"
            description="Post jobs, find qualified candidates, and grow your team"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            (!selectedType || loading) && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={!selectedType || loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="reload-outline" size={20} color={colors.white} />
              <Text style={styles.continueButtonText}>Setting up...</Text>
            </View>
          ) : (
            <>
              <Text style={[
                styles.continueButtonText,
                !selectedType && styles.continueButtonTextDisabled
              ]}>
                Continue with Full Setup
              </Text>
              <Ionicons 
                name="arrow-forward" 
                size={20} 
                color={!selectedType ? colors.gray400 : colors.white} 
              />
            </>
          )}
        </TouchableOpacity>

        {/* 🔧 NEW: Skip Button for Google users */}
        {googleUser && (
          <>
            <TouchableOpacity
              style={[
                styles.skipButton,
                !selectedType && styles.skipButtonFaded,
              ]}
              onPress={handleSkipToFinal}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="flash-outline" 
                size={20} 
                color={!selectedType ? colors.gray500 : colors.primary} 
              />
              <Text style={[
                styles.skipButtonText,
                !selectedType && styles.skipButtonTextFaded
              ]}>
                Skip to Profile Completion
              </Text>
            </TouchableOpacity>
            {!selectedType && (
              <Text style={styles.skipHintText}>
                💡 Select a user type above to enable skip option
              </Text>
            )}
          </>
        )}

        {/* Only show login link if not coming from Google auth */}
        {!googleUser && (
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              Already have an account? Sign In
            </Text>
          </TouchableOpacity>
        )}

        {/* 🔧 CONFIRMATION DIALOG: Skip Registration Steps? */}
        {showSkipConfirm && (
          <View style={styles.confirmationDialog}>
            <Text style={styles.confirmationTitle}>
              Skip Registration Steps?
            </Text>
            <Text style={styles.confirmationMessage}>
              You can complete your profile details now and fill in work/education information later.
            </Text>

            <View style={styles.confirmationActions}>
              <TouchableOpacity
                style={styles.confirmationButton}
                onPress={() => setShowSkipConfirm(false)} // Cancel
              >
                <Text style={styles.confirmationButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmationButton,
                  styles.confirmationButtonPrimary
                ]}
                onPress={confirmSkip} // Confirm skip
              >
                <Text style={styles.confirmationButtonText}>Skip to Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  // ?? NEW: Google user info styles
  googleUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 20,
    backgroundColor: colors.success + '10',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.success,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  googleUserAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
    borderWidth: 2,
    borderColor: colors.success,
  },
  googleUserWelcome: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.success,
    marginBottom: 4,
  },
  googleUserEmail: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 4,
  },
  googleUserTextContainer: {
    flex: 1,
  },
  googleUserName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  googleUserNote: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    fontStyle: 'italic',
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
    lineHeight: 22,
  },
  cardsContainer: {
    flex: 1,
    gap: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleContainer: {
    flex: 1,
    marginLeft: 16,
  },
  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  cardTitleSelected: {
    color: colors.primary,
  },
  cardSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    fontWeight: typography.weights.medium,
  },
  cardDescription: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  skipButtonDisabled: {
    borderColor: colors.gray300,
    backgroundColor: colors.gray100,
  },
  skipButtonFaded: {
    borderColor: colors.gray400,
    backgroundColor: colors.gray50,
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  skipButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  continueButtonTextDisabled: {
    color: colors.gray400,
  },
  skipButtonTextDisabled: {
    color: colors.gray400,
  },
  skipButtonTextFaded: {
    color: colors.gray600,
  },
  skipHintText: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 16,
    fontStyle: 'italic',
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
  // 🔧 NEW: Confirmation dialog styles
  confirmationDialog: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.black + '80',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmationTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginBottom: 16,
  },
  confirmationMessage: {
    fontSize: typography.sizes.md,
    color: colors.gray200,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmationButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  confirmationButtonPrimary: {
    backgroundColor: colors.primary,
  },
  confirmationButtonText: {
    color: colors.text,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});