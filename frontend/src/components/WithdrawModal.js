import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../services/api';
import { showToast } from './Toast';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Shared Withdraw Modal — used by WalletScreen and EarningsScreen.
 *
 * Props:
 *  visible       – boolean
 *  onClose       – () => void
 *  onSuccess     – () => void, called after successful withdrawal
 *  navigation    – navigation object (for History link)
 *  walletBalance – optional number, shows "Only referral earnings" hint when > withdrawable
 */
export default function WithdrawModal({ visible, onClose, onSuccess, navigation, walletBalance }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Form state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  // Withdrawable data
  const [withdrawableBalance, setWithdrawableBalance] = useState(0);
  const [loadingWithdrawable, setLoadingWithdrawable] = useState(false);
  const [withdrawMinimum, setWithdrawMinimum] = useState(200);
  const withdrawalFee = 0;
  const minimumWithdrawal = withdrawMinimum;

  // Confirmation sub-modal
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch withdrawable balance when modal opens
  useEffect(() => {
    if (visible) {
      (async () => {
        try {
          setLoadingWithdrawable(true);
          const result = await refopenAPI.getWithdrawableBalance();
          if (result.success) {
            setWithdrawableBalance(result.data.withdrawableAmount || 0);
            if (result.data.minimumWithdrawal) setWithdrawMinimum(result.data.minimumWithdrawal);
          }
        } catch (error) {
          console.error('Error fetching withdrawable balance:', error);
        } finally {
          setLoadingWithdrawable(false);
        }
      })();
    }
  }, [visible]);

  const resetForm = () => {
    setWithdrawAmount('');
    setUpiId('');
    setBankAccount('');
    setIfscCode('');
    setAccountHolderName('');
  };

  const handleClose = () => {
    onClose();
  };

  const isFormValid = withdrawAmount &&
    parseFloat(withdrawAmount) >= minimumWithdrawal &&
    parseFloat(withdrawAmount) <= withdrawableBalance &&
    (paymentMethod === 'upi' ? !!upiId : (!!bankAccount && !!ifscCode && !!accountHolderName)) &&
    !withdrawing && !loadingWithdrawable;

  const handleSubmit = async () => {
    try {
      setWithdrawing(true);
      const paymentDetails = paymentMethod === 'upi'
        ? { upiId }
        : { bankAccount, ifscCode, accountHolderName };
      const response = await refopenAPI.requestWithdrawal(parseFloat(withdrawAmount), paymentDetails);
      if (response.success) {
        showToast(`Withdrawal request submitted! You'll receive ₹${response.data.netAmount}`, 'success');
        setShowConfirm(false);
        resetForm();
        onClose();
        if (onSuccess) onSuccess();
      } else {
        console.error('Withdrawal error:', response.error);
        showToast('Withdrawal failed. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Withdrawal error:', error.message || error);
      showToast('Withdrawal failed. Please try again.', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <>
      {/* ── Withdraw Form Modal ── */}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Withdraw Money</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                {navigation && (
                  <TouchableOpacity
                    onPress={() => { handleClose(); navigation.navigate('WithdrawalRequests'); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Ionicons name="time-outline" size={20} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 14 }}>History</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalLabel}>Withdrawable Earnings</Text>
              <Text style={styles.modalBalance}>
                {loadingWithdrawable ? 'Loading...' : `₹${withdrawableBalance.toFixed(2)}`}
              </Text>
              {walletBalance != null && withdrawableBalance < walletBalance && (
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
                  Only referral earnings are withdrawable
                </Text>
              )}

              <Text style={styles.modalLabel}>Amount to Withdraw</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={`Min ₹${minimumWithdrawal}`}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
              />

              {/* Payment Method Toggle */}
              <Text style={styles.modalLabel}>Payment Method</Text>
              <View style={styles.paymentMethodRow}>
                <TouchableOpacity
                  style={[styles.paymentMethodBtn, paymentMethod === 'upi' && styles.paymentMethodBtnActive]}
                  onPress={() => setPaymentMethod('upi')}
                >
                  <Ionicons name="card-outline" size={18} color={paymentMethod === 'upi' ? colors.white : colors.text} />
                  <Text style={[styles.paymentMethodText, paymentMethod === 'upi' && styles.paymentMethodTextActive]}>UPI</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.paymentMethodBtn, paymentMethod === 'bank' && styles.paymentMethodBtnActive]}
                  onPress={() => setPaymentMethod('bank')}
                >
                  <Ionicons name="business-outline" size={18} color={paymentMethod === 'bank' ? colors.white : colors.text} />
                  <Text style={[styles.paymentMethodText, paymentMethod === 'bank' && styles.paymentMethodTextActive]}>Bank</Text>
                </TouchableOpacity>
              </View>

              {/* UPI Fields */}
              {paymentMethod === 'upi' && (
                <>
                  <Text style={styles.modalLabel}>UPI ID</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="yourname@upi"
                    placeholderTextColor={colors.textMuted}
                    value={upiId}
                    onChangeText={setUpiId}
                    autoCapitalize="none"
                  />
                </>
              )}

              {/* Bank Fields */}
              {paymentMethod === 'bank' && (
                <>
                  <Text style={styles.modalLabel}>Account Holder Name</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="As per bank account"
                    placeholderTextColor={colors.textMuted}
                    value={accountHolderName}
                    onChangeText={setAccountHolderName}
                  />

                  <Text style={styles.modalLabel}>Bank Account Number</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Enter account number"
                    placeholderTextColor={colors.textMuted}
                    value={bankAccount}
                    onChangeText={setBankAccount}
                    keyboardType="numeric"
                  />

                  <Text style={styles.modalLabel}>IFSC Code</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., HDFC0001234"
                    placeholderTextColor={colors.textMuted}
                    value={ifscCode}
                    onChangeText={setIfscCode}
                    autoCapitalize="characters"
                  />
                </>
              )}

              {parseFloat(withdrawAmount) >= minimumWithdrawal && withdrawalFee > 0 && (
                <View style={styles.feeBreakdown}>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Amount</Text>
                    <Text style={styles.feeValue}>₹{withdrawAmount}</Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Processing Fee</Text>
                    <Text style={[styles.feeValue, { color: colors.error }]}>-₹{withdrawalFee}</Text>
                  </View>
                  <View style={[styles.feeRow, styles.feeRowTotal]}>
                    <Text style={styles.feeLabelBold}>You'll Receive</Text>
                    <Text style={styles.feeValueBold}>₹{(parseFloat(withdrawAmount) - withdrawalFee).toFixed(2)}</Text>
                  </View>
                </View>
              )}

              {parseFloat(withdrawAmount) > 0 && parseFloat(withdrawAmount) < minimumWithdrawal && (
                <Text style={styles.errorText}>Minimum withdrawal is ₹{minimumWithdrawal}</Text>
              )}

              {parseFloat(withdrawAmount) > withdrawableBalance && (
                <Text style={styles.errorText}>Insufficient balance</Text>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, !isFormValid && styles.submitButtonDisabled]}
                disabled={!isFormValid}
                onPress={() => setShowConfirm(true)}
              >
                {withdrawing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Confirmation Modal ── */}
      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconContainer}>
              <Ionicons name="warning" size={48} color={colors.warning} />
            </View>

            <Text style={styles.confirmTitle}>Confirm Withdrawal</Text>

            <Text style={styles.confirmMessage}>
              Are you sure you want to withdraw{' '}
              <Text style={styles.confirmAmount}>₹{parseFloat(withdrawAmount || 0).toFixed(2)}</Text>
              ?
            </Text>

            <View style={styles.confirmDetails}>
              <View style={styles.confirmDetailRow}>
                <Text style={styles.confirmDetailLabel}>Payment Method:</Text>
                <Text style={styles.confirmDetailValue}>
                  {paymentMethod === 'upi' ? `UPI (${upiId})` : 'Bank Transfer'}
                </Text>
              </View>
              <View style={styles.confirmDetailRow}>
                <Text style={styles.confirmDetailLabel}>Processing Time:</Text>
                <Text style={styles.confirmDetailValue}>
                  {paymentMethod === 'upi' ? '2-3 business days' : '4-5 business days'}
                </Text>
              </View>
            </View>

            <Text style={styles.confirmNote}>
              {paymentMethod === 'upi'
                ? 'UPI withdrawals are processed within 2 business days.'
                : 'Bank transfers take 2 days for processing + 2-3 days for bank transfer.'}
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setShowConfirm(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmProceedBtn}
                disabled={withdrawing}
                onPress={handleSubmit}
              >
                {withdrawing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.confirmProceedText}>Yes, Withdraw</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalBody: {
    padding: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 16,
  },
  modalBalance: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.success,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  paymentMethodBtnActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  paymentMethodTextActive: {
    color: colors.white,
  },
  feeBreakdown: {
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 10,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  feeRowTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    paddingTop: 12,
  },
  feeLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  feeValue: {
    fontSize: 14,
    color: colors.text,
  },
  feeLabelBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  feeValueBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmBox: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: (colors.warningBg || (colors.warning + '20')),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  confirmAmount: {
    fontWeight: 'bold',
    color: colors.success,
    fontSize: 18,
  },
  confirmDetails: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  confirmDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  confirmDetailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  confirmDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  confirmNote: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  confirmProceedBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.success,
    alignItems: 'center',
  },
  confirmProceedText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
