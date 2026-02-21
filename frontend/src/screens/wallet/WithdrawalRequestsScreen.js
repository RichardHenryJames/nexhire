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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import { typography } from '../../styles/theme';
import useResponsive from '../../hooks/useResponsive';

export default function WithdrawalRequestsScreen({ navigation }) {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Load withdrawal data
  const loadWithdrawals = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const result = await refopenAPI.getWithdrawalHistory(1, 50);

      if (result.success) {
        setWithdrawals(result.data.withdrawals || []);
        setHasMore(result.data.totalPages > 1);
        setPage(1);
      }
    } catch (error) {
      console.error('Error loading withdrawals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWithdrawals(false);
  }, [loadWithdrawals]);

  // Get status color and icon
  const getStatusInfo = (status) => {
    switch (status) {
      case 'Pending':
        return { color: '#F59E0B', icon: 'time-outline', bgColor: '#F59E0B22' };
      case 'Processing':
        return { color: colors.primary, icon: 'sync-outline', bgColor: colors.primary + '22' };
      case 'Completed':
        return { color: '#10B981', icon: 'checkmark-circle', bgColor: '#10B98122' };
      case 'Rejected':
        return { color: '#EF4444', icon: 'close-circle', bgColor: '#EF444422' };
      default:
        return { color: colors.textSecondary, icon: 'help-circle-outline', bgColor: colors.border };
    }
  };

  // Mask sensitive data (show first 3 and last 2 chars)
  const maskSensitiveData = (data) => {
    if (!data || data.length < 6) return data || 'N/A';
    const firstPart = data.slice(0, 3);
    const lastPart = data.slice(-2);
    const maskedLength = Math.max(4, data.length - 5);
    return `${firstPart}${'*'.repeat(maskedLength)}${lastPart}`;
  };

  // Render withdrawal item
  const renderWithdrawal = ({ item }) => {
    const statusInfo = getStatusInfo(item.Status);
    const netAmount = item.NetAmount ?? item.Amount; // Use NetAmount if available, else show Amount
    const fee = item.ProcessingFee ?? 0;
    
    return (
      <View style={styles.withdrawalItem}>
        <View style={styles.withdrawalHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
            <Ionicons name={statusInfo.icon} size={16} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{item.Status}</Text>
          </View>
          <View style={styles.amountContainer}>
            <Text style={styles.amount}>₹{netAmount.toFixed(2)}</Text>
            {fee > 0 && (
              <Text style={styles.amountBreakdown}>
                (₹{item.Amount.toFixed(0)} - ₹{fee} fee)
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.withdrawalDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="wallet-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>
              {item.UpiId ? `UPI: ${maskSensitiveData(item.UpiId)}` : `Bank: ${maskSensitiveData(item.BankAccountNumber)}`}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>
              Requested: {new Date(item.RequestedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          
          {item.ProcessedAt && (
            <View style={styles.detailRow}>
              <Ionicons name="checkmark-done-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText}>
                Processed: {new Date(item.ProcessedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
          )}
          
          {item.PaymentReference && (
            <View style={styles.detailRow}>
              <Ionicons name="receipt-outline" size={16} color={colors.success} />
              <Text style={[styles.detailText, { color: colors.success }]}>
                Ref: {item.PaymentReference}
              </Text>
            </View>
          )}
          
          {item.RejectionReason && (
            <View style={[styles.detailRow, styles.rejectionRow]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={[styles.detailText, { color: colors.error }]}>
                {item.RejectionReason}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading withdrawals...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Withdrawals" directBack="Wallet" />
      <View style={styles.innerContainer}>
        {withdrawals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={64} color={colors.gray400} />
            <Text style={styles.emptyTitle}>No Withdrawal Requests</Text>
            <Text style={styles.emptySubtext}>
              Your withdrawal requests will appear here when you withdraw your referral earnings.
            </Text>
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={withdrawals}
            renderItem={renderWithdrawal}
            keyExtractor={(item) => item.WithdrawalID}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
            windowSize={11}
            maxToRenderPerBatch={10}
            initialNumToRender={15}
            removeClippedSubviews={Platform.OS !== 'web'}
          />
        )}
      </View>
    </View>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: responsive.isDesktop ? 'center' : 'stretch',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: responsive.isDesktop ? 900 : '100%',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  listContent: {
    padding: 16,
  },
  withdrawalItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  withdrawalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  amountBreakdown: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  withdrawalDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  rejectionRow: {
    backgroundColor: '#EF444411',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
