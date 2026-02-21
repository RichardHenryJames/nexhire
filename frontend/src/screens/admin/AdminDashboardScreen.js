import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
  Image,
  TextInput,
  Linking,
  Alert,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import refopenAPI from '../../services/api';
import { showToast } from '../../components/Toast';

const { width: screenWidth } = Dimensions.get('window');

// Valid tab names for deep linking
const VALID_TABS = ['overview', 'users', 'activity', 'referrals', 'transactions', 'services', 'emailLogs', 'resumeAnalyzer'];

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const { user, isAdmin } = useAuth();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // Get initial tab from route params (deep link) or default to 'overview'
  const initialTab = VALID_TABS.includes(route.params?.tab) ? route.params.tab : 'overview';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab); // overview, users, referrals, transactions, emailLogs, resumeAnalyzer
  
  // Separate state for each tab's data
  const [overviewData, setOverviewData] = useState(null);
  const [usersData, setUsersData] = useState(null);
  const [usersPagination, setUsersPagination] = useState({ page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
  const [usersFilters, setUsersFilters] = useState({
    search: '',
    userType: 'all',
    verifiedStatus: 'all',
    accountStatus: 'all',
    signupPeriod: 'all',
    hasApplications: 'all',
    hasBalance: 'all',
    hasReferrals: 'all',
    hasReferralsAsked: 'all'
  });
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [referralsData, setReferralsData] = useState(null);
  const [transactionsData, setTransactionsData] = useState(null);
  const [emailLogsData, setEmailLogsData] = useState(null);
  const [emailLogsPagination, setEmailLogsPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [resumeAnalyzerData, setResumeAnalyzerData] = useState(null);
  const [resumeAnalyzerPagination, setResumeAnalyzerPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  
  // Activity tracking data
  const [activityData, setActivityData] = useState(null);
  const [activityDays, setActivityDays] = useState(30);
  const [activitySort, setActivitySort] = useState('views'); // 'views' or 'lastActive'
  
  // Services interest data
  const [servicesData, setServicesData] = useState(null);
  
  // Social Share Claims data
  const [socialShareData, setSocialShareData] = useState(null);
  
  // Social Share Rejection Modal state
  const [socialRejectModalVisible, setSocialRejectModalVisible] = useState(false);
  const [selectedSocialClaim, setSelectedSocialClaim] = useState(null);
  const [socialRejectionReason, setSocialRejectionReason] = useState('');
  
  // Verifications data
  const [verificationsData, setVerificationsData] = useState(null);
  const [verificationRejectModalVisible, setVerificationRejectModalVisible] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [verificationRejectionReason, setVerificationRejectionReason] = useState('');
  
  // Track which tabs have been loaded
  const loadedTabs = useRef({ overview: false, users: false, referrals: false, transactions: false, emailLogs: false, resumeAnalyzer: false, activity: false, services: false, socialShare: false, verifications: false });
  
  // ScrollView ref for scroll to top
  const scrollViewRef = useRef(null);
  
  // Search debounce timer
  const searchTimerRef = useRef(null);
  
  // Tab-specific loading states
  const [tabLoading, setTabLoading] = useState({
    overview: false,
    users: false,
    referrals: false,
    transactions: false,
    emailLogs: false,
    resumeAnalyzer: false,
    activity: false,
    services: false,
    socialShare: false,
    verifications: false
  });

  // Handle tab change with URL update for deep linking
  const handleTabChange = useCallback((tabKey) => {
    setActiveTab(tabKey);
    // Update URL without navigation (for web deep linking)
    if (Platform.OS === 'web') {
      const newPath = tabKey === 'overview' ? '/admin' : `/admin/${tabKey}`;
      window.history.replaceState(null, '', newPath);
    }
  }, []);

  // Sync tab from route params when navigating back
  useEffect(() => {
    const tabFromRoute = route.params?.tab;
    if (tabFromRoute && VALID_TABS.includes(tabFromRoute) && tabFromRoute !== activeTab) {
      setActiveTab(tabFromRoute);
    }
  }, [route.params?.tab]);

  useEffect(() => {
    navigation.setOptions({
      title: 'Admin Dashboard',
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { color: colors.text, fontWeight: 'bold' },
    });
  }, [navigation, colors]);

  // Load overview data on initial mount (fast, lightweight)
  const loadOverview = useCallback(async (force = false) => {
    if (loadedTabs.current.overview && !force) return;
    try {
      setTabLoading(prev => ({ ...prev, overview: true }));
      const response = await refopenAPI.apiCall('/management/dashboard/overview');
      if (response.success) {
        setOverviewData(response.data);
        loadedTabs.current.overview = true;
      }
    } catch (error) {
      console.error('Error loading overview:', error);
    } finally {
      setTabLoading(prev => ({ ...prev, overview: false }));
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load users data on demand (with pagination and filters)
  const loadUsers = useCallback(async (page = 1, filters = usersFilters) => {
    try {
      setTabLoading(prev => ({ ...prev, users: true }));
      
      // Build query params
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
        search: filters.search || '',
        userType: filters.userType || 'all',
        verifiedStatus: filters.verifiedStatus || 'all',
        accountStatus: filters.accountStatus || 'all',
        signupPeriod: filters.signupPeriod || 'all',
        hasApplications: filters.hasApplications || 'all',
        hasBalance: filters.hasBalance || 'all',
        hasReferrals: filters.hasReferrals || 'all',
        hasReferralsAsked: filters.hasReferralsAsked || 'all'
      });
      
      const response = await refopenAPI.apiCall(`/management/dashboard/users?${params.toString()}`);
      if (response.success) {
        setUsersData(response.data);
        if (response.data.pagination) {
          setUsersPagination(response.data.pagination);
        }
        loadedTabs.current.users = true;
        // Scroll to top when page changes
        setTimeout(() => {
          if (Platform.OS === 'web') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ x: 0, y: 0, animated: true });
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setTabLoading(prev => ({ ...prev, users: false }));
    }
  }, []);

  // Load referrals data on demand
  const loadReferrals = useCallback(async (force = false) => {
    if (loadedTabs.current.referrals && !force) return;
    try {
      setTabLoading(prev => ({ ...prev, referrals: true }));
      const response = await refopenAPI.apiCall('/management/dashboard/referrals');
      if (response.success) {
        setReferralsData(response.data);
        loadedTabs.current.referrals = true;
      }
    } catch (error) {
      console.error('Error loading referrals:', error);
    } finally {
      setTabLoading(prev => ({ ...prev, referrals: false }));
    }
  }, []);

  // Load transactions data on demand
  const loadTransactions = useCallback(async (force = false) => {
    if (loadedTabs.current.transactions && !force) return;
    try {
      setTabLoading(prev => ({ ...prev, transactions: true }));
      const response = await refopenAPI.apiCall('/management/dashboard/transactions');
      if (response.success) {
        setTransactionsData(response.data);
        loadedTabs.current.transactions = true;
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setTabLoading(prev => ({ ...prev, transactions: false }));
    }
  }, []);

  // Load email logs data on demand (paginated)
  const loadEmailLogs = useCallback(async (page = 1) => {
    try {
      setTabLoading(prev => ({ ...prev, emailLogs: true }));
      const response = await refopenAPI.apiCall(`/management/dashboard/email-logs?page=${page}&pageSize=20`);
      if (response.success) {
        setEmailLogsData(response.data.emailLogs);
        setEmailLogsPagination(response.data.pagination);
        loadedTabs.current.emailLogs = true;
      }
    } catch (error) {
      console.error('Error loading email logs:', error);
    } finally {
      setTabLoading(prev => ({ ...prev, emailLogs: false }));
    }
  }, []);

  // Load resume analyzer data on demand (paginated)
  const loadResumeAnalyzer = useCallback(async (page = 1) => {
    try {
      setTabLoading(prev => ({ ...prev, resumeAnalyzer: true }));
      const response = await refopenAPI.apiCall(`/management/dashboard/resume-analyzer?page=${page}&pageSize=20`);
      if (response.success) {
        setResumeAnalyzerData(response.data.resumeAnalyzer);
        setResumeAnalyzerPagination(response.data.pagination);
        loadedTabs.current.resumeAnalyzer = true;
      }
    } catch (error) {
      console.error('Error loading resume analyzer data:', error);
    } finally {
      setTabLoading(prev => ({ ...prev, resumeAnalyzer: false }));
    }
  }, []);

  // Load activity analytics data
  const loadActivity = useCallback(async (days = 30, force = false) => {
    if (loadedTabs.current.activity && !force) return;
    try {
      setTabLoading(prev => ({ ...prev, activity: true }));
      const response = await refopenAPI.apiCall(`/management/activity/analytics?days=${days}`);
      if (response.success) {
        setActivityData(response.data);
        loadedTabs.current.activity = true;
      }
    } catch (error) {
      console.error('Error loading activity data:', error);
    } finally {
      setTabLoading(prev => ({ ...prev, activity: false }));
    }
  }, []);

  // Load services interest data
  const loadServices = useCallback(async (force = false) => {
    if (loadedTabs.current.services && !force) return;
    try {
      setTabLoading(prev => ({ ...prev, services: true }));
      const response = await refopenAPI.apiCall('/management/service-interests/stats');
      if (response.success) {
        setServicesData(response.data);
        loadedTabs.current.services = true;
      }
    } catch (error) {
      console.error('Error loading services data:', error);
    } finally {
      setTabLoading(prev => ({ ...prev, services: false }));
    }
  }, []);

  // Load social share claims data
  const loadSocialShare = useCallback(async () => {
    if (loadedTabs.current.socialShare) return;
    try {
      setTabLoading(prev => ({ ...prev, socialShare: true }));
      const response = await refopenAPI.apiCall('/management/social-share/claims');
      if (response.success) {
        setSocialShareData(response.data);
        loadedTabs.current.socialShare = true;
      }
    } catch (error) {
      console.error('Error loading social share claims:', error);
    } finally {
      setTabLoading(prev => ({ ...prev, socialShare: false }));
    }
  }, []);

  // Load verifications data
  const loadVerifications = useCallback(async () => {
    if (loadedTabs.current.verifications) return;
    try {
      setTabLoading(prev => ({ ...prev, verifications: true }));
      const response = await refopenAPI.apiCall('/management/verifications/pending');
      if (response.success) {
        setVerificationsData(response.data);
        loadedTabs.current.verifications = true;
      }
    } catch (error) {
      console.error('Error loading verifications:', error);
    } finally {
      setTabLoading(prev => ({ ...prev, verifications: false }));
    }
  }, []);

  // Verification rejection handlers
  const confirmVerificationReject = async () => {
    if (!verificationRejectionReason.trim()) {
      Alert.alert('Error', 'Please enter a rejection reason');
      return;
    }
    try {
      const response = await refopenAPI.apiCall(`/management/verifications/${selectedVerification.VerificationID}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: verificationRejectionReason })
      });
      if (response.success) {
        setVerificationRejectModalVisible(false);
        setSelectedVerification(null);
        setVerificationRejectionReason('');
        loadedTabs.current.verifications = false;
        loadVerifications();
      } else {
        Alert.alert('Error', response.error || 'Failed to reject verification');
      }
    } catch (error) {
      console.error('Error rejecting verification:', error);
      Alert.alert('Error', 'Failed to reject verification');
    }
  };

  const cancelVerificationReject = () => {
    setVerificationRejectModalVisible(false);
    setSelectedVerification(null);
    setVerificationRejectionReason('');
  };
  const confirmSocialReject = async () => {
    if (!socialRejectionReason.trim()) {
      Alert.alert('Error', 'Please enter a rejection reason');
      return;
    }
    
    try {
      const response = await refopenAPI.apiCall(`/management/social-share/claims/${selectedSocialClaim.ClaimID}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: socialRejectionReason })
      });
      if (response.success) {
        setSocialRejectModalVisible(false);
        setSelectedSocialClaim(null);
        setSocialRejectionReason('');
        loadedTabs.current.socialShare = false;
        loadSocialShare();
      } else {
        Alert.alert('Error', response.error || 'Failed to reject claim');
      }
    } catch (error) {
      console.error('Error rejecting claim:', error);
      Alert.alert('Error', 'Failed to reject claim');
    }
  };

  const cancelSocialReject = () => {
    setSocialRejectModalVisible(false);
    setSelectedSocialClaim(null);
    setSocialRejectionReason('');
  };

  // Load data when tab changes
  useEffect(() => {
    if (!isAdmin) return;
    
    switch (activeTab) {
      case 'overview':
        loadOverview();
        break;
      case 'users':
        loadUsers();
        break;
      case 'referrals':
        loadReferrals();
        break;
      case 'transactions':
        loadTransactions();
        break;
      case 'emailLogs':
        loadEmailLogs();
        break;
      case 'resumeAnalyzer':
        loadResumeAnalyzer();
        break;
      case 'activity':
        loadActivity();
        break;
      case 'services':
        loadServices();
        break;
      case 'socialShare':
        loadSocialShare();
        break;
      case 'verifications':
        loadVerifications();
        break;
    }
  }, [activeTab, isAdmin, loadOverview, loadUsers, loadReferrals, loadTransactions, loadEmailLogs, loadResumeAnalyzer, loadActivity, loadServices, loadSocialShare, loadVerifications]);

  // Initial load
  useEffect(() => {
    if (isAdmin) {
      loadOverview();
    }
  }, [isAdmin, loadOverview]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Reset loaded tabs to force reload
    loadedTabs.current = { overview: false, users: false, referrals: false, transactions: false, emailLogs: false, resumeAnalyzer: false, activity: false };
    
    // Reload current tab
    switch (activeTab) {
      case 'overview':
        loadOverview(true);
        break;
      case 'users':
        loadUsers(1, usersFilters);
        break;
      case 'referrals':
        loadReferrals(true);
        break;
      case 'transactions':
        loadTransactions(true);
        break;
      case 'emailLogs':
        loadEmailLogs(1);
        break;
      case 'resumeAnalyzer':
        loadResumeAnalyzer(1);
        break;
    }
  }, [activeTab, loadOverview, loadUsers, loadReferrals, loadTransactions, loadEmailLogs, loadResumeAnalyzer]);

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color={colors.error} />
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedText}>
            This page is only accessible to administrators.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && !overviewData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // Combine data from different tabs for rendering
  const dashboardData = {
    ...overviewData,
    ...usersData,
    ...referralsData,
    ...transactionsData
  };

  const { 
    userStats = {}, 
    referralStats = {}, 
    dailySignups = [], 
    dailyReferrals = [],
    jobStats = {},
    walletStats = {},
    recentTransactions = [],
    recentUsers = [],
    recentReferrals = [],
    topOrganizations = [],
    applicationStats = {},
    messageStats = {},
    verifiedReferrers = []
  } = dashboardData || {};

  const renderStatCard = (title, value, icon, color, subtitle) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statCardHeader}>
        <View style={[styles.statIconBg, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.statValue}>{value || 0}</Text>
      </View>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {[
          { key: 'overview', label: 'Overview', icon: 'grid-outline' },
          { key: 'users', label: 'Users', icon: 'people-outline' },
          { key: 'activity', label: 'Activity', icon: 'pulse-outline' },
          { key: 'referrals', label: 'Referrals', icon: 'share-social-outline' },
          { key: 'transactions', label: 'Transactions', icon: 'wallet-outline' },
          { key: 'services', label: 'Services', icon: 'rocket-outline' },
          { key: 'emailLogs', label: 'Emails', icon: 'mail-outline' },
          { key: 'resumeAnalyzer', label: 'Resume', icon: 'analytics-outline' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => handleTabChange(tab.key)}
          >
            <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            {tabLoading[tab.key] && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 4 }} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Tab loading spinner component
  const TabLoadingSpinner = () => (
    <View style={styles.tabLoadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.tabLoadingText}>Loading...</Text>
    </View>
  );

  const renderOverviewTab = () => {
    if (tabLoading.overview && !overviewData) {
      return <TabLoadingSpinner />;
    }
    return (
    <>
      {/* Quick Stats Row */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Stats</Text>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.statsScroll}
        contentContainerStyle={styles.statsRow}
      >
        {renderStatCard('Total Users', userStats.TotalUsers, 'people', colors.primary)}
        {renderStatCard('Today', userStats.UsersToday, 'person-add', '#10B981', 'New signups')}
        {renderStatCard('This Week', userStats.UsersThisWeek, 'calendar', '#8B5CF6')}
        {renderStatCard('This Month', userStats.UsersThisMonth, 'trending-up', '#F59E0B')}
      </ScrollView>

      {/* User Breakdown */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>User Breakdown</Text>
      </View>
      <View style={styles.gridRow}>
        {renderStatCard('Job Seekers', userStats.TotalJobSeekers, 'briefcase', colors.primary)}
        {renderStatCard('Employers', userStats.TotalEmployers, 'business', '#10B981')}
        {renderStatCard('Active Users', userStats.ActiveUsers, 'checkmark-circle', '#8B5CF6')}
        {renderStatCard('Verified Referrers', userStats.VerifiedReferrers, 'shield-checkmark', '#F59E0B')}
      </View>

      {/* Referral Stats */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Referral Requests</Text>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.statsScroll}
        contentContainerStyle={styles.statsRow}
      >
        {renderStatCard('Total Requests', referralStats.TotalRequests, 'share-social', colors.primary)}
        {renderStatCard('Today', referralStats.RequestsToday, 'today', '#10B981')}
        {renderStatCard('Pending', referralStats.PendingRequests, 'hourglass', '#F59E0B')}
        {renderStatCard('Completed', referralStats.CompletedRequests, 'checkmark-done', '#8B5CF6')}
      </ScrollView>

      {/* Job Stats */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Job Statistics</Text>
      </View>
      <View style={styles.gridRow}>
        {renderStatCard('Total Jobs', jobStats.TotalJobs, 'documents', colors.primary)}
        {renderStatCard('Active Jobs', jobStats.ActiveJobs, 'checkmark-circle', '#10B981')}
        {renderStatCard('External Jobs', jobStats.ExternalJobs, 'link', '#8B5CF6')}
        {renderStatCard('Today', jobStats.JobsToday, 'add-circle', '#F59E0B')}
      </View>

      {/* Application & Message Stats */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Engagement</Text>
      </View>
      <View style={styles.gridRow}>
        {renderStatCard('Applications', applicationStats.TotalApplications, 'document-text', colors.primary)}
        {renderStatCard('Today', applicationStats.ApplicationsToday, 'today', '#10B981')}
        {renderStatCard('Conversations', messageStats.TotalConversations, 'chatbubbles', '#8B5CF6')}
        {renderStatCard('Messages', messageStats.TotalMessages, 'mail', '#F59E0B')}
      </View>

      {/* Wallet Stats */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Wallet Overview</Text>
      </View>
      <View style={styles.walletCard}>
        <View style={styles.walletRow}>
          <Text style={styles.walletLabel}>Total Wallet Balance (All Users)</Text>
          <Text style={styles.walletAmount}>₹{(walletStats.TotalWalletBalance || 0).toLocaleString()}</Text>
        </View>
        <View style={styles.walletRow}>
          <Text style={styles.walletLabel}>Total Active Wallets</Text>
          <Text style={styles.walletCount}>{walletStats.TotalWallets || 0}</Text>
        </View>
      </View>
    </>
  );
  };

  // Handle filter change
  const handleFilterChange = (filterName, value) => {
    const newFilters = { ...usersFilters, [filterName]: value };
    setUsersFilters(newFilters);
    
    // For search, debounce the API call
    if (filterName === 'search') {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      searchTimerRef.current = setTimeout(() => {
        loadUsers(1, newFilters);
      }, 500);
    } else {
      // For other filters, load immediately
      loadUsers(1, newFilters);
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    const defaultFilters = {
      search: '',
      userType: 'all',
      verifiedStatus: 'all',
      accountStatus: 'all',
      signupPeriod: 'all',
      hasApplications: 'all',
      hasBalance: 'all',
      hasReferrals: 'all',
      hasReferralsAsked: 'all'
    };
    setUsersFilters(defaultFilters);
    loadUsers(1, defaultFilters);
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return usersFilters.search !== '' ||
      usersFilters.userType !== 'all' ||
      usersFilters.verifiedStatus !== 'all' ||
      usersFilters.accountStatus !== 'all' ||
      usersFilters.signupPeriod !== 'all' ||
      usersFilters.hasApplications !== 'all' ||
      usersFilters.hasBalance !== 'all' ||
      usersFilters.hasReferrals !== 'all' ||
      usersFilters.hasReferralsAsked !== 'all';
  };

  // Filter dropdown component
  const FilterDropdown = ({ label, value, options, onChange }) => {
    const isActive = value !== 'all';
    return (
      <View style={{ marginRight: 10, marginBottom: 10 }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isActive ? colors.primary + '15' : colors.background,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: isActive ? colors.primary : colors.border,
          paddingHorizontal: 14,
          paddingVertical: 10,
          shadowColor: colors.shadow || '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        }}>
          <Text style={{ 
            fontSize: 13, 
            fontWeight: '500',
            color: isActive ? colors.primary : colors.textSecondary, 
            marginRight: 6 
          }}>
            {label}:
          </Text>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 13,
              fontWeight: '600',
              color: isActive ? colors.primary : colors.text,
              cursor: 'pointer',
              outline: 'none',
              paddingRight: 20,
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              appearance: 'none',
              minWidth: 80,
            }}
          >
            {options.map(opt => (
              <option 
                key={opt.value} 
                value={opt.value}
                style={{ 
                  backgroundColor: colors.surface,
                  color: colors.text,
                  padding: '12px 16px',
                  fontSize: '14px',
                }}
              >
                {opt.label}
              </option>
            ))}
          </select>
          <Ionicons 
            name="chevron-down" 
            size={16} 
            color={isActive ? colors.primary : colors.textSecondary} 
            style={{ position: 'absolute', right: 12, pointerEvents: 'none' }} 
          />
        </View>
      </View>
    );
  };

  const renderUsersTab = () => {
    if (tabLoading.users && !usersData) {
      return <TabLoadingSpinner />;
    }
    return (
    <>
      {/* Search Bar */}
      <View style={{ 
        backgroundColor: colors.surface, 
        borderRadius: 12, 
        padding: 12, 
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border 
      }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          backgroundColor: colors.background,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginBottom: 12
        }}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={{ 
              flex: 1, 
              marginLeft: 8, 
              fontSize: 14, 
              color: colors.text,
              outlineStyle: 'none'
            }}
            placeholder="Search by name or email..."
            placeholderTextColor={colors.textSecondary}
            value={usersFilters.search}
            onChangeText={(text) => handleFilterChange('search', text)}
          />
          {usersFilters.search !== '' && (
            <TouchableOpacity onPress={() => handleFilterChange('search', '')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Primary Filters Row */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
          <FilterDropdown
            label="Type"
            value={usersFilters.userType}
            options={[
              { value: 'all', label: 'All Users' },
              { value: 'JobSeeker', label: 'Job Seekers' },
              { value: 'Employer', label: 'Employers' }
            ]}
            onChange={(val) => handleFilterChange('userType', val)}
          />
          <FilterDropdown
            label="Verified"
            value={usersFilters.verifiedStatus}
            options={[
              { value: 'all', label: 'All' },
              { value: 'verified', label: 'Verified' },
              { value: 'notVerified', label: 'Not Verified' }
            ]}
            onChange={(val) => handleFilterChange('verifiedStatus', val)}
          />
          <FilterDropdown
            label="Status"
            value={usersFilters.accountStatus}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' }
            ]}
            onChange={(val) => handleFilterChange('accountStatus', val)}
          />
          <FilterDropdown
            label="Signup"
            value={usersFilters.signupPeriod}
            options={[
              { value: 'all', label: 'All Time' },
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' }
            ]}
            onChange={(val) => handleFilterChange('signupPeriod', val)}
          />
          
          {/* More Filters Toggle */}
          <TouchableOpacity
            onPress={() => setShowMoreFilters(!showMoreFilters)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: showMoreFilters ? colors.primary + '20' : colors.background,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginBottom: 8
            }}
          >
            <Ionicons 
              name={showMoreFilters ? "chevron-up" : "options-outline"} 
              size={16} 
              color={showMoreFilters ? colors.primary : colors.textSecondary} 
            />
            <Text style={{ 
              fontSize: 13, 
              color: showMoreFilters ? colors.primary : colors.textSecondary, 
              marginLeft: 4 
            }}>
              {showMoreFilters ? 'Less' : 'More Filters'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* More Filters (Activity-based) */}
        {showMoreFilters && (
          <View style={{ 
            flexDirection: 'row', 
            flexWrap: 'wrap', 
            alignItems: 'center',
            marginTop: 8,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border
          }}>
            <FilterDropdown
              label="Applications"
              value={usersFilters.hasApplications}
              options={[
                { value: 'all', label: 'All' },
                { value: 'yes', label: 'Has Applications' },
                { value: 'no', label: 'No Applications' }
              ]}
              onChange={(val) => handleFilterChange('hasApplications', val)}
            />
            <FilterDropdown
              label="Wallet"
              value={usersFilters.hasBalance}
              options={[
                { value: 'all', label: 'All' },
                { value: 'yes', label: 'Has Balance' },
                { value: 'no', label: 'No Balance' }
              ]}
              onChange={(val) => handleFilterChange('hasBalance', val)}
            />
            <FilterDropdown
              label="Referrals Given"
              value={usersFilters.hasReferrals}
              options={[
                { value: 'all', label: 'All' },
                { value: 'yes', label: 'Has Given' },
                { value: 'no', label: 'None Given' }
              ]}
              onChange={(val) => handleFilterChange('hasReferrals', val)}
            />
            <FilterDropdown
              label="Referrals Asked"
              value={usersFilters.hasReferralsAsked}
              options={[
                { value: 'all', label: 'All' },
                { value: 'yes', label: 'Has Asked' },
                { value: 'no', label: 'None Asked' }
              ]}
              onChange={(val) => handleFilterChange('hasReferralsAsked', val)}
            />
          </View>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters() && (
          <TouchableOpacity
            onPress={clearAllFilters}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 12,
              paddingVertical: 8
            }}
          >
            <Ionicons name="close-circle-outline" size={16} color={colors.error} />
            <Text style={{ fontSize: 13, color: colors.error, marginLeft: 4 }}>
              Clear All Filters
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {hasActiveFilters() ? 'Filtered Users' : 'All Users'}
        </Text>
        <Text style={styles.sectionSubtitle}>
          {usersPagination.totalCount > 0 
            ? `Showing ${((usersPagination.page - 1) * 20) + 1}-${Math.min(usersPagination.page * 20, usersPagination.totalCount)} of ${usersPagination.totalCount} users${hasActiveFilters() ? ' (filtered)' : ''}` 
            : 'No users found'}
        </Text>
      </View>
      
      {recentUsers.length === 0 ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
          <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 12, textAlign: 'center' }}>
            No users match your filters
          </Text>
          <TouchableOpacity onPress={clearAllFilters} style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 14, color: colors.primary }}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
      recentUsers.map((userData, index) => (
        <TouchableOpacity 
          key={userData.UserID || index} 
          style={styles.userCard}
          onPress={() => navigation.navigate('ViewProfile', { userId: userData.UserID })}
        >
          {userData.ProfilePictureURL ? (
            <Image 
              source={{ uri: userData.ProfilePictureURL }} 
              style={styles.userAvatarImage}
            />
          ) : (
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {userData.FirstName?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={[styles.userInfo, { flex: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.userName, { flexShrink: 1 }]} numberOfLines={1}>{userData.FirstName} {userData.LastName}</Text>
              {userData.IsVerifiedReferrer && (
                <View style={[styles.badge, { backgroundColor: '#8B5CF620', flexShrink: 0 }]}>
                  <Ionicons name="checkmark-circle" size={12} color="#8B5CF6" style={{ marginRight: 2 }} />
                  <Text style={[styles.badgeText, { color: '#8B5CF6' }]}>Verified</Text>
                </View>
              )}
            </View>
            <Text style={styles.userEmail}>{userData.Email}</Text>
            {userData.Phone && (
              <Text style={[styles.userEmail, { marginTop: 2 }]}>📱 {userData.Phone}</Text>
            )}
            <View style={styles.userMeta}>
              <View style={[styles.badge, { backgroundColor: userData.UserType === 'JobSeeker' ? colors.primary + '20' : '#10B98120' }]}>
                <Text style={[styles.badgeText, { color: userData.UserType === 'JobSeeker' ? colors.primary : '#10B981' }]}>
                  {userData.UserType}
                </Text>
              </View>
              {userData.IsActive ? (
                <View style={[styles.badge, { backgroundColor: '#10B98120' }]}>
                  <Text style={[styles.badgeText, { color: '#10B981' }]}>Active</Text>
                </View>
              ) : (
                <View style={[styles.badge, { backgroundColor: '#EF444420' }]}>
                  <Text style={[styles.badgeText, { color: '#EF4444' }]}>Inactive</Text>
                </View>
              )}
            </View>
            {/* User Stats Row */}
            <View style={{ flexDirection: 'row', marginTop: 8, gap: 12, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>
                  {userData.ApplicationsCount || 0} apps
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="wallet-outline" size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>
                  ₹{userData.WalletBalance || 0}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="arrow-down-outline" size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>
                  {userData.ReferralsAsked || 0} asked
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="arrow-up-outline" size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 4 }}>
                  {userData.ReferralsGiven || 0} given
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.userRightSection}>
            <Text style={styles.userDate}>
              {new Date(userData.CreatedAt).toLocaleDateString()}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      ))
      )}
      
      {/* Pagination Controls */}
      {usersPagination.totalPages > 1 && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[styles.paginationButton, !usersPagination.hasPrevPage && styles.paginationButtonDisabled]}
            onPress={() => usersPagination.hasPrevPage && loadUsers(usersPagination.page - 1, usersFilters)}
            disabled={!usersPagination.hasPrevPage || tabLoading.users}
          >
            <Ionicons name="chevron-back" size={20} color={usersPagination.hasPrevPage ? colors.primary : colors.textSecondary} />
            <Text style={[styles.paginationButtonText, !usersPagination.hasPrevPage && styles.paginationButtonTextDisabled]}>
              Previous
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.paginationInfo}>
            Page {usersPagination.page} of {usersPagination.totalPages}
          </Text>
          
          <TouchableOpacity
            style={[styles.paginationButton, !usersPagination.hasNextPage && styles.paginationButtonDisabled]}
            onPress={() => usersPagination.hasNextPage && loadUsers(usersPagination.page + 1, usersFilters)}
            disabled={!usersPagination.hasNextPage || tabLoading.users}
          >
            <Text style={[styles.paginationButtonText, !usersPagination.hasNextPage && styles.paginationButtonTextDisabled]}>
              Next
            </Text>
            <Ionicons name="chevron-forward" size={20} color={usersPagination.hasNextPage ? colors.primary : colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}
      
      {tabLoading.users && usersData && (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </>
  );
  };

  const renderReferralsTab = () => {
    if (tabLoading.referrals && !referralsData) {
      return <TabLoadingSpinner />;
    }
    return (
    <>
      {/* Referral Status Breakdown */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Referral Status</Text>
      </View>
      <View style={styles.gridRow}>
        {renderStatCard('Pending', referralStats.PendingRequests, 'hourglass', '#F59E0B')}
        {renderStatCard('Claimed', referralStats.ClaimedRequests, 'hand-left', colors.primary)}
        {renderStatCard('Completed', referralStats.CompletedRequests, 'checkmark-done', '#10B981')}
        {renderStatCard('Cancelled', referralStats.CancelledRequests, 'close-circle', '#EF4444')}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Referral Requests</Text>
        <Text style={styles.sectionSubtitle}>Last 20 requests</Text>
      </View>
      {recentReferrals.map((ref, index) => (
        <View key={ref.RequestID || index} style={styles.referralCard}>
          <View style={styles.referralHeader}>
            <Text style={styles.referralTitle} numberOfLines={1}>{ref.JobTitle}</Text>
            <View style={[
              styles.statusBadge, 
              { backgroundColor: getStatusColor(ref.Status) + '20' }
            ]}>
              <Text style={[styles.statusText, { color: getStatusColor(ref.Status) }]}>
                {ref.Status}
              </Text>
            </View>
          </View>
          <Text style={styles.referralCompany}>{ref.CompanyName}</Text>
          <View style={styles.referralMeta}>
            <Text style={styles.referralBy}>By: {ref.RequesterName}</Text>
            {ref.ReferrerName && (
              <Text style={styles.referralClaimed}>Referrer: {ref.ReferrerName}</Text>
            )}
          </View>
          <Text style={styles.referralDate}>
            {new Date(ref.RequestedAt).toLocaleDateString()}
          </Text>
        </View>
      ))}
    </>
  );
  };

  const renderTransactionsTab = () => {
    if (tabLoading.transactions && !transactionsData) {
      return <TabLoadingSpinner />;
    }
    return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <Text style={styles.sectionSubtitle}>Last 10 wallet transactions</Text>
      </View>
      {recentTransactions.map((tx, index) => (
        <View key={tx.TransactionID || index} style={styles.transactionCard}>
          <View style={[
            styles.txIcon,
            { backgroundColor: tx.TransactionType === 'Credit' ? '#10B98120' : '#EF444420' }
          ]}>
            <Ionicons 
              name={tx.TransactionType === 'Credit' ? 'arrow-down' : 'arrow-up'} 
              size={20} 
              color={tx.TransactionType === 'Credit' ? '#10B981' : '#EF4444'} 
            />
          </View>
          <View style={styles.txInfo}>
            <Text style={styles.txDescription}>{tx.Description || tx.Source}</Text>
            <Text style={styles.txUser}>{tx.UserName} ({tx.Email})</Text>
            <Text style={styles.txDate}>
              {new Date(tx.CreatedAt).toLocaleString()}
            </Text>
          </View>
          <Text style={[
            styles.txAmount,
            { color: tx.TransactionType === 'Credit' ? '#10B981' : '#EF4444' }
          ]}>
            {tx.TransactionType === 'Credit' ? '+' : '-'}₹{tx.Amount}
          </Text>
        </View>
      ))}
    </>
  );
  };

  const getEmailStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'sent': return colors.primary;
      case 'delivered': return '#10B981';
      case 'opened': return '#8B5CF6';
      case 'clicked': return '#F59E0B';
      case 'bounced': return '#EF4444';
      case 'failed': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const renderEmailLogsTab = () => {
    if (tabLoading.emailLogs && !emailLogsData) {
      return <TabLoadingSpinner />;
    }
    return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Email Logs</Text>
        <Text style={styles.sectionSubtitle}>
          Page {emailLogsPagination.page} of {emailLogsPagination.totalPages} ({emailLogsPagination.total} total)
        </Text>
      </View>
      
      {(emailLogsData || []).map((email, index) => (
        <View key={email.LogID || index} style={styles.emailLogCard}>
          <View style={styles.emailLogHeader}>
            <View style={[styles.emailStatusBadge, { backgroundColor: getEmailStatusColor(email.Status) + '20' }]}>
              <Ionicons 
                name={email.Status === 'bounced' || email.Status === 'failed' ? 'close-circle' : 'checkmark-circle'} 
                size={14} 
                color={getEmailStatusColor(email.Status)} 
              />
              <Text style={[styles.emailStatusText, { color: getEmailStatusColor(email.Status) }]}>
                {email.Status || 'sent'}
              </Text>
            </View>
            <Text style={styles.emailType}>{email.EmailType}</Text>
          </View>
          <Text style={styles.emailSubject} numberOfLines={2}>{email.Subject}</Text>
          <View style={styles.emailRecipient}>
            <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.emailRecipientText}>
              {email.UserName ? `${email.UserName} - ` : ''}{email.ToEmail}
            </Text>
          </View>
          <Text style={styles.emailDate}>
            {new Date(email.SentAt).toLocaleString()}
          </Text>
        </View>
      ))}

      {/* Pagination Controls */}
      <View style={styles.paginationContainer}>
        <TouchableOpacity 
          style={[styles.paginationButton, !emailLogsPagination.hasPrev && styles.paginationButtonDisabled]}
          onPress={() => emailLogsPagination.hasPrev && loadEmailLogs(emailLogsPagination.page - 1)}
          disabled={!emailLogsPagination.hasPrev}
        >
          <Ionicons name="chevron-back" size={20} color={emailLogsPagination.hasPrev ? colors.primary : colors.textSecondary} />
          <Text style={[styles.paginationButtonText, !emailLogsPagination.hasPrev && styles.paginationButtonTextDisabled]}>Previous</Text>
        </TouchableOpacity>
        
        <Text style={styles.paginationInfo}>
          Page {emailLogsPagination.page} / {emailLogsPagination.totalPages}
        </Text>
        
        <TouchableOpacity 
          style={[styles.paginationButton, !emailLogsPagination.hasNext && styles.paginationButtonDisabled]}
          onPress={() => emailLogsPagination.hasNext && loadEmailLogs(emailLogsPagination.page + 1)}
          disabled={!emailLogsPagination.hasNext}
        >
          <Text style={[styles.paginationButtonText, !emailLogsPagination.hasNext && styles.paginationButtonTextDisabled]}>Next</Text>
          <Ionicons name="chevron-forward" size={20} color={emailLogsPagination.hasNext ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </>
  );
  };

  // Services Tab - Service Interest Tracking
  const renderServicesTab = () => {
    if (tabLoading.services && !servicesData) {
      return <TabLoadingSpinner />;
    }
    
    const SERVICE_LABELS = {
      ResumeAnalyzer: 'Resume Analyzer',
      ATSBeatSheet: 'Resume Builder',
      InterviewDecoded: 'Interview Prep',
      LinkedInOptimizer: 'LinkedIn Optimizer',
      SalarySpy: 'Salary Spy',
      OfferCoach: 'Offer Coach',
      MarketPulse: 'Market Pulse',
      BlindReview: 'Blind Review',
      CareerSimulator: 'Career Simulator',
    };

    if (!servicesData?.counts?.length) {
      return (
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="rocket-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>No Interest Data Yet</Text>
          <Text style={[styles.sectionSubtitle, { textAlign: 'center' }]}>Users can express interest in services from the Services tab. Data will appear here once they do.</Text>
        </View>
      );
    }

    const maxCount = Math.max(...servicesData.counts.map(c => c.count), 1);

    return (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🔥 Service Interest ({servicesData.totalInterests} total)</Text>
          <Text style={styles.sectionSubtitle}>User demand for upcoming tools — ranked by interest</Text>
        </View>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          {servicesData.counts.map((item, index) => (
            <View key={item.serviceName} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: index < servicesData.counts.length - 1 ? 1 : 0, borderBottomColor: colors.border + '40' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary, width: 24 }}>#{index + 1}</Text>
              <Text style={[styles.userName, { flex: 1, fontSize: 14 }]}>{SERVICE_LABELS[item.serviceName] || item.serviceName}</Text>
              <View style={{ flex: 2, height: 20, backgroundColor: colors.border + '60', borderRadius: 10, overflow: 'hidden', marginHorizontal: 12 }}>
                <View style={{ width: `${(item.count / maxCount) * 100}%`, height: '100%', backgroundColor: '#F59E0B', borderRadius: 10 }} />
              </View>
              <Text style={[styles.userEmail, { width: 40, textAlign: 'right', fontWeight: '700', fontSize: 15, color: colors.text }]}>{item.count}</Text>
            </View>
          ))}
        </View>
      </>
    );
  };

  // Activity Tab - User Analytics & Tracking
  const renderActivityTab = () => {
    if (tabLoading.activity && !activityData) {
      return <TabLoadingSpinner />;
    }

    const { summary, activeUsers, allUsersInPeriod, screenStats, dropOffPoints, dailyTrend, hourlyPattern, userFlow, deviceBreakdown, browserBreakdown, platformBreakdown } = activityData || {};
    const isDesktopView = responsive.isDesktop || responsive.isTablet;

    // Reusable component for active user card
    const ActiveUserCard = ({ user, index }) => (
      <TouchableOpacity 
        key={user.UserID || index} 
        style={styles.userCard}
        onPress={() => navigation.navigate('ViewProfile', { userId: user.UserID })}
      >
        {user.ProfilePictureURL ? (
          <Image source={{ uri: user.ProfilePictureURL }} style={styles.userAvatarImage} />
        ) : (
          <View style={[styles.userAvatar, { backgroundColor: '#10B981' }]}>
            <Text style={styles.userAvatarText}>{user.FirstName?.charAt(0)?.toUpperCase() || '?'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{user.FirstName} {user.LastName}</Text>
          <Text style={styles.userEmail}>{user.Email}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <View style={[styles.badge, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="navigate-outline" size={12} color="#10B981" />
              <Text style={[styles.badgeText, { color: '#10B981', marginLeft: 4 }]}>{user.CurrentScreen || 'Unknown'}</Text>
            </View>
            <Text style={[styles.userEmail, { marginLeft: 8 }]}>
              {user.Platform || 'web'}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' }} />
          <Text style={[styles.userEmail, { marginTop: 4 }]}>
            {user.LastActivityAt ? new Date(user.LastActivityAt).toLocaleTimeString() : 'Now'}
          </Text>
        </View>
      </TouchableOpacity>
    );

    // Reusable component for all users card
    const AllUsersCard = ({ user, index }) => (
      <TouchableOpacity 
        key={user.UserID || index} 
        style={styles.userCard}
        onPress={() => navigation.navigate('ViewProfile', { userId: user.UserID })}
      >
        {user.ProfilePictureURL ? (
          <Image source={{ uri: user.ProfilePictureURL }} style={styles.userAvatarImage} />
        ) : (
          <View style={[styles.userAvatar, { backgroundColor: '#8B5CF6' }]}>
            <Text style={styles.userAvatarText}>{user.FirstName?.charAt(0)?.toUpperCase() || '?'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{user.FirstName} {user.LastName}</Text>
          <Text style={styles.userEmail}>{user.Email}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
            <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="eye-outline" size={12} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.primary, marginLeft: 4 }]}>{user.TotalViews} views</Text>
            </View>
            <Text style={styles.userEmail}>Last: {user.LastScreen || 'Unknown'}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.userEmail, { fontSize: 11 }]}>
            {user.LastSeen ? new Date(user.LastSeen).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
          </Text>
          <Text style={[styles.userEmail, { fontSize: 10, color: colors.textSecondary }]}>
            {user.LastSeen ? new Date(user.LastSeen).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
    );

    // Reusable horizontal bar for breakdown items
    const BreakdownBar = ({ label, count, total, color, icon, uniqueUsers }) => {
      const pct = total > 0 ? (count / total * 100) : 0;
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border + '40' }}>
          <Ionicons name={icon} size={16} color={color} style={{ width: 24 }} />
          <Text style={[styles.userName, { flex: 1, fontSize: 13 }]}>{label}</Text>
          <View style={{ flex: 2, height: 18, backgroundColor: colors.border + '60', borderRadius: 9, overflow: 'hidden', marginHorizontal: 10 }}>
            <View style={{ width: `${Math.min(pct, 100)}%`, height: '100%', backgroundColor: color, borderRadius: 9 }} />
          </View>
          <Text style={[styles.statValue, { fontSize: 13, width: 55, textAlign: 'right', color: colors.text }]}>{Math.round(pct)}%</Text>
          <Text style={[styles.userEmail, { width: 60, textAlign: 'right', fontSize: 11 }]}>{uniqueUsers} usr</Text>
        </View>
      );
    };

    // Hourly pattern helpers
    const maxHourlyCount = hourlyPattern?.length ? Math.max(...hourlyPattern.map(h => h.ActivityCount || 0), 1) : 1;
    const getHourLabel = (h) => {
      if (h === 0) return '12am';
      if (h === 12) return '12pm';
      return h < 12 ? `${h}am` : `${h - 12}pm`;
    };

    // Totals for breakdowns
    const deviceTotal = deviceBreakdown?.reduce((s, d) => s + (d.Count || 0), 0) || 1;
    const browserTotal = browserBreakdown?.reduce((s, b) => s + (b.Count || 0), 0) || 1;

    // Device icons
    const deviceIcon = (type) => {
      switch (type?.toLowerCase()) {
        case 'mobile': return 'phone-portrait-outline';
        case 'tablet': return 'tablet-portrait-outline';
        case 'desktop': return 'desktop-outline';
        default: return 'help-outline';
      }
    };
    const deviceColor = (type) => {
      switch (type?.toLowerCase()) {
        case 'mobile': return colors.primary;
        case 'tablet': return '#8B5CF6';
        case 'desktop': return '#10B981';
        default: return '#6B7280';
      }
    };
    const browserIcon = (name) => {
      switch (name?.toLowerCase()) {
        case 'chrome': return 'logo-chrome';
        case 'safari': return 'compass-outline';
        case 'firefox': return 'logo-firefox';
        case 'edge': return 'globe-outline';
        default: return 'globe-outline';
      }
    };
    const browserColor = (name) => {
      switch (name?.toLowerCase()) {
        case 'chrome': return '#4285F4';
        case 'safari': return '#007AFF';
        case 'firefox': return '#FF7139';
        case 'edge': return '#0078D7';
        default: return '#6B7280';
      }
    };

    // ─── Day Range Picker ────────────────────────────
    const dayOptions = [1, 7, 14, 30, 60, 90];
    const handleDaysChange = (newDays) => {
      setActivityDays(newDays);
      loadedTabs.current.activity = false;
      loadActivity(newDays, true);
    };

    const renderDaysPicker = () => (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.userName, { fontSize: 13, marginLeft: 6, color: colors.textSecondary }]}>Time Range:</Text>
        </View>
        {dayOptions.map((d) => (
          <TouchableOpacity
            key={d}
            onPress={() => handleDaysChange(d)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: activityDays === d ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: activityDays === d ? colors.primary : colors.border,
            }}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: activityDays === d ? '700' : '500',
              color: activityDays === d ? '#fff' : colors.textSecondary,
            }}>{d}d</Text>
          </TouchableOpacity>
        ))}
        {tabLoading.activity && activityData && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
        )}
      </View>
    );

    // ─── Render Sections ────────────────────────────

    const renderSummaryCards = () => (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📊 User Activity Analytics</Text>
          <Text style={styles.sectionSubtitle}>Real-time user engagement tracking</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <View style={[styles.statCard, { flex: 1, minWidth: 140, backgroundColor: '#10B98120' }]}>
            <View style={[styles.statIcon, { backgroundColor: '#10B981' }]}>
              <Ionicons name="radio-outline" size={20} color="#fff" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{summary?.currentlyActive || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active Now</Text>
          </View>
          <View style={[styles.statCard, { flex: 1, minWidth: 140, backgroundColor: colors.primary + '20' }]}>
            <View style={[styles.statIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="eye-outline" size={20} color="#fff" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{summary?.totalScreenViews?.toLocaleString() || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Screen Views ({activityDays}d)</Text>
          </View>
          <View style={[styles.statCard, { flex: 1, minWidth: 140, backgroundColor: '#8B5CF620' }]}>
            <View style={[styles.statIcon, { backgroundColor: '#8B5CF6' }]}>
              <Ionicons name="people-outline" size={20} color="#fff" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{summary?.totalUniqueUsers || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Unique Users ({activityDays}d)</Text>
          </View>
          <View style={[styles.statCard, { flex: 1, minWidth: 140, backgroundColor: '#F59E0B20' }]}>
            <View style={[styles.statIcon, { backgroundColor: '#F59E0B' }]}>
              <Ionicons name="star-outline" size={20} color="#fff" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{summary?.topScreen || 'N/A'}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Top Screen</Text>
          </View>
        </View>
      </>
    );

    const renderDailyTrend = () => (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📈 Daily Trend (Last {activityDays}d)</Text>
          <Text style={styles.sectionSubtitle}>Users • Sessions • Screen Views</Text>
        </View>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          {/* Legend */}
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.primary }} />
              <Text style={[styles.userEmail, { fontSize: 11 }]}>Users</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#8B5CF6' }} />
              <Text style={[styles.userEmail, { fontSize: 11 }]}>Sessions</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#10B981' }} />
              <Text style={[styles.userEmail, { fontSize: 11 }]}>Views</Text>
            </View>
          </View>
          {dailyTrend?.slice(0, activityDays).reverse().map((day, index) => {
            const maxVal = Math.max(...dailyTrend.slice(0, activityDays).map(d => d.TotalScreenViews || d.ActiveUsers || 1), 1);
            return (
              <View key={day.Date || index} style={{ marginBottom: 10 }}>
                <Text style={[styles.userEmail, { fontSize: 11, marginBottom: 4 }]}>
                  {new Date(day.Date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
                {/* Users bar */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <View style={{ flex: 1, height: 14, backgroundColor: colors.border + '40', borderRadius: 4, overflow: 'hidden' }}>
                    <View style={{ width: `${(day.ActiveUsers / maxVal) * 100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 4 }} />
                  </View>
                  <Text style={[styles.userEmail, { width: 40, textAlign: 'right', fontSize: 11, fontWeight: '600' }]}>{day.ActiveUsers}</Text>
                </View>
                {/* Sessions bar */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <View style={{ flex: 1, height: 14, backgroundColor: colors.border + '40', borderRadius: 4, overflow: 'hidden' }}>
                    <View style={{ width: `${((day.TotalSessions || 0) / maxVal) * 100}%`, height: '100%', backgroundColor: '#8B5CF6', borderRadius: 4 }} />
                  </View>
                  <Text style={[styles.userEmail, { width: 40, textAlign: 'right', fontSize: 11, fontWeight: '600' }]}>{day.TotalSessions || 0}</Text>
                </View>
                {/* Views bar */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1, height: 14, backgroundColor: colors.border + '40', borderRadius: 4, overflow: 'hidden' }}>
                    <View style={{ width: `${((day.TotalScreenViews || 0) / maxVal) * 100}%`, height: '100%', backgroundColor: '#10B981', borderRadius: 4 }} />
                  </View>
                  <Text style={[styles.userEmail, { width: 40, textAlign: 'right', fontSize: 11, fontWeight: '600' }]}>{day.TotalScreenViews || 0}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </>
    );

    const renderHourlyPattern = () => {
      if (!hourlyPattern?.length) return null;
      // Fill in missing hours with 0
      const hourData = Array.from({ length: 24 }, (_, i) => {
        const found = hourlyPattern.find(h => h.Hour === i);
        return { Hour: i, ActivityCount: found?.ActivityCount || 0, UniqueUsers: found?.UniqueUsers || 0 };
      });
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🕐 Hourly Activity Pattern ({activityDays}d)</Text>
            <Text style={styles.sectionSubtitle}>Peak usage hours in UTC</Text>
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 2 }}>
              {hourData.map((h) => {
                const barH = maxHourlyCount > 0 ? (h.ActivityCount / maxHourlyCount) * 100 : 0;
                const isPeak = h.ActivityCount >= maxHourlyCount * 0.7;
                return (
                  <View key={h.Hour} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <Text style={{ fontSize: 8, color: colors.textSecondary, marginBottom: 2 }}>
                      {h.ActivityCount > 0 ? h.ActivityCount : ''}
                    </Text>
                    <View style={{
                      width: '100%',
                      height: `${Math.max(barH, 2)}%`,
                      backgroundColor: isPeak ? '#EF4444' : h.ActivityCount > maxHourlyCount * 0.4 ? '#F59E0B' : colors.primary,
                      borderRadius: 2,
                      minHeight: 2,
                    }} />
                  </View>
                );
              })}
            </View>
            {/* Hour labels */}
            <View style={{ flexDirection: 'row', marginTop: 4, gap: 2 }}>
              {hourData.map((h) => (
                <View key={h.Hour} style={{ flex: 1, alignItems: 'center' }}>
                  {h.Hour % 3 === 0 && (
                    <Text style={{ fontSize: 8, color: colors.textSecondary }}>{getHourLabel(h.Hour)}</Text>
                  )}
                </View>
              ))}
            </View>
            {/* Legend */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#EF4444' }} />
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>Peak (70%+)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#F59E0B' }} />
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>Medium</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colors.primary }} />
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>Low</Text>
              </View>
            </View>
          </View>
        </>
      );
    };

    const renderDeviceBrowserBreakdown = () => (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>💻 Device & Browser Breakdown ({activityDays}d)</Text>
          <Text style={styles.sectionSubtitle}>How users access the platform</Text>
        </View>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          {/* Device breakdown */}
          <Text style={[styles.userName, { fontSize: 13, marginBottom: 8, color: colors.textSecondary }]}>DEVICES</Text>
          {deviceBreakdown?.map((d, i) => (
            <BreakdownBar
              key={d.DeviceType || i}
              label={d.DeviceType?.charAt(0)?.toUpperCase() + d.DeviceType?.slice(1) || 'Unknown'}
              count={d.Count}
              total={deviceTotal}
              color={deviceColor(d.DeviceType)}
              icon={deviceIcon(d.DeviceType)}
              uniqueUsers={d.UniqueUsers}
            />
          ))}

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 14 }} />

          {/* Browser breakdown */}
          <Text style={[styles.userName, { fontSize: 13, marginBottom: 8, color: colors.textSecondary }]}>BROWSERS</Text>
          {browserBreakdown?.map((b, i) => (
            <BreakdownBar
              key={b.Browser || i}
              label={b.Browser || 'Unknown'}
              count={b.Count}
              total={browserTotal}
              color={browserColor(b.Browser)}
              icon={browserIcon(b.Browser)}
              uniqueUsers={b.UniqueUsers}
            />
          ))}
        </View>
      </>
    );

    const renderUserFlow = () => {
      if (!userFlow?.length) return null;
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔄 User Navigation Flow</Text>
            <Text style={styles.sectionSubtitle}>Most common screen transitions</Text>
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: colors.border }}>
              <Text style={[styles.userName, { flex: 2, fontSize: 11, color: colors.textSecondary }]}>FROM</Text>
              <Ionicons name="arrow-forward" size={12} color={colors.textSecondary} style={{ marginHorizontal: 6 }} />
              <Text style={[styles.userName, { flex: 2, fontSize: 11, color: colors.textSecondary }]}>TO</Text>
              <Text style={[styles.userName, { width: 50, fontSize: 11, color: colors.textSecondary, textAlign: 'right' }]}>COUNT</Text>
              <Text style={[styles.userName, { width: 45, fontSize: 11, color: colors.textSecondary, textAlign: 'right' }]}>USERS</Text>
            </View>
            {userFlow?.slice(0, 15).map((flow, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border + '40' }}>
                <View style={{ flex: 2 }}>
                  <Text style={[styles.userName, { fontSize: 12 }]}>{flow.FromScreen}</Text>
                </View>
                <Ionicons name="arrow-forward" size={12} color={colors.primary} style={{ marginHorizontal: 6 }} />
                <View style={{ flex: 2 }}>
                  <Text style={[styles.userName, { fontSize: 12 }]}>{flow.ToScreen}</Text>
                </View>
                <Text style={[styles.statValue, { width: 50, fontSize: 12, textAlign: 'right', color: colors.text }]}>{flow.TransitionCount}</Text>
                <Text style={[styles.userEmail, { width: 45, textAlign: 'right', fontSize: 11 }]}>{flow.UniqueUsers}</Text>
              </View>
            ))}
          </View>
        </>
      );
    };

    const renderActiveUsers = () => (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🟢 Currently Active Users</Text>
          <Text style={styles.sectionSubtitle}>{activeUsers?.length || 0} users online now</Text>
        </View>
        {activeUsers?.length > 0 ? (
          activeUsers.slice(0, 10).map((user, index) => (
            <ActiveUserCard key={user.UserID || index} user={user} index={index} />
          ))
        ) : (
          <View style={{ padding: 20, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, marginBottom: 12 }}>
            <Ionicons name="moon-outline" size={32} color={colors.textSecondary} />
            <Text style={[styles.userEmail, { marginTop: 8 }]}>No active users right now</Text>
          </View>
        )}
      </>
    );

    const renderScreenStats = () => (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📱 Most Visited Screens ({activityDays}d)</Text>
          <Text style={styles.sectionSubtitle}>Where users spend time</Text>
        </View>
        {screenStats?.slice(0, 10).map((screen, index) => (
          <View key={screen.ScreenName || index} style={[styles.userCard, { flexDirection: 'row', justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{screen.ScreenName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                <Text style={styles.userEmail}>{screen.UniqueUsers} users</Text>
                <Text style={[styles.userEmail, { color: colors.textSecondary }]}>•</Text>
                <Text style={styles.userEmail}>Avg {Math.round(screen.AvgDurationSeconds || 0)}s</Text>
                {screen.BounceRate != null && (
                  <>
                    <Text style={[styles.userEmail, { color: colors.textSecondary }]}>•</Text>
                    <Text style={[styles.userEmail, { color: screen.BounceRate > 60 ? '#EF4444' : '#10B981' }]}>
                      {Math.round(screen.BounceRate)}% bounce
                    </Text>
                  </>
                )}
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.statValue, { fontSize: 18 }]}>{screen.TotalViews?.toLocaleString()}</Text>
              <Text style={styles.userEmail}>views</Text>
            </View>
          </View>
        ))}
      </>
    );

    const renderDropOffs = () => (
      <>
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>🚪 Drop-off Points ({activityDays}d)</Text>
          <Text style={styles.sectionSubtitle}>Where users leave the app</Text>
        </View>
        {dropOffPoints?.slice(0, 5).map((point, index) => (
          <View key={point.ScreenName || index} style={[styles.userCard, { flexDirection: 'row', justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{point.ScreenName}</Text>
              <Text style={styles.userEmail}>{point.UniqueExits} users exited here</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: point.ExitRate > 50 ? '#EF444420' : '#F59E0B20' }]}>
              <Text style={[styles.badgeText, { color: point.ExitRate > 50 ? '#EF4444' : '#F59E0B' }]}>
                {Math.round(point.ExitRate || 0)}% exit rate
              </Text>
            </View>
          </View>
        ))}
      </>
    );

    const renderAllUsers = () => {
      if (!allUsersInPeriod?.length) return null;
      const sortedUsers = [...allUsersInPeriod].sort((a, b) => {
        if (activitySort === 'lastActive') {
          return new Date(b.LastSeen || 0) - new Date(a.LastSeen || 0);
        }
        return (b.TotalViews || 0) - (a.TotalViews || 0);
      });
      return (
        <>
          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <Text style={styles.sectionTitle}>👥 All Users with Activity ({activityDays}d)</Text>
            <Text style={styles.sectionSubtitle}>{allUsersInPeriod?.length} users</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => setActivitySort('views')}
              style={[styles.badge, { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: activitySort === 'views' ? colors.primary + '20' : colors.surface, borderWidth: 1, borderColor: activitySort === 'views' ? colors.primary : colors.border }]}
            >
              <Ionicons name="eye-outline" size={14} color={activitySort === 'views' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.badgeText, { marginLeft: 4, color: activitySort === 'views' ? colors.primary : colors.textSecondary, fontWeight: activitySort === 'views' ? '700' : '500' }]}>Most Views</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActivitySort('lastActive')}
              style={[styles.badge, { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: activitySort === 'lastActive' ? colors.primary + '20' : colors.surface, borderWidth: 1, borderColor: activitySort === 'lastActive' ? colors.primary : colors.border }]}
            >
              <Ionicons name="time-outline" size={14} color={activitySort === 'lastActive' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.badgeText, { marginLeft: 4, color: activitySort === 'lastActive' ? colors.primary : colors.textSecondary, fontWeight: activitySort === 'lastActive' ? '700' : '500' }]}>Last Active</Text>
            </TouchableOpacity>
          </View>
          {sortedUsers.slice(0, 20).map((user, index) => (
            <AllUsersCard key={user.UserID || index} user={user} index={index} />
          ))}
        </>
      );
    };

    return (
      <>
        {renderSummaryCards()}
        {renderDaysPicker()}

        {isDesktopView ? (
          <>
            {/* Row 1: Daily Trend + Hourly Pattern */}
            <View style={{ flexDirection: 'row', gap: 20 }}>
              <View style={{ flex: 1 }}>{renderDailyTrend()}</View>
              <View style={{ flex: 1 }}>{renderHourlyPattern()}</View>
            </View>

            {/* Row 2: Device/Browser + User Flow */}
            <View style={{ flexDirection: 'row', gap: 20 }}>
              <View style={{ flex: 1 }}>{renderDeviceBrowserBreakdown()}</View>
              <View style={{ flex: 1 }}>{renderUserFlow()}</View>
            </View>

            {/* Row 3: Active Users + Screen Stats */}
            <View style={{ flexDirection: 'row', gap: 20 }}>
              <View style={{ flex: 1 }}>
                {renderActiveUsers()}
                {renderAllUsers()}
              </View>
              <View style={{ flex: 1 }}>
                {renderScreenStats()}
                {renderDropOffs()}
              </View>
            </View>
          </>
        ) : (
          <>
            {renderDailyTrend()}
            {renderHourlyPattern()}
            {renderDeviceBrowserBreakdown()}
            {renderUserFlow()}
            {renderActiveUsers()}
            {renderScreenStats()}
            {renderDropOffs()}
            {renderAllUsers()}
          </>
        )}
      </>
    );
  };

  const renderResumeAnalyzerTab = () => {
    if (tabLoading.resumeAnalyzer && !resumeAnalyzerData) {
      return <TabLoadingSpinner />;
    }
    return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Resume Analyzer Usage</Text>
        <Text style={styles.sectionSubtitle}>
          Page {resumeAnalyzerPagination.page} of {resumeAnalyzerPagination.totalPages} ({resumeAnalyzerPagination.total} total)
        </Text>
      </View>
      
      {(resumeAnalyzerData || []).map((item, index) => (
        <View key={item.ResumeMetadataID || index} style={styles.resumeAnalyzerCard}>
          <View style={styles.resumeAnalyzerHeader}>
            <View style={[styles.emailStatusBadge, { backgroundColor: item.AIModel?.includes('gemini') ? '#4285F420' : '#10A37F20' }]}>
              <Ionicons 
                name={item.AIModel?.includes('gemini') ? 'sparkles' : 'hardware-chip'} 
                size={14} 
                color={item.AIModel?.includes('gemini') ? '#4285F4' : '#10A37F'} 
              />
              <Text style={[styles.emailStatusText, { color: item.AIModel?.includes('gemini') ? '#4285F4' : '#10A37F' }]}>
                {item.AIModel || 'N/A'}
              </Text>
            </View>
            {item.LastMatchScore !== null && (
              <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(item.LastMatchScore) + '20' }]}>
                <Text style={[styles.scoreText, { color: getScoreColor(item.LastMatchScore) }]}>
                  {item.LastMatchScore}%
                </Text>
              </View>
            )}
          </View>
          
          <Text style={styles.resumeFileName} numberOfLines={1}>{item.FileName || 'Unknown File'}</Text>
          
          {item.FullName && (
            <View style={styles.resumeInfoRow}>
              <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.resumeInfoText}>{item.FullName}</Text>
            </View>
          )}
          
          {item.Email && (
            <View style={styles.resumeInfoRow}>
              <Ionicons name="mail-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.resumeInfoText}>{item.Email}</Text>
            </View>
          )}
          
          {item.Mobile && (
            <View style={styles.resumeInfoRow}>
              <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.resumeInfoText}>{item.Mobile}</Text>
            </View>
          )}
          
          {item.UserName && (
            <View style={styles.resumeInfoRow}>
              <Ionicons name="person-circle-outline" size={14} color={colors.primary} />
              <Text style={[styles.resumeInfoText, { color: colors.primary }]}>User: {item.UserName}</Text>
            </View>
          )}
          
          <View style={styles.resumeMetaRow}>
            <Text style={styles.resumeMetaText}>
              Analyzed {item.AnalysisCount || 1}x
            </Text>
            <Text style={styles.resumeMetaText}>
              {new Date(item.LastAnalyzedAt || item.CreatedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      ))}

      {/* Pagination Controls */}
      <View style={styles.paginationContainer}>
        <TouchableOpacity 
          style={[styles.paginationButton, !resumeAnalyzerPagination.hasPrev && styles.paginationButtonDisabled]}
          onPress={() => resumeAnalyzerPagination.hasPrev && loadResumeAnalyzer(resumeAnalyzerPagination.page - 1)}
          disabled={!resumeAnalyzerPagination.hasPrev}
        >
          <Ionicons name="chevron-back" size={20} color={resumeAnalyzerPagination.hasPrev ? colors.primary : colors.textSecondary} />
          <Text style={[styles.paginationButtonText, !resumeAnalyzerPagination.hasPrev && styles.paginationButtonTextDisabled]}>Previous</Text>
        </TouchableOpacity>
        
        <Text style={styles.paginationInfo}>
          Page {resumeAnalyzerPagination.page} / {resumeAnalyzerPagination.totalPages}
        </Text>
        
        <TouchableOpacity 
          style={[styles.paginationButton, !resumeAnalyzerPagination.hasNext && styles.paginationButtonDisabled]}
          onPress={() => resumeAnalyzerPagination.hasNext && loadResumeAnalyzer(resumeAnalyzerPagination.page + 1)}
          disabled={!resumeAnalyzerPagination.hasNext}
        >
          <Text style={[styles.paginationButtonText, !resumeAnalyzerPagination.hasNext && styles.paginationButtonTextDisabled]}>Next</Text>
          <Ionicons name="chevron-forward" size={20} color={resumeAnalyzerPagination.hasNext ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </>
  );
  };

  // Social Share Claims Tab - Review and approve social media posts
  const renderSocialShareTab = () => {
    if (tabLoading.socialShare && !socialShareData) {
      return <TabLoadingSpinner />;
    }

    const claims = socialShareData?.claims || [];
    const stats = socialShareData?.stats || {};
    const isMobileView = responsive.isMobile;

    const handleApprove = async (claimId) => {
      try {
        const response = await refopenAPI.apiCall(`/management/social-share/claims/${claimId}/approve`, { method: 'POST' });
        if (response.success) {
          // Reload data
          loadedTabs.current.socialShare = false;
          loadSocialShare();
        } else {
          Alert.alert('Error', response.error || 'Failed to approve claim');
        }
      } catch (error) {
        console.error('Error approving claim:', error);
        Alert.alert('Error', 'Failed to approve claim');
      }
    };

    const handleReject = (claim) => {
      setSelectedSocialClaim(claim);
      setSocialRejectionReason('');
      setSocialRejectModalVisible(true);
    };

    const getPlatformIcon = (platform) => {
      switch (platform) {
        case 'LinkedIn': return 'logo-linkedin';
        case 'Twitter': return 'logo-twitter';
        case 'Instagram': return 'logo-instagram';
        case 'Facebook': return 'logo-facebook';
        default: return 'share-social';
      }
    };

    const getPlatformColor = (platform) => {
      switch (platform) {
        case 'LinkedIn': return '#0A66C2';
        case 'Twitter': return colors.text; // X uses theme text color
        case 'Instagram': return '#E4405F';
        case 'Facebook': return '#1877F2';
        default: return colors.primary;
      }
    };

    // Render platform icon - special case for X (Twitter)
    const renderPlatformIcon = (platform) => {
      if (platform === 'Twitter') {
        return <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>𝕏</Text>;
      }
      return <Ionicons name={getPlatformIcon(platform)} size={18} color={getPlatformColor(platform)} />;
    };

    return (
      <>
        {/* Stats */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📢 Social Share Claims</Text>
          <Text style={styles.sectionSubtitle}>Review and approve social media posts</Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <View style={[styles.statCard, { flex: 1, minWidth: 80, backgroundColor: '#F59E0B20' }]}>
            <Text style={[styles.statValue, { color: colors.text, fontSize: isMobileView ? 20 : 24 }]}>{stats.pending || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: isMobileView ? 11 : 12 }]}>Pending</Text>
          </View>
          <View style={[styles.statCard, { flex: 1, minWidth: 80, backgroundColor: '#10B98120' }]}>
            <Text style={[styles.statValue, { color: colors.text, fontSize: isMobileView ? 20 : 24 }]}>{stats.approved || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: isMobileView ? 11 : 12 }]}>Approved</Text>
          </View>
          <View style={[styles.statCard, { flex: 1, minWidth: 80, backgroundColor: '#EF444420' }]}>
            <Text style={[styles.statValue, { color: colors.text, fontSize: isMobileView ? 20 : 24 }]}>{stats.rejected || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: isMobileView ? 11 : 12 }]}>Rejected</Text>
          </View>
        </View>

        {/* Claims List */}
        {claims.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="megaphone-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { marginTop: 12 }]}>No social share claims yet</Text>
          </View>
        ) : (
          <View style={{ width: '100%' }}>
            {claims.map((claim, index) => (
              <View key={claim.ClaimID || index} style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border
              }}>
                {/* Row 1: Platform + Name + Email */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ 
                    backgroundColor: getPlatformColor(claim.Platform) + '20', 
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12
                  }}>
                    {renderPlatformIcon(claim.Platform)}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{claim.FirstName} {claim.LastName}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{claim.Email}</Text>
                  </View>
                </View>

                {/* Row 2: Status Badge */}
                <View style={{
                  backgroundColor: claim.Status === 'Pending' ? '#F59E0B20' : 
                                   claim.Status === 'Approved' ? '#10B98120' : '#EF444420',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                  alignSelf: 'flex-start',
                  marginBottom: 12
                }}>
                  <Text style={{ 
                    color: claim.Status === 'Pending' ? '#F59E0B' : 
                           claim.Status === 'Approved' ? '#10B981' : '#EF4444',
                    fontSize: 13,
                    fontWeight: '600'
                  }}>{claim.Status}</Text>
                </View>

                {/* Row 3: Rejection Reason (only if rejected) */}
                {claim.Status === 'Rejected' && claim.RejectionReason && (
                  <View style={{ 
                    backgroundColor: '#EF444410', 
                    padding: 12, 
                    borderRadius: 8,
                    marginBottom: 12
                  }}>
                    <Text style={{ color: '#EF4444', fontSize: 13 }}>
                      <Text style={{ fontWeight: '600' }}>Reason: </Text>
                      {claim.RejectionReason}
                    </Text>
                  </View>
                )}

                {/* Row 4: Details */}
                <View style={{ marginBottom: claim.Status === 'Pending' ? 12 : 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name="gift-outline" size={16} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, marginLeft: 8, fontSize: 14 }}>Reward: ₹{claim.RewardAmount}</Text>
                  </View>
                  
                  {claim.PostURL && (
                    <TouchableOpacity 
                      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                      onPress={() => Linking.openURL(claim.PostURL)}
                    >
                      <Ionicons name="link-outline" size={16} color={colors.primary} />
                      <Text style={{ marginLeft: 8, color: colors.primary, fontSize: 14 }}>View Post</Text>
                    </TouchableOpacity>
                  )}
                  
                  {claim.ScreenshotURL && (
                    <TouchableOpacity 
                      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                      onPress={() => Linking.openURL(claim.ScreenshotURL)}
                    >
                      <Ionicons name="image-outline" size={16} color={colors.primary} />
                      <Text style={{ marginLeft: 8, color: colors.primary, fontSize: 14 }}>View Screenshot</Text>
                    </TouchableOpacity>
                  )}
                  
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                    Submitted: {new Date(claim.CreatedAt).toLocaleDateString('en-US', { 
                      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}
                  </Text>
                </View>

                {/* Row 5: Action Buttons (only for Pending) */}
                {claim.Status === 'Pending' && (
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity 
                      style={{ 
                        flex: 1, 
                        backgroundColor: '#10B981', 
                        paddingVertical: 12,
                        borderRadius: 8,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                      onPress={() => handleApprove(claim.ClaimID)}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 6 }}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={{ 
                        flex: 1, 
                        backgroundColor: '#EF4444', 
                        paddingVertical: 12,
                        borderRadius: 8,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}
                      onPress={() => handleReject(claim)}
                    >
                      <Ionicons name="close" size={18} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 6 }}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </>
    );
  };

  // ─── Verifications Tab ─────────────────────
  const renderVerificationsTab = () => {
    if (tabLoading.verifications && !verificationsData) {
      return <TabLoadingSpinner />;
    }

    const verifications = Array.isArray(verificationsData) ? verificationsData : [];
    const isMobileView = responsive.isMobile;

    const handleApproveVerification = async (verificationId) => {
      try {
        const response = await refopenAPI.apiCall(`/management/verifications/${verificationId}/approve`, { method: 'POST' });
        if (response.success) {
          loadedTabs.current.verifications = false;
          loadVerifications();
          showToast('Verification approved! User now has blue tick.', 'success');
        } else {
          Alert.alert('Error', response.error || 'Failed to approve');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to approve verification');
      }
    };

    const handleRejectVerification = (verification) => {
      setSelectedVerification(verification);
      setVerificationRejectionReason('');
      setVerificationRejectModalVisible(true);
    };

    const getMethodLabel = (method) => {
      switch (method) {
        case 'Aadhaar': return '🪪 Aadhaar Card';
        case 'CollegeEmail': return '🎓 College Email';
        case 'CompanyEmail': return '🏢 Company Email';
        default: return method;
      }
    };

    const getMethodColor = (method) => {
      switch (method) {
        case 'Aadhaar': return '#F59E0B';
        case 'CollegeEmail': return '#8B5CF6';
        case 'CompanyEmail': return '#3B82F6';
        default: return colors.primary;
      }
    };

    return (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🛡️ Pending Verifications</Text>
          <Text style={styles.sectionSubtitle}>Review and approve user verification requests</Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <View style={[styles.statCard, { flex: 1, minWidth: 80, backgroundColor: '#F59E0B20' }]}>
            <Text style={[styles.statValue, { color: colors.text, fontSize: isMobileView ? 20 : 24 }]}>{verifications.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary, fontSize: isMobileView ? 11 : 12 }]}>Pending</Text>
          </View>
        </View>

        {verifications.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { marginTop: 12 }]}>No pending verifications</Text>
          </View>
        ) : (
          <View style={{ width: '100%' }}>
            {verifications.map((v, index) => (
              <View key={v.VerificationID || index} style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: getMethodColor(v.Method) + '40',
              }}>
                {/* Header: Method badge + User info */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{
                    backgroundColor: getMethodColor(v.Method) + '20',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 6,
                    marginRight: 10,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: getMethodColor(v.Method) }}>
                      {getMethodLabel(v.Method)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {new Date(v.CreatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                {/* User details */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  {v.ProfilePictureURL ? (
                    <Image source={{ uri: v.ProfilePictureURL }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                  ) : (
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name="person" size={20} color={colors.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{v.FirstName} {v.LastName}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{v.Email}</Text>
                    {v.Phone && <Text style={{ fontSize: 12, color: colors.textSecondary }}>{v.Phone}</Text>}
                  </View>
                </View>

                {/* College name for college email */}
                {v.CollegeName && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#8B5CF610', padding: 8, borderRadius: 8 }}>
                    <Ionicons name="school" size={16} color="#8B5CF6" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 13, color: colors.text, fontWeight: '500' }}>{v.CollegeName}</Text>
                  </View>
                )}

                {/* Aadhaar photos */}
                {v.Method === 'Aadhaar' && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>Submitted Documents:</Text>
                    <View style={{ flexDirection: isMobileView ? 'column' : 'row', gap: 12 }}>
                      {v.AadhaarPhotoURL && (
                        <TouchableOpacity
                          onPress={() => {
                            if (Platform.OS === 'web') {
                              window.open(v.AadhaarPhotoURL, '_blank');
                            } else {
                              Linking.openURL(v.AadhaarPhotoURL).catch(() => {});
                            }
                          }}
                          style={{ flex: 1 }}
                        >
                          <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }}>Aadhaar Card</Text>
                          <Image
                            source={{ uri: v.AadhaarPhotoURL }}
                            style={{ width: '100%', height: 180, borderRadius: 8, backgroundColor: colors.border }}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      )}
                      {v.SelfiePhotoURL && (
                        <TouchableOpacity
                          onPress={() => {
                            if (Platform.OS === 'web') {
                              window.open(v.SelfiePhotoURL, '_blank');
                            } else {
                              Linking.openURL(v.SelfiePhotoURL).catch(() => {});
                            }
                          }}
                          style={{ flex: 1 }}
                        >
                          <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }}>Selfie Photo</Text>
                          <Image
                            source={{ uri: v.SelfiePhotoURL }}
                            style={{ width: '100%', height: 180, borderRadius: 8, backgroundColor: colors.border }}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {/* Approve / Reject buttons */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#10B981',
                      paddingVertical: 12,
                      borderRadius: 8,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                    onPress={() => handleApproveVerification(v.VerificationID)}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 6 }}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#EF4444',
                      paddingVertical: 12,
                      borderRadius: 8,
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                    onPress={() => handleRejectVerification(v)}
                  >
                    <Ionicons name="close-circle" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 6 }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </>
    );
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#22C55E';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return '#F59E0B';
      case 'claimed': return colors.primary;
      case 'completed': return '#10B981';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        {renderTabs()}
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'users' && renderUsersTab()}
          {activeTab === 'activity' && renderActivityTab()}
          {activeTab === 'services' && renderServicesTab()}
          {activeTab === 'referrals' && renderReferralsTab()}
          {activeTab === 'transactions' && renderTransactionsTab()}
          {activeTab === 'emailLogs' && renderEmailLogsTab()}
          {activeTab === 'resumeAnalyzer' && renderResumeAnalyzerTab()}
        </ScrollView>
      </View>
    </View>
  );
}

const createStyles = (colors, responsive = {}) => {
  const { isMobile = true, isDesktop = false, isTablet = false } = responsive;
  const cardWidth = isDesktop ? 220 : isTablet ? 180 : 150;
  const gridColumns = isDesktop ? 4 : isTablet ? 3 : 2;
  const contentPadding = isDesktop ? 24 : 16;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      ...(Platform.OS === 'web' && isDesktop ? { alignItems: 'center' } : {}),
    },
    innerContainer: {
      flex: 1,
      width: '100%',
      maxWidth: Platform.OS === 'web' && isDesktop ? 1200 : '100%',
      ...(Platform.OS === 'web' ? { overflow: 'hidden' } : {}),
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 12,
      color: colors.textSecondary,
      fontSize: 16,
    },
    tabLoadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    tabLoadingText: {
      marginTop: 12,
      color: colors.textSecondary,
      fontSize: 14,
    },
    accessDenied: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    accessDeniedTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 16,
    },
    accessDeniedText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    backButton: {
      marginTop: 24,
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: colors.primary,
      borderRadius: 8,
    },
    backButtonText: {
      color: '#FFF',
      fontWeight: '600',
    },
    tabsContainer: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      maxHeight: 56,
      ...(isDesktop && { justifyContent: 'center' }),
      // Fixed position for web
      ...(Platform.OS === 'web' && {
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }),
    },
    tabsContent: {
      paddingHorizontal: contentPadding,
      paddingVertical: 8,
      gap: isDesktop ? 12 : 8,
      flexDirection: 'row',
      alignItems: 'center',
      ...(isDesktop && { justifyContent: 'center' }),
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: isDesktop ? 20 : 14,
      paddingVertical: isDesktop ? 10 : 8,
      borderRadius: 20,
      backgroundColor: colors.background,
      marginRight: isDesktop ? 12 : 8,
      gap: 6,
      height: isDesktop ? 44 : 40,
    },
    tabActive: {
      backgroundColor: colors.primary + '15',
    },
    tabText: {
      fontSize: isDesktop ? 15 : 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: contentPadding,
      paddingBottom: 100,
    },
    sectionHeader: {
      marginTop: isDesktop ? 24 : 16,
      marginBottom: isDesktop ? 16 : 12,
    },
    sectionTitle: {
      fontSize: isDesktop ? 20 : 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    sectionSubtitle: {
      fontSize: isDesktop ? 14 : 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    quickActionCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickActionIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quickActionContent: {
      flex: 1,
      marginLeft: 12,
    },
    quickActionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    quickActionSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    statsScroll: {
      marginHorizontal: -contentPadding,
    },
    statsRow: {
      flexDirection: 'row',
      paddingHorizontal: contentPadding,
      gap: isDesktop ? 16 : 12,
      ...(isDesktop && { flexWrap: 'wrap' }),
    },
    gridRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: isDesktop ? 16 : 12,
    },
    statCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: isDesktop ? 20 : 16,
      width: cardWidth,
      minWidth: isDesktop ? 200 : cardWidth,
      flex: isDesktop ? 1 : 0,
      maxWidth: isDesktop ? 280 : cardWidth,
      borderLeftWidth: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    statCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: isDesktop ? 12 : 8,
    },
    statIconBg: {
      width: isDesktop ? 44 : 36,
      height: isDesktop ? 44 : 36,
      borderRadius: isDesktop ? 22 : 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: isDesktop ? 16 : 12,
    },
    statValue: {
      fontSize: isDesktop ? 28 : 24,
      fontWeight: 'bold',
      color: colors.text,
    },
    statLabel: {
      fontSize: isDesktop ? 13 : 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    statTitle: {
      fontSize: isDesktop ? 14 : 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    statSubtitle: {
      fontSize: isDesktop ? 12 : 11,
      color: colors.gray500,
      marginTop: 2,
    },
    walletCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: isDesktop ? 24 : 20,
      marginTop: 8,
    },
    walletRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: isDesktop ? 12 : 8,
    },
    walletLabel: {
      fontSize: isDesktop ? 16 : 14,
      color: colors.textSecondary,
    },
    walletAmount: {
      fontSize: isDesktop ? 28 : 24,
      fontWeight: 'bold',
      color: '#10B981',
    },
    walletCount: {
      fontSize: isDesktop ? 22 : 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: isDesktop ? 20 : 16,
      marginBottom: 12,
    },
    userAvatar: {
      width: isDesktop ? 56 : 48,
      height: isDesktop ? 56 : 48,
      borderRadius: isDesktop ? 28 : 24,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: isDesktop ? 16 : 12,
    },
    userAvatarImage: {
      width: isDesktop ? 56 : 48,
      height: isDesktop ? 56 : 48,
      borderRadius: isDesktop ? 28 : 24,
      marginRight: isDesktop ? 16 : 12,
    },
    userAvatarText: {
      fontSize: isDesktop ? 20 : 18,
      fontWeight: 'bold',
      color: colors.primary,
    },
    userRightSection: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: isDesktop ? 17 : 16,
      fontWeight: '600',
      color: colors.text,
    },
    userEmail: {
      fontSize: isDesktop ? 14 : 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    userMeta: {
      flexDirection: 'row',
      marginTop: 6,
      gap: isDesktop ? 12 : 8,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isDesktop ? 10 : 8,
      paddingVertical: isDesktop ? 3 : 2,
      borderRadius: 10,
    },
    badgeText: {
      fontSize: isDesktop ? 12 : 11,
      fontWeight: '600',
    },
    userDate: {
      fontSize: isDesktop ? 13 : 12,
      color: colors.gray500,
    },
    referralCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: isDesktop ? 20 : 16,
      marginBottom: 12,
    },
    referralHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    referralTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    referralCompany: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    referralMeta: {
      flexDirection: 'row',
      marginTop: 8,
      gap: 16,
    },
    referralBy: {
      fontSize: 12,
      color: colors.gray500,
    },
    referralClaimed: {
      fontSize: isDesktop ? 13 : 12,
      color: colors.primary,
    },
    referralDate: {
      fontSize: isDesktop ? 12 : 11,
      color: colors.gray400,
      marginTop: 8,
    },
    transactionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: isDesktop ? 20 : 16,
      marginBottom: 12,
    },
    txIcon: {
      width: isDesktop ? 52 : 44,
      height: isDesktop ? 52 : 44,
      borderRadius: isDesktop ? 26 : 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: isDesktop ? 16 : 12,
    },
    txInfo: {
      flex: 1,
    },
    txDescription: {
      fontSize: isDesktop ? 15 : 14,
      fontWeight: '600',
      color: colors.text,
    },
    txUser: {
      fontSize: isDesktop ? 13 : 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    txDate: {
      fontSize: isDesktop ? 12 : 11,
      color: colors.gray500,
      marginTop: 4,
    },
    txAmount: {
      fontSize: isDesktop ? 18 : 16,
      fontWeight: 'bold',
    },
    // Payment tab styles
    paymentCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    paymentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    paymentAmount: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
    },
    paymentDetails: {
      marginBottom: 12,
    },
    paymentRow: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    paymentLabel: {
      width: 100,
      fontSize: 13,
      color: colors.textSecondary,
    },
    paymentValue: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      fontWeight: '500',
    },
    paymentActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      gap: 6,
    },
    approveButton: {
      backgroundColor: '#10B981',
    },
    rejectButton: {
      backgroundColor: '#EF4444',
    },
    actionButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    socialIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Modal styles for Social Share Rejection
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContainer: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 450,
    },
    modalHeader: {
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 12,
    },
    claimSummary: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      alignItems: 'center',
    },
    claimUser: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    claimPlatform: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    modalLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    modalInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      fontSize: 14,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 80,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    modalButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
      borderRadius: 12,
      gap: 8,
    },
    modalCancelButton: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalCancelText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 14,
    },
    modalRejectButton: {
      backgroundColor: '#EF4444',
    },
    modalRejectText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    emptyText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textSecondary,
    },
    // Email Log styles
    emailLogCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: isDesktop ? 20 : 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emailLogHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    emailStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    emailStatusText: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    emailType: {
      fontSize: 12,
      color: colors.textSecondary,
      backgroundColor: colors.background,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    emailSubject: {
      fontSize: isDesktop ? 15 : 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emailRecipient: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    emailRecipientText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    emailDate: {
      fontSize: 12,
      color: colors.gray500,
    },
    paginationContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 10,
    },
    paginationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.surface,
      gap: 4,
    },
    paginationButtonDisabled: {
      opacity: 0.5,
    },
    paginationButtonText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    paginationButtonTextDisabled: {
      color: colors.textSecondary,
    },
    paginationInfo: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    // Resume Analyzer Tab Styles
    resumeAnalyzerCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resumeAnalyzerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    scoreBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    scoreText: {
      fontSize: 14,
      fontWeight: '600',
    },
    resumeFileName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    resumeInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    resumeInfoText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    resumeMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    resumeMetaText: {
      fontSize: 12,
      color: colors.gray500,
    },
  });
};
