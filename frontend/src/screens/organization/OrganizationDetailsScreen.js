import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';
import { typography } from '../../styles/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import useResponsive from '../../hooks/useResponsive';
import { showToast } from '../../components/Toast';

export default function OrganizationDetailsScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const responsive = useResponsive();
  const { isMobile, isDesktop, isTablet } = responsive;
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // Handle both route params and URL query params (for web deep linking)
  const getOrganizationId = () => {
    if (route.params?.organizationId) {
      return route.params.organizationId;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryOrgId = urlParams.get('organizationId');
      if (queryOrgId) return queryOrgId;
    }
    return null;
  };
  
  const organizationId = getOrganizationId();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!organizationId) {
      setError('Organization ID is missing');
      setLoading(false);
      return;
    }
    loadOrganizationDetails();
  }, [organizationId]);

  const loadOrganizationDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await refopenAPI.getOrganizationById(organizationId);
      
      if (result.success && result.data) {
        setOrganization(result.data);
        loadRecentJobs(result.data.id);
      } else {
        setError(result.error || 'Failed to load organization details');
      }
    } catch (err) {
      console.error('Error loading organization details:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentJobs = async (orgId) => {
    try {
      setLoadingJobs(true);
      
      const filters = {
        organizationIds: [orgId].join(','),
        postedWithinDays: 1,
        sortBy: 'PublishedAt',
        sortOrder: 'desc',
        dontPersonalize: true
      };
      
      const result = await refopenAPI.getJobs(1, 10, filters);
      
      if (result.success && result.data && Array.isArray(result.data)) {
        setRecentJobs(result.data.slice(0, 5));
      } else {
        setRecentJobs([]);
      }
    } catch (err) {
      console.error('Error loading recent jobs:', err);
      setRecentJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  };

  const openURL = (url) => {
    if (!url) return;
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        Linking.openURL(url);
      }
    } catch (error) {
      showToast('Unable to open link', 'error');
    }
  };

  const formatDate = (job) => {
    const dateString = job.PublishedAt || job.CreatedAt || job.UpdatedAt;
    if (!dateString) return 'Recently posted';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Recently posted';
    
    const now = new Date();
    const hours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just posted';
    if (hours < 24) return `${hours} hours ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} days ago`;
    
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} weeks ago`;
    
    return date.toLocaleDateString();
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading organization details...</Text>
      </View>
    );
  }

  // Error state
  if (error || !organization) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="business-outline" size={64} color={colors.gray400} />
        <Text style={styles.errorTitle}>Unable to Load</Text>
        <Text style={styles.errorText}>{error || 'Organization not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadOrganizationDetails}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SubScreenHeader title="Company Details" fallbackTab="Home" />
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.innerContainer}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          {/* Company Header Row */}
          <View style={styles.companyHeaderRow}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              {organization.logoURL ? (
                <Image 
                  source={{ uri: organization.logoURL }} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="business" size={40} color={colors.gray400} />
                </View>
              )}
            </View>

            {/* Company Info */}
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{organization.name}</Text>
              
              {/* Badges Row */}
              <View style={styles.badgesRow}>
                {!!organization.verification && (
                  <View style={[
                    styles.badge,
                    { backgroundColor: organization.verification === 'Verified' ? colors.success + '15' : colors.warning + '15' }
                  ]}>
                    <Ionicons 
                      name={organization.verification === 'Verified' ? 'checkmark-circle' : 'shield-outline'} 
                      size={14} 
                      color={organization.verification === 'Verified' ? colors.success : colors.warning} 
                    />
                    <Text style={[
                      styles.badgeText,
                      { color: organization.verification === 'Verified' ? colors.success : colors.warning }
                    ]}>
                      {organization.verification}
                    </Text>
                  </View>
                )}
                {/* Tier badge - admin only */}
                {organization.tier && user?.userType === 'Admin' && (
                  <View style={[
                    styles.badge,
                    { backgroundColor: organization.tier === 'Elite' ? '#8B5CF615' : organization.tier === 'Premium' ? '#F59E0B15' : colors.gray200 }
                  ]}>
                    <Ionicons
                      name={organization.tier === 'Elite' ? 'diamond' : organization.tier === 'Premium' ? 'star' : 'business'}
                      size={12}
                      color={organization.tier === 'Elite' ? '#8B5CF6' : organization.tier === 'Premium' ? '#F59E0B' : colors.gray500}
                    />
                    <Text style={[
                      styles.badgeText,
                      { color: organization.tier === 'Elite' ? '#8B5CF6' : organization.tier === 'Premium' ? '#F59E0B' : colors.gray500 }
                    ]}>
                      {organization.tier}
                    </Text>
                  </View>
                )}

              {/* Quick Links */}
              <View style={styles.quickLinksRow}>
                {organization.website && (
                  <TouchableOpacity 
                    style={styles.quickLinkBtn}
                    onPress={() => openURL(organization.website)}
                  >
                    <Ionicons name="globe-outline" size={16} color={colors.primary} />
                    <Text style={styles.quickLinkText}>Visit Website</Text>
                  </TouchableOpacity>
                )}
                {organization.linkedIn && (
                  <TouchableOpacity 
                    style={styles.quickLinkBtn}
                    onPress={() => openURL(organization.linkedIn)}
                  >
                    <Ionicons name="logo-linkedin" size={16} color={colors.primary} />
                    <Text style={styles.quickLinkText}>LinkedIn Profile</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Recent Jobs Section */}
        {!loadingJobs && recentJobs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Recent Jobs ({recentJobs.length})</Text>
              </View>
              {recentJobs.length >= 5 && (
                <TouchableOpacity onPress={() => navigation.navigate('Jobs', { organizationId: organization.id })}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.sectionSubtitle}>Posted in last 24 hours</Text>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.jobsScrollContent}
            >
              {recentJobs.map((job, index) => (
                <TouchableOpacity
                  key={job.JobID || index}
                  style={styles.jobCard}
                  onPress={() => navigation.navigate('JobDetails', { jobId: job.JobID })}
                >
                  <Text style={styles.jobTitle} numberOfLines={2}>{job.Title}</Text>
                  <Text style={styles.jobLocation} numberOfLines={1}>{job.Location}</Text>
                  <View style={styles.jobMeta}>
                    <View style={styles.jobTypeTag}>
                      <Text style={styles.jobTypeText}>{job.JobTypeName}</Text>
                    </View>
                    <Text style={styles.jobDate}>{formatDate(job)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {loadingJobs && (
          <View style={styles.section}>
            <View style={styles.loadingJobsContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingJobsText}>Loading recent jobs...</Text>
            </View>
          </View>
        )}

        {/* About Section */}
        {organization.description && !organization.description.includes('Auto-created') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.card}>
              <Text style={styles.description}>{organization.description}</Text>
            </View>
          </View>
        )}

        {/* Company Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company Information</Text>
          <View style={styles.card}>
            {organization.industry && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="business-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Industry</Text>
                  <Text style={styles.infoValue}>{organization.industry}</Text>
                </View>
              </View>
            )}
            
            {organization.size && organization.size !== 'Unknown' && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="people-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Company Size</Text>
                  <Text style={styles.infoValue}>{organization.size}</Text>
                </View>
              </View>
            )}
            
            {organization.location && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="location-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Location</Text>
                  <Text style={styles.infoValue}>{organization.location}</Text>
                </View>
              </View>
            )}
            
            {organization.foundedYear && (
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Founded</Text>
                  <Text style={styles.infoValue}>{organization.foundedYear}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              navigation.navigate('AskReferral', { 
                preSelectedOrganization: {
                  id: organization.id,
                  name: organization.name,
                  industry: organization.industry,
                  logoURL: organization.logoURL,
                  tier: organization.tier || 'Standard'
                }
              });
            }}
          >
            <Ionicons name="people" size={20} color={colors.white} />
            <Text style={styles.actionButtonText}>Ask for Referral</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        {(organization.createdAt || organization.updatedAt) && (
          <View style={styles.footer}>
            {organization.createdAt && (
              <Text style={styles.footerText}>
                Added: {new Date(organization.createdAt).toLocaleDateString()}
              </Text>
            )}
            {organization.updatedAt && (
              <Text style={styles.footerText}>
                Updated: {new Date(organization.updatedAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
    </View>
  );
}

const createStyles = (colors, responsive = {}) => {
  const { isMobile = true, isDesktop = false, isTablet = false } = responsive;
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: isDesktop ? 'center' : 'stretch',
      paddingBottom: 40,
    },
    innerContainer: {
      width: '100%',
      maxWidth: isDesktop ? 900 : '100%',
      paddingHorizontal: isMobile ? 0 : 24,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 14,
      color: colors.textSecondary,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    errorText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: '600',
    },
    
    // Header Card
    headerCard: {
      backgroundColor: colors.surface,
      padding: isMobile ? 16 : 24,
      marginBottom: 16,
      ...(isMobile ? {} : {
        borderRadius: 16,
        marginTop: 16,
      }),
    },
    companyHeaderRow: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'center' : 'flex-start',
    },
    logoContainer: {
      width: isMobile ? 100 : 120,
      height: isMobile ? 100 : 120,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: isMobile ? 16 : 0,
      marginRight: isMobile ? 0 : 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    logo: {
      width: isMobile ? 80 : 100,
      height: isMobile ? 80 : 100,
      borderRadius: 12,
    },
    logoPlaceholder: {
      width: isMobile ? 80 : 100,
      height: isMobile ? 80 : 100,
      borderRadius: 12,
      backgroundColor: colors.gray100,
      justifyContent: 'center',
      alignItems: 'center',
    },
    companyInfo: {
      flex: 1,
      alignItems: isMobile ? 'center' : 'flex-start',
    },
    companyName: {
      fontSize: isMobile ? 22 : 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textAlign: isMobile ? 'center' : 'left',
    },
    badgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: isMobile ? 'center' : 'flex-start',
      gap: 8,
      marginBottom: 16,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 4,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    fortune500Badge: {
      backgroundColor: '#FFD70020',
      borderWidth: 1,
      borderColor: '#FFD700',
    },
    fortune500Text: {
      fontSize: 12,
      fontWeight: '700',
      color: '#B8860B',
    },
    quickLinksRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: isMobile ? 'center' : 'flex-start',
      gap: 12,
    },
    quickLinkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary + '10',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 6,
    },
    quickLinkText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
    },
    
    // Sections
    section: {
      marginBottom: 20,
      paddingHorizontal: isMobile ? 16 : 0,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    sectionSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    seeAllText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    
    // Cards
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
    },
    
    // Info Rows
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    infoIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    infoContent: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    
    // Jobs
    jobsScrollContent: {
      paddingRight: 16,
    },
    jobCard: {
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      marginRight: 12,
      width: 260,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
    },
    jobTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
      lineHeight: 20,
    },
    jobLocation: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    jobMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    jobTypeTag: {
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    jobTypeText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '600',
    },
    jobDate: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    loadingJobsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: colors.surface,
      borderRadius: 12,
    },
    loadingJobsText: {
      marginLeft: 12,
      fontSize: 14,
      color: colors.textSecondary,
    },
    
    // Description
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    
    // Action Section
    actionSection: {
      paddingHorizontal: isMobile ? 16 : 0,
      marginTop: 8,
      marginBottom: 24,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      gap: 8,
    },
    actionButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    
    // Footer
    footer: {
      paddingTop: 16,
      paddingHorizontal: isMobile ? 16 : 0,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'center',
      gap: 4,
    },
    footerText: {
      fontSize: 12,
      color: colors.gray500,
    },
  });
};
