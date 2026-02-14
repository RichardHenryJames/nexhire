import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';
import WalletRechargeModal from './WalletRechargeModal';

// Centralized content configuration based on context type
const CONTEXT_CONFIG = {
  referral: {
    headerIcon: 'people',
    headerTitle: 'Request Referral',
    itemPrefix: 'Request referral for',
    amountLabel: 'Will be held',
    amountColor: '#F59E0B', // Orange for "held"
    securityNote: 'Your amount is secure. It is charged only after a successful referral.',
    benefitsHeading: 'Next steps:',
    benefits: [
      '• All verified employees are notified',
      '• You\'re charged only if referred. Cancel anytime',
      '• Amount is auto-released if no referral in 14 days',
    ],
    showSecurityNote: true,
    proceedIcon: 'paper-plane',
    proceedText: 'Proceed',
  },
  'ai-jobs': {
    headerIcon: 'bulb',
    headerIconColor: '#FFD700',
    headerTitle: 'AI Recommended Jobs',
    itemPrefix: '',
    amountLabel: 'Will be deducted',
    amountColor: null, // Use primary color
    securityNote: null,
    benefitsHeading: 'What you get:',
    benefits: [
      '• 50 AI-matched job recommendations',
      '• Personalized based on your profile',
    ],
    showSecurityNote: false,
    proceedIcon: 'flash',
    proceedText: 'Unlock Now',
  },
  'profile-views': {
    headerIcon: 'eye',
    headerTitle: 'Unlock Profile Views',
    itemPrefix: '',
    amountLabel: 'Will be deducted',
    amountColor: null,
    securityNote: null,
    benefitsHeading: 'What you get:',
    benefits: [
      '• See who viewed your profile',
      '• Track your profile visibility',
    ],
    showSecurityNote: false,
    proceedIcon: 'eye',
    proceedText: 'Unlock',
  },
  'publish-job': {
    headerIcon: 'briefcase',
    headerTitle: 'Publish Job',
    itemPrefix: 'Publish',
    amountLabel: 'Will be deducted',
    amountColor: null,
    securityNote: null,
    benefitsHeading: 'What happens next:',
    benefits: [
      '• Job will be visible to all users',
      '• Receive applications from candidates',
    ],
    showSecurityNote: false,
    proceedIcon: 'checkmark-circle',
    proceedText: 'Publish',
  },
  generic: {
    headerIcon: 'card',
    headerTitle: 'Confirm Purchase',
    itemPrefix: '',
    amountLabel: 'Will be deducted',
    amountColor: null,
    securityNote: null,
    benefitsHeading: null,
    benefits: [],
    showSecurityNote: false,
    proceedIcon: 'checkmark',
    proceedText: 'Confirm',
  },
};

/**
 * 🎨 Generic Confirm Purchase Modal
 * Works for both sufficient and insufficient balance
 * - Insufficient: Delegates to WalletRechargeModal
 * - Sufficient: Shows confirmation with benefits
 */
export default function ConfirmPurchaseModal({
  visible,
  currentBalance = 0,
  requiredAmount = 49,
  onProceed,
  onCancel,
  onAddMoney,
  // Context props
  contextType = 'generic', // 'referral' | 'ai-jobs' | 'profile-views' | 'publish-job' | 'generic'
  itemName = '', // e.g., job title, feature name
  accessDays = null, // For features with duration (e.g., "30 days")
  isFree = false, // For free actions (e.g., referrer posting job)
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const hasInsufficientBalance = !isFree && currentBalance < requiredAmount;
  const config = CONTEXT_CONFIG[contextType] || CONTEXT_CONFIG.generic;

  // For insufficient balance, delegate to WalletRechargeModal
  if (hasInsufficientBalance) {
    return (
      <WalletRechargeModal
        visible={visible}
        currentBalance={currentBalance}
        requiredAmount={requiredAmount}
        contextType={contextType}
        itemName={itemName}
        accessDays={accessDays}
        onAddMoney={onAddMoney}
        onCancel={onCancel}
      />
    );
  }

  // Build display title
  const displayTitle = itemName 
    ? (config.itemPrefix ? `${config.itemPrefix} ${itemName}` : itemName)
    : '';

  // Build benefits with accessDays substitution
  const displayBenefits = config.benefits.map(benefit => 
    accessDays ? benefit.replace('{accessDays}', accessDays) : benefit
  );

  // Add access days benefit if provided and not already in benefits
  if (accessDays && !config.benefits.some(b => b.includes('day'))) {
    displayBenefits.push(`• ${accessDays}-day access`);
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={[styles.header, contextType === 'ai-jobs' && { backgroundColor: '#1a1a2e' }]}>
            <Ionicons 
              name={config.headerIcon} 
              size={24} 
              color={config.headerIconColor || colors.textPrimary} 
            />
            <Text style={styles.headerTitle}>{config.headerTitle}</Text>
          </View>

          {/* Content Area */}
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Item Title */}
            {displayTitle && (
              <View style={styles.itemTitleSection}>
                <Text style={styles.itemTitle}>{displayTitle}</Text>
              </View>
            )}

            {/* Cost Card */}
            <View style={styles.costCard}>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Amount</Text>
                <Text style={styles.kvValue}>
                  {isFree ? 'FREE' : `₹${requiredAmount.toFixed(2)}`}
                </Text>
              </View>
              {!isFree && (
                <>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Available Balance</Text>
                    <Text style={[styles.kvValue, styles.kvValueOk]}>
                      ₹{currentBalance.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.kvDivider} />
                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabelBold}>{config.amountLabel}</Text>
                    <Text style={[styles.kvValueBold, { color: config.amountColor || colors.primary }]}>
                      ₹{requiredAmount.toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Security Note - for referral context */}
            {config.showSecurityNote && config.securityNote && (
              <View style={styles.holdInfoBox}>
                <Ionicons name="shield-checkmark" size={20} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={styles.holdInfoText}>{config.securityNote}</Text>
              </View>
            )}

            {/* Benefits Box */}
            {displayBenefits.length > 0 && (
              <View style={styles.benefitsBox}>
                {config.benefitsHeading && (
                  <Text style={styles.benefitsHeading}>{config.benefitsHeading}</Text>
                )}
                {displayBenefits.map((benefit, index) => (
                  <Text key={index} style={styles.benefitItem}>{benefit}</Text>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.proceedBtn}
              onPress={onProceed}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={config.proceedIcon} 
                size={18} 
                color={colors.white} 
              />
              <Text style={styles.proceedBtnText}>{config.proceedText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


const createStyles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderRadius: 14,
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  itemTitleSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  itemTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  costCard: {
    marginHorizontal: 16,
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
  kvValueOk: {
    color: '#10B981',
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
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  proceedBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
  },
  proceedBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
});
