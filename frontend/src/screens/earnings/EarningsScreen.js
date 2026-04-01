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
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});

  // FAQ data (frontend-only, not DB driven)
  const faqData = [
    {
      question: 'How do I earn referral earnings?',
      answer: 'When you refer a candidate for a job and the job seeker verifies your referral, you earn a cash payout directly to your wallet. The payout amount varies based on the company.'
    },
    {
      question: 'What are milestone bonuses?',
      answer: 'Milestone bonuses are extra cash rewards for hitting referral targets each month. The more verified referrals you complete, the bigger the bonus. Check the milestone progress bar above to see your current targets.'
    },
    {
      question: 'What are RefPoints?',
      answer: 'RefPoints are activity points earned for submitting referral proofs, getting verifications, quick responses, and monthly streaks. They track your referral activity and contribution to the platform.'
    },
    {
      question: 'How do I withdraw my earnings?',
      answer: 'Go to your Wallet and tap Withdraw. You can withdraw via UPI or bank transfer once your balance reaches the minimum withdrawal amount. Withdrawals are processed within 24-48 hours.'
    },
    {
      question: 'When do I get paid for a referral?',
      answer: 'You get paid once the job seeker confirms (verifies) your referral. After verification, the earning is credited to your wallet instantly. Unverified referrals do not earn payouts.'
    },
    {
      question: 'Do milestone bonuses reset every month?',
      answer: 'Yes, milestone progress resets at the start of each calendar month. You can earn milestone bonuses every month by hitting the targets again.'
    },
  ];

  // Data state (loaded from APIs)
  const [totalPoints, setTotalPoints] = useState(0);
  const [pointsHistory, setPointsHistory] = useState([]);

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
  
  

  // Point type display info (frontend-only) — uses Ionicons instead of emojis
  const getPointTypeInfo = (type) => {
    const typeDefaults = {
      proof_submission: { 
        ionicon: 'camera-outline', 
        title: 'Proof Submissions', 
        color: colors.primary,
        description: 'Base points for submitting referral screenshots'
      },
      verification: { 
        ionicon: 'checkmark-circle-outline', 
        title: 'Verifications', 
        color: colors.success,
        description: 'Bonus points when job seekers confirm referrals'
      },
      quick_response_bonus: { 
        ionicon: 'flash-outline', 
        title: 'Quick Response Bonus', 
        color: colors.warning,
        description: 'Extra points for responding within 24 hours'
      },
      monthly_bonus: { 
        ionicon: 'gift-outline', 
        title: 'Monthly Bonus', 
        color: colors.accent,
        description: 'Special monthly activity bonus'
      },
      streak_bonus: { 
        ionicon: 'flame-outline', 
        title: 'Streak Bonus', 
        color: colors.error,
        description: 'Consecutive referral streak bonus'
      },
      general: { 
        ionicon: 'ellipse-outline', 
        title: 'General Points', 
        color: colors.gray500 || colors.textSecondary,
        description: 'Other referral activities'
      },
      milestone_5: { 
        ionicon: 'star-outline', 
        title: '5th Referral Milestone', 
        color: colors.primary,
        description: 'Bonus for reaching 5 verified referrals'
      },
      milestone_10: { 
        ionicon: 'flame-outline', 
        title: '10th Referral Milestone', 
        color: colors.warning,
        description: 'Bonus for reaching 10 verified referrals'
      },
      milestone_15: { 
        ionicon: 'trophy-outline', 
        title: '15th Referral Milestone', 
        color: colors.error,
        description: 'Bonus for reaching 15 verified referrals'
      },
      milestone_20: { 
        ionicon: 'diamond-outline', 
        title: '20th Referral Milestone', 
        color: colors.success,
        description: 'Bonus for reaching 20 verified referrals'
      }
    };
    
    const defaultInfo = typeDefaults[type] || typeDefaults.general;
    
    return {
      ionicon: defaultInfo.ionicon,
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
          
          {/* ── Hero Stats ── */}
          <View style={styles.heroStats}>
            {/* Primary: Earnings — the number that matters most */}
            <View style={styles.heroPrimary}>
              <View style={styles.heroPrimaryIconWrap}>
                <Ionicons name="wallet-outline" size={22} color={colors.success} />
              </View>
              <Text style={styles.heroPrimaryAmount}>₹{withdrawableData.withdrawableAmount || 0}</Text>
              <Text style={styles.heroPrimaryLabel}>Total Earnings</Text>
            </View>

            {/* Secondary: 3 compact metrics */}
            <View style={styles.heroSecondaryRow}>
              <View style={styles.heroSecondaryItem}>
                <Text style={styles.heroSecondaryNumber}>{referralStats.totalReferralsMade || 0}</Text>
                <Text style={styles.heroSecondaryLabel}>Referrals</Text>
              </View>
              <View style={[styles.heroSecondaryItem, styles.heroSecondaryItemBorder]}>
                <Text style={[styles.heroSecondaryNumber, { color: colors.success }]}>{referralStats.verifiedReferrals || 0}</Text>
                <Text style={styles.heroSecondaryLabel}>Verified</Text>
              </View>
              <View style={styles.heroSecondaryItem}>
                <Text style={[styles.heroSecondaryNumber, { color: colors.primary }]}>{totalPoints || 0}</Text>
                <Text style={styles.heroSecondaryLabel}>RefPoints</Text>
              </View>
            </View>
          </View>

          {/* ── Monthly Milestones ── */}
          {(() => {
            const verified = referralStats.verifiedThisMonth || 0;
            const milestones = [
              { count: 5, bonus: 100, color: colors.primary, ionicon: 'star', hidden: false },
              { count: 10, color: colors.warning, ionicon: 'flame', hidden: true },
              { count: 15, color: colors.error, ionicon: 'trophy', hidden: true },
              { count: 20, color: colors.success, ionicon: 'diamond', hidden: true },
            ];
            const currentMonth = new Date().toLocaleString('default', { month: 'long' });
            const nextMilestone = milestones.find(m => verified < m.count);
            const remaining = nextMilestone ? nextMilestone.count - verified : 0;

            return (
              <View style={styles.milestoneSection}>
                <View style={styles.milestoneTitleRow}>
                  <Text style={styles.milestoneSectionTitle}>Monthly Milestones</Text>
                  <View style={styles.milestoneMonthBadge}>
                    <Text style={styles.milestoneMonthText}>{currentMonth}</Text>
                  </View>
                </View>
                <Text style={styles.milestoneSubheading}>Extra cash rewards on top of your per-referral earnings</Text>
                
                {/* Progress indicator */}
                <View style={styles.milestoneProgressRow}>
                  <Text style={styles.milestoneProgressCount}>
                    <Text style={{ fontWeight: '700', color: colors.text }}>{verified}</Text>
                    <Text style={{ color: colors.textSecondary }}> / {nextMilestone ? nextMilestone.count : '20+'}</Text>
                  </Text>
                  {nextMilestone ? (
                    <Text style={styles.milestoneProgressHint}>{remaining} more to next reward</Text>
                  ) : (
                    <Text style={[styles.milestoneProgressHint, { color: colors.success }]}>All milestones reached!</Text>
                  )}
                </View>

                {/* Clean progress bar */}
                <View style={styles.milestoneBarTrack}>
                  <View style={[styles.milestoneBarFill, { width: `${Math.min(verified / 20, 1) * 100}%` }]} />
                </View>

                {/* Milestone cards */}
                <View style={styles.milestoneCardsRow}>
                  {milestones.map((m) => {
                    const reached = verified >= m.count;
                    const isNext = !reached && milestones.findIndex(ms => verified < ms.count) === milestones.indexOf(m);
                    const milestoneBreakdown = pointsBreakdown[`milestone_${m.count}`]?.total;
                    const earnedAmount = m.hidden && reached
                      ? (milestoneBreakdown || m.bonus || null)
                      : m.bonus;
                    return (
                      <View key={m.count} style={[
                        styles.milestoneCard,
                        reached && { borderColor: m.color, backgroundColor: m.color + '12' },
                        isNext && { borderColor: m.color + '60' }
                      ]}>
                        <View style={[styles.milestoneCardIcon, reached && { backgroundColor: m.color + '20' }]}>
                          <Ionicons name={reached ? 'checkmark-circle' : m.ionicon + '-outline'} size={20} color={reached ? m.color : colors.textSecondary} />
                        </View>
                        <Text style={[styles.milestoneCardCount, reached && { color: m.color }]}>{m.count}</Text>
                        {m.hidden && !reached ? (
                          <Text style={styles.milestoneCardBonusHidden}>Hidden</Text>
                        ) : earnedAmount ? (
                          <Text style={[styles.milestoneCardBonus, reached && { color: m.color }]}>₹{earnedAmount}</Text>
                        ) : (
                          <Text style={styles.milestoneCardBonusHidden}>Bonus</Text>
                        )}
                        {reached && <Text style={[styles.milestoneCardStatus, { color: m.color }]}>Earned</Text>}
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
              <Text style={styles.sectionTitle}>RefPoints Breakdown</Text>
              
              {Object.values(pointsBreakdown).map((category) => {
                const typeInfo = getPointTypeInfo(category.type);
                return (
                  <View key={category.type} style={styles.breakdownCard}>
                    <View style={styles.breakdownHeader}>
                      <View style={styles.breakdownTitleRow}>
                        <View style={[styles.breakdownIconWrap, { backgroundColor: typeInfo.color + '15' }]}>
                          <Ionicons name={typeInfo.ionicon} size={18} color={typeInfo.color} />
                        </View>
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
                    {(category.entries || []).slice(0, expandedCategories[category.type] ? undefined : 3).map((entry, index) => {
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
                    {(category.entries || []).length > 3 && (
                      <TouchableOpacity
                        onPress={() => setExpandedCategories(prev => ({ ...prev, [category.type]: !prev[category.type] }))}
                        style={{ alignItems: 'center', paddingVertical: 6 }}
                      >
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                          {expandedCategories[category.type] ? 'Show less' : `Show all ${category.entries.length} entr${category.entries.length === 1 ? 'y' : 'ies'}`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.emptyState}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Ionicons name="trophy-outline" size={28} color={colors.primary} />
                </View>
                <Text style={styles.emptyStateTitle}>No Points Yet</Text>
                <Text style={styles.emptyStateDescription}>
                  Start earning by referring candidates for jobs at your company!
                </Text>
              </View>
            </View>
          )}

          {/* FAQ Section — frontend only, collapsible like Resume Analyzer */}
          <View style={styles.faqSection}>
            <Text style={styles.faqSectionTitle}>Frequently Asked Questions</Text>
            <View style={styles.faqSubtitleRow}>
              <Text style={styles.faqSectionSubtitle}>
                Have a question? Find answers below or{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Support')}>
                <Text style={styles.faqSupportLink}>contact support</Text>
              </TouchableOpacity>
            </View>
            {faqData.map((faq, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.faqItem}
                onPress={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                activeOpacity={0.7}
              >
                <View style={styles.faqQuestionRow}>
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <Ionicons
                    name={expandedFaq === idx ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
                {expandedFaq === idx && (
                  <Text style={styles.faqAnswer}>{faq.answer}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>


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
  // ── Hero Stats ──
  heroStats: {
    marginBottom: 20,
  },
  heroPrimary: {
    backgroundColor: colors.surface || colors.background,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  heroPrimaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroPrimaryAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: -0.5,
  },
  heroPrimaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  heroSecondaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface || colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  heroSecondaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  heroSecondaryItemBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  heroSecondaryNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  heroSecondaryLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  // kept for backward compat
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
  // ── Milestone Section ──
  milestoneSection: {
    marginBottom: 20,
    backgroundColor: colors.surface || colors.background,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  milestoneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  milestoneSectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  milestoneMonthBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  milestoneMonthText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  milestoneSubheading: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  milestoneProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  milestoneProgressCount: { fontSize: 20, fontWeight: '600' },
  milestoneProgressHint: { fontSize: 12, color: colors.textSecondary },
  milestoneBarTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  milestoneBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  milestoneCardsRow: { flexDirection: 'row', gap: 8 },
  milestoneCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
    backgroundColor: colors.surface || colors.background,
  },
  milestoneCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border + '50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  milestoneCardCount: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 2 },
  milestoneCardBonus: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  milestoneCardBonusHidden: { fontSize: 11, color: colors.textSecondary + '80', fontStyle: 'italic' },
  milestoneCardStatus: { fontSize: 10, fontWeight: '600', marginTop: 4 },
  // (compact stat styles removed — now using heroStats layout)
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
  breakdownIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: colors.error, // Red color for negative/spent points
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
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
    backgroundColor: colors.success,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.success,
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
    color: colors.white,
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
    color: colors.white,
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
    shadowColor: colors.black,
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
    color: colors.success,
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
    backgroundColor: colors.success,
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
    color: colors.white,
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
    color: colors.white,
  },
  // FAQ Section
  faqSection: {
    paddingVertical: 20,
    marginBottom: 24,
  },
  faqSectionTitle: {
    fontSize: responsive.isMobile ? 20 : 24,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  faqSectionSubtitle: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  faqSubtitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    maxWidth: 400,
    alignSelf: 'center',
  },
  faqSupportLink: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.primary,
    fontWeight: typography.weights?.semibold || '600',
    textDecorationLine: 'underline',
    lineHeight: 22,
  },
  faqItem: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 14,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.semibold || '600',
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: 8,
  },
});
