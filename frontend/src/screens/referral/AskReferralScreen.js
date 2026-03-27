import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Pressable, Image,
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

const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
};

export default function AskReferralScreen({ navigation, route }) {
  const { user, isJobSeeker, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const { pricing } = usePricing();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // ─── Auth Guard ──────────────────────────────────────────────
  const requireAuth = (action) => {
    if (!isAuthenticated || !user) {
      navigation.navigate('Auth', { screen: 'Login', params: { returnTo: 'AskReferral', returnParams: route?.params } });
      return false;
    }
    return true;
  };

  // ─── Loading States ──────────────────────────────────────────
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ─── Data ────────────────────────────────────────────────────
  const [resumes, setResumes] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);

  // ─── Mode ────────────────────────────────────────────────────
  const [openToAny, setOpenToAny] = useState(true);

  // ─── Company (inline dropdown) ───────────────────────────────
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const debouncedCompanySearch = useDebounce(companySearch, 300);
  const preSelectedOrganization = route?.params?.preSelectedOrganization;

  // ─── Form ────────────────────────────────────────────────────
  const [jobTitle, setJobTitle] = useState('');
  const [jobId, setJobId] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [referralMessage, setReferralMessage] = useState('');
  const [errors, setErrors] = useState({});

  // ─── Modals ──────────────────────────────────────────────────
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalData, setWalletModalData] = useState({ currentBalance: 0, requiredAmount: 0 });
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [referralCompanyName, setReferralCompanyName] = useState('');
  const [referralBroadcastTime, setReferralBroadcastTime] = useState(null);

  // ─── Progressive Reveal ──────────────────────────────────────
  // Step 0: mode toggle (always visible)
  // Step 1: company (if specific) or job title (if open)
  // Step 2: job title (if specific) / resume (if open)
  // Step 3: resume + submit
  const [currentStep, setCurrentStep] = useState(0);
  const advanceTo = useCallback((s) => setCurrentStep((p) => (s > p ? s : p)), []);

  // Auto-advance based on mode + selections
  useEffect(() => { advanceTo(1); }, []); // mode is pre-selected, show next immediately

  useEffect(() => {
    if (openToAny) {
      // Open: just need job title
      if (jobTitle.trim().length >= 2) advanceTo(2);
    } else {
      // Specific: need company first
      if (selectedCompany) advanceTo(2);
    }
  }, [openToAny, selectedCompany, jobTitle, advanceTo]);

  useEffect(() => {
    if (!openToAny && selectedCompany && jobTitle.trim().length >= 2) advanceTo(3);
    if (openToAny && jobTitle.trim().length >= 2) advanceTo(2); // resume step
  }, [openToAny, selectedCompany, jobTitle, advanceTo]);

  // ─── Pricing ─────────────────────────────────────────────────
  const getEffectiveCost = () => {
    if (openToAny) return pricing.openToAnyReferralCost;
    const tier = selectedCompany?.tier || 'Standard';
    if (tier === 'Elite') return pricing.eliteReferralCost || 199;
    if (tier === 'Premium') return pricing.premiumReferralCost || 99;
    return pricing.referralRequestCost;
  };
  const effectiveCost = getEffectiveCost();

  // ─── Hide header ─────────────────────────────────────────────
  useEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);

  // ─── Data Loading ────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated && user) {
      loadWalletBalance();
      loadResumes();
    } else {
      setLoadingWallet(false);
    }
    if (preSelectedOrganization) {
      setSelectedCompany(preSelectedOrganization);
      setOpenToAny(false);
    }
  }, [preSelectedOrganization]);

  const loadResumes = async () => {
    setLoadingResumes(true);
    try {
      const res = await refopenAPI.getUserResumes();
      if (res?.success && res.data) {
        const sorted = [...res.data].sort((a, b) => {
          if (a.IsPrimary && !b.IsPrimary) return -1;
          if (!a.IsPrimary && b.IsPrimary) return 1;
          return new Date(b.UploadedAt || 0) - new Date(a.UploadedAt || 0);
        });
        setResumes(sorted);
        if (sorted[0]?.ResumeID) setSelectedResumeId(sorted[0].ResumeID);
      }
    } catch (e) { console.error('Error loading resumes:', e); }
    finally { setLoadingResumes(false); }
  };

  const loadWalletBalance = async () => {
    setLoadingWallet(true);
    try {
      const res = await refopenAPI.getWalletBalance();
      if (res?.success) setWalletBalance(res.data?.availableBalance ?? res.data?.balance ?? 0);
    } catch (e) { console.error('Error loading wallet:', e); }
    finally { setLoadingWallet(false); }
  };

  // ─── Company Search ──────────────────────────────────────────
  useEffect(() => {
    if (!showCompanyDropdown) return;
    (async () => {
      setOrgLoading(true);
      try {
        const res = await refopenAPI.getOrganizations(debouncedCompanySearch || '', null);
        const raw = res?.success && Array.isArray(res.data) ? res.data : [];
        if (debouncedCompanySearch?.trim()) {
          const s = debouncedCompanySearch.toLowerCase();
          const matches = raw.filter((o) => o.name?.toLowerCase().includes(s));
          // Sort: starts-with first
          matches.sort((a, b) => {
            const aS = a.name?.toLowerCase().startsWith(s) ? 0 : 1;
            const bS = b.name?.toLowerCase().startsWith(s) ? 0 : 1;
            return aS - bS;
          });
          setOrgResults(matches);
        } else {
          setOrgResults(raw);
        }
      } catch (e) { setOrgResults([]); }
      finally { setOrgLoading(false); }
    })();
  }, [debouncedCompanySearch, showCompanyDropdown]);

  // ─── Handlers ────────────────────────────────────────────────
  const handleSelectCompany = (org) => {
    setSelectedCompany(org);
    setCompanySearch('');
    setShowCompanyDropdown(false);
    if (errors.company) setErrors((p) => ({ ...p, company: null }));
    advanceTo(2);
  };

  const handleResumeSelected = async (data) => {
    setSelectedResumeId(data.ResumeID);
    await loadResumes();
    setShowResumeModal(false);
    if (errors.resume) setErrors((p) => ({ ...p, resume: null }));
    showToast('Resume selected', 'success');
  };

  const switchMode = (isOpen) => {
    setOpenToAny(isOpen);
    if (isOpen) { setSelectedCompany(null); setJobId(''); setErrors({}); }
    setCurrentStep(1); // reset progressive reveal
  };

  // ─── Validation ──────────────────────────────────────────────
  const validateForm = () => {
    const e = {};
    if (!openToAny && !selectedCompany) e.company = 'Select a company';
    if (!jobTitle.trim()) e.jobTitle = 'Job title is required';
    if (!openToAny && !jobId.trim()) e.jobId = 'Job ID is required';
    if (!selectedResumeId) e.resume = 'Select a resume';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAskReferral = () => {
    if (!requireAuth('ask referral')) return;
    if (!validateForm()) return;
    setShowConfirmModal(true);
  };

  const handleSubmit = async () => {
    const startTime = Date.now();
    setSubmitting(true);
    try {
      const requestData = {
        jobID: null,
        extJobID: openToAny ? undefined : jobId,
        resumeID: selectedResumeId,
        jobTitle: jobTitle.trim(),
        companyName: selectedCompany?.name || undefined,
        organizationId: selectedCompany?.id?.toString() || undefined,
        referralMessage: referralMessage || undefined,
        openToAnyCompany: openToAny || undefined,
      };

      const result = await refopenAPI.createReferralRequest(requestData);

      if (result?.success) {
        const broadcastTime = (Date.now() - startTime) / 1000;
        setReferralCompanyName(openToAny ? 'All Companies' : (selectedCompany?.name || ''));
        setReferralBroadcastTime(broadcastTime);
        setShowSuccessOverlay(true);
        invalidateCache(CACHE_KEYS.REFERRER_REQUESTS, CACHE_KEYS.WALLET_BALANCE, CACHE_KEYS.DASHBOARD_STATS);
        if (result.data?.availableBalanceAfter !== undefined) setWalletBalance(result.data.availableBalanceAfter);
        // Reset form
        setJobTitle(''); setJobId(''); setReferralMessage(''); setSelectedCompany(null); setOpenToAny(true); setErrors({}); setCurrentStep(1);
      } else if (result.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
        setWalletModalData({ currentBalance: result.data?.currentBalance || 0, requiredAmount: result.data?.requiredAmount || effectiveCost });
        setShowWalletModal(true);
      } else {
        showToast(result?.error || 'Failed to submit referral', 'error');
      }
    } catch (error) {
      showToast(error?.message || 'An error occurred', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Derived ─────────────────────────────────────────────────
  const selectedResume = resumes.find((r) => r.ResumeID === selectedResumeId);

  // ─── Access Gate ─────────────────────────────────────────────
  if (isAuthenticated && !isJobSeeker) {
    return (
      <View style={styles.gateContainer}>
        <Ionicons name="lock-closed" size={64} color={colors.gray400} />
        <Text style={styles.gateTitle}>Access Restricted</Text>
        <Text style={styles.gateSub}>Only job seekers can request referrals.</Text>
      </View>
    );
  }

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TabHeader navigation={navigation} showWallet walletBalance={loadingWallet ? null : walletBalance} />

      <View style={styles.inner}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

          {/* Backdrop for dropdowns */}
          {showCompanyDropdown && (
            <Pressable
              style={Platform.OS === 'web' ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9990 } : { position: 'absolute', top: -1000, left: -1000, right: -1000, bottom: -1000, zIndex: 9990 }}
              onPress={() => {
                if (companySearch.trim().length >= 2) {
                  setSelectedCompany({ id: null, name: companySearch.trim() });
                  advanceTo(2);
                }
                setShowCompanyDropdown(false);
                setCompanySearch('');
              }}
            />
          )}

          {/* ── Header ──────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>🚀</Text>
            <Text style={styles.headerTitle}>Get Referred</Text>
            <Text style={styles.headerSub}>Choose how you want to be referred and we'll match you with the right people</Text>
          </View>

          {/* ── Step 0: Mode Toggle ─────────────────────── */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, openToAny && styles.modeBtnActive, openToAny && { borderColor: '#8B5CF6' }]}
              onPress={() => switchMode(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="globe-outline" size={20} color={openToAny ? '#8B5CF6' : colors.gray400} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.modeBtnTitle, openToAny && { color: '#8B5CF6' }]}>Open to Any</Text>
                <Text style={styles.modeBtnDesc}>Multiple companies can refer you</Text>
              </View>
              <Text style={[styles.modePrice, openToAny && { color: '#8B5CF6' }]}>₹{pricing.openToAnyReferralCost}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeBtn, !openToAny && styles.modeBtnActive]}
              onPress={() => switchMode(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="business-outline" size={20} color={!openToAny ? colors.primary : colors.gray400} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.modeBtnTitle, !openToAny && { color: colors.primary }]}>Specific Company</Text>
                <Text style={styles.modeBtnDesc}>Target one company</Text>
              </View>
              <Text style={[styles.modePrice, !openToAny && { color: colors.primary }]}>₹{pricing.referralRequestCost}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Step 1: Company (if Specific) ───────────── */}
          {!openToAny && currentStep >= 1 && (
            <View style={[styles.fieldGroup, { zIndex: showCompanyDropdown ? 9999 : 1 }]}>
              <Text style={styles.fieldLabel}>Which company? <Text style={styles.req}>*</Text></Text>
              <View style={{ position: 'relative', zIndex: showCompanyDropdown ? 9999 : 1 }}>
                <View style={[styles.searchWrap, selectedCompany && !showCompanyDropdown && styles.searchWrapCompleted]}>
                  <Ionicons name="search" size={18} color={selectedCompany && !showCompanyDropdown ? colors.success : colors.gray400} style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.searchInner}
                    placeholder="Search or type company name"
                    placeholderTextColor={colors.gray500}
                    value={showCompanyDropdown ? companySearch : (selectedCompany?.name || '')}
                    onChangeText={(t) => {
                      setCompanySearch(t);
                      if (!showCompanyDropdown) { setShowCompanyDropdown(true); setSelectedCompany(null); }
                    }}
                    onFocus={() => { setShowCompanyDropdown(true); setCompanySearch(''); }}
                    onBlur={() => {
                      if (showCompanyDropdown && companySearch.trim().length >= 2 && !selectedCompany) {
                        setSelectedCompany({ id: null, name: companySearch.trim() });
                        setShowCompanyDropdown(false); setCompanySearch(''); advanceTo(2);
                      }
                    }}
                    autoCorrect={false}
                    autoCapitalize="words"
                  />
                </View>
                {selectedCompany && !showCompanyDropdown && (
                  <TouchableOpacity style={styles.clearBtn} onPress={() => { setSelectedCompany(null); setShowCompanyDropdown(true); setCompanySearch(''); }}>
                    <Ionicons name="close-circle" size={18} color={colors.gray400} />
                  </TouchableOpacity>
                )}

                {showCompanyDropdown && (
                  <View style={styles.dropdown}>
                    {orgLoading ? (
                      <View style={styles.dropdownLoading}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.dropdownLoadingText}>Searching...</Text></View>
                    ) : orgResults.length > 0 ? (
                      <ScrollView style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                        {orgResults.slice(0, 15).map((org) => (
                          <TouchableOpacity key={org.id} style={styles.orgItem} onPress={() => handleSelectCompany(org)}>
                            {org.logoURL ? (
                              <CachedImage source={{ uri: org.logoURL }} style={styles.orgLogo} resizeMode="contain" />
                            ) : (
                              <View style={styles.orgLogoPlaceholder}><Ionicons name="business" size={16} color={colors.gray400} /></View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.orgName}>{org.name}</Text>
                              {org.industry && org.industry !== 'Other' && <Text style={styles.orgIndustry}>{org.industry}</Text>}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    ) : companySearch.length > 1 && !orgLoading ? (
                      <View style={styles.dropdownEmpty}>
                        <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                        <Text style={styles.dropdownEmptyText}>Click outside to use "{companySearch.trim()}"</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
              {errors.company && <Text style={styles.fieldError}>{errors.company}</Text>}
            </View>
          )}

          {/* ── Job Title ──────────────────────────────── */}
          {currentStep >= (openToAny ? 1 : 2) && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>What role are you looking for? <Text style={styles.req}>*</Text></Text>
              <TextInput
                style={[styles.fieldInput, errors.jobTitle && styles.fieldInputError]}
                placeholder="e.g. Senior Software Engineer"
                placeholderTextColor={colors.gray500}
                value={jobTitle}
                onChangeText={(t) => { setJobTitle(t); if (errors.jobTitle) setErrors((p) => ({ ...p, jobTitle: null })); }}
                maxLength={200}
              />
              {errors.jobTitle && <Text style={styles.fieldError}>{errors.jobTitle}</Text>}
            </View>
          )}

          {/* ── Job ID (Specific only) ─────────────────── */}
          {!openToAny && currentStep >= 2 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Job ID / Reference <Text style={styles.req}>*</Text></Text>
              <TextInput
                style={[styles.fieldInput, errors.jobId && styles.fieldInputError]}
                placeholder="e.g. REQ-2024-001"
                placeholderTextColor={colors.gray500}
                value={jobId}
                onChangeText={(t) => { setJobId(t); if (errors.jobId) setErrors((p) => ({ ...p, jobId: null })); }}
                maxLength={100}
              />
              <Text style={styles.fieldHint}>Find this on the company's career page</Text>
              {errors.jobId && <Text style={styles.fieldError}>{errors.jobId}</Text>}
            </View>
          )}

          {/* ── Resume ─────────────────────────────────── */}
          {currentStep >= 2 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Resume <Text style={styles.req}>*</Text></Text>
              {loadingResumes ? (
                <View style={styles.resumeLoading}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.resumeLoadingText}>Loading...</Text></View>
              ) : selectedResume ? (
                <View style={styles.resumePill}>
                  <Ionicons name="document-text" size={18} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.resumeName} numberOfLines={1}>{selectedResume.ResumeLabel}</Text>
                    {selectedResume.IsPrimary && <Text style={styles.resumePrimary}>Primary</Text>}
                  </View>
                  <TouchableOpacity style={styles.resumeChangeBtn} onPress={() => { if (requireAuth('resume')) setShowResumeModal(true); }}>
                    <Text style={styles.resumeChangeBtnText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : resumes.length > 0 ? (
                <View style={styles.resumeList}>
                  {resumes.slice(0, 3).map((r) => (
                    <TouchableOpacity key={r.ResumeID} style={[styles.resumeItem, selectedResumeId === r.ResumeID && styles.resumeItemActive]} onPress={() => setSelectedResumeId(r.ResumeID)}>
                      <Ionicons name="document-text" size={16} color={selectedResumeId === r.ResumeID ? colors.primary : colors.gray400} />
                      <Text style={[styles.resumeItemLabel, selectedResumeId === r.ResumeID && { color: colors.primary }]} numberOfLines={1}>{r.ResumeLabel}</Text>
                      <View style={[styles.radio, selectedResumeId === r.ResumeID && styles.radioActive]}>
                        {selectedResumeId === r.ResumeID && <View style={styles.radioInner} />}
                      </View>
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
          )}

          {/* ── Message (optional, always visible once resume shown) */}
          {currentStep >= 2 && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Message to Referrer <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.textArea}
                placeholder="Why you're a great fit..."
                placeholderTextColor={colors.gray500}
                value={referralMessage}
                onChangeText={setReferralMessage}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
              />
            </View>
          )}
        </ScrollView>

        {/* ── Sticky Bottom CTA ─────────────────────────── */}
        <View style={styles.stickyBottom}>
          <View style={styles.stickySummary}>
            <View>
              <Text style={styles.stickyLabel}>Total</Text>
              <Text style={[styles.stickyPrice, openToAny && { color: '#8B5CF6' }]}>₹{effectiveCost}</Text>
            </View>
            <View style={styles.stickyWallet}>
              <Ionicons name="wallet-outline" size={14} color={colors.success} />
              <Text style={styles.stickyBalance}>{loadingWallet ? '...' : `₹${walletBalance.toFixed(0)}`}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, openToAny && { backgroundColor: '#8B5CF6' }, submitting && styles.submitBtnDisabled]}
            onPress={handleAskReferral}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Send Referral Request</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Modals ──────────────────────────────────────── */}
      <ResumeUploadModal visible={showResumeModal} onClose={() => setShowResumeModal(false)} onResumeSelected={handleResumeSelected} user={user} jobTitle={jobTitle || 'Job Application'} />
      <WalletRechargeModal visible={showWalletModal} currentBalance={walletModalData.currentBalance} requiredAmount={walletModalData.requiredAmount} onAddMoney={() => { setShowWalletModal(false); navigation.navigate('WalletRecharge'); }} onCancel={() => setShowWalletModal(false)} />
      <ConfirmPurchaseModal visible={showConfirmModal} currentBalance={walletBalance} requiredAmount={effectiveCost} contextType="referral" itemName={jobTitle || 'this job'} onProceed={async () => { setShowConfirmModal(false); await handleSubmit(); }} onAddMoney={() => { setShowConfirmModal(false); navigation.navigate('WalletRecharge'); }} onCancel={() => setShowConfirmModal(false)} />
      <ReferralSuccessOverlay visible={showSuccessOverlay} onComplete={() => { setShowSuccessOverlay(false); navigation.goBack(); }} duration={3500} companyName={referralCompanyName} broadcastTime={referralBroadcastTime} isOpenToAny={referralCompanyName === 'All Companies'} />
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const createStyles = (colors, responsive = {}) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, ...(Platform.OS === 'web' && responsive.isDesktop ? { alignItems: 'center' } : {}) },
    inner: { width: '100%', maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 640 : '100%', flex: 1 },
    scroll: { flex: 1 },

    /* Header */
    header: { padding: 20, paddingTop: 16 },
    headerEmoji: { fontSize: 36, marginBottom: 8 },
    headerTitle: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.4, marginBottom: 4 },
    headerSub: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },

    /* Mode Toggle */
    modeToggle: { paddingHorizontal: 16, gap: 10, marginBottom: 24 },
    modeBtn: {
      flexDirection: 'row', alignItems: 'center',
      padding: 16, borderRadius: 14, borderWidth: 1.5,
      borderColor: colors.border, backgroundColor: colors.surface,
    },
    modeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg || (colors.primary + '08') },
    modeBtnTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    modeBtnDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
    modePrice: { fontSize: 18, fontWeight: '700', color: colors.text },

    /* Fields */
    fieldGroup: { paddingHorizontal: 16, marginBottom: 20 },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
    req: { color: colors.danger || '#EF4444' },
    optional: { color: colors.textMuted, fontWeight: '400', fontSize: 12 },
    fieldInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14, fontSize: 15,
      color: colors.text, backgroundColor: colors.surface,
    },
    fieldInputError: { borderColor: colors.danger || '#EF4444' },
    fieldError: { fontSize: 12, color: colors.danger || '#EF4444', marginTop: 4 },
    fieldHint: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    textArea: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14, fontSize: 15,
      color: colors.text, backgroundColor: colors.surface, minHeight: 80,
    },

    /* Company search */
    searchWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4,
    },
    searchWrapCompleted: { borderColor: (colors.success || '#22C55E') + '50', backgroundColor: (colors.success || '#22C55E') + '08' },
    searchInner: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text },
    clearBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },

    /* Dropdown */
    dropdown: {
      position: 'absolute', top: '100%', left: 0, right: 0,
      backgroundColor: colors.surfaceElevated || '#2D2D2D', borderWidth: 1,
      borderColor: colors.border, borderRadius: 12, marginTop: 6,
      maxHeight: 260, zIndex: 9999, elevation: 10,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16,
      overflow: 'hidden',
    },
    dropdownLoading: { padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    dropdownLoadingText: { fontSize: 13, color: colors.textMuted },
    dropdownEmpty: { padding: 16, alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center' },
    dropdownEmptyText: { fontSize: 13, color: colors.success || '#22C55E' },
    orgItem: {
      flexDirection: 'row', alignItems: 'center', padding: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    orgLogo: { width: 32, height: 32, borderRadius: 8, marginRight: 12, backgroundColor: colors.background },
    orgLogoPlaceholder: { width: 32, height: 32, borderRadius: 8, marginRight: 12, backgroundColor: colors.gray100 || '#2D2D2D', justifyContent: 'center', alignItems: 'center' },
    orgName: { fontSize: 15, fontWeight: '600', color: colors.text },
    orgIndustry: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

    /* Resume */
    resumeLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    resumeLoadingText: { marginLeft: 10, fontSize: 13, color: colors.textMuted },
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

    /* Sticky Bottom */
    stickyBottom: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
    },
    stickySummary: { gap: 2 },
    stickyLabel: { fontSize: 11, color: colors.textMuted },
    stickyPrice: { fontSize: 22, fontWeight: '700', color: colors.primary },
    stickyWallet: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    stickyBalance: { fontSize: 12, fontWeight: '600', color: colors.success || '#22C55E' },
    submitBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.primary, paddingVertical: 16, paddingHorizontal: 24,
      borderRadius: 14,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    /* Gate */
    gateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: colors.background },
    gateTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 16 },
    gateSub: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },
  });
