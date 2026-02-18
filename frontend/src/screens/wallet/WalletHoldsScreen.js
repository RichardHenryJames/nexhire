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
import { typography } from '../../styles/theme';
import SubScreenHeader from '../../components/SubScreenHeader';

export default function WalletHoldsScreen({ navigation }) {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const [holds, setHolds] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('Active'); // 'Active', 'Converted', 'Released', or null for all

  const loadHolds = useCallback(async (statusFilter = filter, showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const result = await refopenAPI.getWalletHolds(statusFilter);
      if (result.success) {
        setHolds(result.data?.holds || []);
        setSummary(result.data?.summary || null);
      }
    } catch (error) {
      console.error('Error loading holds:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadHolds();
  }, [loadHolds]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHolds(filter, false);
  }, [filter, loadHolds]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    loadHolds(newFilter);
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'Active':
        return { icon: 'time-outline', color: '#F59E0B', bg: '#FEF3C7', label: 'On Hold' };
      case 'Converted':
        return { icon: 'checkmark-circle', color: '#EF4444', bg: '#FEE2E2', label: 'Charged' };
      case 'Released':
        return { icon: 'arrow-undo-circle', color: '#10B981', bg: '#D1FAE5', label: 'Released' };
      default:
        return { icon: 'help-circle', color: '#999', bg: '#F3F4F6', label: status };
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderHold = ({ item }) => {
    const statusConfig = getStatusConfig(item.Status);
    const isOpenToAny = !!item.OpenToAnyCompany;

    return (
      <TouchableOpacity
        style={styles.holdCard}
        activeOpacity={0.7}
        onPress={() => {
          if (item.ReferralRequestID) {
            navigation.navigate('ReferralTracking', { requestId: item.ReferralRequestID });
          }
        }}
      >
        {/* Left: Icon */}
        <View style={[styles.holdIcon, { backgroundColor: statusConfig.bg }]}>
          {isOpenToAny ? (
            <Ionicons name="globe-outline" size={24} color={statusConfig.color} />
          ) : (
            <Ionicons name={statusConfig.icon} size={24} color={statusConfig.color} />
          )}
        </View>

        {/* Middle: Details */}
        <View style={styles.holdContent}>
          <Text style={styles.holdJobTitle} numberOfLines={1}>
            {item.JobTitle || 'Referral Request'}
          </Text>
          <Text style={styles.holdCompany} numberOfLines={1}>
            {isOpenToAny ? '🌐 Any Company' : item.CompanyName}
          </Text>
          <Text style={styles.holdDate}>{formatDate(item.CreatedAt)}</Text>

          {/* Show resolved date for non-active */}
          {item.Status === 'Converted' && item.ConvertedAt && (
            <Text style={[styles.holdResolvedDate, { color: '#EF4444' }]}>
              Charged on {formatDate(item.ConvertedAt)}
            </Text>
          )}
          {item.Status === 'Released' && item.ReleasedAt && (
            <Text style={[styles.holdResolvedDate, { color: '#10B981' }]}>
              Released on {formatDate(item.ReleasedAt)}
            </Text>
          )}
        </View>

        {/* Right: Amount + Status */}
        <View style={styles.holdRight}>
          <Text style={[styles.holdAmount, { color: statusConfig.color }]}>
            ₹{item.Amount?.toFixed(2)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Summary Card */}
      {summary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Balance</Text>
              <Text style={styles.summaryValue}>₹{summary.totalBalance?.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Available</Text>
              <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                ₹{summary.availableBalance?.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>On Hold</Text>
              <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                ₹{summary.totalHoldAmount?.toFixed(2)}
              </Text>
            </View>
          </View>
          {summary.activeHoldsCount > 0 && (
            <Text style={styles.summaryHint}>
              {summary.activeHoldsCount} active hold{summary.activeHoldsCount > 1 ? 's' : ''} • Auto-released if no referral in 14 days
            </Text>
          )}
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {[
          { key: 'Active', label: 'Active', icon: 'time-outline', color: '#F59E0B' },
          { key: 'Converted', label: 'Charged', icon: 'checkmark-circle', color: '#EF4444' },
          { key: 'Released', label: 'Released', icon: 'arrow-undo-circle', color: '#10B981' },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterButton, filter === f.key && styles.filterButtonActive]}
            onPress={() => handleFilterChange(f.key)}
          >
            <Ionicons
              name={f.icon}
              size={14}
              color={filter === f.key ? '#FFF' : f.color}
            />
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={filter === 'Active' ? 'checkmark-circle-outline' : 'receipt-outline'}
        size={80}
        color={colors.textSecondary}
        style={{ opacity: 0.4 }}
      />
      <Text style={styles.emptyText}>
        {filter === 'Active' ? 'No active holds' : filter === 'Converted' ? 'No charged holds' : 'No released holds'}
      </Text>
      <Text style={styles.emptySubtext}>
        {filter === 'Active'
          ? 'Holds are created when you request referrals.\nThey\'re auto-released if no referral in 14 days.'
          : filter === 'Converted'
          ? 'Holds are charged when a referrer successfully provides a referral.'
          : 'Holds are released when requests are cancelled or expire.'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading holds...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Wallet Holds" onBack={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate('Wallet'); }} />
      <View style={styles.innerContainer}>
        <FlatList
          data={holds}
          keyExtractor={(item) => item.HoldID?.toString()}
          renderItem={renderHold}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      </View>
    </View>
  );
}

const createStyles = (colors, responsive) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  innerContainer: {
    flex: 1,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  listContent: {
    paddingBottom: 20,
  },
  header: {
    padding: 16,
  },
  // Summary Card
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  summaryHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  // Filter
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#FFF',
  },
  // Hold Card
  holdCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  holdIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  holdContent: {
    flex: 1,
  },
  holdJobTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  holdCompany: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  holdDate: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  holdResolvedDate: {
    fontSize: 11,
    marginTop: 2,
  },
  holdRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  holdAmount: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});
