import React, { useState, useEffect } from 'react';
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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import refopenAPI from '../../services/api';
import { colors, typography } from '../../styles/theme';

export default function OrganizationDetailsScreen({ route, navigation }) {
// ? Handle both route params and URL query params (for web deep linking)
const getOrganizationId = () => {
  // First try route.params
  if (route.params?.organizationId) {
    return route.params.organizationId;
  }
    
  // For web, check URL query parameters
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const queryOrgId = urlParams.get('organizationId');
    if (queryOrgId) {
      return queryOrgId;
    }
  }
    
  return null;
};
  
const organizationId = getOrganizationId();
const [loading, setLoading] = useState(true);
const [organization, setOrganization] = useState(null);
const [error, setError] = useState(null);

  // ? Navigation header with smart back button
  useEffect(() => {
    navigation.setOptions({
      title: 'Company Details',
      headerStyle: { 
        backgroundColor: colors.surface, 
        elevation: 0, 
        shadowOpacity: 0, 
        borderBottomWidth: 1, 
        borderBottomColor: colors.border 
      },
      headerTitleStyle: { 
        fontSize: typography.sizes.lg, 
        fontWeight: typography.weights.bold, 
        color: colors.text 
      },
      headerLeft: () => (
        <TouchableOpacity 
          style={styles.headerButton} 
          onPress={() => {
            // ? Smart back navigation - check if we have meaningful navigation history
            const navState = navigation.getState();
            const routes = navState?.routes || [];
            const currentIndex = navState?.index || 0;
            
            // If we have more than 1 route in the stack, go back normally
            // This handles: Jobs -> OrganizationDetails (back should go to Jobs)
            if (routes.length > 1 && currentIndex > 0) {
              console.log('? Going back normally - have navigation history');
              navigation.goBack();
            } else {
              // Hard refresh scenario - navigate to Home tab
              console.log('?? Hard refresh detected - navigating to Home');
              navigation.navigate('Main', {
                screen: 'MainTabs',
                params: {
                  screen: 'Home'
                }
              });
            }
          }} 
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

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
      } else {
        setError(result.error || 'Failed to load organization details');
      }
    } catch (err) {
      console.error('Error loading organization details:', err);
      setError(err.message || 'An error occurred while loading organization details');
    } finally {
      setLoading(false);
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
      Alert.alert('Error', 'Unable to open link');
    }
  };

  const InfoRow = ({ icon, label, value, onPress, isLink = false }) => {
    if (!value) return null;

    const content = (
      <View style={styles.infoRow}>
        <View style={styles.infoIconContainer}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.infoContent}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={[styles.infoValue, isLink && styles.infoValueLink]}>
            {value}
          </Text>
        </View>
        {isLink && (
          <Ionicons name="open-outline" size={18} color={colors.primary} />
        )}
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          {content}
        </TouchableOpacity>
      );
    }

    return content;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading organization details...</Text>
      </View>
    );
  }

  if (error || !organization) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="business-outline" size={64} color={colors.gray400} />
        <Text style={styles.errorTitle}>Unable to Load</Text>
        <Text style={styles.errorText}>{error || 'Organization not found'}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={loadOrganizationDetails}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerBackground} />
        
        {/* Logo Container */}
        <View style={styles.logoContainer}>
          {organization.logoURL ? (
            <Image 
              source={{ uri: organization.logoURL }} 
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Ionicons name="business" size={48} color={colors.gray400} />
            </View>
          )}
        </View>

        {/* Company Name and Verification */}
        <View style={styles.headerInfo}>
          <Text style={styles.companyName}>{organization.name}</Text>
          
          {console.log('Organization Data:', {
            verification: organization.verification,
            isFortune500: organization.isFortune500,
            isFortune500Type: typeof organization.isFortune500,
            allData: organization
          })}
          
          {organization.verification ? (
            <View style={styles.verificationBadge}>
              <Ionicons 
                name={organization.verification === 'Verified' ? 'checkmark-circle' : 'shield-outline'} 
                size={16} 
                color={organization.verification === 'Verified' ? colors.success : colors.warning} 
              />
              <Text style={[
                styles.verificationText,
                organization.verification === 'Verified' ? styles.verifiedText : styles.unverifiedText
              ]}>
                {organization.verification}
              </Text>
            </View>
          ) : null}

          {(organization.isFortune500 === true || organization.isFortune500 === 1) ? (
            <View style={styles.fortune500Badge}>
              <Ionicons name="trophy" size={16} color="#FFD700" />
              <Text style={styles.fortune500Text}>Fortune 500</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Description Section */}
        {organization.description && !organization.description.includes('Auto-created') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{organization.description}</Text>
          </View>
        )}

        {/* Quick Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company Information</Text>
          
          <InfoRow 
            icon="business-outline"
            label="Industry"
            value={organization.industry}
          />
          
          {organization.size && organization.size !== 'Unknown' && (
            <InfoRow 
              icon="people-outline"
              label="Company Size"
              value={organization.size}
            />
          )}
          
          {organization.location && (
            <InfoRow 
              icon="location-outline"
              label="Location"
              value={organization.location}
            />
          )}
          
          {organization.foundedYear && (
            <InfoRow 
              icon="calendar-outline"
              label="Founded"
              value={organization.foundedYear}
            />
          )}
        </View>

        {/* Links Section */}
        {(organization.website || organization.linkedIn) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connect</Text>
            
            {organization.website && (
              <InfoRow 
                icon="globe-outline"
                label="Website"
                value={organization.website}
                isLink={true}
                onPress={() => openURL(organization.website)}
              />
            )}
            
            {organization.linkedIn && (
              <InfoRow 
                icon="logo-linkedin"
                label="LinkedIn"
                value="View LinkedIn Profile"
                isLink={true}
                onPress={() => openURL(organization.linkedIn)}
              />
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              // Navigate to jobs list filtered by this organization
              navigation.navigate('Jobs', { organizationId: organization.id });
            }}
          >
            <Ionicons name="briefcase" size={20} color={colors.white} />
            <Text style={styles.actionButtonText}>View Open Positions</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Info */}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  errorTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
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
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  header: {
    position: 'relative',
    paddingBottom: 24,
    backgroundColor: colors.surface,
  },
  headerBackground: {
    height: 120,
    backgroundColor: colors.primary + '15',
  },
  logoContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    marginTop: 60,
    paddingLeft: 140,
    paddingRight: 20,
  },
  companyName: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.success + '15',
    marginBottom: 8,
  },
  verificationText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginLeft: 4,
  },
  verifiedText: {
    color: colors.success,
  },
  unverifiedText: {
    color: colors.warning,
  },
  fortune500Badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFD70020',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  fortune500Text: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#B8860B',
    marginLeft: 4,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 16,
  },
  description: {
    fontSize: typography.sizes.md,
    color: colors.gray700,
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 8,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.sizes.xs,
    color: colors.gray600,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  infoValueLink: {
    color: colors.primary,
  },
  actionSection: {
    marginTop: 16,
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginLeft: 8,
  },
  footer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    marginBottom: 4,
  },
  headerButton: {
    padding: 8,
  },
});
