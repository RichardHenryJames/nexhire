import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import TermsContent from '../legal/TermsContent';
import PrivacyContent from '../legal/PrivacyContent';

/* ───────────────────────────────────────────────
 *  TermsConsentModal
 *
 *  Blocking modal with inline reader.
 *  view: 'main' → consent card
 *  view: 'terms' / 'privacy' → full legal text inside the same modal
 *
 *  DPDPA 2023 compliant (explicit re-consent + backend audit log).
 * ─────────────────────────────────────────────── */

export default function TermsConsentModal({ visible, onAccept, loading }) {
  const { colors } = useTheme();
  const [checked, setChecked] = useState(false);
  const [view, setView] = useState('main'); // 'main' | 'terms' | 'privacy'
  const scrollRef = useRef(null);
  const s = createStyles(colors);

  const openDoc = (which) => {
    setView(which);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
  };

  const goBack = () => setView('main');

  // ── Reader view (Terms or Privacy full text) ──
  if (view !== 'main') {
    return (
      <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={goBack}>
        <View style={s.overlay}>
          <View style={[s.card, s.readerCard]}>
            {/* Reader header */}
            <View style={s.readerHeader}>
              <TouchableOpacity onPress={goBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={s.readerTitle}>
                {view === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
              </Text>
              <View style={{ width: 22 }} />
            </View>

            {/* Scrollable legal text */}
            <ScrollView ref={scrollRef} style={s.readerBody} showsVerticalScrollIndicator>
              {view === 'terms' ? <TermsContent compact /> : <PrivacyContent compact />}
            </ScrollView>

            {/* Back to consent */}
            <TouchableOpacity style={s.readerBackBtn} onPress={goBack} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={16} color={colors.primary} />
              <Text style={[s.linkLabel, { color: colors.primary }]}>Back to consent</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Main consent view ──
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.iconCircle}>
            <Ionicons name="shield-checkmark" size={28} color={colors.primary} />
          </View>

          <Text style={s.title}>We've updated our policies</Text>

          <View style={s.links}>
            <TouchableOpacity style={s.linkRow} onPress={() => openDoc('terms')} activeOpacity={0.6}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              <Text style={s.linkLabel}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={s.divider} />
            <TouchableOpacity style={s.linkRow} onPress={() => openDoc('privacy')} activeOpacity={0.6}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
              <Text style={s.linkLabel}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.checkRow} onPress={() => setChecked(!checked)} activeOpacity={0.7}>
            <View style={[s.checkbox, checked && s.checkboxOn]}>
              {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={s.checkLabel}>
              I agree to the{' '}
              <Text style={s.inline} onPress={() => openDoc('terms')}>Terms</Text>
              {' & '}
              <Text style={s.inline} onPress={() => openDoc('privacy')}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btn, (!checked || loading) && s.btnOff]}
            onPress={onAccept}
            disabled={!checked || loading}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>Continue</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════
 *  Styles
 * ═══════════════════════════════════════════════ */

const createStyles = (colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },

    // ── Card (shared) ──
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingVertical: 32,
      paddingHorizontal: 24,
      width: '100%',
      maxWidth: 380,
      alignItems: 'center',
      ...(Platform.OS === 'web'
        ? { boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }
        : { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 16 }),
    },

    // ── Main consent view ──
    iconCircle: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: (colors.primary || '#4F46E5') + '14',
      justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 16 },
    subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    links: { width: '100%', backgroundColor: colors.gray100 || colors.background, borderRadius: 12, marginBottom: 20, overflow: 'hidden' },
    linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 12 },
    linkLabel: { flex: 1, fontSize: 12, fontWeight: '500', color: colors.text },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 14 },
    checkRow: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 2, marginBottom: 16, gap: 10 },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
    checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkLabel: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    inline: { color: colors.primary, fontWeight: '600' },
    btn: { width: '100%', backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
    btnOff: { opacity: 0.45 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

    // ── Reader view ──
    readerCard: {
      paddingVertical: 0, paddingHorizontal: 0,
      maxWidth: 520, maxHeight: '90%',
      alignItems: 'stretch',
    },
    readerHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    readerTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center', flex: 1 },
    readerBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    readerBackBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    },
  });
