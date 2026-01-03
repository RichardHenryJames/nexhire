import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import refopenAPI from '../../services/api';

const { width: screenWidth } = Dimensions.get('window');

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user, isAdmin } = useAuth();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, users, referrals, transactions

  useEffect(() => {
    navigation.setOptions({
      title: 'Admin Dashboard',
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { color: colors.text, fontWeight: 'bold' },
    });
  }, [navigation, colors]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      // NOTE: Using "management/dashboard" because "admin" is reserved in Azure Functions
      const response = await refopenAPI.apiCall('/management/dashboard');
      if (response.success) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadDashboard();
    }
  }, [isAdmin, loadDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

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

  if (loading && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

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
    messageStats = {}
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
          { key: 'referrals', label: 'Referrals', icon: 'share-social-outline' },
          { key: 'transactions', label: 'Transactions', icon: 'wallet-outline' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons 
              name={tab.icon} 
              size={16} 
              color={activeTab === tab.key ? colors.primary : colors.textSecondary} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === tab.key && styles.tabTextActive
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderOverviewTab = () => (
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
        {renderStatCard('Total Users', userStats.TotalUsers, 'people', '#3B82F6')}
        {renderStatCard('Today', userStats.UsersToday, 'person-add', '#10B981', 'New signups')}
        {renderStatCard('This Week', userStats.UsersThisWeek, 'calendar', '#8B5CF6')}
        {renderStatCard('This Month', userStats.UsersThisMonth, 'trending-up', '#F59E0B')}
      </ScrollView>

      {/* User Breakdown */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>User Breakdown</Text>
      </View>
      <View style={styles.gridRow}>
        {renderStatCard('Job Seekers', userStats.TotalJobSeekers, 'briefcase', '#3B82F6')}
        {renderStatCard('Employers', userStats.TotalEmployers, 'business', '#10B981')}
        {renderStatCard('Active Users', userStats.ActiveUsers, 'checkmark-circle', '#8B5CF6')}
        {renderStatCard('Verified', userStats.VerifiedUsers, 'shield-checkmark', '#F59E0B')}
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
        {renderStatCard('Total Requests', referralStats.TotalRequests, 'share-social', '#3B82F6')}
        {renderStatCard('Today', referralStats.RequestsToday, 'today', '#10B981')}
        {renderStatCard('Pending', referralStats.PendingRequests, 'hourglass', '#F59E0B')}
        {renderStatCard('Completed', referralStats.CompletedRequests, 'checkmark-done', '#8B5CF6')}
      </ScrollView>

      {/* Job Stats */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Job Statistics</Text>
      </View>
      <View style={styles.gridRow}>
        {renderStatCard('Total Jobs', jobStats.TotalJobs, 'documents', '#3B82F6')}
        {renderStatCard('Active Jobs', jobStats.ActiveJobs, 'checkmark-circle', '#10B981')}
        {renderStatCard('External Jobs', jobStats.ExternalJobs, 'link', '#8B5CF6')}
        {renderStatCard('Today', jobStats.JobsToday, 'add-circle', '#F59E0B')}
      </View>

      {/* Application & Message Stats */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Engagement</Text>
      </View>
      <View style={styles.gridRow}>
        {renderStatCard('Applications', applicationStats.TotalApplications, 'document-text', '#3B82F6')}
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

  const renderUsersTab = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Users</Text>
        <Text style={styles.sectionSubtitle}>Last 20 signups</Text>
      </View>
      {recentUsers.map((user, index) => (
        <View key={user.UserID || index} style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {user.FirstName?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.FirstName} {user.LastName}</Text>
            <Text style={styles.userEmail}>{user.Email}</Text>
            <View style={styles.userMeta}>
              <View style={[styles.badge, { backgroundColor: user.UserType === 'JobSeeker' ? '#3B82F620' : '#10B98120' }]}>
                <Text style={[styles.badgeText, { color: user.UserType === 'JobSeeker' ? '#3B82F6' : '#10B981' }]}>
                  {user.UserType}
                </Text>
              </View>
              {user.IsActive ? (
                <View style={[styles.badge, { backgroundColor: '#10B98120' }]}>
                  <Text style={[styles.badgeText, { color: '#10B981' }]}>Active</Text>
                </View>
              ) : (
                <View style={[styles.badge, { backgroundColor: '#EF444420' }]}>
                  <Text style={[styles.badgeText, { color: '#EF4444' }]}>Inactive</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.userDate}>
            {new Date(user.CreatedAt).toLocaleDateString()}
          </Text>
        </View>
      ))}
    </>
  );

  const renderReferralsTab = () => (
    <>
      {/* Referral Status Breakdown */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Referral Status</Text>
      </View>
      <View style={styles.gridRow}>
        {renderStatCard('Pending', referralStats.PendingRequests, 'hourglass', '#F59E0B')}
        {renderStatCard('Claimed', referralStats.ClaimedRequests, 'hand-left', '#3B82F6')}
        {renderStatCard('Completed', referralStats.CompletedRequests, 'checkmark-done', '#10B981')}
        {renderStatCard('Cancelled', referralStats.CancelledRequests, 'close-circle', '#EF4444')}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Referral Requests</Text>
        <Text style={styles.sectionSubtitle}>Last 20 requests</Text>
      </View>
      {recentReferrals.map((ref, index) => (
        <View key={ref.ReferralRequestID || index} style={styles.referralCard}>
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
            {new Date(ref.CreatedAt).toLocaleDateString()}
          </Text>
        </View>
      ))}
    </>
  );

  const renderTransactionsTab = () => (
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

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return '#F59E0B';
      case 'claimed': return '#3B82F6';
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
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'users' && renderUsersTab()}
          {activeTab === 'referrals' && renderReferralsTab()}
          {activeTab === 'transactions' && renderTransactionsTab()}
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
    userAvatarText: {
      fontSize: isDesktop ? 20 : 18,
      fontWeight: 'bold',
      color: colors.primary,
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
  });
};
