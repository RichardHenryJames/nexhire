import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';
import { showToast } from '../../components/Toast';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';

export default function WalletRechargeScreen({ navigation }) {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ Smart back navigation for hard refresh scenarios
  React.useEffect(() => {
    navigation.setOptions({
      title: 'Add Money to Wallet',
      headerStyle: { backgroundColor: colors.surface, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
      headerTitleStyle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text },
      headerLeft: () => (
        <TouchableOpacity 
          style={{ marginLeft: 16, padding: 4 }} 
          onPress={() => {
            const navState = navigation.getState();
            const routes = navState?.routes || [];
            const currentIndex = navState?.index || 0;
            if (routes.length > 1 && currentIndex > 0) {
              navigation.goBack();
            } else {
              navigation.navigate('Wallet');
            }
          }} 
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  // Quick amount buttons
  const quickAmounts = [100, 200, 300, 500, 1000];

  const handleQuickAmount = (value) => {
    setAmount(value.toString());
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
      const orderResult = await refopenAPI.createWalletRechargeOrder(rechargeAmount);

      if (!orderResult.success) {
        throw new Error(orderResult.error || 'Failed to create order');
      }

      // For web platform, use Razorpay web checkout
      if (Platform.OS === 'web') {
        loadRazorpayScript(orderResult.data, rechargeAmount);
      } else {
        // For mobile, you'll need to integrate react-native-razorpay
        showToast('Razorpay mobile integration pending. Please use web version for now.', 'info');
        setLoading(false);
      }
    } catch (error) {
      console.error('Recharge error:', error);
      showToast('Failed to process recharge. Please try again.', 'error');
      setLoading(false);
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
        // Navigate to Payment Success screen for tracking and confirmation
        navigation.navigate('PaymentSuccess', {
          amount: rechargeAmount,
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
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
          {/* Header */}
          <View style={styles.header}>
        <Ionicons name="wallet" size={48} color="#007AFF" />
        <Text style={styles.headerTitle}>Recharge Wallet</Text>
        <Text style={styles.headerSubtitle}>Add money to your wallet</Text>
      </View>

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
              // Only allow numbers
              const numericValue = text.replace(/[^0-9]/g, '');
              setAmount(numericValue);
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
        </ScrollView>
      </View>
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
