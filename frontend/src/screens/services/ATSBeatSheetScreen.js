import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import refopenAPI from '../../services/api';

const SERVICE_NAME = 'ATSBeatSheet';

export default function ATSBeatSheetScreen({ navigation }) {
  const { colors } = useTheme();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkInterest = async () => {
      try {
        const result = await refopenAPI.apiCall('/services/interests');
        if (result?.interests?.includes(SERVICE_NAME)) {
          setSubmitted(true);
        }
      } catch (err) {
        // Silently fail
      } finally {
        setChecking(false);
      }
    };
    checkInterest();
  }, []);

  const handleInterest = async () => {
    setLoading(true);
    try {
      const result = await refopenAPI.apiCall('/services/interest', { method: 'POST', body: JSON.stringify({ serviceName: SERVICE_NAME }) });
      if (result?.success || result?.alreadyExists) {
        setSubmitted(true);
      }
    } catch (err) {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => { if (navigation.canGoBack()) { navigation.goBack(); } else { navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Services' } }); } }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Resume Builder</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Lock Content */}
      <View style={styles.content}>
        <LinearGradient
          colors={['#7C3AED', '#A78BFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.lockCircle}
        >
          <Ionicons name="lock-closed" size={64} color="rgba(255,255,255,0.9)" />
        </LinearGradient>

        <Text style={[styles.title, { color: colors.text }]}>Resume Builder</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          AI creates a polished, job-ready resume from your work experience — tailored to any role with ATS-optimized formatting.
        </Text>

        {!checking && (
          submitted ? (
            <View style={[styles.submittedBtn, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text style={[styles.submittedText, { color: colors.primary }]}>Interest Submitted</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.interestBtn, { backgroundColor: colors.primary }]}
              onPress={handleInterest}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="hand-right" size={18} color="#fff" />
                  <Text style={styles.interestBtnText}>I'm Interested</Text>
                </>
              )}
            </TouchableOpacity>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  lockCircle: { width: 140, height: 140, borderRadius: 70, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24, maxWidth: 340 },
  submittedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 25, marginTop: 24,
  },
  submittedText: { fontSize: 15, fontWeight: '700' },
  interestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 25, marginTop: 24,
  },
  interestBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
