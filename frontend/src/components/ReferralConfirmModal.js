import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';
import WalletRechargeModal from './WalletRechargeModal';

/**
 * 🎨 Premium Request Referral Modal
 * Beautiful, tight, and polished design matching the reference UI
 * Shows cost breakdown and benefits clearly
 */
export default function ReferralConfirmModal({
  visible,
  currentBalance = 0,
  requiredAmount = 50,
  onProceed,
  onCancel,
  onAddMoney,
  jobTitle = 'this job',
}) {
  const balanceAfter = currentBalance - requiredAmount;
  const hasInsufficientBalance = currentBalance < requiredAmount;

  if (hasInsufficientBalance) {
    return (
      <WalletRechargeModal
        visible={visible}
        currentBalance={currentBalance}
        requiredAmount={requiredAmount}
        title="Wallet Recharge Required"
        subtitle="Insufficient wallet balance"
        note={`Recharge your wallet to request a referral for ${jobTitle}.`}
        primaryLabel="Add Money"
        secondaryLabel="Cancel"
        onAddMoney={onAddMoney}
        onCancel={onCancel}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Ionicons name="people" size={24} color={colors.textPrimary} />
            <Text style={styles.headerTitle}>Request Referral</Text>
          </View>

          {/* 📄 Content Area */}
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Job Title */}
            <View style={styles.jobTitleSection}>
              <Text style={styles.jobTitle}>Request referral for {jobTitle}</Text>
            </View>

            <View style={styles.costCard}>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Cost</Text>
                <Text style={styles.kvValue}>₹{requiredAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Current Balance</Text>
                <Text style={[styles.kvValue, hasInsufficientBalance ? styles.kvValueDanger : styles.kvValueOk]}>
                  ₹{currentBalance.toFixed(2)}
                </Text>
              </View>
              {!hasInsufficientBalance && (
                <>
                  <View style={styles.kvDivider} />
                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabelBold}>Balance After</Text>
                    <Text style={styles.kvValueBold}>₹{balanceAfter.toFixed(2)}</Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.benefitsBox}>
              <Text style={styles.benefitsHeading}>What happens next:</Text>
              <Text style={styles.benefitItem}>• Submit your request immediately</Text>
              <Text style={styles.benefitItem}>• Employees at that company get notified</Text>
              <Text style={styles.benefitItem}>• Improves your chances of getting a referral</Text>
              <Text style={styles.benefitItem}>• Can help you get fast-tracked</Text>
            </View>
          </ScrollView>

          {/* 🎯 Action Buttons - Clean Design */}
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
                name={"paper-plane"} 
                size={18} 
                color={colors.white} 
              />
              <Text style={styles.proceedBtnText}>
                Proceed
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
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

  // 📄 Scroll Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },

  // 💼 Job Title Section
  jobTitleSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  jobTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // 💰 Cost Card - Clean & Tight
  costCard: {
    marginHorizontal: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  kvLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
  },
  kvValue: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  kvDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  kvLabelBold: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
  },
  kvValueBold: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    fontWeight: typography.weights.bold,
  },
  kvValueOk: {
    color: colors.success,
  },
  kvValueDanger: {
    color: colors.danger,
  },


  // ✨ Benefits Box - Numbered Steps Only
  benefitsBox: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  benefitsHeading: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  benefitItem: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 6,
  },

  // 🎯 Footer Actions - Clean Buttons
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  proceedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  proceedBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
});

