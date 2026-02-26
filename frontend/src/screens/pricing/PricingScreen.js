import React, { useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { usePricing } from '../../contexts/PricingContext';
import useResponsive from '../../hooks/useResponsive';
import ComplianceFooter from '../../components/ComplianceFooter';
import SubScreenHeader from '../../components/SubScreenHeader';

// ─── Helpers ───────────────────────────────────────────────
const fmt = (v) => `₹${v}`;

const Badge = ({ text, color, bg, style }) => (
  <View style={[{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }, style]}>
    <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{text}</Text>
  </View>
);

// ─── Individual Feature Card ───────────────────────────────
const FeatureRow = ({ icon, label, value, sub, colors }) => (
  <View style={{
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  }}>
    <View style={{
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.primary + '14',
      alignItems: 'center', justifyContent: 'center', marginRight: 12,
    }}>
      <Ionicons name={icon} size={18} color={colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>{label}</Text>
      {sub ? <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{sub}</Text> : null}
    </View>
    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{value}</Text>
  </View>
);

// ─── Tier Card ─────────────────────────────────────────────
const TierCard = ({ tier, price, payout, accent, icon, popular, colors, styles }) => (
  <View style={[
    styles.tierCard,
    popular && { borderColor: colors.primary, borderWidth: 2 },
  ]}>
    {popular && (
      <View style={styles.popularBadge}>
        <Text style={styles.popularText}>MOST POPULAR</Text>
      </View>
    )}
    <View style={{ alignItems: 'center', paddingTop: popular ? 10 : 0 }}>
      <View style={[styles.tierIcon, { backgroundColor: accent + '18' }]}>
        <Ionicons name={icon} size={26} color={accent} />
      </View>
      <Text style={[styles.tierName, { color: accent }]}>{tier}</Text>
      <Text style={styles.tierPrice}>{fmt(price)}</Text>
      <Text style={styles.tierPriceLabel}>per referral request</Text>
    </View>
    <View style={styles.tierDivider} />
    <View style={styles.tierDetail}>
      <Ionicons name="checkmark-circle" size={16} color={colors.success || '#10B981'} />
      <Text style={styles.tierDetailText}>Referrer earns {fmt(payout)}</Text>
    </View>
    <View style={styles.tierDetail}>
      <Ionicons name="checkmark-circle" size={16} color={colors.success || '#10B981'} />
      <Text style={styles.tierDetailText}>Direct request to verified employee</Text>
    </View>
    <View style={styles.tierDetail}>
      <Ionicons name="checkmark-circle" size={16} color={colors.success || '#10B981'} />
      <Text style={styles.tierDetailText}>Pay only if someone refers you</Text>
    </View>
  </View>
);

// ─── Main Component ────────────────────────────────────────
export default function PricingScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { pricing } = usePricing();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const tiers = [
    {
      tier: 'Standard',
      price: pricing.referralRequestCost,
      payout: pricing.standardReferrerPayout,
      accent: '#3B82F6',
      icon: 'person-outline',
    },
    {
      tier: 'Premium',
      price: pricing.premiumReferralCost,
      payout: pricing.premiumReferrerPayout,
      accent: '#8B5CF6',
      icon: 'star-outline',
      popular: true,
    },
    {
      tier: 'Elite',
      price: pricing.eliteReferralCost,
      payout: pricing.eliteReferrerPayout,
      accent: '#F59E0B',
      icon: 'diamond-outline',
    },
  ];

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Pricing" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.innerContainer}>
          <View style={styles.content}>

            {/* ── Hero ── */}
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>Simple, Transparent Pricing</Text>
              <Text style={styles.heroSub}>
                Pay only when someone actually refers you. No subscriptions, no hidden fees.
              </Text>
            </View>

            {/* ── Referral Tiers ── */}
            <Text style={styles.sectionTitle}>Referral Request Pricing</Text>
            <Text style={styles.sectionSub}>
              Cost depends on the referrer's tier at their company
            </Text>

            <View style={styles.tiersRow}>
              {tiers.map((t) => (
                <TierCard key={t.tier} {...t} colors={colors} styles={styles} />
              ))}
            </View>

            {/* ── Open to Any ── */}
            <View style={styles.highlightCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="globe-outline" size={22} color="#8B5CF6" />
                <Text style={[styles.highlightTitle, { marginLeft: 8 }]}>Open-to-Any Company</Text>
                <Badge text="WIDE REACH" color="#8B5CF6" bg="#8B5CF620" style={{ marginLeft: 'auto' }} />
              </View>
              <Text style={styles.highlightPrice}>{fmt(pricing.openToAnyReferralCost)}</Text>
              <Text style={styles.highlightSub}>
                Request goes to referrers across all companies — great if you're open to multiple opportunities.
              </Text>
            </View>

            {/* ── AI & Tools ── */}
            <Text style={styles.sectionTitle}>AI & Career Tools</Text>
            <View style={styles.card}>
              <FeatureRow
                icon="sparkles-outline"
                label="AI Job Recommendations"
                value={fmt(pricing.aiJobsCost)}
                sub={`${pricing.aiAccessDurationDays}-day access`}
                colors={colors}
              />
              <FeatureRow
                icon="document-text-outline"
                label="AI Resume Analysis"
                value={pricing.aiResumeFreeUses > 0
                  ? `${pricing.aiResumeFreeUses} free, then ${fmt(pricing.aiResumeAnalysisCost)}`
                  : fmt(pricing.aiResumeAnalysisCost)}
                sub="Detailed feedback & score"
                colors={colors}
              />
              <FeatureRow
                icon="reader-outline"
                label="Resume Templates"
                value={fmt(pricing.resumeTemplateCost)}
                sub="Professional ATS-friendly templates"
                colors={colors}
              />
              <FeatureRow
                icon="eye-outline"
                label="Profile Views"
                value={fmt(pricing.profileViewCost)}
                sub={`${pricing.profileViewAccessDurationDays}-day access`}
                colors={colors}
              />
            </View>

            {/* ── Referrer Earnings ── */}
            <Text style={styles.sectionTitle}>Referrer Rewards</Text>
            <Text style={styles.sectionSub}>
              Earn by helping others land jobs
            </Text>
            <View style={styles.card}>
              <FeatureRow
                icon="cash-outline"
                label="Standard Referral Payout"
                value={fmt(pricing.standardReferrerPayout)}
                sub="Per accepted referral"
                colors={colors}
              />
              <FeatureRow
                icon="cash-outline"
                label="Premium Referral Payout"
                value={fmt(pricing.premiumReferrerPayout)}
                sub="Per accepted referral"
                colors={colors}
              />
              <FeatureRow
                icon="cash-outline"
                label="Elite Referral Payout"
                value={fmt(pricing.eliteReferrerPayout)}
                sub="Per accepted referral"
                colors={colors}
              />
            </View>

            {/* ── Milestone Bonuses ── */}
            <Text style={styles.sectionTitle}>Milestone Bonuses</Text>
            <View style={styles.milestonesRow}>
              {[
                { count: 5, bonus: pricing.milestone5Bonus, emoji: '🎯' },
                { count: 10, bonus: pricing.milestone10Bonus, emoji: '🔥' },
                { count: 20, bonus: pricing.milestone20Bonus, emoji: '🏆' },
              ].map((m) => (
                <View key={m.count} style={styles.milestoneChip}>
                  <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                  <Text style={styles.milestoneCount}>{m.count} referrals</Text>
                  <Text style={styles.milestoneBonus}>+{fmt(m.bonus)}</Text>
                </View>
              ))}
            </View>

            {/* ── Other Info ── */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
                <Text style={styles.infoText}>Hold-based billing — you're charged only when someone refers you. If no one picks up your request in 2 weeks, the hold is released.</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="wallet-outline" size={20} color={colors.primary} />
                <Text style={styles.infoText}>Minimum withdrawal: {fmt(pricing.minimumWithdrawal)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="infinite-outline" size={20} color={colors.primary} />
                <Text style={styles.infoText}>Wallet credits never expire while your account is active.</Text>
              </View>
            </View>

            {/* ── CTA ── */}
            <TouchableOpacity
              style={styles.ctaButton}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Wallet')}
            >
              <Ionicons name="wallet-outline" size={20} color="#fff" />
              <Text style={styles.ctaText}>Add Money to Wallet</Text>
            </TouchableOpacity>

            <ComplianceFooter currentPage="pricing" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────
const createStyles = (colors, responsive = {}) => {
  const isDesktop = Platform.OS === 'web' && responsive.isDesktop;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      ...(isDesktop ? { alignItems: 'center' } : {}),
    },
    scrollView: { flex: 1, width: '100%' },
    innerContainer: {
      width: '100%',
      maxWidth: isDesktop ? 900 : '100%',
      alignSelf: 'center',
    },
    content: { padding: 20, paddingBottom: 40 },

    // ── Hero
    hero: { alignItems: 'center', marginBottom: 28 },
    heroTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    heroSub: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 360,
    },

    // ── Section headers
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginTop: 28,
      marginBottom: 4,
    },
    sectionSub: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 14,
    },

    // ── Tier cards
    tiersRow: {
      flexDirection: isDesktop ? 'row' : 'column',
      gap: 14,
      marginTop: 8,
    },
    tierCard: {
      flex: isDesktop ? 1 : undefined,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    popularBadge: {
      position: 'absolute',
      top: 0, left: 0, right: 0,
      backgroundColor: colors.primary,
      paddingVertical: 4,
      alignItems: 'center',
    },
    popularText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
    },
    tierIcon: {
      width: 52, height: 52, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 10,
    },
    tierName: {
      fontSize: 16, fontWeight: '700',
      marginBottom: 4,
    },
    tierPrice: {
      fontSize: 28, fontWeight: '800',
      color: colors.text,
    },
    tierPriceLabel: {
      fontSize: 12, color: colors.textSecondary,
      marginBottom: 8,
    },
    tierDivider: {
      height: 1,
      backgroundColor: colors.border,
      alignSelf: 'stretch',
      marginVertical: 12,
    },
    tierDetail: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginBottom: 8,
    },
    tierDetailText: {
      fontSize: 13, color: colors.textSecondary,
      marginLeft: 6,
    },

    // ── Highlight (open-to-any)
    highlightCard: {
      backgroundColor: '#8B5CF610',
      borderRadius: 14,
      padding: 18,
      marginTop: 18,
      borderWidth: 1,
      borderColor: '#8B5CF630',
    },
    highlightTitle: {
      fontSize: 16, fontWeight: '700',
      color: colors.text,
    },
    highlightPrice: {
      fontSize: 28, fontWeight: '800',
      color: '#8B5CF6',
      marginBottom: 4,
    },
    highlightSub: {
      fontSize: 13, color: colors.textSecondary,
      lineHeight: 20,
    },

    // ── Generic card
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 6,
    },

    // ── Milestones
    milestonesRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 10,
    },
    milestoneChip: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    milestoneCount: {
      fontSize: 13, fontWeight: '600',
      color: colors.text,
      marginTop: 6,
    },
    milestoneBonus: {
      fontSize: 16, fontWeight: '800',
      color: '#10B981',
      marginTop: 2,
    },

    // ── Info card
    infoCard: {
      backgroundColor: colors.primary + '0A',
      borderRadius: 14,
      padding: 18,
      marginTop: 28,
      borderWidth: 1,
      borderColor: colors.primary + '20',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
      marginLeft: 10,
      flex: 1,
    },

    // ── CTA
    ctaButton: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 12,
      marginTop: 24,
      marginBottom: 16,
    },
    ctaText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });
};
