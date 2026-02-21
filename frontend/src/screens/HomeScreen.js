import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Dimensions,
  TextInput,
  FlatList,
  Animated,
  Modal,
} from 'react-native';
import CachedImage from '../components/CachedImage';
import AddWorkExperienceModal from '../components/profile/AddWorkExperienceModal';
import VerifiedReferrerOverlay from '../components/VerifiedReferrerOverlay';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import refopenAPI from '../services/api';
import { typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import AdCard from '../components/ads/AdCard'; // Google AdSense Ad
import useResponsive from '../hooks/useResponsive';
import { ResponsiveContainer, ResponsiveGrid } from '../components/common/ResponsiveLayout';
import { showToast } from '../components/Toast';
import TabHeader from '../components/TabHeader';
import EngagementHub from '../components/engagement/EngagementHub';
import { getCached, hasCached, setCache, CACHE_KEYS } from '../utils/homeCache';

const { width } = Dimensions.get('window');

// ⚡ PERF: Extracted OUTSIDE component — React sees stable component types,
// no unmount/remount of native view subtrees on parent re-render.

const getStatusColor = (statusId, colors) => {
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

const formatJobDate = (job) => {
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

const HomeJobCard = React.memo(({ job, styles, colors, onPress }) => (
  <TouchableOpacity style={styles.jobCard} onPress={onPress}>
    <View style={styles.jobHeader}>
      <Text style={styles.jobTitle} numberOfLines={1}>{job.Title}</Text>
      <Text style={styles.jobCompany}>{job.OrganizationName}</Text>
    </View>
    <Text style={styles.jobLocation}>{job.Location}</Text>
    <View style={styles.jobMeta}>
      <View style={styles.jobTypeTag}>
        <Text style={styles.jobTypeText}>{job.JobTypeName}</Text>
      </View>
      <Text style={styles.jobDate}>{formatJobDate(job)}</Text>
    </View>
  </TouchableOpacity>
));

const HomeApplicationCard = React.memo(({ application, styles, colors, onPress }) => (
  <TouchableOpacity style={styles.applicationCard} onPress={onPress}>
    <View style={styles.applicationHeader}>
      <Text style={styles.applicationTitle} numberOfLines={1}>{application.JobTitle}</Text>
      <View style={[styles.applicationStatus, { backgroundColor: getStatusColor(application.StatusID, colors) + '20' }]}>
        <Text style={[styles.applicationStatusText, { color: getStatusColor(application.StatusID, colors) }]}>
          {getStatusText(application.StatusID)}
        </Text>
      </View>
    </View>
    <Text style={styles.applicationCompany}>{application.CompanyName}</Text>
    <Text style={styles.applicationDate}>Applied {new Date(application.SubmittedAt).toLocaleDateString()}</Text>
  </TouchableOpacity>
));

const HomeSectionLoader = React.memo(({ styles, colors }) => (
  <View style={styles.sectionLoader}>
    <ActivityIndicator size="small" color={colors.primary} />
    <Text style={styles.sectionLoaderText}>Loading...</Text>
  </View>
));

export default function HomeScreen({ navigation }) {
const { user, isEmployer, isJobSeeker, isAdmin, isVerifiedUser, currentWork, refreshVerificationStatus } = useAuth();
const { colors } = useTheme();
const responsive = useResponsive();
const { isMobile, isDesktop, isTablet, contentWidth, gridColumns, statColumns } = responsive;
const styles = React.useMemo(() => createStyles(colors, responsive), [colors, responsive]);
const [refreshing, setRefreshing] = useState(false);

// Organization search state
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState([]);
const [searchLoading, setSearchLoading] = useState(false);
const [showSearchResults, setShowSearchResults] = useState(false);
  
// ⚡ PERF: Loading states initialized from cache — if cache exists, NO loading spinners!
const [loadingStats, setLoadingStats] = useState(!hasCached(CACHE_KEYS.DASHBOARD_STATS));
const [loadingJobs, setLoadingJobs] = useState(!hasCached(CACHE_KEYS.RECENT_JOBS));
const [loadingF500Jobs, setLoadingF500Jobs] = useState(!hasCached(CACHE_KEYS.F500_JOBS));
const [loadingApplications, setLoadingApplications] = useState(!hasCached(CACHE_KEYS.RECENT_APPLICATIONS));

// 🎯 Fortune 500 companies for Get Referrals card — initialized from cache
const [fortune500Companies, setFortune500Companies] = useState(() => getCached(CACHE_KEYS.F500_COMPANIES) || []);
const f500LogoScrollRef = useRef(null);
const f500ScrollPositionRef = useRef(0);
const scrollIntervalRef = useRef(null);



// 🎯 NEW: Loading state for navigating to verify referrer
const [navigatingToVerify, setNavigatingToVerify] = useState(false);

// 🎯 Verification flow states
const [showConfirmCompanyModal, setShowConfirmCompanyModal] = useState(false);
const [showAddWorkModal, setShowAddWorkModal] = useState(false);
const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false);
const [currentWorkExperience, setCurrentWorkExperience] = useState(null);
const [workExperiences, setWorkExperiences] = useState([]);
const [showVerifiedOverlay, setShowVerifiedOverlay] = useState(false);
const [verifiedCompanyName, setVerifiedCompanyName] = useState('');

// 🎯 Referrer requests (referrals that came to me) — initialized from cache
const [myReferrerRequests, setMyReferrerRequests] = useState(() => getCached(CACHE_KEYS.REFERRER_REQUESTS) || []);

// 🎯 Social share claims — initialized from cache
const [approvedSocialPlatforms, setApprovedSocialPlatforms] = useState(() => getCached(CACHE_KEYS.SOCIAL_CLAIMS) || []);

// 🎯 Wallet balance for header badge — initialized from cache
const [walletBalance, setWalletBalance] = useState(() => getCached(CACHE_KEYS.WALLET_BALANCE) ?? null);
  
const [dashboardData, setDashboardData] = useState(() => {
  // ⚡ PERF: Initialize from cache — instant render, no loading spinners
  const cachedStats = getCached(CACHE_KEYS.DASHBOARD_STATS);
  const cachedJobs = getCached(CACHE_KEYS.RECENT_JOBS);
  const cachedF500 = getCached(CACHE_KEYS.F500_JOBS);
  const cachedApps = getCached(CACHE_KEYS.RECENT_APPLICATIONS);
  return {
    stats: cachedStats || {},
    recentJobs: cachedJobs || [],
    f500Jobs: cachedF500 || [],
    recentApplications: cachedApps || [],
    referralStats: {}
  };
});
  
// ✅ NEW: Scroll ref for scroll-to-top functionality
  const scrollViewRef = React.useRef(null);

  // ⚡ AbortController: cancel in-flight API calls when user leaves this tab
  // so the destination screen's API calls get network/JS-thread priority.
  const abortRef = useRef(null);

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

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    // ⚡ Abort any previous in-flight fetch
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const sig = { signal: ac.signal };

    // Only show loading spinners if NO cache exists (first ever load)
    // On refresh, we already have data visible — no spinners needed
    if (isRefresh || hasCached(CACHE_KEYS.DASHBOARD_STATS)) {
      // Don't show spinners — cached data is already visible
    } else {
      setLoadingStats(true);
      setLoadingJobs(true);
      setLoadingF500Jobs(true);
      setLoadingApplications(true);
    }

    // ⚡ All 8 fetches in parallel — each saves to cache on success
    
    // 1. Dashboard Stats
    const statsPromise = refopenAPI.apiCall('/users/dashboard-stats', sig)
      .then(res => {
        if (res.success) {
          const stats = res.data || {};
          setCache(CACHE_KEYS.DASHBOARD_STATS, stats);
          setDashboardData(prev => ({ ...prev, stats }));
        }
      })
      .catch(err => { if (err?.name !== 'AbortError') console.warn('Dashboard stats failed:', err); })
      .finally(() => setLoadingStats(false));

    // 2. Recommended Jobs
    let jobsPromise = Promise.resolve();
    if (isJobSeeker) {
      jobsPromise = (async () => {
        try {
          const res = await refopenAPI.getJobs(1, 5, {}, sig);
          if (res.success) {
            const recentJobs = (res.data || []).slice(0, 5);
            setCache(CACHE_KEYS.RECENT_JOBS, recentJobs);
            setDashboardData(prev => ({ ...prev, recentJobs }));
          }
        } catch (err) { if (err?.name !== 'AbortError') console.warn('Jobs failed:', err); }
        finally { setLoadingJobs(false); }
      })();
    } else { setLoadingJobs(false); }

    // 3. F500 Jobs
    let f500JobsPromise = Promise.resolve();
    if (isJobSeeker) {
      f500JobsPromise = (async () => {
        try {
          const res = await refopenAPI.getJobs(1, 5, { isFortune500: true }, sig);
          if (res.success) {
            const f500Jobs = (res.data || []).slice(0, 5);
            setCache(CACHE_KEYS.F500_JOBS, f500Jobs);
            setDashboardData(prev => ({ ...prev, f500Jobs }));
          }
        } catch (err) { if (err?.name !== 'AbortError') console.warn('F500 jobs failed:', err); }
        finally { setLoadingF500Jobs(false); }
      })();
    } else { setLoadingF500Jobs(false); }

    // 4. Applications
    let applicationsPromise = Promise.resolve();
    if (isJobSeeker) {
      applicationsPromise = (async () => {
        try {
          const res = await refopenAPI.getMyApplications(1, 3, sig);
          if (res.success) {
            const recentApplications = (res.data || []).slice(0, 3);
            setCache(CACHE_KEYS.RECENT_APPLICATIONS, recentApplications);
            setDashboardData(prev => ({ ...prev, recentApplications }));
          }
        } catch (err) { if (err?.name !== 'AbortError') console.warn('Applications failed:', err); }
        finally { setLoadingApplications(false); }
      })();
    }

    // 5. Fortune 500 Companies (logos)
    let f500CompaniesPromise = Promise.resolve();
    if (isJobSeeker) {
      f500CompaniesPromise = (async () => {
        try {
          const result = await refopenAPI.getOrganizations('', 500, 0, { isFortune500: true, ...sig });
          if (result.success && result.data) {
            const f500WithLogos = result.data
              .filter(org => org.logoURL)
              .map(org => ({ ...org, referrerCount: Math.floor(Math.random() * 120) }))
              .sort(() => Math.random() - 0.5);
            setCache(CACHE_KEYS.F500_COMPANIES, f500WithLogos);
            setFortune500Companies(f500WithLogos);
          }
        } catch (err) { if (err?.name !== 'AbortError') console.warn('F500 companies failed:', err); }
      })();
    }

    // 6. Social share claims
    const socialSharePromise = (async () => {
      try {
        const result = await refopenAPI.apiCall('/social-share/my-claims', sig);
        if (result.success) {
          const claims = Array.isArray(result.data) ? result.data : (result.data?.claims || []);
          const approved = claims.filter(c => c.Status === 'Approved').map(c => c.Platform);
          setCache(CACHE_KEYS.SOCIAL_CLAIMS, approved);
          setApprovedSocialPlatforms(approved);
        }
      } catch (err) { if (err?.name !== 'AbortError') console.warn('Social share failed:', err); }
    })();

    // 7. Wallet balance
    const walletPromise = (async () => {
      try {
        const result = await refopenAPI.apiCall('/wallet', sig);
        if (result.success && result.data) {
          const balance = result.data.Balance ?? result.data.balance ?? 0;
          setCache(CACHE_KEYS.WALLET_BALANCE, balance);
          setWalletBalance(balance);
        }
      } catch (err) { if (err?.name !== 'AbortError') console.warn('Wallet failed:', err); }
    })();

    // 8. Referrer requests
    let referrerRequestsPromise = Promise.resolve();
    if (isJobSeeker) {
      referrerRequestsPromise = (async () => {
        try {
          const result = await refopenAPI.getMyReferrerRequests(1, 10, sig);
          if (result.success && result.data) {
            const requests = result.data.requests || result.data || [];
            const activeRequests = Array.isArray(requests) 
              ? requests.filter(r => r.StatusID === 1 || r.Status === 'Pending')
              : [];
            setCache(CACHE_KEYS.REFERRER_REQUESTS, activeRequests);
            setMyReferrerRequests(activeRequests);
          }
        } catch (err) { if (err?.name !== 'AbortError') console.warn('Referrer requests failed:', err); }
      })();
    }

    Promise.all([
      statsPromise, jobsPromise, f500JobsPromise, applicationsPromise,
      f500CompaniesPromise, referrerRequestsPromise, socialSharePromise, walletPromise
    ]).catch(err => {
      if (err?.name === 'AbortError') return;
      console.error('Error in dashboard data fetch:', err);
    });

  }, [isJobSeeker, isEmployer, user]);

  // Initial data fetch on mount
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ⚡ No focus listener for data — mount + pull-to-refresh only.
  // But we DO abort in-flight fetches on blur so the destination screen gets priority.
  useFocusEffect(
    useCallback(() => {
      // On focus: nothing (data already loaded on mount)
      return () => {
        // On blur: abort any in-flight Home API calls
        if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
      };
    }, [])
  );

  // ⚡ PERF: scroll-to-top on focus REMOVED — was triggering layout recalculation
  // of entire ScrollView on every tab switch. Users expect scroll position preserved.

  // 🎯 Handler for "Become a Verified Referrer" button
  const handleBecomeVerifiedReferrer = useCallback(async () => {
    setNavigatingToVerify(true);
    try {
      // Use cached currentWork for instant display if available
      if (currentWork) {
        setCurrentWorkExperience(currentWork);
        setShowConfirmCompanyModal(true);
        setNavigatingToVerify(false);
        return;
      }
      
      // Fetch user's work experiences if not cached
      const res = await refopenAPI.getMyWorkExperiences();
      if (res.success && res.data) {
        setWorkExperiences(res.data);
        // Find current work experience
        const current = res.data.find(exp => exp.IsCurrent === 1 || exp.IsCurrent === true);
        if (current) {
          setCurrentWorkExperience(current);
          setShowConfirmCompanyModal(true);
        } else {
          // No current company, show add work experience modal directly
          setCurrentWorkExperience(null);
          setShowAddWorkModal(true);
        }
      } else {
        // No work experiences, show add work experience modal
        setCurrentWorkExperience(null);
        setShowAddWorkModal(true);
      }
    } catch (error) {
      console.error('Error fetching work experiences:', error);
      showToast('Failed to load your work experiences. Please try again.', 'error');
    } finally {
      setNavigatingToVerify(false);
    }
  }, []);

  // 🎯 Auto-scroll Fortune 500 logos — uses ref.scrollTo instead of setState
  // to avoid re-rendering the entire 1966-line component every 2 seconds.
  useEffect(() => {
    if (fortune500Companies.length > 3 && isJobSeeker) {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
      const logoItemWidth = 70;
      const maxScroll = (fortune500Companies.length - 3) * logoItemWidth;
      f500ScrollPositionRef.current = 0;
      scrollIntervalRef.current = setInterval(() => {
        const next = f500ScrollPositionRef.current + logoItemWidth;
        f500ScrollPositionRef.current = next >= maxScroll ? 0 : next;
        f500LogoScrollRef.current?.scrollTo({ x: f500ScrollPositionRef.current, animated: true });
      }, 2000);
      return () => clearInterval(scrollIntervalRef.current);
    }
  }, [fortune500Companies.length, isJobSeeker]);

  // Helper function to format referrer count
  const formatReferrerCount = (count) => {
    if (count > 99) return '99+';
    return count.toString();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData(true);
    setRefreshing(false);
  };

  // ⚡ PERF: JobCard, ApplicationCard, SectionLoader extracted OUTSIDE
  // component body (above) — prevents native view unmount/remount on re-render.

  // ⚡ Remove the global loading screen - show content immediately

  const { stats, recentJobs, recentApplications, referralStats } = dashboardData;

  return (
    <>
      {/* Compact Header with Search - OUTSIDE ScrollView for proper z-index */}
      <TabHeader
        navigation={navigation}
        showWallet={true}
        walletBalance={walletBalance}
        onProfileSliderOpen={() => {
          // Abort Home's heavy API calls so ProfileSlider gets network priority
          if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
        }}
        centerContent={
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
                        navigation.navigate('OrganizationDetails', { 
                          organizationId: item.id 
                        });
                        setShowSearchResults(false);
                        setSearchQuery('');
                      }}
                    >
                      {item.logoURL ? (
                        <CachedImage 
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
        }
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer style={styles.responsiveContent}>

        {/* Enhanced Quick Actions for Job Seekers */}
        <View style={styles.actionsContainer}>
          
          {isAdmin ? (
            <>
              {/* Admin cards - Quick access to admin functions */}
              <View style={styles.secondaryCardsContainer}>
                <TouchableOpacity 
                  style={styles.quickActionCard}
                  onPress={() => navigation.navigate('ActionCenter')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#EF4444' + '20' }]}>
                    <Ionicons name="flash" size={24} color="#EF4444" />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionTitle}>Action Center</Text>
                    <Text style={styles.quickActionDescription}>Verifications, payments, social share, support</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.quickActionCard}
                  onPress={() => navigation.navigate('Admin')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="stats-chart" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionTitle}>Analytics</Text>
                    <Text style={styles.quickActionDescription}>Users, activity, referrals, transactions</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.quickActionCard}
                  onPress={() => navigation.navigate('Settings')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: colors.info + '20' }]}>
                    <Ionicons name="settings" size={24} color={colors.info} />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionTitle}>Settings</Text>
                    <Text style={styles.quickActionDescription}>Manage your account settings</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
                </TouchableOpacity>
              </View>
            </>
          ) : isEmployer ? (
            <>
              {/* Employer cards - 3 column grid on desktop, stacked on mobile */}
              <View style={styles.secondaryCardsContainer}>
                <TouchableOpacity 
                  style={styles.quickActionCard}
                  onPress={() => navigation.navigate('CreateJob')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="add-circle" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionTitle}>Post a New Job</Text>
                    <Text style={styles.quickActionDescription}>Create and publish a job posting</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.quickActionCard}
                  onPress={() => navigation.navigate('Applications')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: colors.success + '20' }]}>
                    <Ionicons name="people" size={24} color={colors.success} />
                    {stats.pendingApplications > 0 && (
                      <View style={[styles.quickActionBadge, { backgroundColor: stats.pendingApplications > 10 ? colors.danger : colors.success }]}>
                        <Text style={styles.quickActionBadgeText}>{stats.pendingApplications}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionTitle}>Review Applications</Text>
                    <Text style={styles.quickActionDescription}>Manage candidate applications</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
                </TouchableOpacity>

                {/* 🎯 Resume Analyzer Card - AI-powered resume analysis */}
                <TouchableOpacity 
                  style={styles.quickActionCard}
                  onPress={() => navigation.navigate('ResumeAnalyzer', { userId: user?.UserID })}
                  activeOpacity={0.8}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#9333EA' + '20' }]}>
                    <Ionicons name="document-text" size={24} color="#9333EA" />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionTitle}>Resume Analyzer</Text>
                    <Text style={styles.quickActionDescription}>AI-powered resume analysis for jobs</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
                </TouchableOpacity>

                {/* Google AdSense Ad - Employer Home */}
                <AdCard variant="home" />
              </View>
            </>
          ) : (
            <>
              {/* 🎯 Engagement Hub — Greeting, Streak, Profile Completion, Daily Checklist, Nudges */}
              <EngagementHub
                navigation={navigation}
                dashboardStats={dashboardData.stats}
                applications={dashboardData.recentApplications}
                savedJobs={0}
              />

              {/* 🎯 Get Referrals Card - Premium Design with F500 Logo Scroll */}
              <TouchableOpacity 
                style={styles.premiumActionCard}
                onPress={() => navigation.navigate('AskReferral')}
                activeOpacity={0.9}
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
                  
                  {/* 🎯 Fortune 500 Company Logos with Referrer Counts */}
                  {fortune500Companies.length > 0 && (
                    <View style={styles.f500LogoContainer}>
                      <ScrollView
                        ref={f500LogoScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        scrollEnabled={true}
                        style={styles.f500LogoScroll}
                      >
                        {fortune500Companies.map((company, index) => (
                          <TouchableOpacity
                            key={company.id || index}
                            style={styles.f500LogoItem}
                            onPress={(e) => {
                              e.stopPropagation();
                              navigation.navigate('AskReferral', { 
                                preSelectedOrganization: {
                                  id: company.id,
                                  name: company.name,
                                  logoURL: company.logoURL
                                }
                              });
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.f500LogoBadge}>
                              <Text style={styles.f500BadgeText}>
                                {formatReferrerCount(company.referrerCount)}
                              </Text>
                            </View>
                            <CachedImage 
                              source={{ uri: company.logoURL }} 
                              style={styles.f500Logo}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              {/* Secondary Cards Container - 3 column grid on desktop */}
              <View style={styles.secondaryCardsContainer}>
                {/* 🎯 My Referrals Card - Only show if user has incoming referral requests */}
                {myReferrerRequests.length > 0 && (
                  <TouchableOpacity 
                    style={styles.quickActionCard}
                    onPress={() => navigation.navigate('Referrals', { tab: 'referrer' })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: colors.success + '20' }]}>
                      <Ionicons name="gift" size={24} color={colors.success} />
                      <View style={styles.quickActionBadge}>
                        <Text style={styles.quickActionBadgeText}>{myReferrerRequests.length}</Text>
                      </View>
                    </View>
                    <View style={styles.quickActionContent}>
                      <Text style={styles.quickActionTitle}>My Referrals</Text>
                      <Text style={styles.quickActionDescription}>Help others get their dream job</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
                  </TouchableOpacity>
                )}

                {/* Google AdSense Ad - Job Seeker Home */}
                <AdCard variant="home" />
              </View>
            </>
          )}
        </View>

        {/* Jobs from Top MNCs (Fortune 500) - Job Seekers only - MOVED ABOVE Recommended Jobs */}
        {isJobSeeker && (
          loadingF500Jobs ? (
            <View style={styles.recentContainer}>
              <Text style={styles.sectionTitle}>Jobs by Top MNCs</Text>
              <HomeSectionLoader styles={styles} colors={colors} />
            </View>
          ) : dashboardData.f500Jobs?.length > 0 ? (
            <View style={styles.recentContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Jobs by Top MNCs</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Jobs', { filterF500: true })}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              >
                {dashboardData.f500Jobs.map((job, index) => (
                  <HomeJobCard key={job.JobID || index} job={job} styles={styles} colors={colors} onPress={() => navigation.navigate('JobDetails', { jobId: job.JobID })} />
                ))}
              </ScrollView>
            </View>
          ) : null
        )}

        {/* Recommended Jobs Section - Job Seekers only */}
        {isJobSeeker && (loadingJobs ? (
          <View style={styles.recentContainer}>
            <Text style={styles.sectionTitle}>Recommended Jobs</Text>
            <HomeSectionLoader styles={styles} colors={colors} />
          </View>
        ) : recentJobs.length > 0 ? (
          <View style={styles.recentContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recommended Jobs</Text>
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
                <HomeJobCard key={job.JobID || index} job={job} styles={styles} colors={colors} onPress={() => navigation.navigate('JobDetails', { jobId: job.JobID })} />
              ))}
            </ScrollView>
          </View>
        ) : null)}

        {/* Recent Applications (Job Seekers only) */}
        {isJobSeeker && (
          loadingApplications ? (
            <View style={styles.recentContainer}>
              <Text style={styles.sectionTitle}>Recent Applications</Text>
              <HomeSectionLoader styles={styles} colors={colors} />
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
                <HomeApplicationCard key={application.ApplicationID || index} application={application} styles={styles} colors={colors} onPress={() => navigation.navigate('Applications')} />
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
        </ResponsiveContainer>
      </ScrollView>

      {/* Confirm Current Company Modal */}
      <Modal
        visible={showConfirmCompanyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmCompanyModal(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalCard}>
            <Ionicons name="briefcase" size={40} color={colors.primary} />
            <Text style={styles.confirmModalTitle}>Verify Your Employment</Text>
            <Text style={styles.confirmModalMessage}>
              Is <Text style={{ fontWeight: '700' }}>{currentWorkExperience?.CompanyName}</Text> your current company?
            </Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalButtonSecondary]}
                onPress={() => {
                  setShowConfirmCompanyModal(false);
                  setShowAddWorkModal(true);
                }}
              >
                <Text style={styles.confirmModalButtonSecondaryText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalButtonPrimary]}
                onPress={() => {
                  setShowConfirmCompanyModal(false);
                  setShowAddWorkModal(true);
                }}
              >
                <Text style={styles.confirmModalButtonPrimaryText}>Yes, Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Work Experience Modal */}
      <AddWorkExperienceModal
        visible={showAddWorkModal}
        onClose={() => setShowAddWorkModal(false)}
        onSave={async () => {
          // Refresh dashboard data after saving
          fetchDashboardData();
        }}
        editingItem={currentWorkExperience}
        existingExperiences={workExperiences}
        showVerification={true}
        onVerificationComplete={(companyName) => {
          setVerifiedCompanyName(companyName);
          setShowAddWorkModal(false);
          setShowVerifiedOverlay(true);
          // Refresh verification status in AuthContext so other screens see the update
          refreshVerificationStatus();
          // Refresh to update verified status
          fetchDashboardData();
        }}
      />

      {/* Verified Referrer Celebration Overlay */}
      <VerifiedReferrerOverlay
        visible={showVerifiedOverlay}
        onClose={() => setShowVerifiedOverlay(false)}
        companyName={verifiedCompanyName}
      />
    </>
  );
}

const createStyles = (colors, responsive = {}) => {
  const { isMobile = true, isDesktop = false, isTablet = false, contentWidth = width, statColumns = 2 } = responsive;
  
  return StyleSheet.create({
container: {
  flex: 1,
  backgroundColor: colors.background,
},
scrollContent: {
  flexGrow: 1,
  paddingBottom: 100,
  alignItems: isDesktop ? 'center' : 'stretch',
},
responsiveContent: {
  width: '100%',
  maxWidth: isDesktop ? 1200 : '100%',
  paddingHorizontal: isMobile ? 0 : 24,
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
  brandName: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  brandLogo: {
    width: 92,
    height: 24,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    height: 44,
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
  
  // ── Sections ──
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
    gap: isMobile ? 12 : 16,
    justifyContent: 'flex-start',
  },
  statCard: {
    backgroundColor: colors.surface,
    padding: isMobile ? 16 : 20,
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
    // Responsive width: 2 cols on mobile, 4 cols on tablet/desktop
    width: isMobile ? '48%' : isTablet ? '23%' : '23%',
    minWidth: isMobile ? 150 : 200,
    minHeight: isMobile ? 120 : 140,
  },
  statCardLarge: {
    padding: isMobile ? 20 : 24,
    borderLeftWidth: 6,
    width: isMobile ? '48%' : '23%',
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
    padding: isMobile ? 16 : 24,
    paddingTop: 0,
  },
  // Secondary cards container - 3 column grid on desktop
  secondaryCardsContainer: {
    ...(isDesktop && {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      marginTop: 8,
    }),
  },
  // Premium Get Referrals Card - Full width on desktop
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
    // Full width on desktop (takes entire first row)
    ...(isDesktop && {
      width: '100%',
    }),
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
  // 🎯 Fortune 500 Logo Scroll Styles
  f500LogoContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  f500LogoScroll: {
    flexDirection: 'row',
  },
  f500LogoItem: {
    alignItems: 'center',
    marginRight: 14,
    position: 'relative',
  },
  f500Logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  f500LogoBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  f500BadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  // 🎯 Quick Action Card (Compact Style like employer cards)
  quickActionCard: {
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
    borderWidth: 1,
    borderColor: colors.border,
    // On desktop, make cards equal width in 3-column grid
    ...(isDesktop && {
      width: 'calc(33.333% - 11px)',
      marginBottom: 0,
      minWidth: 280,
    }),
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    position: 'relative',
  },
  quickActionBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickActionBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  quickActionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
  },
  quickActionRewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  quickActionRewardText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    marginLeft: 4,
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
    padding: isMobile ? 16 : 20,
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
    // On desktop, action cards go in a 2-column grid
    ...(isDesktop && {
      width: '48%',
      minWidth: 350,
    }),
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
    padding: isMobile ? 16 : 24,
    paddingTop: 0,
  },
  horizontalScroll: {
    paddingRight: isMobile ? 16 : 24,
  },
  jobCard: {
    backgroundColor: colors.surface,
    padding: isMobile ? 16 : 20,
    borderRadius: 12,
    marginRight: 12,
    width: isMobile ? 280 : 320,
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
    height: 100,
  },
  // Confirm Company Modal styles
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  confirmModalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmModalMessage: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmModalButtonSecondary: {
    backgroundColor: colors.gray200 || colors.gray100,
  },
  confirmModalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  confirmModalButtonSecondaryText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray700 || colors.text,
  },
  confirmModalButtonPrimaryText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
});
};
