import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { typography } from '../styles/theme';

// Centralized content configuration based on context type
const CONTEXT_CONFIG = {
  referral: {
    securityNote: 'Your amount is secure. It is charged only after a successful referral.',
    benefitsHeading: 'How it works:',
    benefits: [
      '• Amount will be held, not debited upfront',
      '• All verified employees are notified',
      '• You\'re charged only if referred. Cancel anytime',
      '• Amount is auto-released if no referral in 14 days',
    ],
    showSecurityNote: true,
  },
  'ai-jobs': {
    securityNote: null,
    benefitsHeading: 'What you get:',
    benefits: [
      '• 50 AI-matched job recommendations',
      '• Personalized based on your profile',
    ],
    showSecurityNote: false,
  },
  'profile-views': {
    securityNote: null,
    benefitsHeading: 'What you get:',
    benefits: [
      '• See who viewed your profile',
      '• Track your profile visibility',
    ],
    showSecurityNote: false,
  },
  'publish-job': {
    securityNote: null,
    benefitsHeading: 'What happens next:',
    benefits: [
      '• Job will be visible to all users',
      '• Receive applications from candidates',
    ],
    showSecurityNote: false,
  },
  generic: {
    securityNote: null,
    benefitsHeading: null,
    benefits: [],
    showSecurityNote: false,
  },
};

export default function WalletRechargeModal({
  visible,
  title = 'Wallet Recharge Required',
  currentBalance = 0,
  requiredAmount = 39,
  onAddMoney,
  onCancel,
  primaryLabel = 'Add Money',
  secondaryLabel = 'Maybe Later',
  // Context props
  contextType = 'generic', // 'referral' | 'ai-jobs' | 'profile-views' | 'publish-job' | 'generic'
  itemName = '', // e.g., job title, feature name
  accessDays = null, // For features with duration (e.g., "15 days")
  customNote = '', // For backward compatibility - shows as a benefit if provided
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Get config based on context type
  const config = CONTEXT_CONFIG[contextType] || CONTEXT_CONFIG.generic;
  
  // Build display title based on context
  const displayTitle = itemName 
    ? (contextType === 'referral' ? `Request referral for ${itemName}` : itemName)
    : '';

  // Build benefits with accessDays substitution
  let displayBenefits = config.benefits.map(benefit => 
    accessDays ? benefit.replace('{accessDays}', accessDays) : benefit
  );

  // Add access days benefit if provided and not already in benefits
  if (accessDays && !config.benefits.some(b => b.includes('day'))) {
    displayBenefits.push(`• ${accessDays}-day access`);
  }

  // Fallback to customNote for backward compatibility
  if (displayBenefits.length === 0 && customNote) {
    displayBenefits = [customNote];
  }
  
  return (
    <Modal visible={visible} transparent onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerDanger}>
            <Ionicons name="wallet-outline" size={24} color={colors.white} />
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} bounces={false}>
            {/* Always show "Insufficient wallet balance" */}
            <View style={styles.subtitleSection}>
              <Text style={styles.subtitleText}>Insufficient wallet balance</Text>
            </View>

            {/* Feature/Job Title - only if provided */}
            {displayTitle ? (
              <View style={styles.titleSection}>
                <Text style={styles.featureTitle}>{displayTitle}</Text>
              </View>
            ) : null}

            {/* Cost Card */}
            <View style={styles.costCard}>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Amount</Text>
                <Text style={styles.kvValue}>₹{Number(requiredAmount || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Available Balance</Text>
                <Text style={[styles.kvValue, styles.kvValueDanger]}>₹{Number(currentBalance || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.kvDivider} />
              <View style={styles.kvRow}>
                <Text style={styles.kvLabelBold}>Need to Add</Text>
                <Text style={[styles.kvValueBold, { color: colors.primary }]}>₹{Math.max(0, requiredAmount - currentBalance).toFixed(2)}</Text>
              </View>
            </View>

            {/* Security Note - based on config */}
            {config.showSecurityNote && config.securityNote && (
              <View style={styles.holdInfoBox}>
                <Ionicons name="shield-checkmark" size={20} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={styles.holdInfoText}>{config.securityNote}</Text>
              </View>
            )}

            {/* Benefits/Info Section */}
            {displayBenefits.length > 0 && (
              <View style={styles.benefitsBox}>
                {config.benefitsHeading && <Text style={styles.benefitsHeading}>{config.benefitsHeading}</Text>}
                {displayBenefits.map((benefit, index) => (
                  <Text key={index} style={styles.benefitItem}>{benefit}</Text>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnSecondary} onPress={onCancel}>
              <Text style={styles.btnSecondaryText}>{secondaryLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={onAddMoney}>
              <Text style={styles.btnPrimaryText}>{primaryLabel}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: colors.background,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: colors.error,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  subtitleSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  subtitleText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  titleSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  featureTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  costCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  kvLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  kvValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  kvValueDanger: {
    color: colors.error,
  },
  kvDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  kvLabelBold: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  kvValueBold: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  holdInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  holdInfoText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  benefitsBox: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 16,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  benefitsHeading: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  benefitItem: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  btnPrimaryText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
});
