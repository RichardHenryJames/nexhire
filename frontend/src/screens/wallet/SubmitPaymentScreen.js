import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { typography } from '../../styles/theme';
import refopenAPI from '../../services/api';
import DatePicker from '../../components/DatePicker';
import { showToast } from '../../components/Toast';

const PAYMENT_METHODS = ['QR / UPI', 'Bank Transfer'];

// Animated percentage badge with fill effect
const BonusPercentBadge = ({ percent }) => {
  const fillAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    fillAnim.setValue(0);
    Animated.spring(fillAnim, { toValue: 1, tension: 40, friction: 8, useNativeDriver: false }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
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
        <View style={{ backgroundColor: '#10B98110', paddingHorizontal: 10, paddingVertical: 6 }}>
          <Animated.View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: fillWidth, backgroundColor: '#10B98130', borderRadius: 8 }} />
          <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: '20%', left: shimmerLeft, backgroundColor: '#10B98118', borderRadius: 8 }} />
          <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 13, textAlign: 'center', letterSpacing: 0.3 }}>
            {percent}% extra
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const SubmitPaymentScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  // Packs & Promo
  const [bonusPacks, setBonusPacks] = useState([]);
  const [selectedPack, setSelectedPack] = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  // Form
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('QR / UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [userRemarks, setUserRemarks] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      title: 'Submit Payment',
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
              navigation.navigate('WalletRecharge');
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
      const [settingsRes, submissionsRes, packsRes] = await Promise.all([
        refopenAPI.getManualPaymentSettings(),
        refopenAPI.getMyManualPaymentSubmissions(),
        refopenAPI.getBonusPacks(),
      ]);
      if (settingsRes?.success) setSettings(settingsRes.data);
      if (submissionsRes?.success) setSubmissions(submissionsRes.data || []);
      if (packsRes?.success) setBonusPacks(packsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Computed values
  const getPayAmount = () => parseFloat(amount) || 0;
  const getPackBonus = () => selectedPack?.BonusAmount || 0;
  const getPromoBonus = () => (promoResult?.valid ? promoResult.bonusAmount || 0 : 0);
  const getTotalCredit = () => getPayAmount() + getPackBonus() + getPromoBonus();

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
      const result = await refopenAPI.validatePromoCode(codeToValidate.trim().toUpperCase(), amountToValidate);
      setPromoResult(result?.data || { valid: false, message: 'Invalid promo code' });
    } catch (error) {
      setPromoResult({ valid: false, message: 'Failed to validate promo code' });
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoCode('');
    setPromoResult(null);
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      showToast('Please enter a valid amount', 'error'); return;
    }
    if (!referenceNumber.trim()) {
      showToast('Please enter the transaction reference number', 'error'); return;
    }
    const invalidRefs = ['na', 'n/a', 'n.a', 'n.a.', 'none', 'nil', 'null', '-', '--', 'test', 'abc', '123', '1234', '12345'];
    const refLower = referenceNumber.trim().toLowerCase();
    if (invalidRefs.includes(refLower) || refLower.length < 6) {
      showToast('Please enter a valid UTR/Transaction ID (minimum 6 characters)', 'error'); return;
    }
    if (settings && parseFloat(amount) < settings.minAmount) {
      showToast(`Minimum amount is ₹${settings.minAmount}`, 'error'); return;
    }
    if (settings && parseFloat(amount) > settings.maxAmount) {
      showToast(`Maximum amount is ₹${settings.maxAmount}`, 'error'); return;
    }

    try {
      setSubmitting(true);
      const payload = {
        amount: parseFloat(amount),
        paymentMethod,
        referenceNumber: referenceNumber.trim(),
        paymentDate: paymentDate.toISOString().split('T')[0],
        userRemarks: userRemarks.trim() || null,
        packId: selectedPack?.PackID || null,
        promoCode: promoResult?.valid ? promoCode.trim().toUpperCase() : null,
      };

      const result = await refopenAPI.submitManualPayment(payload);
      if (result?.success) {
        showToast('Payment submitted successfully! 🎉', 'success');
        setAmount(''); setReferenceNumber(''); setUserRemarks('');
        setPaymentDate(new Date()); setSelectedPack(null);
        setPromoCode(''); setPromoResult(null);
        loadData(); // Reload submissions
      } else {
        showToast('Failed to submit. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Submit error:', error);
      showToast('Failed to submit payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved': return '#10B981';
      case 'Rejected': return '#EF4444';
      default: return '#F59E0B';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Approved': return 'checkmark-circle';
      case 'Rejected': return 'close-circle';
      default: return 'time';
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1 },
    scrollContent: { padding: 16 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    section: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16 },
    sectionTitle: { fontSize: typography.sizes?.md || 16, fontWeight: typography.weights?.semibold || '600', color: colors.text, marginBottom: 12 },
    label: { fontSize: typography.sizes?.sm || 14, fontWeight: typography.weights?.medium || '500', color: colors.text, marginBottom: 6 },
    input: {
      backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
      borderRadius: 8, padding: 12, fontSize: typography.sizes?.md || 16, color: colors.text, marginBottom: 16,
    },
    methodsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    methodChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    methodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    methodChipText: { fontSize: typography.sizes?.sm || 14, color: colors.text },
    methodChipTextActive: { color: colors.white },
    formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    submissionCard: { backgroundColor: colors.background, borderRadius: 8, padding: 12, marginBottom: 12, borderLeftWidth: 4 },
    submissionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    submissionAmount: { fontSize: typography.sizes?.lg || 18, fontWeight: typography.weights?.bold || '700', color: colors.text },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: typography.sizes?.xs || 12, fontWeight: typography.weights?.medium || '500', marginLeft: 4 },
    submissionDetails: { marginTop: 4 },
    submissionRow: { flexDirection: 'row', marginBottom: 4 },
    submissionLabel: { fontSize: typography.sizes?.xs || 12, color: colors.gray500, width: 80 },
    submissionValue: { fontSize: typography.sizes?.xs || 12, color: colors.text, flex: 1 },
    adminRemarks: { marginTop: 8, padding: 8, backgroundColor: colors.error + '10', borderRadius: 4 },
    adminRemarksText: { fontSize: typography.sizes?.xs || 12, color: colors.error },
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

  const totalBonus = getPackBonus() + getPromoBonus();
  const bonusPct = getPayAmount() > 0 && totalBonus > 0 ? Math.round((totalBonus / getPayAmount()) * 100) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>

        {/* Step 1: Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 How much did you pay?</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>₹</Text>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0, fontSize: 20, fontWeight: '700', paddingVertical: 14 }]}
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
              placeholder={`Min ₹${settings?.minAmount || 100}`}
              placeholderTextColor={colors.gray400}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Step 2: Pack Selection — horizontal chips */}
        {bonusPacks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 Any pack you selected? (Optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {bonusPacks.map((pack) => {
                  const isSelected = selectedPack?.PackID === pack.PackID;
                  return (
                    <TouchableOpacity
                      key={pack.PackID}
                      onPress={() => handlePackSelect(pack)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 10,
                        borderRadius: 10, borderWidth: 1.5,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary + '10' : colors.background,
                        minWidth: 100, alignItems: 'center',
                      }}
                    >
                      {pack.Badge && (
                        <Text style={{ fontSize: 8, fontWeight: '700', color: pack.Badge === 'Most Popular' ? '#F59E0B' : pack.Badge === 'Best Value' ? '#10B981' : colors.primary, textTransform: 'uppercase', marginBottom: 2 }}>
                          {pack.Badge}
                        </Text>
                      )}
                      <Text style={{ fontSize: 15, fontWeight: '700', color: isSelected ? colors.primary : colors.text }}>₹{pack.PayAmount}</Text>
                      <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '700', marginTop: 2 }}>Get ₹{pack.GetAmount}</Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ position: 'absolute', top: 4, right: 4 }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Step 3: Promo Code */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏷️ Any promo code you applied? (Optional)</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0, paddingVertical: 10 }]}
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
                style={{ backgroundColor: colors.error + '15', borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center' }}
              >
                <Ionicons name="close" size={18} color={colors.error} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => handleValidatePromo()}
                disabled={validatingPromo || !promoCode.trim()}
                style={{ backgroundColor: promoCode.trim() ? colors.primary : colors.gray300, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' }}
              >
                {validatingPromo ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={{ color: colors.white, fontWeight: '600', fontSize: 13 }}>Apply</Text>}
              </TouchableOpacity>
            )}
          </View>
          {promoResult && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <Ionicons name={promoResult.valid ? 'checkmark-circle' : 'alert-circle'} size={14} color={promoResult.valid ? '#10B981' : colors.error} />
              <Text style={{ color: promoResult.valid ? '#10B981' : colors.error, fontSize: 12, marginLeft: 4, flex: 1 }}>{promoResult.message}</Text>
            </View>
          )}
        </View>

        {/* Credit Summary — shows when amount > 0 */}
        {getPayAmount() > 0 && (
          <View style={[styles.section, { backgroundColor: totalBonus > 0 ? '#10B981' + '08' : colors.surface, borderWidth: totalBonus > 0 ? 1 : 0, borderColor: '#10B981' + '25' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.gray500, fontSize: 11 }}>You paid</Text>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 1 }}>₹{getPayAmount()}</Text>
                <View style={{ height: 1, backgroundColor: colors.border + '40', marginVertical: 6 }} />
                <Text style={{ color: colors.gray500, fontSize: 11 }}>You will get</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 1 }}>
                  <Text style={{ color: '#10B981', fontSize: 20, fontWeight: '800' }}>₹{getTotalCredit()}</Text>
                  {totalBonus > 0 && (
                    <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600', marginLeft: 6 }}>(+₹{totalBonus} bonus)</Text>
                  )}
                </View>
                {selectedPack && (
                  <Text style={{ color: colors.primary, fontSize: 11, marginTop: 2 }}>📦 {selectedPack.Name} +₹{getPackBonus()}</Text>
                )}
                {promoResult?.valid && getPromoBonus() > 0 && (
                  <Text style={{ color: '#10B981', fontSize: 11, marginTop: 1 }}>🏷️ {promoCode} +₹{getPromoBonus()}</Text>
                )}
              </View>
              {bonusPct > 0 && <BonusPercentBadge percent={bonusPct} />}
            </View>
          </View>
        )}

        {/* Payment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Now provide payment details</Text>

          <Text style={styles.label}>Payment Method *</Text>
          <View style={styles.methodsContainer}>
            {PAYMENT_METHODS.map((method) => (
              <TouchableOpacity
                key={method}
                style={[styles.methodChip, paymentMethod === method && styles.methodChipActive]}
                onPress={() => setPaymentMethod(method)}
              >
                <Text style={[styles.methodChipText, paymentMethod === method && styles.methodChipTextActive]}>{method}</Text>
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
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={{
            backgroundColor: colors.primary, borderRadius: 12, padding: 16,
            alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
            marginBottom: 16, opacity: submitting ? 0.6 : 1,
          }}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color={colors.white} />
              <Text style={{ color: colors.white, fontSize: 16, fontWeight: '700', marginLeft: 8 }}>Submit Payment</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Your Submissions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📄 Your Submissions</Text>
          {submissions.length === 0 ? (
            <Text style={{ textAlign: 'center', color: colors.gray400, paddingVertical: 20 }}>
              No submissions yet. Submit your first payment above!
            </Text>
          ) : (
            submissions.map((sub, index) => (
              <View key={sub.submissionId || index} style={[styles.submissionCard, { borderLeftColor: getStatusColor(sub.status) }]}>
                <View style={styles.submissionHeader}>
                  <Text style={styles.submissionAmount}>₹{sub.amount}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(sub.status) + '20' }]}>
                    <Ionicons name={getStatusIcon(sub.status)} size={14} color={getStatusColor(sub.status)} />
                    <Text style={[styles.statusText, { color: getStatusColor(sub.status) }]}>{sub.status}</Text>
                  </View>
                </View>
                <View style={styles.submissionDetails}>
                  {sub.packName && (
                    <View style={styles.submissionRow}>
                      <Text style={styles.submissionLabel}>Pack:</Text>
                      <Text style={[styles.submissionValue, { color: colors.primary }]}>{sub.packName}</Text>
                    </View>
                  )}
                  {sub.promoCode && (
                    <View style={styles.submissionRow}>
                      <Text style={styles.submissionLabel}>Promo:</Text>
                      <Text style={[styles.submissionValue, { color: '#10b981' }]}>{sub.promoCode}</Text>
                    </View>
                  )}
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
                    <Text style={styles.submissionValue}>{new Date(sub.paymentDate).toLocaleDateString('en-IN')}</Text>
                  </View>
                  <View style={styles.submissionRow}>
                    <Text style={styles.submissionLabel}>Submitted:</Text>
                    <Text style={styles.submissionValue}>{new Date(sub.createdAt).toLocaleDateString('en-IN')}</Text>
                  </View>
                </View>
                {sub.status === 'Rejected' && sub.adminRemarks && (
                  <View style={styles.adminRemarks}>
                    <Text style={styles.adminRemarksText}>Reason: {sub.adminRemarks}</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Need Help */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Support')}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 8, paddingVertical: 16, marginBottom: 20,
          }}
        >
          <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Need Help?</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

export default SubmitPaymentScreen;
