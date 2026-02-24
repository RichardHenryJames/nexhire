/**
 * AdminVerificationsScreen — Approve/reject user verification requests (Aadhaar, College Email)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
  Image, Modal, TextInput, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import { useAuth } from '../../contexts/AuthContext';
import useResponsive from '../../hooks/useResponsive';
import { showToast } from '../../components/Toast';
import refopenAPI from '../../services/api';

export default function AdminVerificationsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { isAdmin } = useAuth();
  const responsive = useResponsive();
  const isMobile = responsive.isMobile;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [subTab, setSubTab] = useState('pending');
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await refopenAPI.apiCall('/management/verifications/pending');
      if (res.success && res.data) {
        setPending(res.data.pending || []);
        setCompleted(res.data.completed || []);
        setStats(res.data.stats || { pending: 0, approved: 0, rejected: 0 });
      }
    } catch (err) {
      console.error('Error loading verifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin, fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleApprove = async (id) => {
    try {
      const res = await refopenAPI.apiCall(`/management/verifications/${id}/approve`, { method: 'POST' });
      if (res.success) {
        showToast('Verification approved! User now has blue tick.', 'success');
        fetchData();
      } else {
        showToast(res.error || 'Failed to approve', 'error');
      }
    } catch (err) {
      showToast('Failed to approve verification', 'error');
    }
  };

  const handleReject = (item) => {
    setSelectedItem(item);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectionReason.trim()) { showToast('Please enter a rejection reason', 'error'); return; }
    try {
      const res = await refopenAPI.apiCall(`/management/verifications/${selectedItem.VerificationID}/reject`, {
        method: 'POST', body: JSON.stringify({ reason: rejectionReason })
      });
      if (res.success) {
        setRejectModalVisible(false);
        setSelectedItem(null);
        showToast('Verification rejected', 'info');
        fetchData();
      } else {
        showToast(res.error || 'Failed to reject', 'error');
      }
    } catch (err) {
      showToast('Failed to reject verification', 'error');
    }
  };

  const getMethodLabel = (m) => m === 'Aadhaar' ? '🪪 Aadhaar Card' : m === 'CollegeEmail' ? '🎓 College Email' : m === 'CompanyEmail' ? '🏢 Company Email' : m;
  const getMethodColor = (m) => m === 'Aadhaar' ? '#F59E0B' : m === 'CollegeEmail' ? '#8B5CF6' : '#3B82F6';

  const styles = makeStyles(colors, responsive);

  const renderVerificationCard = (v, showActions = true) => (
    <View key={v.VerificationID} style={[styles.card, { borderLeftColor: getMethodColor(v.Method), borderLeftWidth: 4 }]}>
      {/* Method + Status + Date */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <View style={{ backgroundColor: getMethodColor(v.Method) + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: getMethodColor(v.Method) }}>{getMethodLabel(v.Method)}</Text>
        </View>
        {v.Status !== 'Pending' && (
          <View style={{ backgroundColor: (v.Status === 'Approved' ? '#10B981' : '#EF4444') + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: v.Status === 'Approved' ? '#10B981' : '#EF4444' }}>{v.Status}</Text>
          </View>
        )}
        <Text style={{ fontSize: 11, color: colors.textSecondary }}>
          {new Date(v.ReviewedAt || v.CreatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {/* User */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        {v.ProfilePictureURL ? (
          <Image source={{ uri: v.ProfilePictureURL }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
        ) : (
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name="person" size={20} color={colors.primary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{v.FirstName} {v.LastName}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{v.Email}</Text>
          {v.Phone && <Text style={{ fontSize: 12, color: colors.textSecondary }}>{v.Phone}</Text>}
        </View>
      </View>

      {/* College */}
      {v.CollegeName && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#8B5CF610', padding: 8, borderRadius: 8 }}>
          <Ionicons name="school" size={16} color="#8B5CF6" style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 13, color: colors.text, fontWeight: '500' }}>{v.CollegeName}</Text>
        </View>
      )}

      {/* Rejection reason */}
      {v.Status === 'Rejected' && v.RejectionReason && (
        <View style={{ backgroundColor: '#EF444410', padding: 10, borderRadius: 8, marginBottom: 10 }}>
          <Text style={{ color: '#EF4444', fontSize: 13 }}><Text style={{ fontWeight: '600' }}>Reason: </Text>{v.RejectionReason}</Text>
        </View>
      )}

      {/* Aadhaar photos */}
      {v.Method === 'Aadhaar' && (v.AadhaarPhotoURL || v.SelfiePhotoURL) && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>Documents:</Text>
          <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
            {v.AadhaarPhotoURL && (
              <TouchableOpacity onPress={() => { if (Platform.OS === 'web') { window.open(v.AadhaarPhotoURL, '_blank'); } else { Linking.openURL(v.AadhaarPhotoURL).catch(() => {}); } }} style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }}>Aadhaar Card</Text>
                <Image source={{ uri: v.AadhaarPhotoURL }} style={{ width: '100%', height: 180, borderRadius: 8, backgroundColor: colors.border }} resizeMode="contain" />
              </TouchableOpacity>
            )}
            {v.SelfiePhotoURL && (
              <TouchableOpacity onPress={() => { if (Platform.OS === 'web') { window.open(v.SelfiePhotoURL, '_blank'); } else { Linking.openURL(v.SelfiePhotoURL).catch(() => {}); } }} style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }}>Selfie</Text>
                <Image source={{ uri: v.SelfiePhotoURL }} style={{ width: '100%', height: 180, borderRadius: 8, backgroundColor: colors.border }} resizeMode="contain" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Actions - only for pending */}
      {showActions && v.Status === 'Pending' && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(v.VerificationID)}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.btnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(v)}>
            <Ionicons name="close-circle" size={18} color="#fff" />
            <Text style={styles.btnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const currentList = subTab === 'pending' ? pending : completed;

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Verifications" fallbackTab="ActionCenter" />

      {/* Sub Tabs */}
      <View style={styles.subTabsRow}>
        <TouchableOpacity style={[styles.subTab, subTab === 'pending' && styles.subTabActive]} onPress={() => setSubTab('pending')}>
          <Text style={[styles.subTabText, subTab === 'pending' && { color: '#F59E0B', fontWeight: '700' }]}>Pending ({stats.pending})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.subTab, subTab === 'completed' && styles.subTabCompleted]} onPress={() => setSubTab('completed')}>
          <Text style={[styles.subTabText, subTab === 'completed' && { color: '#10B981', fontWeight: '700' }]}>Completed ({stats.approved + stats.rejected})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ padding: 60, alignItems: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : currentList.length === 0 ? (
          <View style={{ padding: 60, alignItems: 'center' }}>
            <Ionicons name={subTab === 'pending' ? 'shield-checkmark-outline' : 'document-text-outline'} size={56} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 12 }}>
              {subTab === 'pending' ? 'All caught up!' : 'No history'}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
              {subTab === 'pending' ? 'No pending verifications' : 'No completed verifications yet'}
            </Text>
          </View>
        ) : (
          currentList.map((v) => renderVerificationCard(v, subTab === 'pending'))
        )}
      </ScrollView>

      {/* Reject Modal */}
      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Ionicons name="close-circle" size={40} color="#EF4444" />
            <Text style={styles.modalTitle}>Reject Verification</Text>
            {selectedItem && (
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
                {selectedItem.FirstName} {selectedItem.LastName} • {getMethodLabel(selectedItem.Method)}
              </Text>
            )}
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for rejection..."
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
    content: { padding: 16, ...(isDesktop ? { maxWidth: 700, alignSelf: 'center', width: '100%' } : {}) },
    subTabsRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 16 },
    subTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    subTabActive: { borderBottomWidth: 2, borderBottomColor: '#F59E0B' },
    subTabCompleted: { borderBottomWidth: 2, borderBottomColor: '#10B981' },
    subTabText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
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
