import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import useResponsive from '../hooks/useResponsive';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import SubScreenHeader from '../components/SubScreenHeader';
import { usePricing } from '../contexts/PricingContext';
import { typography } from '../styles/theme';
import messagingApi from '../services/messagingApi';
import refopenAPI from '../services/api';
import WalletRechargeModal from '../components/WalletRechargeModal';
import ConfirmPurchaseModal from '../components/ConfirmPurchaseModal';
import { showToast } from '../components/Toast';

// Confirmation modal styles (same as AI jobs modal)
const createConfirmModalStyles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.background,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  body: {
    padding: 16,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  benefits: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  benefitsTitle: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.semibold,
    marginBottom: 8,
  },
  benefitItem: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  kvLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  kvValue: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  kvDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  kvLabelBold: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  kvValueBold: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: {
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
});

export default function ProfileViewsScreen({ navigation }) {
  const { colors } = useTheme();
  const { pricing } = usePricing();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const confirmModalStyles = useMemo(() => createConfirmModalStyles(colors), [colors]);
  
  const [profileViews, setProfileViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalViews, setTotalViews] = useState(0);
  
  // Access state
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // Load wallet balance
  const loadWalletBalance = useCallback(async () => {
    try {
      const result = await refopenAPI.getWalletBalance();
      if (result?.success) {
        setWalletBalance(result.data?.balance || 0);
      }
    } catch (error) {
      console.error('Error loading wallet balance:', error);
    }
  }, []);

  // Check if user has profile view access
  const checkAccess = useCallback(async () => {
    try {
      setCheckingAccess(true);
      const result = await messagingApi.checkProfileViewAccess();
      if (result.success && result.data) {
        setHasAccess(result.data.hasActiveAccess);
      }
    } catch (error) {
      console.error('Error checking profile view access:', error);
    } finally {
      setCheckingAccess(false);
    }
  }, []);

  useEffect(() => {
    // Load all data in parallel for faster initial load
    const loadAllData = async () => {
      setLoading(true);
      setCheckingAccess(true);
      
      try {
        const [accessResult, walletResult, viewsResult] = await Promise.all([
          messagingApi.checkProfileViewAccess().catch(err => {
            console.error('Error checking access:', err);
            return { success: false };
          }),
          refopenAPI.getWalletBalance().catch(err => {
            console.error('Error loading wallet:', err);
            return { success: false };
          }),
          messagingApi.getMyProfileViews(1, 20).catch(err => {
            console.error('Error fetching views:', err);
            return { success: false };
          })
        ]);

        // Set access status
        if (accessResult.success && accessResult.data) {
          setHasAccess(accessResult.data.hasActiveAccess);
        }

        // Set wallet balance
        if (walletResult?.success) {
          setWalletBalance(walletResult.data?.balance || 0);
        }

        // Set profile views
        if (viewsResult.success && viewsResult.data) {
          setProfileViews(viewsResult.data);
          if (viewsResult.pagination?.total || viewsResult.meta?.total) {
            setTotalViews(viewsResult.pagination?.total || viewsResult.meta?.total);
          } else {
            setTotalViews(viewsResult.data.length);
          }
          const totalPages = viewsResult.pagination?.totalPages || 1;
          setHasMore(1 < totalPages);
          setPage(1);
        }
      } finally {
        setLoading(false);
        setCheckingAccess(false);
      }
    };

    loadAllData();
  }, []);

  const fetchProfileViews = useCallback(async (pageNum = 1, isRefresh = false) => {
    try {
      if (pageNum === 1) {
        isRefresh ? setRefreshing(true) : setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const result = await messagingApi.getMyProfileViews(pageNum, 20);
      
      if (result.success && result.data) {
        if (pageNum === 1) {
          setProfileViews(result.data);
        } else {
          setProfileViews(prev => [...prev, ...result.data]);
        }
        
        // Set total views count
        if (result.pagination?.total || result.meta?.total) {
          setTotalViews(result.pagination?.total || result.meta?.total);
        } else {
          setTotalViews(result.data.length);
        }
        
        // Check if there are more pages
        const totalPages = result.pagination?.totalPages || 1;
        setHasMore(pageNum < totalPages);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error fetching profile views:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileViews(1);
  }, [fetchProfileViews]);

  const onRefresh = () => {
    fetchProfileViews(1, true);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchProfileViews(page + 1);
    }
  };

  // Handle unlock button press - show confirmation modal
  const handleUnlock = useCallback(() => {
    // Check if user has enough balance first
    if (walletBalance < pricing.profileViewCost) {
      setShowWalletModal(true);
      return;
    }

    // Show confirmation modal
    setShowConfirmModal(true);
  }, [walletBalance, pricing]);

  // Handle confirm purchase
  const handleConfirmPurchase = useCallback(async () => {
    try {
      setPurchasing(true);
      setShowConfirmModal(false);
      
      const result = await messagingApi.purchaseProfileViewAccess();
      
      if (result.success) {
        setHasAccess(true);
        await loadWalletBalance(); // Refresh wallet balance
        showToast(`You can now see who viewed your profile for ${pricing.profileViewAccessDurationDays} days.`, 'success');
        // Refresh the list to show real names
        fetchProfileViews(1, true);
      } else {
        if (result.error === 'Insufficient balance') {
          setShowWalletModal(true);
        } else {
          showToast('Failed to unlock profile views. Please try again.', 'error');
        }
      }
    } catch (error) {
      console.error('Error purchasing profile view access:', error);
      showToast('Failed to unlock profile views. Please try again.', 'error');
    } finally {
      setPurchasing(false);
    }
  }, [loadWalletBalance, fetchProfileViews, pricing]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    // Handle SQL Server datetime format (2025-12-18 18:46:46.3766667)
    let date;
    try {
      if (typeof dateString === 'string') {
        // SQL Server format: "2025-12-18 18:46:46.3766667"
        // Remove fractional seconds beyond milliseconds and convert to ISO format
        let cleanedDate = dateString;
        
        // If it has more than 3 decimal places, truncate
        const dotIndex = cleanedDate.indexOf('.');
        if (dotIndex > -1 && cleanedDate.length > dotIndex + 4) {
          cleanedDate = cleanedDate.substring(0, dotIndex + 4); // Keep only 3 decimal places
        }
        
        // Replace space with T for ISO format
        if (!cleanedDate.includes('T')) {
          cleanedDate = cleanedDate.replace(' ', 'T');
        }
        
        // Add Z for UTC if not present
        if (!cleanedDate.endsWith('Z') && !cleanedDate.includes('+')) {
          cleanedDate += 'Z';
        }
        
        date = new Date(cleanedDate);
      } else {
        date = new Date(dateString);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return dateString.split(' ')[0] || ''; // Fallback to just the date part
      }
    } catch (e) {
      return dateString.split(' ')[0] || '';
    }
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    
    return date.toLocaleDateString();
  };

  const ViewerCard = ({ item }) => {
    // Backend returns: ViewerUserID, ViewerName, ViewerProfilePic, ViewerUserType, ViewedAt, DeviceType
    const showRealData = hasAccess;
    const displayName = showRealData ? (item.ViewerName || 'Anonymous') : 'Anonymous User';
    const profilePic = showRealData ? item.ViewerProfilePic : null;
    
    return (
      <TouchableOpacity 
        style={styles.viewerCard}
        onPress={() => {
          if (showRealData && item.ViewerUserID) {
            navigation.navigate('ViewProfile', { userId: item.ViewerUserID });
          } else if (!hasAccess) {
            handleUnlock();
          }
        }}
        activeOpacity={0.7}
      >
        {profilePic ? (
          <Image 
            source={{ uri: profilePic }} 
            style={styles.viewerAvatar}
          />
        ) : (
          <View style={[styles.viewerAvatarPlaceholder, !showRealData && styles.lockedAvatar]}>
            <Ionicons 
              name={showRealData ? "person" : "lock-closed"} 
              size={24} 
              color={showRealData ? colors.gray400 : colors.primary} 
            />
          </View>
        )}
        
        <View style={styles.viewerInfo}>
          <Text style={[styles.viewerName, !showRealData && styles.lockedText]} numberOfLines={1}>
            {displayName}
          </Text>
          {showRealData && item.ViewerUserType && (
            <Text style={styles.viewerTitle} numberOfLines={1}>
              {item.ViewerUserType === 'JobSeeker' ? 'Job Seeker' : item.ViewerUserType}
            </Text>
          )}
          {!showRealData && (
            <Text style={styles.unlockHint}>Tap to unlock</Text>
          )}
        </View>
        
        <View style={styles.viewerMeta}>
          <Text style={styles.viewedAt}>{formatDate(item.ViewedAt)}</Text>
          <Ionicons 
            name={showRealData ? "chevron-forward" : "lock-closed"} 
            size={16} 
            color={showRealData ? colors.gray400 : colors.primary} 
          />
        </View>
      </TouchableOpacity>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="eye-off-outline" size={64} color={colors.gray400} />
      <Text style={styles.emptyTitle}>No Profile Views Yet</Text>
      <Text style={styles.emptyText}>
        Complete your profile and apply to jobs to get more visibility
      </Text>
      <TouchableOpacity 
        style={styles.emptyButton}
        onPress={() => navigation.navigate('Profile')}
      >
        <Text style={styles.emptyButtonText}>Complete Profile</Text>
      </TouchableOpacity>
    </View>
  );

  const ListFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile views...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
      {/* Header */}
      <SubScreenHeader
        title="Profile Views"
        fallbackTab="Home"
        rightContent={
          <View style={styles.headerRight}>
            {!hasAccess && !checkingAccess && totalViews > 0 && (
              <TouchableOpacity 
                style={styles.unlockButton}
                onPress={handleUnlock}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="lock-open-outline" size={14} color={colors.white} />
                    <Text style={styles.unlockButtonText}>₹{pricing.profileViewCost}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {hasAccess && (
              <View style={styles.unlockedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.unlockedText}>Unlocked</Text>
              </View>
            )}
            <View style={styles.viewCountBadge}>
              <Text style={styles.viewCountText}>{totalViews || profileViews.length}</Text>
            </View>
          </View>
        }
      />

      {/* Wallet Recharge Modal */}
      <WalletRechargeModal
        visible={showWalletModal}
        currentBalance={walletBalance}
        requiredAmount={pricing.profileViewCost}
        contextType="profile-views"
        itemName={`See who viewed your profile for ${pricing.profileViewAccessDurationDays} days`}
        onAddMoney={() => {
          setShowWalletModal(false);
          navigation.navigate('WalletRecharge');
        }}
        onCancel={() => setShowWalletModal(false)}
      />

      {/* Confirmation Modal - Uses ConfirmPurchaseModal */}
      <ConfirmPurchaseModal
        visible={showConfirmModal}
        currentBalance={Number(walletBalance || 0)}
        requiredAmount={pricing.profileViewCost}
        contextType="profile-views"
        itemName={`See who's interested in your profile`}
        accessDays={pricing.profileViewAccessDurationDays}
        onProceed={handleConfirmPurchase}
        onAddMoney={() => {
          setShowConfirmModal(false);
          navigation.navigate('WalletRecharge');
        }}
        onCancel={() => setShowConfirmModal(false)}
      />

      <FlatList
        style={{ flex: 1 }}
        data={profileViews}
        keyExtractor={(item, index) => item.ViewID?.toString() || index.toString()}
        renderItem={({ item }) => <ViewerCard item={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={<EmptyState />}
        ListFooterComponent={<ListFooter />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
      />
      </View>
    </View>
  );
}

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
    color: colors.gray600,
    fontSize: typography.sizes.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  unlockButtonText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  unlockedText: {
    color: colors.success,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  viewCountBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewCountText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  viewerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  viewerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  viewerAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lockedAvatar: {
    backgroundColor: colors.primary + '15',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    borderStyle: 'dashed',
  },
  viewerInfo: {
    flex: 1,
  },
  viewerName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  lockedText: {
    color: colors.gray500,
    fontStyle: 'italic',
  },
  unlockHint: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    marginTop: 2,
  },
  viewerTitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 2,
  },
  viewerMeta: {
    alignItems: 'flex-end',
  },
  viewedAt: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    marginBottom: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
