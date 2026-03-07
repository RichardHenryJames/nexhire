import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useNavigationState } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import refopenAPI from '../../services/api';
import CachedImage from '../CachedImage';

/**
 * Desktop-only top navigation bar (LinkedIn-style)
 * Shows: Logo | Search | Home Jobs AskReferral Messages Notifications | Me dropdown
 * Only rendered on web when width >= 1024
 */
export default function DesktopNavBar() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, isJobSeeker, isEmployer, isAdmin, isVerifiedReferrer, logout } = useAuth();
  const navigation = useNavigation();
  const [showMeDropdown, setShowMeDropdown] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  // Company search (same as HomeScreen)
  const searchOrganizations = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setSearchLoading(true);
    try {
      const result = await refopenAPI.getOrganizations(query.trim(), 10);
      if (result.success && result.data) {
        const filtered = result.data.filter(org => org.id !== 999999);
        setSearchResults(filtered);
        setShowSearchResults(filtered.length > 0);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch {
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => searchOrganizations(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchOrganizations]);

  // Helper: derive active tab name from a URL path
  const getTabFromPath = useCallback((path) => {
    if (!path) return null;
    const p = path.toLowerCase();
    if (p.includes('/jobs') || p.includes('/job-details')) return 'Jobs';
    if (p.includes('/messages') || p.includes('/chat')) return 'Messages';
    if (p.includes('/notifications')) return 'Notifications';
    if (p.includes('/ask-for-referral') || p.includes('/ask-referral')) return 'AskReferral';
    if (p.includes('/services')) return 'Services';
    if (p.includes('/profile') || p.includes('/settings')) return 'Profile';
    if (p === '/' || p.includes('/home')) return 'Home';
    return null;
  }, []);

  // Track active tab in local state — updates immediately on click
  const [activeRoute, setActiveRoute] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return getTabFromPath(window.location.pathname) || 'Home';
    }
    return 'Home';
  });

  // Sync from navigation state (handles programmatic navigation from other components)
  const navStateRoute = useNavigationState(state => {
    try {
      if (!state || !state.routes || state.index == null) return null;
      const mainRoute = state.routes[state.index];
      if (!mainRoute) return null;
      if (mainRoute.name === 'Main' && mainRoute.state) {
        const mainState = mainRoute.state;
        const innerRoute = mainState.routes?.[mainState.index];
        if (!innerRoute) return null;
        if (innerRoute.name === 'MainTabs' && innerRoute.state) {
          return innerRoute.state.routes?.[innerRoute.state.index]?.name || null;
        }
        if (innerRoute.name === 'JobsList' || innerRoute.name === 'JobDetails') return 'Jobs';
        if (innerRoute.name === 'Conversations' || innerRoute.name === 'ChatScreen') return 'Messages';
        return innerRoute.name;
      }
      return mainRoute.name;
    } catch {
      return null;
    }
  });

  // When navigation state changes (e.g. sidebar link click, deep link), sync active tab
  useEffect(() => {
    if (navStateRoute) setActiveRoute(navStateRoute);
  }, [navStateRoute]);

  // Listen for browser back/forward to keep active tab in sync
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onPopState = () => {
      const tab = getTabFromPath(window.location.pathname);
      if (tab) setActiveRoute(tab);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [getTabFromPath]);

  // Fetch wallet balance + unread count
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [walletRes, notifRes] = await Promise.all([
          refopenAPI.apiCall('/wallet/balance').catch(() => null),
          refopenAPI.apiCall('/notifications/unread-count').catch(() => null),
        ]);
        if (walletRes?.success) setWalletBalance(walletRes.data?.Balance ?? walletRes.data?.balance ?? 0);
        if (notifRes?.success) setUnreadCount(notifRes.data?.count || 0);
      } catch {}
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click (web)
  useEffect(() => {
    if (Platform.OS !== 'web' || !showMeDropdown) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowMeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [showMeDropdown]);

  const navigateTo = useCallback((screen, params) => {
    setShowMeDropdown(false);
    // DesktopNavBar is a sibling of MainStack, so we need to navigate through Main
    navigation.navigate('Main', { screen, params });
  }, [navigation]);

  const navigateToTab = useCallback((tabName) => {
    setShowMeDropdown(false);
    navigation.navigate('Main', { screen: 'MainTabs', params: { screen: tabName } });
  }, [navigation]);

  const handleLogout = async () => {
    setShowMeDropdown(false);
    try { await logout(); } catch {}
  };

  // Nav items
  const navItems = [
    { name: 'Home', icon: 'home', iconOutline: 'home-outline', label: 'Home', isTab: true },
    { name: 'Jobs', icon: 'briefcase', iconOutline: 'briefcase-outline', label: 'Jobs', isTab: true },
    ...(isJobSeeker ? [{ name: 'AskReferral', icon: 'person-add', iconOutline: 'person-add-outline', label: 'Ask Referral', isTab: true }] : []),
    ...(isEmployer ? [{ name: 'CreateJob', icon: 'add-circle', iconOutline: 'add-circle-outline', label: 'Post Job', isTab: true }] : []),
    ...(isJobSeeker ? [{ name: 'Services', icon: 'grid', iconOutline: 'grid-outline', label: 'Services', isTab: true }] : []),
    { name: 'Messages', icon: 'chatbubbles', iconOutline: 'chatbubbles-outline', label: 'Messaging', isTab: false },
    { name: 'Notifications', icon: 'notifications', iconOutline: 'notifications-outline', label: 'Notifications', isTab: true, badge: unreadCount },
  ];

  const profilePic = user?.ProfilePictureURL;
  const userName = user ? `${user.FirstName || ''} ${user.LastName || ''}`.trim() : 'User';
  const userTitle = user?.CurrentJobTitle
    ? (user?.CurrentCompany ? `${user.CurrentJobTitle} at ${user.CurrentCompany}` : user.CurrentJobTitle)
    : (user?.HighestEducation || (isEmployer ? 'Employer' : isAdmin ? 'Admin' : ''));

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.inner}>
        {/* Left: Logo */}
        <TouchableOpacity style={styles.logoContainer} onPress={() => navigateToTab('Home')}>
          {Platform.OS === 'web' ? (
            <img src="/refopen-logo.png" alt="RefOpen" style={{ width: 120, height: 44, objectFit: 'contain' }} />
          ) : (
            <Image source={require('../../../assets/refopen-logo.png')} style={{ width: 120, height: 44 }} resizeMode="contain" />
          )}
        </TouchableOpacity>

        {/* Center: Company Search with autocomplete */}
        <View ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.gray400} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search companies..."
              placeholderTextColor={colors.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => searchQuery.trim().length >= 2 && setShowSearchResults(true)}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
            />
            {searchLoading && <ActivityIndicator size="small" color={colors.primary} />}
            {searchQuery.length > 0 && !searchLoading && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setShowSearchResults(false); }}>
                <Ionicons name="close-circle" size={16} color={colors.gray400} />
              </TouchableOpacity>
            )}
          </View>
          {/* Search results dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <View style={[styles.searchDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                {searchResults.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.searchResultItem}
                    onPress={() => {
                      navigation.navigate('Main', { screen: 'OrganizationDetails', params: { organizationId: item.id } });
                      setShowSearchResults(false);
                      setSearchQuery('');
                    }}
                  >
                    {item.logoURL ? (
                      <CachedImage source={{ uri: item.logoURL }} style={styles.searchOrgLogo} />
                    ) : (
                      <View style={[styles.searchOrgLogo, { backgroundColor: colors.gray100, justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="business" size={16} color={colors.gray400} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.searchOrgName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                      {item.industry && <Text style={{ fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>{item.industry}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.gray400} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Right: Nav Icons */}
        <View style={styles.navItems}>
          {navItems.map(item => {
            const isActive = activeRoute === item.name;
            return (
              <TouchableOpacity
                key={item.name}
                style={[styles.navItem, isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => {
                  setActiveRoute(item.name);
                  item.isTab ? navigateToTab(item.name) : navigateTo(item.name);
                }}
              >
                <View style={styles.navIconWrapper}>
                  <Ionicons 
                    name={isActive ? item.icon : item.iconOutline} 
                    size={22} 
                    color={isActive ? colors.primary : colors.gray500} 
                  />
                  {item.badge > 0 && (
                    <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
                      <Text style={styles.badgeText}>{item.badge > 99 ? '99+' : item.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.navLabel, { color: isActive ? colors.primary : colors.gray500 }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Wallet badge */}
          {walletBalance !== null && (
            <TouchableOpacity 
              style={[styles.navItem, { width: 'auto', paddingHorizontal: 8 }]}
              onPress={() => navigateTo('Wallet')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.success + '12', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14 }}>
                <Ionicons name="wallet-outline" size={14} color={colors.success} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.success }}>₹{walletBalance}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Me dropdown */}
          <View ref={dropdownRef} style={{ position: 'relative' }}>
            <TouchableOpacity
              style={[styles.navItem, showMeDropdown && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setShowMeDropdown(v => !v)}
            >
              {profilePic ? (
                <CachedImage source={{ uri: profilePic }} style={styles.avatarSmall} />
              ) : (
                <View style={[styles.avatarSmall, { backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={14} color={colors.primary} />
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={[styles.navLabel, { color: showMeDropdown ? colors.primary : colors.gray500 }]}>Me</Text>
                <Ionicons name="caret-down" size={10} color={colors.gray500} />
              </View>
            </TouchableOpacity>

            {/* Dropdown */}
            {showMeDropdown && (
              <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Profile header */}
                <TouchableOpacity style={styles.dropdownProfile} onPress={() => navigateTo('Profile')}>
                  {profilePic ? (
                    <CachedImage source={{ uri: profilePic }} style={styles.avatarMed} />
                  ) : (
                    <View style={[styles.avatarMed, { backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="person" size={24} color={colors.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dropdownName, { color: colors.text }]}>{userName}</Text>
                    <Text style={[styles.dropdownTitle, { color: colors.textSecondary }]} numberOfLines={1}>{userTitle}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.viewProfileBtn, { borderColor: colors.primary }]} 
                  onPress={() => navigateTo('Profile')}
                >
                  <Text style={[styles.viewProfileText, { color: colors.primary }]}>View Profile</Text>
                </TouchableOpacity>

                <View style={[styles.dropdownDivider, { backgroundColor: colors.border }]} />

                {/* Menu items — matches ProfileSlider sections */}
                {/* 💰 Wallet & Rewards */}
                {[
                  { icon: 'wallet-outline', label: 'Wallet', screen: 'Wallet', right: walletBalance !== null ? `₹${walletBalance}` : null },
                  ...(isVerifiedReferrer || isAdmin ? [{ icon: 'trending-up-outline', label: 'Earnings', screen: 'Earnings' }] : []),
                  { icon: 'megaphone-outline', label: 'Social Share', screen: 'ShareEarn' },
                ].map(item => (
                  <TouchableOpacity key={item.label} style={styles.dropdownItem} onPress={() => navigateTo(item.screen)}>
                    <Ionicons name={item.icon} size={18} color={colors.textSecondary} />
                    <Text style={[styles.dropdownItemText, { color: colors.text }]}>{item.label}</Text>
                    {item.right && <Text style={[styles.dropdownItemRight, { color: colors.primary }]}>{item.right}</Text>}
                  </TouchableOpacity>
                ))}

                <View style={[styles.dropdownDivider, { backgroundColor: colors.border }]} />

                {/* 📋 Your Activity */}
                {[
                  { icon: 'send-outline', label: 'My Referral Requests', screen: 'MyReferralRequests' },
                  { icon: 'eye-outline', label: 'Who Viewed My Profile', screen: 'ProfileViews' },
                  { icon: 'bookmark-outline', label: 'Saved Jobs', screen: 'SavedJobs' },
                  { icon: 'document-text-outline', label: 'Applications', screen: 'Applications' },
                ].map(item => (
                  <TouchableOpacity key={item.label} style={styles.dropdownItem} onPress={() => navigateTo(item.screen)}>
                    <Ionicons name={item.icon} size={18} color={colors.textSecondary} />
                    <Text style={[styles.dropdownItemText, { color: colors.text }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}

                <View style={[styles.dropdownDivider, { backgroundColor: colors.border }]} />

                {/* 🚀 Referrer */}
                {isVerifiedReferrer || isAdmin ? (
                  <TouchableOpacity style={styles.dropdownItem} onPress={() => navigateTo('Referral')}>
                    <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.dropdownItemText, { color: colors.text }]}>Provide Referral</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.dropdownItem} onPress={() => navigateTo('BecomeReferrer')}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.dropdownItemText, { color: colors.text }]}>Become a Referrer 🚀</Text>
                  </TouchableOpacity>
                )}

                <View style={[styles.dropdownDivider, { backgroundColor: colors.border }]} />

                {/* ⚙️ More */}
                {[
                  { icon: 'settings-outline', label: 'Settings and Privacy', screen: 'Settings' },
                  { icon: 'help-circle-outline', label: 'Help & Support', screen: 'Support', isRoot: true },
                ].map(item => (
                  <TouchableOpacity key={item.label} style={styles.dropdownItem} onPress={() => {
                    setShowMeDropdown(false);
                    if (item.isRoot) {
                      navigation.navigate(item.screen);
                    } else if (item.isTab) {
                      navigateToTab(item.screen);
                    } else {
                      navigateTo(item.screen);
                    }
                  }}>
                    <Ionicons name={item.icon} size={18} color={colors.textSecondary} />
                    <Text style={[styles.dropdownItemText, { color: colors.text }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}

                <View style={[styles.dropdownDivider, { backgroundColor: colors.border }]} />

                {/* Dark mode toggle */}
                <TouchableOpacity style={styles.dropdownItem} onPress={() => { toggleTheme(); setShowMeDropdown(false); }}>
                  <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.textSecondary} />
                  <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                    {isDark ? 'Light Mode' : 'Dark Mode'}
                  </Text>
                </TouchableOpacity>

                {/* Logout */}
                <TouchableOpacity style={styles.dropdownItem} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={18} color={colors.error || '#EF4444'} />
                  <Text style={[styles.dropdownItemText, { color: colors.error || '#EF4444' }]}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { position: 'sticky', top: 0, zIndex: 1000 } : {}),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    height: 60,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 16,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 34,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  searchDropdown: {
    position: 'absolute',
    top: 38,
    left: 0,
    right: 0,
    borderRadius: 8,
    borderWidth: 1,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    } : {}),
    zIndex: 1002,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchOrgLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  searchOrgName: {
    fontSize: 13,
    fontWeight: '500',
  },
  navItems: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 60,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  navIconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  avatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  // Dropdown
  dropdown: {
    position: 'absolute',
    top: 56,
    right: 0,
    width: 280,
    maxHeight: 'calc(100vh - 60px)',
    borderRadius: 8,
    borderWidth: 1,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      overflowY: 'auto',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    }),
    paddingVertical: 8,
    zIndex: 1001,
  },
  dropdownProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarMed: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  dropdownName: {
    fontSize: 15,
    fontWeight: '600',
  },
  dropdownTitle: {
    fontSize: 12,
    marginTop: 2,
  },
  viewProfileBtn: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 4,
    alignItems: 'center',
  },
  viewProfileText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownDivider: {
    height: 1,
    marginVertical: 6,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dropdownItemText: {
    fontSize: 14,
    flex: 1,
  },
  dropdownItemRight: {
    fontSize: 13,
    fontWeight: '600',
  },
});
