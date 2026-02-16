/**
 * StreakTracker.js — Daily login streak tracker
 * 
 * Shows a 🔥 flame counter that increments every day the user opens the app.
 * Streak resets if a day is missed. Stores data in AsyncStorage.
 * 
 * Features:
 * - Daily streak counter with flame animation
 * - Milestone celebrations (3, 7, 14, 30, 60, 100 days)
 * - Visual progress bar to next milestone
 * - Motivational messages based on streak length
 */
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { typography } from '../../styles/theme';

const STREAK_KEY = 'refopen_streak_data';

const MILESTONES = [3, 7, 14, 30, 60, 100];

const STREAK_MESSAGES = [
  { min: 0, max: 0, msg: "Start your streak today! 🚀", sub: "Open RefOpen daily to build momentum" },
  { min: 1, max: 2, msg: "You're getting started! 💪", sub: "Keep it up — consistency wins" },
  { min: 3, max: 6, msg: "3-day streak! You're on fire! 🔥", sub: "Top candidates check daily" },
  { min: 7, max: 13, msg: "1 week streak! Unstoppable! ⚡", sub: "You're ahead of 80% of job seekers" },
  { min: 14, max: 29, msg: "2 weeks strong! 🏆", sub: "Your consistency is paying off" },
  { min: 30, max: 59, msg: "30-day streak! Legend! 👑", sub: "You're in the top 5% of active users" },
  { min: 60, max: 99, msg: "60 days! Absolute machine! 🦾", sub: "Employers notice this dedication" },
  { min: 100, max: Infinity, msg: "100+ days! You're a RefOpen OG! 💎", sub: "Nothing can stop you" },
];

const getStreakMessage = (streak) => {
  return STREAK_MESSAGES.find(s => streak >= s.min && streak <= s.max) || STREAK_MESSAGES[0];
};

const getNextMilestone = (streak) => {
  return MILESTONES.find(m => m > streak) || null;
};

export default function StreakTracker({ compact = false }) {
  const { colors } = useTheme();
  const [streakData, setStreakData] = useState({ streak: 0, lastVisit: null, longestStreak: 0 });
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneReached, setMilestoneReached] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkAndUpdateStreak();
  }, []);

  useEffect(() => {
    if (streakData.streak > 0) {
      // Pulse animation for flame
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
      // Glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
        ])
      ).start();
    }
  }, [streakData.streak]);

  const checkAndUpdateStreak = async () => {
    try {
      const stored = await AsyncStorage.getItem(STREAK_KEY);
      const today = new Date().toDateString();
      
      if (stored) {
        const data = JSON.parse(stored);
        const lastVisit = data.lastVisit;
        
        if (lastVisit === today) {
          // Already visited today — don't increment
          setStreakData(data);
          return;
        }
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();
        
        let newStreak;
        if (lastVisit === yesterdayStr) {
          // Consecutive day — increment streak
          newStreak = (data.streak || 0) + 1;
        } else {
          // Missed a day — reset to 1
          newStreak = 1;
        }
        
        const longestStreak = Math.max(newStreak, data.longestStreak || 0);
        const newData = { streak: newStreak, lastVisit: today, longestStreak };
        
        await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(newData));
        setStreakData(newData);
        
        // Check if milestone reached
        if (MILESTONES.includes(newStreak)) {
          setMilestoneReached(newStreak);
          setShowMilestone(true);
          setTimeout(() => setShowMilestone(false), 5000);
        }
      } else {
        // First ever visit
        const newData = { streak: 1, lastVisit: today, longestStreak: 1 };
        await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(newData));
        setStreakData(newData);
      }
    } catch (err) {
      console.warn('Streak tracker error:', err);
    }
  };

  const { streak, longestStreak } = streakData;
  const msg = getStreakMessage(streak);
  const nextMilestone = getNextMilestone(streak);
  const progress = nextMilestone ? (streak / nextMilestone) : 1;

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,165,0,0.0)', 'rgba(255,165,0,0.15)'],
  });

  if (compact) {
    // Compact mode: just flame + number for header bar
    return (
      <View style={[compactStyles.container, { backgroundColor: streak > 0 ? '#FF6B0020' : colors.surface }]}>
        <Animated.Text style={[compactStyles.flame, { transform: [{ scale: pulseAnim }] }]}>
          {streak > 0 ? '🔥' : '❄️'}
        </Animated.Text>
        <Text style={[compactStyles.count, { color: streak > 0 ? '#FF6B00' : colors.gray500 }]}>
          {streak}
        </Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: '#FF6B00' }]}>
      {/* Milestone celebration overlay */}
      {showMilestone && (
        <View style={styles.milestoneOverlay}>
          <Text style={styles.milestoneEmoji}>🎉</Text>
          <Text style={[styles.milestoneText, { color: '#FF6B00' }]}>
            {milestoneReached}-Day Streak!
          </Text>
        </View>
      )}

      <View style={styles.topRow}>
        {/* Flame + Count */}
        <View style={styles.flameSection}>
          <Animated.Text style={[styles.flame, { transform: [{ scale: pulseAnim }] }]}>
            {streak > 0 ? '🔥' : '❄️'}
          </Animated.Text>
          <View>
            <Text style={[styles.streakCount, { color: streak > 0 ? '#FF6B00' : colors.gray500 }]}>
              {streak}
            </Text>
            <Text style={[styles.streakLabel, { color: colors.gray500 }]}>
              {streak === 1 ? 'day' : 'days'}
            </Text>
          </View>
        </View>

        {/* Message */}
        <View style={styles.messageSection}>
          <Text style={[styles.messageText, { color: colors.text }]} numberOfLines={1}>
            {msg.msg}
          </Text>
          <Text style={[styles.messageSub, { color: colors.gray500 }]} numberOfLines={1}>
            {msg.sub}
          </Text>
        </View>

        {/* Best streak badge */}
        {longestStreak > streak && (
          <View style={[styles.bestBadge, { backgroundColor: '#FFD70020' }]}>
            <Text style={styles.bestText}>Best: {longestStreak}</Text>
          </View>
        )}
      </View>

      {/* Progress to next milestone */}
      {nextMilestone && (
        <View style={styles.progressSection}>
          <View style={[styles.progressBg, { backgroundColor: colors.background }]}>
            <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
          </View>
          <Text style={[styles.progressLabel, { color: colors.gray400 }]}>
            {nextMilestone - streak} days to {nextMilestone}-day milestone
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const compactStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2,
  },
  flame: { fontSize: 16 },
  count: { fontSize: 14, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  milestoneOverlay: {
    position: 'absolute', top: -10, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, zIndex: 10,
  },
  milestoneEmoji: { fontSize: 16 },
  milestoneText: { fontSize: 12, fontWeight: '800' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flame: { fontSize: 28 },
  streakCount: { fontSize: 24, fontWeight: '900', lineHeight: 26 },
  streakLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  messageSection: { flex: 1 },
  messageText: { fontSize: 13, fontWeight: '700' },
  messageSub: { fontSize: 11, marginTop: 1 },
  bestBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  bestText: { fontSize: 10, fontWeight: '700', color: '#B8860B' },
  progressSection: { marginTop: 10 },
  progressBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#FF6B00',
  },
  progressLabel: { fontSize: 10, marginTop: 4, textAlign: 'right' },
});
