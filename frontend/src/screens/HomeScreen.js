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
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import refopenAPI from '../services/api';
import aiJobRecommendations from '../services/aiJobRecommendations';
import { colors, typography } from '../styles/theme';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
const { user, isEmployer, isJobSeeker } = useAuth();
const [refreshing, setRefreshing] = useState(false);
  
// ⚡ NEW: Separate loading states for lazy loading
const [loadingStats, setLoadingStats] = useState(true);
const [loadingJobs, setLoadingJobs] = useState(true);
const [loadingApplications, setLoadingApplications] = useState(true);
  
const [dashboardData, setDashboardData] = useState({
  // Enhanced stats from backend
  stats: {},
  recentJobs: [],
  recentApplications: [],
  referralStats: {}
});
  
// 🆕 NEW: AI Personalized Jobs state
const [aiJobs, setAiJobs] = useState([]);
const [loadingAiJobs, setLoadingAiJobs] = useState(false);
const [walletBalance, setWalletBalance] = useState(0);
const [showAIConfirmModal, setShowAIConfirmModal] = useState(false);
const [isInsufficientBalance, setIsInsufficientBalance] = useState(false);
  
// ✅ NEW: Scroll ref for scroll-to-top functionality
const scrollViewRef = React.useRef(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      // ⚡ Load stats first (for Quick Actions badges)
      setLoadingStats(true);
      const dashboardRes = await refopenAPI.apiCall('/users/dashboard-stats').catch(() => ({ success: false, data: {} }));
      const stats = dashboardRes.success ? dashboardRes.data : {};
      
      setDashboardData(prev => ({ ...prev, stats }));
      setLoadingStats(false);

      // ⚡ Load jobs in parallel (non-blocking)
      setLoadingJobs(true);
      const recentJobsRes = isEmployer 
        ? await refopenAPI.getOrganizationJobs({ page: 1, pageSize: 5, status: 'Published', postedByUserId: user?.UserID || user?.userId || user?.id }).catch(() => ({ success: false, data: [] }))
        : await refopenAPI.getJobs(1, 5).catch(() => ({ success: false, data: [] }));
      
      let recentJobs = [];
      if (recentJobsRes.success) {
        if (isEmployer) {
          recentJobs = (recentJobsRes.data || []).slice(0, 5);
        } else {
          recentJobs = (recentJobsRes.data || []).slice(0, 5);
        }
      }
      
      setDashboardData(prev => ({ ...prev, recentJobs }));
      setLoadingJobs(false);

      // ⚡ Load applications (for job seekers)
      if (isJobSeeker) {
        setLoadingApplications(true);
        const applicationsRes = await refopenAPI.getMyApplications(1, 3).catch(() => ({ success: false, data: [] }));
        const recentApplications = applicationsRes.success ? applicationsRes.data.slice(0, 3) : [];
        
        setDashboardData(prev => ({ ...prev, recentApplications }));
        setLoadingApplications(false);

        // 🤖 Load AI personalized jobs (non-critical, can load last)
        loadAIPersonalizedJobs();
        
        // Load wallet balance for AI feature
        loadWalletBalance();
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data. Please try again.');
      setLoadingStats(false);
      setLoadingJobs(false);
      setLoadingApplications(false);
    }
  }, [isJobSeeker, isEmployer, user]);

  // Load wallet balance
  const loadWalletBalance = async () => {
    try {
      const result = await refopenAPI.getWalletBalance();
      if (result?.success) {
        setWalletBalance(result.data?.balance || 0);
      }
    } catch (error) {
      console.error('Error loading wallet balance:', error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDashboardData();
    });

    return unsubscribe;
  }, [navigation, fetchDashboardData]);

  // ✅ NEW: Scroll to top when navigating to HomeScreen
  useFocusEffect(
    useCallback(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setDashboardData({
      stats: {},
      recentJobs: [],
      recentApplications: [],
      referralStats: {}
    });
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
            <Text style={styles.statSubtitle} numberOfLines={2}>{subtitle}</Text>
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

  // Handle Show More AI Jobs (backend will handle ₹100 deduction like referrals)
  const handleShowMoreAIJobs = async () => {
    const requiredAmount = 100;
    
    // Check balance first (lightweight check)
    if (walletBalance < requiredAmount) {
      setIsInsufficientBalance(true);
      setShowAIConfirmModal(true);
      return;
    }

    // Show confirmation modal
    setIsInsufficientBalance(false);
    setShowAIConfirmModal(true);
  };

  const handleAIJobsConfirm = () => {
    setShowAIConfirmModal(false);
    if (!isInsufficientBalance) {
      // Navigate - backend will automatically deduct ₹100 when loading AI jobs
      navigation.navigate('AIRecommendedJobs');
      // Reload wallet balance after returning
      setTimeout(() => loadWalletBalance(), 1000);
    }
  };

  const handleAIJobsCancel = () => {
    setShowAIConfirmModal(false);
    if (isInsufficientBalance) {
      // Navigate to recharge
      navigation.navigate('WalletRecharge');
    }
  };

  // 🤖 NEW: Load AI Personalized Jobs
  const loadAIPersonalizedJobs = async () => {
    try {
      setLoadingAiJobs(true);
      const userId = user?.UserID || user?.userId || user?.id;
      
      if (!userId) {
        console.warn('No user ID available for AI recommendations');
        return;
      }

      console.log('🤖 Loading AI personalized jobs for user:', userId);
      const result = await aiJobRecommendations.getPersonalizedJobs(userId, 5);
      
      if (result.success && result.jobs) {
        console.log(`🤖 Loaded ${result.jobs.length} AI personalized jobs`);
        setAiJobs(result.jobs);
      } else {
        console.warn('🤖 No AI personalized jobs found');
        setAiJobs([]);
      }
    } catch (error) {
      console.error('🤖 Error loading AI personalized jobs:', error);
      setAiJobs([]);
    } finally {
      setLoadingAiJobs(false);
    }
  };

  // ⚡ NEW: Section loading component
  const SectionLoader = () => (
    <View style={styles.sectionLoader}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.sectionLoaderText}>Loading...</Text>
    </View>
  );

  // ⚡ Remove the global loading screen - show content immediately

  const { stats, recentJobs, recentApplications, referralStats } = dashboardData;

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* New Header with RefOpen branding and profile picture */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>RefOpen</Text>
            <Text style={styles.subGreeting}>
              {isEmployer ? 'Manage your team and hiring pipeline' : 'Advance your career journey'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.headerRight}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            {user?.ProfilePictureURL ? (
              <Image 
                source={{ uri: user.ProfilePictureURL }} 
                style={styles.profilePicture}
              />
            ) : (
              <View style={styles.profilePicturePlaceholder}>
                <Ionicons name="person" size={24} color={colors.white} />
              </View>
            )}
          </TouchableOpacity>
        </View>

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
                title="Get Referrals"
                description="Request referrals for job opportunities"
                icon="people"
                color="#FEB800"
                onPress={() => navigation.navigate('AskReferral')}
              />
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
                badge={stats.profileCompleteness < 80 ? `${stats.profileCompleteness || 0}%` : null}
                urgent={stats.profileCompleteness < 60}
                onPress={() => navigation.navigate('Profile')}
              />
            </>
          )}
        </View>

        {/* Recent Jobs Section */}
        {loadingJobs ? (
          <View style={styles.recentContainer}>
            <Text style={styles.sectionTitle}>Recent Jobs</Text>
            <SectionLoader />
          </View>
        ) : recentJobs.length > 0 ? (
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
        ) : null}

        {/* 🤖 AI Personalized Jobs Section - ONLY for Job Seekers */}
        {isJobSeeker && (
          <View style={styles.aiJobsContainer}>
            <View style={styles.aiSectionHeader}>
              <View style={styles.aiTitleContainer}>
                <View style={styles.aiSparkleIcon}>
                  <Ionicons name="bulb-outline" size={24} color={colors.white} />
                </View>
                <View>
                  <Text style={styles.aiSectionTitle}>AI Recommends</Text>
                  <Text style={styles.aiSubtitle}>Jobs matched to your profile</Text>
                </View>
              </View>
            </View>

            {loadingAiJobs ? (
              <View style={styles.aiLoadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.aiLoadingText}>AI analyzing your profile...</Text>
              </View>
            ) : aiJobs.length > 0 ? (
              <>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScroll}
                >
                  {aiJobs.map((job, index) => (
                    <View key={job.JobID || index} style={styles.aiJobCardWrapper}>
                      <View style={styles.aiJobBadge}>
                        <Ionicons name="flash-outline" size={12} color={colors.white} />
                        <Text style={styles.aiJobBadgeText}>AI Matched</Text>
                      </View>
                      <JobCard job={job} />
                    </View>
                  ))}
                </ScrollView>
                
                {/* Show More Button */}
                <TouchableOpacity 
                  style={styles.showMoreButton}
                  onPress={handleShowMoreAIJobs}
                >
                  <Text style={styles.showMoreText}>Show More</Text>
                  <View style={styles.showMoreBadge}>
                    <Text style={styles.showMoreBadgeText}>₹100</Text>
                  </View>
                </TouchableOpacity>
                
                <View style={styles.aiTipContainer}>
                  <Ionicons name="information-circle" size={16} color={colors.primary} />
                  <Text style={styles.aiTipText}>
                    Complete your profile with more details for even better recommendations
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.aiNoJobsState}>
                <Ionicons name="search-outline" size={32} color={colors.gray400} />
                <Text style={styles.aiNoJobsText}>
                  No matching jobs found right now. Try exploring all jobs or check back later.
                </Text>
                <View style={styles.aiTipContainer}>
                  <Ionicons name="information-circle" size={16} color={colors.primary} />
                  <Text style={styles.aiTipText}>
                    Add more skills and experience to your profile for better AI recommendations
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Recent Applications (Job Seekers only) */}
        {isJobSeeker && (
          loadingApplications ? (
            <View style={styles.recentContainer}>
              <Text style={styles.sectionTitle}>Recent Applications</Text>
              <SectionLoader />
            </View>
          ) : recentApplications.length > 0 ? (
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
          ) : null
        )}

        {/* Enhanced Empty State */}
        {!loadingJobs && !loadingApplications && recentJobs.length === 0 && recentApplications.length === 0 && (
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

      {/* AI Jobs Confirmation Modal */}
      <Modal 
        visible={showAIConfirmModal} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setShowAIConfirmModal(false)}
      >
        <View style={styles.aiModalOverlay}>
          <View style={styles.aiModalContent}>
            <View style={styles.aiModalIconContainer}>
              <Ionicons 
                name={isInsufficientBalance ? "wallet-outline" : "flash"} 
                size={40} 
                color={isInsufficientBalance ? colors.warning : colors.primary} 
              />
            </View>
            
            <Text style={styles.aiModalTitle}>
              {isInsufficientBalance ? 'Insufficient Balance' : 'AI Recommended Jobs'}
            </Text>
            
            <Text style={styles.aiModalMessage}>
              {isInsufficientBalance 
                ? `You need ₹100 to view all AI recommended jobs.\n\nYour current balance: ₹${walletBalance.toFixed(2)}\n\nWould you like to recharge your wallet?`
                : `₹100 will be deducted from your wallet to access up to 50 personalized AI-matched jobs.\n\nCurrent Balance: ₹${walletBalance.toFixed(2)}\n\nDo you want to continue?`
              }
            </Text>
            
            <View style={styles.aiModalButtons}>
              <TouchableOpacity 
                style={styles.aiModalCancelButton} 
                onPress={() => setShowAIConfirmModal(false)}
              >
                <Text style={styles.aiModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.aiModalConfirmButton,
                  isInsufficientBalance && styles.aiModalRechargeButton
                ]} 
                onPress={isInsufficientBalance ? handleAIJobsCancel : handleAIJobsConfirm}
              >
                <Text style={styles.aiModalConfirmText}>
                  {isInsufficientBalance ? 'Recharge Wallet' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  // ⚡ NEW: Section loader styles
  sectionLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginTop: 8,
  },
  sectionLoaderText: {
    marginLeft: 12,
    fontSize: typography.sizes.sm,
    color: colors.gray600,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  companyName: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerRight: {
    marginLeft: 16,
  },
  profilePicture: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  profilePicturePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  greeting: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginTop: 2,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
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
    width: '48%', // Makes it 2x2 grid with gap
    minHeight: 120,
  },
  statCardLarge: {
    padding: 20,
    borderLeftWidth: 6,
    width: '48%', // Keep consistent with regular cards
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
    marginTop: 4,
    lineHeight: 14,
    flexWrap: 'wrap',
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
  // 🤖 AI Personalized Jobs Styles
  aiJobsContainer: {
    margin: 20,
    marginTop: 8,
    padding: 16,
    backgroundColor: `${colors.primary}05`,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  aiSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  aiSparkleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  aiSectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: 2,
  },
  aiSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.gray600,
    fontStyle: 'italic',
  },
  aiJobCardWrapper: {
    position: 'relative',
  },
  aiJobBadge: {
    position: 'absolute',
    top: 8,
    right: 20,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  aiJobBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.weights.bold,
    marginLeft: 4,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    gap: 10,
  },
  showMoreText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  showMoreBadge: {
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  showMoreBadgeText: {
    color: colors.primary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  aiLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  aiLoadingText: {
    marginLeft: 12,
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    fontStyle: 'italic',
  },
  aiTipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '08',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  aiTipText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.gray600,
    marginLeft: 8,
    lineHeight: 16,
  },
  aiNoJobsState: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiNoJobsText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  // AI Modal Styles
  aiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  aiModalContent: {
    backgroundColor: colors.surface || '#FFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  aiModalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  aiModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text || '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  aiModalMessage: {
    fontSize: 16,
    color: colors.gray600 || '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  aiModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  aiModalCancelButton: {
    flex: 1,
    backgroundColor: colors.background || '#F5F5F7',
    borderWidth: 1,
    borderColor: colors.border || '#E5E5EA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  aiModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#000',
  },
  aiModalConfirmButton: {
    flex: 1,
    backgroundColor: colors.primary || '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  aiModalRechargeButton: {
    backgroundColor: colors.warning || '#FEB800',
  },
  aiModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white || '#FFF',
  },
});