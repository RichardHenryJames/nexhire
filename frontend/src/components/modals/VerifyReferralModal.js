/**
 * VerifyReferralModal — Shared verification confirmation modal
 * 
 * Used by: MyReferralRequestsScreen, ReferralTrackingScreen
 * 
 * Props:
 *  - visible: boolean
 *  - jobTitle: string (job title for display)
 *  - companyName: string (optional, for child referrals from specific company)
 *  - proofFileURL: string (optional)
 *  - proofDescription: string (optional)
 *  - onVerify: (verified: boolean) => void
 *  - onClose: () => void
 */
import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Platform,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

export default function VerifyReferralModal({
  visible,
  jobTitle,
  companyName,
  proofFileURL,
  proofDescription,
  isOpenToAny,
  onVerify,
  onClose,
}) {
  const { colors } = useTheme();

  const openProof = () => {
    if (!proofFileURL) return;
    if (Platform.OS === 'web') window.open(proofFileURL, '_blank');
    else Linking.openURL(proofFileURL);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="checkmark-done-circle" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text, flex: 1 }]}>Verify Referral</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Message */}
          <Text style={[styles.message, { color: colors.text }]}>
            {companyName
              ? <>Has the referrer from <Text style={{ fontWeight: '700' }}>{companyName}</Text> successfully referred you for <Text style={{ fontWeight: '700' }}>{jobTitle || 'this job'}</Text>?</>
              : <>Has the referrer successfully referred you for <Text style={{ fontWeight: '700' }}>{jobTitle || 'this job'}</Text>?</>
            }
          </Text>

          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10, lineHeight: 17 }}>Please confirm whether you received a legitimate referral.</Text>

          {/* Proof Section */}
          {(proofDescription || proofFileURL) && (
            <View style={[styles.proofBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.proofLabel, { color: colors.textSecondary }]}>Referral Proof</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {proofDescription && (
                  <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Ionicons name="chatbubble-outline" size={12} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '600', marginLeft: 4 }}>Message</Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 12, fontStyle: 'italic', lineHeight: 16 }} numberOfLines={3}>
                      "{proofDescription}"
                    </Text>
                  </View>
                )}
                {proofFileURL && (
                  <TouchableOpacity
                    style={{ flex: proofDescription ? 0 : 1, backgroundColor: colors.primary + '10', borderRadius: 8, padding: 8, alignItems: 'center', justifyContent: 'center', minWidth: 80 }}
                    onPress={openProof}
                  >
                    <Ionicons name="document-attach" size={20} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '600', marginTop: 4 }}>View Proof</Text>
                    <Ionicons name="open-outline" size={12} color={colors.primary} style={{ marginTop: 2 }} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Info */}
          <View style={[styles.infoBox, { backgroundColor: colors.primary + '08' }]}>
            <Ionicons name="information-circle" size={18} color={colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 17, flex: 1, marginLeft: 8 }}>
              Your feedback helps us verify authentic referrers and improve the platform for everyone.
            </Text>
          </View>

          {/* Dispute Warning — hidden for Open to Any referrals */}
          {!isOpenToAny && (
          <View style={[styles.warningBox, { backgroundColor: colors.warning + '0D', borderColor: colors.warning + '35' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="warning" size={15} color={colors.warning} />
              <Text style={{ color: colors.warning, fontWeight: '700', fontSize: 12, marginLeft: 6 }}>Before clicking 'No'</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 12, lineHeight: 18 }}>
              This will raise a dispute. Our team will review the proof and respond within 2 working days. If found invalid, you'll get a full refund.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, backgroundColor: colors.surface, borderRadius: 6, padding: 8 }}>
              <Text style={{ fontSize: 13, marginRight: 6 }}>💡</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 16, flex: 1 }}>
                Some companies don't send confirmation emails. Check your <Text style={{ fontWeight: '700', color: colors.text }}>Spam</Text> or <Text style={{ fontWeight: '700', color: colors.text }}>Junk</Text> folder before disputing.
              </Text>
            </View>
          </View>
          )}

          </ScrollView>

          {/* Actions - Fixed at bottom */}
          <View style={[styles.actions, { paddingTop: 12 }]}>
            {!isOpenToAny && (
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.error + '10', borderColor: colors.error + '30', borderWidth: 1 }]}
              onPress={() => onVerify(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="alert-circle" size={16} color={colors.error} style={{ marginRight: 6 }} />
              <Text style={{ color: colors.error, fontWeight: '700', fontSize: 13 }}>Raise Dispute</Text>
            </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.success, flex: isOpenToAny ? 1 : undefined }]}
              onPress={() => onVerify(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Yes, Verify</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: 14,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  proofBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    marginBottom: 10,
  },
  proofLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  warningBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});
