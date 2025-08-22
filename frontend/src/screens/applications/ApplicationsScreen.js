import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import nexhireAPI from '../../services/api';
import { colors, typography } from '../../styles/theme';

export default function ApplicationsScreen({ navigation }) {
  const { isEmployer, isJobSeeker } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    fetchApplications();
  }, [],);

  const fetchApplications = async (resetPage = false) => {
    try {
      const currentPage = resetPage ? 1 : pagination.page;
      setLoading(resetPage);

      let result;
      if (isJobSeeker) {
        // Get job seeker's own applications
        result = await nexhireAPI.getMyApplications(currentPage, pagination.pageSize);
      } else {
        // For employers, we'd need to get applications for their jobs
        // This would require a different API call or job-specific applications
        result = { success: true, data: [], meta: { total: 0, totalPages: 0 } };
      }

      if (result.success) {
        const newApplications = resetPage ? result.data : [...applications, ...result.data];
        setApplications(newApplications);
        
        if (result.meta) {
          setPagination({
            page: result.meta.page || currentPage,
            pageSize: result.meta.pageSize || pagination.pageSize,
            total: result.meta.total || 0,
            totalPages: result.meta.totalPages || 0,
          });
        }
      } else {
        console.error('Failed to fetch applications:', result.error);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchApplications(true);
  };

  const loadMoreApplications = () => {
    if (!loading && pagination.page < pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
      fetchApplications(false);
    }
  };

  const getStatusColor = (statusId) => {
    // Map status IDs to colors based on typical application statuses
    switch (statusId) {
      case 1: // Submitted/Pending
        return colors.warning;
      case 2: // Under Review
        return colors.primary;
      case 3: // Interview Scheduled
        return colors.info;
      case 4: // Offer Extended
        return colors.success;
      case 5: // Hired
        return colors.success;
      case 6: // Rejected
        return colors.danger;
      default:
        return colors.gray500;
    }
  };

  const getStatusText = (statusId) => {
    switch (statusId) {
      case 1:
        return 'Submitted';
      case 2:
        return 'Under Review';
      case 3:
        return 'Interview';
      case 4:
        return 'Offer Extended';
      case 5:
        return 'Hired';
      case 6:
        return 'Rejected';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date not available';
    return new Date(dateString).toLocaleDateString();
  };

  const formatSalary = (amount, currencyCode = 'USD') => {
    if (!amount) return 'Not specified';
    return `$${amount.toLocaleString()} ${currencyCode}`;
  };

  const ApplicationCard = ({ application }) => (
    <TouchableOpacity 
      style={styles.applicationCard}
      onPress={() => {
        // Navigate to job details or application details
        if (application.JobID) {
          navigation.navigate('JobDetails', { jobId: application.JobID });
        }
      }}
    >
      <View style={styles.applicationHeader}>
        <Text style={styles.jobTitle} numberOfLines={2}>
          {application.JobTitle || `Job ID: ${application.JobID}`}
        </Text>
        <View style={[
          styles.statusBadge, 
          { backgroundColor: getStatusColor(application.StatusID) + '20' }
        ]}>
          <Text style={[
            styles.statusText, 
            { color: getStatusColor(application.StatusID) }
          ]}>
            {getStatusText(application.StatusID)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.companyName}>
        {application.CompanyName || 'Company Name'}
      </Text>
      
      <View style={styles.applicationDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar" size={16} color={colors.gray500} />
          <Text style={styles.detailText}>
            Applied: {formatDate(application.SubmittedAt)}
          </Text>
        </View>
        
        {application.ExpectedSalary && (
          <View style={styles.detailItem}>
            <Ionicons name="cash" size={16} color={colors.gray500} />
            <Text style={styles.detailText}>
              Expected: {formatSalary(application.ExpectedSalary, application.CurrencyCode)}
            </Text>
          </View>
        )}

        {application.AvailableFromDate && (
          <View style={styles.detailItem}>
            <Ionicons name="time" size={16} color={colors.gray500} />
            <Text style={styles.detailText}>
              Available: {formatDate(application.AvailableFromDate)}
            </Text>
          </View>
        )}
      </View>

      {application.CoverLetter && (
        <Text style={styles.coverLetterPreview} numberOfLines={2}>
          {application.CoverLetter}
        </Text>
      )}

      <View style={styles.applicationActions}>
        {application.StatusID === 1 && ( // If pending, allow withdrawal
          <TouchableOpacity style={styles.withdrawButton}>
            <Text style={styles.withdrawButtonText}>Withdraw</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.viewButton}>
          <Text style={styles.viewButtonText}>View Details</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons 
        name={isEmployer ? "people-outline" : "document-text-outline"} 
        size={64} 
        color={colors.gray400} 
      />
      <Text style={styles.emptyStateTitle}>
        {isEmployer ? 'No Applications Yet' : 'No Applications Found'}
      </Text>
      <Text style={styles.emptyStateText}>
        {isEmployer 
          ? 'Applications will appear here when candidates apply to your jobs.'
          : 'Start applying to jobs to track your applications here.'
        }
      </Text>
      {!isEmployer && (
        <TouchableOpacity 
          style={styles.browseJobsButton}
          onPress={() => {
            // Navigate to jobs screen
            navigation.navigate('Jobs');
          }}
        >
          <Text style={styles.browseJobsButtonText}>Browse Jobs</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const LoadingFooter = () => (
    loading && pagination.page > 1 ? (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading more applications...</Text>
      </View>
    ) : null
  );

  if (loading && pagination.page === 1) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading applications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isEmployer ? 'Job Applications' : 'My Applications'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {pagination.total} {pagination.total === 1 ? 'application' : 'applications'}
        </Text>
      </View>

      {/* Applications List */}
      <FlatList
        data={applications}
        renderItem={({ item }) => <ApplicationCard application={item} />}
        keyExtractor={(item) => item.ApplicationID}
        contentContainerStyle={applications.length === 0 ? styles.emptyContainer : styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMoreApplications}
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
  header: {
    padding: 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
  },
  applicationCard: {
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
  applicationHeader: {
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  companyName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.gray700,
    marginBottom: 12,
  },
  applicationDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginLeft: 6,
  },
  coverLetterPreview: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 18,
  },
  applicationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  withdrawButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  withdrawButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    fontWeight: typography.weights.medium,
  },
  viewButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  viewButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.white,
    fontWeight: typography.weights.medium,
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
  browseJobsButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  browseJobsButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});