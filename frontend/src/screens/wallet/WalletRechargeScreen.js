import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';
import { showToast } from '../../components/Toast';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import ScreenWrapper from '../../components/ScreenWrapper';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
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

export default function WalletRechargeScreen({ navigation }) {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const { pricing } = usePricing();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const [expandedFaq, setExpandedFaq] = useState(null);
  
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Bonus Packs
  const [bonusPacks, setBonusPacks] = useState([]);
  const [selectedPack, setSelectedPack] = useState(null);

  // Promo Code
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [showPromoInput, setShowPromoInput] = useState(false);

  // Quick amount buttons
  const quickAmounts = [100, 200, 300, 500, 1000];

  // Load bonus packs on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await refopenAPI.getBonusPacks();
        if (res?.success) setBonusPacks(res.data || []);
      } catch (e) {
        console.error('Error loading packs:', e);
      } finally {
        setInitialLoading(false);
      }
    })();
  }, []);

  const handlePackSelect = (pack) => {
    if (selectedPack?.PackID === pack.PackID) {
      setSelectedPack(null);
      setAmount('');
    } else {
      setSelectedPack(pack);
      setAmount(String(pack.PayAmount));
      if (promoResult?.valid && promoCode) {
        handleValidatePromo(promoCode, pack.PayAmount);
      }
    }
  };

  const handleValidatePromo = async (code, rechargeAmount) => {
    const codeToValidate = code || promoCode;
    const amountToValidate = rechargeAmount || parseFloat(amount) || 0;
    if (!codeToValidate.trim()) { setPromoResult(null); return; }
    try {
      setValidatingPromo(true);
      const res = await refopenAPI.validatePromoCode(codeToValidate.trim(), amountToValidate);
      if (res?.success) setPromoResult(res.data);
      else setPromoResult({ valid: false, message: 'Unable to validate promo code' });
    } catch (e) {
      setPromoResult({ valid: false, message: 'Unable to validate promo code' });
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => { setPromoCode(''); setPromoResult(null); };

  const getPayAmount = () => parseFloat(amount) || 0;
  const getPackBonus = () => selectedPack?.BonusAmount || 0;
  const getPromoBonus = () => (promoResult?.valid ? promoResult.bonusAmount || 0 : 0);
  const getTotalCredit = () => getPayAmount() + getPackBonus() + getPromoBonus();

  const handleQuickAmount = (value) => {
    setAmount(value.toString());
    // Check if this matches a pack
    const matchingPack = bonusPacks.find(p => p.PayAmount === value);
    setSelectedPack(matchingPack || null);
  };

  const validateAmount = () => {
    const rechargeAmount = parseInt(amount);

    if (!rechargeAmount || isNaN(rechargeAmount)) {
      showToast('Please enter a valid amount', 'error');
      return false;
    }

    if (rechargeAmount <= 0) {
      showToast('Amount must be greater than zero', 'error');
      return false;
    }

    if (rechargeAmount > 100000) {
      showToast('Maximum recharge amount is ₹1,00,000', 'error');
      return false;
    }

    return true;
  };

  const handleRecharge = async () => {
    if (!validateAmount()) return;

    const rechargeAmount = parseInt(amount);

    try {
      setLoading(true);

      // Create Razorpay order
      const orderResult = await refopenAPI.createWalletRechargeOrder(
        rechargeAmount,
        4,
        selectedPack?.PackID || null,
        promoResult?.valid ? promoCode.trim().toUpperCase() : null
      );

      if (!orderResult.success) {
        throw new Error(orderResult.error || 'Failed to create order');
      }

      // For web platform, use Razorpay web checkout
      if (Platform.OS === 'web') {
        loadRazorpayScript(orderResult.data, rechargeAmount);
      } else {
        // Native: use react-native-razorpay SDK
        openRazorpayNative(orderResult.data, rechargeAmount);
      }
    } catch (error) {
      console.error('Recharge error:', error);
      showToast('Failed to process recharge. Please try again.', 'error');
      setLoading(false);
    }
  };

  // Native Razorpay checkout using react-native-razorpay SDK
  const openRazorpayNative = async (orderData, rechargeAmount) => {
    try {
      const RazorpayCheckout = require('react-native-razorpay').default;
      if (!orderData.razorpayKeyId) {
        showToast('Payment gateway configuration is missing.', 'error');
        setLoading(false);
        return;
      }

      const options = {
        key: orderData.razorpayKeyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'RefOpen',
        description: 'Wallet Recharge',
        order_id: orderData.orderId,
        prefill: {
          name: '',
          email: '',
          contact: '',
        },
        theme: { color: '#007AFF' },
      };

      const response = await RazorpayCheckout.open(options);
      await verifyPayment(response, rechargeAmount);
    } catch (error) {
      if (error?.code === 'PAYMENT_CANCELLED' || error?.description?.includes('cancelled')) {
        setLoading(false);
      } else {
        console.error('Native Razorpay error:', error);
        showToast('Payment failed. Please try again.', 'error');
        setLoading(false);
      }
    }
  };

  // Load Razorpay script dynamically
  const loadRazorpayScript = (orderData, rechargeAmount) => {
    if (typeof window !== 'undefined') {
      if (typeof window.Razorpay === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          openRazorpayWeb(orderData, rechargeAmount);
        };
        script.onerror = () => {
          console.error('Failed to load Razorpay script');
          showToast('Failed to load payment gateway script. Please refresh the page and try again.', 'error');
          setLoading(false);
        };
        document.head.appendChild(script);
      } else {
        openRazorpayWeb(orderData, rechargeAmount);
      }
    } else {
      showToast('Payment gateway is only available on web platform', 'error');
      setLoading(false);
    }
  };

  const openRazorpayWeb = (orderData, rechargeAmount) => {
    if (!orderData.razorpayKeyId) {
      showToast('Payment gateway configuration is missing. Please contact support.', 'error');
      setLoading(false);
      return;
    }

    if (!orderData.orderId) {
      showToast('Order ID is missing. Please try again.', 'error');
      setLoading(false);
      return;
    }

    const options = {
      key: orderData.razorpayKeyId,
      amount: orderData.amount, // amount in paise
      currency: orderData.currency || 'INR',
      name: 'RefOpen',
      description: 'Wallet Recharge',
      order_id: orderData.orderId,
      handler: async function (response) {
        await verifyPayment(response, rechargeAmount);
      },
      prefill: {
        name: '',
        email: '',
        contact: '',
      },
      theme: {
        color: '#007AFF',
      },
      modal: {
        ondismiss: function () {
          setLoading(false);
        },
      },
    };

    if (typeof window !== 'undefined' && window.Razorpay) {
      try {
        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } catch (error) {
        console.error('Error opening Razorpay:', error);
        showToast('Failed to open payment gateway. Please try again.', 'error');
        setLoading(false);
      }
    } else {
      showToast('Razorpay is not loaded. Please refresh the page.', 'error');
      setLoading(false);
    }
  };

  const verifyPayment = async (response, rechargeAmount) => {
    try {
      setLoading(true);

      const verifyResult = await refopenAPI.verifyWalletRecharge({
        razorpayPaymentId: response.razorpay_payment_id,
        razorpayOrderId: response.razorpay_order_id,
        razorpaySignature: response.razorpay_signature,
      });

      if (verifyResult.success) {
        setAmount('');
        setSelectedPack(null);
        setPromoCode('');
        setPromoResult(null);
        setShowPromoInput(false);
        // Navigate to Payment Success screen for tracking and confirmation
        navigation.navigate('PaymentSuccess', {
          amount: rechargeAmount,
          bonusCredited: verifyResult.data.bonusCredited || 0,
          balanceAfter: verifyResult.data.balanceAfter,
          transactionId: verifyResult.data.transactionId || '',
          paymentId: response.razorpay_payment_id,
        });
      } else {
        throw new Error(verifyResult.error || 'Payment verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      showToast('Verification failed. Please contact support.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper withKeyboard>
    <View style={styles.container}>
      <SubScreenHeader title="Add Money" fallbackTab="Home" />
      <View style={styles.innerContainer}>
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
          {/* Header */}
          <View style={styles.header}>
        <Ionicons name="wallet" size={48} color="#007AFF" />
        <Text style={styles.headerTitle}>Recharge Wallet</Text>
        <Text style={styles.headerSubtitle}>Add money to your wallet</Text>
      </View>

      {/* Bonus Packs — horizontal scroll */}
      {bonusPacks.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={styles.sectionTitle}>Choose a Pack</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 2, paddingVertical: 2 }}>
            {bonusPacks.map((pack) => {
              const isSelected = selectedPack?.PackID === pack.PackID;
              return (
                <TouchableOpacity
                  key={pack.PackID}
                  activeOpacity={0.7}
                  onPress={() => handlePackSelect(pack)}
                  style={{
                    width: 140,
                    borderWidth: isSelected ? 1.5 : 1,
                    borderRadius: 10,
                    padding: 10,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary + '08' : colors.surface,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: pack.Badge ? 'space-between' : 'flex-end', alignItems: 'center', marginBottom: 3, minHeight: 18 }}>
                    {pack.Badge ? (
                      <View style={{ backgroundColor: pack.Badge === 'Most Popular' ? '#F59E0B' : pack.Badge === 'Best Value' ? '#10B981' : colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 }}>{pack.Badge}</Text>
                      </View>
                    ) : null}
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>₹{pack.PayAmount}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Get ₹{pack.GetAmount}</Text>
                  </View>
                  {pack.BonusPercent > 0 && (
                    <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 11, marginTop: 1 }}>+{Math.round(pack.BonusPercent)}% bonus</Text>
                  )}
                  {pack.ReferralsWorth > 0 && (
                    <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>≈ {pack.ReferralsWorth} referrals</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Promo Code — compact inline */}
      <View style={[styles.section, { paddingVertical: showPromoInput ? 14 : 10 }]}>
        {!showPromoInput ? (
          <TouchableOpacity
            onPress={() => setShowPromoInput(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13, marginLeft: 6 }}>Have a promo code?</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={{
                  flex: 1, backgroundColor: colors.surface, borderWidth: 1,
                  borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
                  fontSize: 14, color: colors.text,
                }}
                value={promoCode}
                onChangeText={(text) => { setPromoCode(text.toUpperCase()); if (promoResult) setPromoResult(null); }}
                placeholder="Enter promo code"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                editable={!promoResult?.valid}
              />
              {promoResult?.valid ? (
                <TouchableOpacity
                  onPress={handleRemovePromo}
                  style={{ backgroundColor: '#EF4444' + '15', borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={18} color="#EF4444" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => handleValidatePromo()}
                  disabled={validatingPromo || !promoCode.trim()}
                  style={{ backgroundColor: promoCode.trim() ? colors.primary : (colors.gray400 || '#6B7280'), borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' }}
                >
                  {validatingPromo ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>Apply</Text>}
                </TouchableOpacity>
              )}
            </View>
            {promoResult && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <Ionicons name={promoResult.valid ? 'checkmark-circle' : 'alert-circle'} size={14} color={promoResult.valid ? '#10B981' : '#EF4444'} />
                <Text style={{ color: promoResult.valid ? '#10B981' : '#EF4444', fontSize: 12, marginLeft: 4, flex: 1 }}>{promoResult.message}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Credit Summary — compact */}
      {(selectedPack || promoResult?.valid) && getPayAmount() > 0 && (() => {
        const bonusPct = Math.round(((getTotalCredit() - getPayAmount()) / getPayAmount()) * 100);
        return (
        <View style={{
          backgroundColor: colors.primary + '06', borderWidth: 1, borderColor: colors.primary + '25',
          borderRadius: 12, padding: 12, marginBottom: 24,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>If you pay</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 1 }}>₹{getPayAmount()}</Text>
              <View style={{ height: 1, backgroundColor: colors.border + '40', marginVertical: 6 }} />
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>You will get</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 1 }}>
                <Text style={{ color: '#10B981', fontSize: 20, fontWeight: '800' }}>₹{getTotalCredit()}</Text>
                {(getPackBonus() + getPromoBonus()) > 0 && (
                  <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600', marginLeft: 6 }}>
                    (+₹{getPackBonus() + getPromoBonus()} bonus)
                  </Text>
                )}
              </View>
            </View>
            <BonusPercentBadge percent={bonusPct} />
          </View>
        </View>
        );
      })()}

      {/* Quick Amount Buttons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Select</Text>
        <View style={styles.quickAmountsContainer}>
          {quickAmounts.map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => handleQuickAmount(value)}
              style={[
                styles.quickAmountButton,
                amount === value.toString() && styles.quickAmountButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.quickAmountText,
                  amount === value.toString() && styles.quickAmountTextSelected,
                ]}
              >
                ₹{value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Manual Amount Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Or Enter Amount</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={(text) => {
              const numericValue = text.replace(/[^0-9]/g, '');
              setAmount(numericValue);
              // Auto-match typed amount to a pack
              const typed = parseFloat(numericValue);
              const matchedPack = bonusPacks.find(p => p.PayAmount === typed);
              if (matchedPack) {
                setSelectedPack(matchedPack);
                if (promoResult?.valid && promoCode) {
                  handleValidatePromo(promoCode, typed);
                }
              } else {
                setSelectedPack(null);
              }
            }}
            placeholder="Enter amount"
            keyboardType="numeric"
            style={styles.input}
            editable={!loading}
          />
        </View>

        {/* Validation Messages */}
        {amount && parseInt(amount) <= 0 && (
          <Text style={styles.errorText}>Amount must be greater than zero</Text>
        )}
        {amount && parseInt(amount) > 100000 && (
          <Text style={styles.errorText}>Maximum recharge: ₹1,00,000</Text>
        )}
      </View>

      {/* Information */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color="#007AFF" />
        <Text style={styles.infoText}>
          Maximum recharge: ₹1,00,000{'\n'}
          Instant credit after payment
        </Text>
      </View>

      {/* Recharge Button */}
      <TouchableOpacity
        style={[
          styles.rechargeButton,
          (!amount || parseInt(amount) <= 0 || loading) && styles.rechargeButtonDisabled,
        ]}
        onPress={handleRecharge}
        disabled={!amount || parseInt(amount) <= 0 || loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Ionicons name="card" size={24} color="#FFF" />
            <Text style={styles.rechargeButtonText}>
              Proceed to Pay ₹{amount || '0'}
              {(getPackBonus() + getPromoBonus()) > 0 ? ` (Get ₹${getTotalCredit()})` : ''}
            </Text>
          </>
        )}
      </TouchableOpacity>

          {/* Payment Methods */}
          <View style={styles.paymentMethods}>
            <Text style={styles.paymentMethodsTitle}>Accepted Payment Methods</Text>
            <View style={styles.paymentMethodsIcons}>
              <View style={styles.paymentMethodItem}>
                <Ionicons name="card" size={32} color="#666" />
                <Text style={styles.paymentMethodText}>Cards</Text>
              </View>
              <View style={styles.paymentMethodItem}>
                <Ionicons name="phone-portrait" size={32} color="#666" />
                <Text style={styles.paymentMethodText}>UPI</Text>
              </View>
              <View style={styles.paymentMethodItem}>
                <Ionicons name="business" size={32} color="#666" />
                <Text style={styles.paymentMethodText}>Netbanking</Text>
              </View>
            </View>
          </View>

          {/* FAQ Section */}
          <View style={{ marginTop: 24, marginBottom: 32 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 }}>Frequently Asked Questions</Text>
            {[
              {
                q: 'Can I withdraw my added wallet balance?',
                a: 'No. Recharged balance and bonuses are non-withdrawable and can only be used for services on RefOpen such as referral requests, AI Job Recommendations, profile views, and other RefOpen services.',
              },
              {
                q: 'How does the bonus on packs work?',
                a: 'When you select a pack, you pay less and receive more. For example, pay ₹89 and get ₹100 in your wallet — that\'s a 12% bonus. The bonus is credited instantly and usable like regular balance.',
              },
              {
                q: 'What payment methods are accepted?',
                a: 'UPI, credit/debit cards, and netbanking — all processed securely via Razorpay, an RBI-licensed payment gateway. We never store your card or bank details.',
              },
              {
                q: 'Can I recharge a custom amount?',
                a: 'Yes! Enter any amount (min ₹1, max ₹1,00,000). Note: pack bonus is only applied when you select a pack or enter an amount matching a pack.',
              },
              {
                q: 'How do promo codes work?',
                a: 'Enter a valid promo code to receive extra bonus credits on top of your recharge. Promo codes have usage limits and expiry dates.',
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
                q: 'My payment was deducted but balance not updated?',
                a: 'This is rare — balance usually updates within seconds. If it doesn\'t, contact us via "Need Help?" and we\'ll resolve it within 24 hours.',
              },
            ].map((item, idx) => (
              <View key={idx} style={{ backgroundColor: colors.surface, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border + '40' }}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}
                >
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text, marginRight: 8 }}>{item.q}</Text>
                  <Ionicons name={expandedFaq === idx ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
                </TouchableOpacity>
                {expandedFaq === idx && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 0 }}>
                    <View style={{ height: 1, backgroundColor: colors.border + '30', marginBottom: 10 }} />
                    <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>{item.a}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
    </ScreenWrapper>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  innerContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 900 : '100%',
    flex: 1,
    ...(Platform.OS === 'web' ? { overflow: 'hidden' } : {}),
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  quickAmountsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAmountButton: {
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    minWidth: 100,
    alignItems: 'center',
  },
  quickAmountButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickAmountText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  quickAmountTextSelected: {
    color: '#FFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    paddingVertical: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  rechargeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 24,
  },
  rechargeButtonDisabled: {
    backgroundColor: colors.gray400 || '#6B7280',
  },
  rechargeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  paymentMethods: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
  },
  paymentMethodsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  paymentMethodsIcons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  paymentMethodItem: {
    alignItems: 'center',
    gap: 8,
  },
  paymentMethodText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
