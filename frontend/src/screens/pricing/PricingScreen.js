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
import ConfirmPurchaseModal from '../../components/ConfirmPurchaseModal';

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
);import { useSubscription } from '../../contexts/SubscriptionContext';



// ─── Main Component ────────────────────────────────────────
export default function PricingScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { pricing } = usePricing();
  const { subscription, refreshSubscription } = useSubscription();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [insufficientData, setInsufficientData] = useState({ needed: 0, balance: 0 });

  const handleSubscribe = useCallback(async (plan) => {
    if (!isAuthenticated) { navigation.navigate('Auth'); showToast('Please log in to subscribe', 'info'); return; }
    if (subscribing) return; // Prevent double-click
    setSubscribing(true);
    try {
      const res = await refopenAPI.subscribeToPro(plan);
      if (res?.success) {
        showToast(res.data?.message || 'Welcome to RefOpen Pro! 🎉', 'success');
        refreshSubscription();
      } else if (res?.errorCode === 'INSUFFICIENT_BALANCE') {
        const needed = plan === 'monthly' ? pricing.proMonthlyPrice : pricing.proSemiAnnualPrice;
        setInsufficientData({ needed, balance: res.data?.currentBalance || 0 });
        setShowInsufficientModal(true);
      } else {
        showToast(res?.error || 'Failed to subscribe', 'error');
      }
    } catch (e) {
      if (e?.status === 402 || e?.data?.errorCode === 'INSUFFICIENT_BALANCE') {
        const needed = selectedPlan === 'monthly' ? pricing.proMonthlyPrice : pricing.proSemiAnnualPrice;
        setInsufficientData({ needed, balance: e?.data?.data?.currentBalance || 0 });
        setShowInsufficientModal(true);
      } else {
        showToast(e?.data?.error || e?.message || 'Failed to subscribe. Please try again.', 'error');
      }
    } finally { setSubscribing(false); }
  }, [isAuthenticated, navigation, pricing, selectedPlan]);

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
              <Text style={styles.heroSub}>One table. No surprises.</Text>
            </View>

            {/* ── Plan toggle ── */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20, gap: 8 }}>
              <TouchableOpacity onPress={() => setSelectedPlan('monthly')}
                style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, backgroundColor: selectedPlan === 'monthly' ? BRAND : colors.surface, borderWidth: 1, borderColor: selectedPlan === 'monthly' ? BRAND : colors.border }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: selectedPlan === 'monthly' ? '#fff' : colors.text }}>Monthly</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedPlan('semi_annual')}
                style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, backgroundColor: selectedPlan === 'semi_annual' ? BRAND : colors.surface, borderWidth: 1, borderColor: selectedPlan === 'semi_annual' ? BRAND : colors.border }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: selectedPlan === 'semi_annual' ? '#fff' : colors.text }}>6 Months</Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: selectedPlan === 'semi_annual' ? '#fff' : colors.success, textAlign: 'center' }}>Save 11%</Text>
              </TouchableOpacity>
            </View>

            {/* ══════ SINGLE COMPARISON TABLE ══════ */}
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden', marginBottom: 20 }}>

              {/* Header row */}
              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flex: 2, padding: 14 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary }}>Feature</Text>
                </View>
                <View style={{ flex: 1, padding: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Free</Text>
                </View>
                <View style={{ flex: 1, padding: 14, alignItems: 'center', backgroundColor: '#D4A45A' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>💎 Pro</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#1a1a1a' }}>₹{selectedPlan === 'monthly' ? pricing.proMonthlyPrice : Math.round(pricing.proSemiAnnualPrice / 6)}/mo</Text>
                </View>
              </View>

              {/* Feature rows */}
              {[
                { feature: 'Browse & apply to jobs', free: '✅', pro: '✅' },
                { feature: 'Referrals', free: `₹${pricing.referralRequestCost}–${pricing.eliteReferralCost}/each`, pro: '3 FREE/month\nthen pay-per-use', highlight: true },
                { feature: 'Open-to-Any Referral', free: `₹${pricing.openToAnyReferralCost}`, pro: `₹${pricing.proOtaDiscountPrice}`, highlight: true },
                { feature: 'Resume Analyzer', free: `${pricing.aiResumeFreeUses} free, then \u20b9${pricing.aiResumeAnalysisCost}`, pro: '\u2705 Unlimited', highlight: true },
                { feature: 'Blind Review', free: `${pricing.blindReviewFreeUses || 1} free, then \u20b9${pricing.blindReviewCost || 49}`, pro: '\u2705 Unlimited', highlight: true },
                { feature: 'LinkedIn Optimizer', free: `${pricing.linkedInOptimizerFreeUses || 1} free, then \u20b9${pricing.linkedInOptimizerCost || 29}`, pro: '\u2705 Unlimited', highlight: true },
                { feature: 'AI Job Recommendations', free: `₹${pricing.aiJobsCost}`, pro: '✅ Always on', highlight: true },
                { feature: 'Resume Builder', free: '1 template', pro: '✅ All templates', highlight: true },
                { feature: 'Pro badge', free: '—', pro: '✅' },
                { feature: 'Priority matching', free: '—', pro: '✅' },
              ].map((row, i) => (
                <View key={i} style={{ flexDirection: 'row', borderBottomWidth: i < 9 ? 1 : 0, borderBottomColor: colors.border + '60' }}>
                  <View style={{ flex: 2, padding: 12, justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text }}>{row.feature}</Text>
                  </View>
                  <View style={{ flex: 1, padding: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>{row.free}</Text>
                  </View>
                  <View style={{ flex: 1, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D4A45A' + '15' }}>
                    <Text style={{ fontSize: 12, fontWeight: row.highlight ? '700' : '500', color: row.highlight ? '#D4A45A' : colors.text, textAlign: 'center' }}>{row.pro}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ── Subscribe CTA or Active Plan ── */}
            {subscription?.isPro ? (
              <View style={{ backgroundColor: '#22c55e15', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#22c55e40' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#22c55e' }}>You're on Pro!</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                  {subscription.referralsRemaining}/{subscription.referralsIncluded} referrals left · {subscription.daysRemaining} days remaining
                </Text>
              </View>
            ) : (
            <TouchableOpacity
              style={{ backgroundColor: '#D4A45A', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 8, flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: subscribing ? 0.6 : 1 }}
              onPress={() => handleSubscribe(selectedPlan)}
              disabled={subscribing}
            >
              {subscribing ? <ActivityIndicator size="small" color="#1a1a1a" /> : (
                <>
                  <Ionicons name="diamond" size={20} color="#1a1a1a" />
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#1a1a1a' }}>
                    Get Pro — ₹{selectedPlan === 'monthly' ? pricing.proMonthlyPrice + '/month' : pricing.proSemiAnnualPrice + '/6 months'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            )}
            {!subscription?.isPro && (
              <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 }}>Paid from wallet balance. Cancel anytime. No auto-renewal.</Text>
            )}

            {/* ── How it works (simplified) ── */}
            <View style={{ borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 20 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 }}>How referral billing works</Text>
              {[
                { icon: 'shield-checkmark-outline', text: 'Free users: Money is held (not charged) until someone refers you. Auto-refund if no one picks up in 2 weeks.' },
                { icon: 'diamond-outline', text: 'Pro users: 3 referrals included. Used instantly — no holds needed. Additional referrals charged normally.' },
                { icon: 'wallet-outline', text: 'Wallet credits never expire while your account is active.' },
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: i < 2 ? 10 : 0, gap: 10 }}>
                  <Ionicons name={item.icon} size={18} color={colors.primary} style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1, lineHeight: 18 }}>{item.text}</Text>
                </View>
              ))}
            </View>

            {/* ── Wallet CTA ── */}
            <TouchableOpacity style={styles.ctaButton} activeOpacity={0.8}
              onPress={() => navigation.navigate('WalletRecharge')}>
              <Ionicons name="wallet-outline" size={20} color={colors.white} />
              <Text style={styles.ctaText}>Add Money to Wallet</Text>
            </TouchableOpacity>

            <ComplianceFooter currentPage="pricing" />
          </View>
        </View>
      </ScrollView>

      {/* Insufficient balance modal for Pro subscription */}
      <ConfirmPurchaseModal
        visible={showInsufficientModal}
        currentBalance={insufficientData.balance}
        requiredAmount={insufficientData.needed}
        contextType="generic"
        itemName={`RefOpen Pro (${selectedPlan === 'monthly' ? '1 month' : '6 months'})`}
        onProceed={() => { setShowInsufficientModal(false); handleSubscribe(selectedPlan); }}
        onAddMoney={() => { setShowInsufficientModal(false); navigation.navigate('WalletRecharge'); }}
        onCancel={() => setShowInsufficientModal(false)}
      />
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
