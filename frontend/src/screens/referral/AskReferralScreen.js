import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Animated,
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
import AdCard from '../../components/ads/AdCard';
import TabHeader from '../../components/TabHeader';
import CachedImage from '../../components/CachedImage';

export default function AskReferralScreen({ navigation, route }) {
  const { user, isJobSeeker, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const { pricing } = usePricing();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // ─── Auth Guard ────────────────────────────────────────────────────
  const requireAuth = (action) => {
    if (!isAuthenticated || !user) {
      navigation.navigate('Auth', {
        screen: 'Login',
        params: { returnTo: 'AskReferral', returnParams: route?.params },
      });
      return false;
    }
    return true;
  };

  // ─── Loading States ────────────────────────────────────────────────
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ─── Data ──────────────────────────────────────────────────────────
  const [resumes, setResumes] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);

  // ─── Fortune 500 Showcase ──────────────────────────────────────────
  const [fortune500Companies, setFortune500Companies] = useState([]);
  const [currentCompanyIndex, setCurrentCompanyIndex] = useState(0);
  const fadeAnim = useState(new Animated.Value(1))[0];
  const [showRotationTick, setShowRotationTick] = useState(false);
  const rotationTimeoutRef = useRef(null);
  const tickTimeoutRef = useRef(null);

  // ─── Mode Selection (Open to Any = DEFAULT / flagship) ─────────────
  const [openToAnyCompany, setOpenToAnyCompany] = useState(true);

  // ─── Company Selection ─────────────────────────────────────────────
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const preSelectedOrganization = route?.params?.preSelectedOrganization;

  // ─── Form State ────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    jobId: '',
    jobTitle: '',
    jobUrl: '',
    referralMessage: '',
    selectedResumeId: '',
    minSalary: '',
    salaryCurrency: 'INR',
    salaryPeriod: 'Annual',
    preferredLocations: '',
  });
  const [errors, setErrors] = useState({});
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  // ─── Modals & Overlays ─────────────────────────────────────────────
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalData, setWalletModalData] = useState({
    currentBalance: 0,
    requiredAmount: pricing.referralRequestCost,
  });
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showReferralSuccessOverlay, setShowReferralSuccessOverlay] = useState(false);
  const [referralCompanyName, setReferralCompanyName] = useState('');
  const [referralBroadcastTime, setReferralBroadcastTime] = useState(null);
  const [showReferralConfirmModal, setShowReferralConfirmModal] = useState(false);

  // ─── Header Search ─────────────────────────────────────────────────
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [headerSearchResults, setHeaderSearchResults] = useState([]);
  const [headerSearchLoading, setHeaderSearchLoading] = useState(false);
  const [showHeaderSearchResults, setShowHeaderSearchResults] = useState(false);

  // ─── Pricing ───────────────────────────────────────────────────────
  const getEffectiveCost = () => {
    if (openToAnyCompany) return pricing.openToAnyReferralCost;
    const tier = selectedCompany?.tier || 'Standard';
    if (tier === 'Elite') return pricing.eliteReferralCost || 199;
    if (tier === 'Premium') return pricing.premiumReferralCost || 99;
    return pricing.referralRequestCost;
  };
  const effectiveCost = getEffectiveCost();

  // ═══════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════

  // Hide default navigation header
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // ─── Header Search ─────────────────────────────────────────────────
  const searchOrganizationsHeader = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setHeaderSearchResults([]);
      setShowHeaderSearchResults(false);
      return;
    }
    setHeaderSearchLoading(true);
    try {
      const result = await refopenAPI.getOrganizations(query.trim(), 10);
      if (result.success && result.data) {
        const filtered = result.data.filter(org => org.id !== 999999);
        setHeaderSearchResults(filtered);
        setShowHeaderSearchResults(filtered.length > 0);
      } else {
        setHeaderSearchResults([]);
        setShowHeaderSearchResults(false);
      }
    } catch (error) {
      console.error('Organization search error:', error);
      setHeaderSearchResults([]);
      setShowHeaderSearchResults(false);
    } finally {
      setHeaderSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchOrganizationsHeader(headerSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [headerSearchQuery, searchOrganizationsHeader]);

  // ─── Initial Data Load (staggered for performance) ─────────────────
  useEffect(() => {
    if (isAuthenticated && user) {
      loadWalletBalance();
      setTimeout(() => loadResumes(), 100);
    } else {
      setLoadingWallet(false);
      setLoadingResumes(false);
    }
    setTimeout(() => loadCompanies(), 300);

    // Auto-select organization if passed from route params
    if (preSelectedOrganization) {
      setSelectedCompany(preSelectedOrganization);
      setOpenToAnyCompany(false);
      setFormData(prev => ({ ...prev, companyName: preSelectedOrganization.name }));
    }
  }, [preSelectedOrganization]);

  // ─── Fortune 500 Rotation (social proof) ───────────────────────────
  useEffect(() => {
    const f500WithLogos = companies.filter(
      org =>
        (org.isFortune500 === 1 || org.isFortune500 === true ||
         org.isFortune500 === '1' || org.isFortune500 === 'true') &&
        org.logoURL
    );
    if (f500WithLogos.length === 0) return;

    const checkActiveHours = () => {
      const hour = new Date().getHours();
      return hour >= 9 || hour <= 1;
    };
    if (!checkActiveHours()) return;

    let rotationCompanies = fortune500Companies;
    if (rotationCompanies.length === 0) {
      rotationCompanies = [...f500WithLogos].sort(() => Math.random() - 0.5);
      setFortune500Companies(rotationCompanies);
    }

    const getRandomDelayMs = () => Math.floor(Math.random() * 9000) + 1000;

    const scheduleNextRotation = () => {
      if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);
      rotationTimeoutRef.current = setTimeout(rotateCompany, getRandomDelayMs());
    };

    const rotateCompany = () => {
      if (!checkActiveHours() || !rotationCompanies?.length) return;

      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setCurrentCompanyIndex(prev => (prev + 1) % rotationCompanies.length);

        setShowRotationTick(true);
        if (tickTimeoutRef.current) clearTimeout(tickTimeoutRef.current);
        tickTimeoutRef.current = setTimeout(() => setShowRotationTick(false), 2000);

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();

        scheduleNextRotation();
      });
    };

    scheduleNextRotation();

    return () => {
      if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);
      if (tickTimeoutRef.current) clearTimeout(tickTimeoutRef.current);
    };
  }, [companies, fortune500Companies, fadeAnim]);

  // ═══════════════════════════════════════════════════════════════════
  // DATA LOADERS
  // ═══════════════════════════════════════════════════════════════════

  const loadResumes = async () => {
    setLoadingResumes(true);
    try {
      const resumesRes = await refopenAPI.getUserResumes();
      if (resumesRes?.success && resumesRes.data) {
        const resumeList = resumesRes.data || [];
        const sortedResumes = [...resumeList].sort((a, b) => {
          if (a.IsPrimary && !b.IsPrimary) return -1;
          if (!a.IsPrimary && b.IsPrimary) return 1;
          return (
            new Date(b.UploadedAt || b.CreatedAt || 0) -
            new Date(a.UploadedAt || a.CreatedAt || 0)
          );
        });
        setResumes(sortedResumes);

        // Auto-select most recent resume
        const mostRecent = [...resumeList].sort(
          (a, b) =>
            new Date(b.UploadedAt || b.CreatedAt || 0) -
            new Date(a.UploadedAt || a.CreatedAt || 0)
        )[0];
        if (mostRecent?.ResumeID) {
          setFormData(prev => ({ ...prev, selectedResumeId: mostRecent.ResumeID }));
        }
      } else {
        setResumes([]);
      }
    } catch (error) {
      console.error('Error loading resumes:', error);
      setResumes([]);
      showToast('Failed to load resumes. Please try again.', 'error');
    } finally {
      setLoadingResumes(false);
    }
  };

  const loadCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const result = await refopenAPI.getOrganizations('');
      if (result?.success && result.data && Array.isArray(result.data)) {
        setCompanies(result.data);
      } else {
        setCompanies([]);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const loadWalletBalance = async () => {
    setLoadingWallet(true);
    try {
      const result = await refopenAPI.getWalletBalance();
      if (result?.success) {
        setWalletBalance(result.data?.availableBalance ?? result.data?.balance ?? 0);
      }
    } catch (error) {
      console.error('Failed to load wallet balance:', error);
    } finally {
      setLoadingWallet(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  const handleResumeSelected = async (resumeData) => {
    setFormData(prev => ({ ...prev, selectedResumeId: resumeData.ResumeID }));
    await loadResumes();
    setShowResumeModal(false);
    if (errors.resume) setErrors(prev => ({ ...prev, resume: null }));
    showToast('Resume selected successfully', 'success');
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleCompanySelect = (company) => {
    setSelectedCompany(company);
    setFormData(prev => ({ ...prev, companyName: company.name }));
    setShowCompanyModal(false);
    setCompanySearchTerm('');
    if (errors.company) setErrors(prev => ({ ...prev, company: null }));
  };

  const resetForm = () => {
    setFormData({
      jobId: '',
      jobTitle: '',
      jobUrl: '',
      referralMessage: '',
      selectedResumeId: '',
      minSalary: '',
      salaryCurrency: 'INR',
      salaryPeriod: 'Annual',
      preferredLocations: '',
    });
    setSelectedCompany(null);
    setOpenToAnyCompany(true);
    setErrors({});
    setShowOptionalFields(false);
  };

  const switchToMode = (isOpen) => {
    setOpenToAnyCompany(isOpen);
    if (isOpen) {
      setSelectedCompany(null);
      updateFormData('jobId', '');
      setErrors(prev => ({ ...prev, company: null, jobId: null }));
    }
  };

  // ─── Validation ────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors = {};
    if (!openToAnyCompany && !selectedCompany) {
      newErrors.company = 'Company selection is required';
    }
    if (!openToAnyCompany && (!formData.jobId || !formData.jobId.trim())) {
      newErrors.jobId = 'Job ID is required';
    }
    if (!formData.jobTitle || !formData.jobTitle.trim()) {
      newErrors.jobTitle = 'Job title is required';
    }
    if (!formData.selectedResumeId) {
      newErrors.resume = 'Please select a resume';
    }
    if (formData.jobUrl && formData.jobUrl.trim()) {
      try {
        new URL(formData.jobUrl);
      } catch {
        newErrors.jobUrl = 'Please enter a valid URL';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Submit Flow ───────────────────────────────────────────────────
  const handleAskReferralClick = () => {
    if (!requireAuth('ask referral')) return;
    if (!validateForm()) return;
    setShowReferralConfirmModal(true);
  };

  const handleSubmit = async () => {
    const startTime = Date.now();
    try {
      setSubmitting(true);

      const requestData = {
        jobID: null,
        extJobID: openToAnyCompany ? undefined : formData.jobId,
        resumeID: formData.selectedResumeId,
        jobTitle: formData.jobTitle,
        companyName: selectedCompany?.name || undefined,
        organizationId: selectedCompany?.id?.toString() || undefined,
        jobUrl: formData.jobUrl || undefined,
        referralMessage: formData.referralMessage || undefined,
        openToAnyCompany: openToAnyCompany || undefined,
        minSalary:
          openToAnyCompany && formData.minSalary
            ? parseFloat(formData.minSalary)
            : undefined,
        salaryCurrency:
          openToAnyCompany && formData.minSalary
            ? formData.salaryCurrency
            : undefined,
        salaryPeriod:
          openToAnyCompany && formData.minSalary
            ? formData.salaryPeriod
            : undefined,
        preferredLocations:
          openToAnyCompany && formData.preferredLocations?.trim()
            ? formData.preferredLocations.trim()
            : undefined,
      };

      const result = await refopenAPI.createReferralRequest(requestData);

      if (result?.success) {
        const broadcastTime = (Date.now() - startTime) / 1000;
        setReferralCompanyName(
          openToAnyCompany ? 'All Companies' : (selectedCompany?.name || '')
        );
        setReferralBroadcastTime(broadcastTime);
        setShowReferralSuccessOverlay(true);

        const amountHeld =
          result.data?.amountHeld || result.data?.amountDeducted || effectiveCost;
        const availableBalance = result.data?.availableBalanceAfter;

        let message = 'Referral request submitted! Amount held until referral is completed.';
        if (availableBalance !== undefined) {
          message = `Referral sent! ₹${amountHeld} held. Available: ₹${availableBalance.toFixed(2)}`;
        }
        showToast(message, 'success');
        invalidateCache(
          CACHE_KEYS.REFERRER_REQUESTS,
          CACHE_KEYS.WALLET_BALANCE,
          CACHE_KEYS.DASHBOARD_STATS
        );

        if (availableBalance !== undefined) setWalletBalance(availableBalance);
        resetForm();
      } else {
        if (result.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
          setWalletModalData({
            currentBalance: result.data?.currentBalance || 0,
            requiredAmount: result.data?.requiredAmount || effectiveCost,
          });
          setShowWalletModal(true);
        } else {
          showToast(
            result?.error || result?.message || 'Failed to submit referral request',
            'error'
          );
        }
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      showToast(
        error?.message || 'An unexpected error occurred. Please try again.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Derived State ─────────────────────────────────────────────────
  const isFormReady = !loadingWallet && !loadingResumes;
  const selectedResume = resumes.find(r => r.ResumeID === formData.selectedResumeId);

  // ─── Access Gate ───────────────────────────────────────────────────
  if (isAuthenticated && !isJobSeeker) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="lock-closed" size={64} color={colors.gray400} />
        <Text style={styles.errorTitle}>Access Restricted</Text>
        <Text style={styles.errorSubtext}>Only job seekers can request referrals.</Text>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <TabHeader
        navigation={navigation}
        showWallet
        walletBalance={loadingWallet ? null : walletBalance}
        centerContent={
          <View style={styles.searchContainerMain}>
            <View style={styles.searchInputWrapper}>
              <Ionicons
                name="search"
                size={18}
                color={colors.gray400}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={styles.headerSearchInput}
                placeholder="Search companies..."
                placeholderTextColor={colors.gray400}
                value={headerSearchQuery}
                onChangeText={setHeaderSearchQuery}
                onFocus={() =>
                  headerSearchQuery.trim().length >= 2 &&
                  setShowHeaderSearchResults(true)
                }
                onBlur={() =>
                  setTimeout(() => setShowHeaderSearchResults(false), 300)
                }
              />
              {headerSearchLoading && (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginLeft: 8 }}
                />
              )}
            </View>

            {/* Search dropdown */}
            {showHeaderSearchResults && headerSearchResults.length > 0 && (
              <View style={styles.searchResultsDropdown}>
                <FlatList
                  data={headerSearchResults}
                  keyExtractor={item => item.id.toString()}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 300 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.searchResultItem}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (!requireAuth('view company details')) return;
                        navigation.navigate('OrganizationDetails', {
                          organizationId: item.id,
                        });
                        setShowHeaderSearchResults(false);
                        setHeaderSearchQuery('');
                      }}
                    >
                      {item.logoURL ? (
                        <CachedImage
                          source={{ uri: item.logoURL }}
                          style={styles.orgLogo}
                        />
                      ) : (
                        <View style={styles.orgLogoPlaceholder}>
                          <Ionicons
                            name="business"
                            size={20}
                            color={colors.gray400}
                          />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orgName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.industry && (
                          <Text style={styles.orgIndustry} numberOfLines={1}>
                            {item.industry}
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.gray400}
                      />
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </View>
        }
      />

      <View style={styles.innerContainer}>
        <ScrollView
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Ad ──────────────────────────────────────────────── */}
          <AdCard variant="referral" />

          {/* ═══════════════════════════════════════════════════════
              SECTION 1 — MODE SELECTOR (The Hero)
              Two prominent cards: flagship "Open to Any" vs "Specific"
              ═══════════════════════════════════════════════════════ */}
          <View style={styles.modeSection}>
            <Text style={styles.modeHeading}>
              How do you want to be referred?
            </Text>

            {/* ── Open to Any Company (Flagship) ─────────────────── */}
            <TouchableOpacity
              style={[
                styles.modeCard,
                openToAnyCompany && styles.modeCardActive,
                openToAnyCompany && { borderColor: colors.primary },
              ]}
              onPress={() => switchToMode(true)}
              activeOpacity={0.8}
            >
              {/* RECOMMENDED badge */}
              <View style={styles.recommendedBadge}>
                <Ionicons name="star" size={10} color={colors.white} />
                <Text style={styles.recommendedText}>RECOMMENDED</Text>
              </View>

              <View style={styles.modeCardRow}>
                <View
                  style={[
                    styles.modeIconBox,
                    openToAnyCompany && {
                      backgroundColor: colors.primary + '20',
                    },
                  ]}
                >
                  <Ionicons
                    name="globe-outline"
                    size={28}
                    color={openToAnyCompany ? colors.primary : colors.gray400}
                  />
                </View>

                <View style={styles.modeCardContent}>
                  <Text
                    style={[
                      styles.modeCardTitle,
                      openToAnyCompany && { color: colors.primary },
                    ]}
                  >
                    Open to Any Company
                  </Text>
                  <Text style={styles.modeCardDesc}>
                    Broadcast to all verified referrers. Multiple companies can
                    refer you.
                  </Text>
                  <View style={styles.modeTagsRow}>
                    <View
                      style={[
                        styles.modeTag,
                        { backgroundColor: colors.successBg },
                      ]}
                    >
                      <Text
                        style={[styles.modeTagText, { color: colors.success }]}
                      >
                        Full refund if no referral
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.modeTag,
                        { backgroundColor: colors.primaryBg },
                      ]}
                    >
                      <Text
                        style={[styles.modeTagText, { color: colors.primary }]}
                      >
                        Multiple referrals
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modePriceBox}>
                  <Text
                    style={[
                      styles.modePriceAmount,
                      openToAnyCompany && { color: colors.primary },
                    ]}
                  >
                    ₹{pricing.openToAnyReferralCost}
                  </Text>
                  <Text style={styles.modePriceLabel}>one-time</Text>
                </View>
              </View>

              {/* Radio */}
              <View
                style={[
                  styles.modeRadio,
                  openToAnyCompany && styles.modeRadioActive,
                ]}
              >
                {openToAnyCompany && <View style={styles.modeRadioInner} />}
              </View>
            </TouchableOpacity>

            {/* ── Specific Company ────────────────────────────────── */}
            <TouchableOpacity
              style={[
                styles.modeCard,
                !openToAnyCompany && styles.modeCardActive,
                !openToAnyCompany && { borderColor: colors.primary },
              ]}
              onPress={() => switchToMode(false)}
              activeOpacity={0.8}
            >
              <View style={styles.modeCardRow}>
                <View
                  style={[
                    styles.modeIconBox,
                    !openToAnyCompany && {
                      backgroundColor: colors.primary + '20',
                    },
                  ]}
                >
                  <Ionicons
                    name="business-outline"
                    size={28}
                    color={!openToAnyCompany ? colors.primary : colors.gray400}
                  />
                </View>

                <View style={styles.modeCardContent}>
                  <Text
                    style={[
                      styles.modeCardTitle,
                      !openToAnyCompany && { color: colors.primary },
                    ]}
                  >
                    Specific Company
                  </Text>
                  <Text style={styles.modeCardDesc}>
                    Target a specific company. One referrer claims your request.
                  </Text>
                  <View style={styles.modeTagsRow}>
                    <View style={[styles.modeTag, { backgroundColor: colors.successBg }]}>
                      <Text style={[styles.modeTagText, { color: colors.success }]}>Full refund if no referral</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modePriceBox}>
                  <Text
                    style={[
                      styles.modePriceAmount,
                      !openToAnyCompany && { color: colors.primary },
                    ]}
                  >
                    ₹{pricing.referralRequestCost}
                  </Text>
                  <Text style={styles.modePriceLabel}>onwards</Text>
                </View>
              </View>

              <View
                style={[
                  styles.modeRadio,
                  !openToAnyCompany && styles.modeRadioActive,
                ]}
              >
                {!openToAnyCompany && <View style={styles.modeRadioInner} />}
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Live Social Proof — Fortune 500 Ticker ────────────── */}
          {fortune500Companies.length > 0 && (
            <Animated.View
              style={[styles.socialProofBar, { opacity: fadeAnim }]}
            >
              <View style={styles.socialProofContent}>
                <View style={styles.socialProofLogoBox}>
                  <CachedImage
                    source={{
                      uri: fortune500Companies[currentCompanyIndex]?.logoURL,
                    }}
                    style={styles.socialProofLogo}
                    resizeMode="contain"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.socialProofText}>
                    Referral submitted for
                  </Text>
                  <Text style={styles.socialProofCompany}>
                    {fortune500Companies[currentCompanyIndex]?.name}
                  </Text>
                </View>
                <View style={styles.socialProofRight}>
                  {showRotationTick && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.success}
                    />
                  )}
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ═══════════════════════════════════════════════════════
              SECTION 2 — SMART FORM (Progressive Disclosure)
              Only shows fields relevant to the chosen mode.
              ═══════════════════════════════════════════════════════ */}
          <View style={styles.formSection}>
            {/* ── Job Title (Always required) ─────────────────────── */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                What role are you looking for?{' '}
                <Text style={styles.req}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.fieldInput,
                  errors.jobTitle && styles.fieldInputError,
                ]}
                placeholder="e.g., Senior Software Engineer, Product Manager"
                placeholderTextColor={colors.gray500}
                value={formData.jobTitle}
                onChangeText={v => updateFormData('jobTitle', v)}
                maxLength={200}
              />
              {errors.jobTitle && (
                <Text style={styles.fieldError}>{errors.jobTitle}</Text>
              )}
            </View>

            {/* ── Company + Job ID (Specific mode only) ──────────── */}
            {!openToAnyCompany && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Which company? <Text style={styles.req}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.companySelector,
                      errors.company && styles.fieldInputError,
                    ]}
                    onPress={() => setShowCompanyModal(true)}
                  >
                    {selectedCompany ? (
                      <View style={styles.companySelectorInner}>
                        {selectedCompany.logoURL ? (
                          <CachedImage
                            source={{ uri: selectedCompany.logoURL }}
                            style={styles.companySelectorLogo}
                            resizeMode="contain"
                          />
                        ) : (
                          <View style={styles.companySelectorLogoPlaceholder}>
                            <Ionicons
                              name="business"
                              size={16}
                              color={colors.gray400}
                            />
                          </View>
                        )}
                        <Text style={styles.companySelectorName}>
                          {selectedCompany.name}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.companySelectorPlaceholder}>
                        Tap to select company
                      </Text>
                    )}
                    <Ionicons
                      name="chevron-down"
                      size={20}
                      color={colors.gray500}
                    />
                  </TouchableOpacity>
                  {errors.company && (
                    <Text style={styles.fieldError}>{errors.company}</Text>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>
                    Job ID / Reference <Text style={styles.req}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.fieldInput,
                      errors.jobId && styles.fieldInputError,
                    ]}
                    placeholder="e.g., REQ-2024-001"
                    placeholderTextColor={colors.gray500}
                    value={formData.jobId}
                    onChangeText={v => updateFormData('jobId', v)}
                    maxLength={100}
                  />
                  {errors.jobId && (
                    <Text style={styles.fieldError}>{errors.jobId}</Text>
                  )}
                  <Text style={styles.fieldHint}>
                    Find this on the company's career page
                  </Text>
                </View>
              </>
            )}

            {/* ── Resume (Compact pre-selected pill) ─────────────── */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Resume <Text style={styles.req}>*</Text>
              </Text>

              {loadingResumes ? (
                <View style={styles.resumeLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.resumeLoadingText}>
                    Loading resumes...
                  </Text>
                </View>
              ) : selectedResume ? (
                /* ✅ Pre-selected resume — compact pill with "Change" */
                <View style={styles.resumePill}>
                  <View style={styles.resumePillLeft}>
                    <Ionicons
                      name="document-text"
                      size={18}
                      color={colors.primary}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.resumePillName} numberOfLines={1}>
                        {selectedResume.ResumeLabel}
                      </Text>
                      {selectedResume.IsPrimary && (
                        <Text style={styles.resumePillPrimary}>Primary</Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.resumeChangeBtn}
                    onPress={() => {
                      if (requireAuth('change resume'))
                        setShowResumeModal(true);
                    }}
                  >
                    <Text style={styles.resumeChangeBtnText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : resumes.length > 0 ? (
                /* Has resumes but none auto-selected */
                <View style={styles.resumeSelectList}>
                  {resumes.slice(0, 3).map(resume => (
                    <TouchableOpacity
                      key={resume.ResumeID}
                      style={[
                        styles.resumeSelectItem,
                        formData.selectedResumeId === resume.ResumeID &&
                          styles.resumeSelectItemActive,
                      ]}
                      onPress={() =>
                        updateFormData('selectedResumeId', resume.ResumeID)
                      }
                    >
                      <Ionicons
                        name="document-text"
                        size={18}
                        color={
                          formData.selectedResumeId === resume.ResumeID
                            ? colors.primary
                            : colors.gray500
                        }
                      />
                      <Text
                        style={[
                          styles.resumeSelectLabel,
                          formData.selectedResumeId === resume.ResumeID && {
                            color: colors.primary,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {resume.ResumeLabel}
                      </Text>
                      {resume.IsPrimary && (
                        <Text style={styles.resumePillPrimary}>Primary</Text>
                      )}
                      <View
                        style={[
                          styles.miniRadio,
                          formData.selectedResumeId === resume.ResumeID &&
                            styles.miniRadioActive,
                        ]}
                      >
                        {formData.selectedResumeId === resume.ResumeID && (
                          <View style={styles.miniRadioInner} />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                  {resumes.length > 3 && (
                    <TouchableOpacity
                      onPress={() => setShowResumeModal(true)}
                      style={styles.seeAllResumes}
                    >
                      <Text style={styles.seeAllResumesText}>
                        See all ({resumes.length}) →
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                /* No resumes — upload CTA */
                <TouchableOpacity
                  style={styles.resumeUploadCTA}
                  onPress={() => {
                    if (requireAuth('upload resume'))
                      setShowResumeModal(true);
                  }}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={24}
                    color={colors.primary}
                  />
                  <Text style={styles.resumeUploadCTATitle}>
                    Upload your resume
                  </Text>
                  <Text style={styles.resumeUploadCTADesc}>
                    PDF or DOC, max 5MB
                  </Text>
                </TouchableOpacity>
              )}

              {errors.resume && (
                <Text style={styles.fieldError}>{errors.resume}</Text>
              )}
            </View>

            {/* ── Optional Fields Toggle ─────────────────────────── */}
            <TouchableOpacity
              style={styles.optionalToggle}
              onPress={() => setShowOptionalFields(!showOptionalFields)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showOptionalFields ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.optionalToggleText}>
                {showOptionalFields ? 'Hide' : 'Show'} optional details
              </Text>
              {!showOptionalFields &&
                (formData.referralMessage ||
                  formData.jobUrl ||
                  formData.minSalary ||
                  formData.preferredLocations) && (
                  <View style={styles.optionalFilledDot} />
                )}
            </TouchableOpacity>

            {/* ── Optional Fields (Collapsible) ──────────────────── */}
            {showOptionalFields && (
              <View style={styles.optionalSection}>
                {/* Salary + Locations — Open mode */}
                {openToAnyCompany && (
                  <>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Expected Salary</Text>
                      <View style={styles.salaryRow}>
                        <TouchableOpacity
                          style={styles.salaryPrefix}
                          onPress={() =>
                            updateFormData(
                              'salaryCurrency',
                              formData.salaryCurrency === 'INR' ? 'USD' : 'INR'
                            )
                          }
                        >
                          <Text style={styles.salaryPrefixText}>
                            {formData.salaryCurrency === 'INR' ? '₹' : '$'}
                          </Text>
                        </TouchableOpacity>
                        <TextInput
                          style={styles.salaryInput}
                          placeholder={
                            formData.salaryCurrency === 'INR'
                              ? '15,00,000'
                              : '120,000'
                          }
                          placeholderTextColor={colors.gray500}
                          value={formData.minSalary}
                          onChangeText={v =>
                            updateFormData(
                              'minSalary',
                              v.replace(/[^0-9]/g, '')
                            )
                          }
                          keyboardType="numeric"
                          maxLength={10}
                        />
                        <TouchableOpacity
                          style={styles.salarySuffix}
                          onPress={() =>
                            updateFormData(
                              'salaryPeriod',
                              formData.salaryPeriod === 'Annual'
                                ? 'Monthly'
                                : 'Annual'
                            )
                          }
                        >
                          <Text style={styles.salarySuffixText}>
                            {formData.salaryPeriod === 'Annual' ? '/yr' : '/mo'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Preferred Locations</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="e.g., Bangalore, Hyderabad, Remote"
                        placeholderTextColor={colors.gray500}
                        value={formData.preferredLocations}
                        onChangeText={v =>
                          updateFormData('preferredLocations', v)
                        }
                        maxLength={200}
                      />
                      <Text style={styles.fieldHint}>
                        Comma-separated city preferences
                      </Text>
                    </View>
                  </>
                )}

                {/* Job URL — Specific mode */}
                {!openToAnyCompany && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Job URL</Text>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        errors.jobUrl && styles.fieldInputError,
                      ]}
                      placeholder="https://careers.company.com/job/12345"
                      placeholderTextColor={colors.gray500}
                      value={formData.jobUrl}
                      onChangeText={v => updateFormData('jobUrl', v)}
                      keyboardType="url"
                      autoCapitalize="none"
                    />
                    {errors.jobUrl && (
                      <Text style={styles.fieldError}>{errors.jobUrl}</Text>
                    )}
                  </View>
                )}

                {/* Message — Both modes */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Message to Referrer</Text>
                  <TextInput
                    style={[
                      styles.textArea,
                      errors.referralMessage && styles.fieldInputError,
                    ]}
                    placeholder="Why you're a great fit for this role..."
                    placeholderTextColor={colors.gray500}
                    value={formData.referralMessage}
                    onChangeText={v => updateFormData('referralMessage', v)}
                    multiline
                    numberOfLines={3}
                    maxLength={1000}
                    textAlignVertical="top"
                  />
                  <Text style={styles.fieldHint}>
                    {formData.referralMessage.length}/1000
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* ═══════════════════════════════════════════════════════
            STICKY BOTTOM CTA — Price + Wallet + Send Button
            Always visible. GPay-style: user sees cost upfront.
            ═══════════════════════════════════════════════════════ */}
        <View style={styles.stickyBottom}>
          <View style={styles.stickySummary}>
            <View>
              <Text style={styles.stickyPriceLabel}>Total</Text>
              <Text style={styles.stickyPrice}>₹{effectiveCost}</Text>
            </View>
            <View style={styles.stickyBalanceBox}>
              <Ionicons
                name="wallet-outline"
                size={14}
                color={colors.success}
              />
              <Text style={styles.stickyBalance}>
                {loadingWallet ? '...' : `₹${walletBalance.toFixed(0)}`}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.stickyCTA,
              submitting && styles.stickyCTADisabled,
            ]}
            onPress={handleAskReferralClick}
            disabled={!isFormReady || submitting || loadingWallet}
            activeOpacity={0.85}
          >
            {!isFormReady || loadingWallet ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : submitting ? (
              <>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={styles.stickyCTAText}>Sending...</Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="paper-plane"
                  size={18}
                  color={colors.white}
                />
                <Text style={styles.stickyCTAText}>
                  Send Referral Request
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════
          MODALS & OVERLAYS (all interfaces preserved)
          ═══════════════════════════════════════════════════════════ */}

      {/* Company Selection Modal */}
      <Modal
        visible={showCompanyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCompanyModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Company</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowCompanyModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.gray600} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearch}>
            <Ionicons name="search" size={20} color={colors.gray500} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search companies..."
              value={companySearchTerm}
              onChangeText={setCompanySearchTerm}
              placeholderTextColor={colors.gray500}
              autoFocus
            />
            {companySearchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setCompanySearchTerm('')}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.gray400}
                />
              </TouchableOpacity>
            )}
          </View>

          {loadingCompanies ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.modalLoadingText}>Loading companies...</Text>
            </View>
          ) : (
            <FlatList
              data={companies.filter(c =>
                c.name
                  ?.toLowerCase()
                  ?.includes(companySearchTerm.toLowerCase())
              )}
              keyExtractor={item => item.id.toString()}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.companyItem}
                  onPress={() => handleCompanySelect(item)}
                  activeOpacity={0.7}
                >
                  {item.logoURL ? (
                    <CachedImage
                      source={{ uri: item.logoURL }}
                      style={styles.companyLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.companyLogoPlaceholder}>
                      <Ionicons
                        name="business"
                        size={20}
                        color={colors.gray400}
                      />
                    </View>
                  )}
                  <View style={styles.companyInfo}>
                    <Text style={styles.companyName}>{item.name}</Text>
                    {item.industry && item.industry !== 'Other' && (
                      <Text style={styles.companyIndustry}>
                        {item.industry}
                      </Text>
                    )}
                  </View>
                  {item.id === 999999 && (
                    <Ionicons
                      name="add-circle"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Ionicons
                    name="business"
                    size={48}
                    color={colors.gray400}
                  />
                  <Text style={styles.emptyText}>
                    {companySearchTerm
                      ? 'No companies found'
                      : 'No companies available'}
                  </Text>
                  {companySearchTerm && (
                    <Text style={styles.emptySubtext}>
                      Try different keywords
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {/* Resume Upload Modal */}
      <ResumeUploadModal
        visible={showResumeModal}
        onClose={() => setShowResumeModal(false)}
        onResumeSelected={handleResumeSelected}
        user={user}
        jobTitle={formData.jobTitle || 'External Job Application'}
      />

      {/* Wallet Recharge Modal */}
      <WalletRechargeModal
        visible={showWalletModal}
        currentBalance={walletModalData.currentBalance}
        requiredAmount={walletModalData.requiredAmount}
        onAddMoney={() => {
          setShowWalletModal(false);
          navigation.navigate('WalletRecharge');
        }}
        onCancel={() => setShowWalletModal(false)}
      />

      {/* Confirm Purchase Modal */}
      <ConfirmPurchaseModal
        visible={showReferralConfirmModal}
        currentBalance={walletBalance}
        requiredAmount={effectiveCost}
        contextType="referral"
        itemName={formData.jobTitle || 'this job'}
        onProceed={async () => {
          setShowReferralConfirmModal(false);
          await handleSubmit();
        }}
        onAddMoney={() => {
          setShowReferralConfirmModal(false);
          navigation.navigate('WalletRecharge');
        }}
        onCancel={() => setShowReferralConfirmModal(false)}
      />

      {/* Success Overlay (GPay-style green tick) */}
      <ReferralSuccessOverlay
        visible={showReferralSuccessOverlay}
        onComplete={() => {
          setShowReferralSuccessOverlay(false);
          navigation.goBack();
        }}
        duration={3500}
        companyName={referralCompanyName}
        broadcastTime={referralBroadcastTime}
        isOpenToAny={referralCompanyName === 'All Companies'}
      />
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════

const createStyles = (colors, responsive = {}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      ...(Platform.OS === 'web' && responsive.isDesktop
        ? { alignItems: 'center' }
        : {}),
    },
    innerContainer: {
      width: '100%',
      maxWidth:
        Platform.OS === 'web' && responsive.isDesktop ? 720 : '100%',
      flex: 1,
    },
    scrollContainer: {
      flex: 1,
    },

    // ── Header Search ──────────────────────────────────────────────
    searchContainerMain: {
      flex: 1,
      position: 'relative',
      zIndex: 9999,
    },
    searchInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      height: 40,
    },
    headerSearchInput: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text,
      padding: 0,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
    },
    searchResultsDropdown: {
      position: 'absolute',
      top: 44,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 300,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 999,
      zIndex: 9999,
    },
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    orgLogo: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.background,
    },
    orgLogoPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    orgName: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: 2,
    },
    orgIndustry: {
      fontSize: typography.sizes.xs,
      color: colors.gray600,
    },

    // ── Mode Selector (Hero) ───────────────────────────────────────
    modeSection: {
      padding: 16,
      paddingBottom: 8,
    },
    modeHeading: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.textPrimary,
      marginBottom: 14,
      textAlign: 'center',
    },
    modeCard: {
      position: 'relative',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    modeCardActive: {
      backgroundColor: colors.primaryBg,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    modeCardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    modeIconBox: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.gray100,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modeCardContent: {
      flex: 1,
    },
    modeCardTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
      color: colors.textPrimary,
      marginBottom: 4,
    },
    modeCardDesc: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 8,
    },
    modeTagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    modeTag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    modeTagText: {
      fontSize: 11,
      fontWeight: typography.weights.semibold,
    },
    modePriceBox: {
      alignItems: 'flex-end',
      minWidth: 50,
    },
    modePriceAmount: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.textPrimary,
    },
    modePriceLabel: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 1,
    },
    modeRadio: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.gray400,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modeRadioActive: {
      borderColor: colors.primary,
    },
    modeRadioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    recommendedBadge: {
      position: 'absolute',
      top: -1,
      left: 16,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 6,
      gap: 4,
      zIndex: 2,
    },
    recommendedText: {
      fontSize: 9,
      fontWeight: typography.weights.bold,
      color: colors.white,
      letterSpacing: 0.8,
    },

    // ── Social Proof Bar ───────────────────────────────────────────
    socialProofBar: {
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.successBorder || colors.success + '30',
    },
    socialProofContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    socialProofLogoBox: {
      width: 36,
      height: 36,
      borderRadius: 6,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    socialProofLogo: {
      width: 30,
      height: 30,
    },
    socialProofText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    socialProofCompany: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
    },
    socialProofRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.success + '15',
      borderWidth: 1,
      borderColor: colors.success + '40',
    },
    liveDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.success,
      marginRight: 5,
    },
    liveText: {
      fontSize: 9,
      fontWeight: typography.weights.bold,
      color: colors.success,
      letterSpacing: 0.6,
    },

    // ── Form Section ───────────────────────────────────────────────
    formSection: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },
    fieldGroup: {
      marginBottom: 20,
    },
    fieldLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
      marginBottom: 8,
    },
    req: {
      color: colors.danger,
    },
    fieldInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: typography.sizes.md,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    fieldInputError: {
      borderColor: colors.danger,
    },
    fieldError: {
      fontSize: typography.sizes.xs,
      color: colors.danger,
      marginTop: 4,
    },
    fieldHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
    },
    textArea: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: typography.sizes.md,
      color: colors.text,
      backgroundColor: colors.surface,
      minHeight: 80,
    },

    // ── Company Selector ───────────────────────────────────────────
    companySelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.surface,
    },
    companySelectorInner: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 8,
    },
    companySelectorLogo: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: colors.surface,
    },
    companySelectorLogoPlaceholder: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: colors.gray100,
      justifyContent: 'center',
      alignItems: 'center',
    },
    companySelectorName: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.medium,
      color: colors.textPrimary,
      flex: 1,
    },
    companySelectorPlaceholder: {
      fontSize: typography.sizes.md,
      color: colors.gray500,
      flex: 1,
    },
    tierBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    tierBadgeText: {
      fontSize: 10,
      fontWeight: typography.weights.bold,
    },

    // ── Resume Styles ──────────────────────────────────────────────
    resumeLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      backgroundColor: colors.gray50,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resumeLoadingText: {
      marginLeft: 10,
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
    },
    resumePill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primaryBg,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    resumePillLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    resumePillName: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
    },
    resumePillPrimary: {
      fontSize: 10,
      fontWeight: typography.weights.bold,
      color: colors.success,
      marginTop: 1,
    },
    resumeChangeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.primary + '15',
    },
    resumeChangeBtnText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    resumeSelectList: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    resumeSelectItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    resumeSelectItemActive: {
      backgroundColor: colors.primaryBg,
    },
    resumeSelectLabel: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.textPrimary,
    },
    miniRadio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.gray400,
      justifyContent: 'center',
      alignItems: 'center',
    },
    miniRadioActive: {
      borderColor: colors.primary,
    },
    miniRadioInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    seeAllResumes: {
      padding: 10,
      alignItems: 'center',
    },
    seeAllResumesText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    resumeUploadCTA: {
      alignItems: 'center',
      padding: 24,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.primary + '40',
      borderStyle: 'dashed',
    },
    resumeUploadCTATitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
      marginTop: 8,
    },
    resumeUploadCTADesc: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 4,
    },

    // ── Optional Fields ────────────────────────────────────────────
    optionalToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      gap: 6,
      marginBottom: 8,
    },
    optionalToggleText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.primary,
    },
    optionalFilledDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    optionalSection: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },

    // ── Salary Row ─────────────────────────────────────────────────
    salaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    salaryPrefix: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.primary + '12',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    salaryPrefixText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    salaryInput: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: typography.sizes.md,
      color: colors.text,
    },
    salarySuffix: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.primary + '12',
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    },
    salarySuffixText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },

    // ── Sticky Bottom CTA ──────────────────────────────────────────
    stickyBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 12,
      ...(Platform.OS === 'ios' ? { paddingBottom: 28 } : {}),
    },
    stickySummary: {
      gap: 2,
    },
    stickyPriceLabel: {
      fontSize: 10,
      color: colors.textMuted,
      fontWeight: typography.weights.medium,
    },
    stickyPrice: {
      fontSize: typography.sizes.xl || 20,
      fontWeight: typography.weights.bold,
      color: colors.textPrimary,
    },
    stickyBalanceBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    stickyBalance: {
      fontSize: 11,
      fontWeight: typography.weights.semibold,
      color: colors.success,
    },
    stickyCTA: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    stickyCTADisabled: {
      backgroundColor: colors.gray300,
    },
    stickyCTAText: {
      color: colors.white,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
    },

    // ── Company Modal ──────────────────────────────────────────────
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    modalTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.textPrimary,
    },
    modalCloseBtn: {
      padding: 8,
    },
    modalSearch: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      backgroundColor: colors.surface,
    },
    modalSearchInput: {
      flex: 1,
      marginLeft: 8,
      fontSize: typography.sizes.md,
      color: colors.text,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
    },
    modalLoading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalLoadingText: {
      marginTop: 12,
      fontSize: typography.sizes.md,
      color: colors.textMuted,
    },
    companyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    companyLogo: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    companyLogoPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.gray100,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    companyInfo: {
      flex: 1,
    },
    companyName: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.medium,
      color: colors.textPrimary,
    },
    companyIndustry: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    emptyContainer: {
      alignItems: 'center',
      padding: 40,
    },
    emptyText: {
      fontSize: typography.sizes.md,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 12,
    },
    emptySubtext: {
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
    },

    // ── Error Screen ───────────────────────────────────────────────
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
      backgroundColor: colors.background,
    },
    errorTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.textPrimary,
      marginTop: 16,
      marginBottom: 8,
    },
    errorSubtext: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
  });
