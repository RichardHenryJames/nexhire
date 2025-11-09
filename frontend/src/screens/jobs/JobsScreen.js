import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import refopenAPI from '../../services/api';
import JobCard from '../../components/jobs/JobCard';
import FilterModal from '../../components/jobs/FilterModal';
import ResumeUploadModal from '../../components/ResumeUploadModal';
import WalletRechargeModal from '../../components/WalletRechargeModal';
import { styles } from './JobsScreen.styles';
import { showToast } from '../../components/Toast';

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
  salaryMin: '',
  salaryMax: '',
  currencyId: null,
  experienceMin: '',
  experienceMax: '',
  postedWithinDays: null,
  department: ''
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

export default function JobsScreen({ navigation, route }) {
  const { user, isJobSeeker } = useAuth();
  
  // 🔧 REQUIREMENT 1: Handle navigation params from JobDetailsScreen
  const { activeTab: initialTab, successMessage, appliedJobId } = route.params || {};

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 350);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 100, total: 0, totalPages: 0, hasMore: true });

  // Applied filters
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });

  // Manual reload trigger
  const [reloadKey, setReloadKey] = useState(0);
  const triggerReload = useCallback(() => setReloadKey(k => k + 1), []);

  // Draft for modal
  const [filterDraft, setFilterDraft] = useState({ ...EMPTY_FILTERS });
  const [showFilters, setShowFilters] = useState(false);

  // ✅ NEW: Resume modal state
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [pendingJobForApplication, setPendingJobForApplication] = useState(null);
  const [referralMode, setReferralMode] = useState(false); // NEW: distinguish apply vs referral

  // ✅ NEW: Referral tracking state
  const [referredJobIds, setReferredJobIds] = useState(new Set());
  const [referralRequestingIds, setReferralRequestingIds] = useState(new Set()); // NEW
  const [referralEligibility, setReferralEligibility] = useState({
    isEligible: true,
    dailyQuotaRemaining: 5,
    hasActiveSubscription: false,
    reason: null
  });
  // Cache primary resume (or fallback first resume) so we can auto-apply without showing modal every time
  const [primaryResume, setPrimaryResume] = useState(null);
  const primaryResumeLoadedRef = useRef(false);

  // 💎 NEW: Beautiful wallet modal state
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalData, setWalletModalData] = useState({ currentBalance: 0, requiredAmount: 50 });
  
  // Load primary resume once (or first resume as fallback)
  const loadPrimaryResume = useCallback(async () => {
    if (!user || !isJobSeeker) return;
    if (primaryResumeLoadedRef.current && primaryResume) return;
    try {
      const profile = await refopenAPI.getApplicantProfile(user.userId || user.id || user.sub || user.UserID);
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

  const [jobTypes, setJobTypes] = useState([]);
  const [workplaceTypes, setWorkplaceTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);

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
    if (!ids.length) return 'Any';
    const names = ids.map(id => (jobTypes.find(j => String(j.JobTypeID) === String(id)) || {}).Type).filter(Boolean);
    return names.length ? names.slice(0, 2).join('/') + (names.length > 2 ? ` +${names.length - 2}` : '') : 'Any';
  }, [filters.jobTypeIds, jobTypes]);

  const quickWorkplaceLabel = useMemo(() => {
    const ids = filters.workplaceTypeIds || [];
    if (!ids.length) return 'Any';
    const names = ids.map(id => (workplaceTypes.find(w => String(w.WorkplaceTypeID) === String(id)) || {}).Type).filter(Boolean);
    return names.length ? names.slice(0, 2).join('/') + (names.length > 2 ? ` +${names.length - 2}` : '') : 'Any';
  }, [filters.workplaceTypeIds, workplaceTypes]);

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

  // Tabs state and counts
  const [activeTab, setActiveTab] = useState(initialTab || 'openings'); // 🔧 Use initial tab from navigation
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [appliedCount, setAppliedCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [savedIds, setSavedIds] = useState(new Set());
  const [smartPaginating, setSmartPaginating] = useState(false);

  // 🔧 REQUIREMENT 1: Show success message and handle applied job removal
  useEffect(() => {
    if (successMessage) {
      setTimeout(() => {
        showToast(successMessage, 'success');
      }, 500); // Small delay to ensure screen is loaded
    }
    
    // 🔧 NEW: Remove applied job from jobs list and refresh data
    if (appliedJobId) {
      console.log('🔄 Removing applied job from UI and refreshing data:', appliedJobId);
      
      // Remove from current jobs list immediately
      setJobs(prev => {
        const filtered = prev.filter(j => (j.JobID || j.id) !== appliedJobId);
        console.log(`📊 Jobs list updated: ${prev.length} -> ${filtered.length}`);
        return filtered;
      });
      
      // Update pagination totals to reflect removal
      setPagination(prev => {
        const newTotal = Math.max((prev.total || 0) - 1, 0);
        const newTotalPages = Math.max(Math.ceil(newTotal / prev.pageSize), 1);
        console.log(`📊 Pagination updated: total ${prev.total} -> ${newTotal}`);
        return { 
          ...prev, 
          total: newTotal, 
          totalPages: newTotalPages, 
          hasMore: prev.page < newTotalPages && newTotal > prev.page * prev.pageSize 
        };
      });
      
      // Add to applied IDs
      setAppliedIds(prev => new Set([...prev, appliedJobId]));
      
      // Trigger a full refresh to get updated data after a short delay
      setTimeout(() => {
        console.log('🔄 Triggering full data refresh...');
        triggerReload(); // This will refresh the jobs list
        refreshApplicationsData(); // This will refresh applications
      }, 1000);
    }
  }, [successMessage, appliedJobId, triggerReload, refreshApplicationsData]);

  // 🔧 NEW: Function to refresh applications data
  const refreshApplicationsData = useCallback(async () => {
    try {
      console.log('🔄 Refreshing applications data...');
      const r = await refopenAPI.getMyApplications(1, 500);
      if (r?.success) {
        const ids = new Set((r.data || []).map(a => a.JobID));
        setAppliedIds(ids);
        const items = (r.data || []).map(a => ({
          JobID: a.JobID,
          Title: a.JobTitle || a.Title,
          OrganizationName: a.CompanyName || a.OrganizationName,
          Location: a.JobLocation || a.Location,
          SalaryRangeMin: a.SalaryRangeMin,
          SalaryRangeMax: a.SalaryRangeMax,
          PublishedAt: a.SubmittedAt,
        }));
        setAppliedJobs(items);
        setAppliedCount(Number(r.meta?.total || items.length || 0));
        console.log('✅ Applications data refreshed successfully');
      }
    } catch (e) {
      console.error('❌ Failed to refresh applications data:', e);
    }
  }, []);

  // Preload applied IDs and list
  useEffect(() => {
    (async () => {
      try {
        const r = await refopenAPI.getMyApplications(1, 500);
        if (r?.success) {
          const ids = new Set((r.data || []).map(a => a.JobID));
          setAppliedIds(ids);
          const items = (r.data || []).map(a => ({
            JobID: a.JobID,
            Title: a.JobTitle || a.Title,
            OrganizationName: a.CompanyName || a.OrganizationName,
            Location: a.JobLocation || a.Location,
            SalaryRangeMin: a.SalaryRangeMin,
            SalaryRangeMax: a.SalaryRangeMax,
            PublishedAt: a.SubmittedAt,
          }));
          setAppliedJobs(items);
          setAppliedCount(Number(r.meta?.total || items.length || 0));
        }
      } catch {}
    })();
  }, []);

  // 🔧 NEW: Add focus listener to refresh applications when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('📱 JobsScreen focused, refreshing applications data...');
      refreshApplicationsData();
    });

    return unsubscribe;
  }, [navigation, refreshApplicationsData]);

  // ? NEW: Preload referred job IDs
  useEffect(() => {
    (async () => {
      if (!user || !isJobSeeker) return;
      try {
        const [referralRes, eligibilityRes] = await Promise.all([
          refopenAPI.getMyReferralRequests(1, 500),
          refopenAPI.checkReferralEligibility()
        ]);

        if (referralRes?.success && referralRes.data?.requests) {
          const ids = new Set(referralRes.data.requests.map(r => r.JobID));
          setReferredJobIds(ids);
        }

        if (eligibilityRes?.success) {
          setReferralEligibility(eligibilityRes.data);
        }
      } catch (e) {
        console.warn('Failed to load referral data:', e.message);
      }
    })();
  }, [user, isJobSeeker]);

  // Counts from backend
  const refreshCounts = useCallback(async () => {
    try {
      const [appliedRes, savedRes] = await Promise.all([
        refopenAPI.getMyApplications(1, 1),
        refopenAPI.getMySavedJobs(1, 1)
      ]);
      if (appliedRes?.success) setAppliedCount(Number(appliedRes.meta?.total || 0));
      if (savedRes?.success) setSavedCount(Number(savedRes.meta?.total || 0));
    } catch {}
  }, []);

  useEffect(() => { refreshCounts(); }, [refreshCounts]);

  // Apply smart filters based on user profile
  const applySmart = useCallback(async () => {
    try {
      if (!user) return;
      const profRes = await refopenAPI.getApplicantProfile(user.userId || user.id || user.sub || user.UserID);
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

  // Load reference data once
  useEffect(() => {
    (async () => {
      try {
        const [jt, wt, cur] = await Promise.all([
          refopenAPI.getJobTypes(),
          refopenAPI.getWorkplaceTypes(),
          refopenAPI.getCurrencies()
        ]);
        if (jt?.success) setJobTypes(jt.data);
        if (wt?.success) setWorkplaceTypes(wt.data);
        if (cur?.success) setCurrencies(cur.data);
      } catch {}
    })();
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
        setLoading(true);
        const apiFilters = {};
        if (filters.location) apiFilters.location = filters.location;
        if (filters.jobTypeIds?.length) apiFilters.jobTypeIds = filters.jobTypeIds.join(',');
        if (filters.workplaceTypeIds?.length) apiFilters.workplaceTypeIds = filters.workplaceTypeIds.join(',');
        if (filters.salaryMin) apiFilters.salaryMin = filters.salaryMin;
        if (filters.salaryMax) apiFilters.salaryMax = filters.salaryMax;
        if (filters.currencyId) apiFilters.currencyId = filters.currencyId;
        if (filters.experienceMin) apiFilters.experienceMin = filters.experienceMin;
        if (filters.experienceMax) apiFilters.experienceMax = filters.experienceMax;
        if (filters.postedWithinDays) apiFilters.postedWithinDays = filters.postedWithinDays;
        if (filters.department) apiFilters.department = filters.department;

        const shouldUseSearch = debouncedQuery.trim().length > 0 || (personalizationApplied && Object.keys(smartBoosts).length > 0);

        let result;
        if (shouldUseSearch) {
          const params = { page: 1, pageSize: pagination.pageSize, ...apiFilters, ...smartBoosts };
          result = await refopenAPI.searchJobs(debouncedQuery.trim() || '', params, { signal: controller.signal });
        } else {
          result = await refopenAPI.getJobs(1, pagination.pageSize, apiFilters, { signal: controller.signal });
        }
        if (controller.signal.aborted) return;

        if (result.success) {
          const list = Array.isArray(result.data) ? result.data : [];
          setJobs(list);
          const meta = result.meta || {};
          const hasMore = meta.hasMore !== undefined ? Boolean(meta.hasMore) : (meta.page ? (meta.page < (meta.totalPages || 1)) : false);
          setPagination(prev => ({
            ...prev,
            page: meta.page || 1,
            total: meta.total || list.length,
            totalPages: meta.totalPages || Math.ceil((meta.total || list.length) / (meta.pageSize || prev.pageSize)),
            hasMore
          }));
        }
      } catch (e) {
        if (e?.name !== 'AbortError') console.error('Error fetching jobs:', e);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    run();
    return () => { try { controller.abort(); } catch {} };
  }, [debouncedQuery, filters, reloadKey, personalizationApplied, smartBoosts, pagination.pageSize]);

  // ===== LOAD MORE =====
  const loadMoreJobs = useCallback(async () => {
    if (showFiltersRef.current) return;
    if (loading || loadingMore) return;
    if (isLoadingMoreRef.current) return;
    if (!pagination.hasMore) {
      console.log('Load more skipped - no more jobs available');
      return;
    }

    const nextPage = (pagination.page || 1) + 1;
    if (pagination.totalPages && nextPage > pagination.totalPages) {
      console.log(`Skipping fetch: nextPage ${nextPage} > totalPages ${pagination.totalPages}`);
      setPagination(prev => ({ ...prev, hasMore: false }));
      return;
    }

    if (lastAutoLoadPageRef.current === nextPage) {
      console.log(`Skipping duplicate auto-load for page ${nextPage}`);
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
      if (filters.salaryMin) apiFilters.salaryMin = filters.salaryMin;
      if (filters.salaryMax) apiFilters.salaryMax = filters.salaryMax;
      if (filters.currencyId) apiFilters.currencyId = filters.currencyId;
      if (filters.experienceMin) apiFilters.experienceMin = filters.experienceMin;
      if (filters.experienceMax) apiFilters.experienceMax = filters.experienceMax;
      if (filters.postedWithinDays) apiFilters.postedWithinDays = filters.postedWithinDays;
      if (filters.department) apiFilters.department = filters.department;

      let result;
      if (debouncedQuery.trim().length > 0 || hasBoosts) {
        result = await refopenAPI.searchJobs(debouncedQuery.trim(), { ...apiFilters, page: nextPage, pageSize: pagination.pageSize }, { signal: controller.signal });
      } else {
        result = await refopenAPI.getJobs(nextPage, pagination.pageSize, apiFilters, { signal: controller.signal });
      }
      if (controller.signal.aborted) return;

      if (result.success) {
        const list = Array.isArray(result.data) ? result.data : [];
        console.log(`?? Load more result: ${list.length} jobs, hasMore: ${result.meta?.hasMore}`);
        setJobs(prev => [...prev, ...list]);

        const meta = result.meta || {};
        setPagination(prev => ({
          ...prev,
          page: meta.page || nextPage,
          total: meta.total ?? prev.total,
          totalPages: meta.totalPages ?? prev.totalPages,
          hasMore: Boolean(meta.hasMore)
        }));

        if (list.length === 0) {
          console.log('?? No more jobs returned - setting hasMore to false');
          setPagination(prev => ({ ...prev, hasMore: false }));
        } else {
          lastAutoLoadPageRef.current = meta.page || nextPage;
        }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') console.error('Error loading more jobs:', e);
    } finally {
      if (!controller.signal.aborted) {
        setLoadingMore(false);
        isLoadingMoreRef.current = false;
      }
    }
  }, [loading, loadingMore, pagination.hasMore, pagination.page, pagination.pageSize, pagination.totalPages, debouncedQuery, filters, hasBoosts]);

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
    if (activeTab !== 'openings' || loading || loadingMore) return;
    const backendHasMore = pagination.hasMore;
    const lowThreshold = 5;

    console.log(`Smart Pagination Check:`, {
      jobsLength: jobs.length,
      lowThreshold,
      backendHasMore,
      currentPage: pagination.page,
      totalPages: pagination.totalPages,
      total: pagination.total
    });

    if (!backendHasMore) {
      console.log('Smart pagination skipped - backend says no more jobs available');
      return;
    }

    if (pagination.totalPages && pagination.page >= pagination.totalPages) {
      console.log(`Smart pagination skipped - already on last page ${pagination.page}/${pagination.totalPages}`);
      setPagination(prev => ({ ...prev, hasMore: false }));
      return;
    }

    // Trigger proactive load only once per page and only if not already loading
    if (jobs.length > 0 && jobs.length <= lowThreshold && lastAutoLoadPageRef.current < (pagination.page + 1)) {
      console.log(`Proactive pagination: Only ${jobs.length} jobs left on page ${pagination.page}, preloading page ${pagination.page + 1}...`);
      loadMoreJobs();
    }

    // Emergency loading - when user has no jobs visible but backend has more
    if (jobs.length === 0 && backendHasMore && !loading) {
      console.log('Emergency pagination: No jobs visible but backend has more available, loading immediately...');
      setSmartPaginating(true);
      setTimeout(() => {
        loadMoreJobs();
        setTimeout(() => setSmartPaginating(false), 1000);
      }, 100);
    }
  }, [jobs.length, activeTab, loading, loadingMore, pagination.hasMore, loadMoreJobs]);

  // ===== Handlers =====
  const openFilters = useCallback(() => { setFilterDraft({ ...filters }); setShowFilters(true); }, [filters]);
  const closeFilters = useCallback(() => setShowFilters(false), []);
  const resetDraft = useCallback(() => setFilterDraft({ ...EMPTY_FILTERS }), []);
  const applyDraft = useCallback(() => {
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
    setSavedJobs(prev => prev.filter(j => (j.JobID || j.id) !== jobId));
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
    const data = activeTab === 'openings' ? jobs : savedJobs;

    if (loading && data.length === 0 && activeTab === 'openings') {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      );
    }

    if (smartPaginating && data.length === 0 && activeTab === 'openings') {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Finding more opportunities...</Text>
        </View>
      );
    }

    if (data.length === 0) {
      const hasMoreToLoad = activeTab === 'openings' && pagination.hasMore;

      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No {activeTab} jobs</Text>
          <Text style={styles.emptyMessage}>
            {activeTab === 'openings'
              ? hasMoreToLoad
                ? 'Checking for more opportunities...'
                : `You've seen all available jobs! Great job exploring every opportunity. New jobs will appear here as they're posted.`
              : activeTab === 'saved' 
                ? 'Saved jobs will appear here when you bookmark jobs for later.'
                : 'New opportunities will appear here.'
            }
          </Text>

          {hasMoreToLoad && (
            <TouchableOpacity
              style={[styles.clearAllButton, { marginTop: 16, backgroundColor: '#0066cc' }]}
              onPress={() => {
                console.log('Manual Load More triggered');
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

    // Simple job cards without animations
    return data.map((job, index) => {
      const id = job.JobID || index;
      const jobKey = job.JobID || job.id;
      const isReferred = referredJobIds.has(jobKey);
      const isSaved = savedIds.has(jobKey);
      const isReferralRequesting = referralRequestingIds.has(jobKey); // NEW

      return (
        <View key={id} style={{ marginBottom: 12 }}>
          <JobCard
            job={job}
            jobTypes={jobTypes}
            workplaceTypes={workplaceTypes}
            onPress={() => navigation.navigate('JobDetails', { jobId: job.JobID })}
            onApply={() => handleApply(job)}
            onAskReferral={isReferred || isReferralRequesting ? null : () => handleAskReferral(job)}
            onSave={() => handleSave(job)}
            onUnsave={() => handleUnsave(job)}
            savedContext={activeTab === 'saved'}
            isReferred={isReferred}
            isSaved={isSaved}
            isReferralRequesting={isReferralRequesting}
          />
        </View>
      );
    });
  };

  const openingsCount = jobs.length;

  // 🔧 NEW: Preload saved job IDs and list
  useEffect(() => {
    (async () => {
      try {
        const r = await refopenAPI.getMySavedJobs(1, 500);
        if (r?.success) {
          const ids = new Set((r.data || []).map(s => s.JobID));
          setSavedIds(ids);
          setSavedJobs(r.data || []);
          setSavedCount(Number(r.meta?.total || r.data?.length || 0));
        }
      } catch {}
    })();
  }, []);

  // Tabs header
  const Tabs = () => (
    <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e9ecef' }}>
      {['openings','saved'].map(key => {
        const labels = { openings: 'Openings', saved: 'Saved' };
        const count = key === 'openings' ? openingsCount : savedCount;
        const active = activeTab === key;
        return (
          <TouchableOpacity key={key} onPress={() => setActiveTab(key)} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: active ? '#0066cc' : 'transparent' }}>
            <Text style={{ color: active ? '#0066cc' : '#555', fontWeight: active ? '700' : '600' }}>{`${labels[key]}(${count})`}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

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
      Alert.alert('Access Denied', 'Only job seekers can apply for positions');
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
    console.log('handleAskReferral called in JobsScreen for job:', job?.Title);

    if (!job) return;
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
      Alert.alert('Access Denied', 'Only job seekers can ask for referrals');
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

    // ✅ NEW: Check wallet balance instead of subscription
    try {
      console.log('Checking wallet balance...');
      const walletBalance = await refopenAPI.getWalletBalance();
      console.log('Wallet balance result:', walletBalance);

      if (walletBalance?.success) {
        const balance = walletBalance.data?.balance || 0;
        console.log('Current balance:', balance);

        // Check if balance >= ₹50
        if (balance < 50) {
          console.log('Insufficient wallet balance:', balance);
          
          // 💎 NEW: Show beautiful modal instead of ugly alert
          setWalletModalData({ currentBalance: balance, requiredAmount: 50 });
          setShowWalletModal(true);
          return;
        }

        console.log('✅ Sufficient balance - proceeding with referral');
      } else {
        console.error('Failed to check wallet balance:', walletBalance.error);
        Alert.alert('Error', 'Unable to check wallet balance. Please try again.');
        return;
      }
    } catch (e) {
      console.error('Failed to check wallet balance:', e);
      Alert.alert('Error', 'Unable to check wallet balance. Please try again.');
      return;
    }

    // Double-check no existing request (in case of race conditions)
    try {
      const existing = await refopenAPI.getMyReferralRequests(1, 100);
      if (existing.success && existing.data?.requests) {
        const already = existing.data.requests.some(r => r.JobID === jobId);
        if (already) {
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
      }
    } catch (e) {
      console.warn('Referral pre-check failed:', e.message);
    }

    // If user already has a primary resume, skip modal and create referral directly
    if (primaryResume?.ResumeID) {
      setReferralRequestingIds(prev => new Set([...prev, jobId]));
      await quickReferral(job, primaryResume.ResumeID);
      setReferralRequestingIds(prev => { const n = new Set(prev); n.delete(jobId); return n; });
      return;
    }
    setReferralMode(true); setPendingJobForApplication(job); setShowResumeModal(true);
  }, [user, isJobSeeker, navigation, referredJobIds, showSubscriptionModal, primaryResume, loadPrimaryResume]);

  // NEW: Subscription modal for quota exhausted users
  const showSubscriptionModal = useCallback(async (reasonOverride = null, hasActiveSubscription = false) => {
     console.log('💳 showSubscriptionModal called in JobsScreen');
     console.log('💳 Navigation object:', navigation);
     console.log('💳 Available routes:', navigation.getState?.());
     
     // On web, Alert only supports a single OK button (RN Web polyfill). Navigate directly.
     const exhaustedMsg = reasonOverride || `You've used all referral requests allowed in your current plan today.`;
     const body = hasActiveSubscription
       ? `${exhaustedMsg}\n\nUpgrade your plan to increase daily referral limit and continue boosting your job search.`
       : `You've used all 5 free referral requests for today!\n\nUpgrade to continue making referral requests and boost your job search.`;

     if (Platform.OS === 'web') {
       console.log('💳 Web platform detected - navigating directly to ReferralPlans');
       navigation.navigate('ReferralPlans');
       return;
     }
     
     try {
       Alert.alert(
         '🚀 Upgrade Required',
         body,
         [
           { 
             text: 'Maybe Later', 
             style: 'cancel',
             onPress: () => console.log('💳 User selected Maybe Later')
           },
           { 
             text: 'View Plans', 
             onPress: () => {
               console.log('💳 User selected View Plans - attempting navigation...');
               try {
                 navigation.navigate('ReferralPlans');
                 console.log('💳 Navigation successful!');
               } catch (navError) {
                 console.error('💳 Navigation error:', navError);
                 Alert.alert('Navigation Error', 'Unable to open plans. Please try again.');
               }
             }
           }
         ]
       );
       // Fallback: ensure navigation if user does not pick (defensive – some platforms auto-dismiss custom buttons)
       setTimeout(() => {
         const state = navigation.getState?.();
         const currentRoute = state?.routes?.[state.index]?.name;
         if (currentRoute !== 'ReferralPlans' && referralEligibility.dailyQuotaRemaining === 0) {
           console.log('💳 Fallback navigation to ReferralPlans after Alert timeout');
             try { navigation.navigate('ReferralPlans'); } catch (e) { console.warn('Fallback navigation failed', e); }
         }
       }, 3000);
     } catch (error) {
       console.error('🚨 Error showing subscription modal:', error);
       Alert.alert('Error', 'Failed to load subscription options. Please try again later.');
     }
   }, [navigation, referralEligibility]);

  // ? NEW: Handle plan selection and purchase
  const handlePlanSelection = useCallback(async (plan) => {
    console.log('Plan selected in JobsScreen:', plan);

    Alert.alert(
      'Confirm Subscription',
      `Subscribe to ${plan.Name} for ?${plan.Price}/month?\n\nThis will give you unlimited referral requests!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Subscribe Now',
          onPress: async () => {
            try {
              // For demo - simulate successful purchase
              Alert.alert(
                'Subscription Successful!',
                `Welcome to ${plan.Name}! You now have unlimited referral requests.`,
                [
                  {
                    text: 'Start Referring!',
                    onPress: async () => {
                      // Refresh eligibility after "purchase"
                      const eligibilityRes = await refopenAPI.checkReferralEligibility();
                      if (eligibilityRes?.success) {
                        setReferralEligibility(eligibilityRes.data);
                      }
                    }
                  }
                ]
              );

              // TODO: Implement real payment processing
              // const purchaseResult = await refopenAPI.purchaseReferralPlan(plan.PlanID);

            } catch (error) {
              Alert.alert('Purchase Failed', error.message || 'Failed to purchase subscription');
            }
          }
        }
      ]
    );
  }, []);

  // ? UPDATED: Resume selected handler supports both apply & referral flows
  const handleResumeSelected = useCallback(async (resumeData) => {
    if (!pendingJobForApplication) return;
    const job = pendingJobForApplication;
    const id = job.JobID || job.id;
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
          setReferredJobIds(prev => new Set([...prev, id]));
          setReferralEligibility(prev => ({
            ...prev,
            dailyQuotaRemaining: Math.max(0, prev.dailyQuotaRemaining - 1),
            isEligible: prev.dailyQuotaRemaining > 1
          }));
          showToast('Referral request sent successfully', 'success');
          
          // 🔧 FIXED: Reload primary resume after successful referral
          await loadPrimaryResume();
        } else {
          Alert.alert('Request Failed', res.error || res.message || 'Failed to send referral request');
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
          if (activeTab === 'openings') {
            setJobs(prev => prev.filter(j => (j.JobID || j.id) !== id));
            setPagination(prev => {
              const newTotal = Math.max((prev.total || 0) - 1, 0);
              const newTotalPages = Math.max(Math.ceil(newTotal / prev.pageSize), 1);
              return { ...prev, total: newTotal, totalPages: newTotalPages, hasMore: prev.page < newTotalPages && newTotal > prev.page * prev.pageSize };
            });
          }
          setAppliedJobs(prev => [{ ...job, __appliedAt: Date.now() }, ...prev]);
          showToast('Application submitted successfully', 'success');
          
          // 🔧 FIXED: Reload primary resume after successful application
          console.log('🔄 Reloading primary resume after successful application...');
          primaryResumeLoadedRef.current = false; // Reset the loaded flag
          await loadPrimaryResume(); // Reload primary resume
          console.log('✅ Primary resume reloaded, next applications will auto-apply');
          
          // Only refresh applied count (lightweight)
          try {
            const appliedRes = await refopenAPI.getMyApplications(1, 1);
            if (appliedRes?.success) setAppliedCount(Number(appliedRes.meta?.total || 0));
          } catch {}
        } else {
          Alert.alert('Application Failed', res.error || res.message || 'Failed to submit application');
        }
      }
    } catch (e) {
      console.error(referralMode ? 'Referral error' : 'Apply error', e);
      Alert.alert('Error', e.message || 'Operation failed');
    } finally {
      setPendingJobForApplication(null);
      setReferralMode(false);
    }
  }, [pendingJobForApplication, referralMode, activeTab, removeSavedJobLocally, loadPrimaryResume]);

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
        if (activeTab === 'openings') {
          setJobs(prev => prev.filter(j => (j.JobID || j.id) !== id));
          setPagination(prev => {
            const newTotal = Math.max((prev.total || 0) - 1, 0);
            const newTotalPages = Math.max(Math.ceil(newTotal / prev.pageSize), 1);
            return { ...prev, total: newTotal, totalPages: newTotalPages, hasMore: prev.page < newTotalPages && newTotal > prev.page * prev.pageSize };
          });
        }
        showToast('Application submitted', 'success');
        try {
          const appliedRes = await refopenAPI.getMyApplications(1, 1);
          if (appliedRes?.success) setAppliedCount(Number(appliedRes.meta?.total || 0));
        } catch {}
      } else {
        Alert.alert('Application Failed', res.error || res.message || 'Failed to submit application');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to submit application');
    }
  }, [activeTab, removeSavedJobLocally]);

  // NEW: Auto referral with known resume
  const quickReferral = useCallback(async (job, resumeId) => {
    const id = job.JobID || job.id;
    try {
      setReferralRequestingIds(prev => new Set([...prev, id])); // mark requesting
      const res = await refopenAPI.createReferralRequest({
        jobID: id,
        extJobID: null,
        resumeID: resumeId
      });
      if (res?.success) {
        setReferredJobIds(prev => new Set([...prev, id]));
        setReferralEligibility(prev => ({ ...prev, dailyQuotaRemaining: Math.max(0, prev.dailyQuotaRemaining - 1) }));
        
        // ✅ NEW: Show wallet deduction info
        const amountDeducted = res.data?.amountDeducted || 50;
        const balanceAfter = res.data?.walletBalanceAfter;
        
        let message = 'Referral request sent';
        if (balanceAfter !== undefined) {
          message = `Referral sent! ₹${amountDeducted} deducted. Balance: ₹${balanceAfter.toFixed(2)}`;
        }
        
        showToast(message, 'success');
      } else {
        // ✅ NEW: Handle insufficient balance error
        if (res.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
          const currentBalance = res.data?.currentBalance || 0;
          const requiredAmount = res.data?.requiredAmount || 50;
          
          // 💎 NEW: Show beautiful modal instead of ugly alert
          setWalletModalData({ currentBalance, requiredAmount });
          setShowWalletModal(true);
        } else {
          Alert.alert('Request Failed', res.error || res.message || 'Failed to send referral request');
        }
      }
    } catch (e) {
      console.error('Quick referral error:', e);
      Alert.alert('Error', e.message || 'Failed to send referral request');
    } finally {
      setReferralRequestingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }, [navigation]);

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
        
        // Add job to saved list without removing from openings
        setSavedJobs(prev => [{ ...job, __savedAt: Date.now() }, ...prev]);
        
        showToast('Job saved successfully', 'success');
      } else {
        Alert.alert('Save Failed', res.error || 'Failed to save job');
      }
    } catch (e) {
      console.error('Save error', e);
      Alert.alert('Error', e.message || 'Failed to save job');
    } finally {
      refreshCounts();
      if (activeTab === 'saved') {
        try {
          const r = await refopenAPI.getMySavedJobs(1, 50);
          if (r?.success) setSavedJobs(r.data || []);
        } catch {}
      }
    }
  }, [activeTab, refreshCounts, showToast]);

  // 🔧 NEW: Handle unsave functionality
  const handleUnsave = useCallback(async (job) => {
    if (!job) return;
    const id = job.JobID || job.id;
    try {
      const res = await refopenAPI.unsaveJob(id);
      if (res?.success) {
        removeSavedJobLocally(id);
        showToast('Job removed from saved', 'success');
      } else {
        Alert.alert('Unsave Failed', res.error || 'Failed to remove job from saved');
      }
    } catch (e) {
      console.error('Unsave error', e);
      Alert.alert('Error', e.message || 'Failed to remove job from saved');
    }
  }, [removeSavedJobLocally, showToast]);

  // Tab data loading effect - refresh when switching tabs
  useEffect(() => {
    (async () => {
      if (activeTab === 'saved') {
        try {
          console.log('🔄 Refreshing saved jobs data...');
          const r = await refopenAPI.getMySavedJobs(1, 50);
          if (r?.success) setSavedJobs(r.data || []);
        } catch {}
      } else if (activeTab === 'applied') {
        // 🔧 NEW: Refresh applied jobs when switching to applied tab
        await refreshApplicationsData();
      }
    })();
  }, [activeTab, refreshApplicationsData]);

  // Smart pagination monitoring with improved UX
  useEffect(() => {
    if (activeTab !== 'openings' || loading || loadingMore) return;

    const backendHasMore = pagination.hasMore;
    const lowThreshold = 5; // Trigger when only 5 jobs left

    console.log(`Smart Pagination Check:`, {
      jobsLength: jobs.length,
      lowThreshold,
      backendHasMore,
      currentPage: pagination.page,
      totalPages: pagination.totalPages,
      total: pagination.total
    });

    // Don't trigger if backend says no more
    if (!backendHasMore) {
      console.log('Smart pagination skipped - backend says no more jobs available');
      return;
    }

    // FIXED: Additional guard - don't trigger if current page >= totalPages
    if (pagination.totalPages && pagination.page >= pagination.totalPages) {
      console.log(`Smart pagination skipped - already on last page ${pagination.page}/${pagination.totalPages}`);
      setPagination(prev => ({ ...prev, hasMore: false }));
      return;
    }

    // Trigger proactive load only once per page and only if not already loading
    if (jobs.length > 0 && jobs.length <= lowThreshold && lastAutoLoadPageRef.current < (pagination.page + 1)) {
      console.log(`Proactive pagination: Only ${jobs.length} jobs left on page ${pagination.page}, preloading page ${pagination.page + 1}...`);
      loadMoreJobs();
    }

    // Emergency loading - when user has no jobs visible but backend has more
    if (jobs.length === 0 && backendHasMore && !loading) {
      console.log('Emergency pagination: No jobs visible but backend has more available, loading immediately...');
      setSmartPaginating(true);
      setTimeout(() => {
        loadMoreJobs();
        setTimeout(() => setSmartPaginating(false), 1000);
      }, 100);
    }
  }, [jobs.length, activeTab, loading, loadingMore, pagination.hasMore, loadMoreJobs]);

  // ===== Render =====
  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search jobs..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterButton} onPress={openFilters}>
          <Ionicons name="options-outline" size={24} color="#0066cc" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <Tabs />

      {/* Quick Filters Row */}
      {activeTab === 'openings' && (
        <View style={styles.quickFiltersContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
              <View style={styles.quickFilterItem}>
                <TouchableOpacity
                  style={[styles.quickFilterDropdown, (filters.jobTypeIds || []).length > 0 && styles.quickFilterActive]}
                  onPress={() => setExpandedQuick(expandedQuick === 'jobType' ? null : 'jobType')}
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
                  onPress={() => setExpandedQuick(expandedQuick === 'workplace' ? null : 'workplace')}
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
                  onPress={() => setExpandedQuick(expandedQuick === 'posted' ? null : 'posted')}
                >
                  <Text style={[styles.quickFilterText, (filters.postedWithinDays || quickPostedWithin) ? styles.quickFilterActiveText : null]}>
                    {quickPostedWithin ? (quickPostedWithin === 1 ? 'Last 24h' : quickPostedWithin === 7 ? 'Last 7 days' : 'Last 30 days') : 'Any'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={(filters.postedWithinDays || quickPostedWithin) ? '#0066cc' : '#666'} />
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

      {/* Expanded Quick Filter Slider */}
      {activeTab === 'openings' && expandedQuick && (
        <View style={styles.sliderBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 32 }}
            style={{ flexDirection: 'row' }}
          >
            {expandedQuick === 'jobType' && jobTypes.map(jt => (
              <TouchableOpacity
                key={jt.JobTypeID}
                style={[styles.chip, isSelected(filters.jobTypeIds, jt.JobTypeID) && styles.chipActive]}
                onPress={() => onQuickToggleJobType(jt.JobTypeID)}
              >
                <Text style={[styles.chipText, isSelected(filters.jobTypeIds, jt.JobTypeID) && styles.chipTextActive]}>
                  {jt.Type}
                </Text>
              </TouchableOpacity>
            ))}
            {expandedQuick === 'workplace' && workplaceTypes.map(wt => (
              <TouchableOpacity
                key={wt.WorkplaceTypeID}
                style={[styles.chip, isSelected(filters.workplaceTypeIds, wt.WorkplaceTypeID) && styles.chipActive]}
                onPress={() => onQuickToggleWorkplace(wt.WorkplaceTypeID)}
              >
                <Text style={[styles.chipText, isSelected(filters.workplaceTypeIds, wt.WorkplaceTypeID) && styles.chipTextActive]}>
                  {wt.Type}
                </Text>
              </TouchableOpacity>
            ))}
            {expandedQuick === 'posted' && (
              <>
                <TouchableOpacity
                  style={[styles.chip, quickPostedWithin === 1 && styles.chipActive]}
                  onPress={() => { setQuickPostedWithin(1); handleQuickPostedWithinChange(1); }}
                >
                  <Text style={[styles.chipText, quickPostedWithin === 1 && styles.chipTextActive]}>Last 24h</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, quickPostedWithin === 7 && styles.chipActive]}
                  onPress={() => { setQuickPostedWithin(7); handleQuickPostedWithinChange(7); }}
                >
                  <Text style={[styles.chipText, quickPostedWithin === 7 && styles.chipTextActive]}>Last 7 days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, quickPostedWithin === 30 && styles.chipActive]}
                  onPress={() => { setQuickPostedWithin(30); handleQuickPostedWithinChange(30); }}
                >
                  <Text style={[styles.chipText, quickPostedWithin === 30 && styles.chipTextActive]}>Last 30 days</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.chip, (!quickPostedWithin && !filters.postedWithinDays) && styles.chipActive]}
                  onPress={() => { setQuickPostedWithin(null); handleQuickPostedWithinChange(null); }}
                >
                  <Text style={[styles.chipText, (!quickPostedWithin && !filters.postedWithinDays) && styles.chipTextActive]}>Any</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      )}

      {/* Summary */}
      {activeTab === 'openings' && (
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            {(pagination.total || jobs.length)} jobs found{summaryText ? ` for "${summaryText}"` : ''}
          </Text>
        </View>
      )}

      {/* Job List */}
      <ScrollView
        style={styles.jobList}
        showsVerticalScrollIndicator={false}
        refreshControl={activeTab === 'openings' ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
        onScroll={activeTab === 'openings' ? onScrollNearEnd : undefined}
        scrollEventThrottle={16}
      >
        {renderList()}
      </ScrollView>

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
        onToggleJobType={onToggleJobType}
        onToggleWorkplaceType={onToggleWorkplaceType}
        onSelectCurrency={onSelectCurrency}
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
    </View>
  );
}