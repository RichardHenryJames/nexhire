/**
 * AdminActionCenterScreen — Hub for all admin actions
 * Shows 4 action cards with pending counts, each navigates to its own screen
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import useResponsive from '../../hooks/useResponsive';
import refopenAPI from '../../services/api';

export default function AdminActionCenterScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { isAdmin } = useAuth();
  const responsive = useResponsive();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts] = useState({
    verifications: 0,
    payments: 0,
    socialShare: 0,
    support: 0,
  });

  const fetchCounts = useCallback(async () => {
    try {
      const [verifRes, socialRes] = await Promise.all([
        refopenAPI.apiCall('/management/verifications/pending'),
        refopenAPI.apiCall('/management/social-share/claims'),
      ]);

      setCounts({
        verifications: verifRes.success && Array.isArray(verifRes.data) ? verifRes.data.length : 0,
        payments: 0, // AdminPayments has its own count
        socialShare: socialRes.success ? (socialRes.data?.stats?.pending || 0) : 0,
        support: 0, // AdminSupport has its own count
      });
    } catch (err) {
      console.error('Error fetching action counts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchCounts();
  }, [isAdmin, fetchCounts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCounts();
  };

  const actions = [
    {
      key: 'support',
      title: 'Support Tickets',
      desc: 'Reply to users, resolve issues',
      icon: 'chatbubbles-outline',
      color: '#F59E0B',
      screen: 'AdminSupport',
      badge: counts.support,
    },
    {
      key: 'payments',
      title: 'Payments & Withdrawals',
      desc: 'Review manual payments, process withdrawals',
      icon: 'card-outline',
      color: '#10B981',
      screen: 'AdminPayments',
      badge: counts.payments,
    },
    {
      key: 'socialShare',
      title: 'Social Share Claims',
      desc: 'Approve social media post reward claims',
      icon: 'megaphone-outline',
      color: '#3B82F6',
      screen: 'AdminSocialShare',
      badge: counts.socialShare,
    },
    {
      key: 'verifications',
      title: 'Verifications',
      desc: 'Approve Aadhaar, college email submissions',
      icon: 'shield-checkmark-outline',
      color: '#8B5CF6',
      screen: 'AdminVerifications',
      badge: counts.verifications,
    },
  ];

  const totalPending = counts.verifications + counts.socialShare;

  const styles = makeStyles(colors, responsive);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Action Center</Text>
        {totalPending > 0 && (
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{totalPending} pending</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.actionCard}
                onPress={() => navigation.navigate(action.screen)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: action.color + '15' }]}>
                  <Ionicons name={action.icon} size={28} color={action.color} />
                  {action.badge > 0 && (
                    <View style={styles.badgeCircle}>
                      <Text style={styles.badgeText}>{action.badge > 99 ? '99+' : action.badge}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDesc}>{action.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors, responsive) {
  const isDesktop = Platform.OS === 'web' && responsive?.isDesktop;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 16 : 50, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
    totalBadge: { backgroundColor: '#EF4444', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    totalBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    content: { padding: 16, ...(isDesktop ? { maxWidth: 700, alignSelf: 'center', width: '100%' } : {}) },
    loadingContainer: { padding: 60, alignItems: 'center' },
    actionCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card, borderRadius: 14, padding: 18,
      marginBottom: 14, borderWidth: 1, borderColor: colors.border,
    },
    actionIconBox: {
      width: 56, height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16,
    },
    badgeCircle: {
      position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444',
      borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 5,
      justifyContent: 'center', alignItems: 'center',
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    actionContent: { flex: 1 },
    actionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 2 },
    actionDesc: { fontSize: 13, color: colors.textSecondary },
  });
}
