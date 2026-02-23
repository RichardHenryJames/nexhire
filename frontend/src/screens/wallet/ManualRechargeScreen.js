import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
  Pressable,
  Linking,
  Platform,
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
import useResponsive from '../../hooks/useResponsive';

// ─── Animated "Limited Time" badge ───────────────────────────────
const LimitedTimeBadge = () => {
  const drainAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(drainAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(drainAnim, { toValue: 0.08, duration: 3000, useNativeDriver: false }),
        Animated.timing(drainAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.delay(400),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.delay(1600),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.8, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1500, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const drainWidth = drainAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const borderOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: ['#EF444450', '#EF4444CC'] });

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }], marginLeft: 8 }}>
      <Animated.View style={{ overflow: 'hidden', borderRadius: 10, borderWidth: 1.5, borderColor: borderOpacity }}>
        <View style={{ backgroundColor: '#EF444410', paddingHorizontal: 9, paddingVertical: 3.5 }}>
          <Animated.View style={{
            position: 'absolute', top: 0, right: 0, bottom: 0,
            width: drainWidth, backgroundColor: '#EF444435', borderRadius: 10,
          }} />
          <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 9, textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            ⏳ Limited Time
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

// ─── Animated bonus percent badge ────────────────────────────────
const BonusPercentBadge = ({ percent }) => {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fillAnim.setValue(0);
    Animated.spring(fillAnim, { toValue: 1, tension: 40, friction: 8, useNativeDriver: false }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [percent]);

  const fillWidth = fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <View style={{ overflow: 'hidden', borderRadius: 8, borderWidth: 1, borderColor: '#10B98140', minWidth: 72 }}>
        <View style={{ backgroundColor: '#10B98110', paddingHorizontal: 10, paddingVertical: 6 }}>
          <Animated.View style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: fillWidth, backgroundColor: '#10B98130', borderRadius: 8,
          }} />
          <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 13, textAlign: 'center', letterSpacing: 0.3 }}>
            {percent}% extra
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

// ─── UPI Deep Link helpers ───────────────────────────────────────
const UPI_PAYEE_VPA = 'rocanafashionaccessoriesprivatelimited.ibz@icici';
const UPI_PAYEE_NAME = 'Rocana Fashion Accessories Pvt Ltd';

const buildUpiUrl = (appScheme, amount) => {
  const amt = parseFloat(amount) || 0;
  const base = `${appScheme}://pay?pa=${encodeURIComponent(UPI_PAYEE_VPA)}&pn=${encodeURIComponent(UPI_PAYEE_NAME)}&cu=INR`;
  return amt > 0 ? `${base}&am=${amt.toFixed(2)}` : base;
};

const UPI_APPS = [
  { id: 'phonepe', name: 'PhonePe', scheme: 'phonepe', color: '#5F259F',
    pkg: 'com.phonepe.app',
    logo: 'https://www.google.com/s2/favicons?sz=64&domain=phonepe.com' },
  { id: 'gpay', name: 'Google Pay', scheme: 'tez', color: '#4285F4',
    pkg: 'com.google.android.apps.nbu.paisa.user',
    logo: 'https://www.google.com/s2/favicons?sz=64&domain=pay.google.com' },
  { id: 'paytm', name: 'Paytm', scheme: 'paytmmp', color: '#00BAF2',
    pkg: 'net.one97.paytm',
    logo: 'https://www.google.com/s2/favicons?sz=64&domain=paytm.com' },
  { id: 'generic', name: 'Any UPI App', scheme: 'upi', color: '#2D7D46',
    pkg: null,
    logo: null },
];

// ─── Main Component ──────────────────────────────────────────────
const ManualRechargeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { pricing } = usePricing();
  const { isMobile } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [showQrFullscreen, setShowQrFullscreen] = useState(false);

  // Bonus Packs
  const [bonusPacks, setBonusPacks] = useState([]);
  const [selectedPack, setSelectedPack] = useState(null);

  // Promo Code
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [showPromoInput, setShowPromoInput] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsRes, packsRes] = await Promise.all([
        refopenAPI.getManualPaymentSettings(),
        refopenAPI.getBonusPacks(),
      ]);
      if (settingsRes?.success) setSettings(settingsRes.data);
      if (packsRes?.success && packsRes.data?.length > 0) {
        setBonusPacks(packsRes.data);
      } else {
        // Fallback packs if API returns empty
        setBonusPacks([
          { PackID: 'f1', PayAmount: 89, GetAmount: 100, BonusAmount: 11, BonusPercent: 12, ReferralsWorth: 2, Badge: null },
          { PackID: 'f2', PayAmount: 199, GetAmount: 240, BonusAmount: 41, BonusPercent: 21, ReferralsWorth: 5, Badge: 'Most Popular' },
          { PackID: 'f3', PayAmount: 399, GetAmount: 500, BonusAmount: 101, BonusPercent: 25, ReferralsWorth: 10, Badge: 'Best Value' },
          { PackID: 'f4', PayAmount: 799, GetAmount: 1100, BonusAmount: 301, BonusPercent: 38, ReferralsWorth: 22, Badge: 'Power Pack' },
        ]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePackSelect = (pack) => {
    if (selectedPack?.PackID === pack.PackID) {
      setSelectedPack(null);
      setAmount('');
    } else {
      setSelectedPack(pack);
      setAmount(String(pack.PayAmount));
      if (promoResult?.valid && promoCode) handleValidatePromo(promoCode, pack.PayAmount);
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
    } catch (error) {
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

  const openUpiApp = async (app) => {
    const amt = parseFloat(amount) || 0;
    const params = `pa=${encodeURIComponent(UPI_PAYEE_VPA)}&pn=${encodeURIComponent(UPI_PAYEE_NAME)}&cu=INR${amt > 0 ? `&am=${amt.toFixed(2)}` : ''}`;

    if (Platform.OS === 'web') {
      // On mobile web, use app-specific deep link schemes.
      // phonepe:// → PhonePe, tez:// → Google Pay, paytmmp:// → Paytm
      // If the app isn't installed, the browser will error silently.
      // We detect this with a visibility change listener — if the page
      // stays visible after 1.5s, the app didn't open → fall back to
      // generic upi:// which shows the system UPI app chooser.
      const scheme = app.scheme;
      const appUrl = `${scheme}://pay?${params}`;
      const fallbackUrl = `upi://pay?${params}`;

      if (scheme === 'upi') {
        // "Any UPI App" button — go straight to system chooser
        window.location.href = fallbackUrl;
        return;
      }

      // Try app-specific scheme first
      const beforeTime = Date.now();
      window.location.href = appUrl;

      // If the app opened, the browser tab loses focus (goes to background).
      // If it didn't open (app not installed), page stays visible.
      // After 2s, if page is still visible and not much time has passed,
      // fall back to generic upi:// chooser.
      setTimeout(() => {
        if (document.visibilityState !== 'hidden' && (Date.now() - beforeTime) < 3000) {
          window.location.href = fallbackUrl;
        }
      }, 2000);
      return;
    }

    // Native (Android/iOS) — use Linking API with app-specific scheme
    const url = `${app.scheme}://pay?${params}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        const genericUrl = `upi://pay?${params}`;
        const genSupported = await Linking.canOpenURL(genericUrl);
        if (genSupported) await Linking.openURL(genericUrl);
        else showToast(`${app.name} not installed. Scan the QR code instead.`, 'info');
      }
    } catch (e) {
      showToast(`Could not open ${app.name}. Scan the QR code instead.`, 'info');
    }
  };

  const styles = createStyles(colors);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const payAmt = getPayAmount();
  const totalBonus = getPackBonus() + getPromoBonus();
  const bonusPct = totalBonus > 0 && payAmt > 0 ? Math.round((totalBonus / payAmt) * 100) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SubScreenHeader title="Add Money" fallbackTab="Home" />
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>

        {/* ═══ 1. BOOSTER PACKS ═══ */}
        {bonusPacks.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>⚡ Booster Packs</Text>
              <LimitedTimeBadge />
            </View>
            <Text style={{ fontSize: 11, color: colors.gray500, paddingHorizontal: 4, marginBottom: 8 }}>Pay less, get more</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 2, paddingVertical: 2 }}>
              {bonusPacks.map((pack) => {
                const isSelected = selectedPack?.PackID === pack.PackID;
                return (
                  <TouchableOpacity
                    key={pack.PackID}
                    activeOpacity={0.7}
                    onPress={() => handlePackSelect(pack)}
                    style={{
                      width: 95,
                      borderWidth: isSelected ? 1.5 : 1,
                      borderRadius: 10,
                      padding: 8,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary + '08' : colors.surface,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: pack.Badge ? 'space-between' : 'flex-end', alignItems: 'center', marginBottom: 2, minHeight: 14 }}>
                      {pack.Badge ? (
                        <View style={{ backgroundColor: pack.Badge === 'Most Popular' ? '#F59E0B' : pack.Badge === 'Best Value' ? '#10B981' : colors.primary, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
                          <Text style={{ color: '#fff', fontSize: 6, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.2 }}>{pack.Badge}</Text>
                        </View>
                      ) : null}
                      {isSelected && <Ionicons name="checkmark-circle" size={14} color={colors.primary} />}
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>₹{pack.PayAmount}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, marginTop: 1 }}>Get ₹{pack.GetAmount}</Text>
                    {pack.BonusPercent > 0 && (
                      <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 10, marginTop: 1 }}>+{Math.round(pack.BonusPercent)}%</Text>
                    )}
                    {pack.ReferralsWorth > 0 && (
                      <Text style={{ color: colors.gray500, fontSize: 8, marginTop: 1 }}>≈ {pack.ReferralsWorth} referrals</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ═══ 2. CUSTOM AMOUNT ═══ */}
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

        {/* ═══ 3. PROMO CODE ═══ */}
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

        {/* ═══ 4. CREDIT SUMMARY ═══ */}
        {payAmt > 0 && (
          <View style={[styles.section, {
            backgroundColor: totalBonus > 0 ? '#10B98108' : colors.surface,
            borderWidth: totalBonus > 0 ? 1 : 0,
            borderColor: '#10B98125',
            paddingVertical: 10,
            paddingHorizontal: 12,
            marginBottom: 14,
          }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.gray500, fontSize: 11 }}>If you pay</Text>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 1 }}>₹{payAmt}</Text>
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
        )}

        {/* ═══ 5. PAYMENT SECTION — responsive ═══ */}
        <View style={[styles.section, { padding: 0, marginBottom: 14, borderWidth: 1, borderColor: colors.primary + '30', overflow: 'hidden' }]}>
          {/* Header */}
          <View style={{ backgroundColor: colors.primary + '10', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border + '40' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="shield-checkmark" size={14} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                {isMobile ? (payAmt > 0 ? `Pay ₹${payAmt} via UPI` : 'Pay via UPI') : 'Scan QR to Pay'}
              </Text>
            </View>
          </View>

          <View style={{ padding: 14 }}>
            {isMobile ? (
              /* ── MOBILE: QR left + UPI apps right ── */
              <View style={{ flexDirection: 'row', gap: 14 }}>
                {/* LEFT — QR (blue border, clickable fullscreen) */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowQrFullscreen(true)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: 6,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: '#3B82F6',
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    shadowColor: '#3B82F6',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Image
                    source={require('../../../assets/payment-qr.png')}
                    style={{ width: 120, height: 120 }}
                    resizeMode="contain"
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="scan-outline" size={10} color="#3B82F6" style={{ marginRight: 3 }} />
                    <Text style={{ fontSize: 8, color: '#3B82F6', fontWeight: '700' }}>Tap to enlarge</Text>
                  </View>
                </TouchableOpacity>
                {/* Copy UPI ID button below QR */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    Clipboard.setStringAsync(UPI_PAYEE_VPA);
                    showToast('UPI ID copied!', 'success');
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    backgroundColor: colors.primary + '10',
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    marginTop: 6,
                  }}
                >
                  <Ionicons name="copy-outline" size={11} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 9, color: colors.primary, fontWeight: '600' }}>Copy UPI ID</Text>
                </TouchableOpacity>

                {/* RIGHT — UPI App deep links */}
                <View style={{ flex: 1, gap: 6 }}>
                  {UPI_APPS.map((app) => (
                    <TouchableOpacity
                      key={app.id}
                      activeOpacity={0.7}
                      onPress={() => openUpiApp(app)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.surface,
                        borderRadius: 10,
                        paddingVertical: 10,
                        paddingHorizontal: 10,
                        borderWidth: 1,
                        borderColor: colors.border + '80',
                      }}
                    >
                      {app.logo ? (
                        <Image
                          source={{ uri: app.logo }}
                          style={{ width: 24, height: 24, borderRadius: 4, marginRight: 8 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: app.color + '20', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                          <Ionicons name="apps-outline" size={14} color={app.color} />
                        </View>
                      )}
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.text }}>{app.name}</Text>
                      <Ionicons name="chevron-forward" size={16} color={app.color} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              /* ── DESKTOP: QR centered only (no UPI buttons) ── */
              <>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowQrFullscreen(true)}
                style={{
                  alignSelf: 'center',
                  backgroundColor: '#FFFFFF',
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: '#3B82F6',
                  alignItems: 'center',
                  shadowColor: '#3B82F6',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <Image
                  source={require('../../../assets/payment-qr.png')}
                  style={{ width: 200, height: 200 }}
                  resizeMode="contain"
                />
                {payAmt > 0 && (
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#3B82F6', marginTop: 8 }}>₹{payAmt}</Text>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <Ionicons name="scan-outline" size={12} color="#3B82F6" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 10, color: '#3B82F6', fontWeight: '600' }}>Click to enlarge</Text>
                </View>
              </TouchableOpacity>
              {/* Copy UPI ID button below desktop QR */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  Clipboard.setStringAsync(UPI_PAYEE_VPA);
                  showToast('UPI ID copied!', 'success');
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'center',
                  backgroundColor: colors.primary + '10',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  marginTop: 10,
                }}
              >
                <Ionicons name="copy-outline" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Copy UPI ID</Text>
              </TouchableOpacity>
              </>
            )}
          </View>

          {/* Footer */}
          <View style={{ backgroundColor: colors.background, paddingVertical: 6, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.border + '30' }}>
            <Text style={{ fontSize: 9, color: colors.gray500, fontStyle: 'italic', textAlign: 'center' }}>
              🔒 Secure payments powered by Rocana
            </Text>
          </View>
        </View>

        {/* ═══ 6. ALREADY PAID ═══ */}
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

        {/* ═══ 7. FAQ ═══ */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10, paddingHorizontal: 4 }}>Frequently Asked Questions</Text>
          {[
            { q: 'Can I withdraw my added wallet balance?', a: 'No. Recharged balance and bonuses are non-withdrawable and can only be used for services on RefOpen such as referral requests, AI Job Recommendations, profile views, and other RefOpen services.' },
            { q: 'How does manual recharge work?', a: 'Select a booster pack or enter a custom amount. Pay via any UPI app or scan the QR code, then tap "Already Paid? Submit Details" to upload your payment proof. We\'ll verify and credit your wallet.' },
            { q: 'How long does it take to credit my wallet?', a: 'Manual payments are usually verified within 1 minute to 24 hours. You\'ll receive a notification once your wallet is credited.' },
            { q: 'Do I still get pack bonuses with manual payment?', a: 'Yes! Select a pack before paying, and the bonus will be applied when your payment is verified.' },
            { q: 'Can I recharge a custom amount?', a: `Yes. Enter any custom amount — the minimum is ₹${settings?.minAmount || 1}.` },
            { q: 'What can I spend wallet balance on?', a: `• Referral request at a specific company — ₹${pricing.referralRequestCost}\n• Open-to-any-company referral — ₹${pricing.openToAnyReferralCost}\n• AI Job Recommendations (${pricing.aiAccessDurationDays} days) — ₹${pricing.aiJobsCost}\n• Profile Views (${pricing.profileViewAccessDurationDays} days) — ₹${pricing.profileViewCost}` },
            { q: 'What happens when I request a referral?', a: `When you request a referral, ₹${pricing.referralRequestCost} is placed on hold (not deducted). If a referrer picks up your request, the hold converts to a debit. If no one picks it up within 14 days, the full amount is automatically released back to your wallet.` },
            { q: 'Who is Rocana?', a: 'Rocana is our payment processing partner. All UPI transfers go through Rocana\'s verified accounts.' },
            { q: 'My payment was not credited?', a: 'Make sure you\'ve submitted payment proof via "Already Paid? Submit Details". If already submitted and not credited within 24 hours, contact us via "Need Help?".' },
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

      {/* ═══ QR FULLSCREEN MODAL ═══ */}
      <Modal
        visible={showQrFullscreen}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrFullscreen(false)}
      >
        <Pressable
          style={styles.qrModalOverlay}
          onPress={() => setShowQrFullscreen(false)}
        >
          <Pressable style={styles.qrModalContent} onPress={() => {}}>
            <View style={styles.qrModalCard}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 4, textAlign: 'center' }}>Scan to Pay</Text>
              {payAmt > 0 && (
                <Text style={{ fontSize: 14, color: '#6366F1', fontWeight: '600', marginBottom: 12, textAlign: 'center' }}>₹{payAmt}</Text>
              )}
              <Image
                source={require('../../../assets/payment-qr.png')}
                style={{ width: 260, height: 260 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 10, color: '#64748B', marginTop: 12, textAlign: 'center' }}>
                Scan with any UPI app to pay
              </Text>
              <Text style={{ fontSize: 9, color: '#94A3B8', fontStyle: 'italic', marginTop: 4, textAlign: 'center' }}>
                Powered by Rocana
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowQrFullscreen(false)}
              style={styles.qrModalClose}
            >
              <Ionicons name="close-circle" size={40} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────
const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  scrollContent: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16 },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 12, fontSize: typography.sizes?.md || 16, color: colors.text, marginBottom: 16,
  },
  submitButton: {
    backgroundColor: colors.primary, borderRadius: 12, padding: 16,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginBottom: 16,
  },
  submitButtonText: { color: colors.white, fontSize: typography.sizes?.md || 16, fontWeight: typography.weights?.semibold || '600' },
  qrModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  qrModalContent: { alignItems: 'center' },
  qrModalCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
  },
  qrModalClose: { marginTop: 20 },
});

export default ManualRechargeScreen;
