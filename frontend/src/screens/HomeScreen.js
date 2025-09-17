import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import nexhireAPI from '../services/api';
import { colors, typography } from '../styles/theme';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const { user, isEmployer, isJobSeeker } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    // Enhanced stats from backend
    stats: {},
    recentJobs: [],
    recentApplications: [],
    referralStats: {}
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch comprehensive dashboard data
      const [dashboardRes, recentJobsRes, applicationsRes, referralRes] = await Promise.all([
        nexhireAPI.apiCall('/users/dashboard-stats').catch(() => ({ success: false, data: {} })),
        nexhireAPI.getJobs(1, 5).catch(() => ({ success: false, data: [] })),
        isJobSeeker ? nexhireAPI.getMyApplications(1, 3).catch(() => ({ success: false, data: [] })) : Promise.resolve({ success: false, data: [] }),
        nexhireAPI.getReferralAnalytics().catch(() => ({ success: false, data: {} })),
      ]);

      // Process dashboard stats
      const stats = dashboardRes.success ? dashboardRes.data : {};
      
      // Process recent jobs
      const recentJobs = recentJobsRes.success ? recentJobsRes.data.slice(0, 5) : [];
      
      // Process recent applications
      const recentApplications = (isJobSeeker && applicationsRes.success) ? applicationsRes.data.slice(0, 3) : [];
      
      // Process referral analytics
      const referralStats = referralRes.success ? referralRes.data : {};

      setDashboardData({
        stats,
        recentJobs,
        recentApplications,
        referralStats
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isJobSeeker]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDashboardData();
    });

    return unsubscribe;
  }, [navigation, fetchDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  // Enhanced StatCard with trends and better styling
  const StatCard = ({ title, value, icon, color = colors.primary, subtitle, trend, onPress, size = 'normal' }) => {
    const isLarge = size === 'large';
    
    return (
      <TouchableOpacity 
        style={[
          styles.statCard, 
          { borderLeftColor: color },
          isLarge && styles.statCardLarge
        ]}
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={styles.statContent}>
          <View style={styles.statHeader}>
            <Ionicons name={icon} size={isLarge ? 32 : 24} color={color} />
            <View style={styles.statValueContainer}>
              <Text style={[styles.statValue, isLarge && styles.statValueLarge]}>{value}</Text>
              {trend && (
                <View style={[styles.trendContainer, { backgroundColor: trend.positive ? colors.success + '20' : colors.danger + '20' }]}>
                  <Ionicons 
                    name={trend.positive ? 'trending-up' : 'trending-down'} 
                    size={12} 
                    color={trend.positive ? colors.success : colors.danger} 
                  />
                  <Text style={[styles.trendText, { color: trend.positive ? colors.success : colors.danger }]}>
                    {trend.value}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.statTitle, isLarge && styles.statTitleLarge]}>{title}</Text>
          {subtitle && (
            <Text style={styles.statSubtitle}>{subtitle}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Enhanced QuickAction with better styling
  const QuickAction = ({ title, description, icon, onPress, color = colors.primary, badge, urgent = false }) => (
    <TouchableOpacity 
      style={[styles.actionCard, urgent && styles.actionCardUrgent]} 
      onPress={onPress}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + '20' }]}
      >
        <Ionicons name={icon} size={24} color={color} />
        {badge && (
          <View style={[styles.actionBadge, urgent && styles.actionBadgeUrgent]}>
            <Text style={styles.actionBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <View style={styles.actionContent}>
        <Text style={[styles.actionTitle, urgent && styles.actionTitleUrgent]}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
    </TouchableOpacity>
  );

  // Performance metrics component
  const PerformanceMetrics = () => {
    if (!isJobSeeker) return null;

    const { stats } = dashboardData;
    const successRate = stats.applicationSuccessRate || 0;
    const responseTime = stats.averageResponseTime || 0;
    
    return (
      <View style={styles.performanceContainer}>
        <Text style={styles.sectionTitle}>Performance Insights</Text>
        <View style={styles.performanceGrid}>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceValue}>{successRate.toFixed(1)}%</Text>
            <Text style={styles.performanceLabel}>Success Rate</Text>
            <View style={[styles.performanceBar, { width: `${Math.min(successRate, 100)}%` }]} />
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceValue}>{responseTime.toFixed(1)}</Text>
            <Text style={styles.performanceLabel}>Avg Response (days)</Text>
          </View>
        </View>
      </View>
    );
  };

  // Attention items component
  const AttentionItems = () => {
    const { stats } = dashboardData;
    const needsAttention = stats.summary?.needsAttention || [];
    
    if (needsAttention.length === 0) return null;

    return (
      <View style={styles.attentionContainer}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="alert-circle" size={16} color={colors.warning} /> Needs Attention
        </Text>
        {needsAttention.slice(0, 3).map((item, index) => (
          <View key={index} style={styles.attentionItem}>
            <Ionicons name="chevron-forward" size={16} color={colors.warning} />
            <Text style={styles.attentionText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  };

  const JobCard = ({ job }) => {
    const formatDate = (job) => {
      // Use same date field priority as the actual API response and JobCard component
      const dateString = job.PublishedAt || job.CreatedAt || job.UpdatedAt;
      
      if (!dateString) return 'Recently posted';
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Recently posted';
      
      const now = new Date();
      const hours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (hours < 1) return 'Just posted';
      if (hours < 24) return `${hours} hours ago`;
      
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days} days ago`;
      
      const weeks = Math.floor(days / 7);
      if (weeks < 4) return `${weeks} weeks ago`;
      
      return date.toLocaleDateString();
    };

    return (
      <TouchableOpacity
        style={styles.jobCard}
        onPress={() => navigation.navigate('JobDetails', { jobId: job.JobID })}
      >
        <View style={styles.jobHeader}>
          <Text style={styles.jobTitle} numberOfLines={1}>
            {job.Title}
          </Text>
          <Text style={styles.jobCompany}>{job.OrganizationName}</Text>
        </View>
        <Text style={styles.jobLocation}>{job.Location}</Text>
        <View style={styles.jobMeta}>
          <View style={styles.jobTypeTag}>
            <Text style={styles.jobTypeText}>{job.JobTypeName}</Text>
          </View>
          <Text style={styles.jobDate}>
            {formatDate(job)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ApplicationCard = ({ application }) => (
    <TouchableOpacity
      style={styles.applicationCard}
      onPress={() => navigation.navigate('Applications')}
    >
      <View style={styles.applicationHeader}>
        <Text style={styles.applicationTitle} numberOfLines={1}>
          {application.JobTitle}
        </Text>
        <View style={[
          styles.applicationStatus,
          { backgroundColor: getStatusColor(application.StatusID) + '20' }
        ]}>
          <Text style={[
            styles.applicationStatusText,
            { color: getStatusColor(application.StatusID) }
          ]}>
            {getStatusText(application.StatusID)}
          </Text>
        </View>
      </View>
      <Text style={styles.applicationCompany}>{application.CompanyName}</Text>
      <Text style={styles.applicationDate}>
        Applied {new Date(application.SubmittedAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  const getStatusColor = (statusId) => {
    switch (statusId) {
      case 1: return colors.warning;
      case 2: return colors.primary;
      case 3: return colors.info;
      case 4: return colors.success;
      case 5: return colors.success;
      case 6: return colors.danger;
      default: return colors.gray500;
    }
  };

  const getStatusText = (statusId) => {
    switch (statusId) {
      case 1: return 'Pending';
      case 2: return 'Under Review';
      case 3: return 'Interview';
      case 4: return 'Offer Extended';
      case 5: return 'Hired';
      case 6: return 'Rejected';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your personalized dashboard...</Text>
      </View>
    );
  }

  const { stats, recentJobs, recentApplications, referralStats } = dashboardData;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Enhanced Header with user context */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Welcome back, {user?.FirstName || user?.firstName || 'User'}!
        </Text>
        <Text style={styles.subGreeting}>
          {isEmployer ? 'Manage your team and hiring pipeline' : 'Advance your career journey'}
        </Text>
        {stats.summary && (
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryText}>
              {isEmployer 
                ? `Hiring velocity: ${stats.summary.hiringVelocity || 'Unknown'}`
                : `Profile strength: ${stats.summary.profileStrength || 'Unknown'}`
              }
            </Text>
          </View>
        )}
      </View>

      {/* Primary Stats Overview */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          {isEmployer ? (
            <>
              <StatCard
                title="Active Jobs"
                value={stats.activeJobs || 0}
                icon="briefcase"
                color={colors.primary}
                subtitle={`${stats.totalJobsPosted || 0} total • ${stats.draftJobs || 0} drafts`}
                trend={stats.jobsPostedLast30Days > 0 ? { positive: true, value: `+${stats.jobsPostedLast30Days}` } : null}
                onPress={() => navigation.navigate('Jobs')}
                size="large"
              />
              <StatCard
                title="Applications"
                value={stats.totalApplicationsReceived || 0}
                icon="document-text"
                color={colors.success}
                subtitle={`${stats.pendingApplications || 0} pending review`}
                trend={stats.applicationsReceivedLast30Days > 0 ? { positive: true, value: `+${stats.applicationsReceivedLast30Days}` } : null}
                onPress={() => navigation.navigate('Applications')}
              />
              <StatCard
                title="Success Rate"
                value={`${(stats.hiringSuccessRate || 0).toFixed(1)}%`}
                icon="trophy"
                color={colors.warning}
                subtitle={`${stats.offersExtended || 0} offers extended`}
                onPress={() => navigation.navigate('Analytics')}
              />
            </>
          ) : (
            <>
              <StatCard
                title="Applications"
                value={stats.totalApplications || 0}
                icon="document-text"
                color={colors.primary}
                subtitle={`${stats.shortlistedApplications || 0} shortlisted • ${stats.interviewsScheduled || 0} interviews`}
                trend={stats.applicationsLast30Days > 0 ? { positive: true, value: `+${stats.applicationsLast30Days}` } : null}
                onPress={() => navigation.navigate('Applications')}
                size="large"
              />
              <StatCard
                title="Profile Score"
                value={`${stats.profileCompleteness || 0}%`}
                icon="person"
                color={stats.profileCompleteness >= 80 ? colors.success : colors.warning}
                subtitle={`${stats.profileViews || 0} profile views`}
                onPress={() => navigation.navigate('Profile')}
              />
              <StatCard
                title="Referral Points"
                value={referralStats.totalPointsEarned || stats.totalReferralPoints || 0}
                icon="star"
                color={colors.info}
                subtitle={`${stats.referralRequestsMade || 0} requests • ${stats.completedReferrals || 0} completed`}
                onPress={() => navigation.navigate('Referrals')}
              />
            </>
          )}
        </View>
      </View>

      {/* Performance Metrics for Job Seekers */}
      <PerformanceMetrics />

      {/* Attention Items */}
      <AttentionItems />

      {/* Quick Actions with Enhanced Urgency */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        {isEmployer ? (
          <>
            <QuickAction
              title="Post a New Job"
              description="Create and publish a job posting"
              icon="add-circle"
              color={colors.primary}
              onPress={() => navigation.navigate('CreateJob')}
            />
            <QuickAction
              title="Review Applications"
              description="Manage candidate applications"
              icon="people"
              color={colors.success}
              badge={stats.pendingApplications > 0 ? stats.pendingApplications : null}
              urgent={stats.pendingApplications > 10}
              onPress={() => navigation.navigate('Applications')}
            />
            <QuickAction
              title="Hiring Pipeline"
              description="Track your recruitment progress"
              icon="analytics"
              color={colors.info}
              badge={stats.interviewsInProgress > 0 ? `${stats.interviewsInProgress} active` : null}
              onPress={() => navigation.navigate('Analytics')}
            />
            <QuickAction
              title="Referral Network"
              description="Leverage employee referrals"
              icon="link"
              color={colors.warning}
              badge={stats.referralNetwork?.referralsForMyJobs > 0 ? stats.referralNetwork.referralsForMyJobs : null}
              onPress={() => navigation.navigate('Referrals')}
            />
          </>
        ) : (
          <>
            <QuickAction
              title="Browse Jobs"
              description="Discover new opportunities"
              icon="search"
              color={colors.primary}
              onPress={() => navigation.navigate('Jobs')}
            />
            <QuickAction
              title="My Applications"
              description="Track your job applications"
              icon="document-text"
              color={colors.success}
              badge={stats.pendingApplications > 0 ? stats.pendingApplications : null}
              urgent={stats.pendingApplications > 5}
              onPress={() => navigation.navigate('Applications')}
            />
            <QuickAction
              title="Complete Profile"
              description="Improve your profile to stand out"
              icon="person"
              color={stats.profileCompleteness >= 80 ? colors.success : colors.warning}
              badge={stats.profileCompleteness < 80 ? `${100 - (stats.profileCompleteness || 0)}%` : null}
              urgent={stats.profileCompleteness < 60}
              onPress={() => navigation.navigate('Profile')}
            />
            <QuickAction
              title="Get Referrals"
              description="Ask for job referrals from your network"
              icon="people"
              color={colors.info}
              badge={referralStats.dailyQuotaRemaining > 0 ? `${referralStats.dailyQuotaRemaining} left` : null}
              onPress={() => navigation.navigate('Referrals')}
            />
          </>
        )}
      </View>

      {/* Recent Jobs Section */}
      {recentJobs.length > 0 && (
        <View style={styles.recentContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Jobs</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Jobs')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {recentJobs.map((job, index) => (
              <JobCard key={job.JobID || index} job={job} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Recent Applications (Job Seekers only) */}
      {isJobSeeker && recentApplications.length > 0 && (
        <View style={styles.recentContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Applications</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Applications')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentApplications.map((application, index) => (
            <ApplicationCard key={application.ApplicationID || index} application={application} />
          ))}
        </View>
      )}

      {/* Recent Activity Timeline for Employers */}
      {isEmployer && stats.topPerformingJobs && stats.topPerformingJobs.length > 0 && (
        <View style={styles.recentContainer}>
          <Text style={styles.sectionTitle}>Top Performing Jobs</Text>
          {stats.topPerformingJobs.slice(0, 3).map((job, index) => (
            <TouchableOpacity 
              key={job.JobID || index} 
              style={styles.performingJobCard}
              onPress={() => navigation.navigate('JobDetails', { jobId: job.JobID })}
            >
              <View style={styles.performingJobHeader}>
                <Text style={styles.performingJobTitle}>{job.Title}</Text>
                <Text style={styles.performingJobApps}>{job.ApplicationCount} apps</Text>
              </View>
              <View style={styles.performingJobStats}>
                <Text style={styles.performingJobStat}>{job.ShortlistedCount} shortlisted</Text>
                <Text style={styles.performingJobStat}>{job.HiredCount} hired</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Enhanced Empty State */}
      {recentJobs.length === 0 && recentApplications.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons 
            name={isEmployer ? "briefcase-outline" : "search-outline"} 
            size={64} 
            color={colors.gray400} 
          />
          <Text style={styles.emptyStateTitle}>
            {isEmployer ? 'Start Building Your Dream Team' : 'Begin Your Career Journey'}
          </Text>
          <Text style={styles.emptyStateText}>
            {isEmployer 
              ? 'Post your first job to discover talented candidates and grow your team'
              : 'Explore opportunities that match your skills and career aspirations'
            }
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => navigation.navigate(isEmployer ? 'CreateJob' : 'Jobs')}
          >
            <Text style={styles.emptyStateButtonText}>
              {isEmployer ? 'Post Your First Job' : 'Explore Jobs'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: colors.primary,
  },
  greeting: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: typography.sizes.md,
    color: colors.white + 'CC',
    marginBottom: 12,
  },
  summaryBadge: {
    backgroundColor: colors.white + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  summaryText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  statsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  statsGrid: {
    gap: 12,
  },
  statCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statCardLarge: {
    padding: 20,
    borderLeftWidth: 6,
  },
  statContent: {
    flex: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statValueContainer: {
    alignItems: 'flex-end',
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statValueLarge: {
    fontSize: typography.sizes.xxl,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  trendText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginLeft: 2,
  },
  statTitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    fontWeight: typography.weights.medium,
  },
  statTitleLarge: {
    fontSize: typography.sizes.md,
  },
  statSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    marginTop: 2,
  },
  performanceContainer: {
    padding: 20,
    paddingTop: 0,
  },
  performanceGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  performanceCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  performanceValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  performanceLabel: {
    fontSize: typography.sizes.xs,
    color: colors.gray600,
    marginTop: 4,
  },
  performanceBar: {
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  attentionContainer: {
    padding: 20,
    paddingTop: 0,
  },
  attentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '10',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  attentionText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginLeft: 8,
    flex: 1,
  },
  actionsContainer: {
    padding: 20,
    paddingTop: 0,
  },
  actionCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
  actionCardUrgent: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    backgroundColor: colors.danger + '05',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
  },
  actionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  actionBadgeUrgent: {
    backgroundColor: colors.warning,
  },
  actionBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  actionTitleUrgent: {
    color: colors.danger,
  },
  actionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
  },
  recentContainer: {
    padding: 20,
    paddingTop: 0,
  },
  horizontalScroll: {
    paddingRight: 20,
  },
  jobCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    width: 280,
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
    marginBottom: 8,
  },
  jobTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  jobCompany: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    fontWeight: typography.weights.medium,
  },
  jobLocation: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    marginBottom: 12,
  },
  jobMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobTypeTag: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  jobTypeText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  jobDate: {
    fontSize: typography.sizes.xs,
    color: colors.gray400,
  },
  applicationCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
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
  applicationTitle: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginRight: 12,
  },
  applicationStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  applicationStatusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  applicationCompany: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 4,
  },
  applicationDate: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
  },
  performingJobCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  performingJobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  performingJobTitle: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  performingJobApps: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  performingJobStats: {
    flexDirection: 'row',
    gap: 16,
  },
  performingJobStat: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyStateTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  emptyStateButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  bottomSpacing: {
    height: 20,
  },
});