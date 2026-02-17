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

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Image,
  Platform,
  Linking,
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
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
  { quote: "Spent ₹49 on a referral request. Got a call from Google in 4 days. Now earning ₹45 LPA. Best ₹49 I ever spent.", name: "Priya S.", role: "Software Engineer", company: "Google", avatar: "P" },
  { quote: "Made ₹8,*** last month just referring people from my company. It takes 2 minutes per referral. Easiest side income ever.", name: "Rahul M.", role: "Senior PM", company: "Microsoft", avatar: "R" },
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
// COMPANY LIST - Static horizontal scroll
// ============================================
const CompanyMarquee = ({ companies, C }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
    {companies.map((company, index) => (
      <View
        key={`${company.name}-${index}`}
        style={{
          width: 140, height: 70, marginHorizontal: 8,
          backgroundColor: C.bgCard, borderRadius: 16,
          borderWidth: 1, borderColor: C.border,
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
  </ScrollView>
);

// ============================================
// BENTO CARD - Static grid card
// ============================================
const BentoCard = ({ children, span = 1, height = 280, gradient, C, style, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.9}
    onPress={onPress || (() => Linking.openURL(REFOPEN_URL))}
    style={{ flex: span, minHeight: height, margin: 6, ...style }}
  >
    {gradient ? (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1, borderRadius: 24, padding: 24,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
        }}
      >
        {children}
      </LinearGradient>
    ) : (
      <View
        style={{
          flex: 1, backgroundColor: C.bgCard, borderRadius: 24, padding: 24,
          borderWidth: 1, borderColor: C.border, overflow: 'hidden',
        }}
      >
        {children}
      </View>
    )}
  </TouchableOpacity>
);

// ============================================
// SIMPLE GRADIENT BUTTON
// ============================================
const GlowButton = ({ title, icon, gradient, onPress, size = 'large' }) => {
  const isLarge = size === 'large';
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
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
    </TouchableOpacity>
  );
};

// ============================================
// TESTIMONIAL CARD - Static
// ============================================
const TestimonialCard = ({ item, index, C }) => {
  const gradients = [
    ['#6366F1', '#8B5CF6'],
    ['#06B6D4', '#22D3EE'],
    ['#10B981', '#34D399'],
    ['#F59E0B', '#FBBF24'],
    ['#F43F5E', '#FB7185'],
    ['#7C3AED', '#A78BFA'],
  ];

  return (
    <View style={{ marginHorizontal: 8, marginBottom: 16, width: 320 }}>
      <View
        style={{
          backgroundColor: C.bgCard, borderRadius: 20, padding: 24,
          borderWidth: 1, borderColor: C.border,
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
    </View>
  );
};

// ============================================
// STAT ITEM - Static
// ============================================
const StatItem = ({ value, label, color, C, isLg }) => (
  <View style={{ alignItems: 'center', paddingHorizontal: isLg ? 32 : 16 }}>
    <Text style={{ fontSize: isLg ? 56 : 36, fontWeight: '800', color, letterSpacing: -2 }}>{value}</Text>
    <View style={{ height: 3, backgroundColor: color, borderRadius: 2, marginVertical: 8, width: '100%' }} />
    <Text style={{ fontSize: isLg ? 14 : 12, color: C.textSub, textAlign: 'center' }}>{label}</Text>
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
            <GlowButton title="Sign Up" gradient={C.gradPrimary} onPress={() => navigation.navigate('Auth', { screen: 'JobSeekerFlow', params: { screen: 'ExperienceTypeSelection', params: { userType: 'JobSeeker', fromGoogleAuth: false, googleUser: null } } })} size="small" />
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ============================================ */}
        {/* HERO SECTION */}
        {/* ============================================ */}
        <View style={{ paddingTop: isLg ? 32 : 20, paddingBottom: 24, ...containerStyle }}>
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
                marginBottom: 20,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.emerald, marginRight: 10 }} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.primaryBright, letterSpacing: 0.5 }}>
                Trusted by 10,000+ professionals
              </Text>
            </View>

            {/* Main headline with gradient text effect */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
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
                marginBottom: 28,
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
              <GlowButton
                title="Get Referred →"
                gradient={C.gradAccent}
                onPress={() => goToApp()}
              />
            </View>

            {/* Trust indicators */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, opacity: 0.6 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons key={i} name="star" size={16} color={C.amber} style={{ marginRight: 2 }} />
              ))}
              <Text style={{ fontSize: 13, color: C.textMuted, marginLeft: 8 }}>4.9 rating · 10,000+ reviews</Text>
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* STATS SECTION — Immediate social proof */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 32, ...containerStyle }}>
          <View
            style={{
              flexDirection: isLg ? 'row' : 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              gap: isLg ? 0 : 16,
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
        <View style={{ paddingVertical: 40, ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View
              style={{
                backgroundColor: 'rgba(99,102,241,0.15)',
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 100,
                borderWidth: 1,
                borderColor: 'rgba(99,102,241,0.3)',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: C.primary, textTransform: 'uppercase' }}>For Job Seekers</Text>
            </View>
            <Text style={{ fontSize: isLg ? 36 : 28, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              Your Dream Job is{'\n'}One Referral Away
            </Text>
          </View>

          {/* Bento Grid */}
          <View style={{ flexDirection: isLg ? 'row' : 'column', flexWrap: 'wrap' }}>
            {/* Large feature card */}
            <BentoCard span={isLg ? 2 : 1} height={280} gradient={C.gradPrimary} C={C}>
              <Ionicons name="briefcase" size={36} color="rgba(255,255,255,0.9)" style={{ marginBottom: 16 }} />
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 10 }}>
                Apply Directly to 125K+ Jobs
              </Text>
              <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 24 }}>
                Browse jobs from Fortune 500 companies and startups. One-click apply with your profile.
              </Text>
            </BentoCard>

            {/* Ask Referral card */}
            <BentoCard span={1} height={280} C={C}>
              <LinearGradient colors={C.gradAccent} style={{ width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="hand-right" size={24} color="#fff" />
              </LinearGradient>
              <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 8 }}>Ask for Referral</Text>
              <Text style={{ fontSize: 14, color: C.textSub, lineHeight: 22 }}>
                One request reaches ALL verified employees at that company. Skip cold DMs.
              </Text>
            </BentoCard>

            {/* External Referral */}
            <BentoCard span={1} height={240} C={C}>
              <LinearGradient colors={C.gradEmerald} style={{ width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="globe" size={24} color="#fff" />
              </LinearGradient>
              <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 8 }}>External Jobs</Text>
              <Text style={{ fontSize: 14, color: C.textSub, lineHeight: 22 }}>
                Found a job elsewhere? Paste the URL and we connect you with referrers.
              </Text>
            </BentoCard>

            {/* Track Applications */}
            <BentoCard span={1} height={240} C={C}>
              <LinearGradient colors={C.gradAmber} style={{ width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="analytics" size={24} color="#fff" />
              </LinearGradient>
              <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 8 }}>Real-Time Tracking</Text>
              <Text style={{ fontSize: 14, color: C.textSub, lineHeight: 22 }}>
                Track all applications, referrals, and messages in one dashboard.
              </Text>
            </BentoCard>

            {/* AI Recommendations */}
            <BentoCard span={1} height={240} gradient={['#7C3AED', '#A855F7', '#D946EF']} C={C}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>✨</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 }}>AI-Powered</Text>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 22 }}>
                AI learns your preferences and surfaces jobs you'll actually love.
              </Text>
            </BentoCard>
          </View>
        </View>

        {/* ============================================ */}
        {/* ZERO RISK GUARANTEE */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 32, ...containerStyle }}>
          <LinearGradient
            colors={['rgba(52,211,153,0.12)', 'rgba(16,185,129,0.06)', 'rgba(52,211,153,0.02)']}
            style={{
              borderRadius: 24, padding: isLg ? 36 : 24,
              borderWidth: 1.5, borderColor: 'rgba(52,211,153,0.25)', alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="shield-checkmark" size={32} color={C.emerald} style={{ marginRight: 12 }} />
              <Text style={{ fontSize: isLg ? 28 : 22, fontWeight: '800', color: C.text, letterSpacing: -1 }}>
                Zero Risk. We Mean It.
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: C.textSub, textAlign: 'center', maxWidth: 520, lineHeight: 22, marginBottom: 20 }}>
              We know you've been burned by "job platforms" before. That's why we built the hold system:
            </Text>

            <View style={{ flexDirection: isLg ? 'row' : 'column', gap: 12, width: '100%' }}>
              {[
                { icon: 'lock-closed', title: 'Money Held, Not Charged', desc: '₹49 held — only charged when a referrer actually submits.' },
                { icon: 'refresh', title: 'Auto-Refund in 14 Days', desc: 'No referrer? Full automatic refund. No forms, no emails.' },
                { icon: 'close-circle', title: 'Cancel Anytime', desc: 'Changed your mind? Cancel anytime with ease.' },
              ].map((item, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1, backgroundColor: 'rgba(52,211,153,0.08)', borderRadius: 16, padding: 18,
                    borderWidth: 1, borderColor: 'rgba(52,211,153,0.15)', alignItems: 'center',
                  }}
                >
                  <Ionicons name={item.icon} size={26} color={C.emerald} style={{ marginBottom: 10 }} />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 4 }}>{item.title}</Text>
                  <Text style={{ fontSize: 12, color: C.textSub, textAlign: 'center', lineHeight: 18 }}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* ============================================ */}
        {/* TESTIMONIALS */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 36 }}>
          <View style={{ alignItems: 'center', marginBottom: 24, ...containerStyle }}>
            <Text style={{ fontSize: isLg ? 32 : 24, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              Real People. Real Results.
            </Text>
            <Text style={{ fontSize: 14, color: C.textSub, textAlign: 'center', marginTop: 8, maxWidth: 500 }}>
              From people who were exactly where you are right now.
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {TESTIMONIALS.map((item, index) => (
              <TestimonialCard key={index} item={item} index={index} C={C} />
            ))}
          </ScrollView>
        </View>

        {/* ============================================ */}
        {/* COMPANIES MARQUEE */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 28, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border }}>
          <Text style={{ textAlign: 'center', fontSize: 11, color: C.textMuted, letterSpacing: 2, marginBottom: 16, textTransform: 'uppercase' }}>
            Employees from these companies are on RefOpen
          </Text>
          <CompanyMarquee companies={COMPANIES} C={C} />
        </View>

        {/* ============================================ */}
        {/* CAREER TOOLS                                */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 40, ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View
              style={{
                backgroundColor: 'rgba(167,139,250,0.15)',
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 100,
                borderWidth: 1,
                borderColor: 'rgba(167,139,250,0.3)',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: C.violet, textTransform: 'uppercase' }}>Career Tools</Text>
            </View>
            <Text style={{ fontSize: isLg ? 36 : 28, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              9 AI-Powered Career Tools.{"\n"}One Platform.
            </Text>
            <Text style={{ fontSize: 14, color: C.textSub, textAlign: 'center', marginTop: 12, maxWidth: 520 }}>
              The most complete career toolkit — no more paying for 5 different subscriptions.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {CAREER_TOOLS.map((tool) => (
              <TouchableOpacity
                key={tool.id}
                activeOpacity={0.9}
                onPress={tool.ready ? goToResumeAnalyzer : goToApp}
                style={{
                  backgroundColor: C.bgCard, borderRadius: 16, padding: 18,
                  borderWidth: 1, borderColor: tool.ready ? 'rgba(34,211,238,0.3)' : C.border,
                  width: isLg ? '30%' : isMd ? '45%' : '100%',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <LinearGradient
                    colors={tool.gradient}
                    style={{ width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
                  >
                    <Ionicons name={tool.icon} size={20} color="#fff" />
                  </LinearGradient>
                  {tool.ready && (
                    <View
                      style={{
                        backgroundColor: tool.free ? 'rgba(34,211,238,0.15)' : 'rgba(52,211,153,0.15)',
                        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 9, fontWeight: '700', color: tool.free ? C.accent : C.emerald, letterSpacing: 0.5 }}>
                        {tool.free ? '🆓 FREE' : '✅ LIVE'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 }}>{tool.title}</Text>
                <Text style={{ fontSize: 12, color: C.textSub, lineHeight: 18 }}>{tool.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ============================================ */}
        {/* BENTO GRID - FOR REFERRERS */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 40, backgroundColor: 'rgba(16,185,129,0.03)', ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View
              style={{
                backgroundColor: 'rgba(16,185,129,0.15)',
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 100,
                borderWidth: 1,
                borderColor: 'rgba(16,185,129,0.3)',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: C.emerald, textTransform: 'uppercase' }}>For Referrers</Text>
            </View>
            <Text style={{ fontSize: isLg ? 36 : 28, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              Turn LinkedIn DMs{'\n'}Into Real Income
            </Text>
            <Text style={{ fontSize: 14, color: C.textSub, marginTop: 12, textAlign: 'center', maxWidth: 500 }}>
              Get paid for every single referral — not just when they get hired.
            </Text>
          </View>

          <View style={{ flexDirection: isLg ? 'row' : 'column', flexWrap: 'wrap' }}>
            {/* Earning card */}
            <BentoCard span={isLg ? 1.5 : 1} height={320} gradient={C.gradEmerald} C={C}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>💰</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 10 }}>Earn Per Referral</Text>
              <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 24, marginBottom: 20 }}>
                Instant rewards for every referral. Plus your company's bonus if they get hired!
              </Text>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, padding: 16 }}>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 2 }}>Top referrers earn</Text>
                <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff' }}>$3K+/month</Text>
              </View>
            </BentoCard>

            {/* How it works */}
            <BentoCard span={1} height={320} C={C}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 20 }}>How It Works</Text>
              {[
                { num: '01', title: 'Get Verified', desc: 'Connect work email' },
                { num: '02', title: 'Post Jobs', desc: 'List open positions' },
                { num: '03', title: 'Refer & Earn', desc: 'Instant rewards' },
              ].map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: C.emerald, marginRight: 14, width: 28 }}>{step.num}</Text>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{step.title}</Text>
                    <Text style={{ fontSize: 12, color: C.textMuted }}>{step.desc}</Text>
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
        <View style={{ paddingVertical: 40, ...containerStyle }}>
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View
              style={{
                backgroundColor: 'rgba(59,130,246,0.15)',
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 100,
                borderWidth: 1,
                borderColor: 'rgba(59,130,246,0.3)',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: C.accentBright, textTransform: 'uppercase' }}>For Employers</Text>
            </View>
            <Text style={{ fontSize: isLg ? 36 : 28, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1 }}>
              Hire Better, Faster
            </Text>
          </View>

          <View style={{ flexDirection: isLg ? 'row' : 'column' }}>
            {[
              { icon: 'create', title: 'Post Jobs Free', desc: 'Reach 50K+ qualified professionals instantly.', gradient: ['#3B82F6', '#2563EB'] },
              { icon: 'people', title: 'Referral Network', desc: 'Leverage your employees\' networks for better hires.', gradient: ['#8B5CF6', '#7C3AED'] },
              { icon: 'analytics', title: 'Track & Measure', desc: 'Full analytics on your hiring funnel.', gradient: ['#06B6D4', '#0891B2'] },
            ].map((item, i) => (
              <BentoCard key={i} span={1} height={220} gradient={item.gradient} C={C}>
                <Ionicons name={item.icon} size={32} color="rgba(255,255,255,0.9)" style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 6 }}>{item.title}</Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 20 }}>{item.desc}</Text>
              </BentoCard>
            ))}
          </View>
        </View>

        {/* ============================================ */}
        {/* FINAL CTA */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 48, ...containerStyle }}>
          <LinearGradient
            colors={['rgba(99,102,241,0.15)', 'rgba(34,211,238,0.08)', 'rgba(52,211,153,0.05)']}
            style={{
              borderRadius: 28,
              padding: isLg ? 48 : 28,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: C.borderGlow,
            }}
          >
            <Text style={{ fontSize: isLg ? 44 : 32, fontWeight: '800', color: C.text, textAlign: 'center', letterSpacing: -1, marginBottom: 16 }}>
              Ready to Transform{'\n'}Your Career?
            </Text>
            <Text style={{ fontSize: 16, color: C.textSub, textAlign: 'center', marginBottom: 28, maxWidth: 500 }}>
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
        <View style={{ paddingVertical: 36, borderTopWidth: 1, borderTopColor: C.border }}>
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
