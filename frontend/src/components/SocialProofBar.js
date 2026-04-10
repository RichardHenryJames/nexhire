/**
 * SocialProofBar — Lightweight reusable social proof ticker
 * Shows: "● X active now · Y referrals today · Z blind reviews"
 * Uses daily-seeded deterministic values with natural time-of-day curve
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const TOD = [.08,.06,.05,.04,.04,.06,.12,.25,.45,.65,.82,.95,1.0,.98,.95,.88,.78,.65,.50,.38,.28,.20,.14,.10];
const HOURLY_RATE = [.3,.2,.2,.1,.1,.2,.5,1.2,2.0,3.0,3.8,4.2,4.5,4.3,4.0,3.5,3.0,2.5,2.0,1.5,1.0,.7,.5,.4];
const CUM = HOURLY_RATE.reduce((acc, v) => { acc.push((acc.length ? acc[acc.length - 1] : 0) + v); return acc; }, []);
const DAY_TOTAL = CUM[CUM.length - 1];

function computePulse() {
  const d = new Date();
  const daySeed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const hash = (n) => Math.abs(Math.floor(Math.sin(daySeed * n) * 10000));
  const hr = d.getHours();
  const min = d.getMinutes();
  const curMul = TOD[hr];
  const nxtMul = TOD[(hr + 1) % 24];
  const timeMul = curMul + (nxtMul - curMul) * (min / 60);
  const slot = Math.floor((hr * 60 + min) / 2);
  const jitter = (Math.abs(Math.floor(Math.sin((daySeed + slot) * 7) * 100)) % 7) - 3;
  const baseActive = 40 + (hash(1) % 60);
  const cumNow = (hr > 0 ? CUM[hr - 1] : 0) + HOURLY_RATE[hr] * (min / 60);
  const cumFraction = cumNow / DAY_TOTAL;
  const dailyRefTarget = 150 + (hash(2) % 200);
  return {
    active: Math.max(10, Math.round(baseActive + 140 * timeMul + jitter)),
    referrals: Math.max(5, Math.round(dailyRefTarget * cumFraction)),
    blindReviews: Math.max(6, Math.round((300 + (hash(6) % 200)) * cumFraction)),
  };
}

export default function SocialProofBar({ style }) {
  const { colors } = useTheme();
  const [pulse, setPulse] = useState(computePulse);

  useEffect(() => {
    const iv = setInterval(() => setPulse(computePulse()), 2 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <View style={[styles.dot, { backgroundColor: colors.success }]} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.val, { color: colors.success }]}>{pulse.active}</Text>
        <Text style={[styles.lbl, { color: colors.textSecondary }]}> active now</Text>
        <Text style={[styles.sep, { color: colors.textSecondary }]}> · </Text>
        <Text style={[styles.val, { color: colors.primary }]}>{pulse.referrals}</Text>
        <Text style={[styles.lbl, { color: colors.textSecondary }]}> referrals today</Text>
        <Text style={[styles.sep, { color: colors.textSecondary }]}> · </Text>
        <Text style={[styles.val, { color: '#a78bfa' }]}>{pulse.blindReviews}</Text>
        <Text style={[styles.lbl, { color: colors.textSecondary }]}> blind reviews</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
  scroll: { flexDirection: 'row', alignItems: 'center' },
  val: { fontSize: 12, fontWeight: '700' },
  lbl: { fontSize: 12 },
  sep: { fontSize: 12 },
});
