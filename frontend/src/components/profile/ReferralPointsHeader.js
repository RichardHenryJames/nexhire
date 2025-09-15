import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Note: If you don't have expo-linear-gradient installed, remove this import and set useGradient to false
// import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../styles/theme';

const ReferralPointsHeader = ({ 
  referralPoints = 0, 
  referralStats = {}, 
  onPress = () => {},
  compact = false,
  useGradient = false // Set to false by default to avoid import issues
}) => {
  const [scaleAnim] = useState(new Animated.Value(1));

  // ?? FIX: Ensure all values are properly converted to numbers
  const safeReferralPoints = Number(referralPoints) || 0;
  const {
    totalReferralsMade = 0,
    verifiedReferrals = 0,
    referralRequestsMade = 0
  } = referralStats;

  // ?? FIX: Convert all stats to numbers to prevent string concatenation
  const safeTotalReferralsMade = Number(totalReferralsMade) || 0;
  const safeVerifiedReferrals = Number(verifiedReferrals) || 0;
  const safeReferralRequestsMade = Number(referralRequestsMade) || 0;

  // Animation handlers
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // Container component - use View for now (LinearGradient can be added later)
  const Container = View;

  if (compact) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity 
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
          style={styles.compactContainer}
        >
          <View style={styles.compactPointsSection}>
            <Ionicons name="trophy" size={20} color={colors.primary} />
            <Text style={styles.pointsText}>{safeReferralPoints}</Text>
            <Text style={styles.pointsLabel}>Points</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} style={styles.compactChevron} />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        style={styles.container}
      >
        <View style={styles.headerRow}>
          <View style={styles.pointsSection}>
            <View style={styles.pointsCircle}>
              <Ionicons name="trophy" size={24} color={colors.primary} />
              <Text style={styles.pointsValue}>{safeReferralPoints}</Text>
            </View>
            <Text style={styles.pointsTitle}>Referral{'\n'}Points</Text>
          </View>
          
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{safeTotalReferralsMade}</Text>
              <Text style={styles.statLabel}>Referrals Made</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{safeVerifiedReferrals}</Text>
              <Text style={styles.statLabel}>Verified</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{safeReferralRequestsMade}</Text>
              <Text style={styles.statLabel}>Requested</Text>
            </View>
          </View>
          
          <View style={styles.actionSection}>
            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </View>
        </View>
        
        {/* Progress to next level */}
        {safeReferralPoints > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${Math.min((safeReferralPoints % 100) / 100 * 100, 100)}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {100 - (safeReferralPoints % 100)} points to next level
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = {
  container: {
    backgroundColor: colors.white || '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.gray100 || '#F3F4F6',
  },
  compactContainer: {
    backgroundColor: colors.primary + '10' || '#3B82F615',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.primary + '20' || '#3B82F620',
  },
  compactPointsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactChevron: {
    marginLeft: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pointsSection: {
    alignItems: 'center',
    flex: 1,
    minWidth: 100,
  },
  pointsCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + '15' || '#3B82F615',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: colors.primary + '30' || '#3B82F630',
    shadowColor: colors.primary || '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  pointsValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary || '#3B82F6',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  pointsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary || '#111827',
    letterSpacing: 0.2,
    textAlign: 'center',
    lineHeight: 16,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary || '#3B82F6',
    marginLeft: 6,
  },
  pointsLabel: {
    fontSize: 14,
    color: colors.textSecondary || '#6B7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  statsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary || '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary || '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 14,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.gray200 || '#E5E7EB',
    marginHorizontal: 8,
    opacity: 0.6,
  },
  actionSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 16,
    minWidth: 32,
  },
  progressSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray100 || '#F3F4F6',
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.gray200 || '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary || '#3B82F6',
    borderRadius: 3,
    shadowColor: colors.primary || '#3B82F6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  progressText: {
    fontSize: 13,
    color: colors.textSecondary || '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
};

export default ReferralPointsHeader;