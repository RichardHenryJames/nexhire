import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';
import { showToast } from '../../components/Toast';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import WithdrawModal from '../../components/WithdrawModal';
import { typography } from '../../styles/theme';
import useResponsive from '../../hooks/useResponsive';

export default function WalletScreen({ navigation, route }) {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Withdraw modal
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  // Load wallet data
  const loadWalletData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      // Load wallet balance first (fast) — show UI immediately
      const walletResult = await refopenAPI.getWalletBalance();
      if (walletResult.success) {
        setWallet(walletResult.data);
      }
      // Stop full-screen loader as soon as balance is ready
      setLoading(false);

      // Then load transactions (can be slower, list will show spinner)
      const transactionsResult = await refopenAPI.getWalletTransactions(1, 100);
      if (transactionsResult.success) {
        setTransactions(transactionsResult.data.transactions || []);
        setHasMore(transactionsResult.data.totalPages > 1);
        setPage(1);
      }

      // Load pending manual payment submissions
      try {
        const subsResult = await refopenAPI.getMyManualPaymentSubmissions();
        if (subsResult?.success) {
          const pending = (subsResult.data || []).filter(s => s.status === 'Pending');
          setPendingSubmissions(pending);
        }
      } catch (e) { /* non-critical */ }
    } catch (error) {
      console.error('Error loading wallet data:', error);
      showToast('Failed to load wallet data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  // Listen for route params to refresh after payment
  useEffect(() => {
    if (route.params?.refresh) {
      loadWalletData(false);
    }
  }, [route.params?.refresh, route.params?.timestamp, loadWalletData]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWalletData(false);
  }, [loadWalletData]);

  // Load more transactions
  const loadMoreTransactions = async () => {
    if (!hasMore || loading) return;

    try {
      const nextPage = page + 1;
      const result = await refopenAPI.getWalletTransactions(nextPage, 100);

      if (result.success) {
        setTransactions((prev) => [...prev, ...(result.data.transactions || [])]);
        setPage(nextPage);
        setHasMore(nextPage < result.data.totalPages);
      }
    } catch (error) {
      console.error('Error loading more transactions:', error);
    }
  };

  // Render transaction item
  const renderTransaction = ({ item }) => {
    const isCredit = item.TransactionType === 'Credit';
    const icon = isCredit ? 'arrow-down-circle' : 'arrow-up-circle';
    const iconColor = isCredit ? colors.success : colors.error;

    return (
      <View style={styles.transactionItem}>
        <View style={styles.transactionIcon}>
          <Ionicons name={icon} size={32} color={iconColor} />
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionDescription}>
            {item.Description || item.Source}
          </Text>
          <Text style={styles.transactionDate}>
            {new Date(item.CreatedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={styles.transactionAmount}>
          <Text style={[styles.amountText, { color: iconColor }]}>
            {isCredit ? '+' : '-'}₹{item.Amount.toFixed(2)}
          </Text>
          <Text style={styles.balanceText}>
            Bal: ₹{item.BalanceAfter.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SubScreenHeader title="My Wallet" directBack="Home" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubScreenHeader title="My Wallet" directBack="Home" />
      <ScrollView style={styles.innerContainer} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Wallet Balance Card */}
      <View style={styles.balanceCard}>
        {/* Top Row: Total Balance + Available/Hold Info */}
        <View style={styles.balanceTopRow}>
          {/* Left: Total Balance */}
          <View style={styles.balanceLeft}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Text style={styles.balanceAmount}>
              ₹{wallet?.balance?.toFixed(2) || '0.00'}
            </Text>
            <Text style={styles.balanceCurrency}>{wallet?.currencyCode || 'INR'}</Text>
          </View>
          
          {/* Right: Available & Hold - only show if there are holds */}
          {wallet?.holdAmount > 0 && (
            <TouchableOpacity 
              style={styles.holdInfoContainer}
              onPress={() => navigation.navigate('WalletHolds')}
              activeOpacity={0.7}
            >
              <View style={styles.holdInfoRow}>
                <Text style={styles.availableLabel}>Available</Text>
                <Text style={styles.availableAmount}>
                  ₹{wallet?.availableBalance?.toFixed(2) || '0.00'}
                </Text>
              </View>
              <View style={styles.holdInfoRow}>
                <Text style={styles.holdLabel}>On Hold</Text>
                <Text style={styles.holdAmount}>
                  ₹{wallet?.holdAmount?.toFixed(2) || '0.00'}
                </Text>
              </View>
              <Text style={styles.holdHint}>Pending referral requests</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.addMoneyButton}
            onPress={() => navigation.navigate('WalletRecharge')}
          >
            <Ionicons name="add-circle" size={24} color={colors.white} />
            <Text style={styles.addMoneyText}>Add Money</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.withdrawMoneyButton}
            onPress={() => setShowWithdrawModal(true)}
          >
            <Ionicons name="arrow-up-circle" size={24} color={colors.white} />
            <Text style={styles.withdrawMoneyText}>Withdraw</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => navigation.navigate('WalletTransactions')}
          >
            <Ionicons name="receipt-outline" size={24} color={colors.primary} />
            <Text style={styles.historyText}>Transactions</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Get Free Credits Banner */}
      <TouchableOpacity 
        style={{
          backgroundColor: colors.indigo,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 10,
          marginHorizontal: 16,
          marginBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
        }}
        onPress={() => navigation.navigate('ShareEarn')}
      >
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.white }}>
          💰 Get Free Credits!
        </Text>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
          <Text style={{ color: colors.white, fontWeight: '600', fontSize: 12 }}>Earn Now</Text>
        </View>
      </TouchableOpacity>

      {/* Pending Payment Submissions */}
      {pendingSubmissions.length > 0 && (
        <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 }}>⏳ Pending Submissions</Text>
          {pendingSubmissions.map((sub, idx) => (
            <View key={sub.submissionId || idx} style={{
              backgroundColor: colors.warning + '08',
              borderWidth: 1,
              borderColor: colors.warning + '30',
              borderRadius: 10,
              padding: 12,
              marginBottom: 6,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>₹{sub.amount}</Text>
                  {sub.packName && (
                    <View style={{ backgroundColor: colors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '600', color: colors.primary }}>{sub.packName}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  Ref: {sub.referenceNumber || 'N/A'} · {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : ''}
                </Text>
              </View>
              <View style={{ backgroundColor: colors.warning + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="time-outline" size={12} color={colors.warning} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.warning }}>Pending</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.transactionsContainer}>
        {/* ? NEW: Header with Add Money button */}
        <View style={styles.transactionsHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity
            style={styles.miniAddButton}
            onPress={() => navigation.navigate('WalletRecharge')}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <FlatList
          style={{ flex: 1 }}
          data={transactions.slice(0, 5)}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.TransactionID}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={64} color={colors.gray300} />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Add money to your wallet to get started
              </Text>
              <TouchableOpacity
                style={styles.emptyAddButton}
                onPress={() => navigation.navigate('WalletRecharge')}
              >
                <Ionicons name="add-circle" size={20} color={colors.white} />
                <Text style={styles.emptyAddButtonText}>Add Money Now</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />

        {transactions.length > 5 && (
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('WalletTransactions')}
          >
            <Text style={styles.viewAllText}>View All Transactions</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
      </ScrollView>

      {/* Shared Withdraw Modal */}
      <WithdrawModal
        visible={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        onSuccess={() => loadWalletData(false)}
        navigation={navigation}
        walletBalance={wallet?.balance}
      />
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.textSecondary,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    padding: responsive.isDesktop ? 24 : 16,
    margin: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  balanceLeft: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: responsive.isDesktop ? 42 : 36,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 2,
  },
  balanceCurrency: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addMoneyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  addMoneyText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  withdrawMoneyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  withdrawMoneyText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  historyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  historyText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  transactionsContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  transactionIcon: {
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  balanceText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 4,
  },

  // ? NEW: Transactions header styles
  transactionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  miniAddButton: {
    padding: 4,
  },

  // ? NEW: Empty state add button
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  emptyAddButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // 💰 NEW: Hold info styles (compact, right side)
  holdInfoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    padding: 10,
    minWidth: 130,
  },
  holdInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  availableLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  availableAmount: {
    color: colors.success,
    fontSize: 13,
    fontWeight: 'bold',
  },
  holdLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  holdAmount: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: 'bold',
  },
  holdHint: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    marginTop: 4,
    textAlign: 'center',
  },
});
