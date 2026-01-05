import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Animated, Alert, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../styles/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import refopenAPI from '../../services/api';
import useResponsive from '../../hooks/useResponsive';
import { showToast } from '../Toast';

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
    minimumWithdrawal: 500,
    withdrawalFee: 0
  });
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [loadingWithdrawable, setLoadingWithdrawable] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  
  // Payment method states
  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi' or 'bank'
  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');

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

  // Calculate final amount after fee
  const getWithdrawCalculation = () => {
    const amount = parseFloat(withdrawAmount) || 0;
    const fee = withdrawableData.withdrawalFee;
    const finalAmount = Math.max(0, amount - fee);
    return { amount, fee, finalAmount };
  };

  // Validate withdrawal amount
  const isValidWithdrawAmount = () => {
    const amount = parseFloat(withdrawAmount) || 0;
    return amount >= withdrawableData.minimumWithdrawal && amount <= withdrawableData.withdrawableAmount;
  };

  // Individual field validation helpers
  const getUpiValidationError = () => {
    if (!upiId.trim()) return null; // Don't show error if empty (not touched)
    if (!upiId.includes('@')) return 'UPI ID must contain @ (e.g., name@upi)';
    return null;
  };

  const getBankAccountValidationError = () => {
    if (!bankAccount.trim()) return null;
    if (!/^\d+$/.test(bankAccount)) return 'Account number must contain only digits';
    if (bankAccount.length < 9 || bankAccount.length > 18) return 'Account number should be 9-18 digits';
    return null;
  };

  const getIfscValidationError = () => {
    if (!ifscCode.trim()) return null;
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) return 'Invalid IFSC format (e.g., HDFC0001234)';
    return null;
  };

  const getAccountHolderValidationError = () => {
    if (!accountHolderName.trim()) return null;
    if (!/^[a-zA-Z\s]+$/.test(accountHolderName)) return 'Name should contain only letters';
    if (accountHolderName.trim().length < 3) return 'Name should be at least 3 characters';
    return null;
  };

  // Validate payment details based on method
  const isValidPaymentDetails = () => {
    if (paymentMethod === 'upi') {
      return upiId.trim().length > 0 && upiId.includes('@');
    } else {
      return bankAccount.trim().length >= 9 && 
             /^\d+$/.test(bankAccount) &&
             /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase()) && 
             accountHolderName.trim().length >= 3 &&
             /^[a-zA-Z\s]+$/.test(accountHolderName);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount) || 0;
    
    // Validate payment method details
    if (paymentMethod === 'upi') {
      if (!upiId.trim()) {
        Alert.alert('Error', 'Please enter your UPI ID');
        return;
      }
      // Basic UPI ID validation
      if (!upiId.includes('@')) {
        Alert.alert('Error', 'Please enter a valid UPI ID (e.g., name@upi)');
        return;
      }
    } else {
      if (!bankAccount.trim()) {
        Alert.alert('Error', 'Please enter your bank account number');
        return;
      }
      if (!ifscCode.trim()) {
        Alert.alert('Error', 'Please enter IFSC code');
        return;
      }
      if (!accountHolderName.trim()) {
        Alert.alert('Error', 'Please enter account holder name');
        return;
      }
      // Basic IFSC validation (11 characters)
      if (ifscCode.length !== 11) {
        Alert.alert('Error', 'IFSC code must be 11 characters');
        return;
      }
    }
    
    if (amount < withdrawableData.minimumWithdrawal) {
      Alert.alert('Invalid Amount', `Minimum withdrawal amount is ₹${withdrawableData.minimumWithdrawal}`);
      return;
    }
    
    if (amount > withdrawableData.withdrawableAmount) {
      Alert.alert('Invalid Amount', `You can withdraw maximum ₹${withdrawableData.withdrawableAmount}`);
      return;
    }
    
    try {
      setWithdrawing(true);
      
      const { finalAmount, fee } = getWithdrawCalculation();
      
      // Build payment details based on method
      const paymentDetails = paymentMethod === 'upi' 
        ? { upiId: upiId.trim() }
        : { 
            bankAccount: bankAccount.trim(),
            ifscCode: ifscCode.trim().toUpperCase(),
            accountHolderName: accountHolderName.trim()
          };
      
      const response = await refopenAPI.requestWithdrawal(amount, paymentDetails);
      
      if (response.success) {
        // Reset all fields first
        setUpiId('');
        setBankAccount('');
        setIfscCode('');
        setAccountHolderName('');
        setWithdrawAmount('');
        setPaymentMethod('upi');
        
        // Close modal immediately
        setShowWithdrawModal(false);
        onClose();
        
        // Show success toast
        const paymentDestination = paymentMethod === 'upi' ? 'UPI' : 'bank account';
        showToast(`₹${finalAmount} withdrawal requested! Will be credited to ${paymentDestination} in 24-48 hrs`, 'success');
        
        // Navigate to withdrawal requests screen
        setTimeout(() => {
          navigation.navigate('WithdrawalRequests');
        }, 500);
        
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
      showToast(error.message || 'Failed to request withdrawal. Please try again.', 'error');
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
                  <Ionicons name="wallet" size={20} color={colors.success} />
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
                        backgroundColor: colors.success
                      }
                    ]} 
                  />
                  <View style={styles.withdrawButtonContent}>
                    <Ionicons 
                      name={withdrawableData.canWithdraw ? "cash" : "water"} 
                      size={24} 
                      color={withdrawableData.withdrawableAmount > 0 ? '#fff' : colors.textSecondary} 
                    />
                    <Text style={[
                      styles.withdrawButtonAmount,
                      { color: withdrawableData.withdrawableAmount > 0 ? '#fff' : colors.textSecondary }
                    ]}>
                      ₹{withdrawableData.withdrawableAmount}
                    </Text>
                    <Text style={[
                      styles.withdrawButtonLabel,
                      { color: withdrawableData.withdrawableAmount > 0 ? 'rgba(255,255,255,0.8)' : colors.textSecondary }
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
                        backgroundColor: colors.success
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
          <ScrollView 
            style={styles.withdrawModalScrollView}
            contentContainerStyle={styles.withdrawModalScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          <View style={styles.conversionModalContent}>
            <View style={styles.withdrawModalHeaderCompact}>
              <Ionicons name="wallet" size={36} color={colors.success} />
            </View>
            <Text style={styles.withdrawModalTitleCompact}>Withdraw Earnings</Text>
            <Text style={styles.conversionModalDescription}>
              Withdraw your referral earnings to your bank/UPI
            </Text>
            
            {/* Compact Liquid Fill Display */}
            <View style={styles.withdrawLiquidContainerCompact}>
              <View style={styles.withdrawLiquidOuterCompact}>
                <View 
                  style={[
                    styles.withdrawLiquidFill,
                    { 
                      height: `${Math.min(100, (withdrawableData.withdrawableAmount / withdrawableData.minimumWithdrawal) * 100)}%`,
                      backgroundColor: colors.success
                    }
                  ]} 
                />
                <View style={styles.withdrawLiquidContent}>
                  <Ionicons 
                    name={withdrawableData.canWithdraw ? "checkmark-circle" : "water"} 
                    size={24} 
                    color={withdrawableData.withdrawableAmount > 0 ? '#fff' : colors.textSecondary} 
                  />
                  <Text style={[
                    styles.withdrawLiquidAmountCompact,
                    { color: withdrawableData.withdrawableAmount > 0 ? '#fff' : colors.textSecondary }
                  ]}>
                    ₹{withdrawableData.withdrawableAmount}
                  </Text>
                </View>
              </View>
              <Text style={styles.withdrawMinimumTextCompact}>
                Min: ₹{withdrawableData.minimumWithdrawal}
              </Text>
            </View>

            {withdrawableData.canWithdraw ? (
              <>
                {/* Withdrawal Amount Input */}
                <View style={styles.upiInputContainer}>
                  <Text style={styles.upiLabel}>Enter Withdrawal Amount</Text>
                  <TextInput
                    style={styles.upiInput}
                    placeholder={`Min ₹${withdrawableData.minimumWithdrawal}`}
                    placeholderTextColor={colors.textSecondary}
                    value={withdrawAmount}
                    onChangeText={(text) => setWithdrawAmount(text.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  <Text style={styles.withdrawAvailableText}>
                    Available: ₹{withdrawableData.withdrawableAmount}
                  </Text>
                </View>

                {/* Fee Breakdown - Only show when valid amount entered */}
                {parseFloat(withdrawAmount) >= withdrawableData.minimumWithdrawal && (
                  <View style={styles.feeBreakdownContainer}>
                    <View style={styles.feeBreakdownRow}>
                      <Text style={styles.feeBreakdownLabel}>Withdrawal Amount:</Text>
                      <Text style={styles.feeBreakdownValue}>₹{withdrawAmount}</Text>
                    </View>
                    <View style={styles.feeBreakdownRow}>
                      <Text style={styles.feeBreakdownLabel}>Processing Fee:</Text>
                      <Text style={[styles.feeBreakdownValue, { color: colors.error }]}>- ₹{withdrawableData.withdrawalFee}</Text>
                    </View>
                    <View style={[styles.feeBreakdownRow, styles.feeBreakdownTotal]}>
                      <Text style={styles.feeBreakdownTotalLabel}>You'll Receive:</Text>
                      <Text style={styles.feeBreakdownTotalValue}>₹{getWithdrawCalculation().finalAmount}</Text>
                    </View>
                  </View>
                )}

                {/* Amount validation warning */}
                {withdrawAmount && parseFloat(withdrawAmount) < withdrawableData.minimumWithdrawal && (
                  <View style={styles.withdrawWarningBox}>
                    <Ionicons name="warning" size={16} color={colors.warning} />
                    <Text style={styles.withdrawWarningText}>
                      Minimum withdrawal is ₹{withdrawableData.minimumWithdrawal}
                    </Text>
                  </View>
                )}

                {withdrawAmount && parseFloat(withdrawAmount) > withdrawableData.withdrawableAmount && (
                  <View style={styles.withdrawWarningBox}>
                    <Ionicons name="warning" size={16} color={colors.error} />
                    <Text style={[styles.withdrawWarningText, { color: colors.error }]}>
                      Maximum withdrawal is ₹{withdrawableData.withdrawableAmount}
                    </Text>
                  </View>
                )}

                {/* Payment Method Selector */}
                <View style={styles.paymentMethodContainer}>
                  <Text style={styles.upiLabel}>Select Payment Method</Text>
                  <View style={styles.paymentMethodTabs}>
                    <TouchableOpacity 
                      style={[
                        styles.paymentMethodTab,
                        paymentMethod === 'upi' && styles.paymentMethodTabActive
                      ]}
                      onPress={() => setPaymentMethod('upi')}
                    >
                      <Ionicons 
                        name="phone-portrait" 
                        size={18} 
                        color={paymentMethod === 'upi' ? '#fff' : colors.text} 
                      />
                      <Text style={[
                        styles.paymentMethodTabText,
                        paymentMethod === 'upi' && styles.paymentMethodTabTextActive
                      ]}>UPI</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[
                        styles.paymentMethodTab,
                        paymentMethod === 'bank' && styles.paymentMethodTabActive
                      ]}
                      onPress={() => setPaymentMethod('bank')}
                    >
                      <Ionicons 
                        name="business" 
                        size={18} 
                        color={paymentMethod === 'bank' ? '#fff' : colors.text} 
                      />
                      <Text style={[
                        styles.paymentMethodTabText,
                        paymentMethod === 'bank' && styles.paymentMethodTabTextActive
                      ]}>Bank</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* UPI Input */}
                {paymentMethod === 'upi' && (
                  <View style={styles.upiInputContainer}>
                    <Text style={styles.upiLabel}>Enter UPI ID</Text>
                    <TextInput
                      style={[styles.upiInput, getUpiValidationError() && styles.inputError]}
                      placeholder="yourname@upi"
                      placeholderTextColor={colors.textSecondary}
                      value={upiId}
                      onChangeText={setUpiId}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {getUpiValidationError() && (
                      <View style={styles.validationErrorRow}>
                        <Ionicons name="alert-circle" size={14} color={colors.error} />
                        <Text style={styles.validationErrorText}>{getUpiValidationError()}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Bank Account Inputs */}
                {paymentMethod === 'bank' && (
                  <>
                    <View style={styles.upiInputContainer}>
                      <Text style={styles.upiLabel}>Account Holder Name</Text>
                      <TextInput
                        style={[styles.upiInput, getAccountHolderValidationError() && styles.inputError]}
                        placeholder="Enter name as per bank account"
                        placeholderTextColor={colors.textSecondary}
                        value={accountHolderName}
                        onChangeText={setAccountHolderName}
                        autoCapitalize="words"
                      />
                      {getAccountHolderValidationError() && (
                        <View style={styles.validationErrorRow}>
                          <Ionicons name="alert-circle" size={14} color={colors.error} />
                          <Text style={styles.validationErrorText}>{getAccountHolderValidationError()}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.upiInputContainer}>
                      <Text style={styles.upiLabel}>Bank Account Number</Text>
                      <TextInput
                        style={[styles.upiInput, getBankAccountValidationError() && styles.inputError]}
                        placeholder="Enter account number"
                        placeholderTextColor={colors.textSecondary}
                        value={bankAccount}
                        onChangeText={(text) => setBankAccount(text.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                      />
                      {getBankAccountValidationError() && (
                        <View style={styles.validationErrorRow}>
                          <Ionicons name="alert-circle" size={14} color={colors.error} />
                          <Text style={styles.validationErrorText}>{getBankAccountValidationError()}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.upiInputContainer}>
                      <Text style={styles.upiLabel}>IFSC Code</Text>
                      <TextInput
                        style={[styles.upiInput, getIfscValidationError() && styles.inputError]}
                        placeholder="e.g., HDFC0001234"
                        placeholderTextColor={colors.textSecondary}
                        value={ifscCode}
                        onChangeText={(text) => setIfscCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        autoCapitalize="characters"
                        maxLength={11}
                      />
                      {getIfscValidationError() && (
                        <View style={styles.validationErrorRow}>
                          <Ionicons name="alert-circle" size={14} color={colors.error} />
                          <Text style={styles.validationErrorText}>{getIfscValidationError()}</Text>
                        </View>
                      )}
                    </View>
                  </>
                )}
                
                <View style={styles.conversionModalButtons}>
                  <TouchableOpacity
                    style={styles.conversionCancelButton}
                    onPress={() => {
                      setShowWithdrawModal(false);
                      setWithdrawAmount('');
                      setUpiId('');
                      setBankAccount('');
                      setIfscCode('');
                      setAccountHolderName('');
                      setPaymentMethod('upi');
                    }}
                    disabled={withdrawing}
                  >
                    <Text style={styles.conversionCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.conversionConfirmButton, 
                      { backgroundColor: colors.success },
                      (withdrawing || !isValidPaymentDetails() || !isValidWithdrawAmount()) && styles.conversionConfirmButtonDisabled
                    ]}
                    onPress={handleWithdraw}
                    disabled={withdrawing || !isValidPaymentDetails() || !isValidWithdrawAmount()}
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
                  <Ionicons name="information-circle" size={18} color={colors.warning} />
                  <Text style={styles.withdrawInfoText}>
                    You need ₹{withdrawableData.minimumWithdrawal - withdrawableData.withdrawableAmount} more to be eligible for withdrawal.
                    Keep referring and verifying to earn more!
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={[styles.conversionCancelButton, { marginTop: 16, alignSelf: 'center', width: '50%' }]}
                  onPress={() => setShowWithdrawModal(false)}
                >
                  <Text style={styles.conversionCancelText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          </ScrollView>
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
    padding: 16,
  },
  conversionModalContent: {
    backgroundColor: colors.surface || colors.background,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  conversionModalHeader: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  conversionModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  conversionModalDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
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
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  conversionCancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  conversionCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  conversionConfirmButton: {
    flex: 1,
    backgroundColor: '#7EB900',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  conversionConfirmButtonDisabled: {
    opacity: 0.6,
  },
  conversionConfirmText: {
    fontSize: 14,
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
    borderColor: colors.success + '33',
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
    borderColor: colors.success + '55',
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
  
  // Withdraw Modal Styles - ScrollView
  withdrawModalScrollView: {
    flex: 1,
    maxHeight: '90%',
  },
  withdrawModalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  // Compact Header for Modal
  withdrawModalHeaderCompact: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.success + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  withdrawModalTitleCompact: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  // Compact Liquid Display
  withdrawLiquidContainerCompact: {
    alignItems: 'center',
    marginVertical: 12,
  },
  withdrawLiquidOuterCompact: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.success + '55',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  withdrawLiquidAmountCompact: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  withdrawMinimumTextCompact: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 6,
  },
  // Original styles (kept for backwards compatibility)
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
    borderColor: colors.success + '55',
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
    marginBottom: 10,
  },
  upiLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  upiInput: {
    width: '100%',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 1.5,
  },
  validationErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  validationErrorText: {
    fontSize: 11,
    color: colors.error,
    flex: 1,
  },
  withdrawAvailableText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'right',
  },
  feeBreakdownContainer: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feeBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  feeBreakdownLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  feeBreakdownValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  feeBreakdownTotal: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 0,
  },
  feeBreakdownTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  feeBreakdownTotalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
  },
  withdrawWarningBox: {
    flexDirection: 'row',
    backgroundColor: colors.warning + '22',
    borderRadius: 8,
    padding: 8,
    gap: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  withdrawWarningText: {
    flex: 1,
    fontSize: 12,
    color: colors.warning,
  },
  withdrawInfoBox: {
    flexDirection: 'row',
    backgroundColor: colors.warning + '22',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  withdrawInfoText: {
    flex: 1,
    fontSize: 13,
    color: colors.warning,
    lineHeight: 18,
  },
  // Payment Method Styles
  paymentMethodContainer: {
    width: '100%',
    marginBottom: 10,
  },
  paymentMethodTabs: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  paymentMethodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  paymentMethodTabActive: {
    backgroundColor: colors.success,
  },
  paymentMethodTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  paymentMethodTabTextActive: {
    color: '#fff',
  },
});

export default ReferralPointsBreakdown;