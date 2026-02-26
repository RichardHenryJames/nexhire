/**
 * ProfileSlider Component - LinkedIn-style profile drawer
 * Slides in from left, covers ~75% of screen width
 * Shows profile photo, name, basic info, and categorized navigation
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  Switch,
  Modal,
  StyleSheet,
  PanResponder,
} from 'react-native';
import CachedImage from './CachedImage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { showToast } from './Toast';
import refopenAPI from '../services/api';
import { frontendConfig } from '../config/appConfig';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 340);

export default function ProfileSlider({ visible, onClose }) {
  const { user, isEmployer, isJobSeeker, isAdmin, isVerifiedUser, isVerifiedReferrer, currentWork, logout, refreshVerificationStatus } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const navigation = useNavigation();
  const slideAnim = useRef(new Animated.Value(-SLIDER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const newBadgePulse = useRef(new Animated.Value(0.6)).current;
  const [mounted, setMounted] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [pendingReferralCount, setPendingReferralCount] = useState(0);

  // ⚡ Swipe-to-close: drag the panel left to dismiss (like LinkedIn)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dx < -10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) {
          slideAnim.setValue(gs.dx);
          overlayAnim.setValue(1 + gs.dx / SLIDER_WIDTH);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -(SLIDER_WIDTH * 0.3) || gs.vx < -0.5) {
          Animated.parallel([
            Animated.timing(slideAnim, { toValue: -SLIDER_WIDTH, duration: 200, useNativeDriver: true }),
            Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => { setMounted(false); onClose(); });
        } else {
          Animated.parallel([
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 5 }),
            Animated.spring(overlayAnim, { toValue: 1, useNativeDriver: true, bounciness: 5 }),
          ]).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      // Pulse animation for NEW badge
      Animated.loop(
        Animated.sequence([
          Animated.timing(newBadgePulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(newBadgePulse, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
      // Refresh verification status and wallet balance when slider opens
      refreshVerificationStatus();
      (async () => {
        try {
          const result = await refopenAPI.apiCall('/wallet/balance');
          if (result.success && result.data != null) {
            setWalletBalance(result.data.Balance ?? result.data.balance ?? 0);
          }
        } catch (e) {
          console.warn('Wallet balance fetch failed:', e);
        }
      })();
      // Fetch available referral requests for verified referrers or admin
      if (isVerifiedReferrer || isAdmin) {
        (async () => {
          try {
            const res = await refopenAPI.getAvailableReferralRequests(1, 100);
            if (res.success && res.data) {
              const requests = Array.isArray(res.data) ? res.data : (res.data.requests || []);
              // Only count active/open requests (not expired, completed, etc.)
              const active = requests.filter(r => 
                r.Status === 'NotifiedToReferrers' || r.Status === 'Viewed' || 
                r.Status === 'Pending' || r.Status === 'Claimed'
              );
              setPendingReferralCount(active.length);
            }
          } catch (e) {}
        })();
      }
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SLIDER_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted && !visible) return null;

  const profilePhotoUrl =
    user?.ProfilePictureURL || user?.profilePictureURL || user?.picture || null;

  const userName = `${user?.FirstName || ''} ${user?.LastName || ''}`.trim() || 'User';
  const userEmail = user?.Email || '';

  const navigateTo = (screen, params) => {
    onClose();
    setTimeout(() => {
      navigation.navigate(screen, params);
    }, 300);
  };

  const handleLogoutPress = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutModal(false);
    onClose();
    setTimeout(() => logout(), 300);
  };

  // Categorized menu sections
  const menuSections = [
    {
      title: '💰 Wallet & Rewards',
      items: [
        {
          icon: 'wallet-outline',
          label: 'Wallet',
          onPress: () => navigateTo('Wallet'),
          rightText: walletBalance !== null ? `₹${walletBalance}` : null,
        },
        {
          icon: 'trending-up-outline',
          label: 'Earnings',
          onPress: () => navigateTo('Earnings'),
          highlight: true,
        },
        {
          icon: 'megaphone-outline',
          label: 'Social Share',
          onPress: () => navigateTo('ShareEarn'),
        },
      ],
    },
    {
      title: '📋 Your Activity',
      items: [
        {
          icon: 'send-outline',
          label: 'My Referral Requests',
          onPress: () => navigateTo('MyReferralRequests'),
        },
        {
          icon: 'eye-outline',
          label: 'Who Viewed My Profile',
          onPress: () => navigateTo('ProfileViews'),
        },
      ],
    },
    ...((!isVerifiedReferrer && !isAdmin) ? [{
      title: '🚀 Referrer',
      items: [
        {
          icon: 'shield-checkmark-outline',
          label: 'Become a Referrer 🚀',
          onPress: () => navigateTo('BecomeReferrer'),
          highlight: true,
        },
      ],
    }] : [{
      title: '🏅 Referrer',
      items: [
        {
          icon: 'people-outline',
          label: 'Provide Referral',
          onPress: () => navigateTo('Referral'),          badge: pendingReferralCount,        },
      ],
    }]),
    {
      title: '⚙️ More',
      items: [
        {
          icon: 'settings-outline',
          label: 'Settings and Privacy',
          onPress: () => navigateTo('Settings'),
        },
        {
          icon: 'help-circle-outline',
          label: 'Help & Support',
          onPress: () => navigateTo('Support'),
        },
      ],
    },
  ];

  // Logout Modal (same style as Settings screen)
  const renderLogoutModal = () => (
    <Modal
      visible={showLogoutModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowLogoutModal(false)}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 24,
          alignItems: 'center',
          width: '100%',
          maxWidth: 320,
        }}>
          <Ionicons name="log-out-outline" size={48} color="#FF3B30" />
          <Text style={{
            fontSize: 20,
            fontWeight: '600',
            color: colors.text,
            marginTop: 16,
            marginBottom: 8,
          }}>Logout?</Text>
          <Text style={{
            fontSize: 14,
            color: colors.textSecondary,
            textAlign: 'center',
            marginBottom: 24,
          }}>Are you sure you want to logout?</Text>
          <View style={{
            flexDirection: 'row',
            gap: 12,
            marginTop: 8,
          }}>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 44,
                backgroundColor: colors.gray100 || colors.border,
              }}
              onPress={() => setShowLogoutModal(false)}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 44,
                backgroundColor: '#FF3B30',
              }}
              onPress={handleLogoutConfirm}
            >
              <Text style={{ color: '#FFF', fontWeight: '600' }}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999999,
      elevation: 999999,
      ...(Platform.OS === 'web' ? { 
        position: 'fixed',
        zIndex: 999999,
      } : {}),
    }}>
      {/* Logout Confirmation Modal */}
      {renderLogoutModal()}

      {/* Dark overlay */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          opacity: overlayAnim,
        }}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* Slider Panel — swipe left to close */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: SLIDER_WIDTH,
          backgroundColor: colors.background,
          transform: [{ translateX: slideAnim }],
          shadowColor: '#000',
          shadowOffset: { width: 4, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 20,
          borderRightWidth: 1,
          borderRightColor: colors.border,
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Profile Header */}
          <View style={{
            paddingTop: Platform.OS === 'ios' ? 60 : Platform.OS === 'web' ? 20 : 40,
            paddingHorizontal: 20,
            paddingBottom: 20,
            backgroundColor: colors.primary + '10',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
            {/* Close button */}
            <TouchableOpacity
              onPress={onClose}
              style={{
                position: 'absolute',
                top: Platform.OS === 'ios' ? 50 : Platform.OS === 'web' ? 12 : 32,
                right: 12,
                padding: 6,
                zIndex: 10,
              }}
            >
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Profile Photo - tapping navigates to Profile */}
            <TouchableOpacity
              onPress={() => navigateTo('Profile')}
              activeOpacity={0.8}
            >
              {profilePhotoUrl ? (
                <CachedImage
                  source={{ uri: profilePhotoUrl }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    borderWidth: 2,
                    borderColor: colors.primary,
                  }}
                />
              ) : (
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Ionicons name="person" size={30} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {/* Name & Verified Badges - tapping name navigates to Profile */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => navigateTo('Profile')}
                activeOpacity={0.8}
              >
                <Text style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: '700',
                }} numberOfLines={1}>
                  {userName}
                </Text>
              </TouchableOpacity>
              {isVerifiedUser && (
                <MaterialIcons
                  name="verified"
                  size={20}
                  color={colors.primary}
                  style={{ marginLeft: 6 }}
                />
              )}
              {isVerifiedReferrer && currentWork && (
                <TouchableOpacity
                  onPress={() => showToast(`Verified Referrer at ${currentWork.CompanyName || currentWork.companyName || 'Company'}`, 'success', 2000)}
                  activeOpacity={0.7}
                  style={{ marginLeft: 6 }}
                >
                  {(currentWork.LogoURL || currentWork.logoURL) ? (
                    <CachedImage
                      source={{ uri: currentWork.LogoURL || currentWork.logoURL }}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 1.5,
                        borderColor: '#10B981',
                      }}
                    />
                  ) : (
                    <View style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: '#10B98120',
                      borderWidth: 1.5,
                      borderColor: '#10B981',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Ionicons name="business" size={12} color="#10B981" />
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Current Work Experience with Company Logo */}
            {currentWork && (
              <TouchableOpacity
                onPress={() => navigateTo('Profile')}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 10,
                  gap: 8,
                }}
              >
                {(currentWork.LogoURL || currentWork.logoURL) ? (
                  <CachedImage
                    source={{ uri: currentWork.LogoURL || currentWork.logoURL }}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                    }}
                  />
                ) : (
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    backgroundColor: colors.primary + '20',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Ionicons name="business" size={14} color={colors.primary} />
                  </View>
                )}
                <Text style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  flex: 1,
                }} numberOfLines={1}>
                  {currentWork.JobTitle || currentWork.jobTitle}{(currentWork.CompanyName || currentWork.companyName) ? ` at ${currentWork.CompanyName || currentWork.companyName}` : ''}
                </Text>
              </TouchableOpacity>
            )}

            {/* View Profile Button */}
            <TouchableOpacity
              onPress={() => navigateTo('Profile')}
              activeOpacity={0.7}
              style={{
                marginTop: 14,
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: colors.primary,
                alignSelf: 'flex-start',
              }}
            >
              <Text style={{
                color: colors.primary,
                fontSize: 13,
                fontWeight: '600',
              }}>View Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Categorized Menu Sections */}
          {menuSections.map((section, sectionIndex) => (
            <View key={sectionIndex}>
              {/* Section Header */}
              <View style={{
                paddingHorizontal: 20,
                paddingTop: 10,
                paddingBottom: 4,
              }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>
                  {section.title}
                </Text>
              </View>

              {/* Section Items */}
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                  }}
                >
                  <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
                  <Text style={{
                    color: colors.text,
                    fontSize: 14,
                    marginLeft: 14,
                    flex: 1,
                  }} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.highlight && (
                    <Animated.View style={{ opacity: newBadgePulse }}>
                      <LinearGradient
                        colors={['#6366F1', colors.primary, '#EC4899']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>NEW</Text>
                      </LinearGradient>
                    </Animated.View>
                  )}
                  {item.rightText && (
                    <Text style={{
                      color: colors.primary,
                      fontSize: 13,
                      fontWeight: '700',
                    }}>
                      {item.rightText}
                    </Text>
                  )}
                  {item.badge > 0 && (
                    <View style={{ backgroundColor: '#EF4444', borderRadius: 9, minWidth: 20, height: 20, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{item.badge > 99 ? '99+' : item.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              {/* Section Divider */}
              {sectionIndex < menuSections.length - 1 && (
                <View style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginHorizontal: 20,
                  marginTop: 4,
                }} />
              )}
            </View>
          ))}

          {/* Dark Mode Toggle */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 20,
            marginTop: 4,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
            <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={20} color={colors.textSecondary} />
            <Text style={{
              color: colors.text,
              fontSize: 14,
              marginLeft: 14,
              flex: 1,
            }}>
              Dark Mode
            </Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.gray300 || '#ccc', true: colors.primary + '60' }}
              thumbColor={isDark ? colors.primary : '#f4f3f4'}
            />
          </View>

          {/* Logout */}
          <TouchableOpacity
            onPress={handleLogoutPress}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 10,
              paddingHorizontal: 20,
              marginTop: 2,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={{
              color: '#EF4444',
              fontSize: 14,
              fontWeight: '600',
              marginLeft: 14,
            }}>
              Log Out
            </Text>
          </TouchableOpacity>

          {/* App Version */}
          <View style={{
            paddingVertical: 16,
            alignItems: 'center',
          }}>
            <Text style={{
              fontSize: 11,
              color: colors.textSecondary + '80',
            }}>
              RefOpen v{process.env.EXPO_PUBLIC_APP_VERSION || '1.1.0'}{(process.env.EXPO_PUBLIC_APP_ENV || 'development') !== 'production' ? `-${process.env.EXPO_PUBLIC_APP_ENV || 'dev'}` : ''}
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}
