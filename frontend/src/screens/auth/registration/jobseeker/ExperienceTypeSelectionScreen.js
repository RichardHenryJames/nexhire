import React, { useState } from 'react';
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
import { colors, typography } from '../../../../styles/theme';

export default function ExperienceTypeSelectionScreen({ navigation, route }) {
  const [selectedType, setSelectedType] = useState(null);
  const { 
    userType, 
    fromGoogleAuth = false, 
    googleUser = null 
  } = route.params || {};

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

  // ?? NEW: Handle Skip to final screen
  const handleSkipToFinal = () => {
    if (!selectedType) {
      Alert.alert('Selection Required', 'Please select your experience level first');
      return;
    }

    Alert.alert(
      'Skip Registration Steps?',
      'You can complete your profile now and add work/education details later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip to Profile',
          onPress: () => {
            navigation.navigate('PersonalDetails', {
              userType,
              experienceType: selectedType,
              fromGoogleAuth,
              googleUser,
              skippedSteps: true,
            });
          }
        }
      ]
    );
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

          {/* ?? NEW: Show Google user info if available */}
          {googleUser && fromGoogleAuth && (
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

        {/* Skip Button - NEW PART */}
        <TouchableOpacity
          style={[
            styles.skipButton,
            !selectedType && styles.skipButtonDisabled
          ]}
          onPress={handleSkipToFinal}
          disabled={!selectedType}
        >
          <Text style={[
            styles.skipButtonText,
            !selectedType && styles.skipButtonTextDisabled
          ]}>
            Skip
          </Text>
          <Ionicons 
            name="arrow-forward" 
            size={20} 
            color={!selectedType ? colors.gray400 : colors.white} 
          />
        </TouchableOpacity>

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
            Continue with Setup
          </Text>
          <Ionicons 
            name="arrow-forward" 
            size={20} 
            color={!selectedType ? colors.gray400 : colors.white} 
          />
        </TouchableOpacity>

        {/* ?? NEW: Skip Button for Google users */}
        {googleUser && fromGoogleAuth && (
          <TouchableOpacity
            style={[
              styles.skipButton,
              !selectedType && styles.skipButtonDisabled
            ]}
            onPress={handleSkipToFinal}
            disabled={!selectedType}
          >
            <Ionicons 
              name="flash-outline" 
              size={20} 
              color={!selectedType ? colors.gray400 : colors.primary} 
            />
            <Text style={[
              styles.skipButtonText,
              !selectedType && styles.skipButtonTextDisabled
            ]}>
              Skip to Profile Completion
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
  // NEW STYLES FOR GOOGLE USER INFO
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
    gap: 8,
    marginTop: 20,
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
  // ?? NEW: Skip button styles
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  skipButtonDisabled: {
    borderColor: colors.gray300,
    backgroundColor: colors.gray100,
  },
  skipButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  skipButtonTextDisabled: {
    color: colors.gray400,
  },
});