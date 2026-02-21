import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import TabHeader from '../../components/TabHeader';
import SubScreenHeader from '../../components/SubScreenHeader';
import { usePricing } from '../../contexts/PricingContext';
import refopenAPI from '../../services/api';
import JobCard from '../../components/jobs/JobCard';
import AdCard from '../../components/ads/AdCard';
import FilterModal from '../../components/jobs/FilterModal';
import ResumeUploadModal from '../../components/ResumeUploadModal';
import WalletRechargeModal from '../../components/WalletRechargeModal';
import ConfirmPurchaseModal from '../../components/ConfirmPurchaseModal';
import ReferralSuccessOverlay from '../../components/ReferralSuccessOverlay';
import { createStyles } from './JobsScreen.styles';
import { showToast } from '../../components/Toast';
import { typography } from '../../styles/theme';
import useResponsive from '../../hooks/useResponsive';
import { ResponsiveContainer } from '../../components/common/ResponsiveLayout';
import { getCached, hasCached, setCache, invalidateCache, CACHE_KEYS } from '../../utils/homeCache';

// Ad configuration - Google AdSense
const AD_CONFIG = {
  enabled: true,                              // Toggle ads on/off
  adClient: 'ca-pub-7167287641762329',        // Your AdSense Publisher ID
  adSlot: '1062213844',                       // RefOpen Job Feeds ad slot
  frequency: 5,                               // Show ad after every N job cards
};

// Debounce hook
const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
};

// Chips helper
const isSelected = (arr, id) => arr?.some(x => String(x) === String(id));

// Helper to get years from months
const monthsToYears = (m) => {
  const n = parseInt(m || 0, 10);
  return isNaN(n) ? 0 : Math.floor(n / 12);
};

// Helper to format counts smartly
const formatCount = (count) => {
  const num = Number(count) || 0;
  if (num < 100) return String(num); // Exact count below 100
  if (num < 1000) return '100+'; // 100-999
  if (num < 10000) return '1000+'; // 1000-9999
  return '10k+'; // 10000+
};

// Map strings to ids using reference arrays
const mapTypesToIds = (names = [], ref = [], idKey = 'JobTypeID', nameKey = 'Type') => {
  const set = new Set(names.map((s) => (s || '').toString().trim().toLowerCase()));
  return ref.filter((r) => set.has((r[nameKey] || '').toString().trim().toLowerCase())).map((r) => r[idKey]);
};

// Constants
const EMPTY_FILTERS = {
  location: '',
  jobTypeIds: [],
  workplaceTypeIds: [],
  organizationIds: [],
  salaryMin: '',
  salaryMax: '',
  currencyId: null,
  experienceMin: '',
  experienceMax: '',
  postedWithinDays: null,
  department: '',
  postedByType: null
};

// Helper: detect if any filters are active (compared to EMPTY_FILTERS)
const isFiltersDirty = (f) => {
  const defaults = EMPTY_FILTERS;
  return Object.keys(defaults).some((k) => {
    const v = f[k];
    const d = defaults[k];
    if (Array.isArray(d)) return (v || []).length > 0;
    return (v ?? '') !== (d ?? '');
  });
};

const createAiModalStyles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.background,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerAI: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: colors.error,
  },
  headerTitleAI: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  headerTitleDanger: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  body: {
    padding: 16,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  benefits: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  benefitsTitle: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.semibold,
    marginBottom: 8,
  },
  benefitItem: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  benefitNote: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 8,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  kvLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  kvValue: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  kvDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  kvLabelBold: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  kvValueBold: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: {
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
});

export default function JobsScreen({ navigation, route }) {
  const { user, isJobSeeker } = useAuth();
  const { colors } = useTheme();
  const { pricing } = usePricing(); // 💰 DB-driven pricing
  const responsive = useResponsive();
  const { isMobile, isDesktop, isTablet, gridColumns, contentWidth } = responsive;
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const aiModalStyles = useMemo(() => createAiModalStyles(colors), [colors]);
  
  // 🔧 REQUIREMENT 1: Handle navigation params from JobDetailsScreen
  const { successMessage, appliedJobId, filterF500 } = route.params || {};

  // 🔧 Reset filterF500 when Jobs tab is pressed directly (not from HomeScreen's "See All")
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (e) => {
      // When tab is pressed, clear the filterF500 param so it shows all jobs
      if (filterF500) {
        navigation.setParams({ filterF500: undefined });
      }
    });
    return unsubscribe;
  }, [navigation, filterF500]);

  const [jobs, setJobs] = useState(() => getCached(CACHE_KEYS.JOBS_LIST) || []);
  const [loading, setLoading] = useState(!hasCached(CACHE_KEYS.JOBS_LIST));
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 350);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 30, hasMore: true });

  // Applied filters
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });

  // Manual reload trigger
  const [reloadKey, setReloadKey] = useState(0);
  const triggerReload = useCallback(() => setReloadKey(k => k + 1), []);

  // Draft for modal
  const [filterDraft, setFilterDraft] = useState({ ...EMPTY_FILTERS });
  const [showFilters, setShowFilters] = useState(false);
  const [initialFilterSection, setInitialFilterSection] = useState(null);

  // ✅ NEW: Resume modal state
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [pendingJobForApplication, setPendingJobForApplication] = useState(null);
  const [referralMode, setReferralMode] = useState(false); // NEW: distinguish apply vs referral

  // ✅ NEW: Referral tracking state
  const [referredJobIds, setReferredJobIds] = useState(new Set());
  const [referralRequestingIds, setReferralRequestingIds] = useState(new Set()); // NEW
  // Cache primary resume (or fallback first resume) so we can auto-apply without showing modal every time
  const [primaryResume, setPrimaryResume] = useState(null);
  const primaryResumeLoadedRef = useRef(false);

  // ⚡ AbortController: cancel in-flight supporting API calls when user leaves this tab
  const tabAbortRef = useRef(null);
  // Create a fresh controller for mount-time calls
  useEffect(() => {
    const ac = new AbortController();
    tabAbortRef.current = ac;
    return () => { ac.abort(); tabAbortRef.current = null; };
  }, []);

  // 💎 NEW: Beautiful wallet modal state
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalData, setWalletModalData] = useState({ currentBalance: 0, requiredAmount: pricing.referralRequestCost });

  // 💎 NEW: Referral confirmation modal state
  const [showReferralConfirmModal, setShowReferralConfirmModal] = useState(false);
  const [referralConfirmData, setReferralConfirmData] = useState({ currentBalance: 0, requiredAmount: pricing.referralRequestCost, jobId: null, jobTitle: '', companyName: '', job: null });

  // 🎉 NEW: Referral success overlay state
  const [showReferralSuccessOverlay, setShowReferralSuccessOverlay] = useState(false);
  const [referralCompanyName, setReferralCompanyName] = useState('');

  // Profile photo handled by TabHeader
  const [referralBroadcastTime, setReferralBroadcastTime] = useState(null);
  const [pendingReferralJobId, setPendingReferralJobId] = useState(null);

  // 🤖 AI Recommended Jobs access (moved from Home to Jobs)
  const [walletBalance, setWalletBalance] = useState(0);
  const [showAIConfirmModal, setShowAIConfirmModal] = useState(false);
  const [isInsufficientBalance, setIsInsufficientBalance] = useState(false);
  const [hasActiveAIAccess, setHasActiveAIAccess] = useState(false);

  const loadWalletBalance = useCallback(async () => {
    try {
      const result = await refopenAPI.getWalletBalance(tabAbortRef.current ? { signal: tabAbortRef.current.signal } : {});
      if (result?.success) {
        // Use availableBalance for hold-based payment system
        setWalletBalance(result.data?.availableBalance ?? result.data?.balance ?? 0);
      }
    } catch (e) {
      // silent
    }
  }, []);

  const checkAIAccessStatus = useCallback(async () => {
    try {
      // Use unified access API
      const result = await refopenAPI.apiCall('/access/status?type=ai_jobs', tabAbortRef.current ? { signal: tabAbortRef.current.signal } : {});
      if (result?.success) {
        setHasActiveAIAccess(!!result.data?.hasActiveAccess);
      } else {
        setHasActiveAIAccess(false);
      }
    } catch (e) {
      setHasActiveAIAccess(false);
    }
  }, []);

  useEffect(() => {
    if (!user || !isJobSeeker) return;
    loadWalletBalance();
    checkAIAccessStatus();
  }, [user, isJobSeeker, loadWalletBalance, checkAIAccessStatus]);

  const handleSearchWithAI = useCallback(async () => {
    if (!user) {
      if (Platform.OS === 'web') {
        if (window.confirm('Please login to view AI recommended jobs.\n\nWould you like to login now?')) {
          navigation.navigate('Auth');
        }
        return;
      }
      Alert.alert('Login Required', 'Please login to view AI recommended jobs', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Auth') },
      ]);
      return;
    }
    if (!isJobSeeker) {
      showToast('Only job seekers can use AI job recommendations', 'error');
      return;
    }

    try {
      // Use unified access API
      const accessStatus = await refopenAPI.apiCall('/access/status?type=ai_jobs');
      if (accessStatus?.success && accessStatus.data?.hasActiveAccess) {
        navigation.navigate('AIRecommendedJobs');
        return;
      }
    } catch (e) {
      // fall through to payment flow
    }

    const requiredAmount = pricing.aiJobsCost;
    // Ensure we have latest wallet balance before deciding
    try {
      const bal = await refopenAPI.getWalletBalance();
      // Use availableBalance for hold-based payment system
      const current = bal?.success ? (bal.data?.availableBalance ?? bal.data?.balance ?? 0) : walletBalance;
      setWalletBalance(current);
      if (current < requiredAmount) {
        setIsInsufficientBalance(true);
        setShowAIConfirmModal(true);
        return;
      }
      setIsInsufficientBalance(false);
      setShowAIConfirmModal(true);
    } catch (e) {
      // fallback: show modal with current cached balance
      const current = walletBalance || 0;
      if (current < requiredAmount) setIsInsufficientBalance(true);
      else setIsInsufficientBalance(false);
      setShowAIConfirmModal(true);
    }
  }, [user, isJobSeeker, navigation, walletBalance]);

  const handleAIJobsConfirm = useCallback(() => {
    setShowAIConfirmModal(false);
    if (!isInsufficientBalance) {
      navigation.navigate('AIRecommendedJobs');
      setTimeout(() => {
        loadWalletBalance();
        checkAIAccessStatus();
      }, 1000);
    }
  }, [isInsufficientBalance, navigation, loadWalletBalance, checkAIAccessStatus]);

  const handleAIJobsCancel = useCallback(() => {
    setShowAIConfirmModal(false);
    if (isInsufficientBalance) {
      navigation.navigate('WalletRecharge');
    }
  }, [isInsufficientBalance, navigation]);

  // Load primary resume once (or first resume as fallback)
  const loadPrimaryResume = useCallback(async () => {
    if (!user || !isJobSeeker) return;
    if (primaryResumeLoadedRef.current && primaryResume) return;
    try {
      const profile = await refopenAPI.getApplicantProfile(user.UserID || user.userId || user.id || user.sub, tabAbortRef.current ? { signal: tabAbortRef.current.signal } : {});
      if (profile?.success) {
        const resumes = profile.data?.resumes || [];
        const primary = resumes.find(r => r.IsPrimary) || resumes[0];
        if (primary) setPrimaryResume(primary);
      }
    } catch (e) {
      // silent
    } finally {
      primaryResumeLoadedRef.current = true;
    }
  }, [user, isJobSeeker, primaryResume]);

  useEffect(() => { loadPrimaryResume(); }, [loadPrimaryResume]);

  const [jobTypes, setJobTypes] = useState(() => getCached(CACHE_KEYS.JOBS_JOB_TYPES) || []);
  const [workplaceTypes, setWorkplaceTypes] = useState(() => getCached(CACHE_KEYS.JOBS_WORKPLACE_TYPES) || []);
  const [currencies, setCurrencies] = useState(() => getCached(CACHE_KEYS.JOBS_CURRENCIES) || []);
  const [companies, setCompanies] = useState(() => getCached(CACHE_KEYS.JOBS_COMPANIES) || []);

  // Smart filter toggle
  const [smartEnabled] = useState(false);
  const [personalizationApplied, setPersonalizationApplied] = useState(false);
  const [smartBoosts, setSmartBoosts] = useState({});

  const hasBoosts = useMemo(() => {
    if (!smartBoosts) return false;
    return Object.values(smartBoosts).some(v => v !== undefined && v !== null && String(v).trim() !== '');
  }, [smartBoosts]);

  // Quick filter states
  const [quickJobType, setQuickJobType] = useState('');
  const [quickWorkplaceType, setQuickWorkplaceType] = useState('');
  const [quickPostedWithin, setQuickPostedWithin] = useState('');
  const [expandedQuick, setExpandedQuick] = useState(null);

  // Compute quick labels based on selections
  const quickJobTypeLabel = useMemo(() => {
    const ids = filters.jobTypeIds || [];
    if (!ids.length) return 'JobType';
    const names = ids.map(id => (jobTypes.find(j => String(j.JobTypeID) === String(id)) || {}).Type).filter(Boolean);
    return names.length ? names.slice(0, 2).join('/') + (names.length > 2 ? ` +${names.length - 2}` : '') : 'JobType';
  }, [filters.jobTypeIds, jobTypes]);

  const quickWorkplaceLabel = useMemo(() => {
    const ids = filters.workplaceTypeIds || [];
    if (!ids.length) return 'Workplace';
    const names = ids.map(id => (workplaceTypes.find(w => String(w.WorkplaceTypeID) === String(id)) || {}).Type).filter(Boolean);
    return names.length ? names.slice(0, 2).join('/') + (names.length > 2 ? ` +${names.length - 2}` : '') : 'Workplace';
  }, [filters.workplaceTypeIds, workplaceTypes]);

  const quickCompanyLabel = useMemo(() => {
    const orgIds = filters.organizationIds || [];
    if (!orgIds.length) return 'Company';
    
    // Map IDs to names for display
    const orgNames = orgIds
      .map(id => companies.find(c => c.id === id)?.name)
      .filter(Boolean);
    
    return orgNames.length 
      ? orgNames.slice(0, 2).join('/') + (orgNames.length > 2 ? ` +${orgNames.length - 2}` : '') 
      : 'Company';
  }, [filters.organizationIds, companies]);

  // Toggle selection helper
  const toggleId = (arr, id) => (arr || []).some(x => String(x) === String(id))
    ? (arr || []).filter(x => String(x) !== String(id))
    : [ ...(arr || []), id ];

  // Inline quick slider toggle handlers
  const onQuickToggleJobType = useCallback((id) => {
    setFilters(prev => ({ ...prev, jobTypeIds: toggleId(prev.jobTypeIds, id) }))
    setPagination(p => ({ ...p, page: 1 }))
    triggerReload()
  }, [triggerReload])

  const onQuickToggleWorkplace = useCallback((id) => {
    setFilters(prev => ({ ...prev, workplaceTypeIds: toggleId(prev.workplaceTypeIds, id) }))
    setPagination(p => ({ ...p, page: 1 }))
    triggerReload()
  }, [triggerReload])

  // Applied count for badge display
  const [appliedCount, setAppliedCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [savedIds, setSavedIds] = useState(new Set());
  const [smartPaginating, setSmartPaginating] = useState(false);
  
  // My Referral Requests count for FAB badge
  const [myReferralRequestsCount, setMyReferralRequestsCount] = useState(0);

  // 🔧 REQUIREMENT 1: Show success message and handle applied job removal
  useEffect(() => {
    if (successMessage) {
      setTimeout(() => {
        showToast(successMessage, 'success');
      }, 500); // Small delay to ensure screen is loaded
    }

    // 🔧 NEW: Remove applied job from jobs list and refresh data
    if (appliedJobId) {
      // Remove from current jobs list immediately
      setJobs(prev => {
        const filtered = prev.filter(j => (j.JobID || j.id) !== appliedJobId);
        return filtered;
      });

      // Add to applied IDs
      setAppliedIds(prev => new Set([...prev, appliedJobId]));

      // Trigger a full refresh to get updated data after a short delay
      setTimeout(() => {
        triggerReload(); // This will refresh the jobs list
        refreshApplicationsData(); // This will refresh applications
      }, 1000);
    }
  }, [successMessage, appliedJobId, triggerReload, refreshApplicationsData]);

  // 🔧 Function to refresh applications data
  const refreshApplicationsData = useCallback(async () => {
    try {
      const r = await refopenAPI.getMyApplications(1, 500, tabAbortRef.current ? { signal: tabAbortRef.current.signal } : {});
      if (r?.success) {
        const ids = new Set((r.data || []).map(a => a.JobID));
        setAppliedIds(ids);
        setAppliedCount(Number(r.meta?.total || r.data?.length || 0));
      }
    } catch (e) {
      console.error('❌ Failed to refresh applications data:', e);
    }
  }, []);

  // Load applied IDs on mount (needed for FAB badge + bookmark state)
  useEffect(() => { refreshApplicationsData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved job IDs (needed for bookmark icon state)
  useEffect(() => {
    (async () => {
      try {
        const r = await refopenAPI.getMySavedJobs(1, 500, tabAbortRef.current ? { signal: tabAbortRef.current.signal } : {});
        if (r?.success) {
          const ids = new Set((r.data || []).map(s => s.JobID));
          setSavedIds(ids);
          setSavedCount(Number(r.meta?.total || r.data?.length || 0));
        }
      } catch {}
    })();
  }, []);

  // ⚡ No focus listener — data loads on mount, pull-to-refresh for updates. Zero work on tab switch = instant.
  // But we DO abort in-flight supporting fetches on blur so destination screen gets priority.
  useFocusEffect(
    useCallback(() => {
      return () => {
        // On blur: abort supporting API calls (wallet, applications, saved jobs, etc.)
        if (tabAbortRef.current) { tabAbortRef.current.abort(); tabAbortRef.current = null; }
        // Also abort the main job list fetch
        if (listAbortRef.current) { try { listAbortRef.current.abort(); } catch {} }
        if (loadMoreAbortRef.current) { try { loadMoreAbortRef.current.abort(); } catch {} }
      };
    }, [])
  );

  // Load referral data (deferred 100ms)
  useEffect(() => {
    if (!user || !isJobSeeker) return;

    const timer = setTimeout(() => {
      (async () => {
        try {
          const referralRes = await refopenAPI.getMyReferralRequests(1, 500, tabAbortRef.current ? { signal: tabAbortRef.current.signal } : {});

          if (referralRes?.success && referralRes.data?.requests) {
            const activeRequests = referralRes.data.requests.filter(r => r.Status !== 'Cancelled' && r.Status !== 'Expired');
            const ids = new Set(activeRequests.map(r => r.JobID));
            setReferredJobIds(ids);
            setMyReferralRequestsCount(activeRequests.length);
          }
        } catch (e) {
          console.warn('Failed to load referral data:', e.message);
        }
      })();
    }, 100);

    return () => clearTimeout(timer);
  }, [user, isJobSeeker]);

  const refreshCounts = useCallback(async () => {
    try {
      const sig = tabAbortRef.current ? { signal: tabAbortRef.current.signal } : {};
      const [appliedRes, savedRes] = await Promise.all([
        refopenAPI.getMyApplications(1, 1, sig),
        refopenAPI.getMySavedJobs(1, 1, sig)
      ]);
      if (appliedRes?.success) setAppliedCount(Number(appliedRes.meta?.total || 0));
      if (savedRes?.success) setSavedCount(Number(savedRes.meta?.total || 0));
    } catch {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshCounts();
    }, 100);
    return () => clearTimeout(timer);
  }, [refreshCounts]);

  // Apply smart filters based on user profile
  const applySmart = useCallback(async () => {
    try {
      if (!user) return;
      const profRes = await refopenAPI.getApplicantProfile(user.UserID || user.userId || user.id || user.sub, tabAbortRef.current ? { signal: tabAbortRef.current.signal } : {});
      if (profRes?.success) {
        const profile = profRes.data;
        const years = monthsToYears(profile.TotalExperienceMonths);
        const rawLoc = (profile.PreferredLocations || profile.CurrentLocation || '').split(',')[0]?.trim();
        const loc = rawLoc && /[a-zA-Z]/.test(rawLoc) && rawLoc.length >= 3 ? rawLoc : null;

        const pjt = (profile.PreferredJobTypes || '').split(',').map(s => s.trim()).filter(Boolean);
        const boostJobTypeIds = pjt.length ? mapTypesToIds(pjt, jobTypes, 'JobTypeID', 'Type') : [];
        const pwt = (profile.PreferredWorkTypes || '').split(',').map(s => s.trim()).filter(Boolean);
        const boostWorkplaceTypeIds = pwt.length ? mapTypesToIds(pwt, workplaceTypes, 'WorkplaceTypeID', 'Type') : [];

        const nextBoosts = {};
        if (years) nextBoosts.candidateYears = years;
        if (loc) nextBoosts.boostLocation = loc;
        if (boostJobTypeIds.length) nextBoosts.boostJobTypeIds = boostJobTypeIds.join(',');
        if (boostWorkplaceTypeIds.length) nextBoosts.boostWorkplaceTypeIds = boostWorkplaceTypeIds.join(',');
        setSmartBoosts(nextBoosts);
        setPersonalizationApplied(true);
      } else {
        setPersonalizationApplied(true);
      }
    } catch (e) {
      console.warn('Smart filter apply failed:', e?.message);
      setPersonalizationApplied(true);
    }
  }, [user, jobTypes, workplaceTypes]);

  // Personalize only if explicitly enabled
  useEffect(() => {
    const ready = !!user && !personalizationApplied && smartEnabled;
    const pristine = searchQuery.length === 0 && !isFiltersDirty(filters);
    if (ready && pristine) {
      applySmart();
    }
  }, [user, personalizationApplied, smartEnabled, searchQuery, filters, applySmart]);

  // ⏱️ PRIORITY 3: Load after 300ms delay - Job Types, Workplace Types, Currencies (for filters)
  useEffect(() => {
    const timer = setTimeout(() => {
      (async () => {
        try {
          const sig = tabAbortRef.current ? { signal: tabAbortRef.current.signal } : {};
          const [refData, cur] = await Promise.all([
            refopenAPI.getBulkReferenceMetadata(['JobType', 'WorkplaceType'], sig),
            refopenAPI.getCurrencies(sig)
          ]);
          if (refData?.success && refData.data) {
            // Transform JobType data
            if (refData.data.JobType) {
              const transformedJobTypes = refData.data.JobType.map(item => ({
                JobTypeID: item.ReferenceID,
                Type: item.Value
              }));
              setJobTypes(transformedJobTypes);
              setCache(CACHE_KEYS.JOBS_JOB_TYPES, transformedJobTypes);
            }
            // Transform WorkplaceType data
            if (refData.data.WorkplaceType) {
              const transformedWorkplaceTypes = refData.data.WorkplaceType.map(item => ({
                WorkplaceTypeID: item.ReferenceID,
                Type: item.Value
              }));
              setWorkplaceTypes(transformedWorkplaceTypes);
              setCache(CACHE_KEYS.JOBS_WORKPLACE_TYPES, transformedWorkplaceTypes);
            }
          }
          if (cur?.success) {
            setCurrencies(cur.data);
            setCache(CACHE_KEYS.JOBS_CURRENCIES, cur.data);
          }
        } catch (e) {
          console.warn('Failed to load reference data:', e.message);
        }
      })();
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  // 🎯 PRIORITY 4: Preload companies — instant from cache, refresh in bg
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const companiesLoadedRef = useRef(false);

  useEffect(() => {
    // If cache exists, skip the 2s delay — companies already in state
    const delay = hasCached(CACHE_KEYS.JOBS_COMPANIES) ? 0 : 2000;
    const timer = setTimeout(() => {
      if (!companiesLoadedRef.current) {
        companiesLoadedRef.current = true;
        if (!hasCached(CACHE_KEYS.JOBS_COMPANIES)) setLoadingCompanies(true);
        
        (async () => {
          try {
            const orgs = await refopenAPI.getOrganizations('', null, 0, tabAbortRef.current ? { signal: tabAbortRef.current.signal } : {});
            if (orgs?.success) {
              const filteredOrgs = orgs.data.filter(org => {
                const hasName = org.name && org.name.trim().length > 0;
                return hasName;
              });
              setCompanies(filteredOrgs);
              setCache(CACHE_KEYS.JOBS_COMPANIES, filteredOrgs);
            }
          } catch (e) {
            console.warn('Failed to load organizations:', e.message);
          } finally {
            setLoadingCompanies(false);
          }
        })();
      }
    }, 2000); // Wait 2s for jobs to load first
    return () => clearTimeout(timer);
  }, []);

  // Track modal open and loading states
  const showFiltersRef = useRef(false);
  useEffect(() => { showFiltersRef.current = showFilters; }, [showFilters]);

  const [loadingMore, setLoadingMore] = useState(false);
  const listAbortRef = useRef(null);
  const loadMoreAbortRef = useRef(null);
  const mountedRef = useRef(true);
  // NEW: guards to prevent duplicate load-more triggers
  const isLoadingMoreRef = useRef(false);
  const lastAutoLoadPageRef = useRef(0);

  useEffect(() => () => {
    mountedRef.current = false;
    try { listAbortRef.current?.abort?.(); } catch {}
    try { loadMoreAbortRef.current?.abort?.(); } catch {}
  }, []);

  // ===== BASE LIST FETCH (page 1) =====
  useEffect(() => {
    if (showFiltersRef.current) return;

    if (listAbortRef.current) { try { listAbortRef.current.abort(); } catch {} }
    const controller = new AbortController();
    listAbortRef.current = controller;

    const run = async () => {
      try {
        // ⚡ Only show loading spinner if no cache exists (first ever load)
        if (!hasCached(CACHE_KEYS.JOBS_LIST) || isFiltersDirty(filters) || debouncedQuery || filterF500) {
          setLoading(true);
        }
        const apiFilters = {};
        if (filters.location) apiFilters.location = filters.location;
if (filters.jobTypeIds?.length) apiFilters.jobTypeIds = filters.jobTypeIds.join(',');
    if (filters.workplaceTypeIds?.length) apiFilters.workplaceTypeIds = filters.workplaceTypeIds.join(',');
        if (filters.organizationIds?.length) apiFilters.organizationIds = filters.organizationIds.join(',');
        if (filters.salaryMin) apiFilters.salaryMin = filters.salaryMin;
        if (filters.salaryMax) apiFilters.salaryMax = filters.salaryMax;
        if (filters.currencyId) apiFilters.currencyId = filters.currencyId;
        if (filters.experienceMin) apiFilters.experienceMin = filters.experienceMin;
        if (filters.experienceMax) apiFilters.experienceMax = filters.experienceMax;
        if (filters.postedWithinDays) apiFilters.postedWithinDays = filters.postedWithinDays;
    if (filters.department) apiFilters.department = filters.department;
        if (filters.postedByType !== null && filters.postedByType !== undefined) apiFilters.postedByType = filters.postedByType;
    
        // 🏢 Filter by Fortune 500 companies when navigating from Top MNCs section
        if (filterF500) apiFilters.isFortune500 = true;

    // 🔍 DEBUG: Log organization filter details
        
        
        
        
        // Map IDs to names for debugging
        if (filters.organizationIds?.length) {
          const selectedOrgNames = filters.organizationIds.map(id => {
            const org = companies.find(c => c.id === id);
            return org ? `${org.name} (ID: ${id})` : `Unknown (ID: ${id})`;
          });
          
        }

    const shouldUseSearch = debouncedQuery.trim().length > 0 || (personalizationApplied && Object.keys(smartBoosts).length > 0);

  // ⏱️ START: Measure API response time
const apiStartTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        

        let result;
        if (shouldUseSearch) {
    const params = { page: 1, pageSize: pagination.pageSize, ...apiFilters, ...smartBoosts };
    result = await refopenAPI.searchJobs(debouncedQuery.trim() || '', params, { signal: controller.signal });
        } else {
          result = await refopenAPI.getJobs(1, pagination.pageSize, apiFilters, { signal: controller.signal });
        }

        // ⏱️ END: Calculate and log response time
 const apiEndTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const responseTime = apiEndTime - apiStartTime;

      if (controller.signal.aborted) return;

        if (result.success) {
       const list = Array.isArray(result.data) ? result.data : [];
              
              // 🔍 DEBUG: Log received jobs and their organizations
              
              if (list.length > 0 && filters.organizationIds?.length) {
                
                list.slice(0, 5).forEach((job, idx) => {
                  
                });
                
                // Check if any jobs don't match the filter
                const unexpectedJobs = list.filter(job => 
                  !filters.organizationIds.includes(job.OrganizationID)
                );
                if (unexpectedJobs.length > 0) {
                  console.warn('⚠️ WARNING: Found jobs from organizations NOT in filter!');
                  console.warn('⚠️ Unexpected organizations:', 
                    unexpectedJobs.map(j => `${j.OrganizationName} (ID: ${j.OrganizationID})`).slice(0, 5)
                  );
                }
              }
              
       setJobs(list);
       // ⚡ Cache the initial unfiltered job list for instant next render
       if (!debouncedQuery && !isFiltersDirty(filters) && !filterF500) {
         setCache(CACHE_KEYS.JOBS_LIST, list);
       }
  const meta = result.meta || {};
          setPagination(prev => {
            const nextPageSize = meta.pageSize || prev.pageSize;
            const hasMore = meta.hasMore !== undefined ? Boolean(meta.hasMore) : (list.length === nextPageSize);
            return {
              ...prev,
              page: meta.page || 1,
              pageSize: nextPageSize,
              hasMore
            };
          });
        }
   } catch (e) {
    if (e?.name !== 'AbortError') {
        // Error handling
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    run();
    return () => { try { controller.abort(); } catch {} };
  }, [debouncedQuery, filters, reloadKey, personalizationApplied, smartBoosts, pagination.pageSize, filterF500]);

  // ===== LOAD MORE =====
  const loadMoreJobs = useCallback(async () => {
    if (showFiltersRef.current) return;
    if (loading || loadingMore) return;
    if (isLoadingMoreRef.current) return;
    if (!pagination.hasMore) {
      return;
    }

    const nextPage = (pagination.page || 1) + 1;

    if (lastAutoLoadPageRef.current === nextPage) {
      return;
    }

    if (loadMoreAbortRef.current) { try { loadMoreAbortRef.current.abort(); } catch {} }
    const controller = new AbortController();
    loadMoreAbortRef.current = controller;

    try {
      isLoadingMoreRef.current = true;
      setLoadingMore(true);
      const apiFilters = {};
      if (filters.location) apiFilters.location = filters.location;
      if (filters.jobTypeIds?.length) apiFilters.jobTypeIds = filters.jobTypeIds.join(',');
      if (filters.workplaceTypeIds?.length) apiFilters.workplaceTypeIds = filters.workplaceTypeIds.join(',');
      if (filters.organizationIds?.length) apiFilters.organizationIds = filters.organizationIds.join(',');
      if (filters.salaryMin) apiFilters.salaryMin = filters.salaryMin;
      if (filters.salaryMax) apiFilters.salaryMax = filters.salaryMax;
      if (filters.currencyId) apiFilters.currencyId = filters.currencyId;
      if (filters.experienceMin) apiFilters.experienceMin = filters.experienceMin;
      if (filters.experienceMax) apiFilters.experienceMax = filters.experienceMax;
      if (filters.postedWithinDays) apiFilters.postedWithinDays = filters.postedWithinDays;
      if (filters.department) apiFilters.department = filters.department;
      if (filters.postedByType !== null && filters.postedByType !== undefined) apiFilters.postedByType = filters.postedByType;
      
      // 🏢 Filter by Fortune 500 companies when navigating from Top MNCs section
      if (filterF500) apiFilters.isFortune500 = true;

       // ⏱️ START: Measure API response time for pagination
     const apiStartTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

      let result;
   if (debouncedQuery.trim().length > 0 || hasBoosts) {
        result = await refopenAPI.searchJobs(debouncedQuery.trim(), { ...apiFilters, page: nextPage, pageSize: pagination.pageSize }, { signal: controller.signal });
      } else {
        result = await refopenAPI.getJobs(nextPage, pagination.pageSize, apiFilters, { signal: controller.signal });
      }

      // ⏱️ END: Calculate and log response time
      const apiEndTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const responseTime = apiEndTime - apiStartTime;

   if (controller.signal.aborted) return;

    if (result.success) {
        const list = Array.isArray(result.data) ? result.data : [];
        setJobs(prev => [...prev, ...list]);

        const meta = result.meta || {};
        setPagination(prev => {
          const nextPageSize = meta.pageSize || prev.pageSize;
          const hasMore = meta.hasMore !== undefined ? Boolean(meta.hasMore) : (list.length === nextPageSize);
          return {
            ...prev,
            page: meta.page || nextPage,
            pageSize: nextPageSize,
            hasMore
          };
        });

        if (list.length === 0) {
          setPagination(prev => ({ ...prev, hasMore: false }));
        } else {
          lastAutoLoadPageRef.current = meta.page || nextPage;
    }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        // Error handling
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingMore(false);
        isLoadingMoreRef.current = false;
      }
    }
  }, [loading, loadingMore, pagination.hasMore, pagination.page, pagination.pageSize, debouncedQuery, filters, hasBoosts]);

  // ===== Infinite scroll =====
  const onScrollNearEnd = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent || {};
    if (!contentOffset || !contentSize || !layoutMeasurement) return;
    if (loading || loadingMore) return;
    if (!pagination.hasMore) return;
    const threshold = 160;
    const isNearEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - threshold;
    if (isNearEnd) {
      loadMoreJobs();
    }
  }, [loading, loadingMore, pagination.hasMore, loadMoreJobs]);

  // Smart pagination monitoring with improved UX
  useEffect(() => {
    if (loading || loadingMore) return;
    const backendHasMore = pagination.hasMore;
    const lowThreshold = 5;

    if (!backendHasMore) {
      return;
    }

    // Trigger proactive load only once per page and only if not already loading
    if (jobs.length > 0 && jobs.length <= lowThreshold && lastAutoLoadPageRef.current < (pagination.page + 1)) {
      loadMoreJobs();
    }

    // Emergency loading - when user has no jobs visible but backend has more
    if (jobs.length === 0 && backendHasMore && !loading) {
      setSmartPaginating(true);
      setTimeout(() => {
        loadMoreJobs();
        setTimeout(() => setSmartPaginating(false), 1000);
      }, 100);
    }
  }, [jobs.length, loading, loadingMore, pagination.hasMore, loadMoreJobs]);

  // ===== Handlers =====
  const openFilters = useCallback((section = null) => { 
    setFilterDraft({ ...filters }); 
    setInitialFilterSection(section);
    setShowFilters(true); 
  }, [filters]);
  const closeFilters = useCallback(() => setShowFilters(false), []);
  const resetDraft = useCallback(() => setFilterDraft({ ...EMPTY_FILTERS }), []);
  const applyDraft = useCallback(() => {
    setJobs([]); // Clear old jobs immediately
    setLoading(true); // Show loader
    setFilters({ ...filterDraft });
    setShowFilters(false);
    setPagination(p => ({ ...p, page: 1 }));
    triggerReload();
  }, [filterDraft, triggerReload]);

  const onChangeDraft = useCallback((patch) => { setFilterDraft(prev => ({ ...prev, ...patch })); }, []);
  const onToggleJobType = useCallback((id) => {
    setFilterDraft(prev => ({
      ...prev,
      jobTypeIds: isSelected(prev.jobTypeIds, id)
        ? prev.jobTypeIds.filter(x => String(x) !== String(id))
        : [...(prev.jobTypeIds || []), id]
    }));
  }, []);
  const onToggleWorkplaceType = useCallback((id) => {
    setFilterDraft(prev => ({
      ...prev,
      workplaceTypeIds: isSelected(prev.workplaceTypeIds, id)
        ? prev.workplaceTypeIds.filter(x => String(x) !== String(id))
        : [...(prev.workplaceTypeIds || []), id]
    }));
  }, []);
  const onSelectCurrency = useCallback((id) => { setFilterDraft(prev => ({ ...prev, currencyId: id })); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); triggerReload(); }, [triggerReload]);
  const handleSearchSubmit = useCallback(() => { setPagination(p => ({ ...p, page: 1 })); triggerReload(); }, [triggerReload]);
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setFilters({ ...EMPTY_FILTERS });
    setFilterDraft({ ...EMPTY_FILTERS });
    setPagination(p => ({ ...p, page: 1 }));
    triggerReload();
  }, [triggerReload]);
  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setFilters(EMPTY_FILTERS);
    setFilterDraft(EMPTY_FILTERS);
    setQuickJobType('');
    setQuickWorkplaceType('');
    setQuickPostedWithin('');
    setExpandedQuick(null);
    triggerReload();
  }, [triggerReload]);

  // Quick filter handlers
  const handleQuickJobTypeChange = useCallback((jobTypeId) => {
    setQuickJobType(jobTypeId);
    if (jobTypeId) {
      setFilters(prev => ({ ...prev, jobTypeIds: [jobTypeId] }));
    } else {
      setFilters(prev => ({ ...prev, jobTypeIds: [] }));
    }
    triggerReload();
  }, [triggerReload]);

  const handleQuickWorkplaceTypeChange = useCallback((workplaceTypeId) => {
    setQuickWorkplaceType(workplaceTypeId);
    if (workplaceTypeId) {
      setFilters(prev => ({ ...prev, workplaceTypeIds: [workplaceTypeId] }));
    } else {
      setFilters(prev => ({ ...prev, workplaceTypeIds: [] }));
    }
    triggerReload();
  }, [triggerReload]);

  const handleQuickPostedWithinChange = useCallback((days) => {
    setQuickPostedWithin(days);
    if (days) {
      setFilters(prev => ({ ...prev, postedWithinDays: parseInt(days) }));
    } else {
      setFilters(prev => ({ ...prev, postedWithinDays: null }));
    }
    triggerReload();
  }, [triggerReload]);

  // Add this helper (was missing, caused ReferenceError in browser)
  const removeSavedJobLocally = useCallback((jobId) => {
    if (!jobId) return;
    setSavedIds(prev => { const next = new Set(prev ?? new Set()); next.delete(jobId); return next; });
    setSavedCount(c => Math.max((c || 0) - 1, 0));
  }, []);

  // Build summary string
  const summaryText = useMemo(() => {
    const parts = [];

    // Smart boosts (if enabled)
    if (smartBoosts.candidateYears) parts.push(`${smartBoosts.candidateYears}+ yrs`);
    const jt = (smartBoosts.boostJobTypeIds || '').split(',').filter(Boolean).map(id => (jobTypes.find(j => String(j.JobTypeID) === String(id)) || {}).Type).filter(Boolean);
    const wt = (smartBoosts.boostWorkplaceTypeIds || '').split(',').filter(Boolean).map(id => (workplaceTypes.find(w => String(w.WorkplaceTypeID) === String(id)) || {}).Type).filter(Boolean);
    if (jt.length) parts.push(jt.slice(0, 3).join('/'));
    if (wt.length) parts.push(wt.join('/'));
    if (smartBoosts.boostLocation) parts.push(smartBoosts.boostLocation);

    // ✅ ADD ALL MANUAL FILTERS
    if (parts.length === 0) {
      // Job Type filter
 const jobTypeNames = (filters.jobTypeIds || []).map(id => (jobTypes.find(j => String(j.JobTypeID) === String(id)) || {}).Type).filter(Boolean);
      if (jobTypeNames.length) parts.push(jobTypeNames.slice(0, 2).join('/'));

      // Workplace Type filter
      const workplaceNames = (filters.workplaceTypeIds || []).map(id => (workplaceTypes.find(w => String(w.WorkplaceTypeID) === String(id)) || {}).Type).filter(Boolean);
      if (workplaceNames.length) parts.push(workplaceNames.join('/'));

      // Location filter
      if (filters.location) parts.push(filters.location);

  // ✅ NEW: Department filter
      if (filters.department) parts.push(`Dept: ${filters.department}`);

      // ✅ NEW: Experience filter
 if (filters.experienceMin || filters.experienceMax) {
        if (filters.experienceMin && filters.experienceMax) {
          parts.push(`${filters.experienceMin}-${filters.experienceMax} yrs exp`);
      } else if (filters.experienceMin) {
        parts.push(`${filters.experienceMin}+ yrs exp`);
  } else if (filters.experienceMax) {
     parts.push(`Up to ${filters.experienceMax} yrs exp`);
        }
      }

      // ✅ NEW: Salary filter
      if (filters.salaryMin || filters.salaryMax) {
        const currencySymbol = currencies.find(c => c.CurrencyID === filters.currencyId)?.Symbol || '₹';
        if (filters.salaryMin && filters.salaryMax) {
          parts.push(`${currencySymbol}${filters.salaryMin}-${filters.salaryMax}`);
     } else if (filters.salaryMin) {
          parts.push(`${currencySymbol}${filters.salaryMin}+`);
      } else if (filters.salaryMax) {
          parts.push(`Up to ${currencySymbol}${filters.salaryMax}`);
        }
      }

      // ✅ NEW: Freshness filter (THIS WAS MISSING!)
      if (filters.postedWithinDays) {
     const daysMap = {
          1: 'Last 24h',
          3: 'Last 3 days',
          7: 'Last week',
          14: 'Last 2 weeks',
          30: 'Last month'
        };
        parts.push(daysMap[filters.postedWithinDays] || `Last ${filters.postedWithinDays} days`);
    }
}

    return parts.join(' • ');
  }, [smartBoosts, filters, jobTypes, workplaceTypes, currencies]);

  // Render list without animations
  const renderList = () => {
    const data = jobs; // Always show openings

    // 🔧 NEW: Show loader while initially loading OR when searching/filtering (loading=true and no jobs yet)
    if (loading && data.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
       <Text style={[styles.loadingText, { marginTop: 12 }]}>Loading jobs...</Text>
        </View>
   );
    }

    if (smartPaginating && data.length === 0) {
      return (
      <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={[styles.loadingText, { marginTop: 12 }]}>Finding more opportunities...</Text>
        </View>
      );
    }

    if (data.length === 0) {
      const hasMoreToLoad = pagination.hasMore;

      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No jobs found</Text>
          <Text style={styles.emptyMessage}>
            {hasMoreToLoad
              ? 'Checking for more opportunities...'
              : `You've seen all available jobs! Great job exploring every opportunity. New jobs will appear here as they're posted.`
            }
          </Text>

          {hasMoreToLoad && (
            <TouchableOpacity
              style={[styles.clearAllButton, { marginTop: 16, backgroundColor: '#0066cc' }]}
              onPress={() => {
                setSmartPaginating(true);
                loadMoreJobs();
                setTimeout(() => setSmartPaginating(false), 2000);
              }}
            >
              <Text style={[styles.clearAllText, { color: 'white' }]}>Load More Jobs</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Simple job cards without animations - with Ad integration
    const elements = [];
    
    data.forEach((job, index) => {
      const id = job.JobID || index;
      const jobKey = job.JobID || job.id;
      const isReferred = referredJobIds.has(jobKey);
      const isSaved = savedIds.has(jobKey);
      const isReferralRequesting = referralRequestingIds.has(jobKey); // NEW

      // Add job card - responsive width for grid layout
      elements.push(
        <View key={id} style={styles.jobCardWrapper}>
          <JobCard
            job={job}
            jobTypes={jobTypes}
            workplaceTypes={workplaceTypes}
            onPress={() => navigation.navigate('JobDetails', { jobId: job.JobID })}
            onApply={() => handleApply(job)}
            onAskReferral={isReferred || isReferralRequesting ? null : () => handleAskReferral(job)}
            onSave={() => handleSave(job)}
            onUnsave={() => handleUnsave(job)}
            savedContext={false}
            isReferred={isReferred}
            isSaved={isSaved}
            isReferralRequesting={isReferralRequesting}
            currentUserId={user?.UserID}
          />
        </View>
      );
      
      // Insert ad card after every N jobs (based on AD_CONFIG.frequency) - only on mobile
      if (AD_CONFIG.enabled && isMobile && (index + 1) % AD_CONFIG.frequency === 0 && index < data.length - 1) {
        elements.push(
          <View key={`ad-${index}`} style={styles.jobCardWrapper}>
            <AdCard variant="jobs" />
          </View>
        );
      }
    });
    
    // On desktop/tablet, wrap in a grid container
    if (!isMobile) {
      return (
        <View style={styles.jobsGrid}>
          {elements}
          {/* Show ad at the end on desktop */}
          {AD_CONFIG.enabled && data.length > 0 && (
            <View style={styles.jobCardWrapper}>
              <AdCard variant="jobs" />
            </View>
          )}
        </View>
      );
    }
    
    return elements;
  };

  const openingsCount = jobs.length;

  // Handle apply - simplified without animations
  const handleApply = useCallback(async (job) => {
    if (!job) return;
    if (!user) {
      Alert.alert('Login Required', 'Please login to apply for jobs', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Auth') }
      ]);
      return;
    }
    if (!isJobSeeker) {
      showToast('Only job seekers can apply for positions', 'error');
      return;
    }
    if (!primaryResumeLoadedRef.current) await loadPrimaryResume();
    if (primaryResume?.ResumeID) { await quickApply(job, primaryResume.ResumeID); return; }
    setReferralMode(false); // application flow
    setPendingJobForApplication(job);
    setShowResumeModal(true);
  }, [user, isJobSeeker, navigation, primaryResume]);

  // NEW: Ask Referral handler
  const handleAskReferral = useCallback(async (job) => {
    if (!job) {
      return;
    }
    if (!user) {
      // Web-compatible alert
      if (Platform.OS === 'web') {
        if (window.confirm('Please login to ask for referrals.\n\nWould you like to login now?')) {
          navigation.navigate('Auth');
        }
        return;
      }
      Alert.alert('Login Required', 'Please login to ask for referrals', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Auth') }
      ]);
      return;
    }
    if (!isJobSeeker) {
      showToast('Only job seekers can ask for referrals', 'error');
      return;
    }

    const jobId = job.JobID || job.id;

    // Check if already referred
    if (referredJobIds.has(jobId)) {
      if (Platform.OS === 'web') {
        if (window.confirm('You have already requested a referral for this job.\n\nWould you like to view your referrals?')) {
          navigation.navigate('Referrals');
        }
        return;
      }
      Alert.alert('Already Requested', 'You have already requested a referral for this job', [
        { text: 'View Referrals', onPress: () => navigation.navigate('Referrals') },
        { text: 'OK' }
      ]);
      return;
    }

    // ✅ NEW: Check wallet balance and show confirmation modal
    // NOW USES availableBalance (balance minus holds)
    try {
      const walletBalance = await refopenAPI.getWalletBalance();

      if (walletBalance?.success) {
        // Use availableBalance for hold-based payment system
        const availableBalance = walletBalance.data?.availableBalance ?? walletBalance.data?.balance ?? 0;
        const holdAmount = walletBalance.data?.holdAmount ?? 0;

        // 💎 NEW: Show confirmation modal (whether sufficient balance or not)
        setReferralConfirmData({
          currentBalance: availableBalance, // Use available, not total
          requiredAmount: pricing.referralRequestCost,
          holdAmount: holdAmount, // Pass hold info for display
          jobId: job.JobID || job.id, // Store JobID to correctly identify the job later
          jobTitle: job.Title || 'this job',
          companyName: job.OrganizationName || '',
          job: job // Store the full job object for reliable reference
        });
        setShowReferralConfirmModal(true);
        return;

      } else {
        console.error('❌ Failed to check wallet balance:', walletBalance.error);
        showToast('Unable to check wallet balance. Please try again.', 'error');
        return;
      }
    } catch (e) {
      console.error('❌ Exception in wallet balance check:', e);
      showToast('Unable to check wallet balance. Please try again.', 'error');
      return;
    }
  }, [user, isJobSeeker, navigation, referredJobIds, primaryResume, loadPrimaryResume]);

  // ? UPDATED: Resume selected handler supports both apply & referral flows
  const handleResumeSelected = useCallback(async (resumeData) => {
    if (!pendingJobForApplication) return;
    const job = pendingJobForApplication;
    const id = job.JobID || job.id;
    const startTime = Date.now(); // Track start time for broadcast duration
    try {
      setShowResumeModal(false);
      if (referralMode) {
        // Create referral request - ✅ NEW SCHEMA: Send jobID (internal) with extJobID as null
        const res = await refopenAPI.createReferralRequest({
          jobID: id,  // Internal job ID (UNIQUEIDENTIFIER)
          extJobID: null, // Explicitly null for internal referrals
          resumeID: resumeData.ResumeID
        });
        if (res?.success) {
          // Calculate broadcast time
          const broadcastTime = (Date.now() - startTime) / 1000;
          
          // 🎉 Store pending job ID - will mark as referred when overlay closes
          setPendingReferralJobId(id);
          
          // 🎉 Show fullscreen success overlay
          setReferralCompanyName(job.OrganizationName || '');
          setReferralBroadcastTime(broadcastTime);
          setShowReferralSuccessOverlay(true);
          
          showToast('Referral request sent successfully', 'success');
          invalidateCache(CACHE_KEYS.REFERRER_REQUESTS, CACHE_KEYS.WALLET_BALANCE, CACHE_KEYS.DASHBOARD_STATS);

          // 🔧 FIXED: Set the resume directly and reload
          setPrimaryResume(resumeData);
          primaryResumeLoadedRef.current = false;
          await loadPrimaryResume();
        } else {
          showToast('Failed to send referral request. Please try again.', 'error');
        }
      } else {
        const applicationData = {
          jobID: id,
          coverLetter: `I am very interested in the ${job.Title} position and believe my skills and experience make me a great candidate for this role.`,
          resumeId: resumeData.ResumeID
        };
        const res = await refopenAPI.applyForJob(applicationData);
        if (res?.success) {
          setAppliedIds(prev => { const n = new Set(prev); n.add(id); return n; });
          setAppliedCount(c => (Number(c) || 0) + 1);
          // Always remove from saved locally (backend auto-removes later)
            removeSavedJobLocally(id);
          setJobs(prev => prev.filter(j => (j.JobID || j.id) !== id));
          showToast('Application submitted successfully', 'success');
          invalidateCache(CACHE_KEYS.RECENT_APPLICATIONS, CACHE_KEYS.DASHBOARD_STATS, CACHE_KEYS.JOBS_SAVED_IDS);

          // 🔧 FIXED: Reload primary resume after successful application
          primaryResumeLoadedRef.current = false; // Reset the loaded flag
          await loadPrimaryResume(); // Reload primary resume

          // Only refresh applied count (lightweight)
          try {
            const appliedRes = await refopenAPI.getMyApplications(1, 1);
            if (appliedRes?.success) setAppliedCount(Number(appliedRes.meta?.total || 0));
          } catch {}
        } else {
          showToast('Failed to submit application. Please try again.', 'error');
        }
      }
    } catch (e) {
      console.error(referralMode ? 'Referral error' : 'Apply error', e);
      showToast('Operation failed. Please try again.', 'error');
    } finally {
      setPendingJobForApplication(null);
      setReferralMode(false);
    }
  }, [pendingJobForApplication, referralMode, removeSavedJobLocally, loadPrimaryResume]);

  // NEW: Auto apply with known resume (no modal)
  const quickApply = useCallback(async (job, resumeId) => {
    const id = job.JobID || job.id;
    try {
      const applicationData = { jobID: id, coverLetter: `I am very interested in the ${job.Title} position and believe my skills and experience make me a great candidate for this role.`, resumeId };
      const res = await refopenAPI.applyForJob(applicationData);
      if (res?.success) {
        setAppliedIds(prev => { const n = new Set(prev); n.add(id); return n; });
        setAppliedCount(c => (Number(c) || 0) + 1);
        removeSavedJobLocally(id); // ensure removal if it was saved
        setJobs(prev => prev.filter(j => (j.JobID || j.id) !== id));
        showToast('Application submitted', 'success');
        invalidateCache(CACHE_KEYS.RECENT_APPLICATIONS, CACHE_KEYS.DASHBOARD_STATS, CACHE_KEYS.JOBS_SAVED_IDS);
        try {
          const appliedRes = await refopenAPI.getMyApplications(1, 1);
          if (appliedRes?.success) setAppliedCount(Number(appliedRes.meta?.total || 0));
        } catch {}
      } else {
        showToast('Failed to submit application. Please try again.', 'error');
      }
    } catch (e) {
      showToast('Failed to submit application. Please try again.', 'error');
    }
  }, [removeSavedJobLocally]);
  const quickReferral = useCallback(async (job, resumeId) => {
    const id = job.JobID || job.id;
    const startTime = Date.now(); // Track start time for broadcast duration
    try {
      setReferralRequestingIds(prev => new Set([...prev, id])); // mark requesting
      const res = await refopenAPI.createReferralRequest({
        jobID: id,
        extJobID: null,
        resumeID: resumeId
      });
      if (res?.success) {
        // Calculate broadcast time
        const broadcastTime = (Date.now() - startTime) / 1000;
        
        // 🎉 Store pending job ID - will mark as referred when overlay closes
        setPendingReferralJobId(id);

        // 🎉 Show fullscreen success overlay
        setReferralCompanyName(job.OrganizationName || referralConfirmData.companyName || '');
        setReferralBroadcastTime(broadcastTime);
        setShowReferralSuccessOverlay(true);

        // ✅ Show wallet deduction info
        const amountDeducted = res.data?.amountDeducted || 39;
        const balanceAfter = res.data?.walletBalanceAfter;

        let message = 'Referral request sent to verified employees who can refer!';
        if (balanceAfter !== undefined) {
          message = `Referral sent to verified employees! ₹${amountDeducted} deducted. Balance: ₹${balanceAfter.toFixed(2)}`;
        }

        showToast(message, 'success');
        invalidateCache(CACHE_KEYS.REFERRER_REQUESTS, CACHE_KEYS.WALLET_BALANCE, CACHE_KEYS.DASHBOARD_STATS);

        // 🔧 FIXED: Reload primary resume after successful referral
        await loadPrimaryResume();
      } else {
        // ✅ NEW: Handle insufficient balance error
        if (res.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
          const currentBalance = res.data?.currentBalance || 0;
          const requiredAmount = res.data?.requiredAmount || pricing.referralRequestCost;

          // 💎 NEW: Show beautiful modal instead of ugly alert
          setWalletModalData({ currentBalance, requiredAmount });
          setShowWalletModal(true);
        } else {
          showToast('Failed to send referral request. Please try again.', 'error');
        }
      }
    } catch (e) {
      console.error('Quick referral error:', e);
      showToast('Failed to send referral request. Please try again.', 'error');
    } finally {
      setReferralRequestingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }, [navigation, loadPrimaryResume]);

  const handleSave = useCallback(async (job) => {
    if (!job) return;
    const id = job.JobID || job.id;

    try {
      const res = await refopenAPI.saveJob(id);
      if (res?.success) {
        setSavedCount(c => (Number(c) || 0) + 1);
        setSavedIds(prev => {
          const next = new Set(prev ?? new Set());
          next.add(id);
          return next;
        });

        showToast('Job saved successfully', 'success');
        invalidateCache(CACHE_KEYS.JOBS_SAVED_IDS);
      } else {
        showToast('Failed to save job. Please try again.', 'error');
      }
    } catch (e) {
      console.error('Save error', e);
      showToast('Failed to save job. Please try again.', 'error');
    } finally {
      refreshCounts();
    }
  }, [refreshCounts, showToast]);

  // 🔧 NEW: Handle unsave functionality
  const handleUnsave = useCallback(async (job) => {
    if (!job) return;
    const id = job.JobID || job.id;
    try {
      const res = await refopenAPI.unsaveJob(id);
      if (res?.success) {
        removeSavedJobLocally(id);
        showToast('Job removed from saved', 'success');
        invalidateCache(CACHE_KEYS.JOBS_SAVED_IDS);
      } else {
        showToast('Failed to remove job from saved. Please try again.', 'error');
      }
    } catch (e) {
      console.error('Unsave error', e);
      showToast('Failed to remove job from saved. Please try again.', 'error');
    }
  }, [removeSavedJobLocally, showToast]);

  // Smart pagination monitoring with improved UX
  useEffect(() => {
    if (loading || loadingMore) return;

    const backendHasMore = pagination.hasMore;
    const lowThreshold = 5; // Trigger when only 5 jobs left

    // Don't trigger if backend says no more
    if (!backendHasMore) {
      return;
    }

    // Trigger proactive load only once per page and only if not already loading
    if (jobs.length > 0 && jobs.length <= lowThreshold && lastAutoLoadPageRef.current < (pagination.page + 1)) {
      loadMoreJobs();
    }

    // Emergency loading - when user has no jobs visible but backend has more
    if (jobs.length === 0 && backendHasMore && !loading) {
      setSmartPaginating(true);
      setTimeout(() => {
        loadMoreJobs();
        setTimeout(() => setSmartPaginating(false), 1000);
      }, 100);
    }
  }, [jobs.length, loading, loadingMore, pagination.hasMore, loadMoreJobs]);

  // ===== Render =====
  return (
    <View style={styles.container}>
      {/* Fortune 500 Mode: SubScreenHeader */}
      {filterF500 ? (
        <SubScreenHeader title="Jobs by Top MNCs" fallbackTab="Home" />
      ) : (
        <TabHeader
          navigation={navigation}
          onProfileSliderOpen={() => {
            // Abort Jobs' heavy API calls so ProfileSlider gets network priority
            if (tabAbortRef.current) { tabAbortRef.current.abort(); tabAbortRef.current = null; }
            if (listAbortRef.current) { try { listAbortRef.current.abort(); } catch {} }
            if (loadMoreAbortRef.current) { try { loadMoreAbortRef.current.abort(); } catch {} }
          }}
          centerContent={
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#666" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search jobs..."
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  if (text.trim().length > 0) {
                    setJobs([]);
                    setLoading(true);
                  }
                }}
                onSubmitEditing={handleSearchSubmit}
                placeholderTextColor="#999"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>
          }
          rightContent={
            <TouchableOpacity style={styles.filterButton} onPress={openFilters}>
              <Ionicons name="options-outline" size={24} color="#0066cc" />
            </TouchableOpacity>
          }
          showMessages={false}
        />
      )}

      {/* Quick Filters Row — only in normal mode */}
      {!filterF500 && (
          <View style={styles.quickFiltersContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
                <View style={styles.quickFilterItem}>
                  <TouchableOpacity
                    style={styles.quickFilterDropdown}
                    onPress={handleSearchWithAI}
                  >
                    <Text style={styles.quickFilterText}>
                      AI Jobs
                    </Text>
                    <Ionicons
                      name={'bulb-outline'}
                      size={14}
                      color={'#666'}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.quickFilterItem}>
                  <TouchableOpacity
                    style={[styles.quickFilterDropdown, (filters.jobTypeIds || []).length > 0 && styles.quickFilterActive]}
                    onPress={() => openFilters('jobType')}
                  >
                    <Text style={[styles.quickFilterText, (filters.jobTypeIds || []).length > 0 && styles.quickFilterActiveText]}>
                      {quickJobTypeLabel}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={(filters.jobTypeIds || []).length > 0 ? '#0066cc' : '#666'} />
                  </TouchableOpacity>
                </View>

                <View style={styles.quickFilterItem}>
                  <TouchableOpacity
                    style={[styles.quickFilterDropdown, (filters.workplaceTypeIds || []).length > 0 && styles.quickFilterActive]}
                    onPress={() => openFilters('workMode')}
                  >
                    <Text style={[styles.quickFilterText, (filters.workplaceTypeIds || []).length > 0 && styles.quickFilterActiveText]}>
                      {quickWorkplaceLabel}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={(filters.workplaceTypeIds || []).length > 0 ? '#0066cc' : '#666'} />
                  </TouchableOpacity>
                </View>

                <View style={styles.quickFilterItem}>
                  <TouchableOpacity
                    style={[styles.quickFilterDropdown, (filters.postedWithinDays || quickPostedWithin) ? styles.quickFilterActive : null]}
                    onPress={() => openFilters('postedBy')}
                  >
                    <Text style={[styles.quickFilterText, (filters.postedWithinDays || quickPostedWithin) ? styles.quickFilterActiveText : null]}>
                      {quickPostedWithin ? (quickPostedWithin === 1 ? 'Last 24h' : quickPostedWithin === 7 ? 'Last 7 days' : 'Last 30 days') : 'Freshness'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={(filters.postedWithinDays || quickPostedWithin) ? '#0066cc' : '#666'} />
                  </TouchableOpacity>
                </View>

                <View style={styles.quickFilterItem}>
                  <TouchableOpacity
                    style={[styles.quickFilterDropdown, (filters.organizationIds || []).length > 0 && styles.quickFilterActive]}
                    onPress={() => openFilters('company')}
                  >
                    <Text style={[styles.quickFilterText, (filters.organizationIds || []).length > 0 && styles.quickFilterActiveText]}>
                      {quickCompanyLabel}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={(filters.organizationIds || []).length > 0 ? '#0066cc' : '#666'} />
                  </TouchableOpacity>
                </View>

                <View style={styles.quickFilterItem}>
                  <TouchableOpacity
                    style={[styles.quickFilterDropdown, filters.postedByType === 2 && styles.quickFilterActive]}
                    onPress={() => {
                      const newValue = filters.postedByType === 2 ? null : 2;
                      setFilters(prev => ({ ...prev, postedByType: newValue }));
                      setPagination(p => ({ ...p, page: 1 }));
                      triggerReload();
                    }}
                  >
                    <Ionicons name="people" size={14} color={filters.postedByType === 2 ? '#0066cc' : '#666'} style={{ marginRight: 4 }} />
                    <Text style={[styles.quickFilterText, filters.postedByType === 2 && styles.quickFilterActiveText]}>
                      Referrer Jobs
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              {isFiltersDirty(filters) && (
                <TouchableOpacity style={styles.clearAllButton} onPress={clearAllFilters}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
      )}

      {/* Job List Container with FAB */}
      <View style={{ flex: 1 }}>
        {/* Floating Action Buttons - Top Right of Job List */}
        <View style={styles.fabContainerTop}>
          <TouchableOpacity
            style={[styles.fab, styles.fabSaved]}
            onPress={() => navigation.navigate('SavedJobs')}
            activeOpacity={0.8}
          >
            <Ionicons name="bookmark" size={20} color="#FFFFFF" />
            {savedCount > 0 && (
              <View style={styles.fabBadge}>
                <Text style={styles.fabBadgeText}>{savedCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.fab, styles.fabApplications]}
            onPress={() => navigation.navigate('Applications')}
            activeOpacity={0.8}
          >
            <Ionicons name="briefcase" size={20} color="#FFFFFF" />
            {appliedCount > 0 && (
              <View style={styles.fabBadge}>
                <Text style={styles.fabBadgeText}>{appliedCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.fab, styles.fabReferralRequests]}
            onPress={() => navigation.navigate('MyReferralRequests')}
            activeOpacity={0.8}
          >
            <Ionicons name="people" size={20} color="#FFFFFF" />
            {myReferralRequestsCount > 0 && (
              <View style={styles.fabBadge}>
                <Text style={styles.fabBadgeText}>{myReferralRequestsCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Job List */}
        <ScrollView
          style={styles.jobList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.jobListContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onScroll={onScrollNearEnd}
          scrollEventThrottle={16}
        >
          <ResponsiveContainer style={styles.jobListResponsive}>
            {renderList()}
          
          {/* Loading More Indicator */}
          {loadingMore && (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: 14 }}>Loading more jobs...</Text>
            </View>
          )}
          </ResponsiveContainer>
        </ScrollView>
      </View>

      {/* Filter Modal */}
      <FilterModal
        visible={showFilters}
        onClose={closeFilters}
        filters={filterDraft}
        onFiltersChange={onChangeDraft}
        onApply={applyDraft}
        onClear={resetDraft}
        jobTypes={jobTypes}
        workplaceTypes={workplaceTypes}
        currencies={currencies}
        companies={companies}
        loadingCompanies={loadingCompanies}
        onToggleJobType={onToggleJobType}
        onToggleWorkplaceType={onToggleWorkplaceType}
        onSelectCurrency={onSelectCurrency}
        initialSection={initialFilterSection}
      />

      {/* ? NEW: Resume Upload Modal */}
      <ResumeUploadModal
        visible={showResumeModal}
        onClose={() => {
          setShowResumeModal(false);
          setPendingJobForApplication(null);
          setReferralMode(false);
        }}
        onResumeSelected={handleResumeSelected}
        user={user}
        jobTitle={pendingJobForApplication?.Title}
      />

      {/* 💎 NEW: Beautiful Wallet Recharge Modal */}
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

      {/* AI Jobs Confirmation Modal - Uses ConfirmPurchaseModal */}
      <ConfirmPurchaseModal
        visible={showAIConfirmModal}
        currentBalance={Number(walletBalance || 0)}
        requiredAmount={pricing.aiJobsCost}
        contextType="ai-jobs"
        itemName={`Get 50 personalized job matches`}
        accessDays={pricing.aiAccessDurationDays}
        onProceed={handleAIJobsConfirm}
        onAddMoney={handleAIJobsCancel}
        onCancel={() => setShowAIConfirmModal(false)}
      />

      {/* Referral Confirmation Modal */}
      <ConfirmPurchaseModal
        visible={showReferralConfirmModal}
        currentBalance={referralConfirmData.currentBalance}
        requiredAmount={referralConfirmData.requiredAmount}
        contextType="referral"
        itemName={referralConfirmData.jobTitle}
        onProceed={async () => {
          setShowReferralConfirmModal(false);
          
          // Use the stored job object directly instead of searching by title
          // This fixes the bug where duplicate jobs with same title would be confused
          const job = referralConfirmData.job;
          if (!job) {
            showToast('Job not found. Please try again.', 'error');
            return;
          }

          const jobId = referralConfirmData.jobId || job.JobID || job.id;

          // Double-check no existing request (in case of race conditions)
          try {
            const existing = await refopenAPI.getMyReferralRequests(1, 100);
            if (existing.success && existing.data?.requests) {
              const already = existing.data.requests.some(r => r.JobID === jobId && r.Status !== 'Cancelled' && r.Status !== 'Expired');
              if (already) {
                showToast('You have already requested a referral for this job', 'info');
                return;
              }
            }
          } catch (e) {
            console.warn('Referral pre-check failed:', e.message);
          }

          // If user already has a primary resume, proceed directly
          if (primaryResume?.ResumeID) {
            setReferralRequestingIds(prev => new Set([...prev, jobId]));
            await quickReferral(job, primaryResume.ResumeID);
            setReferralRequestingIds(prev => { const n = new Set(prev); n.delete(jobId); return n; });
            return;
          }
          
          // Otherwise, show resume modal
          setReferralMode(true);
          setPendingJobForApplication(job);
          setShowResumeModal(true);
        }}
        onAddMoney={() => {
          setShowReferralConfirmModal(false);
          navigation.navigate('WalletRecharge');
        }}
        onCancel={() => setShowReferralConfirmModal(false)}
      />

      {/* 🎉 Referral Success Overlay */}
      <ReferralSuccessOverlay
        visible={showReferralSuccessOverlay}
        onComplete={() => {
          setShowReferralSuccessOverlay(false);
          // ✅ Now mark the job as referred after overlay closes
          if (pendingReferralJobId) {
            setReferredJobIds(prev => new Set([...prev, pendingReferralJobId]));
            setPendingReferralJobId(null);
          }
        }}
        duration={3500}
        companyName={referralCompanyName}
        broadcastTime={referralBroadcastTime}
      />

      {/* LinkedIn-style Profile Slider handled by TabHeader */}
    </View>
  );
}