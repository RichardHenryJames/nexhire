/**
 * EarningsScreen — Standalone screen for Referrer Dashboard
 * Route: /Earnings
 * Shows referral stats, earnings, milestone progress, and points breakdown
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePricing } from '../../contexts/PricingContext';
import useResponsive from '../../hooks/useResponsive';
import refopenAPI from '../../services/api';
import SubScreenHeader from '../../components/SubScreenHeader';
import ReferralPointsBreakdown from '../../components/profile/ReferralPointsBreakdown';

export default function EarningsScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();

  // Referral points data
  const [referralPointsData, setReferralPointsData] = useState({
    totalPoints: 0,
    pointsHistory: [],
    pointTypeMetadata: {},
    referralStats: {},
    totalPointsFromRewards: 0
  });
  const [loading, setLoading] = useState(true);

  // Load referral points data + referrer stats
  const loadReferralPoints = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      // Load BOTH: points history AND referral stats (two separate APIs)
      const [pointsResult, statsResult] = await Promise.all([
        refopenAPI.getReferralPointsHistory(),  // No args — uses auth token
        refopenAPI.getReferrerStats(),
      ]);

      const newData = { ...referralPointsData };

      if (pointsResult?.success && pointsResult.data) {
        newData.totalPoints = pointsResult.data.totalPoints || 0;
        newData.pointsHistory = pointsResult.data.history || [];
        newData.pointTypeMetadata = pointsResult.data.pointTypeMetadata || {};
      }

      if (statsResult?.success && statsResult.data) {
        newData.referralStats = statsResult.data;
      }

      setReferralPointsData(newData);
    } catch (error) {
      console.error('Error loading earnings data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadReferralPoints();
  }, [loadReferralPoints]);

  // Show the breakdown directly (not as modal — visible=true, fullscreen style)
  return (
    <ReferralPointsBreakdown
      visible={true}
      onClose={() => navigation.goBack()}
      totalPoints={referralPointsData.totalPoints}
      pointsHistory={referralPointsData.pointsHistory}
      pointTypeMetadata={referralPointsData.pointTypeMetadata}
      referralStats={referralPointsData.referralStats}
      navigation={navigation}
      onConversionSuccess={async () => {
        await loadReferralPoints();
      }}
    />
  );
}
