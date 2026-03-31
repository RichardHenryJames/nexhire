import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    // Trust-first messaging (money is held, not charged)
    trustTitle: 'You only pay if you get referred',
    trustPoints: ['Money is held, not charged', 'Auto-released in 14 days'],
    amountVerb: 'reserved',
    amountNote: '(not charged now)',
    steps: [
      { icon: 'notifications-outline', text: 'Employees are notified', color: colors.primary },
      { icon: 'checkmark-done-outline', text: 'Charged only if referred', color: colors.success },
      { icon: 'time-outline', text: 'Auto-release in 14 days', color: colors.warning || '#F59E0B' },
    ],
    safetyNote: 'Money stays in RefOpen if unused (can be reused anytime)',
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
  contextType = 'generic',
  itemName = '',
  accessDays = null,
  isFree = false,
}) {
  const { colors } = useTheme();
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
          {/* ── Header ─────────────────────────────────────── */}
          <View style={styles.header}>
            <Ionicons name={config.headerIcon} size={18} color={colors.textSecondary} />
            <Text style={styles.headerTitle}>{config.headerTitle}</Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
            {/* ── Item title ──────────────────────────────── */}
            {displayTitle ? (
              <Text style={styles.itemTitle}>
                {config.itemPrefix ? (
                  <>{config.itemPrefix}{' '}<Text style={{ fontWeight: '700', color: colors.text }}>{itemName}</Text></>
                ) : (
                  <Text style={{ fontWeight: '700', color: colors.text }}>{itemName}</Text>
                )}
              </Text>
            ) : null}

            {/* ── Trust box (referral-specific) ────────────── */}
            {config.trustTitle && (
              <View style={styles.trustBox}>
                <Text style={styles.trustTitle}>{config.trustTitle}</Text>
                {config.trustPoints.map((pt, i) => (
                  <View key={i} style={styles.trustSub}>
                    <Text style={[styles.trustDot, { color: colors.success }]}>•</Text>
                    <Text style={styles.trustText}>{pt}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── Amount card ─────────────────────────────── */}
            {!isFree && (
              <View style={styles.amountCard}>
                <View style={styles.amountRow}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.amountText}>
                    ₹{requiredAmount} will be {config.amountVerb}{' '}
                    {config.amountNote ? <Text style={styles.amountLight}>{config.amountNote}</Text> : null}
                  </Text>
                </View>

                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>Available Balance</Text>
                  <Text style={[styles.balanceValue, insufficient && { color: colors.error }]}>
                    ₹{Number(currentBalance).toFixed(0)}
                  </Text>
                </View>

                {insufficient && (
                  <View style={styles.addRow}>
                    <Text style={styles.addText}>
                      Add ₹{needToAdd} to continue{' '}
                      {config.amountNote ? <Text style={styles.amountLight}>{config.amountNote}</Text> : null}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Steps ───────────────────────────────────── */}
            {config.steps.length > 0 && (
              <View style={styles.steps}>
                {config.steps.map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <Ionicons name={step.icon} size={16} color={step.color} />
                    <Text style={styles.stepText}>{step.text}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── Safety note ─────────────────────────────── */}
            {config.safetyNote && (
              <View style={styles.safetyBox}>
                <Ionicons name="wallet-outline" size={16} color={colors.success} />
                <Text style={styles.safetyText}>{config.safetyNote}</Text>
              </View>
            )}

            {/* ── Access days note ────────────────────────── */}
            {accessDays && (
              <View style={styles.safetyBox}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={styles.safetyText}>{accessDays}-day access included</Text>
              </View>
            )}
          </ScrollView>

          {/* ── CTA ───────────────────────────────────────── */}
          <View style={styles.footer}>
            {insufficient ? (
              <>
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
            <TouchableOpacity style={styles.helpBtn} activeOpacity={0.6} onPress={() => { try { const { Linking } = require('react-native'); Linking.openURL('https://www.refopen.com/support'); } catch(e) {} }}>
              <Ionicons name="help-circle-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.helpText}>Need Help?</Text>
            </TouchableOpacity>
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
