/**
 * Blind Review Inbox Screen (Referrer Side)
 * 
 * Verified referrers see anonymized profiles from candidates targeting
 * their company. They can rate, give feedback, and say whether they'd refer.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SubScreenHeader from '../../components/SubScreenHeader';
import { useTheme } from '../../contexts/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useAuth } from '../../contexts/AuthContext';
import refopenAPI from '../../services/api';

const getScoreColor = (score) => {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#F97316';
  return '#EF4444';
};

export default function BlindReviewInboxScreen({ navigation }) {
  const { colors } = useTheme();
  const { isDesktop } = useResponsive();
  const { isAuthenticated } = useAuth();

  const [tab, setTab] = useState('pending'); // 'pending' | 'history'
  const [pending, setPending] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Review form
  const [wouldRefer, setWouldRefer] = useState(null);
  const [rating, setRating] = useState(0);
  const [profileFit, setProfileFit] = useState(0);
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Load pending reviews
  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await refopenAPI.apiCall('/tools/blind-review/pending');
      if (res?.success) {
        setPending(res.data || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  // Load referrer's own review history
  const loadMyReviews = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await refopenAPI.apiCall('/tools/blind-review/my-reviews');
      if (res?.success) {
        setMyReviews(res.data || []);
      }
    } catch { /* silent */ }
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadPending();
  }, [isAuthenticated]);

  // Submit review
  const handleSubmitReview = useCallback(async () => {
    if (wouldRefer === null) { setError('Please select whether you would refer this person.'); return; }
    if (rating === 0) { setError('Please provide an overall rating.'); return; }

    setSubmitting(true);
    setError('');

    try {
      const res = await refopenAPI.apiCall(`/tools/blind-review/respond/${selectedRequest.requestId}`, {
        method: 'POST',
        body: JSON.stringify({
          wouldRefer,
          overallRating: rating,
          profileFit: profileFit || undefined,
          strengthsFeedback: strengths.trim() || undefined,
          weaknessesFeedback: weaknesses.trim() || undefined,
          suggestions: suggestions.trim() || undefined,
        }),
      });

      if (res?.success) {
        setSubmitted(true);
        // Remove from pending list
        setPending(prev => prev.filter(p => p.requestId !== selectedRequest.requestId));
      } else {
        setError(res?.error || 'Failed to submit review.');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    }
    setSubmitting(false);
  }, [selectedRequest, wouldRefer, rating, profileFit, strengths, weaknesses, suggestions]);

  const resetForm = useCallback(() => {
    setSelectedRequest(null);
    setWouldRefer(null);
    setRating(0);
    setProfileFit(0);
    setStrengths('');
    setWeaknesses('');
    setSuggestions('');
    setSubmitted(false);
    setError('');
  }, []);

  const s = useMemo(() => makeStyles(colors, isDesktop), [colors, isDesktop]);

  // ── Review Form ──────────────────────────────────────────
  const reviewForm = selectedRequest ? (
    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {submitted ? (
        <View style={s.successWrap}>
          <Ionicons name="checkmark-circle" size={64} color="#10B981" />
          <Text style={s.successTitle}>Review Submitted!</Text>
          <Text style={s.successSub}>Thank you for your honest feedback. It helps candidates improve.</Text>
          <TouchableOpacity style={s.backBtn} onPress={resetForm} activeOpacity={0.7}>
            <Text style={s.backBtnText}>Review More Profiles</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Anonymity reminder */}
          <View style={s.anonBannerSmall}>
            <Ionicons name="eye-off" size={14} color="#10B981" />
            <Text style={s.anonBannerSmallText}>You're reviewing anonymously. The candidate will never know who you are.</Text>
          </View>

          {/* Profile Card */}
          <View style={s.profileCard}>
            <View style={s.profileHeader}>
              <View style={[s.aiScoreBadge, { backgroundColor: getScoreColor(selectedRequest.aiScore || 50) + '15' }]}>
                <Text style={[s.aiScoreText, { color: getScoreColor(selectedRequest.aiScore || 50) }]}>
                  AI: {selectedRequest.aiScore || '-'}
                </Text>
              </View>
              <Text style={s.profileRole}>Targeting: {selectedRequest.targetRole}</Text>
            </View>

            {selectedRequest.anonymizedProfile && (
              <View style={s.profileBody}>
                <Text style={s.profileSummary}>{selectedRequest.anonymizedProfile.summary}</Text>

                <View style={s.profileRow}>
                  <Text style={s.profileLabel}>Experience</Text>
                  <Text style={s.profileValue}>{selectedRequest.anonymizedProfile.experienceYears} years</Text>
                </View>
                <View style={s.profileRow}>
                  <Text style={s.profileLabel}>Education</Text>
                  <Text style={s.profileValue}>
                    {selectedRequest.anonymizedProfile.educationLevel}
                    {selectedRequest.anonymizedProfile.fieldOfStudy !== 'Not specified' ? ` in ${selectedRequest.anonymizedProfile.fieldOfStudy}` : ''}
                  </Text>
                </View>

                {selectedRequest.anonymizedProfile.skills?.length > 0 && (
                  <View style={s.profileRow}>
                    <Text style={s.profileLabel}>Skills</Text>
                    <View style={s.chipWrap}>
                      {selectedRequest.anonymizedProfile.skills.map((sk, i) => (
                        <View key={i} style={s.chip}><Text style={s.chipText}>{sk}</Text></View>
                      ))}
                    </View>
                  </View>
                )}

                {selectedRequest.anonymizedProfile.recentRoles?.length > 0 && (
                  <View style={[s.profileRow, { flexDirection: 'column' }]}>
                    <Text style={s.profileLabel}>Work Experience</Text>
                    {selectedRequest.anonymizedProfile.recentRoles.map((r, i) => (
                      <View key={i} style={{ marginTop: i > 0 ? 6 : 4 }}>
                        <Text style={s.profileValue}>
                          {r.title}{r.company ? ` at ${r.company}` : ''}{r.durationMonths ? ` (${r.durationMonths >= 12 ? Math.round(r.durationMonths / 12) + 'y' : r.durationMonths + 'mo'})` : ''}{r.industry ? ` · ${r.industry}` : ''}
                        </Text>
                        {r.highlights?.length > 0 && r.highlights.map((h, hi) => (
                          <Text key={hi} style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1, paddingLeft: 8 }}>• {h}</Text>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
                {selectedRequest.anonymizedProfile.projects?.length > 0 && (
                  <View style={[s.profileRow, { flexDirection: 'column' }]}>
                    <Text style={s.profileLabel}>Projects</Text>
                    {selectedRequest.anonymizedProfile.projects.map((p, i) => (
                      <View key={i} style={{ marginTop: i > 0 ? 4 : 2 }}>
                        <Text style={[s.profileValue, { fontWeight: '600' }]}>{p.name}</Text>
                        {p.description ? <Text style={{ fontSize: 12, color: colors.textSecondary }}>{p.description}</Text> : null}
                        {p.technologies?.length > 0 && (
                          <View style={[s.chipWrap, { marginTop: 2 }]}>
                            {p.technologies.map((t, ti) => (
                              <View key={ti} style={s.chip}><Text style={s.chipText}>{t}</Text></View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Would Refer */}
          <View style={s.formSection}>
            <Text style={s.formLabel}>Would you refer this person? <Text style={{ color: colors.error || '#EF4444' }}>*</Text></Text>
            <View style={s.referToggle}>
              <TouchableOpacity
                style={[s.referBtn, wouldRefer === true && { backgroundColor: '#10B981', borderColor: '#10B981' }]}
                onPress={() => setWouldRefer(true)} activeOpacity={0.7}
              >
                <Ionicons name="thumbs-up" size={20} color={wouldRefer === true ? '#fff' : colors.textSecondary} />
                <Text style={[s.referBtnText, wouldRefer === true && { color: '#fff' }]}>Yes, I'd refer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.referBtn, wouldRefer === false && { backgroundColor: '#EF4444', borderColor: '#EF4444' }]}
                onPress={() => setWouldRefer(false)} activeOpacity={0.7}
              >
                <Ionicons name="thumbs-down" size={20} color={wouldRefer === false ? '#fff' : colors.textSecondary} />
                <Text style={[s.referBtnText, wouldRefer === false && { color: '#fff' }]}>No</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Overall Rating */}
          <View style={s.formSection}>
            <Text style={s.formLabel}>Overall rating <Text style={{ color: colors.error || '#EF4444' }}>*</Text></Text>
            <View style={s.starRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setRating(n)} activeOpacity={0.7}>
                  <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={32} color={n <= rating ? '#F59E0B' : colors.border} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Profile Fit */}
          <View style={s.formSection}>
            <Text style={s.formLabel}>How well does this profile fit the role? <Text style={s.optionalHint}>(optional)</Text></Text>
            <View style={s.starRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setProfileFit(n)} activeOpacity={0.7}>
                  <Ionicons name={n <= profileFit ? 'star' : 'star-outline'} size={28} color={n <= profileFit ? '#3B82F6' : colors.border} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Text feedback */}
          <View style={s.formSection}>
            <Text style={s.formLabel}>What are their strengths? <Text style={s.optionalHint}>(optional)</Text></Text>
            <TextInput style={s.textArea} value={strengths} onChangeText={setStrengths}
              placeholder="e.g. Strong system design skills, relevant experience..."
              placeholderTextColor={colors.gray400} multiline numberOfLines={3} textAlignVertical="top" />
          </View>

          <View style={s.formSection}>
            <Text style={s.formLabel}>What needs improvement? <Text style={s.optionalHint}>(optional)</Text></Text>
            <TextInput style={s.textArea} value={weaknesses} onChangeText={setWeaknesses}
              placeholder="e.g. Lacks cloud experience, no leadership roles..."
              placeholderTextColor={colors.gray400} multiline numberOfLines={3} textAlignVertical="top" />
          </View>

          <View style={s.formSection}>
            <Text style={s.formLabel}>Your suggestions <Text style={s.optionalHint}>(optional)</Text></Text>
            <TextInput style={s.textArea} value={suggestions} onChangeText={setSuggestions}
              placeholder="e.g. Get AWS certified, highlight project impact more..."
              placeholderTextColor={colors.gray400} multiline numberOfLines={3} textAlignVertical="top" />
          </View>

          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.error || '#EF4444'} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={s.submitWrap}>
            <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmitReview} disabled={submitting} activeOpacity={0.85}>
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#fff" />
                  <Text style={s.submitBtnText}>Submit Review</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={s.submitHint}>Your identity is never revealed to the candidate</Text>
          </View>
        </>
      )}
    </ScrollView>
  ) : null;

  // ── RENDER ───────────────────────────────────────────────
  return (
    <View style={s.container}>
      <SubScreenHeader title="Review Inbox" fallbackTab="Services" onBack={selectedRequest ? resetForm : undefined} />

      {selectedRequest ? reviewForm : (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.inboxHeader}>
            <Ionicons name="people" size={24} color={colors.primary} />
            <Text style={s.inboxTitle}>Blind Review</Text>
            <Text style={s.inboxSub}>Review anonymous candidate profiles at your company</Text>
          </View>

          {/* Anonymity assurance */}
          <View style={s.anonBanner}>
            <Ionicons name="shield-checkmark" size={16} color="#10B981" />
            <Text style={s.anonBannerText}>Your identity is completely hidden. Candidates only see "Reviewer 1", "Reviewer 2" etc. They never see your name, role, or any identifying info.</Text>
          </View>

          {/* Tabs */}
          <View style={s.tabRow}>
            <TouchableOpacity style={[s.tabBtn, tab === 'pending' && s.tabBtnActive]} onPress={() => setTab('pending')} activeOpacity={0.7}>
              <Text style={[s.tabBtnText, tab === 'pending' && s.tabBtnTextActive]}>
                Pending{pending.length > 0 ? ` (${pending.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.tabBtn, tab === 'history' && s.tabBtnActive]} onPress={() => { setTab('history'); if (!myReviews.length) loadMyReviews(); }} activeOpacity={0.7}>
              <Text style={[s.tabBtnText, tab === 'history' && s.tabBtnTextActive]}>My Reviews</Text>
            </TouchableOpacity>
          </View>

          {tab === 'pending' ? (
            <>
              {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
          ) : pending.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="checkmark-done-outline" size={48} color={colors.border} />
              <Text style={s.emptyTitle}>No profiles to review</Text>
              <Text style={s.emptySub}>When candidates request a blind review at your company, they'll appear here.</Text>
            </View>
          ) : (
            pending.map(item => (
              <TouchableOpacity key={item.requestId} style={s.pendingCard} onPress={() => setSelectedRequest(item)} activeOpacity={0.7}>
                <View style={s.pendingRow}>
                  <View style={s.pendingLeft}>
                    <Text style={s.pendingRole}>{item.targetRole}</Text>
                    <Text style={s.pendingMeta}>
                      {item.anonymizedProfile?.experienceYears || '?'} yrs exp · {item.anonymizedProfile?.skills?.length || 0} skills
                    </Text>
                    <Text style={s.pendingDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View style={s.pendingRight}>
                    {item.aiScore !== null && (
                      <View style={[s.pendingScoreBadge, { backgroundColor: getScoreColor(item.aiScore) + '15' }]}>
                        <Text style={[s.pendingScoreText, { color: getScoreColor(item.aiScore) }]}>{item.aiScore}</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity style={s.refreshBtn} onPress={loadPending} activeOpacity={0.7}>
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={s.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
            </>
          ) : (
            /* ── My Reviews History Tab ── */
            <>
              {historyLoading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
              ) : myReviews.length === 0 ? (
                <View style={s.emptyWrap}>
                  <Ionicons name="document-text-outline" size={48} color={colors.border} />
                  <Text style={s.emptyTitle}>No reviews yet</Text>
                  <Text style={s.emptySub}>Reviews you submit will appear here for your records.</Text>
                </View>
              ) : (
                myReviews.map((rev, idx) => (
                  <View key={rev.responseId || idx} style={s.historyCard}>
                    <View style={s.historyCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.historyCardRole}>{rev.targetRole}</Text>
                        <Text style={s.historyCardOrg}>{rev.organizationName}</Text>
                      </View>
                      <View style={s.historyCardBadge}>
                        <Ionicons name={rev.wouldRefer ? 'thumbs-up' : 'thumbs-down'} size={14} color={rev.wouldRefer ? '#10B981' : '#EF4444'} />
                        <Text style={[s.historyCardBadgeText, { color: rev.wouldRefer ? '#10B981' : '#EF4444' }]}>
                          {rev.wouldRefer ? 'Would refer' : 'Would not refer'}
                        </Text>
                      </View>
                    </View>
                    <View style={s.historyCardStats}>
                      <View style={s.historyCardStat}>
                        <Text style={s.historyCardStatLabel}>Your Rating</Text>
                        <View style={{ flexDirection: 'row', gap: 2 }}>
                          {[1,2,3,4,5].map(n => (
                            <Ionicons key={n} name={n <= rev.overallRating ? 'star' : 'star-outline'} size={14} color={n <= rev.overallRating ? '#F59E0B' : colors.border} />
                          ))}
                        </View>
                      </View>
                      {rev.profileFit > 0 && (
                        <View style={s.historyCardStat}>
                          <Text style={s.historyCardStatLabel}>Profile Fit</Text>
                          <Text style={s.historyCardStatValue}>{rev.profileFit}/5</Text>
                        </View>
                      )}
                      <View style={s.historyCardStat}>
                        <Text style={s.historyCardStatLabel}>Date</Text>
                        <Text style={s.historyCardStatValue}>{new Date(rev.createdAt).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    {(rev.strengths || rev.weaknesses || rev.suggestions) && (
                      <View style={s.historyCardFeedback}>
                        {rev.strengths ? <Text style={s.historyFeedbackText}><Text style={{ fontWeight: '700', color: '#10B981' }}>Strengths:</Text> {rev.strengths}</Text> : null}
                        {rev.weaknesses ? <Text style={s.historyFeedbackText}><Text style={{ fontWeight: '700', color: '#F59E0B' }}>Improve:</Text> {rev.weaknesses}</Text> : null}
                        {rev.suggestions ? <Text style={s.historyFeedbackText}><Text style={{ fontWeight: '700', color: '#3B82F6' }}>Suggestions:</Text> {rev.suggestions}</Text> : null}
                      </View>
                    )}
                  </View>
                ))
              )}
              <TouchableOpacity style={s.refreshBtn} onPress={loadMyReviews} activeOpacity={0.7}>
                <Ionicons name="refresh" size={16} color={colors.primary} />
                <Text style={s.refreshBtnText}>Refresh</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (c, isDesktop) => ({
  container: { flex: 1, backgroundColor: c.background },
  scroll: { flex: 1 },

  inboxHeader: { padding: 20, alignItems: 'center', gap: 6 },
  inboxTitle: { fontSize: 20, fontWeight: '800', color: c.text },
  inboxSub: { fontSize: 13, color: c.textSecondary, textAlign: 'center', maxWidth: 320 },

  anonBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 16, marginBottom: 16, padding: 12, backgroundColor: '#10B98110', borderRadius: 12, borderWidth: 1, borderColor: '#10B98120' },
  anonBannerText: { fontSize: 12, color: '#10B981', flex: 1, lineHeight: 17 },
  anonBannerSmall: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#10B98108', borderRadius: 8 },
  anonBannerSmallText: { fontSize: 11, color: '#10B981', flex: 1 },

  emptyWrap: { alignItems: 'center', padding: 40, marginTop: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginTop: 12 },
  emptySub: { fontSize: 13, color: c.textSecondary, marginTop: 4, textAlign: 'center', maxWidth: 280 },

  pendingCard: { marginHorizontal: 16, marginBottom: 10, padding: 14, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border },
  pendingRow: { flexDirection: 'row', alignItems: 'center' },
  pendingLeft: { flex: 1 },
  pendingRole: { fontSize: 15, fontWeight: '700', color: c.text },
  pendingMeta: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  pendingDate: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
  pendingRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingScoreBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pendingScoreText: { fontSize: 13, fontWeight: '800' },
  pendingReviews: { fontSize: 12, color: c.textSecondary },

  refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginTop: 12, paddingVertical: 10 },
  refreshBtnText: { fontSize: 13, fontWeight: '600', color: c.primary },

  // Tabs
  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  tabBtn: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabBtnActive: { backgroundColor: c.primary },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  tabBtnTextActive: { color: '#fff' },

  // History cards
  historyCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  historyCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: c.border + '50' },
  historyCardRole: { fontSize: 14, fontWeight: '700', color: c.text },
  historyCardOrg: { fontSize: 12, color: c.textSecondary, marginTop: 1 },
  historyCardBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  historyCardBadgeText: { fontSize: 11, fontWeight: '700' },
  historyCardStats: { flexDirection: 'row', padding: 12, gap: 16 },
  historyCardStat: { gap: 2 },
  historyCardStatLabel: { fontSize: 10, fontWeight: '600', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  historyCardStatValue: { fontSize: 13, fontWeight: '600', color: c.text },
  historyCardFeedback: { paddingHorizontal: 14, paddingBottom: 14, gap: 6 },
  historyFeedbackText: { fontSize: 12, color: c.textSecondary, lineHeight: 17 },

  // Review form
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  backRowText: { fontSize: 14, fontWeight: '600', color: c.primary },

  profileCard: { marginHorizontal: 16, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, marginBottom: 16, overflow: 'hidden' },
  profileHeader: { padding: 14, backgroundColor: c.primary + '08', borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiScoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  aiScoreText: { fontSize: 12, fontWeight: '800' },
  profileRole: { fontSize: 14, fontWeight: '700', color: c.text, flex: 1 },
  profileBody: { padding: 14 },
  profileSummary: { fontSize: 13, color: c.text, lineHeight: 19, marginBottom: 12, fontStyle: 'italic' },
  profileRow: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.border + '50', gap: 8 },
  profileLabel: { fontSize: 12, fontWeight: '600', color: c.textSecondary, width: 80 },
  profileValue: { fontSize: 13, color: c.text, flex: 1 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 },
  chip: { backgroundColor: c.primary + '10', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  chipText: { fontSize: 11, fontWeight: '600', color: c.primary },

  formSection: { paddingHorizontal: 16, marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 8 },
  optionalHint: { fontSize: 11, fontWeight: '400', color: c.textSecondary },

  referToggle: { flexDirection: 'row', gap: 10 },
  referBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  referBtnText: { fontSize: 14, fontWeight: '600', color: c.text },

  starRow: { flexDirection: 'row', gap: 4 },

  textArea: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: c.text, minHeight: 80, textAlignVertical: 'top' },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12, padding: 12, backgroundColor: (c.error || '#EF4444') + '10', borderRadius: 10, borderWidth: 1, borderColor: (c.error || '#EF4444') + '20' },
  errorText: { fontSize: 13, color: c.error || '#EF4444', flex: 1 },

  submitWrap: { paddingHorizontal: 16, alignItems: 'center' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, width: '100%', paddingVertical: 16, borderRadius: 14 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  submitHint: { fontSize: 11, color: c.textSecondary, marginTop: 8 },

  successWrap: { alignItems: 'center', padding: 40 },
  successTitle: { fontSize: 20, fontWeight: '800', color: '#10B981', marginTop: 16 },
  successSub: { fontSize: 14, color: c.textSecondary, marginTop: 8, textAlign: 'center' },
  backBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: c.primary + '10' },
  backBtnText: { fontSize: 14, fontWeight: '600', color: c.primary },
});
