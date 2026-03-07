import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import refopenAPI from '../../services/api';
import SubScreenHeader from '../../components/SubScreenHeader';

/**
 * NotificationPreferencesScreen — Standalone notification settings page.
 * Extracted from SettingsScreen modal for direct navigation from Notifications sidebar.
 */
export default function NotificationPreferencesScreen({ navigation }) {
  const { colors } = useTheme();

  const [prefs, setPrefs] = useState({
    EmailEnabled: true,
    PushEnabled: true,
    ReferralRequestEmail: true,
    ReferralClaimedEmail: true,
    ReferralVerifiedEmail: true,
    MessageReceivedEmail: true,
    WeeklyDigestEmail: true,
    DailyJobRecommendationEmail: true,
    ReferrerNotificationEmail: true,
    MarketingEmail: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUserChanged, setHasUserChanged] = useState(false);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    setLoading(true);
    try {
      const response = await refopenAPI.getNotificationPreferences();
      if (response?.success && response?.preferences) {
        setPrefs(response.preferences);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePrefs = async () => {
    setSaving(true);
    try {
      await refopenAPI.updateNotificationPreferences(prefs);
    } catch (error) {
      console.error('Error saving notification preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save when user toggles something (debounced)
  useEffect(() => {
    if (loading || !hasUserChanged) return;
    const timer = setTimeout(() => savePrefs(), 800);
    return () => clearTimeout(timer);
  }, [prefs, hasUserChanged]);

  const Toggle = ({ icon, label, desc, value, onValueChange }) => (
    <View style={[styles.toggleRow, { borderBottomColor: colors.border + '40' }]}>
      <View style={styles.toggleLeft}>
        <Ionicons name={icon} size={20} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text>
          {desc && <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>{desc}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { setHasUserChanged(true); onValueChange(v); }}
        trackColor={{ false: colors.gray300, true: colors.primaryLight }}
        thumbColor={value ? colors.primary : colors.gray100}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubScreenHeader 
        title="Notification Preferences" 
        fallbackTab="Home"
        rightContent={
          saving ? <ActivityIndicator size="small" color={colors.primary} /> : null
        }
      />
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={[styles.content, Platform.OS === 'web' && { maxWidth: 700, width: '100%', alignSelf: 'center' }]}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading preferences...</Text>
            </View>
          ) : (
            <>
              {/* Global */}
              <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Global Settings</Text>
                <Toggle
                  icon="mail-outline"
                  label="Email Notifications"
                  desc="Master toggle for all email notifications"
                  value={prefs.EmailEnabled}
                  onValueChange={(value) => {
                    if (value) {
                      // Turn ON all email toggles
                      setPrefs(prev => ({
                        ...prev, EmailEnabled: true,
                        ReferralRequestEmail: true, ReferralClaimedEmail: true,
                        ReferralVerifiedEmail: true, MessageReceivedEmail: true,
                        WeeklyDigestEmail: true, DailyJobRecommendationEmail: true,
                        ReferrerNotificationEmail: true, MarketingEmail: true,
                      }));
                    } else {
                      // Turn OFF all email toggles
                      setPrefs(prev => ({
                        ...prev, EmailEnabled: false,
                        ReferralRequestEmail: false, ReferralClaimedEmail: false,
                        ReferralVerifiedEmail: false, MessageReceivedEmail: false,
                        WeeklyDigestEmail: false, DailyJobRecommendationEmail: false,
                        ReferrerNotificationEmail: false, MarketingEmail: false,
                      }));
                    }
                  }}
                />
                <Toggle
                  icon="notifications-outline"
                  label="Push Notifications"
                  value={prefs.PushEnabled}
                  onValueChange={(v) => setPrefs(p => ({ ...p, PushEnabled: v }))}
                />
              </View>

              {/* Job Seekers */}
              <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>For Job Seekers</Text>
                <Toggle
                  icon="briefcase-outline"
                  label="Job Recommendations"
                  desc="Personalized job picks based on your preferences"
                  value={prefs.DailyJobRecommendationEmail}
                  onValueChange={(v) => setPrefs(p => ({ ...p, DailyJobRecommendationEmail: v, ...(v ? { EmailEnabled: true } : {}) }))}
                />
                <Toggle
                  icon="checkmark-circle-outline"
                  label="Referral Submitted"
                  desc="When someone submits a referral for you"
                  value={prefs.ReferralClaimedEmail}
                  onValueChange={(v) => setPrefs(p => ({ ...p, ReferralClaimedEmail: v, ...(v ? { EmailEnabled: true } : {}) }))}
                />
              </View>

              {/* Referrers */}
              <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>For Referrers</Text>
                <Toggle
                  icon="hand-right-outline"
                  label="New Referral Requests"
                  desc="When someone needs a referral at your company"
                  value={prefs.ReferralRequestEmail}
                  onValueChange={(v) => setPrefs(p => ({ ...p, ReferralRequestEmail: v, ...(v ? { EmailEnabled: true } : {}) }))}
                />
                <Toggle
                  icon="trophy-outline"
                  label="Referral Verified"
                  desc="When you earn rewards for a referral"
                  value={prefs.ReferralVerifiedEmail}
                  onValueChange={(v) => setPrefs(p => ({ ...p, ReferralVerifiedEmail: v, ...(v ? { EmailEnabled: true } : {}) }))}
                />
                <Toggle
                  icon="people-outline"
                  label="Referrer Notifications"
                  desc="Get notified about open referral requests"
                  value={prefs.ReferrerNotificationEmail}
                  onValueChange={(v) => setPrefs(p => ({ ...p, ReferrerNotificationEmail: v, ...(v ? { EmailEnabled: true } : {}) }))}
                />
              </View>

              {/* Other */}
              <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Other</Text>
                <Toggle
                  icon="megaphone-outline"
                  label="Marketing & Promotional"
                  desc="Tips, updates, and special offers"
                  value={prefs.MarketingEmail}
                  onValueChange={(v) => setPrefs(p => ({ ...p, MarketingEmail: v, ...(v ? { EmailEnabled: true } : {}) }))}
                />
                <Toggle
                  icon="calendar-outline"
                  label="Weekly Digest"
                  desc="Summary of activity and opportunities"
                  value={prefs.WeeklyDigestEmail}
                  onValueChange={(v) => setPrefs(p => ({ ...p, WeeklyDigestEmail: v, ...(v ? { EmailEnabled: true } : {}) }))}
                />
              </View>

              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
