import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { typography } from '../styles/theme';
import refopenAPI from '../services/api';
import { showToast } from './Toast';

/**
 * Reusable Withdraw Modal Component
 * Can be used from WalletScreen or ReferralPointsBreakdown
 */
export default function WithdrawModal({
  visible,
  onClose,
  onSuccess,
  navigation,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Withdrawable data
  const [withdrawableData, setWithdrawableData] = useState({
    withdrawableAmount: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
    canWithdraw: false,
    minimumWithdrawal: 10,
    withdrawalFee: 0,
  });
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  // Form states
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');

  // Load withdrawable balance when modal opens
  useEffect(() => {
    if (visible) {
      loadWithdrawableBalance();
    }
  }, [visible]);

  const loadWithdrawableBalance = async () => {
    try {
      setLoading(true);
      const response = await refopenAPI.getWithdrawableBalance();
      if (response.success && response.data) {
        setWithdrawableData(response.data);
      }
    } catch (error) {
      console.error('Error loading withdrawable balance:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate withdrawal fee and final amount
  const getWithdrawCalculation = () => {
    const amount = parseFloat(withdrawAmount) || 0;
    const fee = withdrawableData.withdrawalFee;
    const finalAmount = Math.max(0, amount - fee);
    return { amount, fee, finalAmount };
  };

  // Handle withdrawal request
  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount) || 0;

    // Validate payment details
    if (paymentMethod === 'upi') {
      if (!upiId.trim()) {
        showToast('Please enter your UPI ID', 'error');
        return;
      }
      if (!upiId.includes('@')) {
        showToast('Please enter a valid UPI ID (e.g., name@upi)', 'error');
        return;
      }
    } else {
      if (!bankAccount.trim()) {
        showToast('Please enter your bank account number', 'error');
        return;
      }
      if (!ifscCode.trim()) {
        showToast('Please enter IFSC code', 'error');
        return;
      }
      if (!accountHolderName.trim()) {
        showToast('Please enter account holder name', 'error');
        return;
      }
      if (ifscCode.length !== 11) {
        showToast('IFSC code must be 11 characters', 'error');
        return;
      }
    }

    if (amount < withdrawableData.minimumWithdrawal) {
      showToast(`Minimum withdrawal amount is ₹${withdrawableData.minimumWithdrawal}`, 'error');
      return;
    }

    if (amount > withdrawableData.withdrawableAmount) {
      showToast(`Maximum withdrawal is ₹${withdrawableData.withdrawableAmount}`, 'error');
      return;
    }

    try {
      setWithdrawing(true);

      const { finalAmount } = getWithdrawCalculation();

      const paymentDetails =
        paymentMethod === 'upi'
          ? { upiId: upiId.trim() }
          : {
              bankAccount: bankAccount.trim(),
              ifscCode: ifscCode.trim().toUpperCase(),
              accountHolderName: accountHolderName.trim(),
            };

      const response = await refopenAPI.requestWithdrawal(amount, paymentDetails);

      if (response.success) {
        // Reset form
        setUpiId('');
        setBankAccount('');
        setIfscCode('');
        setAccountHolderName('');
        setWithdrawAmount('');
        setPaymentMethod('upi');

        // Close modal
        onClose();

        // Show success
        const paymentDestination = paymentMethod === 'upi' ? 'UPI' : 'bank account';
        showToast(
          `₹${finalAmount} withdrawal requested! Will be credited to ${paymentDestination} in 24-48 hrs`,
          'success'
        );

        // Navigate to withdrawal requests
        if (navigation) {
          setTimeout(() => {
            navigation.navigate('WithdrawalRequests');
          }, 500);
        }

        // Callback
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(response.error || 'Withdrawal request failed');
      }
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      showToast(error.message || 'Failed to request withdrawal', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  const { finalAmount } = getWithdrawCalculation();
  const isValidAmount =
    parseFloat(withdrawAmount) >= withdrawableData.minimumWithdrawal &&
    parseFloat(withdrawAmount) <= withdrawableData.withdrawableAmount;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Withdraw Funds</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
              {/* Available Balance */}
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Withdrawable Earnings</Text>
                <Text style={styles.balanceAmount}>₹{withdrawableData.withdrawableAmount}</Text>
                {withdrawableData.withdrawalFee > 0 && (
                  <Text style={styles.feeNote}>₹{withdrawableData.withdrawalFee} processing fee per withdrawal</Text>
                )}
                <Text style={{ color: colors.textSecondary || '#9CA3AF', fontSize: 11, marginTop: 4 }}>
                  Only referral earnings are withdrawable
                </Text>
              </View>

              {withdrawableData.withdrawableAmount < withdrawableData.minimumWithdrawal ? (
                <View style={styles.notEligibleBox}>
                  <Ionicons name="information-circle" size={24} color={colors.warning} />
                  <Text style={styles.notEligibleText}>
                    Minimum ₹{withdrawableData.minimumWithdrawal} required to withdraw.
                    You need ₹{withdrawableData.minimumWithdrawal - withdrawableData.withdrawableAmount} more.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Amount Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Withdrawal Amount</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={`Min ₹${withdrawableData.minimumWithdrawal}`}
                      placeholderTextColor={colors.textSecondary}
                      value={withdrawAmount}
                      onChangeText={(text) => setWithdrawAmount(text.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                    <TouchableOpacity
                      style={styles.maxBtn}
                      onPress={() => setWithdrawAmount(String(withdrawableData.withdrawableAmount))}
                    >
                      <Text style={styles.maxBtnText}>MAX</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Fee Breakdown - only show if there's a fee */}
                  {isValidAmount && withdrawableData.withdrawalFee > 0 && (
                    <View style={styles.feeBreakdown}>
                      <View style={styles.feeRow}>
                        <Text style={styles.feeLabel}>Amount:</Text>
                        <Text style={styles.feeValue}>₹{withdrawAmount}</Text>
                      </View>
                      <View style={styles.feeRow}>
                        <Text style={styles.feeLabel}>Processing Fee:</Text>
                        <Text style={[styles.feeValue, { color: colors.error }]}>
                          - ₹{withdrawableData.withdrawalFee}
                        </Text>
                      </View>
                      <View style={[styles.feeRow, styles.feeTotal]}>
                        <Text style={styles.feeTotalLabel}>You'll Receive:</Text>
                        <Text style={styles.feeTotalValue}>₹{finalAmount}</Text>
                      </View>
                    </View>
                  )}

                  {/* Payment Method */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Payment Method</Text>
                    <View style={styles.methodTabs}>
                      <TouchableOpacity
                        style={[styles.methodTab, paymentMethod === 'upi' && styles.methodTabActive]}
                        onPress={() => setPaymentMethod('upi')}
                      >
                        <Ionicons
                          name="phone-portrait"
                          size={18}
                          color={paymentMethod === 'upi' ? '#fff' : colors.text}
                        />
                        <Text
                          style={[
                            styles.methodTabText,
                            paymentMethod === 'upi' && styles.methodTabTextActive,
                          ]}
                        >
                          UPI
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.methodTab, paymentMethod === 'bank' && styles.methodTabActive]}
                        onPress={() => setPaymentMethod('bank')}
                      >
                        <Ionicons
                          name="business"
                          size={18}
                          color={paymentMethod === 'bank' ? '#fff' : colors.text}
                        />
                        <Text
                          style={[
                            styles.methodTabText,
                            paymentMethod === 'bank' && styles.methodTabTextActive,
                          ]}
                        >
                          Bank
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* UPI Input */}
                  {paymentMethod === 'upi' && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>UPI ID</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="yourname@upi"
                        placeholderTextColor={colors.textSecondary}
                        value={upiId}
                        onChangeText={setUpiId}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  )}

                  {/* Bank Details */}
                  {paymentMethod === 'bank' && (
                    <>
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Account Holder Name</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Full name as per bank"
                          placeholderTextColor={colors.textSecondary}
                          value={accountHolderName}
                          onChangeText={setAccountHolderName}
                        />
                      </View>
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Account Number</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Bank account number"
                          placeholderTextColor={colors.textSecondary}
                          value={bankAccount}
                          onChangeText={setBankAccount}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>IFSC Code</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="IFSC code (11 characters)"
                          placeholderTextColor={colors.textSecondary}
                          value={ifscCode}
                          onChangeText={(text) => setIfscCode(text.toUpperCase())}
                          autoCapitalize="characters"
                          maxLength={11}
                        />
                      </View>
                    </>
                  )}

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[styles.submitBtn, (!isValidAmount || withdrawing) && styles.submitBtnDisabled]}
                    onPress={handleWithdraw}
                    disabled={!isValidAmount || withdrawing}
                  >
                    {withdrawing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="arrow-up-circle" size={20} color="#fff" />
                        <Text style={styles.submitBtnText}>
                          Withdraw ₹{finalAmount || 0}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    closeBtn: {
      padding: 4,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    content: {
      padding: 16,
    },
    balanceCard: {
      backgroundColor: colors.success + '15',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.success + '30',
    },
    balanceLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    balanceAmount: {
      fontSize: 32,
      fontWeight: typography.weights.bold,
      color: colors.success,
    },
    feeNote: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      marginTop: 8,
    },
    notEligibleBox: {
      backgroundColor: colors.warning + '15',
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    notEligibleText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.text,
    },
    inputGroup: {
      marginBottom: 16,
      position: 'relative',
    },
    inputLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 14,
      fontSize: typography.sizes.md,
      color: colors.text,
    },
    maxBtn: {
      position: 'absolute',
      right: 12,
      top: 38,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    maxBtnText: {
      color: '#fff',
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.bold,
    },
    feeBreakdown: {
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    feeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    feeLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    feeValue: {
      fontSize: typography.sizes.sm,
      color: colors.text,
    },
    feeTotal: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      marginTop: 4,
    },
    feeTotalLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    feeTotalValue: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
      color: colors.success,
    },
    methodTabs: {
      flexDirection: 'row',
      gap: 12,
    },
    methodTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    methodTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    methodTabText: {
      fontSize: typography.sizes.sm,
      color: colors.text,
      fontWeight: typography.weights.medium,
    },
    methodTabTextActive: {
      color: '#fff',
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.success,
      padding: 16,
      borderRadius: 12,
      marginTop: 8,
      marginBottom: 24,
    },
    submitBtnDisabled: {
      backgroundColor: colors.border,
    },
    submitBtnText: {
      color: '#fff',
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
    },
  });
