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
          {/* 🎨 Premium Header - Gradient Purple */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Ionicons name="people" size={28} color="#fff" style={styles.headerIcon} />
              <Text style={styles.headerTitle}>Request Referral</Text>
            </View>
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

            {/* 💰 Cost Breakdown - Clean Card */}
            <View style={styles.costCard}>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Cost</Text>
                <Text style={styles.costAmount}>₹{requiredAmount.toFixed(2)}</Text>
              </View>
              
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Current Balance</Text>
                <Text style={[
                  styles.balanceAmount,
                  { color: hasInsufficientBalance ? '#ef4444' : '#10b981' }
                ]}>
                  ₹{currentBalance.toFixed(2)}
                </Text>
              </View>

              {!hasInsufficientBalance && (
                <>
                  <View style={styles.costDivider} />
                  <View style={styles.balanceAfterRow}>
                    <Text style={styles.balanceAfterLabel}>Balance After</Text>
                    <Text style={styles.balanceAfterAmount}>
                      ₹{balanceAfter.toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {hasInsufficientBalance ? (
              /* ⚠️ Insufficient Balance Alert */
              <View style={styles.insufficientAlert}>
                <Ionicons name="alert-circle" size={18} color="#f59e0b" />
                <Text style={styles.insufficientText}>
                  Insufficient balance. Please add money to continue.
                </Text>
              </View>
            ) : (
              /* ✨ Benefits Section - Numbered Steps Only (No Icons) */
              <View style={styles.benefitsBox}>
                <Text style={styles.benefitsHeading}>What happens next:</Text>
                
                <Text style={styles.benefitLabel}>
                  <Text style={styles.benefitNumber}>1. </Text>
                  Submit your referral request immediately
                </Text>

                <Text style={styles.benefitLabel}>
                  <Text style={styles.benefitNumber}>2. </Text>
                  Employees at that company get notified instantly
                </Text>

                <Text style={styles.benefitLabel}>
                  <Text style={styles.benefitNumber}>3. </Text>
                  Increase your chances with employees ready to refer
                </Text>

                <Text style={styles.benefitLabel}>
                  <Text style={styles.benefitNumber}>4. </Text>
                  Get fast-tracked in the hiring process through internal referrals
                </Text>
              </View>
            )}
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
              onPress={hasInsufficientBalance ? onAddMoney : onProceed}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={hasInsufficientBalance ? "add-circle" : "paper-plane"} 
                size={18} 
                color="#fff" 
              />
              <Text style={styles.proceedBtnText}>
                {hasInsufficientBalance ? 'Add Money' : 'Proceed'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 450,
    maxHeight: '90%',
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
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.25)',
      },
    }),
  },

  // 🎨 Premium Header - Purple with Icon
  header: {
    backgroundColor: '#6366f1',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  headerIcon: {
    marginRight: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  jobTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 24,
  },

  // 💰 Cost Card - Clean & Tight
  costCard: {
    marginHorizontal: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  costLabel: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  costAmount: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '600',
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  costDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10,
  },
  balanceAfterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  balanceAfterLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  balanceAfterAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },

  // ⚠️ Insufficient Balance Alert
  insufficientAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fcd34d',
    marginBottom: 16,
  },
  insufficientText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
    lineHeight: 18,
  },

  // ✨ Benefits Box - Numbered Steps Only
  benefitsBox: {
    marginHorizontal: 20,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginBottom: 20,
  },
  benefitsHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 12,
  },
  benefitLabel: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 8,
  },
  benefitNumber: {
    fontWeight: '700',
    color: '#1e3a8a',
  },

  // 🎯 Footer Actions - Clean Buttons
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4b5563',
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
    backgroundColor: '#6366f1',
    ...Platform.select({
      ios: {
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
      },
    }),
  },
  proceedBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
});

