import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../styles/theme'; // ?? FIX: Import from theme.js instead of colors.js

const ReferralPointsHeader = ({ 
  referralPoints = 0, 
  referralStats = {}, 
  onPress = () => {},
  compact = false 
}) => {
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

  if (compact) {
    return (
      <TouchableOpacity 
        style={styles.compactContainer}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.pointsSection}>
          <Ionicons name="trophy" size={20} color={colors.primary} />
          <Text style={styles.pointsText}>{safeReferralPoints}</Text>
          <Text style={styles.pointsLabel}>Points</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.headerRow}>
        <View style={styles.pointsSection}>
          <View style={styles.pointsCircle}>
            <Ionicons name="trophy" size={24} color={colors.primary} />
            <Text style={styles.pointsValue}>{safeReferralPoints}</Text>
          </View>
          <Text style={styles.pointsTitle}>Referral Points</Text>
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
        
        <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
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
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compactContainer: {
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pointsSection: {
    alignItems: 'center',
    flex: 1,
  },
  pointsCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  pointsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  pointsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  pointsText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 4,
  },
  pointsLabel: {
    fontSize: 12,
    color: colors.gray600,
    marginLeft: 4,
  },
  statsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'center',
  },
  statItem: {
    alignItems: 'center',
    minWidth: 50,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.gray200,
    marginHorizontal: 12,
  },
  progressSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: colors.gray600,
    textAlign: 'center',
    marginTop: 8,
  },
};

export default ReferralPointsHeader;