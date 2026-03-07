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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useResponsive } from '../../hooks/useResponsive';
import refopenAPI from '../../services/api';
import JobCard from '../../components/jobs/JobCard';
import CachedImage from '../../components/CachedImage';
import TabHeader from '../../components/TabHeader';
import DesktopLayout from '../../components/layout/DesktopLayout';

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

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recommendedJobs, setRecommendedJobs] = useState([]);
  const [topMncJobs, setTopMncJobs] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [jobTypes, setJobTypes] = useState([]);
  const [workplaceTypes, setWorkplaceTypes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const abortRef = useRef(null);

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

    if (!isRefresh) setLoading(true);

    try {
      // Parallel fetch: recommended, F500, recent, reference data
      const [recRes, f500Res, recentRes, refRes] = await Promise.all([
        refopenAPI.getJobs(1, 6, {}).catch(() => ({ success: false })),
        refopenAPI.getJobs(1, 6, { isFortune500: true }).catch(() => ({ success: false })),
        refopenAPI.getJobs(1, 6, {}).catch(() => ({ success: false })),
        refopenAPI.getBulkReferenceMetadata(['JobType', 'WorkplaceType']).catch(() => ({ success: false })),
      ]);

      if (recRes.success) setRecommendedJobs((recRes.data || []).slice(0, 6));
      if (f500Res.success) setTopMncJobs((f500Res.data || []).slice(0, 6));
      if (recentRes.success) setRecentJobs((recentRes.data || []).slice(0, 6));
      if (refRes?.success && refRes.data) {
        if (refRes.data.JobType) {
          setJobTypes(refRes.data.JobType.map(item => ({ JobTypeID: item.ReferenceID, Type: item.Value })));
        }
        if (refRes.data.WorkplaceType) {
          setWorkplaceTypes(refRes.data.WorkplaceType.map(item => ({ WorkplaceTypeID: item.ReferenceID, Type: item.Value })));
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

  if (loading) {
    return (
      <View style={styles.container}>
        <TabHeader title="Jobs" centerContent={null} gradient={null} showMessages={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading jobs...</Text>
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
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

      {/* Quick filter chips — open filter dropdown on JobsScreen */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
        {[
          { label: 'AI Jobs', icon: 'bulb-outline', action: 'ai' },
          { label: 'JobType', icon: 'chevron-down', filterSection: 'jobType' },
          { label: 'Workplace', icon: 'chevron-down', filterSection: 'workMode' },
          { label: 'Location', icon: 'chevron-down', filterSection: 'location' },
          { label: 'Freshness', icon: 'chevron-down', filterSection: 'postedBy' },
          { label: 'Company', icon: 'chevron-down', filterSection: 'company' },
          { label: 'Referrer Jobs', icon: 'people-outline', action: 'referrer' },
        ].map(chip => (
          <TouchableOpacity
            key={chip.label}
            style={[styles.chip, { backgroundColor: colors.gray100 || colors.background, borderColor: colors.border }]}
            onPress={() => {
              if (chip.action === 'ai') {
                navigation.navigate('AIRecommendedJobs');
              } else if (chip.action === 'referrer') {
                navigation.navigate('JobsList', { screenTitle: 'Referrer Jobs' });
              } else {
                navigation.navigate('JobsList', { openFilterSection: chip.filterSection, screenTitle: 'Browse Jobs' });
              }
            }}
          >
            <Text style={[styles.chipText, { color: colors.text }]}>{chip.label}</Text>
            <Ionicons name={chip.icon} size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
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
            onPress={() => navigation.navigate('JobsList', { openFilterSection: null, screenTitle: 'Browse Jobs' })}
          >
            <Ionicons name="options-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        }
      />
      
      <DesktopLayout>
        {mainContent}
      </DesktopLayout>
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
      marginBottom: isMobile ? 16 : 24,
      backgroundColor: colors.surface,
      borderRadius: isDesktopWeb ? 12 : 8,
      padding: isMobile ? 12 : 20,
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
        gridTemplateColumns: isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
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
