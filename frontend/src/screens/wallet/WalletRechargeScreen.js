import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';

export default function WalletRechargeScreen({ navigation }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Quick amount buttons
  const quickAmounts = [100, 200, 300, 500, 1000];

  const handleQuickAmount = (value) => {
    setAmount(value.toString());
  };

  const validateAmount = () => {
    const rechargeAmount = parseInt(amount);

    if (!rechargeAmount || isNaN(rechargeAmount)) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return false;
    }

    if (rechargeAmount < 100) {
      Alert.alert('Minimum Amount', 'Minimum recharge amount is ₹100');
      return false;
    }

    if (rechargeAmount > 100000) {
      Alert.alert('Maximum Amount', 'Maximum recharge amount is ₹1,00,000');
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

      console.log('Order created:', orderResult.data);

      // For web platform, use Razorpay web checkout
      if (Platform.OS === 'web') {
        loadRazorpayScript(orderResult.data, rechargeAmount);
      } else {
        // For mobile, you'll need to integrate react-native-razorpay
        Alert.alert(
          'Mobile Payment',
          'Razorpay mobile integration pending. Please use web version for now.',
          [{ text: 'OK' }]
        );
        setLoading(false);
      }
    } catch (error) {
      console.error('Recharge error:', error);
      Alert.alert('Error', error.message || 'Failed to process recharge');
      setLoading(false);
    }
  };

  // Load Razorpay script dynamically
  const loadRazorpayScript = (orderData, rechargeAmount) => {
    if (typeof window !== 'undefined') {
      if (typeof window.Razorpay === 'undefined') {
        console.log('Loading Razorpay script...');
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          console.log('Razorpay script loaded successfully');
          openRazorpayWeb(orderData, rechargeAmount);
        };
        script.onerror = () => {
          console.error('Failed to load Razorpay script');
          Alert.alert('Error', 'Failed to load payment gateway script. Please refresh the page and try again.');
          setLoading(false);
        };
        document.head.appendChild(script);
      } else {
        console.log('Razorpay script already loaded');
        openRazorpayWeb(orderData, rechargeAmount);
      }
    } else {
      Alert.alert('Error', 'Payment gateway is only available on web platform');
      setLoading(false);
    }
  };

  const openRazorpayWeb = (orderData, rechargeAmount) => {
    console.log('Opening Razorpay checkout with order:', orderData);
    
    if (!orderData.razorpayKeyId) {
      Alert.alert('Error', 'Payment gateway configuration is missing. Please contact support.');
      setLoading(false);
      return;
    }

    if (!orderData.orderId) {
      Alert.alert('Error', 'Order ID is missing. Please try again.');
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
        console.log('Payment success:', response);
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
          console.log('Payment cancelled by user');
        },
      },
    };

    console.log('Razorpay options:', { ...options, key: options.key.substring(0, 10) + '...' });

    if (typeof window !== 'undefined' && window.Razorpay) {
      try {
        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } catch (error) {
        console.error('Error opening Razorpay:', error);
        Alert.alert('Error', 'Failed to open payment gateway. Please try again.');
        setLoading(false);
      }
    } else {
      Alert.alert('Error', 'Razorpay is not loaded. Please refresh the page.');
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
        Alert.alert(
          '? Payment Successful',
          `?${rechargeAmount} added to your wallet!\n\nNew Balance: ?${verifyResult.data.balanceAfter}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setAmount('');
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        throw new Error(verifyResult.error || 'Payment verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert('Verification Failed', error.message || 'Please contact support');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
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
        {amount && parseInt(amount) < 100 && (
          <Text style={styles.warningText}>Minimum recharge: ₹100</Text>
        )}
        {amount && parseInt(amount) > 100000 && (
          <Text style={styles.errorText}>Maximum recharge: ₹1,00,000</Text>
        )}
      </View>

      {/* Information */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color="#007AFF" />
        <Text style={styles.infoText}>
          Minimum recharge: ₹100{'\n'}
          Maximum recharge: ₹1,00,000{'\n'}
          Instant credit after payment
        </Text>
      </View>

      {/* Recharge Button */}
      <TouchableOpacity
        style={[
          styles.rechargeButton,
          (!amount || parseInt(amount) < 100 || loading) && styles.rechargeButtonDisabled,
        ]}
        onPress={handleRecharge}
        disabled={!amount || parseInt(amount) < 100 || loading}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  quickAmountsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAmountButton: {
    backgroundColor: '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    minWidth: 100,
    alignItems: 'center',
  },
  quickAmountButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  quickAmountText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  quickAmountTextSelected: {
    color: '#FFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    paddingVertical: 16,
  },
  warningText: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  rechargeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 24,
  },
  rechargeButtonDisabled: {
    backgroundColor: '#CCC',
  },
  rechargeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  paymentMethods: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
  },
  paymentMethodsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
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
    color: '#666',
  },
});
