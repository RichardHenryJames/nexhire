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
import { typography } from '../../styles/theme';
import { showToast } from '../../components/Toast';

export default function MyReferralRequestsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myRequests, setMyRequests] = useState([]);

  const [showProofViewer, setShowProofViewer] = useState(false);
  const [viewingProof, setViewingProof] = useState(null);

  const [cancelTarget, setCancelTarget] = useState(null);

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
      case 'Completed':
        return colors.success;
      case 'Verified':
        return '#ffd700';
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
      case 'Completed':
        return 'checkmark-circle';
      case 'Verified':
        return 'trophy';
      case 'Cancelled':
        return 'close-circle';
      default:
        return 'help-outline';
    }
  };

  const handleViewProof = (request) => {
    if (!request.ProofFileURL) {
      Alert.alert('No Proof', 'Referrer has not uploaded proof yet');
      return;
    }
    setViewingProof(request);
    setShowProofViewer(true);
  };

  const handleVerifyReferral = async (requestId) => {
    try {
      const result = await refopenAPI.verifyReferralCompletion(requestId, true);
      if (result.success) {
        showToast('Referral verified', 'success');
        setMyRequests((prev) =>
          prev.map((r) =>
            r.RequestID === requestId
              ? { ...r, Status: 'Verified', VerifiedByApplicant: 1 }
              : r
          )
        );
        loadMyRequests();
      } else {
        Alert.alert('Error', result.error || 'Failed to verify referral');
      }
    } catch (e) {
      console.error('Verify error:', e);
      Alert.alert('Error', e.message || 'Failed to verify referral');
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
        Alert.alert('Error', res.error || 'Failed to cancel');
      }
    } catch (e) {
      console.error('Cancel request error:', e);
      Alert.alert('Error', e.message || 'Failed to cancel');
    }
  };

  const renderMyRequestCard = (request) => {
    const isExternalJob = !!request.ExtJobID;
    const isInternalJob = !!request.JobID && !request.ExtJobID;

    return (
      <View key={request.RequestID} style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.logoContainer}>
            {request.OrganizationLogo ? (
              <Image
                source={{ uri: request.OrganizationLogo }}
                style={styles.companyLogo}
                onError={() => {}}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons
                  name="business-outline"
                  size={24}
                  color={colors.gray500}
                />
              </View>
            )}
          </View>

          <View style={styles.requestInfo}>
            <View style={styles.jobTypeBadgeContainer}>
              <Text style={styles.jobTitle} numberOfLines={1}>
                {request.JobTitle || 'Job Title'}
              </Text>
              {isExternalJob && (
                <View style={styles.externalBadge}>
                  <Ionicons name="open-outline" size={10} color="#8B5CF6" />
                  <Text style={styles.externalBadgeText}>External</Text>
                </View>
              )}
              {isInternalJob && (
                <View style={styles.internalBadge}>
                  <Ionicons
                    name="arrow-forward-circle-outline"
                    size={10}
                    color="#3B82F6"
                  />
                  <Text style={styles.internalBadgeText}>Internal</Text>
                </View>
              )}
            </View>

            <Text style={styles.companyName} numberOfLines={1}>
              {request.CompanyName || 'Company'}
            </Text>

            {isExternalJob && request.ExtJobID && (
              <View style={styles.externalJobIdRow}>
                <Ionicons name="link-outline" size={14} color="#8B5CF6" />
                <Text style={styles.externalJobIdText} numberOfLines={1}>
                  Job ID: {request.ExtJobID}
                </Text>
              </View>
            )}

            <View style={styles.timestampRow}>
              <Ionicons name="time-outline" size={14} color={colors.gray500} />
              <Text style={styles.requestDate}>
                Requested on {formatDate(request.RequestedAt)}
              </Text>
            </View>

            {request.ReferrerName && request.CompanyName && (
              <View style={styles.referrerRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={colors.success}
                />
                <Text style={styles.referrerName}>
                  Referred by {request.CompanyName} employee
                </Text>
              </View>
            )}
          </View>

          <View style={styles.statusBadge}>
            <Ionicons
              name={getStatusIcon(request.Status)}
              size={16}
              color={getStatusColor(request.Status)}
            />
            <Text
              style={[styles.statusText, { color: getStatusColor(request.Status) }]}
              numberOfLines={1}
            >
              {request.Status}
            </Text>
          </View>
        </View>

        <View style={styles.requestActions}>
          {request.Status === 'Completed' && (
            <>
              <TouchableOpacity
                style={styles.viewProofBtn}
                onPress={() => handleViewProof(request)}
              >
                <Ionicons name="eye-outline" size={16} color={colors.primary} />
                <Text style={styles.viewProofText}>View Proof</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={() => handleVerifyReferral(request.RequestID)}
              >
                <Ionicons name="checkmark-done" size={16} color={colors.white} />
                <Text style={styles.verifyText}>Verify</Text>
              </TouchableOpacity>
            </>
          )}

          {request.Status === 'Verified' && request.ProofFileURL && (
            <TouchableOpacity
              style={styles.viewProofBtn}
              onPress={() => handleViewProof(request)}
            >
              <Ionicons name="eye-outline" size={16} color={colors.primary} />
              <Text style={styles.viewProofText}>View Proof</Text>
            </TouchableOpacity>
          )}

          {request.Status === 'Pending' && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => handleCancelRequest(request.RequestID)}
            >
              <Ionicons
                name="close-circle-outline"
                size={16}
                color={colors.danger}
              />
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
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
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.description}>Referral requests you have asked for</Text>

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
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  logoContainer: {
    marginRight: 12,
  },
  companyLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestInfo: {
    flex: 1,
  },
  jobTypeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  jobTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flexShrink: 1,
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
    backgroundColor: colors.primaryLight || '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  internalBadgeText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  companyName: {
    marginTop: 4,
    fontSize: typography.sizes.sm,
    color: colors.gray700,
  },
  externalJobIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
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
    marginTop: 8,
    gap: 6,
  },
  requestDate: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
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
    gap: 6,
    marginLeft: 8,
  },
  statusText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  viewProofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  viewProofText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
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
});
