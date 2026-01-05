import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../styles/theme';
import { useTheme } from '../../contexts/ThemeContext';
import ReferralPointsBreakdown from './ReferralPointsBreakdown';

const ReferralPointsHeader = ({ 
  referralPoints = 0, 
  referralStats = {},
  pointsHistory = [], // Points history for detailed breakdown
  pointTypeMetadata = {}, // NEW: Dynamic metadata from backend
  onPress,
  compact = false 
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Default stats structure
  const stats = {
    totalReferralsMade: 0,
    verifiedReferrals: 0,
    referralRequestsMade: 0,
    totalPointsFromRewards: 0,
    ...referralStats
  };

  const handlePress = () => {
    // Always use the modal behavior for now
    setShowBreakdown(true);
  };

  // Format points display with proper number handling
  const formatPoints = (points) => {
    if (Array.isArray(points)) {
      // Handle array case (sum the values)
      return points.reduce((sum, point) => sum + (Number(point) || 0), 0);
    }
    return Number(points) || 0;
  };

  const displayPoints = formatPoints(referralPoints);

  if (compact) {
    return (
      <>
        <TouchableOpacity 
          style={styles.compactContainer} 
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={styles.compactPointsSection}>
            <View style={styles.compactIcon}>
              <Text style={styles.compactEmoji}>?</Text>
            </View>
            <View style={styles.compactInfo}>
              <Text style={styles.compactPoints}>{displayPoints}</Text>
              <Text style={styles.compactLabel}>Referral Points</Text>
              <Text style={styles.tapHint}>Tap for details</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.gray500} />
        </TouchableOpacity>

        <ReferralPointsBreakdown
          visible={showBreakdown}
          totalPoints={displayPoints}
          referralStats={stats}
          pointsHistory={pointsHistory}
          pointTypeMetadata={pointTypeMetadata}
          onClose={() => {
            setShowBreakdown(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <TouchableOpacity 
        style={styles.container} 
        onPress={handlePress}
        activeOpacity={0.7} // Add visual feedback
      >
        {/* Main Points Display */}
        <View style={styles.pointsSection}>
          <View style={styles.pointsIcon}>
            <Text style={styles.pointsEmoji}>🪙</Text>
          </View>
          <View style={styles.pointsInfo}>
            <Text style={styles.pointsNumber}>{displayPoints}</Text>
            <Text style={styles.pointsLabel}>Referral Points</Text>
          </View>
          <View style={styles.detailArrow}>
            <Ionicons name="chevron-forward" size={20} color={colors.gray500} />
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.totalReferralsMade}</Text>
            <Text style={styles.statLabel}>Referrals{'\n'}Made</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.verifiedReferrals}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.referralRequestsMade}</Text>
            <Text style={styles.statLabel}>Requested</Text>
          </View>
        </View>

        {/* Tap to Detail Hint */}
        <View style={styles.hintSection}>
          <Text style={styles.hintText}>Tap to view detailed breakdown</Text>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>

      {/* Points Breakdown Modal */}
      <ReferralPointsBreakdown
        visible={showBreakdown}
        totalPoints={displayPoints}
        referralStats={stats}
        pointsHistory={pointsHistory}
        pointTypeMetadata={pointTypeMetadata} // Pass metadata
        onClose={() => {
          setShowBreakdown(false);
        }}
      />
    </>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface || colors.background,
    borderRadius: 16,
    padding: 20,
    marginVertical: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  pointsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pointsIcon: {
    marginRight: 16,
  },
  pointsEmoji: {
    fontSize: 32,
  },
  pointsInfo: {
    flex: 1,
  },
  pointsNumber: {
    fontSize: 32,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.primary,
    lineHeight: 36,
  },
  pointsLabel: {
    fontSize: typography.sizes?.md || 16,
    color: colors.textSecondary,
    marginTop: 2,
  },
  detailArrow: {
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border + '50',
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '50',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border + '50',
  },
  statNumber: {
    fontSize: typography.sizes?.xl || 20,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  hintSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  hintText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.textSecondary,
    marginRight: 4,
  },
  compactContainer: {
    backgroundColor: colors.surface || colors.background,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  compactPointsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactIcon: {
    marginRight: 12,
  },
  compactEmoji: {
    fontSize: 24,
  },
  compactInfo: {
    flex: 1,
  },
  compactPoints: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.primary,
  },
  compactLabel: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.textSecondary,
  },
  tapHint: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

export default ReferralPointsHeader;