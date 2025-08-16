import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { colors, typography } from '../styles/theme';

export default function HomeScreen({ navigation }) {
  const { user, isEmployer, isJobSeeker } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalJobs: 0,
    applications: 0,
    views: 0,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch latest data
    setTimeout(() => setRefreshing(false), 1000);
  };

  const StatCard = ({ title, value, icon, color = colors.primary }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statContent}>
        <View style={styles.statHeader}>
          <Ionicons name={icon} size={24} color={color} />
          <Text style={styles.statValue}>{value}</Text>
        </View>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );

  const QuickAction = ({ title, description, icon, onPress, color = colors.primary }) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Welcome back, {user?.firstName || 'User'}!
        </Text>
        <Text style={styles.subGreeting}>
          {isEmployer ? 'Manage your job postings' : 'Find your next opportunity'}
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          {isEmployer ? (
            <>
              <StatCard
                title="Active Jobs"
                value={stats.totalJobs}
                icon="briefcase"
                color={colors.primary}
              />
              <StatCard
                title="Applications"
                value={stats.applications}
                icon="document-text"
                color={colors.success}
              />
              <StatCard
                title="Profile Views"
                value={stats.views}
                icon="eye"
                color={colors.warning}
              />
            </>
          ) : (
            <>
              <StatCard
                title="Applications"
                value={stats.applications}
                icon="document-text"
                color={colors.primary}
              />
              <StatCard
                title="Saved Jobs"
                value={stats.totalJobs}
                icon="bookmark"
                color={colors.success}
              />
              <StatCard
                title="Profile Views"
                value={stats.views}
                icon="eye"
                color={colors.warning}
              />
            </>
          )}
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        {isEmployer ? (
          <>
            <QuickAction
              title="Post a New Job"
              description="Create and publish a job posting"
              icon="add-circle"
              color={colors.primary}
              onPress={() => navigation.navigate('CreateJob')}
            />
            <QuickAction
              title="Manage Applications"
              description="Review and respond to applications"
              icon="people"
              color={colors.success}
              onPress={() => navigation.navigate('Applications')}
            />
            <QuickAction
              title="View Analytics"
              description="See performance metrics"
              icon="analytics"
              color={colors.warning}
              onPress={() => {}}
            />
          </>
        ) : (
          <>
            <QuickAction
              title="Browse Jobs"
              description="Discover new opportunities"
              icon="search"
              color={colors.primary}
              onPress={() => navigation.navigate('Jobs')}
            />
            <QuickAction
              title="My Applications"
              description="Track your job applications"
              icon="document-text"
              color={colors.success}
              onPress={() => navigation.navigate('Applications')}
            />
            <QuickAction
              title="Update Profile"
              description="Keep your profile current"
              icon="person"
              color={colors.warning}
              onPress={() => navigation.navigate('Profile')}
            />
          </>
        )}
      </View>

      <View style={styles.recentContainer}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color={colors.gray400} />
          <Text style={styles.emptyStateText}>No recent activity</Text>
          <Text style={styles.emptyStateSubtext}>
            {isEmployer 
              ? 'Start by posting your first job'
              : 'Begin by browsing available jobs'
            }
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    backgroundColor: colors.primary,
  },
  greeting: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: typography.sizes.md,
    color: colors.white + 'CC',
  },
  statsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 16,
  },
  statsGrid: {
    gap: 12,
  },
  statCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statContent: {
    flex: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  statTitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    fontWeight: typography.weights.medium,
  },
  actionsContainer: {
    padding: 20,
  },
  actionCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
  },
  recentContainer: {
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    textAlign: 'center',
  },
});