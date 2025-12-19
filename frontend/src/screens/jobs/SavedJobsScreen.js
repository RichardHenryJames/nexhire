import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import JobCard from '../../components/jobs/JobCard';
import refopenAPI from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

const SavedJobsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [savedIds, setSavedIds] = useState(new Set());

  // Load saved jobs
  const loadSavedJobs = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const response = await refopenAPI.getMySavedJobs(1, 500);
      if (response?.success) {
        const jobs = response.data || [];
        setSavedJobs(jobs);
        setSavedCount(Number(response.meta?.total || jobs.length || 0));
        
        // Update saved IDs set
        const ids = new Set(jobs.map(j => j.JobID));
        setSavedIds(ids);
      }
    } catch (error) {
      console.error('Error loading saved jobs:', error);
      Alert.alert('Error', 'Failed to load saved jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadSavedJobs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update navigation header with count
  useEffect(() => {
    navigation.setOptions({
      headerTitle: savedCount > 0 ? `Saved Jobs (${savedCount})` : 'Saved Jobs',
    });
  }, [savedCount, navigation]);

  // ✅ Smart back navigation (hard-refresh safe) - same as JobDetails/Applications
  // Also set header style for dark mode support
  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: colors.surface,
      },
      headerTintColor: colors.text,
      headerTitleStyle: {
        color: colors.text,
      },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            const navState = navigation.getState?.();
            const routes = navState?.routes || [];
            const currentIndex = navState?.index || 0;

            if (routes.length > 1 && currentIndex > 0) {
              navigation.goBack();
            } else {
              navigation.navigate('Main', {
                screen: 'MainTabs',
                params: { screen: 'Profile' },
              });
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  // Refresh handler
  const onRefresh = () => {
    setRefreshing(true);
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
        Alert.alert('Success', 'Job removed from saved');
      } else {
        Alert.alert('Error', response.error || 'Failed to remove job from saved');
      }
    } catch (error) {
      console.error('Unsave error:', error);
      Alert.alert('Error', error.message || 'Failed to remove job from saved');
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
      />
    );
  }, [handleJobPress, handleUnsave]);

  // Empty state
  const renderEmptyState = () => {
    if (loading) return null;
    
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

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading saved jobs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
      />
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
