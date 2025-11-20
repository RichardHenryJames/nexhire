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
  const linkTo = useLinkTo();
  
  // 🔧 Get from context
  const { hasPendingGoogleAuth, pendingGoogleAuth } = useAuth();
  
  const { 
    userType,
    fromGoogleAuth: fromGoogleAuthParam = false, 
    googleUser: routeGoogleUser = null 
  } = route.params || {};

  // 🔧 Handle fromGoogleAuth as string from URL params
  const fromGoogleAuth = fromGoogleAuthParam === true || fromGoogleAuthParam === 'true' || hasPendingGoogleAuth;

  // 🔧 Use googleUser from route or fallback to context (SAME AS ExperienceTypeSelectionScreen)
  const googleUser = routeGoogleUser || pendingGoogleAuth?.user;

  // 🔧 DEBUG: Log what we have
  useEffect(() => {
    console.log('📍 UserTypeSelection - Google Status:', {
      fromGoogleAuth,
      fromGoogleAuthParam,
      hasGoogleUser: !!googleUser,
      hasPendingAuth: !!pendingGoogleAuth,
      googleUserName: googleUser?.name,
      googleUserEmail: googleUser?.email,
      googleUserStructure: googleUser,
      pendingAuthUserStructure: pendingGoogleAuth?.user
    });
  }, [fromGoogleAuth, fromGoogleAuthParam, googleUser, pendingGoogleAuth]);

  // NEW: Guard against hard refresh with lost Google data
  useEffect(() => {
    if (fromGoogleAuth && !pendingGoogleAuth && !googleUser) {
      console.warn('⚠️ Hard refresh detected with lost Google data - redirecting to login');
      
      // 🔧 For web: Use window.location for reliable redirect
      if (typeof window !== 'undefined') {
        console.log('🌐 Using window.location redirect for web');
        window.location.href = '/login';
        return;
      }
      
      // For native: Use navigation reset
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }, 100);
    }
  }, [fromGoogleAuth, pendingGoogleAuth, googleUser, navigation]);

  // Show welcome message for Google users
  useEffect(() => {
    console.log('👋 Google user detected:', googleUser?.name || googleUser?.email || 'undefined');
    console.log('📊 Full googleUser object:', googleUser);
    console.log('📊 pendingGoogleAuth.user:', pendingGoogleAuth?.user);
  }, [googleUser, fromGoogleAuth, pendingGoogleAuth]);

  const handleContinue = async () => {
    if (!selectedType) {
      Alert.alert('Selection Required', 'Please select whether you are looking for jobs or hiring talent');
      return;
    }

    // FIXED: Don't complete Google registration here!
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
          {/* NEW: Show Google user info if available */}
          {(googleUser || pendingGoogleAuth?.user) && (fromGoogleAuth || pendingGoogleAuth) && (
            <View style={styles.googleUserInfo}>
              {(googleUser?.picture || pendingGoogleAuth?.user?.picture) && (
                <Image 
                  source={{ uri: googleUser?.picture || pendingGoogleAuth?.user?.picture }} 
                  style={styles.googleUserAvatar}
                />
              )}
              <View style={styles.googleUserTextContainer}>
                <Text style={styles.googleUserWelcome}>
                  ✅ Google Account Connected
                </Text>
                <Text style={styles.googleUserName}>
                  {googleUser?.name || googleUser?.given_name || pendingGoogleAuth?.user?.name || 'Google User'}
                </Text>
                <Text style={styles.googleUserEmail}>
                  {googleUser?.email || pendingGoogleAuth?.user?.email || 'Email'}
                </Text>
                <Text style={styles.googleUserNote}>
                  Your basic info has been captured from Google
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            </View>
          )}
          
          <Text style={styles.title}>
            {googleUser ? 'Complete Your Profile' : 'Welcome to RefOpen!'}
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
                Continue
              </Text>
              <Ionicons 
                name="arrow-forward" 
                size={20} 
                color={!selectedType ? colors.gray400 : colors.white} 
              />
            </>
          )}
        </TouchableOpacity>

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
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  // NEW: Google user info styles
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
    marginTop: 24,
    marginBottom: 16,
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: colors.gray300,
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
  continueButtonTextDisabled: {
    color: colors.gray400,
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
});