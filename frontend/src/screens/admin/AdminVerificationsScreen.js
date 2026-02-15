/**
 * AdminVerificationsScreen — Approve/reject user verification requests (Aadhaar, College Email)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
  Image, Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
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

  const goToActionCenter = () => {
    const state = navigation.getState();
    if (state?.routes?.length > 1) navigation.goBack();
    else navigation.navigate('Main', { screen: 'ActionCenter' });
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifications, setVerifications] = useState([]);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await refopenAPI.apiCall('/management/verifications/pending');
      if (res.success && Array.isArray(res.data)) {
        setVerifications(res.data);
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
        Alert.alert('Error', res.error || 'Failed to approve');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to approve verification');
    }
  };

  const handleReject = (item) => {
    setSelectedItem(item);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectionReason.trim()) { Alert.alert('Error', 'Please enter a rejection reason'); return; }
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
        Alert.alert('Error', res.error || 'Failed to reject');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to reject verification');
    }
  };

  const getMethodLabel = (m) => m === 'Aadhaar' ? '🪪 Aadhaar Card' : m === 'CollegeEmail' ? '🎓 College Email' : m === 'CompanyEmail' ? '🏢 Company Email' : m;
  const getMethodColor = (m) => m === 'Aadhaar' ? '#F59E0B' : m === 'CollegeEmail' ? '#8B5CF6' : '#3B82F6';

  const styles = makeStyles(colors, responsive);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goToActionCenter} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verifications</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ padding: 60, alignItems: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : verifications.length === 0 ? (
          <View style={{ padding: 60, alignItems: 'center' }}>
            <Ionicons name="shield-checkmark-outline" size={56} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 12 }}>All caught up!</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>No pending verifications</Text>
          </View>
        ) : (
          <>
            <View style={styles.countBanner}>
              <Text style={styles.countText}>{verifications.length} pending</Text>
            </View>

            {verifications.map((v, idx) => (
              <View key={v.VerificationID || idx} style={[styles.card, { borderLeftColor: getMethodColor(v.Method), borderLeftWidth: 4 }]}>
                {/* Method + Date */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ backgroundColor: getMethodColor(v.Method) + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: getMethodColor(v.Method) }}>{getMethodLabel(v.Method)}</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginLeft: 10 }}>
                    {new Date(v.CreatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
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

                {/* Aadhaar photos */}
                {v.Method === 'Aadhaar' && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>Documents:</Text>
                    <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
                      {v.AadhaarPhotoURL && (
                        <TouchableOpacity onPress={() => Platform.OS === 'web' && window.open(v.AadhaarPhotoURL, '_blank')} style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }}>Aadhaar Card</Text>
                          <Image source={{ uri: v.AadhaarPhotoURL }} style={{ width: '100%', height: 180, borderRadius: 8, backgroundColor: colors.border }} resizeMode="contain" />
                        </TouchableOpacity>
                      )}
                      {v.SelfiePhotoURL && (
                        <TouchableOpacity onPress={() => Platform.OS === 'web' && window.open(v.SelfiePhotoURL, '_blank')} style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, fontWeight: '600' }}>Selfie</Text>
                          <Image source={{ uri: v.SelfiePhotoURL }} style={{ width: '100%', height: 180, borderRadius: 8, backgroundColor: colors.border }} resizeMode="contain" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {/* Actions */}
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
              </View>
            ))}
          </>
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 16 : 50, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    content: { padding: 16, ...(isDesktop ? { maxWidth: 700, alignSelf: 'center', width: '100%' } : {}) },
    countBanner: { backgroundColor: '#F59E0B20', borderRadius: 8, padding: 10, marginBottom: 16, alignItems: 'center' },
    countText: { color: '#F59E0B', fontWeight: '700', fontSize: 14 },
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
