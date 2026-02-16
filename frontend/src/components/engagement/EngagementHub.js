/**
 * EngagementHub.js — The retention engine for RefOpen HomeScreen
 * 
 * Renders engagement hooks between header and content:
 * 1. Personalized greeting with time-of-day context
 * 2. Daily streak (imports existing StreakTracker)
 * 3. Profile completion progress card (drives to Settings)
 * 4. Daily action checklist (AsyncStorage, resets daily)
 * 5. Activity pulse — social proof banner
 * 6. Smart nudges — context-aware cards based on user state
 */
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { typography } from '../../styles/theme';
import StreakTracker from './StreakTracker';

// ─── Constants ────────────────────────────────────────────────
const CHECKLIST_KEY = 'refopen_daily_checklist';
const ACTIVITY_PULSE_KEY = 'refopen_activity_pulse';
const NUDGE_DISMISS_KEY = 'refopen_nudge_dismiss';

// Profile fields we track for completeness
const PROFILE_FIELDS = [
  { key: 'FirstName', label: 'First name', weight: 1 },
  { key: 'LastName', label: 'Last name', weight: 1 },
  { key: 'Email', label: 'Email', weight: 1 },
  { key: 'Phone', label: 'Phone number', weight: 2 },
  { key: 'ProfilePictureURL', label: 'Profile photo', weight: 3 },
  { key: 'Headline', label: 'Professional headline', weight: 2 },
  { key: 'CurrentJobTitle', label: 'Current job title', weight: 2 },
  { key: 'CurrentCompany', label: 'Current company', weight: 2 },
  { key: 'Location', label: 'Location', weight: 1 },
  { key: 'Summary', label: 'Professional summary', weight: 2 },
];

const TOTAL_WEIGHT = PROFILE_FIELDS.reduce((s, f) => s + f.weight, 0);

// ─── Helper: time-of-day greeting ─────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 5) return { text: 'Burning the midnight oil', emoji: '🌙' };
  if (h < 12) return { text: 'Good morning', emoji: '☀️' };
  if (h < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  if (h < 21) return { text: 'Good evening', emoji: '🌆' };
  return { text: 'Night owl mode', emoji: '🦉' };
};

// ─── Helper: motivational subtitles ──────────────────────────
const SUBTITLES = [
  "Your next opportunity is one step away",
  "Consistency beats talent — keep showing up",
  "Great careers are built one day at a time",
  "Today might be the day you land your dream role",
  "The job market rewards the prepared — that's you",
  "Every referral request gets you closer",
  "Your profile is your first impression — make it count",
];

const getSubtitle = (user) => {
  // Deterministic "random" based on date so it changes daily
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return SUBTITLES[dayOfYear % SUBTITLES.length];
};

// ─── Helper: profile completeness ────────────────────────────
const calcCompleteness = (user) => {
  if (!user) return { percent: 0, missing: PROFILE_FIELDS.map(f => f.label) };
  let filled = 0;
  const missing = [];
  PROFILE_FIELDS.forEach(f => {
    const val = user[f.key];
    if (val && val !== '' && val !== null && val !== undefined) {
      filled += f.weight;
    } else {
      missing.push(f.label);
    }
  });
  return { percent: Math.round((filled / TOTAL_WEIGHT) * 100), missing };
};

// ─── Helper: daily checklist ─────────────────────────────────
const DEFAULT_TASKS = [
  { id: 'browse_jobs', label: 'Browse new jobs', icon: 'briefcase-outline', screen: 'Jobs' },
  { id: 'check_referrals', label: 'Check referral status', icon: 'people-outline', screen: 'MyReferralRequests' },
  { id: 'resume_check', label: 'Analyze your resume', icon: 'document-text-outline', screen: 'ResumeAnalyzer' },
  { id: 'explore_companies', label: 'Explore a company', icon: 'business-outline', screen: 'Jobs' },
];

// ─── Helper: activity pulse (simulated social proof) ────────
const generatePulseData = () => {
  const hour = new Date().getHours();
  const dayFactor = hour >= 9 && hour <= 18 ? 1.5 : 0.8; // busier during work hours
  return {
    referralsToday: Math.floor((15 + Math.random() * 35) * dayFactor),
    hiredThisWeek: Math.floor(5 + Math.random() * 15),
    activeNow: Math.floor((50 + Math.random() * 200) * dayFactor),
    newJobs24h: Math.floor(20 + Math.random() * 80),
  };
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function EngagementHub({ navigation, dashboardStats = {}, applications = [], savedJobs = 0 }) {
  const { colors } = useTheme();
  const { user, isJobSeeker } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── State ──────────────────────────────────────────────────
  const [checklist, setChecklist] = useState([]);
  const [pulseData, setPulseData] = useState(null);
  const [dismissedNudge, setDismissedNudge] = useState(null);
  const [profileComplete, setProfileComplete] = useState({ percent: 0, missing: [] });

  // ── Animations ─────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Init ────────────────────────────────────────────────────
  useEffect(() => {
    loadChecklist();
    loadPulseData();
    loadDismissedNudge();

    // Entrance animation
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    // Pulse dot animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    setProfileComplete(calcCompleteness(user));
  }, [user]);

  // ── Checklist logic ────────────────────────────────────────
  const loadChecklist = async () => {
    try {
      const stored = await AsyncStorage.getItem(CHECKLIST_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const today = new Date().toDateString();
        if (data.date === today) {
          setChecklist(data.tasks);
          return;
        }
      }
      // New day → fresh checklist
      const fresh = DEFAULT_TASKS.map(t => ({ ...t, done: false }));
      setChecklist(fresh);
      await AsyncStorage.setItem(CHECKLIST_KEY, JSON.stringify({ date: new Date().toDateString(), tasks: fresh }));
    } catch (e) {
      setChecklist(DEFAULT_TASKS.map(t => ({ ...t, done: false })));
    }
  };

  const toggleTask = async (taskId) => {
    const updated = checklist.map(t =>
      t.id === taskId ? { ...t, done: !t.done } : t
    );
    setChecklist(updated);
    await AsyncStorage.setItem(CHECKLIST_KEY, JSON.stringify({ date: new Date().toDateString(), tasks: updated }));

    // Navigate to the screen for that task
    const task = DEFAULT_TASKS.find(t => t.id === taskId);
    if (task && !checklist.find(t => t.id === taskId)?.done) {
      navigation.navigate(task.screen);
    }
  };

  const completedCount = checklist.filter(t => t.done).length;
  const totalTasks = checklist.length;
  const allDone = completedCount === totalTasks && totalTasks > 0;

  // ── Pulse data ─────────────────────────────────────────────
  const loadPulseData = async () => {
    try {
      const stored = await AsyncStorage.getItem(ACTIVITY_PULSE_KEY);
      const now = Date.now();
      if (stored) {
        const data = JSON.parse(stored);
        // Refresh every 30 minutes
        if (now - data.timestamp < 30 * 60 * 1000) {
          setPulseData(data.pulse);
          return;
        }
      }
      const pulse = generatePulseData();
      setPulseData(pulse);
      await AsyncStorage.setItem(ACTIVITY_PULSE_KEY, JSON.stringify({ pulse, timestamp: now }));
    } catch (e) {
      setPulseData(generatePulseData());
    }
  };

  // ── Nudge dismiss ──────────────────────────────────────────
  const loadDismissedNudge = async () => {
    try {
      const stored = await AsyncStorage.getItem(NUDGE_DISMISS_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.date === new Date().toDateString()) {
          setDismissedNudge(data.nudgeId);
        }
      }
    } catch (e) { /* ignore */ }
  };

  const dismissNudge = async (nudgeId) => {
    setDismissedNudge(nudgeId);
    await AsyncStorage.setItem(NUDGE_DISMISS_KEY, JSON.stringify({ nudgeId, date: new Date().toDateString() }));
  };

  // ── Smart nudge selection ──────────────────────────────────
  const getSmartNudge = useCallback(() => {
    if (!user || !isJobSeeker) return null;

    const { percent, missing } = profileComplete;

    // Priority 1: Profile photo missing (highest visual impact)
    if (missing.includes('Profile photo') && dismissedNudge !== 'photo') {
      return {
        id: 'photo',
        icon: 'camera',
        color: '#8B5CF6',
        title: 'Add a profile photo',
        subtitle: 'Profiles with photos get 5x more referral responses',
        action: () => navigation.navigate('Settings'),
        actionLabel: 'Add Photo',
      };
    }

    // Priority 2: Very low completeness
    if (percent < 40 && dismissedNudge !== 'complete_profile') {
      return {
        id: 'complete_profile',
        icon: 'person-add',
        color: '#F59E0B',
        title: `Your profile is only ${percent}% complete`,
        subtitle: `Add your ${missing[0]?.toLowerCase()} to stand out to referrers`,
        action: () => navigation.navigate('Settings'),
        actionLabel: 'Complete Profile',
      };
    }

    // Priority 3: No applications yet
    if (applications.length === 0 && dismissedNudge !== 'first_apply') {
      return {
        id: 'first_apply',
        icon: 'rocket',
        color: '#10B981',
        title: "You haven't applied anywhere yet",
        subtitle: 'Take the leap — browse jobs and send your first application',
        action: () => navigation.navigate('Jobs'),
        actionLabel: 'Browse Jobs',
      };
    }

    // Priority 4: Has saved jobs but no applications
    if (savedJobs > 0 && applications.length === 0 && dismissedNudge !== 'saved_not_applied') {
      return {
        id: 'saved_not_applied',
        icon: 'bookmark',
        color: '#3B82F6',
        title: `You saved ${savedJobs} jobs but haven't applied`,
        subtitle: "Ready to take the leap? Your saved jobs are waiting",
        action: () => navigation.navigate('SavedJobs'),
        actionLabel: 'View Saved',
      };
    }

    return null;
  }, [user, isJobSeeker, profileComplete, applications, savedJobs, dismissedNudge, navigation]);

  const nudge = getSmartNudge();
  const firstName = user?.FirstName || 'there';
  const greeting = getGreeting();

  if (!user || !isJobSeeker) return null;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

      {/* ─── 1. GREETING + STREAK ROW ─────────────────────── */}
      <View style={styles.greetingRow}>
        <View style={styles.greetingText}>
          <Text style={[styles.greetingMain, { color: colors.text }]}>
            {greeting.emoji} {greeting.text}, {firstName}
          </Text>
          <Text style={[styles.greetingSub, { color: colors.gray500 }]}>
            {getSubtitle(user)}
          </Text>
        </View>
        <StreakTracker compact />
      </View>

      {/* ─── 2. ACTIVITY PULSE ────────────────────────────── */}
      {pulseData && (
        <View style={[styles.pulseBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Animated.View style={[styles.pulseDot, { opacity: pulseAnim, backgroundColor: '#10B981' }]} />
          <Text style={[styles.pulseText, { color: colors.gray600 }]}>
            <Text style={{ fontWeight: '700', color: '#10B981' }}>{pulseData.activeNow}</Text> active now{'  '}·{'  '}
            <Text style={{ fontWeight: '700', color: colors.primary }}>{pulseData.referralsToday}</Text> referrals today{'  '}·{'  '}
            <Text style={{ fontWeight: '700', color: '#F59E0B' }}>{pulseData.hiredThisWeek}</Text> hired this week
          </Text>
        </View>
      )}

      {/* ─── 3. PROFILE COMPLETION (only if < 80%) ────────── */}
      {profileComplete.percent < 80 && (
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.85}
        >
          <View style={styles.profileCardTop}>
            <View style={styles.profileProgress}>
              {/* Circular progress indicator */}
              <View style={[styles.progressCircle, { borderColor: colors.border }]}>
                <View style={[styles.progressCircleInner, {
                  borderColor: profileComplete.percent < 30 ? '#EF4444'
                    : profileComplete.percent < 60 ? '#F59E0B' : '#10B981',
                  borderTopColor: 'transparent',
                  transform: [{ rotate: `${(profileComplete.percent / 100) * 360}deg` }],
                }]} />
                <Text style={[styles.progressPercent, { color: colors.text }]}>
                  {profileComplete.percent}%
                </Text>
              </View>
            </View>
            <View style={styles.profileCardInfo}>
              <Text style={[styles.profileCardTitle, { color: colors.text }]}>
                Complete your profile
              </Text>
              <Text style={[styles.profileCardSub, { color: colors.gray500 }]}>
                {profileComplete.percent < 30
                  ? 'Completed profiles get 5x more referral responses'
                  : profileComplete.percent < 60
                    ? `Add your ${profileComplete.missing[0]?.toLowerCase()} to boost visibility`
                    : 'Almost there! A few more fields for maximum impact'
                }
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </View>
          {/* Mini progress bar */}
          <View style={[styles.profileProgressBar, { backgroundColor: colors.background }]}>
            <View style={[styles.profileProgressFill, {
              width: `${profileComplete.percent}%`,
              backgroundColor: profileComplete.percent < 30 ? '#EF4444'
                : profileComplete.percent < 60 ? '#F59E0B' : '#10B981',
            }]} />
          </View>
        </TouchableOpacity>
      )}

      {/* ─── 4. DAILY CHECKLIST ───────────────────────────── */}
      <View style={[styles.checklistCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.checklistHeader}>
          <View style={styles.checklistTitleRow}>
            <Text style={[styles.checklistTitle, { color: colors.text }]}>
              {allDone ? '🎉 All done for today!' : '📋 Daily Goals'}
            </Text>
            <View style={[styles.checklistBadge, {
              backgroundColor: allDone ? '#10B981' : colors.primary + '20',
            }]}>
              <Text style={[styles.checklistBadgeText, {
                color: allDone ? '#fff' : colors.primary,
              }]}>
                {completedCount}/{totalTasks}
              </Text>
            </View>
          </View>
          {!allDone && (
            <Text style={[styles.checklistSub, { color: colors.gray500 }]}>
              Complete daily tasks to build career momentum
            </Text>
          )}
        </View>

        {checklist.map((task, i) => (
          <TouchableOpacity
            key={task.id}
            style={[
              styles.checklistItem,
              i === checklist.length - 1 && { borderBottomWidth: 0 },
              task.done && styles.checklistItemDone,
            ]}
            onPress={() => toggleTask(task.id)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.checkbox,
              { borderColor: task.done ? '#10B981' : colors.gray400 },
              task.done && { backgroundColor: '#10B981' },
            ]}>
              {task.done && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <Ionicons
              name={task.icon}
              size={18}
              color={task.done ? colors.gray400 : colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={[
              styles.checklistLabel,
              { color: task.done ? colors.gray400 : colors.text },
              task.done && styles.checklistLabelDone,
            ]}>
              {task.label}
            </Text>
            {!task.done && (
              <Ionicons name="chevron-forward" size={14} color={colors.gray400} style={{ marginLeft: 'auto' }} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── 5. SMART NUDGE ───────────────────────────────── */}
      {nudge && (
        <View style={[styles.nudgeCard, { backgroundColor: nudge.color + '10', borderColor: nudge.color + '30' }]}>
          <TouchableOpacity
            style={styles.nudgeDismiss}
            onPress={() => dismissNudge(nudge.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color={colors.gray400} />
          </TouchableOpacity>
          <View style={[styles.nudgeIcon, { backgroundColor: nudge.color + '20' }]}>
            <Ionicons name={nudge.icon} size={22} color={nudge.color} />
          </View>
          <View style={styles.nudgeContent}>
            <Text style={[styles.nudgeTitle, { color: colors.text }]}>{nudge.title}</Text>
            <Text style={[styles.nudgeSub, { color: colors.gray500 }]}>{nudge.subtitle}</Text>
          </View>
          <TouchableOpacity
            style={[styles.nudgeButton, { backgroundColor: nudge.color }]}
            onPress={nudge.action}
          >
            <Text style={styles.nudgeButtonText}>{nudge.actionLabel}</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const createStyles = (colors) => StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 12,
  },

  // ─── Greeting ──────────────────────────────────────────────
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingText: {
    flex: 1,
    marginRight: 12,
  },
  greetingMain: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },

  // ─── Activity Pulse ────────────────────────────────────────
  pulseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  pulseText: {
    fontSize: 11,
    flex: 1,
  },

  // ─── Profile Completion ────────────────────────────────────
  profileCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  profileCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileProgress: {
    position: 'relative',
  },
  progressCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleInner: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '800',
  },
  profileCardInfo: {
    flex: 1,
  },
  profileCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  profileCardSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  profileProgressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  profileProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // ─── Checklist ─────────────────────────────────────────────
  checklistCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  checklistHeader: {
    padding: 14,
    paddingBottom: 8,
  },
  checklistTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checklistTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  checklistBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  checklistBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  checklistSub: {
    fontSize: 11,
    marginTop: 3,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border || '#e5e7eb',
  },
  checklistItemDone: {
    opacity: 0.6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checklistLabel: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  checklistLabelDone: {
    textDecorationLine: 'line-through',
  },

  // ─── Nudge ─────────────────────────────────────────────────
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  nudgeDismiss: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 1,
  },
  nudgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeContent: {
    flex: 1,
    paddingRight: 16,
  },
  nudgeTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  nudgeSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  nudgeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  nudgeButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
