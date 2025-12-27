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
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { typography } from '../../styles/theme';

/**
 * ReferralTrackingScreen - Shows detailed tracking/history of a referral request
 * Beautiful timeline UI with status updates
 */
export default function ReferralTrackingScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { requestId, request: initialRequest } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [request, setRequest] = useState(initialRequest || null);
  const [history, setHistory] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(initialRequest?.Status || 'Pending');

  // Set header style
  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitle: 'Referral Tracking',
      headerTitleStyle: { color: colors.text },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  useFocusEffect(
    useCallback(() => {
      if (requestId) {
        loadHistory();
      }
    }, [requestId])
  );

  const loadHistory = async () => {
    if (!requestId) return;

    setLoading(true);
    try {
      const result = await refopenAPI.getReferralStatusHistory(requestId);
      if (result.success && result.data) {
        setHistory(result.data.history || []);
        setCurrentStatus(result.data.currentStatus || request?.Status || 'Pending');
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
        color: '#3B82F6',
        icon: 'notifications-outline',
        label: 'Notified to Referrers',
        description: 'Potential referrers have been notified',
      },
      'Viewed': {
        color: '#3B82F6',
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
            {request.OrganizationLogo ? (
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
              {request.CompanyName || 'Company'}
            </Text>
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

        {/* Request Date */}
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.gray500} />
          <Text style={styles.dateText}>
            Requested on {formatDate(request.RequestedAt)}
          </Text>
        </View>
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
                      by {item.actorName}
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
  );
}

const createStyles = (colors) => StyleSheet.create({
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
    marginTop: 8,
    gap: 6,
  },
  actorText: {
    fontSize: typography.sizes.xs,
    color: colors.gray600,
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
