import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import nexhireAPI from '../../services/api';
import { colors, typography } from '../../styles/theme';

export default function JobsScreen({ navigation }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    location: '',
    jobType: '',
    experienceLevel: '',
    isRemote: null,
    salaryMin: '',
    salaryMax: '',
  });

  useEffect(() => {
    fetchJobs(true);
  }, []);

  const fetchJobs = async (resetPage = false) => {
    try {
      const currentPage = resetPage ? 1 : pagination.page;
      setLoading(resetPage);

      let result;
      
      if (searchQuery.trim()) {
        // Use search API when there's a search query
        result = await nexhireAPI.searchJobs(searchQuery, {
          page: currentPage,
          pageSize: pagination.pageSize,
          ...filters,
        });
      } else {
        // Use regular jobs API for browsing
        result = await nexhireAPI.getJobs(currentPage, pagination.pageSize, filters);
      }

      if (result.success) {
        const newJobs = resetPage ? result.data : [...jobs, ...result.data];
        setJobs(newJobs);
        
        if (result.meta) {
          setPagination({
            page: result.meta.page || currentPage,
            pageSize: result.meta.pageSize || pagination.pageSize,
            total: result.meta.total || 0,
            totalPages: result.meta.totalPages || 0,
          });
        }
      } else {
        console.error('Failed to fetch jobs:', result.error);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchJobs(true);
  };

  const loadMoreJobs = () => {
    if (!loading && pagination.page < pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
      fetchJobs(false);
    }
  };

  const handleSearch = () => {
    fetchJobs(true);
  };

  const formatSalary = (job) => {
    if (job.SalaryRangeMin && job.SalaryRangeMax) {
      const currency = job.CurrencyCode || 'USD';
      const period = job.SalaryPeriod || 'Annual';
      return `$${job.SalaryRangeMin?.toLocaleString()} - $${job.SalaryRangeMax?.toLocaleString()} ${currency} ${period}`;
    }
    return 'Salary not specified';
  };

  const formatLocation = (job) => {
    const locationParts = [];
    if (job.City) locationParts.push(job.City);
    if (job.State) locationParts.push(job.State);
    if (job.Country) locationParts.push(job.Country);
    
    let location = locationParts.join(', ') || job.Location || 'Location not specified';
    
    if (job.IsRemote) {
      location += ' (Remote)';
    } else if (job.WorkplaceType) {
      location += ` (${job.WorkplaceType})`;
    }
    
    return location;
  };

  const formatPostedDate = (dateString) => {
    if (!dateString) return 'Recently posted';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just posted';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks} weeks ago`;
    
    return date.toLocaleDateString();
  };

  const JobCard = ({ job }) => (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() => navigation.navigate('JobDetails', { jobId: job.JobID })}
    >
      <View style={styles.jobHeader}>
        <Text style={styles.jobTitle} numberOfLines={2}>
          {job.Title}
        </Text>
        <Text style={styles.jobSalary}>
          {formatSalary(job)}
        </Text>
      </View>
      
      <Text style={styles.jobCompany}>
        {job.OrganizationName || 'Company Name'}
      </Text>
      
      <Text style={styles.jobLocation}>
        {formatLocation(job)}
      </Text>
      
      <Text style={styles.jobDescription} numberOfLines={2}>
        {job.Description || 'Job description not available'}
      </Text>
      
      <View style={styles.jobFooter}>
        <View style={styles.jobTags}>
          <Text style={styles.jobType}>
            {job.JobTypeName || job.JobType || 'Full-time'}
          </Text>
          {job.ExperienceLevel && (
            <Text style={styles.experienceLevel}>
              {job.ExperienceLevel}
            </Text>
          )}
          {job.IsRemote && (
            <Text style={styles.remoteTag}>Remote</Text>
          )}
        </View>
        <Text style={styles.jobPosted}>
          {formatPostedDate(job.CreatedAt || job.PublishedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="briefcase-outline" size={64} color={colors.gray400} />
      <Text style={styles.emptyStateTitle}>
        {searchQuery ? 'No Jobs Found' : 'No Jobs Available'}
      </Text>
      <Text style={styles.emptyStateText}>
        {searchQuery 
          ? 'Try adjusting your search criteria or check back later for new opportunities.'
          : 'New job opportunities will appear here. Check back soon!'
        }
      </Text>
      {searchQuery && (
        <TouchableOpacity
          style={styles.clearSearchButton}
          onPress={() => {
            setSearchQuery('');
            fetchJobs(true);
          }}
        >
          <Text style={styles.clearSearchText}>Clear Search</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const LoadingFooter = () => (
    loading && pagination.page > 1 ? (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading more jobs...</Text>
      </View>
    ) : null
  );

  if (loading && pagination.page === 1) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading jobs...</Text>
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
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                fetchJobs(true);
              }}
            >
              <Ionicons name="close-circle" size={20} color={colors.gray400} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => {
            // TODO: Implement filter modal
            console.log('Filter button pressed');
          }}
        >
          <Ionicons name="options" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Results Summary */}
      {pagination.total > 0 && (
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryText}>
            {searchQuery 
              ? `${pagination.total} jobs found for "${searchQuery}"`
              : `${pagination.total} jobs available`
            }
          </Text>
        </View>
      )}

      <FlatList
        data={jobs}
        renderItem={({ item }) => <JobCard job={item} />}
        keyExtractor={(item) => item.JobID}
        contentContainerStyle={jobs.length === 0 ? styles.emptyContainer : styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMoreJobs}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={<EmptyState />}
        ListFooterComponent={<LoadingFooter />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 8,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
  },
  jobCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  jobTitle: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginRight: 12,
  },
  jobSalary: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  jobCompany: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.gray700,
    marginBottom: 4,
  },
  jobLocation: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 8,
  },
  jobDescription: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    lineHeight: 20,
    marginBottom: 12,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobTags: {
    flexDirection: 'row',
    gap: 8,
  },
  jobType: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  experienceLevel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.success,
    backgroundColor: colors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  remoteTag: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.warning,
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  jobPosted: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  clearSearchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearSearchText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});