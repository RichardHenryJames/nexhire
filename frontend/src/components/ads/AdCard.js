import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { typography } from '../../styles/theme';
import useResponsive from '../../hooks/useResponsive';

// Generate unique ID for each ad instance
let adInstanceCounter = 0;

// Ad slot IDs for each page (created in Google AdSense dashboard)
const AD_SLOTS = {
  home: '7282446761',         // Homepage ad slot
  jobs: '1062213844',         // RefOpen Job Feeds ad slot
  about: '2030120088',        // About screen ad slot
  referral: '7090875076',     // Ask Referral ad slot
  applications: '8368297727', // Applications screen ad slot
};

/**
 * AdCard Component - Displays Google AdSense ads
 * 
 * Each variant uses EXACT CSS matching its parent page:
 * - home: Matches quickActionCard style from HomeScreen
 * - jobs: Matches JobCard style from JobCard component
 * - referral: Thin strip at top of AskReferralScreen
 * - about: Matches AboutScreen card style
 */
const AdCard = ({ 
  adClient = 'ca-pub-7167287641762329',
  variant = 'jobs', // 'jobs' | 'referral' | 'about' | 'home' | 'applications'
  style = {},
}) => {
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const [adId] = useState(() => `ad-${variant}-${++adInstanceCounter}`);
  const [adLoaded, setAdLoaded] = useState(false);
  
  // Get the correct ad slot for this variant
  const adSlot = AD_SLOTS[variant] || AD_SLOTS.jobs;

  useEffect(() => {
    if (Platform.OS === 'web' && !adLoaded) {
      const timer = setTimeout(() => {
        try {
          const adElement = document.getElementById(adId);
          if (adElement && !adElement.dataset.adsbygoogleStatus && window.adsbygoogle) {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            setAdLoaded(true);
          }
        } catch (error) {
          console.log('AdSense initialization error:', error);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [adId, adLoaded]);

  // ========================================
  // HOME VARIANT - Matches quickActionCard from HomeScreen exactly
  // ========================================
  if (variant === 'home') {
    return (
      <View style={[styles.homeCard, style]}>
        <View style={[styles.homeIcon, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="megaphone" size={24} color={colors.primary} />
          <View style={[styles.homeBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.homeBadgeText}>AD</Text>
          </View>
        </View>
        <View style={styles.homeContent}>
          <Text style={styles.homeTitle}>Sponsored</Text>
          {Platform.OS === 'web' ? (
            <ins
              id={adId}
              className="adsbygoogle"
              style={{
                display: 'block',
                width: '100%',
                minHeight: '50px',
              }}
              data-ad-client={adClient}
              data-ad-slot={adSlot}
              data-ad-format="fluid"
              data-ad-layout-key="-fb+5w+4e-db+86"
            />
          ) : (
            <Text style={styles.homeDescription}>Promoted content</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
      </View>
    );
  }

  // ========================================
  // JOBS VARIANT - Matches JobCard style exactly
  // ========================================
  if (variant === 'jobs') {
    return (
      <View style={[styles.jobCard, style]}>
        {/* Header Row - Same as JobCard */}
        <View style={styles.jobHeader}>
          <View style={styles.jobTitleRow}>
            <View style={styles.jobLogoContainer}>
              <View style={styles.jobLogoPlaceholder}>
                <Ionicons name="megaphone" size={20} color={colors.primary} />
              </View>
            </View>
            <View style={styles.jobTitleContent}>
              <Text style={styles.jobTitle} numberOfLines={1}>Sponsored</Text>
              <Text style={styles.jobCompany} numberOfLines={1}>Advertisement</Text>
            </View>
          </View>
        </View>
        
        {/* Ad Content */}
        {Platform.OS === 'web' && (
          <ins
            id={adId}
            className="adsbygoogle"
            style={{
              display: 'block',
              width: '100%',
              height: '60px',
              marginTop: '8px',
            }}
            data-ad-client={adClient}
            data-ad-slot={adSlot}
            data-ad-format="fluid"
            data-ad-layout-key="-fb+5w+4e-db+86"
          />
        )}
        
        {/* Footer - Similar to JobCard */}
        <View style={styles.jobFooter}>
          <View style={styles.jobBadge}>
            <Text style={styles.jobBadgeText}>AD</Text>
          </View>
          <Text style={styles.jobMeta}>Sponsored</Text>
        </View>
      </View>
    );
  }

  // ========================================
  // REFERRAL VARIANT - Thin strip at top
  // ========================================
  if (variant === 'referral') {
    return (
      <View style={[styles.referralStrip, style]}>
        {Platform.OS === 'web' && (
          <ins
            id={adId}
            className="adsbygoogle"
            style={{
              display: 'block',
              width: '100%',
              height: '50px',
            }}
            data-ad-client={adClient}
            data-ad-slot={adSlot}
            data-ad-format="fluid"
            data-ad-layout-key="-fb+5w+4e-db+86"
          />
        )}
      </View>
    );
  }

  // ========================================
  // ABOUT VARIANT - Matches AboutScreen card style
  // ========================================
  if (variant === 'about') {
    return (
      <View style={[styles.aboutCard, style]}>
        {Platform.OS === 'web' && (
          <ins
            id={adId}
            className="adsbygoogle"
            style={{
              display: 'block',
              width: '100%',
              height: '90px',
            }}
            data-ad-client={adClient}
            data-ad-slot={adSlot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        )}
      </View>
    );
  }

  // ========================================
  // APPLICATIONS VARIANT - Matches ApplicationCard style
  // ========================================
  if (variant === 'applications') {
    return (
      <View style={[styles.applicationCard, style]}>
        {/* Compact header with ad */}
        <View style={styles.appTitleRow}>
          <View style={styles.appLogoContainer}>
            <View style={styles.appLogoPlaceholder}>
              <Ionicons name="megaphone" size={20} color={colors.primary} />
            </View>
          </View>
          <View style={styles.appTitleContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <Text style={styles.appTitle} numberOfLines={1}>Sponsored</Text>
              <View style={[styles.appBadge, { marginLeft: 8 }]}>
                <Text style={styles.appBadgeText}>AD</Text>
              </View>
            </View>
            {Platform.OS === 'web' && (
              <ins
                id={adId}
                className="adsbygoogle"
                style={{
                  display: 'block',
                  width: '100%',
                  minHeight: '50px',
                }}
                data-ad-client={adClient}
                data-ad-slot={adSlot}
                data-ad-format="fluid"
                data-ad-layout-key="-fb+5w+4e-db+86"
              />
            )}
          </View>
        </View>
      </View>
    );
  }

  // Default fallback
  return null;
};

// ========================================
// STYLES - Exact CSS from each page
// ========================================
const createStyles = (colors, responsive = {}) => {
  const { isDesktop } = responsive;
  
  return StyleSheet.create({
  // ============ HOME VARIANT - quickActionCard style from HomeScreen ============
  homeCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.border,
    // On desktop, make cards equal width in 3-column grid (matching quickActionCard)
    ...(Platform.OS === 'web' && isDesktop ? {
      width: 'calc(33.333% - 11px)',
      marginBottom: 0,
      minWidth: 280,
      minHeight: 80,
    } : {}),
  },
  homeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    position: 'relative',
  },
  homeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    borderRadius: 10,
    minWidth: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  homeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  homeContent: {
    flex: 1,
  },
  homeTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  homeDescription: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
  },

  // ============ JOBS VARIANT - JobCard style ============
  jobCard: {
    backgroundColor: colors.surface,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  jobHeader: {
    marginBottom: 6,
  },
  jobTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  jobLogoContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  jobLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  jobTitleContent: {
    flex: 1,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  jobCompany: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  jobFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  jobBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  jobBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  jobMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // ============ REFERRAL VARIANT - Thin strip ============
  referralStrip: {
    marginHorizontal: 20,
    marginBottom: 12,
    height: 50,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },

  // ============ ABOUT VARIANT - AboutScreen card style ============
  aboutCard: {
    marginHorizontal: 24,
    marginVertical: 16,
    backgroundColor: '#18181B', // COLORS.bgCard from AboutScreen
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A', // COLORS.border from AboutScreen
    overflow: 'hidden',
  },

  // ============ APPLICATIONS VARIANT - ApplicationCard style ============
  applicationCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  appHeader: {
    marginBottom: 6,
  },
  appTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  appLogoContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  appLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  appTitleContent: {
    flex: 1,
  },
  appTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
    lineHeight: 22,
  },
  appCompany: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  appFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  appBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  appBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  appMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
};

export default AdCard;
