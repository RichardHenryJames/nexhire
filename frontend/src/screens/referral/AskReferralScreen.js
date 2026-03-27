import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePricing } from '../../contexts/PricingContext';
import useResponsive from '../../hooks/useResponsive';
import refopenAPI from '../../services/api';
import { typography } from '../../styles/theme';
import { showToast } from '../../components/Toast';
import { invalidateCache, CACHE_KEYS } from '../../utils/homeCache';
import WalletRechargeModal from '../../components/WalletRechargeModal';
import ResumeUploadModal from '../../components/ResumeUploadModal';
import ReferralSuccessOverlay from '../../components/ReferralSuccessOverlay';
import ConfirmPurchaseModal from '../../components/ConfirmPurchaseModal';
import TabHeader from '../../components/TabHeader';
import CachedImage from '../../components/CachedImage';
import AnimatedSection from '../../components/auth/AnimatedSection';

const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const h = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(h); }, [value, delay]);
  return debounced;
};

export default function AskReferralScreen({ navigation, route }) {
  const { user, isJobSeeker, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const { pricing } = usePricing();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const requireAuth = (action) => {
    if (!isAuthenticated || !user) { navigation.navigate('Auth', { screen: 'Login', params: { returnTo: 'AskReferral', returnParams: route?.params } }); return false; }
    return true;
  };

  // ─── States ──────────────────────────────────────────────────
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [companies, setCompanies] = useState([]);
  const [openToAny, setOpenToAny] = useState(true);

  // Company
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const debouncedCompanySearch = useDebounce(companySearch, 300);
  const preSelectedOrganization = route?.params?.preSelectedOrganization;

  // Form
  const [jobTitle, setJobTitle] = useState('');
  const [jobId, setJobId] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [referralMessage, setReferralMessage] = useState('');
  const [minSalary, setMinSalary] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('INR');
  const [salaryPeriod, setSalaryPeriod] = useState('Annual');
  const [preferredLocations, setPreferredLocations] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [errors, setErrors] = useState({});

  // Modals
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalData, setWalletModalData] = useState({ currentBalance: 0, requiredAmount: 0 });
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [referralCompanyName, setReferralCompanyName] = useState('');
  const [referralBroadcastTime, setReferralBroadcastTime] = useState(null);

  // ─── Social Proof: Fortune 500 Ticker ────────────────────────
  const [fortune500, setFortune500] = useState([]);
  const [tickerIdx, setTickerIdx] = useState(0);
  const tickerFade = useRef(new Animated.Value(1)).current;

  const dailyRefCount = useMemo(() => {
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    const hash = Math.abs(Math.floor(Math.sin(seed * 2) * 10000));
    const hr = d.getHours(); const min = d.getMinutes();
    const R = [.3,.2,.2,.1,.1,.2,.5,1.2,2,3,3.8,4.2,4.5,4.3,4,3.5,3,2.5,2,1.5,1,.7,.5,.4];
    const C = R.reduce((a, v) => { a.push((a.length ? a[a.length-1] : 0) + v); return a; }, []);
    const total = C[C.length-1];
    const cum = (hr > 0 ? C[hr-1] : 0) + R[hr] * (min / 60);
    return Math.max(5, Math.round((150 + (hash % 200)) * (cum / total)));
  }, []);

  const [referrersOnline, setReferrersOnline] = useState(() => {
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    const hash = Math.abs(Math.floor(Math.sin(seed * 6) * 10000));
    const hr = d.getHours(); const min = d.getMinutes();
    const T = [.08,.06,.05,.04,.04,.06,.12,.25,.45,.65,.82,.95,1,.98,.95,.88,.78,.65,.5,.38,.28,.2,.14,.1];
    const m = T[hr] + (T[(hr+1)%24] - T[hr]) * (min/60);
    const j = (Math.abs(Math.floor(Math.sin((seed + Math.floor((hr*60+min)/2)) * 11) * 100)) % 201) - 100;
    return Math.max(1000, Math.round(3000 + (hash % 5000) + 13000 * m + j));
  });

  useEffect(() => {
    const iv = setInterval(() => {
      const d = new Date();
      const seed = d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
      const hash = Math.abs(Math.floor(Math.sin(seed*6)*10000));
      const hr = d.getHours(); const min = d.getMinutes();
      const T = [.08,.06,.05,.04,.04,.06,.12,.25,.45,.65,.82,.95,1,.98,.95,.88,.78,.65,.5,.38,.28,.2,.14,.1];
      const m = T[hr] + (T[(hr+1)%24] - T[hr]) * (min/60);
      const j = (Math.abs(Math.floor(Math.sin((seed + Math.floor((hr*60+min)/2))*11)*100))%201)-100;
      setReferrersOnline(Math.max(1000, Math.round(3000+(hash%5000)+13000*m+j)));
    }, 120000);
    return () => clearInterval(iv);
  }, []);

  // Fortune 500 rotation
  useEffect(() => {
    const f500 = companies.filter(c => (c.isFortune500 === 1 || c.isFortune500 === true || c.isFortune500 === '1') && c.logoURL);
    if (f500.length > 0) setFortune500([...f500].sort(() => Math.random() - 0.5));
  }, [companies]);

  useEffect(() => {
    if (fortune500.length < 2) return;
    const iv = setInterval(() => {
      Animated.timing(tickerFade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setTickerIdx(p => (p + 1) % fortune500.length);
        Animated.timing(tickerFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(iv);
  }, [fortune500, tickerFade]);

  // ─── Pricing ─────────────────────────────────────────────────
  const getEffectiveCost = () => {
    if (openToAny) return pricing.openToAnyReferralCost;
    const tier = selectedCompany?.tier || 'Standard';
    if (tier === 'Elite') return pricing.eliteReferralCost || 199;
    if (tier === 'Premium') return pricing.premiumReferralCost || 99;
    return pricing.referralRequestCost;
  };
  const effectiveCost = getEffectiveCost();

  useEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);

  // ─── Data Loading ────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated && user) { loadWalletBalance(); loadResumes(); }
    else setLoadingWallet(false);
    loadCompanies();
    if (preSelectedOrganization) { setSelectedCompany(preSelectedOrganization); setOpenToAny(false); }
  }, [preSelectedOrganization]);

  const loadResumes = async () => {
    setLoadingResumes(true);
    try {
      const res = await refopenAPI.getUserResumes();
      if (res?.success && res.data) {
        const sorted = [...res.data].sort((a, b) => { if (a.IsPrimary && !b.IsPrimary) return -1; if (!a.IsPrimary && b.IsPrimary) return 1; return new Date(b.UploadedAt||0) - new Date(a.UploadedAt||0); });
        setResumes(sorted);
        if (sorted[0]?.ResumeID) setSelectedResumeId(sorted[0].ResumeID);
      }
    } catch(e) {} finally { setLoadingResumes(false); }
  };
  const loadWalletBalance = async () => {
    setLoadingWallet(true);
    try { const r = await refopenAPI.getWalletBalance(); if (r?.success) setWalletBalance(r.data?.availableBalance ?? r.data?.balance ?? 0); }
    catch(e) {} finally { setLoadingWallet(false); }
  };
  const loadCompanies = async () => {
    try { const r = await refopenAPI.getOrganizations(''); if (r?.success && Array.isArray(r.data)) setCompanies(r.data); }
    catch(e) {}
  };

  // ─── Company Search ──────────────────────────────────────────
  useEffect(() => {
    if (!showCompanyDropdown) return;
    (async () => {
      setOrgLoading(true);
      try {
        const res = await refopenAPI.getOrganizations(debouncedCompanySearch || '', null);
        const raw = res?.success && Array.isArray(res.data) ? res.data.filter(o => o.id !== 999999) : [];
        if (debouncedCompanySearch?.trim()) {
          const s = debouncedCompanySearch.toLowerCase();
          const m = raw.filter(o => o.name?.toLowerCase().includes(s));
          m.sort((a,b) => (a.name?.toLowerCase().startsWith(s)?0:1) - (b.name?.toLowerCase().startsWith(s)?0:1));
          setOrgResults(m);
        } else { setOrgResults(raw); }
      } catch(e) { setOrgResults([]); } finally { setOrgLoading(false); }
    })();
  }, [debouncedCompanySearch, showCompanyDropdown]);

  // ─── Handlers ────────────────────────────────────────────────
  const handleSelectCompany = (org) => { setSelectedCompany(org); setCompanySearch(''); setShowCompanyDropdown(false); if (errors.company) setErrors(p => ({...p, company: null})); };
  const handleResumeSelected = async (data) => { setSelectedResumeId(data.ResumeID); await loadResumes(); setShowResumeModal(false); if (errors.resume) setErrors(p => ({...p, resume: null})); };
  const switchMode = (isOpen) => { setOpenToAny(isOpen); if (isOpen) { setSelectedCompany(null); setJobId(''); setErrors({}); } };

  const validateForm = () => {
    const e = {};
    if (!openToAny && !selectedCompany) e.company = 'Select a company';
    if (!jobTitle.trim()) e.jobTitle = 'Job title is required';
    if (!openToAny && !jobId.trim()) e.jobId = 'Job ID is required';
    if (!selectedResumeId) e.resume = 'Select a resume';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleAskReferral = () => { if (!requireAuth('ask referral')) return; if (!validateForm()) return; setShowConfirmModal(true); };

  const handleSubmit = async () => {
    const startTime = Date.now(); setSubmitting(true);
    try {
      const req = {
        jobID: null, extJobID: openToAny ? undefined : jobId, resumeID: selectedResumeId,
        jobTitle: jobTitle.trim(), companyName: selectedCompany?.name || undefined,
        organizationId: selectedCompany?.id?.toString() || undefined,
        referralMessage: referralMessage || undefined, openToAnyCompany: openToAny || undefined,
        ...(openToAny && minSalary ? { minSalary: parseFloat(minSalary), salaryCurrency, salaryPeriod } : {}),
        ...(openToAny && preferredLocations.trim() ? { preferredLocations: preferredLocations.trim() } : {}),
      };
      const result = await refopenAPI.createReferralRequest(req);
      if (result?.success) {
        setReferralCompanyName(openToAny ? 'All Companies' : (selectedCompany?.name || ''));
        setReferralBroadcastTime((Date.now() - startTime) / 1000);
        setShowSuccessOverlay(true);
        invalidateCache(CACHE_KEYS.REFERRER_REQUESTS, CACHE_KEYS.WALLET_BALANCE, CACHE_KEYS.DASHBOARD_STATS);
        if (result.data?.availableBalanceAfter !== undefined) setWalletBalance(result.data.availableBalanceAfter);
        setJobTitle(''); setJobId(''); setReferralMessage(''); setMinSalary(''); setPreferredLocations('');
        setSelectedCompany(null); setOpenToAny(true); setErrors({}); setShowOptional(false);
      } else if (result.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
        setWalletModalData({ currentBalance: result.data?.currentBalance || 0, requiredAmount: result.data?.requiredAmount || effectiveCost });
        setShowWalletModal(true);
      } else { showToast(result?.error || 'Failed to submit', 'error'); }
    } catch(error) { showToast(error?.message || 'An error occurred', 'error'); }
    finally { setSubmitting(false); }
  };

  const selectedResume = resumes.find(r => r.ResumeID === selectedResumeId);

  if (isAuthenticated && !isJobSeeker) {
    return (<View style={styles.gate}><Ionicons name="lock-closed" size={64} color={colors.gray400} /><Text style={styles.gateTitle}>Access Restricted</Text><Text style={styles.gateSub}>Only job seekers can request referrals.</Text></View>);
  }

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TabHeader navigation={navigation} showWallet walletBalance={loadingWallet ? null : walletBalance} />

      <View style={styles.inner}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

          {showCompanyDropdown && (
            <Pressable style={Platform.OS === 'web' ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9990 } : { position: 'absolute', top: -1000, left: -1000, right: -1000, bottom: -1000, zIndex: 9990 }}
              onPress={() => { setShowCompanyDropdown(false); setCompanySearch(''); }} />
          )}

          {/* ── Social Proof Bar (subtle, not cluttered) ─── */}
          <AnimatedSection delay={0}>
            <View style={styles.proofBar}>
              <View style={styles.proofStats}>
                <View style={styles.proofDot} />
                <Text style={styles.proofOnline}>{referrersOnline.toLocaleString('en-IN')}</Text>
                <Text style={styles.proofLabel}>referrers online</Text>
                <Text style={styles.proofSep}>·</Text>
                <Text style={styles.proofCount}>{dailyRefCount}</Text>
                <Text style={styles.proofLabel}>referrals today</Text>
              </View>

              {fortune500.length > 0 && (
                <Animated.View style={[styles.tickerRow, { opacity: tickerFade }]}>
                  <CachedImage source={{ uri: fortune500[tickerIdx]?.logoURL }} style={styles.tickerLogo} resizeMode="contain" />
                  <Text style={styles.tickerText}>Someone just got referred at </Text>
                  <Text style={styles.tickerCompany}>{fortune500[tickerIdx]?.name}</Text>
                  <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
                </Animated.View>
              )}
            </View>
          </AnimatedSection>

          {/* ── Header ──────────────────────────────────── */}
          <AnimatedSection delay={100}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Get Referred</Text>
              <Text style={styles.headerSub}>Choose how you want to be referred</Text>
            </View>
          </AnimatedSection>

          {/* ── Mode Toggle ─────────────────────────────── */}
          <AnimatedSection delay={200}>
            <View style={styles.modeToggle}>
              <TouchableOpacity style={[styles.modeBtn, openToAny && styles.modeBtnActive, openToAny && { borderColor: '#8B5CF6' }]} onPress={() => switchMode(true)} activeOpacity={0.8}>
                <Ionicons name="globe-outline" size={20} color={openToAny ? '#8B5CF6' : colors.gray400} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.modeBtnTitle, openToAny && { color: '#8B5CF6' }]}>Open to Any</Text>
                  <Text style={styles.modeBtnDesc}>Broadcast to all referrers</Text>
                </View>
                <Text style={[styles.modePrice, openToAny && { color: '#8B5CF6' }]}>₹{pricing.openToAnyReferralCost}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeBtn, !openToAny && styles.modeBtnActive]} onPress={() => switchMode(false)} activeOpacity={0.8}>
                <Ionicons name="business-outline" size={20} color={!openToAny ? colors.primary : colors.gray400} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.modeBtnTitle, !openToAny && { color: colors.primary }]}>Specific Company</Text>
                  <Text style={styles.modeBtnDesc}>Target one company</Text>
                </View>
                <Text style={[styles.modePrice, !openToAny && { color: colors.primary }]}>₹{pricing.referralRequestCost}</Text>
              </TouchableOpacity>
            </View>
          </AnimatedSection>

          {/* ── Company (Specific only, dropdown-only — no random names) */}
          <AnimatedSection delay={300}>
          {!openToAny && (
            <View style={[styles.fieldGroup, { zIndex: showCompanyDropdown ? 9999 : 1 }]}>
              <Text style={styles.fieldLabel}>Which company? <Text style={styles.req}>*</Text></Text>
              <View style={{ position: 'relative', zIndex: showCompanyDropdown ? 9999 : 1 }}>
                <View style={[styles.searchWrap, selectedCompany && !showCompanyDropdown && styles.searchWrapDone]}>
                  <Ionicons name="search" size={18} color={selectedCompany && !showCompanyDropdown ? colors.success : colors.gray400} style={{ marginRight: 10 }} />
                  <TextInput style={styles.searchInner} placeholder="Search company..." placeholderTextColor={colors.gray500}
                    value={showCompanyDropdown ? companySearch : (selectedCompany?.name || '')}
                    onChangeText={t => { setCompanySearch(t); if (!showCompanyDropdown) { setShowCompanyDropdown(true); setSelectedCompany(null); } }}
                    onFocus={() => { setShowCompanyDropdown(true); setCompanySearch(''); }}
                    autoCorrect={false} autoCapitalize="words" />
                </View>
                {selectedCompany && !showCompanyDropdown && (
                  <TouchableOpacity style={styles.clearBtn} onPress={() => { setSelectedCompany(null); setShowCompanyDropdown(true); setCompanySearch(''); }}>
                    <Ionicons name="close-circle" size={18} color={colors.gray400} />
                  </TouchableOpacity>
                )}
                {showCompanyDropdown && (
                  <View style={styles.dropdown}>
                    {orgLoading ? (
                      <View style={styles.ddLoad}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.ddLoadText}>Searching...</Text></View>
                    ) : orgResults.length > 0 ? (
                      <ScrollView style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                        {orgResults.slice(0, 15).map(org => (
                          <TouchableOpacity key={org.id} style={styles.ddItem} onPress={() => handleSelectCompany(org)}>
                            {org.logoURL ? <CachedImage source={{ uri: org.logoURL }} style={styles.ddLogo} resizeMode="contain" />
                              : <View style={styles.ddLogoPlaceholder}><Ionicons name="business" size={16} color={colors.gray400} /></View>}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.ddName}>{org.name}</Text>
                              {org.industry && org.industry !== 'Other' && <Text style={styles.ddIndustry}>{org.industry}</Text>}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    ) : companySearch.length > 1 ? (
                      <View style={styles.ddEmpty}><Ionicons name="alert-circle-outline" size={16} color={colors.textMuted} /><Text style={styles.ddEmptyText}>No company found. Check the spelling.</Text></View>
                    ) : null}
                  </View>
                )}
              </View>
              {errors.company && <Text style={styles.fieldError}>{errors.company}</Text>}
            </View>
          )}
          </AnimatedSection>

          {/* ── Job Title ──────────────────────────────── */}
          <AnimatedSection delay={350}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>What role are you looking for? <Text style={styles.req}>*</Text></Text>
              <TextInput style={[styles.fieldInput, errors.jobTitle && styles.fieldInputError]} placeholder="e.g. Senior Software Engineer" placeholderTextColor={colors.gray500} value={jobTitle} onChangeText={t => { setJobTitle(t); if (errors.jobTitle) setErrors(p => ({...p, jobTitle:null})); }} maxLength={200} />
              {errors.jobTitle && <Text style={styles.fieldError}>{errors.jobTitle}</Text>}
            </View>
          </AnimatedSection>

          {/* ── Job ID (Specific only) ─────────────────── */}
          {!openToAny && (
            <AnimatedSection delay={400}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Job ID / Reference <Text style={styles.req}>*</Text></Text>
                <TextInput style={[styles.fieldInput, errors.jobId && styles.fieldInputError]} placeholder="e.g. REQ-2024-001" placeholderTextColor={colors.gray500} value={jobId} onChangeText={t => { setJobId(t); if (errors.jobId) setErrors(p => ({...p, jobId:null})); }} maxLength={100} />
                <Text style={styles.fieldHint}>Find this on the company's career page</Text>
                {errors.jobId && <Text style={styles.fieldError}>{errors.jobId}</Text>}
              </View>
            </AnimatedSection>
          )}

          {/* ── Resume ─────────────────────────────────── */}
          <AnimatedSection delay={450}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Resume <Text style={styles.req}>*</Text></Text>
              {loadingResumes ? (
                <View style={styles.resumeLoad}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.resumeLoadText}>Loading...</Text></View>
              ) : selectedResume ? (
                <View style={styles.resumePill}>
                  <Ionicons name="document-text" size={18} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}><Text style={styles.resumeName} numberOfLines={1}>{selectedResume.ResumeLabel}</Text>{selectedResume.IsPrimary && <Text style={styles.resumePrimary}>Primary</Text>}</View>
                  <TouchableOpacity style={styles.resumeChangeBtn} onPress={() => { if (requireAuth('resume')) setShowResumeModal(true); }}><Text style={styles.resumeChangeBtnText}>Change</Text></TouchableOpacity>
                </View>
              ) : resumes.length > 0 ? (
                <View style={styles.resumeList}>
                  {resumes.slice(0,3).map(r => (
                    <TouchableOpacity key={r.ResumeID} style={[styles.resumeItem, selectedResumeId === r.ResumeID && styles.resumeItemActive]} onPress={() => setSelectedResumeId(r.ResumeID)}>
                      <Ionicons name="document-text" size={16} color={selectedResumeId === r.ResumeID ? colors.primary : colors.gray400} />
                      <Text style={[styles.resumeItemLabel, selectedResumeId === r.ResumeID && { color: colors.primary }]} numberOfLines={1}>{r.ResumeLabel}</Text>
                      <View style={[styles.radio, selectedResumeId === r.ResumeID && styles.radioActive]}>{selectedResumeId === r.ResumeID && <View style={styles.radioInner} />}</View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadCTA} onPress={() => { if (requireAuth('upload')) setShowResumeModal(true); }}>
                  <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                  <Text style={styles.uploadCTATitle}>Upload your resume</Text>
                  <Text style={styles.uploadCTASub}>PDF or DOC, max 5MB</Text>
                </TouchableOpacity>
              )}
              {errors.resume && <Text style={styles.fieldError}>{errors.resume}</Text>}
            </View>
          </AnimatedSection>

          {/* ── Optional Fields Toggle ─────────────────── */}
          <AnimatedSection delay={500}>
            <TouchableOpacity style={styles.optionalToggle} onPress={() => setShowOptional(!showOptional)} activeOpacity={0.7}>
              <Ionicons name={showOptional ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
              <Text style={styles.optionalToggleText}>{showOptional ? 'Hide' : 'Show'} optional details</Text>
            </TouchableOpacity>

            {showOptional && (
              <View style={{ paddingHorizontal: 16 }}>
                {/* Salary (Open mode) */}
                {openToAny && (
                  <View style={styles.fieldGroupInner}>
                    <Text style={styles.fieldLabel}>Expected Salary</Text>
                    <View style={styles.salaryRow}>
                      <TouchableOpacity style={styles.salaryPrefix} onPress={() => setSalaryCurrency(c => c === 'INR' ? 'USD' : 'INR')}>
                        <Text style={styles.salaryPrefixText}>{salaryCurrency === 'INR' ? '₹' : '$'}</Text>
                      </TouchableOpacity>
                      <TextInput style={styles.salaryInput} placeholder={salaryCurrency === 'INR' ? '15,00,000' : '120,000'} placeholderTextColor={colors.gray500} value={minSalary} onChangeText={v => setMinSalary(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" maxLength={10} />
                      <TouchableOpacity style={styles.salarySuffix} onPress={() => setSalaryPeriod(p => p === 'Annual' ? 'Monthly' : 'Annual')}>
                        <Text style={styles.salarySuffixText}>{salaryPeriod === 'Annual' ? '/yr' : '/mo'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Locations (Open mode) */}
                {openToAny && (
                  <View style={styles.fieldGroupInner}>
                    <Text style={styles.fieldLabel}>Preferred Locations</Text>
                    <TextInput style={styles.fieldInput} placeholder="e.g. Bangalore, Hyderabad, Remote" placeholderTextColor={colors.gray500} value={preferredLocations} onChangeText={setPreferredLocations} maxLength={200} />
                    <Text style={styles.fieldHint}>Comma-separated city preferences</Text>
                  </View>
                )}

                {/* Message */}
                <View style={styles.fieldGroupInner}>
                  <Text style={styles.fieldLabel}>Message to Referrer</Text>
                  <TextInput style={styles.textArea} placeholder="Why you're a great fit..." placeholderTextColor={colors.gray500} value={referralMessage} onChangeText={setReferralMessage} multiline numberOfLines={3} maxLength={1000} textAlignVertical="top" />
                  <Text style={styles.fieldHint}>{referralMessage.length}/1000</Text>
                </View>
              </View>
            )}
          </AnimatedSection>

        </ScrollView>

        {/* ── Sticky Bottom ─────────────────────────────── */}
        <View style={styles.stickyBottom}>
          <View style={styles.stickySummary}>
            <View><Text style={styles.stickyLabel}>Total</Text><Text style={[styles.stickyPrice, openToAny && { color: '#8B5CF6' }]}>₹{effectiveCost}</Text></View>
            <View style={styles.stickyWallet}><Ionicons name="wallet-outline" size={14} color={colors.success} /><Text style={styles.stickyBalance}>{loadingWallet ? '...' : `₹${walletBalance.toFixed(0)}`}</Text></View>
          </View>
          <TouchableOpacity style={[styles.submitBtn, openToAny && { backgroundColor: '#8B5CF6' }, submitting && { opacity: 0.6 }]} onPress={handleAskReferral} disabled={submitting} activeOpacity={0.85}>
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="paper-plane" size={18} color="#fff" /><Text style={styles.submitBtnText}>Send Request</Text></>}
          </TouchableOpacity>
        </View>
      </View>

      <ResumeUploadModal visible={showResumeModal} onClose={() => setShowResumeModal(false)} onResumeSelected={handleResumeSelected} user={user} jobTitle={jobTitle || 'Job Application'} />
      <WalletRechargeModal visible={showWalletModal} currentBalance={walletModalData.currentBalance} requiredAmount={walletModalData.requiredAmount} onAddMoney={() => { setShowWalletModal(false); navigation.navigate('WalletRecharge'); }} onCancel={() => setShowWalletModal(false)} />
      <ConfirmPurchaseModal visible={showConfirmModal} currentBalance={walletBalance} requiredAmount={effectiveCost} contextType="referral" itemName={jobTitle || 'this job'} onProceed={async () => { setShowConfirmModal(false); await handleSubmit(); }} onAddMoney={() => { setShowConfirmModal(false); navigation.navigate('WalletRecharge'); }} onCancel={() => setShowConfirmModal(false)} />
      <ReferralSuccessOverlay visible={showSuccessOverlay} onComplete={() => { setShowSuccessOverlay(false); navigation.goBack(); }} duration={3500} companyName={referralCompanyName} broadcastTime={referralBroadcastTime} isOpenToAny={referralCompanyName === 'All Companies'} />
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, ...(Platform.OS === 'web' && responsive.isDesktop ? { alignItems: 'center' } : {}) },
  inner: { width: '100%', maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 640 : '100%', flex: 1 },
  scroll: { flex: 1 },

  /* Social Proof */
  proofBar: { marginHorizontal: 16, marginTop: 8, marginBottom: 4, backgroundColor: colors.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border },
  proofStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 6 },
  proofDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  proofOnline: { fontSize: 11, color: colors.success, fontWeight: '700' },
  proofLabel: { fontSize: 11, color: colors.textMuted },
  proofSep: { fontSize: 10, color: colors.textMuted },
  proofCount: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  tickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border },
  tickerLogo: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.background },
  tickerText: { fontSize: 12, color: colors.textMuted },
  tickerCompany: { fontSize: 12, fontWeight: '700', color: colors.text, flex: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: (colors.success||'#22C55E') + '15', borderWidth: 1, borderColor: (colors.success||'#22C55E') + '30' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success, marginRight: 4 },
  liveText: { fontSize: 8, fontWeight: '700', color: colors.success, letterSpacing: 0.5 },

  /* Header */
  header: { padding: 20, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.4, marginBottom: 4 },
  headerSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

  /* Mode */
  modeToggle: { paddingHorizontal: 16, gap: 10, marginBottom: 20 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  modeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg || (colors.primary + '08') },
  modeBtnTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  modeBtnDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  modePrice: { fontSize: 17, fontWeight: '700', color: colors.text },

  /* Fields */
  fieldGroup: { paddingHorizontal: 16, marginBottom: 18 },
  fieldGroupInner: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  req: { color: colors.danger || '#EF4444' },
  fieldInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text, backgroundColor: colors.surface },
  fieldInputError: { borderColor: colors.danger || '#EF4444' },
  fieldError: { fontSize: 12, color: colors.danger || '#EF4444', marginTop: 4 },
  fieldHint: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  textArea: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text, backgroundColor: colors.surface, minHeight: 80 },

  /* Company */
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
  searchWrapDone: { borderColor: (colors.success||'#22C55E') + '50', backgroundColor: (colors.success||'#22C55E') + '08' },
  searchInner: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
  clearBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: colors.surfaceElevated || '#2D2D2D', borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginTop: 6, maxHeight: 260, zIndex: 9999, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, overflow: 'hidden' },
  ddLoad: { padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  ddLoadText: { fontSize: 13, color: colors.textMuted },
  ddEmpty: { padding: 16, alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center' },
  ddEmptyText: { fontSize: 13, color: colors.textMuted },
  ddItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  ddLogo: { width: 32, height: 32, borderRadius: 8, marginRight: 12, backgroundColor: colors.background },
  ddLogoPlaceholder: { width: 32, height: 32, borderRadius: 8, marginRight: 12, backgroundColor: colors.gray100 || '#2D2D2D', justifyContent: 'center', alignItems: 'center' },
  ddName: { fontSize: 15, fontWeight: '600', color: colors.text },
  ddIndustry: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  /* Resume */
  resumeLoad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  resumeLoadText: { marginLeft: 10, fontSize: 13, color: colors.textMuted },
  resumePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryBg || (colors.primary + '08'), borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.primary + '30' },
  resumeName: { fontSize: 14, fontWeight: '600', color: colors.text },
  resumePrimary: { fontSize: 10, fontWeight: '700', color: colors.success || '#22C55E', marginTop: 1 },
  resumeChangeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.textSecondary + '20' },
  resumeChangeBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  resumeList: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  resumeItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  resumeItemActive: { backgroundColor: colors.primaryBg || (colors.primary + '08') },
  resumeItemLabel: { flex: 1, fontSize: 14, color: colors.text },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.gray400, justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: colors.primary },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  uploadCTA: { alignItems: 'center', padding: 24, borderWidth: 1, borderColor: colors.border, borderRadius: 12, borderStyle: 'dashed', backgroundColor: colors.surface },
  uploadCTATitle: { fontSize: 15, fontWeight: '600', color: colors.primary, marginTop: 8 },
  uploadCTASub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  /* Optional */
  optionalToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginBottom: 8 },
  optionalToggleText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  salaryRow: { flexDirection: 'row', alignItems: 'center' },
  salaryPrefix: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, paddingHorizontal: 14, paddingVertical: 14 },
  salaryPrefixText: { fontSize: 16, fontWeight: '700', color: colors.text },
  salaryInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 0, borderRightWidth: 0, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: colors.text, backgroundColor: colors.surface },
  salarySuffix: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 14, paddingVertical: 14 },
  salarySuffixText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  /* Sticky */
  stickyBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  stickySummary: { gap: 2 },
  stickyLabel: { fontSize: 11, color: colors.textMuted },
  stickyPrice: { fontSize: 22, fontWeight: '700', color: colors.primary },
  stickyWallet: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  stickyBalance: { fontSize: 12, fontWeight: '600', color: colors.success || '#22C55E' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 14, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  gate: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background },
  gateTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 16 },
  gateSub: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },
});
