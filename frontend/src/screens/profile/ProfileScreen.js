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
  TextInput,
  Alert,
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
import refopenAPI from '../../services/api';
import UserProfileHeader from '../../components/profile/UserProfileHeader';
import ComplianceFooter from '../../components/ComplianceFooter';
import WorkExperienceSection from '../../components/profile/WorkExperienceSection';
import SalaryBreakdownSection from '../../components/profile/SalaryBreakdownSection';
import EducationSection from '../../components/profile/EducationSection';
import ResumeSection from '../../components/profile/ResumeSection';
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
  const { user, userType, logout, updateProfileSmart } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { isMobile, isDesktop, isTablet } = responsive;
  const styles = React.useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const openedFromHome = route?.params?.openedFromHome === true;
  
  const [loading, setLoading] = useState(false);
  const [loadingSections, setLoadingSections] = useState(true); // Loading state for work exp, education sections
  const [refreshing, setRefreshing] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'personal', 'professional', 'workexp', 'salary', 'education', 'preferences', 'skills', 'notifications'
  const [editingModal, setEditingModal] = useState(false); // Track if modal is in edit mode
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  
  // Wallet state
  const [walletBalance, setWalletBalance] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  
  // Referral Points state
  const [referralPointsData, setReferralPointsData] = useState({
    totalPoints: 0,
    pointsHistory: [],
    pointTypeMetadata: {}
  });
  const [loadingReferralPoints, setLoadingReferralPoints] = useState(false);
  const [showReferralBreakdown, setShowReferralBreakdown] = useState(false);
  
  // User-level verification status
  const [isVerifiedReferrer, setIsVerifiedReferrer] = useState(false);
  
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
  
  // Scroll animation refs
  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showHeaderProfilePic, setShowHeaderProfilePic] = useState(false);
  const headerProfileOpacity = useRef(new Animated.Value(0)).current;
  const headerProfileScale = useRef(new Animated.Value(0.8)).current;
  
  // Modal toast state for Invite & Earn
  const [inviteToast, setInviteToast] = useState(null);
  
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
    preferredCompanySize: '',
    skills: { primary: [], secondary: [] },
    // Privacy Settings
    allowRecruitersToContact: true,
    hideCurrentCompany: false,
    hideSalaryDetails: false,
  });

  // Handle scroll animation
  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      if (value > 250 && !showHeaderProfilePic) {
        setShowHeaderProfilePic(true);
        Animated.parallel([
          Animated.timing(headerProfileOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(headerProfileScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
        ]).start();
      } else if (value <= 250 && showHeaderProfilePic) {
        setShowHeaderProfilePic(false);
        Animated.parallel([
          Animated.timing(headerProfileOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(headerProfileScale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
        ]).start();
      }
    });
    return () => scrollY.removeListener(listenerId);
  }, [showHeaderProfilePic]);

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

  // 🎯 Handler for "Become a Verified Referrer" button
  const handleBecomeVerifiedReferrer = useCallback(async () => {
    setNavigatingToVerify(true);
    try {
      // Fetch user's work experiences
      const res = await refopenAPI.getMyWorkExperiences();
      if (res.success && res.data) {
        setWorkExperiencesForVerify(res.data);
        // Find current work experience
        const current = res.data.find(exp => exp.IsCurrent === 1 || exp.IsCurrent === true);
        if (current) {
          setCurrentWorkExperience(current);
          setShowConfirmCompanyModal(true);
        } else {
          // No current company, show add work experience modal directly
          setCurrentWorkExperience(null);
          setShowAddWorkModal(true);
        }
      } else {
        // No work experiences, show add work experience modal
        setCurrentWorkExperience(null);
        setShowAddWorkModal(true);
      }
    } catch (error) {
      console.error('Error fetching work experiences:', error);
      Alert.alert('Error', 'Failed to load your work experiences. Please try again.');
    } finally {
      setNavigatingToVerify(false);
    }
  }, []);
  
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
          }));
          
          // Fetch user-level verification status
          try {
            const verifyRes = await refopenAPI.getVerificationStatus();
            if (verifyRes.success) {
              // Prefer isVerifiedUser (permanent) over isVerifiedReferrer
              setIsVerifiedReferrer(verifyRes.data?.isVerifiedUser || verifyRes.data?.isVerifiedReferrer || false);
            }
          } catch (verifyError) {
            console.warn('Could not load verification status:', verifyError);
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
        setReferralPointsData({
          totalPoints: response.data.totalPoints || 0,
          pointsHistory: response.data.history || [],
          pointTypeMetadata: response.data.pointTypeMetadata || {}
        });
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
    scrollRef.current?.scrollTo({ y: 0, animated: true });
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
  const savePersonalDetails = async () => {
    try {
      const response = await updateProfileSmart({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        linkedInProfile: jobSeekerProfile.linkedInProfile,
        githubProfile: jobSeekerProfile.githubProfile,
      });
      if (response.success) {
        Alert.alert('Success', 'Personal details updated successfully');
        setActiveModal(null);
        await loadExtendedProfile();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update personal details');
    }
  };

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
        Alert.alert('Success', 'Skills updated successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to update skills');
      }
    } catch (error) {
      console.error('Error saving skills:', error);
      Alert.alert('Error', 'Failed to update skills. Please try again.');
    }
  };


  const saveProfessionalDetails = async () => {
    try {
      const response = await updateProfileSmart({
        currentJobTitle: jobSeekerProfile.currentJobTitle,
        currentCompany: jobSeekerProfile.currentCompany,
        yearsOfExperience: jobSeekerProfile.yearsOfExperience,
      });
      if (response.success) {
        Alert.alert('Success', 'Professional details updated successfully');
        setEditingModal(false);
        await loadExtendedProfile();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update professional details');
    }
  };

  const saveEducationDetails = async () => {
    try {
      const response = await updateProfileSmart({
        highestEducation: jobSeekerProfile.highestEducation,
        fieldOfStudy: jobSeekerProfile.fieldOfStudy,
        institution: jobSeekerProfile.institution,
        graduationYear: jobSeekerProfile.graduationYear,
        gpa: jobSeekerProfile.gpa,
      });
      if (response.success) {
        Alert.alert('Success', 'Education details updated successfully');
        setEditingModal(false);
        await loadExtendedProfile();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update education details');
    }
  };

  const savePreferences = async () => {
    try {
      const response = await updateProfileSmart({
        isOpenToWork: jobSeekerProfile.isOpenToWork,
        openToRefer: jobSeekerProfile.openToRefer,
        profileVisibility: profile.profileVisibility,
        preferredJobTypes: jobSeekerProfile.preferredJobTypes,
        preferredLocations: jobSeekerProfile.preferredLocations,
        preferredCompanySize: jobSeekerProfile.preferredCompanySize,
        // Privacy Settings
        allowRecruitersToContact: jobSeekerProfile.allowRecruitersToContact,
        hideCurrentCompany: jobSeekerProfile.hideCurrentCompany,
        hideSalaryDetails: jobSeekerProfile.hideSalaryDetails,
      });
      if (response.success) {
        Alert.alert('Success', 'Preferences updated successfully');
        setEditingModal(false);
        await loadExtendedProfile();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update preferences');
    }
  };

  // Personal Details Modal
  const renderPersonalModal = () => (
    <Modal
      visible={activeModal === 'personal'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        setActiveModal(null);
        setEditingModal(false);
      }}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => {
            setActiveModal(null);
            setEditingModal(false);
          }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Personal Details</Text>
          <TouchableOpacity onPress={() => {
            if (editingModal) {
              savePersonalDetails();
            } else {
              setEditingModal(true);
            }
          }}>
            <Ionicons 
              name={editingModal ? "checkmark" : "create-outline"} 
              size={24} 
              color={colors.primary} 
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>First Name</Text>
            {editingModal ? (
              <TextInput
                style={styles.fieldInput}
                value={profile.firstName}
                onChangeText={(text) => setProfile(prev => ({ ...prev, firstName: text }))}
                placeholder="Enter first name"
              />
            ) : (
              <Text style={styles.fieldValue}>{profile.firstName || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Last Name</Text>
            {editingModal ? (
              <TextInput
                style={styles.fieldInput}
                value={profile.lastName}
                onChangeText={(text) => setProfile(prev => ({ ...prev, lastName: text }))}
                placeholder="Enter last name"
              />
            ) : (
              <Text style={styles.fieldValue}>{profile.lastName || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{profile.email || 'Not set'}</Text>
            <Text style={styles.fieldHint}>Email cannot be changed</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone</Text>
            {editingModal ? (
              <TextInput
                style={styles.fieldInput}
                value={profile.phone}
                onChangeText={(text) => setProfile(prev => ({ ...prev, phone: text }))}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.fieldValue}>{profile.phone || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>LinkedIn URL</Text>
            {editingModal ? (
              <TextInput
                style={styles.fieldInput}
                value={jobSeekerProfile.linkedInProfile}
                onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, linkedInProfile: text }))}
                placeholder="https://linkedin.com/in/your-profile"
                keyboardType="url"
              />
            ) : (
              <Text style={styles.fieldValue}>{jobSeekerProfile.linkedInProfile || 'Not set'}</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>GitHub URL</Text>
            {editingModal ? (
              <TextInput
                style={styles.fieldInput}
                value={jobSeekerProfile.githubProfile}
                onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, githubProfile: text }))}
                placeholder="https://github.com/your-username"
                keyboardType="url"
              />
            ) : (
              <Text style={styles.fieldValue}>{jobSeekerProfile.githubProfile || 'Not set'}</Text>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  // Professional Details Modal - Clean Summary View
  const renderProfessionalModal = () => (
    <Modal
      visible={activeModal === 'professional' || activeModal === 'workexp' || activeModal === 'salary'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        setActiveModal(null);
        setEditingModal(false);
      }}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => {
            setActiveModal(null);
            setEditingModal(false);
          }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Professional Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Work Experience Card */}
          <TouchableOpacity 
            style={styles.subsectionCard}
            onPress={() => {
              setActiveModal('workexp');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.subsectionHeader}>
              <View style={styles.subsectionHeaderLeft}>
                <Ionicons name="briefcase" size={20} color={colors.primary} />
                <Text style={styles.subsectionTitle}>Work Experience</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
            <Text style={styles.subsectionSummary}>
              {jobSeekerProfile.currentJobTitle 
                ? `${jobSeekerProfile.currentJobTitle} at ${jobSeekerProfile.currentCompany || 'Company'}`
                : 'Add your work experience'}
            </Text>
          </TouchableOpacity>

          {/* Salary Breakdown Card */}
          <TouchableOpacity 
            style={styles.subsectionCard}
            onPress={() => {
              setActiveModal('salary');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.subsectionHeader}>
              <View style={styles.subsectionHeaderLeft}>
                <Ionicons name="cash" size={20} color={colors.primary} />
                <Text style={styles.subsectionTitle}>Salary Breakdown</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
            <Text style={styles.subsectionSummary}>
              Manage your salary components and expectations
            </Text>
          </TouchableOpacity>

          {/* Skills Card */}
          <TouchableOpacity 
            style={styles.subsectionCard}
            onPress={() => setShowSkillsModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.subsectionHeader}>
              <View style={styles.subsectionHeaderLeft}>
                <Ionicons name="code-slash" size={20} color={colors.primary} />
                <Text style={styles.subsectionTitle}>Skills</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
            {jobSeekerProfile.skills.primary.length > 0 || jobSeekerProfile.skills.secondary.length > 0 ? (
              <View>
                {jobSeekerProfile.skills.primary.length > 0 && (
                  <View style={{marginTop: 8}}>
                    <Text style={{fontSize: 12, color: '#666', marginBottom: 4}}>Primary:</Text>
                    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 4}}>
                      {jobSeekerProfile.skills.primary.slice(0, 3).map((skill, idx) => (
                        <View key={idx} style={{backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12}}>
                          <Text style={{fontSize: 12, color: '#0066cc'}}>{skill}</Text>
                        </View>
                      ))}
                      {jobSeekerProfile.skills.primary.length > 3 && (
                        <View style={{backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12}}>
                          <Text style={{fontSize: 12, color: '#666'}}>+{jobSeekerProfile.skills.primary.length - 3} more</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.subsectionSummary}>Add your skills</Text>
            )}
          </TouchableOpacity>

          {/* Auto-Calculated Summary */}
          <View style={styles.subsectionCard}>
            <View style={styles.subsectionHeader}>
              <View style={styles.subsectionHeaderLeft}>
                <Ionicons name="analytics-outline" size={20} color={colors.primary} />
                <Text style={styles.subsectionTitle}>Career Summary</Text>
              </View>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Current Position</Text>
              <Text style={styles.summaryValue}>{jobSeekerProfile.currentJobTitle || 'Not set'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Current Company</Text>
              <Text style={styles.summaryValue}>{jobSeekerProfile.currentCompany || 'Not set'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Experience</Text>
              <Text style={styles.summaryValue}>{jobSeekerProfile.yearsOfExperience || '0'} years</Text>
            </View>
            
            <Text style={styles.summaryHint}>Automatically calculated from work experience</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  // Work Experience Full Modal
  const renderWorkExpModal = () => (
    <Modal
      visible={activeModal === 'workexp'}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setActiveModal(null)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalInnerContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Work Experience</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={styles.modalContent}>
            <WorkExperienceSection editing={true} showHeader={false} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Salary Breakdown Full Modal - with View/Edit mode
  const renderSalaryModal = () => {
    const salaryRef = React.useRef(null);
    
    return (
      <Modal
        visible={activeModal === 'salary'}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Salary Breakdown</Text>
            {!editingModal ? (
              <TouchableOpacity onPress={() => setEditingModal(true)}>
                <Ionicons name="create-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 24 }} />
            )}
          </View>
          <ScrollView style={styles.modalContent}>
            <SalaryBreakdownSection 
              ref={salaryRef}
              profile={{
                UserID: profile.userID,
                salaryBreakdown: jobSeekerProfile.salaryBreakdown
              }}
              setProfile={(updater) => {
                if (typeof updater === 'function') {
                  setJobSeekerProfile(prev => {
                    const newProfile = updater({ salaryBreakdown: prev.salaryBreakdown });
                    return { ...prev, ...newProfile };
                  });
                }
              }}
              onUpdate={(updates) => {
                setJobSeekerProfile(prev => ({ ...prev, ...updates }));
                loadExtendedProfile();
                setEditingModal(false);
              }}
              editing={editingModal} 
              embedded={true}
              compact={!editingModal} 
            />
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // Education Details Modal
  const renderEducationModal = () => (
    <Modal
      visible={activeModal === 'education'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        setActiveModal(null);
        setEditingModal(false);
      }}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => {
            setActiveModal(null);
            setEditingModal(false);
          }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Education Details</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          <EducationSection 
            profile={{
              institution: jobSeekerProfile.institution || '',
              highestEducation: jobSeekerProfile.highestEducation || '',
              fieldOfStudy: jobSeekerProfile.fieldOfStudy || '',
              graduationYear: jobSeekerProfile.graduationYear || '',
              gpa: jobSeekerProfile.gpa || ''
            }}
            setProfile={(updatedEducation) => {
              setJobSeekerProfile(prev => ({
                ...prev,
                institution: updatedEducation.institution || '',
                highestEducation: updatedEducation.highestEducation || '',
                fieldOfStudy: updatedEducation.fieldOfStudy || '',
                graduationYear: updatedEducation.graduationYear || '',
                gpa: updatedEducation.gpa || ''
              }));
            }}
            onUpdate={async (updatedEducation) => {
              await loadExtendedProfile();
            }}
          />
        </ScrollView>
      </View>
    </Modal>
  );

  // State for dropdowns
  const [jobTypes, setJobTypes] = useState([]);
  const [companySizes, setCompanySizes] = useState([]);
  const [showJobTypesModal, setShowJobTypesModal] = useState(false);
  const [showCompanySizeModal, setShowCompanySizeModal] = useState(false);
  const [selectedJobTypes, setSelectedJobTypes] = useState([]);
  const [selectedCompanySize, setSelectedCompanySize] = useState('');

  // Load reference data when preferences modal opens
  useEffect(() => {
    if (activeModal === 'preferences') {
      loadPreferencesReferenceData();
      // Initialize selected values from profile
      if (jobSeekerProfile.preferredJobTypes) {
        const types = jobSeekerProfile.preferredJobTypes.split(',').map(t => t.trim()).filter(Boolean);
        setSelectedJobTypes(types);
      }
      if (jobSeekerProfile.preferredCompanySize) {
        setSelectedCompanySize(jobSeekerProfile.preferredCompanySize);
      }
    }
  }, [activeModal, jobSeekerProfile.preferredJobTypes, jobSeekerProfile.preferredCompanySize]);

  const loadPreferencesReferenceData = async () => {
    try {
      // Load Job Types
      const jobTypeResponse = await refopenAPI.getReferenceMetadata('JobType');
      if (jobTypeResponse.success && jobTypeResponse.data) {
        setJobTypes(jobTypeResponse.data.map(item => item.Value));
      }

      // Company sizes - use hardcoded values (not in ReferenceMetadata)
      setCompanySizes(['Startup', 'Small', 'Medium', 'Large', 'Enterprise']);
    } catch (error) {
      console.error('Error loading preferences reference data:', error);
    }
  };

  // Preferences Modal
  const renderPreferencesModal = () => (
    <Modal
      visible={activeModal === 'preferences'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        setActiveModal(null);
        setEditingModal(false);
      }}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => {
            setActiveModal(null);
            setEditingModal(false);
          }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Preferences</Text>
          <TouchableOpacity onPress={() => {
            if (editingModal) {
              savePreferences();
            } else {
              setEditingModal(true);
            }
          }}>
            <Ionicons 
              name={editingModal ? "checkmark" : "create-outline"} 
              size={24} 
              color={colors.primary} 
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="briefcase-outline" size={20} color={colors.text} />
              <Text style={styles.toggleLabel}>Open to Job Opportunities</Text>
            </View>
            <TouchableOpacity 
              disabled={!editingModal}
              onPress={() => editingModal && setJobSeekerProfile(prev => ({ 
                ...prev, 
                isOpenToWork: !prev.isOpenToWork 
              }))}
              style={[styles.toggle, jobSeekerProfile.isOpenToWork && styles.toggleActive]}
            >
              <Text style={styles.toggleText}>{jobSeekerProfile.isOpenToWork ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="people-outline" size={20} color={colors.text} />
              <Text style={styles.toggleLabel}>Open to Refer Others</Text>
            </View>
            <TouchableOpacity 
              disabled={!editingModal}
              onPress={() => editingModal && setJobSeekerProfile(prev => ({ 
                ...prev, 
                openToRefer: !prev.openToRefer 
              }))}
              style={[styles.toggle, jobSeekerProfile.openToRefer && styles.toggleActive]}
            >
              <Text style={styles.toggleText}>{jobSeekerProfile.openToRefer ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="eye-outline" size={20} color={colors.text} />
              <Text style={styles.toggleLabel}>Profile Visibility</Text>
            </View>
            <TouchableOpacity 
              disabled={!editingModal}
              onPress={() => editingModal && setProfile(prev => ({ 
                ...prev, 
                profileVisibility: prev.profileVisibility === 'Public' ? 'Private' : 'Public' 
              }))}
              style={[styles.toggle, profile.profileVisibility === 'Public' && styles.toggleActive]}
            >
              <Text style={styles.toggleText}>{profile.profileVisibility || 'Public'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHeader}>Privacy Settings</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="chatbubbles-outline" size={20} color={colors.text} />
              <Text style={styles.toggleLabel}>Allow Recruiters to Contact</Text>
            </View>
            <TouchableOpacity 
              disabled={!editingModal}
              onPress={() => editingModal && setJobSeekerProfile(prev => ({ 
                ...prev, 
                allowRecruitersToContact: !prev.allowRecruitersToContact 
              }))}
              style={[styles.toggle, jobSeekerProfile.allowRecruitersToContact && styles.toggleActive]}
            >
              <Text style={styles.toggleText}>{jobSeekerProfile.allowRecruitersToContact ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="business-outline" size={20} color={colors.text} />
              <Text style={styles.toggleLabel}>Hide Current Company</Text>
            </View>
            <TouchableOpacity 
              disabled={!editingModal}
              onPress={() => editingModal && setJobSeekerProfile(prev => ({ 
                ...prev, 
                hideCurrentCompany: !prev.hideCurrentCompany 
              }))}
              style={[styles.toggle, jobSeekerProfile.hideCurrentCompany && styles.toggleActive]}
            >
              <Text style={styles.toggleText}>{jobSeekerProfile.hideCurrentCompany ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Ionicons name="cash-outline" size={20} color={colors.text} />
              <Text style={styles.toggleLabel}>Hide Salary Details</Text>
            </View>
            <TouchableOpacity 
              disabled={!editingModal}
              onPress={() => editingModal && setJobSeekerProfile(prev => ({ 
                ...prev, 
                hideSalaryDetails: !prev.hideSalaryDetails 
              }))}
              style={[styles.toggle, jobSeekerProfile.hideSalaryDetails && styles.toggleActive]}
            >
              <Text style={styles.toggleText}>{jobSeekerProfile.hideSalaryDetails ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHeader}>Job Preferences</Text>
          
          {/* Preferred Job Types - Dropdown */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Preferred Job Types</Text>
            {editingModal ? (
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowJobTypesModal(true)}
              >
                <Text style={[styles.dropdownButtonText, selectedJobTypes.length === 0 && styles.placeholderText]}>
                  {selectedJobTypes.length > 0 
                    ? selectedJobTypes.join(', ') 
                    : 'Select job types'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.gray500} />
              </TouchableOpacity>
            ) : (
              <Text style={styles.fieldValue}>
                {jobSeekerProfile.preferredJobTypes || 'Not set'}
              </Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Preferred Locations</Text>
            {editingModal ? (
              <TextInput
                style={styles.fieldInput}
                value={jobSeekerProfile.preferredLocations}
                onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, preferredLocations: text }))}
                placeholder="e.g., Bangalore, Remote"
              />
            ) : (
              <Text style={styles.fieldValue}>{jobSeekerProfile.preferredLocations || 'Not set'}</Text>
            )}
          </View>

          {/* Preferred Company Size - Dropdown */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Preferred Company Size</Text>
            {editingModal ? (
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowCompanySizeModal(true)}
              >
                <Text style={[styles.dropdownButtonText, !selectedCompanySize && styles.placeholderText]}>
                  {selectedCompanySize || 'Select company size'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.gray500} />
              </TouchableOpacity>
            ) : (
              <Text style={styles.fieldValue}>
                {jobSeekerProfile.preferredCompanySize || 'Not set'}
              </Text>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Job Types Modal */}
      <Modal
        visible={showJobTypesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowJobTypesModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowJobTypesModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Job Types</Text>
            <TouchableOpacity onPress={() => {
              setJobSeekerProfile(prev => ({ 
                ...prev, 
                preferredJobTypes: selectedJobTypes.join(', ') 
              }));
              setShowJobTypesModal(false);
            }}>
              <Text style={styles.doneButton}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {jobTypes.map((type, index) => {
              const isSelected = selectedJobTypes.includes(type);
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                  onPress={() => {
                    setSelectedJobTypes(prev => 
                      isSelected 
                        ? prev.filter(t => t !== type)
                        : [...prev, type]
                    );
                  }}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {type}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Company Size Modal */}
      <Modal
        visible={showCompanySizeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCompanySizeModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCompanySizeModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Company Size</Text>
            <TouchableOpacity onPress={() => {
              setJobSeekerProfile(prev => ({ 
                ...prev, 
                preferredCompanySize: selectedCompanySize 
              }));
              setShowCompanySizeModal(false);
            }}>
              <Text style={styles.doneButton}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {companySizes.map((size, index) => {
              const isSelected = selectedCompanySize === size;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                  onPress={() => setSelectedCompanySize(size)}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {size}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </Modal>
  );

  // Resume Preferences Modal
  const renderResumesModal = () => (
    <Modal
      visible={activeModal === 'resumes'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        setActiveModal(null);
        setEditingModal(false);
      }}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => {
            setActiveModal(null);
            setEditingModal(false);
          }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Resumes & Documents</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          <ResumeSection
            profile={{ 
              ...jobSeekerProfile, 
              UserID: profile.userID,
              resumes: jobSeekerProfile.resumes || []
            }}
            setProfile={(updatedProfile) => {
              setJobSeekerProfile(prev => ({
                ...prev,
                ...updatedProfile
              }));
            }}
            onUpdate={(updatedData) => {
              setJobSeekerProfile(prev => ({
                ...prev,
                ...updatedData
              }));
              // Reload to get fresh data
              loadExtendedProfile();
            }}
            editing={true} // Always enable editing in this modal
          />
        </ScrollView>
      </View>
    </Modal>
  );

  if (loading && !profile.firstName) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sticky Header with Wallet */}
      <View style={styles.stickyHeader}>
        {/* Animated Profile Pic - Absolutely positioned overlay (only when from tab) */}
        {!openedFromHome && showHeaderProfilePic && (
          <Animated.View style={[styles.headerProfilePic, { opacity: headerProfileOpacity, transform: [{ scale: headerProfileScale }] }]}>
            <TouchableOpacity onPress={scrollToTop} activeOpacity={0.8}>
              {profile.profilePictureURL ? (
                <Image source={{ uri: profile.profilePictureURL }} style={styles.headerProfileImage} />
              ) : (
                <View style={styles.headerProfilePlaceholder}>
                  <Text style={styles.headerInitials}>
                    {`${profile.firstName?.charAt(0) || ''}${profile.lastName?.charAt(0) || ''}`.toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Left side spacer or Settings icon (when from home) */}
        {openedFromHome ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
            style={styles.headerIconButton}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text || '#000'} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}

        <Text style={styles.title}>Profile</Text>

        {/* Right side: Close button (when from home) OR Settings icon (when from tab) */}
        {openedFromHome ? (
          <TouchableOpacity
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
            activeOpacity={0.7}
            style={styles.headerIconButton}
          >
            <Ionicons name="close" size={24} color={colors.text || '#000'} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
            style={styles.headerIconButton}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text || '#000'} />
          </TouchableOpacity>
        )}
      </View>

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
              isVerifiedUser={isVerifiedReferrer}
              isVerifiedReferrer={isCurrentJobVerified}
              onBecomeVerifiedReferrer={handleBecomeVerifiedReferrer}
              isLoadingVerify={navigatingToVerify}
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
                {loadingWallet ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.actionButtonAmount}>₹{walletBalance?.balance?.toFixed(0) || '0'}</Text>
                )}
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
                  <View style={[styles.actionButtonIcon, { backgroundColor: '#E6F4FF' }]}>
                    <Ionicons name="star" size={20} color="#00A3EE" />
                  </View>
                  <View style={styles.actionButtonContent}>
                    <Text style={styles.actionButtonLabel}>Rewards</Text>
                    {loadingReferralPoints ? (
                      <ActivityIndicator size="small" color="#00A3EE" />
                    ) : (
                      <Text style={[styles.actionButtonAmount, { color: '#00A3EE' }]}>
                        {referralPointsData.totalPoints || 0}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Invite & Earn Button */}
                <TouchableOpacity 
                  style={styles.actionButtonThird}
                  onPress={() => setActiveModal('invite')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionButtonIcon, { backgroundColor: '#FFF4E6' }]}>
                    <Ionicons name="gift" size={20} color="#FF9500" />
                  </View>
                  <View style={styles.actionButtonContent}>
                    <Text style={styles.actionButtonLabel}>Invite</Text>
                    <Text style={styles.actionButtonSubtext}>Get ₹25</Text>
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

        {/* About Section */}
        {!loadingSections && jobSeekerProfile.summary && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionHeading}>About</Text>
              <TouchableOpacity onPress={() => setActiveModal('professional')} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.aboutText}>{jobSeekerProfile.summary}</Text>
          </View>
        )}

        {/* Work Experience Section - View Mode */}
        {!loadingSections && jobSeekerProfile.workExperiences && jobSeekerProfile.workExperiences.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="briefcase-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionHeading}>Work Experience</Text>
              <TouchableOpacity onPress={() => setActiveModal('workexp')} style={styles.editIconButton}>
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
                        {isExpVerified ? (
                          <View style={{ backgroundColor: '#ECFDF5', padding: 4, borderRadius: 10 }}>
                            <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                          </View>
                        ) : (
                          <View style={{ backgroundColor: colors.gray100 || '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Ionicons name="shield-outline" size={10} color={colors.gray500 || '#6B7280'} />
                            <Text style={{ fontSize: 10, color: colors.gray500 || '#6B7280' }}>Unverified</Text>
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

        {/* Education Section - View Mode */}
        {!loadingSections && jobSeekerProfile.highestEducation && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="school-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionHeading}>Education</Text>
              <TouchableOpacity onPress={() => setActiveModal('education')} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
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
          </View>
        )}

        {/* Skills Section - View Mode */}
        {!loadingSections && (jobSeekerProfile.skills.primary?.length > 0 || jobSeekerProfile.skills.secondary?.length > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="code-slash-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionHeading}>Skills</Text>
              <TouchableOpacity onPress={() => setShowSkillsModal(true)} style={styles.editIconButton}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.skillsContainer}>
              {[...(jobSeekerProfile.skills.primary || []), ...(jobSeekerProfile.skills.secondary || [])].map((skill, index) => (
                <View key={index} style={styles.skillChip}>
                  <Text style={styles.skillChipText}>{skill}</Text>
                </View>
              ))}
            </View>
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
      {renderPersonalModal()}
      {renderProfessionalModal()}
      {renderWorkExpModal()}
      {renderSalaryModal()}
      {renderEducationModal()}
      {renderPreferencesModal()}
      {renderResumesModal()}

      {/* Referral Points Breakdown Modal */}
      <ReferralPointsBreakdown
        visible={showReferralBreakdown}
        onClose={() => setShowReferralBreakdown(false)}
        totalPoints={referralPointsData.totalPoints}
        pointsHistory={referralPointsData.pointsHistory}
        pointTypeMetadata={referralPointsData.pointTypeMetadata}
        navigation={navigation}
        onConversionSuccess={async () => {
          // Refresh wallet and points data after successful conversion
          await loadWallet();
          await loadReferralPoints();
        }}
      />

      {/* Invite & Earn Modal */}
      <Modal
        visible={activeModal === 'invite'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalInnerContainer}>
            {/* Modal Toast - shows inside modal */}
            <ModalToast
              visible={!!inviteToast}
              message={inviteToast?.text || ''}
              type={inviteToast?.type || 'success'}
              onHide={() => setInviteToast(null)}
            />
            
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeButton}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Invite & Earn</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.modalContent} contentContainerStyle={{ padding: 16 }}>
            {/* Gift Icon */}
            <View style={styles.inviteIconContainer}>
              <View style={styles.inviteIconCircle}>
                <Ionicons name="gift" size={40} color="#FF9500" />
              </View>
            </View>

            {/* Heading */}
            <Text style={styles.inviteHeading}>Share the Love, Earn Rewards!</Text>
            <Text style={styles.inviteSubheading}>
              Invite your friends and you both get rewarded when they sign up
            </Text>

            {/* Referral Code Card */}
            <View style={styles.referralCodeCard}>
              <Text style={styles.referralCodeLabel}>Your Referral Code</Text>
              <View style={styles.referralCodeBox}>
                <Text style={styles.referralCodeText}>{referralCode}</Text>
              </View>
              <TouchableOpacity 
                style={styles.copyCodeButton}
                onPress={async () => {
                  try {
                    await navigator.clipboard.writeText(referralCode);
                    setInviteToast({ text: 'Copied!', type: 'success' });
                  } catch (e) {
                    setInviteToast({ text: 'Failed to copy code', type: 'error' });
                  }
                }}
              >
                <Ionicons name="copy-outline" size={18} color="#FFF" />
                <Text style={styles.copyCodeButtonText}>Copy Code</Text>
              </TouchableOpacity>
            </View>

            {/* How it Works */}
            <View style={styles.howItWorksSection}>
              <Text style={styles.howItWorksTitle}>How it Works</Text>
              
              <View style={styles.howItWorksStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Share Your Code</Text>
                  <Text style={styles.stepDescription}>
                    Share your unique referral code with friends
                  </Text>
                </View>
              </View>

              <View style={styles.howItWorksStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Friend Signs Up</Text>
                  <Text style={styles.stepDescription}>
                    They use your code during registration
                  </Text>
                </View>
              </View>

              <View style={styles.howItWorksStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Both Get ₹25!</Text>
                  <Text style={styles.stepDescription}>
                    Your friend gets ₹25 on signup, you get ₹25 when they join
                  </Text>
                </View>
              </View>
            </View>

            {/* Benefits */}
            <View style={styles.benefitsSection}>
              <View style={styles.benefitCard}>
                <Ionicons name="person-add" size={24} color={colors.primary} />
                <Text style={styles.benefitTitle}>Your Friend</Text>
                <Text style={styles.benefitAmount}>₹50</Text>
                <Text style={styles.benefitDescription}>On successful signup</Text>
              </View>

              <View style={styles.benefitCard}>
                <Ionicons name="wallet" size={24} color="#FF9500" />
                <Text style={styles.benefitTitle}>You</Text>
                <Text style={styles.benefitAmount}>₹50</Text>
                <Text style={styles.benefitDescription}>When they join</Text>
              </View>
            </View>

            {/* Share Link Section */}
            <View style={styles.shareLinkSection}>
              <Text style={styles.shareLinkTitle}>Share Link</Text>
              <View style={styles.shareLinkBox}>
                <Text style={styles.shareLinkText} numberOfLines={1}>
                  https://refopen.com/register?ref={referralCode}
                </Text>
              </View>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    paddingTop: 8,
    paddingBottom: 12,
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
    width: 40,
  },
  headerIconButton: {
    width: 40,
    height: 40,
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
    maxWidth: responsive.isDesktop ? 800 : '100%',
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
