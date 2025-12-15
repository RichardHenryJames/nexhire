import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../contexts/AuthContext';
import { colors, typography } from '../../../../styles/theme';

export default function ExperienceTypeSelectionScreen({ navigation, route }) {
  const [selectedType, setSelectedType] = useState(null);
  const { pendingGoogleAuth } = useAuth(); // 🔧 Get from context
  
  const { 
    userType = 'JobSeeker', 
    fromGoogleAuth: fromGoogleAuthParam = false, 
    googleUser: routeGoogleUser = null 
  } = route.params || {};

  // 🔧 Handle fromGoogleAuth as string from URL params
  const fromGoogleAuth = fromGoogleAuthParam === true || fromGoogleAuthParam === 'true';

  // 🔧 Use googleUser from route or fallback to context
  const googleUser = routeGoogleUser || pendingGoogleAuth?.user;

  // 🔧 IMPROVED: Guard against hard refresh with lost Google data
  useEffect(() => {
    if (fromGoogleAuth && !googleUser && !pendingGoogleAuth) {
      console.warn('⚠️ Hard refresh detected with lost Google data - redirecting to login');
      
      // 🔧 For web: Use window.location for reliable redirect
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
        return;
      }
      
      // For native: Reset to Login
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }, 100);
    }
  }, [fromGoogleAuth, googleUser, pendingGoogleAuth, navigation]);

  const handleSwitchToEmployer = () => {
    const parentNav = navigation.getParent?.();
    const target = {
      screen: 'EmployerTypeSelection',
      params: {
        userType: 'Employer',
        fromGoogleAuth,
        googleUser,
      },
    };

    if (parentNav?.replace) {
      parentNav.replace('EmployerFlow', target);
      return;
    }

    navigation.navigate('EmployerFlow', target);
  };

  const handleContinue = () => {
    if (!selectedType) {
      Alert.alert('Selection Required', 'Please select your experience level');
      return;
    }

    if (selectedType === 'Student') {
      // Students go directly to education details
      navigation.navigate('EducationDetailsScreen', { 
        userType, 
        experienceType: selectedType,
        fromGoogleAuth,
        googleUser
      });
    } else {
      // Experienced professionals first provide work experience
      navigation.navigate('WorkExperienceScreen', { 
        userType, 
        experienceType: selectedType,
        fromGoogleAuth,
        googleUser
      });
    }
  };

  // FIXED: Handle Skip to final screen - using same logic as UserTypeSelectionScreen
  const handleSkipToFinal = () => {
    if (!selectedType) {
      Alert.alert('Selection Required', 'Please select your experience level first');
      return;
    }

    
    // Navigate directly to PersonalDetailsScreenDirect (same route used in UserTypeSelectionScreen)
    navigation.navigate('PersonalDetailsScreenDirect', {
      userType,
      experienceType: selectedType,
      fromGoogleAuth,
      googleUser,
      skippedSteps: true,
    });
  };

  const ExperienceCard = ({ type, title, icon, description, examples }) => (
    <TouchableOpacity
      style={[
        styles.card,
        selectedType === type && styles.cardSelected
      ]}
      onPress={() => setSelectedType(type)}
    >
      <View style={styles.cardHeader}>
        <Ionicons 
          name={icon} 
          size={40} 
          color={selectedType === type ? colors.primary : colors.gray500} 
        />
        <View style={styles.cardTitleContainer}>
          <Text style={[
            styles.cardTitle,
            selectedType === type && styles.cardTitleSelected
          ]}>
            {title}
          </Text>
        </View>
        {selectedType === type && (
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
        )}
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
      <Text style={styles.cardExamples}>{examples}</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>

          {/* Show Google user info if available */}
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
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            </View>
          )}
          
          <Text style={styles.title}>What's your current situation?</Text>
          <Text style={styles.subtitle}>
            This helps us personalize your job search experience
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          <ExperienceCard
            type="Student"
            title="I'm a student"
            icon="school"
            description="Currently studying or recently graduated"
            examples="Looking for internships, entry-level positions, or part-time work"
          />

          <ExperienceCard
            type="Experienced"
            title="I have work experience"
            icon="briefcase"
            description="Already working or have previous work experience"
            examples="Seeking new opportunities, career advancement, or career change"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedType && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={!selectedType}
        >
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
        </TouchableOpacity>

        {/* FIXED: Single "Skip to Profile Register" button - always shown */}
        <TouchableOpacity
          style={[
            styles.skipButton,
            !selectedType && styles.skipButtonFaded
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
            Skip to Profile Register
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchFlowButton}
          onPress={handleSwitchToEmployer}
          activeOpacity={0.8}
        >
          <Ionicons name="business-outline" size={18} color={colors.primary} />
          <Text style={styles.switchFlowButtonText}>I want to hire talent</Text>
        </TouchableOpacity>
       
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
    marginBottom: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    lineHeight: 22,
  },
  // Google user info styles
  googleUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.success + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.success,
  },
  googleUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  googleUserTextContainer: {
    flex: 1,
  },
  googleUserWelcome: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.success,
    marginBottom: 2,
  },
  googleUserName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 1,
  },
  googleUserEmail: {
    fontSize: typography.sizes.xs,
    color: colors.gray600,
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
  },
  cardTitleSelected: {
    color: colors.primary,
  },
  cardDescription: {
    fontSize: typography.sizes.md,
    color: colors.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  cardExamples: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  continueButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 24, // ADDED: Equal spacing above button
    gap: 8,
    marginBottom: 16,
  },
  continueButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  continueButtonTextDisabled: {
    color: colors.gray400,
  },
  // Skip button styles (matching UserTypeSelectionScreen)
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
  skipButtonFaded: {
    borderColor: colors.gray400,
    backgroundColor: colors.gray50,
    opacity: 0.6,
  },
  skipButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
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
  switchFlowButton: {
    marginTop: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  switchFlowButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
});