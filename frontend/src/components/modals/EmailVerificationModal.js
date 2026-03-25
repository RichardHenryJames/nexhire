import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import refopenAPI from '../../services/api';

/**
 * EmailVerificationModal
 * 
 * Full-screen modal shown to logged-in users whose email is not verified.
 * Flow:
 * 1. Shows the user's email and a "Send Verification Code" button
 * 2. On click, sends OTP to their email
 * 3. Shows 6-digit OTP input
 * 4. On verify, marks EmailVerified = 1 and calls onVerified callback
 */
const EmailVerificationModal = ({ visible, email, onVerified, onLogout, onClose }) => {
  const { colors } = useTheme();
  const [step, setStep] = useState('initial'); // 'initial' | 'otp' | 'success'
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const cooldownTimer = useRef(null);
  const otpInputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  const startCooldown = useCallback((seconds = 60) => {
    setCooldown(seconds);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendOTP = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await refopenAPI.sendAccountVerificationOTP();
      if (result.success) {
        setStep('otp');
        startCooldown(60);
        setSuccessMessage('Verification code sent. Please check your inbox.');
        setTimeout(() => {
          otpInputRef.current?.focus();
        }, 500);
      } else {
        if (result.error === 'OTP_COOLDOWN') {
          setStep('otp');
          const waitMatch = result.message?.match(/wait (\d+)/);
          if (waitMatch) startCooldown(parseInt(waitMatch[1]));
        } else if (result.error === 'ALREADY_VERIFIED') {
          onVerified?.();
        } else {
          setError(result.message || 'Failed to send code. Please try again.');
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await refopenAPI.verifyAccountEmailOTP(otp);
      if (result.success) {
        setStep('success');
        setTimeout(() => {
          onVerified?.();
        }, 1500);
      } else {
        setError(result.message || 'Invalid code. Please try again.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (cooldown > 0) return;
    await handleSendOTP();
  };

  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, start, middle, end) => 
        start + '*'.repeat(Math.min(middle.length, 5)) + end
      )
    : '';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]} 
            activeOpacity={1}
            onPress={onClose}
          />
          
          <Animated.View style={[
            styles.container,
            { backgroundColor: colors.card, transform: [{ scale: scaleAnim }] }
          ]}>
            {/* Close button */}
            {step !== 'success' && onClose && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Header Icon */}
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons 
                name={step === 'success' ? 'checkmark-circle' : 'mail-unread'} 
                size={48} 
                color={step === 'success' ? colors.success : colors.primary} 
              />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>
              {step === 'success' ? 'Email Verified! ✅' : 'Verify Your Email'}
            </Text>

            {/* Subtitle */}
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {step === 'success'
                ? 'All features are now unlocked. Enjoy RefOpen!'
                : step === 'otp'
                ? `Enter the 6-digit code sent to`
                : 'Please verify your email to access all features on RefOpen.'
              }
            </Text>

            {step !== 'success' && (
              <View style={[styles.emailBadge, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                <Ionicons name="mail" size={16} color={colors.primary} />
                <Text style={[styles.emailText, { color: colors.primary }]}>{maskedEmail}</Text>
              </View>
            )}

            {/* Error */}
            {error ? (
              <View style={[styles.errorContainer, { backgroundColor: colors.error + '10', borderColor: colors.error + '30' }]}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            {/* Success message after sending */}
            {step === 'otp' && successMessage && !error ? (
              <View style={[styles.successContainer, { backgroundColor: colors.success + '10', borderColor: colors.success + '30' }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.successText, { color: colors.success }]}>{successMessage}</Text>
              </View>
            ) : null}

            {/* Step: Initial — Send OTP button */}
            {step === 'initial' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleSendOTP}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryButtonText}>Send Verification Code</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Step: OTP Input */}
            {step === 'otp' && (
              <>
                <TextInput
                  ref={otpInputRef}
                  style={[styles.otpInput, { 
                    color: colors.text, 
                    backgroundColor: colors.inputBackground || colors.background,
                    borderColor: error ? colors.error : colors.border,
                  }]}
                  value={otp}
                  onChangeText={(text) => {
                    setOtp(text.replace(/[^0-9]/g, '').slice(0, 6));
                    setError('');
                  }}
                  placeholder="• • • • • •"
                  placeholderTextColor={colors.textTertiary || colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                  autoFocus
                />

                <TouchableOpacity
                  style={[styles.primaryButton, { 
                    backgroundColor: otp.length === 6 ? colors.primary : colors.primary + '60',
                  }]}
                  onPress={handleVerifyOTP}
                  disabled={loading || otp.length !== 6}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryButtonText}>Verify Code</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={handleResendOTP}
                  disabled={cooldown > 0 || loading}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.resendText, { 
                    color: cooldown > 0 ? colors.textTertiary || colors.textSecondary : colors.primary 
                  }]}>
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
                  </Text>
                </TouchableOpacity>

                {/* Helpful hints */}
                <View style={[styles.hintBox, { backgroundColor: colors.warning + '10', borderColor: colors.warning + '25' }]}>
                  <Ionicons name="information-circle" size={15} color={colors.warning} style={{ marginTop: 1 }} />
                  <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                    Didn't get the code? Check your <Text style={{ fontWeight: '600' }}>spam/junk folder</Text>. Emails come from noreply@refopen.com
                  </Text>
                </View>
              </>
            )}

            {/* Bottom actions */}
            {step !== 'success' && (
              <View style={styles.bottomActions}>
                <TouchableOpacity
                  style={styles.bottomActionButton}
                  onPress={() => Linking.openURL('https://www.refopen.com/support')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="help-circle-outline" size={15} color={colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.bottomActionText, { color: colors.textSecondary }]}>Need help?</Text>
                </TouchableOpacity>

                <View style={[styles.bottomDivider, { backgroundColor: colors.border }]} />

                <TouchableOpacity
                  style={styles.bottomActionButton}
                  onPress={onLogout}
                  activeOpacity={0.7}
                >
                  <Ionicons name="log-out-outline" size={15} color={colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.bottomActionText, { color: colors.textSecondary }]}>Sign out</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { minHeight: '100vh' } : {}),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web' ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 } : {}),
  },
  container: {
    width: Platform.OS === 'web' ? 420 : '88%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    ...(Platform.OS === 'web' ? { zIndex: 1 } : {}),
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
    gap: 8,
  },
  emailText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
    width: '100%',
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
    width: '100%',
  },
  successText: {
    fontSize: 13,
    flex: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  otpInput: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  resendButton: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
    width: '100%',
  },
  hintText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 0,
  },
  bottomActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bottomActionText: {
    fontSize: 13,
  },
  bottomDivider: {
    width: 1,
    height: 16,
  },
});

export default EmailVerificationModal;
