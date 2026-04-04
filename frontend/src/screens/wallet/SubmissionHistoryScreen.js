import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import refopenAPI from '../../services/api';
import { typography } from '../../styles/theme';

const STATUS_CONFIG = {
  Pending: { icon: 'time-outline', color: 'warning', label: 'Pending' },
  Approved: { icon: 'checkmark-circle', color: 'success', label: 'Approved' },
  Rejected: { icon: 'close-circle', color: 'error', label: 'Rejected' },
};

export default function SubmissionHistoryScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSubmissions = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const res = await refopenAPI.getMyManualPaymentSubmissions();
      if (res?.success) setSubmissions(res.data || []);
    } catch (e) {
      console.error('Error loading submissions:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadSubmissions(); }, [loadSubmissions]);

  useFocusEffect(useCallback(() => { loadSubmissions(false); }, [loadSubmissions]));

  const onRefresh = () => { setRefreshing(true); loadSubmissions(false); };

  const renderItem = ({ item }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.Pending;
    const statusColor = colors[cfg.color] || colors.warning;

    return (
      <View style={[styles.card, { borderLeftColor: statusColor }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.amount}>₹{item.amount}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>  
            <Ionicons name={cfg.icon} size={13} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.detailsGrid}>
          {item.packName && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pack:</Text>
              <Text style={[styles.detailValue, { color: colors.primary }]}>{item.packName}</Text>
            </View>
          )}
          {item.promoCode && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Promo:</Text>
              <Text style={[styles.detailValue, { color: colors.success }]}>{item.promoCode}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Method:</Text>
            <Text style={styles.detailValue}>{item.paymentMethod || 'QR / UPI'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Ref No:</Text>
            <Text style={[styles.detailValue, { fontWeight: '700' }]}>{item.referenceNumber || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date:</Text>
            <Text style={styles.detailValue}>{item.paymentDate ? new Date(item.paymentDate).toLocaleDateString() : 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Submitted:</Text>
            <Text style={styles.detailValue}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}</Text>
          </View>
          {item.adminRemarks && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Remarks:</Text>
              <Text style={[styles.detailValue, { color: colors.error, fontStyle: 'italic' }]}>{item.adminRemarks}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <SubScreenHeader title="Credit History" fallbackTab="Wallet" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SubScreenHeader title="Credit History" fallbackTab="Wallet" />
      <FlatList
        data={submissions}
        renderItem={renderItem}
        keyExtractor={(item, idx) => item.submissionId || String(idx)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={56} color={colors.gray300} />
            <Text style={styles.emptyText}>No submissions yet</Text>
            <Text style={styles.emptySubtext}>Submit a manual payment to see it here</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, maxWidth: 700, width: '100%', alignSelf: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  amount: { fontSize: 20, fontWeight: '800', color: colors.text },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  detailsGrid: { gap: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailLabel: { fontSize: 12, color: colors.textMuted, width: 80, fontStyle: 'italic' },
  detailValue: { fontSize: 12, color: colors.text, fontWeight: '500', flex: 1 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 12 },
  emptySubtext: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
