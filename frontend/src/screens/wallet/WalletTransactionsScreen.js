import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';
import useResponsive from '../../hooks/useResponsive';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import { typography } from '../../styles/theme';

export default function WalletTransactionsScreen({ navigation }) {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'Credit', 'Debit'
  const [currentBalance, setCurrentBalance] = useState(0);

  const loadTransactions = useCallback(async (pageNum = 1, filterType = filter, showLoader = true) => {
    try {
      if (showLoader && pageNum === 1) setLoading(true);

      const result = await refopenAPI.getWalletTransactions(
        pageNum,
        20,
        filterType === 'all' ? undefined : filterType
      );

      if (result.success) {
        if (pageNum === 1) {
          setTransactions(result.data.transactions || []);
        } else {
          setTransactions((prev) => [...prev, ...(result.data.transactions || [])]);
        }
        setCurrentBalance(result.data.currentBalance || 0);
        setHasMore(pageNum < result.data.totalPages);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTransactions(1, filter, false);
  }, [filter, loadTransactions]);

  const loadMore = () => {
    if (hasMore && !loading) {
      loadTransactions(page + 1, filter, false);
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPage(1);
    loadTransactions(1, newFilter);
  };

  const renderTransaction = ({ item }) => {
    const isCredit = item.TransactionType === 'Credit';
    const icon = isCredit ? 'arrow-down-circle' : 'arrow-up-circle';
    const iconColor = isCredit ? '#10B981' : '#EF4444';

    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionIcon}>
          <Ionicons name={icon} size={40} color={iconColor} />
        </View>

        <View style={styles.transactionContent}>
          <View style={styles.transactionHeader}>
            <Text style={styles.transactionType}>{item.TransactionType}</Text>
            <Text style={[styles.transactionAmount, { color: iconColor }]}>
              {isCredit ? '+' : '-'}₹{item.Amount.toFixed(2)}
            </Text>
          </View>

          <Text style={styles.transactionDescription} numberOfLines={2}>
            {item.Description || item.Source}
          </Text>

          <View style={styles.transactionFooter}>
            <View style={styles.transactionDate}>
              <Ionicons name="time-outline" size={14} color="#999" />
              <Text style={styles.dateText}>
                {new Date(item.CreatedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Balance: </Text>
              <Text style={styles.balanceValue}>₹{item.BalanceAfter.toFixed(2)}</Text>
            </View>
          </View>

          {item.Status !== 'Completed' && (
            <View style={[styles.statusBadge, styles[`status${item.Status}`]]}>
              <Text style={styles.statusText}>{item.Status}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Current Balance with Add Money button */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceCardHeader}>
          <View>
            <Text style={styles.balanceCardLabel}>Current Balance</Text>
            <Text style={styles.balanceCardAmount}>₹{currentBalance.toFixed(2)}</Text>
          </View>
          {/* ? NEW: Add Money button in balance card */}
          <TouchableOpacity
            style={styles.balanceAddButton}
            onPress={() => navigation.navigate('WalletRecharge')}
          >
            <Ionicons name="add-circle" size={24} color="#FFF" />
            <Text style={styles.balanceAddButtonText}>Add Money</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => handleFilterChange('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, filter === 'Credit' && styles.filterButtonActive]}
          onPress={() => handleFilterChange('Credit')}
        >
          <Ionicons
            name="arrow-down-circle"
            size={16}
            color={filter === 'Credit' ? '#FFF' : '#10B981'}
          />
          <Text style={[styles.filterText, filter === 'Credit' && styles.filterTextActive]}>
            Credits
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, filter === 'Debit' && styles.filterButtonActive]}
          onPress={() => handleFilterChange('Debit')}
        >
          <Ionicons
            name="arrow-up-circle"
            size={16}
            color={filter === 'Debit' ? '#FFF' : '#EF4444'}
          />
          <Text style={[styles.filterText, filter === 'Debit' && styles.filterTextActive]}>
            Debits
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.footerText}>Loading more...</Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="receipt-outline" size={80} color="#CCC" />
      <Text style={styles.emptyText}>No transactions found</Text>
      <Text style={styles.emptySubtext}>
        {filter === 'all'
          ? 'Add money to your wallet to see transactions'
          : `No ${filter.toLowerCase()} transactions yet`}
      </Text>
    </View>
  );

  if (loading && page === 1) {
    return (
      <View style={styles.container}>
        <View style={styles.innerContainer}>
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading transactions...</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Transaction History" directBack="Wallet" />
      <View style={styles.innerContainer}>
        <FlatList
          style={{ flex: 1 }}
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.TransactionID}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          windowSize={11}
          maxToRenderPerBatch={10}
          initialNumToRender={15}
          removeClippedSubviews={Platform.OS !== 'web'}
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
  listContent: {
    paddingBottom: 20,
  },
  header: {
    padding: 16,
  },
  balanceCard: {
    backgroundColor: '#007AFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  balanceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceCardLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  balanceCardAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFF',
  },
  balanceAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  balanceAddButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
    borderWidth: 2,
    borderColor: colors.border,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#FFF',
  },
  transactionCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  transactionIcon: {
    marginRight: 12,
    justifyContent: 'center',
  },
  transactionContent: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionType: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  balanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  balanceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusFailed: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
