import React, { useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import refopenAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import { showToast } from '../../components/Toast';

export default function MyReferralRequestsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myRequests, setMyRequests] = useState([]);

  const [showProofViewer, setShowProofViewer] = useState(false);
  const [viewingProof, setViewingProof] = useState(null);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [verifyTarget, setVerifyTarget] = useState(null);

  // ✅ Set header style for dark mode support
  useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: colors.surface,
      },
      headerTintColor: colors.text,
      headerTitleStyle: {
        color: colors.text,
      },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            const navState = navigation.getState?.();
            const routes = navState?.routes || [];
            const currentIndex = navState?.index || 0;

            if (routes.length > 1 && currentIndex > 0) {
              navigation.goBack();
            } else {
              navigation.navigate('Main', {
                screen: 'MainTabs',
                params: { screen: 'Profile' },
              });
            }
          }}
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
      loadMyRequests();
    }, [user])
  );

  const loadMyRequests = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await refopenAPI.getMyReferralRequests(1, 50);
      if (result.success) {
        setMyRequests(result.data?.requests || []);
      } else {
        setMyRequests([]);
      }
    } catch (error) {
      console.error('Error loading my referral requests:', error);
      setMyRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMyRequests();
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';

    const date = new Date(dateString);
    const dateOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    const timeOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };

    return `${date.toLocaleDateString('en-US', dateOptions)} at ${date.toLocaleTimeString('en-US', timeOptions)}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
        return colors.gray500;
      case 'NotifiedToReferrers':
        return '#3B82F6'; // Blue - notified
      case 'Viewed':
        return '#3B82F6'; // Blue - someone viewed it
      case 'Claimed':
        return '#F59E0B'; // Amber - being worked on
      case 'ProofUploaded':
        return '#8B5CF6'; // Purple - proof submitted
      case 'Completed':
        return colors.success;
      case 'Verified':
        return '#ffd700';
      case 'Unverified':
        return '#ef4444'; // Red - not verified
      case 'Cancelled':
        return colors.danger;
      default:
        return colors.gray500;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending':
        return 'time-outline';
      case 'NotifiedToReferrers':
        return 'notifications-outline';
      case 'Viewed':
        return 'eye-outline';
      case 'Claimed':
        return 'hand-left-outline';
      case 'ProofUploaded':
        return 'document-attach-outline';
      case 'Completed':
        return 'checkmark-circle';
      case 'Verified':
        return 'trophy';
      case 'Unverified':
        return 'alert-circle';
      case 'Cancelled':
        return 'close-circle';
      default:
        return 'help-outline';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'Pending':
        return 'Waiting for referrer';
      case 'NotifiedToReferrers':
        return 'Notified to Referrers';
      case 'Viewed':
        return 'Viewed by referrer';
      case 'Claimed':
        return 'Being referred';
      case 'ProofUploaded':
        return 'Proof submitted';
      case 'Completed':
        return 'Completed';
      case 'Verified':
        return 'Verified';
      case 'Unverified':
        return 'Unverified';
      case 'Cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const handleViewProof = (request) => {
    if (!request.ProofFileURL) {
      showToast('Referrer has not uploaded proof yet', 'info');
      return;
    }
    setViewingProof(request);
    setShowProofViewer(true);
  };

  const handleVerifyReferral = async (requestId) => {
    const request = myRequests.find((r) => r.RequestID === requestId);
    setVerifyTarget({ requestId, request });
  };

  const performVerifyReferral = async (requestId, verified) => {
    try {
      const result = await refopenAPI.verifyReferralCompletion(requestId, verified);
      if (result.success) {
        const newStatus = verified ? 'Verified' : 'Unverified';
        showToast(`Referral ${verified ? 'verified' : 'marked as unverified'}`, 'success');
        setMyRequests((prev) =>
          prev.map((r) =>
            r.RequestID === requestId
              ? { ...r, Status: newStatus, VerifiedByApplicant: verified ? 1 : 0 }
              : r
          )
        );
        loadMyRequests();
      } else {
        showToast('Failed to verify referral. Please try again.', 'error');
      }
    } catch (e) {
      console.error('Verify error:', e);
      showToast('Failed to verify referral. Please try again.', 'error');
    }
  };

  const handleCancelRequest = async (requestId) => {
    const request = myRequests.find((r) => r.RequestID === requestId);

    if (Platform.OS === 'web') {
      setCancelTarget({ requestId, request });
      return;
    }

    Alert.alert(
      'Cancel Referral Request',
      `Are you sure you want to cancel your referral request for ${request?.JobTitle || 'this job'}? This action cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => performCancelRequest(requestId),
        },
      ]
    );
  };

  const performCancelRequest = async (requestId) => {
    try {
      const res = await refopenAPI.cancelReferralRequest(requestId);

      if (res.success) {
        setMyRequests((prev) =>
          prev.map((r) =>
            r.RequestID === requestId ? { ...r, Status: 'Cancelled' } : r
          )
        );
        showToast('Referral request cancelled', 'success');
      } else {
        console.error('Cancel request failed:', res.error);
        showToast('Failed to cancel. Please try again.', 'error');
      }
    } catch (e) {
      console.error('Cancel request error:', e);
      showToast('Failed to cancel. Please try again.', 'error');
    }
  };

  const handleViewTracking = (request) => {
    navigation.navigate('ReferralTracking', { 
      requestId: request.RequestID,
      request: request
    });
  };

  const renderMyRequestCard = (request) => {
    const isExternalJob = !!request.ExtJobID;
    const isInternalJob = !!request.JobID && !request.ExtJobID;

    // Get initials for company placeholder
    const getCompanyInitials = (name) => {
      if (!name) return 'CO';
      const words = name.split(' ');
      if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    };

    // Generate a color based on company name
    const getCompanyColor = (name) => {
      const colorPalette = [
        '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B',
        '#10B981', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1'
      ];
      if (!name) return colorPalette[0];
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colorPalette[Math.abs(hash) % colorPalette.length];
    };

    const companyName = request.CompanyName || 'Company';
    const companyColor = getCompanyColor(companyName);

    return (
      <View key={request.RequestID} style={styles.requestCard}>
        <View style={styles.requestHeader}>
          {/* Company Logo - clickable to org screen */}
          <TouchableOpacity 
            style={styles.logoContainer}
            onPress={() => {
              if (request.OrganizationID) {
                navigation.navigate('OrganizationDetails', { 
                  organizationId: request.OrganizationID 
                });
              }
            }}
          >
            {request.OrganizationLogo ? (
              <Image
                source={{ uri: request.OrganizationLogo }}
                style={styles.companyLogo}
                onError={() => {}}
              />
            ) : (
              <View style={[styles.logoPlaceholder, { backgroundColor: companyColor }]}>
                <Text style={styles.logoInitials}>{getCompanyInitials(companyName)}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.requestInfo}>
            {/* Company Name - Primary */}
            <TouchableOpacity 
              onPress={() => {
                if (request.OrganizationID) {
                  navigation.navigate('OrganizationDetails', { 
                    organizationId: request.OrganizationID 
                  });
                }
              }}
            >
              <Text style={styles.companyNamePrimary} numberOfLines={1}>
                {companyName}
              </Text>
            </TouchableOpacity>

            {/* "for [Job Title]" row */}
            <View style={styles.forJobRow}>
              <Text style={styles.forJobText}>for </Text>
              <Text style={styles.jobTitleBold} numberOfLines={1}>
                {request.JobTitle || 'Job Title'}
              </Text>
            </View>

            {/* Meta Row: Internal/External • Date */}
            <View style={styles.metaRow}>
              {isInternalJob && (
                <>
                  <Text style={[styles.jobTypePill, { color: '#3B82F6' }]}>Internal</Text>
                  <Text style={styles.metaDot}>•</Text>
                </>
              )}
              {isExternalJob && (
                <>
                  <Text style={[styles.jobTypePill, { color: '#8B5CF6' }]}>External</Text>
                  <Text style={styles.metaDot}>•</Text>
                </>
              )}
              <Text style={styles.timeAgo}>
                {formatDate(request.RequestedAt)}
              </Text>
            </View>

            {/* Status + Track Button Row */}
            <View style={styles.bottomRow}>
              {/* Status Badge */}
              <View style={[styles.statusPill, { backgroundColor: getStatusColor(request.Status) + '20' }]}>
                <Ionicons
                  name={getStatusIcon(request.Status)}
                  size={12}
                  color={getStatusColor(request.Status)}
                />
                <Text style={[styles.statusPillText, { color: getStatusColor(request.Status) }]}>
                  {request.Status}
                </Text>
              </View>

              {/* Spacer */}
              <View style={{ flex: 1 }} />

              {/* Track Button */}
              <TouchableOpacity 
                style={styles.trackBtn}
                onPress={() => handleViewTracking(request)}
              >
                <Text style={styles.trackBtnText}>Track</Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading referral requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
        {myRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color={colors.gray400} />
            <Text style={styles.emptyTitle}>No Referral Requests</Text>
            <Text style={styles.emptyText}>
              You haven't requested any referrals yet. Use "Ask Referral" to get
              started.
            </Text>
          </View>
        ) : (
          myRequests.map(renderMyRequestCard)
        )}
      </ScrollView>
      </View>

      {showProofViewer && viewingProof && (
        <Modal
          visible={showProofViewer}
          animationType="slide"
          onRequestClose={() => setShowProofViewer(false)}
        >
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 40, right: 20, zIndex: 10 }}
              onPress={() => setShowProofViewer(false)}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <Image
              source={{ uri: viewingProof.ProofFileURL }}
              style={{ flex: 1, resizeMode: 'contain' }}
            />
            <View style={{ padding: 16, backgroundColor: 'rgba(0,0,0,0.6)' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 8 }}>
                Proof Description
              </Text>
              <Text style={{ color: '#fff' }}>
                {viewingProof.ProofDescription || 'No description provided'}
              </Text>
            </View>
          </View>
        </Modal>
      )}

      <Modal
        visible={!!cancelTarget}
        transparent
        onRequestClose={() => setCancelTarget(null)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setCancelTarget(null)}>
          <Pressable style={styles.confirmBox} onPress={() => {}}>
            <View style={styles.confirmHeader}>
              <View style={styles.confirmIconContainer}>
                <Ionicons name="warning" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.confirmTitle}>Cancel Referral Request</Text>
            </View>

            <Text style={styles.confirmMessage}>
              Are you sure you want to cancel your referral request for{' '}
              <Text style={styles.jobTitleInModal}>
                {cancelTarget?.request?.JobTitle || 'this job'}
              </Text>
              ?{'\n\n'}This action cannot be undone and you'll need to create a new
              request if you change your mind.
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.keepBtn]}
                onPress={() => setCancelTarget(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.keepBtnText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.cancelReqBtn]}
                onPress={() => {
                  const requestId = cancelTarget?.requestId;
                  setCancelTarget(null);
                  if (requestId != null) performCancelRequest(requestId);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color="#dc2626"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.cancelReqBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Verification Confirmation Modal */}
      <Modal
        visible={!!verifyTarget}
        transparent
        onRequestClose={() => setVerifyTarget(null)}
      >
        <Pressable style={styles.confirmOverlay} onPress={() => setVerifyTarget(null)}>
          <Pressable style={styles.confirmBox} onPress={() => {}}>
            <View style={styles.confirmHeader}>
              <View style={[styles.confirmIconContainer, styles.verifyIconContainer]}>
                <Ionicons name="checkmark-done-circle" size={24} color={colors.primary} />
              </View>
              <Text style={styles.confirmTitle}>Verify Referral</Text>
            </View>

            <Text style={styles.confirmMessage}>
              Has the referrer successfully referred you for{' '}
              <Text style={styles.jobTitleInModal}>
                {verifyTarget?.request?.JobTitle || 'this job'}
              </Text>
              ?{'\n\n'}Please confirm whether you received a legitimate referral from this person.
            </Text>

            {verifyTarget?.request?.ProofDescription && (
              <View style={styles.referrerMessageBox}>
                <View style={styles.referrerMessageHeader}>
                  <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
                  <Text style={styles.referrerMessageLabel}>Referrer's Message:</Text>
                </View>
                <Text style={styles.referrerMessageText}>
                  "{verifyTarget.request.ProofDescription}"
                </Text>
              </View>
            )}

            <View style={styles.verifyInfoBox}>
              <Ionicons name="information-circle" size={18} color="#93c5fd" />
              <Text style={styles.verifyInfoText}>
                Your feedback helps us verify authentic referrers and improve the platform for everyone.
              </Text>
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.noBtn]}
                onPress={() => {
                  const requestId = verifyTarget?.requestId;
                  setVerifyTarget(null);
                  if (requestId != null) performVerifyReferral(requestId, false);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={colors.danger}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.noBtnText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.yesBtn]}
                onPress={() => {
                  const requestId = verifyTarget?.requestId;
                  setVerifyTarget(null);
                  if (requestId != null) performVerifyReferral(requestId, true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.white}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.yesBtnText}>Yes</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
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
    paddingTop: 12,
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 20,
  },

  requestCard: {
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  logoContainer: {
    marginRight: 12,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.gray100,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitials: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  requestInfo: {
    flex: 1,
  },
  companyNamePrimary: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  forJobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 4,
  },
  forJobText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  jobTitleBold: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  jobTypePill: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  metaDot: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  timeAgo: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 4,
  },
  statusPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  trackBtnText: {
    fontSize: typography.sizes.xs,
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  // Keep old styles for backward compatibility (unused now)
  jobTypeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  jobTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    flexShrink: 1,
    lineHeight: 18,
  },
  externalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight || '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  externalBadgeText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  internalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  internalBadgeText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: '#3B82F6',
  },
  companyName: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 16,
  },
  externalJobIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  externalJobIdText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    flexShrink: 1,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 6,
  },
  requestDate: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginLeft: 4,
    lineHeight: 14,
  },
  referrerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  referrerName: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontWeight: typography.weights.semibold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: colors.gray100,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginLeft: 3,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  viewProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.primary + '20',
    borderRadius: 6,
    gap: 4,
  },
  viewProofText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  verifyText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  cancelText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },

  confirmOverlay: {
    ...Platform.select({
      web: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
      default: {
        flex: 1,
      },
    }),
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  confirmIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.warningLight || '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  confirmMessage: {
    fontSize: typography.sizes.sm,
    color: colors.gray700,
    lineHeight: 20,
    marginBottom: 16,
  },
  jobTitleInModal: {
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  confirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  keepBtn: {
    backgroundColor: colors.gray100,
  },
  keepBtnText: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
  cancelReqBtn: {
    backgroundColor: colors.dangerLight || '#FEE2E2',
  },
  cancelReqBtnText: {
    color: colors.danger,
    fontWeight: typography.weights.semibold,
  },
  trackingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  trackingHintText: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
  },

  // Verification modal styles
  verifyIconContainer: {
    backgroundColor: colors.primaryDark || 'rgba(59, 130, 246, 0.2)',
  },
  verifyInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  verifyInfoText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: '#93c5fd',
    lineHeight: 18,
  },
  referrerMessageBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  referrerMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  referrerMessageLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: '#6ee7b7',
  },
  referrerMessageText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary || '#a3e635',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  noBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  noBtnText: {
    color: '#f87171',
    fontWeight: typography.weights.semibold,
  },
  yesBtn: {
    backgroundColor: colors.primary,
  },
  yesBtnText: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
});
