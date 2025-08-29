import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import nexhireAPI from '../../services/api';
import { colors, typography } from '../../styles/theme';

// Debounce hook
const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
};

// Fuzzy score
const score = (text, query) => {
  if (!query) return 1;
  const t = (text || '').toString().toLowerCase();
  const q = query.toLowerCase();
  if (t.includes(q)) return 1;
  const tokens = q.split(/\s+/).filter(Boolean);
  let hits = 0;
  tokens.forEach(tok => { if (t.includes(tok)) hits++; });
  return hits / Math.max(tokens.length, 1);
};

// Chips helper
const isSelected = (arr, id) => arr?.some(x => String(x) === String(id));
const toggleInArray = (arr, id) => isSelected(arr, id) ? arr.filter(x => String(x) !== String(id)) : [...(arr || []), id];

// HOISTED, STABLE MODAL COMPONENT
const FilterSheet = React.memo(function FilterSheet({
  visible,
  draft,
  jobTypes,
  workplaceTypes,
  currencies,
  onChangeDraft,
  onToggleJobType,
  onToggleWorkplaceType,
  onSelectCurrency,
  onApply,
  onReset,
  onClose,
}) {
  const postedWithinOptions = [
    { label: '24h', value: 1 },
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
  ];

  const phColor = colors.gray400;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Filters</Text>
          <TouchableOpacity onPress={onReset}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
          {/* Location */}
          <View>
            <Text style={styles.filterLabel}>Location</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="City, State or Country"
              placeholderTextColor={phColor}
              value={draft.location}
              onChangeText={(t) => onChangeDraft({ location: t })}
            />
          </View>

          {/* Job Type (multi) */}
          <View>
            <Text style={styles.filterLabel}>Job Type</Text>
            <View style={styles.pillRow}>
              {jobTypes.map(jt => (
                <TouchableOpacity
                  key={jt.JobTypeID}
                  style={[styles.pill, isSelected(draft.jobTypeIds, jt.JobTypeID) && styles.pillActive]}
                  onPress={() => onToggleJobType(jt.JobTypeID)}
                >
                  <Text style={[styles.pillText, isSelected(draft.jobTypeIds, jt.JobTypeID) && styles.pillTextActive]}>
                    {jt.Type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Workplace (multi) */}
          <View>
            <Text style={styles.filterLabel}>Workplace</Text>
            <View style={styles.pillRow}>
              {/* Any chip */}
              <TouchableOpacity
                style={[styles.pill, (!draft.workplaceTypeIds || draft.workplaceTypeIds.length === 0) && styles.pillActive]}
                onPress={() => onChangeDraft({ workplaceTypeIds: [] })}
              >
                <Text style={[styles.pillText, (!draft.workplaceTypeIds || draft.workplaceTypeIds.length === 0) && styles.pillTextActive]}>Any</Text>
              </TouchableOpacity>

              {/* Actual workplace types */}
              {workplaceTypes.map(wt => (
                <TouchableOpacity
                  key={wt.WorkplaceTypeID}
                  style={[styles.pill, isSelected(draft.workplaceTypeIds, wt.WorkplaceTypeID) && styles.pillActive]}
                  onPress={() => onToggleWorkplaceType(wt.WorkplaceTypeID)}
                >
                  <Text style={[styles.pillText, isSelected(draft.workplaceTypeIds, wt.WorkplaceTypeID) && styles.pillTextActive]}>
                    {wt.Type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Experience range */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Min Experience (yrs)</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="e.g., 2"
                placeholderTextColor={phColor}
                keyboardType="numeric"
                value={draft.experienceMin?.toString() || ''}
                onChangeText={(t) => onChangeDraft({ experienceMin: t.replace(/[^0-9]/g, '') })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Max Experience (yrs)</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="e.g., 6"
                placeholderTextColor={phColor}
                keyboardType="numeric"
                value={draft.experienceMax?.toString() || ''}
                onChangeText={(t) => onChangeDraft({ experienceMax: t.replace(/[^0-9]/g, '') })}
              />
            </View>
          </View>

          {/* Salary Range */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Min Salary</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="e.g., 1000000"
                placeholderTextColor={phColor}
                keyboardType="numeric"
                value={draft.salaryMin}
                onChangeText={(t) => onChangeDraft({ salaryMin: t.replace(/[^0-9]/g, '') })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Max Salary</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="e.g., 3000000"
                placeholderTextColor={phColor}
                keyboardType="numeric"
                value={draft.salaryMax}
                onChangeText={(t) => onChangeDraft({ salaryMax: t.replace(/[^0-9]/g, '') })}
              />
            </View>
          </View>

          {/* Currency (single) */}
          <View>
            <Text style={styles.filterLabel}>Currency</Text>
            <View style={styles.pillRow}>
              <TouchableOpacity
                style={[styles.pill, !draft.currencyId && styles.pillActive]}
                onPress={() => onSelectCurrency(null)}
              >
                <Text style={[styles.pillText, !draft.currencyId && styles.pillTextActive]}>Any</Text>
              </TouchableOpacity>
              {(currencies || []).slice(0, 8).map(c => (
                <TouchableOpacity
                  key={c.CurrencyID}
                  style={[styles.pill, String(draft.currencyId) === String(c.CurrencyID) && styles.pillActive]}
                  onPress={() => onSelectCurrency(c.CurrencyID)}
                >
                  <Text style={[styles.pillText, String(draft.currencyId) === String(c.CurrencyID) && styles.pillTextActive]}>
                    {c.Code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Posted within */}
          <View>
            <Text style={styles.filterLabel}>Posted Within</Text>
            <View style={styles.pillRow}>
              <TouchableOpacity
                style={[styles.pill, !draft.postedWithinDays && styles.pillActive]}
                onPress={() => onChangeDraft({ postedWithinDays: null })}
              >
                <Text style={[styles.pillText, !draft.postedWithinDays && styles.pillTextActive]}>Any time</Text>
              </TouchableOpacity>
              {postedWithinOptions.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.pill, Number(draft.postedWithinDays) === opt.value && styles.pillActive]}
                  onPress={() => onChangeDraft({ postedWithinDays: opt.value })}
                >
                  <Text style={[styles.pillText, Number(draft.postedWithinDays) === opt.value && styles.pillTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Department */}
          <View>
            <Text style={styles.filterLabel}>Department</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="e.g., Engineering, Product"
              placeholderTextColor={phColor}
              value={draft.department || ''}
              onChangeText={(t) => onChangeDraft({ department: t })}
            />
          </View>

          <TouchableOpacity style={styles.applyBtn} onPress={onApply}>
            <Ionicons name="checkmark" size={18} color={colors.white} />
            <Text style={styles.applyBtnText}>Apply Filters</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
});

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

// Compute recommended filters from applicant profile
const computeRecommendedFilters = (profile, jobTypes, workplaceTypes) => {
  const rec = { ...EMPTY_FILTERS };
  if (!profile) return rec;

  const years = monthsToYears(profile.TotalExperienceMonths);
  if (years > 0) {
    rec.experienceMin = String(years); // show jobs at or above candidate's years
    rec.postedWithinDays = 30; // fresher jobs not prioritized; recent postings
  } else {
    // Likely student/fresher
    rec.postedWithinDays = 30;
  }

  // Job types preference
  const pjt = (profile.PreferredJobTypes || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (pjt.length) {
    rec.jobTypeIds = mapTypesToIds(pjt, jobTypes, 'JobTypeID', 'Type');
  } else if (years === 0) {
    // default for students
    rec.jobTypeIds = mapTypesToIds(['Internship', 'Temporary', 'Part-time'], jobTypes, 'JobTypeID', 'Type');
  }

  // Workplace
  const pwt = (profile.PreferredWorkTypes || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (pwt.length) {
    rec.workplaceTypeIds = mapTypesToIds(pwt, workplaceTypes, 'WorkplaceTypeID', 'Type');
  }

  // Location preference
  const loc = (profile.PreferredLocations || profile.CurrentLocation || '').split(',')[0]?.trim();
  if (loc) rec.location = loc;

  // Salary
  if (profile.MinimumSalary != null) rec.salaryMin = String(profile.MinimumSalary);

  // Department/industry keywords
  if (profile.PreferredIndustries) {
    rec.department = profile.PreferredIndustries.split(',')[0].trim();
  } else if (profile.CurrentJobTitle) {
    // rough extraction for engineering/product/design
    const title = profile.CurrentJobTitle.toLowerCase();
    if (title.includes('engineer') || title.includes('developer')) rec.department = 'Engineering';
    else if (title.includes('data')) rec.department = 'Data';
    else if (title.includes('product')) rec.department = 'Product';
    else if (title.includes('design')) rec.department = 'Design';
  }

  return rec;
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
  const { user } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 350);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });

  // Applied filters
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });

  // Manual reload trigger
  const [reloadKey, setReloadKey] = useState(0);
  const triggerReload = useCallback(() => setReloadKey(k => k + 1), []);

  // Draft for modal
  const [filterDraft, setFilterDraft] = useState({ ...EMPTY_FILTERS });
  const [showFilters, setShowFilters] = useState(false);

  const [jobTypes, setJobTypes] = useState([]);
  const [workplaceTypes, setWorkplaceTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  // Smart filter toggle
  const [smartEnabled, setSmartEnabled] = useState(true);
  const [personalizationApplied, setPersonalizationApplied] = useState(false);

  const applySmart = useCallback(async () => {
    try {
      if (!user) return;
      const profRes = await nexhireAPI.getApplicantProfile(user.userId || user.id || user.sub || user.UserID);
      if (profRes?.success) {
        const rec = computeRecommendedFilters(profRes.data, jobTypes, workplaceTypes);
        setFilters({ ...rec });
        setFilterDraft({ ...rec });
        setPersonalizationApplied(true);
        triggerReload();
      } else {
        setPersonalizationApplied(true);
      }
    } catch (e) {
      console.warn('Smart filter apply failed:', e?.message);
      setPersonalizationApplied(true);
    }
  }, [user, jobTypes, workplaceTypes, triggerReload]);

  // Personalize once on first load if smartEnabled and no user input yet
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

  // Track modal open in a ref to skip fetches without causing effect re-runs
  const showFiltersRef = useRef(false);
  useEffect(() => { showFiltersRef.current = showFilters; }, [showFilters]);

  // Track loading more separately to avoid flicker and loops
  const [loadingMore, setLoadingMore] = useState(false);

  // Separate controllers for base list and load-more
  const listAbortRef = useRef(null);
  const loadMoreAbortRef = useRef(null);

  // Mounted ref and global cleanup for abort controllers
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
    try { listAbortRef.current?.abort?.(); } catch {}
    try { loadMoreAbortRef.current?.abort?.(); } catch {}
  }, []);

  // ===== BASE LIST FETCH (page 1) =====
  useEffect(() => {
    if (showFiltersRef.current) return; // don't fetch while editing filters

    // Abort previous base request
    if (listAbortRef.current) {
      try { listAbortRef.current.abort(); } catch {}
    }

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

        const currentPage = 1;
        let result;
        if (debouncedQuery.trim()) {
          result = await nexhireAPI.searchJobs(debouncedQuery, { page: currentPage, pageSize: pagination.pageSize, ...apiFilters }, { signal: controller.signal });
        } else {
          result = await nexhireAPI.getJobs(currentPage, pagination.pageSize, apiFilters, { signal: controller.signal });
        }
        if (controller.signal.aborted) return;

        if (result.success) {
          let list = Array.isArray(result.data) ? result.data : [];
          // client-side safety filters
          list = list.filter(j => {
            if (filters.jobTypeIds?.length && !filters.jobTypeIds.map(String).includes(String(j.JobTypeID))) return false;
            if (filters.workplaceTypeIds?.length && !filters.workplaceTypeIds.map(String).includes(String(j.WorkplaceTypeID))) return false;
            if (filters.currencyId && String(j.CurrencyID) !== String(filters.currencyId)) return false;
            if (filters.location) {
              const loc = [j.City, j.State, j.Country, j.Location].filter(Boolean).join(', ').toLowerCase();
              if (!loc.includes(filters.location.toLowerCase())) return false;
            }
            if (filters.salaryMin && !(j.SalaryRangeMax == null || parseFloat(j.SalaryRangeMax) >= parseFloat(filters.salaryMin))) return false;
            if (filters.salaryMax && !(j.SalaryRangeMin == null || parseFloat(j.SalaryRangeMin) <= parseFloat(filters.salaryMax))) return false;
            if (filters.experienceMin && !(j.ExperienceMax == null || parseInt(j.ExperienceMax) >= parseInt(filters.experienceMin))) return false;
            if (filters.experienceMax && !(j.ExperienceMin == null || parseInt(j.ExperienceMin) <= parseInt(filters.experienceMax))) return false;
            if (filters.postedWithinDays) {
              const dt = new Date(j.PublishedAt || j.CreatedAt || j.UpdatedAt);
              if (isNaN(dt)) return false;
              const diffDays = (Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24);
              if (diffDays > Number(filters.postedWithinDays)) return false;
            }
            if (filters.department && !(j.Department || '').toLowerCase().includes(filters.department.toLowerCase())) return false;
            return true;
          });

          if (debouncedQuery.trim()) {
            list = list
              .map(j => ({
                ...j,
                __s: Math.max(
                  score(j.Title, debouncedQuery),
                  score(j.OrganizationName, debouncedQuery),
                  score([j.City, j.State, j.Country, j.Location].filter(Boolean).join(' '), debouncedQuery)
                )
              }))
              .filter(j => j.__s > 0)
              .sort((a, b) => b.__s - a.__s)
              .map(({ __s, ...rest }) => rest);
          }
          if (!mountedRef.current) return;
          setJobs(list);
          if (result.meta) {
            setPagination(prev => ({ ...prev, page: result.meta.page || 1, total: result.meta.total || list.length, totalPages: result.meta.totalPages || Math.ceil((result.meta.total || list.length) / (result.meta.pageSize || prev.pageSize)) }));
          } else {
            setPagination(prev => ({ ...prev, page: 1, total: list.length, totalPages: Math.ceil(list.length / prev.pageSize) }));
          }
        }
      } catch (e) {
        if (e?.name !== 'AbortError') {
          console.error('Error fetching jobs:', e);
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
  }, [debouncedQuery, filters, reloadKey]);

  // ===== LOAD MORE (page > 1) =====
  const loadMoreJobs = useCallback(async () => {
    if (showFiltersRef.current) return;
    if (loading || loadingMore) return;
    if (!pagination.totalPages || pagination.page >= pagination.totalPages) return;

    // Abort any previous load-more request
    if (loadMoreAbortRef.current) {
      try { loadMoreAbortRef.current.abort(); } catch {}
    }

    const nextPage = (pagination.page || 1) + 1;
    const controller = new AbortController();
    loadMoreAbortRef.current = controller;

    try {
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
      if (debouncedQuery.trim()) {
        result = await nexhireAPI.searchJobs(debouncedQuery, { page: nextPage, pageSize: pagination.pageSize, ...apiFilters }, { signal: controller.signal });
      } else {
        result = await nexhireAPI.getJobs(nextPage, pagination.pageSize, apiFilters, { signal: controller.signal });
      }
      if (controller.signal.aborted) return;

      if (result.success) {
        let list = Array.isArray(result.data) ? result.data : [];
        if (list.length === 0) {
          // no more data
          setPagination(prev => ({ ...prev, page: nextPage, totalPages: prev.page }));
          return;
        }
        // optional client-side filters (same as above)
        if (filters.jobTypeIds?.length || filters.workplaceTypeIds?.length || filters.location || filters.currencyId || filters.salaryMin || filters.salaryMax || filters.experienceMin || filters.experienceMax || filters.postedWithinDays || filters.department) {
          list = list.filter(j => {
            if (filters.jobTypeIds?.length && !filters.jobTypeIds.map(String).includes(String(j.JobTypeID))) return false;
            if (filters.workplaceTypeIds?.length && !filters.workplaceTypeIds.map(String).includes(String(j.WorkplaceTypeID))) return false;
            if (filters.currencyId && String(j.CurrencyID) !== String(filters.currencyId)) return false;
            if (filters.location) {
              const loc = [j.City, j.State, j.Country, j.Location].filter(Boolean).join(', ').toLowerCase();
              if (!loc.includes(filters.location.toLowerCase())) return false;
            }
            if (filters.salaryMin && !(j.SalaryRangeMax == null || parseFloat(j.SalaryRangeMax) >= parseFloat(filters.salaryMin))) return false;
            if (filters.salaryMax && !(j.SalaryRangeMin == null || parseFloat(j.SalaryRangeMin) <= parseFloat(filters.salaryMax))) return false;
            if (filters.experienceMin && !(j.ExperienceMax == null || parseInt(j.ExperienceMax) >= parseInt(filters.experienceMin))) return false;
            if (filters.experienceMax && !(j.ExperienceMin == null || parseInt(j.ExperienceMin) <= parseInt(filters.experienceMax))) return false;
            if (filters.postedWithinDays) {
              const dt = new Date(j.PublishedAt || j.CreatedAt || j.UpdatedAt);
              if (isNaN(dt)) return false;
              const diffDays = (Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24);
              if (diffDays > Number(filters.postedWithinDays)) return false;
            }
            if (filters.department && !(j.Department || '').toLowerCase().includes(filters.department.toLowerCase())) return false;
            return true;
          });
        }

        // append
        setJobs(prev => [...prev, ...list]);
        if (result.meta) {
          setPagination(prev => ({
            ...prev,
            page: result.meta.page || nextPage,
            total: result.meta.total || (prev.total + list.length),
            totalPages: result.meta.totalPages || prev.totalPages
          }));
        } else {
          // Fallback: if we got less than a full page, we reached the end
          const reachedEnd = list.length < (pagination.pageSize || 20);
          setPagination(prev => ({ ...prev, page: nextPage, total: prev.total + list.length, totalPages: reachedEnd ? nextPage : nextPage + 1 }));
        }
      }
    } catch (e) {
      if (e?.name !== 'AbortError') console.error('Error loading more jobs:', e);
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }, [loading, loadingMore, pagination.page, pagination.pageSize, pagination.totalPages, debouncedQuery, filters]);

  // ===== Handlers for filters, search, refresh =====
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
  const clearAllFilters = useCallback(() => { clearSearch(); }, [clearSearch]);

  const toggleSmartFilter = useCallback(() => {
    setSmartEnabled(prev => {
      const next = !prev;
      if (next) applySmart();
      return next;
    });
  }, [applySmart]);

  // ===== Utilities for card rendering =====
  const formatSalary = (job) => {
    if (job?.SalaryRangeMin != null && job?.SalaryRangeMax != null) {
      const fmt = (n) => (typeof n === 'number' ? n : parseFloat(n || 0)).toLocaleString('en-US');
      const currency = job.CurrencyCode || job.CurrencySymbol || 'USD';
      const period = job.SalaryPeriod || 'Annual';
      return `$${fmt(job.SalaryRangeMin)} - $${fmt(job.SalaryRangeMax)} ${currency} ${period}`;
    }
    return 'Salary not specified';
  };

  const formatLocation = (job) => {
    const parts = [];
    if (job?.City) parts.push(job.City);
    if (job?.State) parts.push(job.State);
    if (job?.Country) parts.push(job.Country);
    let loc = parts.join(', ') || job?.Location || 'Location not specified';
    if (job?.IsRemote) loc += ' (Remote)';
    else if (job?.WorkplaceType) loc += ` (${job.WorkplaceType})`;
    return loc;
  };

  const formatPostedDate = (ds) => {
    if (!ds) return 'Recently posted';
    const d = new Date(ds); const now = new Date();
    const h = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    if (h < 1) return 'Just posted';
    if (h < 24) return `${h} hours ago`;
    const days = Math.floor(h / 24); if (days < 7) return `${days} days ago`;
    const w = Math.floor(days / 7); if (w < 4) return `${w} weeks ago`;
    return d.toLocaleDateString();
  };

  const JobCard = React.memo(({ job }) => (
    <TouchableOpacity style={styles.jobCard} onPress={() => navigation.navigate('JobDetails', { jobId: job.JobID })}>
      <View style={styles.jobHeader}>
        <Text style={styles.jobTitle} numberOfLines={2}>{job.Title}</Text>
        <Text style={styles.jobSalary}>{formatSalary(job)}</Text>
      </View>
      <Text style={styles.jobCompany}>{job.OrganizationName || 'Company Name'}</Text>
      <Text style={styles.jobLocation}>{formatLocation(job)}</Text>
      {!!job.Description && <Text style={styles.jobDescription} numberOfLines={2}>{job.Description}</Text>}
      <View style={styles.jobFooter}>
        <View style={styles.jobTags}>
          <Text style={styles.jobType}>{job.JobTypeName || job.JobType || 'Full-time'}</Text>
          {job.ExperienceLevel && (<Text style={styles.experienceLevel}>{job.ExperienceLevel}</Text>)}
          {job.IsRemote && (<Text style={styles.remoteTag}>Remote</Text>)}
        </View>
        <Text style={styles.jobPosted}>{formatPostedDate(job.CreatedAt || job.PublishedAt)}</Text>
      </View>
    </TouchableOpacity>
  ));

  const EmptyState = React.memo(() => (
    <View style={styles.emptyState}>
      <Ionicons name="briefcase-outline" size={64} color={colors.gray400} />
      <Text style={styles.emptyStateTitle}>{debouncedQuery ? 'No Jobs Found' : 'No Jobs Available'}</Text>
      <Text style={styles.emptyStateText}>{debouncedQuery ? 'Try adjusting your search or filters.' : 'New opportunities will appear here.'}</Text>
      {(debouncedQuery || isFiltersDirty(filters)) && (
        <TouchableOpacity style={styles.clearSearchButton} onPress={clearAllFilters}>
          <Text style={styles.clearSearchText}>Clear All</Text>
        </TouchableOpacity>
      )}
    </View>
  ));

  const LoadingFooter = React.memo(() => (
    loadingMore ? (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading more jobs...</Text>
      </View>
    ) : null
  ));

  // ===== end added handlers/components =====

  // Build a small personalized summary string (memoized)
  const jobTypeNames = useMemo(() => (
    (filters.jobTypeIds || [])
      .map(id => (jobTypes.find(j => String(j.JobTypeID) === String(id)) || {}).Type)
      .filter(Boolean)
  ), [filters.jobTypeIds, jobTypes]);

  const workplaceNames = useMemo(() => (
    (filters.workplaceTypeIds || [])
      .map(id => (workplaceTypes.find(w => String(w.WorkplaceTypeID) === String(id)) || {}).Type)
      .filter(Boolean)
  ), [filters.workplaceTypeIds, workplaceTypes]);

  const summaryText = useMemo(() => {
    const parts = [];
    if (filters.experienceMin) parts.push(`${filters.experienceMin}+ yrs`);
    if (jobTypeNames.length) parts.push(jobTypeNames.slice(0, 3).join('/'));
    if (workplaceNames.length) parts.push(workplaceNames.join('/'));
    if (filters.location) parts.push(filters.location);
    return parts.join(' � ');
  }, [filters.experienceMin, filters.location, jobTypeNames, workplaceNames]);

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={colors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search jobs..."
            placeholderTextColor={colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch}>
              <Ionicons name="close-circle" size={20} color={colors.gray400} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterButton} onPress={openFilters}>
          <Ionicons name="options" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Results Summary with Clear All + Smart toggle */}
      <View style={styles.summaryContainer}>
        <View style={{ flexDirection: 'column', gap: 2, flex: 1 }}>
          <Text style={styles.summaryText}>
            {debouncedQuery ? `${jobs.length} jobs found for "${debouncedQuery}"` : `${jobs.length} jobs available`}
          </Text>
          {smartEnabled && personalizationApplied && summaryText && (
            <Text style={styles.smartSummaryText}>Personalized: {summaryText}</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={[styles.smartBtn, smartEnabled ? styles.smartOn : null]}
            onPress={toggleSmartFilter}
          >
            <Ionicons name="sparkles" size={16} color={smartEnabled ? colors.white : colors.primary} />
            <Text style={[styles.smartText, smartEnabled ? { color: colors.white } : null]}>Smart</Text>
          </TouchableOpacity>
          {(searchQuery.length > 0 || isFiltersDirty(filters)) && (
            <TouchableOpacity style={styles.clearAllBtn} onPress={clearAllFilters}>
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={styles.clearAllText}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={jobs}
        renderItem={({ item }) => <JobCard job={item} />}
        keyExtractor={(item) => item.JobID}
        contentContainerStyle={jobs.length === 0 ? styles.emptyContainer : styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMoreJobs}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={<EmptyState />}
        ListFooterComponent={<LoadingFooter />}
        showsVerticalScrollIndicator={false}
      />

      <FilterSheet
        visible={showFilters}
        draft={filterDraft}
        jobTypes={jobTypes}
        workplaceTypes={workplaceTypes}
        currencies={currencies}
        onChangeDraft={onChangeDraft}
        onToggleJobType={onToggleJobType}
        onToggleWorkplaceType={onToggleWorkplaceType}
        onSelectCurrency={onSelectCurrency}
        onApply={applyDraft}
        onReset={resetDraft}
        onClose={closeFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, fontSize: typography.sizes.md, color: colors.gray600 },
  searchContainer: { flexDirection: 'row', padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 12, marginRight: 12 },
  searchInput: { flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: typography.sizes.md, color: colors.text },
  filterButton: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  summaryContainer: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryText: { fontSize: typography.sizes.sm, color: colors.gray600 },
  clearAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  clearAllText: { color: colors.primary, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
  listContainer: { padding: 16 },
  emptyContainer: { flex: 1 },
  jobCard: { backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  jobTitle: { flex: 1, fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text, marginRight: 12 },
  jobSalary: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.primary },
  jobCompany: { fontSize: typography.sizes.md, fontWeight: typography.weights.medium, color: colors.gray700, marginBottom: 4 },
  jobLocation: { fontSize: typography.sizes.sm, color: colors.gray600, marginBottom: 8 },
  jobDescription: { fontSize: typography.sizes.sm, color: colors.gray600, lineHeight: 20, marginBottom: 12 },
  jobFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobTags: { flexDirection: 'row', gap: 8 },
  jobType: { fontSize: typography.sizes.xs, fontWeight: typography.weights.medium, color: colors.primary, backgroundColor: colors.primary + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  experienceLevel: { fontSize: typography.sizes.xs, fontWeight: typography.weights.medium, color: colors.success, backgroundColor: colors.success + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  remoteTag: { fontSize: typography.sizes.xs, fontWeight: typography.weights.medium, color: colors.warning, backgroundColor: colors.warning + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  jobPosted: { fontSize: typography.sizes.xs, color: colors.gray500 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyStateTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text, marginTop: 16, marginBottom: 8 },
  emptyStateText: { fontSize: typography.sizes.md, color: colors.gray600, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  clearSearchButton: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  clearSearchText: { color: colors.white, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
  loadingFooter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text },
  filterLabel: { fontSize: typography.sizes.sm, color: colors.gray600, marginBottom: 6 },
  filterInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: typography.sizes.md, color: colors.text },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface },
  pillActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  pillText: { color: colors.text },
  pillTextActive: { color: colors.primary, fontWeight: '600' },
  applyBtn: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10 },
  applyBtnText: { color: colors.white, fontWeight: '600' },
  smartBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  smartOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  smartText: { color: colors.primary, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
  smartSummaryText: { fontSize: typography.sizes.xs, color: colors.gray600 },
});