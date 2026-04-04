/**
 * Blind Review Screen
 * 
 * Submit your profile anonymously for review by verified referrers 
 * at your target company. Get honest feedback on whether they'd refer you.
 * 
 * Flow:
 * 1. Pick target company (inline dropdown with logos)
 * 2. Enter target role
 * 3. Choose source: Resume (default) or Profile
 * 4. If resume → pick which resume
 * 5. Submit → instant AI score + waiting for human reviews
 * 6. Results: AI score ring + human feedback cards + aggregated summary
 * 
 * Desktop: 2-panel (form left / results right)
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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  { emoji: '🔒', label: 'Anonymizing your profile...' },
  { emoji: '🧠', label: 'AI analyzing your fit...' },
  { emoji: '📊', label: 'Calculating referrability score...' },
  { emoji: '✨', label: 'Generating insights...' },
];

const getScoreColor = (score) => {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#F97316';
  return '#EF4444';
};

const getScoreLabel = (score) => {
  if (score >= 80) return 'Strong Candidate';
  if (score >= 60) return 'Good Potential';
  if (score >= 40) return 'Needs Improvement';
  return 'Major Gaps';
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
export default function BlindReviewScreen({ navigation }) {
  const { colors } = useTheme();
  const { isDesktop } = useResponsive();
  const { user, isAuthenticated } = useAuth();
  const { pricing } = usePricing();

  // View state
  const [view, setView] = useState('input'); // input | analyzing | results | history
  const [sourceType, setSourceType] = useState('resume');

  // Form fields
  const [targetRole, setTargetRole] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companySearch, setCompanySearch] = useState('');
  const [companyResults, setCompanyResults] = useState([]);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);

  // Resume selection
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [resumesLoading, setResumesLoading] = useState(false);

  // Results
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);

  // History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Wallet + usage
  const [walletBalance, setWalletBalance] = useState(0);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [freeUses, setFreeUses] = useState(1);
  const [costPerUse, setCostPerUse] = useState(49);
  const isFreeUse = usageCount < freeUses;

  // Animations
  const stepAnim = useRef(new Animated.Value(0)).current;
  const ctaPulseAnim = useRef(new Animated.Value(1)).current;

  // ── Load data on mount ───────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const [balResult, resumeResult, usageResult] = await Promise.all([
          refopenAPI.getWalletBalance(),
          refopenAPI.getMyResumes(),
          refopenAPI.apiCall('/access/status?type=blind_review'),
        ]);
        if (balResult?.success) setWalletBalance(balResult.data?.availableBalance ?? balResult.data?.balance ?? 0);
        if (resumeResult?.success && resumeResult.data) {
          const sorted = resumeResult.data
            .filter(r => !r.IsDeleted)
            .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
          setResumes(sorted);
          if (sorted.length) setSelectedResumeId(sorted[0].ResumeID);
        }
        // Load usage info from unified access endpoint (same pattern as LinkedIn Optimizer)
        if (usageResult?.success && usageResult.data) {
          const d = usageResult.data;
          if (d.totalUsed !== undefined) setUsageCount(d.totalUsed);
          if (d.freeUses !== undefined) setFreeUses(d.freeUses);
          if (d.cost !== undefined) setCostPerUse(d.cost);
        }
      } catch (e) { /* silent */ }
    })();
  }, [isAuthenticated]);

  // ── Company search ───────────────────────────────────────
  const searchCompanyTimeout = useRef(null);
  const handleCompanySearch = useCallback((text) => {
    setCompanySearch(text);
    setSelectedCompany(null);

    if (searchCompanyTimeout.current) clearTimeout(searchCompanyTimeout.current);
    if (text.trim().length < 2) {
      setCompanyResults([]);
      setShowCompanyDropdown(false);
      return;
    }

    setShowCompanyDropdown(true);
    setCompanyLoading(true);

    searchCompanyTimeout.current = setTimeout(async () => {
      try {
        const res = await refopenAPI.getOrganizations(text.trim(), 8);
        if (res?.success && Array.isArray(res.data)) {
          // Filter out the 'My company is not listed' sentinel
          setCompanyResults(res.data.filter(o => o.id !== 999999));
        } else {
          setCompanyResults([]);
        }
      } catch {
        setCompanyResults([]);
      } finally {
        setCompanyLoading(false);
      }
    }, 300);
  }, []);

  const selectCompany = useCallback((org) => {
    setSelectedCompany(org);
    setCompanySearch(org.name);
    setShowCompanyDropdown(false);
    setCompanyResults([]);
  }, []);

  // ── Analyzing animation ──────────────────────────────────
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

  // CTA pulse animation (scale pulse for attention)
  useEffect(() => {
    if (view !== 'results' || !result) return;
    ctaPulseAnim.setValue(1);
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulseAnim, { toValue: 1.03, duration: 1000, useNativeDriver: true }),
        Animated.timing(ctaPulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [view, result]);

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!isAuthenticated) { setShowSignIn(true); return; }

    if (!selectedCompany) {
      setError('Please select a target company.');
      return;
    }
    if (!targetRole.trim()) {
      setError('Please enter the role you want reviewed for.');
      return;
    }
    if (sourceType === 'resume' && !selectedResumeId) {
      setError('Please select a resume. Upload one if you don\'t have any.');
      return;
    }

    // Pre-check wallet for paid use
    if (!isFreeUse) {
      try {
        const b = await refopenAPI.getWalletBalance();
        if (b?.success) setWalletBalance(b.data?.availableBalance ?? b.data?.balance ?? 0);
      } catch { /* use cached */ }
      setShowPurchase(true);
      return;
    }

    await executeSubmit();
  }, [selectedCompany, targetRole, sourceType, selectedResumeId, isAuthenticated, isFreeUse]);

  const executeSubmit = useCallback(async () => {
    setError('');
    setAnalyzing(true);
    setAnalyzeStep(0);
    setView('analyzing');

    try {
      const response = await refopenAPI.apiCall('/tools/blind-review/submit', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: selectedCompany.id,
          targetRole: targetRole.trim(),
          sourceType,
          resumeId: sourceType === 'resume' ? selectedResumeId : undefined,
        }),
      });

      if (response?.success) {
        setResult(response);
        if (response.usageInfo?.totalUsed !== undefined) setUsageCount(response.usageInfo.totalUsed);
        if (response.usageInfo?.wasFree === false) {
          refopenAPI.getWalletBalance().then(r => { if (r?.success) setWalletBalance(r.data?.availableBalance ?? r.data?.balance ?? 0); }).catch(() => {});
        }
        setView('results');
      } else if (response?.requiresPayment) {
        setShowPurchase(true);
        setView('input');
      } else {
        setError(response?.error || 'Submission failed. Please try again.');
        setView('input');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setView('input');
    } finally {
      setAnalyzing(false);
    }
  }, [selectedCompany, targetRole, sourceType, selectedResumeId]);

  // ── Load history ─────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await refopenAPI.apiCall('/tools/blind-review/history');
      if (res?.success && res.data) {
        setHistory(res.data);
      }
    } catch { /* silent */ }
    setHistoryLoading(false);
  }, []);

  // ── View a past request ──────────────────────────────────
  const viewRequest = useCallback(async (requestId) => {
    try {
      const res = await refopenAPI.apiCall(`/tools/blind-review/status/${requestId}`);
      if (res?.success) {
        setResult({ data: res.data, success: true });
        setView('results');
      }
    } catch { /* silent */ }
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setView('input');
    setError('');
    setSelectedCompany(null);
    setCompanySearch('');
    setTargetRole('');
  }, []);

  const s = useMemo(() => makeStyles(colors, isDesktop), [colors, isDesktop]);

  // ── INPUT PANEL ──────────────────────────────────────────
  const inputPanel = (
    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {/* Hero */}
      <LinearGradient colors={[colors.accentDark || '#6C3AED', colors.accentLight || '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.heroIconCircle}>
          <Ionicons name="people" size={32} color="#fff" />
        </View>
        <Text style={s.heroTitle}>Blind Review</Text>
        <Text style={s.heroSub}>Get anonymous feedback from insiders at your target company</Text>
        <View style={s.heroChips}>
          {['Anonymous', 'Real Insiders', 'Honest Feedback', 'AI Score'].map(c => (
            <View key={c} style={s.heroChip}><Text style={s.heroChipText}>{c}</Text></View>
          ))}
        </View>
      </LinearGradient>

      {/* History toggle */}
      <TouchableOpacity style={s.historyBtn} onPress={() => { if (view === 'history') { setView('input'); } else { setView('history'); loadHistory(); } }} activeOpacity={0.7}>
        <Ionicons name="time-outline" size={16} color={colors.primary} />
        <Text style={s.historyBtnText}>{view === 'history' ? 'Back to Form' : 'View Past Reviews'}</Text>
      </TouchableOpacity>

      {view === 'history' ? (
        // ── History List ────────────────────────────────────
        <View style={s.historyWrap}>
          {historyLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : history.length === 0 ? (
            <View style={s.emptyHistory}>
              <Ionicons name="documents-outline" size={48} color={colors.border} />
              <Text style={s.emptyHistoryText}>No reviews yet</Text>
              <Text style={s.emptyHistorySub}>Submit your first blind review above!</Text>
            </View>
          ) : (
            history.map(item => (
              <TouchableOpacity key={item.requestId} style={s.historyCard} onPress={() => viewRequest(item.requestId)} activeOpacity={0.7}>
                <View style={s.historyRow}>
                  <View style={[s.statusDot, { backgroundColor: item.status === 'completed' ? '#10B981' : item.status === 'pending' ? '#F59E0B' : '#3B82F6' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.historyRole}>{item.targetRole}</Text>
                    <Text style={s.historyOrg}>{item.organizationName}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {item.aiScore !== null && (
                      <Text style={[s.historyScore, { color: getScoreColor(item.aiScore) }]}>{item.aiScore}</Text>
                    )}
                    <Text style={s.historyDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                  </View>
                </View>
                <View style={s.historyMeta}>
                  <View style={[s.statusPill, { backgroundColor: item.status === 'completed' ? '#10B98115' : '#F59E0B15' }]}>
                    <Text style={[s.statusPillText, { color: item.status === 'completed' ? '#10B981' : '#F59E0B' }]}>
                      {item.status === 'completed' ? '✓ Review complete' : item.status === 'in_review' ? '⏳ In progress' : '⏳ Processing'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <>
          {/* Step 1: Target Company */}
          <View style={s.fieldsWrap}>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>
                <Ionicons name="business-outline" size={14} color={colors.textSecondary} />{' '}
                Which company do you want feedback from?
              </Text>
              <View style={{ position: 'relative', zIndex: 9999 }}>
                <View style={s.searchInputWrap}>
                  <Ionicons name="search" size={16} color={colors.textSecondary} />
                  <TextInput
                    style={s.searchInput}
                    value={companySearch}
                    onChangeText={handleCompanySearch}
                    placeholder="Search company..."
                    placeholderTextColor={colors.gray400}
                    onFocus={() => { if (companyResults.length) setShowCompanyDropdown(true); }}
                    onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                  />
                  {selectedCompany && (
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  )}
                </View>

                {showCompanyDropdown && (
                  <View style={s.dropdown}>
                    {companyLoading ? (
                      <View style={s.dropdownLoading}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    ) : companyResults.length === 0 ? (
                      <View style={s.dropdownEmpty}>
                        <Text style={s.dropdownEmptyText}>No companies found. Check spelling.</Text>
                      </View>
                    ) : (
                      companyResults.map(org => (
                        <TouchableOpacity key={org.id} style={s.dropdownItem} onPress={() => selectCompany(org)} activeOpacity={0.7}>
                          {org.logoURL ? (
                            <Image source={{ uri: org.logoURL }} style={s.orgLogoImg} />
                          ) : (
                            <View style={s.orgLogo}>
                              <Text style={s.orgLogoText}>{(org.name || '?').charAt(0)}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={s.orgName}>{org.name}</Text>
                            {org.industry ? <Text style={s.orgIndustry}>{org.industry}</Text> : null}
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Step 2: Target Role */}
          {selectedCompany && (
            <View style={s.fieldsWrap}>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>
                  <Ionicons name="briefcase-outline" size={14} color={colors.textSecondary} />{' '}
                  What role are you targeting?
                </Text>
                <TextInput
                  style={s.input}
                  value={targetRole}
                  onChangeText={setTargetRole}
                  placeholder="e.g. Senior Software Engineer"
                  placeholderTextColor={colors.gray400}
                />
              </View>
            </View>
          )}

          {/* Step 3: Source Type */}
          {selectedCompany && targetRole.trim() && (
            <View style={s.fieldsWrap}>
              <Text style={s.fieldLabel}>
                <Ionicons name="document-outline" size={14} color={colors.textSecondary} />{' '}
                What should we review?
              </Text>
              <View style={s.sourceToggle}>
                <TouchableOpacity
                  style={[s.sourceBtn, sourceType === 'resume' && s.sourceBtnActive]}
                  onPress={() => setSourceType('resume')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="document-text" size={16} color={sourceType === 'resume' ? '#fff' : colors.textSecondary} />
                  <Text style={[s.sourceBtnText, sourceType === 'resume' && s.sourceBtnTextActive]}>My Resume</Text>
                  <Text style={[s.sourceBtnHint, sourceType === 'resume' && { color: 'rgba(255,255,255,0.7)' }]}>Recommended</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.sourceBtn, sourceType === 'profile' && s.sourceBtnActive]}
                  onPress={() => setSourceType('profile')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person" size={16} color={sourceType === 'profile' ? '#fff' : colors.textSecondary} />
                  <Text style={[s.sourceBtnText, sourceType === 'profile' && s.sourceBtnTextActive]}>My Profile</Text>
                  <Text style={[s.sourceBtnHint, sourceType === 'profile' && { color: 'rgba(255,255,255,0.7)' }]}>Fields only</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 4: Resume Picker */}
          {selectedCompany && targetRole.trim() && sourceType === 'resume' && (
            <View style={s.fieldsWrap}>
              <Text style={s.fieldLabel}>
                <Ionicons name="folder-open-outline" size={14} color={colors.textSecondary} />{' '}
                Select resume
              </Text>
              {resumesLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
              ) : resumes.length === 0 ? (
                <View style={s.noResumeBox}>
                  <Text style={s.noResumeText}>No resumes uploaded yet.</Text>
                  <TouchableOpacity style={s.uploadResumeBtn} onPress={() => navigation.navigate('ResumeUpload')} activeOpacity={0.7}>
                    <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
                    <Text style={s.uploadResumeBtnText}>Upload Resume</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.resumeList}>
                  {resumes.map(r => (
                    <TouchableOpacity
                      key={r.ResumeID}
                      style={[s.resumeCard, selectedResumeId === r.ResumeID && s.resumeCardSelected]}
                      onPress={() => setSelectedResumeId(r.ResumeID)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={selectedResumeId === r.ResumeID ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={selectedResumeId === r.ResumeID ? colors.primary : colors.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.resumeName}>{r.ResumeLabel || 'Resume'}</Text>
                        <Text style={s.resumeDate}>{new Date(r.CreatedAt).toLocaleDateString()}</Text>
                      </View>
                      {r.IsPrimary ? (
                        <View style={s.primaryBadge}><Text style={s.primaryBadgeText}>Primary</Text></View>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* What they'll see preview */}
          {selectedCompany && targetRole.trim() && (sourceType === 'profile' || selectedResumeId) && (
            <View style={s.fieldsWrap}>
              <View style={s.previewCard}>
                <Ionicons name="eye-off-outline" size={20} color={colors.primary} />
                <Text style={s.previewTitle}>What the reviewer will see</Text>
                <Text style={s.previewText}>
                  {'• Skills, technologies, certifications\n• Work experience with company names, durations, key achievements\n• Projects with descriptions and tech stack\n• Education with college name and GPA\n\n'}
                  <Text style={{ fontWeight: '700', color: colors.primary }}>NOT shared:</Text>{' Your name, email, phone number, or LinkedIn profile'}
                </Text>
              </View>
            </View>
          )}

          {/* Error */}
          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.error || '#EF4444'} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Submit CTA */}
          {selectedCompany && targetRole.trim() && (sourceType === 'profile' || selectedResumeId) && (
            <View style={s.ctaWrap}>
              <TouchableOpacity style={[s.ctaBtn, analyzing && { opacity: 0.6 }]} onPress={handleSubmit} disabled={analyzing} activeOpacity={0.85}>
                {analyzing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={18} color="#fff" />
                    <Text style={s.ctaBtnText}>Get Blind Review</Text>
                  </>
                )}
              </TouchableOpacity>
              {isFreeUse && (
                <Text style={s.freeLabel}>✨ First review is free</Text>
              )}
            </View>
          )}
        </>
      )}
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
      <Text style={s.analyzingHint}>This takes 10-20 seconds...</Text>
    </View>
  );

  // ── RESULTS ──────────────────────────────────────────────
  const data = result?.data || result;
  const aiScore = data?.aiScore || data?.data?.aiScore;
  const anonymizedProfile = data?.anonymizedProfile || data?.data?.anonymizedProfile;
  const aiAnalysis = data?.aiAnalysis || data?.data?.aiAnalysis || aiScore;
  const finalFeedback = data?.finalFeedback || data?.data?.finalFeedback;
  const responses = data?.responses || data?.data?.responses || [];
  const responseCount = data?.responseCount ?? data?.data?.responseCount ?? 0;
  const status = data?.status || data?.data?.status || 'pending';
  const hasReferrers = result?.hasReferrers;
  const orgName = data?.organizationName || data?.data?.organizationName || selectedCompany?.name || '';

  // Compute Get Referred CTA (always show one: Specific for strong, Open for weak)
  const getReferredCTA = (() => {
    if (!orgName && !data) return null;
    const humanYes = responses.some(r => r.wouldRefer);
    const humanExists = responses.length > 0;
    const allHumanNo = humanExists && !humanYes;
    const aiReviewPositive = finalFeedback && (finalFeedback.wouldReferPercent >= 50);
    const score = aiAnalysis?.score || aiScore || 0;

    // Strong signal: show Specific referral CTA (green)
    if (humanYes) return { type: 'specific', ctaTitle: `An insider would refer you at ${orgName}`, ctaSub: 'A real insider validated your profile. Take the next step.', color: '#10B981' };
    if (aiReviewPositive) return { type: 'specific', ctaTitle: `Your profile is referrable at ${orgName}`, ctaSub: 'Based on detailed review. Request a referral now.', color: '#10B981' };
    if (!allHumanNo && score >= 70) return { type: 'specific', ctaTitle: `Strong candidate at ${orgName}`, ctaSub: 'Your profile shows strong potential. Get referred now.', color: '#10B981' };
    if (!allHumanNo && score >= 50) return { type: 'specific', ctaTitle: `Decent fit at ${orgName}`, ctaSub: 'Your profile shows potential. Request a referral now.', color: '#10B981' };

    // Weak signal: show Open referral CTA (blue)
    return { type: 'open', ctaTitle: 'Try Open Referral', ctaSub: 'Get referred across multiple companies with a single request. Broaden your chances.', color: '#3B82F6' };
  })();

  const resultsPanel = data ? (
    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* AI Score */}
      <View style={s.scoreCard}>
        <ScoreRing score={aiAnalysis?.score || aiScore || 0} size={isDesktop ? 140 : 120} colors={colors} />
        <Text style={[s.scoreLabel, { color: getScoreColor(aiAnalysis?.score || aiScore || 0) }]}>
          {getScoreLabel(aiAnalysis?.score || aiScore || 0)}
        </Text>
        <Text style={s.targetLabel}>
          {data?.targetRole || data?.data?.targetRole || targetRole} at {orgName}
        </Text>
        <Text style={s.scoreSubLabel}>AI Referrability Score</Text>
      </View>

      {/* Status badge */}
      <View style={s.statusCard}>
        <View style={[s.statusBadgePill, { backgroundColor: status === 'completed' ? '#10B98115' : status === 'in_review' ? '#3B82F615' : '#F59E0B15' }]}>
          <Ionicons
            name={status === 'completed' ? 'checkmark-circle' : status === 'in_review' ? 'hourglass' : 'time'}
            size={16}
            color={status === 'completed' ? '#10B981' : status === 'in_review' ? '#3B82F6' : '#F59E0B'}
          />
          <Text style={[s.statusBadgeText, { color: status === 'completed' ? '#10B981' : status === 'in_review' ? '#3B82F6' : '#F59E0B' }]}>
            {status === 'completed' ? 'Review complete. See results below.' :
             status === 'in_review' ? 'Feedback received. Compiling insights...' :
             'Your review is being processed...'}
          </Text>
        </View>
      </View>

      {/* Get Referred CTA */}
      {getReferredCTA && (
        <TouchableOpacity
          style={[s.getReferredBtn, { backgroundColor: getReferredCTA.color }]}
          onPress={() => {
            if (getReferredCTA.type === 'open') {
              navigation.navigate('AskReferral');
            } else {
              const org = selectedCompany || {
                id: data?.organizationId || data?.data?.organizationId,
                name: orgName,
                logoURL: data?.organizationLogo || data?.data?.organizationLogo || null,
                tier: 'Standard',
              };
              navigation.navigate('AskReferral', {
                preSelectedOrganization: {
                  id: org.id,
                  name: org.name || orgName,
                  logoURL: org.logoURL || null,
                  tier: org.tier || 'Standard',
                },
              });
            }
          }}
          activeOpacity={0.85}
        >
          <Animated.View style={[s.getReferredInner, { transform: [{ scale: ctaPulseAnim }] }]}>
            <Ionicons name={getReferredCTA.type === 'open' ? 'globe' : 'rocket'} size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={s.getReferredTitle}>{getReferredCTA.ctaTitle}</Text>
              <Text style={s.getReferredSub}>{getReferredCTA.ctaSub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* AI Strengths */}
      {aiAnalysis?.strengths?.length > 0 && (
        <View style={s.feedbackCard}>
          <View style={s.feedbackHeader}>
            <View style={[s.feedbackIcon, { backgroundColor: '#10B98115' }]}>
              <Ionicons name="thumbs-up" size={16} color="#10B981" />
            </View>
            <Text style={s.feedbackTitle}>Strengths</Text>
          </View>
          {aiAnalysis.strengths.map((item, i) => (
            <View key={i} style={s.bulletRow}>
              <Text style={[s.bulletDot, { color: '#10B981' }]}>✓</Text>
              <Text style={s.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* AI Weaknesses */}
      {aiAnalysis?.weaknesses?.length > 0 && (
        <View style={s.feedbackCard}>
          <View style={s.feedbackHeader}>
            <View style={[s.feedbackIcon, { backgroundColor: '#F59E0B15' }]}>
              <Ionicons name="warning" size={16} color="#F59E0B" />
            </View>
            <Text style={s.feedbackTitle}>Areas to Improve</Text>
          </View>
          {aiAnalysis.weaknesses.map((item, i) => (
            <View key={i} style={s.bulletRow}>
              <Text style={[s.bulletDot, { color: '#F59E0B' }]}>!</Text>
              <Text style={s.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Red Flags */}
      {aiAnalysis?.redFlags?.length > 0 && (
        <View style={s.feedbackCard}>
          <View style={s.feedbackHeader}>
            <View style={[s.feedbackIcon, { backgroundColor: '#EF444415' }]}>
              <Ionicons name="flag" size={16} color="#EF4444" />
            </View>
            <Text style={s.feedbackTitle}>Red Flags</Text>
          </View>
          {aiAnalysis.redFlags.map((item, i) => (
            <View key={i} style={s.bulletRow}>
              <Text style={[s.bulletDot, { color: '#EF4444' }]}>⚠</Text>
              <Text style={s.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Recommendation */}
      {aiAnalysis?.recommendation && (
        <View style={s.recommendCard}>
          <Ionicons name="bulb" size={18} color="#8B5CF6" />
          <Text style={s.recommendText}>{aiAnalysis.recommendation}</Text>
        </View>
      )}

      {/* Anonymized Profile Preview */}
      {anonymizedProfile && (
        <View style={s.anonCard}>
          <Text style={s.anonTitle}>Your Anonymized Profile</Text>
          <Text style={s.anonHint}>This is what reviewers see. Your name, email and phone are removed.</Text>
          <View style={s.anonRow}>
            <Text style={s.anonLabel}>Experience</Text>
            <Text style={s.anonValue}>{anonymizedProfile.experienceYears} years</Text>
          </View>
          <View style={s.anonRow}>
            <Text style={s.anonLabel}>Education</Text>
            <Text style={s.anonValue}>
              {anonymizedProfile.educationLevel}{anonymizedProfile.fieldOfStudy !== 'Not specified' ? ` in ${anonymizedProfile.fieldOfStudy}` : ''}
              {anonymizedProfile.institution ? `\n${anonymizedProfile.institution}` : ''}
              {anonymizedProfile.gpa ? ` · GPA: ${anonymizedProfile.gpa}` : ''}
            </Text>
          </View>
          {anonymizedProfile.skills?.length > 0 && (
            <View style={s.anonRow}>
              <Text style={s.anonLabel}>Skills</Text>
              <View style={s.chipWrap}>
                {anonymizedProfile.skills.map((sk, i) => (
                  <View key={i} style={s.skillChip}><Text style={s.skillChipText}>{sk}</Text></View>
                ))}
              </View>
            </View>
          )}
          {anonymizedProfile.recentRoles?.length > 0 && (
            <View style={[s.anonRow, { flexDirection: 'column' }]}>
              <Text style={s.anonLabel}>Work Experience</Text>
              {anonymizedProfile.recentRoles.slice(0, 4).map((r, i) => (
                <View key={i} style={{ marginTop: i > 0 ? 8 : 4 }}>
                  <Text style={s.anonValue}>
                    {r.title}{r.company ? ` at ${r.company}` : ''}{r.durationMonths ? ` (${r.durationMonths >= 12 ? Math.round(r.durationMonths / 12) + 'y' : r.durationMonths + 'mo'})` : ''}{r.industry ? ` · ${r.industry}` : ''}
                  </Text>
                  {r.highlights?.length > 0 && r.highlights.map((h, hi) => (
                    <Text key={hi} style={s.anonHighlight}>• {h}</Text>
                  ))}
                </View>
              ))}
            </View>
          )}
          {anonymizedProfile.projects?.length > 0 && (
            <View style={[s.anonRow, { flexDirection: 'column' }]}>
              <Text style={s.anonLabel}>Projects</Text>
              {anonymizedProfile.projects.slice(0, 3).map((p, i) => (
                <View key={i} style={{ marginTop: i > 0 ? 6 : 4 }}>
                  <Text style={[s.anonValue, { fontWeight: '600' }]}>{p.name}</Text>
                  {p.description ? <Text style={s.anonHighlight}>{p.description}</Text> : null}
                  {p.technologies?.length > 0 && (
                    <View style={[s.chipWrap, { marginTop: 3 }]}>
                      {p.technologies.slice(0, 5).map((t, ti) => (
                        <View key={ti} style={s.skillChip}><Text style={s.skillChipText}>{t}</Text></View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
          {anonymizedProfile.summary && (
            <View style={[s.anonRow, { flexDirection: 'column' }]}>
              <Text style={s.anonLabel}>Summary</Text>
              <Text style={[s.anonValue, { marginTop: 4 }]}>{anonymizedProfile.summary}</Text>
            </View>
          )}
        </View>
      )}

      {/* Human Feedback (if completed) */}
      {finalFeedback && (
        <View style={s.humanSection}>
          <View style={s.humanHeader}>
            <Ionicons name="people" size={20} color={colors.primary} />
            <Text style={s.humanTitle}>Insider Feedback</Text>
          </View>

          {finalFeedback.summary && (
            <View style={s.humanSummaryCard}>
              <Text style={s.humanSummaryText}>{finalFeedback.summary}</Text>
            </View>
          )}

          <View style={s.humanStatsRow}>
            <View style={s.humanStatCard}>
              <Text style={[s.humanStatNum, { color: getScoreColor(finalFeedback.wouldReferPercent || 0) }]}>
                {finalFeedback.wouldReferPercent || 0}%
              </Text>
              <Text style={s.humanStatLabel}>Would Refer</Text>
            </View>
            <View style={s.humanStatCard}>
              <Text style={s.humanStatNum}>{finalFeedback.averageRating?.toFixed(1) || '-'}</Text>
              <Text style={s.humanStatLabel}>Avg Rating</Text>
            </View>
            <View style={s.humanStatCard}>
              <Text style={s.humanStatNum}>{finalFeedback.responseCount || 0}</Text>
              <Text style={s.humanStatLabel}>Reviews</Text>
            </View>
          </View>

          {finalFeedback.strengths?.length > 0 && (
            <View style={s.feedbackCard}>
              <Text style={s.feedbackTitle}>💪 Strengths (from insiders)</Text>
              {finalFeedback.strengths.map((item, i) => (
                <View key={i} style={s.bulletRow}>
                  <Text style={[s.bulletDot, { color: '#10B981' }]}>✓</Text>
                  <Text style={s.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {finalFeedback.weaknesses?.length > 0 && (
            <View style={s.feedbackCard}>
              <Text style={s.feedbackTitle}>📌 Areas to Improve</Text>
              {finalFeedback.weaknesses.map((item, i) => (
                <View key={i} style={s.bulletRow}>
                  <Text style={[s.bulletDot, { color: '#F59E0B' }]}>→</Text>
                  <Text style={s.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {finalFeedback.suggestions?.length > 0 && (
            <View style={s.feedbackCard}>
              <Text style={s.feedbackTitle}>💡 Suggestions</Text>
              {finalFeedback.suggestions.map((item, i) => (
                <View key={i} style={s.bulletRow}>
                  <Text style={[s.bulletDot, { color: '#8B5CF6' }]}>•</Text>
                  <Text style={s.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Individual Reviewer Cards */}
      {responses.length > 0 && (
        <View style={s.humanSection}>
          {!finalFeedback && (
            <View style={s.humanHeader}>
              <Ionicons name="people" size={20} color={colors.primary} />
              <Text style={s.humanTitle}>Insider Feedback</Text>
            </View>
          )}
          {responses.map((rev, idx) => (
            <View key={idx} style={s.reviewerCard}>
              <View style={s.reviewerHeader}>
                <View style={s.reviewerAvatar}>
                  <Ionicons name="person" size={16} color={colors.primary} />
                </View>
                <Text style={s.reviewerLabel}>Reviewer {idx + 1}</Text>
                <View style={[s.referBadge, { backgroundColor: rev.wouldRefer ? '#10B98115' : '#EF444415' }]}>
                  <Ionicons name={rev.wouldRefer ? 'thumbs-up' : 'thumbs-down'} size={12} color={rev.wouldRefer ? '#10B981' : '#EF4444'} />
                  <Text style={[s.referBadgeText, { color: rev.wouldRefer ? '#10B981' : '#EF4444' }]}>
                    {rev.wouldRefer ? 'Would refer' : 'Would not refer'}
                  </Text>
                </View>
              </View>
              <View style={s.reviewerStars}>
                {[1,2,3,4,5].map(n => (
                  <Ionicons key={n} name={n <= rev.overallRating ? 'star' : 'star-outline'} size={16} color={n <= rev.overallRating ? '#F59E0B' : colors.border} />
                ))}
                {rev.profileFit > 0 && (
                  <Text style={s.reviewerFit}>Fit: {rev.profileFit}/5</Text>
                )}
              </View>
              {rev.strengths ? <Text style={s.reviewerFeedback}><Text style={{ fontWeight: '700', color: '#10B981' }}>Strengths:</Text> {rev.strengths}</Text> : null}
              {rev.weaknesses ? <Text style={s.reviewerFeedback}><Text style={{ fontWeight: '700', color: '#F59E0B' }}>Improve:</Text> {rev.weaknesses}</Text> : null}
              {rev.suggestions ? <Text style={s.reviewerFeedback}><Text style={{ fontWeight: '700', color: '#3B82F6' }}>Suggestion:</Text> {rev.suggestions}</Text> : null}
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={s.resetBtn} onPress={handleReset} activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
        <Text style={s.resetBtnText}>Submit Another Review</Text>
      </TouchableOpacity>
    </ScrollView>
  ) : null;

  // ── RENDER ───────────────────────────────────────────────
  return (
    <View style={s.container}>
      <SubScreenHeader title="Blind Review" fallbackTab="Services" />

      {isDesktop ? (
        <View style={s.desktopLayout}>
          <View style={s.desktopLeft}>{inputPanel}</View>
          <View style={s.desktopRight}>
            {view === 'analyzing' ? analyzingView : view === 'results' && data ? resultsPanel : (
              <View style={s.emptyRight}>
                <Ionicons name="shield-checkmark-outline" size={48} color={colors.border} />
                <Text style={s.emptyText}>Your blind review results will appear here</Text>
                <Text style={s.emptySubText}>Instant AI score + honest feedback from insiders</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={s.inner}>
          {(view === 'input' || view === 'history') && inputPanel}
          {view === 'analyzing' && analyzingView}
          {view === 'results' && resultsPanel}
        </View>
      )}

      <SignInBottomSheet visible={showSignIn} onClose={() => setShowSignIn(false)} navigation={navigation} />
      <ConfirmPurchaseModal
        visible={showPurchase}
        currentBalance={walletBalance}
        requiredAmount={costPerUse}
        contextType="tool"
        itemName="Blind Profile Review"
        onProceed={async () => { setShowPurchase(false); await executeSubmit(); }}
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
  heroIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 12 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 6, maxWidth: 360 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
  heroChip: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  heroChipText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  historyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginTop: 12, paddingVertical: 8 },
  historyBtnText: { fontSize: 13, fontWeight: '600', color: c.primary },

  fieldsWrap: { paddingHorizontal: 16, marginTop: 16 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 8 },
  input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: c.text },

  searchInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: c.text },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, marginTop: 4, maxHeight: 260, zIndex: 9999, ...(Platform.OS === 'web' ? { boxShadow: '0 8px 24px rgba(0,0,0,0.15)' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }) },
  dropdownLoading: { padding: 20, alignItems: 'center' },
  dropdownEmpty: { padding: 16, alignItems: 'center' },
  dropdownEmptyText: { fontSize: 13, color: c.textSecondary },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  orgLogo: { width: 32, height: 32, borderRadius: 8, backgroundColor: c.primary + '15', justifyContent: 'center', alignItems: 'center' },
  orgLogoImg: { width: 32, height: 32, borderRadius: 8 },
  orgLogoText: { fontSize: 14, fontWeight: '700', color: c.primary },
  orgName: { fontSize: 14, fontWeight: '600', color: c.text },
  orgIndustry: { fontSize: 11, color: c.textSecondary },
  tierBadge: { backgroundColor: '#F59E0B15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tierBadgeText: { fontSize: 10, fontWeight: '700', color: '#F59E0B' },

  sourceToggle: { flexDirection: 'row', gap: 10, marginTop: 8 },
  sourceBtn: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, gap: 4 },
  sourceBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
  sourceBtnText: { fontSize: 13, fontWeight: '600', color: c.text },
  sourceBtnTextActive: { color: '#fff' },
  sourceBtnHint: { fontSize: 10, color: c.textSecondary },

  resumeList: { gap: 8, marginTop: 8 },
  resumeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border },
  resumeCardSelected: { borderColor: c.primary, backgroundColor: c.primary + '08' },
  resumeName: { fontSize: 14, fontWeight: '600', color: c.text },
  resumeDate: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
  primaryBadge: { backgroundColor: c.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  primaryBadgeText: { fontSize: 10, fontWeight: '700', color: c.primary },
  noResumeBox: { padding: 20, alignItems: 'center', backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', marginTop: 8 },
  noResumeText: { fontSize: 13, color: c.textSecondary, marginBottom: 12 },
  uploadResumeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: c.primary + '10' },
  uploadResumeBtnText: { fontSize: 13, fontWeight: '600', color: c.primary },

  previewCard: { padding: 16, backgroundColor: c.primary + '08', borderRadius: 12, borderWidth: 1, borderColor: c.primary + '20', alignItems: 'center', gap: 8 },
  previewTitle: { fontSize: 14, fontWeight: '700', color: c.text },
  previewText: { fontSize: 12, lineHeight: 18, color: c.textSecondary, textAlign: 'center' },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, padding: 12, backgroundColor: (c.error || '#EF4444') + '10', borderRadius: 10, borderWidth: 1, borderColor: (c.error || '#EF4444') + '20' },
  errorText: { fontSize: 13, color: c.error || '#EF4444', flex: 1 },

  ctaWrap: { paddingHorizontal: 16, marginTop: 20, alignItems: 'center' },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.accentDark || '#6C3AED', width: '100%', paddingVertical: 16, borderRadius: 14, shadowColor: '#6C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  freeLabel: { fontSize: 12, color: c.textSecondary, marginTop: 8 },

  analyzingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  analyzingEmoji: { fontSize: 64 },
  analyzingLabel: { fontSize: 17, fontWeight: '600', color: c.text, marginTop: 16, textAlign: 'center' },
  analyzingHint: { fontSize: 12, color: c.textSecondary, marginTop: 12 },

  scoreCard: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  scoreLabel: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  targetLabel: { fontSize: 13, color: c.textSecondary, marginTop: 4 },
  scoreSubLabel: { fontSize: 11, color: c.textSecondary, marginTop: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  statusCard: { marginHorizontal: 16, marginBottom: 12 },
  statusBadgePill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  statusBadgeText: { fontSize: 13, fontWeight: '600', flex: 1 },

  feedbackCard: { marginHorizontal: 16, padding: 16, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
  feedbackHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  feedbackIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  feedbackTitle: { fontSize: 14, fontWeight: '700', color: c.text },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bulletDot: { fontSize: 13, fontWeight: '800', lineHeight: 19 },
  bulletText: { fontSize: 13, color: c.text, flex: 1, lineHeight: 19 },

  recommendCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, padding: 14, backgroundColor: '#8B5CF608', borderRadius: 12, borderWidth: 1, borderColor: '#8B5CF620', marginBottom: 12 },
  recommendText: { fontSize: 13, color: c.text, flex: 1, lineHeight: 19, fontStyle: 'italic' },

  anonCard: { marginHorizontal: 16, padding: 16, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: 12 },
  anonTitle: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 2 },
  anonHint: { fontSize: 11, color: c.textSecondary, marginBottom: 12 },
  anonRow: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.border + '50', gap: 8 },
  anonLabel: { fontSize: 12, fontWeight: '600', color: c.textSecondary, width: 90 },
  anonValue: { fontSize: 13, color: c.text, flex: 1 },
  anonHighlight: { fontSize: 12, color: c.textSecondary, lineHeight: 17, marginTop: 2, paddingLeft: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 },
  skillChip: { backgroundColor: c.primary + '10', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  skillChipText: { fontSize: 11, fontWeight: '600', color: c.primary },

  humanSection: { marginTop: 8 },
  humanHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12 },
  humanTitle: { fontSize: 16, fontWeight: '800', color: c.text },
  humanSummaryCard: { marginHorizontal: 16, padding: 14, backgroundColor: c.primary + '08', borderRadius: 12, borderWidth: 1, borderColor: c.primary + '15', marginBottom: 12 },
  humanSummaryText: { fontSize: 13, color: c.text, lineHeight: 20, fontStyle: 'italic' },
  humanStatsRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 12 },
  humanStatCard: { flex: 1, padding: 12, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
  humanStatNum: { fontSize: 22, fontWeight: '800', color: c.text },
  humanStatLabel: { fontSize: 10, fontWeight: '600', color: c.textSecondary, marginTop: 2, textTransform: 'uppercase' },

  // Individual reviewer cards
  reviewerCard: { marginHorizontal: 16, marginBottom: 10, padding: 14, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border },
  reviewerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  reviewerAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.primary + '15', justifyContent: 'center', alignItems: 'center' },
  reviewerLabel: { fontSize: 13, fontWeight: '700', color: c.text, flex: 1 },
  referBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  referBadgeText: { fontSize: 11, fontWeight: '700' },
  reviewerStars: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8 },
  reviewerFit: { fontSize: 11, color: c.textSecondary, marginLeft: 8 },
  reviewerFeedback: { fontSize: 12, color: c.textSecondary, lineHeight: 17, marginBottom: 4 },

  historyWrap: { paddingHorizontal: 16, marginTop: 8 },
  historyCard: { padding: 14, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  historyRole: { fontSize: 14, fontWeight: '700', color: c.text },
  historyOrg: { fontSize: 12, color: c.textSecondary, marginTop: 1 },
  historyScore: { fontSize: 18, fontWeight: '800' },
  historyDate: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
  historyMeta: { flexDirection: 'row', marginTop: 8 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusPillText: { fontSize: 11, fontWeight: '600' },
  emptyHistory: { alignItems: 'center', padding: 40 },
  emptyHistoryText: { fontSize: 16, fontWeight: '700', color: c.text, marginTop: 12 },
  emptyHistorySub: { fontSize: 13, color: c.textSecondary, marginTop: 4 },

  // Get Referred CTA - prominent, animated
  getReferredBtn: { marginHorizontal: 16, marginTop: 16, marginBottom: 12, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  getReferredInner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18, paddingHorizontal: 18 },
  getReferredTitle: { fontSize: 15, fontWeight: '800', color: '#fff', lineHeight: 20 },
  getReferredSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginTop: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: c.primary + '30', backgroundColor: c.primary + '06' },
  resetBtnText: { fontSize: 14, fontWeight: '600', color: c.primary },

  emptyRight: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15, color: c.textSecondary, marginTop: 12, textAlign: 'center' },
  emptySubText: { fontSize: 12, color: c.textSecondary, marginTop: 4, textAlign: 'center' },
});
