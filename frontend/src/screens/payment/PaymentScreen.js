import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useResponsive from '../../hooks/useResponsive';
import refopenAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import { typography } from '../../styles/theme';
import { showToast } from '../../components/Toast';
import { frontendConfig } from '../../config/appConfig'; // Added

// Helper: format number as INR with rupee symbol (fallback if Intl unsupported)
const formatINR = (value) => {
  if (value == null || isNaN(Number(value))) return '?0';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
      .format(Number(value))
      .replace('INR', '') // keep symbol only
      .trim();
  } catch {
    return `?${Number(value).toFixed(2)}`;
  }
};

export default function PaymentScreen({ route, navigation }) {
  const { plan, returnScreen = 'ReferralPlans' } = route.params || {};
  const { user } = useAuth();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const [loading, setLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  useEffect(() => {
    if (!plan) {
      showToast('No plan selected', 'error');
      navigation.goBack();
      return;
    }
  }, [plan]);

  const initiatePayment = async () => {
    try {
      setLoading(true);
      const orderData = {
        amount: Math.round(plan.Price * 100), // paise
        currency: 'INR',
        planId: plan.PlanID,
        planName: plan.Name,
        customerEmail: user.email,
        customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      };

      const orderResponse = await refopenAPI.createRazorpayOrder(orderData);
      if (!orderResponse.success) throw new Error(orderResponse.error || 'Failed to create payment order');
      setOrderDetails(orderResponse.data);
      const paymentUrl = createRazorpayPaymentUrl(orderResponse.data);

      if (typeof window !== 'undefined') {
        loadRazorpayScript(orderResponse.data, orderData);
      } else {
        Linking.openURL(paymentUrl);
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      showToast('Failed to initiate payment. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRazorpayScript = (orderData, customerData) => {
    if (typeof window.Razorpay === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => openRazorpayCheckout(orderData, customerData);
      script.onerror = () => showToast('Failed to load payment gateway script. Please retry.', 'error');
      document.head.appendChild(script);
    } else {
      openRazorpayCheckout(orderData, customerData);
    }
  };

  const openRazorpayCheckout = (orderData, customerData) => {
    const key = frontendConfig?.razorpay?.keyId;
    if (!key) {
      showToast('Payment gateway key is not configured.', 'error');
      return;
    }

    const options = {
      key, // replaced hard-coded key with config-driven key
      amount: orderData.amount,
      currency: 'INR',
      name: 'RefOpen',
      description: `${customerData.planName} Subscription` || 'Subscription Payment',
      order_id: orderData.orderId || orderData.id, // support both shapes
      handler: (response) => {
        handlePaymentSuccess({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
          planId: plan.PlanID,
          amount: orderData.amount
        });
      },
      prefill: { name: customerData.customerName, email: customerData.customerEmail },
      theme: { color: '#3B82F6' },
      modal: { ondismiss: () => handlePaymentCancellation() }
    };

    if (!options.order_id || !/^order_/.test(options.order_id)) {
      console.warn('Razorpay order id missing or invalid format:', options.order_id);
      showToast('Invalid order id received. Please retry.', 'error');
      return;
    }

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        handlePaymentFailure({ error: response.error });
      });
      rzp.open();
    } catch (e) {
      showToast('Unable to open payment gateway. Please try again.', 'error');
    }
  };

  const createRazorpayPaymentUrl = (orderData) => `https://razorpay.com/payment-link/${orderData.orderId || orderData.id}`;

  const handlePaymentSuccess = async (paymentData) => {
    try {
      setLoading(true);
      const verificationData = {
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpayOrderId: paymentData.razorpay_order_id,
        razorpaySignature: paymentData.razorpay_signature,
        planId: paymentData.planId,
        amount: paymentData.amount,
      };
      const result = await refopenAPI.verifyPaymentAndActivateSubscription(verificationData);
      if (result.success) {
        showToast(`Subscription '${plan.Name}' activated successfully`, 'success');
        navigation.navigate('Jobs');
      } else {
        throw new Error(result.error || 'Payment verification failed');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      showToast('Payment verification failed. Please contact support.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentFailure = (errorData) => {
    console.error('Payment failed:', errorData);
    showToast(`Payment failed: ${errorData.error?.description || 'Please try again.'}`, 'error');
  };

  const handlePaymentCancellation = () => {
    showToast('Payment cancelled', 'warning');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Processing payment...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubScreenHeader title="Secure Payment" fallbackTab="Home" />
    <ScrollView style={styles.container}>
      <View style={styles.innerContainer}>
      <View style={styles.content}>
        <View style={styles.planSummary}>
          <Text style={styles.planName}>{plan?.Name}</Text>
          <Text style={styles.planPrice}>{formatINR(plan?.Price)}</Text>
          <Text style={styles.planDuration}>
            {plan?.DurationDays === 9999 ? 'Lifetime Access' : 
             plan?.DurationDays === 30 ? 'Monthly Subscription' :
             plan?.DurationDays === 7 ? 'Weekly Subscription' :
             `${plan?.DurationDays} days`}
          </Text>
        </View>

        <View style={styles.features}>
          <Text style={styles.featuresTitle}>What you get:</Text>
          <View style={styles.feature}><Ionicons name="checkmark-circle" size={20} color={colors.success} /><Text style={styles.featureText}>{plan?.ReferralsPerDay} referral requests per day</Text></View>
          <View style={styles.feature}><Ionicons name="checkmark-circle" size={20} color={colors.success} /><Text style={styles.featureText}>Priority processing</Text></View>
          <View style={styles.feature}><Ionicons name="checkmark-circle" size={20} color={colors.success} /><Text style={styles.featureText}>Email support</Text></View>
          <View style={styles.feature}><Ionicons name="checkmark-circle" size={20} color={colors.success} /><Text style={styles.featureText}>Advanced analytics</Text></View>
        </View>

        <View style={styles.securityInfo}>
          <Ionicons name="shield-checkmark" size={24} color={colors.success} />
          <Text style={styles.securityText}>
            Secure payment powered by Razorpay with 256-bit SSL encryption
          </Text>
        </View>

        <TouchableOpacity
          style={styles.payButton}
          onPress={initiatePayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="card" size={20} color={colors.white} />
              <Text style={styles.payButtonText}>Pay {formatINR(plan?.Price)}</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By proceeding with the payment, you agree to our Terms of Service and Privacy Policy. 
          Your subscription will be activated immediately upon successful payment.
        </Text>
      </View>
      </View>
    </ScrollView>
    </View>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  content: {
    padding: 20,
  },
  planSummary: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  planName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
  },
  planPrice: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: 4,
  },
  planDuration: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  features: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 16,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    marginLeft: 12,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '10',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  securityText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  payButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    marginBottom: 20,
  },
  payButtonText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginLeft: 8,
  },
  disclaimer: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});