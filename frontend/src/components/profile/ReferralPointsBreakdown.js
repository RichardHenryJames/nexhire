import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Animated, Alert, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../styles/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import refopenAPI from '../../services/api';
import useResponsive from '../../hooks/useResponsive';

const ReferralPointsBreakdown = ({ 
  totalPoints = 0, 
  pointsHistory = [], 
  pointTypeMetadata = {}, // NEW: Dynamic metadata from backend
  referralStats = {},
  onClose,
  visible,
  onConversionSuccess // NEW: Callback to refresh data after conversion
}) => {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const { isMobile, isDesktop } = responsive;
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const [fadeAnim] = useState(new Animated.Value(0));
  const navigation = useNavigation();
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [converting, setConverting] = useState(false);
  
  // Withdraw feature states
  const [withdrawableData, setWithdrawableData] = useState({
    withdrawableAmount: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
    canWithdraw: false,
    minimumWithdrawal: 500
  });
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [loadingWithdrawable, setLoadingWithdrawable] = useState(false);

  // Load withdrawable balance when modal opens
  useEffect(() => {
    if (visible) {
      loadWithdrawableBalance();
    }
  }, [visible]);

  const loadWithdrawableBalance = async () => {
    try {
      setLoadingWithdrawable(true);
      const response = await refopenAPI.getWithdrawableBalance();
      if (response.success && response.data) {
        setWithdrawableData(response.data);
      }
    } catch (error) {
      console.error('Error loading withdrawable balance:', error);
    } finally {
      setLoadingWithdrawable(false);
    }
  };

  // Debug logging
  

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
    
    
    
    
    
    if (!pointsHistory || !Array.isArray(pointsHistory)) {
      
      return breakdown;
    }
    
    pointsHistory.forEach((entry, index) => {
      
      
      if (!entry || typeof entry !== 'object') {
        
        return;
      }
      
      // 🔧 CRITICAL FIX: Check multiple possible field names for points type
      const type = entry.PointsType || entry.pointsType || entry.type || 'general';
      
      // 🆕 Handle conversion transactions (negative points)
      const transactionType = entry.TransactionType || entry.transactionType || 'earned';
      const isConversion = transactionType === 'converted' || type === 'conversion';
      
      // Points should be positive for earned, negative for converted
      let points = parseInt(entry.PointsAmount || entry.PointsEarned || entry.pointsEarned || entry.points || 0);
      if (isConversion) {
        points = -Math.abs(points); // Make sure conversions are negative
      }
      
      
      
      
      
      
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
        pointsEarned: points, // Store as signed value (negative for conversions)
        isConversion: isConversion
      });
      
      
    });
    
    
    
    return breakdown;
  };

  const pointsBreakdown = getPointsBreakdown();
  
  // 🔧 Log the processed breakdown
  
  

  // 🔧 UPDATED: Get point type display info with better fallbacks
  const getPointTypeInfo = (type) => {
    
    
    
    // Use backend metadata if available, with fallback to default
    const backendMetadata = pointTypeMetadata[type];
    
    if (backendMetadata) {
      
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

  const handleConvertPoints = async () => {
    try {
      setConverting(true);
      
      // Call the real API endpoint
      const response = await refopenAPI.convertPointsToWallet();
      
      if (response.success) {
        const { pointsConverted, walletAmount, newWalletBalance } = response.data;
        
        // Close modals immediately
        setShowConversionModal(false);
        onClose();
        
        // Refresh parent data
        if (onConversionSuccess) {
          await onConversionSuccess();
        }
        
        // Show success message after refresh
        Alert.alert(
          'Conversion Successful! 🎉',
          `${pointsConverted} points converted to ₹${walletAmount.toFixed(2)}\n\nNew Wallet Balance: ₹${newWalletBalance.toFixed(2)}`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error(response.error || 'Conversion failed');
      }
    } catch (error) {
      console.error('Error converting points:', error);
      Alert.alert(
        'Conversion Failed', 
        error.message || 'Failed to convert points. Please try again.'
      );
    } finally {
      setConverting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!upiId.trim()) {
      Alert.alert('Error', 'Please enter your UPI ID');
      return;
    }
    
    if (!withdrawableData.canWithdraw) {
      Alert.alert('Not Eligible', `You need at least ₹${withdrawableData.minimumWithdrawal} to withdraw`);
      return;
    }
    
    try {
      setWithdrawing(true);
      
      const response = await refopenAPI.requestWithdrawal(withdrawableData.withdrawableAmount, upiId.trim());
      
      if (response.success) {
        setShowWithdrawModal(false);
        setUpiId('');
        
        Alert.alert(
          'Withdrawal Requested! 🎉',
          `Your withdrawal request for ₹${withdrawableData.withdrawableAmount} has been submitted.\n\nAmount will be credited to your UPI within 24-48 hours.`,
          [{ text: 'OK' }]
        );
        
        // Refresh withdrawable balance
        loadWithdrawableBalance();
        
        // Refresh parent data
        if (onConversionSuccess) {
          await onConversionSuccess();
        }
      } else {
        throw new Error(response.error || 'Withdrawal request failed');
      }
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      Alert.alert(
        'Withdrawal Failed',
        error.message || 'Failed to request withdrawal. Please try again.'
      );
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.innerContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>RefPoints Breakdown</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Top Cards Row - Side by side on desktop, stacked on mobile */}
          <View style={styles.topCardsRow}>
            {/* Withdraw Earnings Section - MOVED FIRST */}
            <View style={[styles.withdrawSection, !isMobile && styles.topCardHalf]}>
              <View style={styles.withdrawHeader}>
                <View style={styles.withdrawTitleRow}>
                  <Ionicons name="wallet" size={20} color="#10b981" />
                  <Text style={styles.withdrawTitle}>Referral Earnings</Text>
                </View>
                <Text style={styles.withdrawSubtitle}>
                  Earn money when job seekers verify your referrals
                </Text>
              </View>
              
              {/* Liquid Fill Withdraw Button */}
              <TouchableOpacity 
                style={styles.withdrawButtonContainer}
                onPress={() => setShowWithdrawModal(true)}
                activeOpacity={0.8}
              >
                <View style={styles.withdrawButtonOuter}>
                  {/* Background liquid fill based on amount */}
                  <View 
                    style={[
                      styles.withdrawButtonFill,
                      { 
                        height: `${Math.min(100, (withdrawableData.withdrawableAmount / withdrawableData.minimumWithdrawal) * 100)}%`,
                        backgroundColor: withdrawableData.canWithdraw ? '#10b981' : '#22c55e'
                      }
                    ]} 
                  />
                  <View style={styles.withdrawButtonContent}>
                    <Ionicons 
                      name={withdrawableData.canWithdraw ? "cash" : "water"} 
                      size={24} 
                      color={withdrawableData.withdrawableAmount > 0 ? '#fff' : '#6b7280'} 
                    />
                    <Text style={[
                      styles.withdrawButtonAmount,
                      { color: withdrawableData.withdrawableAmount > 0 ? '#fff' : '#6b7280' }
                    ]}>
                      ₹{withdrawableData.withdrawableAmount}
                    </Text>
                    <Text style={[
                      styles.withdrawButtonLabel,
                      { color: withdrawableData.withdrawableAmount > 0 ? 'rgba(255,255,255,0.8)' : '#9ca3af' }
                    ]}>
                      {withdrawableData.canWithdraw ? 'Withdraw Now' : `₹${withdrawableData.minimumWithdrawal - withdrawableData.withdrawableAmount} more to withdraw`}
                    </Text>
                  </View>
                </View>
                <View style={styles.withdrawProgressBar}>
                  <View 
                    style={[
                      styles.withdrawProgressFill,
                      { 
                        width: `${Math.min(100, (withdrawableData.withdrawableAmount / withdrawableData.minimumWithdrawal) * 100)}%`,
                        backgroundColor: withdrawableData.canWithdraw ? '#10b981' : '#22c55e'
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.withdrawProgressText}>
                  {withdrawableData.withdrawableAmount} / {withdrawableData.minimumWithdrawal} required
                </Text>
              </TouchableOpacity>
            </View>

            {/* Total Points Card */}
            <View style={[styles.totalPointsCard, !isMobile && styles.topCardHalf]}>
              <View style={styles.pointsIcon}>
                <Text style={styles.pointsEmoji}>🏆</Text>
              </View>
              <Text style={styles.totalPointsNumber}>{totalPoints || 0}</Text>
              <Text style={styles.totalPointsLabel}>Total RefPoints</Text>
              
              {/* Quick Stats Row */}
              <View style={styles.quickStatsRow}>
                <View style={styles.quickStat}>
                  <Text style={styles.quickStatNumber}>{referralStats.totalReferralsMade || 0}</Text>
                  <Text style={styles.quickStatLabel}>Referral Made</Text>
                </View>
                <View style={styles.quickStat}>
                  <Text style={styles.quickStatNumber}>{referralStats.verifiedReferrals || 0}</Text>
                  <Text style={styles.quickStatLabel}>Referral Verified</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Points Breakdown by Type */}
          {Object.keys(pointsBreakdown).length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 RefPoints Breakdown by Type</Text>
              
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
                    {(category.entries || []).map((entry, index) => {
                      const isConversion = entry.isConversion || entry.pointsEarned < 0;
                      const pointsValue = Math.abs(entry.pointsEarned || 0);
                      
                      return (
                        <View key={index} style={styles.entryRow}>
                          <Text style={styles.entryDate}>{formatDate(entry.TransactionDate || entry.AwardedAt || entry.awardedAt)}</Text>
                          <Text style={[
                            styles.entryPoints,
                            isConversion && styles.entryPointsNegative
                          ]}>
                            {isConversion ? '-' : '+'}{pointsValue}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateEmoji}>🎯</Text>
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
        </ScrollView>
        </View>
      </Animated.View>

      {/* Withdraw Modal */}
      <Modal
        visible={showWithdrawModal}
        transparent
        onRequestClose={() => !withdrawing && setShowWithdrawModal(false)}
      >
        <View style={styles.conversionModalOverlay}>
          <View style={styles.conversionModalContent}>
            <View style={styles.conversionModalHeader}>
              <Ionicons name="wallet" size={48} color="#10b981" />
            </View>
            <Text style={styles.conversionModalTitle}>Withdraw Earnings</Text>
            <Text style={styles.conversionModalDescription}>
              Withdraw your referral earnings to your bank/UPI
            </Text>
            
            {/* Liquid Fill Display */}
            <View style={styles.withdrawLiquidContainer}>
              <View style={styles.withdrawLiquidOuter}>
                <View 
                  style={[
                    styles.withdrawLiquidFill,
                    { 
                      height: `${Math.min(100, (withdrawableData.withdrawableAmount / withdrawableData.minimumWithdrawal) * 100)}%`,
                      backgroundColor: withdrawableData.canWithdraw ? '#10b981' : '#22c55e'
                    }
                  ]} 
                />
                <View style={styles.withdrawLiquidContent}>
                  <Ionicons 
                    name={withdrawableData.canWithdraw ? "checkmark-circle" : "water"} 
                    size={32} 
                    color={withdrawableData.withdrawableAmount > 0 ? '#fff' : '#6b7280'} 
                  />
                  <Text style={[
                    styles.withdrawLiquidAmount,
                    { color: withdrawableData.withdrawableAmount > 0 ? '#fff' : '#6b7280' }
                  ]}>
                    ₹{withdrawableData.withdrawableAmount}
                  </Text>
                </View>
              </View>
              <Text style={styles.withdrawMinimumText}>
                Minimum withdrawal: ₹{withdrawableData.minimumWithdrawal}
              </Text>
            </View>

            {withdrawableData.canWithdraw ? (
              <>
                <View style={styles.upiInputContainer}>
                  <Text style={styles.upiLabel}>Enter UPI ID</Text>
                  <TextInput
                    style={styles.upiInput}
                    placeholder="yourname@upi"
                    placeholderTextColor="#9ca3af"
                    value={upiId}
                    onChangeText={setUpiId}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                
                <View style={styles.conversionModalButtons}>
                  <TouchableOpacity
                    style={styles.conversionCancelButton}
                    onPress={() => setShowWithdrawModal(false)}
                    disabled={withdrawing}
                  >
                    <Text style={styles.conversionCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.conversionConfirmButton, 
                      { backgroundColor: '#10b981' },
                      (withdrawing || !upiId.trim()) && styles.conversionConfirmButtonDisabled
                    ]}
                    onPress={handleWithdraw}
                    disabled={withdrawing || !upiId.trim()}
                  >
                    {withdrawing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.conversionConfirmText}>Withdraw</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.withdrawInfoBox}>
                  <Ionicons name="information-circle" size={20} color="#f59e0b" />
                  <Text style={styles.withdrawInfoText}>
                    You need ₹{withdrawableData.minimumWithdrawal - withdrawableData.withdrawableAmount} more to be eligible for withdrawal.
                    Keep referring and verifying to earn more!
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={[styles.conversionCancelButton, { marginTop: 20, alignSelf: 'center', width: '50%' }]}
                  onPress={() => setShowWithdrawModal(false)}
                >
                  <Text style={styles.conversionCancelText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Conversion Confirmation Modal */}
      <Modal
        visible={showConversionModal}
        transparent
        onRequestClose={() => !converting && setShowConversionModal(false)}
      >
        <View style={styles.conversionModalOverlay}>
          <View style={styles.conversionModalContent}>
            <View style={styles.conversionModalHeader}>
              <Ionicons name="swap-horizontal" size={48} color={colors.primary} />
            </View>
            <Text style={styles.conversionModalTitle}>Convert RefPoints to Wallet</Text>
            <Text style={styles.conversionModalDescription}>
              Convert your RefPoints to wallet balance
            </Text>
            
            <View style={styles.conversionRate}>
              <Text style={styles.conversionRateText}>1 RefPoint = ₹0.50</Text>
            </View>

            <View style={styles.conversionDetails}>
              <View style={styles.conversionRow}>
                <Text style={styles.conversionLabel}>Your RefPoints:</Text>
                <Text style={styles.conversionValue}>{totalPoints}</Text>
              </View>
              <View style={styles.conversionRow}>
                <Text style={styles.conversionLabel}>You will receive:</Text>
                <Text style={[styles.conversionValue, styles.conversionAmount]}>
                  ₹{(totalPoints * 0.5).toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.conversionModalButtons}>
              <TouchableOpacity
                style={styles.conversionCancelButton}
                onPress={() => setShowConversionModal(false)}
                disabled={converting}
              >
                <Text style={styles.conversionCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.conversionConfirmButton, converting && styles.conversionConfirmButtonDisabled]}
                onPress={handleConvertPoints}
                disabled={converting}
              >
                {converting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.conversionConfirmText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: responsive.isDesktop ? 'center' : 'stretch',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: responsive.isDesktop ? 800 : '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 20,
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
  // Responsive top cards row
  topCardsRow: {
    flexDirection: responsive.isMobile ? 'column' : 'row',
    gap: 16,
    marginBottom: responsive.isMobile ? 0 : 24,
  },
  topCardHalf: {
    flex: 1,
    marginBottom: 0,
  },
  totalPointsCard: {
    backgroundColor: colors.surface || colors.background,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: responsive.isMobile ? 24 : 0,
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
    color: colors.textSecondary,
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
    color: colors.textSecondary,
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
    color: colors.textSecondary,
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
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
  entryPoints: {
    fontSize: typography.sizes?.sm || 14,
    fontWeight: typography.weights?.medium || '500',
    color: colors.primary,
  },
  entryPointsNegative: {
    color: '#EF4444', // Red color for negative/spent points
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
    color: colors.textSecondary,
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
    color: colors.textSecondary,
  },
  conversionSection: {
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  convertButton: {
    backgroundColor: '#7EB900',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#7EB900',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  convertButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convertIcon: {
    marginRight: 12,
  },
  convertTextContainer: {
    flex: 1,
  },
  convertButtonText: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  convertButtonSubtext: {
    fontSize: typography.sizes?.sm || 14,
    color: 'rgba(255, 255, 255, 0.9)',
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
  conversionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  conversionModalContent: {
    backgroundColor: colors.surface || colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  conversionModalHeader: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  conversionModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  conversionModalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  conversionRate: {
    backgroundColor: colors.primary + '10',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 20,
  },
  conversionRateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  conversionDetails: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  conversionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  conversionLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  conversionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  conversionAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7EB900',
  },
  conversionModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  conversionCancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  conversionCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  conversionConfirmButton: {
    flex: 1,
    backgroundColor: '#7EB900',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  conversionConfirmButtonDisabled: {
    opacity: 0.6,
  },
  conversionConfirmText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  
  // Withdraw Feature Styles
  withdrawSection: {
    backgroundColor: colors.surface || colors.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: responsive.isMobile ? 24 : 0,
    borderWidth: 1,
    borderColor: '#10b98133',
  },
  withdrawHeader: {
    marginBottom: 16,
  },
  withdrawTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  withdrawTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  withdrawSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 28,
  },
  withdrawButtonContainer: {
    alignItems: 'center',
  },
  withdrawButtonOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background,
    borderWidth: 3,
    borderColor: '#10b98155',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  withdrawButtonFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 0,
  },
  withdrawButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  withdrawButtonAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  withdrawButtonLabel: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 8,
  },
  withdrawProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  withdrawProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  withdrawProgressText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Withdraw Modal Styles
  withdrawLiquidContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  withdrawLiquidOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background,
    borderWidth: 3,
    borderColor: '#10b98155',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  withdrawLiquidFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  withdrawLiquidContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  withdrawLiquidAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  withdrawMinimumText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 12,
  },
  upiInputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  upiLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  upiInput: {
    width: '100%',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  },
  withdrawInfoBox: {
    flexDirection: 'row',
    backgroundColor: '#f59e0b22',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  withdrawInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#f59e0b',
    lineHeight: 20,
  },
});

export default ReferralPointsBreakdown;