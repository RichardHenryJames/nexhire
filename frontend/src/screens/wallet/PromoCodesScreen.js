import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import { typography } from '../../styles/theme';
import refopenAPI from '../../services/api';
import { showToast } from '../../components/Toast';
import useResponsive from '../../hooks/useResponsive';

// ─── Promo Code Card ─────────────────────────────────────────────
const PromoCard = ({ promo, colors, onApply }) => {
  const isPercent = promo.type === 'PERCENT_BONUS';
  const bonusLabel = isPercent
    ? `${promo.value}% extra`
    : `₹${promo.value} bonus`;
  const exhausted = promo.exhausted;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(promo.code);
    showToast('success', 'Copied!', `${promo.code} copied to clipboard`);
  };

  return (
    <View style={{
      backgroundColor: exhausted ? colors.surface + '80' : colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: promo.recommended ? colors.primary + '40' : colors.border,
      opacity: exhausted ? 0.6 : 1,
    }}>
      {/* Top row: Code badge + bonus */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{
            backgroundColor: exhausted ? colors.gray300 : colors.primary + '15',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: exhausted ? colors.gray400 : colors.primary + '30',
            borderStyle: 'dashed',
          }}>
            <Text style={{
              fontSize: 14,
              fontWeight: '800',
              color: exhausted ? colors.gray500 : colors.primary,
              letterSpacing: 1.5,
            }}>{promo.code}</Text>
          </View>
          <TouchableOpacity onPress={handleCopy} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="copy-outline" size={16} color={colors.gray500} />
          </TouchableOpacity>
        </View>
        <View style={{
          backgroundColor: exhausted ? colors.gray200 : '#10B98115',
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 10,
        }}>
          <Text style={{
            fontSize: 12,
            fontWeight: '700',
            color: exhausted ? colors.gray500 : '#10B981',
          }}>{bonusLabel}</Text>
        </View>
      </View>

      {/* Description */}
      {promo.description ? (
        <Text style={{ fontSize: 12, color: colors.gray600 || colors.gray500, marginBottom: 6, lineHeight: 17 }}>
          {promo.description}
        </Text>
      ) : null}

      {/* Recommendation reason */}
      {promo.recommended && promo.recommendReason ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 4 }}>
          <Text style={{ fontSize: 11, color: '#F59E0B' }}>✨</Text>
          <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '600', fontStyle: 'italic' }}>
            {promo.recommendReason}
          </Text>
        </View>
      ) : null}

      {/* Details row */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <Text style={{ fontSize: 11, color: colors.gray500 }}>Min ₹{promo.minRecharge}</Text>
        {promo.maxBonus !== null && (
          <Text style={{ fontSize: 11, color: colors.gray500 }}>Max ₹{promo.maxBonus}</Text>
        )}
      </View>

      {/* Action button */}
      {exhausted ? (
        <View style={{
          backgroundColor: colors.gray200,
          borderRadius: 8,
          paddingVertical: 8,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.gray500 }}>✓ All uses exhausted</Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => onApply(promo.code)}
          activeOpacity={0.7}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 8,
            paddingVertical: 8,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          <Ionicons name="flash-outline" size={14} color="#fff" />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Use This Code</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────
const PromoCodesScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { maxWidth } = useResponsive();
  const styles = createStyles(colors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [promoCodes, setPromoCodes] = useState([]);

  const fetchPromoCodes = useCallback(async () => {
    try {
      const response = await refopenAPI.getPromoCodes();
      if (response?.success && response.data) {
        setPromoCodes(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch promo codes:', error);
      showToast('error', 'Error', 'Failed to load promo codes');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchPromoCodes();
      setLoading(false);
    })();
  }, [fetchPromoCodes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPromoCodes();
    setRefreshing(false);
  };

  const handleApply = (code) => {
    navigation.navigate({ name: 'WalletRecharge', params: { promoCode: code }, merge: true });
  };

  const recommended = promoCodes.filter(p => p.recommended);
  const others = promoCodes.filter(p => !p.recommended && !p.exhausted);
  const exhaustedCodes = promoCodes.filter(p => p.exhausted);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <SubScreenHeader title="Promo Codes" directBack="WalletRecharge" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.gray500, marginTop: 10, fontSize: 13 }}>Loading offers...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SubScreenHeader title="Promo Codes" directBack="WalletRecharge" />
      <View style={styles.content}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { maxWidth, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        >
          {/* Hero banner */}
          <View style={{
            backgroundColor: colors.primary + '0A',
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.primary + '20',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="pricetags" size={20} color={colors.primary} />
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Save on Every Recharge</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.gray500, lineHeight: 18 }}>
              Apply a promo code when adding money to get extra wallet credit. Stack with booster pack bonuses!
            </Text>
          </View>

          {/* Recommended section */}
          {recommended.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>Recommended for You</Text>
              </View>
              {recommended.map((promo) => (
                <PromoCard key={promo.code} promo={promo} colors={colors} onApply={handleApply} />
              ))}
            </View>
          )}

          {/* All codes section */}
          {others.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                  {recommended.length > 0 ? 'Other Codes' : 'Available Codes'}
                </Text>
              </View>
              {others.map((promo) => (
                <PromoCard key={promo.code} promo={promo} colors={colors} onApply={handleApply} />
              ))}
            </View>
          )}

          {/* Exhausted codes */}
          {exhaustedCodes.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Ionicons name="checkmark-done-outline" size={16} color={colors.gray400} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.gray400 }}>Used Up</Text>
              </View>
              {exhaustedCodes.map((promo) => (
                <PromoCard key={promo.code} promo={promo} colors={colors} onApply={handleApply} />
              ))}
            </View>
          )}

          {/* Empty state */}
          {promoCodes.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="pricetags-outline" size={48} color={colors.gray300} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.gray500, marginTop: 12 }}>No promo codes available</Text>
              <Text style={{ fontSize: 12, color: colors.gray400, marginTop: 4 }}>Check back later for new offers!</Text>
            </View>
          )}

          {/* How it works */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 }}>How it works</Text>
            {[
              { icon: 'copy-outline', text: 'Copy a promo code or tap "Use This Code"' },
              { icon: 'wallet-outline', text: 'Enter it while adding money to your wallet' },
              { icon: 'gift-outline', text: 'Get extra credit added to your balance!' },
            ].map((step, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: i < 2 ? 6 : 0 }}>
                <View style={{
                  width: 24, height: 24, borderRadius: 12,
                  backgroundColor: colors.primary + '15',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={step.icon} size={12} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 11, color: colors.gray500, flex: 1 }}>{step.text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────
const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  scrollContent: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default PromoCodesScreen;
