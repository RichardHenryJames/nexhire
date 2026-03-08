/**
 * AdminCareerApplicationsScreen — Admin view for career applications
 * 
 * Features:
 * - List all career applications with user info, job title, resume links
 * - Filter by status (All, Applied, Reviewed, Shortlisted, Rejected)
 * - Update application status
 * - View resume (opens URL)
 * - Responsive: mobile + desktop
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  RefreshControl,
  Linking,
  Image,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import useResponsive from '../../hooks/useResponsive';
import SubScreenHeader from '../../components/SubScreenHeader';
import { showToast } from '../../components/Toast';
import refopenAPI from '../../services/api';

const BRAND = '#4F46E5';
const STATUSES = ['All', 'Applied', 'Reviewed', 'Shortlisted', 'Rejected', 'Hired'];
const STATUS_COLORS = {
  Applied: '#3b82f6',
  Reviewed: '#f59e0b',
  Shortlisted: '#22c55e',
  Rejected: '#ef4444',
  Hired: '#8b5cf6',
};

export default function AdminCareerApplicationsScreen({ navigation }) {
  const { colors } = useTheme();
  const { isAdmin } = useAuth();
  const responsive = useResponsive();
  const { isMobile, isDesktop } = responsive;

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [total, setTotal] = useState(0);

  // Status update modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const loadApplications = useCallback(async () => {
    try {
      const result = await refopenAPI.getAdminCareerApplications(1, 100, selectedStatus);
      if (result?.success) {
        setApplications(result.data || []);
        setTotal(result.meta?.total || 0);
      }
    } catch (e) { console.warn('Failed to load applications:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [selectedStatus]);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  const openResume = (url) => {
    if (url) {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        Linking.openURL(url);
      }
    }
  };

  const handleStatusUpdate = (app) => {
    setSelectedApp(app);
    setNewStatus(app.Status);
    setReviewNotes(app.ReviewNotes || '');
    setShowStatusModal(true);
  };

  const submitStatusUpdate = async () => {
    if (!newStatus) return;
    setUpdating(true);
    try {
      const r = await refopenAPI.updateCareerApplicationStatus(selectedApp.ApplicationID, newStatus, reviewNotes.trim() || undefined);
      if (r?.success) {
        setApplications(prev => prev.map(a =>
          a.ApplicationID === selectedApp.ApplicationID
            ? { ...a, Status: newStatus, ReviewNotes: reviewNotes.trim(), ReviewedAt: new Date().toISOString() }
            : a
        ));
        setShowStatusModal(false);
        showToast('Status updated', 'success');
      } else { showToast(r?.error || 'Failed', 'error'); }
    } catch (e) { showToast('Failed to update', 'error'); }
    finally { setUpdating(false); }
  };

  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
           dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const statusCounts = useMemo(() => {
    // When filter is 'All', we have all applications — compute counts
    if (selectedStatus !== 'All') return null;
    const counts = {};
    applications.forEach(a => { counts[a.Status] = (counts[a.Status] || 0) + 1; });
    return counts;
  }, [applications, selectedStatus]);

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <SubScreenHeader title="Access Denied" fallbackTab="Home" />
        <View style={styles.centerC}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.gray400} />
          <Text style={styles.emptyTitle}>Admin access required</Text>
        </View>
      </View>
    );
  }

  if (loading) return (
    <View style={styles.container}>
      <SubScreenHeader title="Career Applications" fallbackTab="Home" />
      <View style={styles.centerC}><ActivityIndicator size="large" color={BRAND} /><Text style={styles.loadingT}>Loading applications...</Text></View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Career Applications" fallbackTab="Home" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadApplications(); }} />}
        showsVerticalScrollIndicator={false}>

        {/* Header Stats */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Career Applications</Text>
          <Text style={styles.headerSub}>{total} total applications</Text>
        </View>

        {/* Status summary cards */}
        {statusCounts && (
          <View style={styles.statCards}>
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <View key={status} style={[styles.statCard, { borderLeftColor: color }]}>
                <Text style={[styles.statCount, { color }]}>{statusCounts[status] || 0}</Text>
                <Text style={styles.statLabel}>{status}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ gap: 8 }}>
          {STATUSES.map(s => (
            <TouchableOpacity key={s} style={[styles.chip, selectedStatus === s && styles.chipOn]} onPress={() => { setSelectedStatus(s); setLoading(true); }}>
              <Text style={[styles.chipT, selectedStatus === s && styles.chipTOn]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Applications List */}
        {applications.length === 0 ? (
          <View style={styles.centerC}>
            <Ionicons name="document-text-outline" size={48} color={colors.gray400} />
            <Text style={styles.emptyTitle}>No applications found</Text>
            <Text style={styles.emptySub}>No applications with status "{selectedStatus}"</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {/* Desktop: Table header */}
            {isDesktop && (
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 2 }]}>Applicant</Text>
                <Text style={[styles.th, { flex: 2 }]}>Position</Text>
                <Text style={[styles.th, { flex: 1 }]}>Status</Text>
                <Text style={[styles.th, { flex: 1 }]}>Applied</Text>
                <Text style={[styles.th, { flex: 1.5 }]}>Actions</Text>
              </View>
            )}

            {applications.map((app) => {
              const statusColor = STATUS_COLORS[app.Status] || colors.textSecondary;
              return (
                <View key={app.ApplicationID} style={styles.appCard}>
                  {isDesktop ? (
                    // Desktop: Table row
                    <View style={styles.tableRow}>
                      <View style={[styles.td, { flex: 2 }]}>
                        <View style={styles.applicantRow}>
                          {app.ProfileImageURL ? (
                            <Image source={{ uri: app.ProfileImageURL }} style={styles.avatar} />
                          ) : (
                            <View style={[styles.avatar, styles.avatarFallback]}>
                              <Text style={styles.avatarT}>{(app.FullName || 'U')[0].toUpperCase()}</Text>
                            </View>
                          )}
                          <View>
                            <Text style={styles.applicantName}>{app.FullName}</Text>
                            <Text style={styles.applicantEmail}>{app.Email}</Text>
                            {app.Phone && <Text style={styles.applicantEmail}>{app.Phone}</Text>}
                          </View>
                        </View>
                      </View>
                      <View style={[styles.td, { flex: 2 }]}>
                        <Text style={styles.jobTitle}>{app.JobTitle}</Text>
                        <Text style={styles.jobMeta}>{app.Department} • {app.JobType}</Text>
                      </View>
                      <View style={[styles.td, { flex: 1 }]}>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
                          <Text style={[styles.statusT, { color: statusColor }]}>{app.Status}</Text>
                        </View>
                      </View>
                      <View style={[styles.td, { flex: 1 }]}>
                        <Text style={styles.dateT}>{fmtDate(app.AppliedAt)}</Text>
                      </View>
                      <View style={[styles.td, { flex: 1.5, flexDirection: 'row', gap: 8 }]}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openResume(app.ResumeURL)}>
                          <Ionicons name="document-text-outline" size={16} color={BRAND} />
                          <Text style={styles.actionBtnT}>Resume</Text>
                        </TouchableOpacity>
                        {app.LinkedInURL && (
                          <TouchableOpacity style={styles.actionBtn} onPress={() => openResume(app.LinkedInURL)}>
                            <Ionicons name="logo-linkedin" size={16} color="#0077b5" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => handleStatusUpdate(app)}>
                          <Ionicons name="create-outline" size={16} color="#fff" />
                          <Text style={styles.actionBtnPrimaryT}>Update</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    // Mobile: Card layout
                    <View>
                      <View style={styles.mobileHead}>
                        <View style={styles.applicantRow}>
                          {app.ProfileImageURL ? (
                            <Image source={{ uri: app.ProfileImageURL }} style={styles.avatar} />
                          ) : (
                            <View style={[styles.avatar, styles.avatarFallback]}>
                              <Text style={styles.avatarT}>{(app.FullName || 'U')[0].toUpperCase()}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.applicantName}>{app.FullName}</Text>
                            <Text style={styles.applicantEmail}>{app.Email}</Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
                            <Text style={[styles.statusT, { color: statusColor }]}>{app.Status}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.mobileMeta}>
                        <Text style={styles.jobTitle}>{app.JobTitle}</Text>
                        <Text style={styles.jobMeta}>{app.Department} • {app.JobType} • {fmtDate(app.AppliedAt)}</Text>
                      </View>

                      {app.CoverLetter && (
                        <Text style={styles.coverLetter} numberOfLines={2}>{app.CoverLetter}</Text>
                      )}

                      {app.ReviewNotes && (
                        <View style={styles.reviewNotesBox}>
                          <Text style={styles.reviewNotesLabel}>Review Notes:</Text>
                          <Text style={styles.reviewNotesText}>{app.ReviewNotes}</Text>
                        </View>
                      )}

                      <View style={styles.mobileActions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => openResume(app.ResumeURL)}>
                          <Ionicons name="document-text-outline" size={16} color={BRAND} />
                          <Text style={styles.actionBtnT}>View Resume</Text>
                        </TouchableOpacity>
                        {app.LinkedInURL && (
                          <TouchableOpacity style={styles.actionBtn} onPress={() => openResume(app.LinkedInURL)}>
                            <Ionicons name="logo-linkedin" size={16} color="#0077b5" />
                            <Text style={[styles.actionBtnT, { color: '#0077b5' }]}>LinkedIn</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => handleStatusUpdate(app)}>
                          <Ionicons name="create-outline" size={14} color="#fff" />
                          <Text style={styles.actionBtnPrimaryT}>Update Status</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Status Update Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade" onRequestClose={() => setShowStatusModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowStatusModal(false)}>
          <Pressable style={styles.modal} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Update Application</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>

            {selectedApp && (
              <View style={styles.modalAppInfo}>
                <Text style={styles.modalAppName}>{selectedApp.FullName}</Text>
                <Text style={styles.modalAppJob}>{selectedApp.JobTitle}</Text>
              </View>
            )}

            <Text style={styles.label}>Status</Text>
            <View style={styles.statusOptions}>
              {STATUSES.filter(s => s !== 'All').map(s => {
                const color = STATUS_COLORS[s] || colors.textSecondary;
                const isSelected = newStatus === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusOption, isSelected && { backgroundColor: color + '20', borderColor: color }]}
                    onPress={() => setNewStatus(s)}
                  >
                    <Text style={[styles.statusOptionT, isSelected && { color, fontWeight: '700' }]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>Review Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes about this application..."
              placeholderTextColor={colors.textSecondary}
              value={reviewNotes}
              onChangeText={setReviewNotes}
              multiline
              numberOfLines={4}
              maxLength={2000}
              textAlignVertical="top"
            />

            <View style={styles.modalActs}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowStatusModal(false)}>
                <Text style={styles.cancelT}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, updating && { opacity: 0.6 }]} onPress={submitStatusUpdate} disabled={updating}>
                {updating ? <ActivityIndicator size="small" color="#fff" /> : (
                  <><Ionicons name="checkmark-circle-outline" size={16} color="#fff" /><Text style={styles.submitT}>Save</Text></>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (colors, responsive = {}) => {
  const { isMobile = true, isDesktop = false } = responsive;
  const mw = isDesktop ? 1000 : '100%';
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { alignItems: 'center', paddingBottom: 20 },
    centerC: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
    loadingT: { marginTop: 12, color: colors.textSecondary },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 12 },
    emptySub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },

    header: { maxWidth: mw, width: '100%', paddingHorizontal: isMobile ? 16 : 0, marginTop: 20, marginBottom: 16 },
    headerTitle: { fontSize: isMobile ? 22 : 28, fontWeight: '800', color: colors.text },
    headerSub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },

    // Stat cards
    statCards: {
      maxWidth: mw, width: '100%', paddingHorizontal: isMobile ? 16 : 0, marginBottom: 16,
      flexDirection: 'row', gap: 10, flexWrap: 'wrap',
    },
    statCard: {
      flex: 1, minWidth: isMobile ? 80 : 120, backgroundColor: colors.surface, borderRadius: 10,
      padding: 12, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3,
    },
    statCount: { fontSize: 22, fontWeight: '800' },
    statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '500', marginTop: 2 },

    chips: { maxWidth: mw, width: '100%', paddingHorizontal: isMobile ? 16 : 0, marginBottom: 16, flexGrow: 0 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    chipOn: { backgroundColor: BRAND, borderColor: BRAND },
    chipT: { fontSize: 13, fontWeight: '600', color: colors.text },
    chipTOn: { color: '#fff' },

    list: { maxWidth: mw, width: '100%', paddingHorizontal: isMobile ? 16 : 0, gap: isMobile ? 12 : 0 },

    // Desktop table
    tableHeader: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    th: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
    td: { justifyContent: 'center' },

    appCard: {
      backgroundColor: colors.surface, borderRadius: isMobile ? 12 : 0, padding: isMobile ? 16 : 0,
      borderWidth: isMobile ? 1 : 0, borderColor: colors.border,
      ...(isDesktop ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {}),
    },

    applicantRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    avatarFallback: { backgroundColor: BRAND + '20', justifyContent: 'center', alignItems: 'center' },
    avatarT: { fontSize: 16, fontWeight: '700', color: BRAND },
    applicantName: { fontSize: 14, fontWeight: '700', color: colors.text },
    applicantEmail: { fontSize: 12, color: colors.textSecondary },

    jobTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    jobMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
    statusT: { fontSize: 12, fontWeight: '600' },

    dateT: { fontSize: 12, color: colors.textSecondary },

    // Action buttons
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: BRAND + '10', borderWidth: 1, borderColor: BRAND + '25' },
    actionBtnT: { fontSize: 12, fontWeight: '600', color: BRAND },
    actionBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: BRAND },
    actionBtnPrimaryT: { fontSize: 12, fontWeight: '600', color: '#fff' },

    // Mobile layout
    mobileHead: { marginBottom: 10 },
    mobileMeta: { marginBottom: 8 },
    coverLetter: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 8, fontStyle: 'italic' },
    reviewNotesBox: { backgroundColor: colors.background, borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
    reviewNotesLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 2, textTransform: 'uppercase' },
    reviewNotesText: { fontSize: 13, color: colors.text, lineHeight: 18 },
    mobileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },

    // Modal
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modal: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '85%' },
    modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    modalAppInfo: { backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    modalAppName: { fontSize: 15, fontWeight: '700', color: colors.text },
    modalAppJob: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
    statusOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statusOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    statusOptionT: { fontSize: 13, fontWeight: '500', color: colors.text },
    notesInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 14, color: colors.text, backgroundColor: colors.background, minHeight: 80, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
    modalActs: { flexDirection: 'row', gap: 12, marginTop: 20 },
    cancelBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    cancelT: { fontSize: 14, fontWeight: '600', color: colors.text },
    submitBtn: { flex: 1, flexDirection: 'row', gap: 6, padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND },
    submitT: { fontSize: 14, fontWeight: '600', color: '#fff' },
  });
};
