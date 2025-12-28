import React, { useMemo, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { typography } from '../../styles/theme';

/**
 * AdCard Component - Displays Google AdSense ads
 * 
 * Props:
 * - variant: 'jobs' (default) | 'referral' - Different styles for different pages
 */
const AdCard = ({ 
  adSlot = '1062213844',
  adClient = 'ca-pub-7167287641762329',
  adFormat = 'auto',
  variant = 'jobs', // 'jobs' | 'referral'
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, variant), [colors, variant]);
  const adInitialized = useRef(false);

  useEffect(() => {
    // Only run on web platform
    if (Platform.OS === 'web' && !adInitialized.current) {
      try {
        const timer = setTimeout(() => {
          if (window.adsbygoogle) {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            adInitialized.current = true;
          }
        }, 100);
        return () => clearTimeout(timer);
      } catch (error) {
        console.log('AdSense error:', error);
      }
    }
  }, []);

  // Referral page variant - Minimal inline style
  if (variant === 'referral') {
    return (
      <View style={styles.minimalAd}>
        <View style={styles.minimalBadge}>
          <Text style={styles.minimalBadgeText}>AD</Text>
        </View>
        <Text style={styles.minimalText}>Sponsored</Text>
      </View>
    );
  }

  // Jobs page variant - Card style (default)
  return (
    <TouchableOpacity activeOpacity={0.8} style={styles.card}>
      {/* Header - Same as JobCard */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {/* Logo Container - Same as JobCard */}
          <View style={styles.logoContainer}>
            <View style={styles.logoPlaceholder}>
              <Ionicons name="megaphone" size={20} color={colors.primary} />
            </View>
          </View>
          
          {/* Title and Company - Same structure as JobCard */}
          <View style={styles.titleContent}>
            <Text style={styles.title} numberOfLines={1}>Sponsored Content</Text>
            <Text style={styles.company} numberOfLines={1}>Advertisement</Text>
          </View>
        </View>
      </View>
      
      {/* Meta Row - Same as JobCard */}
      <View style={styles.metaRow}>
        <Text style={styles.meta}>Promoted</Text>
        <Text style={styles.dot}> • </Text>
        <Text style={styles.meta}>Relevant to your search</Text>
      </View>

      {/* Badge Row - Similar to JobCard job type badges */}
      <View style={styles.metaRowAlt}>
        <Text style={styles.metaBadge}>AD</Text>
        <Text style={styles.metaBadge}>Sponsored</Text>
      </View>

      {/* Google AdSense - inline ad (only on web) */}
      {Platform.OS === 'web' && (
        <ins
          className="adsbygoogle"
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            minHeight: '50px',
            maxHeight: '100px',
            marginTop: '8px',
          }}
          data-ad-client={adClient}
          data-ad-slot={adSlot}
          data-ad-format="fluid"
          data-ad-layout-key="-fb+5w+4e-db+86"
        />
      )}

      {/* Actions Row - Same structure as JobCard */}
      <View style={styles.actionsRow}>
        <View style={styles.adBadgePill}>
          <Ionicons name="information-circle-outline" size={16} color={colors.gray500} />
          <Text style={styles.adBadgeText}>Sponsored</Text>
        </View>
        
        <TouchableOpacity style={styles.learnMoreBtn} activeOpacity={0.7}>
          <Ionicons name="open-outline" size={18} color="#fff" />
          <Text style={styles.learnMoreText}>Learn More</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// Styles for both variants
const createStyles = (colors, variant) => StyleSheet.create({
  // ============ JOBS VARIANT (JobCard style) ============
  card: {
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
  header: {
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  logoContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  titleContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  company: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaRowAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  metaBadge: {
    fontSize: 12,
    color: colors.primary,
    backgroundColor: colors.primaryLight + '30',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  dot: { 
    color: colors.gray300 
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  adBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.gray100,
    marginRight: 'auto',
  },
  adBadgeText: {
    fontSize: 12,
    color: colors.gray500,
    marginLeft: 4,
    fontWeight: '500',
  },
  learnMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  learnMoreText: { 
    color: '#fff', 
    marginLeft: 6, 
    fontWeight: '700', 
    fontSize: 13 
  },
  
  // ============ REFERRAL VARIANT (Minimal style) ============
  minimalAd: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 0,
    paddingVertical: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  minimalContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  minimalBadge: {
    backgroundColor: colors.gray500,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 8,
  },
  minimalBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  minimalText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});

export default AdCard;
