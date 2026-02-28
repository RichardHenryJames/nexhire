import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../contexts/AuthContext';
import { useTheme } from '../../../../contexts/ThemeContext';
import { typography } from '../../../../styles/theme';
import { authDarkColors } from '../../../../styles/authDarkColors';
import useResponsive from '../../../../hooks/useResponsive';
import { showToast } from '../../../../components/Toast';
import RegistrationWrapper from '../../../../components/auth/RegistrationWrapper';

export default function ExperienceTypeSelectionScreen({ navigation, route }) {
  const colors = authDarkColors; // Always use dark colors for auth screens
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
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
      showToast('Please select your experience level', 'error');
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

  // Handle Skip to final screen
  const handleSkipToFinal = () => {
    if (!selectedType) {
      showToast('Please select your experience level first', 'error');
      return;
    }

    
    // Navigate directly to PersonalDetailsScreenDirect
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
      activeOpacity={0.8}
    >
      <View style={styles.cardIconBadge}>
        <Ionicons 
          name={icon} 
          size={28} 
          color={selectedType === type ? '#3B82F6' : '#94A3B8'} 
        />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={[
            styles.cardTitle,
            selectedType === type && styles.cardTitleSelected
          ]}>
            {title}
          </Text>
          {selectedType === type && (
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            </View>
          )}
        </View>
        <Text style={styles.cardDescription}>{description}</Text>
        <Text style={styles.cardExamples}>{examples}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <RegistrationWrapper
      currentStep={1}
      totalSteps={4}
      stepLabel="Choose your path"
      onBack={() => navigation.navigate('Login')}
      showTrustBadge={true}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Google user card */}
          {(googleUser || pendingGoogleAuth?.user) && (fromGoogleAuth || pendingGoogleAuth) && (
            <View style={styles.googleUserInfo}>
              {(googleUser?.picture || pendingGoogleAuth?.user?.picture) && (
                <Image 
                  source={{ uri: googleUser?.picture || pendingGoogleAuth?.user?.picture }} 
                  style={styles.googleUserAvatar}
                />
              )}
              <View style={styles.googleUserTextContainer}>
                <Text style={styles.googleUserWelcome}>Google Account Connected</Text>
                <Text style={styles.googleUserName}>
                  {googleUser?.name || googleUser?.given_name || pendingGoogleAuth?.user?.name || 'Google User'}
                </Text>
                <Text style={styles.googleUserEmail}>
                  {googleUser?.email || pendingGoogleAuth?.user?.email || 'Email'}
                </Text>
              </View>
              <View style={styles.googleCheckBadge}>
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              </View>
            </View>
          )}

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>What describes you best?</Text>
            <Text style={styles.subtitle}>
              We'll personalize your experience based on your background
            </Text>
          </View>

          {/* Skip pill */}
          {!!selectedType && (
            <TouchableOpacity
              style={styles.skipPillButton}
              onPress={handleSkipToFinal}
              activeOpacity={0.7}
            >
              <Ionicons name="flash" size={14} color="#3B82F6" />
              <Text style={styles.skipPillButtonText}>Quick setup — skip details</Text>
              <Ionicons name="chevron-forward" size={14} color="#3B82F6" />
            </TouchableOpacity>
          )}

          {/* Cards */}
          <View style={styles.cardsContainer}>
            <ExperienceCard
              type="Student"
              title="Student / Fresh Graduate"
              icon="school-outline"
              description="Currently enrolled or recently graduated"
              examples="Internships · Entry-level roles · Part-time work"
            />
            <ExperienceCard
              type="Experienced"
              title="Working Professional"
              icon="briefcase-outline"
              description="Currently employed or have previous experience"
              examples="New opportunities · Career switch · Referrals"
            />
          </View>

          {/* Continue */}
          <TouchableOpacity
            style={[styles.continueButton, !selectedType && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!selectedType}
            activeOpacity={0.85}
          >
            <Text style={[styles.continueButtonText, !selectedType && styles.continueButtonTextDisabled]}>
              Continue
            </Text>
            <Ionicons 
              name="arrow-forward" 
              size={18} 
              color={selectedType ? '#FFFFFF' : '#64748B'} 
            />
          </TouchableOpacity>

          {/* Switch to employer */}
          <TouchableOpacity
            style={styles.switchFlowButton}
            onPress={handleSwitchToEmployer}
            activeOpacity={0.7}
          >
            <Ionicons name="business-outline" size={18} color="#94A3B8" />
            <Text style={styles.switchFlowButtonText}>
              I'm looking to hire instead
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </RegistrationWrapper>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 8,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  content: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 520 : '100%',
    padding: 24,
    paddingTop: 8,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    lineHeight: 22,
  },

  // Google user info
  googleUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  googleUserAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  googleUserTextContainer: { flex: 1 },
  googleUserWelcome: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22C55E',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  googleUserName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 1,
  },
  googleUserEmail: {
    fontSize: 12,
    color: '#94A3B8',
  },
  googleCheckBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Skip
  skipPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    marginBottom: 20,
  },
  skipPillButtonText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
  },

  // Cards
  cardsContainer: {
    gap: 14,
    marginBottom: 28,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  cardSelected: {
    borderColor: 'rgba(59, 130, 246, 0.5)',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  cardIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardBody: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F1F5F9',
    flex: 1,
  },
  cardTitleSelected: {
    color: '#60A5FA',
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
    marginBottom: 6,
  },
  cardExamples: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },

  // Continue button
  continueButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    gap: 8,
    marginBottom: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonDisabled: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  continueButtonTextDisabled: {
    color: '#64748B',
  },

  // Switch flow
  switchFlowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    marginBottom: 8,
  },
  switchFlowButtonText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
});