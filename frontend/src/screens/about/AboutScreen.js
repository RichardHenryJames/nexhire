/**
 * RefOpen About Page V2 - REVOLUTIONARY DESIGN
 * 
 * Inspired by: Linear, Vercel, Stripe, Notion, Arc Browser
 * 
 * Features:
 * - Animated gradient mesh hero with floating orbs
 * - Bento grid layout for features
 * - Scroll-triggered animations
 * - Animated counters
 * - Auto-scrolling company marquee
 * - Glassmorphism cards with glow effects
 * - Gradient text headlines
 * - Modern micro-interactions
 * - 3D-like card transforms
 * 
 * Route: /about-new
 */

import React, { useEffect, useRef, useMemo, useState } from 'react';
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
import useResponsive from '../../hooks/useResponsive';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ComplianceFooter from '../../components/ComplianceFooter';

// Assets
const RefOpenLogo = require('../../../assets/refopen-logo.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const REFOPEN_URL = 'https://www.refopen.com';
const ASK_REFERRAL_URL = 'https://www.refopen.com/ask-referral';

// ============================================
// THEME - Dark mode optimized for stunning visuals
// ============================================
const getColors = (isDark) => ({
  // Backgrounds
  bg: '#030712',
  bgAlt: '#0a0f1a',
  bgCard: 'rgba(17, 24, 39, 0.7)',
  bgGlass: 'rgba(17, 24, 39, 0.4)',
  
  // Brand Colors
  primary: '#818CF8',
  primaryBright: '#A5B4FC',
  accent: '#22D3EE',
  accentBright: '#67E8F9',
  emerald: '#34D399',
  amber: '#FBBF24',
  rose: '#FB7185',
  violet: '#A78BFA',
  
  // Gradients
  gradHero: ['#030712', '#0F172A', '#1E1B4B', '#312E81'],
  gradPrimary: ['#6366F1', '#8B5CF6', '#A855F7'],
  gradAccent: ['#06B6D4', '#22D3EE', '#67E8F9'],
  gradEmerald: ['#10B981', '#34D399'],
  gradAmber: ['#F59E0B', '#FBBF24'],
  gradRose: ['#F43F5E', '#FB7185'],
  gradViolet: ['#7C3AED', '#A78BFA'],
  gradMesh: ['rgba(99,102,241,0.15)', 'rgba(34,211,238,0.1)', 'rgba(52,211,153,0.05)'],
  
  // Text
  text: '#F9FAFB',
  textSub: '#9CA3AF',
  textMuted: '#6B7280',
  
  // Borders & Effects
  border: 'rgba(255,255,255,0.08)',
  borderGlow: 'rgba(129,140,248,0.3)',
  glow: 'rgba(99,102,241,0.4)',
  glowAccent: 'rgba(34,211,238,0.4)',
});

// ============================================
// COMPANIES DATA
// ============================================
const COMPANIES = [
  { name: 'Google', domain: 'google.com' },
  { name: 'Microsoft', domain: 'microsoft.com' },
  { name: 'Amazon', domain: 'amazon.com' },
  { name: 'Apple', domain: 'apple.com' },
  { name: 'Meta', domain: 'facebook.com' },
  { name: 'Netflix', domain: 'netflix.com' },
  { name: 'Adobe', domain: 'adobe.com' },
  { name: 'Salesforce', domain: 'salesforce.com' },
  { name: 'Oracle', domain: 'oracle.com' },
  { name: 'IBM', domain: 'ibm.com' },
  { name: 'Goldman Sachs', domain: 'goldmansachs.com' },
  { name: 'JPMorgan', domain: 'jpmorganchase.com' },
  { name: 'Uber', domain: 'uber.com' },
  { name: 'Spotify', domain: 'spotify.com' },
  { name: 'Stripe', domain: 'stripe.com' },
  { name: 'Airbnb', domain: 'airbnb.com' },
];

// ============================================
// TESTIMONIALS - Real experiences from RefOpen users
// ============================================
const TESTIMONIALS = [
  { quote: "Applied to 200+ jobs with no callbacks. Posted my profile on RefOpen and within a week, someone at Google reached out to refer me. Now I'm an L4 SWE there.", name: "Priya S.", role: "Software Engineer", company: "Google", avatar: "P" },
  { quote: "I was mass-applying on LinkedIn for 4 months straight. Joined RefOpen, connected with a referrer at Amazon, and had my first interview scheduled in 10 days.", name: "Amit K.", role: "Data Scientist", company: "Amazon", avatar: "A" },
  { quote: "As a referrer, I love that I get paid for every referral I submit - not just when someone gets hired. Already made ₹8,000 this month and counting.", name: "Rahul M.", role: "Senior PM", company: "Microsoft", avatar: "R" },
  { quote: "Cold DMs on LinkedIn felt awkward and rarely got responses. RefOpen made the whole referral ask feel natural - the platform does the matchmaking for you.", name: "Neha T.", role: "Product Designer", company: "Figma", avatar: "N" },
  { quote: "Hired 4 engineers through RefOpen referrals this quarter. The quality of candidates is noticeably higher when they come through trusted connections.", name: "Jason L.", role: "Engineering Manager", company: "Stripe", avatar: "J" },
  { quote: "Moved from a service company to a product role at Meta. My referrer guided me through the whole process - couldn't have done it without this platform.", name: "Karthik R.", role: "Software Engineer", company: "Meta", avatar: "K" },
];

// ============================================
// CAREER TOOLS
// ============================================
const CAREER_TOOLS = [
  { id: 1, title: 'Resume Analyzer', desc: 'AI scores your resume, catches ATS killers, suggests fixes in 30 seconds', icon: 'document-text', gradient: ['#6366F1', '#818CF8'], ready: true, free: true },
  { id: 2, title: 'Cover Letter AI', desc: 'Generates role-specific cover letters that actually sound human', icon: 'create', gradient: ['#06B6D4', '#22D3EE'], ready: false, free: false },
  { id: 3, title: 'Interview Prep', desc: 'AI mock interviews with real questions from your target company', icon: 'mic', gradient: ['#F59E0B', '#FBBF24'], ready: false, free: false },
  { id: 4, title: 'Salary Negotiator', desc: 'Know your worth: real-time comp data + AI negotiation scripts', icon: 'cash', gradient: ['#10B981', '#34D399'], ready: false, free: false },
  { id: 5, title: 'LinkedIn Optimizer', desc: 'Rewrite your headline, about, and experience for maximum visibility', icon: 'logo-linkedin', gradient: ['#0A66C2', '#3B82F6'], ready: false, free: false },
  { id: 6, title: 'Job Match Score', desc: 'Instantly see how well you match any job before applying', icon: 'git-compare', gradient: ['#F43F5E', '#FB7185'], ready: false, free: false },
  { id: 7, title: 'Market Pulse', desc: 'Live dashboard: who\'s hiring, trending roles, layoff alerts', icon: 'pulse', gradient: ['#15803D', '#4ADE80'], ready: false, free: false },
  { id: 8, title: 'Blind Review', desc: 'Anonymous profile review by referrers at your target company', icon: 'eye-off', gradient: ['#9333EA', '#C084FC'], ready: false, free: false },
  { id: 9, title: 'Career Simulator', desc: 'AI maps your 3-year career trajectory with salary projections', icon: 'rocket', gradient: ['#EA580C', '#FB923C'], ready: false, free: false },
];

// ============================================
// ANIMATED FLOATING ORB
// ============================================
const FloatingOrb = ({ color, size, initialX, initialY, duration = 8000 }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animateOrb = () => {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(translateY, { toValue: -30, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 30, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(translateX, { toValue: 20, duration: duration * 0.7, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(translateX, { toValue: -20, duration: duration * 0.7, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(translateX, { toValue: 0, duration: duration * 0.6, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(scale, { toValue: 1.2, duration: duration * 0.5, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 0.9, duration: duration * 0.5, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1, duration: duration * 0.5, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
        ])
      ).start();
    };
    const timeout = setTimeout(animateOrb, Math.random() * 1000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: initialX,
        top: initialY,
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: color,
        opacity: 0.6,
        transform: [{ translateY }, { translateX }, { scale }],
        ...(Platform.OS === 'web' ? { filter: `blur(${size * 0.4}px)` } : {}),
      }}
    />
  );
};

// ============================================
// MARQUEE - Auto-scrolling companies
// ============================================
const CompanyMarquee = ({ companies, C, speed = 30 }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const duplicatedCompanies = [...companies, ...companies, ...companies];
  const itemWidth = 140;
  const totalWidth = companies.length * itemWidth;

  useEffect(() => {
    const animate = () => {
      scrollX.setValue(0);
      Animated.loop(
        Animated.timing(scrollX, {
          toValue: -totalWidth,
          duration: totalWidth * speed,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    };
    animate();
  }, []);

  return (
    <View style={{ overflow: 'hidden', height: 80 }}>
      <Animated.View
        style={{
          flexDirection: 'row',
          transform: [{ translateX: scrollX }],
        }}
      >
        {duplicatedCompanies.map((company, index) => (
          <View
            key={`${company.name}-${index}`}
            style={{
              width: itemWidth,
              height: 70,
              marginHorizontal: 8,
              backgroundColor: C.bgCard,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: C.border,
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'row',
            }}
          >
            <Image
              source={{ uri: `https://www.google.com/s2/favicons?domain=${company.domain}&sz=128` }}
              style={{ width: 28, height: 28, marginRight: 10 }}
              resizeMode="contain"
            />
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.textSub }}>{company.name}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

// ============================================
// BENTO CARD - Modern grid card with animations
// ============================================
const BentoCard = ({ children, span = 1, height = 280, gradient, C, style, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, tension: 100 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100 }).start();
  };

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] });

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress || (() => Linking.openURL(REFOPEN_URL))}
      style={{ flex: span, minHeight: height, margin: 6, ...style }}
    >
      <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
        {gradient ? (
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              borderRadius: 24,
              padding: 24,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
          >
            {children}
          </LinearGradient>
        ) : (
          <View
            style={{
              flex: 1,
              backgroundColor: C.bgCard,
              borderRadius: 24,
              padding: 24,
              borderWidth: 1,
              borderColor: C.border,
              overflow: 'hidden',
              ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
            }}
          >
            {/* Animated glow effect */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 200,
                height: 200,
                borderRadius: 100,
                backgroundColor: C.glow,
                opacity: glowOpacity,
              }}
            />
            {children}
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ============================================
// GLOWING BUTTON
// ============================================
const GlowButton = ({ title, icon, gradient, onPress, size = 'large' }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.7] });

  const isLarge = size === 'large';

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {/* Outer glow */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -8,
            left: -8,
            right: -8,
            bottom: -8,
            borderRadius: isLarge ? 20 : 14,
            backgroundColor: gradient[0],
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          }}
        />
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: isLarge ? 32 : 20,
            paddingVertical: isLarge ? 18 : 12,
            borderRadius: isLarge ? 16 : 12,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: isLarge ? 16 : 14, marginRight: icon ? 8 : 0 }}>{title}</Text>
          {icon && <Ionicons name={icon} size={isLarge ? 20 : 16} color="#fff" />}
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ============================================
// TESTIMONIAL CARD - Floating design
// ============================================
const TestimonialCard = ({ item, index, C }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 3000 + index * 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 8, duration: 3000 + index * 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const gradients = [
    ['#6366F1', '#8B5CF6'],
    ['#06B6D4', '#22D3EE'],
    ['#10B981', '#34D399'],
    ['#F59E0B', '#FBBF24'],
    ['#F43F5E', '#FB7185'],
    ['#7C3AED', '#A78BFA'],
  ];

  return (
    <Animated.View style={{ transform: [{ translateY: floatAnim }], marginHorizontal: 8, marginBottom: 16, width: 320 }}>
      <View
        style={{
          backgroundColor: C.bgCard,
          borderRadius: 20,
          padding: 24,
          borderWidth: 1,
          borderColor: C.border,
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
        }}
      >
        {/* Quote icon */}
        <View style={{ position: 'absolute', top: 16, right: 16, opacity: 0.1 }}>
          <Ionicons name="chatbubble-ellipses" size={40} color={C.text} />
        </View>

        <Text style={{ fontSize: 15, color: C.text, lineHeight: 24, marginBottom: 20, fontStyle: 'italic' }}>
          "{item.quote}"
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <LinearGradient
            colors={gradients[index % gradients.length]}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{item.avatar}</Text>
          </LinearGradient>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{item.name}</Text>
            <Text style={{ fontSize: 12, color: C.textMuted }}>{item.role} · {item.company}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

// ============================================
// STAT ITEM with animated underline
// ============================================
const StatItem = ({ value, label, color, C, isLg }) => {
  const lineWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(lineWidth, {
      toValue: 1,
      duration: 1000,
      delay: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, []);

  const width = lineWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={{ alignItems: 'center', paddingHorizontal: isLg ? 32 : 16 }}>
      <Text style={{ fontSize: isLg ? 56 : 36, fontWeight: '800', color, letterSpacing: -2 }}>{value}</Text>
      <Animated.View style={{ height: 3, backgroundColor: color, borderRadius: 2, marginVertical: 8, width }} />
      <Text style={{ fontSize: isLg ? 14 : 12, color: C.textSub, textAlign: 'center' }}>{label}</Text>
    </View>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function AboutScreenNew() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const { isDesktop, isTablet, isMobile } = useResponsive();
  const scrollRef = useRef(null);

  // Navigate to Main if logged in, Auth (Login) if logged out
  const goToApp = () => navigation.navigate(isAuthenticated ? 'Main' : 'Auth');
  const goToResumeAnalyzer = () => {
    if (isAuthenticated) {
      navigation.navigate('Main', { screen: 'ServicesTab', params: { screen: 'ResumeAnalyzer' } });
    } else {
      navigation.navigate('ResumeAnalyzer');
    }
  };

  const C = useMemo(() => getColors(isDark), [isDark]);
  const isLg = isDesktop;
  const isMd = isTablet;

  const containerStyle = {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: isLg ? 24 : isMd ? 20 : 16,
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, overflow: 'hidden' }}>
      {/* Background gradient mesh */}
      <LinearGradient
        colors={C.gradHero}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 1.2 }}
      />

      {/* Floating orbs for depth */}
      <FloatingOrb color="rgba(99,102,241,0.3)" size={400} initialX={-100} initialY={100} duration={10000} />
      <FloatingOrb color="rgba(34,211,238,0.25)" size={300} initialX={SCREEN_WIDTH - 150} initialY={200} duration={12000} />
      <FloatingOrb color="rgba(52,211,153,0.2)" size={250} initialX={SCREEN_WIDTH / 2 - 100} initialY={500} duration={9000} />
      <FloatingOrb color="rgba(251,113,133,0.2)" size={200} initialX={50} initialY={800} duration={11000} />
      <FloatingOrb color="rgba(167,139,250,0.25)" size={350} initialX={SCREEN_WIDTH - 200} initialY={1000} duration={13000} />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: isLg ? 40 : 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          backgroundColor: 'rgba(3,7,18,0.8)',
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 } : {}),
        }}
      >
        <TouchableOpacity onPress={() => Linking.openURL(REFOPEN_URL)}>
          <Image source={RefOpenLogo} style={{ width: 130, height: 36 }} resizeMode="contain" />
        </TouchableOpacity>
        {isAuthenticated ? (
          <GlowButton title="Get Started" gradient={C.gradPrimary} onPress={() => goToApp()} size="small" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Auth', { screen: 'Login' })}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: C.primaryBright,
              }}
            >
              <Text style={{ color: C.primaryBright, fontWeight: '700', fontSize: 14 }}>Sign In</Text>
            </TouchableOpacity>
            <GlowButton title="Sign Up" gradient={C.gradPrimary} onPress={() => navigation.navigate('Auth', { screen: 'Login' })} size="small" />
          </View>
        )}
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        {/* ============================================ */}
        {/* HERO SECTION */}
        {/* ============================================ */}
        <View style={{ paddingTop: isLg ? 48 : 28, paddingBottom: 40, ...containerStyle }}>
          <View style={{ alignItems: 'center' }}>
            {/* Badge */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(99,102,241,0.15)',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 100,
                borderWidth: 1,
                borderColor: 'rgba(99,102,241,0.3)',
                marginBottom: 32,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.emerald, marginRight: 10 }} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.primaryBright, letterSpacing: 0.5 }}>
                Trusted by 10,000+ professionals
              </Text>
            </View>

            {/* Main headline with gradient text effect */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: isLg ? 72 : isMd ? 52 : 38,
                  fontWeight: '800',
                  textAlign: 'center',
                  lineHeight: isLg ? 82 : isMd ? 62 : 46,
                  letterSpacing: -2,
                  color: C.text,
                }}
              >
                The Future of{'\n'}
                <Text style={{ color: C.primary }}>Job Referrals</Text>
              </Text>
            </View>

            {/* Subheadline */}
            <Text
              style={{
                fontSize: isLg ? 20 : 16,
                color: C.textSub,
                textAlign: 'center',
                lineHeight: isLg ? 32 : 26,
                maxWidth: 640,
                marginBottom: 48,
              }}
            >
              Stop cold-applying. Referred candidates are{' '}
              <Text style={{ color: C.accent, fontWeight: '700' }}>15x more likely</Text> to get hired.
              Get referrals directly from employees at your dream companies.
            </Text>

            {/* CTA Buttons */}
            <View style={{ flexDirection: isLg ? 'row' : 'column', alignItems: 'center', gap: 16 }}>
              <GlowButton
                title="Browse 125K+ Jobs"
                icon="arrow-forward"
                gradient={C.gradPrimary}
                onPress={() => goToApp()}
              />
              <TouchableOpacity onPress={() => goToApp()}>
                <View
                  style={{
                    paddingHorizontal: 32,
                    paddingVertical: 18,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: C.borderGlow,
                    backgroundColor: 'rgba(99,102,241,0.1)',
                  }}
                >
                  <Text style={{ color: C.primaryBright, fontWeight: '700', fontSize: 16 }}>Get Referred →</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Trust indicators */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, opacity: 0.6 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons key={i} name="star" size={16} color={C.amber} style={{ marginRight: 2 }} />
              ))}
              <Text style={{ fontSize: 13, color: C.textMuted, marginLeft: 8 }}>4.9 rating · 10,000+ reviews</Text>
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* COMPANIES MARQUEE */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 40, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border }}>
          <Text style={{ textAlign: 'center', fontSize: 12, color: C.textMuted, letterSpacing: 2, marginBottom: 24, textTransform: 'uppercase' }}>
            Employees from these companies are on RefOpen
          </Text>
          <CompanyMarquee companies={COMPANIES} C={C} />
        </View>

        {/* ============================================ */}
        {/* STATS SECTION */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 80, ...containerStyle }}>
          <View
            style={{
              flexDirection: isLg ? 'row' : 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: isLg ? 0 : 32,
            }}
          >
            <StatItem value="125K+" label="Active Jobs" color={C.primary} C={C} isLg={isLg} />
            {isLg && <View style={{ width: 1, height: 60, backgroundColor: C.border, marginHorizontal: 40 }} />}
            <StatItem value="1000+" label="Verified Referrers" color={C.accent} C={C} isLg={isLg} />
            {isLg && <View style={{ width: 1, height: 60, backgroundColor: C.border, marginHorizontal: 40 }} />}
            <StatItem value="2.5K+" label="Companies" color={C.emerald} C={C} isLg={isLg} />
            {isLg && <View style={{ width: 1, height: 60, backgroundColor: C.border, marginHorizontal: 40 }} />}
            <StatItem value="15x" label="Higher Hiring Rate" color={C.rose} C={C} isLg={isLg} />
          </View>
        </View>

        {/* ============================================ */}
        {/* BENTO GRID - FOR JOB SEEKERS */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 60, ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <View
              style={{
                backgroundColor: 'rgba(99,102,241,0.15)',
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 100,
                borderWidth: 1,
                borderColor: 'rgba(99,102,241,0.3)',
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: C.primary, textTransform: 'uppercase' }}>For Job Seekers</Text>
            </View>
            <Text style={{ fontSize: isLg ? 44 : 32, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              Your Dream Job is{'\n'}One Referral Away
            </Text>
          </View>

          {/* Bento Grid */}
          <View style={{ flexDirection: isLg ? 'row' : 'column', flexWrap: 'wrap' }}>
            {/* Large feature card */}
            <BentoCard span={isLg ? 2 : 1} height={320} gradient={C.gradPrimary} C={C}>
              <Ionicons name="briefcase" size={40} color="rgba(255,255,255,0.9)" style={{ marginBottom: 20 }} />
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 12 }}>
                Apply Directly to 125K+ Jobs
              </Text>
              <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 26 }}>
                Browse jobs from Fortune 500 companies and startups. One-click apply with your profile. AI-powered recommendations find perfect matches.
              </Text>
            </BentoCard>

            {/* Ask Referral card */}
            <BentoCard span={1} height={320} C={C}>
              <LinearGradient colors={C.gradAccent} style={{ width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                <Ionicons name="hand-right" size={28} color="#fff" />
              </LinearGradient>
              <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 10 }}>Ask for Referral</Text>
              <Text style={{ fontSize: 14, color: C.textSub, lineHeight: 22 }}>
                One request reaches ALL verified employees at that company. Skip the cold DMs.
              </Text>
            </BentoCard>

            {/* External Referral */}
            <BentoCard span={1} height={280} C={C}>
              <LinearGradient colors={C.gradEmerald} style={{ width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                <Ionicons name="globe" size={28} color="#fff" />
              </LinearGradient>
              <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 10 }}>External Jobs</Text>
              <Text style={{ fontSize: 14, color: C.textSub, lineHeight: 22 }}>
                Found a job on a company's career site? Paste the URL and we'll connect you with referrers at that company.
              </Text>
            </BentoCard>

            {/* Track Applications */}
            <BentoCard span={1} height={280} C={C}>
              <LinearGradient colors={C.gradAmber} style={{ width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                <Ionicons name="analytics" size={28} color="#fff" />
              </LinearGradient>
              <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 10 }}>Real-Time Tracking</Text>
              <Text style={{ fontSize: 14, color: C.textSub, lineHeight: 22 }}>
                Track all applications, referral requests, and messages in one beautiful dashboard.
              </Text>
            </BentoCard>

            {/* AI Recommendations */}
            <BentoCard span={1} height={280} gradient={['#7C3AED', '#A855F7', '#D946EF']} C={C}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>✨</Text>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 10 }}>AI-Powered</Text>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 22 }}>
                Our AI learns your preferences and surfaces jobs you'll actually love. Daily personalized alerts.
              </Text>
            </BentoCard>
          </View>
        </View>

        {/* ============================================ */}
        {/* BENTO GRID - FOR REFERRERS */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 60, backgroundColor: 'rgba(16,185,129,0.03)', ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <View
              style={{
                backgroundColor: 'rgba(16,185,129,0.15)',
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 100,
                borderWidth: 1,
                borderColor: 'rgba(16,185,129,0.3)',
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: C.emerald, textTransform: 'uppercase' }}>For Referrers</Text>
            </View>
            <Text style={{ fontSize: isLg ? 44 : 32, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              Turn LinkedIn DMs{'\n'}Into Real Income
            </Text>
            <Text style={{ fontSize: 16, color: C.textSub, marginTop: 16, textAlign: 'center', maxWidth: 500 }}>
              Stop ignoring referral requests. Get paid for every single referral — not just when they get hired.
            </Text>
          </View>

          <View style={{ flexDirection: isLg ? 'row' : 'column', flexWrap: 'wrap' }}>
            {/* Earning card */}
            <BentoCard span={isLg ? 1.5 : 1} height={360} gradient={C.gradEmerald} C={C}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>💰</Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 12 }}>Earn Per Referral</Text>
              <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', lineHeight: 26, marginBottom: 24 }}>
                Get instant rewards for every referral you submit. Plus your company's bonus if they get hired!
              </Text>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: 20 }}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Top referrers earn</Text>
                <Text style={{ fontSize: 36, fontWeight: '800', color: '#fff' }}>$3K+/month</Text>
              </View>
            </BentoCard>

            {/* How it works */}
            <BentoCard span={1} height={360} C={C}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 24 }}>How It Works</Text>
              {[
                { num: '01', title: 'Get Verified', desc: 'Connect work email' },
                { num: '02', title: 'Post Jobs', desc: 'List open positions' },
                { num: '03', title: 'Refer & Earn', desc: 'Instant rewards' },
              ].map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: C.emerald, marginRight: 16, width: 30 }}>{step.num}</Text>
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{step.title}</Text>
                    <Text style={{ fontSize: 13, color: C.textMuted }}>{step.desc}</Text>
                  </View>
                </View>
              ))}
              <GlowButton title="Start Earning" gradient={C.gradEmerald} onPress={() => goToApp()} size="small" />
            </BentoCard>
          </View>
        </View>

        {/* ============================================ */}
        {/* FOR EMPLOYERS */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 60, ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <View
              style={{
                backgroundColor: 'rgba(59,130,246,0.15)',
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 100,
                borderWidth: 1,
                borderColor: 'rgba(59,130,246,0.3)',
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: C.accentBright, textTransform: 'uppercase' }}>For Employers</Text>
            </View>
            <Text style={{ fontSize: isLg ? 44 : 32, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              Hire Better, Faster
            </Text>
          </View>

          <View style={{ flexDirection: isLg ? 'row' : 'column' }}>
            {[
              { icon: 'create', title: 'Post Jobs Free', desc: 'Reach 50K+ qualified professionals instantly.', gradient: ['#3B82F6', '#2563EB'] },
              { icon: 'people', title: 'Referral Network', desc: 'Leverage your employees\' networks for better hires.', gradient: ['#8B5CF6', '#7C3AED'] },
              { icon: 'analytics', title: 'Track & Measure', desc: 'Full analytics on your hiring funnel.', gradient: ['#06B6D4', '#0891B2'] },
            ].map((item, i) => (
              <BentoCard key={i} span={1} height={260} gradient={item.gradient} C={C}>
                <Ionicons name={item.icon} size={36} color="rgba(255,255,255,0.9)" style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 }}>{item.title}</Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 22 }}>{item.desc}</Text>
              </BentoCard>
            ))}
          </View>
        </View>

        {/* ============================================ */}
        {/* CAREER TOOLS                                */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 60, ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View
              style={{
                backgroundColor: 'rgba(167,139,250,0.15)',
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 100,
                borderWidth: 1,
                borderColor: 'rgba(167,139,250,0.3)',
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: C.violet, textTransform: 'uppercase' }}>Career Tools</Text>
            </View>
            <Text style={{ fontSize: isLg ? 44 : 32, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              9 AI-Powered Career Tools.{"\n"}One Platform.
            </Text>
            <Text style={{ fontSize: 16, color: C.textSub, textAlign: 'center', marginTop: 16, maxWidth: 520 }}>
              We're building the most complete career toolkit — so you never have to pay for 5 different subscriptions again.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {CAREER_TOOLS.map((tool) => (
              <TouchableOpacity
                key={tool.id}
                activeOpacity={0.9}
                onPress={tool.ready ? goToResumeAnalyzer : goToApp}
                style={{
                  backgroundColor: C.bgCard, borderRadius: 20, padding: 22,
                  borderWidth: 1, borderColor: tool.ready ? 'rgba(34,211,238,0.3)' : C.border,
                  width: isLg ? '30%' : isMd ? '45%' : '100%',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <LinearGradient
                    colors={tool.gradient}
                    style={{ width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}
                  >
                    <Ionicons name={tool.icon} size={22} color="#fff" />
                  </LinearGradient>
                  {tool.ready && (
                    <View
                      style={{
                        backgroundColor: tool.free ? 'rgba(34,211,238,0.15)' : 'rgba(52,211,153,0.15)',
                        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: tool.free ? C.accent : C.emerald, letterSpacing: 0.5 }}>
                        {tool.free ? '🆓 FREE' : '✅ LIVE'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 6 }}>{tool.title}</Text>
                <Text style={{ fontSize: 13, color: C.textSub, lineHeight: 20 }}>{tool.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ============================================ */}
        {/* TESTIMONIALS */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 80 }}>
          <View style={{ alignItems: 'center', marginBottom: 48, ...containerStyle }}>
            <Text style={{ fontSize: isLg ? 44 : 32, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              Real Stories from Our Community
            </Text>
            <Text style={{ fontSize: 16, color: C.textSub, textAlign: 'center', marginTop: 12, maxWidth: 500 }}>
              Job seekers, referrers, and hiring managers share their RefOpen experience
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {TESTIMONIALS.map((item, index) => (
              <TestimonialCard key={index} item={item} index={index} C={C} />
            ))}
          </ScrollView>
        </View>

        {/* ============================================ */}
        {/* FINAL CTA */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 100, ...containerStyle }}>
          <LinearGradient
            colors={['rgba(99,102,241,0.15)', 'rgba(34,211,238,0.08)', 'rgba(52,211,153,0.05)']}
            style={{
              borderRadius: 32,
              padding: isLg ? 80 : 40,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: C.borderGlow,
            }}
          >
            <Text style={{ fontSize: isLg ? 52 : 36, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1, marginBottom: 20 }}>
              Ready to Transform{'\n'}Your Career?
            </Text>
            <Text style={{ fontSize: 17, color: C.textSub, textAlign: 'center', marginBottom: 40, maxWidth: 500 }}>
              Join 10,000+ professionals who found their dream jobs through referrals.
            </Text>
            <View style={{ flexDirection: isLg ? 'row' : 'column', alignItems: 'center', gap: 16 }}>
              <GlowButton title="Get Started Free" icon="arrow-forward" gradient={C.gradPrimary} onPress={() => goToApp()} />
              <GlowButton title="Start Earning" icon="cash" gradient={C.gradEmerald} onPress={() => goToApp()} />
            </View>
            <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 32 }}>
              ✓ Free to join  ✓ No credit card  ✓ 125K+ jobs
            </Text>
          </LinearGradient>
        </View>

        {/* ============================================ */}
        {/* FOOTER */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 60, borderTopWidth: 1, borderTopColor: C.border }}>
          <View style={{ alignItems: 'center', ...containerStyle }}>
            <TouchableOpacity onPress={() => Linking.openURL(REFOPEN_URL)} style={{ marginBottom: 20 }}>
              <Image source={RefOpenLogo} style={{ width: 180, height: 50 }} resizeMode="contain" />
            </TouchableOpacity>
            <Text style={{ fontSize: 14, color: C.textSub, marginBottom: 24 }}>
              Find Jobs · Get Referred · Hire Talent · Earn Rewards
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 32, gap: 20 }}>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.linkedin.com/company/refopen')}>
                <Ionicons name="logo-linkedin" size={24} color={C.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.instagram.com/refopensolutions')}>
                <Ionicons name="logo-instagram" size={24} color={C.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://x.com/refopensolution')}>
                <Ionicons name="logo-twitter" size={24} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: C.textMuted }}>© 2025 RefOpen. All rights reserved.</Text>
          </View>
        </View>

        <ComplianceFooter currentPage="about" />
      </ScrollView>
    </View>
  );
}
