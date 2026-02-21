import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';
import { showToast } from '../../components/Toast';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import { typography } from '../../styles/theme';
import useResponsive from '../../hooks/useResponsive';

export default function WalletScreen({ navigation, route }) {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Withdraw modal states
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false); // Confirmation modal
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi' or 'bank'
  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawableBalance, setWithdrawableBalance] = useState(0);
  const [loadingWithdrawable, setLoadingWithdrawable] = useState(false);
  const withdrawalFee = 0; // No withdrawal fee
  const minimumWithdrawal = 10;

  // Fetch withdrawable balance when modal opens
  useEffect(() => {
    if (showWithdrawModal) {
      const fetchWithdrawable = async () => {
        try {
          setLoadingWithdrawable(true);
          const result = await refopenAPI.getWithdrawableBalance();
          if (result.success) {
            setWithdrawableBalance(result.data.withdrawableAmount || 0);
          }
        } catch (error) {
          console.error('Error fetching withdrawable balance:', error);
        } finally {
          setLoadingWithdrawable(false);
        }
      };
      fetchWithdrawable();
    }
  }, [showWithdrawModal]);

  // Load wallet data
  const loadWalletData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      // Load wallet balance and transactions in parallel
      const [walletResult, transactionsResult] = await Promise.all([
        refopenAPI.getWalletBalance(),
        refopenAPI.getWalletTransactions(1, 20),
      ]);

      if (walletResult.success) {
        setWallet(walletResult.data);
      }

      if (transactionsResult.success) {
        setTransactions(transactionsResult.data.transactions || []);
        setHasMore(transactionsResult.data.totalPages > 1);
        setPage(1);
      }
    } catch (error) {
      console.error('Error loading wallet data:', error);
      showToast('Failed to load wallet data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  // Listen for route params to refresh after payment
  useEffect(() => {
    if (route.params?.refresh) {
      loadWalletData(false);
    }
  }, [route.params?.refresh, route.params?.timestamp, loadWalletData]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadWalletData(false);
  }, [loadWalletData]);

  // Load more transactions
  const loadMoreTransactions = async () => {
    if (!hasMore || loading) return;

    try {
      const nextPage = page + 1;
      const result = await refopenAPI.getWalletTransactions(nextPage, 20);

      if (result.success) {
        setTransactions((prev) => [...prev, ...(result.data.transactions || [])]);
        setPage(nextPage);
        setHasMore(nextPage < result.data.totalPages);
      }
    } catch (error) {
      console.error('Error loading more transactions:', error);
    }
  };

  // Render transaction item
  const renderTransaction = ({ item }) => {
    const isCredit = item.TransactionType === 'Credit';
    const icon = isCredit ? 'arrow-down-circle' : 'arrow-up-circle';
    const iconColor = isCredit ? '#10B981' : '#EF4444';

    return (
      <View style={styles.transactionItem}>
        <View style={styles.transactionIcon}>
          <Ionicons name={icon} size={32} color={iconColor} />
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionDescription}>
            {item.Description || item.Source}
          </Text>
          <Text style={styles.transactionDate}>
            {new Date(item.CreatedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={styles.transactionAmount}>
          <Text style={[styles.amountText, { color: iconColor }]}>
            {isCredit ? '+' : '-'}₹{item.Amount.toFixed(2)}
          </Text>
          <Text style={styles.balanceText}>
            Bal: ₹{item.BalanceAfter.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading wallet...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubScreenHeader title="My Wallet" fallbackTab="Home" />
      <View style={styles.innerContainer}>
      {/* Wallet Balance Card */}
      <View style={styles.balanceCard}>
        {/* Top Row: Total Balance + Available/Hold Info */}
        <View style={styles.balanceTopRow}>
          {/* Left: Total Balance */}
          <View style={styles.balanceLeft}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Text style={styles.balanceAmount}>
              ₹{wallet?.balance?.toFixed(2) || '0.00'}
            </Text>
            <Text style={styles.balanceCurrency}>{wallet?.currencyCode || 'INR'}</Text>
          </View>
          
          {/* Right: Available & Hold - only show if there are holds */}
          {wallet?.holdAmount > 0 && (
            <TouchableOpacity 
              style={styles.holdInfoContainer}
              onPress={() => navigation.navigate('WalletHolds')}
              activeOpacity={0.7}
            >
              <View style={styles.holdInfoRow}>
                <Text style={styles.availableLabel}>Available</Text>
                <Text style={styles.availableAmount}>
                  ₹{wallet?.availableBalance?.toFixed(2) || '0.00'}
                </Text>
              </View>
              <View style={styles.holdInfoRow}>
                <Text style={styles.holdLabel}>On Hold</Text>
                <Text style={styles.holdAmount}>
                  ₹{wallet?.holdAmount?.toFixed(2) || '0.00'}
                </Text>
              </View>
              <Text style={styles.holdHint}>Pending referral requests</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.addMoneyButton}
            onPress={() => navigation.navigate('WalletRecharge')}
          >
            <Ionicons name="add-circle" size={24} color="#FFF" />
            <Text style={styles.addMoneyText}>Add Money</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.withdrawMoneyButton}
            onPress={() => setShowWithdrawModal(true)}
          >
            <Ionicons name="arrow-up-circle" size={24} color="#FFF" />
            <Text style={styles.withdrawMoneyText}>Withdraw</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => navigation.navigate('WalletTransactions')}
          >
            <Ionicons name="receipt-outline" size={24} color="#007AFF" />
            <Text style={styles.historyText}>Transactions</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Get Free Credits Banner */}
      <TouchableOpacity 
        style={{
          backgroundColor: '#6366F1',
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 10,
          marginHorizontal: 16,
          marginBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
        }}
        onPress={() => navigation.navigate('ShareEarn')}
      >
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#FFF' }}>
          💰 Get Free Credits!
        </Text>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
          <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 12 }}>Earn Now</Text>
        </View>
      </TouchableOpacity>

      {/* Recent Transactions */}
      <View style={styles.transactionsContainer}>
        {/* ? NEW: Header with Add Money button */}
        <View style={styles.transactionsHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity
            style={styles.miniAddButton}
            onPress={() => navigation.navigate('WalletRecharge')}
          >
            <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <FlatList
          style={{ flex: 1 }}
          data={transactions.slice(0, 5)}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.TransactionID}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Add money to your wallet to get started
              </Text>
              <TouchableOpacity
                style={styles.emptyAddButton}
                onPress={() => navigation.navigate('WalletRecharge')}
              >
                <Ionicons name="add-circle" size={20} color="#FFF" />
                <Text style={styles.emptyAddButtonText}>Add Money Now</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />

        {transactions.length > 5 && (
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('WalletTransactions')}
          >
            <Text style={styles.viewAllText}>View All Transactions</Text>
            <Ionicons name="chevron-forward" size={20} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>
      </View>

      {/* Withdraw Modal */}
      <Modal
        visible={showWithdrawModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Withdraw Money</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <TouchableOpacity 
                  onPress={() => {
                    setShowWithdrawModal(false);
                    navigation.navigate('WithdrawalRequests');
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Ionicons name="time-outline" size={20} color="#007AFF" />
                  <Text style={{ color: '#007AFF', fontSize: 14 }}>History</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalLabel}>Withdrawable Earnings</Text>
              <Text style={styles.modalBalance}>
                {loadingWithdrawable ? 'Loading...' : `₹${withdrawableBalance.toFixed(2)}`}
              </Text>
              {withdrawableBalance < (wallet?.balance || 0) && (
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
                  <Ionicons name="card-outline" size={18} color={paymentMethod === 'upi' ? '#FFF' : colors.text} />
                  <Text style={[styles.paymentMethodText, paymentMethod === 'upi' && styles.paymentMethodTextActive]}>UPI</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.paymentMethodBtn, paymentMethod === 'bank' && styles.paymentMethodBtnActive]}
                  onPress={() => setPaymentMethod('bank')}
                >
                  <Ionicons name="business-outline" size={18} color={paymentMethod === 'bank' ? '#FFF' : colors.text} />
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

              {parseFloat(withdrawAmount) > (wallet?.balance || 0) && (
                <Text style={styles.errorText}>Insufficient balance</Text>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowWithdrawModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!withdrawAmount || parseFloat(withdrawAmount) < minimumWithdrawal || parseFloat(withdrawAmount) > withdrawableBalance || 
                   (paymentMethod === 'upi' && !upiId) || 
                   (paymentMethod === 'bank' && (!bankAccount || !ifscCode || !accountHolderName)) || 
                   withdrawing || loadingWithdrawable) && styles.submitButtonDisabled
                ]}
                disabled={!withdrawAmount || parseFloat(withdrawAmount) < minimumWithdrawal || parseFloat(withdrawAmount) > withdrawableBalance || 
                   (paymentMethod === 'upi' && !upiId) || 
                   (paymentMethod === 'bank' && (!bankAccount || !ifscCode || !accountHolderName)) || 
                   withdrawing || loadingWithdrawable}
                onPress={() => setShowWithdrawConfirm(true)}
              >
                {withdrawing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Withdrawal Confirmation Modal */}
      <Modal
        visible={showWithdrawConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWithdrawConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIconContainer}>
              <Ionicons name="warning" size={48} color="#f59e0b" />
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
                  {paymentMethod === 'upi' ? `UPI (${upiId})` : `Bank Transfer`}
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
              💡 {paymentMethod === 'upi' 
                ? 'UPI withdrawals are processed within 2 business days.' 
                : 'Bank transfers take 2 days for processing + 2-3 days for bank transfer.'}
            </Text>
            
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowWithdrawConfirm(false)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmProceedBtn}
                disabled={withdrawing}
                onPress={async () => {
                  try {
                    setWithdrawing(true);
                    const paymentDetails = paymentMethod === 'upi' 
                      ? { upiId } 
                      : { bankAccount, ifscCode, accountHolderName };
                    const response = await refopenAPI.requestWithdrawal(parseFloat(withdrawAmount), paymentDetails);
                    if (response.success) {
                      showToast(`Withdrawal request submitted! You'll receive ₹${response.data.netAmount}`, 'success');
                      setShowWithdrawConfirm(false);
                      setShowWithdrawModal(false);
                      setWithdrawAmount('');
                      setUpiId('');
                      setBankAccount('');
                      setIfscCode('');
                      setAccountHolderName('');
                      loadWalletData(false);
                    } else {
                      // Log technical errors to console, show user-friendly message
                      console.error('Withdrawal error:', response.error);
                      showToast('Withdrawal failed. Please try again.', 'error');
                    }
                  } catch (error) {
                    // Log technical errors to console, show user-friendly message
                    console.error('Withdrawal error:', error.message || error);
                    showToast('Withdrawal failed. Please try again.', 'error');
                  } finally {
                    setWithdrawing(false);
                  }
                }}
              >
                {withdrawing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmProceedText}>Yes, Withdraw</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  innerContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 900 : '100%',
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.textSecondary,
  },
  balanceCard: {
    backgroundColor: '#007AFF',
    padding: responsive.isDesktop ? 24 : 16,
    margin: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  balanceLeft: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: responsive.isDesktop ? 42 : 36,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 2,
  },
  balanceCurrency: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addMoneyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  addMoneyText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  withdrawMoneyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  withdrawMoneyText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  historyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  historyText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  transactionsContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  transactionIcon: {
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  balanceText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 4,
  },

  // ? NEW: Transactions header styles
  transactionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  miniAddButton: {
    padding: 4,
  },

  // ? NEW: Empty state add button
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  emptyAddButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // 💰 NEW: Hold info styles (compact, right side)
  holdInfoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    padding: 10,
    minWidth: 130,
  },
  holdInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  availableLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  availableAmount: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: 'bold',
  },
  holdLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  holdAmount: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: 'bold',
  },
  holdHint: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    marginTop: 4,
    textAlign: 'center',
  },
  // Withdraw Modal Styles
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
    color: '#10B981',
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
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  paymentMethodTextActive: {
    color: '#FFF',
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
    color: '#10B981',
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
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // Confirmation Modal Styles
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
    backgroundColor: '#fef3c7',
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
    color: '#10B981',
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
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  confirmProceedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
