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
import { useAuth } from '../../../contexts/AuthContext';
import { colors, typography } from '../../../styles/theme';

export default function UserTypeSelectionScreen({ navigation, route }) {
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // ?? NEW: Extract Google user info from params (if coming from Google auth)
  const googleUser = route?.params?.googleUser;
  const fromGoogleAuth = route?.params?.fromGoogleAuth;
  
  const { completeGoogleRegistration, hasPendingGoogleAuth } = useAuth();

  // Show welcome message for Google users
  useEffect(() => {
    if (googleUser && fromGoogleAuth) {
      console.log('?? Google user detected:', googleUser.name);
    }
  }, [googleUser, fromGoogleAuth]);

  const handleContinue = async () => {
    if (!selectedType) {
      Alert.alert('Selection Required', 'Please select whether you are looking for jobs or hiring talent');
      return;
    }

    // ?? NEW: Handle Google registration completion
    if (googleUser && fromGoogleAuth) {
      await handleGoogleRegistrationContinue();
      return;
    }

    // Original flow for regular users
    if (selectedType === 'JobSeeker') {
      navigation.navigate('JobSeekerFlow', { 
        screen: 'ExperienceTypeSelection',
        params: { userType: 'JobSeeker' }
      });
    } else {
      navigation.navigate('EmployerFlow', { 
        screen: 'EmployerTypeSelection',
        params: { userType: 'Employer' }
      });
    }
  };

  // ?? NEW: Handle Google user registration completion
  const handleGoogleRegistrationContinue = async () => {
    try {
      setLoading(true);
      
      console.log('?? Completing Google registration...');
      console.log('??? Selected type:', selectedType);
      console.log('?? Google user:', googleUser.email);

      const result = await completeGoogleRegistration({
        userType: selectedType,
        // You can add experience type for job seekers here later
        // experienceType: selectedType === 'JobSeeker' ? 'Student' : undefined
      });

      if (result.success) {
        console.log('? Google registration completed successfully');
        
        // Show success message
        Alert.alert(
          'Welcome to NexHire!',
          `Your ${selectedType === 'JobSeeker' ? 'job seeker' : 'employer'} account has been created successfully.`,
          [
            {
              text: 'Continue',
              onPress: () => {
                // Navigate based on user type to complete profile
                if (selectedType === 'JobSeeker') {
                  navigation.replace('JobSeekerFlow', {
                    screen: 'ExperienceTypeSelection',
                    params: { 
                      userType: 'JobSeeker',
                      fromGoogleAuth: true,
                      skipEmailPassword: true 
                    }
                  });
                } else {
                  navigation.replace('EmployerFlow', {
                    screen: 'EmployerTypeSelection', 
                    params: { 
                      userType: 'Employer',
                      fromGoogleAuth: true,
                      skipEmailPassword: true
                    }
                  });
                }
              }
            }
          ]
        );
      } else {
        console.error('? Google registration failed:', result.error);
        Alert.alert(
          'Registration Failed',
          result.error || 'Failed to complete account setup. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('? Google registration error:', error);
      Alert.alert(
        'Error',
        error.message || 'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
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
              <Text style={styles.googleUserWelcome}>
                Welcome, {googleUser.given_name || googleUser.name}!
              </Text>
              <Text style={styles.googleUserEmail}>{googleUser.email}</Text>
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
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  // ?? NEW: Google user info styles
  googleUserInfo: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleUserAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  googleUserWelcome: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  googleUserEmail: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
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