import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import JobCard from '../../components/jobs/JobCard';
import refopenAPI from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import { useAuth } from '../../contexts/AuthContext';
import useResponsive from '../../hooks/useResponsive';
import { showToast } from '../../components/Toast';
import { invalidateCache, CACHE_KEYS } from '../../utils/homeCache';

const SavedJobsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [savedIds, setSavedIds] = useState(new Set());
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, hasMore: true });
  const isLoadingMoreRef = useRef(false);

  // Load saved jobs (page 1 — fresh load)
  const loadSavedJobs = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const response = await refopenAPI.getMySavedJobs(1, pagination.pageSize);
      if (response?.success) {
        const jobs = response.data || [];
        setSavedJobs(jobs);
        const total = Number(response.meta?.total || jobs.length || 0);
        setSavedCount(total);
        const hasMore = jobs.length === pagination.pageSize && jobs.length < total;
        setPagination(prev => ({ ...prev, page: 1, hasMore }));
        
        // Update saved IDs set
        const ids = new Set(jobs.map(j => j.JobID));
        setSavedIds(ids);
      }
    } catch (error) {
      console.error('Error loading saved jobs:', error);
      showToast('Failed to load saved jobs', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load more saved jobs (next page)
  const loadMoreSavedJobs = useCallback(async () => {
    if (loading || loadingMore || !pagination.hasMore) return;
    if (isLoadingMoreRef.current) return;

    const nextPage = pagination.page + 1;
    try {
      isLoadingMoreRef.current = true;
      setLoadingMore(true);
      const response = await refopenAPI.getMySavedJobs(nextPage, pagination.pageSize);
      if (response?.success) {
        const newJobs = response.data || [];
        if (newJobs.length > 0) {
          setSavedJobs(prev => [...prev, ...newJobs]);
          // Update saved IDs
          setSavedIds(prev => {
            const newSet = new Set(prev);
            newJobs.forEach(j => newSet.add(j.JobID));
            return newSet;
          });
        }
        const total = Number(response.meta?.total || 0);
        const hasMore = newJobs.length === pagination.pageSize;
        setPagination(prev => ({ ...prev, page: nextPage, hasMore }));
      }
    } catch (error) {
      console.error('Error loading more saved jobs:', error);
    } finally {
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  }, [loading, loadingMore, pagination]);

  // Infinite scroll handler (same pattern as JobsScreen)
  const onScrollNearEnd = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent || {};
    if (!contentOffset || !contentSize || !layoutMeasurement) return;
    if (loading || loadingMore || !pagination.hasMore) return;
    const threshold = 160;
    const isNearEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - threshold;
    if (isNearEnd) {
      loadMoreSavedJobs();
    }
  }, [loading, loadingMore, pagination.hasMore, loadMoreSavedJobs]);

  // Auto-load more if content doesn't fill the viewport
  const onContentSizeChange = useCallback((w, h) => {
    if (loading || loadingMore || !pagination.hasMore) return;
    // If content height is small, auto-load next page
    if (h > 0 && h < 800 && savedJobs.length > 0) {
      loadMoreSavedJobs();
    }
  }, [loading, loadingMore, pagination.hasMore, savedJobs.length, loadMoreSavedJobs]);

  // Initial load
  useEffect(() => {
    loadSavedJobs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh handler
  const onRefresh = () => {
    setRefreshing(true);
    setPagination(prev => ({ ...prev, page: 1, hasMore: true }));
    loadSavedJobs(false);
  };

  // Remove saved job locally
  const removeSavedJobLocally = useCallback((jobId) => {
    setSavedJobs(prev => prev.filter(j => j.JobID !== jobId));
    setSavedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(jobId);
      return newSet;
    });
    setSavedCount(prev => Math.max(0, prev - 1));
  }, []);

  // Handle unsave
  const handleUnsave = useCallback(async (job) => {
    if (!job) return;
    const id = job.JobID || job.id;
    
    try {
      const response = await refopenAPI.unsaveJob(id);
      if (response?.success) {
        removeSavedJobLocally(id);
        // Show success message
        showToast('Job removed from saved', 'success');
        invalidateCache(CACHE_KEYS.JOBS_SAVED_IDS);
      } else {
        showToast('Failed to remove job from saved. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Unsave error:', error);
      showToast('Failed to remove job from saved. Please try again.', 'error');
    }
  }, [removeSavedJobLocally]);

  // Handle job card press
  const handleJobPress = useCallback((job) => {
    navigation.navigate('JobDetails', {
      jobId: job.JobID,
      job,
      onGoBack: () => loadSavedJobs(false),
    });
  }, [navigation]); // Removed loadSavedJobs from dependencies

  // Render job card
  const renderJobCard = useCallback(({ item }) => {
    return (
      <JobCard
        job={item}
        onPress={() => handleJobPress(item)}
        savedContext={true}
        onSave={() => {}}
        onUnsave={() => {
          handleUnsave(item);
        }}
        currentUserId={user?.UserID}
      />
    );
  }, [handleJobPress, handleUnsave, user?.UserID]);

  // Empty state
  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading saved jobs...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bookmark-outline" size={64} color={colors.gray400} />
        <Text style={styles.emptyTitle}>
          No saved jobs yet
        </Text>
        <Text style={styles.emptySubtitle}>
          Start saving jobs you're interested in to view them here
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Jobs')}
          style={styles.browseButton}
        >
          <Text style={styles.browseButtonText}>
            Browse Jobs
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title={savedCount > 0 ? `Saved Jobs (${savedCount})` : 'Saved Jobs'} fallbackTab="Jobs" />
      <View style={styles.innerContainer}>
        {/* Job list */}
        <FlatList
          data={savedJobs}
          renderItem={renderJobCard}
          keyExtractor={(item) => `saved-${item.JobID}`}
          contentContainerStyle={savedJobs.length === 0 ? { flex: 1 } : { paddingBottom: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={renderEmptyState}
          onScroll={onScrollNearEnd}
          scrollEventThrottle={16}
          onContentSizeChange={onContentSizeChange}
          windowSize={7}
          maxToRenderPerBatch={5}
          initialNumToRender={10}
          removeClippedSubviews={Platform.OS !== 'web'}
          ListFooterComponent={loadingMore ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: 14 }}>Loading more jobs...</Text>
            </View>
          ) : null}
        />
      </View>
    </View>
  );
};

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  innerContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 900 : '100%',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.gray500,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
  browseButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SavedJobsScreen;
