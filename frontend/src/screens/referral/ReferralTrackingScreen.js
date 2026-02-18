import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import refopenAPI from '../../services/api';
import messagingApi from '../../services/messagingApi';
import { useAuth } from '../../contexts/AuthContext';
import useResponsive from '../../hooks/useResponsive';
import { useTheme } from '../../contexts/ThemeContext';
import { typography } from '../../styles/theme';
import { showToast } from '../../components/Toast';
import SubScreenHeader from '../../components/SubScreenHeader';

/**
 * ReferralTrackingScreen - Shows detailed tracking/history of a referral request
 * Beautiful timeline UI with status updates
 */
export default function ReferralTrackingScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const { requestId, request: initialRequest } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [request, setRequest] = useState(initialRequest || null);
  const [history, setHistory] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(initialRequest?.Status || 'Pending');
  const [messagingReferrer, setMessagingReferrer] = useState(false);
  const [referrerConversation, setReferrerConversation] = useState(null); // Conversation with referrer if exists
  const [referrerUserIds, setReferrerUserIds] = useState([]); // All referrers who interacted with this request
  const [messageExpanded, setMessageExpanded] = useState(false);

  // Handle messaging the referrer
  // If there are unread messages, go to Chat screen directly
  // If no unread messages, go to Conversations screen (list)
  const handleMessageReferrer = async () => {
    // Check if we have unread messages from referrer
    const hasUnread = referrerConversation?.TotalUnreadFromReferrers > 0 || referrerConversation?.UnreadCount > 0;
    
    if (hasUnread && referrerConversation) {
      // Go directly to chat with this referrer
      navigation.navigate('Chat', {
        conversationId: referrerConversation.ConversationID,
        otherUserName: referrerConversation.OtherUserName || 'Referrer',
        otherUserId: referrerConversation.OtherUserID,
        referralContext: {
          requestId: requestId,
          jobTitle: request?.JobTitle,
          companyName: request?.CompanyName,
          isReferrer: false,
        }
      });
    } else {
      // No unread - go to messages/conversations list
      navigation.navigate('Messages');
    }
  };

  // Handle back navigation - go to MyReferralRequests if context lost
  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Context lost (hard refresh), navigate to my requests
      navigation.reset({
        index: 0,
        routes: [
          { name: 'MainTabs' },
          { name: 'MyReferralRequests' },
        ],
      });
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (requestId) {
        loadHistory();
      }
    }, [requestId])
  );

  // Check if there are conversations with any referrers who have unread messages
  const checkReferrerConversations = async (referrerIds) => {
    if (!referrerIds || referrerIds.length === 0) {
      setReferrerConversation(null);
      return;
    }

    try {
      const result = await messagingApi.getMyConversations(1, 100);
      
      // Handle both possible response structures
      const conversations = result.data?.conversations || result.data || [];
      
      if (result.success && conversations.length > 0) {
        // Find conversations with any of the referrers (case-insensitive comparison)
        const referrerConvs = conversations.filter(c => {
          const match = referrerIds.some(rid => 
            rid && c.OtherUserID && 
            rid.toLowerCase() === c.OtherUserID.toLowerCase()
          );
          return match;
        });
        
        // Calculate total unread count from all referrer conversations
        let totalUnread = 0;
        let bestConv = null;
        
        for (const conv of referrerConvs) {
          if (conv.LastMessageAt) {
            totalUnread += conv.UnreadCount || 0;
            // Use the conversation with most recent message or unread messages
            if (!bestConv || conv.UnreadCount > 0 || conv.LastMessageAt > bestConv.LastMessageAt) {
              bestConv = conv;
            }
          }
        }
        
        if (bestConv) {
          // Store the best conversation with total unread count
          setReferrerConversation({
            ...bestConv,
            TotalUnreadFromReferrers: totalUnread
          });
        } else {
          setReferrerConversation(null);
        }
      }
    } catch (error) {
      console.error('Error checking referrer conversations:', error);
    }
  };

  const loadHistory = async () => {
    if (!requestId) return;

    setLoading(true);
    try {
      const result = await refopenAPI.getReferralStatusHistory(requestId);
      if (result.success && result.data) {
        setHistory(result.data.history || []);
        setCurrentStatus(result.data.currentStatus || request?.Status || 'Pending');
        
        // Update request data from API (fixes hard refresh issue)
        if (result.data.request) {
          setRequest(prev => ({
            ...prev,
            ...result.data.request,
          }));
        }
        
        // Get referrer IDs - use from history first, fallback to AssignedReferrerUserID
        let referrerIds = result.data.referrerUserIds || [];
        
        // Fallback: if no referrerIds but we have AssignedReferrerUserID, use that
        if (referrerIds.length === 0 && result.data.request?.AssignedReferrerUserID) {
          referrerIds = [result.data.request.AssignedReferrerUserID];
        }
        
        setReferrerUserIds(referrerIds);
        
        // Check conversations with these referrers
        if (referrerIds.length > 0) {
          checkReferrerConversations(referrerIds);
        }
      }
    } catch (error) {
      console.error('Error loading referral history:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
    return `${date.toLocaleDateString('en-US', dateOptions)} at ${date.toLocaleTimeString('en-US', timeOptions)}`;
  };

  const getStatusConfig = (status) => {
    const configs = {
      'Pending': {
        color: colors.gray500,
        icon: 'time-outline',
        label: 'Request Created',
        description: 'Your referral request has been submitted',
      },
      'NotifiedToReferrers': {
        color: colors.primary,
        icon: 'notifications-outline',
        label: 'Visible to Referrers',
        description: 'Your request is now live and visible to referrers',
      },
      'Viewed': {
        color: colors.primary,
        icon: 'eye-outline',
        label: 'Viewed by Referrer',
        description: 'A referrer has viewed your request',
      },
      'Claimed': {
        color: '#F59E0B',
        icon: 'hand-left-outline',
        label: 'Claimed by Referrer',
        description: 'A referrer is working on your referral',
      },
      'ProofUploaded': {
        color: '#8B5CF6',
        icon: 'document-attach-outline',
        label: 'Proof Submitted',
        description: 'Referrer has submitted proof of referral',
      },
      'Completed': {
        color: colors.success,
        icon: 'checkmark-circle',
        label: 'Referral Completed',
        description: 'Your referral has been completed',
      },
      'Verified': {
        color: '#FFD700',
        icon: 'trophy',
        label: 'Verified',
        description: 'You have verified the referral',
      },
      'Cancelled': {
        color: colors.danger,
        icon: 'close-circle',
        label: 'Cancelled',
        description: 'This referral request was cancelled',
      },
    };
    return configs[status] || configs['Pending'];
  };

  const handleOpenJobLink = () => {
    const jobUrl = request?.JobURL || request?.ExternalLogoURL;
    if (jobUrl) {
      Linking.openURL(jobUrl);
    }
  };

  const renderHeader = () => {
    if (!request) return null;

    const statusConfig = getStatusConfig(currentStatus);

    return (
      <View style={styles.headerCard}>
        {/* Job Info */}
        <View style={styles.jobSection}>
          <View style={styles.logoContainer}>
            {request.OpenToAnyCompany ? (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="globe-outline" size={28} color={colors.primary} />
              </View>
            ) : request.OrganizationLogo ? (
              <Image
                source={{ uri: request.OrganizationLogo }}
                style={styles.companyLogo}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="business-outline" size={28} color={colors.gray500} />
              </View>
            )}
          </View>
          <View style={styles.jobInfo}>
            <Text style={styles.jobTitle} numberOfLines={2}>
              {request.JobTitle || 'Job Title'}
            </Text>
            <Text style={styles.companyName}>
              {request.OpenToAnyCompany ? 'Any Company' : (request.CompanyName || 'Company')}
            </Text>
            {request.OpenToAnyCompany && request.MinSalary ? (
              <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                {request.SalaryCurrency === 'USD' ? '$' : '₹'}{request.MinSalary?.toLocaleString()}{request.SalaryPeriod === 'Annual' ? '/yr' : '/mo'} min
              </Text>
            ) : null}
            {request.JobURL && (
              <TouchableOpacity 
                style={styles.linkButton}
                onPress={handleOpenJobLink}
              >
                <Ionicons name="open-outline" size={14} color={colors.primary} />
                <Text style={styles.linkText}>View Job</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Current Status Badge */}
        <View style={[styles.currentStatusBadge, { backgroundColor: statusConfig.color + '20' }]}>
          <Ionicons name={statusConfig.icon} size={20} color={statusConfig.color} />
          <View style={styles.statusInfo}>
            <Text style={[styles.currentStatusLabel, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
            <Text style={styles.currentStatusDesc}>
              {statusConfig.description}
            </Text>
          </View>
        </View>

        {/* Seeker Message - collapsible */}
        {request.ReferralMessage ? (
          <TouchableOpacity
            style={styles.seekerMessageRow}
            onPress={() => setMessageExpanded(prev => !prev)}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.gray400} style={{ marginRight: 6, marginTop: 1 }} />
            <Text
              style={styles.seekerMessageText}
              numberOfLines={messageExpanded ? undefined : 1}
            >
              {request.ReferralMessage}
            </Text>
            {request.ReferralMessage.length > 50 && (
              <Text style={styles.seekerMessageToggle}>
                {messageExpanded ? 'less' : 'more'}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}

        {/* Request Date */}
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.gray500} />
          <Text style={styles.dateText}>
            Requested on {formatDate(request.RequestedAt)}
          </Text>
        </View>

        {/* Message Referrer Button - Only show when referrer has messaged */}
        {referrerConversation && currentStatus !== 'Completed' && currentStatus !== 'Rejected' && (
          <TouchableOpacity
            style={styles.messageReferrerBtnTop}
            onPress={handleMessageReferrer}
            disabled={messagingReferrer}
          >
            <View style={styles.messageBtnContent}>
              <Ionicons name="chatbubble-outline" size={18} color="#fff" />
              <Text style={styles.messageReferrerTextTop}>
                {(referrerConversation.TotalUnreadFromReferrers || referrerConversation.UnreadCount) > 0 
                  ? 'Message Referrer' 
                  : 'View Conversations'}
              </Text>
            </View>
            {(referrerConversation.TotalUnreadFromReferrers || referrerConversation.UnreadCount) > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {(referrerConversation.TotalUnreadFromReferrers || referrerConversation.UnreadCount) > 99 
                    ? '99+' 
                    : (referrerConversation.TotalUnreadFromReferrers || referrerConversation.UnreadCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderTimeline = () => {
    if (history.length === 0) {
      return (
        <View style={styles.emptyHistory}>
          <Ionicons name="time-outline" size={48} color={colors.gray400} />
          <Text style={styles.emptyHistoryText}>No activity yet</Text>
          <Text style={styles.emptyHistorySubtext}>
            Updates will appear here as your referral progresses
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.timelineContainer}>
        <Text style={styles.sectionTitle}>Activity Timeline</Text>
        
        {history.map((item, index) => {
          const config = getStatusConfig(item.status);
          const isLast = index === history.length - 1;
          const isFirst = index === 0;

          return (
            <View key={item.historyId || index} style={styles.timelineItem}>
              {/* Timeline Line */}
              <View style={styles.timelineLine}>
                <View 
                  style={[
                    styles.timelineDot, 
                    { backgroundColor: config.color },
                    isFirst && styles.timelineDotFirst
                  ]} 
                />
                {!isLast && (
                  <View style={[styles.timelineConnector, { backgroundColor: colors.border }]} />
                )}
              </View>

              {/* Content */}
              <View style={[styles.timelineContent, isLast && styles.timelineContentLast]}>
                <View style={styles.timelineHeader}>
                  <View style={[styles.statusIconBg, { backgroundColor: config.color + '20' }]}>
                    <Ionicons name={config.icon} size={16} color={config.color} />
                  </View>
                  <View style={styles.timelineTextContainer}>
                    <Text style={[styles.timelineStatus, { color: config.color }]}>
                      {config.label}
                    </Text>
                    <Text style={styles.timelineDate}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                </View>

                {item.actorName && (
                  <View style={styles.actorRow}>
                    <Ionicons name="person-outline" size={14} color={colors.gray500} />
                    <Text style={styles.actorText}>
                      by {request?.OpenToAnyCompany ? 'a' : (request?.CompanyName || 'Company')} Referrer
                    </Text>
                  </View>
                )}

                {item.statusMessage && (
                  <Text style={styles.timelineMessage}>
                    "{item.statusMessage}"
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  if (loading && !request) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading tracking info...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Referral Tracking" fallbackTab="Home" />
      <View style={styles.innerContainer}>
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {renderHeader()}
          {renderTimeline()}
          
          {/* Help Section */}
          <View style={styles.helpSection}>
            <Ionicons name="information-circle-outline" size={20} color={colors.gray500} />
            <Text style={styles.helpText}>
              Pull down to refresh and see the latest updates on your referral request.
            </Text>
          </View>
        </ScrollView>
      </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Header Card
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  jobSection: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  logoContainer: {
    marginRight: 12,
  },
  companyLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  companyName: {
    fontSize: typography.sizes.md,
    color: colors.gray700,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  linkText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },

  // Current Status
  currentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  statusInfo: {
    flex: 1,
  },
  currentStatusLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  currentStatusDesc: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
  },
  seekerMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border || colors.gray100,
  },
  seekerMessageText: {
    flex: 1,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.gray400,
    lineHeight: 18,
  },
  seekerMessageToggle: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    marginLeft: 6,
    marginTop: 1,
  },

  // Timeline
  timelineContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
  },
  timelineLine: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  timelineDotFirst: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 2,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 24,
  },
  timelineContentLast: {
    paddingBottom: 0,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineTextContainer: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  timelineDate: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    marginTop: 2,
  },
  actorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  actorText: {
    fontSize: typography.sizes.xs,
    color: colors.gray600,
  },
  // Message referrer button at top of card
  messageReferrerBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  messageBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageReferrerTextTop: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: '#fff',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  unreadBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: '#fff',
  },
  timelineMessage: {
    fontSize: typography.sizes.sm,
    color: colors.gray700,
    fontStyle: 'italic',
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },

  // Empty State
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyHistoryText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptyHistorySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
  },

  // Help Section
  helpSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: colors.gray100,
    borderRadius: 12,
    marginBottom: 32,
    gap: 10,
  },
  helpText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    lineHeight: 20,
  },
});
