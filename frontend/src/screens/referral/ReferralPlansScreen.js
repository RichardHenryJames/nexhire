import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { typography } from '../../styles/theme';

export default function ReferralPlansScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [eligibility, setEligibility] = useState(null);

  // Add navigation check at component load
  useEffect(() => {
    loadPlansAndSubscription();
  }, []);

  const loadPlansAndSubscription = async () => {
    try {
      setLoading(true);
      const [plansRes, subscriptionRes, eligibilityRes] = await Promise.all([
        refopenAPI.getReferralPlans(),
        refopenAPI.getCurrentReferralSubscription(),
        refopenAPI.checkReferralEligibility()
      ]);

      if (plansRes.success) {
        setPlans(plansRes.data || []);
      }

      if (subscriptionRes.success) {
        setCurrentSubscription(subscriptionRes.data);
      }

      if (eligibilityRes.success) {
        setEligibility(eligibilityRes.data);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      Alert.alert('Error', 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (plan) => {
    if (plan.Price === 0) {
      // Free plan - no payment needed
      Alert.alert('Free Plan', 'You are already on the free plan with 5 referrals per day.');
      return;
    }

    // Navigate to payment screen with selected plan
    navigation.navigate('Payment', { 
      plan: plan,
      returnScreen: 'ReferralPlans'
    });
  };

  const getPlanFeatures = (plan) => {
    const features = [
      `${plan.ReferralsPerDay} referral requests per day`,
    ];

    if (plan.Name.toLowerCase().includes('free')) {
      features.push('Basic support');
      features.push('Standard processing time');
    } else if (plan.Name.toLowerCase().includes('basic') || plan.Name.toLowerCase().includes('weekly')) {
      features.push('Email support');
      features.push('Priority processing');
      features.push('Basic analytics');
    } else if (plan.Name.toLowerCase().includes('pro') || plan.Name.toLowerCase().includes('monthly')) {
      features.push('Priority support');
      features.push('Fast processing');
      features.push('Advanced analytics');
      features.push('Multiple resume uploads');
    } else if (plan.Name.toLowerCase().includes('elite') || plan.Name.toLowerCase().includes('premium') || plan.Name.toLowerCase().includes('unlimited')) {
      features.push('24/7 Premium support');
      features.push('Instant processing');
      features.push('Complete analytics dashboard');
      features.push('Unlimited resume uploads');
      features.push('Job matching recommendations');
      
      if (plan.Name.toLowerCase().includes('lifetime') || plan.Name.toLowerCase().includes('unlimited')) {
        features.push('Lifetime access');
        features.push('All future features included');
      }
    }

    return features;
  };

  const getDurationText = (durationDays) => {
    if (durationDays === 0) return 'Forever';
    if (durationDays === 7) return '7 days';
    if (durationDays === 30) return '1 month';
    if (durationDays === 90) return '3 months';
    if (durationDays === 180) return '6 months';
    if (durationDays === 365) return '1 year';
    if (durationDays === 9999) return 'Lifetime';
    return `${durationDays} days`;
  };

  const isCurrentPlan = (plan) => {
    if (!currentSubscription) {
      return plan.Price === 0; // Free plan is current if no subscription
    }
    return currentSubscription.PlanID === plan.PlanID;
  };

  const PlanCard = ({ plan, isPopular = false }) => (
    <View style={[styles.planCard, isPopular && styles.popularPlan]}>
      {isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
        </View>
      )}
      
      <View style={styles.planHeader}>
        <Text style={styles.planName}>{plan.Name}</Text>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>
            {plan.Price === 0 ? 'Free' : `₹${plan.Price}`}
          </Text>
          {plan.Price > 0 && (
            <Text style={styles.duration}>/{getDurationText(plan.DurationDays)}</Text>
          )}
        </View>
      </View>

      <View style={styles.planFeatures}>
        {getPlanFeatures(plan).map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.selectButton,
          isCurrentPlan(plan) && styles.currentPlanButton,
          isPopular && styles.popularButton
        ]}
        onPress={() => handlePlanSelect(plan)}
        disabled={isCurrentPlan(plan)}
      >
        <Text style={[
          styles.selectButtonText,
          isCurrentPlan(plan) && styles.currentPlanButtonText,
          isPopular && !isCurrentPlan(plan) && styles.popularButtonText
        ]}>
          {isCurrentPlan(plan) ? 'Current Plan' : 'Select Plan'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading subscription plans...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Upgrade Your Referral Power</Text>
        <Text style={styles.subtitle}>
          Choose a plan that fits your job search needs and boost your chances of getting referred!
        </Text>

        {/* Current Status */}
        {eligibility && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text style={styles.statusTitle}>Current Status</Text>
            </View>
            <Text style={styles.statusText}>
              Daily quota: {eligibility.dailyQuotaRemaining} of {eligibility.hasActiveSubscription ? currentSubscription?.ReferralsPerDay || 0 : 5} remaining
            </Text>
            {currentSubscription && (
              <Text style={styles.statusText}>
                Active plan: {currentSubscription.PlanName}
              </Text>
            )}
          </View>
        )}

        {/* Plans */}
        <View style={styles.plansContainer}>
          {plans.map((plan, index) => (
            <PlanCard
              key={plan.PlanID}
              plan={plan}
              isPopular={index === 2} // Make the 3rd plan (usually monthly) popular
            />
          ))}
        </View>

        {/* Features Comparison */}
        <View style={styles.comparisonSection}>
          <Text style={styles.comparisonTitle}>Why Upgrade?</Text>
          
          <View style={styles.comparisonItem}>
            <Ionicons name="flash" size={20} color={colors.warning} />
            <Text style={styles.comparisonText}>
              Get more referral requests per day to maximize your job opportunities
            </Text>
          </View>
          
          <View style={styles.comparisonItem}>
            <Ionicons name="people" size={20} color={colors.primary} />
            <Text style={styles.comparisonText}>
              Access to premium referrers in your network
            </Text>
          </View>
          
          <View style={styles.comparisonItem}>
            <Ionicons name="analytics" size={20} color={colors.success} />
            <Text style={styles.comparisonText}>
              Detailed analytics on your referral success rate
            </Text>
          </View>
          
          <View style={styles.comparisonItem}>
            <Ionicons name="headset" size={20} color={colors.primary} />
            <Text style={styles.comparisonText}>
              Priority customer support for faster assistance
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            All plans include secure payments through Razorpay and can be canceled anytime.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  statusCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginLeft: 8,
  },
  statusText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 4,
  },
  plansContainer: {
    marginBottom: 32,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
  },
  popularPlan: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '05',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  planName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  duration: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    marginLeft: 4,
  },
  planFeatures: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginLeft: 8,
    flex: 1,
  },
  selectButton: {
    backgroundColor: colors.gray200,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  popularButton: {
    backgroundColor: colors.primary,
  },
  currentPlanButton: {
    backgroundColor: colors.success + '20',
    borderWidth: 1,
    borderColor: colors.success,
  },
  selectButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  popularButtonText: {
    color: colors.white,
  },
  currentPlanButtonText: {
    color: colors.success,
  },
  comparisonSection: {
    marginBottom: 32,
  },
  comparisonTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  comparisonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 8,
  },
  comparisonText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 18,
  },
});