import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import refopenAPI from '../../services/api';
import { showToast } from '../../components/Toast';

export default function AdminPaymentsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { isAdmin } = useAuth();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [processingPayment, setProcessingPayment] = useState(null);
  const [activeTab, setActiveTab] = useState('withdrawals'); // withdrawals, payments
  const [subTab, setSubTab] = useState('pending'); // pending, completed
  
  // Withdrawal state
  const [allWithdrawals, setAllWithdrawals] = useState([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [completedWithdrawals, setCompletedWithdrawals] = useState([]);
  const [processingWithdrawal, setProcessingWithdrawal] = useState(null);
  
  // Rejection modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingSubmissionId, setRejectingSubmissionId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Withdrawal approval modal state
  const [withdrawalModalVisible, setWithdrawalModalVisible] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [withdrawalAction, setWithdrawalAction] = useState('approve'); // 'approve' or 'reject'
  const [withdrawalRejectionReason, setWithdrawalRejectionReason] = useState('');

  useEffect(() => {
    navigation.setOptions({
      title: 'Payment Approvals',
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { color: colors.text, fontWeight: 'bold' },
    });
  }, [navigation, colors]);

  const loadPendingPayments = useCallback(async () => {
    try {
      const response = await refopenAPI.apiCall('/manual-payment/admin/pending');
      if (response.success) {
        setPendingPayments(response.data || []);
      }
    } catch (error) {
      console.error('Error loading pending payments:', error);
    }
  }, []);

  const loadAllPayments = useCallback(async () => {
    try {
      const response = await refopenAPI.apiCall('/manual-payment/admin/all');
      if (response.success) {
        setAllPayments(response.data || []);
      }
    } catch (error) {
      console.error('Error loading all payments:', error);
    }
  }, []);

  const loadPendingWithdrawals = useCallback(async () => {
    try {
      const response = await refopenAPI.apiCall('/management/withdrawals');
      if (response.success) {
        const all = response.data?.withdrawals || [];
        setAllWithdrawals(all);
        setPendingWithdrawals(all.filter(w => w.Status === 'Pending'));
        setCompletedWithdrawals(all.filter(w => w.Status !== 'Pending').sort((a, b) => new Date(b.ProcessedAt || b.RequestedAt) - new Date(a.ProcessedAt || a.RequestedAt)));
      }
    } catch (error) {
      console.error('Error loading withdrawals:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadPendingPayments(), loadAllPayments(), loadPendingWithdrawals()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadPendingPayments, loadAllPayments, loadPendingWithdrawals]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleApprovePayment = async (submissionId) => {
    try {
      setProcessingPayment(submissionId);
      const response = await refopenAPI.apiCall(`/manual-payment/admin/approve/${submissionId}`, {
        method: 'POST',
        body: JSON.stringify({ adminRemarks: 'Payment verified and approved' })
      });
      if (response.success) {
        showToast('Payment approved! Amount credited to user wallet.', 'success');
        loadData();
      } else {
        showToast('Failed to approve payment. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error approving payment:', error);
      showToast('Failed to approve payment', 'error');
    } finally {
      setProcessingPayment(null);
    }
  };

  const handleRejectPayment = (submissionId) => {
    setRejectingSubmissionId(submissionId);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const confirmReject = () => {
    if (!rejectionReason.trim()) {
      showToast('Please enter a reason for rejection', 'error');
      return;
    }
    setRejectModalVisible(false);
    executeReject(rejectingSubmissionId, rejectionReason.trim());
  };

  const cancelReject = () => {
    setRejectModalVisible(false);
    setRejectingSubmissionId(null);
    setRejectionReason('');
  };

  const executeReject = async (submissionId, reason) => {
    try {
      setProcessingPayment(submissionId);
      const response = await refopenAPI.apiCall(`/manual-payment/admin/reject/${submissionId}`, {
        method: 'POST',
        body: JSON.stringify({ adminRemarks: reason })
      });
      if (response.success) {
        showToast('Payment rejected.', 'success');
        loadData();
      } else {
        showToast('Failed to reject payment. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error rejecting payment:', error);
      showToast('Failed to reject payment', 'error');
    } finally {
      setProcessingPayment(null);
    }
  };

  // Withdrawal functions
  const handleApproveWithdrawal = (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setWithdrawalAction('approve');
    setPaymentReference('');
    setWithdrawalModalVisible(true);
  };

  const handleRejectWithdrawal = (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setWithdrawalAction('reject');
    setWithdrawalRejectionReason('');
    setWithdrawalModalVisible(true);
  };

  const confirmWithdrawalAction = async () => {
    if (withdrawalAction === 'approve' && !paymentReference.trim()) {
      showToast('Please enter payment reference/transaction ID', 'error');
      return;
    }
    if (withdrawalAction === 'reject' && !withdrawalRejectionReason.trim()) {
      showToast('Please enter reason for rejection', 'error');
      return;
    }
    
    try {
      setProcessingWithdrawal(selectedWithdrawal.WithdrawalID);
      setWithdrawalModalVisible(false);
      
      const response = await refopenAPI.apiCall(`/management/withdrawals/${selectedWithdrawal.WithdrawalID}/process`, {
        method: 'POST',
        body: JSON.stringify({
          action: withdrawalAction,
          paymentReference: paymentReference.trim() || undefined,
          rejectionReason: withdrawalRejectionReason.trim() || undefined,
        })
      });
      
      if (response.success) {
        showToast(
          withdrawalAction === 'approve' 
            ? `Withdrawal of ₹${selectedWithdrawal.Amount} approved!` 
            : 'Withdrawal request rejected.',
          'success'
        );
        loadPendingWithdrawals();
      } else {
        showToast(response.error || 'Failed to process withdrawal', 'error');
      }
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      showToast('Failed to process withdrawal', 'error');
    } finally {
      setProcessingWithdrawal(null);
      setSelectedWithdrawal(null);
    }
  };

  const cancelWithdrawalModal = () => {
    setWithdrawalModalVisible(false);
    setSelectedWithdrawal(null);
    setPaymentReference('');
    setWithdrawalRejectionReason('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved': return colors.success;
      case 'Rejected': return colors.error;
      default: return '#F59E0B';
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color={colors.error} />
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedText}>
            This page is only accessible to administrators.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading payments...</Text>
      </View>
    );
  }

  const renderPaymentCard = (payment, showActions = true) => (
    <View key={payment.submissionId} style={styles.paymentCard}>
      <View style={styles.paymentHeader}>
        <Text style={styles.paymentAmount}>₹{payment.amount?.toFixed(2)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(payment.status) }]}>
            {payment.status}
          </Text>
        </View>
      </View>

      <View style={styles.paymentDetails}>
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>User:</Text>
          <Text style={styles.paymentValue}>{payment.userName || payment.userEmail || 'Unknown'}</Text>
        </View>
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Email:</Text>
          <Text style={styles.paymentValue}>{payment.userEmail || '-'}</Text>
        </View>
        {payment.packName && (
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Pack:</Text>
            <Text style={[styles.paymentValue, { color: '#6366f1', fontWeight: '600' }]}>
              {payment.packName}{payment.packBonusAmount ? ` (+₹${payment.packBonusAmount})` : ''}
            </Text>
          </View>
        )}
        {payment.promoCode && (
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Promo:</Text>
            <Text style={[styles.paymentValue, { color: '#10b981', fontWeight: '600' }]}>{payment.promoCode}</Text>
          </View>
        )}
        {payment.bonusCredited > 0 && (
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Bonus Credited:</Text>
            <Text style={[styles.paymentValue, { color: '#f59e0b', fontWeight: '700' }]}>₹{payment.bonusCredited}</Text>
          </View>
        )}
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Method:</Text>
          <Text style={styles.paymentValue}>{payment.paymentMethod || '-'}</Text>
        </View>
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Ref No:</Text>
          <Text style={styles.paymentValue}>{payment.referenceNumber || '-'}</Text>
        </View>
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Payment Date:</Text>
          <Text style={styles.paymentValue}>{formatDate(payment.paymentDate)}</Text>
        </View>
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Submitted:</Text>
          <Text style={styles.paymentValue}>{formatDateTime(payment.createdAt)}</Text>
        </View>
        {payment.userRemarks && (
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Remarks:</Text>
            <Text style={styles.paymentValue}>{payment.userRemarks}</Text>
          </View>
        )}
        {payment.adminRemarks && (
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Admin Note:</Text>
            <Text style={styles.paymentValue}>{payment.adminRemarks}</Text>
          </View>
        )}
      </View>

      {showActions && payment.status === 'Pending' && (
        <View style={styles.paymentActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprovePayment(payment.submissionId)}
            disabled={processingPayment === payment.submissionId}
          >
            {processingPayment === payment.submissionId ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                <Text style={styles.actionButtonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRejectPayment(payment.submissionId)}
            disabled={processingPayment === payment.submissionId}
          >
            <Ionicons name="close-circle" size={18} color="#FFF" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderWithdrawalCard = (withdrawal) => (
    <View key={withdrawal.WithdrawalID} style={styles.paymentCard}>
      <View style={styles.paymentHeader}>
        <Text style={styles.paymentAmount}>₹{withdrawal.Amount}</Text>
        <View style={[styles.statusBadge, { backgroundColor: '#F59E0B20' }]}>
          <Text style={[styles.statusText, { color: '#F59E0B' }]}>Pending</Text>
        </View>
      </View>

      <View style={styles.paymentDetails}>
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>User:</Text>
          <Text style={styles.paymentValue}>{withdrawal.FirstName} {withdrawal.LastName}</Text>
        </View>
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Email:</Text>
          <Text style={styles.paymentValue}>{withdrawal.Email || '-'}</Text>
        </View>
        {withdrawal.UpiId ? (
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>UPI ID:</Text>
            <Text style={[styles.paymentValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
              {withdrawal.UpiId}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Bank A/C:</Text>
              <Text style={[styles.paymentValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                {withdrawal.BankAccountNumber}
              </Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>IFSC:</Text>
              <Text style={styles.paymentValue}>{withdrawal.BankIFSC}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Account Name:</Text>
              <Text style={styles.paymentValue}>{withdrawal.BankAccountName}</Text>
            </View>
          </>
        )}
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Requested:</Text>
          <Text style={styles.paymentValue}>{formatDateTime(withdrawal.RequestedAt)}</Text>
        </View>
      </View>

      <View style={styles.paymentActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleApproveWithdrawal(withdrawal)}
          disabled={processingWithdrawal === withdrawal.WithdrawalID}
        >
          {processingWithdrawal === withdrawal.WithdrawalID ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleRejectWithdrawal(withdrawal)}
          disabled={processingWithdrawal === withdrawal.WithdrawalID}
        >
          <Ionicons name="close-circle" size={18} color="#FFF" />
          <Text style={styles.actionButtonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Completed payments (approved + rejected, sorted by time desc)
  const completedPayments = allPayments.filter(p => p.status !== 'Pending').sort((a, b) => new Date(b.reviewedAt || b.createdAt) - new Date(a.reviewedAt || a.createdAt));

  const tabs = [
    { key: 'withdrawals', label: `Withdrawals`, icon: 'wallet' },
    { key: 'payments', label: `Payments`, icon: 'card' },
  ];

  const subTabs = [
    { key: 'pending', label: `Pending (${activeTab === 'withdrawals' ? pendingWithdrawals.length : pendingPayments.length})` },
    { key: 'completed', label: `Completed (${activeTab === 'withdrawals' ? completedWithdrawals.length : completedPayments.length})` },
  ];

  return (
    <View style={styles.container}>
      {/* Main Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => { setActiveTab(tab.key); setSubTab('pending'); }}
          >
            <Ionicons 
              name={tab.icon} 
              size={18} 
              color={activeTab === tab.key ? colors.primary : colors.textSecondary} 
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sub Tabs */}
      <View style={[styles.tabsContainer, { borderBottomWidth: 0, paddingTop: 0 }]}>
        {subTabs.map(st => (
          <TouchableOpacity
            key={st.key}
            style={[styles.tab, { paddingVertical: 8 }, subTab === st.key && { borderBottomWidth: 2, borderBottomColor: subTab === st.key && st.key === 'pending' ? '#F59E0B' : '#10B981' }]}
            onPress={() => setSubTab(st.key)}
          >
            <Text style={[styles.tabText, subTab === st.key && { color: subTab === st.key && st.key === 'pending' ? '#F59E0B' : '#10B981', fontWeight: '700' }]}>
              {st.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Withdrawals - Pending */}
        {activeTab === 'withdrawals' && subTab === 'pending' && (
          <>
            {pendingWithdrawals.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-done-circle" size={64} color={colors.success} />
                <Text style={styles.emptyTitle}>All Caught Up!</Text>
                <Text style={styles.emptyText}>No pending withdrawal requests.</Text>
              </View>
            ) : (
              <View style={styles.cardsGrid}>
                {pendingWithdrawals.map(withdrawal => renderWithdrawalCard(withdrawal))}
              </View>
            )}
          </>
        )}

        {/* Withdrawals - Completed */}
        {activeTab === 'withdrawals' && subTab === 'completed' && (
          <>
            {completedWithdrawals.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
                <Text style={styles.emptyTitle}>No History</Text>
                <Text style={styles.emptyText}>No completed withdrawals yet.</Text>
              </View>
            ) : (
              <View style={styles.cardsGrid}>
                {completedWithdrawals.map(w => (
                  <View key={w.WithdrawalID} style={styles.paymentCard}>
                    <View style={styles.paymentHeader}>
                      <Text style={styles.paymentAmount}>₹{w.Amount}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: (w.Status === 'Completed' ? '#10B981' : '#EF4444') + '20' }]}>
                        <Text style={[styles.statusText, { color: w.Status === 'Completed' ? '#10B981' : '#EF4444' }]}>{w.Status}</Text>
                      </View>
                    </View>
                    <View style={styles.paymentDetails}>
                      <View style={styles.paymentRow}><Text style={styles.paymentLabel}>User:</Text><Text style={styles.paymentValue}>{w.FirstName} {w.LastName}</Text></View>
                      <View style={styles.paymentRow}><Text style={styles.paymentLabel}>Email:</Text><Text style={styles.paymentValue}>{w.Email || '-'}</Text></View>
                      {w.UpiId && <View style={styles.paymentRow}><Text style={styles.paymentLabel}>UPI:</Text><Text style={styles.paymentValue}>{w.UpiId}</Text></View>}
                      {w.PaymentReference && <View style={styles.paymentRow}><Text style={styles.paymentLabel}>Ref:</Text><Text style={styles.paymentValue}>{w.PaymentReference}</Text></View>}
                      {w.RejectionReason && <View style={styles.paymentRow}><Text style={[styles.paymentLabel, {color:'#EF4444'}]}>Reason:</Text><Text style={[styles.paymentValue, {color:'#EF4444'}]}>{w.RejectionReason}</Text></View>}
                      <View style={styles.paymentRow}><Text style={styles.paymentLabel}>Date:</Text><Text style={styles.paymentValue}>{formatDateTime(w.ProcessedAt || w.RequestedAt)}</Text></View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Payments - Pending */}
        {activeTab === 'payments' && subTab === 'pending' && (
          <>
            {pendingPayments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-done-circle" size={64} color={colors.success} />
                <Text style={styles.emptyTitle}>All Caught Up!</Text>
                <Text style={styles.emptyText}>No pending payment approvals.</Text>
              </View>
            ) : (
              <View style={styles.cardsGrid}>
                {pendingPayments.map(payment => renderPaymentCard(payment, true))}
              </View>
            )}
          </>
        )}

        {/* Payments - Completed */}
        {activeTab === 'payments' && subTab === 'completed' && (
          <>
            {completedPayments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
                <Text style={styles.emptyTitle}>No History</Text>
                <Text style={styles.emptyText}>No completed payments yet.</Text>
              </View>
            ) : (
              <View style={styles.cardsGrid}>
                {completedPayments.map(payment => renderPaymentCard(payment, false))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Rejection Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelReject}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="close-circle" size={40} color={colors.error} />
              <Text style={styles.modalTitle}>Reject Payment</Text>
            </View>
            
            <Text style={styles.modalLabel}>Reason for rejection:</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter reason (e.g., Invalid reference number, Payment not received...)"
              placeholderTextColor={colors.textSecondary}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={cancelReject}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalRejectButton]}
                onPress={confirmReject}
              >
                <Ionicons name="close-circle" size={18} color="#FFF" />
                <Text style={styles.modalRejectText}>Reject Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Withdrawal Modal */}
      <Modal
        visible={withdrawalModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelWithdrawalModal}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons 
                name={withdrawalAction === 'approve' ? 'checkmark-circle' : 'close-circle'} 
                size={40} 
                color={withdrawalAction === 'approve' ? colors.success : colors.error} 
              />
              <Text style={styles.modalTitle}>
                {withdrawalAction === 'approve' ? 'Approve Withdrawal' : 'Reject Withdrawal'}
              </Text>
            </View>

            {selectedWithdrawal && (
              <View style={styles.withdrawalSummary}>
                <Text style={styles.withdrawalAmount}>₹{selectedWithdrawal.Amount}</Text>
                <Text style={styles.withdrawalUser}>
                  {selectedWithdrawal.FirstName} {selectedWithdrawal.LastName}
                </Text>
                <Text style={styles.withdrawalDestination}>
                  {selectedWithdrawal.UpiId 
                    ? `UPI: ${selectedWithdrawal.UpiId}`
                    : `Bank: ${selectedWithdrawal.BankAccountNumber}`
                  }
                </Text>
              </View>
            )}
            
            {withdrawalAction === 'approve' ? (
              <>
                <Text style={styles.modalLabel}>Payment Reference / Transaction ID:</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter UTR/Transaction ID from bank transfer"
                  placeholderTextColor={colors.textSecondary}
                  value={paymentReference}
                  onChangeText={setPaymentReference}
                  autoFocus
                />
              </>
            ) : (
              <>
                <Text style={styles.modalLabel}>Reason for rejection:</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter reason (e.g., Invalid bank details, KYC required...)"
                  placeholderTextColor={colors.textSecondary}
                  value={withdrawalRejectionReason}
                  onChangeText={setWithdrawalRejectionReason}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  autoFocus
                />
              </>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={cancelWithdrawalModal}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  withdrawalAction === 'approve' ? styles.approveButton : styles.modalRejectButton
                ]}
                onPress={confirmWithdrawalAction}
              >
                <Ionicons 
                  name={withdrawalAction === 'approve' ? 'checkmark-circle' : 'close-circle'} 
                  size={18} 
                  color="#FFF" 
                />
                <Text style={styles.modalRejectText}>
                  {withdrawalAction === 'approve' ? 'Approve & Deduct Balance' : 'Reject Withdrawal'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (colors, responsive) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.error,
    marginTop: 16,
  },
  accessDeniedText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    ...(responsive.isDesktop && {
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  cardsGrid: {
    ...(responsive.isDesktop && {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      justifyContent: 'flex-start',
    }),
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  paymentCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...(responsive.isDesktop && {
      width: 'calc(50% - 8px)',
      minWidth: 400,
      maxWidth: 580,
    }),
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paymentAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paymentDetails: {
    gap: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paymentLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  paymentValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  paymentActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 12,
  },
  modalLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  modalCancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalRejectButton: {
    backgroundColor: '#EF4444',
  },
  modalCancelText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  modalRejectText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  // Withdrawal summary styles
  withdrawalSummary: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  withdrawalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  withdrawalUser: {
    fontSize: 16,
    color: colors.text,
    marginTop: 4,
  },
  withdrawalDestination: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
