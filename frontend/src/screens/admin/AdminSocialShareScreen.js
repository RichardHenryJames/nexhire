/**
 * AdminSocialShareScreen — Approve/reject social media share reward claims
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
  Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import useResponsive from '../../hooks/useResponsive';
import { showToast } from '../../components/Toast';
import refopenAPI from '../../services/api';

export default function AdminSocialShareScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { isAdmin } = useAuth();
  const responsive = useResponsive();

  const goToActionCenter = () => {
    const state = navigation.getState();
    if (state?.routes?.length > 1) navigation.goBack();
    else navigation.navigate('Main', { screen: 'ActionCenter' });
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({});
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await refopenAPI.apiCall('/management/social-share/claims');
      if (res.success) {
        setClaims(res.data?.claims || []);
        setStats(res.data?.stats || {});
      }
    } catch (err) {
      console.error('Error loading social share claims:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin, fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleApprove = async (claimId) => {
    try {
      const res = await refopenAPI.apiCall(`/management/social-share/claims/${claimId}/approve`, { method: 'POST' });
      if (res.success) { showToast('Claim approved!', 'success'); fetchData(); }
      else Alert.alert('Error', res.error || 'Failed to approve');
    } catch (err) { Alert.alert('Error', 'Failed to approve claim'); }
  };

  const handleReject = (claim) => {
    setSelectedClaim(claim);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectionReason.trim()) { Alert.alert('Error', 'Please enter a rejection reason'); return; }
    try {
      const res = await refopenAPI.apiCall(`/management/social-share/claims/${selectedClaim.ClaimID}/reject`, {
        method: 'POST', body: JSON.stringify({ reason: rejectionReason })
      });
      if (res.success) { setRejectModalVisible(false); showToast('Claim rejected', 'info'); fetchData(); }
      else Alert.alert('Error', res.error || 'Failed to reject');
    } catch (err) { Alert.alert('Error', 'Failed to reject claim'); }
  };

  const getPlatformColor = (p) => p === 'LinkedIn' ? '#0A66C2' : p === 'Instagram' ? '#E4405F' : p === 'Facebook' ? '#1877F2' : colors.text;
  const getPlatformIcon = (p) => p === 'LinkedIn' ? 'logo-linkedin' : p === 'Instagram' ? 'logo-instagram' : p === 'Facebook' ? 'logo-facebook' : 'share-social';
  const renderPlatformIcon = (p) => p === 'Twitter' ? <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>𝕏</Text> : <Ionicons name={getPlatformIcon(p)} size={18} color={getPlatformColor(p)} />;
  const getStatusColor = (s) => s === 'Pending' ? '#F59E0B' : s === 'Approved' ? '#10B981' : '#EF4444';

  const styles = makeStyles(colors, responsive);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goToActionCenter} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Social Share Claims</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ padding: 60, alignItems: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <>
            {/* Stats */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <View style={[styles.statBox, { backgroundColor: '#F59E0B15' }]}>
                <Text style={[styles.statNum, { color: '#F59E0B' }]}>{stats.pending || 0}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: '#10B98115' }]}>
                <Text style={[styles.statNum, { color: '#10B981' }]}>{stats.approved || 0}</Text>
                <Text style={styles.statLabel}>Approved</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: '#EF444415' }]}>
                <Text style={[styles.statNum, { color: '#EF4444' }]}>{stats.rejected || 0}</Text>
                <Text style={styles.statLabel}>Rejected</Text>
              </View>
            </View>

            {claims.length === 0 ? (
              <View style={{ padding: 60, alignItems: 'center' }}>
                <Ionicons name="megaphone-outline" size={56} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 12 }}>No claims yet</Text>
              </View>
            ) : (
              claims.map((claim, idx) => (
                <View key={claim.ClaimID || idx} style={styles.card}>
                  {/* Platform + User */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ backgroundColor: getPlatformColor(claim.Platform) + '20', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      {renderPlatformIcon(claim.Platform)}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{claim.FirstName} {claim.LastName}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{claim.Email}</Text>
                    </View>
                  </View>

                  {/* Status */}
                  <View style={{ backgroundColor: getStatusColor(claim.Status) + '20', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 10 }}>
                    <Text style={{ color: getStatusColor(claim.Status), fontSize: 12, fontWeight: '700' }}>{claim.Status}</Text>
                  </View>

                  {/* Rejection reason */}
                  {claim.Status === 'Rejected' && claim.RejectionReason && (
                    <View style={{ backgroundColor: '#EF444410', padding: 10, borderRadius: 8, marginBottom: 10 }}>
                      <Text style={{ color: '#EF4444', fontSize: 13 }}><Text style={{ fontWeight: '600' }}>Reason: </Text>{claim.RejectionReason}</Text>
                    </View>
                  )}

                  {/* Details */}
                  <View style={{ marginBottom: claim.Status === 'Pending' ? 12 : 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Ionicons name="gift-outline" size={16} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, marginLeft: 8, fontSize: 14 }}>Reward: ₹{claim.RewardAmount}</Text>
                    </View>
                    {claim.PostURL && (
                      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }} onPress={() => Linking.openURL(claim.PostURL)}>
                        <Ionicons name="link-outline" size={16} color={colors.primary} />
                        <Text style={{ marginLeft: 8, color: colors.primary, fontSize: 14 }}>View Post</Text>
                      </TouchableOpacity>
                    )}
                    {claim.ScreenshotURL && (
                      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }} onPress={() => Linking.openURL(claim.ScreenshotURL)}>
                        <Ionicons name="image-outline" size={16} color={colors.primary} />
                        <Text style={{ marginLeft: 8, color: colors.primary, fontSize: 14 }}>View Screenshot</Text>
                      </TouchableOpacity>
                    )}
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                      {new Date(claim.CreatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  {/* Actions */}
                  {claim.Status === 'Pending' && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(claim.ClaimID)}>
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.btnText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(claim)}>
                        <Ionicons name="close" size={18} color="#fff" />
                        <Text style={styles.btnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Reject Modal */}
      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Ionicons name="close-circle" size={40} color="#EF4444" />
            <Text style={styles.modalTitle}>Reject Claim</Text>
            {selectedClaim && (
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
                {selectedClaim.FirstName} {selectedClaim.LastName} • {selectedClaim.Platform} • ₹{selectedClaim.RewardAmount}
              </Text>
            )}
            <TextInput
              style={styles.modalInput}
              placeholder="Reason (e.g., Post not public, RefOpen not tagged...)"
              placeholderTextColor={colors.textSecondary}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setRejectModalVisible(false)}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#EF4444' }]} onPress={confirmReject}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function makeStyles(colors, responsive) {
  const isDesktop = Platform.OS === 'web' && responsive?.isDesktop;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 16 : 50, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    content: { padding: 16, ...(isDesktop ? { maxWidth: 700, alignSelf: 'center', width: '100%' } : {}) },
    statBox: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
    statNum: { fontSize: 22, fontWeight: '800' },
    statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
    card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
    approveBtn: { flex: 1, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    rejectBtn: { flex: 1, backgroundColor: '#EF4444', paddingVertical: 12, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '600', marginLeft: 6 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalBox: { backgroundColor: colors.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 8, marginBottom: 4 },
    modalInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.text, width: '100%', minHeight: 80, marginTop: 8 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  });
}
