import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../styles/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { usePricing } from '../../contexts/PricingContext';
import { useAuth } from '../../contexts/AuthContext';
import refopenAPI from '../../services/api';
import useResponsive from '../../hooks/useResponsive';
import SubScreenHeader from '../../components/SubScreenHeader';
import { useFocusEffect } from '@react-navigation/native';

export default function EarningsScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { pricing } = usePricing();
  const responsive = useResponsive();
  const { isMobile, isDesktop } = responsive;
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const [fadeAnim] = useState(new Animated.Value(1));

  // Data state (loaded from APIs)
  const [totalPoints, setTotalPoints] = useState(0);
  const [pointsHistory, setPointsHistory] = useState([]);
  const [pointTypeMetadata, setPointTypeMetadata] = useState({});
  const [referralStats, setReferralStats] = useState({});
  
  // Withdrawable data (just for display)
  const [withdrawableData, setWithdrawableData] = useState({
    withdrawableAmount: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
    canWithdraw: false,
    minimumWithdrawal: 200,
    withdrawalFee: 0
  });

  // Load all data on focus (auto-refresh when navigating to screen)
  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [])
  );

  const loadAllData = async () => {
    try {
      const userId = user?.UserID || user?.userId || user?.id || user?.sub;
      
      // 1. Load referralStats from Profile API (the ONLY source of totalReferralsMade/verifiedReferrals)
      if (userId) {
        const profileResult = await refopenAPI.getApplicantProfile(userId);
        if (profileResult?.success && profileResult?.data?.referralStats) {
          setReferralStats(profileResult.data.referralStats);
        }
      }

      // 2. Load points history + metadata
      const pointsResult = await refopenAPI.getReferralPointsHistory();
      if (pointsResult?.success && pointsResult.data) {
        setTotalPoints(pointsResult.data.totalPoints || 0);
        setPointsHistory(pointsResult.data.history || []);
        setPointTypeMetadata(pointsResult.data.pointTypeMetadata || {});
      }

      // 3. Load withdrawable balance
      await loadWithdrawableBalance();
    } catch (error) {
      console.error('Error loading earnings data:', error);
    }
  };

  const loadWithdrawableBalance = async () => {
    try {
      const response = await refopenAPI.getWithdrawableBalance();
      if (response.success && response.data) {
        setWithdrawableData(response.data);
      }
    } catch (error) {
      console.error('Error loading withdrawable balance:', error);
    }
  };



  // Group points by type for breakdown
  const getPointsBreakdown = () => {
    const breakdown = {};
    
    
    
    
    
    if (!pointsHistory || !Array.isArray(pointsHistory)) {
      
      return breakdown;
    }
    
    pointsHistory.forEach((entry, index) => {
      
      
      if (!entry || typeof entry !== 'object') {
        
        return;
      }
      
      // 🔧 CRITICAL FIX: Check multiple possible field names for points type
      const type = entry.PointsType || entry.pointsType || entry.type || 'general';
      
      // 🆕 Handle conversion transactions (negative points)
      const transactionType = entry.TransactionType || entry.transactionType || 'earned';
      const isConversion = transactionType === 'converted' || type === 'conversion';
      
      // Points should be positive for earned, negative for converted
      let points = parseInt(entry.PointsAmount || entry.PointsEarned || entry.pointsEarned || entry.points || 0);
      if (isConversion) {
        points = -Math.abs(points); // Make sure conversions are negative
      }
      
      
      
      
      
      
      if (!breakdown[type]) {
        breakdown[type] = {
          type,
          total: 0,
          count: 0,
          entries: []
        };
      }
      
      breakdown[type].total += points;
      breakdown[type].count += 1;
      breakdown[type].entries.push({
        ...entry,
        pointsEarned: points, // Store as signed value (negative for conversions)
        isConversion: isConversion
      });
      
      
    });
    
    
    
    return breakdown;
  };

  const pointsBreakdown = getPointsBreakdown();
  
  // 🔧 Log the processed breakdown
  
  

  // 🔧 UPDATED: Get point type display info with better fallbacks
  const getPointTypeInfo = (type) => {
    
    
    
    // Use backend metadata if available, with fallback to default
    const backendMetadata = pointTypeMetadata[type];
    
    if (backendMetadata) {
      
      return {
        icon: backendMetadata.icon || '🎯', // 🔧 Add fallback emoji
        title: backendMetadata.title || 'Points',
        description: backendMetadata.description || 'Referral activity points',
        color: backendMetadata.color || colors.primary
      };
    }
    
    // 🔧 Improved fallbacks for unknown types with guaranteed emojis
    const typeDefaults = {
      proof_submission: { 
        icon: '📸', 
        title: 'Proof Submissions', 
        color: colors.primary,
        description: 'Base points for submitting referral screenshots'
      },
      verification: { 
        icon: '✅', 
        title: 'Verifications', 
        color: '#10B981',
        description: 'Bonus points when job seekers confirm referrals'
      },
      quick_response_bonus: { 
        icon: '⚡', 
        title: 'Quick Response Bonus', 
        color: '#F59E0B',
        description: 'Extra points for responding within 24 hours'
      },
      monthly_bonus: { 
        icon: '🎁', 
        title: 'Monthly Bonus', 
        color: '#8B5CF6',
        description: 'Special monthly activity bonus'
      },
      streak_bonus: { 
        icon: '🔥', 
        title: 'Streak Bonus', 
        color: '#EF4444',
        description: 'Consecutive referral streak bonus'
      },
      general: { 
        icon: '🎯', 
        title: 'General Points', 
        color: '#6B7280',
        description: 'Other referral activities'
      }
    };
    
    const defaultInfo = typeDefaults[type] || typeDefaults.general;
    
    
    return {
      icon: defaultInfo.icon,
      title: defaultInfo.title,
      description: defaultInfo.description,
      color: defaultInfo.color
    };
  };

  const formatDate = (dateString) => {
    try {
      if (!dateString) return 'Unknown date';
      
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.warn('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
          {/* Header */}
          <SubScreenHeader title="Referrer Dashboard" fallbackTab="Profile" />

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* Referral Stats Row - FIRST */}
          <View style={styles.referralStatsRow}>
            <View style={styles.referralStatCard}>
              <Text style={styles.referralStatNumber}>{referralStats.totalReferralsMade || 0}</Text>
              <Text style={styles.referralStatLabel}>Referrals Made</Text>
            </View>
            <View style={styles.referralStatCard}>
              <Text style={[styles.referralStatNumber, { color: colors.success }]}>{referralStats.verifiedReferrals || 0}</Text>
              <Text style={styles.referralStatLabel}>Verified</Text>
            </View>
          </View>

          {/* Total Earnings + Total RefPoints - SECOND (side by side) */}
          <View style={styles.statsRowCompact}>
            <View style={styles.earningsCardCompact}>
              <Ionicons name="wallet" size={20} color={colors.success} />
              <Text style={styles.earningsAmountCompact}>₹{withdrawableData.withdrawableAmount || 0}</Text>
              <Text style={styles.statsLabelCompact}>Referral Earnings</Text>
            </View>
            <View style={styles.pointsCardCompact}>
              <Text style={styles.pointsEmojiCompact}>🏆</Text>
              <Text style={styles.pointsNumberCompact}>{totalPoints || 0}</Text>
              <Text style={styles.statsLabelCompact}>RefPoints</Text>
            </View>
          </View>

          {/* 🎯 Monthly Milestone Progress Bar — flat for all referrers */}
          {(() => {
            const verified = referralStats.verifiedReferrals || 0;
            const milestones = [
              { count: 5, bonus: pricing.milestone5Bonus || 50, color: '#3B82F6', emoji: '⭐' },
              { count: 10, bonus: pricing.milestone10Bonus || 100, color: '#F59E0B', emoji: '🔥' },
              { count: 20, bonus: pricing.milestone20Bonus || 200, color: '#10B981', emoji: '🏆' },
            ];
            const maxCount = 25;
            const progress = Math.min(verified / maxCount, 1);
            const currentMonth = new Date().toLocaleString('default', { month: 'short' });

            return (
              <View style={styles.milestoneSection}>
                <Text style={styles.milestoneSectionTitle}>🎯 Monthly Milestones ({currentMonth})</Text>
                
                <View style={styles.milestoneBarContainer}>
                  <View style={styles.milestoneBarTrack}>
                    <View style={[styles.milestoneBarFill, { width: `${progress * 100}%` }]} />
                    {milestones.map((m) => {
                      const pos = (m.count / maxCount) * 100;
                      const reached = verified >= m.count;
                      return (
                        <View key={m.count} style={[styles.milestoneMarker, { left: `${pos}%` }]}>
                          <View style={[
                            styles.milestoneMarkerDot,
                            reached ? { backgroundColor: m.color, borderColor: m.color } : { backgroundColor: colors.surface, borderColor: colors.border }
                          ]}>
                            <Text style={styles.milestoneMarkerEmoji}>{reached ? '✓' : m.count}</Text>
                          </View>
                        </View>
                      );
                    })}
                    {verified < maxCount && (
                      <View style={[styles.milestoneYouAreHere, { left: `${progress * 100}%` }]}>
                        <View style={styles.milestoneYouDot} />
                      </View>
                    )}
                  </View>
                  <View style={styles.milestoneLabelsRow}>
                    <Text style={[styles.milestoneCountLabel, { left: 0 }]}>0</Text>
                    {milestones.map((m) => (
                      <Text key={m.count} style={[styles.milestoneCountLabel, { left: `${(m.count / maxCount) * 100}%` }]}>{m.count}</Text>
                    ))}
                  </View>
                </View>

                <Text style={styles.milestoneCurrentText}>
                  You've done <Text style={{ fontWeight: 'bold', color: colors.primary }}>{verified}</Text> verified referral{verified !== 1 ? 's' : ''} this month
                </Text>

                <View style={styles.milestoneCardsRow}>
                  {milestones.map((m) => {
                    const reached = verified >= m.count;
                    const isNext = !reached && (milestones.findIndex(ms => verified < ms.count) === milestones.indexOf(m));
                    return (
                      <View key={m.count} style={[
                        styles.milestoneCard,
                        reached && { borderColor: m.color, backgroundColor: m.color + '15' },
                        isNext && { borderColor: m.color, borderStyle: 'dashed' }
                      ]}>
                        <Text style={styles.milestoneCardEmoji}>{m.emoji}</Text>
                        <Text style={[styles.milestoneCardCount, reached && { color: m.color }]}>{m.count} referrals</Text>
                        <Text style={[styles.milestoneCardBonus, reached && { color: m.color }]}>₹{m.bonus}</Text>
                        {reached && <Text style={[styles.milestoneCardStatus, { color: m.color }]}>✓ Earned</Text>}
                        {isNext && <Text style={[styles.milestoneCardStatus, { color: m.color }]}>{m.count - verified} more</Text>}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}

          {/* Points Breakdown by Type */}
          {Object.keys(pointsBreakdown).length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 RefPoints Breakdown by Type</Text>
              
              {Object.values(pointsBreakdown).map((category) => {
                const typeInfo = getPointTypeInfo(category.type);
                return (
                  <View key={category.type} style={styles.breakdownCard}>
                    <View style={styles.breakdownHeader}>
                      <View style={styles.breakdownTitleRow}>
                        <Text style={styles.breakdownIcon}>{typeInfo.icon}</Text>
                        <View style={styles.breakdownTitleColumn}>
                          <Text style={styles.breakdownTitle}>{typeInfo.title}</Text>
                          <Text style={styles.breakdownDescription}>{typeInfo.description}</Text>
                        </View>
                      </View>
                      <View style={styles.breakdownPointsColumn}>
                        <Text style={[styles.breakdownPoints, { color: typeInfo.color }]}>
                          +{category.total || 0}
                        </Text>
                        <Text style={styles.breakdownCount}>
                          {category.count || 0} time{(category.count || 0) !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Individual entries for this type */}
                    {(category.entries || []).map((entry, index) => {
                      const isConversion = entry.isConversion || entry.pointsEarned < 0;
                      const pointsValue = Math.abs(entry.pointsEarned || 0);
                      
                      return (
                        <View key={index} style={styles.entryRow}>
                          <Text style={styles.entryDate}>{formatDate(entry.TransactionDate || entry.AwardedAt || entry.awardedAt)}</Text>
                          <Text style={[
                            styles.entryPoints,
                            isConversion && styles.entryPointsNegative
                          ]}>
                            {isConversion ? '-' : '+'}{pointsValue}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>🎯</Text>
                <Text style={styles.emptyStateTitle}>No Points Yet</Text>
                <Text style={styles.emptyStateDescription}>
                  Start earning points by referring candidates for jobs at your company!
                </Text>
              </View>
            </View>
          )}


        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  // Referral Stats Row (first section)
  referralStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  referralStatCard: {
    flex: 1,
    backgroundColor: colors.surface || colors.background,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  referralStatNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  referralStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Compact row for Earnings + RefPoints
  statsRowCompact: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  // Milestone Progress Section
  milestoneSection: {
    marginBottom: 20,
    backgroundColor: colors.surface || colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  milestoneSectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 16 },
  milestoneBarContainer: { marginBottom: 12 },
  milestoneBarTrack: { height: 8, backgroundColor: colors.border, borderRadius: 4, position: 'relative', overflow: 'visible' },
  milestoneBarFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 4, position: 'absolute', left: 0, top: 0 },
  milestoneMarker: { position: 'absolute', top: -8, transform: [{ translateX: -12 }], alignItems: 'center' },
  milestoneMarkerDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  milestoneMarkerEmoji: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
  milestoneYouAreHere: { position: 'absolute', top: -4, transform: [{ translateX: -8 }] },
  milestoneYouDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#3B82F6', borderWidth: 3, borderColor: '#fff', shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 4 },
  milestoneLabelsRow: { position: 'relative', height: 20, marginTop: 4 },
  milestoneCountLabel: { position: 'absolute', fontSize: 10, color: colors.textSecondary, transform: [{ translateX: -5 }] },
  milestoneCurrentText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 12 },
  milestoneCardsRow: { flexDirection: 'row', gap: 8 },
  milestoneCard: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10, alignItems: 'center', backgroundColor: colors.surface || colors.background },
  milestoneCardEmoji: { fontSize: 20, marginBottom: 4 },
  milestoneCardCount: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  milestoneCardBonus: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginTop: 2 },
  milestoneCardStatus: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  earningsCardCompact: {
    flex: 1,
    backgroundColor: colors.surface || colors.background,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pointsCardCompact: {
    flex: 1,
    backgroundColor: colors.surface || colors.background,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  earningsAmountCompact: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.success,
    marginTop: 4,
  },
  pointsEmojiCompact: {
    fontSize: 20,
  },
  pointsNumberCompact: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 4,
  },
  statsLabelCompact: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  breakdownCard: {
    backgroundColor: colors.surface || colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  breakdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  breakdownIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  breakdownTitleColumn: {
    flex: 1,
  },
  breakdownTitle: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.medium || '500',
    color: colors.text,
  },
  breakdownDescription: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  breakdownPointsColumn: {
    alignItems: 'flex-end',
  },
  breakdownPoints: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
  },
  breakdownCount: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 36,
    borderTopWidth: 1,
    borderTopColor: colors.border + '50',
  },
  entryDate: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.textSecondary,
  },
  entryPoints: {
    fontSize: typography.sizes?.sm || 14,
    fontWeight: typography.weights?.medium || '500',
    color: colors.primary,
  },
  entryPointsNegative: {
    color: '#EF4444', // Red color for negative/spent points
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: typography.sizes?.md || 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  conversionSection: {
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  convertButton: {
    backgroundColor: '#7EB900',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#7EB900',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  convertButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convertIcon: {
    marginRight: 12,
  },
  convertTextContainer: {
    flex: 1,
  },
  convertButtonText: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  convertButtonSubtext: {
    fontSize: typography.sizes?.sm || 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  redirectSection: {
    marginTop: 8,
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  redirectButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  redirectButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  redirectIcon: {
    marginRight: 12,
  },
  redirectTextContainer: {
    flex: 1,
  },
  redirectButtonText: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  redirectButtonSubtext: {
    fontSize: typography.sizes?.sm || 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  conversionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  conversionModalContent: {
    backgroundColor: colors.surface || colors.background,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  conversionModalHeader: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  conversionModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  conversionModalDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
  },
  conversionRate: {
    backgroundColor: colors.primary + '10',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 20,
  },
  conversionRateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  conversionDetails: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  conversionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  conversionLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  conversionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  conversionAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7EB900',
  },
  conversionModalButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  conversionCancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  conversionCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  conversionConfirmButton: {
    flex: 1,
    backgroundColor: '#7EB900',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  conversionConfirmButtonDisabled: {
    opacity: 0.6,
  },
  conversionConfirmText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  
  // Withdraw Feature Styles
  withdrawSection: {
    backgroundColor: colors.surface || colors.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: responsive.isMobile ? 24 : 0,
    borderWidth: 1,
    borderColor: colors.success + '33',
  },
  withdrawHeader: {
    marginBottom: 16,
  },
  withdrawTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  withdrawTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  withdrawSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 28,
  },
  withdrawButtonContainer: {
    alignItems: 'center',
  },
  withdrawButtonOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background,
    borderWidth: 3,
    borderColor: colors.success + '55',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  withdrawButtonFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 0,
  },
  withdrawButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  withdrawButtonAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  withdrawButtonLabel: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 8,
  },
  withdrawProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  withdrawProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  withdrawProgressText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Withdraw Modal Styles - ScrollView
  withdrawModalScrollView: {
    flex: 1,
    maxHeight: '90%',
  },
  withdrawModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  // Compact Header for Modal
  withdrawModalHeaderCompact: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.success + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  withdrawModalTitleCompact: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  // Compact Liquid Display
  withdrawLiquidContainerCompact: {
    alignItems: 'center',
    marginVertical: 12,
  },
  withdrawLiquidOuterCompact: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.success + '55',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  withdrawLiquidAmountCompact: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  withdrawMinimumTextCompact: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 6,
  },
  // Original styles (kept for backwards compatibility)
  withdrawLiquidContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  withdrawLiquidOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background,
    borderWidth: 3,
    borderColor: colors.success + '55',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  withdrawLiquidFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  withdrawLiquidContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  withdrawLiquidAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  withdrawMinimumText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 12,
  },
  upiInputContainer: {
    width: '100%',
    marginBottom: 10,
  },
  upiLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  upiInput: {
    width: '100%',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 1.5,
  },
  validationErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  validationErrorText: {
    fontSize: 11,
    color: colors.error,
    flex: 1,
  },
  withdrawAvailableText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'right',
  },
  feeBreakdownContainer: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feeBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  feeBreakdownLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  feeBreakdownValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  feeBreakdownTotal: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 0,
  },
  feeBreakdownTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  feeBreakdownTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
  },
  withdrawWarningBox: {
    flexDirection: 'row',
    backgroundColor: colors.warning + '22',
    borderRadius: 8,
    padding: 8,
    gap: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  withdrawWarningText: {
    flex: 1,
    fontSize: 12,
    color: colors.warning,
  },
  withdrawInfoBox: {
    flexDirection: 'row',
    backgroundColor: colors.warning + '22',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  withdrawInfoText: {
    flex: 1,
    fontSize: 13,
    color: colors.warning,
    lineHeight: 18,
  },
  // Payment Method Styles
  paymentMethodContainer: {
    width: '100%',
    marginBottom: 10,
  },
  paymentMethodTabs: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  paymentMethodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  paymentMethodTabActive: {
    backgroundColor: colors.success,
  },
  paymentMethodTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  paymentMethodTabTextActive: {
    color: '#fff',
  },
});
