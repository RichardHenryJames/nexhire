/**
 * Resume Analyzer Screen — Redesigned
 *
 * Features:
 * - Desktop: 2-panel side-by-side (40% input / 60% results)
 * - Tablet: 2-panel 50/50
 * - Mobile: Full-screen view switching (Input → Analyzing → Results)
 * - SVG animated score ring, keyword chips, expandable insights
 * - Keeps all auth/payment/wallet/API logic intact
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
  Animated,
  Modal,
  Easing,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import { useResponsive } from '../../hooks/useResponsive';
import { useAuth } from '../../contexts/AuthContext';
import { typography, spacing, borderRadius } from '../../styles/theme';
import SignInBottomSheet from '../../components/SignInBottomSheet';
import ConfirmPurchaseModal from '../../components/ConfirmPurchaseModal';
import ComplianceFooter from '../../components/ComplianceFooter';
import { usePricing } from '../../contexts/PricingContext';
import refopenAPI from '../../services/api';

// ──────────────────────────── Constants ────────────────────────────
const JOB_SOURCES = { JOB_URL: 'url', DESCRIPTION: 'description' };

const ANALYZING_STEPS = [
  { emoji: '📄', label: 'Reading your resume...' },
  { emoji: '🔍', label: 'Extracting keywords...' },
  { emoji: '📋', label: 'Comparing with job requirements...' },
  { emoji: '💡', label: 'Generating personalized insights...' },
];

const FAQ_DATA = [
  { question: 'What is the Resume Analyzer?', answer: 'The Resume Analyzer is a free AI-powered tool that compares your resume against a specific job description. It gives you a match score, highlights your strengths, flags missing keywords, and provides tips to improve your resume before applying.' },
  { question: 'Is my resume kept private?', answer: 'Absolutely. Your resume is automatically anonymized before analysis — personal details like name, email, and phone number are stripped out. The content is processed in real-time by our AI and is never stored on any server. Once the analysis is complete, the data is discarded immediately.' },
  { question: 'Is it free to use?', answer: 'Your first 2 analyses are completely free! After that, each analysis costs ₹29 from your wallet balance.' },
  { question: 'How is the match score calculated?', answer: 'The AI compares your resume against the job description and scores it from 0 to 100%. It looks at keyword alignment, relevant skills, experience match, and overall resume quality for that specific role.' },
  { question: 'What file formats are supported?', answer: 'We support PDF resumes up to 10MB. You can upload a new file or select a resume already saved to your RefOpen profile.' },
  { question: 'What job sources can I use?', answer: 'You can paste a job URL from any platform — RefOpen, LinkedIn, Indeed, Naukri, or any other site. You can also paste the job description text directly.' },
];

// ──────────────────────────── Helpers ────────────────────────────
const extractRefOpenJobId = (url) => {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('refopen.com') || urlObj.hostname.includes('refopen.io')) {
      const match = urlObj.pathname.match(/\/(?:job-details|job)\/([a-fA-F0-9-]+)/i);
      if (match?.[1]) return match[1];
    }
  } catch (e) { /* invalid URL */ }
  return null;
};

const getScoreColor = (score, colors) => {
  if (score >= 71) return colors.success;
  if (score >= 61) return '#EAB308'; // yellow
  if (score >= 41) return colors.warning;
  return colors.error;
};

const getScoreLabel = (score) => {
  if (score >= 80) return 'Excellent Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Fair Match';
  return 'Needs Improvement';
};

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

/** Parse **bold** markdown in text */
const renderBoldText = (text, baseStyle, boldStyle) => {
  if (!text || typeof text !== 'string') return <Text style={baseStyle}>{text}</Text>;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return <Text style={baseStyle}>{text}</Text>;
  return (
    <Text style={baseStyle}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={i} style={[baseStyle, { fontWeight: '700' }, boldStyle]}>{part.slice(2, -2)}</Text>;
        }
        return part;
      })}
    </Text>
  );
};

/** Get tip text whether string or structured object */
const getTipText = (tip) => (typeof tip === 'string' ? tip : tip?.text || '');
const getTipPriority = (tip) => (typeof tip === 'object' ? tip?.priority : null);
const getTipCategory = (tip) => (typeof tip === 'object' ? tip?.category : null);

// ──────────────────────────── SEO ────────────────────────────
const setSEOMetaTags = () => {
  if (Platform.OS !== 'web') return;
  document.title = 'Free Resume Analyzer - AI Resume Checker & ATS Score | RefOpen';
  const desc = 'Free AI-powered resume analyzer. Check your resume against any job description, get ATS compatibility score, find missing keywords, and get improvement tips. No sign-up required.';
  let meta = document.querySelector('meta[name="description"]');
  if (meta) { meta.setAttribute('content', desc); } else { meta = document.createElement('meta'); meta.name = 'description'; meta.content = desc; document.head.appendChild(meta); }
  let kw = document.querySelector('meta[name="keywords"]');
  if (!kw) { kw = document.createElement('meta'); kw.name = 'keywords'; document.head.appendChild(kw); }
  kw.setAttribute('content', 'resume analyzer, resume checker, ATS checker, resume score, resume feedback, job match score, resume keywords, resume tips, AI resume review, free resume analysis');
  const og = { 'og:title': 'Free Resume Analyzer - AI Resume Checker | RefOpen', 'og:description': desc, 'og:type': 'website', 'og:url': 'https://refopen.com/resume-analyzer' };
  Object.entries(og).forEach(([p, c]) => { let m = document.querySelector(`meta[property="${p}"]`); if (!m) { m = document.createElement('meta'); m.setAttribute('property', p); document.head.appendChild(m); } m.setAttribute('content', c); });
};

// ──────────────────────────── Animated Score Ring ────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ScoreRing({ score, size = 120, strokeWidth = 10, colors }) {
  const animVal = useRef(new Animated.Value(0)).current;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    animVal.setValue(0);
    Animated.timing(animVal, {
      toValue: score,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score]);

  const strokeColor = getScoreColor(score, colors);

  const strokeDashoffset = animVal.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  // For displaying the animated number
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    const id = animVal.addListener(({ value }) => setDisplayScore(Math.round(value)));
    return () => animVal.removeListener(id);
  }, [animVal]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 36, fontWeight: '800', color: strokeColor }}>{displayScore}</Text>
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: -2 }}>/ 100</Text>
      </View>
    </View>
  );
}

// ──────────────────────────── Accordion Section ────────────────────────────
function AccordionSection({ title, icon, borderColor, children, defaultOpen = false, colors }) {
  const [open, setOpen] = useState(defaultOpen);
  const rotateAnim = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    Animated.timing(rotateAnim, { toValue: open ? 0 : 1, duration: 200, useNativeDriver: true }).start();
    setOpen(!open);
  };

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={{
      borderLeftWidth: 3,
      borderLeftColor: borderColor,
      borderRadius: 12,
      backgroundColor: colors.surface,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    }}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 }}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text }}>{title}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        </Animated.View>
      </TouchableOpacity>
      {open && <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>{children}</View>}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function ResumeAnalyzerScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { width, isMobile, isTablet, isDesktop } = useResponsive();
  const styles = useMemo(() => createStyles(colors, width, isMobile, isTablet, isDesktop), [colors, width, isMobile, isTablet, isDesktop]);

  const { user, loginWithGoogle, googleAuthAvailable } = useAuth();
  const { pricing } = usePricing();
  const userId = route?.params?.userId || user?.UserID || null;

  // ── Wallet + Payment ──
  const [walletBalance, setWalletBalance] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState(null);
  const analysisCost = pricing.aiResumeAnalysisCost || 29;
  const freeUses = pricing.aiResumeFreeUses || 2;
  const [usageCount, setUsageCount] = useState(0);
  const isFreeUse = usageCount < freeUses;

  // ── Core state ──
  const [selectedFile, setSelectedFile] = useState(null);
  const [userResumes, setUserResumes] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [showAllResumes, setShowAllResumes] = useState(false);
  const [jobSource, setJobSource] = useState(JOB_SOURCES.JOB_URL);
  const [jobUrlInput, setJobUrlInput] = useState('');
  const [jobDescriptionInput, setJobDescriptionInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);

  // ── Mobile view state: 'input' | 'analyzing' | 'results' ──
  const [mobileView, setMobileView] = useState('input');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── FAQ modal ──
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  // ── Analyzing animation ──
  const [analyzingStep, setAnalyzingStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  const scrollViewRef = useRef(null);

  // ── SEO ──
  useEffect(() => { setSEOMetaTags(); }, []);

  // ── Load wallet + usage on mount ──
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [balResult, usageResult] = await Promise.all([
          refopenAPI.getWalletBalance(),
          refopenAPI.apiCall('/access/status?type=resume_analysis'),
        ]);
        if (balResult?.success) setWalletBalance(balResult.data?.availableBalance ?? balResult.data?.balance ?? 0);
        if (usageResult?.success && usageResult.data?.totalUsed !== undefined) setUsageCount(usageResult.data.totalUsed);
      } catch (e) { /* silent */ }
    })();
  }, [user]);

  // ── Analyzing step animation ──
  useEffect(() => {
    if (!isAnalyzing) { setAnalyzingStep(0); setCompletedSteps([]); return; }
    setCompletedSteps([]);
    setAnalyzingStep(0);

    // Scan line loop
    scanLineAnim.setValue(0);
    const scanLoop = Animated.loop(
      Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    scanLoop.start();

    // Step progression
    let stepIdx = 0;
    const interval = setInterval(() => {
      setCompletedSteps(prev => [...prev, stepIdx]);
      stepIdx++;
      if (stepIdx < ANALYZING_STEPS.length) {
        setAnalyzingStep(stepIdx);
      } else {
        clearInterval(interval);
      }
    }, 3000);

    return () => { clearInterval(interval); scanLoop.stop(); };
  }, [isAnalyzing]);

  // ── Mobile view transitions ──
  const transitionTo = useCallback((view) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setMobileView(view);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  // ── Load user resumes ──
  useEffect(() => {
    if (!userId) return;
    setLoadingResumes(true);
    (async () => {
      try {
        const result = await refopenAPI.getUserResumes();
        if (result?.success && result.data?.length > 0) {
          const sorted = [...result.data].sort((a, b) => {
            if (a.IsPrimary && !b.IsPrimary) return -1;
            if (!a.IsPrimary && b.IsPrimary) return 1;
            return new Date(b.UploadedAt || b.CreatedAt || 0) - new Date(a.UploadedAt || a.CreatedAt || 0);
          });
          setUserResumes(sorted);
          const top = sorted[0];
          if (top?.ResumeURL) {
            setSelectedFile({ name: top.ResumeLabel || 'Resume.pdf', size: null, resumeUrl: top.ResumeURL, resumeId: top.ResumeID, isFromProfile: true });
          }
        }
      } catch (e) { /* silent */ }
      finally { setLoadingResumes(false); }
    })();
  }, [userId]);

  // ── File picker ──
  const handleSelectFile = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.pdf,application/pdf'; input.style.display = 'none';
        document.body.appendChild(input);
        input.onchange = (e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (file.size > 10 * 1024 * 1024) { setError('File too large. Maximum size is 10MB.'); document.body.removeChild(input); return; }
            if (!file.type.includes('pdf')) { setError('Please select a PDF file.'); document.body.removeChild(input); return; }
            setSelectedFile({ name: file.name, size: file.size, file });
            setError(null); setAnalysisResult(null);
          }
          document.body.removeChild(input);
        };
        input.click();
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true, multiple: false });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        if (file.size > 10 * 1024 * 1024) { setError('File too large. Maximum size is 10MB.'); return; }
        setSelectedFile({ name: file.name, size: file.size, uri: file.uri, mimeType: file.mimeType });
        setError(null); setAnalysisResult(null);
      }
    } catch (err) { setError('Failed to select file. Please try again.'); }
  };

  const handleSelectProfileResume = (resume) => {
    setSelectedFile({ name: resume.ResumeLabel || 'Resume.pdf', size: null, resumeUrl: resume.ResumeURL, resumeId: resume.ResumeID, isFromProfile: true });
    setError(null); setAnalysisResult(null);
  };

  // ── Handle Google Sign-In ──
  const handleGoogleSignIn = async () => {
    try {
      const result = await loginWithGoogle({ skipRedirect: true });
      return result;
    } catch (err) { /* handled by auth context */ }
  };

  // ── Analyze ──
  const handleAnalyze = async () => {
    if (!user) { navigation.navigate('Auth', { screen: 'Login', params: { returnTo: 'ResumeAnalyzer', returnParams: route?.params } }); return; }
    if (!selectedFile) { setError('Please select a resume PDF first.'); return; }

    let jobData = {};
    if (jobSource === JOB_SOURCES.JOB_URL) {
      if (!jobUrlInput.trim()) { setError('Please enter a job URL.'); return; }
      const url = jobUrlInput.trim();
      const refOpenJobId = extractRefOpenJobId(url);
      if (refOpenJobId) { jobData.jobId = refOpenJobId; } else { jobData.jobUrl = url; }
    } else {
      if (!jobDescriptionInput.trim()) { setError('Please enter a job description.'); return; }
      jobData.jobDescription = jobDescriptionInput.trim();
    }
    if (userId) jobData.userId = userId;

    if (!isFreeUse) {
      try { const b = await refopenAPI.getWalletBalance(); if (b?.success) setWalletBalance(b.data?.availableBalance ?? b.data?.balance ?? 0); } catch (e) { /* use cached */ }
      setPendingAnalysis({ fileData: selectedFile, jobData });
      setShowConfirmModal(true);
      return;
    }
    await executeAnalysis(selectedFile, jobData);
  };

  const executeAnalysis = async (fileData, jobData) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    if (isMobile) transitionTo('analyzing');

    try {
      const result = await refopenAPI.analyzeResume(fileData, jobData);
      if (result.success) {
        setAnalysisResult(result.data);
        if (result.usageInfo) setUsageCount(result.usageInfo.totalUsed);
        if (isMobile) transitionTo('results');
      } else if (result.requiresPayment) {
        setError(`Free analyses used up. Each analysis now costs ₹${result.cost || 29}. Please recharge your wallet.`);
        if (isMobile) transitionTo('input');
        setTimeout(() => navigation.navigate('WalletRecharge'), 1500);
      } else if (result.error?.includes('Authentication') || result.error?.includes('sign in') || result.error?.includes('Unauthorized')) {
        navigation.navigate('Auth', { screen: 'Login', params: { returnTo: 'ResumeAnalyzer', returnParams: route?.params } });
      } else {
        setError(result.error || 'Analysis failed. Please try again.');
        if (isMobile) transitionTo('input');
      }
    } catch (err) {
      setError(err.message || 'Failed to analyze resume. Please try again.');
      if (isMobile) transitionTo('input');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeAnother = () => {
    setAnalysisResult(null);
    setError(null);
    if (isMobile) transitionTo('input');
  };

  const canAnalyze = selectedFile && (jobSource === JOB_SOURCES.JOB_URL ? jobUrlInput.trim() : jobDescriptionInput.trim());

  // ════════════════════════════════════════════════════════════
  //  RENDER SECTIONS
  // ════════════════════════════════════════════════════════════

  // ── Hero / Value Proposition Card ──
  const renderHeroCard = () => (
    <View style={styles.heroCard}>
      <View style={styles.heroIconWrap}>
        <Ionicons name="analytics-outline" size={40} color={colors.primary + '70'} />
        <View style={{ position: 'absolute', bottom: -2, right: -2 }}>
          <Ionicons name="sparkles" size={20} color={colors.warning || '#F59E0B'} />
        </View>
      </View>
      <Text style={styles.heroTitle}>AI Resume Analyzer</Text>
      <Text style={[styles.bodyText, { textAlign: 'center', maxWidth: 400, marginTop: 6, lineHeight: 22 }]}>
        See how well your resume matches any job. Get a match score, missing keywords, and actionable tips — in under 15 seconds.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 }}>
        {[
          { icon: 'speedometer-outline', label: 'Match Score' },
          { icon: 'key-outline', label: 'Keyword Gap' },
          { icon: 'bulb-outline', label: 'Smart Tips' },
          { icon: 'shield-checkmark-outline', label: 'ATS Check' },
        ].map((f, i) => (
          <View key={i} style={styles.heroChip}>
            <Ionicons name={f.icon} size={14} color={colors.primary} />
            <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>{f.label}</Text>
          </View>
        ))}
      </View>
      {/* Privacy callout */}
      <View style={styles.privacyBanner}>
        <Ionicons name="lock-closed" size={16} color={colors.success} />
        <Text style={{ flex: 1, marginLeft: 8, fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
          <Text style={{ fontWeight: '700', color: colors.success }}>Privacy first</Text> — your resume is anonymized before analysis. The AI never sees your name, email, or phone.
        </Text>
      </View>
      <View style={styles.heroStatsRow}>
        {[
          { value: '50K+', label: 'Resumes Analyzed' },
          { value: '🔒', label: 'Zero Data Stored' },
        ].map((stat, i) => (
          <View key={i} style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{stat.value}</Text>
            <Text style={styles.heroStatLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // ── Resume picker ──
  const renderResumePicker = () => {
    if (loadingResumes) {
      return (
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.bodyText, { marginTop: 8 }]}>Loading your resumes...</Text>
        </View>
      );
    }

    const visibleResumes = showAllResumes ? userResumes : userResumes.slice(0, 3);

    return (
      <View>
        {/* Profile resumes */}
        {userResumes.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            {visibleResumes.map((resume) => {
              const isSelected = selectedFile?.resumeId === resume.ResumeID;
              return (
                <TouchableOpacity
                  key={resume.ResumeID}
                  style={[styles.resumeCard, isSelected && styles.resumeCardSelected]}
                  onPress={() => handleSelectProfileResume(resume)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="document-text" size={20} color={isSelected ? colors.primary : colors.textSecondary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.bodyTextBold, isSelected && { color: colors.primary }]} numberOfLines={1}>
                      {resume.ResumeLabel || 'Resume.pdf'}
                    </Text>
                    <Text style={styles.captionText}>
                      {resume.IsPrimary ? 'Primary • ' : ''}{resume.UploadedAt ? new Date(resume.UploadedAt).toLocaleDateString() : ''}
                    </Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
            {userResumes.length > 3 && !showAllResumes && (
              <TouchableOpacity onPress={() => setShowAllResumes(true)} style={{ paddingVertical: 6 }}>
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600', textAlign: 'center' }}>
                  Show all ({userResumes.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Upload button or selected file */}
        {selectedFile && !selectedFile.isFromProfile ? (
          <View style={[styles.card, styles.selectedFileCard]}>
            <Ionicons name="document" size={22} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.bodyTextBold} numberOfLines={1}>{selectedFile.name}</Text>
              <Text style={styles.captionText}>{formatFileSize(selectedFile.size)}</Text>
            </View>
            <TouchableOpacity onPress={() => { setSelectedFile(null); setAnalysisResult(null); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={22} color={colors.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadCard} onPress={handleSelectFile} activeOpacity={0.7}>
            <Ionicons name="cloud-upload-outline" size={28} color={colors.textSecondary} />
            <Text style={[styles.bodyText, { marginTop: 4 }]}>Upload PDF</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Job source toggle (segmented control) ──
  const renderJobSourceToggle = () => (
    <View style={styles.segmentedControl}>
      {[
        { key: JOB_SOURCES.JOB_URL, label: 'Job URL' },
        { key: JOB_SOURCES.DESCRIPTION, label: 'Paste Description' },
      ].map((seg) => (
        <TouchableOpacity
          key={seg.key}
          style={[styles.segment, jobSource === seg.key && styles.segmentActive]}
          onPress={() => setJobSource(seg.key)}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, jobSource === seg.key && styles.segmentTextActive]}>
            {seg.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Input section ──
  const renderInputSection = () => (
    <View style={styles.inputSection}>
      <Text style={styles.sectionTitle}>Resume</Text>
      {renderResumePicker()}

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Job Details</Text>
      {renderJobSourceToggle()}

      {jobSource === JOB_SOURCES.JOB_URL ? (
        <TextInput
          style={styles.textInput}
          placeholder="Paste job URL (RefOpen, Indeed, LinkedIn, etc.)"
          placeholderTextColor={colors.textSecondary}
          value={jobUrlInput}
          onChangeText={setJobUrlInput}
          autoCapitalize="none"
          keyboardType="url"
        />
      ) : (
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="Paste job description here..."
          placeholderTextColor={colors.textSecondary}
          value={jobDescriptionInput}
          onChangeText={setJobDescriptionInput}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          scrollEnabled
          blurOnSubmit={false}
        />
      )}

      {/* Error */}
      {error && !isAnalyzing && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Analyze Button */}
      <TouchableOpacity onPress={handleAnalyze} disabled={!canAnalyze || isAnalyzing} activeOpacity={0.85}>
        <LinearGradient
          colors={(!canAnalyze || isAnalyzing) ? [colors.border, colors.border] : [colors.primary, colors.primaryDark || colors.primary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.analyzeBtn}
        >
          {isAnalyzing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={{ fontSize: 16 }}>✨</Text>
              <Text style={styles.analyzeBtnText}>
                {!user ? 'Analyze Resume' : !isFreeUse ? `Analyze Resume (₹${costPerUse})` : 'Analyze Resume'}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // ── Analyzing overlay ──
  const renderAnalyzingOverlay = () => (
    <View style={styles.analyzingOverlay}>
      {/* Document icon with scan line */}
      <View style={styles.scanContainer}>
        <Ionicons name="document-text" size={64} color={colors.primary} />
        <Animated.View
          style={[styles.scanLine, {
            backgroundColor: colors.primary,
            transform: [{
              translateY: scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 30] }),
            }],
          }]}
        />
      </View>

      {/* Step checklist */}
      <View style={{ marginTop: 32, width: '100%', maxWidth: 300 }}>
        {ANALYZING_STEPS.map((step, idx) => {
          const isDone = completedSteps.includes(idx);
          const isCurrent = analyzingStep === idx && !isDone;
          return (
            <Animated.View key={idx} style={[styles.stepRow, { opacity: idx <= analyzingStep ? 1 : 0.3 }]}>
              {isDone ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              ) : isCurrent ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border }} />
              )}
              <Text style={[styles.stepText, isDone && { color: colors.success }]}>
                {step.emoji} {step.label}
              </Text>
            </Animated.View>
          );
        })}
      </View>

      <Text style={[styles.captionText, { marginTop: 24 }]}>This usually takes 10-15 seconds</Text>
    </View>
  );

  // ── Results section ──
  const renderResults = () => {
    if (!analysisResult) return null;
    const r = analysisResult;

    return (
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: isMobile ? 80 : 24 }}>
        {/* Score card */}
        <View style={[styles.card, styles.scoreCard]}>
          <ScoreRing score={r.matchScore} size={isMobile ? 100 : 120} strokeWidth={10} colors={colors} />
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={styles.scoreLabel}>Match Score</Text>
            <Text style={[styles.captionText, { textAlign: 'center', marginTop: 4 }]}>
              {r.overallAssessment?.split('.').slice(0, 1).join('.') || getScoreLabel(r.matchScore)}
            </Text>
            {r.jobTitle && (
              <Text style={[styles.captionText, { marginTop: 4 }]} numberOfLines={1}>
                {r.jobTitle}{r.companyName ? ` at ${r.companyName}` : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Category scores 2×2 */}
        <View style={styles.categoryGrid}>
          {[
            { label: 'Skills', value: r.categoryScores?.skills || 0 },
            { label: 'Experience', value: r.categoryScores?.experience || 0 },
            { label: 'Education', value: r.categoryScores?.education || 0 },
            { label: 'Keywords', value: r.categoryScores?.keywords || 0 },
          ].map((cat, idx) => (
            <View key={idx} style={styles.categoryCell}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.bodySm}>{cat.label}</Text>
                <Text style={[styles.bodySm, { fontWeight: '700', color: getScoreColor(cat.value, colors) }]}>{cat.value}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${cat.value}%`, backgroundColor: getScoreColor(cat.value, colors) }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Keywords */}
        {(r.matchedKeywords?.length > 0 || r.missingKeywords?.length > 0) && (
          <View style={[styles.card, { padding: 14, marginBottom: 12 }]}>
            <Text style={styles.sectionTitle}>Keywords Analysis</Text>
            {r.matchedKeywords?.length > 0 && (
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.captionText, { marginBottom: 6 }]}>Matched ✓</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {r.matchedKeywords.map((kw, i) => (
                      <View key={i} style={[styles.chip, styles.chipGreen]}>
                        <Text style={[styles.chipText, { color: colors.success }]}>{kw}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
            {r.missingKeywords?.length > 0 && (
              <View>
                <Text style={[styles.captionText, { marginBottom: 6 }]}>Missing ✗</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {r.missingKeywords.map((kw, i) => (
                      <View key={i} style={[styles.chip, styles.chipRed]}>
                        <Text style={[styles.chipText, { color: colors.error }]}>{kw}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Insights accordions */}
        {r.strengths?.length > 0 && (
          <AccordionSection title="Strengths" icon="✅" borderColor={colors.success} defaultOpen colors={colors}>
            {r.strengths.map((s, i) => (
              <View key={i} style={styles.insightItem}>
                <View style={[styles.bulletDot, { backgroundColor: colors.success }]} />
                {renderBoldText(s, styles.insightText)}
              </View>
            ))}
          </AccordionSection>
        )}

        {r.weaknesses?.length > 0 && (
          <AccordionSection title="Areas to Improve" icon="⚠️" borderColor={colors.warning} colors={colors}>
            {r.weaknesses.map((w, i) => (
              <View key={i} style={styles.insightItem}>
                <View style={[styles.bulletDot, { backgroundColor: colors.warning }]} />
                {renderBoldText(w, styles.insightText)}
              </View>
            ))}
          </AccordionSection>
        )}

        {r.tips?.length > 0 && (
          <AccordionSection title="Actionable Tips" icon="💡" borderColor={colors.primary} defaultOpen colors={colors}>
            {r.tips.map((tip, i) => {
              const text = getTipText(tip);
              const priority = getTipPriority(tip);
              const category = getTipCategory(tip);
              const priorityConfig = { high: { dot: '#EF4444', label: 'High' }, medium: { dot: '#EAB308', label: 'Medium' }, low: { dot: '#22C55E', label: 'Low' } };
              const pc = priority ? priorityConfig[priority] : null;

              return (
                <View key={i} style={styles.tipCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    {pc && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: pc.dot }} />
                        <Text style={{ fontSize: 11, color: pc.dot, fontWeight: '600' }}>{pc.label}</Text>
                      </View>
                    )}
                    {category && (
                      <View style={styles.categoryTag}>
                        <Text style={styles.categoryTagText}>{category}</Text>
                      </View>
                    )}
                  </View>
                  {renderBoldText(text, styles.insightText)}
                </View>
              );
            })}
          </AccordionSection>
        )}

        {/* Resume Quality stats */}
        {(r.achievementMetrics || r.weakVerbs?.length > 0) && (
          <View style={styles.qualityRow}>
            {r.achievementMetrics && r.achievementMetrics.totalBullets > 0 && (
              <View style={[styles.card, styles.qualityCard]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Text style={{ fontSize: 16 }}>📊</Text>
                  <Text style={styles.bodyTextBold}>Achievement Metrics</Text>
                </View>
                <Text style={styles.bodyText}>
                  {r.achievementMetrics.bulletsWithMetrics}/{r.achievementMetrics.totalBullets} bullets have metrics
                </Text>
                <View style={[styles.progressBarBg, { marginTop: 8 }]}>
                  <View style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.round((r.achievementMetrics.bulletsWithMetrics / r.achievementMetrics.totalBullets) * 100)}%`,
                      backgroundColor: getScoreColor(Math.round((r.achievementMetrics.bulletsWithMetrics / r.achievementMetrics.totalBullets) * 100), colors),
                    },
                  ]} />
                </View>
              </View>
            )}
            {r.weakVerbs?.length > 0 && (
              <View style={[styles.card, styles.qualityCard]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Text style={{ fontSize: 16 }}>✏️</Text>
                  <Text style={styles.bodyTextBold}>Action Verbs</Text>
                </View>
                <Text style={styles.bodyText}>{r.weakVerbs.length} weak verb{r.weakVerbs.length > 1 ? 's' : ''} found</Text>
                <View style={[styles.chipRow, { marginTop: 6 }]}>
                  {r.weakVerbs.map((v, i) => (
                    <View key={i} style={[styles.chip, styles.chipRed]}>
                      <Text style={[styles.chipText, { color: colors.error }]}>{v}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Bottom action (desktop/tablet) */}
        {!isMobile && (
          <TouchableOpacity style={styles.outlineBtn} onPress={handleAnalyzeAnother} activeOpacity={0.7}>
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={styles.outlineBtnText}>Analyze Another Resume</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  // ── Placeholder for right panel (desktop) ──
  const renderPlaceholder = () => (
    <View style={styles.placeholderContainer}>
      <View style={styles.placeholderIconWrap}>
        <Ionicons name="document-text-outline" size={48} color={colors.primary + '60'} />
        <View style={{ position: 'absolute', bottom: -4, right: -4 }}>
          <Ionicons name="sparkles" size={24} color={colors.warning} />
        </View>
      </View>
      <Text style={[styles.sectionTitle, { textAlign: 'center', marginTop: 20 }]}>AI Resume Insights</Text>
      <Text style={[styles.bodyText, { textAlign: 'center', maxWidth: 340, marginTop: 8, lineHeight: 22 }]}>
        Upload your resume and paste a job description to get AI-powered insights — match score, missing keywords, and actionable tips.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 20 }}>
        {[
          { icon: 'speedometer-outline', label: 'Match Score' },
          { icon: 'key-outline', label: 'Keywords' },
          { icon: 'bulb-outline', label: 'Tips' },
          { icon: 'shield-checkmark-outline', label: 'ATS Check' },
        ].map((f, i) => (
          <View key={i} style={styles.placeholderChip}>
            <Ionicons name={f.icon} size={14} color={colors.primary} />
            <Text style={[styles.captionText, { color: colors.primary }]}>{f.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // ── FAQ Modal ──
  const renderFaqModal = () => (
    <Modal visible={showFaqModal} transparent animationType="fade" onRequestClose={() => setShowFaqModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.card, styles.faqModalContent]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Frequently Asked Questions</Text>
            <TouchableOpacity onPress={() => setShowFaqModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
            {FAQ_DATA.map((faq, idx) => (
              <TouchableOpacity key={idx} onPress={() => setExpandedFaq(expandedFaq === idx ? null : idx)} activeOpacity={0.7}
                style={{ borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: colors.border, paddingVertical: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.bodyTextBold, { flex: 1, marginRight: 8 }]}>{faq.question}</Text>
                  <Ionicons name={expandedFaq === idx ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
                </View>
                {expandedFaq === idx && <Text style={[styles.bodyText, { marginTop: 8, lineHeight: 22 }]}>{faq.answer}</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ════════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <ScreenWrapper withKeyboard>
      <View style={styles.container}>
        <SubScreenHeader
          title="Resume Analyzer"
          fallbackTab="Services"
          rightContent={
            <TouchableOpacity onPress={() => setShowFaqModal(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="information-circle-outline" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          }
        />

        {/* ─── DESKTOP / TABLET: Side-by-side ─── */}
        {!isMobile ? (
          <ScrollView ref={scrollViewRef} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
            {/* Hero card above side-by-side */}
            <View style={{ maxWidth: 1400, alignSelf: 'center', width: '100%', paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
              {renderHeroCard()}
            </View>
            <View style={styles.sideBySide}>
              {/* Left panel */}
              <View style={styles.leftPanel}>
                {renderInputSection()}
              </View>
              {/* Right panel */}
              <View style={styles.rightPanel}>
                {isAnalyzing ? (
                  renderAnalyzingOverlay()
                ) : analysisResult ? (
                  renderResults()
                ) : (
                  renderPlaceholder()
                )}
              </View>
            </View>
            <View style={{ maxWidth: 900, alignSelf: 'center', width: '100%', paddingHorizontal: 24 }}>
              <ComplianceFooter navigation={navigation} currentPage="Resume Analyzer" />
            </View>
          </ScrollView>
        ) : (
          /* ─── MOBILE: View switching ─── */
          <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
            {mobileView === 'input' && (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
                {renderHeroCard()}
                {renderInputSection()}
                <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.textSecondary} />
                  <Text style={styles.captionText}>Resume is anonymized. Data is never stored.</Text>
                </View>
              </ScrollView>
            )}
            {mobileView === 'analyzing' && renderAnalyzingOverlay()}
            {mobileView === 'results' && (
              <View style={{ flex: 1 }}>
                {/* Floating "Analyze Another" pill */}
                <TouchableOpacity style={styles.floatingPill} onPress={handleAnalyzeAnother} activeOpacity={0.85}>
                  <Ionicons name="arrow-back" size={16} color="#fff" />
                  <Text style={styles.floatingPillText}>Analyze Another</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, paddingHorizontal: 16 }}>
                  {renderResults()}
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Sign-in bottom sheet */}
        <SignInBottomSheet
          title="Sign in for a better experience"
          subtitle="Track analysis history and get personalized recommendations"
          delayMs={3000}
        />

        {/* Confirm purchase modal */}
        <ConfirmPurchaseModal
          visible={showConfirmModal}
          currentBalance={walletBalance}
          requiredAmount={analysisCost}
          contextType="generic"
          itemName="Resume Analysis"
          onProceed={async () => {
            setShowConfirmModal(false);
            if (pendingAnalysis) {
              await executeAnalysis(pendingAnalysis.fileData, pendingAnalysis.jobData);
              setPendingAnalysis(null);
            }
          }}
          onAddMoney={() => { setShowConfirmModal(false); navigation.navigate('WalletRecharge'); }}
          onCancel={() => { setShowConfirmModal(false); setPendingAnalysis(null); }}
        />

        {/* FAQ Modal */}
        {renderFaqModal()}
      </View>
    </ScreenWrapper>
  );
}

// ══════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════
const createStyles = (colors, width, isMobile, isTablet, isDesktop) =>
  StyleSheet.create({
    // ── Layout ──
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    sideBySide: {
      flexDirection: 'row',
      padding: spacing.lg,
      gap: spacing.lg,
      maxWidth: 1400,
      alignSelf: 'center',
      width: '100%',
      minHeight: 600,
    },
    leftPanel: {
      flex: isTablet ? 0.5 : 0.4,
      minWidth: isDesktop ? 380 : undefined,
      maxWidth: isDesktop ? 480 : undefined,
    },
    rightPanel: {
      flex: isTablet ? 0.5 : 0.6,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        web: { boxShadow: '0 2px 12px rgba(0,0,0,0.05)' },
        default: { elevation: 2 },
      }),
    },

    // ── Input Section ──
    inputSection: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: isMobile ? 16 : 20,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        web: isDesktop || isTablet ? { boxShadow: '0 2px 12px rgba(0,0,0,0.05)' } : {},
        default: { elevation: 2 },
      }),
    },

    // ── Cards ──
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    resumeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 8,
    },
    resumeCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '08',
    },
    selectedFileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderColor: colors.primary,
      backgroundColor: colors.primary + '08',
    },
    uploadCard: {
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },

    // ── Segmented Control ──
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 999,
      padding: 3,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: {
      backgroundColor: colors.primary,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    segmentTextActive: {
      color: '#fff',
    },

    // ── Text Input ──
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
    },
    textArea: {
      minHeight: isDesktop ? 130 : 100,
      maxHeight: 200,
      textAlignVertical: 'top',
      ...(Platform.OS === 'web' && { overflow: 'auto' }),
    },

    // ── Analyze Button ──
    analyzeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 14,
      gap: 6,
      marginTop: 16,
    },
    analyzeBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
      letterSpacing: 0.3,
    },

    // ── Floating pill (mobile results) ──
    floatingPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 999,
      marginTop: 8,
      marginBottom: 8,
      gap: 6,
      ...Platform.select({
        web: { boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
        default: { elevation: 6 },
      }),
    },
    floatingPillText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },

    // ── Analyzing Overlay ──
    analyzingOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      ...(isMobile && {
        backgroundColor: colors.background,
      }),
    },
    scanContainer: {
      width: 80,
      height: 80,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    scanLine: {
      position: 'absolute',
      left: 8,
      right: 8,
      height: 2,
      borderRadius: 1,
      opacity: 0.6,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    stepText: {
      fontSize: 14,
      color: colors.text,
    },

    // ── Score Card ──
    scoreCard: {
      alignItems: 'center',
      paddingVertical: 20,
      marginBottom: 12,
    },
    scoreLabel: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },

    // ── Category Grid ──
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 12,
    },
    categoryCell: {
      width: '48%',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    progressBarBg: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: 6,
      borderRadius: 3,
    },

    // ── Keyword Chips ──
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 12,
      height: 24,
      justifyContent: 'center',
      maxWidth: '100%',
    },
    chipGreen: {
      backgroundColor: colors.success + '18',
    },
    chipRed: {
      backgroundColor: colors.error + '15',
      borderWidth: 1,
      borderColor: colors.error + '30',
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
    },

    // ── Insights ──
    insightItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    bulletDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 6,
      marginRight: 8,
    },
    insightText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },

    // ── Tips ──
    tipCard: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryTag: {
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    categoryTagText: {
      fontSize: 10,
      color: colors.primary,
      fontWeight: '600',
    },

    // ── Quality Row ──
    qualityRow: {
      flexDirection: isMobile ? 'column' : 'row',
      gap: 10,
      marginBottom: 12,
    },
    qualityCard: {
      flex: isMobile ? undefined : 1,
      width: isMobile ? '100%' : undefined,
      padding: 14,
    },

    // ── Placeholder ──
    placeholderContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    placeholderIconWrap: {
      width: 80,
      height: 80,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholderChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary + '10',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
    },

    // ── Hero Card ──
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: isMobile ? 20 : 24,
      alignItems: 'center',
      marginBottom: isMobile ? 16 : 0,
      ...Platform.select({
        web: { boxShadow: '0 2px 12px rgba(0,0,0,0.05)' },
        default: { elevation: 2 },
      }),
    },
    heroIconWrap: {
      width: 72,
      height: 72,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTitle: {
      fontSize: isMobile ? 20 : 22,
      fontWeight: '800',
      color: colors.text,
      marginTop: 12,
    },
    heroChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary + '10',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    heroStatsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: isMobile ? 16 : 32,
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      width: '100%',
    },
    heroStat: {
      alignItems: 'center',
    },
    heroStatValue: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.primary,
    },
    heroStatLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    privacyBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.success + '10',
      borderWidth: 1,
      borderColor: colors.success + '25',
      borderRadius: 12,
      padding: 12,
      marginTop: 16,
      width: '100%',
      maxWidth: 420,
    },

    // ── Outline Button ──
    outlineBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.primary,
      marginTop: 8,
      gap: 6,
    },
    outlineBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },

    // ── Error ──
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.error + '12',
      padding: 10,
      borderRadius: 10,
      marginTop: 10,
      gap: 6,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: colors.error,
    },

    // ── FAQ Modal ──
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    faqModalContent: {
      width: '100%',
      maxWidth: 560,
      maxHeight: '80%',
      padding: 20,
    },

    // ── Typography ──
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    bodyText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    bodyTextBold: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    bodySm: {
      fontSize: 13,
      color: colors.text,
    },
    captionText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
