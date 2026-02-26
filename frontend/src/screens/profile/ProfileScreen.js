import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Image,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { typography } from '../../styles/theme';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import refopenAPI from '../../services/api';
import UserProfileHeader from '../../components/profile/UserProfileHeader';
import ComplianceFooter from '../../components/ComplianceFooter';
import ReferralPointsBreakdown from '../../components/profile/ReferralPointsBreakdown';
import SkillsSelectionModal from '../../components/profile/SkillsSelectionModal';
import AddWorkExperienceModal from '../../components/profile/AddWorkExperienceModal';
import VerifiedReferrerOverlay from '../../components/VerifiedReferrerOverlay';
import useResponsive from '../../hooks/useResponsive';
import { ResponsiveContainer } from '../../components/common/ResponsiveLayout';
import { showToast } from '../../components/Toast';
import ModalToast from '../../components/ModalToast';

// Education level options
const EDUCATION_LEVELS = [
  'High School',
  'Diploma',
  'B.Tech / B.E',
  'B.Sc',
  'B.A',
  'B.Com',
  'BBA',
  'B.Arch',
  'MBBS',
  'M.Tech / M.E',
  'M.Sc',
  'M.A',
  'M.Com',
  'MBA',
  'M.Arch',
  'PhD/Doctorate',
  'Other'
];

export default function ProfileScreen({ navigation, route }) {
  const { user, userType, logout, updateProfileSmart, refreshVerificationStatus, currentWork } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { isMobile, isDesktop, isTablet } = responsive;
  const styles = React.useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // On web refresh via /profile deep link, ensure MainTabs is in the stack behind this screen
  React.useEffect(() => {
    if (Platform.OS === 'web' && !navigation.canGoBack()) {
      navigation.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          { name: 'Profile' },
        ],
      });
    }
  }, []);
  
  const [loading, setLoading] = useState(false);
  const [loadingSections, setLoadingSections] = useState(true); // Loading state for work exp, education sections
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  
  // Wallet state
  const [walletBalance, setWalletBalance] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  
  // Referral Points state
  const [referralPointsData, setReferralPointsData] = useState({
    totalPoints: 0,
    pointsHistory: [],
    pointTypeMetadata: {},
    referralStats: {
      totalReferralsMade: 0,
      verifiedReferrals: 0,
      referralRequestsMade: 0,
      totalPointsFromRewards: 0
    }
  });
  const [loadingReferralPoints, setLoadingReferralPoints] = useState(false);
  const [showReferralBreakdown, setShowReferralBreakdown] = useState(false);
  
  // User-level verification status
  const [isVerifiedReferrer, setIsVerifiedReferrer] = useState(false); // Temporary - for referral access
  const [isVerifiedUser, setIsVerifiedUser] = useState(false); // Permanent - for blue tick
  const [loadingVerificationStatus, setLoadingVerificationStatus] = useState(true);
  
  // Become Verified Referrer modals state
  const [showConfirmCompanyModal, setShowConfirmCompanyModal] = useState(false);
  const [showAddWorkModal, setShowAddWorkModal] = useState(false);
  const [showVerifiedOverlay, setShowVerifiedOverlay] = useState(false);
  const [currentWorkExperience, setCurrentWorkExperience] = useState(null);
  const [workExperiencesForVerify, setWorkExperiencesForVerify] = useState([]);
  const [verifiedCompanyName, setVerifiedCompanyName] = useState('');
  const [navigatingToVerify, setNavigatingToVerify] = useState(false);
  
  // Referral code (first part of UserID before dash)
  const referralCode = user?.UserID?.split('-')[0] || '';
  
  // Scroll refs
  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Profile state matching old structure
  const [profile, setProfile] = useState({
    userID: user?.UserID || '',
    firstName: user?.FirstName || '',
    lastName: user?.LastName || '',
    email: user?.Email || '',
    phone: user?.Phone || '',
    userType: user?.UserType || '',
    dateOfBirth: user?.DateOfBirth ? new Date(user.DateOfBirth).toISOString().split('T')[0] : '',
    gender: user?.Gender || '',
    profilePictureURL: user?.ProfilePictureURL || '',
    profileVisibility: user?.ProfileVisibility || 'Public',
    profileCompleteness: 0,
  });

  const [jobSeekerProfile, setJobSeekerProfile] = useState({
    nationality: '',
    currentLocation: '',
    preferredLocations: '',
    linkedInProfile: '',
    githubProfile: '',
    resumes: [],
    workExperiences: [],
    additionalDocuments: '',
    highestEducation: '',
    fieldOfStudy: '',
    institution: '',
    graduationYear: '',
    gpa: '',
    headline: '',
    summary: '',
    currentJobTitle: '',
    currentCompany: '',
    yearsOfExperience: 0,
    salaryBreakdown: { current: [], expected: [] },
    isOpenToWork: false,
    openToRefer: false,
    preferredJobTypes: '',
    preferredRoles: '',
    preferredCompanySize: '',
    skills: { primary: [], secondary: [] },
    // Privacy Settings
    allowRecruitersToContact: true,
    hideCurrentCompany: false,
    hideSalaryDetails: false,
    // Profile completeness from backend
    profileCompleteness: 0,
  });

  // Load profile on focus and scroll to top
  useFocusEffect(
    useCallback(() => {
      // Scroll to top when screen is focused
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      
      loadExtendedProfile();
      loadWallet();
      if (userType === 'JobSeeker') {
        loadReferralPoints();
      }
    }, [])
  );

  // Handle openShareModal route param (from Wallet "Get Free Credits" button)
  useEffect(() => {
    if (route?.params?.openShareModal) {
      navigation.setParams({ openShareModal: undefined });
      navigation.navigate('ShareEarn');
    }
  }, [route?.params?.openShareModal]);

  // 🎯 Handler for "Get Verified" button — navigates to GetVerified screen
  const handleBecomeVerifiedReferrer = useCallback(() => {
    navigation.navigate('GetVerified');
  }, [navigation]);
  
  const loadExtendedProfile = async () => {
    try {
      setLoading(true);
      setLoadingSections(true);
      
      // Use the same API as old ProfileScreen - getApplicantProfile includes salary and resumes
      const response = userType === 'JobSeeker' 
        ? await refopenAPI.getApplicantProfile(user?.UserID)
        : await refopenAPI.getProfile();
      
      if (response.success && response.data) {
        const data = response.data;
        
        // Update basic profile
        setProfile(prev => ({
          ...prev,
          firstName: data.FirstName || data.firstName || prev.firstName,
          lastName: data.LastName || data.lastName || prev.lastName,
          email: data.Email || data.email || prev.email,
          phone: data.Phone || data.phone || prev.phone,
          profilePictureURL: data.ProfilePictureURL || data.profilePictureURL || prev.profilePictureURL,
          profileVisibility: data.ProfileVisibility || data.profileVisibility || prev.profileVisibility,
          profileCompleteness: data.ProfileCompleteness || data.profileCompleteness || 0,
        }));

        // Update job seeker profile
        if (userType === 'JobSeeker') {
          const salaryData = data.salaryBreakdown || { current: [], expected: [] };
          const resumeData = data.resumes || [];
          const workExpData = data.workExperiences || [];
          
          setJobSeekerProfile(prev => ({
            ...prev,
            linkedInProfile: data.LinkedInProfile || data.linkedInProfile || prev.linkedInProfile,
            githubProfile: data.GithubProfile || data.githubProfile || prev.githubProfile,
            currentLocation: data.CurrentLocation || data.currentLocation || prev.currentLocation,
            headline: data.Headline || data.headline || prev.headline,
            summary: data.Summary || data.summary || prev.summary,
            currentJobTitle: data.CurrentJobTitle || data.currentJobTitle || prev.currentJobTitle,
            currentCompany: data.CurrentCompanyName || data.CurrentCompany || data.currentCompany || prev.currentCompany,
            yearsOfExperience: data.YearsOfExperience || data.yearsOfExperience || prev.yearsOfExperience,
            highestEducation: data.HighestEducation || data.highestEducation || prev.highestEducation,
            fieldOfStudy: data.FieldOfStudy || data.fieldOfStudy || prev.fieldOfStudy,
            institution: data.Institution || data.institution || prev.institution,
            graduationYear: data.GraduationYear || data.graduationYear || prev.graduationYear,
            gpa: data.GPA || data.gpa || prev.gpa,
            isOpenToWork: data.IsOpenToWork !== false,
            openToRefer: data.OpenToRefer !== false,
            preferredJobTypes: data.PreferredJobTypes || data.preferredJobTypes || prev.preferredJobTypes,
            preferredRoles: data.PreferredRoles || data.preferredRoles || prev.preferredRoles,
            preferredLocations: data.PreferredLocations || data.preferredLocations || prev.preferredLocations,
            preferredCompanySize: data.PreferredCompanySize || data.preferredCompanySize || prev.preferredCompanySize,
            salaryBreakdown: salaryData,
            resumes: resumeData,
            workExperiences: workExpData,
            skills: {
              primary: data.PrimarySkills ? data.PrimarySkills.split(',').map(s => s.trim()).filter(Boolean) : [],
              secondary: data.SecondarySkills ? data.SecondarySkills.split(',').map(s => s.trim()).filter(Boolean) : [],
            },
            // Privacy Settings
            allowRecruitersToContact: data.AllowRecruitersToContact !== false,
            hideCurrentCompany: data.HideCurrentCompany === true,
            hideSalaryDetails: data.HideSalaryDetails === true,
            // Profile completeness from backend
            profileCompleteness: data.ProfileCompleteness || data.profileCompleteness || 0,
          }));
          
          // Save referralStats from profile for the breakdown modal
          if (data.referralStats) {
            setReferralPointsData(prev => ({
              ...prev,
              referralStats: data.referralStats
            }));
          }
          
          // Fetch user-level verification status
          try {
            const verifyRes = await refopenAPI.getVerificationStatus();
            if (verifyRes.success) {
              // isVerifiedUser = permanent, for blue tick badge
              setIsVerifiedUser(verifyRes.data?.isVerifiedUser || false);
              // isVerifiedReferrer = temporary, for referral access
              setIsVerifiedReferrer(verifyRes.data?.isVerifiedReferrer || false);
            }
          } catch (verifyError) {
            console.warn('Could not load verification status:', verifyError);
          } finally {
            setLoadingVerificationStatus(false);
          }
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
      setLoadingSections(false);
    }
  };

  const loadWallet = async () => {
    try {
      setLoadingWallet(true);
      const response = await refopenAPI.getWalletBalance();
      if (response.success) {
        setWalletBalance(response.data);
      }
    } catch (error) {
      console.error('Error loading wallet:', error);
    } finally {
      setLoadingWallet(false);
    }
  };

  const loadReferralPoints = async () => {
    try {
      setLoadingReferralPoints(true);
      const response = await refopenAPI.getReferralPointsHistory();
      if (response.success && response.data) {
        setReferralPointsData(prev => ({
          ...prev, // Preserve existing referralStats
          totalPoints: response.data.totalPoints || 0,
          pointsHistory: response.data.history || [],
          pointTypeMetadata: response.data.pointTypeMetadata || {}
        }));
      }
    } catch (error) {
      console.error('Error loading referral points:', error);
    } finally {
      setLoadingReferralPoints(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadExtendedProfile();
    await loadWallet();
    if (userType === 'JobSeeker') {
      await loadReferralPoints();
    }
    setRefreshing(false);
  }, []);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  // Section Cards
  const renderSectionCard = (title, icon, onPress, summary) => (
    <TouchableOpacity 
      style={styles.sectionCard} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {summary && <Text style={styles.sectionSummary}>{summary}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const renderToggleCard = (title, icon, value, onValueChange, summary) => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {summary && <Text style={styles.sectionSummary}>{summary}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.gray300, true: colors.primaryLight }}
        thumbColor={value ? colors.primary : colors.gray100}
      />
    </View>
  );

  // Save handlers
  const handleSkillsSave = async (skillsData) => {
    try {
      const payload = {
        primarySkills: skillsData.primarySkills,
        secondarySkills: skillsData.secondarySkills,
      };

      const response = await refopenAPI.updateApplicantProfile(user?.UserID, payload);
      
      if (response.success) {
        // Update local state - split strings back into arrays
        setJobSeekerProfile(prev => ({
          ...prev,
          skills: {
            primary: skillsData.primarySkills.split(',').map(s => s.trim()).filter(Boolean),
            secondary: skillsData.secondarySkills.split(',').map(s => s.trim()).filter(Boolean),
          },
        }));
        showToast('Skills updated successfully', 'success');
      } else {
        showToast('Failed to update skills. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error saving skills:', error);
      showToast('Failed to update skills. Please try again.', 'error');
    }
  };


  if (loading && !profile.firstName) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sticky Header */}
      <SubScreenHeader
        title="Profile"
        fallbackTab="Home"
        rightContent={
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
            style={styles.headerIconButton}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text || '#000'} />
          </TouchableOpacity>
        }
      />

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ResponsiveContainer style={styles.profileContent}>
        {/* User Profile Header */}
        {/* Check if current work experience is verified (not just user-level verification) */}
        {(() => {
          const currentWorkExp = jobSeekerProfile.workExperiences?.find(exp => exp.IsCurrent === 1 || exp.IsCurrent === true);
          const isCurrentJobVerified = currentWorkExp ? (currentWorkExp.CompanyEmailVerified === 1 || currentWorkExp.CompanyEmailVerified === true) : false;
          
          // Use backend-driven profileCompleteness for both JobSeekers and Employers
          const completenessValue = jobSeekerProfile.profileCompleteness || profile.profileCompleteness || 0;
          
          return (
            <UserProfileHeader
              user={user}
              profile={profile}
              jobSeekerProfile={jobSeekerProfile}
              userType={userType}
              onProfileUpdate={(updatedProfile) => {
                setProfile(prev => ({ ...prev, ...updatedProfile }));
                loadExtendedProfile();
              }}
              showStats={false}
              isVerifiedUser={isVerifiedUser}
              isVerifiedReferrer={isVerifiedReferrer}
              currentWorkLogo={currentWork?.LogoURL || currentWork?.logoURL}
              currentWorkCompany={currentWork?.CompanyName || currentWork?.companyName || currentWork?.OrganizationName}
              onBecomeVerifiedReferrer={handleBecomeVerifiedReferrer}
              isLoadingVerify={navigatingToVerify}
              loadingVerificationStatus={loadingVerificationStatus}
              profileCompletenessFromBackend={completenessValue}
            />
          );
        })()}

        {/* Wallet, Referral Points, and Invite & Earn Buttons */}
        {(userType === 'JobSeeker' || userType === 'Employer') && (
          <View style={styles.actionButtonsContainer}>
            {/* Wallet Button */}
            <TouchableOpacity 
              style={styles.actionButtonThird}
              onPress={() => navigation.navigate('Wallet')}
              activeOpacity={0.7}
            >
              <View style={styles.actionButtonIcon}>
                <Ionicons name="wallet" size={20} color={colors.primary} />
              </View>
              <View style={styles.actionButtonContent}>
                <Text style={styles.actionButtonLabel}>Wallet</Text>
              </View>
            </TouchableOpacity>

            {userType === 'JobSeeker' && (
              <>
                {/* Referral Points Button */}
                <TouchableOpacity 
                  style={styles.actionButtonThird}
                  onPress={() => setShowReferralBreakdown(true)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionButtonIcon, { backgroundColor: '#FFF4E6' }]}>
                    <Ionicons name="gift" size={20} color="#FF9500" />
                  </View>
                  <View style={styles.actionButtonContent}>
                    <Text style={styles.actionButtonLabel}>Earnings</Text>
                  </View>
                </TouchableOpacity>

                {/* Share & Earn Button */}
                <TouchableOpacity 
                  style={styles.actionButtonThird}
                  onPress={() => navigation.navigate('ShareEarn')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionButtonIcon, { backgroundColor: '#E8F5E9' }]}>
                    <Ionicons name="share-social" size={20} color="#4CAF50" />
                  </View>
                  <View style={styles.actionButtonContent}>
                    <Text style={styles.actionButtonLabel}>Share</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Loading Skeleton for Sections */}
        {loadingSections && userType === 'JobSeeker' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.skeletonIcon, { backgroundColor: colors.gray200 }]} />
              <View style={[styles.skeletonText, { width: 150, backgroundColor: colors.gray200 }]} />
            </View>
            <View style={styles.workExperienceList}>
              {[1, 2].map((_, index) => (
                <View key={index} style={styles.workExpCard}>
                  <View style={[styles.workExpIcon, { backgroundColor: colors.gray200 }]} />
                  <View style={styles.workExpDetails}>
                    <View style={[styles.skeletonText, { width: '70%', marginBottom: 8, backgroundColor: colors.gray200 }]} />
                    <View style={[styles.skeletonText, { width: '50%', marginBottom: 6, backgroundColor: colors.gray200 }]} />
                    <View style={[styles.skeletonText, { width: '40%', backgroundColor: colors.gray200 }]} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* About Section - Always visible */}
        {!loadingSections && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionHeading}>About</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Settings', { openModal: 'professional' })} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {jobSeekerProfile.summary ? (
              <Text style={styles.aboutText}>{jobSeekerProfile.summary}</Text>
            ) : (
              <TouchableOpacity style={styles.emptySectionCta} onPress={() => navigation.navigate('Settings', { openModal: 'professional' })} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.emptySectionCtaText}>Add a summary to tell others about yourself</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Work Experience Section - View Mode */}
        {!loadingSections && jobSeekerProfile.workExperiences && jobSeekerProfile.workExperiences.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="briefcase-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionHeading}>Work Experience</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Settings', { openModal: 'professional' })} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.workExperienceList}>
              {jobSeekerProfile.workExperiences.map((exp, index) => {
                // Always use work experience level CompanyEmailVerified for showing verification badge
                // The user's overall IsVerifiedReferrer status is separate from individual work experience verification
                const isExpVerified = exp.CompanyEmailVerified === 1 || exp.CompanyEmailVerified === true;
                
                return (
                  <View key={exp.WorkExperienceID || index} style={styles.workExpCard}>
                    <View style={styles.workExpIcon}>
                      {exp.OrganizationLogo ? (
                        <Image 
                          source={{ uri: exp.OrganizationLogo }} 
                          style={{ width: 36, height: 36, borderRadius: 6 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Ionicons name="business" size={20} color={colors.primary} />
                      )}
                    </View>
                    <View style={styles.workExpDetails}>
                      <View style={styles.workExpHeader}>
                        <Text style={styles.workExpTitle}>{exp.JobTitle}</Text>
                        {exp.IsCurrent && (
                          <View style={styles.currentBadge}>
                            <Text style={styles.currentBadgeText}>Current</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.workExpCompany}>{exp.CompanyName || exp.OrganizationName}</Text>
                        {isExpVerified && (
                          <View style={{ backgroundColor: '#ECFDF5', padding: 4, borderRadius: 10 }}>
                            <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                          </View>
                        )}
                      </View>
                      <View style={styles.workExpMeta}>
                        {exp.Location && (
                          <View style={styles.workExpMetaItem}>
                            <Ionicons name="location-outline" size={12} color={colors.gray500} />
                            <Text style={styles.workExpMetaText}>{exp.Location}</Text>
                          </View>
                        )}
                        <View style={styles.workExpMetaItem}>
                          <Ionicons name="calendar-outline" size={12} color={colors.gray500} />
                          <Text style={styles.workExpMetaText}>
                            {exp.StartDate ? new Date(exp.StartDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''} - 
                            {exp.IsCurrent ? 'Present' : (exp.EndDate ? new Date(exp.EndDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Education Section - Always visible */}
        {!loadingSections && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="school-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionHeading}>Education</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Settings', { openModal: 'education' })} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {jobSeekerProfile.highestEducation ? (
              <View style={styles.educationCard}>
                <View style={styles.educationIcon}>
                  <Ionicons name="ribbon-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.educationDetails}>
                  <Text style={styles.educationDegree}>{jobSeekerProfile.highestEducation}</Text>
                  {jobSeekerProfile.fieldOfStudy && (
                    <Text style={styles.educationField}>{jobSeekerProfile.fieldOfStudy}</Text>
                  )}
                  {jobSeekerProfile.institution && (
                    <Text style={styles.educationInstitution}>{jobSeekerProfile.institution}</Text>
                  )}
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.emptySectionCta} onPress={() => navigation.navigate('Settings', { openModal: 'education' })} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.emptySectionCtaText}>Add your education details</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Skills Section - Always visible */}
        {!loadingSections && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="code-slash-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionHeading}>Skills</Text>
              <TouchableOpacity onPress={() => setShowSkillsModal(true)} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {(jobSeekerProfile.skills.primary?.length > 0 || jobSeekerProfile.skills.secondary?.length > 0) ? (
              <View style={styles.skillsContainer}>
                {[...(jobSeekerProfile.skills.primary || []), ...(jobSeekerProfile.skills.secondary || [])].map((skill, index) => (
                  <View key={index} style={styles.skillChip}>
                    <Text style={styles.skillChipText}>{skill}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <TouchableOpacity style={styles.emptySectionCta} onPress={() => setShowSkillsModal(true)} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.emptySectionCtaText}>Add your skills to stand out</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* My Activity Section */}
        {userType === 'JobSeeker' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="pulse-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionHeading}>My Activity</Text>
            </View>

            <TouchableOpacity 
              style={styles.activityCard}
              onPress={() => navigation.navigate('MyReferralRequests')}
              activeOpacity={0.7}
            >
              <View style={styles.activityIcon}>
                <Ionicons name="people-circle-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>My Referral Requests</Text>
                <Text style={styles.activitySummary}>See referrals you have asked for</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.activityCard}
              onPress={() => navigation.navigate('Applications')}
              activeOpacity={0.7}
            >
              <View style={styles.activityIcon}>
                <Ionicons name="clipboard-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>My Applications</Text>
                <Text style={styles.activitySummary}>Track jobs you have applied to</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.activityCard}
              onPress={() => navigation.navigate('SavedJobs')}
              activeOpacity={0.7}
            >
              <View style={styles.activityIcon}>
                <Ionicons name="bookmark-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>My Saved Jobs</Text>
                <Text style={styles.activitySummary}>View and manage saved jobs</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
            </TouchableOpacity>
          </View>
        )}

        {/* Compliance Footer */}
        <ComplianceFooter navigation={navigation} />
        </ResponsiveContainer>
      </Animated.ScrollView>

      {/* Modals */}

      {/* Referral Points Breakdown Modal */}
      <ReferralPointsBreakdown
        visible={showReferralBreakdown}
        onClose={() => setShowReferralBreakdown(false)}
        totalPoints={referralPointsData.totalPoints}
        pointsHistory={referralPointsData.pointsHistory}
        pointTypeMetadata={referralPointsData.pointTypeMetadata}
        referralStats={referralPointsData.referralStats}
        navigation={navigation}
        onConversionSuccess={async () => {
          // Refresh wallet and points data after successful conversion
          await loadWallet();
          await loadReferralPoints();
        }}
      />

      {/* Skills Selection Modal */}
      <SkillsSelectionModal
        visible={showSkillsModal}
        onClose={() => setShowSkillsModal(false)}
        onSave={handleSkillsSave}
        initialPrimarySkills={jobSeekerProfile.skills.primary}
        initialSecondarySkills={jobSeekerProfile.skills.secondary}
        title="Manage Your Skills"
      />

      {/* Confirm Current Company Modal */}
      <Modal
        visible={showConfirmCompanyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmCompanyModal(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalCard}>
            <Ionicons name="briefcase" size={40} color={colors.primary} />
            <Text style={styles.confirmModalTitle}>Verify Your Employment</Text>
            <Text style={styles.confirmModalMessage}>
              Is <Text style={{ fontWeight: '700' }}>{currentWorkExperience?.CompanyName}</Text> your current company?
            </Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalButtonSecondary]}
                onPress={() => {
                  setShowConfirmCompanyModal(false);
                  setCurrentWorkExperience(null);
                  setShowAddWorkModal(true);
                }}
              >
                <Text style={styles.confirmModalButtonSecondaryText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalButtonPrimary]}
                onPress={() => {
                  setShowConfirmCompanyModal(false);
                  setShowAddWorkModal(true);
                }}
              >
                <Text style={styles.confirmModalButtonPrimaryText}>Yes, Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Work Experience Modal for Verification */}
      <AddWorkExperienceModal
        visible={showAddWorkModal}
        onClose={() => setShowAddWorkModal(false)}
        onSave={async () => {
          // Refresh profile data after saving
          loadExtendedProfile();
        }}
        editingItem={currentWorkExperience}
        existingExperiences={workExperiencesForVerify}
        showVerification={true}
        onVerificationComplete={(companyName) => {
          setVerifiedCompanyName(companyName);
          setShowAddWorkModal(false);
          setShowVerifiedOverlay(true);
          setIsVerifiedReferrer(true);
          setIsVerifiedUser(true); // Permanent blue tick
          // Refresh verification status in AuthContext so other screens see the update
          refreshVerificationStatus();
          // Refresh profile
          loadExtendedProfile();
        }}
      />

      {/* Verified Referrer Celebration Overlay */}
      <VerifiedReferrerOverlay
        visible={showVerifiedOverlay}
        onClose={() => setShowVerifiedOverlay(false)}
        companyName={verifiedCompanyName}
      />
    </View>
  );
}

const createStyles = (colors, responsive = {}) => {
  const { isMobile = true, isDesktop = false, isTablet = false } = responsive;
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || '#F5F5F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background || '#F5F5F7',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
    alignItems: isDesktop ? 'center' : 'stretch',
  },
  profileContent: {
    width: '100%',
    maxWidth: isDesktop ? 900 : '100%',
    paddingHorizontal: isMobile ? 0 : 24,
  },
  // Sticky Header
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface || '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E5E5EA',
    zIndex: 10,
  },
  headerProfilePic: {
    position: 'absolute',
    left: 16,
    top: '50%',
    marginTop: -16,
    zIndex: 20,
  },
  headerProfileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerProfilePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInitials: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  headerSpacer: {
    width: 32,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text || '#000',
  },
  walletHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  walletHeaderAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.surface || colors.white,
    marginTop: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  sectionIndicator: {
    width: 4,
    height: 16,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface || '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
    marginBottom: 2,
  },
  sectionSummary: {
    fontSize: 13,
    color: colors.textSecondary || '#8E8E93',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface || '#FFF',
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 32,
    marginBottom: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error || '#FF3B30',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error || '#FF3B30',
    marginLeft: 8,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background || '#F5F5F7',
    alignItems: responsive.isDesktop ? 'center' : 'stretch',
  },
  modalInnerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: responsive.isDesktop ? 900 : '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 16,
    backgroundColor: colors.surface || '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 24,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  componentWrapper: {
    backgroundColor: colors.surface || '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  subsectionCard: {
    backgroundColor: colors.surface || '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  subsectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subsectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
  },
  subsectionHint: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  subsectionSummary: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text || '#1C1C1E',
    flex: 1,
    textAlign: 'right',
  },
  summaryHint: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  fieldGroup: {
    backgroundColor: colors.surface || '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 6,
  },
  fieldValue: {
    fontSize: 16,
    color: colors.text || '#1C1C1E',
    fontWeight: '500',
  },
  fieldHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    fontStyle: 'italic',
  },
  fieldInput: {
    fontSize: 16,
    color: colors.text || '#1C1C1E',
    backgroundColor: colors.inputBackground || '#F5F5F7',
    borderWidth: 1,
    borderColor: colors.border || '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface || '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    color: colors.text || '#1C1C1E',
    marginLeft: 12,
  },
  toggle: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.border || '#E5E5EA',
  },
  toggleActive: {
    backgroundColor: colors.primary + '20',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
  },
  // Education dropdown styles
  educationOptionsScroll: {
    marginTop: 8,
    marginBottom: 8,
  },
  educationOptions: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
  },
  educationOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.inputBackground || '#F5F5F7',
    borderWidth: 1,
    borderColor: colors.border || '#E5E5EA',
    marginRight: 8,
  },
  educationOptionActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  educationOptionText: {
    fontSize: 14,
    color: colors.text || '#1C1C1E',
    fontWeight: '500',
  },
  educationOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  // Action Buttons (Wallet & Invite)
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
    backgroundColor: colors.surface,
    marginTop: 12,
  },
  actionButtonHalf: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: colors.surface || '#FFF',
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonThird: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: colors.gray100 || colors.background || '#F5F5F7',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface || '#FFF',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionButtonContent: {
    alignItems: 'center',
  },
  actionButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
    marginBottom: 2,
  },
  actionButtonAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  actionButtonSubtext: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '500',
  },
  // Invite & Earn Modal Styles
  inviteIconContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  inviteIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF4E6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  inviteHeading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text || '#1C1C1E',
    textAlign: 'center',
    marginBottom: 4,
  },
  inviteSubheading: {
    fontSize: 14,
    color: colors.gray600 || '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  referralCodeCard: {
    backgroundColor: colors.surface || '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  referralCodeLabel: {
    fontSize: 13,
    color: colors.gray600 || '#666',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  referralCodeBox: {
    backgroundColor: colors.background || '#F5F5F7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.primary + '30',
    borderStyle: 'dashed',
  },
  referralCodeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: 2,
  },
  copyCodeButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  copyCodeButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFF',
  },
  howItWorksSection: {
    marginBottom: 20,
  },
  howItWorksTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text || '#1C1C1E',
    marginBottom: 12,
  },
  howItWorksStep: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.primary,
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 12,
    color: colors.gray600 || '#666',
    lineHeight: 16,
  },
  benefitsSection: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  benefitCard: {
    flex: 1,
    backgroundColor: colors.surface || '#FFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  benefitTitle: {
    fontSize: 12,
    color: colors.gray600 || '#666',
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '500',
  },
  benefitAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.success || '#34C759',
    marginBottom: 2,
  },
  benefitDescription: {
    fontSize: 11,
    color: colors.gray600 || '#666',
    textAlign: 'center',
  },
  shareLinkSection: {
    marginBottom: 16,
  },
  shareLinkTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
    marginBottom: 8,
  },
  shareLinkBox: {
    backgroundColor: colors.background || '#F5F5F7',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border || '#E5E5EA',
  },
  shareLinkText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: 'monospace',
  },
  // Social Share Rewards Styles
  socialShareSection: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#E5E5EA',
  },
  socialPlatformCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface || '#FFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderLeftWidth: 4,
  },
  socialIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  socialPlatformName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
  },
  socialPlatformDesc: {
    fontSize: 12,
    color: colors.textSecondary || '#8E8E93',
    marginTop: 2,
  },
  socialRewardBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  socialRewardText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  socialNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.background || '#F5F5F7',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  socialNoteText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary || '#8E8E93',
    lineHeight: 18,
  },
  // Dropdown Styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#1C1C1E',
    flex: 1,
  },
  placeholderText: {
    color: '#8E8E93',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface || '#FFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  optionItemSelected: {
    backgroundColor: colors.primary + '10',
  },
  optionText: {
    fontSize: 16,
    color: colors.text || '#1C1C1E',
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  doneButton: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  // About Section
  aboutText: {
    fontSize: 15,
    color: colors.gray700 || colors.text,
    lineHeight: 24,
  },
  editIconButton: {
    marginLeft: 'auto',
    padding: 4,
  },
  emptySectionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.primaryLight ? colors.primaryLight + '15' : '#F0F4FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryLight || '#E0E7FF',
    borderStyle: 'dashed',
  },
  emptySectionCtaText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    flex: 1,
  },
  // Work Experience View Mode
  workExperienceList: {
    gap: 12,
  },
  workExpCard: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200 || colors.border,
  },
  workExpIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workExpDetails: {
    flex: 1,
  },
  workExpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  workExpTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
    flex: 1,
  },
  workExpCompany: {
    fontSize: 14,
    color: colors.gray600 || colors.textSecondary || '#666',
    marginBottom: 4,
  },
  workExpMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  workExpMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workExpMetaText: {
    fontSize: 12,
    color: colors.gray500 || '#999',
  },
  currentBadge: {
    backgroundColor: colors.success + '20' || '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.success || '#34C759',
    textTransform: 'uppercase',
  },
  // Education View Mode
  educationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  educationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  educationDetails: {
    flex: 1,
  },
  educationDegree: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
    marginBottom: 2,
  },
  educationField: {
    fontSize: 14,
    color: colors.gray600 || colors.textSecondary || '#666',
    marginBottom: 2,
  },
  educationInstitution: {
    fontSize: 13,
    color: colors.gray500 || '#999',
  },
  // Skills View Mode
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    backgroundColor: colors.primary + '12',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  skillChipText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  // Activity Card Styles
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  activitySummary: {
    fontSize: 13,
    color: colors.gray500 || colors.textSecondary,
  },
  // Settings Button
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  settingsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsButtonText: {
    flex: 1,
  },
  settingsButtonTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
    marginBottom: 2,
  },
  settingsButtonSubtitle: {
    fontSize: 13,
    color: colors.textSecondary || '#8E8E93',
  },
  // Skeleton loader styles
  skeletonIcon: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  skeletonText: {
    height: 14,
    borderRadius: 4,
  },
  // Confirm Company Modal styles
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalCard: {
    backgroundColor: colors.surface || '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text || '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmModalMessage: {
    fontSize: 15,
    color: colors.textSecondary || '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalButtonSecondary: {
    backgroundColor: colors.background || '#F5F5F7',
    borderWidth: 1,
    borderColor: colors.border || '#E5E5EA',
  },
  confirmModalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
  },
  confirmModalButtonPrimary: {
    backgroundColor: colors.primary || '#6366F1',
  },
  confirmModalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
};
