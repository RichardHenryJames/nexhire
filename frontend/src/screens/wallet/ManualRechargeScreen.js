import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Clipboard,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { typography } from '../../styles/theme';
import refopenAPI from '../../services/api';
import DatePicker from '../../components/DatePicker';

const PAYMENT_METHODS = ['QR / UPI', 'Bank Transfer'];

const ManualRechargeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showInfoTip, setShowInfoTip] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('QR / UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [userRemarks, setUserRemarks] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // ✅ Smart back navigation for hard refresh scenarios (same as WalletRechargeScreen)
  useEffect(() => {
    navigation.setOptions({
      title: 'Add Money to Wallet',
      headerStyle: { backgroundColor: colors.surface, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
      headerTitleStyle: { fontSize: typography.sizes?.lg || 18, fontWeight: typography.weights?.bold || '700', color: colors.text },
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

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsRes, submissionsRes] = await Promise.all([
        refopenAPI.getManualPaymentSettings(),
        refopenAPI.getMyManualPaymentSubmissions(),
      ]);

      if (settingsRes?.success) {
        setSettings(settingsRes.data);
      }
      if (submissionsRes?.success) {
        setSubmissions(submissionsRes.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, label) => {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(text);
    } else {
      Clipboard.setString(text);
    }
    Alert.alert('Copied!', `${label} copied to clipboard`);
  };

  const handleSubmit = async () => {
    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!referenceNumber.trim()) {
      Alert.alert('Error', 'Please enter the transaction reference number');
      return;
    }
    if (settings && parseFloat(amount) < settings.minAmount) {
      Alert.alert('Error', `Minimum amount is ₹${settings.minAmount}`);
      return;
    }
    if (settings && parseFloat(amount) > settings.maxAmount) {
      Alert.alert('Error', `Maximum amount is ₹${settings.maxAmount}`);
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        amount: parseFloat(amount),
        paymentMethod,
        referenceNumber: referenceNumber.trim(),
        paymentDate: paymentDate.toISOString().split('T')[0],
        userRemarks: userRemarks.trim() || null,
      };
      console.log('📤 Manual Payment Submit Payload:', payload);
      
      const result = await refopenAPI.submitManualPayment(payload);
      console.log('📥 Manual Payment Submit Result:', result);

      if (result?.success) {
        Alert.alert('Success', result.message || 'Payment proof submitted successfully');
        // Reset form
        setAmount('');
        setReferenceNumber('');
        setUserRemarks('');
        setPaymentDate(new Date());
        setShowForm(false);
        // Reload submissions
        loadData();
      } else {
        Alert.alert('Error', result?.message || 'Failed to submit payment proof');
      }
    } catch (error) {
      console.error('❌ Manual Payment Submit Error:', error);
      Alert.alert('Error', 'Failed to submit payment proof');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved':
        return '#10B981';
      case 'Rejected':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Approved':
        return 'checkmark-circle';
      case 'Rejected':
        return 'close-circle';
      default:
        return 'time';
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      flex: 1,
      fontSize: typography.sizes?.lg || 18,
      fontWeight: typography.weights?.semibold || '600',
      color: colors.text,
      marginLeft: 12,
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
    copyButton: {
      marginLeft: 8,
      padding: 4,
    },
    upiContainer: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    upiId: {
      fontSize: typography.sizes?.xl || 20,
      fontWeight: typography.weights?.bold || '700',
      color: colors.primary,
      marginBottom: 8,
    },
    upiName: {
      fontSize: typography.sizes?.sm || 14,
      color: colors.gray500,
      marginBottom: 16,
    },
    copyUpiButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    copyUpiText: {
      color: colors.primary,
      fontWeight: typography.weights?.medium || '500',
      marginLeft: 4,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      paddingHorizontal: 12,
      color: colors.gray400,
      fontSize: typography.sizes?.sm || 14,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 16,
    },
    submitButtonText: {
      color: colors.white,
      fontSize: typography.sizes?.md || 16,
      fontWeight: typography.weights?.semibold || '600',
    },
    formSection: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    formTitle: {
      fontSize: typography.sizes?.md || 16,
      fontWeight: typography.weights?.semibold || '600',
      color: colors.text,
      marginBottom: 4,
    },
    formSubtitle: {
      fontSize: typography.sizes?.sm || 14,
      color: colors.gray500,
      marginBottom: 16,
    },
    label: {
      fontSize: typography.sizes?.sm || 14,
      fontWeight: typography.weights?.medium || '500',
      color: colors.text,
      marginBottom: 6,
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
    methodsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    methodChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    methodChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    methodChipText: {
      fontSize: typography.sizes?.sm || 14,
      color: colors.text,
    },
    methodChipTextActive: {
      color: colors.white,
    },
    dateButton: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    dateButtonText: {
      fontSize: typography.sizes?.md || 16,
      color: colors.text,
      flex: 1,
    },
    formActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: colors.gray200,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: colors.gray600,
      fontWeight: typography.weights?.medium || '500',
    },
    submitFormButton: {
      flex: 2,
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    submitFormButtonText: {
      color: colors.white,
      fontWeight: typography.weights?.semibold || '600',
      marginLeft: 8,
    },
    submissionCard: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      borderLeftWidth: 4,
    },
    submissionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    submissionAmount: {
      fontSize: typography.sizes?.lg || 18,
      fontWeight: typography.weights?.bold || '700',
      color: colors.text,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: typography.sizes?.xs || 12,
      fontWeight: typography.weights?.medium || '500',
      marginLeft: 4,
    },
    submissionDetails: {
      marginTop: 4,
    },
    submissionRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    submissionLabel: {
      fontSize: typography.sizes?.xs || 12,
      color: colors.gray500,
      width: 80,
    },
    submissionValue: {
      fontSize: typography.sizes?.xs || 12,
      color: colors.text,
      flex: 1,
    },
    adminRemarks: {
      marginTop: 8,
      padding: 8,
      backgroundColor: colors.error + '10',
      borderRadius: 4,
    },
    adminRemarksText: {
      fontSize: typography.sizes?.xs || 12,
      color: colors.error,
    },
    noteContainer: {
      backgroundColor: colors.primary + '10',
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 8,
    },
    noteText: {
      fontSize: typography.sizes?.sm || 14,
      color: colors.primary,
      marginLeft: 8,
      flex: 1,
      lineHeight: 20,
    },
    qrSection: {
      alignItems: 'center',
      paddingVertical: 16,
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border + '50',
    },
    qrTitle: {
      fontSize: typography.sizes?.md || 16,
      fontWeight: typography.weights?.semibold || '600',
      color: colors.text,
      marginBottom: 12,
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
    poweredByText: {
      fontSize: typography.sizes?.xs || 12,
      color: colors.gray500,
      fontStyle: 'italic',
    },
    infoIconButton: {
      alignSelf: 'center',
      padding: 8,
      marginTop: 4,
    },
    infoTip: {
      backgroundColor: colors.primary + '15',
      borderRadius: 8,
      padding: 10,
      marginTop: 8,
    },
    infoTipText: {
      fontSize: typography.sizes?.xs || 12,
      color: colors.primary,
      textAlign: 'center',
      lineHeight: 18,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.gray400,
      paddingVertical: 20,
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
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Bank Details Section */}
        {settings && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bank Transfer Details</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Bank</Text>
              <Text style={styles.infoValue}>{settings.bankName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Account Name</Text>
              <Text style={styles.infoValue}>{settings.bankAccountName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Account No</Text>
              <Text style={styles.infoValue}>{settings.bankAccountNumber}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>IFSC Code</Text>
              <Text style={styles.infoValue}>{settings.bankIfsc}</Text>
            </View>

            {/* QR Code Section */}
            <View style={styles.qrSection}>
              <Text style={styles.qrTitle}>Or Scan QR to Pay</Text>
              <View style={styles.qrContainer}>
                <Image 
                  source={require('../../../assets/payment-qr.png')} 
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.poweredByText}>Refopen is powered by Rocana</Text>
            </View>

            <TouchableOpacity 
              style={styles.infoIconButton}
              onPress={() => setShowInfoTip(!showInfoTip)}
            >
              <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
            
            {showInfoTip && (
              <View style={styles.infoTip}>
                <Text style={styles.infoTipText}>
                  After payment, click "Already Paid" to submit. Credited within {settings.processingTime}.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Submit Payment Button or Form */}
        {!showForm ? (
          <TouchableOpacity style={styles.submitButton} onPress={() => setShowForm(true)}>
            <Text style={styles.submitButtonText}>Already Paid? Submit Details</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Submit Payment Details</Text>
            <Text style={styles.formSubtitle}>
              Enter your payment details to verify and credit your wallet
            </Text>

            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder={`Enter amount (Min: ₹${settings?.minAmount || 100})`}
              placeholderTextColor={colors.gray400}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Payment Method *</Text>
            <View style={styles.methodsContainer}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[styles.methodChip, paymentMethod === method && styles.methodChipActive]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Text
                    style={[
                      styles.methodChipText,
                      paymentMethod === method && styles.methodChipTextActive,
                    ]}
                  >
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Transaction Reference / UTR Number *</Text>
            <TextInput
              style={styles.input}
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              placeholder="Enter UTR / Transaction ID"
              placeholderTextColor={colors.gray400}
              autoCapitalize="characters"
            />

            <DatePicker
              label="Payment Date"
              value={paymentDate}
              onChange={(dateString) => setPaymentDate(new Date(dateString))}
              maximumDate={new Date()}
              required
              placeholder="Select payment date"
            />

            <Text style={styles.label}>Remarks (Optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={userRemarks}
              onChangeText={setUserRemarks}
              placeholder="Any additional notes..."
              placeholderTextColor={colors.gray400}
              multiline
            />

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitFormButton}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                    <Text style={styles.submitFormButtonText}>Submit</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Previous Submissions */}
        {submissions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Submissions</Text>
            {submissions.map((sub, index) => (
              <View
                key={sub.submissionId || index}
                style={[styles.submissionCard, { borderLeftColor: getStatusColor(sub.status) }]}
              >
                <View style={styles.submissionHeader}>
                  <Text style={styles.submissionAmount}>₹{sub.amount}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(sub.status) + '20' },
                    ]}
                  >
                    <Ionicons
                      name={getStatusIcon(sub.status)}
                      size={14}
                      color={getStatusColor(sub.status)}
                    />
                    <Text style={[styles.statusText, { color: getStatusColor(sub.status) }]}>
                      {sub.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.submissionDetails}>
                  <View style={styles.submissionRow}>
                    <Text style={styles.submissionLabel}>Method:</Text>
                    <Text style={styles.submissionValue}>{sub.paymentMethod}</Text>
                  </View>
                  <View style={styles.submissionRow}>
                    <Text style={styles.submissionLabel}>Ref No:</Text>
                    <Text style={styles.submissionValue}>{sub.referenceNumber}</Text>
                  </View>
                  <View style={styles.submissionRow}>
                    <Text style={styles.submissionLabel}>Date:</Text>
                    <Text style={styles.submissionValue}>
                      {new Date(sub.paymentDate).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.submissionRow}>
                    <Text style={styles.submissionLabel}>Submitted:</Text>
                    <Text style={styles.submissionValue}>
                      {new Date(sub.createdAt).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                </View>
                {sub.status === 'Rejected' && sub.adminRemarks && (
                  <View style={styles.adminRemarks}>
                    <Text style={styles.adminRemarksText}>Reason: {sub.adminRemarks}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Need Help?</Text>
          <Text style={{ color: colors.gray500, marginBottom: 16 }}>
            If you face any issues with your payment, our support team is here to help.
          </Text>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: colors.primary,
              paddingVertical: 14,
              paddingHorizontal: 20,
              borderRadius: 10,
            }}
            onPress={() => navigation.navigate('Support')}
          >
            <Ionicons name="chatbubbles" size={20} color={colors.white} />
            <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600' }}>
              Contact Support
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ManualRechargeScreen;
