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
import { showToast } from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import refopenAPI from '../../services/api';
import { colors as brandColors } from '../../styles/theme';
import SubScreenHeader from '../../components/SubScreenHeader';

// Status configurations
const STATUS_CONFIG = {
  Open: { color: brandColors.primary, bg: '#EFF6FF', label: 'Open', icon: 'mail-unread' },
  InProgress: { color: '#F59E0B', bg: '#FFFBEB', label: 'In Progress', icon: 'time' },
  Resolved: { color: '#10B981', bg: '#ECFDF5', label: 'Resolved', icon: 'checkmark-circle' },
  Closed: { color: '#6B7280', bg: '#F3F4F6', label: 'Closed', icon: 'close-circle' },
};

const PRIORITY_CONFIG = {
  Low: { color: '#6B7280', bg: '#F3F4F6', label: 'Low' },
  Medium: { color: brandColors.primary, bg: '#EFF6FF', label: 'Medium' },
  High: { color: '#F59E0B', bg: '#FFFBEB', label: 'High' },
  Urgent: { color: '#DC2626', bg: '#FEE2E2', label: 'Urgent' },
};

const CATEGORY_ICONS = {
  Technical: 'bug-outline',
  Payment: 'card-outline',
  Account: 'person-outline',
  Referrals: 'people-outline',
  Jobs: 'briefcase-outline',
  Employer: 'business-outline',
  Other: 'help-circle-outline',
  General: 'chatbubble-outline',
};

export default function AdminSupportScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { isAdmin } = useAuth();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [totalTickets, setTotalTickets] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Response modal
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [updating, setUpdating] = useState(false);
  const [refunding, setRefunding] = useState(false);

  // Conversation state
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Detail modal
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailTicket, setDetailTicket] = useState(null);

  const loadTickets = useCallback(async () => {
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const response = await refopenAPI.getAdminSupportTickets(params);
      if (response.success) {
        setTickets(response.data?.tickets || []);
        setTotalTickets(response.data?.total || 0);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
    }
  }, [page, statusFilter, categoryFilter, priorityFilter]);

  const loadStats = useCallback(async () => {
    try {
      const response = await refopenAPI.getSupportTicketStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadTickets(), loadStats()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadTickets, loadStats]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, loadData]);

  useEffect(() => {
    if (isAdmin && !loading) {
      loadTickets();
    }
  }, [statusFilter, categoryFilter, priorityFilter, page]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const openResponseModal = async (ticket) => {
    setSelectedTicket(ticket);
    setAdminResponse('');
    setNewStatus(ticket.Status);
    setNewPriority(ticket.Priority);
    setResponseModalVisible(true);
    
    // Load conversation messages
    await loadMessages(ticket.TicketID);
  };

  const loadMessages = async (ticketId) => {
    try {
      setLoadingMessages(true);
      const result = await refopenAPI.getSupportTicketMessages(ticketId);
      if (result.success) {
        setMessages(result.data || []);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const closeResponseModal = () => {
    setResponseModalVisible(false);
    setSelectedTicket(null);
    setAdminResponse('');
    setNewStatus('');
    setNewPriority('');
    setMessages([]);
  };

  const openDetailModal = async (ticket) => {
    setDetailTicket(ticket);
    setDetailModalVisible(true);
    await loadMessages(ticket.TicketID);
  };

  const closeDetailModal = () => {
    setDetailModalVisible(false);
    setDetailTicket(null);
    setMessages([]);
  };

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;

    try {
      setUpdating(true);
      
      // If there's a new message, send it via messages API
      if (adminResponse.trim()) {
        const messageResult = await refopenAPI.sendSupportTicketMessage(
          selectedTicket.TicketID, 
          adminResponse.trim()
        );
        if (!messageResult.success) {
          showToast('Failed to send message. Please try again.', 'error');
          return;
        }
      }
      
      // Update status/priority if changed
      const updateData = {};
      if (newStatus && newStatus !== selectedTicket.Status) {
        updateData.status = newStatus;
      }
      if (newPriority && newPriority !== selectedTicket.Priority) {
        updateData.priority = newPriority;
      }

      if (Object.keys(updateData).length > 0) {
        const response = await refopenAPI.updateSupportTicket(selectedTicket.TicketID, updateData);
        if (!response.success) {
          showToast('Failed to update ticket. Please try again.', 'error');
          return;
        }
      }
      
      if (adminResponse.trim() || Object.keys(updateData).length > 0) {
        showToast('Ticket updated successfully', 'success');
        closeResponseModal();
        loadData();
      } else {
        showToast('No changes to update', 'info');
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
      showToast('Something went wrong', 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Extract referral request ID from ticket message (for Referral Dispute tickets)
  const extractRequestId = (ticket) => {
    if (!ticket?.Message) return null;
    const match = ticket.Message.match(/Referral Request ID:\s*([A-Fa-f0-9-]{36})/);
    return match ? match[1] : null;
  };

  const isReferralDispute = (ticket) => {
    return ticket?.Category === 'Referrals' && ticket?.Subject?.includes('Referral Dispute');
  };

  const handleRefundReferral = async () => {
    const requestId = extractRequestId(selectedTicket);
    if (!requestId) {
      showToast('Could not find referral request ID in ticket', 'error');
      return;
    }

    try {
      setRefunding(true);
      const result = await refopenAPI.refundReferral(requestId);
      if (result.success) {
        showToast(`✅ ${result.message || 'Refund processed'}`, 'success');
        // Auto-send a message about the refund
        await refopenAPI.sendSupportTicketMessage(
          selectedTicket.TicketID,
          `Refund of ₹${result.data?.refundAmount || ''} has been processed to your wallet. The referral has been marked as Refunded.`
        );
        closeResponseModal();
        loadData();
      } else {
        showToast(result.error || 'Failed to process refund', 'error');
      }
    } catch (error) {
      console.error('Refund error:', error);
      showToast('Failed to process refund', 'error');
    } finally {
      setRefunding(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStats = () => {
    if (!stats) return null;

    // Use theme-aware colors for stat cards
    const statCardBg = isDark ? colors.surface : colors.gray100;
    const statLabelColor = colors.textSecondary;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: isDark ? '#1E3A5F' : '#EFF6FF' }]}>
            <Ionicons name="mail-unread" size={24} color={colors.info} />
            <Text style={[styles.statNumber, { color: colors.info }]}>{stats.OpenTickets || 0}</Text>
            <Text style={[styles.statLabel, { color: statLabelColor }]}>Open</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? '#422006' : '#FFFBEB' }]}>
            <Ionicons name="time" size={24} color={colors.warning} />
            <Text style={[styles.statNumber, { color: colors.warning }]}>{stats.InProgressTickets || 0}</Text>
            <Text style={[styles.statLabel, { color: statLabelColor }]}>In Progress</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={[styles.statNumber, { color: colors.success }]}>{stats.ResolvedTickets || 0}</Text>
            <Text style={[styles.statLabel, { color: statLabelColor }]}>Resolved</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: isDark ? '#450A0A' : '#FEE2E2' }]}>
            <Ionicons name="alert-circle" size={24} color={colors.error} />
            <Text style={[styles.statNumber, { color: colors.error }]}>{stats.UrgentPending || 0}</Text>
            <Text style={[styles.statLabel, { color: statLabelColor }]}>Urgent</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: statCardBg }]}>
            <Ionicons name="today" size={24} color={colors.textSecondary} />
            <Text style={[styles.statNumber, { color: colors.text }]}>{stats.Last24Hours || 0}</Text>
            <Text style={[styles.statLabel, { color: statLabelColor }]}>Last 24h</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: statCardBg }]}>
            <Ionicons name="documents" size={24} color={colors.primary} />
            <Text style={[styles.statNumber, { color: colors.primary }]}>{stats.TotalTickets || 0}</Text>
            <Text style={[styles.statLabel, { color: statLabelColor }]}>Total</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {/* Status Filter */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Status:</Text>
          <TouchableOpacity
            style={[styles.filterChip, !statusFilter && styles.filterChipActive]}
            onPress={() => setStatusFilter('')}
          >
            <Text style={[styles.filterChipText, !statusFilter && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {Object.keys(STATUS_CONFIG).map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
              onPress={() => setStatusFilter(statusFilter === status ? '' : status)}
            >
              <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
                {STATUS_CONFIG[status].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
        {/* Priority Filter */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Priority:</Text>
          <TouchableOpacity
            style={[styles.filterChip, !priorityFilter && styles.filterChipActive]}
            onPress={() => setPriorityFilter('')}
          >
            <Text style={[styles.filterChipText, !priorityFilter && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {Object.keys(PRIORITY_CONFIG).map((priority) => (
            <TouchableOpacity
              key={priority}
              style={[styles.filterChip, priorityFilter === priority && styles.filterChipActive]}
              onPress={() => setPriorityFilter(priorityFilter === priority ? '' : priority)}
            >
              <Text style={[styles.filterChipText, priorityFilter === priority && styles.filterChipTextActive]}>
                {PRIORITY_CONFIG[priority].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderTicketCard = (ticket) => {
    const statusConfig = STATUS_CONFIG[ticket.Status] || STATUS_CONFIG.Open;
    const priorityConfig = PRIORITY_CONFIG[ticket.Priority] || PRIORITY_CONFIG.Medium;
    const categoryIcon = CATEGORY_ICONS[ticket.Category] || 'help-circle-outline';

    return (
      <TouchableOpacity
        key={ticket.TicketID}
        style={styles.ticketCard}
        onPress={() => openResponseModal(ticket)}
      >
        <View style={styles.ticketHeader}>
          <View style={styles.ticketHeaderLeft}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Ionicons name={statusConfig.icon} size={14} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
            <View style={[styles.priorityBadge, { backgroundColor: priorityConfig.bg }]}>
              <Text style={[styles.priorityText, { color: priorityConfig.color }]}>{priorityConfig.label}</Text>
            </View>
          </View>
          <Text style={styles.ticketId}>#{ticket.TicketID?.slice(0, 8)}</Text>
        </View>

        <View style={styles.categoryRow}>
          <Ionicons name={categoryIcon} size={16} color={colors.textSecondary} />
          <Text style={styles.categoryText}>{ticket.Category}</Text>
        </View>

        <Text style={styles.ticketSubject} numberOfLines={2}>{ticket.Subject}</Text>
        
        <Text style={styles.ticketMessage} numberOfLines={2}>{ticket.Message}</Text>

        <View style={styles.ticketFooter}>
          <View style={styles.userInfo}>
            <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.userName}>{ticket.UserName || 'User'}</Text>
          </View>
          <Text style={styles.ticketDate}>{formatDate(ticket.CreatedAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderResponseModal = () => (
    <Modal
      visible={responseModalVisible}
      transparent
      animationType="slide"
      onRequestClose={closeResponseModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Respond to Ticket</Text>
            <TouchableOpacity onPress={closeResponseModal}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {selectedTicket && (
            <ScrollView style={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubject}>{selectedTicket.Subject}</Text>
              <Text style={styles.modalUserInfo}>
                From: {selectedTicket.UserName} ({selectedTicket.UserEmail})
              </Text>

              {/* Conversation Thread */}
              <Text style={styles.modalLabel}>Conversation</Text>
              {loadingMessages ? (
                <View style={styles.loadingMessagesBox}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingMessagesText}>Loading conversation...</Text>
                </View>
              ) : (
                <View style={styles.conversationContainer}>
                  {/* Original message */}
                  <View style={[styles.conversationMessage, styles.userMessageBubble]}>
                    <View style={styles.messageSenderRow}>
                      <Ionicons name="person" size={14} color={colors.textSecondary} />
                      <Text style={styles.messageSender}>{selectedTicket.UserName}</Text>
                      <Text style={styles.messageTime}>{formatDate(selectedTicket.CreatedAt)}</Text>
                    </View>
                    <Text style={styles.conversationText}>{selectedTicket.Message}</Text>
                  </View>
                  
                  {/* Subsequent messages */}
                  {messages.map((msg, index) => (
                    <View 
                      key={msg.MessageID || index} 
                      style={[
                        styles.conversationMessage,
                        msg.SenderType === 'Admin' ? styles.adminMessageBubble : styles.userMessageBubble
                      ]}
                    >
                      <View style={styles.messageSenderRow}>
                        <Ionicons 
                          name={msg.SenderType === 'Admin' ? 'shield-checkmark' : 'person'} 
                          size={14} 
                          color={msg.SenderType === 'Admin' ? colors.primary : colors.textSecondary} 
                        />
                        <Text style={[
                          styles.messageSender,
                          msg.SenderType === 'Admin' && { color: colors.primary }
                        ]}>
                          {msg.SenderType === 'Admin' ? (msg.SenderName || 'Platform Admin') : selectedTicket.UserName}
                        </Text>
                        <Text style={styles.messageTime}>{formatDate(msg.CreatedAt)}</Text>
                      </View>
                      <Text style={styles.conversationText}>{msg.Message}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Status Selection */}
              <Text style={styles.modalLabel}>Update Status</Text>
              <View style={styles.statusOptions}>
                {Object.keys(STATUS_CONFIG).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      newStatus === status && { backgroundColor: STATUS_CONFIG[status].bg, borderColor: STATUS_CONFIG[status].color },
                    ]}
                    onPress={() => setNewStatus(status)}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      newStatus === status && { color: STATUS_CONFIG[status].color },
                    ]}>
                      {STATUS_CONFIG[status].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Priority Selection */}
              <Text style={styles.modalLabel}>Update Priority</Text>
              <View style={styles.statusOptions}>
                {Object.keys(PRIORITY_CONFIG).map((priority) => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.statusOption,
                      newPriority === priority && { backgroundColor: PRIORITY_CONFIG[priority].bg, borderColor: PRIORITY_CONFIG[priority].color },
                    ]}
                    onPress={() => setNewPriority(priority)}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      newPriority === priority && { color: PRIORITY_CONFIG[priority].color },
                    ]}>
                      {PRIORITY_CONFIG[priority].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Response Input */}
              {selectedTicket.Status !== 'Closed' && (
                <>
                  <Text style={styles.modalLabel}>Send Reply</Text>
                  <TextInput
                    style={styles.responseInput}
                    placeholder="Type your reply to the user..."
                    placeholderTextColor={colors.textSecondary}
                    value={adminResponse}
                    onChangeText={setAdminResponse}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </>
              )}

              {selectedTicket.Status === 'Closed' && (
                <View style={styles.closedBanner}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.closedBannerText}>This ticket is closed</Text>
                </View>
              )}

              {/* Refund Button - Only for Referral Dispute tickets */}
              {isReferralDispute(selectedTicket) && selectedTicket.Status !== 'Closed' && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#EF444415',
                    borderWidth: 1,
                    borderColor: '#EF4444',
                    borderRadius: 10,
                    padding: 12,
                    marginTop: 12,
                    opacity: refunding ? 0.6 : 1,
                  }}
                  onPress={handleRefundReferral}
                  disabled={refunding}
                >
                  {refunding ? (
                    <ActivityIndicator color="#EF4444" size="small" />
                  ) : (
                    <>
                      <Ionicons name="wallet-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 14 }}>
                        Refund Seeker & Mark as Refunded
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={closeResponseModal}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.submitButton, updating && { opacity: 0.6 }]}
                  onPress={handleUpdateTicket}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>Update Ticket</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const renderDetailModal = () => {
    if (!detailTicket) return null;
    const statusConfig = STATUS_CONFIG[detailTicket.Status] || STATUS_CONFIG.Open;
    const priorityConfig = PRIORITY_CONFIG[detailTicket.Priority] || PRIORITY_CONFIG.Medium;

    return (
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeDetailModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ticket Details</Text>
              <TouchableOpacity onPress={closeDetailModal}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.detailRow}>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                  <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: priorityConfig.bg }]}>
                  <Text style={[styles.priorityText, { color: priorityConfig.color }]}>{priorityConfig.label}</Text>
                </View>
              </View>

              <Text style={styles.detailLabel}>Ticket ID</Text>
              <Text style={styles.detailValue}>{detailTicket.TicketID}</Text>

              <Text style={styles.detailLabel}>Category</Text>
              <Text style={styles.detailValue}>{detailTicket.Category}</Text>

              <Text style={styles.detailLabel}>Subject</Text>
              <Text style={styles.detailValue}>{detailTicket.Subject}</Text>

              <Text style={styles.detailLabel}>User</Text>
              <Text style={styles.detailValue}>{detailTicket.UserName} ({detailTicket.UserEmail})</Text>

              <Text style={styles.detailLabel}>Created</Text>
              <Text style={styles.detailValue}>{formatDate(detailTicket.CreatedAt)}</Text>

              {/* Conversation Thread */}
              <Text style={[styles.detailLabel, { marginTop: 16 }]}>Conversation</Text>
              {loadingMessages ? (
                <View style={styles.loadingMessagesBox}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingMessagesText}>Loading conversation...</Text>
                </View>
              ) : (
                <View style={styles.conversationContainer}>
                  {/* Original message */}
                  <View style={[styles.conversationMessage, styles.userMessageBubble]}>
                    <View style={styles.messageSenderRow}>
                      <Ionicons name="person" size={14} color={colors.textSecondary} />
                      <Text style={styles.messageSender}>{detailTicket.UserName}</Text>
                      <Text style={styles.messageTime}>{formatDate(detailTicket.CreatedAt)}</Text>
                    </View>
                    <Text style={styles.conversationText}>{detailTicket.Message}</Text>
                  </View>
                  
                  {/* Subsequent messages */}
                  {messages.map((msg, index) => (
                    <View 
                      key={msg.MessageID || index} 
                      style={[
                        styles.conversationMessage,
                        msg.SenderType === 'Admin' ? styles.adminMessageBubble : styles.userMessageBubble
                      ]}
                    >
                      <View style={styles.messageSenderRow}>
                        <Ionicons 
                          name={msg.SenderType === 'Admin' ? 'shield-checkmark' : 'person'} 
                          size={14} 
                          color={msg.SenderType === 'Admin' ? colors.primary : colors.textSecondary} 
                        />
                        <Text style={[
                          styles.messageSender,
                          msg.SenderType === 'Admin' && { color: colors.primary }
                        ]}>
                          {msg.SenderType === 'Admin' ? (msg.SenderName || 'Platform Admin') : detailTicket.UserName}
                        </Text>
                        <Text style={styles.messageTime}>{formatDate(msg.CreatedAt)}</Text>
                      </View>
                      <Text style={styles.conversationText}>{msg.Message}</Text>
                    </View>
                  ))}
                </View>
              )}

              {detailTicket.ResolvedAt && (
                <>
                  <Text style={styles.detailLabel}>Resolved At</Text>
                  <Text style={styles.detailValue}>{formatDate(detailTicket.ResolvedAt)}</Text>
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalButton, styles.submitButton, { marginTop: 16 }]}
              onPress={() => {
                closeDetailModal();
                openResponseModal(detailTicket);
              }}
            >
              <Ionicons name="chatbubble-ellipses" size={18} color={colors.white} />
              <Text style={styles.submitButtonText}>
                {detailTicket.AdminResponse ? 'Update Response' : 'Respond'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>Access Denied</Text>
          <Text style={styles.emptyText}>You need admin privileges to view this page.</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading support tickets...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Support Tickets" fallbackTab="ActionCenter" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {renderStats()}
        {renderFilters()}

        <View style={styles.ticketsHeader}>
          <Text style={styles.ticketsTitle}>
            {statusFilter || priorityFilter ? 'Filtered Tickets' : 'All Tickets'} ({tickets.length})
          </Text>
        </View>

        {tickets.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Tickets Found</Text>
            <Text style={styles.emptyText}>
              {statusFilter || priorityFilter
                ? 'No tickets match your filters. Try adjusting them.'
                : 'No support tickets yet.'}
            </Text>
          </View>
        ) : (
          <View style={styles.ticketsList}>
            {tickets.map(renderTicketCard)}
          </View>
        )}
      </ScrollView>

      {renderResponseModal()}
      {renderDetailModal()}
    </View>
  );
}

const createStyles = (colors, responsive = {}) => {
  const { isDesktop, isTablet, contentWidth } = responsive;
  const maxWidth = isDesktop ? 1200 : isTablet ? 900 : '100%';
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: isDesktop ? 24 : 16,
    paddingBottom: 100,
    maxWidth: maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },

  // Stats
  statsContainer: {
    marginBottom: isDesktop ? 24 : 16,
    gap: isDesktop ? 16 : 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: isDesktop ? 16 : 10,
  },
  statCard: {
    flex: 1,
    padding: isDesktop ? 20 : 14,
    borderRadius: 12,
    alignItems: 'center',
    gap: 6,
  },
  statNumber: {
    fontSize: isDesktop ? 32 : 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: isDesktop ? 14 : 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Filters
  filtersContainer: {
    marginBottom: isDesktop ? 24 : 16,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isDesktop ? 12 : 8,
    flexWrap: isDesktop ? 'wrap' : 'nowrap',
  },
  filterLabel: {
    fontSize: isDesktop ? 14 : 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: 4,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.text,
  },
  filterChipTextActive: {
    color: colors.white,
    fontWeight: '600',
  },

  // Tickets Header
  ticketsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isDesktop ? 16 : 12,
  },
  ticketsTitle: {
    fontSize: isDesktop ? 20 : 18,
    fontWeight: '700',
    color: colors.text,
  },

  // Ticket Card
  ticketsList: {
    gap: isDesktop ? 16 : 12,
    ...(isDesktop && {
      flexDirection: 'row',
      flexWrap: 'wrap',
    }),
  },
  ticketCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: isDesktop ? 20 : 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDesktop && {
      width: '48%',
      minWidth: 400,
    }),
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ticketHeaderLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ticketId: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  ticketSubject: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
    lineHeight: 22,
  },
  ticketMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userName: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  ticketDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  respondButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
  },
  respondButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContent: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  modalUserInfo: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  responseInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingBottom: 10,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.primary,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },

  // Detail Modal
  detailRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: 12,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  adminResponseBox: {
    backgroundColor: colors.primary + '10',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  adminName: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'right',
  },
  
  // Conversation styles
  modalScrollContent: {
    flex: 1,
  },
  loadingMessagesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
    backgroundColor: colors.background,
    borderRadius: 8,
    marginBottom: 16,
  },
  loadingMessagesText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  conversationContainer: {
    gap: 12,
    marginBottom: 16,
  },
  conversationMessage: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  userMessageBubble: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    marginRight: 24,
  },
  adminMessageBubble: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary + '30',
    marginLeft: 24,
  },
  messageSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  messageTime: {
    fontSize: 10,
    color: colors.textSecondary,
    marginLeft: 'auto',
  },
  conversationText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  originalMessageBox: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.success + '15',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
  },
  closedBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
});
};
