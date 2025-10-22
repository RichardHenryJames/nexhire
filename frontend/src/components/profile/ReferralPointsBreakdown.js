import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../styles/theme';
import { useNavigation } from '@react-navigation/native';

const ReferralPointsBreakdown = ({ 
  totalPoints = 0, 
  pointsHistory = [], 
  pointTypeMetadata = {}, // NEW: Dynamic metadata from backend
  referralStats = {},
  onClose,
  visible 
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const navigation = useNavigation();

  // Debug logging
  console.log('ReferralPointsBreakdown props:', {
    totalPoints,
    pointsHistoryLength: pointsHistory?.length || 0,
    pointsHistory,
    pointTypeMetadata,
    visible
  });

  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Group points by type for breakdown
  const getPointsBreakdown = () => {
    const breakdown = {};
    
    console.log('🔧 getPointsBreakdown called with pointsHistory:', pointsHistory);
    console.log('🔧 pointsHistory type:', typeof pointsHistory, Array.isArray(pointsHistory));
    console.log('🔧 pointsHistory length:', pointsHistory?.length);
    
    if (!pointsHistory || !Array.isArray(pointsHistory)) {
      console.log('🔧 No points history or not array, returning empty breakdown');
      return breakdown;
    }
    
    pointsHistory.forEach((entry, index) => {
      console.log(`🔧 Processing entry ${index}:`, JSON.stringify(entry, null, 2));
      
      if (!entry || typeof entry !== 'object') {
        console.log(`🔧 Invalid entry ${index}, skipping`);
        return;
      }
      
      // 🔧 CRITICAL FIX: Check multiple possible field names for points type
      const type = entry.PointsType || entry.pointsType || entry.type || 'general';
      const points = parseInt(entry.PointsEarned || entry.pointsEarned || entry.points || 0);
      
      console.log(`🔧 Entry ${index}: type="${type}", points=${points}`);
      console.log(`🔧 Raw entry fields:`, Object.keys(entry));
      console.log(`🔧 PointsType field value:`, entry.PointsType);
      console.log(`🔧 PointsEarned field value:`, entry.PointsEarned);
      
      if (!breakdown[type]) {
        breakdown[type] = {
          type,
          total: 0,
          count: 0,
          entries: []
        };
      }
      
      breakdown[type].total += points;
      breakdown[type].count += 1;
      breakdown[type].entries.push({
        ...entry,
        pointsEarned: points // Ensure pointsEarned is a number
      });
      
      console.log(`🔧 Updated breakdown for type "${type}":`, {
        total: breakdown[type].total,
        count: breakdown[type].count,
        entries: breakdown[type].entries.length
      });
    });
    
    console.log('🔧 Final breakdown keys:', Object.keys(breakdown));
    console.log('🔧 Final breakdown:', JSON.stringify(breakdown, null, 2));
    return breakdown;
  };

  const pointsBreakdown = getPointsBreakdown();
  
  // 🔧 Log the processed breakdown
  console.log('🔧 Processed pointsBreakdown:', pointsBreakdown);
  console.log('🔧 Number of breakdown categories:', Object.keys(pointsBreakdown).length);

  // 🔧 UPDATED: Get point type display info with better fallbacks
  const getPointTypeInfo = (type) => {
    console.log(`🔧 getPointTypeInfo called for type: ${type}`);
    console.log(`🔧 Available metadata:`, pointTypeMetadata);
    
    // Use backend metadata if available, with fallback to default
    const backendMetadata = pointTypeMetadata[type];
    
    if (backendMetadata) {
      console.log(`🔧 Found backend metadata for ${type}:`, backendMetadata);
      return {
        icon: backendMetadata.icon || '🎯', // 🔧 Add fallback emoji
        title: backendMetadata.title || 'Points',
        description: backendMetadata.description || 'Referral activity points',
        color: backendMetadata.color || '#3B82F6'
      };
    }
    
    // 🔧 Improved fallbacks for unknown types with guaranteed emojis
    const typeDefaults = {
      proof_submission: { 
        icon: '📸', 
        title: 'Proof Submissions', 
        color: '#3B82F6',
        description: 'Base points for submitting referral screenshots'
      },
      verification: { 
        icon: '✅', 
        title: 'Verifications', 
        color: '#10B981',
        description: 'Bonus points when job seekers confirm referrals'
      },
      quick_response_bonus: { 
        icon: '⚡', 
        title: 'Quick Response Bonus', 
        color: '#F59E0B',
        description: 'Extra points for responding within 24 hours'
      },
      monthly_bonus: { 
        icon: '🎁', 
        title: 'Monthly Bonus', 
        color: '#8B5CF6',
        description: 'Special monthly activity bonus'
      },
      streak_bonus: { 
        icon: '🔥', 
        title: 'Streak Bonus', 
        color: '#EF4444',
        description: 'Consecutive referral streak bonus'
      },
      general: { 
        icon: '🎯', 
        title: 'General Points', 
        color: '#6B7280',
        description: 'Other referral activities'
      }
    };
    
    const defaultInfo = typeDefaults[type] || typeDefaults.general;
    console.log(`🔧 Using default info for ${type}:`, defaultInfo);
    
    return {
      icon: defaultInfo.icon,
      title: defaultInfo.title,
      description: defaultInfo.description,
      color: defaultInfo.color
    };
  };

  const formatDate = (dateString) => {
    try {
      if (!dateString) return 'Unknown date';
      
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.warn('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  const handleNavigateToReferrals = () => {
    // Close the modal first
    onClose();
    
    // Navigate to Referrals screen using React Navigation
    setTimeout(() => {
      navigation.navigate('Referrals');
    }, 300); // Small delay to let modal close animation complete
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Referral Points Breakdown</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Total Points Card */}
          <View style={styles.totalPointsCard}>
            <View style={styles.pointsIcon}>
              <Text style={styles.pointsEmoji}>🏆</Text>
            </View>
            <Text style={styles.totalPointsNumber}>{totalPoints || 0}</Text>
            <Text style={styles.totalPointsLabel}>Total Referral Points</Text>
            
            {/* Quick Stats Row */}
            <View style={styles.quickStatsRow}>
              <View style={styles.quickStat}>
                <Text style={styles.quickStatNumber}>{referralStats.totalReferralsMade || 0}</Text>
                <Text style={styles.quickStatLabel}>Referrals Made</Text>
              </View>
              <View style={styles.quickStat}>
                <Text style={styles.quickStatNumber}>{referralStats.verifiedReferrals || 0}</Text>
                <Text style={styles.quickStatLabel}>Verified</Text>
              </View>
              <View style={styles.quickStat}>
                <Text style={styles.quickStatNumber}>{referralStats.referralRequestsMade || 0}</Text>
                <Text style={styles.quickStatLabel}>Requested</Text>
              </View>
            </View>
          </View>

          {/* Points Breakdown by Type */}
          {Object.keys(pointsBreakdown).length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Points Breakdown by Type</Text>
              
              {Object.values(pointsBreakdown).map((category) => {
                const typeInfo = getPointTypeInfo(category.type);
                return (
                  <View key={category.type} style={styles.breakdownCard}>
                    <View style={styles.breakdownHeader}>
                      <View style={styles.breakdownTitleRow}>
                        <Text style={styles.breakdownIcon}>{typeInfo.icon}</Text>
                        <View style={styles.breakdownTitleColumn}>
                          <Text style={styles.breakdownTitle}>{typeInfo.title}</Text>
                          <Text style={styles.breakdownDescription}>{typeInfo.description}</Text>
                        </View>
                      </View>
                      <View style={styles.breakdownPointsColumn}>
                        <Text style={[styles.breakdownPoints, { color: typeInfo.color }]}>
                          +{category.total || 0}
                        </Text>
                        <Text style={styles.breakdownCount}>
                          {category.count || 0} time{(category.count || 0) !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Individual entries for this type */}
                    {(category.entries || []).map((entry, index) => (
                      <View key={index} style={styles.entryRow}>
                        <Text style={styles.entryDate}>{formatDate(entry.AwardedAt || entry.awardedAt)}</Text>
                        <Text style={styles.entryPoints}>+{entry.pointsEarned || 0}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>0</Text>
                <Text style={styles.emptyStateTitle}>No Points Yet</Text>
                <Text style={styles.emptyStateDescription}>
                  Start earning points by referring candidates for jobs at your company!
                </Text>
              </View>
            </View>
          )}

          {/* How to Earn More Points - UPDATED: Dynamic tips from metadata */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💡 How to Earn More Points</Text>
            <View style={styles.tipsContainer}>
              {Object.entries(pointTypeMetadata).map(([type, metadata]) => {
                // Skip general type in tips
                if (type === 'general') return null;
                
                return (
                  <View key={type} style={styles.tipRow}>
                    <Text style={styles.tipIcon}>{metadata.icon || '🎯'}</Text>
                    <View style={styles.tipContent}>
                      <Text style={styles.tipTitle}>{metadata.title || 'Points'}</Text>
                      <Text style={styles.tipDescription}>{metadata.description || 'Earn referral points'}</Text>
                    </View>
                  </View>
                );
              })}
              
              {/* Always show the summary tip */}
              <View style={styles.tipRow}>
                <Text style={styles.tipIcon}>🎯</Text>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>Maximum Per Referral</Text>
                  <Text style={styles.tipDescription}>Points vary by activity type and timing bonuses</Text>
                </View>
              </View>
            </View>
          </View>

          {/* NEW: Redirect Button to Referrals Page */}
          <View style={styles.redirectSection}>
            <TouchableOpacity 
              style={styles.redirectButton}
              onPress={handleNavigateToReferrals}
              activeOpacity={0.7}
            >
              <View style={styles.redirectButtonContent}>
                <Ionicons name="people" size={24} color="#fff" style={styles.redirectIcon} />
                <View style={styles.redirectTextContainer}>
                  <Text style={styles.redirectButtonText}>View All Referrals</Text>
                  <Text style={styles.redirectButtonSubtext}>Manage your referral requests</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  totalPointsCard: {
    backgroundColor: colors.surface || colors.background,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  pointsIcon: {
    marginBottom: 12,
  },
  pointsEmoji: {
    fontSize: 48,
  },
  totalPointsNumber: {
    fontSize: 48,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  totalPointsLabel: {
    fontSize: typography.sizes?.md || 16,
    color: colors.gray600,
    marginBottom: 20,
  },
  quickStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  quickStat: {
    alignItems: 'center',
  },
  quickStatNumber: {
    fontSize: typography.sizes?.xl || 20,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
  },
  quickStatLabel: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  breakdownCard: {
    backgroundColor: colors.surface || colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  breakdownTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  breakdownIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  breakdownTitleColumn: {
    flex: 1,
  },
  breakdownTitle: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.medium || '500',
    color: colors.text,
  },
  breakdownDescription: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600,
    marginTop: 2,
  },
  breakdownPointsColumn: {
    alignItems: 'flex-end',
  },
  breakdownPoints: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
  },
  breakdownCount: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.gray500,
    marginTop: 2,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 36,
    borderTopWidth: 1,
    borderTopColor: colors.border + '50',
  },
  entryDate: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600,
  },
  entryPoints: {
    fontSize: typography.sizes?.sm || 14,
    fontWeight: typography.weights?.medium || '500',
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: typography.sizes?.md || 16,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
  },
  tipsContainer: {
    gap: 16,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.medium || '500',
    color: colors.text,
    marginBottom: 2,
  },
  tipDescription: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600,
  },
  redirectSection: {
    marginTop: 8,
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  redirectButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  redirectButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  redirectIcon: {
    marginRight: 12,
  },
  redirectTextContainer: {
    flex: 1,
  },
  redirectButtonText: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  redirectButtonSubtext: {
    fontSize: typography.sizes?.sm || 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
});

export default ReferralPointsBreakdown;