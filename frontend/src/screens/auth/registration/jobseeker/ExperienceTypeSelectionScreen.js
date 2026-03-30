import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../contexts/AuthContext';
import { authDarkColors } from '../../../../styles/authDarkColors';
import useResponsive from '../../../../hooks/useResponsive';
import { showToast } from '../../../../components/Toast';
import RegistrationWrapper from '../../../../components/auth/RegistrationWrapper';

export default function ExperienceTypeSelectionScreen({ navigation, route }) {
  const colors = authDarkColors;
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const [selectedType, setSelectedType] = useState(null);
  const { pendingGoogleAuth } = useAuth();

  const {
    userType = 'JobSeeker',
    fromGoogleAuth: fromGoogleAuthParam = false,
    googleUser: routeGoogleUser = null,
  } = route.params || {};

  const fromGoogleAuth = fromGoogleAuthParam === true || fromGoogleAuthParam === 'true';
  const googleUser = routeGoogleUser || pendingGoogleAuth?.user;

  // Guard against hard refresh with lost Google data
  useEffect(() => {
    if (fromGoogleAuth && !googleUser && !pendingGoogleAuth) {
      console.warn('⚠️ Hard refresh detected with lost Google data - redirecting to login');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
        return;
      }
      setTimeout(() => {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }, 100);
    }
  }, [fromGoogleAuth, googleUser, pendingGoogleAuth, navigation]);

  // ── Staggered entrance animations ──────────────────────────
  const headerAnim = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(30)).current;
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card1Slide = useRef(new Animated.Value(40)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;
  const card2Slide = useRef(new Animated.Value(40)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Header
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }),
    ]).start();

    // Card 1 at 200ms
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(card1Anim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(card1Slide, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }),
      ]).start();
    }, 200);

    // Card 2 at 350ms
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(card2Anim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(card2Slide, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }),
      ]).start();
    }, 350);

    // Footer at 500ms
    setTimeout(() => {
      Animated.timing(footerAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 500);
  }, []);

  // Continue button scale bounce
  const btnScale = useRef(new Animated.Value(0.95)).current;
  useEffect(() => {
    Animated.spring(btnScale, {
      toValue: selectedType ? 1 : 0.95,
      useNativeDriver: true,
      tension: 80,
      friction: 8,
    }).start();
  }, [selectedType]);

  // ── Navigation handlers ──────────────────────────────────
  const handleContinue = () => {
    if (!selectedType) {
      showToast('Please select your experience level', 'error');
      return;
    }
    if (selectedType === 'Student') {
      navigation.navigate('EducationDetailsScreen', {
        userType,
        experienceType: selectedType,
        totalSteps: 3,
        fromGoogleAuth,
        googleUser,
      });
    } else {
      navigation.navigate('WorkExperienceScreen', {
        userType,
        experienceType: selectedType,
        totalSteps: 4,
        fromGoogleAuth,
        googleUser,
      });
    }
  };

  // ── Experience card component ────────────────────────────
  const ExperienceCard = ({ type, title, emoji, description, tags, animOpacity, animSlide }) => {
    const isSelected = selectedType === type;

    return (
      <Animated.View style={{ opacity: animOpacity, transform: [{ translateY: animSlide }] }}>
        <TouchableOpacity
          style={[styles.card, isSelected && styles.cardSelected]}
          onPress={() => setSelectedType(type)}
          activeOpacity={0.8}
        >
          <View style={styles.cardInner}>
            <View style={[styles.cardIconBadge, isSelected && styles.cardIconBadgeSelected]}>
              <Text style={styles.cardEmoji}>{emoji}</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardTitleRow}>
                <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                  {title}
                </Text>
                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </View>

              <Text style={styles.cardDescription}>{description}</Text>

              <View style={styles.cardTagsRow}>
                {tags.map((tag, i) => (
                  <View key={i} style={[styles.cardTag, isSelected && styles.cardTagSelected]}>
                    <Text style={[styles.cardTagText, isSelected && styles.cardTagTextSelected]}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <RegistrationWrapper
      currentStep={1}
      totalSteps={selectedType === 'Student' ? 3 : selectedType === 'Experienced' ? 4 : 3}
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
                <Ionicons name="checkmark" size={14} color={colors.white} />
              </View>
            </View>
          )}

          {/* Header */}
          <Animated.View
            style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerSlide }] }]}
          >
            <Text style={styles.greeting}>👋</Text>
            <Text style={styles.title}>What describes you best?</Text>
            <Text style={styles.subtitle}>
              We'll personalize your experience based on your background
            </Text>
          </Animated.View>

          {/* Cards */}
          <View style={styles.cardsContainer}>
            <ExperienceCard
              type="Student"
              title="Student / Fresh Graduate"
              emoji="🎓"
              description="Currently enrolled or recently graduated"
              tags={['Internships', 'Entry-level', 'Campus hire']}
              animOpacity={card1Anim}
              animSlide={card1Slide}
            />
            <ExperienceCard
              type="Experienced"
              title="Working Professional"
              emoji="💼"
              description="Currently employed or have work experience"
              tags={['New opportunities', 'Career switch', 'Referrals']}
              animOpacity={card2Anim}
              animSlide={card2Slide}
            />
          </View>

          {/* Continue button */}
          <Animated.View style={{ opacity: footerAnim, transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[styles.continueButton, !selectedType && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={!selectedType}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.continueButtonText,
                  !selectedType && styles.continueButtonTextDisabled,
                ]}
              >
                Continue
              </Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={selectedType ? colors.white : colors.textMuted}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    </RegistrationWrapper>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const createStyles = (colors, responsive = {}) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingVertical: 8,
      ...(Platform.OS === 'web' && responsive.isDesktop
        ? { alignItems: 'center' }
        : {}),
    },
    content: {
      width: '100%',
      maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 600 : '100%',
      padding: 24,
      paddingTop: 8,
      alignSelf: 'center',
    },

    /* ── Header ───────────────────────── */
    header: {
      marginBottom: 32,
    },
    greeting: {
      fontSize: 40,
      marginBottom: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
    },

    /* ── Google user info ─────────────── */
    googleUserInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
      padding: 16,
      backgroundColor: colors.successGlowSubtle,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.successBorder,
    },
    googleUserAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: 12,
      borderWidth: 2,
      borderColor: colors.successBorderStrong,
    },
    googleUserTextContainer: { flex: 1 },
    googleUserWelcome: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.success,
      marginBottom: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    googleUserName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 1,
    },
    googleUserEmail: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    googleCheckBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* ── Cards ────────────────────────── */
    cardsContainer: {
      gap: 16,
      marginBottom: 24,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.borderThin,
      overflow: 'hidden',
    },
    cardSelected: {
      borderColor: colors.cardGlowBorder,
      backgroundColor: colors.cardGlow,
    },
    cardInner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 20,
    },
    cardIconBadge: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.borderFaint,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    cardIconBadgeSelected: {
      backgroundColor: colors.primaryGlow,
    },
    cardEmoji: {
      fontSize: 28,
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
      color: colors.text,
      flex: 1,
    },
    cardTitleSelected: {
      color: colors.primaryLight,
    },
    cardDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },

    /* ── Radio button ─────────────────── */
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    radioOuterSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },

    /* ── Tags ─────────────────────────── */
    cardTagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    cardTag: {
      backgroundColor: colors.borderFaint,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    cardTagSelected: {
      backgroundColor: colors.primaryGlow,
    },
    cardTagText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '500',
    },
    cardTagTextSelected: {
      color: colors.primaryLight,
    },

    /* ── Continue button ──────────────── */
    continueButton: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      paddingHorizontal: 24,
      borderRadius: 16,
      gap: 8,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    continueButtonDisabled: {
      backgroundColor: colors.surfaceElevated,
      shadowOpacity: 0,
      elevation: 0,
    },
    continueButtonText: {
      color: colors.white,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    continueButtonTextDisabled: {
      color: colors.textMuted,
    },
  });
