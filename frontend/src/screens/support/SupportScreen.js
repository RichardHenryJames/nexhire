import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import refopenAPI from '../../services/api';
import { showToast } from '../../components/Toast';
import SubScreenHeader from '../../components/SubScreenHeader';

// Support categories
const CATEGORIES = [
  { id: 'Technical', label: 'Technical Issue', icon: 'bug-outline' },
  { id: 'Payment', label: 'Payment/Billing', icon: 'card-outline' },
  { id: 'Account', label: 'Account/Profile', icon: 'person-outline' },
  { id: 'Referrals', label: 'Referrals', icon: 'people-outline' },
  { id: 'Jobs', label: 'Jobs/Applications', icon: 'briefcase-outline' },
  { id: 'Other', label: 'Other', icon: 'help-circle-outline' },
];
import { colors as brandColors } from '../../styles/theme';

// Status colors and labels
const STATUS_CONFIG = {
  Open: { color: brandColors.primary, bg: '#EFF6FF', label: 'Open' },
  InProgress: { color: '#F59E0B', bg: '#FFFBEB', label: 'In Progress' },
  Resolved: { color: '#10B981', bg: '#ECFDF5', label: 'Resolved' },
  Closed: { color: '#6B7280', bg: '#F3F4F6', label: 'Closed' },
};

export default function SupportScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // State
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);

  // Form state
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load tickets when history tab is active
  useEffect(() => {
    if (activeTab === 'history') {
      loadTickets();
    }
  }, [activeTab]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const result = await refopenAPI.getMySupportTickets({ limit: 50 });
      if (result.success) {
        setTickets(result.data?.tickets || []);
      } else {
        console.error('Failed to load tickets:', result.error);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTickets();
    setRefreshing(false);
  }, []);

  // Load messages when a ticket is selected
  const loadMessages = async (ticketId) => {
    try {
      setLoadingMessages(true);
      const result = await refopenAPI.getSupportTicketMessages(ticketId);
      if (result.success) {
        setMessages(result.data || []);
      } else {
        console.error('Failed to load messages:', result.error);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Handle selecting a ticket
  const handleSelectTicket = async (ticket) => {
    setSelectedTicket(ticket);
    setReplyMessage('');
    await loadMessages(ticket.TicketID);
  };

  // Send reply message
  const handleSendReply = async () => {
    if (!replyMessage.trim()) {
      showToast('Please enter a message', 'error');
      return;
    }

    try {
      setSendingReply(true);
      const result = await refopenAPI.sendSupportTicketMessage(selectedTicket.TicketID, replyMessage.trim());
      
      if (result.success) {
        showToast('Message sent successfully', 'success');
        setReplyMessage('');
        await loadMessages(selectedTicket.TicketID);
        // Refresh ticket status
        const updatedTicket = await refopenAPI.getSupportTicketById(selectedTicket.TicketID);
        if (updatedTicket.success) {
          setSelectedTicket(updatedTicket.data);
        }
      } else {
        showToast('Failed to send message. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      showToast('Failed to send message', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  // Close ticket
  const handleCloseTicket = async () => {
    try {
      setClosingTicket(true);
      const result = await refopenAPI.closeSupportTicket(selectedTicket.TicketID);
      
      if (result.success) {
        showToast('Ticket closed successfully', 'success');
        setSelectedTicket({ ...selectedTicket, Status: 'Closed' });
        loadTickets(); // Refresh list
      } else {
        showToast('Failed to close ticket. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error closing ticket:', error);
      showToast('Failed to close ticket', 'error');
    } finally {
      setClosingTicket(false);
    }
  };

  const handleSubmit = async () => {
    // Clear previous messages
    setErrorMessage('');
    setSuccessMessage('');
    
    // Validation
    if (!category) {
      showToast('Please select a category', 'error');
      return;
    }
    if (!subject.trim() || subject.trim().length < 5) {
      showToast('Please enter a subject (at least 5 characters)', 'error');
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      showToast('Please describe your issue in detail (at least 10 characters)', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const result = await refopenAPI.createSupportTicket({
        category,
        subject: subject.trim(),
        message: message.trim(),
      });

      if (result.success) {
        showToast('Ticket submitted successfully!', 'success');
        setCategory('');
        setSubject('');
        setMessage('');
        setActiveTab('history');
      } else {
        showToast('Failed to submit ticket. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Submit ticket error:', error);
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setSubmitting(false);
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

  const renderNewTicketForm = () => (
    <View style={styles.formContainer}>
      {/* Category Selection */}
      <Text style={styles.label}>Category *</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryButton,
              category === cat.id && styles.categoryButtonActive,
            ]}
            onPress={() => setCategory(cat.id)}
          >
            <Ionicons
              name={cat.icon}
              size={20}
              color={category === cat.id ? colors.white : colors.primary}
            />
            <Text
              style={[
                styles.categoryButtonText,
                category === cat.id && styles.categoryButtonTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Subject */}
      <Text style={styles.label}>Subject *</Text>
      <TextInput
        style={styles.input}
        placeholder="Brief description of your issue"
        placeholderTextColor={colors.textSecondary}
        value={subject}
        onChangeText={setSubject}
        maxLength={200}
      />
      <Text style={styles.charCount}>{subject.length}/200</Text>

      {/* Message */}
      <Text style={styles.label}>Describe Your Issue *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Please provide as much detail as possible about your issue..."
        placeholderTextColor={colors.textSecondary}
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      {/* Error Message */}
      {errorMessage ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={20} color="#DC2626" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Success Message */}
      {successMessage ? (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : null}

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Ionicons name="send" size={20} color={colors.white} />
            <Text style={styles.submitButtonText}>Submit Ticket</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Info */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          We typically respond within 24-48 hours during business days.
        </Text>
      </View>
    </View>
  );

  const renderTicketDetails = () => {
    if (!selectedTicket) return null;
    const statusConfig = STATUS_CONFIG[selectedTicket.Status] || STATUS_CONFIG.Open;
    const isClosed = selectedTicket.Status === 'Closed';

    return (
      <View style={styles.ticketDetailsContainer}>
        <TouchableOpacity
          style={styles.backToListButton}
          onPress={() => {
            setSelectedTicket(null);
            setMessages([]);
            setReplyMessage('');
          }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backToListText}>Back to tickets</Text>
        </TouchableOpacity>

        <View style={styles.ticketDetailCard}>
          <View style={styles.ticketDetailHeader}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
            <Text style={styles.ticketId}>#{selectedTicket.TicketID?.slice(0, 8)}</Text>
          </View>

          <Text style={styles.ticketDetailSubject}>{selectedTicket.Subject}</Text>
          
          <View style={styles.ticketMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="folder-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaText}>{selectedTicket.Category}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaText}>{formatDate(selectedTicket.CreatedAt)}</Text>
            </View>
          </View>

          {/* Conversation Thread */}
          <Text style={styles.sectionLabel}>Conversation</Text>
          
          {loadingMessages ? (
            <View style={styles.loadingMessagesBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingMessagesText}>Loading messages...</Text>
            </View>
          ) : (
            <View style={styles.conversationContainer}>
              {/* Original message */}
              <View style={[styles.conversationMessage, styles.userMessage]}>
                <View style={styles.messageSenderRow}>
                  <Ionicons name="person" size={14} color={colors.textSecondary} />
                  <Text style={styles.messageSender}>You</Text>
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
                    msg.SenderType === 'Admin' ? styles.adminMessage : styles.userMessage
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
                      {msg.SenderType === 'Admin' ? 'Refopen Support' : 'You'}
                    </Text>
                    <Text style={styles.messageTime}>{formatDate(msg.CreatedAt)}</Text>
                  </View>
                  <Text style={styles.conversationText}>{msg.Message}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Reply Section - only if not closed */}
          {!isClosed && (
            <View style={styles.replySection}>
              <Text style={styles.sectionLabel}>Send a Reply</Text>
              <TextInput
                style={styles.replyInput}
                placeholder="Type your reply..."
                placeholderTextColor={colors.textSecondary}
                value={replyMessage}
                onChangeText={setReplyMessage}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[styles.sendReplyButton, sendingReply && styles.buttonDisabled]}
                onPress={handleSendReply}
                disabled={sendingReply}
              >
                {sendingReply ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color={colors.white} />
                    <Text style={styles.sendReplyText}>Send Reply</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Close Ticket Button */}
          {!isClosed && (
            <TouchableOpacity
              style={[styles.closeTicketButton, closingTicket && styles.buttonDisabled]}
              onPress={handleCloseTicket}
              disabled={closingTicket}
            >
              {closingTicket ? (
                <ActivityIndicator color={colors.error} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={18} color={colors.success} />
                  <Text style={styles.closeTicketText}>Mark as Resolved & Close</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {isClosed && (
            <View style={styles.closedBanner}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.closedBannerText}>This ticket has been closed</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderTicketHistory = () => {
    if (selectedTicket) {
      return renderTicketDetails();
    }

    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your tickets...</Text>
        </View>
      );
    }

    if (tickets.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="ticket-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Tickets Yet</Text>
          <Text style={styles.emptyText}>
            You haven't submitted any support tickets. If you need help, create a new ticket!
          </Text>
          <TouchableOpacity
            style={styles.createTicketButton}
            onPress={() => setActiveTab('new')}
          >
            <Ionicons name="add-circle" size={20} color={colors.white} />
            <Text style={styles.createTicketButtonText}>Create Ticket</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.ticketListContainer}>
        {tickets.map((ticket) => {
          const statusConfig = STATUS_CONFIG[ticket.Status] || STATUS_CONFIG.Open;
          return (
            <TouchableOpacity
              key={ticket.TicketID}
              style={styles.ticketCard}
              onPress={() => handleSelectTicket(ticket)}
            >
              <View style={styles.ticketHeader}>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                  <Text style={[styles.statusText, { color: statusConfig.color }]}>
                    {statusConfig.label}
                  </Text>
                </View>
                <Text style={styles.ticketDate}>{formatDate(ticket.CreatedAt)}</Text>
              </View>
              <Text style={styles.ticketSubject} numberOfLines={2}>
                {ticket.Subject}
              </Text>
              <View style={styles.ticketFooter}>
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>{ticket.Category}</Text>
                </View>
                {ticket.AdminResponse && (
                  <View style={styles.hasResponseBadge}>
                    <Ionicons name="chatbubble" size={12} color={colors.success} />
                    <Text style={styles.hasResponseText}>Response</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Help & Support" fallbackTab="Home" />
      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'new' && styles.tabActive]}
          onPress={() => setActiveTab('new')}
        >
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={activeTab === 'new' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>
            New Ticket
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons
            name="list-outline"
            size={20}
            color={activeTab === 'history' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            My Tickets
          </Text>
          {tickets.filter(t => t.Status === 'Open' || t.Status === 'InProgress').length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {tickets.filter(t => t.Status === 'Open' || t.Status === 'InProgress').length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          activeTab === 'history' ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          ) : undefined
        }
      >
        {activeTab === 'new' ? renderNewTicketForm() : renderTicketHistory()}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      maxWidth: 700,
      alignSelf: 'center',
      width: '100%',
    } : {}),
  },
  
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },

  // Form
  formContainer: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  categoryButtonActive: {
    backgroundColor: colors.primary,
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
  },
  categoryButtonTextActive: {
    color: colors.white,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  textArea: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: -12,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.primary + '10',
    padding: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEE2E2',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#D1FAE5',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },

  // Ticket List
  ticketListContainer: {
    gap: 12,
  },
  ticketCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ticketDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  ticketSubject: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    lineHeight: 22,
  },
  ticketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryTag: {
    backgroundColor: colors.gray100 || colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  hasResponseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    marginRight: 8,
  },
  hasResponseText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 280,
  },
  createTicketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 24,
  },
  createTicketButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },

  // Ticket Details
  ticketDetailsContainer: {
    gap: 16,
  },
  backToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  backToListText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  ticketDetailCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ticketDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ticketId: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  ticketDetailSubject: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    lineHeight: 26,
  },
  ticketMeta: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 8,
  },
  messageBox: {
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  responseBox: {
    backgroundColor: colors.primary + '08',
    borderColor: colors.primary + '30',
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  responseFrom: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  messageText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  resolvedDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 10,
    fontStyle: 'italic',
  },
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.warning + '15',
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  pendingText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  
  // Conversation styles
  loadingMessagesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 20,
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
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  userMessage: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    marginLeft: 20,
  },
  adminMessage: {
    backgroundColor: colors.primary + '08',
    borderColor: colors.primary + '30',
    marginRight: 20,
  },
  messageSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  messageSender: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  messageTime: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 'auto',
  },
  conversationText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  
  // Reply section
  replySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  sendReplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  sendReplyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  
  // Close ticket button
  closeTicketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.success + '15',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  closeTicketText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.success + '15',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 16,
  },
  closedBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
});
