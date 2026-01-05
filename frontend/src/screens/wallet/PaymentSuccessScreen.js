import React, { useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';

/**
 * PaymentSuccessScreen - Thank You page after successful wallet recharge
 * This intermediate page helps with:
 * 1. Razorpay/Payment gateway tracking (callback URL)
 * 2. User confirmation of successful payment
 * 3. Analytics and conversion tracking
 */
export default function PaymentSuccessScreen({ route, navigation }) {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // Get params from navigation
  const { 
    amount = 0, 
    balanceAfter = 0, 
    transactionId = '',
    paymentId = '',
  } = route.params || {};

  // Hide header for this screen
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Prevent back button from going to payment flow
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Only prevent default back action, allow our custom navigation
      if (e.data.action.type === 'GO_BACK') {
        e.preventDefault();
        // Navigate to Wallet instead
        navigation.navigate('Wallet', { refresh: true, timestamp: Date.now() });
      }
    });

    return unsubscribe;
  }, [navigation]);

  const handleGoToWallet = () => {
    navigation.navigate('Wallet', { refresh: true, timestamp: Date.now() });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value).replace('₹', '₹ ');
  };

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        {/* Success Animation Circle */}
        <View style={styles.successCircleOuter}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.successCircle}
          >
            <Ionicons name="checkmark" size={responsive.isLargeScreen ? 80 : 60} color="#fff" />
          </LinearGradient>
        </View>

        {/* Success Message */}
        <Text style={styles.title}>Payment Successful!</Text>
        <Text style={styles.subtitle}>Your wallet has been recharged</Text>

        {/* Amount Card */}
        <View style={styles.amountCard}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Amount Added</Text>
            <Text style={styles.amountValue}>+ {formatCurrency(amount)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>New Wallet Balance</Text>
            <Text style={[styles.amountValue, { color: colors.success }]}>
              {formatCurrency(balanceAfter)}
            </Text>
          </View>
        </View>

        {/* Transaction Details */}
        {(transactionId || paymentId) && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Transaction Details</Text>
            {transactionId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Transaction ID</Text>
                <Text style={styles.detailValue}>{transactionId}</Text>
              </View>
            )}
            {paymentId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment ID</Text>
                <Text style={styles.detailValue}>{paymentId}</Text>
              </View>
            )}
          </View>
        )}

        {/* Info Text */}
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            Your wallet balance is updated instantly. You can now use it for referral requests and other services.
          </Text>
        </View>

        {/* Go to Wallet Button */}
        <TouchableOpacity onPress={handleGoToWallet} style={styles.button} activeOpacity={0.8}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark || '#4F46E5']}
            style={styles.buttonGradient}
          >
            <Ionicons name="wallet-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Go to Wallet</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Secondary Action */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Home' } })}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors, responsive) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  innerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsive.isLargeScreen ? 40 : 24,
    paddingVertical: 40,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  successCircleOuter: {
    width: responsive.isLargeScreen ? 140 : 120,
    height: responsive.isLargeScreen ? 140 : 120,
    borderRadius: responsive.isLargeScreen ? 70 : 60,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successCircle: {
    width: responsive.isLargeScreen ? 110 : 90,
    height: responsive.isLargeScreen ? 110 : 90,
    borderRadius: responsive.isLargeScreen ? 55 : 45,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
      },
      default: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  title: {
    fontSize: responsive.isLargeScreen ? 32 : 26,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: responsive.isLargeScreen ? 18 : 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  amountCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  amountLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  amountValue: {
    fontSize: 20,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsTitle: {
    fontSize: 13,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${colors.info}10`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 32,
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 10,
    lineHeight: 20,
  },
  button: {
    width: '100%',
    marginBottom: 16,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: typography.weights.semibold,
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
});
