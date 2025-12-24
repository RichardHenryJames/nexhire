/**
 * RefOpen About Page - Production-Grade Public Landing Page
 * 
 * DARK THEME - Beautiful, conversion-optimized
 * 
 * CONTENT RATIO:
 * - 50% Job Seekers (request referrals, sent to ALL employees at company)
 * - 30% Referrers (turn LinkedIn spam into income, earn per referral)
 * - 20% Employers (post jobs, hire talent)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
  Linking,
  Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// RefOpen Logo
const RefOpenLogo = require('../../../assets/refopen-logo.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isLargeScreen = SCREEN_WIDTH > 900;
const isMediumScreen = SCREEN_WIDTH > 600;

// RefOpen website URL
const REFOPEN_URL = 'https://www.refopen.com';

// ============================================
// DARK THEME COLORS
// ============================================
const COLORS = {
  bgPrimary: '#09090B',
  bgSecondary: '#0F0F13',
  bgCard: '#18181B',
  bgCardHover: '#27272A',
  
  primary: '#8B5CF6',
  primaryLight: '#A78BFA',
  secondary: '#06B6D4',
  accent: '#22D3EE',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  pink: '#EC4899',
  blue: '#3B82F6',
  
  gradientPrimary: ['#8B5CF6', '#6366F1'],
  gradientSecondary: ['#06B6D4', '#0891B2'],
  gradientAccent: ['#EC4899', '#BE185D'],
  gradientSuccess: ['#10B981', '#059669'],
  gradientWarning: ['#F59E0B', '#D97706'],
  gradientBlue: ['#3B82F6', '#2563EB'],
  
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  
  border: '#27272A',
  borderLight: '#3F3F46',
};

// ============================================
// STATIC DATA
// ============================================
const FEATURED_COMPANIES = [
  { name: 'Google', domain: 'google.com', employees: '12K+' },
  { name: 'Microsoft', domain: 'microsoft.com', employees: '18K+' },
  { name: 'Amazon', domain: 'amazon.com', employees: '25K+' },
  { name: 'Apple', domain: 'apple.com', employees: '8K+' },
  { name: 'Meta', domain: 'facebook.com', employees: '6K+' },
  { name: 'Netflix', domain: 'netflix.com', employees: '3K+' },
  { name: 'Adobe', domain: 'adobe.com', employees: '5K+' },
  { name: 'Salesforce', domain: 'salesforce.com', employees: '9K+' },
  { name: 'Oracle', domain: 'oracle.com', employees: '7K+' },
  { name: 'IBM', domain: 'ibm.com', employees: '11K+' },
  { name: 'Goldman', domain: 'goldmansachs.com', employees: '4K+' },
  { name: 'JPMorgan', domain: 'jpmorganchase.com', employees: '15K+' },
  { name: 'Deloitte', domain: 'deloitte.com', employees: '20K+' },
  { name: 'McKinsey', domain: 'mckinsey.com', employees: '2K+' },
  { name: 'Uber', domain: 'uber.com', employees: '4K+' },
  { name: 'Spotify', domain: 'spotify.com', employees: '3K+' },
];

// ============================================
// HELPER
// ============================================
const openRefOpen = () => {
  Linking.openURL(REFOPEN_URL);
};

// ============================================
// COMPONENTS
// ============================================

// Smooth Floating Company Logo with Letter Fallback
const FloatingLogo = ({ company, index }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Fade in animation
    Animated.parallel([
      Animated.timing(opacity, { 
        toValue: 1, 
        duration: 600, 
        delay: index * 80, 
        useNativeDriver: true 
      }),
      Animated.spring(scale, { 
        toValue: 1, 
        tension: 40, 
        friction: 7, 
        delay: index * 80, 
        useNativeDriver: true 
      }),
    ]).start();

    // Continuous smooth floating using a single looping animation
    const floatDuration = 4000 + (index % 5) * 500;
    
    const float = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: floatDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    
    // Stagger the start
    const timeout = setTimeout(() => float.start(), index * 100);
    return () => {
      clearTimeout(timeout);
      float.stop();
    };
  }, []);

  // Use interpolation with sine-wave pattern for perfectly smooth up AND down
  const floatDistance = 10 + (index % 4) * 3;
  const translateY = animatedValue.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -floatDistance, 0, floatDistance, 0],
  });

  return (
    <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8}>
      <Animated.View
        style={{
          transform: [{ translateY }, { scale }],
          opacity,
          backgroundColor: COLORS.bgCard,
          borderRadius: 16,
          padding: 14,
          margin: 8,
          minWidth: 90,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: COLORS.border,
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 5,
        }}
      >
        {/* Company Logo from Google Favicon Service */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: '#fff',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          <Image
            source={{ uri: `https://www.google.com/s2/favicons?domain=${company.domain}&sz=128` }}
            style={{ width: 36, height: 36 }}
            resizeMode="contain"
          />
        </View>
        <Text style={{ 
          fontSize: 11, 
          color: COLORS.textPrimary, 
          marginTop: 8, 
          fontWeight: '600',
          textAlign: 'center',
        }}>
          {company.name}
        </Text>
        <Text style={{ fontSize: 9, color: COLORS.accent, marginTop: 2, fontWeight: '500' }}>
          {company.employees} on RefOpen
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Section Header
const SectionHeader = ({ tag, tagColor, title, subtitle, align = 'center' }) => (
  <View style={{ marginBottom: 40, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
    <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 2, color: tagColor, marginBottom: 12, textTransform: 'uppercase' }}>
      {tag}
    </Text>
    <Text style={{ 
      fontSize: isLargeScreen ? 42 : isMediumScreen ? 32 : 26, 
      fontWeight: '800', 
      color: COLORS.textPrimary, 
      textAlign: align,
      lineHeight: isLargeScreen ? 52 : isMediumScreen ? 40 : 34,
      maxWidth: 800,
    }}>
      {title}
    </Text>
    {subtitle && (
      <Text style={{ fontSize: 16, color: COLORS.textSecondary, marginTop: 16, textAlign: align, lineHeight: 26, maxWidth: 600 }}>
        {subtitle}
      </Text>
    )}
  </View>
);

// Stat Card
const StatCard = ({ icon, value, label, gradient }) => (
  <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8}>
    <LinearGradient
      colors={[`${gradient[0]}15`, `${gradient[1]}08`]}
      style={{
        borderRadius: 20,
        padding: isLargeScreen ? 24 : 18,
        alignItems: 'center',
        margin: 6,
        minWidth: isLargeScreen ? 180 : isMediumScreen ? 150 : 140,
        borderWidth: 1,
        borderColor: `${gradient[0]}30`,
      }}
    >
      <LinearGradient colors={gradient} style={{ width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
        <Ionicons name={icon} size={22} color="#fff" />
      </LinearGradient>
      <Text style={{ fontSize: isLargeScreen ? 28 : 24, fontWeight: '800', color: COLORS.textPrimary }}>{value}</Text>
      <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center', fontWeight: '500' }}>{label}</Text>
    </LinearGradient>
  </TouchableOpacity>
);

// Feature Card
const FeatureCard = ({ icon, title, description, gradient, index }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, tension: 50, friction: 8, delay: index * 80, useNativeDriver: true }).start();
  }, []);

  return (
    <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8}>
      <Animated.View style={{ transform: [{ scale: anim }], opacity: anim, width: isLargeScreen ? 320 : '100%', marginBottom: 16, marginHorizontal: isLargeScreen ? 8 : 0 }}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 24, minHeight: 200 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name={icon} size={26} color="#fff" />
          </View>
          <Text style={{ fontSize: 19, fontWeight: '700', color: '#fff', marginBottom: 10 }}>{title}</Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 22 }}>{description}</Text>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Process Step with big numbers
const ProcessStep = ({ number, title, description, icon, gradient }) => (
  <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8} style={{ marginBottom: 32 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <LinearGradient colors={gradient} style={{ width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
        <Ionicons name={icon} size={26} color="#fff" />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: gradient[0], marginRight: 8 }}>STEP {number}</Text>
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 }}>{title}</Text>
        <Text style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 }}>{description}</Text>
      </View>
    </View>
  </TouchableOpacity>
);

// Benefit Item
const BenefitItem = ({ icon, text, color }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${color}20`, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
      <Ionicons name={icon} size={16} color={color} />
    </View>
    <Text style={{ fontSize: 14, color: COLORS.textPrimary, flex: 1 }}>{text}</Text>
  </View>
);

// Big Number Highlight
const BigNumber = ({ number, label, color }) => (
  <View style={{ alignItems: 'center', paddingHorizontal: isLargeScreen ? 40 : 20, paddingVertical: 16 }}>
    <Text style={{ fontSize: isLargeScreen ? 64 : 48, fontWeight: '800', color }}>{number}</Text>
    <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 }}>{label}</Text>
  </View>
);

// ============================================
// MAIN COMPONENT
// ============================================
export default function AboutScreen() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const navigation = useNavigation();

  // Scroll to top on mount/refresh - run immediately on web
  useEffect(() => {
    // Immediate scroll for web
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    
    // Delayed scroll to ensure ScrollView is mounted
    const timer = setTimeout(() => {
      scrollToTop(false);
    }, 120);
    
    return () => clearTimeout(timer);
  }, []);

  // Scroll to top whenever the screen comes into focus (handles navigation without remount)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }

      // Ensure multiple attempts to reset scroll (fixes timing/platform issues)
      const doEnsure = () => {
        scrollToTop(false);
        setTimeout(() => scrollToTop(false), 20);
        setTimeout(() => scrollToTop(false), 80);
        requestAnimationFrame(() => scrollToTop(false));
      };

      doEnsure();
    });

    return unsubscribe;
  }, [navigation]);

  const scrollToTop = (animated = false) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      } catch (e) {}
    }

    if (scrollViewRef.current) {
      try {
        scrollViewRef.current.scrollTo({ y: 0, animated });
      } catch (e) {
        // ignore
      }
      // ensure after layout
      requestAnimationFrame(() => {
        try { scrollViewRef.current && scrollViewRef.current.scrollTo({ y: 0, animated }); } catch (e) {}
      });
    }
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const containerStyle = {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: isLargeScreen ? 40 : 20,
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}>
      {/* Dark gradient overlay */}
      <LinearGradient
        colors={[COLORS.bgPrimary, COLORS.bgSecondary, COLORS.bgPrimary]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      
      {/* Fixed Home Button - Top Right */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Main')}
        style={{
          position: 'fixed',
          top: Platform.OS === 'ios' ? 50 : 20,
          right: 20,
          zIndex: 200,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: COLORS.primary,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        }}
      >
        <Ionicons name="home" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Sticky Header */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backgroundColor: '#000000',
          opacity: headerOpacity,
          paddingTop: Platform.OS === 'ios' ? 50 : 16,
          paddingBottom: 12,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1200, alignSelf: 'center', width: '100%' }}>
          <TouchableOpacity onPress={openRefOpen} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={RefOpenLogo} style={{ width: 140, height: 36 }} resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity onPress={openRefOpen}>
            <LinearGradient colors={COLORS.gradientPrimary} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Get Started Free</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentOffset={{ x: 0, y: 0 }}
        keyboardDismissMode="on-drag"
        onLayout={() => {
          scrollToTop(false);
        }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        onContentSizeChange={() => scrollToTop(false)}
      >
        {/* ============================================ */}
        {/* HERO SECTION */}
        {/* ============================================ */}
        <LinearGradient
          colors={[COLORS.bgSecondary, COLORS.bgPrimary]}
          style={{ paddingTop: Platform.OS === 'ios' ? 110 : 90, paddingBottom: 60 }}
        >
          <View style={containerStyle}>
            <View style={{ alignItems: 'center' }}>
              {/* Badge */}
              <TouchableOpacity onPress={openRefOpen}>
                <LinearGradient
                  colors={[`${COLORS.primary}25`, `${COLORS.pink}15`]}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 24,
                    marginBottom: 28,
                    borderWidth: 1,
                    borderColor: `${COLORS.primary}40`,
                  }}
                >
                  <Text style={{ fontSize: 20, marginRight: 8 }}>🚀</Text>
                  <Text style={{ color: COLORS.accent, fontWeight: '600', fontSize: 13 }}>
                    The Smartest Way to Get Referred & Hire Talent
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Main Headline */}
              <Text
                style={{
                  fontSize: isLargeScreen ? 60 : isMediumScreen ? 44 : 34,
                  fontWeight: '800',
                  textAlign: 'center',
                  lineHeight: isLargeScreen ? 72 : isMediumScreen ? 54 : 42,
                  marginBottom: 24,
                  color: COLORS.textPrimary,
                }}
              >
                Get Referred to{'\n'}
                <Text style={{ color: COLORS.primary }}>Any Company</Text>{'\n'}
              </Text>

              <Text
                style={{
                  fontSize: isLargeScreen ? 18 : 15,
                  textAlign: 'center',
                  lineHeight: isLargeScreen ? 28 : 24,
                  marginBottom: 36,
                  maxWidth: 700,
                  color: COLORS.textSecondary,
                }}
              >
                Request a referral and we'll send it to <Text style={{ color: COLORS.accent, fontWeight: '600' }}>ALL employees</Text> at that company on RefOpen. 
                No more cold DMs. No more waiting. Just results.
              </Text>

              {/* CTA Buttons */}
              <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', alignItems: 'center', marginBottom: 40 }}>
                <TouchableOpacity onPress={openRefOpen} style={{ marginRight: isLargeScreen ? 16 : 0, marginBottom: isLargeScreen ? 0 : 12 }}>
                  <LinearGradient
                    colors={COLORS.gradientPrimary}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 32,
                      paddingVertical: 18,
                      borderRadius: 14,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 8 }}>Find Jobs & Get Referred</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={openRefOpen} style={{ marginRight: isLargeScreen ? 16 : 0, marginBottom: isLargeScreen ? 0 : 12 }}>
                  <View style={{ paddingHorizontal: 28, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.success }}>
                    <Text style={{ fontWeight: '600', fontSize: 15, color: COLORS.success }}>Earn by Referring</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={openRefOpen}>
                  <View style={{ paddingHorizontal: 28, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.blue }}>
                    <Text style={{ fontWeight: '600', fontSize: 15, color: COLORS.blue }}>Hire Talent</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Trust indicators */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', marginRight: 16 }}>
                  {[COLORS.gradientPrimary, COLORS.gradientSecondary, COLORS.gradientAccent, COLORS.gradientSuccess].map((gradient, i) => (
                    <LinearGradient
                      key={i}
                      colors={gradient}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginLeft: i > 0 ? -10 : 0,
                        borderWidth: 2,
                        borderColor: COLORS.bgSecondary,
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{String.fromCharCode(65 + i)}</Text>
                    </LinearGradient>
                  ))}
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons key={star} name="star" size={14} color={COLORS.warning} />
                    ))}
                    <Text style={{ marginLeft: 6, fontWeight: '700', color: COLORS.textPrimary, fontSize: 14 }}>4.9</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: COLORS.textMuted }}>50,000+ professionals</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Floating Companies */}
          <View style={{ marginTop: 48 }}>
            <Text style={{ textAlign: 'center', fontSize: 12, color: COLORS.textMuted, marginBottom: 16, letterSpacing: 1 }}>
              EMPLOYEES FROM THESE COMPANIES ARE ON REFOPEN
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              {FEATURED_COMPANIES.map((company, index) => (
                <FloatingLogo key={company.name} company={company} index={index} />
              ))}
            </ScrollView>
          </View>
        </LinearGradient>

        {/* ============================================ */}
        {/* STATS SECTION */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 48, backgroundColor: COLORS.bgPrimary }}>
          <View style={containerStyle}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              <StatCard icon="people" value="50K+" label="Job Seekers" gradient={COLORS.gradientPrimary} />
              <StatCard icon="briefcase" value="125K+" label="Active Jobs" gradient={COLORS.gradientSecondary} />
              <StatCard icon="business" value="2,500+" label="Companies" gradient={COLORS.gradientSuccess} />
              <StatCard icon="gift" value="$2.5M+" label="Rewards Paid" gradient={COLORS.gradientWarning} />
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* SECTION 1: JOB SEEKERS (50%) */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 80, backgroundColor: COLORS.bgSecondary }}>
          <View style={containerStyle}>
            <SectionHeader
              tag="For Job Seekers"
              tagColor={COLORS.primary}
              title="Stop Sending Cold DMs. Start Getting Referred."
              subtitle="Request a referral once and it reaches every employee at that company who's on RefOpen. Maximize your chances with minimal effort."
            />

            {/* Big Impact Numbers */}
            <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', justifyContent: 'center', alignItems: 'center', marginBottom: 48, backgroundColor: COLORS.bgCard, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: COLORS.border }}>
              <BigNumber number="10x" label="Higher Interview Rate" color={COLORS.primary} />
              <View style={{ width: 1, height: 60, backgroundColor: COLORS.border, display: isLargeScreen ? 'flex' : 'none' }} />
              <BigNumber number="1" label="Request = All Employees" color={COLORS.accent} />
              <View style={{ width: 1, height: 60, backgroundColor: COLORS.border, display: isLargeScreen ? 'flex' : 'none' }} />
              <BigNumber number="48hrs" label="Avg Response Time" color={COLORS.success} />
            </View>

            {/* How it works */}
            <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', marginBottom: 48 }}>
              <View style={{ flex: 1, marginRight: isLargeScreen ? 32 : 0, marginBottom: isLargeScreen ? 0 : 32 }}>
                <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 24 }}>How It Works</Text>
                <ProcessStep number="1" title="Browse Jobs" description="Explore 125,000+ jobs from Fortune 500 companies and top startups. Filter by role, location, salary & more." icon="search" gradient={COLORS.gradientPrimary} />
                <ProcessStep number="2" title="Request Referral" description="Click 'Request Referral' on any job. Your request is sent to ALL employees at that company on RefOpen - not just one person!" icon="send" gradient={COLORS.gradientSecondary} />
                <ProcessStep number="3" title="Get Referred & Interviewed" description="Employees review your profile and refer qualified candidates. Your resume goes to the TOP of the pile." icon="trophy" gradient={COLORS.gradientSuccess} />
              </View>

              {/* Benefits Card */}
              <View style={{ flex: 1 }}>
                <LinearGradient
                  colors={[`${COLORS.primary}15`, `${COLORS.primary}05`]}
                  style={{ borderRadius: 24, padding: 28, borderWidth: 1, borderColor: `${COLORS.primary}30`, height: '100%' }}
                >
                  <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 24 }}>Why Job Seekers Love RefOpen</Text>
                  <BenefitItem icon="people" text="One request reaches ALL employees at that company" color={COLORS.primary} />
                  <BenefitItem icon="flash" text="Skip the resume black hole - get noticed instantly" color={COLORS.accent} />
                  <BenefitItem icon="shield-checkmark" text="Verified employees from real companies" color={COLORS.success} />
                  <BenefitItem icon="analytics" text="Track your referral requests in real-time" color={COLORS.warning} />
                  <BenefitItem icon="chatbubbles" text="Chat directly with referrers for tips" color={COLORS.pink} />
                  <BenefitItem icon="ribbon" text="AI-optimized profile to stand out" color={COLORS.blue} />

                  <TouchableOpacity onPress={openRefOpen} style={{ marginTop: 24 }}>
                    <LinearGradient colors={COLORS.gradientPrimary} style={{ paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Start Getting Referred →</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>

            {/* The Problem vs RefOpen */}
            <View style={{ flexDirection: isLargeScreen ? 'row' : 'column' }}>
              {/* Traditional Way */}
              <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8} style={{ flex: 1, margin: 8 }}>
                <View style={{ backgroundColor: COLORS.bgCard, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: COLORS.border, height: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${COLORS.error}20`, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name="close-circle" size={22} color={COLORS.error} />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textPrimary }}>The Old Way</Text>
                  </View>
                  {[
                    'Send 100s of LinkedIn DMs',
                    'Most messages get ignored',
                    'One person = one chance',
                    'No tracking or follow-up',
                    'Resume lost in ATS black hole',
                  ].map((item, index) => (
                    <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Ionicons name="close" size={18} color={COLORS.error} style={{ marginRight: 10 }} />
                      <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>{item}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>

              {/* RefOpen Way */}
              <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8} style={{ flex: 1, margin: 8 }}>
                <LinearGradient
                  colors={[`${COLORS.primary}20`, `${COLORS.secondary}10`]}
                  style={{ borderRadius: 24, padding: 28, borderWidth: 1, borderColor: COLORS.primary, height: '100%' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <LinearGradient colors={COLORS.gradientPrimary} style={{ width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name="checkmark-circle" size={22} color="#fff" />
                    </LinearGradient>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textPrimary }}>The RefOpen Way</Text>
                  </View>
                  {[
                    'One request = ALL employees notified ✨',
                    'Higher response rates guaranteed',
                    'Multiple referrers see your profile',
                    'Real-time status tracking',
                    'Resume goes to TOP of the pile',
                  ].map((item, index) => (
                    <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Ionicons name="checkmark" size={18} color={COLORS.success} style={{ marginRight: 10 }} />
                      <Text style={{ fontSize: 14, color: COLORS.textPrimary }}>{item}</Text>
                    </View>
                  ))}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* SECTION 2: REFERRERS (30%) */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 80, backgroundColor: COLORS.bgPrimary }}>
          <View style={containerStyle}>
            <SectionHeader
              tag="For Employees Who Refer"
              tagColor={COLORS.success}
              title="Turn LinkedIn DMs Into Real Income"
              subtitle="Tired of endless referral requests in your DMs? Now you can get paid for every single referral you make - not just when they get hired!"
            />

            {/* Pain Point Callout */}
            <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8}>
              <LinearGradient
                colors={[`${COLORS.success}15`, `${COLORS.accent}10`]}
                style={{ borderRadius: 24, padding: 28, marginBottom: 48, borderWidth: 1, borderColor: `${COLORS.success}30` }}
              >
                <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: isLargeScreen ? 32 : 0, marginBottom: isLargeScreen ? 0 : 24 }}>
                    <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 }}>
                      Sound Familiar? 👇
                    </Text>
                    <Text style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 24, fontStyle: 'italic', marginBottom: 16 }}>
                      "Hey! I saw you work at Google. Can you refer me? Here's my resume..."
                    </Text>
                    <Text style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 24 }}>
                      You get <Text style={{ color: COLORS.warning, fontWeight: '600' }}>dozens of these messages</Text> every week. 
                      You want to help, but there's no upside for you unless they get hired (which rarely happens).
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 48, fontWeight: '800', color: COLORS.success }}>$$$</Text>
                    <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' }}>Now you earn for{'\n'}EVERY referral</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Traditional vs RefOpen */}
            <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 24, textAlign: 'center' }}>
              Why RefOpen is Different
            </Text>

            <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', marginBottom: 48 }}>
              {/* Traditional */}
              <View style={{ flex: 1, margin: 8, backgroundColor: COLORS.bgCard, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.error, marginBottom: 16 }}>❌ Traditional Referrals</Text>
                <Text style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 24, marginBottom: 12 }}>
                  • You refer someone on LinkedIn{'\n'}
                  • They apply through company portal{'\n'}
                  • You wait months to hear anything{'\n'}
                  • They don't get hired (most don't){'\n'}
                  • <Text style={{ color: COLORS.error, fontWeight: '600' }}>You get NOTHING for your time</Text>
                </Text>
              </View>

              {/* RefOpen */}
              <View style={{ flex: 1, margin: 8 }}>
                <LinearGradient colors={[`${COLORS.success}20`, `${COLORS.success}08`]} style={{ borderRadius: 24, padding: 24, borderWidth: 1, borderColor: COLORS.success, height: '100%' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.success, marginBottom: 16 }}>✅ RefOpen Referrals</Text>
                  <Text style={{ fontSize: 14, color: COLORS.textPrimary, lineHeight: 24, marginBottom: 12 }}>
                    • AI filters low-quality candidates{'\n'}
                    • You only see qualified profiles{'\n'}
                    • Submit referral with one click{'\n'}
                    • <Text style={{ color: COLORS.success, fontWeight: '600' }}>Get paid IMMEDIATELY</Text>{'\n'}
                    • BONUS: Company bonus if hired!
                  </Text>
                </LinearGradient>
              </View>
            </View>

            {/* How Referrers Earn */}
            <View style={{ flexDirection: isLargeScreen ? 'row' : 'column' }}>
              <View style={{ flex: 1, marginRight: isLargeScreen ? 32 : 0, marginBottom: isLargeScreen ? 0 : 32 }}>
                <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 24 }}>How You Earn</Text>
                <ProcessStep number="1" title="Get Verified" description="Connect your work email to verify your employment. Takes 2 minutes." icon="shield-checkmark" gradient={COLORS.gradientSuccess} />
                <ProcessStep number="2" title="Review AI-Filtered Requests" description="Our AI scores candidates and filters spam. You only see quality profiles worth your time." icon="filter" gradient={COLORS.gradientSecondary} />
                <ProcessStep number="3" title="Refer & Earn Instantly" description="Submit the referral to your company's system. Get RefOpen rewards right away - no waiting for hires!" icon="gift" gradient={COLORS.gradientWarning} />
              </View>

              {/* Earning Card */}
              <View style={{ flex: 1 }}>
                <LinearGradient
                  colors={COLORS.gradientSuccess}
                  style={{ borderRadius: 24, padding: 28 }}
                >
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 20 }}>Your Earning Potential 💰</Text>
                  
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Per Referral Reward</Text>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>Instant Pay</Text>
                  </View>

                  <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>If They Get Hired</Text>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>+ Company Bonus</Text>
                  </View>

                  <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 16 }}>
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Top Referrers Earn</Text>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>$3K+/month</Text>
                  </View>

                  <TouchableOpacity onPress={openRefOpen} style={{ marginTop: 20 }}>
                    <View style={{ backgroundColor: '#fff', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
                      <Text style={{ color: COLORS.success, fontWeight: '700', fontSize: 15 }}>Start Earning Today →</Text>
                    </View>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* SECTION 3: EMPLOYERS (20%) */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 80, backgroundColor: COLORS.bgSecondary }}>
          <View style={containerStyle}>
            <SectionHeader
              tag="For Employers"
              tagColor={COLORS.blue}
              title="Hire Exceptional Talent Through Referrals"
              subtitle="The best candidates come through referrals. Post jobs, leverage your employees' networks, and hire faster."
            />

            {/* Feature Cards */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              <FeatureCard
                icon="create"
                title="Post Jobs Instantly"
                description="Create beautiful job listings in minutes. Reach 50,000+ qualified professionals actively seeking opportunities."
                gradient={COLORS.gradientBlue}
                index={0}
              />
              <FeatureCard
                icon="people"
                title="Leverage Employee Networks"
                description="Your employees are on RefOpen. When they refer, candidates are pre-vetted and more likely to be a cultural fit."
                gradient={COLORS.gradientPrimary}
                index={1}
              />
              <FeatureCard
                icon="analytics"
                title="Track & Measure"
                description="Full analytics on your hiring funnel. See which sources bring the best candidates and optimize your process."
                gradient={COLORS.gradientSecondary}
                index={2}
              />
            </View>

            {/* CTA for Employers */}
            <View style={{ alignItems: 'center', marginTop: 32 }}>
              <TouchableOpacity onPress={openRefOpen}>
                <LinearGradient
                  colors={COLORS.gradientBlue}
                  style={{ paddingHorizontal: 32, paddingVertical: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 8 }}>Post Your First Job Free</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* COMPANIES GRID */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 64, backgroundColor: COLORS.bgPrimary }}>
          <View style={containerStyle}>
            <SectionHeader
              tag="Trusted by Employees At"
              tagColor={COLORS.accent}
              title="Top Companies Around the World"
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              {FEATURED_COMPANIES.map((company) => (
                <TouchableOpacity key={company.name} onPress={openRefOpen} activeOpacity={0.8}>
                  <View
                    style={{
                      backgroundColor: COLORS.bgCard,
                      borderRadius: 16,
                      padding: 16,
                      margin: 6,
                      alignItems: 'center',
                      minWidth: 100,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        backgroundColor: '#fff',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <Image
                        source={{ uri: `https://www.google.com/s2/favicons?domain=${company.domain}&sz=128` }}
                        style={{ width: 32, height: 32 }}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' }} numberOfLines={1}>
                      {company.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* TESTIMONIALS */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 64, backgroundColor: COLORS.bgSecondary }}>
          <View style={containerStyle}>
            <SectionHeader
              tag="Success Stories"
              tagColor={COLORS.warning}
              title="What Our Users Say"
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
              {[
                { quote: "Sent one referral request and got 5 responses! Landed interviews at 3 companies. This is so much better than cold DMing.", name: "Priya S.", role: "Software Engineer", company: "Now at Google", gradient: COLORS.gradientPrimary },
                { quote: "I was skeptical at first, but I've made $2,800 in 2 months just by referring people I'd normally ignore on LinkedIn. Game changer!", name: "Rahul M.", role: "Senior PM", company: "Microsoft", gradient: COLORS.gradientSuccess },
                { quote: "We filled 3 senior roles in 6 weeks using RefOpen. The candidates from referrals are significantly better than job boards.", name: "Sarah T.", role: "Head of Talent", company: "Series B Startup", gradient: COLORS.gradientBlue },
                { quote: "No more guessing if someone got my message. I can see when employees view my profile and track everything.", name: "Amit K.", role: "Data Scientist", company: "Now at Amazon", gradient: COLORS.gradientAccent },
              ].map((item, index) => (
                <TouchableOpacity key={index} onPress={openRefOpen} activeOpacity={0.8}>
                  <View
                    style={{
                      backgroundColor: COLORS.bgCard,
                      borderRadius: 24,
                      padding: 24,
                      marginHorizontal: 8,
                      width: isLargeScreen ? 360 : SCREEN_WIDTH - 64,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons key={star} name="star" size={16} color={COLORS.warning} style={{ marginRight: 2 }} />
                      ))}
                    </View>
                    <Text style={{ fontSize: 15, color: COLORS.textPrimary, lineHeight: 24, fontStyle: 'italic', marginBottom: 20 }}>
                      "{item.quote}"
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <LinearGradient colors={item.gradient} style={{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{item.name.charAt(0)}</Text>
                      </LinearGradient>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.textPrimary }}>{item.name}</Text>
                        <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{item.role} • {item.company}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* ============================================ */}
        {/* FINAL CTA */}
        {/* ============================================ */}
        <LinearGradient
          colors={[COLORS.primary, '#7C3AED', '#9333EA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingVertical: 80 }}
        >
          <View style={containerStyle}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: isLargeScreen ? 48 : 32, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: isLargeScreen ? 58 : 42, marginBottom: 20 }}>
                Ready to Get Started?
              </Text>
              <Text style={{ fontSize: 17, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 28, marginBottom: 36, maxWidth: 600 }}>
                Whether you're looking for your dream job, want to earn by helping others, or need to hire talent - RefOpen has you covered.
              </Text>

              <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', alignItems: 'center' }}>
                <TouchableOpacity onPress={openRefOpen} style={{ marginRight: isLargeScreen ? 16 : 0, marginBottom: isLargeScreen ? 0 : 12 }}>
                  <View style={{ backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 16, marginRight: 8 }}>Find Jobs</Text>
                    <Ionicons name="briefcase" size={20} color={COLORS.primary} />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={openRefOpen} style={{ marginRight: isLargeScreen ? 16 : 0, marginBottom: isLargeScreen ? 0 : 12 }}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 8 }}>Start Earning</Text>
                    <Ionicons name="cash" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={openRefOpen}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 8 }}>Hire Talent</Text>
                    <Ionicons name="people" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 24 }}>
                ✓ Free to join  ✓ No credit card  ✓ 50,000+ professionals
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ============================================ */}
        {/* FOOTER */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 48, backgroundColor: COLORS.bgSecondary, borderTopWidth: 1, borderTopColor: COLORS.border }}>
          <View style={containerStyle}>
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity onPress={openRefOpen} style={{ marginBottom: 16 }}>
                <Image source={RefOpenLogo} style={{ width: 240, height: 68 }} resizeMode="contain" />
              </TouchableOpacity>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 24 }}>
                The Smarter Way to Get Referred & Hire
              </Text>

              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
                © 2024 RefOpen. All rights reserved.
              </Text>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
