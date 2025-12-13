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
  TextInput,
  FlatList,
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

// Organization search state
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState([]);
const [searchLoading, setSearchLoading] = useState(false);
const [showSearchResults, setShowSearchResults] = useState(false);
  
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
const [hasActiveAIAccess, setHasActiveAIAccess] = useState(false);
  
// ✅ NEW: Scroll ref for scroll-to-top functionality
  const scrollViewRef = React.useRef(null);

  // Organization search function with debounce
  const searchOrganizations = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    try {
      const result = await refopenAPI.getOrganizations(query.trim(), 10);
      
      if (result.success && result.data) {
        // Filter out "My company is not listed" option
        const filtered = result.data.filter(org => org.id !== 999999);
        setSearchResults(filtered);
        setShowSearchResults(filtered.length > 0);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch (error) {
      console.error('Organization search error:', error);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      searchOrganizations(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchOrganizations]);

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
        
        // Check AI access status (24hr validity)
        checkAIAccessStatus();
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

  // Check AI access status (24hr validity)
  const checkAIAccessStatus = async () => {
    try {
      const result = await refopenAPI.apiCall('/jobs/ai-access-status');
      
      if (result?.success) {
        const hasAccess = result.data?.hasActiveAccess || false;
        setHasActiveAIAccess(hasAccess);
      } else {
        setHasActiveAIAccess(false);
      }
    } catch (error) {
      console.error('❌ Error checking AI access status:', error);
      setHasActiveAIAccess(false);
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

  // Handle Show More AI Jobs - check 24hr access first
  const handleShowMoreAIJobs = async () => {
    try {
      
      // Check if user has active AI access (paid within 24 hours)
      const accessStatus = await refopenAPI.apiCall('/jobs/ai-access-status');
      
      if (accessStatus?.success && accessStatus.data?.hasActiveAccess) {
        // User has active access - navigate directly without payment
        navigation.navigate('AIRecommendedJobs');
        return;
      } else {
      }
    } catch (error) {
      console.error('❌ Error checking AI access status:', error);
      // Continue to payment flow if check fails
    }

    const requiredAmount = 100;
    
    // Check balance (user needs to pay)
    if (walletBalance < requiredAmount) {
      setIsInsufficientBalance(true);
      setShowAIConfirmModal(true);
      return;
    }

    // Show confirmation modal for payment
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

      const result = await aiJobRecommendations.getPersonalizedJobs(userId, 5);
      
      if (result.success && result.jobs) {
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
      {/* Compact Header with Search - OUTSIDE ScrollView for proper z-index */}
      <View style={styles.headerCompact}>
        {/* Left: Brand name */}
        <Text style={styles.brandName}>RefOpen</Text>
        
        {/* Center: Search bar */}
        <View style={styles.searchContainerMain}>
          <View style={styles.searchInputWrapper}>
            <Ionicons 
              name="search" 
              size={18} 
              color={colors.gray400} 
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search companies..."
              placeholderTextColor={colors.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => searchQuery.trim().length >= 2 && setShowSearchResults(true)}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 300)}
            />
            {searchLoading && (
              <ActivityIndicator size="small" color={colors.primary} style={styles.searchLoader} />
            )}
          </View>
          
          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <View style={styles.searchResultsDropdown}>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id.toString()}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchResultItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      // ✅ Use onPress instead of onPressIn to allow scrolling
                      console.log('🔍 [HomeScreen] Search result pressed:', {
                        id: item.id,
                        name: item.name,
                        industry: item.industry
                      });
                      
                      console.log('🔍 [HomeScreen] Navigating to OrganizationDetails with ID:', item.id);
                      
                      // Navigate
                      navigation.navigate('OrganizationDetails', { 
                        organizationId: item.id 
                      });
                      
                      // Clear state after navigation
                      setShowSearchResults(false);
                      setSearchQuery('');
                    }}
                  >
                    {item.logoURL ? (
                      <Image 
                        source={{ uri: item.logoURL }} 
                        style={styles.orgLogo}
                      />
                    ) : (
                      <View style={styles.orgLogoPlaceholder}>
                        <Ionicons name="business" size={20} color={colors.gray400} />
                      </View>
                    )}
                    <View style={styles.orgInfo}>
                      <Text style={styles.orgName} numberOfLines={1}>{item.name}</Text>
                      {item.industry && (
                        <Text style={styles.orgIndustry} numberOfLines={1}>{item.industry}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
                  </TouchableOpacity>
                )}
                style={styles.searchResultsList}
              />
            </View>
          )}
        </View>
        
        {/* Right: Messages button */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('Messages')}
          activeOpacity={0.7}
          style={styles.messagesButton}
        >
          <Ionicons name="chatbubbles-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >

        {/* Enhanced Quick Actions for Job Seekers */}
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
              {/* Get Referrals Card - Premium Design */}
              <TouchableOpacity 
                style={styles.premiumActionCard}
                onPress={() => navigation.navigate('AskReferral')}
                activeOpacity={0.8}
              >
                <View style={styles.premiumCardGradient}>
                  <View style={styles.premiumCardHeader}>
                    <View style={[styles.premiumIcon, { backgroundColor: '#FEB800' + '20' }]}>
                      <Ionicons name="people" size={28} color="#FEB800" />
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#FEB800" />
                  </View>
                  <Text style={styles.premiumActionTitle}>Get Referrals</Text>
                  <Text style={styles.premiumActionDescription}>
                    Request referrals for job opportunities
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Complete Profile Card - With Circular Progress */}
              <TouchableOpacity 
                style={styles.profileActionCard}
                onPress={() => navigation.navigate('Profile')}
                activeOpacity={0.8}
              >
                <View style={styles.profileCardContent}>
                  <View style={styles.profileCardLeft}>
                    <View style={styles.profileCardHeader}>
                      <View style={[styles.profileIcon, { 
                        backgroundColor: stats.profileCompleteness >= 80 ? colors.success + '20' : colors.warning + '20' 
                      }]}>
                        <Ionicons 
                          name="person" 
                          size={28} 
                          color={stats.profileCompleteness >= 80 ? colors.success : colors.warning} 
                        />
                      </View>
                    </View>
                    <Text style={styles.profileActionTitle}>Complete Profile</Text>
                    <Text style={styles.profileActionDescription}>
                      Improve your profile to stand out
                    </Text>
                  </View>
                  
                  {/* Circular Progress Indicator */}
                  <View style={styles.profileCardRight}>
                    <View style={styles.circularProgress}>
                      <Text style={[
                        styles.progressPercentage,
                        { color: stats.profileCompleteness >= 80 ? colors.success : colors.warning }
                      ]}>
                        {stats.profileCompleteness || 0}%
                      </Text>
                      <Text style={styles.progressLabel}>Complete</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
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
                  <Ionicons name="bulb-outline" size={24} color="#FFD700" />
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
                        <Ionicons name="flash-outline" size={12} color="#FFD700" />
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
                  {!hasActiveAIAccess && (
                    <View style={styles.showMoreBadge}>
                      <Text style={styles.showMoreBadgeText}>₹100</Text>
                    </View>
                  )}
                  {/* Debug log */}
                </TouchableOpacity>
                
                <View style={styles.aiTipContainer}>
                  <Ionicons name="information-circle" size={16} color="#FFD700" />
                  <Text style={styles.aiTipText}>
                    Complete your profile with more details for even better AI recommendations
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
                  <Ionicons name="information-circle" size={16} color="#FFD700" />
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
            {isInsufficientBalance ? (
              <>
                {/* Header with red gradient */}
                <View style={styles.insufficientBalanceHeader}>
                  <Ionicons name="wallet-outline" size={32} color="#FFF" />
                  <Text style={styles.insufficientBalanceTitle}>Wallet Recharge Required</Text>
                </View>
                
                <View style={styles.insufficientBalanceBody}>
                  <Text style={styles.insufficientBalanceSubtitle}>Insufficient wallet balance</Text>
                  
                  {/* Balance cards */}
                  <View style={styles.balanceCardsContainer}>
                    <View style={styles.balanceCardCurrent}>
                      <Ionicons name="cash-outline" size={24} color="#DC3545" />
                      <Text style={styles.balanceCardLabel}>Current</Text>
                      <Text style={styles.balanceCardAmount}>₹{walletBalance.toFixed(2)}</Text>
                    </View>
                    
                    <View style={styles.balanceCardRequired}>
                      <Ionicons name="checkmark-circle-outline" size={24} color="#28A745" />
                      <Text style={styles.balanceCardLabel}>Required</Text>
                      <Text style={styles.balanceCardAmount}>₹100.00</Text>
                    </View>
                  </View>
                  
                  {/* Why needed section */}
                  <View style={styles.whyNeededSection}>
                    <Text style={styles.whyNeededTitle}>Why is this needed?</Text>
                    
                    <View style={styles.whyNeededItem}>
                      <Ionicons name="shield-checkmark" size={20} color="#6C5CE7" />
                      <Text style={styles.whyNeededText}>Access 50 AI-matched jobs for 24 hours</Text>
                    </View>
                    
                    <View style={styles.whyNeededItem}>
                      <Ionicons name="people" size={20} color="#6C5CE7" />
                      <Text style={styles.whyNeededText}>Personalized job recommendations</Text>
                    </View>
                    
                    <View style={styles.whyNeededItem}>
                      <Ionicons name="repeat" size={20} color="#6C5CE7" />
                      <Text style={styles.whyNeededText}>Unlimited views within 24 hours</Text>
                    </View>
                  </View>
                  
                  {/* Action buttons */}
                  <View style={styles.insufficientBalanceButtons}>
                    <TouchableOpacity 
                      style={styles.maybeLaterButton} 
                      onPress={() => setShowAIConfirmModal(false)}
                    >
                      <Text style={styles.maybeLaterText}>Maybe Later</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.addMoneyButton} 
                      onPress={handleAIJobsCancel}
                    >
                      <Ionicons name="wallet" size={20} color="#FFF" />
                      <Text style={styles.addMoneyText}>Add Money</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* AI Jobs confirmation modal */}
                <View style={styles.aiConfirmHeader}>
                  <Ionicons name="bulb" size={32} color="#FFD700" />
                  <Text style={styles.aiConfirmHeaderTitle}>AI Recommended Jobs</Text>
                </View>
                
                <View style={styles.aiConfirmBody}>
                  <Text style={styles.aiConfirmSubtitle}>Get 50 personalized job matches</Text>
                  
                  {/* Cost and Balance */}
                  <View style={styles.costBalanceContainer}>
                    <View style={styles.costBalanceRow}>
                      <Text style={styles.costBalanceLabel}>Cost</Text>
                      <Text style={styles.costBalanceValue}>₹100.00</Text>
                    </View>
                    <View style={styles.costBalanceRow}>
                      <Text style={styles.costBalanceLabel}>Current Balance</Text>
                      <Text style={styles.costBalanceValueGreen}>₹{walletBalance.toFixed(2)}</Text>
                    </View>
                    <View style={styles.costBalanceDivider} />
                    <View style={styles.costBalanceRow}>
                      <Text style={styles.costBalanceLabelBold}>Balance After</Text>
                      <Text style={styles.costBalanceValueBold}>₹{(walletBalance - 100).toFixed(2)}</Text>
                    </View>
                  </View>
                  
                  {/* Features section */}
                  <View style={styles.featuresSection}>
                    <Text style={styles.featuresSectionTitle}>What you'll get:</Text>
                    
                    <View style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={20} color="#28A745" />
                      <Text style={styles.featureText}>50 AI-matched jobs based on your profile</Text>
                    </View>
                    
                    <View style={styles.featureItem}>
                      <Ionicons name="time" size={20} color="#28A745" />
                      <Text style={styles.featureText}>24-hour unlimited access</Text>
                    </View>
                    
                    <View style={styles.featureItem}>
                      <Ionicons name="refresh" size={20} color="#28A745" />
                      <Text style={styles.featureText}>No additional charges for 24 hours</Text>
                    </View>
                  </View>
                  
                  {/* Action buttons */}
                  <View style={styles.aiConfirmButtons}>
                    <TouchableOpacity 
                      style={styles.aiConfirmCancelButton} 
                      onPress={() => setShowAIConfirmModal(false)}
                    >
                      <Text style={styles.aiConfirmCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.aiConfirmProceedButton} 
                      onPress={handleAIJobsConfirm}
                    >
                      <Ionicons name="flash" size={20} color="#FFF" />
                      <Text style={styles.aiConfirmProceedText}>Proceed</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
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
headerCompact: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 12,
  paddingTop: Platform.OS === 'ios' ? 44 : 12,
  backgroundColor: colors.surface,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
  gap: 12,
  zIndex: 10000,
  elevation: 10,
  position: Platform.OS === 'web' ? 'sticky' : 'relative',
  top: 0,
},
  brandName: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  searchContainerMain: {
    flex: 1,
    position: 'relative',
    zIndex: 9999,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 36,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
    padding: 0,
    outlineStyle: 'none',
  },
  searchLoader: {
    marginLeft: 8,
  },
  searchResultsDropdown: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 300,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 999,
    zIndex: 9999,
  },
  searchResultsList: {
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  orgLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  orgLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  orgIndustry: {
    fontSize: typography.sizes.xs,
    color: colors.gray600,
  },
  messagesButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
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
  // Premium Get Referrals Card
  premiumActionCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FEB800',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  premiumCardGradient: {
    backgroundColor: colors.surface,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FEB800' + '30',
    borderRadius: 16,
  },
  premiumCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  premiumIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumActionTitle: {
    fontSize: 20,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 6,
  },
  premiumActionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    lineHeight: 20,
  },
  // Profile Completion Card
  profileActionCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  profileCardContent: {
    backgroundColor: colors.surface,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileCardLeft: {
    flex: 1,
    marginRight: 16,
  },
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileActionTitle: {
    fontSize: 20,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 6,
  },
  profileActionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    lineHeight: 20,
  },
  profileCardRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularProgress: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background,
    borderWidth: 6,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressPercentage: {
    fontSize: 20,
    fontWeight: typography.weights.bold,
    marginBottom: 2,
  },
  progressLabel: {
    fontSize: 10,
    color: colors.gray500,
    fontWeight: typography.weights.medium,
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
    backgroundColor: '#1E1E26',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3A3A44',
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
    backgroundColor: '#2C2C34',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#FFD700',
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
    color: '#FFD700',
    marginBottom: 2,
  },
  aiSubtitle: {
    fontSize: typography.sizes.xs,
    color: '#A0A0AA',
    fontStyle: 'italic',
  },
  aiJobCardWrapper: {
    position: 'relative',
  },
  aiJobBadge: {
    position: 'absolute',
    top: 8,
    right: 20,
    backgroundColor: '#2C2C34',
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
    color: '#FFD700',
    fontSize: 10,
    fontWeight: typography.weights.bold,
    marginLeft: 4,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C34',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 12,
    shadowColor: '#FFD700',
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
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  showMoreBadgeText: {
    color: '#2C2C34',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  aiLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#2C2C34',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3A3A44',
  },
  aiLoadingText: {
    marginLeft: 12,
    fontSize: typography.sizes.sm,
    color: '#A0A0AA',
    fontStyle: 'italic',
  },
  aiTipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C34',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  aiTipText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: '#A0A0AA',
    marginLeft: 8,
    lineHeight: 16,
  },
  aiNoJobsState: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#2C2C34',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A44',
  },
  aiNoJobsText: {
    fontSize: typography.sizes.sm,
    color: '#A0A0AA',
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
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  // Insufficient Balance Design
  insufficientBalanceHeader: {
    backgroundColor: '#DC3545',
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  insufficientBalanceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
  },
  insufficientBalanceBody: {
    padding: 24,
  },
  insufficientBalanceSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text || '#000',
    textAlign: 'center',
    marginBottom: 20,
  },
  balanceCardsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  balanceCardCurrent: {
    flex: 1,
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#DC354520',
  },
  balanceCardRequired: {
    flex: 1,
    backgroundColor: '#E8F8F0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#28A74520',
  },
  balanceCardLabel: {
    fontSize: 14,
    color: colors.gray600 || '#666',
    fontWeight: '500',
  },
  balanceCardAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text || '#000',
  },
  whyNeededSection: {
    backgroundColor: colors.background || '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  whyNeededTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text || '#000',
    marginBottom: 16,
  },
  whyNeededItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  whyNeededText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray600 || '#666',
    lineHeight: 20,
  },
  insufficientBalanceButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  maybeLaterButton: {
    flex: 1,
    backgroundColor: colors.background || '#F5F5F7',
    borderWidth: 1,
    borderColor: colors.border || '#E5E5EA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  maybeLaterText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#000',
  },
  addMoneyButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  addMoneyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // AI Confirmation Modal (when balance is sufficient)
  aiConfirmHeader: {
    backgroundColor: '#6C5CE7',
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  aiConfirmHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
  },
  aiConfirmBody: {
    padding: 24,
  },
  aiConfirmSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text || '#000',
    textAlign: 'center',
    marginBottom: 20,
  },
  costBalanceContainer: {
    backgroundColor: colors.background || '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  costBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  costBalanceLabel: {
    fontSize: 14,
    color: colors.gray600 || '#666',
  },
  costBalanceLabelBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text || '#000',
  },
  costBalanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#000',
  },
  costBalanceValueGreen: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28A745',
  },
  costBalanceValueBold: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text || '#000',
  },
  costBalanceDivider: {
    height: 1,
    backgroundColor: colors.border || '#E5E5EA',
    marginVertical: 8,
  },
  featuresSection: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#007AFF20',
  },
  featuresSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text || '#000',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray600 || '#666',
    lineHeight: 20,
  },
  aiConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  aiConfirmCancelButton: {
    flex: 1,
    backgroundColor: colors.background || '#F5F5F7',
    borderWidth: 1,
    borderColor: colors.border || '#E5E5EA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  aiConfirmCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#000',
  },
  aiConfirmProceedButton: {
    flex: 1,
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  aiConfirmProceedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});