import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import { typography } from '../../styles/theme';
import refopenAPI from '../../services/api';
import { showToast } from '../../components/Toast';
import { usePricing } from '../../contexts/PricingContext';

// Animated percentage badge with fill effect
const BonusPercentBadge = ({ percent }) => {
  const fillAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    fillAnim.setValue(0);
    // Fill animation
    Animated.spring(fillAnim, { toValue: 1, tension: 40, friction: 8, useNativeDriver: false }).start();
    // Subtle pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
    // Shimmer sweep
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    ).start();
  }, [percent]);

  const fillWidth = fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const shimmerLeft = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: ['-30%', '130%'] });

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <View style={{ overflow: 'hidden', borderRadius: 8, borderWidth: 1, borderColor: '#10B98140', minWidth: 72 }}>
        {/* Background */}
        <View style={{ backgroundColor: '#10B98110', paddingHorizontal: 10, paddingVertical: 6 }}>
          {/* Animated fill */}
          <Animated.View style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: fillWidth, backgroundColor: '#10B98130', borderRadius: 8,
          }} />
          {/* Shimmer */}
          <Animated.View style={{
            position: 'absolute', top: 0, bottom: 0, width: '20%',
            left: shimmerLeft,
            backgroundColor: '#10B98118', borderRadius: 8,
          }} />
          {/* Text */}
          <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 13, textAlign: 'center', letterSpacing: 0.3 }}>
            {percent}% extra
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const ManualRechargeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { pricing } = usePricing();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Bonus Packs
  const [bonusPacks, setBonusPacks] = useState([]);
  const [selectedPack, setSelectedPack] = useState(null);

  // Promo Code
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null); // { valid, message, bonusAmount }
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [showPromoInput, setShowPromoInput] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsRes, packsRes] = await Promise.all([
        refopenAPI.getManualPaymentSettings(),
        refopenAPI.getBonusPacks(),
      ]);

      if (settingsRes?.success) {
        setSettings(settingsRes.data);
      }
      if (packsRes?.success) {
        setBonusPacks(packsRes.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePackSelect = (pack) => {
    if (selectedPack?.PackID === pack.PackID) {
      // Deselect
      setSelectedPack(null);
      setAmount('');
    } else {
      setSelectedPack(pack);
      setAmount(String(pack.PayAmount));
      // Re-validate promo if one is applied
      if (promoResult?.valid && promoCode) {
        handleValidatePromo(promoCode, pack.PayAmount);
      }
    }
  };

  const handleValidatePromo = async (code, rechargeAmount) => {
    const codeToValidate = code || promoCode;
    const amountToValidate = rechargeAmount || parseFloat(amount) || 0;
    
    if (!codeToValidate.trim()) {
      setPromoResult(null);
      return;
    }

    try {
      setValidatingPromo(true);
      const res = await refopenAPI.validatePromoCode(codeToValidate.trim(), amountToValidate);
      if (res?.success) {
        setPromoResult(res.data);
      } else {
        setPromoResult({ valid: false, message: 'Unable to validate promo code' });
      }
    } catch (error) {
      console.error('Error validating promo:', error);
      setPromoResult({ valid: false, message: 'Unable to validate promo code' });
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoCode('');
    setPromoResult(null);
  };

  // Calculate total credit
  const getPayAmount = () => parseFloat(amount) || 0;
  const getPackBonus = () => selectedPack?.BonusAmount || 0;
  const getPromoBonus = () => (promoResult?.valid ? promoResult.bonusAmount || 0 : 0);
  const getTotalCredit = () => getPayAmount() + getPackBonus() + getPromoBonus();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    section: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: typography.sizes?.md || 16,
      fontWeight: typography.weights?.semibold || '600',
      color: colors.text,
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '30',
    },
    infoLabel: {
      fontSize: typography.sizes?.sm || 14,
      color: colors.gray500,
      flex: 1,
    },
    infoValue: {
      fontSize: typography.sizes?.sm || 14,
      fontWeight: typography.weights?.medium || '500',
      color: colors.text,
      flex: 2,
      textAlign: 'right',
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: typography.sizes?.md || 16,
      color: colors.text,
      marginBottom: 16,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 16,
    },
    submitButtonText: {
      color: colors.white,
      fontSize: typography.sizes?.md || 16,
      fontWeight: typography.weights?.semibold || '600',
    },
    qrContainer: {
      backgroundColor: '#FFF',
      padding: 12,
      borderRadius: 12,
      marginBottom: 8,
    },
    qrImage: {
      width: 180,
      height: 180,
    },
    upiIdContainer: {
      backgroundColor: colors.primary + '10',
      borderRadius: 8,
      padding: 12,
      marginVertical: 12,
      width: '100%',
    },
    upiIdLabel: {
      fontSize: typography.sizes?.xs || 12,
      color: colors.gray500,
      marginBottom: 6,
      textAlign: 'center',
    },
    upiIdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderRadius: 6,
      padding: 10,
    },
    upiIdText: {
      fontSize: typography.sizes?.xs || 12,
      fontWeight: typography.weights?.medium || '500',
      color: colors.primary,
      whiteSpace: 'nowrap',
    },
    copyUpiBtn: {
      padding: 6,
      marginLeft: 8,
    },
    poweredByText: {
      fontSize: typography.sizes?.xs || 12,
      color: colors.gray500,
      fontStyle: 'italic',
    },
    orDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 14,
      gap: 8,
    },
    orDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border + '60',
    },
    orDividerText: {
      fontSize: typography.sizes?.xs || 12,
      color: colors.gray500,
      fontWeight: typography.weights?.medium || '500',
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SubScreenHeader title="Add Money" directBack="Wallet" />
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* QR Payment — prominent at top */}
        {settings && (
          <View style={[styles.section, { paddingVertical: 16, paddingHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.primary + '30' }]}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>Scan & Pay</Text>
              <View style={[styles.qrContainer, { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border }]}>
                <Image 
                  source={require('../../../assets/payment-qr.png')} 
                  style={{ width: 200, height: 200 }}
                  resizeMode="contain"
                />
              </View>
              {/* UPI ID inline */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: colors.primary + '08', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ fontSize: 10, color: colors.gray500, marginRight: 6 }}>UPI:</Text>
                <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '600' }} selectable numberOfLines={1}>rocanafashionaccessoriesprivatelimited.ibz@icici</Text>
                <TouchableOpacity 
                  style={{ marginLeft: 6, padding: 2 }}
                  onPress={() => {
                    Clipboard.setStringAsync('rocanafashionaccessoriesprivatelimited.ibz@icici');
                    showToast('UPI ID copied!', 'success');
                  }}
                >
                  <Ionicons name="copy-outline" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Bank Transfer — collapsed */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowBankDetails(!showBankDetails)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border + '40' }}
            >
              <Ionicons name="business-outline" size={14} color={colors.gray500} />
              <Text style={{ color: colors.gray500, fontSize: 12, fontWeight: '500', marginLeft: 4 }}>Bank Transfer Details</Text>
              <Ionicons name={showBankDetails ? 'chevron-up' : 'chevron-down'} size={14} color={colors.gray500} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            {showBankDetails && (
              <View style={{ marginTop: 8 }}>
                {[
                  { label: 'Bank', value: settings.bankName },
                  { label: 'Account Name', value: settings.bankAccountName },
                  { label: 'Account No', value: settings.bankAccountNumber },
                  { label: 'IFSC Code', value: settings.bankIfsc },
                ].map((item, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: idx < 3 ? 1 : 0, borderBottomColor: colors.border + '30' }}>
                    <Text style={{ fontSize: 12, color: colors.gray500 }}>{item.label}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: colors.text }}>{item.value}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={{ fontSize: 10, color: colors.gray500, fontStyle: 'italic', textAlign: 'center', marginTop: 10 }}>Refopen is powered by Rocana</Text>
          </View>
        )}

        {/* Choose a Pack — horizontal scroll */}
        {bonusPacks.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, paddingHorizontal: 4 }}>Choose a Pack</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 2, paddingVertical: 2 }}>
              {bonusPacks.map((pack) => {
                const isSelected = selectedPack?.PackID === pack.PackID;
                return (
                  <TouchableOpacity
                    key={pack.PackID}
                    activeOpacity={0.7}
                    onPress={() => handlePackSelect(pack)}
                    style={{
                      width: 130,
                      borderWidth: isSelected ? 1.5 : 1,
                      borderRadius: 10,
                      padding: 10,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary + '08' : colors.surface,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: pack.Badge ? 'space-between' : 'flex-end', alignItems: 'center', marginBottom: 3, minHeight: 16 }}>
                      {pack.Badge ? (
                        <View style={{ backgroundColor: pack.Badge === 'Most Popular' ? '#F59E0B' : pack.Badge === 'Best Value' ? '#10B981' : colors.primary, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3 }}>
                          <Text style={{ color: '#fff', fontSize: 7, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 }}>{pack.Badge}</Text>
                        </View>
                      ) : null}
                      {isSelected && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>₹{pack.PayAmount}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Get ₹{pack.GetAmount}</Text>
                    </View>
                    {pack.BonusPercent > 0 && (
                      <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 11, marginTop: 1 }}>+{Math.round(pack.BonusPercent)}% bonus</Text>
                    )}
                    {pack.ReferralsWorth > 0 && (
                      <Text style={{ color: colors.gray500, fontSize: 9, marginTop: 2 }}>≈ {pack.ReferralsWorth} referrals</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Custom Amount + Promo — compact row */}
        <View style={[styles.section, { padding: 10, marginBottom: 10 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 13, color: colors.gray500, fontWeight: '500' }}>Custom</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>₹</Text>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0, fontSize: 15, fontWeight: '600', paddingVertical: 6, paddingHorizontal: 10 }]}
              value={amount}
              onChangeText={(text) => {
                setAmount(text);
                const typed = parseFloat(text);
                const matchedPack = bonusPacks.find(p => p.PayAmount === typed);
                if (matchedPack) {
                  setSelectedPack(matchedPack);
                  if (promoResult?.valid && promoCode) handleValidatePromo(promoCode, typed);
                } else {
                  setSelectedPack(null);
                }
              }}
              placeholder={`Min ₹${settings?.minAmount || 1}`}
              placeholderTextColor={colors.gray400}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Promo Code — compact */}
        <View style={[styles.section, { paddingVertical: showPromoInput ? 10 : 8, paddingHorizontal: 12, marginBottom: 10 }]}>
          {!showPromoInput ? (
            <TouchableOpacity
              onPress={() => setShowPromoInput(true)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12, marginLeft: 5 }}>Got a promo code?</Text>
            </TouchableOpacity>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, paddingVertical: 8, fontSize: 13 }]}
                  value={promoCode}
                  onChangeText={(text) => {
                    setPromoCode(text.toUpperCase());
                    if (promoResult) setPromoResult(null);
                  }}
                  placeholder="Enter promo code"
                  placeholderTextColor={colors.gray400}
                  autoCapitalize="characters"
                  editable={!promoResult?.valid}
                />
                {promoResult?.valid ? (
                  <TouchableOpacity
                    onPress={handleRemovePromo}
                    style={{ backgroundColor: colors.error + '15', borderRadius: 8, paddingHorizontal: 10, justifyContent: 'center' }}
                  >
                    <Ionicons name="close" size={16} color={colors.error} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleValidatePromo()}
                    disabled={validatingPromo || !promoCode.trim()}
                    style={{ backgroundColor: promoCode.trim() ? colors.primary : colors.gray300, borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center' }}
                  >
                    {validatingPromo ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={{ color: colors.white, fontWeight: '600', fontSize: 12 }}>Apply</Text>}
                  </TouchableOpacity>
                )}
              </View>
              {promoResult && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons name={promoResult.valid ? 'checkmark-circle' : 'alert-circle'} size={12} color={promoResult.valid ? '#10B981' : colors.error} />
                  <Text style={{ color: promoResult.valid ? '#10B981' : colors.error, fontSize: 11, marginLeft: 4, flex: 1 }}>{promoResult.message}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Credit Summary — compact */}
        {getPayAmount() > 0 && (() => {
          const totalBonus = getPackBonus() + getPromoBonus();
          const bonusPct = totalBonus > 0 ? Math.round((totalBonus / getPayAmount()) * 100) : 0;
          return (
          <View style={[styles.section, { 
            backgroundColor: totalBonus > 0 ? '#10B981' + '08' : colors.surface, 
            borderWidth: totalBonus > 0 ? 1 : 0, 
            borderColor: '#10B981' + '25',
            paddingVertical: 10,
            paddingHorizontal: 12,
            marginBottom: 10,
          }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.gray500, fontSize: 11 }}>If you pay</Text>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 1 }}>₹{getPayAmount()}</Text>
                <View style={{ height: 1, backgroundColor: colors.border + '40', marginVertical: 6 }} />
                <Text style={{ color: colors.gray500, fontSize: 11 }}>You will get</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 1 }}>
                  <Text style={{ color: '#10B981', fontSize: 20, fontWeight: '800' }}>₹{getTotalCredit()}</Text>
                  {totalBonus > 0 && (
                    <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600', marginLeft: 5 }}>(+₹{totalBonus} bonus)</Text>
                  )}
                </View>
              </View>
              {bonusPct > 0 && <BonusPercentBadge percent={bonusPct} />}
            </View>
          </View>
          );
        })()}

        {/* Already Paid — navigates to Submit Payment screen */}
        <TouchableOpacity
          style={styles.submitButton}
          onPress={() => navigation.navigate('SubmitPayment')}
        >
          <Ionicons name="checkmark-done" size={22} color={colors.white} />
          <Text style={[styles.submitButtonText, { marginLeft: 8 }]}>Already Paid? Submit Details</Text>
        </TouchableOpacity>

        {/* Need Help */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Support')}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, marginBottom: 10 }}
        >
          <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Need Help?</Text>
        </TouchableOpacity>

        {/* FAQ Section */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10, paddingHorizontal: 4 }}>Frequently Asked Questions</Text>
          {[
            {
              q: 'Can I withdraw my added wallet balance?',
              a: 'No. Recharged balance and bonuses are non-withdrawable and can only be used for services on RefOpen such as referral requests, AI Job Recommendations, profile views, and other RefOpen services.',
            },
            {
              q: 'How does manual recharge work?',
              a: 'Scan the QR code or transfer to our UPI/bank account, then tap "Already Paid? Submit Details" to upload your payment proof. We\'ll verify and credit your wallet.',
            },
            {
              q: 'How long does it take to credit my wallet?',
              a: 'Manual payments are usually verified within 1 minute to 24 hours. You\'ll receive a notification once your wallet is credited.',
            },
            {
              q: 'What details do I need to submit after paying?',
              a: 'Your payment amount and a screenshot or UTR/transaction reference number from your payment app.',
            },
            {
              q: 'Do I still get pack bonuses with manual payment?',
              a: 'Yes! Select a pack before paying, and the bonus will be applied when your payment is verified.',
            },
            {
              q: 'Can I recharge a custom amount?',
              a: `Yes. Enter any custom amount — the minimum is ₹${settings?.minAmount || 1}.`,
            },
            {
              q: 'What can I spend wallet balance on?',
              a: `• Referral request at a specific company — ₹${pricing.referralRequestCost}\n• Open-to-any-company referral — ₹${pricing.openToAnyReferralCost}\n• AI Job Recommendations (${pricing.aiAccessDurationDays} days) — ₹${pricing.aiJobsCost}\n• Profile Views (${pricing.profileViewAccessDurationDays} days) — ₹${pricing.profileViewCost}`,
            },
            {
              q: 'What happens when I request a referral?',
              a: `When you request a referral, ₹${pricing.referralRequestCost} is placed on hold (not deducted). If a referrer picks up your request, the hold converts to a debit. If no one picks it up within 14 days, the full amount is automatically released back to your wallet.`,
            },
            {
              q: 'Who is Rocana?',
              a: 'Rocana is our payment processing partner. All bank/UPI transfers go through Rocana\'s verified accounts.',
            },
            {
              q: 'My payment was not credited?',
              a: 'Make sure you\'ve submitted payment proof via "Already Paid? Submit Details". If already submitted and not credited within 24 hours, contact us via "Need Help?".',
            },
          ].map((item, idx) => (
            <View key={idx} style={{ backgroundColor: colors.surface, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: colors.border + '40' }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}
              >
                <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: colors.text, marginRight: 8 }}>{item.q}</Text>
                <Ionicons name={expandedFaq === idx ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
              </TouchableOpacity>
              {expandedFaq === idx && (
                <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 0 }}>
                  <View style={{ height: 1, backgroundColor: colors.border + '30', marginBottom: 8 }} />
                  <Text style={{ fontSize: 11, color: colors.gray500, lineHeight: 17 }}>{item.a}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default ManualRechargeScreen;
