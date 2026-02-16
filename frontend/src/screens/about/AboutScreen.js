/**
 * RefOpen About Page V3 - PAIN-POINT DRIVEN DESIGN
 * 
 * Architecture:
 * - 15 sections: Hero → Broken System → Resume Analyzer CTA → Marquee → Stats
 *   → How It Works → For Seekers Bento → Comparison Table → For Referrers
 *   → For Employers → Career Tools → Zero Risk → Testimonials → Final CTA → Footer
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

const RefOpenLogo = require('../../../assets/refopen-logo.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const REFOPEN_URL = 'https://www.refopen.com';
const ASK_REFERRAL_URL = 'https://www.refopen.com/ask-referral';

// ============================================
// THEME
// ============================================
const getColors = (isDark) => ({
  bg: '#030712',
  bgAlt: '#0a0f1a',
  bgCard: 'rgba(17, 24, 39, 0.7)',
  bgGlass: 'rgba(17, 24, 39, 0.4)',
  primary: '#818CF8',
  primaryBright: '#A5B4FC',
  accent: '#22D3EE',
  accentBright: '#67E8F9',
  emerald: '#34D399',
  amber: '#FBBF24',
  rose: '#FB7185',
  violet: '#A78BFA',
  gradHero: ['#030712', '#0F172A', '#1E1B4B', '#312E81'],
  gradPrimary: ['#6366F1', '#8B5CF6', '#A855F7'],
  gradAccent: ['#06B6D4', '#22D3EE', '#67E8F9'],
  gradEmerald: ['#10B981', '#34D399'],
  gradAmber: ['#F59E0B', '#FBBF24'],
  gradRose: ['#F43F5E', '#FB7185'],
  gradViolet: ['#7C3AED', '#A78BFA'],
  gradMesh: ['rgba(99,102,241,0.15)', 'rgba(34,211,238,0.1)', 'rgba(52,211,153,0.05)'],
  text: '#F9FAFB',
  textSub: '#9CA3AF',
  textMuted: '#6B7280',
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
  { name: 'Goldman Sachs', domain: 'goldmansachs.com' },
  { name: 'Uber', domain: 'uber.com' },
  { name: 'Stripe', domain: 'stripe.com' },
  { name: 'Flipkart', domain: 'flipkart.com' },
  { name: 'Razorpay', domain: 'razorpay.com' },
  { name: 'CRED', domain: 'cred.club' },
  { name: 'Swiggy', domain: 'swiggy.com' },
  { name: 'PhonePe', domain: 'phonepe.com' },
  { name: 'Zomato', domain: 'zomato.com' },
  { name: 'Meesho', domain: 'meesho.com' },
  { name: 'JPMorgan', domain: 'jpmorganchase.com' },
  { name: 'Spotify', domain: 'spotify.com' },
];

// ============================================
// TESTIMONIALS
// ============================================
const TESTIMONIALS = [
  { quote: "Spent ₹49 on a referral request. Got a call from Google in 4 days. Now earning ₹45 LPA. Best ₹49 I ever spent.", name: "Priya S.", role: "Software Engineer", company: "Google", avatar: "P" },
  { quote: "Made ₹18,000 last month just referring people from my company. It takes 2 minutes per referral. Easiest side income ever.", name: "Rahul M.", role: "Senior PM", company: "Microsoft", avatar: "R" },
  { quote: "The free Resume Analyzer caught 12 issues my resume had — including broken ATS formatting. Fixed them, got referred via RefOpen, hired at Amazon in 3 weeks.", name: "Amit K.", role: "Data Scientist", company: "Amazon", avatar: "A" },
  { quote: "I'm from a Tier 2 college. Nobody on LinkedIn responded to my DMs. On RefOpen, a Flipkart engineer claimed my request in 6 hours. Got the offer within 2 weeks.", name: "Sneha V.", role: "Frontend Developer", company: "Flipkart", avatar: "S" },
  { quote: "Cold DMs on LinkedIn felt desperate. RefOpen made referrals feel professional — like a marketplace, not begging. Got 3 referrals in my first week.", name: "Neha T.", role: "Product Designer", company: "CRED", avatar: "N" },
  { quote: "Hired 4 engineers through RefOpen referrals this quarter. The quality of candidates is noticeably higher when they come through trusted connections.", name: "Jason L.", role: "Engineering Manager", company: "Stripe", avatar: "J" },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
// MARQUEE
// ============================================
const CompanyMarquee = ({ companies, C, speed = 30 }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const duplicatedCompanies = [...companies, ...companies, ...companies];
  const itemWidth = 140;
  const totalWidth = companies.length * itemWidth;

  useEffect(() => {
    scrollX.setValue(0);
    Animated.loop(
      Animated.timing(scrollX, {
        toValue: -totalWidth,
        duration: totalWidth * speed,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  return (
    <View style={{ overflow: 'hidden', height: 80 }}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: scrollX }] }}>
        {duplicatedCompanies.map((company, index) => (
          <View
            key={`${company.name}-${index}`}
            style={{
              width: itemWidth, height: 70, marginHorizontal: 8,
              backgroundColor: C.bgCard, borderRadius: 16, borderWidth: 1, borderColor: C.border,
              justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
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
// BENTO CARD
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

  const handlePressIn = () => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, tension: 100 }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 100 }).start();
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
            style={{ flex: 1, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}
          >
            {children}
          </LinearGradient>
        ) : (
          <View
            style={{
              flex: 1, backgroundColor: C.bgCard, borderRadius: 24, padding: 24,
              borderWidth: 1, borderColor: C.border, overflow: 'hidden',
              ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
            }}
          >
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute', top: -50, right: -50, width: 200, height: 200,
                borderRadius: 100, backgroundColor: C.glow, opacity: glowOpacity,
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
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
            borderRadius: isLarge ? 20 : 14, backgroundColor: gradient[0],
            opacity: glowOpacity, transform: [{ scale: glowScale }],
          }}
        />
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: isLarge ? 32 : 20, paddingVertical: isLarge ? 18 : 12,
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
// TESTIMONIAL CARD
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
    ['#6366F1', '#8B5CF6'], ['#06B6D4', '#22D3EE'], ['#10B981', '#34D399'],
    ['#F59E0B', '#FBBF24'], ['#F43F5E', '#FB7185'], ['#7C3AED', '#A78BFA'],
  ];

  return (
    <Animated.View style={{ transform: [{ translateY: floatAnim }], marginHorizontal: 8, marginBottom: 16, width: 320 }}>
      <View
        style={{
          backgroundColor: C.bgCard, borderRadius: 20, padding: 24,
          borderWidth: 1, borderColor: C.border,
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
        }}
      >
        <View style={{ position: 'absolute', top: 16, right: 16, opacity: 0.1 }}>
          <Ionicons name="chatbubble-ellipses" size={40} color={C.text} />
        </View>
        <Text style={{ fontSize: 15, color: C.text, lineHeight: 24, marginBottom: 20, fontStyle: 'italic' }}>
          "{item.quote}"
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <LinearGradient
            colors={gradients[index % gradients.length]}
            style={{ width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}
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
// STAT ITEM
// ============================================
const StatItem = ({ value, label, color, C, isLg }) => {
  const lineWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(lineWidth, {
      toValue: 1, duration: 1000, delay: 500,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
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
// COMPARISON ROW
// ============================================
const ComparisonRow = ({ label, cold, refopen, C, isLg }) => (
  <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 16 }}>
    <View style={{ flex: 1.2 }}>
      <Text style={{ fontSize: isLg ? 14 : 13, fontWeight: '600', color: C.text }}>{label}</Text>
    </View>
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: isLg ? 14 : 12, color: C.rose, textAlign: 'center' }}>{cold}</Text>
    </View>
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: isLg ? 14 : 12, color: C.emerald, fontWeight: '700', textAlign: 'center' }}>{refopen}</Text>
    </View>
  </View>
);

// ============================================
// SECTION BADGE
// ============================================
const SectionBadge = ({ text, color, bgColor }) => (
  <View
    style={{
      backgroundColor: bgColor, paddingHorizontal: 16, paddingVertical: 6,
      borderRadius: 100, borderWidth: 1, borderColor: color + '40', marginBottom: 20,
    }}
  >
    <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color, textTransform: 'uppercase' }}>{text}</Text>
  </View>
);

// ============================================
// MAIN COMPONENT
// ============================================
export default function AboutScreenNew() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const { isDesktop, isTablet, isMobile } = useResponsive();
  const scrollRef = useRef(null);

  const goToApp = () => navigation.navigate(isAuthenticated ? 'Main' : 'Auth');
  const goToResumeAnalyzer = () => {
    if (isAuthenticated) {
      navigation.navigate('Main', { screen: 'ServicesTab', params: { screen: 'ResumeAnalyzer' } });
    } else {
      navigation.navigate('ResumeAnalyzerPublic');
    }
  };

  const C = useMemo(() => getColors(isDark), [isDark]);
  const isLg = isDesktop;
  const isMd = isTablet;

  const containerStyle = {
    maxWidth: 1200, width: '100%', alignSelf: 'center',
    paddingHorizontal: isLg ? 24 : isMd ? 20 : 16,
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, overflow: 'hidden' }}>
      <LinearGradient colors={C.gradHero} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 1.2 }} />

      <FloatingOrb color="rgba(99,102,241,0.3)" size={400} initialX={-100} initialY={100} duration={10000} />
      <FloatingOrb color="rgba(34,211,238,0.25)" size={300} initialX={SCREEN_WIDTH - 150} initialY={200} duration={12000} />
      <FloatingOrb color="rgba(52,211,153,0.2)" size={250} initialX={SCREEN_WIDTH / 2 - 100} initialY={500} duration={9000} />
      <FloatingOrb color="rgba(251,113,133,0.2)" size={200} initialX={50} initialY={800} duration={11000} />
      <FloatingOrb color="rgba(167,139,250,0.25)" size={350} initialX={SCREEN_WIDTH - 200} initialY={1000} duration={13000} />

      {/* HEADER */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: isLg ? 40 : 20, paddingVertical: 16,
          borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: 'rgba(3,7,18,0.8)',
          ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 } : {}),
        }}
      >
        <TouchableOpacity onPress={() => Linking.openURL(REFOPEN_URL)}>
          <Image source={RefOpenLogo} style={{ width: 130, height: 36 }} resizeMode="contain" />
        </TouchableOpacity>
        {isAuthenticated ? (
          <GlowButton title="Go to App" gradient={C.gradPrimary} onPress={goToApp} size="small" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Auth', { screen: 'Login' })}
              style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.primaryBright }}
            >
              <Text style={{ color: C.primaryBright, fontWeight: '700', fontSize: 14 }}>Sign In</Text>
            </TouchableOpacity>
            <GlowButton title="Sign Up Free" gradient={C.gradPrimary} onPress={() => navigation.navigate('Auth', { screen: 'Login' })} size="small" />
          </View>
        )}
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        {/* ═══════════════════════════════════════════ */}
        {/* 1. HERO - Pain-Point Hook                  */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingTop: isLg ? 48 : 28, paddingBottom: 40, ...containerStyle }}>
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: 'rgba(251,113,133,0.12)', paddingHorizontal: 16, paddingVertical: 8,
                borderRadius: 100, borderWidth: 1, borderColor: 'rgba(251,113,133,0.3)', marginBottom: 32,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.rose, letterSpacing: 0.5 }}>
                200 applications. 0 callbacks. Sound familiar?
              </Text>
            </View>

            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: isLg ? 72 : isMd ? 52 : 38, fontWeight: '800', textAlign: 'center',
                  lineHeight: isLg ? 82 : isMd ? 62 : 46, letterSpacing: -2, color: C.text,
                }}
              >
                Stop Sending Resumes{'\n'}
                <Text style={{ color: C.rose }}>Into the Void.</Text>
              </Text>
            </View>

            <Text
              style={{
                fontSize: isLg ? 20 : 16, color: C.textSub, textAlign: 'center',
                lineHeight: isLg ? 32 : 26, maxWidth: 640, marginBottom: 48,
              }}
            >
              It's not you. It's the system. Referral candidates are{' '}
              <Text style={{ color: C.accent, fontWeight: '700' }}>15x more likely</Text> to get hired
              — but you don't know anyone at those companies.{' '}
              <Text style={{ color: C.text, fontWeight: '700' }}>Until now.</Text>
              {'\n\n'}
              RefOpen connects you with verified employees at Google, Amazon, Microsoft & 2,500+ companies who will refer you — no cold DMs needed.
            </Text>

            <View style={{ flexDirection: isLg ? 'row' : 'column', alignItems: 'center', gap: 16 }}>
              <GlowButton title="Analyze My Resume Free" icon="document-text" gradient={C.gradAccent} onPress={goToResumeAnalyzer} />
              <TouchableOpacity onPress={goToApp}>
                <View
                  style={{
                    paddingHorizontal: 32, paddingVertical: 18, borderRadius: 16,
                    borderWidth: 1.5, borderColor: C.borderGlow, backgroundColor: 'rgba(99,102,241,0.1)',
                  }}
                >
                  <Text style={{ color: C.primaryBright, fontWeight: '700', fontSize: 16 }}>Browse 125K+ Jobs →</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, opacity: 0.6 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons key={i} name="star" size={16} color={C.amber} style={{ marginRight: 2 }} />
              ))}
              <Text style={{ fontSize: 13, color: C.textMuted, marginLeft: 8 }}>4.9 rating · 10,000+ professionals</Text>
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════ */}
        {/* 2. THE BROKEN SYSTEM                       */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 60 }}>
        <View style={{ ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <SectionBadge text="The Problem" color={C.rose} bgColor="rgba(251,113,133,0.12)" />
            <Text style={{ fontSize: isLg ? 36 : 26, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              You're Not Bad at This.{'\n'}
              <Text style={{ color: C.rose }}>The System is Broken.</Text>
            </Text>
            <Text style={{ fontSize: 16, color: C.textSub, textAlign: 'center', marginTop: 16, maxWidth: 600 }}>
              Every day, millions of qualified candidates apply to jobs and hear nothing back. Here's what's actually happening behind the scenes:
            </Text>
          </View>

          <View style={{ flexDirection: isLg ? 'row' : 'column', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
            {[
              { emoji: '🕳️', title: 'The ATS Black Hole', stat: '75%', desc: 'of resumes are rejected by software before a human ever sees them. Your dream job? A robot said no.' },
              { emoji: '👻', title: 'The Ghost Zone', stat: '98%', desc: 'of cold applications get zero response — not even a rejection. You\'re left wondering forever.' },
              { emoji: '🔒', title: 'The Network Lock', stat: '70%', desc: 'of jobs are filled through referrals & networking. If you don\'t know anyone inside, you\'re invisible.' },
              { emoji: '😰', title: 'The Confidence Killer', stat: '6 months', desc: 'is the average job search. After 100+ rejections, you start believing something\'s wrong with you. It\'s not — the system failed you, not the other way around.' },
            ].map((item, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: C.bgCard, borderRadius: 20, padding: 28,
                  borderWidth: 1, borderColor: C.border,
                  width: isLg ? '22%' : isMd ? '46%' : '100%', alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 40, marginBottom: 16 }}>{item.emoji}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 12 }}>{item.title}</Text>
                <Text style={{ fontSize: 36, fontWeight: '800', color: C.rose, marginBottom: 12 }}>{item.stat}</Text>
                <Text style={{ fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 20 }}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>
        </View>

        {/* ═══════════════════════════════════════════ */}
        {/* 3. FREE RESUME ANALYZER CTA                */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingVertical: 40, ...containerStyle }}>
          <TouchableOpacity activeOpacity={0.95} onPress={goToResumeAnalyzer}>
            <LinearGradient
              colors={['rgba(34,211,238,0.15)', 'rgba(6,182,212,0.08)', 'rgba(34,211,238,0.03)']}
              style={{
                borderRadius: 24, padding: isLg ? 40 : 24, borderWidth: 1.5,
                borderColor: 'rgba(34,211,238,0.3)', flexDirection: isLg ? 'row' : 'column',
                alignItems: 'center', gap: 24,
              }}
            >
              <LinearGradient
                colors={C.gradAccent}
                style={{ width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="document-text" size={36} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Free AI Resume Analyzer</Text>
                  <View style={{ backgroundColor: 'rgba(34,211,238,0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginLeft: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.accent }}>🆓 FREE</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 15, color: C.textSub, lineHeight: 24 }}>
                  Before you apply anywhere, check if your resume will even pass ATS. Our AI scans for 50+ issues and gives you an instant score.
                </Text>
              </View>
              <GlowButton title="Analyze My Resume Free" gradient={C.gradAccent} onPress={goToResumeAnalyzer} size="small" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════ */}
        {/* 4. COMPANIES MARQUEE                       */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingVertical: 40, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border }}>
          <Text style={{ textAlign: 'center', fontSize: 12, color: C.textMuted, letterSpacing: 2, marginBottom: 24, textTransform: 'uppercase' }}>
            Verified referrers from these companies are on RefOpen
          </Text>
          <CompanyMarquee companies={COMPANIES} C={C} />
        </View>

        {/* ═══════════════════════════════════════════ */}
        {/* 5. STATS                                   */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingVertical: 80, ...containerStyle }}>
          <View style={{ flexDirection: isLg ? 'row' : 'column', justifyContent: 'center', alignItems: 'center', gap: isLg ? 0 : 32 }}>
            <StatItem value="125K+" label="Active Jobs" color={C.primary} C={C} isLg={isLg} />
            {isLg && <View style={{ width: 1, height: 60, backgroundColor: C.border, marginHorizontal: 40 }} />}
            <StatItem value="1000+" label="Verified Referrers" color={C.accent} C={C} isLg={isLg} />
            {isLg && <View style={{ width: 1, height: 60, backgroundColor: C.border, marginHorizontal: 40 }} />}
            <StatItem value="2.5K+" label="Companies" color={C.emerald} C={C} isLg={isLg} />
            {isLg && <View style={{ width: 1, height: 60, backgroundColor: C.border, marginHorizontal: 40 }} />}
            <StatItem value="15x" label="Higher Hiring Rate" color={C.rose} C={C} isLg={isLg} />
          </View>
        </View>

        {/* ═══════════════════════════════════════════ */}
        {/* 6. HOW IT WORKS                            */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingVertical: 60, ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <SectionBadge text="How It Works" color={C.primary} bgColor="rgba(99,102,241,0.15)" />
            <Text style={{ fontSize: isLg ? 36 : 26, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              From Invisible to Referred{'\n'}
              <Text style={{ color: C.primary }}>in 3 Steps</Text>
            </Text>
          </View>

          <View style={{ flexDirection: isLg ? 'row' : 'column', gap: 20 }}>
            {[
              { step: 'STEP 01', title: 'Create Profile', time: '2 minutes', desc: 'Sign up, upload your resume, set job preferences. Your profile reaches all referrers — like a matchmaking platform, but for careers.', icon: 'person-add', gradient: ['#6366F1', '#818CF8'] },
              { step: 'STEP 02', title: 'Ask for Referral', time: 'Takes 30 seconds', desc: 'Pick a job (or paste any job URL). One request reaches ALL verified employees at that company. No cold DMs, no awkward LinkedIn messages. You only pay if someone actually refers you.', icon: 'hand-right', gradient: ['#06B6D4', '#22D3EE'] },
              { step: 'STEP 03', title: 'Get Referred & Hired', time: 'avg. 5 days for referral', desc: 'A verified employee claims your request and submits your resume internally. You skip the ATS queue. Your resume lands on a real desk.', icon: 'checkmark-circle', gradient: ['#10B981', '#34D399'] },
            ].map((item, i) => (
              <View
                key={i}
                style={{ flex: 1, backgroundColor: C.bgCard, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: C.border }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <LinearGradient
                    colors={item.gradient}
                    style={{ width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}
                  >
                    <Ionicons name={item.icon} size={24} color="#fff" />
                  </LinearGradient>
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 1.5 }}>{item.step}</Text>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: C.text }}>{item.title}</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: 'rgba(99,102,241,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary }}>{item.time}</Text>
                </View>
                <Text style={{ fontSize: 14, color: C.textSub, lineHeight: 22 }}>{item.desc}</Text>
              </View>
            ))}
          </View>

          <View style={{ alignItems: 'center', marginTop: 32 }}>
            <View style={{ backgroundColor: 'rgba(52,211,153,0.1)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(52,211,153,0.2)', maxWidth: 500 }}>
              <Text style={{ fontSize: 14, color: C.emerald, textAlign: 'center', fontWeight: '600' }}>
                🛡️ No referrer in 14 days? Full refund. Automatic. No questions asked.
              </Text>
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════ */}
        {/* 7. FOR JOB SEEKERS - Bento                 */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingVertical: 60, ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <SectionBadge text="For Job Seekers" color={C.primary} bgColor="rgba(99,102,241,0.15)" />
            <Text style={{ fontSize: isLg ? 36 : 26, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              Everything You Need to{'\n'}
              <Text style={{ color: C.primary }}>Land Your Dream Job</Text>
            </Text>
            <Text style={{ fontSize: 16, color: C.textSub, textAlign: 'center', marginTop: 12 }}>
              Not just referrals. A complete career toolkit.
            </Text>
          </View>

          <View style={{ flexDirection: isLg ? 'row' : 'column', flexWrap: 'wrap' }}>
            <BentoCard span={isLg ? 2 : 1} height={320} gradient={C.gradPrimary} C={C} onPress={goToApp}>
              <Ionicons name="briefcase" size={40} color="rgba(255,255,255,0.9)" style={{ marginBottom: 20 }} />
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 12 }}>
                Apply Directly to 125K+ Jobs
              </Text>
              <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 26 }}>
                Browse jobs from Fortune 500 companies and startups. One-click apply with your profile. AI-powered recommendations find perfect matches.
              </Text>
            </BentoCard>

            <BentoCard span={1} height={320} C={C} onPress={goToApp}>
              <LinearGradient colors={C.gradAccent} style={{ width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                <Ionicons name="hand-right" size={28} color="#fff" />
              </LinearGradient>
              <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 10 }}>Ask for Referral</Text>
              <Text style={{ fontSize: 14, color: C.textSub, lineHeight: 22 }}>
                One request reaches ALL verified employees at that company. Skip the cold DMs.
              </Text>
            </BentoCard>

            <BentoCard span={1} height={280} C={C} onPress={goToApp}>
              <LinearGradient colors={C.gradEmerald} style={{ width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                <Ionicons name="globe" size={28} color="#fff" />
              </LinearGradient>
              <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 10 }}>External Jobs</Text>
              <Text style={{ fontSize: 14, color: C.textSub, lineHeight: 22 }}>
                Found a job on a company's career site? Paste the URL and we'll connect you with referrers at that company.
              </Text>
            </BentoCard>

            <BentoCard span={1} height={280} gradient={['#7C3AED', '#A855F7', '#D946EF']} C={C} onPress={goToApp}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>✨</Text>
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 10 }}>AI-Powered</Text>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 22 }}>
                Our AI learns your preferences and surfaces jobs you'll actually love. Daily personalized alerts.
              </Text>
            </BentoCard>

            <BentoCard span={1} height={280} C={C} onPress={goToApp}>
              <LinearGradient colors={C.gradAmber} style={{ width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                <Ionicons name="analytics" size={28} color="#fff" />
              </LinearGradient>
              <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 10 }}>Real-Time Tracking</Text>
              <Text style={{ fontSize: 14, color: C.textSub, lineHeight: 22 }}>
                Track all applications, referral requests, and messages in one beautiful dashboard.
              </Text>
            </BentoCard>
          </View>
        </View>

        {/* ═══════════════════════════════════════════ */}
        {/* 8. COMPARISON TABLE                        */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingVertical: 60, ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <SectionBadge text="The Difference" color={C.accent} bgColor="rgba(34,211,238,0.12)" />
            <Text style={{ fontSize: isLg ? 36 : 26, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              Cold Applying vs <Text style={{ color: C.accent }}>RefOpen</Text>
            </Text>
          </View>

          <View
            style={{
              backgroundColor: C.bgCard, borderRadius: 24, padding: isLg ? 32 : 20,
              borderWidth: 1, borderColor: C.border, maxWidth: 700, alignSelf: 'center', width: '100%',
            }}
          >
            <View style={{ flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: C.border, paddingBottom: 16, marginBottom: 8 }}>
              <View style={{ flex: 1.2 }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.rose }}>Cold Apply</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.emerald }}>RefOpen</Text>
              </View>
            </View>
            <ComparisonRow label="Response Rate" cold="2-5%" refopen="40-60%" C={C} isLg={isLg} />
            <ComparisonRow label="Time to Interview" cold="4-8 weeks" refopen="5-10 days" C={C} isLg={isLg} />
            <ComparisonRow label="Resume Seen By" cold="ATS Robot" refopen="Real Human" C={C} isLg={isLg} />
            <ComparisonRow label="Insider Connection" cold="❌ None" refopen="✅ Verified Employee" C={C} isLg={isLg} />
            <ComparisonRow label="Resume Feedback" cold="❌ Silence" refopen="✅ AI Score (FREE)" C={C} isLg={isLg} />
            <ComparisonRow label="Cost" cold="Free but useless" refopen="Pay only when referred" C={C} isLg={isLg} />
          </View>
        </View>

        {/* ═══════════════════════════════════════════ */}
        {/* 9. FOR REFERRERS                           */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingVertical: 60, backgroundColor: 'rgba(16,185,129,0.03)', ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <SectionBadge text="For Referrers" color={C.emerald} bgColor="rgba(16,185,129,0.15)" />
            <Text style={{ fontSize: isLg ? 36 : 26, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              Already Employed?{'\n'}
              <Text style={{ color: C.emerald }}>Turn 2 Minutes Into Real Cash.</Text>
            </Text>
            <Text style={{ fontSize: 16, color: C.textSub, marginTop: 16, textAlign: 'center', maxWidth: 540 }}>
              Stop ignoring LinkedIn referral DMs. Get paid for every single referral you submit — not just when they get hired.
            </Text>
          </View>

          <View style={{ flexDirection: isLg ? 'row' : 'column', flexWrap: 'wrap' }}>
            <BentoCard span={isLg ? 1.5 : 1} height={360} gradient={C.gradEmerald} C={C} onPress={goToApp}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>💰</Text>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 12 }}>Two payouts, one referral</Text>
              <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', lineHeight: 26, marginBottom: 24 }}>
                Get instant rewards for every referral you submit. Plus your company's bonus if they get hired!
              </Text>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: 20 }}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Top referrers earn</Text>
                <Text style={{ fontSize: 36, fontWeight: '800', color: '#fff' }}>$3K+/month</Text>
              </View>
            </BentoCard>

            <BentoCard span={1} height={360} C={C} onPress={goToApp}>
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
              <GlowButton title="Start Earning" gradient={C.gradEmerald} onPress={goToApp} size="small" />
            </BentoCard>
          </View>
        </View>

        {/* ═══════════════════════════════════════════ */}
        {/* 10. FOR EMPLOYERS                          */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingVertical: 40, ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <SectionBadge text="For Employers" color={C.accentBright} bgColor="rgba(59,130,246,0.15)" />
            <Text style={{ fontSize: isLg ? 36 : 26, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              Hire Better. Faster. Free.
            </Text>
          </View>

          <View style={{ flexDirection: isLg ? 'row' : 'column' }}>
            {[
              { icon: 'create', title: 'Post Jobs Free', desc: 'Reach 50K+ qualified professionals instantly. No fees ever.', gradient: ['#3B82F6', '#2563EB'] },
              { icon: 'people', title: 'Referral Network', desc: 'Leverage your employees\' networks for higher-quality hires.', gradient: ['#8B5CF6', '#7C3AED'] },
              { icon: 'analytics', title: 'Track & Measure', desc: 'Full analytics on your referral hiring funnel.', gradient: ['#06B6D4', '#0891B2'] },
            ].map((item, i) => (
              <BentoCard key={i} span={1} height={220} gradient={item.gradient} C={C} onPress={goToApp}>
                <Ionicons name={item.icon} size={32} color="rgba(255,255,255,0.9)" style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 }}>{item.title}</Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 22 }}>{item.desc}</Text>
              </BentoCard>
            ))}
          </View>
        </View>

        {/* ═══════════════════════════════════════════ */}
        {/* 11. CAREER TOOLS                           */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingVertical: 60, ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <SectionBadge text="Career Tools" color={C.violet} bgColor="rgba(167,139,250,0.15)" />
            <Text style={{ fontSize: isLg ? 36 : 26, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              9 AI-Powered Career Tools.{'\n'}One Platform.
            </Text>
            <Text style={{ fontSize: 16, color: C.textSub, textAlign: 'center', maxWidth: 520 }}>
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

        {/* ═══════════════════════════════════════════ */}
        {/* 12. ZERO RISK GUARANTEE                    */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingVertical: 60, ...containerStyle }}>
          <LinearGradient
            colors={['rgba(52,211,153,0.12)', 'rgba(16,185,129,0.06)', 'rgba(52,211,153,0.02)']}
            style={{
              borderRadius: 28, padding: isLg ? 48 : 28,
              borderWidth: 1.5, borderColor: 'rgba(52,211,153,0.25)', alignItems: 'center',
            }}
          >
            <Ionicons name="shield-checkmark" size={48} color={C.emerald} style={{ marginBottom: 20 }} />
            <Text style={{ fontSize: isLg ? 36 : 26, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1, marginBottom: 16 }}>
              Zero Risk. We Mean It.
            </Text>
            <Text style={{ fontSize: 16, color: C.textSub, textAlign: 'center', maxWidth: 520, lineHeight: 26, marginBottom: 32 }}>
              We know you've been burned by "job platforms" before. That's why we built the hold system:
            </Text>

            <View style={{ flexDirection: isLg ? 'row' : 'column', gap: 16, width: '100%' }}>
              {[
                { icon: 'lock-closed', title: 'Money Held, Not Charged', desc: 'Your ₹49 is held — not taken. It\'s only charged when a referrer actually submits your referral.' },
                { icon: 'refresh', title: 'Auto-Refund in 14 Days', desc: 'No referrer picks up your request? Full refund. Automatic. No forms, no emails, no begging.' },
                { icon: 'close-circle', title: 'Cancel Anytime', desc: 'Changed your mind? Cancel within 1 hour for zero fee. Even after that, minimal cancellation charges.' },
              ].map((item, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1, backgroundColor: 'rgba(52,211,153,0.08)', borderRadius: 20, padding: 24,
                    borderWidth: 1, borderColor: 'rgba(52,211,153,0.15)', alignItems: 'center',
                  }}
                >
                  <Ionicons name={item.icon} size={32} color={C.emerald} style={{ marginBottom: 14 }} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 8 }}>{item.title}</Text>
                  <Text style={{ fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 20 }}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* ═══════════════════════════════════════════ */}
        {/* 13. TESTIMONIALS                           */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingVertical: 80 }}>
          <View style={{ alignItems: 'center', marginBottom: 48, ...containerStyle }}>
            <Text style={{ fontSize: isLg ? 36 : 26, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              Real People. Real Results.
            </Text>
            <Text style={{ fontSize: 16, color: C.textSub, textAlign: 'center', marginTop: 12, maxWidth: 500 }}>
              From people who were exactly where you are right now.
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {TESTIMONIALS.map((item, index) => (
              <TestimonialCard key={index} item={item} index={index} C={C} />
            ))}
          </ScrollView>
        </View>

        {/* ═══════════════════════════════════════════ */}
        {/* 14. FINAL CTA                              */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingVertical: 100, ...containerStyle }}>
          <LinearGradient
            colors={['rgba(99,102,241,0.15)', 'rgba(34,211,238,0.08)', 'rgba(52,211,153,0.05)']}
            style={{
              borderRadius: 32, padding: isLg ? 80 : 40, alignItems: 'center',
              borderWidth: 1, borderColor: C.borderGlow,
            }}
          >
            <Text style={{ fontSize: isLg ? 44 : 32, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1, marginBottom: 20 }}>
              Your Dream Company Has{'\n'}
              <Text style={{ color: C.primary }}>a Referrer Waiting for You.</Text>
            </Text>
            <Text style={{ fontSize: 17, color: C.textSub, textAlign: 'center', marginBottom: 40, maxWidth: 540 }}>
              Every day you wait is another day your dream role goes to someone who simply had a connection.
            </Text>

            <View style={{ flexDirection: isLg ? 'row' : 'column', alignItems: 'center', gap: 16, marginBottom: 32 }}>
              <GlowButton title="Get Started Free" icon="arrow-forward" gradient={C.gradPrimary} onPress={goToApp} />
              <GlowButton title="Analyze My Resume" icon="document-text" gradient={C.gradAccent} onPress={goToResumeAnalyzer} />
            </View>

            <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center' }}>
              Start free. No credit card needed.
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 20 }}>
              {['🆓 Free AI Resume Analyzer', '🎁 ₹25 Signup Bonus', '💼 125K+ Jobs', '🛡️ Money-Back Guarantee'].map((item, i) => (
                <View key={i} style={{ backgroundColor: 'rgba(99,102,241,0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}>
                  <Text style={{ fontSize: 13, color: C.textSub, fontWeight: '600' }}>{item}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* ═══════════════════════════════════════════ */}
        {/* 15. FOOTER                                 */}
        {/* ═══════════════════════════════════════════ */}
        <View style={{ paddingVertical: 60, borderTopWidth: 1, borderTopColor: C.border }}>
          <View style={{ alignItems: 'center', ...containerStyle }}>
            <TouchableOpacity onPress={() => Linking.openURL(REFOPEN_URL)} style={{ marginBottom: 20 }}>
              <Image source={RefOpenLogo} style={{ width: 180, height: 50 }} resizeMode="contain" />
            </TouchableOpacity>
            <Text style={{ fontSize: 14, color: C.textSub, marginBottom: 24 }}>
              Find Jobs · Get Referred · Hire Talent · Earn Rewards · AI Career Tools
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
            <Text style={{ fontSize: 12, color: C.textMuted }}>© 2026 RefOpen. All rights reserved.</Text>
          </View>
        </View>

        <ComplianceFooter currentPage="about" />
      </ScrollView>
    </View>
  );
}
