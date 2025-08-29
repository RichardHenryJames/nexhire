import React, { useState, useEffect, useCallback, useRef } from 'react';
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

// HOISTED, STABLE MODAL COMPONENT
const FilterSheet = React.memo(function FilterSheet({
  visible,
  draft,
  jobTypes,
  workplaceTypes,
  onChangeDraft,
  onToggleJobType,
  onToggleWorkplaceType,
  onApply,
  onReset,
  onClose,
}) {
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

        <View style={{ padding: 16, gap: 12 }}>
          {/* Location */}
          <View>
            <Text style={styles.filterLabel}>Location</Text>
            <TextInput
              style={styles.filterInput}
              placeholder="City, State or Country"
              value={draft.location}
              onChangeText={(t) => onChangeDraft({ location: t })}
            />
          </View>

          {/* Job Type */}
          <View>
            <Text style={styles.filterLabel}>Job Type</Text>
            <View style={styles.pillRow}>
              {jobTypes.map(jt => (
                <TouchableOpacity
                  key={jt.JobTypeID}
                  style={[styles.pill, String(draft.jobTypeId) === String(jt.JobTypeID) && styles.pillActive]}
                  onPress={() => onToggleJobType(jt.JobTypeID)}
                >
                  <Text style={[styles.pillText, String(draft.jobTypeId) === String(jt.JobTypeID) && styles.pillTextActive]}>
                    {jt.Type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Workplace Type */}
          <View>
            <Text style={styles.filterLabel}>Workplace</Text>
            <View style={styles.pillRow}>
              {workplaceTypes.map(wt => (
                <TouchableOpacity
                  key={wt.WorkplaceTypeID}
                  style={[styles.pill, String(draft.workplaceTypeId) === String(wt.WorkplaceTypeID) && styles.pillActive]}
                  onPress={() => onToggleWorkplaceType(wt)}
                >
                  <Text style={[styles.pillText, String(draft.workplaceTypeId) === String(wt.WorkplaceTypeID) && styles.pillTextActive]}>
                    {wt.Type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Salary Range */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Min Salary</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="e.g., 1000000"
                keyboardType="numeric"
                value={draft.salaryMin}
                onChangeText={(t) => onChangeDraft({ salaryMin: t })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Max Salary</Text>
              <TextInput
                style={styles.filterInput}
                placeholder="e.g., 3000000"
                keyboardType="numeric"
                value={draft.salaryMax}
                onChangeText={(t) => onChangeDraft({ salaryMax: t })}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.applyBtn} onPress={onApply}>
            <Ionicons name="checkmark" size={18} color={colors.white} />
            <Text style={styles.applyBtnText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

// Keep EMPTY_FILTERS constant to reuse
const EMPTY_FILTERS = { location: '', jobTypeId: '', workplaceTypeId: '', isRemote: null, salaryMin: '', salaryMax: '' };

export default function JobsScreen({ navigation }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 350);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });

  // Applied filters
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });

  // Manual reload trigger (increments to force effect re-run without changing filters/query)
  const [reloadKey, setReloadKey] = useState(0);
  const triggerReload = useCallback(() => setReloadKey(k => k + 1), []);

  // Draft for modal
  const [filterDraft, setFilterDraft] = useState({ ...EMPTY_FILTERS });
  const [showFilters, setShowFilters] = useState(false);

  const [jobTypes, setJobTypes] = useState([]);
  const [workplaceTypes, setWorkplaceTypes] = useState([]);

  // Load reference data once
  useEffect(() => {
    (async () => {
      try {
        const [jt, wt] = await Promise.all([nexhireAPI.getJobTypes(), nexhireAPI.getWorkplaceTypes()]);
        if (jt?.success) setJobTypes(jt.data);
        if (wt?.success) setWorkplaceTypes(wt.data);
      } catch {}
    })();
  }, []);

  // Track modal open in a ref to skip fetches without causing effect re-runs
  const showFiltersRef = useRef(false);
  useEffect(() => { showFiltersRef.current = showFilters; }, [showFilters]);

  // Abort previous in-flight requests when a new search/filter arrives
  const abortRef = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; abortRef.current?.abort?.(); }, []);

  // Single fetch effect: runs on mount and whenever search/filters or reloadKey change
  useEffect(() => {
    if (showFiltersRef.current) return; // don't fetch while editing filters

    // Abort previous request
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const run = async () => {
      try {
        setLoading(true);
        const apiFilters = {};
        if (filters.location) apiFilters.location = filters.location;
        if (filters.jobTypeId) apiFilters.jobTypeId = filters.jobTypeId;
        if (filters.workplaceTypeId) apiFilters.workplaceTypeId = filters.workplaceTypeId;
        if (filters.salaryMin) apiFilters.salaryMin = filters.salaryMin;
        if (filters.salaryMax) apiFilters.salaryMax = filters.salaryMax;
        if (typeof filters.isRemote === 'boolean') apiFilters.isRemote = filters.isRemote;

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
          // client-side safety
          list = list.filter(j => {
            if (filters.jobTypeId && String(j.JobTypeID) !== String(filters.jobTypeId)) return false;
            if (filters.workplaceTypeId && String(j.WorkplaceTypeID) !== String(filters.workplaceTypeId)) return false;
            if (filters.location) {
              const loc = [j.City, j.State, j.Country, j.Location].filter(Boolean).join(', ').toLowerCase();
              if (!loc.includes(filters.location.toLowerCase())) return false;
            }
            const minOk = !filters.salaryMin || (j.SalaryRangeMax == null || parseFloat(j.SalaryRangeMax) >= parseFloat(filters.salaryMin));
            const maxOk = !filters.salaryMax || (j.SalaryRangeMin == null || parseFloat(j.SalaryRangeMin) <= parseFloat(filters.salaryMax));
            if (!minOk || !maxOk) return false;
            if (typeof filters.isRemote === 'boolean') { if (Boolean(j.IsRemote) !== filters.isRemote) return false; }
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
    return () => {
      try { controller.abort(); } catch {}
    };
  }, [debouncedQuery, filters, reloadKey]);

  // Handlers
  const openFilters = useCallback(() => { setFilterDraft({ ...filters }); setShowFilters(true); }, [filters]);
  const closeFilters = useCallback(() => setShowFilters(false), []);
  const resetDraft = useCallback(() => setFilterDraft({ ...EMPTY_FILTERS }), []);
  const applyDraft = useCallback(() => { setFilters({ ...filterDraft }); setShowFilters(false); }, [filterDraft]);

  const onChangeDraft = useCallback((patch) => { setFilterDraft(prev => ({ ...prev, ...patch })); }, []);
  const onToggleJobType = useCallback((id) => { setFilterDraft(prev => ({ ...prev, jobTypeId: String(prev.jobTypeId) === String(id) ? '' : id })); }, []);
  const onToggleWorkplaceType = useCallback((wt) => { setFilterDraft(prev => ({ ...prev, workplaceTypeId: String(prev.workplaceTypeId) === String(wt.WorkplaceTypeID) ? '' : wt.WorkplaceTypeID, isRemote: wt.Type === 'Remote' ? true : (wt.Type === 'Onsite' ? false : prev.isRemote) })); }, []);

  const onRefresh = useCallback(async () => { setRefreshing(true); triggerReload(); }, [triggerReload]);
  const loadMoreJobs = useCallback(() => {}, []); // Pagination disabled for now to keep UX stable
  const handleSearchSubmit = useCallback(() => triggerReload(), [triggerReload]);

  const clearSearch = useCallback(() => { setSearchQuery(''); setFilters({ ...EMPTY_FILTERS }); triggerReload(); }, [triggerReload]);

  const JobCard = React.memo(({ job }) => (
    <TouchableOpacity style={styles.jobCard} onPress={() => navigation.navigate('JobDetails', { jobId: job.JobID })}>
      <View style={styles.jobHeader}>
        <Text style={styles.jobTitle} numberOfLines={2}>{job.Title}</Text>
        <Text style={styles.jobSalary}>{formatSalary(job)}</Text>
      </View>
      <Text style={styles.jobCompany}>{job.OrganizationName || 'Company Name'}</Text>
      <Text style={styles.jobLocation}>{formatLocation(job)}</Text>
      <Text style={styles.jobDescription} numberOfLines={2}>{job.Description || 'Job description not available'}</Text>
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

  const formatSalary = (job) => {
    if (job.SalaryRangeMin && job.SalaryRangeMax) {
      const currency = job.CurrencyCode || 'USD';
      const period = job.SalaryPeriod || 'Annual';
      const fmt = (n) => (typeof n === 'number' ? n : parseFloat(n || 0)).toLocaleString('en-US');
      return `$${fmt(job.SalaryRangeMin)} - $${fmt(job.SalaryRangeMax)} ${currency} ${period}`;
    }
    return 'Salary not specified';
  };

  const formatLocation = (job) => {
    const parts = [];
    if (job.City) parts.push(job.City);
    if (job.State) parts.push(job.State);
    if (job.Country) parts.push(job.Country);
    let loc = parts.join(', ') || job.Location || 'Location not specified';
    if (job.IsRemote) loc += ' (Remote)';
    else if (job.WorkplaceType) loc += ` (${job.WorkplaceType})`;
    return loc;
  };

  const formatPostedDate = (ds) => {
    if (!ds) return 'Recently posted';
    const d = new Date(ds); const now = new Date();
    const h = Math.floor((now - d) / (1000 * 60 * 60));
    if (h < 1) return 'Just posted';
    if (h < 24) return `${h} hours ago`;
    const days = Math.floor(h / 24); if (days < 7) return `${days} days ago`;
    const w = Math.floor(days / 7); if (w < 4) return `${w} weeks ago`;
    return d.toLocaleDateString();
  };

  const EmptyState = React.memo(() => (
    <View style={styles.emptyState}>
      <Ionicons name="briefcase-outline" size={64} color={colors.gray400} />
      <Text style={styles.emptyStateTitle}>{debouncedQuery ? 'No Jobs Found' : 'No Jobs Available'}</Text>
      <Text style={styles.emptyStateText}>{debouncedQuery ? 'Try adjusting your search or filters.' : 'New opportunities will appear here.'}</Text>
      {debouncedQuery && (
        <TouchableOpacity style={styles.clearSearchButton} onPress={clearSearch}>
          <Text style={styles.clearSearchText}>Clear Search</Text>
        </TouchableOpacity>
      )}
    </View>
  ));

  const LoadingFooter = React.memo(() => (
    loading && pagination.page > 1 ? (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading more jobs...</Text>
      </View>
    ) : null
  ));

  // Keep screen content when modal is open
  const showLoading = loading && pagination.page === 1 && !showFilters;
  if (showLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading jobs...</Text>
        <FilterSheet
          visible={showFilters}
          draft={filterDraft}
          jobTypes={jobTypes}
          workplaceTypes={workplaceTypes}
          onChangeDraft={onChangeDraft}
          onToggleJobType={onToggleJobType}
          onToggleWorkplaceType={onToggleWorkplaceType}
          onApply={applyDraft}
          onReset={resetDraft}
          onClose={closeFilters}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={colors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search jobs..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); fetchJobs(true); }}>
              <Ionicons name="close-circle" size={20} color={colors.gray400} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterButton} onPress={() => { setFilterDraft({ ...filters }); setShowFilters(true); }}>
          <Ionicons name="options" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Results Summary */}
      {jobs.length > 0 && (
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            {debouncedQuery ? `${jobs.length} jobs found for "${debouncedQuery}"` : `${jobs.length} jobs available`}
          </Text>
        </View>
      )}

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
        onChangeDraft={onChangeDraft}
        onToggleJobType={onToggleJobType}
        onToggleWorkplaceType={onToggleWorkplaceType}
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
  summaryContainer: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryText: { fontSize: typography.sizes.sm, color: colors.gray600 },
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
});