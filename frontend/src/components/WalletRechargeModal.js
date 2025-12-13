import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
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
      onRequestClose={onCancel}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity 
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={false}
          >
            {/* Header with Icon - Red background, more compact */}
            <View style={styles.header}>
              <Ionicons name="wallet" size={32} color="#fff"/>
              <Text style={styles.title}>Wallet Recharge Required</Text>
            </View>

            {/* Content - More compact */}
            <View style={styles.content}>
              <Text style={styles.message}>
                Insufficient wallet balance
              </Text>

              {/* Balance Info Cards - More compact */}
              <View style={styles.balanceCards}>
                <View style={[styles.balanceCard, styles.currentBalanceCard]}>
                  <Ionicons name="cash-outline" size={16} color="#ef4444" />
                  <Text style={styles.balanceLabel}>Current</Text>
                  <Text style={styles.balanceAmount}>₹{currentBalance.toFixed(2)}</Text>
                </View>

                <View style={[styles.balanceCard, styles.requiredBalanceCard]}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />
                  <Text style={styles.balanceLabel}>Required</Text>
                  <Text style={styles.balanceAmount}>₹{requiredAmount.toFixed(2)}</Text>
                </View>
              </View>

              {/* Why Section - Smaller and more compact */}
              <View style={styles.whySection}>
                <Text style={styles.whyTitle}>Why is this needed?</Text>
                <View style={styles.whyItem}>
                  <Ionicons name="shield-checkmark" size={12} color="#6366f1" />
                  <Text style={styles.whyText}>
                    Maintains quality and serious job seekers
                  </Text>
                </View>
                <View style={styles.whyItem}>
                  <Ionicons name="people" size={12} color="#6366f1" />
                  <Text style={styles.whyText}>
                    Fair compensation for referrers
                  </Text>
                </View>
                <View style={styles.whyItem}>
                  <Ionicons name="repeat" size={12} color="#6366f1" />
                  <Text style={styles.whyText}>
                    Reusable for multiple referral requests
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons - More compact */}
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
                <Ionicons name="card" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>Add Money</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
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
    borderRadius: 16,
    width: '100%',
    maxWidth: 380,
    maxHeight: '75%',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18)',
      },
    }),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#dc2626', // Red background (red-600)
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  headerIcon: {
    marginTop: 2,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    padding: 16,
  },
  message: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  balanceCards: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  balanceCard: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    gap: 4,
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
    fontSize: 10,
    color: colors.gray600,
    fontWeight: typography.weights.medium,
  },
  balanceAmount: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  whySection: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  whyTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  whyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  whyText: {
    flex: 1,
    fontSize: 10,
    color: colors.gray600,
    lineHeight: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    paddingTop: 0,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 5,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.gray700,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 3px 10px rgba(0, 102, 204, 0.25)',
      },
    }),
  },
  primaryButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#fff',
  },
});
