import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { typography } from '../../styles/theme';
import useResponsive from '../../hooks/useResponsive';

export default function WalletScreen({ navigation, route }) {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // ✅ Smart back navigation for hard refresh scenarios
  useEffect(() => {
    navigation.setOptions({
      title: 'My Wallet',
      headerStyle: { backgroundColor: colors.surface, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
      headerTitleStyle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text },
      headerLeft: () => (
        <TouchableOpacity 
          style={{ marginLeft: 16, padding: 4 }} 
          onPress={() => {
            const navState = navigation.getState();
            const routes = navState?.routes || [];
            const currentIndex = navState?.index || 0;
            if (routes.length > 1 && currentIndex > 0) {
              navigation.goBack();
            } else {
              navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Profile' } });
            }
          }} 
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  // Load wallet data
  const loadWalletData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      // Load wallet balance and transactions in parallel
      const [walletResult, transactionsResult] = await Promise.all([
        refopenAPI.getWalletBalance(),
        refopenAPI.getWalletTransactions(1, 20),
      ]);

      if (walletResult.success) {
        setWallet(walletResult.data);
      }

      if (transactionsResult.success) {
        setTransactions(transactionsResult.data.transactions || []);
        setHasMore(transactionsResult.data.totalPages > 1);
        setPage(1);
      }
    } catch (error) {
      console.error('Error loading wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet data');
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
      const result = await refopenAPI.getWalletTransactions(nextPage, 20);

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
    const iconColor = isCredit ? '#10B981' : '#EF4444';

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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading wallet...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
      {/* Wallet Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Wallet Balance</Text>
        <Text style={styles.balanceAmount}>
          ₹{wallet?.balance?.toFixed(2) || '0.00'}
        </Text>
        <Text style={styles.balanceCurrency}>{wallet?.currencyCode || 'INR'}</Text>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.addMoneyButton}
            onPress={() => navigation.navigate('WalletRecharge')}
          >
            <Ionicons name="add-circle" size={24} color="#FFF" />
            <Text style={styles.addMoneyText}>Add Money</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => navigation.navigate('WalletTransactions')}
          >
            <Ionicons name="receipt-outline" size={24} color="#007AFF" />
            <Text style={styles.historyText}>All Transactions</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.transactionsContainer}>
        {/* ? NEW: Header with Add Money button */}
        <View style={styles.transactionsHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity
            style={styles.miniAddButton}
            onPress={() => navigation.navigate('WalletRecharge')}
          >
            <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={transactions.slice(0, 5)}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.TransactionID}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Add money to your wallet to get started
              </Text>
              <TouchableOpacity
                style={styles.emptyAddButton}
                onPress={() => navigation.navigate('WalletRecharge')}
              >
                <Ionicons name="add-circle" size={20} color="#FFF" />
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
            <Ionicons name="chevron-forward" size={20} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>
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
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 800 : '100%',
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
    backgroundColor: '#007AFF',
    padding: responsive.isDesktop ? 32 : 24,
    margin: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  balanceCurrency: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 24,
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
    color: '#FFF',
    fontSize: 16,
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
    gap: 8,
  },
  historyText: {
    color: colors.primary,
    fontSize: 16,
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
    color: '#007AFF',
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
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  emptyAddButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
