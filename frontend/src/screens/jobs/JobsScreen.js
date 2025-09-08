import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import nexhireAPI from '../../services/api';
import JobCard from '../../components/jobs/JobCard';
import FilterModal from '../../components/jobs/FilterModal';
import ResumeUploadModal from '../../components/ResumeUploadModal';
import { styles } from './JobsScreen.styles';

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

export default function JobsScreen({ navigation }) {
  const { user, isJobSeeker } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 350);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0, hasMore: true });

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
  const [activeTab, setActiveTab] = useState('openings');
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [appliedCount, setAppliedCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [appliedIds, setAppliedIds] = useState(new Set());
  const [savedIds, setSavedIds] = useState(new Set());
  const [smartPaginating, setSmartPaginating] = useState(false);

  // Preload applied IDs and list
  useEffect(() => {
    (async () => {
      try {
        const r = await nexhireAPI.getMyApplications(1, 500);
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

  // Preload saved IDs
  useEffect(() => {
    (async () => {
      try {
        const r = await nexhireAPI.getMySavedJobs(1, 500);
        if (r?.success) {
          const ids = new Set((r.data || []).map(s => s.JobID));
          setSavedIds(ids);
          setSavedJobs(r.data || []);
          setSavedCount(Number(r.meta?.total || (r.data || []).length || 0));
        }
      } catch {}
    })();
  }, []);

  // Counts from backend
  const refreshCounts = useCallback(async () => {
    try {
      const [appliedRes, savedRes] = await Promise.all([
        nexhireAPI.getMyApplications(1, 1),
        nexhireAPI.getMySavedJobs(1, 1)
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
      const profRes = await nexhireAPI.getApplicantProfile(user.userId || user.id || user.sub || user.UserID);
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
          nexhireAPI.getJobTypes(),
          nexhireAPI.getWorkplaceTypes(),
          nexhireAPI.getCurrencies()
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
          result = await nexhireAPI.searchJobs(debouncedQuery.trim() || '', params, { signal: controller.signal });
        } else {
          result = await nexhireAPI.getJobs(1, pagination.pageSize, apiFilters, { signal: controller.signal });
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
      console.log('🛑 Load more skipped - no more jobs available');
      return;
    }

    const nextPage = (pagination.page || 1) + 1;
    if (pagination.totalPages && nextPage > pagination.totalPages) {
      console.log(`🛑 Skipping fetch: nextPage ${nextPage} > totalPages ${pagination.totalPages}`);
      setPagination(prev => ({ ...prev, hasMore: false }));
      return;
    }

    if (lastAutoLoadPageRef.current === nextPage) {
      console.log(`🛑 Skipping duplicate auto-load for page ${nextPage}`);
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
        result = await nexhireAPI.searchJobs(debouncedQuery.trim(), { ...apiFilters, page: nextPage, pageSize: pagination.pageSize }, { signal: controller.signal });
      } else {
        result = await nexhireAPI.getJobs(nextPage, pagination.pageSize, apiFilters, { signal: controller.signal });
      }
      if (controller.signal.aborted) return;

      if (result.success) {
        const list = Array.isArray(result.data) ? result.data : [];
        console.log(`📄 Load more result: ${list.length} jobs, hasMore: ${result.meta?.hasMore}`);
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
          console.log('🛑 No more jobs returned - setting hasMore to false');
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

    console.log(`🔍 Smart Pagination Check:`, {
      jobsLength: jobs.length,
      lowThreshold,
      backendHasMore,
      currentPage: pagination.page,
      totalPages: pagination.totalPages,
      total: pagination.total
    });
    
    if (!backendHasMore) {
      console.log('🛑 Smart pagination skipped - backend says no more jobs available');
      return;
    }
    
    if (pagination.totalPages && pagination.page >= pagination.totalPages) {
      console.log(`🛑 Smart pagination skipped - already on last page ${pagination.page}/${pagination.totalPages}`);
      setPagination(prev => ({ ...prev, hasMore: false }));
      return;
    }

    // Trigger proactive load only once per page and only if not already loading
    if (jobs.length > 0 && jobs.length <= lowThreshold && lastAutoLoadPageRef.current < (pagination.page + 1)) {
      console.log(`🔄 Proactive pagination: Only ${jobs.length} jobs left on page ${pagination.page}, preloading page ${pagination.page + 1}...`);
      loadMoreJobs();
    }
  }, [jobs.length, activeTab, loading, loadingMore, pagination.hasMore, pagination.page, pagination.totalPages, loadMoreJobs]);

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

  // Build summary string
  const summaryText = useMemo(() => {
    const parts = [];
    if (smartBoosts.candidateYears) parts.push(`${smartBoosts.candidateYears}+ yrs`);
    const jt = (smartBoosts.boostJobTypeIds || '').split(',').filter(Boolean).map(id => (jobTypes.find(j => String(j.JobTypeID) === String(id)) || {}).Type).filter(Boolean);
    const wt = (smartBoosts.boostWorkplaceTypeIds || '').split(',').filter(Boolean).map(id => (workplaceTypes.find(w => String(w.WorkplaceTypeID) === String(id)) || {}).Type).filter(Boolean);
    if (jt.length) parts.push(jt.slice(0, 3).join('/'));
    if (wt.length) parts.push(wt.join('/'));
    if (smartBoosts.boostLocation) parts.push(smartBoosts.boostLocation);
    
    if (parts.length === 0) {
      if (filters.experienceMin) parts.push(`${filters.experienceMin}+ yrs`);
      const jobTypeNames = (filters.jobTypeIds || []).map(id => (jobTypes.find(j => String(j.JobTypeID) === String(id)) || {}).Type).filter(Boolean);
      const workplaceNames = (filters.workplaceTypeIds || []).map(id => (workplaceTypes.find(w => String(w.WorkplaceTypeID) === String(id)) || {}).Type).filter(Boolean);
      if (jobTypeNames.length) parts.push(jobTypeNames.slice(0, 3).join('/'));
      if (workplaceNames.length) parts.push(workplaceNames.join('/'));
      if (filters.location) parts.push(filters.location);
    }
    return parts.join(' • ');
  }, [smartBoosts, filters, jobTypes, workplaceTypes]);

  // Render list without animations
  const renderList = () => {
    const data = activeTab === 'openings' ? jobs : activeTab === 'applied' ? appliedJobs : savedJobs;
    
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
                : `You've seen all ${pagination.total || 65} available jobs! Great job exploring every opportunity. New jobs will appear here as they're posted.`
              : 'New opportunities will appear here.'
            }
          </Text>
          
          {hasMoreToLoad && (
            <TouchableOpacity 
              style={[styles.clearAllButton, { marginTop: 16, backgroundColor: '#0066cc' }]}
              onPress={() => {
                console.log('📱 Manual Load More triggered');
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
      return (
        <View key={id} style={{ marginBottom: 12 }}>
          <JobCard
            job={job}
            jobTypes={jobTypes}
            workplaceTypes={workplaceTypes}
            onPress={() => navigation.navigate('JobDetails', { jobId: job.JobID })}
            onApply={() => handleApply(job)}
            onSave={() => handleSave(job)}
            savedContext={activeTab === 'saved'}
          />
        </View>
      );
    });
  };

  const openingsCount = jobs.length;

  // Tabs header
  const Tabs = () => (
    <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e9ecef' }}>
      {['openings','applied','saved'].map(key => {
        const labels = { openings: 'Openings', applied: 'Applied', saved: 'Saved' };
        const count = key === 'openings' ? openingsCount : key === 'applied' ? appliedCount : savedCount;
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
    
    // ✅ NEW: Check authentication and user type first
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

    // ✅ NEW: Show resume upload modal instead of direct apply
    console.log('🔧 Apply button clicked, showing resume modal for job:', job.Title);
    setPendingJobForApplication(job);
    setShowResumeModal(true);
  }, [user, isJobSeeker, navigation]);

  // ✅ NEW: Handle resume selection and then apply
  const handleResumeSelected = useCallback(async (resumeData) => {
    if (!pendingJobForApplication) return;
    
    const job = pendingJobForApplication;
    const id = job.JobID || job.id;
    
    try {
      // Hide modal first
      setShowResumeModal(false);
      setPendingJobForApplication(null);

      // Apply with the selected resume
      const applicationData = {
        jobID: id,
        coverLetter: `I am very interested in the ${job.Title} position and believe my skills and experience make me a great candidate for this role.`,
        resumeId: resumeData.ResumeID // Use the ResumeID from the selected/uploaded resume
      };

      console.log('🔧 Applying with resume data:', { resumeId: resumeData.ResumeID, jobTitle: job.Title });
      
      // Update UI immediately for better UX
      if (activeTab === 'openings') {
        setJobs(prev => {
          const updated = prev.filter(j => (j.JobID || j.id) !== id);
          
          if (updated.length === 0) {
            console.log('🔄 Jobs array empty after apply - triggering fresh reload to check for more data');
            setPagination(p => ({ ...p, page: 1 }));
            setTimeout(() => {
              triggerReload();
            }, 100);
          }
          
          return updated;
        });
        
        setPagination(prev => {
          const newTotal = Math.max((prev.total || 0) - 1, 0);
          const newTotalPages = Math.max(Math.ceil(newTotal / prev.pageSize), 1);
          return {
            ...prev,
            total: newTotal,
            totalPages: newTotalPages,
            hasMore: prev.page < newTotalPages && newTotal > prev.page * prev.pageSize
          };
        });
        
        setAppliedJobs(prev => [{ ...job, __appliedAt: Date.now() }, ...prev]);
      } else if (activeTab === 'saved') {
        setSavedJobs(prev => prev.filter(j => (j.JobID || j.id) !== id));
        setAppliedJobs(prev => [{ ...job, __appliedAt: Date.now() }, ...prev]);
        setSavedCount(c => Math.max((c || 0) - 1, 0));
      }
      
      // Make API call
      const res = await nexhireAPI.applyForJob(applicationData);
      if (res?.success) {
        setAppliedIds(prev => {
          const next = new Set(prev ?? new Set());
          next.add(id);
          return next;
        });
        setAppliedCount(c => (Number(c) || 0) + 1);
        
        // ✅ NEW: Show success message
        Alert.alert(
          'Application Submitted! 🎉',
          'Your application has been submitted successfully. Good luck!',
          [
            { text: 'View Applications', onPress: () => setActiveTab('applied') },
            { text: 'OK', style: 'default' }
          ]
        );
      } else {
        Alert.alert('Application Failed', res.error || res.message || 'Failed to submit application');
      }
    } catch (e) {
      console.error('Apply error', e);
      Alert.alert('Error', e.message || 'Failed to submit application');
    } finally {
      refreshCounts();
      
      if (activeTab === 'saved') {
        try { 
          const r = await nexhireAPI.getMySavedJobs(1, 50); 
          if (r?.success) {
            setSavedJobs(r.data || []);
            const ids = new Set((r.data || []).map(s => s.JobID));
            setSavedIds(ids);
          }
        } catch {}
      } else if (activeTab === 'applied') {
        try { 
          const r = await nexhireAPI.getMyApplications(1, 50); 
          if (r?.success) {
            const items = (r.data || []).map(a => ({ 
              JobID: a.JobID, 
              Title: a.JobTitle || a.Title, 
              OrganizationName: a.CompanyName || a.OrganizationName, 
              Location: a.JobLocation || a.Location, 
              SalaryRangeMin: a.SalaryRangeMin, 
              SalaryRangeMax: a.SalaryRangeMax, 
              PublishedAt: a.SubmittedAt 
            }));
            setAppliedJobs(items);
            const ids = new Set((r.data || []).map(a => a.JobID));
            setAppliedIds(ids);
          }
        } catch {}
      }
    }
  }, [pendingJobForApplication, activeTab, refreshCounts, triggerReload]);

  const handleSave = useCallback(async (job) => {
    if (!job) return;
    const id = job.JobID || job.id;
    
    try {
      if (activeTab === 'openings') {
        // Immediate update without animation
        setJobs(prev => {
          const updated = prev.filter(j => (j.JobID || j.id) !== id);
          
          // FIXED: Trigger reload when jobs become empty to refresh pagination metadata
          if (updated.length === 0) {
            console.log('🔄 Jobs array empty after save - triggering fresh reload to check for more data');
            // RESET pagination to page 1 to avoid currentPage > totalPages mismatch
            setPagination(p => ({ ...p, page: 1 }));
            setTimeout(() => {
              triggerReload();
            }, 100);
          }
          
          return updated;
        });
        
        // FIXED: Update pagination metadata immediately when removing jobs
        setPagination(prev => {
          const newTotal = Math.max((prev.total || 0) - 1, 0);
          const newTotalPages = Math.max(Math.ceil(newTotal / prev.pageSize), 1);
          return {
            ...prev,
            total: newTotal,
            totalPages: newTotalPages,
            hasMore: prev.page < newTotalPages && newTotal > prev.page * prev.pageSize
          };
        });
        
        setSavedJobs(prev => [{ ...job, __savedAt: Date.now() }, ...prev]);
      }
      
      const res = await nexhireAPI.saveJob(id);
      if (res?.success) {
        setSavedCount(c => (Number(c) || 0) + 1);
        setSavedIds(prev => {
          const next = new Set(prev ?? new Set());
          next.add(id);
          return next;
        });
      }
    } catch (e) {
      console.error('Save error', e);
    } finally {
      refreshCounts();
      if (activeTab === 'saved') {
        try { 
          const r = await nexhireAPI.getMySavedJobs(1, 50); 
          if (r?.success) setSavedJobs(r.data || []); 
        } catch {}
      }
    }
  }, [activeTab, refreshCounts, triggerReload]);

  // Tab data loading effect
  useEffect(() => {
    (async () => {
      if (activeTab === 'saved') {
        try {
          const r = await nexhireAPI.getMySavedJobs(1, 50);
          if (r?.success) setSavedJobs(r.data || []);
        } catch {}
      } else if (activeTab === 'applied') {
        try {
          const r = await nexhireAPI.getMyApplications(1, 50);
          if (r?.success) {
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
          }
        } catch {}
      }
    })();
  }, [activeTab]);

  // Smart pagination monitoring with improved UX
  useEffect(() => {
    if (activeTab !== 'openings' || loading || loadingMore) return;
    
    const backendHasMore = pagination.hasMore;
    const lowThreshold = 5; // Trigger when only 5 jobs left
    
    console.log(`🔍 Smart Pagination Check:`, {
      jobsLength: jobs.length,
      lowThreshold,
      backendHasMore,
      currentPage: pagination.page,
      totalPages: pagination.totalPages,
      total: pagination.total
    });
    
    // Don't trigger if backend says no more
    if (!backendHasMore) {
      console.log('🛑 Smart pagination skipped - backend says no more jobs available');
      return;
    }
    
    // FIXED: Additional guard - don't trigger if current page >= totalPages
    if (pagination.totalPages && pagination.page >= pagination.totalPages) {
      console.log(`🛑 Smart pagination skipped - already on last page ${pagination.page}/${pagination.totalPages}`);
      setPagination(prev => ({ ...prev, hasMore: false }));
      return;
    }

    // Trigger proactive load only once per page and only if not already loading
    if (jobs.length > 0 && jobs.length <= lowThreshold && lastAutoLoadPageRef.current < (pagination.page + 1)) {
      console.log(`🔄 Proactive pagination: Only ${jobs.length} jobs left on page ${pagination.page}, preloading page ${pagination.page + 1}...`);
      loadMoreJobs();
    }
    
    // Emergency loading - when user has no jobs visible but backend has more
    if (jobs.length === 0 && backendHasMore && !loading) {
      console.log('🔄 Emergency pagination: No jobs visible but backend says more available, loading immediately...');
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

      {/* ✅ NEW: Resume Upload Modal */}
      <ResumeUploadModal
        visible={showResumeModal}
        onClose={() => {
          setShowResumeModal(false);
          setPendingJobForApplication(null);
        }}
        onResumeSelected={handleResumeSelected}
        user={user}
        jobTitle={pendingJobForApplication?.Title}
      />
    </View>
  );
}