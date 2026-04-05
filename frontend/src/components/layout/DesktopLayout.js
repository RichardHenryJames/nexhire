import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useResponsive } from '../../hooks/useResponsive';
import CachedImage from '../CachedImage';
import refopenAPI from '../../services/api';

/**
 * DesktopLayout — LinkedIn-style 3-column layout wrapper for desktop web.
 * 
 * On desktop: renders left sidebar (profile card + links) + center content + optional right sidebar
 * On mobile: renders children directly (passthrough)
 * 
 * Props:
 *  - children: center content (the actual screen content)
 *  - sidebarLinks: array of { icon, label, screen, isTab, badge } for left sidebar quick links
 *  - rightSidebar: optional ReactNode for right sidebar content
 *  - maxWidth: max width for center content (default 800)
 *  - hideProfileCard: boolean to hide the profile card (default false)
 */
export default function DesktopLayout({ 
  children, 
  sidebarLinks = null, 
  rightSidebar = null,
  maxWidth = 800,
  hideProfileCard = false,
}) {
  const { colors } = useTheme();
  const { user, isJobSeeker, isVerifiedReferrer, isVerifiedUser, isAdmin, currentWork } = useAuth();
  const { isDesktop } = useResponsive();
  const navigation = useNavigation();
  const isDesktopWeb = Platform.OS === 'web' && isDesktop;

  // Auto-detect current route for smart sidebar links
  const currentRoute = useNavigationState(state => {
    try {
      if (!state?.routes) return '';
      const main = state.routes[state.index];
      if (!main) return '';
      if (main.name === 'Main' && main.state) {
        const inner = main.state.routes[main.state.index];
        if (inner?.name === 'MainTabs' && inner.state) {
          return inner.state.routes[inner.state.index]?.name || '';
        }
        return inner?.name || '';
      }
      return main.name;
    } catch { return ''; }
  });

  // On mobile, just render children
  if (!isDesktopWeb) return children;

  // Fetch applicant profile for sidebar card (has job title, company, education)
  const [applicantData, setApplicantData] = useState(null);
  useEffect(() => {
    if (user?.UserID && isJobSeeker) {
      refopenAPI.getApplicantProfile(user.UserID).then(res => {
        if (res?.success) setApplicantData(res.data);
      }).catch(() => {});
    }
  }, [user?.UserID, isJobSeeker]);

  const profilePic = user?.ProfilePictureURL;
  const userName = user ? `${user.FirstName || ''} ${user.LastName || ''}`.trim() : '';
  
  // Read from applicant profile (same API as profile screen)
  const jobTitle = applicantData?.CurrentJobTitle || '';
  const company = applicantData?.CurrentCompanyName || '';
  const education = applicantData?.HighestEducation || '';
  const inst = applicantData?.Institution || '';
  const location = applicantData?.CurrentLocation || user?.Location || '';

  const userTitle = jobTitle
    ? (company ? `${jobTitle} at ${company}` : jobTitle)
    : (education ? `${education}${inst ? ` at ${inst}` : ''}` : '');

  const currentWorkLogo = currentWork?.LogoURL || null;
  const currentWorkCompany = currentWork?.CompanyName || company || '';

  // Smart context-aware sidebar links based on current screen
  const getSmartLinks = () => {
    if (sidebarLinks) return sidebarLinks; // explicit override

    // Jobs context
    if (['Jobs', 'JobsList', 'JobDetails', 'SavedJobs', 'AIRecommendedJobs'].includes(currentRoute)) {
      return [
        { icon: 'bookmark-outline', label: 'Saved Jobs', screen: 'SavedJobs' },
        { icon: 'document-text-outline', label: 'Applications', screen: 'Applications' },
        { icon: 'sparkles-outline', label: 'AI Jobs', screen: 'AIRecommendedJobs' },
        { icon: 'send-outline', label: 'My Referral Requests', screen: 'MyReferralRequests' },
        { icon: 'card-outline', label: 'Recharge Wallet', screen: 'WalletRecharge' },
      ];
    }

    // Wallet / Money context
    if (['Wallet', 'WalletTransactions', 'WalletRecharge', 'ManualRecharge', 'SubmitPayment', 'WalletHolds', 'PromoCodes', 'Earnings', 'WithdrawalRequests'].includes(currentRoute)) {
      return [
        { icon: 'wallet-outline', label: 'Wallet', screen: 'Wallet' },
        { icon: 'receipt-outline', label: 'Transactions', screen: 'WalletTransactions' },
        { icon: 'lock-closed-outline', label: 'Holds', screen: 'WalletHolds' },
        { icon: 'trending-up-outline', label: 'Earnings', screen: 'Earnings' },
        { icon: 'pricetag-outline', label: 'Promo Codes', screen: 'PromoCodes' },
      ];
    }

    // Notifications context
    if (['Notifications'].includes(currentRoute)) {
      return [
        { icon: 'options-outline', label: 'Notification Preferences', screen: 'NotificationPreferences' },
        { icon: 'send-outline', label: 'My Referral Requests', screen: 'MyReferralRequests' },
        { icon: 'bookmark-outline', label: 'Saved Jobs', screen: 'SavedJobs' },
        { icon: 'briefcase-outline', label: 'Browse Jobs', screen: 'Jobs', isTab: true },
      ];
    }

    // Default (Home, Services, etc.)
    return [
      ...(!isVerifiedUser ? [{ icon: 'checkmark-circle-outline', label: 'Get Verified', screen: 'GetVerified' }] : []),
      ...(!isVerifiedReferrer && !isAdmin
        ? [{ icon: 'shield-checkmark-outline', label: 'Become a Referrer', screen: 'BecomeReferrer' }]
        : [
            { icon: 'people-outline', label: 'Provide Referral', screen: 'Referral' },
            { icon: 'eye-off-outline', label: 'Blind Review Inbox', screen: 'BlindReviewInbox' },
          ]
      ),
      { icon: 'settings-outline', label: 'Settings', screen: 'Settings' },
      { icon: 'card-outline', label: 'Recharge Wallet', screen: 'WalletRecharge' },
    ];
  };

  const links = getSmartLinks();

  const navigateTo = (screen, isTab = false) => {
    if (isTab) {
      navigation.navigate('Main', { screen: 'MainTabs', params: { screen } });
    } else {
      navigation.navigate('Main', { screen });
    }
  };

  return (
    <View style={styles.outerContainer}>
      <View style={styles.layout}>
        {/* Left sidebar */}
        <View style={styles.leftSidebar}>
          {/* Profile card */}
          {!hideProfileCard && (
            <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.profileCover, { backgroundColor: colors.primary + '15' }]} />
              <TouchableOpacity style={styles.profileAvatarWrapper} onPress={() => navigateTo('Profile')}>
                {profilePic ? (
                  <CachedImage source={{ uri: profilePic }} style={styles.profileAvatar} />
                ) : (
                  <View style={[styles.profileAvatar, { backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="person" size={28} color={colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigateTo('Profile')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Text style={[styles.profileName, { color: colors.text }]}>{userName}</Text>
                  {isVerifiedUser && (
                    <MaterialIcons name="verified" size={16} color={colors.primary} />
                  )}
                  {isVerifiedReferrer && currentWorkLogo ? (
                    <CachedImage
                      source={{ uri: currentWorkLogo }}
                      style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.success }}
                    />
                  ) : isVerifiedReferrer ? (
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.success + '20', borderWidth: 1.5, borderColor: colors.success, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="business" size={10} color={colors.success} />
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
              {userTitle ? <Text style={[styles.profileTitle, { color: colors.textSecondary }]} numberOfLines={2}>{userTitle}</Text> : null}
              {location ? (
                <Text style={[styles.profileLocation, { color: colors.textSecondary }]}>{location}</Text>
              ) : null}
              {company && jobTitle ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                  <Ionicons name="business" size={14} color={colors.textSecondary} />
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{company}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Quick links */}
          {links.length > 0 && (
            <View style={[styles.linksCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {links.map((item, idx) => (
                <TouchableOpacity 
                  key={item.label} 
                  style={[styles.linkItem, idx < links.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border + '40' }]}
                  onPress={() => navigateTo(item.screen, item.isTab)}
                >
                  <Ionicons name={item.icon} size={18} color={colors.primary} />
                  <Text style={[styles.linkText, { color: colors.text }]}>{item.label}</Text>
                  {item.badge && (
                    <View style={[styles.linkBadge, { backgroundColor: colors.primary + '15' }]}>
                      <Text style={[styles.linkBadgeText, { color: colors.primary }]}>{item.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Center content */}
        <View style={[styles.centerContent, { maxWidth }]}>
          {children}
        </View>

        {/* Right sidebar (optional) */}
        {rightSidebar && (
          <View style={styles.rightSidebar}>
            {rightSidebar}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 24,
  },
  leftSidebar: {
    width: 225,
    flexShrink: 0,
  },
  centerContent: {
    flex: 1,
  },
  rightSidebar: {
    width: 300,
    flexShrink: 0,
  },
  profileCard: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
    alignItems: 'center',
    paddingBottom: 16,
  },
  profileCover: {
    height: 56,
    width: '100%',
  },
  profileAvatarWrapper: {
    marginTop: -28,
    marginBottom: 8,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  profileTitle: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  profileLocation: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  linksCard: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  linkBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  linkBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
