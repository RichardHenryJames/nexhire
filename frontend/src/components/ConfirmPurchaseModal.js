import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Context-aware config for each purchase type.
 * Each config has TWO states: sufficient + insufficient balance.
 */
const getContextConfig = (colors) => ({
  referral: {
    headerIcon: 'lock-closed',
    headerTitle: 'Request Referral',
    itemPrefix: 'Request referral for',
    trustTitle: 'Only pay if referred • Auto-refund in 14 days',
    trustPoints: [],
    amountVerb: 'reserved',
    amountNote: '',
    steps: [
      { icon: 'notifications-outline', text: 'All verified employees are notified', color: colors.primary },
      { icon: 'shield-checkmark-outline', text: 'Cancel anytime before referral', color: colors.success },
    ],
    safetyNote: null,
    proceedIcon: 'paper-plane',
    proceedText: 'Request Referral',
    insufficientCta: (amt) => `Add ₹${amt} & Request Referral →`,
    cancelText: 'Cancel',
    insufficientCancelText: 'Cancel Request',
  },
  'ai-jobs': {
    headerIcon: 'bulb',
    headerTitle: 'AI Recommended Jobs',
    itemPrefix: '',
    trustTitle: null,
    trustPoints: [],
    amountVerb: 'deducted',
    amountNote: '',
    steps: [
      { icon: 'sparkles-outline', text: '50 AI-matched job recommendations', color: colors.primary },
      { icon: 'person-outline', text: 'Personalized based on your profile', color: colors.success },
    ],
    safetyNote: null,
    proceedIcon: 'flash',
    proceedText: 'Unlock Now',
    insufficientCta: (amt) => `Add ₹${amt} & Unlock`,
    cancelText: 'Cancel',
    insufficientCancelText: 'Maybe Later',
  },
  'profile-views': {
    headerIcon: 'eye',
    headerTitle: 'Unlock Profile Views',
    itemPrefix: '',
    trustTitle: null,
    trustPoints: [],
    amountVerb: 'deducted',
    amountNote: '',
    steps: [
      { icon: 'eye-outline', text: 'See who viewed your profile', color: colors.primary },
      { icon: 'trending-up-outline', text: 'Track your profile visibility', color: colors.success },
    ],
    safetyNote: null,
    proceedIcon: 'eye',
    proceedText: 'Unlock',
    insufficientCta: (amt) => `Add ₹${amt} & Unlock`,
    cancelText: 'Cancel',
    insufficientCancelText: 'Maybe Later',
  },
  'publish-job': {
    headerIcon: 'briefcase',
    headerTitle: 'Publish Job',
    itemPrefix: 'Publish',
    trustTitle: null,
    trustPoints: [],
    amountVerb: 'deducted',
    amountNote: '',
    steps: [
      { icon: 'globe-outline', text: 'Job visible to all users', color: colors.primary },
      { icon: 'people-outline', text: 'Receive candidate applications', color: colors.success },
    ],
    safetyNote: null,
    proceedIcon: 'checkmark-circle',
    proceedText: 'Publish',
    insufficientCta: (amt) => `Add ₹${amt} & Publish`,
    cancelText: 'Cancel',
    insufficientCancelText: 'Cancel',
  },
  tool: {
    headerIcon: 'sparkles',
    headerTitle: 'Confirm',
    itemPrefix: '',
    trustTitle: null,
    trustPoints: [],
    amountVerb: 'deducted',
    amountNote: '',
    steps: [],
    safetyNote: null,
    proceedIcon: 'checkmark',
    proceedText: 'Confirm',
    insufficientCta: (amt) => `Add ₹${amt} & Continue`,
    cancelText: 'Cancel',
    insufficientCancelText: 'Cancel',
  },
  generic: {
    headerIcon: 'card',
    headerTitle: 'Confirm',
    itemPrefix: '',
    trustTitle: null,
    trustPoints: [],
    amountVerb: 'deducted',
    amountNote: '',
    steps: [],
    safetyNote: null,
    proceedIcon: 'checkmark',
    proceedText: 'Confirm',
    insufficientCta: (amt) => `Add ₹${amt} & Continue`,
    cancelText: 'Cancel',
    insufficientCancelText: 'Maybe Later',
  },
});

/**
 * Unified Purchase/Request Modal
 * 
 * ONE modal, TWO states (sufficient / insufficient balance)
 * Works for ALL contexts: referral, ai-jobs, profile-views, publish-job, tool, generic
 * 
 * Replaces both ConfirmPurchaseModal AND WalletRechargeModal.
 */
export default function ConfirmPurchaseModal({
  visible,
  currentBalance = 0,
  requiredAmount = 49,
  onProceed,
  onCancel,
  onAddMoney,
  onSubscribePro,
  contextType = 'generic',
  itemName = '',
  accessDays = null,
  isFree = false,
  extraInfo = '',
  originalPrice = null,
}) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const CONFIGS = useMemo(() => getContextConfig(colors), [colors]);
  const config = CONFIGS[contextType] || CONFIGS.generic;
  const insufficient = !isFree && currentBalance < requiredAmount;
  const needToAdd = Math.max(0, Math.ceil(requiredAmount - currentBalance));

  const displayTitle = itemName
    ? (config.itemPrefix ? `${config.itemPrefix} ${itemName}` : itemName)
    : '';

  return (
    <Modal visible={visible} transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <Ionicons name={config.headerIcon} size={18} color={colors.textSecondary} />
            <Text style={styles.headerTitle}>{config.headerTitle}</Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
            {/* ── Item title ── */}
            {displayTitle ? (
              <Text style={styles.itemTitle}>
                {config.itemPrefix ? (
                  <>{config.itemPrefix}{' '}<Text style={{ fontWeight: '700', color: colors.text }}>{itemName}</Text></>
                ) : (
                  <Text style={{ fontWeight: '700', color: colors.text }}>{itemName}</Text>
                )}
              </Text>
            ) : null}

            {/* ── Trust moved inside amount card ── */}

            {/* ── Amount + Balance (compact) ── */}
            {!isFree && (
              <View style={styles.amountCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>₹{requiredAmount}</Text>
                    {extraInfo ? <Text style={{ fontSize: 12, color: colors.textSecondary }}>({extraInfo})</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>Balance</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: insufficient ? colors.error : colors.success }}>₹{Number(currentBalance).toFixed(0)}</Text>
                  </View>
                </View>
                {/* Trust line inside amount card */}
                {config.trustTitle && (
                  <Text style={{ fontSize: 12, color: colors.success, marginTop: 8 }}>✅ ₹{requiredAmount} held, not charged. Refunded if no one refers you.</Text>
                )}
                {insufficient && (
                  <Text style={{ fontSize: 12, color: colors.error, marginTop: 6 }}>Need ₹{needToAdd} more</Text>
                )}
              </View>
            )}

            {/* ── Access days ── */}
            {accessDays && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="time-outline" size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{accessDays}-day access</Text>
              </View>
            )}
          </ScrollView>

          {/* ── CTA ───────────────────────────────────────── */}
          <View style={styles.footer}>
            {insufficient ? (
              <>
                {/* Pro upsell — premium gold pill button */}
                {(contextType === 'referral' || contextType === 'tool' || contextType === 'ai-jobs') && (
                  <TouchableOpacity
                    style={{ borderRadius: 28, marginBottom: 12, overflow: 'hidden', backgroundColor: '#C4944A' }}
                    onPress={() => { onCancel?.(); navigation.navigate('Pricing'); }}
                    activeOpacity={0.8}
                  >
                    <View style={{ paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D4A45A', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' }}>
                        {requiredAmount >= 400 ? 'Get this for ₹199 with Pro →' : contextType === 'referral' ? 'Get this FREE with Pro →' : 'Unlock with Pro →'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.btnPrimary} onPress={onAddMoney} activeOpacity={0.85}>
                  <Text style={styles.btnPrimaryText}>{config.insufficientCta(needToAdd)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnTextOnly} onPress={onCancel} activeOpacity={0.7}>
                  <Text style={styles.btnTextOnlyText}>{config.insufficientCancelText}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.btnCancel} onPress={onCancel} activeOpacity={0.7}>
                  <Text style={styles.btnCancelText}>{config.cancelText}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnProceed} onPress={onProceed} activeOpacity={0.85}>
                  <Ionicons name={config.proceedIcon} size={16} color="#fff" />
                  <Text style={styles.btnProceedText}>{config.proceedText}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}


const createStyles = (colors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: colors.background, borderRadius: 14, width: '100%', maxWidth: 420, maxHeight: '90%', overflow: 'hidden', borderWidth: 1, borderColor: colors.border },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },

  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: 0 },

  itemTitle: { fontSize: 14, color: colors.textSecondary, paddingHorizontal: 20, paddingBottom: 16, lineHeight: 20 },

  trustBox: { marginHorizontal: 16, padding: 14, backgroundColor: (colors.success || '#10B981') + '0A', borderRadius: 12, borderWidth: 1, borderColor: (colors.success || '#10B981') + '20', marginBottom: 14 },
  trustTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 6 },
  trustSub: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  trustDot: { fontSize: 12 },
  trustText: { fontSize: 13, color: colors.textSecondary },

  amountCard: { marginHorizontal: 16, padding: 14, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  amountText: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  amountLight: { fontWeight: '400', color: colors.textSecondary, fontSize: 12 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  balanceLabel: { fontSize: 13, color: colors.textSecondary },
  balanceValue: { fontSize: 14, fontWeight: '600', color: colors.success },
  addRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  addText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  steps: { marginHorizontal: 16, marginBottom: 14, gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepText: { fontSize: 13, color: colors.textSecondary },

  safetyBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, padding: 10, backgroundColor: (colors.success || '#10B981') + '08', borderRadius: 10 },
  safetyText: { fontSize: 12, color: colors.textSecondary, flex: 1, lineHeight: 17 },

  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },

  btnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  btnPrimary: { width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnTextOnly: { width: '100%', paddingVertical: 10, alignItems: 'center', marginTop: 6 },
  btnTextOnlyText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  btnCancel: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnCancelText: { fontSize: 14, fontWeight: '600', color: colors.text },
  btnProceed: { flex: 2, flexDirection: 'row', paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary },
  btnProceedText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  helpBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  helpText: { fontSize: 12, color: colors.textSecondary },
});
