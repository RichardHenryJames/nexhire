import React, { useMemo, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePricing } from '../../contexts/PricingContext';
import useResponsive from '../../hooks/useResponsive';
import ComplianceFooter from '../../components/ComplianceFooter';
import SubScreenHeader from '../../components/SubScreenHeader';
import refopenAPI from '../../services/api';
import { showToast } from '../../components/Toast';

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
    <Text style={{ fontSize: 15, fontWeight: '700', color: value === 'Free' ? (colors.success) : colors.text }}>{value}</Text>
  </View>
);



// ─── Main Component ────────────────────────────────────────
export default function PricingScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { pricing } = usePricing();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('monthly');

  const handleSubscribe = useCallback(async (plan) => {
    if (!isAuthenticated) { navigation.navigate('Auth'); showToast('Please log in to subscribe', 'info'); return; }
    setSubscribing(true);
    try {
      const res = await refopenAPI.subscribeToPro(plan);
      if (res?.success) {
        showToast(res.data?.message || 'Welcome to RefOpen Pro! 🎉', 'success');
      } else if (res?.errorCode === 'INSUFFICIENT_BALANCE') {
        showToast(`Insufficient balance. Need ₹${plan === 'monthly' ? pricing.proMonthlyPrice : pricing.proSemiAnnualPrice}`, 'error');
        navigation.navigate('WalletRecharge');
      } else {
        showToast(res?.error || 'Failed to subscribe', 'error');
      }
    } catch (e) {
      showToast('Failed to subscribe. Please try again.', 'error');
    } finally { setSubscribing(false); }
  }, [isAuthenticated, navigation, pricing]);

  const BRAND = '#4F46E5';

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
                Get more with Pro, or pay-per-use. Your choice.
              </Text>
            </View>

            {/* ══════ PRO SUBSCRIPTION SECTION ══════ */}
            <View style={{ marginBottom: 28 }}>

              {/* Plan toggle */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setSelectedPlan('monthly')}
                  style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, backgroundColor: selectedPlan === 'monthly' ? BRAND : colors.surface, borderWidth: 1, borderColor: selectedPlan === 'monthly' ? BRAND : colors.border }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: selectedPlan === 'monthly' ? '#fff' : colors.text }}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedPlan('semi_annual')}
                  style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, backgroundColor: selectedPlan === 'semi_annual' ? BRAND : colors.surface, borderWidth: 1, borderColor: selectedPlan === 'semi_annual' ? BRAND : colors.border }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: selectedPlan === 'semi_annual' ? '#fff' : colors.text }}>6 Months</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: selectedPlan === 'semi_annual' ? '#fff' : colors.success, textAlign: 'center' }}>Save 11%</Text>
                </TouchableOpacity>
              </View>

              {/* Free vs Pro comparison */}
              <View style={{ flexDirection: responsive.isDesktop ? 'row' : 'column', gap: 16 }}>

                {/* Free Plan */}
                <View style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 20 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>Free</Text>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>₹0</Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>Pay-per-use</Text>

                  {[
                    { text: 'Browse & apply to 45,000+ jobs', included: true },
                    { text: 'Resume Analyzer — 2 free uses', included: true },
                    { text: 'Blind Review — 1 free use', included: true },
                    { text: 'LinkedIn Optimizer — 1 free use', included: true },
                    { text: 'Resume Builder — 1 free template', included: true },
                    { text: `Referrals: ₹${pricing.referralRequestCost}–₹${pricing.eliteReferralCost} per use`, included: true },
                    { text: `AI Jobs: ₹${pricing.aiJobsCost} per use`, included: true },
                    { text: `Open-to-Any: ₹${pricing.openToAnyReferralCost}`, included: true },
                    { text: '3 referrals/month included', included: false },
                    { text: 'Unlimited AI tools', included: false },
                  ].map((item, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                      <Ionicons name={item.included ? 'checkmark-circle' : 'close-circle'} size={18} color={item.included ? colors.success : colors.gray400} style={{ marginTop: 1 }} />
                      <Text style={{ fontSize: 13, color: item.included ? colors.text : colors.gray400, flex: 1 }}>{item.text}</Text>
                    </View>
                  ))}
                </View>

                {/* Pro Plan */}
                <View style={{ flex: 1, borderRadius: 16, borderWidth: 2, borderColor: BRAND, backgroundColor: colors.surface, padding: 20, position: 'relative', overflow: 'hidden' }}>
                  {/* Popular badge */}
                  <View style={{ position: 'absolute', top: 12, right: -30, backgroundColor: BRAND, paddingHorizontal: 30, paddingVertical: 4, transform: [{ rotate: '45deg' }] }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>POPULAR</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: BRAND }}>Pro</Text>
                    <View style={{ backgroundColor: BRAND + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: BRAND }}>💎 RECOMMENDED</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: BRAND }}>
                      ₹{selectedPlan === 'monthly' ? pricing.proMonthlyPrice : Math.round(pricing.proSemiAnnualPrice / 6)}
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>/month</Text>
                  </View>
                  {selectedPlan === 'semi_annual' && (
                    <Text style={{ fontSize: 12, color: colors.success, fontWeight: '600', marginBottom: 4 }}>₹{pricing.proSemiAnnualPrice} billed every 6 months</Text>
                  )}
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>Everything included</Text>

                  {[
                    { text: 'Browse & apply to 45,000+ jobs', included: true },
                    { text: '3 referrals/month INCLUDED (any tier)', included: true, highlight: true },
                    { text: 'Unlimited Resume Analyzer', included: true, highlight: true },
                    { text: 'Unlimited Blind Reviews', included: true, highlight: true },
                    { text: 'Unlimited LinkedIn Optimizer', included: true, highlight: true },
                    { text: 'AI Job Recommendations (always on)', included: true, highlight: true },
                    { text: 'Resume Builder — all templates', included: true, highlight: true },
                    { text: `Open-to-Any at ₹${pricing.proOtaDiscountPrice} (vs ₹${pricing.openToAnyReferralCost})`, included: true, highlight: true },
                    { text: 'Pro badge on profile', included: true },
                    { text: 'Priority referral matching', included: true },
                  ].map((item, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                      <Ionicons name="checkmark-circle" size={18} color={item.highlight ? BRAND : colors.success} style={{ marginTop: 1 }} />
                      <Text style={{ fontSize: 13, color: colors.text, flex: 1, fontWeight: item.highlight ? '600' : '400' }}>{item.text}</Text>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={{ backgroundColor: BRAND, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12, flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: subscribing ? 0.6 : 1 }}
                    onPress={() => handleSubscribe(selectedPlan)}
                    disabled={subscribing}
                  >
                    {subscribing ? <ActivityIndicator size="small" color="#fff" /> : (
                      <>
                        <Ionicons name="diamond-outline" size={18} color="#fff" />
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                          Subscribe — ₹{selectedPlan === 'monthly' ? pricing.proMonthlyPrice : pricing.proSemiAnnualPrice}{selectedPlan === 'semi_annual' ? '/6mo' : '/mo'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>Paid from wallet balance. Cancel anytime.</Text>
                </View>
              </View>
            </View>

            {/* ── Divider ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>PAY-PER-USE PRICING</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
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
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.benefitText}>Direct request to verified employees</Text>
                </View>
                <View style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.benefitText}>You're only charged when someone refers you</Text>
                </View>
                <View style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.benefitText}>Auto-refund to wallet if no one picks up in 2 weeks</Text>
                </View>
              </View>
            </View>

            {/* ── Open to Any — Flagship ── */}
            <View style={styles.openCard}>
              <View style={styles.openCardInner}>
                <View style={styles.pricingIconRow}>
                  <View style={[styles.pricingIconCircle, { backgroundColor: colors.accentBg }]}>
                    <Ionicons name="globe-outline" size={24} color={colors.accent} />
                  </View>
                  <Badge text="FLAGSHIP" color={colors.accent} bg={colors.accentBg} />
                </View>

                <Text style={styles.pricingLabel}>Open-to-Any Company</Text>
                <Text style={styles.openPrice}>{fmt(pricing.openToAnyReferralCost)}</Text>
                <Text style={styles.priceNote}>
                  Your request is broadcast to referrers at every company on the platform.
                </Text>

                <View style={{ marginTop: 12, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 13, color: colors.text }}>Referrers from multiple companies can refer you</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 13, color: colors.text }}>Pay once — get referred from Google, Microsoft & more</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 13, color: colors.text }}>Full refund to wallet if no one refers you</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 13, color: colors.text }}>Upgrade any existing request for the difference</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── AI & Tools ── */}
            <Text style={styles.sectionTitle}>AI & Career Tools (Pay-per-use)</Text>
            <View style={styles.card}>
              <FeatureRow
                icon="briefcase-outline"
                label="Job Posting & Apply"
                value="Free"
                sub="Browse and apply to 45,000+ jobs"
                colors={colors}
              />
              <FeatureRow
                icon="document-text-outline"
                label="AI Resume Analysis"
                value={`${pricing.aiResumeFreeUses} Free`}
                sub={`Then ${fmt(pricing.aiResumeAnalysisCost)} each (or unlimited with Pro)`}
                colors={colors}
              />
              <FeatureRow
                icon="eye-outline"
                label="Blind Review"
                value={`${pricing.blindReviewFreeUses || 1} Free`}
                sub="Feedback from dream company employees (unlimited with Pro)"
                colors={colors}
              />
              <FeatureRow
                icon="logo-linkedin"
                label="LinkedIn Optimizer"
                value={`${pricing.linkedInOptimizerFreeUses || 1} Free`}
                sub="AI profile review (unlimited with Pro)"
                colors={colors}
              />
              <FeatureRow
                icon="reader-outline"
                label="Resume Builder"
                value="1 Free"
                sub={`All templates with Pro (or ${fmt(pricing.resumeBuilderPremiumCost)} one-time)`}
                colors={colors}
              />
              <FeatureRow
                icon="color-wand-outline"
                label="AI Job Recommendations"
                value={fmt(pricing.aiJobsCost)}
                sub={`${pricing.aiAccessDurationDays}-day access (always on with Pro)`}
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
              onPress={() => {
                if (Platform.OS === 'web') {
                  window.location.href = '/wallet/recharge';
                } else {
                  navigation.navigate('WalletRecharge');
                }
              }}
            >
              <Ionicons name="wallet-outline" size={20} color={colors.white} />
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
      backgroundColor: colors.accentBg,
      borderRadius: 18,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.accentBg,
      overflow: 'hidden',
    },
    openCardInner: {
      padding: 22,
    },
    openPrice: {
      fontSize: 32, fontWeight: '800',
      color: colors.accent,
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
      color: colors.white,
      fontSize: 16,
      fontWeight: '700',
    },
  });
};
