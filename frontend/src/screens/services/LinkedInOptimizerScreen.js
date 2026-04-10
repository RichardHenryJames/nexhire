/**
 * LinkedIn Profile Optimizer Screen
 * 
 * Hybrid approach:
 * - Quick Mode: Paste headline + about + role + skills (instant)
 * - Full Audit: Upload LinkedIn "Save to PDF" for comprehensive analysis
 * 
 * Desktop: 2-panel (input left / results right)
 * Mobile: Single column with view switching
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import SubScreenHeader from '../../components/SubScreenHeader';
import { useTheme } from '../../contexts/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useAuth } from '../../contexts/AuthContext';
import { usePricing } from '../../contexts/PricingContext';
import SignInBottomSheet from '../../components/SignInBottomSheet';
import ConfirmPurchaseModal from '../../components/ConfirmPurchaseModal';
import refopenAPI from '../../services/api';

// ── Constants ──────────────────────────────────────────────────
const ANALYZING_STEPS = [
  { emoji: '🔍', label: 'Reading your profile...' },
  { emoji: '📊', label: 'Scoring each section...' },
  { emoji: '✍️', label: 'Writing optimized versions...' },
  { emoji: '🚀', label: 'Generating action plan...' },
];

const SECTIONS = [
  { key: 'headline', icon: 'text-outline', label: 'Headline', color: '#8B5CF6' },
  { key: 'about', icon: 'document-text-outline', label: 'About', color: '#3B82F6' },
  { key: 'experience', icon: 'briefcase-outline', label: 'Experience', color: '#10B981' },
  { key: 'skills', icon: 'code-slash-outline', label: 'Skills', color: '#F59E0B' },
];

const getScoreColor = (score) => {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#F97316';
  return '#EF4444';
};

const getScoreLabel = (score) => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Work';
  return 'Major Overhaul';
};

// ── Score Ring SVG ─────────────────────────────────────────────
const ScoreRing = ({ score, size = 120, strokeWidth = 10, colors }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const scoreColor = getScoreColor(score);

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size/2} cy={size/2} r={radius} stroke={colors.border} strokeWidth={strokeWidth} fill="none" />
        <Circle cx={size/2} cy={size/2} r={radius} stroke={scoreColor} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeDashoffset={circumference / 4} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: size * 0.28, fontWeight: '800', color: scoreColor }}>{score}</Text>
        <Text style={{ fontSize: size * 0.1, color: colors.textSecondary, fontWeight: '600' }}>/100</Text>
      </View>
    </View>
  );
};

// ── Main Component ─────────────────────────────────────────────
export default function LinkedInOptimizerScreen({ navigation }) {
  const { colors } = useTheme();
  const { isDesktop } = useResponsive();
  const { user, isAuthenticated } = useAuth();
  const { pricing } = usePricing();

  // State
  const [mode, setMode] = useState('quick');
  const [view, setView] = useState('input');

  // Quick mode fields
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [skills, setSkills] = useState('');
  const [targetRole, setTargetRole] = useState('');

  // Full audit
  const [pdfFile, setPdfFile] = useState(null);

  // Results
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [copied, setCopied] = useState('');
  const [expandedSection, setExpandedSection] = useState(null);

  // Wallet + usage tracking
  const [walletBalance, setWalletBalance] = useState(0);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [usageInfo, setUsageInfo] = useState(null);
  const [usageCount, setUsageCount] = useState(0);
  const [optimizerCost, setOptimizerCost] = useState(29);
  const [freeUses, setFreeUses] = useState(1);
  const isFreeUse = usageCount < freeUses;

  // Animations
  const stepAnim = useRef(new Animated.Value(0)).current;

  // Load wallet + usage on mount (same pattern as ResumeAnalyzer)
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const [balResult, usageResult] = await Promise.all([
          refopenAPI.getWalletBalance(),
          refopenAPI.apiCall('/access/status?type=linkedin_optimization'),
        ]);
        if (balResult?.success) setWalletBalance(balResult.data?.availableBalance ?? balResult.data?.balance ?? 0);
        if (usageResult?.success && usageResult.data) {
          const d = usageResult.data;
          if (d.totalUsed !== undefined) setUsageCount(d.totalUsed);
          if (d.freeUses !== undefined) setFreeUses(d.freeUses);
          if (d.cost !== undefined) setOptimizerCost(d.cost);
        }
      } catch (e) { /* silent */ }
    })();
  }, [isAuthenticated]);

  // Analyzing animation
  useEffect(() => {
    if (!analyzing) return;
    const interval = setInterval(() => {
      setAnalyzeStep(prev => {
        const next = (prev + 1) % ANALYZING_STEPS.length;
        Animated.sequence([
          Animated.timing(stepAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
          Animated.timing(stepAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
        return next;
      });
    }, 3000);
    Animated.timing(stepAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    return () => clearInterval(interval);
  }, [analyzing]);

  // Pick PDF
  const pickPDF = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (!res.canceled && res.assets?.[0]) {
        setPdfFile(res.assets[0]);
        setError('');
      }
    } catch (err) {
      setError('Failed to pick file. Please try again.');
    }
  }, []);

  // Submit
  const handleAnalyze = useCallback(async () => {
    if (!isAuthenticated) { setShowSignIn(true); return; }

    if (mode === 'quick') {
      if (!headline.trim() && !about.trim() && !currentRole.trim() && !skills.trim()) {
        setError('Please fill in at least one field to analyze.');
        return;
      }
    } else if (!pdfFile) {
      setError('Please upload your LinkedIn PDF first.');
      return;
    }

    // Pre-check: if free tier exhausted, show purchase modal first (same as ResumeAnalyzer)
    if (!isFreeUse) {
      try {
        const b = await refopenAPI.getWalletBalance();
        if (b?.success) setWalletBalance(b.data?.availableBalance ?? b.data?.balance ?? 0);
      } catch (e) { /* use cached */ }
      setShowPurchase(true);
      return;
    }

    await executeOptimization();
  }, [mode, headline, about, currentRole, skills, pdfFile, isAuthenticated, isFreeUse]);

  // Actual optimization call (called directly for free tier, or after purchase confirmation)
  const executeOptimization = useCallback(async () => {
    setError('');
    setAnalyzing(true);
    setAnalyzeStep(0);
    setView('analyzing');

    try {
      let response;

      if (mode === 'full' && pdfFile) {
        const formData = new FormData();
        if (Platform.OS === 'web') {
          const blob = await fetch(pdfFile.uri).then(r => r.blob());
          formData.append('pdf', blob, pdfFile.name);
        } else {
          formData.append('pdf', { uri: pdfFile.uri, name: pdfFile.name, type: 'application/pdf' });
        }
        if (targetRole.trim()) formData.append('targetRole', targetRole.trim());

        const token = await refopenAPI.getToken('refopen_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${refopenAPI.baseURL}/tools/linkedin-optimizer`, {
          method: 'POST',
          headers,
          body: formData,
        });
        response = await res.json();
      } else {
        response = await refopenAPI.apiCall('/tools/linkedin-optimizer', {
          method: 'POST',
          body: JSON.stringify({
            headline: headline.trim(),
            about: about.trim(),
            currentRole: currentRole.trim(),
            currentCompany: currentCompany.trim(),
            skills: skills.trim(),
            targetRole: targetRole.trim(),
          }),
        });
      }

      if (response?.success) {
        setResult(response.data);
        setUsageInfo(response.usageInfo);
        if (response.usageInfo?.totalUsed !== undefined) setUsageCount(response.usageInfo.totalUsed);
        // Refresh wallet after paid analysis
        if (response.usageInfo?.wasFree === false) {
          refopenAPI.getWalletBalance().then(r => { if (r?.success) setWalletBalance(r.data?.availableBalance ?? r.data?.balance ?? 0); }).catch(() => {});
        }
        setView('results');
        setExpandedSection('headline');
      } else if (response?.requiresPayment) {
        setShowPurchase(true);
        setView('input');
        return;
      } else {
        setError(response?.error || 'Analysis failed. Please try again.');
        setView('input');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setView('input');
    } finally {
      setAnalyzing(false);
    }
  }, [mode, headline, about, currentRole, currentCompany, skills, targetRole, pdfFile, isAuthenticated]);

  // Copy
  const copyText = useCallback(async (text, label) => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
      } else {
        const Clipboard = require('expo-clipboard');
        await Clipboard.setStringAsync(text);
      }
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } catch (e) { /* silent */ }
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setView('input');
    setError('');
    setExpandedSection(null);
    setPdfFile(null);
  }, []);

  const s = useMemo(() => makeStyles(colors, isDesktop), [colors, isDesktop]);
  const costPerUse = optimizerCost;
  const freeRemaining = Math.max(0, freeUses - usageCount);

  // ── Section Card ─────────────────────────────────────────
  const renderSectionCard = (section, data) => {
    const isExpanded = expandedSection === section.key;
    const scoreColor = getScoreColor(data.score);

    return (
      <View key={section.key} style={[s.sectionCard, isExpanded && { borderColor: section.color + '40' }]}>
        <TouchableOpacity style={s.sectionHeader} onPress={() => setExpandedSection(isExpanded ? null : section.key)} activeOpacity={0.7}>
          <View style={[s.sectionIcon, { backgroundColor: section.color + '15' }]}>
            <Ionicons name={section.icon} size={18} color={section.color} />
          </View>
          <Text style={s.sectionLabel}>{section.label}</Text>
          <View style={[s.scorePill, { backgroundColor: scoreColor + '15' }]}>
            <Text style={[s.scorePillText, { color: scoreColor }]}>{data.score}</Text>
          </View>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {isExpanded && (
          <View style={s.sectionBody}>
            {data.issues?.length > 0 && (
              <View style={s.subsection}>
                <Text style={s.subsectionTitle}>Issues Found</Text>
                {data.issues.map((issue, i) => (
                  <View key={i} style={s.bulletRow}>
                    <Text style={s.bulletDot}>•</Text>
                    <Text style={s.bulletText}>{issue}</Text>
                  </View>
                ))}
              </View>
            )}

            {data.optimizedText ? (
              <View style={s.subsection}>
                <View style={s.optimizedHeader}>
                  <Text style={s.subsectionTitle}>Optimized Version</Text>
                  <TouchableOpacity onPress={() => copyText(data.optimizedText, section.key)} style={s.copyBtn}>
                    <Ionicons name={copied === section.key ? 'checkmark' : 'copy-outline'} size={14} color={copied === section.key ? '#10B981' : colors.primary} />
                    <Text style={[s.copyBtnText, copied === section.key && { color: '#10B981' }]}>
                      {copied === section.key ? 'Copied!' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={s.optimizedBox}>
                  <Text style={s.optimizedText}>{data.optimizedText}</Text>
                </View>
              </View>
            ) : null}

            {data.tips?.length > 0 && (
              <View style={s.subsection}>
                <Text style={s.subsectionTitle}>Tips</Text>
                {data.tips.map((tip, i) => (
                  <View key={i} style={s.tipRow}>
                    <Ionicons name="bulb-outline" size={14} color="#F59E0B" />
                    <Text style={s.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // ── INPUT PANEL ──────────────────────────────────────────
  const inputPanel = (
    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {/* Hero */}
      <LinearGradient colors={['#0A66C2', '#004182']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <Ionicons name="logo-linkedin" size={36} color="#fff" />
        <Text style={s.heroTitle}>LinkedIn Profile Optimizer</Text>
        <Text style={s.heroSub}>AI-powered analysis with ready-to-use optimized text for every section</Text>
        <View style={s.heroChips}>
          {['Profile Score', 'Optimized Headline', 'Better About', 'Keyword Gaps'].map(c => (
            <View key={c} style={s.heroChip}><Text style={s.heroChipText}>{c}</Text></View>
          ))}
        </View>
      </LinearGradient>

      {/* Mode toggle */}
      <View style={s.modeToggle}>
        <TouchableOpacity style={[s.modeBtn, mode === 'quick' && s.modeBtnActive]} onPress={() => setMode('quick')} activeOpacity={0.7}>
          <Ionicons name="flash-outline" size={16} color={mode === 'quick' ? '#fff' : colors.textSecondary} />
          <Text style={[s.modeBtnText, mode === 'quick' && s.modeBtnTextActive]}>Quick Optimize</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.modeBtn, mode === 'full' && s.modeBtnActive]} onPress={() => setMode('full')} activeOpacity={0.7}>
          <Ionicons name="document-text-outline" size={16} color={mode === 'full' ? '#fff' : colors.textSecondary} />
          <Text style={[s.modeBtnText, mode === 'full' && s.modeBtnTextActive]}>Full PDF Audit</Text>
        </TouchableOpacity>
      </View>

      {mode === 'quick' ? (
        <View style={s.fieldsWrap}>
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Your headline <Text style={s.fieldHint}>(below your name)</Text></Text>
            <TextInput style={s.input} value={headline} onChangeText={setHeadline} placeholder="e.g. Software Engineer at Google | React, Node.js" placeholderTextColor={colors.gray400} />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>About / Summary</Text>
            <TextInput style={[s.input, s.textArea]} value={about} onChangeText={setAbout} placeholder="Paste your About section here..." placeholderTextColor={colors.gray400} multiline numberOfLines={5} textAlignVertical="top" />
          </View>

          <View style={isDesktop ? s.rowFields : undefined}>
            <View style={[s.fieldGroup, isDesktop && { flex: 1 }]}>
              <Text style={s.fieldLabel}>Current Role</Text>
              <TextInput style={s.input} value={currentRole} onChangeText={setCurrentRole} placeholder="e.g. Senior SDE" placeholderTextColor={colors.gray400} />
            </View>
            <View style={[s.fieldGroup, isDesktop && { flex: 1 }]}>
              <Text style={s.fieldLabel}>Company</Text>
              <TextInput style={s.input} value={currentCompany} onChangeText={setCurrentCompany} placeholder="e.g. Amazon" placeholderTextColor={colors.gray400} />
            </View>
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Skills <Text style={s.fieldHint}>(comma-separated)</Text></Text>
            <TextInput style={s.input} value={skills} onChangeText={setSkills} placeholder="e.g. React, Node.js, AWS, System Design" placeholderTextColor={colors.gray400} />
          </View>
        </View>
      ) : (
        <View style={s.fieldsWrap}>
          <TouchableOpacity style={s.pdfUploadBox} onPress={pickPDF} activeOpacity={0.7}>
            <Ionicons name={pdfFile ? 'checkmark-circle' : 'cloud-upload-outline'} size={40} color={pdfFile ? '#10B981' : colors.primary} />
            <Text style={s.pdfTitle}>{pdfFile ? pdfFile.name : 'Upload LinkedIn PDF'}</Text>
            <Text style={s.pdfSub}>{pdfFile ? `${(pdfFile.size / 1024).toFixed(0)} KB` : 'Go to your LinkedIn profile → More → Save to PDF'}</Text>
            {!pdfFile && (
              <View style={s.pdfBtn}>
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={s.pdfBtnText}>Choose PDF</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Target role (both modes) */}
      <View style={s.fieldsWrap}>
        <View style={s.fieldGroup}>
          <Text style={s.fieldLabel}>Target role you're aiming for <Text style={s.fieldHint}>(optional)</Text></Text>
          <TextInput style={s.input} value={targetRole} onChangeText={setTargetRole} placeholder="e.g. Staff Engineer at FAANG" placeholderTextColor={colors.gray400} />
        </View>
      </View>

      {error ? (
        <View style={s.errorBox}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={s.ctaWrap}>
        <TouchableOpacity style={[s.ctaBtn, analyzing && { opacity: 0.6 }]} onPress={handleAnalyze} disabled={analyzing} activeOpacity={0.85}>
          {analyzing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={s.ctaBtnText}>{!isFreeUse ? `Optimize My Profile (₹${costPerUse})` : 'Optimize My Profile'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

<<<<<<< HEAD
=======
      {/* Need Help */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Support')}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, marginBottom: 10, position: 'relative', zIndex: 0 }}
      >
        <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Need Help?</Text>
      </TouchableOpacity>
>>>>>>> feature/refopen-pro-subscription
    </ScrollView>
  );

  // ── ANALYZING ────────────────────────────────────────────
  const analyzingView = (
    <View style={s.analyzingWrap}>
      <Animated.View style={{ opacity: stepAnim, transform: [{ scale: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
        <Text style={s.analyzingEmoji}>{ANALYZING_STEPS[analyzeStep].emoji}</Text>
      </Animated.View>
      <Text style={s.analyzingLabel}>{ANALYZING_STEPS[analyzeStep].label}</Text>
      <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
    </View>
  );

  // ── RESULTS ──────────────────────────────────────────────
  const resultsPanel = result ? (
    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.scoreCard}>
        <ScoreRing score={result.overallScore} size={isDesktop ? 140 : 120} colors={colors} />
        <Text style={[s.scoreLabel, { color: getScoreColor(result.overallScore) }]}>{getScoreLabel(result.overallScore)}</Text>
        {result.targetRole ? <Text style={s.targetLabel}>Optimized for: {result.targetRole}</Text> : null}
      </View>

      {result.topPriorities?.length > 0 && (
        <View style={s.priorityCard}>
          <Text style={s.priorityTitle}>Top 3 Priorities</Text>
          {result.topPriorities.map((p, i) => (
            <View key={i} style={s.priorityRow}>
              <View style={[s.priorityBadge, { backgroundColor: ['#EF4444', '#F59E0B', '#3B82F6'][i] + '15' }]}>
                <Text style={[s.priorityNum, { color: ['#EF4444', '#F59E0B', '#3B82F6'][i] }]}>{i + 1}</Text>
              </View>
              <Text style={s.priorityText}>{p}</Text>
            </View>
          ))}
        </View>
      )}

      {SECTIONS.map(sec => {
        const data = result[sec.key];
        return data ? renderSectionCard(sec, data) : null;
      })}

      {result.keywordGaps?.length > 0 && (
        <View style={s.insightCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="key-outline" size={18} color={colors.primary} />
            <Text style={s.insightTitle}>Missing Keywords</Text>
          </View>
          <View style={s.chipWrap}>
            {result.keywordGaps.map((kw, i) => (
              <View key={i} style={s.kwChip}><Text style={s.kwChipText}>{kw}</Text></View>
            ))}
          </View>
        </View>
      )}

      <View style={s.miniScoreRow}>
        {[
          { label: 'Search\nAppearance', data: result.searchAppearance, icon: 'search-outline' },
          { label: 'Recruiter\nReady', data: result.recruiterReadiness, icon: 'person-outline' },
        ].map(({ label, data, icon }) => data ? (
          <View key={label} style={s.miniScoreCard}>
            <Ionicons name={icon} size={18} color={getScoreColor(data.score)} />
            <Text style={[s.miniScoreNum, { color: getScoreColor(data.score) }]}>{data.score}</Text>
            <Text style={s.miniScoreLabel}>{label}</Text>
            {data.tips?.[0] && <Text style={s.miniScoreTip} numberOfLines={2}>{data.tips[0]}</Text>}
          </View>
        ) : null)}
      </View>

      {result.networkingTips?.length > 0 && (
        <View style={s.insightCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="people-outline" size={18} color="#8B5CF6" />
            <Text style={s.insightTitle}>Networking Tips</Text>
          </View>
          {result.networkingTips.map((tip, i) => (
            <View key={i} style={s.tipRow}>
              <Text style={s.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Referral CTA */}
      <TouchableOpacity
        style={{
          marginTop: 16,
          marginBottom: 12,
          borderRadius: 14,
          overflow: 'hidden',
        }}
        onPress={() => navigation.navigate('MainTabs', { screen: 'AskReferral' })}
        activeOpacity={0.85}
      >
        <View style={{
          padding: 18,
          borderRadius: 14,
          backgroundColor: '#8B5CF6' + '12',
          borderWidth: 1,
          borderColor: '#8B5CF6' + '30',
          flexDirection: 'row',
          alignItems: 'center',
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#8B5CF6', fontSize: 15, fontWeight: '700', marginBottom: 4 }}>
              Ready to land the job? Get a referral →
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
              {result.overallScore >= 70
                ? `Your profile scored ${result.overallScore}/100. Put it to work with a direct referral`
                : `Boost your chances with a direct employee referral at your dream company`}
            </Text>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#8B5CF6' + '20', alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
            <Ionicons name="paper-plane" size={20} color="#8B5CF6" />
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={s.resetBtn} onPress={handleReset} activeOpacity={0.7}>
        <Ionicons name="refresh" size={16} color={colors.primary} />
        <Text style={s.resetBtnText}>Optimize Another Profile</Text>
      </TouchableOpacity>
    </ScrollView>
  ) : null;

  // ── RENDER ───────────────────────────────────────────────
  return (
    <View style={s.container}>
      <SubScreenHeader title="LinkedIn Optimizer" fallbackTab="Services" />

      {isDesktop ? (
        <View style={s.desktopLayout}>
          <View style={s.desktopLeft}>{inputPanel}</View>
          <View style={s.desktopRight}>
            {view === 'analyzing' ? analyzingView : view === 'results' && result ? resultsPanel : (
              <View style={s.emptyRight}>
                <Ionicons name="logo-linkedin" size={48} color={colors.border} />
                <Text style={s.emptyText}>Your optimized profile will appear here</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={s.inner}>
          {view === 'input' && inputPanel}
          {view === 'analyzing' && analyzingView}
          {view === 'results' && resultsPanel}
        </View>
      )}

      <SignInBottomSheet visible={showSignIn} onClose={() => setShowSignIn(false)} navigation={navigation} />
      <ConfirmPurchaseModal
        visible={showPurchase}
        currentBalance={walletBalance}
        requiredAmount={optimizerCost}
        contextType="tool"
        itemName="LinkedIn Profile Optimization"
        onProceed={async () => { setShowPurchase(false); await executeOptimization(); }}
        onAddMoney={() => { setShowPurchase(false); navigation.navigate('WalletRecharge'); }}
        onCancel={() => { setShowPurchase(false); setView('input'); }}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const makeStyles = (c, isDesktop) => ({
  container: { flex: 1, backgroundColor: c.background },
  inner: { flex: 1 },
  scroll: { flex: 1 },
  desktopLayout: { flex: 1, flexDirection: 'row' },
  desktopLeft: { flex: 5, borderRightWidth: 1, borderRightColor: c.border },
  desktopRight: { flex: 5, backgroundColor: c.background },

  hero: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 24, alignItems: 'center' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 12 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 6, maxWidth: 360 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
  heroChip: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  heroChipText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  modeToggle: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, backgroundColor: c.surface, borderRadius: 12, padding: 4, gap: 4, borderWidth: 1, borderColor: c.border },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  modeBtnActive: { backgroundColor: '#0A66C2' },
  modeBtnText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  modeBtnTextActive: { color: '#fff' },

  fieldsWrap: { paddingHorizontal: 16, marginTop: 16 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 6 },
  fieldHint: { fontSize: 12, fontWeight: '400', color: c.textSecondary },
  input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: c.text },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  rowFields: { flexDirection: 'row', gap: 12 },

  pdfUploadBox: { alignItems: 'center', padding: 32, borderWidth: 2, borderColor: c.border, borderStyle: 'dashed', borderRadius: 16, backgroundColor: c.surface },
  pdfTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginTop: 12 },
  pdfSub: { fontSize: 12, color: c.textSecondary, marginTop: 4, textAlign: 'center' },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: c.primary + '30', backgroundColor: c.primary + '08' },
  pdfBtnText: { fontSize: 13, fontWeight: '600', color: c.primary },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, padding: 12, backgroundColor: (c.error || '#EF4444') + '10', borderRadius: 10, borderWidth: 1, borderColor: (c.error || '#EF4444') + '20' },
  errorText: { fontSize: 13, color: c.error || '#EF4444', flex: 1 },

  ctaWrap: { paddingHorizontal: 16, marginTop: 20, alignItems: 'center' },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0A66C2', width: '100%', paddingVertical: 16, borderRadius: 14, shadowColor: '#0A66C2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  freeLabel: { fontSize: 12, color: c.textSecondary, marginTop: 8 },

  analyzingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  analyzingEmoji: { fontSize: 64 },
  analyzingLabel: { fontSize: 17, fontWeight: '600', color: c.text, marginTop: 16, textAlign: 'center' },

  scoreCard: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  scoreLabel: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  targetLabel: { fontSize: 12, color: c.textSecondary, marginTop: 4 },

  priorityCard: { marginHorizontal: 16, padding: 16, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: 12 },
  priorityTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 12 },
  priorityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  priorityBadge: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  priorityNum: { fontSize: 12, fontWeight: '800' },
  priorityText: { fontSize: 13, color: c.text, flex: 1, lineHeight: 19 },

  sectionCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  sectionIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: c.text, flex: 1 },
  scorePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  scorePillText: { fontSize: 13, fontWeight: '800' },
  sectionBody: { paddingHorizontal: 14, paddingBottom: 14 },
  subsection: { marginTop: 10 },
  subsectionTitle: { fontSize: 12, fontWeight: '700', color: c.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  bulletRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  bulletDot: { fontSize: 13, color: c.error || '#EF4444', lineHeight: 19 },
  bulletText: { fontSize: 13, color: c.text, flex: 1, lineHeight: 19 },
  optimizedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: c.primary + '10' },
  copyBtnText: { fontSize: 11, fontWeight: '600', color: c.primary },
  optimizedBox: { marginTop: 8, padding: 12, backgroundColor: c.primary + '06', borderRadius: 10, borderWidth: 1, borderColor: c.primary + '15' },
  optimizedText: { fontSize: 13, color: c.text, lineHeight: 20 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  tipText: { fontSize: 13, color: c.text, flex: 1, lineHeight: 19 },

  insightCard: { marginHorizontal: 16, padding: 16, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: 12 },
  insightTitle: { fontSize: 14, fontWeight: '700', color: c.text },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  kwChip: { backgroundColor: (c.error || '#EF4444') + '10', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: (c.error || '#EF4444') + '20' },
  kwChipText: { fontSize: 12, fontWeight: '600', color: c.error || '#EF4444' },

  miniScoreRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 12 },
  miniScoreCard: { flex: 1, padding: 14, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
  miniScoreNum: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  miniScoreLabel: { fontSize: 11, fontWeight: '600', color: c.textSecondary, marginTop: 2, textAlign: 'center' },
  miniScoreTip: { fontSize: 11, color: c.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 15 },

  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginTop: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: c.primary + '30', backgroundColor: c.primary + '06' },
  resetBtnText: { fontSize: 14, fontWeight: '600', color: c.primary },

  emptyRight: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15, color: c.textSecondary, marginTop: 12, textAlign: 'center' },
});
