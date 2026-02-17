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
import refopenAPI from '../../services/api';
import StreakTracker from './StreakTracker';

// ─── Constants ────────────────────────────────────────────────
const CHECKLIST_KEY = 'refopen_daily_checklist';
const NUDGE_DISMISS_KEY = 'refopen_nudge_dismiss';

// Profile fields matching the backend's 20-field completeness logic exactly
// See: user.service.ts → recalculateApplicantProfileCompleteness()
const PROFILE_FIELDS = [
  // Basic Info (Users table) — 5 fields
  { key: 'FirstName', label: 'First name', category: 'Basic Info' },
  { key: 'LastName', label: 'Last name', category: 'Basic Info' },
  { key: 'Email', label: 'Email', category: 'Basic Info' },
  { key: 'Phone', label: 'Phone number', category: 'Basic Info' },
  { key: 'ProfilePictureURL', label: 'Profile photo', category: 'Basic Info' },
  // Professional Info (Applicants table) — 6 fields
  { key: 'Headline', label: 'Professional headline', category: 'Professional' },
  { key: 'CurrentJobTitle', label: 'Current job title', category: 'Professional' },
  { key: 'CurrentCompanyName', altKey: 'CurrentCompany', label: 'Current company', category: 'Professional' },
  { key: 'TotalExperienceMonths', altKey: 'YearsOfExperience', label: 'Years of experience', category: 'Professional', isNumeric: true },
  { key: 'CurrentLocation', label: 'Location', category: 'Professional' },
  { key: 'Summary', label: 'Professional summary', category: 'Professional' },
  // Education — 3 fields
  { key: 'HighestEducation', label: 'Highest education', category: 'Education' },
  { key: 'FieldOfStudy', label: 'Field of study', category: 'Education' },
  { key: 'Institution', label: 'Institution / University', category: 'Education' },
  // Skills & Preferences — 4 fields
  { key: 'PrimarySkills', label: 'Primary skills', category: 'Skills' },
  { key: 'PreferredJobTypes', label: 'Preferred job types', category: 'Preferences' },
  { key: 'PreferredWorkTypes', label: 'Preferred work types', category: 'Preferences' },
  { key: 'workExperiences', label: 'Work experience entry', category: 'Professional', isArray: true },
  // Bonus — 2 fields
  { key: 'resumes', label: 'Resume upload', category: 'Documents', isArray: true },
  { key: 'LinkedInProfile', label: 'LinkedIn profile', category: 'Social' },
];

const TOTAL_FIELDS = PROFILE_FIELDS.length; // 20, matches backend

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

// ─── Helper: profile completeness (matches backend's 20-field logic) ──
const calcCompleteness = (data) => {
  if (!data) return { percent: 0, missing: PROFILE_FIELDS.map(f => f.label), missingByCategory: {} };
  let filled = 0;
  const missing = [];
  const missingByCategory = {};

  PROFILE_FIELDS.forEach(f => {
    let val;
    if (f.isArray) {
      // workExperiences, resumes — check array length
      val = data[f.key];
      if (Array.isArray(val) && val.length > 0) { filled++; return; }
    } else if (f.isNumeric) {
      // TotalExperienceMonths / YearsOfExperience — check > 0
      val = data[f.key] || data[f.altKey];
      if (val && Number(val) > 0) { filled++; return; }
    } else {
      val = data[f.key] || (f.altKey ? data[f.altKey] : null);
      if (val && String(val).trim().length > 0) { filled++; return; }
    }
    // Not filled
    missing.push(f.label);
    if (!missingByCategory[f.category]) missingByCategory[f.category] = [];
    missingByCategory[f.category].push(f.label);
  });

  return { percent: Math.round((filled / TOTAL_FIELDS) * 100), missing, missingByCategory };
};

// ─── Helper: daily checklist ─────────────────────────────────
const DEFAULT_TASKS = [
  { id: 'browse_jobs', label: 'Browse new jobs', icon: 'briefcase-outline', screen: 'Jobs' },
  { id: 'check_referrals', label: 'Check referral status', icon: 'people-outline', screen: 'MyReferralRequests' },
  { id: 'resume_check', label: 'Analyze your resume', icon: 'document-text-outline', screen: 'ResumeAnalyzer' },
];



// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function EngagementHub({ navigation, dashboardStats = {}, applications = [], savedJobs = 0 }) {
  const { colors } = useTheme();
  const { user, isJobSeeker } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── State ──────────────────────────────────────────────────
  const [checklist, setChecklist] = useState([]);
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);
  const [dismissedNudge, setDismissedNudge] = useState(null);
  const [profileComplete, setProfileComplete] = useState(null); // null = still loading

  // ── Animations ─────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Init ────────────────────────────────────────────────────
  useEffect(() => {
    loadChecklist();
    loadDismissedNudge();
    fetchProfileCompleteness();

    // Entrance animation
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // Re-fetch profile completeness when user comes back to HomeScreen (e.g. from Settings)
  useEffect(() => {
    if (!navigation) return;
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProfileCompleteness();
    });
    return unsubscribe;
  }, [navigation]);

  // Fetch real profile completeness from backend
  const fetchProfileCompleteness = async () => {
    try {
      // Use getApplicantProfile for JobSeekers (same as ProfileScreen) — getProfile() doesn't return completeness
      const res = isJobSeeker && user?.UserID
        ? await refopenAPI.getApplicantProfile(user.UserID)
        : await refopenAPI.getProfile();
      if (res.success && res.data) {
        const backendPercent = res.data.ProfileCompleteness || res.data.profileCompleteness || 0;
        // Also compute missing fields locally for the "add X" hint
        const local = calcCompleteness(res.data);
        setProfileComplete({ percent: backendPercent || local.percent, missing: local.missing });
      } else {
        setProfileComplete(calcCompleteness(user));
      }
    } catch (e) {
      // Fallback to local calc if API fails
      setProfileComplete(calcCompleteness(user));
    }
  };

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

  // Auto-collapse when all done
  useEffect(() => {
    if (allDone) setChecklistCollapsed(true);
  }, [allDone]);

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
    if (!user || !isJobSeeker || !profileComplete) return null;

    const { percent, missing } = profileComplete;

    // Priority 1: Profile photo missing (highest visual impact)
    if (missing.includes('Profile photo') && dismissedNudge !== 'photo') {
      return {
        id: 'photo',
        icon: 'camera',
        color: '#8B5CF6',
        title: 'Add a profile photo',
        subtitle: 'Profiles with photos get 5x more referral responses',
        action: () => navigation.navigate('Profile'),
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

  // ── Fake activity pulse (natural curve, refreshes every 2 min) ──
  // Time-of-day multiplier for "active now": low at night, peaks 11am–3pm, dips evening
  //   hr:  0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23
  const TOD = [.08,.06,.05,.04,.04,.06,.12,.25,.45,.65,.82,.95,1.0,.98,.95,.88,.78,.65,.50,.38,.28,.20,.14,.10];

  // Cumulative activity weights for "referrals today" — running total that ONLY goes up
  // Each hour's weight = how many referrals happen in that hour (proportional to activity)
  // Sum at hour H = total referrals accumulated from 12am to H
  const HOURLY_RATE = [.3,.2,.2,.1,.1,.2,.5,1.2,2.0,3.0,3.8,4.2,4.5,4.3,4.0,3.5,3.0,2.5,2.0,1.5,1.0,.7,.5,.4];
  // Pre-compute cumulative sum: CUM[h] = sum of HOURLY_RATE[0..h-1]
  const CUM = HOURLY_RATE.reduce((acc, v) => { acc.push((acc.length ? acc[acc.length - 1] : 0) + v); return acc; }, []);
  const DAY_TOTAL = CUM[CUM.length - 1]; // ~42.7

  const computePulse = useCallback(() => {
    const d = new Date();
    const daySeed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    const hash = (n) => Math.abs(Math.floor(Math.sin(daySeed * n) * 10000));

    const hr = d.getHours();
    const min = d.getMinutes();

    // ── Active now: uses instantaneous activity curve ──
    const curMul = TOD[hr];
    const nxtMul = TOD[(hr + 1) % 24];
    const timeMul = curMul + (nxtMul - curMul) * (min / 60);

    // Per-2-min jitter so it feels alive (±3 wobble)
    const slot = Math.floor((hr * 60 + min) / 2);
    const jitter = (Math.abs(Math.floor(Math.sin((daySeed + slot) * 7) * 100)) % 7) - 3;

    const baseActive = 20 + (hash(1) % 30); // 20–49 daily base

    // ── Referrals today: cumulative, always increasing ──
    // Interpolate between CUM[hr] and CUM[hr+1] based on minutes
    const cumNow = (hr > 0 ? CUM[hr - 1] : 0) + HOURLY_RATE[hr] * (min / 60);
    const cumFraction = cumNow / DAY_TOTAL; // 0.0 at midnight → 1.0 at end of day
    const dailyRefTarget = 25 + (hash(2) % 30); // 25–54 total referrals by end of day
    const refNow = Math.max(1, Math.round(dailyRefTarget * cumFraction));

    return {
      active:    Math.max(5, Math.round(baseActive + 70 * timeMul + jitter)),  // ~5 at 3am, ~90 at 1pm
      referrals: refNow,                                                        // ~1 at midnight → 25–54 by 11pm, always ↑
      resumesAnalyzed: Math.max(3, Math.round((150 + (hash(3) % 100)) * cumFraction)), // ~3 at midnight → 150–249 by end of day, always ↑
    };
  }, []);

  const [fakePulse, setFakePulse] = useState(computePulse);
  useEffect(() => {
    const interval = setInterval(() => setFakePulse(computePulse()), 2 * 60 * 1000); // refresh every 2 min
    return () => clearInterval(interval);
  }, [computePulse]);

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

      {/* ─── 2. ACTIVITY PULSE (daily-seeded social proof) ──── */}
      <View style={[styles.pulseBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.pulseDot, { backgroundColor: '#10B981' }]} />
        <Text style={[styles.pulseText, { color: colors.gray600 }]}>
          <Text style={{ fontWeight: '700', color: '#10B981' }}>{fakePulse.active}</Text> active now{'  '}·{'  '}
          <Text style={{ fontWeight: '700', color: colors.primary }}>{fakePulse.referrals}</Text> referrals today{'  '}·{'  '}
          <Text style={{ fontWeight: '700', color: '#F59E0B' }}>{fakePulse.resumesAnalyzed}</Text> resumes analyzed today
        </Text>
      </View>

      {/* ─── 3. PROFILE COMPLETION (only if loaded & < 100%) ── */}
      {profileComplete && profileComplete.percent < 100 && (
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
                    : profileComplete.percent < 90
                      ? `${profileComplete.missing.length} field${profileComplete.missing.length > 1 ? 's' : ''} left for 100%`
                      : 'Almost perfect! Just 1-2 more fields'
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
          {/* Missing fields hint — show top 3 missing items */}
          {profileComplete.missing.length > 0 && (
            <View style={styles.missingFieldsRow}>
              {profileComplete.missing.slice(0, 3).map((field, i) => (
                <View key={i} style={[styles.missingTag, { backgroundColor: colors.background }]}>
                  <Ionicons name="add-circle-outline" size={12} color={colors.gray500} />
                  <Text style={[styles.missingTagText, { color: colors.gray500 }]}>{field}</Text>
                </View>
              ))}
              {profileComplete.missing.length > 3 && (
                <Text style={[styles.missingMore, { color: colors.gray400 }]}>
                  +{profileComplete.missing.length - 3} more
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* ─── 4. DAILY CHECKLIST ───────────────────────────── */}
      <View style={[styles.checklistCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.checklistHeader}
          onPress={() => setChecklistCollapsed(prev => !prev)}
          activeOpacity={0.8}
        >
          <View style={styles.checklistTitleRow}>
            <Text style={[styles.checklistTitle, { color: colors.text }]}>
              {allDone ? '🎉 All done for today!' : '📋 Daily Goals'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.checklistBadge, {
                backgroundColor: allDone ? '#10B981' : colors.primary + '20',
              }]}>
                <Text style={[styles.checklistBadgeText, {
                  color: allDone ? '#fff' : colors.primary,
                }]}>
                  {completedCount}/{totalTasks}
                </Text>
              </View>
              <Ionicons
                name={checklistCollapsed || allDone ? 'chevron-down' : 'chevron-up'}
                size={16}
                color={colors.gray400}
              />
            </View>
          </View>
          {!allDone && !checklistCollapsed && (
            <Text style={[styles.checklistSub, { color: colors.gray500 }]}>
              Complete daily tasks to build career momentum
            </Text>
          )}
        </TouchableOpacity>

        {!checklistCollapsed && checklist.map((task, i) => (
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
    paddingTop: 8,
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
  missingFieldsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    alignItems: 'center',
  },
  missingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  missingTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  missingMore: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
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
