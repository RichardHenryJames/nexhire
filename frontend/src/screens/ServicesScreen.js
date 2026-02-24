/**
 * ServicesScreen - Premium Tools & Services Hub
 * 
 * Shown to job seekers who are NOT verified referrers.
 * Provides quick access to RefOpen's AI-powered career tools.
 * 
 * Ready:  Resume Analyzer
 * Coming: Resume Builder, Interview Prep, Company AI Match, Salary Insights
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { useFocusEffect } from '@react-navigation/native';
import refopenAPI from '../services/api';
import TabHeader from '../components/TabHeader';

const { width: screenWidth } = Dimensions.get('window');

// ── Service Definitions ─────────────────────────────────────
const SERVICES = [
  {
    id: 'resume-analyzer',
    title: 'Resume Analyzer',
    subtitle: 'AI-powered resume scoring',
    description: 'Get instant feedback on your resume with ATS compatibility score, missing keywords, and actionable improvement tips.',
    icon: 'document-text',
    gradient: ['#2563EB', '#3B82F6'],
    ready: true,
    screen: 'ResumeAnalyzer',
  },
  {
    id: 'resume-builder',
    title: 'Resume Builder',
    subtitle: 'Build your resume in minutes',
    description: 'AI creates a polished, job-ready resume from your work experience — tailored to any role with ATS-optimized formatting.',
    icon: 'create',
    gradient: ['#7C3AED', '#A78BFA'],
    ready: true,
    screen: 'ResumeBuilder',
  },
  {
    id: 'interview-prep',
    title: 'Interview Prep',
    subtitle: 'Practice with real questions',
    description: 'Get role-specific interview questions, model answers, and tips based on your target company — so you walk in prepared.',
    icon: 'mic',
    gradient: ['#059669', '#34D399'],
    ready: false,
    screen: 'InterviewDecoded',
  },
  {
    id: 'linkedin-optimizer',
    title: 'LinkedIn Optimizer',
    subtitle: 'Stand out to recruiters',
    description: 'Paste your LinkedIn URL — AI audits your headline, summary, and skills, then generates an optimized profile in one click.',
    icon: 'logo-linkedin',
    gradient: ['#0A66C2', '#378FE9'],
    ready: false,
    screen: 'LinkedInOptimizer',
  },
  {
    id: 'salary-spy',
    title: 'Salary Spy',
    subtitle: 'Real salaries from insiders',
    description: 'See what people at your target company actually earn — crowdsourced from verified employees. Contribute yours to unlock.',
    icon: 'eye',
    gradient: ['#DC2626', '#F87171'],
    ready: false,
    screen: 'SalarySpy',
  },
  {
    id: 'offer-negotiation',
    title: 'Offer Coach',
    subtitle: 'Negotiate like a pro',
    description: 'Upload your offer letter — AI tells you exactly what to negotiate, how much to push, and gives you ready-to-send email templates.',
    icon: 'cash',
    gradient: ['#0891B2', '#22D3EE'],
    ready: false,
    screen: 'OfferCoach',
  },
  {
    id: 'job-market-pulse',
    title: 'Market Pulse',
    subtitle: 'Real-time hiring trends',
    description: 'Live dashboard of who\'s hiring, trending roles, salary movements, and layoff alerts — updated daily.',
    icon: 'pulse',
    gradient: ['#15803D', '#4ADE80'],
    ready: false,
    screen: 'MarketPulse',
  },
  {
    id: 'blind-profile-review',
    title: 'Blind Review',
    subtitle: 'Insider feedback on your profile',
    description: 'Submit your profile anonymously — verified referrers from your target company rate it and tell you if they\'d refer you.',
    icon: 'people',
    gradient: ['#6D28D9', '#C084FC'],
    ready: false,
    screen: 'BlindReview',
  },
  {
    id: 'career-path-simulator',
    title: 'Career Simulator',
    subtitle: 'Map your 3-year trajectory',
    description: 'AI maps your career path — shows possible next roles, expected salary jumps, and the skills you need to get there.',
    icon: 'map',
    gradient: ['#BE185D', '#F472B6'],
    ready: false,
    screen: 'CareerSimulator',
  },
];

// ── Service Card Component ──────────────────────────────────
function ServiceCard({ service, onPress, colors, index, isDesktop, isInterested }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const isReady = service.ready;

  return (
    <Animated.View
      style={[
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        isDesktop && { width: '48%' },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.serviceCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        onPress={() => onPress(service)}
        activeOpacity={0.7}
      >
        {/* Icon + Gradient Circle */}
        <View style={styles.cardTop}>
          <LinearGradient
            colors={service.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            <Ionicons name={service.icon} size={22} color="#FFFFFF" />
          </LinearGradient>

          {!isReady && isInterested ? (
            <View style={[styles.requestedBadge, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
              <Text style={[styles.requestedText, { color: colors.primary }]}>Requested</Text>
            </View>
          ) : !isReady ? (
            <View style={[styles.lockBadge, { backgroundColor: colors.gray200 || colors.border }]}>
              <Ionicons name="lock-closed" size={12} color={colors.gray500} />
            </View>
          ) : null}
        </View>

        {/* Content */}
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
          {service.title}
        </Text>
        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {service.subtitle}
        </Text>
        <Text style={[styles.cardDescription, { color: colors.gray500 }]} numberOfLines={2}>
          {service.description}
        </Text>

        {/* CTA */}
        <View style={[styles.ctaRow, { borderTopColor: colors.border }]}>
          {isReady ? (
            <>
              <Text style={[styles.ctaText, { color: colors.primary }]}>Try Now</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </>
          ) : (
            <>
              <Text style={[styles.ctaText, { color: colors.textSecondary }]}>Explore</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
            </>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main Screen ─────────────────────────────────────────────
export default function ServicesScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { isDesktop } = useResponsive();
  const [interestedServices, setInterestedServices] = useState(new Set());

  // Fetch user's service interests on focus (so badge updates after returning from lock screen)
  useFocusEffect(
    useCallback(() => {
      const fetchInterests = async () => {
        try {
          const result = await refopenAPI.apiCall('/services/interests');
          if (result?.interests) {
            setInterestedServices(new Set(result.interests));
          }
        } catch (err) {
          // Silently fail — badges just won't show
        }
      };
      fetchInterests();
    }, [])
  );

  const handleServicePress = (service) => {
    if (service.screen) {
      navigation.navigate(service.screen);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TabHeader
        title="Career Tools"
        navigation={navigation}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollContentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Section Label ─────────────────────────────── */}
        <View style={[styles.sectionHeader, isDesktop && { maxWidth: 900 }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            All Tools
          </Text>
        </View>

        {/* ── Service Cards ────────────────────────────── */}
        <View style={[
          styles.cardsContainer,
          isDesktop && styles.cardsContainerDesktop,
        ]}>
          {SERVICES.map((service, index) => (
            <ServiceCard
              key={service.id}
              service={service}
              onPress={handleServicePress}
              colors={colors}
              index={index}
              isDesktop={isDesktop}
              isInterested={interestedServices.has(service.screen)}
            />
          ))}
        </View>

        {/* ── Bottom Spacer ────────────────────────────── */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  scrollContentDesktop: {
    alignItems: 'center',
  },

  // Hero
  heroBanner: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 28,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBannerDesktop: {
    paddingTop: 36,
    paddingBottom: 32,
    borderRadius: 0,
  },
  heroContent: {
    zIndex: 2,
  },
  heroIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  heroIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: 18,
    maxWidth: 500,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroStat: {
    alignItems: 'center',
  },
  heroStatNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 30,
  },
  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 22,
    marginBottom: 14,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Cards
  cardsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  cardsContainerDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    maxWidth: 900,
    justifyContent: 'space-between',
    gap: 16,
  },
  serviceCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
    }),
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  requestedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
