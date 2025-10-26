import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';

/**
 * Beautiful custom modal for wallet recharge prompts
 * Replaces ugly window.confirm() with a styled, branded modal
 */
export default function WalletRechargeModal({
  visible,
  currentBalance = 0,
  requiredAmount = 50,
  onAddMoney,
  onCancel,
}) {
  const amountNeeded = Math.max(requiredAmount - currentBalance, 0);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header with Icon */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="wallet" size={48} color="#fff" />
            </View>
            <Text style={styles.title}>?? Wallet Recharge Required</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.message}>
              To request a referral, you need ?{requiredAmount.toFixed(2)} in your wallet.
            </Text>

            {/* Balance Info Cards */}
            <View style={styles.balanceCards}>
              <View style={[styles.balanceCard, styles.currentBalanceCard]}>
                <Ionicons name="cash-outline" size={20} color="#ef4444" />
                <Text style={styles.balanceLabel}>Current Balance</Text>
                <Text style={styles.balanceAmount}>?{currentBalance.toFixed(2)}</Text>
              </View>

              <View style={[styles.balanceCard, styles.requiredBalanceCard]}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
                <Text style={styles.balanceLabel}>Required Amount</Text>
                <Text style={styles.balanceAmount}>?{requiredAmount.toFixed(2)}</Text>
              </View>
            </View>

            {/* Amount Needed Highlight */}
            <View style={styles.amountNeededCard}>
              <Ionicons name="add-circle" size={24} color="#0066cc" />
              <View style={styles.amountNeededText}>
                <Text style={styles.amountNeededLabel}>Add at least</Text>
                <Text style={styles.amountNeededValue}>?{amountNeeded.toFixed(2)}</Text>
              </View>
            </View>

            {/* Why Section */}
            <View style={styles.whySection}>
              <Text style={styles.whyTitle}>Why is this needed?</Text>
              <View style={styles.whyItem}>
                <Ionicons name="shield-checkmark" size={16} color="#6366f1" />
                <Text style={styles.whyText}>
                  Maintains quality and serious job seekers
                </Text>
              </View>
              <View style={styles.whyItem}>
                <Ionicons name="people" size={16} color="#6366f1" />
                <Text style={styles.whyText}>
                  Fair compensation for referrers
                </Text>
              </View>
              <View style={styles.whyItem}>
                <Ionicons name="repeat" size={16} color="#6366f1" />
                <Text style={styles.whyText}>
                  Reusable for multiple referral requests
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Maybe Later</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={onAddMoney}
            >
              <Ionicons name="card" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Add Money</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 480,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      web: {
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  header: {
    backgroundColor: colors.primary,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: '#fff',
    textAlign: 'center',
  },
  content: {
    padding: 24,
  },
  message: {
    fontSize: typography.sizes.md,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  balanceCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  balanceCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  currentBalanceCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  requiredBalanceCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  balanceLabel: {
    fontSize: typography.sizes.xs,
    color: colors.gray600,
    fontWeight: typography.weights.medium,
  },
  balanceAmount: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  amountNeededCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0066cc',
    marginBottom: 20,
  },
  amountNeededText: {
    flex: 1,
  },
  amountNeededLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 2,
  },
  amountNeededValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: '#0066cc',
  },
  whySection: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  whyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  whyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  whyText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.gray700,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 0,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray700,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 102, 204, 0.3)',
      },
    }),
  },
  primaryButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: '#fff',
  },
});
