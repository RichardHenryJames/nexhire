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
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const openedFromHome = route?.params?.openedFromHome === true;
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'personal', 'professional', 'workexp', 'salary', 'education', 'preferences', 'skills'
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
  
  // Referral code (first part of UserID before dash)
  const referralCode = user?.UserID?.split('-')[0] || '';
  
  // Scroll animation refs
  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showHeaderProfilePic, setShowHeaderProfilePic] = useState(false);
  const headerProfileOpacity = useRef(new Animated.Value(0)).current;
  const headerProfileScale = useRef(new Animated.Value(0.8)).current;
  
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
  
  const loadExtendedProfile = async () => {
    try {
      setLoading(true);
      
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
            skills: {
              primary: data.PrimarySkills ? data.PrimarySkills.split(',').map(s => s.trim()).filter(Boolean) : [],
              secondary: data.SecondarySkills ? data.SecondarySkills.split(',').map(s => s.trim()).filter(Boolean) : [],
            },
          }));
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
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
      onRequestClose={() => setActiveModal('professional')}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setActiveModal('professional')}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Work Experience</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView style={styles.modalContent}>
          <WorkExperienceSection editing={true} showHeader={false} />
        </ScrollView>
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
        onRequestClose={() => setActiveModal('professional')}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal('professional')}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
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
        {showHeaderProfilePic && (
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

        <View style={styles.headerSpacer} />
        <Text style={styles.title}>Profile</Text>
        {openedFromHome ? (
          <TouchableOpacity
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
            activeOpacity={0.7}
            style={styles.headerCloseButton}
          >
            <Ionicons name="close" size={24} color={colors.text || '#000'} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* User Profile Header */}
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
        />

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
                    <Text style={styles.actionButtonLabel}>Points</Text>
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
                    <Text style={styles.actionButtonSubtext}>Get ₹50</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Account Details Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIndicator} />
            <Text style={styles.sectionHeading}>Account Details</Text>
          </View>

          {renderSectionCard(
            'Personal Details',
            'person-outline',
            () => setActiveModal('personal'),
            `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Add personal details'
          )}

          {renderSectionCard(
            'Professional Details',
            'briefcase-outline',
            () => setActiveModal('professional'),
            jobSeekerProfile.currentJobTitle || 'Add your work experience'
          )}

          {renderSectionCard(
            'Education Details',
            'school-outline',
            () => setActiveModal('education'),
            jobSeekerProfile.highestEducation || 'Add your education'
          )}
        </View>

        {/* My Activity Section: applications, saved jobs, referrals */}
        {userType === 'JobSeeker' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIndicator} />
              <Text style={styles.sectionHeading}>My Activity</Text>
            </View>

            {renderSectionCard(
              'My Applications',
              'clipboard-outline',
              () => navigation.navigate('Applications'),
              'Track jobs you have applied to'
            )}

            {renderSectionCard(
              'Saved Jobs',
              'bookmark-outline',
              () => navigation.navigate('SavedJobs'),
              'View and manage saved jobs'
            )}

            {renderSectionCard(
              'Referral Requests',
              'people-circle-outline',
              () => navigation.navigate('MyReferralRequests'),
              'See referrals you have asked for'
            )}
          </View>
        )}

        {/* Preferences Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIndicator} />
            <Text style={styles.sectionHeading}>Preferences</Text>
          </View>

          {renderToggleCard(
            'Dark Mode',
            'moon-outline',
            isDark,
            toggleTheme,
            'Use a darker theme across the app'
          )}

          {renderSectionCard(
            'Job Preferences',
            'settings-outline',
            () => setActiveModal('preferences'),
            'Manage your job search preferences'
          )}

          {renderSectionCard(
            'Resume Preferences',
            'document-text-outline',
            () => setActiveModal('resumes'),
            jobSeekerProfile.resumes?.length > 0 
              ? `${jobSeekerProfile.resumes.length} resume(s) uploaded` 
              : 'Upload and manage your resumes'
          )}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={() => setShowLogoutModal(true)}>
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Compliance Footer */}
        <ComplianceFooter navigation={navigation} />
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
                <Ionicons name="gift" size={60} color="#FF9500" />
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
                onPress={() => {
                  // TODO: Add Clipboard API
                  Alert.alert('Copied!', `Code ${referralCode} copied to clipboard`);
                }}
              >
                <Ionicons name="copy-outline" size={20} color="#FFF" />
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
                  <Text style={styles.stepTitle}>Both Get ₹50!</Text>
                  <Text style={styles.stepDescription}>
                    Your friend gets ₹50 on signup, you get ₹50 when they join
                  </Text>
                </View>
              </View>
            </View>

            {/* Benefits */}
            <View style={styles.benefitsSection}>
              <View style={styles.benefitCard}>
                <Ionicons name="person-add" size={32} color={colors.primary} />
                <Text style={styles.benefitTitle}>Your Friend</Text>
                <Text style={styles.benefitAmount}>₹50</Text>
                <Text style={styles.benefitDescription}>On successful signup</Text>
              </View>

              <View style={styles.benefitCard}>
                <Ionicons name="wallet" size={32} color="#FF9500" />
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
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal visible={showLogoutModal} transparent onRequestClose={() => setShowLogoutModal(false)}>
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalContent}>
            <View style={styles.logoutModalIconContainer}>
              <Ionicons name="log-out-outline" size={40} color={colors.danger} />
            </View>
            <Text style={styles.logoutModalTitle}>Logout</Text>
            <Text style={styles.logoutModalMessage}>Are you sure you want to logout?</Text>
            <View style={styles.logoutModalButtons}>
              <TouchableOpacity style={styles.logoutModalCancelButton} onPress={() => setShowLogoutModal(false)}>
                <Text style={styles.logoutModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutModalConfirmButton} onPress={() => { setShowLogoutModal(false); logout(); }}>
                <Text style={styles.logoutModalConfirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
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
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
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
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
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
    color: colors.text || '#1C1C1E',
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
  // Logout Modal
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoutModalContent: {
    backgroundColor: colors.surface || '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  logoutModalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: (colors.danger || '#FF3B30') + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text || '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  logoutModalMessage: {
    fontSize: 16,
    color: colors.gray600 || '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  logoutModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  logoutModalCancelButton: {
    flex: 1,
    backgroundColor: colors.background || '#F5F5F7',
    borderWidth: 1,
    borderColor: colors.border || '#E5E5EA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logoutModalCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text || '#000',
  },
  logoutModalConfirmButton: {
    flex: 1,
    backgroundColor: colors.danger || '#FF3B30',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logoutModalConfirmText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  // Action Buttons (Wallet & Invite)
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
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
    backgroundColor: colors.surface || '#FFF',
    padding: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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
    marginTop: 20,
    marginBottom: 24,
  },
  inviteIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF4E6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  inviteHeading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text || '#1C1C1E',
    textAlign: 'center',
    marginBottom: 8,
  },
  inviteSubheading: {
    fontSize: 15,
    color: colors.gray600 || '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  referralCodeCard: {
    backgroundColor: colors.surface || '#FFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  referralCodeLabel: {
    fontSize: 14,
    color: colors.gray600 || '#666',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  referralCodeBox: {
    backgroundColor: colors.background || '#F5F5F7',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.primary + '30',
    borderStyle: 'dashed',
  },
  referralCodeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: 2,
  },
  copyCodeButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  copyCodeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  howItWorksSection: {
    marginBottom: 32,
  },
  howItWorksTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text || '#1C1C1E',
    marginBottom: 20,
  },
  howItWorksStep: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  stepContent: {
    flex: 1,
    paddingTop: 4,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.gray600 || '#666',
    lineHeight: 20,
  },
  benefitsSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  benefitCard: {
    flex: 1,
    backgroundColor: colors.surface || '#FFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  benefitTitle: {
    fontSize: 14,
    color: colors.gray600 || '#666',
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  benefitAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.success || '#34C759',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 12,
    color: colors.gray600 || '#666',
    textAlign: 'center',
  },
  shareLinkSection: {
    marginBottom: 20,
  },
  shareLinkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text || '#1C1C1E',
    marginBottom: 12,
  },
  shareLinkBox: {
    backgroundColor: colors.background || '#F5F5F7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border || '#E5E5EA',
  },
  shareLinkText: {
    fontSize: 13,
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
});
