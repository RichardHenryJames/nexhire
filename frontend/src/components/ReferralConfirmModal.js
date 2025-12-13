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
 * Beautiful confirmation modal for referral requests
 * Shows ₹50 deduction and benefits clearly
 */
export default function ReferralConfirmModal({
  visible,
  currentBalance = 0,
  requiredAmount = 50,
  onProceed,
  onCancel,
  onAddMoney, // NEW: Handler for "Add Money" button
  jobTitle = 'this job',
}) {
  const balanceAfter = currentBalance - requiredAmount;
  const hasInsufficientBalance = currentBalance < requiredAmount;

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
            {/* Header with Icon - Purple background */}
            <View style={styles.header}>
              <Ionicons name="people" size={32} color="#fff"/>
              <Text style={styles.title}>Request Referral</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.message}>
                Request referral for {jobTitle}
              </Text>

              {/* Cost and Balance Info */}
              <View style={styles.costSection}>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>Cost</Text>
                  <Text style={styles.costValue}>₹{requiredAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>Current Balance</Text>
                  <Text style={[styles.costValue, { color: hasInsufficientBalance ? '#ef4444' : '#10b981' }]}>
                    ₹{currentBalance.toFixed(2)}
                  </Text>
                </View>
                {!hasInsufficientBalance && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.costRow}>
                      <Text style={styles.costLabelBold}>Balance After</Text>
                      <Text style={[styles.costValueBold, { color: colors.text }]}>
                        ₹{balanceAfter.toFixed(2)}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {hasInsufficientBalance ? (
                /* Insufficient Balance Warning */
                <View style={styles.warningSection}>
                  <Ionicons name="warning" size={16} color="#f59e0b" />
                  <Text style={styles.warningText}>
                    Insufficient balance. Please recharge your wallet to continue.
                  </Text>
                </View>
              ) : (
                /* Benefits Section */
                <View style={styles.benefitsSection}>
                  <Text style={styles.benefitsTitle}>What happens next:</Text>
                  <View style={styles.benefitItem}>
                    <Ionicons name="flash" size={16} color="#10b981" />
                    <Text style={styles.benefitText}>
                      Submit your referral request immediately
                    </Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Ionicons name="notifications" size={16} color="#10b981" />
                    <Text style={styles.benefitText}>
                      Employees at that company get notified instantly
                    </Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Ionicons name="people" size={16} color="#10b981" />
                    <Text style={styles.benefitText}>
                      Increase your chances with employees ready to refer
                    </Text>
                  </View>
                  <View style={styles.benefitItem}>
                    <Ionicons name="trending-up" size={16} color="#10b981" />
                    <Text style={styles.benefitText}>
                      Get fast-tracked in the hiring process through internal referrals
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
              >
                <Text style={styles.cancelButtonText}>
                  {hasInsufficientBalance ? 'Maybe Later' : 'Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={hasInsufficientBalance ? onAddMoney : onProceed}
              >
                <Ionicons 
                  name={hasInsufficientBalance ? "card" : "flash"} 
                  size={16} 
                  color="#fff" 
                />
                <Text style={styles.primaryButtonText}>
                  {hasInsufficientBalance ? 'Add Money' : 'Proceed'}
                </Text>
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
    maxWidth: 400,
    maxHeight: '80%',
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
    backgroundColor: '#6366f1', // Purple background (indigo-500)
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: '#fff',
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  message: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  costSection: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  costLabel: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  costLabelBold: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  costValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  costValueBold: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  warningSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: '#92400e',
    lineHeight: 20,
  },
  benefitsSection: {
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  benefitsTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  benefitText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.gray600,
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
    paddingHorizontal: 16,
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
    backgroundColor: '#6366f1',
    ...Platform.select({
      ios: {
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 3px 10px rgba(99, 102, 241, 0.3)',
      },
    }),
  },
  primaryButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: '#fff',
  },
});
