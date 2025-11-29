import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import refopenAPI from '../../services/api';
import JobCard from '../../components/jobs/JobCard';
import { colors, typography } from '../../styles/theme';

export default function AIRecommendedJobsScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [aiJobs, setAiJobs] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAllAIJobs();
  }, []);

  const loadAllAIJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const userId = user?.UserID || user?.userId || user?.id;
      
      if (!userId) {
        setError({ type: 'auth', message: 'User not found. Please login again.' });
        setLoading(false);
        return;
      }

      console.log('🤖 Loading AI personalized jobs (₹100 will be deducted)');
      
      // Call the backend API that deducts ₹100 and returns AI jobs
      const result = await refopenAPI.getAIRecommendedJobs(50);
      
      if (result.success && result.data) {
        console.log(`🤖 Loaded ${result.data.length} AI personalized jobs`);
        setAiJobs(result.data);
        setError(null);
      } else {
        setError({ type: 'no-data', message: result.message || 'No jobs found' });
        setAiJobs([]);
      }
    } catch (error) {
      console.error('🤖 Error loading AI personalized jobs:', error);
      
      // Handle insufficient balance error
      if (error.message?.includes('Insufficient') || error.message?.includes('balance')) {
        setError({ type: 'insufficient-balance', message: 'You need ₹100 in your wallet to access AI-recommended jobs.' });
      } else {
        setError({ type: 'error', message: 'Failed to load AI recommendations. Please try again.' });
      }
      setAiJobs([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <View style={styles.headerIcon}>
            <Ionicons name="bulb" size={20} color={colors.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Recommended Jobs</Text>
            <Text style={styles.headerSubtitle}>Personalized for you</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading AI recommendations...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <View style={[styles.errorIconContainer, error.type === 'insufficient-balance' && styles.warningIconContainer]}>
            <Ionicons 
              name={error.type === 'insufficient-balance' ? 'wallet-outline' : 'alert-circle-outline'} 
              size={48} 
              color={error.type === 'insufficient-balance' ? colors.warning : colors.danger} 
            />
          </View>
          <Text style={styles.errorTitle}>
            {error.type === 'insufficient-balance' ? 'Insufficient Balance' : 'Something Went Wrong'}
          </Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity 
              style={styles.errorSecondaryButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.errorSecondaryButtonText}>Go Back</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.errorPrimaryButton, error.type === 'insufficient-balance' && styles.rechargeButton]}
              onPress={() => {
                if (error.type === 'insufficient-balance') {
                  navigation.navigate('Wallet');
                } else {
                  loadAllAIJobs();
                }
              }}
            >
              <Text style={styles.errorPrimaryButtonText}>
                {error.type === 'insufficient-balance' ? 'Recharge Wallet' : 'Try Again'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : aiJobs.length > 0 ? (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoCard}>
            <Ionicons name="sparkles" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              {aiJobs.length} AI-matched jobs for you
            </Text>
          </View>

          {/* Job Cards - same as JobsScreen */}
          {aiJobs.map((job, index) => (
            <JobCard 
              key={job.JobID || index} 
              job={job}
              onPress={() => navigation.navigate('JobDetails', { jobId: job.JobID })}
              showAIBadge={true}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={48} color={colors.gray400} />
          <Text style={styles.emptyTitle}>No Matches Found</Text>
          <Text style={styles.emptyText}>
            Update your profile with more skills and experience for better recommendations.
          </Text>
          <TouchableOpacity 
            style={styles.updateProfileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.updateProfileButtonText}>Update Profile</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.gray600,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.danger + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  warningIconContainer: {
    backgroundColor: colors.warning + '15',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    paddingHorizontal: 20,
  },
  errorSecondaryButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  errorSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  errorPrimaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rechargeButton: {
    backgroundColor: colors.warning,
  },
  errorPrimaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  emptyTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  updateProfileButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  updateProfileButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
