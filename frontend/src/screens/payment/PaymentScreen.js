import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import nexhireAPI from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography } from '../../styles/theme';

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
  const [loading, setLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);

  useEffect(() => {
    if (!plan) {
      Alert.alert('Error', 'No plan selected');
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

      const orderResponse = await nexhireAPI.createRazorpayOrder(orderData);
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
      Alert.alert('Payment Error', error.message || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  const loadRazorpayScript = (orderData, customerData) => {
    if (typeof window.Razorpay === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => openRazorpayCheckout(orderData, customerData);
      script.onerror = () => Alert.alert('Error', 'Failed to load payment gateway script. Please retry.');
      document.head.appendChild(script);
    } else {
      openRazorpayCheckout(orderData, customerData);
    }
  };

  const openRazorpayCheckout = (orderData, customerData) => {
    const options = {
      key: 'rzp_test_RHBUKjg4k9qx4J',
      amount: orderData.amount,
      currency: 'INR',
      name: 'NexHire',
      description: `${customerData.planName} Subscription`,
      order_id: orderData.orderId,
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

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        handlePaymentFailure({ error: response.error });
      });
      rzp.open();
    } catch (e) {
      Alert.alert('Payment Error', 'Unable to open payment gateway. Please try again.');
    }
  };

  const createRazorpayPaymentUrl = (orderData) => `https://razorpay.com/payment-link/${orderData.orderId}`;

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
      const result = await nexhireAPI.verifyPaymentAndActivateSubscription(verificationData);
      if (result.success) {
        Alert.alert(
          '?? Payment Successful!',
          `Welcome to ${plan.Name}! Your subscription has been activated and you now have unlimited referral requests.`,
          [
            { text: 'Start Referring!', onPress: () => navigation.navigate(returnScreen === 'ReferralPlans' ? 'ReferralPlans' : 'Jobs') }
          ]
        );
      } else {
        throw new Error(result.error || 'Payment verification failed');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      Alert.alert('Verification Error', error.message || 'Payment verification failed. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentFailure = (errorData) => {
    console.error('Payment failed:', errorData);
    Alert.alert(
      'Payment Failed',
      `Payment could not be processed. ${errorData.error?.description || 'Please try again.'}`,
      [
        { text: 'Retry', onPress: () => initiatePayment() },
        { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() }
      ]
    );
  };

  const handlePaymentCancellation = () => {
    Alert.alert(
      'Payment Cancelled',
      'You cancelled the payment. Would you like to try again?',
      [
        { text: 'Retry', onPress: () => initiatePayment() },
        { text: 'Go Back', style: 'cancel', onPress: () => navigation.goBack() }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Processing payment...</Text>
      </View>
    );
  }

  // Payment initiation screen
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.gray600,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
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
    color: colors.gray600,
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
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 18,
  },
});