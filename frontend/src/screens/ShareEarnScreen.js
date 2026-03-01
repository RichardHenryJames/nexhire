/**
 * ShareEarnScreen - Standalone screen for Share & Earn
 * Social media sharing rewards + invite friends referral code
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SubScreenHeader from '../components/SubScreenHeader';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import refopenAPI from '../services/api';
import { showToast } from '../components/Toast';

const getPlatforms = (colors) => [
  { key: 'LinkedIn', icon: 'logo-linkedin', color: colors.primaryDark, reward: 30, label: 'Post about RefOpen' },
  { key: 'Twitter', icon: null, color: colors.black, reward: 20, label: 'Post about RefOpen', useXLogo: true },
  { key: 'Instagram', icon: 'logo-instagram', color: colors.rose, reward: 20, label: 'Post or Story' },
  { key: 'Facebook', icon: 'logo-facebook', color: colors.primary, reward: 15, label: 'Share about RefOpen' },
];

export default function ShareEarnScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [approvedPlatforms, setApprovedPlatforms] = useState([]);

  const referralCode = user?.UserID?.split('-')[0] || '';

  useEffect(() => {
    const fetchClaims = async () => {
      try {
        const result = await refopenAPI.apiCall('/social-share/my-claims');
        if (result.success) {
          const claims = Array.isArray(result.data) ? result.data : (result.data?.claims || []);
          const approved = claims.filter(c => c.Status === 'Approved').map(c => c.Platform);
          setApprovedPlatforms(approved);
        }
      } catch (err) {
        console.warn('Failed to fetch social claims:', err);
      }
    };
    fetchClaims();
  }, []);

  const copyText = async (text, label) => {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        }
      } else {
        const Clipboard = require('expo-clipboard');
        await Clipboard.setStringAsync(text);
      }
      showToast(`${label} copied!`, 'success');
    } catch (e) {
      showToast('Failed to copy', 'error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <SubScreenHeader
        title="Share & Earn"
        icon="close"
        fallbackTab="Home"
      />

      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Post on Social Media */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.errorBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="megaphone" size={18} color={colors.rose} />
            </View>
            <Text style={{ marginLeft: 10, fontSize: 16, fontWeight: '700', color: colors.text }}>
              Post on Social Media
            </Text>
          </View>

          {/* 2x2 Grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {getPlatforms(colors).map((p) => {
              const isApproved = approvedPlatforms.includes(p.key);
              return (
                <TouchableOpacity
                  key={p.key}
                  style={{
                    flex: 1,
                    minWidth: '45%',
                    backgroundColor: isApproved ? colors.background : colors.surface,
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 2,
                    borderColor: isApproved ? colors.success : (p.key === 'Twitter' && isDark ? colors.text : p.color),
                    opacity: isApproved ? 0.7 : 1,
                  }}
                  disabled={isApproved}
                  onPress={() => navigation.navigate('SocialShareSubmit', { platform: p.key })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <View style={{
                      width: 44, height: 44, borderRadius: 12,
                      backgroundColor: p.key === 'Twitter' && isDark ? colors.text : p.color,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {p.useXLogo ? (
                        <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? colors.background : colors.white }}>𝕏</Text>
                      ) : (
                        <Ionicons name={p.icon} size={24} color={colors.white} />
                      )}
                    </View>
                    {isApproved ? (
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark" size={18} color={colors.white} />
                      </View>
                    ) : (
                      <View style={{ backgroundColor: colors.successBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                        <Text style={{ fontSize: 14, color: colors.success, fontWeight: '800' }}>₹{p.reward}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                    {p.key === 'Twitter' ? 'X (Twitter)' : p.key}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    {isApproved ? 'Reward earned!' : p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Note */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, backgroundColor: colors.surface, padding: 12, borderRadius: 10 }}>
            <Ionicons name="gift-outline" size={16} color={colors.textSecondary} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 8, flex: 1 }}>
              Submit proof & earn credits
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 20 }} />

        {/* Invite Friends */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="people" size={18} color={colors.primary} />
            </View>
            <Text style={{ marginLeft: 10, fontSize: 16, fontWeight: '700', color: colors.text }}>
              Invite Friends
            </Text>
            <View style={{ marginLeft: 'auto', backgroundColor: colors.successBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
              <Text style={{ fontSize: 12, color: colors.success, fontWeight: '700' }}>₹25 each!</Text>
            </View>
          </View>

          {/* Referral Code Card */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Your Referral Code</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: colors.primary, letterSpacing: 3 }}>{referralCode}</Text>
              </View>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
                onPress={() => copyText(referralCode, 'Code')}
              >
                <Ionicons name="copy-outline" size={18} color={colors.white} />
                <Text style={{ color: colors.white, fontWeight: '700', fontSize: 14, marginLeft: 6 }}>Copy</Text>
              </TouchableOpacity>
            </View>

            {/* Share Link */}
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.background,
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                borderStyle: 'dashed',
              }}
              onPress={() => copyText(`https://refopen.com/register?ref=${referralCode}`, 'Link')}
            >
              <Ionicons name="link" size={16} color={colors.primary} />
              <Text style={{ flex: 1, marginLeft: 10, fontSize: 12, color: colors.primary }} numberOfLines={1}>
                refopen.com/register?ref={referralCode}
              </Text>
              <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Reward Info */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Ionicons name="person-add" size={20} color={colors.primary} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>They get</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.success }}>₹25</Text>
              </View>
              <View style={{ width: 1, height: 40, backgroundColor: colors.border }} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Ionicons name="gift" size={20} color={colors.warning} />
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>You get</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.success }}>₹25</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
