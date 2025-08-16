import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, styles } from '../styles/theme';

export default function LoadingScreen() {
  return (
    <SafeAreaView style={screenStyles.container}>
      <View style={screenStyles.content}>
        <View style={screenStyles.logoContainer}>
          <Ionicons name="briefcase" size={80} color={colors.primary} />
        </View>
        <Text style={screenStyles.title}>NexHire</Text>
        <Text style={screenStyles.subtitle}>Loading your job platform...</Text>
        <ActivityIndicator 
          size="large" 
          color={colors.primary} 
          style={screenStyles.spinner}
        />
      </View>
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  container: {
    ...styles.safeArea,
  },
  content: {
    ...styles.center,
    flex: 1,
    padding: spacing.xl,
  },
  logoContainer: {
    marginBottom: spacing.md,
  },
  title: {
    ...styles.heading1,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...styles.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  spinner: {
    marginTop: spacing.lg,
  },
});