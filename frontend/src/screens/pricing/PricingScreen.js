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
    <Text style={{ fontSize: 15, fontWeight: '700', color: value === 'Free' ? (colors.success || '#10B981') : colors.text }}>{value}</Text>
  </View>
);



// ─── Main Component ────────────────────────────────────────
export default function PricingScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { pricing } = usePricing();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Pricing" />
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

            {/* ── Referral Pricing Card ── */}
            <View style={styles.pricingCard}>
              <View style={styles.pricingCardAccent} />
              <View style={styles.pricingCardInner}>
                <View style={styles.pricingIconRow}>
                  <View style={styles.pricingIconCircle}>
                    <Ionicons name="send-outline" size={24} color={colors.primary} />
                  </View>
                  <Badge text="PER REQUEST" color={colors.primary} bg={colors.primary + '14'} />
                </View>

                <Text style={styles.pricingLabel}>Referral Request</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceRange}>{fmt(pricing.referralRequestCost)} – {fmt(pricing.eliteReferralCost)}</Text>
                </View>
                <Text style={styles.priceNote}>Exact price shown when you send a request</Text>

                <View style={styles.pricingDivider} />

                <View style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success || '#10B981'} />
                  <Text style={styles.benefitText}>Direct request to verified employees</Text>
                </View>
                <View style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success || '#10B981'} />
                  <Text style={styles.benefitText}>You're only charged when someone refers you</Text>
                </View>
                <View style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success || '#10B981'} />
                  <Text style={styles.benefitText}>Auto-refund if no one picks up in 2 weeks</Text>
                </View>
              </View>
            </View>

            {/* ── Open to Any ── */}
            <View style={styles.openCard}>
              <View style={styles.openCardInner}>
                <View style={styles.pricingIconRow}>
                  <View style={[styles.pricingIconCircle, { backgroundColor: '#8B5CF614' }]}>
                    <Ionicons name="globe-outline" size={24} color="#8B5CF6" />
                  </View>
                  <Badge text="WIDE REACH" color="#8B5CF6" bg="#8B5CF620" />
                </View>

                <Text style={styles.pricingLabel}>Open-to-Any Company</Text>
                <Text style={styles.openPrice}>{fmt(pricing.openToAnyReferralCost)}</Text>
                <Text style={styles.priceNote}>
                  Your request goes to referrers across all companies — great when you're open to multiple opportunities.
                </Text>
              </View>
            </View>

            {/* ── AI & Tools ── */}
            <Text style={styles.sectionTitle}>AI & Career Tools</Text>
            <View style={styles.card}>
              <FeatureRow
                icon="briefcase-outline"
                label="Job Posting"
                value="Free"
                sub="Post and discover jobs at no cost"
                colors={colors}
              />
              <FeatureRow
                icon="document-text-outline"
                label="AI Resume Analysis"
                value="Free"
                sub="Detailed feedback & score"
                colors={colors}
              />
              <FeatureRow
                icon="reader-outline"
                label="Resume Templates"
                value="Free"
                sub="Professional ATS-friendly templates"
                colors={colors}
              />
              <FeatureRow
                icon="color-wand-outline"
                label="AI Job Recommendations"
                value={fmt(pricing.aiJobsCost)}
                sub={`${pricing.aiAccessDurationDays}-day access`}
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

            {/* ── Other Info ── */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
                <Text style={styles.infoText}>Hold-based billing — you're charged only when someone refers you. If no one picks up your request in 2 weeks, the hold is released.</Text>
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
              onPress={() => navigation.navigate('WalletRecharge')}
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

    // ── Referral pricing card
    pricingCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      marginTop: 24,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    pricingCardAccent: {
      height: 4,
      backgroundColor: colors.primary,
    },
    pricingCardInner: {
      padding: 22,
    },
    pricingIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    pricingIconCircle: {
      width: 46, height: 46, borderRadius: 14,
      backgroundColor: colors.primary + '14',
      alignItems: 'center', justifyContent: 'center',
    },
    pricingLabel: {
      fontSize: 18, fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: 4,
    },
    priceRange: {
      fontSize: 32, fontWeight: '800',
      color: colors.text,
    },
    priceNote: {
      fontSize: 13, color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 4,
    },
    pricingDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    benefitText: {
      fontSize: 14, color: colors.textSecondary,
      marginLeft: 8,
      flex: 1,
    },

    // ── Open-to-any card
    openCard: {
      backgroundColor: '#8B5CF60A',
      borderRadius: 18,
      marginTop: 16,
      borderWidth: 1,
      borderColor: '#8B5CF625',
      overflow: 'hidden',
    },
    openCardInner: {
      padding: 22,
    },
    openPrice: {
      fontSize: 32, fontWeight: '800',
      color: '#8B5CF6',
      marginBottom: 6,
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
