import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  RefreshControl,
  TextInput,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useResponsive } from '../../hooks/useResponsive';
import refopenAPI from '../../services/api';
import JobCard from '../../components/jobs/JobCard';
import CachedImage from '../../components/CachedImage';
import TabHeader from '../../components/TabHeader';
import DesktopLayout from '../../components/layout/DesktopLayout';
import FilterModal from '../../components/jobs/FilterModal';
import ConfirmPurchaseModal from '../../components/ConfirmPurchaseModal';
import { usePricing } from '../../contexts/PricingContext';
import { showToast } from '../../components/Toast';
import { getCached, hasCached, setCache, CACHE_KEYS } from '../../utils/homeCache';

/**
 * JobsLandingScreen — LinkedIn-style Jobs discovery page
 * 
 * Shows curated sections:
 *  1. Recommended for You (personalized)
 *  2. Top MNC Jobs (Fortune 500)
 *  3. Recent Jobs (latest)
 * 
 * Each section has "Show all →" which navigates to full JobsScreen with filter.
 * Used as the Jobs tab content on ALL platforms.
 */
export default function JobsLandingScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { user, isJobSeeker, isEmployer } = useAuth();
  const responsive = useResponsive();
  const { isMobile, isDesktop } = responsive;
  const isDesktopWeb = Platform.OS === 'web' && isDesktop;
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const [loading, setLoading] = useState(!hasCached(CACHE_KEYS.RECENT_JOBS));
  const [refreshing, setRefreshing] = useState(false);
  const [recommendedJobs, setRecommendedJobs] = useState(() => getCached(CACHE_KEYS.RECENT_JOBS) || []);
  const [topMncJobs, setTopMncJobs] = useState(() => getCached(CACHE_KEYS.F500_JOBS) || []);
  const [recentJobs, setRecentJobs] = useState(() => getCached('jobs_landing_recent') || []);
  const [jobTypes, setJobTypes] = useState(() => getCached(CACHE_KEYS.JOBS_JOB_TYPES) || []);
  const [workplaceTypes, setWorkplaceTypes] = useState(() => getCached(CACHE_KEYS.JOBS_WORKPLACE_TYPES) || []);
  const [searchQuery, setSearchQuery] = useState('');
  const abortRef = useRef(null);

  // FAB counts
  const [savedCount, setSavedCount] = useState(0);
  const [appliedCount, setAppliedCount] = useState(0);
  const [myReferralRequestsCount, setMyReferralRequestsCount] = useState(0);

  // FAB expand/collapse animation
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;
  const toggleFab = useCallback(() => {
    const toValue = fabOpen ? 0 : 1;
    Animated.spring(fabAnim, { toValue, useNativeDriver: true, friction: 6, tension: 80 }).start();
    setFabOpen(prev => !prev);
  }, [fabOpen, fabAnim]);

  // Load FAB badge counts
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const loadCounts = async () => {
        try {
          const [appliedRes, savedRes, referralRes] = await Promise.all([
            refopenAPI.getMyApplications(1, 1),
            refopenAPI.getMySavedJobs(1, 1),
            isJobSeeker ? refopenAPI.getMyReferralRequests(1, 500) : Promise.resolve(null),
          ]);
          if (appliedRes?.success) setAppliedCount(Number(appliedRes.meta?.total || 0));
          if (savedRes?.success) setSavedCount(Number(savedRes.meta?.total || 0));
          if (referralRes?.success) {
            const active = (referralRes.data?.requests || []).filter(r =>
              !['Cancelled', 'Expired', 'Verified', 'Unverified', 'Refunded'].includes(r.Status)
            );
            setMyReferralRequestsCount(active.length);
          }
        } catch {}
      };
      const timer = setTimeout(loadCounts, 100);
      return () => clearTimeout(timer);
    }, [user])
  );

  // Filter modal state (opens in-place, navigates to JobsList on apply)
  const EMPTY_FILTERS = {
    locations: [], jobTypeIds: [], workplaceTypeIds: [], organizationIds: [],
    salaryMin: '', salaryMax: '', currencyId: null, experienceMin: '', experienceMax: '',
    postedWithinDays: null, department: '', postedByType: null,
  };
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterDraft, setFilterDraft] = useState({ ...EMPTY_FILTERS });
  const [initialFilterSection, setInitialFilterSection] = useState(null);

  const openFilterChip = useCallback((section) => {
    setFilterDraft({ ...EMPTY_FILTERS });
    setInitialFilterSection(section);
    setShowFilterModal(true);
  }, []);

  const handleFilterApply = useCallback(() => {
    setShowFilterModal(false);
    // Navigate to browse screen with filters pre-applied
    navigation.navigate('JobsList', {
      screenTitle: 'Browse Jobs',
      appliedFilters: { ...filterDraft },
    });
  }, [filterDraft, navigation]);

  const handleFilterClose = useCallback(() => setShowFilterModal(false), []);
  const handleFilterClear = useCallback(() => setFilterDraft({ ...EMPTY_FILTERS }), []);
  const handleFilterChange = useCallback((patch) => setFilterDraft(prev => ({ ...prev, ...patch })), []);

  // AI Jobs access check + payment modal (handled here, not in JobsScreen)
  const { pricing } = usePricing();
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiWalletBalance, setAiWalletBalance] = useState(0);
  const [aiInsufficientBalance, setAiInsufficientBalance] = useState(false);
  const [aiChecking, setAiChecking] = useState(false);

  const handleAIJobsPress = useCallback(async () => {
    if (!user) { navigation.navigate('Auth'); return; }
    if (!isJobSeeker) { showToast('Only job seekers can use AI job recommendations', 'error'); return; }
    setAiChecking(true);
    try {
      // Check if user already has active AI access
      const accessStatus = await refopenAPI.apiCall('/access/status?type=ai_jobs');
      if (accessStatus?.success && accessStatus.data?.hasActiveAccess) {
        navigation.navigate('AIRecommendedJobs');
        return;
      }
    } catch (e) { /* fall through to payment */ }
    // Need to pay — get wallet balance
    try {
      const bal = await refopenAPI.getWalletBalance();
      const current = bal?.success ? (bal.data?.availableBalance ?? bal.data?.balance ?? 0) : 0;
      setAiWalletBalance(current);
      setAiInsufficientBalance(current < pricing.aiJobsCost);
      setShowAIModal(true);
    } catch (e) {
      setAiWalletBalance(0);
      setAiInsufficientBalance(true);
      setShowAIModal(true);
    } finally {
      setAiChecking(false);
    }
  }, [user, isJobSeeker, navigation, pricing]);

  const handleAIConfirm = useCallback(() => {
    setShowAIModal(false);
    if (!aiInsufficientBalance) {
      navigation.navigate('AIRecommendedJobs');
    }
  }, [aiInsufficientBalance, navigation]);

  const handleAICancel = useCallback(() => {
    setShowAIModal(false);
    if (aiInsufficientBalance) {
      navigation.navigate('WalletRecharge');
    }
  }, [aiInsufficientBalance, navigation]);

  // Navigate to full jobs list with search
  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigation.navigate('JobsList', { searchQuery: searchQuery.trim(), screenTitle: `Search: ${searchQuery.trim()}` });
    }
  };

  const loadData = useCallback(async (isRefresh = false) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const sig = { signal: controller.signal };

    // Only show loading spinner on first load (no cached data)
    // On refresh, keep existing data visible — no flash
    if (!isRefresh && !hasCached(CACHE_KEYS.RECENT_JOBS)) setLoading(true);

    try {
      // Parallel fetch: recommended (personalized), F500, recent (newest, no personalization), reference data
      const [recRes, f500Res, recentRes, refRes] = await Promise.all([
        refopenAPI.getJobs(1, 6, {}).catch(() => ({ success: false })),
        refopenAPI.getJobs(1, 6, { isFortune500: true }).catch(() => ({ success: false })),
        refopenAPI.getJobs(1, 6, { sortBy: 'newest', dontPersonalize: true }).catch(() => ({ success: false })),
        refopenAPI.getBulkReferenceMetadata(['JobType', 'WorkplaceType']).catch(() => ({ success: false })),
      ]);

      if (recRes.success) {
        const data = (recRes.data || []).slice(0, 6);
        setRecommendedJobs(data);
        setCache(CACHE_KEYS.RECENT_JOBS, data);
      }
      if (f500Res.success) {
        const data = (f500Res.data || []).slice(0, 6);
        setTopMncJobs(data);
        setCache(CACHE_KEYS.F500_JOBS, data);
      }
      if (recentRes.success) {
        const data = (recentRes.data || []).slice(0, 6);
        setRecentJobs(data);
        setCache('jobs_landing_recent', data);
      }
      if (refRes?.success && refRes.data) {
        if (refRes.data.JobType) {
          const jt = refRes.data.JobType.map(item => ({ JobTypeID: item.ReferenceID, Type: item.Value }));
          setJobTypes(jt);
          setCache(CACHE_KEYS.JOBS_JOB_TYPES, jt);
        }
        if (refRes.data.WorkplaceType) {
          const wt = refRes.data.WorkplaceType.map(item => ({ WorkplaceTypeID: item.ReferenceID, Type: item.Value }));
          setWorkplaceTypes(wt);
          setCache(CACHE_KEYS.JOBS_WORKPLACE_TYPES, wt);
        }
      }
    } catch (err) {
      if (err?.name !== 'AbortError') console.warn('JobsLanding load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  // Handlers
  const goToJob = (job) => {
    if (isDesktopWeb) {
      // Desktop: open split-pane view with this job pre-selected
      navigation.navigate('JobsList', { selectedJobId: job.JobID, screenTitle: 'Browse Jobs' });
    } else {
      // Mobile: navigate to full-screen job detail
      navigation.navigate('JobDetails', { jobId: job.JobID });
    }
  };

  // Show all — navigate to full JobsScreen (as stack screen) with filter
  const handleShowAll = (filter, title) => {
    navigation.navigate('JobsList', { 
      filterF500: filter?.isFortune500 || undefined,
      screenTitle: title,
    });
  };

  // Render a section
  const renderSection = (title, icon, jobs, filterParam, loadingState) => {
    if (jobs.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name={icon} size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <TouchableOpacity 
            style={styles.showAllBtn}
            onPress={() => handleShowAll(filterParam, title)}
          >
            <Text style={styles.showAllText}>Show all</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {jobs.length > 0 && (
          <View style={styles.jobsGrid}>
            {jobs.map((job) => (
              <View key={job.JobID} style={styles.jobCardWrapper}>
                <JobCard
                  job={job}
                  jobTypes={jobTypes}
                  workplaceTypes={workplaceTypes}
                  isDesktop={!isMobile}
                  onPress={() => goToJob(job)}
                  hideApply
                  hideReferral
                  hideSave
                  currentUserId={user?.UserID}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Engaging loading messages (Naukri-style)
  const loadingMessages = useMemo(() => [
    'Curating jobs for you...',
    'Finding the best matches...',
    'Scanning top companies...',
    'Personalizing recommendations...',
    'Almost there...',
  ], []);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setLoadingMsgIdx(i => (i + 1) % loadingMessages.length), 2000);
    return () => clearInterval(timer);
  }, [loading, loadingMessages]);

  if (loading) {
    return (
      <View style={styles.container}>
        <TabHeader title="Jobs" centerContent={null} gradient={null} showMessages={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{loadingMessages[loadingMsgIdx]}</Text>
        </View>
      </View>
    );
  }

  const mainContent = (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Search bar + filter icon (filter icon only on desktop, mobile has it in header) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={[styles.searchBar, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.gray400} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search jobs, companies, skills..."
            placeholderTextColor={colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.gray400} />
            </TouchableOpacity>
          )}
        </View>
        {isDesktopWeb && (
          <TouchableOpacity
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center' }}
            onPress={() => openFilterChip(null)}
          >
            <Ionicons name="options-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick filter chips — focused, direct action */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
        {/* AI Jobs */}
        <TouchableOpacity
          style={[styles.chip, { backgroundColor: colors.gray100 || colors.background, borderColor: colors.border }]}
          onPress={handleAIJobsPress}
        >
          <Text style={[styles.chipText, { color: colors.text }]}>AI Jobs</Text>
          <Ionicons name="bulb-outline" size={14} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Experience — direct navigate */}
        {[
          { label: 'Fresher / Entry Level', min: 0, max: 2 },
          { label: 'Mid Level', min: 3, max: 5 },
        ].map(lvl => (
          <TouchableOpacity
            key={lvl.label}
            style={[styles.chip, { backgroundColor: colors.gray100 || colors.background, borderColor: colors.border }]}
            onPress={() => navigation.navigate('JobsList', {
              screenTitle: `${lvl.label} Jobs`,
              appliedFilters: { experienceMin: lvl.min, experienceMax: lvl.max },
            })}
          >
            <Text style={[styles.chipText, { color: colors.text }]}>{lvl.label}</Text>
          </TouchableOpacity>
        ))}

        {/* Company Direct — navigate to direct career site jobs */}
        <TouchableOpacity
          style={[styles.chip, { backgroundColor: colors.gray100 || colors.background, borderColor: colors.border }]}
          onPress={() => navigation.navigate('JobsList', {
            screenTitle: 'Company Direct Jobs',
            appliedFilters: { directOnly: true },
          })}
        >
          <Text style={[styles.chipText, { color: colors.text }]}>Company Direct</Text>
        </TouchableOpacity>

        {/* Remote */}
        {(() => {
          const remoteWt = workplaceTypes.find(wt => wt.Type === 'Remote');
          if (!remoteWt) return null;
          return (
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: colors.gray100 || colors.background, borderColor: colors.border }]}
              onPress={() => navigation.navigate('JobsList', {
                screenTitle: 'Remote Jobs',
                appliedFilters: { workplaceTypeIds: [remoteWt.WorkplaceTypeID] },
              })}
            >
              <Text style={[styles.chipText, { color: colors.text }]}>Remote</Text>
            </TouchableOpacity>
          );
        })()}

        {/* Last 24h */}
        <TouchableOpacity
          style={[styles.chip, { backgroundColor: colors.gray100 || colors.background, borderColor: colors.border }]}
          onPress={() => navigation.navigate('JobsList', {
            screenTitle: 'Latest Jobs',
            appliedFilters: { postedWithinDays: 1 },
          })}
        >
          <Text style={[styles.chipText, { color: colors.text }]}>Last 24h</Text>
        </TouchableOpacity>

        {/* Location — opens modal */}
        <TouchableOpacity
          style={[styles.chip, { backgroundColor: colors.gray100 || colors.background, borderColor: colors.border }]}
          onPress={() => openFilterChip('location')}
        >
          <Text style={[styles.chipText, { color: colors.text }]}>Location</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* More — opens full filter modal */}
        <TouchableOpacity
          style={[styles.chip, { backgroundColor: colors.gray100 || colors.background, borderColor: colors.border }]}
          onPress={() => openFilterChip(null)}
        >
          <Ionicons name="options-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.chipText, { color: colors.text }]}>More</Text>
        </TouchableOpacity>
      </ScrollView>

      {renderSection('Recommended for You', 'sparkles-outline', recommendedJobs, { recommended: true }, loading)}
      {renderSection('Top MNC Jobs', 'business-outline', topMncJobs, { isFortune500: true }, loading)}
      {renderSection('Recent Jobs', 'time-outline', recentJobs, { sortBy: 'newest' }, loading)}

      {/* Browse all jobs CTA */}
      <TouchableOpacity
        style={[styles.browseAllBtn, { borderColor: colors.primary }]}
        onPress={() => handleShowAll({}, 'All Jobs')}
      >
        <Ionicons name="search-outline" size={20} color={colors.primary} />
        <Text style={[styles.browseAllText, { color: colors.primary }]}>Browse all jobs</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.primary} />
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <TabHeader 
        title="Jobs" 
        centerContent={null} 
        gradient={null} 
        showMessages={false}
        rightContent={
          <TouchableOpacity 
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center' }}
            onPress={() => openFilterChip('workMode')}
          >
            <Ionicons name="options-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        }
      />
      
      <View style={{ flex: 1 }}>
        <DesktopLayout>
          {mainContent}
        </DesktopLayout>

        {/* Floating Action Button - Expandable (same as JobsScreen) */}
        {user && (
          <View style={styles.fabContainerTop} pointerEvents="box-none">
            {/* Main FAB Toggle */}
            <TouchableOpacity
              style={[styles.fab, styles.fabMain]}
              onPress={toggleFab}
              activeOpacity={0.8}
            >
              <Animated.View style={{ transform: [{ rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
                <Ionicons name="add" size={24} color={colors.white} />
              </Animated.View>
              {!fabOpen && (savedCount + appliedCount + myReferralRequestsCount) > 0 && (
                <View style={styles.fabBadge}>
                  <Text style={styles.fabBadgeText}>{savedCount + appliedCount + myReferralRequestsCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Child FAB 1: Saved Jobs */}
            <Animated.View pointerEvents={fabOpen ? 'auto' : 'none'} style={{
              opacity: fabAnim,
              transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }, { scale: fabAnim }],
            }}>
              <TouchableOpacity
                style={[styles.fab, styles.fabSaved]}
                onPress={() => { navigation.navigate('SavedJobs'); toggleFab(); }}
                activeOpacity={0.8}
                pointerEvents={fabOpen ? 'auto' : 'none'}
              >
                <Ionicons name="bookmark" size={20} color={colors.white} />
                {savedCount > 0 && (
                  <View style={styles.fabBadge}>
                    <Text style={styles.fabBadgeText}>{savedCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Child FAB 2: Applications */}
            <Animated.View pointerEvents={fabOpen ? 'auto' : 'none'} style={{
              opacity: fabAnim,
              transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [-15, 0] }) }, { scale: fabAnim }],
            }}>
              <TouchableOpacity
                style={[styles.fab, styles.fabApplications]}
                onPress={() => { navigation.navigate('Applications'); toggleFab(); }}
                activeOpacity={0.8}
                pointerEvents={fabOpen ? 'auto' : 'none'}
              >
                <Ionicons name="briefcase" size={20} color={colors.white} />
                {appliedCount > 0 && (
                  <View style={styles.fabBadge}>
                    <Text style={styles.fabBadgeText}>{appliedCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Child FAB 3: Referral Requests */}
            <Animated.View pointerEvents={fabOpen ? 'auto' : 'none'} style={{
              opacity: fabAnim,
              transform: [{ translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }, { scale: fabAnim }],
            }}>
              <TouchableOpacity
                style={[styles.fab, styles.fabReferralRequests]}
                onPress={() => { navigation.navigate('MyReferralRequests'); toggleFab(); }}
                activeOpacity={0.8}
                pointerEvents={fabOpen ? 'auto' : 'none'}
              >
                <Ionicons name="people" size={20} color={colors.white} />
                {myReferralRequestsCount > 0 && (
                  <View style={styles.fabBadge}>
                    <Text style={styles.fabBadgeText}>{myReferralRequestsCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </View>

      <FilterModal
        visible={showFilterModal}
        onClose={handleFilterClose}
        filters={filterDraft}
        onFiltersChange={handleFilterChange}
        onApply={handleFilterApply}
        onClear={handleFilterClear}
        jobTypes={jobTypes}
        workplaceTypes={workplaceTypes}
        initialSection={initialFilterSection}
      />

      {/* AI Jobs confirmation modal */}
      <ConfirmPurchaseModal
        visible={showAIModal}
        currentBalance={Number(aiWalletBalance || 0)}
        requiredAmount={pricing.aiJobsCost}
        contextType="ai-jobs"
        itemName="Get 50 personalized job matches"
        accessDays={pricing.aiAccessDurationDays}
        onProceed={handleAIConfirm}
        onAddMoney={handleAICancel}
        onCancel={() => setShowAIModal(false)}
      />
    </View>
  );
}

const createStyles = (colors, responsive = {}) => {
  const { isMobile = true, isDesktop = false, isTablet = false } = responsive;
  const isDesktopWeb = Platform.OS === 'web' && isDesktop;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: isMobile ? 8 : 16,
      paddingTop: isMobile ? 0 : 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
    },
    pageHeader: {
      paddingVertical: 24,
      paddingHorizontal: 4,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
    },
    pageSubtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 4,
    },
    section: {
      marginBottom: isMobile ? 20 : 28,
      backgroundColor: colors.surface,
      borderRadius: isDesktopWeb ? 12 : 8,
      padding: isMobile ? 14 : 20,
      ...(isDesktopWeb ? {
        borderWidth: 1,
        borderColor: colors.border + '60',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      } : {}),
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isMobile ? 12 : 16,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      fontSize: isMobile ? 17 : 19,
      fontWeight: '700',
      color: colors.text,
    },
    showAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    showAllText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    jobsGrid: {
      ...(Platform.OS === 'web' && !isMobile ? {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 16,
      } : {}),
    },
    jobCardWrapper: {
      marginBottom: isMobile ? 0 : 0,
    },
    emptySection: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    browseAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 8,
      borderWidth: 1,
      marginTop: 8,
    },
    browseAllText: {
      fontSize: 15,
      fontWeight: '600',
    },
    // Search bar
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 12,
      height: 44,
      gap: 8,
      marginBottom: 12,
      marginTop: isMobile ? 8 : 0,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
    },
    chipsRow: {
      marginBottom: 16,
      flexGrow: 0,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '500',
    },
    // Floating Action Buttons
    fabContainerTop: {
      position: 'absolute',
      right: 16,
      top: 170,
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      zIndex: 10,
    },
    fab: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 6,
    },
    fabMain: {
      backgroundColor: colors.primary,
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    fabSaved: {
      backgroundColor: colors.primary,
    },
    fabApplications: {
      backgroundColor: colors.primary,
    },
    fabReferralRequests: {
      backgroundColor: colors.primary,
    },
    fabBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: colors.error,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    fabBadgeText: {
      color: colors.white,
      fontSize: 11,
      fontWeight: '700',
    },
    // Desktop LinkedIn-style layout
    desktopLayout: {
      flex: 1,
      flexDirection: 'row',
      maxWidth: 1200,
      width: '100%',
      alignSelf: 'center',
      paddingHorizontal: 24,
      paddingTop: 20,
      gap: 24,
    },
    leftSidebar: {
      width: 240,
    },
    mainContent: {
      flex: 1,
    },
    profileCard: {
      borderRadius: 8,
      borderWidth: 1,
      overflow: 'hidden',
      marginBottom: 12,
      alignItems: 'center',
      paddingBottom: 16,
    },
    profileCover: {
      height: 60,
      width: '100%',
    },
    profileAvatarWrapper: {
      marginTop: -30,
      marginBottom: 8,
    },
    profileAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 2,
      borderColor: '#fff',
    },
    profileName: {
      fontSize: 16,
      fontWeight: '600',
    },
    profileTitle: {
      fontSize: 12,
      marginTop: 2,
    },
    profileLocation: {
      fontSize: 11,
      marginTop: 2,
    },
    quickLinksCard: {
      borderRadius: 8,
      borderWidth: 1,
      paddingVertical: 8,
    },
    quickLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    quickLinkText: {
      fontSize: 13,
      fontWeight: '500',
    },
  });
};
