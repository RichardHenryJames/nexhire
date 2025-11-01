import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography } from '../../styles/theme';
import refopenAPI from '../../services/api';
import EducationSection from '../../components/profile/EducationSection';
import SalaryBreakdownSection from '../../components/profile/SalaryBreakdownSection';
import ProfileSection, { useEditing } from '../../components/profile/ProfileSection';
import UserProfileHeader from '../../components/profile/UserProfileHeader';
import WorkExperienceSection from '../../components/profile/WorkExperienceSection';
import ResumeSection from '../../components/profile/ResumeSection';
import ComplianceFooter from '../../components/ComplianceFooter';

export default function ProfileScreen({ navigation }) {
  const { 
    user, 
    logout, 
    userType,
    // ? NEW: Use smart methods directly from AuthContext (THE FIX!)
    updateProfileSmart,
    togglePrivacySetting, 
    updateCompleteProfile 
  } = useAuth();

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState({});
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [skillType, setSkillType] = useState('primary'); // ? NEW: Track which skill type we're adding

  // 🆕 NEW: Wallet state
  const [walletBalance, setWalletBalance] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  const scrollRef = useRef(null); // ? FIX: Declare ref used in useFocusEffect & ScrollView
  
  // 🆕 NEW: Scroll animation state
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showHeaderProfilePic, setShowHeaderProfilePic] = useState(false);
  const headerProfileOpacity = useRef(new Animated.Value(0)).current;
  const headerProfileScale = useRef(new Animated.Value(0.8)).current;

  // 🆕 NEW: Handle scroll animation for header profile pic
  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      // Show profile pic after scrolling ~50px (past UserProfileHeader)
      if (value > 250 && !showHeaderProfilePic) {
        setShowHeaderProfilePic(true);
        // Fade in with spring scale animation
        Animated.parallel([
          Animated.timing(headerProfileOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(headerProfileScale, {
            toValue: 1,
            friction: 5,
            tension: 100,
            useNativeDriver: true,
          }),
        ]).start();
      } else if (value <= 250 && showHeaderProfilePic) {
        // Fade out when scrolling back up
        setShowHeaderProfilePic(false);
        Animated.parallel([
          Animated.timing(headerProfileOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(headerProfileScale, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });

    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [showHeaderProfilePic]);

  // Initialize basic profile with correct backend field names
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

  // Extended profile for job seekers and employers - UPDATED with all database fields
  const [jobSeekerProfile, setJobSeekerProfile] = useState({
    // Personal Information
    nationality: '',
    currentLocation: '',
    preferredLocations: ''
    
    // Social Profiles
    ,linkedInProfile: ''
    ,githubProfile: ''
    
    // Documents
    ,resumes: [] // ? NEW: Array to store multiple resumes
    ,additionalDocuments: ''
    
    // Education (? Enhanced with GraduationYear and GPA)
    ,highestEducation: ''
    ,fieldOfStudy: ''
    ,institution: ''
    ,graduationYear: ''
    ,gpa: ''
    
    // Professional Information
    ,headline: ''
    ,summary: ''
    ,currentJobTitle: ''
    ,currentCompany: ''
    ,yearsOfExperience: 0
    ,noticePeriod: 30
    ,totalWorkExperience: ''
    
    // Job Preferences
    ,preferredJobTypes: ''
    ,preferredWorkTypes: ''
    ,preferredRoles: ''
    ,preferredIndustries: ''
    ,minimumSalary: 0 // ? ENSURE CORRECT FIELD NAME
    ,preferredCompanySize: ''
    
    // Skills and Experience - ? UPDATED: secondarySkills as array
    ,primarySkills: []
    ,secondarySkills: [] // ? CHANGED: Now an array like primarySkills
    ,languages: ''
    ,certifications: ''
    ,workExperience: ''
    
    // Availability and Preferences
    ,immediatelyAvailable: false
    ,willingToRelocate: false
    ,jobSearchStatus: ''
    
    // ? Privacy Settings (THE MAIN FIX!)
    ,allowRecruitersToContact: true
    ,hideCurrentCompany: false      // This will now work!
    ,hideSalaryDetails: false       // This will now work!
    ,openToRefer: true              // NEW: Default to true as per requirement
    
    // Status Fields
    ,isOpenToWork: true
    ,isFeatured: false
    ,featuredUntil: null
    
    // 🆕 REFERRAL POINTS AND STATS
    ,ReferralPoints: 0
    ,referralStats: {
      totalReferralsMade: 0,
      verifiedReferrals: 0,
      referralRequestsMade: 0,
      totalPointsFromRewards: 0
    }

    // 🆕 Load detailed points history for breakdown
    ,pointsHistory: [] // Will be loaded separately
    ,pointTypeMetadata: {} // 🆕 Dynamic metadata from backend
    
    // Additional
    ,tags: ''
    
    // Legacy fields (kept for backward compatibility)
    ,expectedSalary: ''
    ,currencyPreference: 'USD'
    ,location: ''
    ,relocatable: false
    ,remotePreference: 'Hybrid'
    ,workAuthorization: ''
    ,resumeURL: ''
    ,portfolioURL: ''
    ,personalWebsite: ''
    ,bio: ''
    ,industries: []
  });

  const [employerProfile, setEmployerProfile] = useState({
    jobTitle: ''
    ,department: ''
    ,organizationName: ''
    ,organizationSize: ''
    ,industry: ''
    ,canPostJobs: true
    ,canManageApplications: true
    ,canViewAnalytics: false
    ,recruitmentFocus: ''
    ,linkedInProfile: ''
    ,bio: ''
  });

  // 🆕 NEW: Scroll to top when header profile pic is tapped
  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  // ? FIX: Optimized ProfileField component with proper debounce cleanup
  // ? FIX: Local state ProfileField - no parent updates until blur (like normal forms)
  const ProfileField = React.memo(({ fieldKey, label, placeholder, options = {} }) => {
    const isEditing = useEditing();
    
    const { 
      multiline = false, 
      keyboardType = 'default', 
      editable = true, 
      secure = false,
      choices = null,
      profileType = 'basic'
    } = options;

    const currentProfile = profileType === 'jobSeeker' ? jobSeekerProfile : 
                          profileType === 'employer' ? employerProfile : profile;
    
    const setCurrentProfile = profileType === 'jobSeeker' ? setJobSeekerProfile : 
                             profileType === 'employer' ? setEmployerProfile : setProfile;

    // ? FIX: Local state for editing - no parent updates during typing
    const [localValue, setLocalValue] = useState(currentProfile[fieldKey]?.toString() || '');
    const [isFocused, setIsFocused] = useState(false);

    // ? FIX: Sync with parent value when not focused
    useEffect(() => {
      if (!isFocused) {
        setLocalValue(currentProfile[fieldKey]?.toString() || '');
      }
    }, [currentProfile[fieldKey], isFocused]);

    // ? FIX: Only update parent when field loses focus
    const handleBlur = () => {
      setIsFocused(false);
      setCurrentProfile(prev => ({ ...prev, [fieldKey]: localValue }));
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleChoiceSelect = (choice) => {
      setCurrentProfile(prev => ({ ...prev, [fieldKey]: choice }));
    };

    // ? NEW: Format minimum salary with INR currency
    const formatMinimumSalary = (value) => {
      if (fieldKey === 'minimumSalary') {
        const amount = parseFloat(value);
        if (!isNaN(amount) && amount >= 0) {
          return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(amount);
        }
        return '₹0 INR'; // Show currency symbol even when amount is 0
      }
      return value?.toString() || 'Not specified';
    };

    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {isEditing && editable ? (
          choices ? (
            <View style={styles.choicesContainer}>
              {choices.map((choice) => (
                <TouchableOpacity
                  key={choice}
                  style={[
                    styles.choiceButton,
                    currentProfile[fieldKey] === choice && styles.choiceButtonActive
                  ]}
                  onPress={() => handleChoiceSelect(choice)}
                >
                  <Text style={[
                    styles.choiceButtonText,
                    currentProfile[fieldKey] === choice && styles.choiceButtonTextActive
                  ]}>
                    {choice}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            fieldKey === 'minimumSalary' ? (
              <View style={styles.salaryInputContainer}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={[styles.fieldInput, styles.salaryInput]}
                  value={localValue}
                  onChangeText={setLocalValue}  // ? Only updates local state
                  onFocus={handleFocus}
                  onBlur={handleBlur}          // ? Updates parent on blur
                  placeholder="Enter salary in INR"
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.currencySuffix}>INR</Text>
              </View>
            ) : (
              <TextInput
                style={[styles.fieldInput, multiline && styles.multilineInput]}
                value={localValue}
                onChangeText={setLocalValue}  // ? Only updates local state
                onFocus={handleFocus}
                onBlur={handleBlur}          // ? Updates parent on blur
                placeholder={placeholder}
                multiline={multiline}
                numberOfLines={multiline ? 4 : 1}
                keyboardType={keyboardType}
                secureTextEntry={secure}
                autoCapitalize={fieldKey === 'email' ? 'none' : 'words'}
                autoCorrect={false}
              />
            )
          )
        ) : (
          <Text style={styles.fieldValue}>
            {fieldKey === 'minimumSalary' ? formatMinimumSalary(currentProfile[fieldKey]) : (currentProfile[fieldKey]?.toString() || 'Not specified')}
          </Text>
        )}
        {errors[fieldKey] && <Text style={styles.errorText}>{errors[fieldKey]}</Text>}
      </View>
    );
  });

  // Validation functions and other helper functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhoneNumber = (phone = '') => {
    // Allow empty phone number (optional field)
    const phoneRegex = /^\+?[\d\s\-()]+$/;
    return phoneRegex.test(phone);
  };

  const addSkill = () => {
    const currentSkills = skillType === 'primary' ? jobSeekerProfile.primarySkills : jobSeekerProfile.secondarySkills;
    
    if (newSkill.trim() && !currentSkills.includes(newSkill.trim())) {
      if (skillType === 'primary') {
        setJobSeekerProfile({
          ...jobSeekerProfile,
          primarySkills: [...jobSeekerProfile.primarySkills, newSkill.trim()]
        });
      } else {
        setJobSeekerProfile({
          ...jobSeekerProfile,
          secondarySkills: [...jobSeekerProfile.secondarySkills, newSkill.trim()]
        });
      }
      setNewSkill('');
      setShowSkillsModal(false);
    }
  };

  const removeSkill = (skill, type = 'primary') => {
    if (type === 'primary') {
      setJobSeekerProfile({
        ...jobSeekerProfile,
        primarySkills: jobSeekerProfile.primarySkills.filter(s => s !== skill)
      });
    } else {
      setJobSeekerProfile({
        ...jobSeekerProfile,
        secondarySkills: jobSeekerProfile.secondarySkills.filter(s => s !== skill)
      });
    }
  };

  // ? NEW: Enhanced SkillsSection component with primary and secondary skills
  const SkillsSection = () => {
    const isEditing = useEditing();
    
    return (
      <View style={styles.skillsSection}>
        {/* Primary Skills */}
        <View style={styles.skillsSubsection}>
          <View style={styles.skillsHeader}>
            <Text style={styles.fieldLabel}>Primary Skills</Text>
            {isEditing && (
              <TouchableOpacity
                style={styles.addSkillButton}
                onPress={() => {
                  setSkillType('primary');
                  setShowSkillsModal(true);
                }}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.addSkillText}>Add Primary</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.skillsContainer}>
            {jobSeekerProfile.primarySkills.map((skill, index) => (
              <View key={index} style={styles.skillTag}>
                <Text style={styles.skillText}>{skill}</Text>
                {isEditing && (
                  <TouchableOpacity
                    style={styles.removeSkillButton}
                    onPress={() => removeSkill(skill, 'primary')}
                  >
                    <Ionicons name="close" size={14} color={colors.white} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {jobSeekerProfile.primarySkills.length === 0 && (
              <Text style={styles.noSkillsText}>
                {isEditing ? 'Tap "Add Primary" to add your core skills' : 'No primary skills added'}
              </Text>
            )}
          </View>
        </View>

        {/* Secondary Skills */}
        <View style={styles.skillsSubsection}>
          <View style={styles.skillsHeader}>
            <Text style={styles.fieldLabel}>Secondary Skills</Text>
            {isEditing && (
              <TouchableOpacity
                style={styles.addSkillButton}
                onPress={() => {
                  setSkillType('secondary');
                  setShowSkillsModal(true);
                }}
              >
                <Ionicons name="add" size={16} color={colors.secondary || colors.primary} />
                <Text style={styles.addSkillText}>Add Secondary</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.skillsContainer}>
            {jobSeekerProfile.secondarySkills.map((skill, index) => (
              <View key={index} style={styles.secondarySkillTag}>
                <Text style={styles.secondarySkillText}>{skill}</Text>
                {isEditing && (
                  <TouchableOpacity
                    style={styles.removeSecondarySkillButton}
                    onPress={() => removeSkill(skill, 'secondary')}
                  >
                    <Ionicons name="close" size={14} color={colors.text} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {jobSeekerProfile.secondarySkills.length === 0 && (
              <Text style={styles.noSkillsText}>
                {isEditing ? 'Tap "Add Secondary" to add additional skills' : 'No secondary skills added'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Choice options
  const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];
  const visibilityOptions = ['Public', 'Private', 'Professional'];

  // ? MISSING SAVE FUNCTIONS - Add them here
  
  /**
   * Save professional information section
   */
  const saveProfessionalInfo = async (updatedData) => {
    try {
      setLoading(true);
      const result = await handleSmartSave();
      return result;
    } catch (error) {
      console.error('Failed to save professional info:', error);
      Alert.alert('Error', error.message || 'Failed to update professional information');
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save skills and expertise section
   */
  const saveSkillsExpertise = async (updatedData) => {
    try {
      setLoading(true);
      const result = await handleSmartSave();
      return result;
    } catch (error) {
      console.error('Failed to save skills expertise:', error);
      Alert.alert('Error', error.message || 'Failed to update skills and expertise');
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save work preferences section
   */
  const saveWorkPreferences = async (updatedData) => {
    try {
      setLoading(true);
      const result = await handleSmartSave();
      return result;
    } catch (error) {
      console.error('Failed to save work preferences:', error);
      Alert.alert('Error', error.message || 'Failed to update work preferences');
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save online presence section
   */
  const saveOnlinePresence = async (updatedData) => {
    try {
      setLoading(true);
      const result = await handleSmartSave();
      return result;
    } catch (error) {
      console.error('Failed to save online presence:', error);
      Alert.alert('Error', error.message || 'Failed to update online presence');
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save employer data (for employer profiles)
   */
  const saveEmployerData = async (updatedData) => {
    try {
      setLoading(true);
      console.log('Saving employer data...');
      const result = await refopenAPI.updateEmployerProfile(user.UserID, updatedData);
      if (result.success) {
        Alert.alert('Success', 'Employer information updated successfully!');
        return true;
      } else {
        Alert.alert('Update Failed', result.error || 'Failed to update employer information');
        return false;
      }
    } catch (error) {
      console.error('Failed to save employer data:', error);
      Alert.alert('Error', error.message || 'Failed to update employer information');
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Quick privacy setting toggle using smart routing
   */
  const handlePrivacyToggle = async (setting, value) => {
    try {
      console.log(`?Toggling ${setting} to ${value} using smart update...`);
      
      const result = await togglePrivacySetting(setting, value);
      
      if (result.success) {
        // Update local state immediately
        setJobSeekerProfile(prev => ({ ...prev, [setting]: value }));
        
        // Show success message
        const settingNames = {
          hideCurrentCompany: 'Hide Current Company',
          hideSalaryDetails: 'Hide Salary Details',
          allowRecruitersToContact: 'Allow Recruiters to Contact',
          isOpenToWork: 'Open to Work',
          openToRefer: 'Open to Refer' // NEW: Added Open to Refer
        };
        
        Alert.alert(
          'Success',
          `${settingNames[setting]} ${value ? 'enabled' : 'disabled'} successfully!`
        );
      } else {
        Alert.alert('Update Failed', result.error || 'Failed to update privacy setting');
      }
    } catch (error) {
      console.error(`Failed to toggle ${setting}:`, error);
      Alert.alert('Error', error.message || 'Failed to update privacy setting');
    }
  };

  // ?Privacy Settings Content
  const renderPrivacySettingsContent = () => (
    <View style={styles.privacyContainer}>
      <View style={styles.switchContainer}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Hide Current Company</Text>
          <Text style={styles.switchDescription}>
            Your current company will be hidden from your profile
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.switch, jobSeekerProfile.hideCurrentCompany && styles.switchActive]}
          onPress={() => handlePrivacyToggle('hideCurrentCompany', !jobSeekerProfile.hideCurrentCompany)}
        >
          <View style={[styles.switchThumb, jobSeekerProfile.hideCurrentCompany && styles.switchThumbActive]} />
        </TouchableOpacity>
      </View>

      <View style={styles.switchContainer}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Hide Salary Details</Text>
          <Text style={styles.switchDescription}>
            Your salary information will be private
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.switch, jobSeekerProfile.hideSalaryDetails && styles.switchActive]}
          onPress={() => handlePrivacyToggle('hideSalaryDetails', !jobSeekerProfile.hideSalaryDetails)}
        >
          <View style={[styles.switchThumb, jobSeekerProfile.hideSalaryDetails && styles.switchThumbActive]} />
        </TouchableOpacity>
      </View>

      <View style={styles.switchContainer}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Allow Recruiters to Contact</Text>
          <Text style={styles.switchDescription}>
            Recruiters can send you job opportunities
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.switch, jobSeekerProfile.allowRecruitersToContact && styles.switchActive]}
          onPress={() => handlePrivacyToggle('allowRecruitersToContact', !jobSeekerProfile.allowRecruitersToContact)}
        >
          <View style={[styles.switchThumb, jobSeekerProfile.allowRecruitersToContact && styles.switchThumbActive]} />
        </TouchableOpacity>
      </View>

      <View style={styles.switchContainer}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Open to Work</Text>
          <Text style={styles.switchDescription}>
            Display that you're actively looking for opportunities
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.switch, jobSeekerProfile.isOpenToWork && styles.switchActive]}
          onPress={() => handlePrivacyToggle('isOpenToWork', !jobSeekerProfile.isOpenToWork)}
        >
          <View style={[styles.switchThumb, jobSeekerProfile.isOpenToWork && styles.switchThumbActive]} />
        </TouchableOpacity>
      </View>

      <View style={styles.switchContainer}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Open to Refer</Text>
          <Text style={styles.switchDescription}>
            Others can request referrals from you at your workplace
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.switch, jobSeekerProfile.openToRefer && styles.switchActive]}
          onPress={() => handlePrivacyToggle('openToRefer', !jobSeekerProfile.openToRefer)}
        >
          <View style={[styles.switchThumb, jobSeekerProfile.openToRefer && styles.switchThumbActive]} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Load user data and extended profile on mount
  useEffect(() => {
    if (user) {
      setProfile({
        userID: user.UserID || '',
        firstName: user.FirstName || '',
        lastName: user.LastName || '',
        email: user.Email || '',
        phone: user.Phone || '',
        userType: user.UserType || '',
        dateOfBirth: user.DateOfBirth ? new Date(user.DateOfBirth).toISOString().split('T')[0] : '',
        gender: user.Gender || '',
        profilePictureURL: user.ProfilePictureURL || '',
        profileVisibility: user.ProfileVisibility || 'Public',
      });
      
      // Load extended profile based on user type
      loadExtendedProfile();
      // 🆕 NEW: Load wallet balance for job seekers
      if (userType === 'JobSeeker') {
        loadWalletBalance();
      }
    }
  }, [user]);

  // 🔧 NEW: Handle direct navigation and screen focus
  useFocusEffect(
    useCallback(() => {
      console.log('🎯 ProfileScreen focused');
      console.log('🎯 User at focus:', user ? { UserID: user.UserID, UserType: user.UserType } : 'No user');
      
      // ? NEW: Always scroll to top when screen gains focus
      try {
        if (scrollRef.current && typeof scrollRef.current.scrollTo === 'function') {
          scrollRef.current.scrollTo({ y:0, animated: false });
        }
        // For web fallback
        if (typeof window !== 'undefined' && window?.scrollTo) {
          window.scrollTo(0,0);
        }
      } catch (e) {
        console.warn('Failed to auto-scroll to top:', e);
      }
      
      if (user && user.UserID) {
        console.log('🎯 User found on focus, loading profile...');
        loadExtendedProfile();
      } else if (!loading) {
        console.log('🎯 No user found on focus, auth loading state:', loading);
      }
    }, [user, loading])
  );

  // 🔧 NEW: Force profile load on component mount (for direct URL navigation)
  useEffect(() => {
    console.log('🔍 ProfileScreen mounted, user present:', !!user);
    console.log('🔍 User data:', user ? { UserID: user.UserID, UserType: user.UserType } : 'No user');
    console.log('🔍 Auth loading state:', loading);
    
    if (user && user.UserID) {
      console.log('🔍 Triggering loadExtendedProfile for direct navigation...');
      loadExtendedProfile();
    } else if (!loading) {
      console.log('🔍 No user found but auth not loading - user might not be logged in');
    }
  }, []); // Empty dependency - runs once on mount

  const loadExtendedProfile = async () => {
    console.log('📡 loadExtendedProfile called');
    console.log('📡 User data:', user ? { UserID: user.UserID, UserType: user.UserType } : 'No user');
    
    if (!user || !user.UserID) {
      console.log('❌ No user or UserID found, skipping profile load');
      return;
    }
    
    try {
      console.log('🔄 Starting profile data load...');
      setRefreshing(true);
      
      if (userType === 'JobSeeker') {
        console.log('👤 Loading JobSeeker profile for UserID:', user.UserID);
        
        const response = await refopenAPI.getApplicantProfile(user.UserID);
        console.log('📊 JobSeeker profile API response:', response.success ? 'Success' : 'Failed');
        
        if (response.success) {
          console.log('✅ Profile data loaded successfully');
          const months = response.data.TotalExperienceMonths != null ? Number(response.data.TotalExperienceMonths) : null;
          const derivedYears = months != null && !isNaN(months) ? Math.round(months / 12) : (response.data.YearsOfExperience || 0);
          setJobSeekerProfile({
            // Personal Information
            nationality: response.data.Nationality || '',
            currentLocation: response.data.CurrentLocation || '',
            preferredLocations: response.data.PreferredLocations || '',
            
            // Social Profiles
            linkedInProfile: response.data.LinkedInProfile || '',
            githubProfile: response.data.GithubProfile || '',
            
            // Documents - NEW: Include resumes from new schema
            resumes: response.data.resumes || [],
            additionalDocuments: response.data.AdditionalDocuments || '',
            
            // Education
            highestEducation: response.data.HighestEducation || '',
            fieldOfStudy: response.data.FieldOfStudy || '',
            institution: response.data.Institution || '',
            graduationYear: response.data.GraduationYear || '',
            gpa: response.data.GPA || '',
            
            // Professional Information
            headline: response.data.Headline || '',
            summary: response.data.Summary || '',
            currentJobTitle: response.data.CurrentJobTitle || '',
            currentCompany: response.data.CurrentCompanyName || response.data.CurrentCompany || '',
            yearsOfExperience: derivedYears || 0,
            noticePeriod: response.data.NoticePeriod || 30,
            totalWorkExperience: '',
            
            // Job Preferences
            preferredJobTypes: response.data.PreferredJobTypes || '',
            preferredWorkTypes: response.data.PreferredWorkTypes || '',
            preferredRoles: response.data.PreferredRoles || '',
            preferredIndustries: response.data.PreferredIndustries || '',
            minimumSalary: response.data.MinimumSalary || 0, // keep numeric
            preferredCompanySize: response.data.PreferredCompanySize || '',
            
            // Skills and Experience
            primarySkills: response.data.PrimarySkills ? response.data.PrimarySkills.split(',').map(s => s.trim()).filter(s => s) : [],
            secondarySkills: response.data.SecondarySkills ? response.data.SecondarySkills.split(',').map(s => s.trim()).filter(s => s) : [],
            languages: response.data.Languages || '',
            certifications: response.data.Certifications || '',
            workExperience: response.data.WorkExperience || '',
            
            // Availability and Preferences
            immediatelyAvailable: response.data.ImmediatelyAvailable || false,
            willingToRelocate: response.data.WillingToRelocate || false,
            jobSearchStatus: response.data.JobSearchStatus || '',
            
            // Privacy Settings
            allowRecruitersToContact: response.data.AllowRecruitersToContact !== false,
            hideCurrentCompany: response.data.HideCurrentCompany === 1 || response.data.HideCurrentCompany === true,
            hideSalaryDetails: response.data.HideSalaryDetails === 1 || response.data.HideSalaryDetails === true,
            openToRefer: response.data.OpenToRefer !== false, // Default to true, only false if explicitly set
            
            // Status Fields
            isOpenToWork: response.data.IsOpenToWork !== false,
            isFeatured: response.data.IsFeatured || false,
            featuredUntil: response.data.FeaturedUntil || null,
            
            // 🆕 REFERRAL POINTS AND STATS
            ReferralPoints: response.data.ReferralPoints || 0,
            referralStats: response.data.referralStats || {
              totalReferralsMade: 0,
              verifiedReferrals: 0,
              referralRequestsMade: 0,
              totalPointsFromRewards: response.data.ReferralPoints || 0 // Use actual points
            },

            // 🔧 Load detailed points history for breakdown (will be loaded separately from API)
            pointsHistory: [], // Will be loaded from API
            pointTypeMetadata: {}, // Will be loaded from API
            
            // Additional
            tags: response.data.Tags || '',
            salaryBreakdown: response.data.salaryBreakdown || { current: [], expected: [] },
            
            // Legacy fields
            expectedSalary: response.data.minimumSalary?.toString() || '',
            currencyPreference: 'USD',
            location: response.data.CurrentLocation || '',
            relocatable: response.data.WillingToRelocate || false,
            remotePreference: response.data.PreferredWorkTypes || 'Hybrid',
            workAuthorization: '',
            resumeURL: response.data.primaryResumeURL || '',
            portfolioURL: '',
            personalWebsite: '',
            bio: response.data.Summary || '',
            industries: response.data.PreferredIndustries ? response.data.PreferredIndustries.split(',').map(s => s.trim()).filter(s => s) : [],
          });
        } else {
          console.log('❌ Failed to load JobSeeker profile:', response.error);
        }
      } else if (userType === 'Employer') {
        console.log('🏢 Loading Employer profile for UserID:', user.UserID);
        
        const response = await refopenAPI.getEmployerProfile(user.UserID);
        console.log('📊 Employer profile API response:', response.success ? 'Success' : 'Failed');
        
        if (response.success) {
          console.log('✅ Employer profile data loaded successfully');
          setEmployerProfile({
            jobTitle: response.data.JobTitle || '',
            department: response.data.Department || '',
            organizationName: response.data.OrganizationName || '',
            organizationSize: response.data.OrganizationSize || '',
            industry: response.data.Industry || '',
            canPostJobs: response.data.CanPostJobs !== false,
            canManageApplications: response.data.CanManageApplications !== false,
            canViewAnalytics: response.data.CanViewAnalytics || false,
            recruitmentFocus: response.data.RecruitmentFocus || '',
            linkedInProfile: response.data.LinkedInProfile || '',
            bio: response.data.Bio || '',
          });
        } else {
          console.log('❌ Failed to load Employer profile:', response.error);
        }
      }
    } catch (error) {
      console.error('❌ Error loading extended profile:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Stack trace:', error.stack);
    } finally {
      console.log('🔄 Profile load completed, setting refreshing to false');
      setRefreshing(false);
    }
  };

  // 🆕 NEW: Load wallet balance
  const loadWalletBalance = async () => {
    try {
      setLoadingWallet(true);
      const result = await refopenAPI.getWalletBalance();
      if (result.success) {
        setWalletBalance(result.data);
      }
    } catch (error) {
      console.error('Error loading wallet balance:', error);
    } finally {
      setLoadingWallet(false);
    }
  };

  // ? Smart profile save using field routing
  const handleSmartSave = async () => {
    try {
      setLoading(true);
      
      console.log('Starting smart profile save...');
      
      // Combine all profile data (Users + Applicants table fields)
      const completeProfileData = {
        // Users table fields
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: profile.phone?.trim(),
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        profilePictureURL: profile.profilePictureURL?.trim(),
        profileVisibility: profile.profileVisibility,
        
        // Applicants table fields
        ...jobSeekerProfile,
        primarySkills: Array.isArray(jobSeekerProfile.primarySkills) 
          ? jobSeekerProfile.primarySkills.join(', ') 
          : jobSeekerProfile.primarySkills,
        secondarySkills: Array.isArray(jobSeekerProfile.secondarySkills) 
          ? jobSeekerProfile.secondarySkills.join(', ') 
          : jobSeekerProfile.secondarySkills, // ? UPDATED: Handle secondary skills array
      };
      
      console.log('Complete profile data:', Object.keys(completeProfileData));
      
      const result = await updateCompleteProfile(completeProfileData);
      
      if (result.success) {
        setEditing(false);
        
        let message = 'Profile updated successfully!';
        if (result.usersUpdated && result.applicantsUpdated) {
          message = 'Complete profile updated successfully!';
        } else if (result.usersUpdated) {
          message = 'Basic profile information updated successfully!';
        } else if (result.applicantsUpdated) {
          message = 'Professional profile updated successfully!';
        }
        
        if (result.errors && result.errors.length > 0) {
          message += `\n\nNote: ${result.errors.length} minor issue(s) occurred.`;
        }
        
        Alert.alert('Success', message);
        return true;
      } else {
        Alert.alert('Update Failed', result.error || 'Failed to update profile');
        return false;
      }
    } catch (error) {
      console.error('Smart profile save error:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ? SECTION-SPECIFIC SAVE METHODS (Reusing the same API pattern as bottom edit button)

  /**
   * Save personal information section
   */
  const savePersonalInfo = async (updatedData) => {
    try {
      setLoading(true);
      
      // Validate required fields
      const firstName = updatedData.firstName || profile.firstName;
      const lastName = updatedData.lastName || profile.lastName;
      
      if (!firstName?.trim()) {
        Alert.alert('Validation Error', 'First name is required');
        return false;
      }
      
      if (!lastName?.trim()) {
        Alert.alert('Validation Error', 'Last name is required');
        return false;
      }
      
      // Update local state first
      setProfile(prev => ({
        ...prev,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: updatedData.phone || prev.phone,
        dateOfBirth: updatedData.dateOfBirth || prev.dateOfBirth,
        gender: updatedData.gender || prev.gender,
      }));
      
      const result = await handleSmartSave();
      return result;
    } catch (error) {
      console.error('Failed to save personal info:', error);
      Alert.alert('Error', error.message || 'Failed to update personal information');
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save account settings section
   */
  const saveAccountSettings = async (updatedData) => {
    try {
      setLoading(true);
      
      // Update local state first
      setProfile(prev => ({
        ...prev,
        profileVisibility: updatedData.profileVisibility || prev.profileVisibility,
      }));
      
      const result = await handleSmartSave();
      return result;
    } catch (error) {
      console.error('Failed to save account settings:', error);
      Alert.alert('Error', error.message || 'Failed to update account settings');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Small helper component to switch based on section editing context
  const SectionSwitch = ({ view, children }) => {
    const sectionEditing = useEditing();
    return sectionEditing ? children : view;
  };

  // Helper compact read-only renderer for Professional Info (no textbox look)
  const ReadOnlyKVRow = ({ label, value, icon = 'information-circle' }) => (
    <View style={styles.kvRow}>
      <View style={styles.kvLeft}>
        <Ionicons name={icon} size={14} color={colors.gray500 || '#6B7280'} />
        <Text style={styles.kvLabel}>{label}</Text>
      </View>
      <Text
        style={[styles.kvValue, !value && styles.kvValueEmpty]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {value || 'Not specified'}
      </Text>
    </View>
  );

  // Edit-aware wrapper that lives inside ProfileSection context
  const EditAware = ({ view, children }) => {
    const sectionEditing = useEditing();
    return sectionEditing ? <>{children}</> : view;
  };

  // Helper function to check if a section has meaningful data
  const hasData = (sectionType, data = {}) => {
    switch (sectionType) {
      case 'skills':
        return (data.primarySkills && data.primarySkills.length > 0) ||
               (data.secondarySkills && data.secondarySkills.length > 0) ||
               (data.languages && data.languages.trim()) ||
               (data.certifications && data.certifications.trim());
      
      case 'workPreferences':
        return (data.minimumSalary && data.minimumSalary > 0) ||
               (data.preferredWorkTypes && data.preferredWorkTypes.trim()) ||
               (data.preferredJobTypes && data.preferredJobTypes.trim()) ||
               (data.preferredLocations && data.preferredLocations.trim()) ||
               (data.preferredCompanySize && data.preferredCompanySize.trim());
      
      case 'salaryBreakdown':
        return data.salaryBreakdown && 
               ((data.salaryBreakdown.current && data.salaryBreakdown.current.length > 0) ||
                (data.salaryBreakdown.expected && data.salaryBreakdown.expected.length > 0));
      
      case 'resumes':
        return data.resumes && data.resumes.length > 0;
      
      case 'onlinePresence':
        return (data.linkedInProfile && data.linkedInProfile.trim()) ||
               (data.githubProfile && data.githubProfile.trim());
      
      case 'personalInfo':
        return (data.firstName && data.firstName.trim()) ||
               (data.lastName && data.lastName.trim()) ||
               (data.phone && data.phone.trim()) ||
               (data.dateOfBirth && data.dateOfBirth.trim()) ||
               (data.gender && data.gender.trim());
      
      case 'accountSettings':
        // Always show account settings since userType is always present
        return true;
      
      case 'privacySettings':
        // Always show privacy settings as they're important
        return true;
      
      default:
        return false;
    }
  };

  // Helper to handle referral navigation (implement actual navigation later)
  const handleReferralNavigation = useCallback(() => {
    // TODO: Navigate to ReferralScreen
    // navigation.navigate('Referrals');
    console.log('Navigate to Referrals Screen');
  }, []);

  // Helper to show referral points details
  const showReferralPointsDetails = useCallback(() => {
    const points = Number(jobSeekerProfile.ReferralPoints) || 0;
    const stats = jobSeekerProfile.referralStats || {};
    
    Alert.alert(
      '🏆 Referral Points System',
      `You have ${points} referral points!\n\n` +
      `📊 Your Statistics:\n` +
      `• Referrals Made: ${Number(stats.totalReferralsMade) || 0}\n` +
      `• Successfully Verified: ${Number(stats.verifiedReferrals) || 0}\n` +
      `• Requests Made: ${Number(stats.referralRequestsMade) || 0}\n` +
      `• Total Rewards Earned: ${Number(stats.totalPointsFromRewards) || 0}\n\n` +
      `💡 How to Earn More Points:\n` +
      `• Submit proof of referrals: +15 points\n` +
      `• Get referrals verified: +25 points\n` +
      `• Quick responses (< 24hrs): +10 bonus\n` +
      `• Maximum per referral: 50 points`,
      [
        { text: 'Got it!', style: 'default' },
        { 
          text: 'View Referrals', 
          style: 'default',
          onPress: handleReferralNavigation
        }
      ]
    );
  }, [jobSeekerProfile.ReferralPoints, jobSeekerProfile.referralStats, handleReferralNavigation]);

  // Render the profile screen UI
  return (
    <KeyboardAvoidingView 
  style={{ flex: 1 }} 
 behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {/* 🆕 STICKY HEADER */}
      <View style={styles.stickyHeader}>
    {/* 🆕 Animated Profile Picture (appears on scroll) */}
        {showHeaderProfilePic && (
          <Animated.View 
        style={[
           styles.headerProfilePic,
 {
          opacity: headerProfileOpacity,
        transform: [{ scale: headerProfileScale }]
     }
       ]}
          >
<TouchableOpacity 
   onPress={scrollToTop}
activeOpacity={0.8}
      >
       {profile?.profilePictureURL ? (
     <Image 
          source={{ uri: profile.profilePictureURL }} 
       style={styles.headerProfileImage}
      />
          ) : (
   <View style={styles.headerProfilePlaceholder}>
    <Text style={styles.headerInitials}>
             {`${profile?.firstName?.charAt(0) || ''}${profile?.lastName?.charAt(0) || ''}`.toUpperCase()}
   </Text>
       </View>
              )}
      </TouchableOpacity>
          </Animated.View>
        )}

        {/* Left spacer to balance the layout */}
        <View style={styles.headerSpacer} />

   <Text style={styles.title}>Profile</Text>
     
        {/* 🆕 NEW: Compact Wallet Button in Header */}
        {userType === 'JobSeeker' ? (
          <TouchableOpacity 
    style={styles.walletHeaderButton}
            onPress={() => navigation.navigate('Wallet')}
    activeOpacity={0.7}
       >
   <Ionicons name="wallet" size={16} color={colors.primary} />
            {loadingWallet ? (
  <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 4 }} />
      ) : (
        <Text style={styles.walletHeaderAmount}>
     ₹{walletBalance?.balance?.toFixed(0) || '0'}
   </Text>
            )}
   </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
    )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.container} 
      contentContainerStyle={styles.contentContainer}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
       { useNativeDriver: false }
  )}
        scrollEventThrottle={16}
        refreshControl={
      <RefreshControl
            refreshing={refreshing}
    onRefresh={loadExtendedProfile}
          colors={[colors.primary]}
       />
        }
      >
        {/* REMOVED OLD HEADER - Now sticky at top */}

        {/* REMOVED: Large wallet card - no longer needed */}

   <UserProfileHeader
          user={user}
          profile={profile}
          jobSeekerProfile={jobSeekerProfile}
          employerProfile={employerProfile}
          userType={userType}
          onProfileUpdate={(updatedProfile) => {
            setProfile(prev => ({ ...prev, ...updatedProfile }));
            loadExtendedProfile();
          }}
          showStats={false}
        />
        
        {userType === 'JobSeeker' ? (
          <>
            {/* 1. PROFESSIONAL INFORMATION */}
            <ProfileSection 
              title="Professional Information" 
              icon="briefcase"
              editing={editing}
              onUpdate={(updatedData) => console.log('Professional info updated:', updatedData)}
              onSave={() => saveProfessionalInfo(jobSeekerProfile)}
              defaultCollapsed={false}
            >
              <EditAware
                view={
                  <View>
                    <ReadOnlyKVRow label="Professional Headline" value={jobSeekerProfile.headline} icon="briefcase" />
                    {/* Professional Summary is now shown in the header, so omit it here in view mode */}
                    <ReadOnlyKVRow label="Current Location" value={jobSeekerProfile.currentLocation} icon="location" />
                    <ReadOnlyKVRow label="Current Job Title" value={jobSeekerProfile.currentJobTitle} icon="medal" />
                    <ReadOnlyKVRow label="Current Company" value={jobSeekerProfile.currentCompany} icon="business" />
                    <ReadOnlyKVRow label="Total Years of Experience" value={(jobSeekerProfile.yearsOfExperience || 0).toString()} icon="time" />
                  </View>
                }
              >
                <>
                  {/* Order: Headline -> Summary -> Current Location -> Job Title (derived) -> Current Company (derived) -> Total YOE (derived) */}
                  <ProfileField fieldKey="headline" label="Professional Headline" placeholder="e.g., Senior Software Engineer" options={{ profileType: 'jobSeeker' }} />
                  <ProfileField fieldKey="summary" label="Professional Summary" placeholder="Tell us about yourself..." options={{ multiline: true, profileType: 'jobSeeker' }} />
                  <ProfileField fieldKey="currentLocation" label="Current Location" placeholder="City, Country" options={{ profileType: 'jobSeeker' }} />
                  <ProfileField fieldKey="currentJobTitle" label="Current Job Title" placeholder="Auto-derived from latest work experience" options={{ profileType: 'jobSeeker', editable: false }} />
                  <ProfileField fieldKey="currentCompany" label="Current Company" placeholder="Auto-derived from latest work experience" options={{ profileType: 'jobSeeker', editable: false }} />
                  <ProfileField fieldKey="yearsOfExperience" label="Total Years of Experience" placeholder="Auto-calculated" options={{ keyboardType: 'numeric', profileType: 'jobSeeker', editable: false }} />
                </>
              </EditAware>
            </ProfileSection>

            {/* 2. EDUCATION */}
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
              onUpdate={(updatedEducation) => {
                console.log('Education updated:', updatedEducation);
              }}
            />

            {/* 3. WORK EXPERIENCE */}
            <ProfileSection
              title="Work Experience"
              icon="briefcase"
              editing={editing}
              onSave={() => Promise.resolve(true)}
              hideSaveButton
              defaultCollapsed={false}
            >
              <WorkExperienceSection />
            </ProfileSection>

            {/* 4. SKILLS & EXPERTISE */}
            <ProfileSection 
              title="Skills & Expertise" 
              icon="bulb"
              editing={editing}
              onUpdate={(updatedData) => console.log('Skills updated:', updatedData)}
              onSave={() => saveSkillsExpertise(jobSeekerProfile)}
              defaultCollapsed={!hasData('skills', jobSeekerProfile)}
            >
              <EditAware
                view={
                  <View>
                    <ReadOnlyKVRow label="Primary Skills" value={(jobSeekerProfile.primarySkills || []).join(', ')} icon="star" />
                    <ReadOnlyKVRow label="Secondary Skills" value={(jobSeekerProfile.secondarySkills || []).join(', ')} icon="star-outline" />
                  </View>
                }
              >
                <>
                  <SkillsSection />
                  <ProfileField fieldKey="languages" label="Languages" placeholder="e.g., English (Fluent), Spanish (Basic)" options={{ profileType: 'jobSeeker' }} />
                  <ProfileField fieldKey="certifications" label="Certifications" placeholder="Professional certifications" options={{ multiline: true, profileType: 'jobSeeker' }} />
                </>
              </EditAware>
            </ProfileSection>

            {/* 5. WORK PREFERENCES */}
            <ProfileSection 
              title="Work Preferences" 
              icon="settings"
              editing={editing}
              onUpdate={(updatedData) => console.log('Preferences updated:', updatedData)}
              onSave={() => saveWorkPreferences(jobSeekerProfile)}
              defaultCollapsed={!hasData('workPreferences', jobSeekerProfile)}
            >
              <EditAware
                view={
                  <View>
                    <ReadOnlyKVRow label="Minimum Salary" value={(jobSeekerProfile.minimumSalary || 0).toString()} icon="cash" />
                    <ReadOnlyKVRow label="Work Style Preference" value={jobSeekerProfile.preferredWorkTypes} icon="home" />
                    <ReadOnlyKVRow label="Preferred Job Types" value={jobSeekerProfile.preferredJobTypes} icon="briefcase" />
                    <ReadOnlyKVRow label="Preferred Locations" value={jobSeekerProfile.preferredLocations} icon="location" />
                    <ReadOnlyKVRow label="Preferred Company Size" value={jobSeekerProfile.preferredCompanySize} icon="people" />
                  </View>
                }
              >
                <>
                  <ProfileField fieldKey="minimumSalary" label="Minimum Salary" placeholder="0" options={{ keyboardType: 'numeric', profileType: 'jobSeeker' }} />
                  <ProfileField fieldKey="preferredWorkTypes" label="Work Style Preference" placeholder="" options={{ choices: ['Remote', 'Hybrid', 'On-site'], profileType: 'jobSeeker' }} />
                  <ProfileField fieldKey="preferredJobTypes" label="Preferred Job Types" placeholder="e.g., Full-time, Contract" options={{ profileType: 'jobSeeker' }} />
                  <ProfileField fieldKey="preferredLocations" label="Preferred Locations" placeholder="Cities/countries you'd like to work in" options={{ profileType: 'jobSeeker' }} />
                  <ProfileField fieldKey="preferredCompanySize" label="Preferred Company Size" placeholder="e.g., Startup, Mid-size, Enterprise" options={{ profileType: 'jobSeeker' }} />
                </>
              </EditAware>
            </ProfileSection>

            {/* 6. SALARY BREAKDOWN */}
            <ProfileSection
              title="Salary Breakdown"
              icon="cash"
              editing={editing}
              onSave={() => Promise.resolve(true)}
              defaultCollapsed={!hasData('salaryBreakdown', jobSeekerProfile)}
            >
              <EditAware
                view={
                  <SalaryBreakdownSection
                    profile={{ UserID: user?.UserID, salaryBreakdown: jobSeekerProfile.salaryBreakdown }}
                    setProfile={() => {}}
                    editing={false}
                    onUpdate={() => {}}
                    embedded
                    compact
                  />
                }
              >
                <SalaryBreakdownSection
                  profile={{ UserID: user?.UserID, salaryBreakdown: jobSeekerProfile.salaryBreakdown }}
                  setProfile={(updated) => {
                    if (updated.salaryBreakdown) {
                      setJobSeekerProfile(prev => ({ ...prev, salaryBreakdown: updated.salaryBreakdown }));
                    }
                  }}
                  editing
                  onUpdate={(updated) => {
                    if (updated.salaryBreakdown) {
                      setJobSeekerProfile(prev => ({ ...prev, salaryBreakdown: updated.salaryBreakdown }));
                    }
                  }}
                />
              </EditAware>
            </ProfileSection>

            {/* 7. RESUMES & DOCUMENTS */}
            <ProfileSection 
              title="Resumes & Documents" 
              icon="document-text"
              editing={editing}
              onUpdate={(updatedData) => console.log('Resumes updated:', updatedData)}
              onSave={() => Promise.resolve(true)}
              defaultCollapsed={!hasData('resumes', jobSeekerProfile)}
            >
              <ResumeSection
                profile={{ ...jobSeekerProfile, UserID: user?.UserID }}
                setProfile={(updatedProfile) => {
                  setJobSeekerProfile(prev => ({
                    ...prev,
                    ...updatedProfile
                  }));
                }}
                onUpdate={(updatedData) => {
                  console.log('Resume section updated:', updatedData);
                  // ✅ REMOVED: if (onUpdate) call since onUpdate doesn't exist in ProfileScreen scope
                  // The resume upload success is already handled by the ResumeSection internally
                }}
              />
            </ProfileSection>

            {/* 8. ONLINE PRESENCE */}
            <ProfileSection 
              title="Online Presence" 
              icon="link"
              editing={editing}
              onUpdate={(updatedData) => console.log('Online presence updated:', updatedData)}
              onSave={() => saveOnlinePresence(jobSeekerProfile)}
              defaultCollapsed={!hasData('onlinePresence', jobSeekerProfile)}
            >
              <EditAware
                view={
                  <View>
                    <ReadOnlyKVRow label="LinkedIn" value={jobSeekerProfile.linkedInProfile} icon="logo-linkedin" />
                    <ReadOnlyKVRow label="GitHub" value={jobSeekerProfile.githubProfile} icon="logo-github" />
                  </View>
                }
              >
                <>
                  <ProfileField fieldKey="linkedInProfile" label="LinkedIn Profile" placeholder="linkedin.com/in/yourprofile" options={{ profileType: 'jobSeeker' }} />
                  <ProfileField fieldKey="githubProfile" label="GitHub Profile" placeholder="github.com/yourusername" options={{ profileType: 'jobSeeker' }} />
                </>
              </EditAware>
            </ProfileSection>

            {/* 9. PERSONAL INFORMATION */}
            <ProfileSection 
              title="Personal Information" 
              icon="person"
              editing={editing}
              onUpdate={(updatedData) => console.log('Personal info updated:', updatedData)}
              onSave={() => savePersonalInfo({ ...profile, ...jobSeekerProfile })}
              defaultCollapsed={!hasData('personalInfo', profile)}
            >
              <EditAware
                view={
                  <View>
                    <ReadOnlyKVRow label="First Name" value={profile.firstName} icon="person" />
                    <ReadOnlyKVRow label="Last Name" value={profile.lastName} icon="person" />
                    <ReadOnlyKVRow label="Email" value={profile.email} icon="mail" />
                    <ReadOnlyKVRow label="Phone" value={profile.phone} icon="call" />
                    <ReadOnlyKVRow label="Date of Birth" value={profile.dateOfBirth} icon="calendar" />
                    <ReadOnlyKVRow label="Gender" value={profile.gender} icon="male-female" />
                  </View>
                }
              >
                <>
                  <ProfileField fieldKey="firstName" label="First Name *" placeholder="Enter your first name" />
                  <ProfileField fieldKey="lastName" label="Last Name *" placeholder="Enter your last name" />
                  <ProfileField fieldKey="email" label="Email Address *" placeholder="Enter your email" options={{ keyboardType: 'email-address', editable: false }} />
                  <ProfileField fieldKey="phone" label="Phone Number" placeholder="Enter your phone number" options={{ keyboardType: 'phone-pad' }} />
                  <ProfileField fieldKey="dateOfBirth" label="Date of Birth" placeholder="YYYY-MM-DD" options={{ keyboardType: 'numeric' }} />
                  <ProfileField fieldKey="gender" label="Gender" placeholder="" options={{ choices: genderOptions }} />
                </>
              </EditAware>
            </ProfileSection>

            {/* 10. ACCOUNT SETTINGS */}
            <ProfileSection 
              title="Account Settings" 
              icon="cog"
              editing={editing}
              onUpdate={(updatedData) => console.log('Account settings updated:', updatedData)}
              onSave={() => saveAccountSettings(profile)}
              defaultCollapsed={!hasData('accountSettings', profile)}
            >
              <EditAware
                view={
                  <View>
                    <ReadOnlyKVRow label="Account Type" value={profile.userType} icon="person-outline" />
                    <ReadOnlyKVRow label="Profile Visibility" value={profile.profileVisibility} icon="eye" />
                  </View>
                }
              >
                <>
                  <ProfileField fieldKey="userType" label="Account Type" placeholder="" options={{ editable: false }} />
                  <ProfileField fieldKey="profileVisibility" label="Profile Visibility" placeholder="" options={{ choices: visibilityOptions }} />
                </>
              </EditAware>
            </ProfileSection>

            {/* 11. PRIVACY SETTINGS */}
            <ProfileSection 
              title="Privacy Settings" 
              icon="shield-checkmark"
              editing={editing}
              onUpdate={(updatedData) => console.log('Privacy settings updated:', updatedData)}
              onSave={() => Promise.resolve(true)}
              defaultCollapsed={!hasData('privacySettings', jobSeekerProfile)}
              hideHeaderActions
            >
              {renderPrivacySettingsContent()}
            </ProfileSection>
          </>
        ) : (
          // Employer branch unchanged
          <>
            {/* EMPLOYER: reorder similarly if needed */}
          </>
        )}

        {/* GLOBAL ACTIONS */}
        {editing && (
          <View style={styles.actions}>
            <TouchableOpacity 
              onPress={() => setEditing(false)} 
              style={[styles.actionButton, styles.cancelButton]}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleSmartSave} 
              style={styles.actionButton}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}

        {!editing && (
          <View style={styles.logoutSection}>
            <TouchableOpacity 
              onPress={() => setShowLogoutModal(true)} 
              style={styles.logoutMainButton}
              disabled={loading}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.danger || '#FF3B30'} />
              <Text style={styles.logoutMainButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {/* Compliance Footer with legal links */}
        <ComplianceFooter currentPage="profile" />
      </ScrollView>

      {/* Skills Modal */}
      <Modal
        visible={showSkillsModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSkillsModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Add {skillType === 'primary' ? 'Primary' : 'Secondary'} Skill
            </Text>
            <TouchableOpacity onPress={addSkill}>
              <Text style={styles.addButton}>Add</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <Text style={styles.skillTypeDescription}>
              {skillType === 'primary' 
                ? 'Primary skills are your core competencies and main areas of expertise.'
                : 'Secondary skills are additional abilities that complement your primary skills.'
              }
            </Text>
            <TextInput
              style={styles.skillInput}
              value={newSkill}
              onChangeText={setNewSkill}
              placeholder={`Enter a ${skillType} skill...`}
              autoFocus
            />
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
      >
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalContainer}>
            <View style={styles.logoutModalIconContainer}>
              <Ionicons name="log-out-outline" size={48} color={colors.danger} />
            </View>

            <Text style={styles.logoutModalTitle}>Logout</Text>
            
            <Text style={styles.logoutModalMessage}>
              Are you sure you want to logout? You'll need to sign in again to access your account.
            </Text>

            <View style={styles.logoutModalButtons}>
              <TouchableOpacity
                style={styles.logoutModalCancelButton}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.logoutModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoutModalConfirmButton}
                onPress={() => {
                  setShowLogoutModal(false);
                  logout();
                }}
              >
                <Text style={styles.logoutModalConfirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 0, // Remove top padding since we have sticky header
    paddingBottom: 32,
  },
  
  // 🆕 STICKY HEADER STYLES
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    height: 64, // Fixed height to prevent shaking
    backgroundColor: colors.background || '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  
  // 🆕 Header spacer to balance layout
  headerSpacer: {
    width: 70, // Match the wallet button width
  },
  
  // 🆕 ANIMATED HEADER PROFILE PIC STYLES
  headerProfilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'absolute',
    left: 20,
    zIndex: 1,
  },
  headerProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerProfilePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInitials: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary || colors.text,
    letterSpacing: 0.3,
  },
  
  // 🆕 NEW: Compact wallet button in header
  walletHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    gap: 4,
    minWidth: 70,
    justifyContent: 'center',
  },
  walletHeaderAmount: {
    fontSize: typography.sizes?.sm || 14,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.primary,
    marginLeft: 2,
  },

  // Field styles
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: typography.sizes?.sm || 14,
    fontWeight: typography.weights?.medium || '500',
    color: colors.gray600 || colors.gray || '#666666',
    marginBottom: 8,
  },
  fieldValue: {
    fontSize: typography.sizes?.md || 16,
    color: colors.text || '#000000',
    paddingVertical: 4,
  },
  fieldInput: {
    backgroundColor: colors.background || '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: typography.sizes?.md || 16,
    color: colors.text || '#000000',
  },
  
  // ? NEW: Salary input styles
  salaryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background || '#FFFFFF',
  },
  currencyPrefix: {
    paddingLeft: 12,
    paddingRight: 8,
    fontSize: typography.sizes?.md || 16,
    color: colors.primary || '#007AFF',
    fontWeight: typography.weights?.bold || 'bold',
  },
  salaryInput: {
    flex: 1,
    borderWidth: 0,
    paddingLeft: 0,
    paddingRight: 8,
  },
  currencySuffix: {
    paddingLeft: 8,
    paddingRight: 12,
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600 || '#666666',
    fontWeight: typography.weights?.medium || '500',
  },
  
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: colors.danger || '#FF3B30',
    fontSize: typography.sizes?.sm || 14,
    marginTop: 4,
  },
  choicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
    backgroundColor: colors.background || '#FFFFFF',
  },
  choiceButtonActive: {
    backgroundColor: colors.primary || '#007AFF',
    borderColor: colors.primary || '#007AFF',
  },
  choiceButtonText: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.text || '#000000',
  },
  choiceButtonTextActive: {
    color: colors.white || '#FFFFFF',
  },
  
  // Skills styles
  skillsSection: {
    marginBottom: 20,
  },
  skillsSubsection: {
    marginBottom: 16,
  },
  skillsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addSkillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  addSkillText: {
    color: colors.primary || '#007AFF',
    fontSize: typography.sizes?.sm || 14,
    marginLeft: 4,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 32, // Ensure space for empty state text
  },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary || '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillText: {
    color: colors.white || '#FFFFFF',
    fontSize: typography.sizes?.sm || 14,
  },
  removeSkillButton: {
    marginLeft: 8,
    padding: 2,
  },
  
  // ? NEW: Secondary skill styles
  secondarySkillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray200 || '#E5E7EB',
    borderWidth: 1,
    borderColor: colors.gray300 || '#D1D5DB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  secondarySkillText: {
    color: colors.gray700 || '#374151',
    fontSize: typography.sizes?.sm || 14,
  },
  removeSecondarySkillButton: {
    marginLeft: 8,
    padding: 2,
  },
  noSkillsText: {
    color: colors.gray500 || '#6B7280',
    fontSize: typography.sizes?.sm || 14,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  
  // Privacy and switch styles
  privacyContainer: {
    gap: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: typography.sizes?.md || 16,
    color: colors.text || '#000000',
    fontWeight: typography.weights?.medium || '500',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600 || colors.gray || '#666666',
    lineHeight: 18,
    marginTop: 2,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.gray300 || '#CCCCCC',
    justifyContent: 'center',
    padding: 2,
    marginTop: 4,
  },
  switchActive: {
    backgroundColor: colors.primary || '#007AFF',
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white || '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  switchThumbActive: {
    marginLeft: 'auto',
  },
  
 // Logout button styles
  logoutSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  logoutMainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoutMainButtonText: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.medium || '500',
    color: colors.danger || '#FF3B30',
    marginLeft: 8,
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.sizes?.lg || 18,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
  },
  addButton: {
    fontSize: typography.sizes?.md || 16,
    color: colors.primary,
    fontWeight: typography.weights?.medium || '500',
  },
  modalContent: {
    padding: 20,
  },
  skillTypeDescription: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.gray600 || '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  skillInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: typography.sizes?.md || 16,
    color: colors.text,
  },
  
  // Logout Modal Styles
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoutModalContainer: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  logoutModalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.danger + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutModalTitle: {
    fontSize: typography.sizes?.xl || 24,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  logoutModalMessage: {
    fontSize: typography.sizes?.md || 16,
    color: colors.gray600,
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
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logoutModalCancelText: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.medium || '500',
    color: colors.text,
  },
  logoutModalConfirmButton: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logoutModalConfirmText: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.bold || 'bold',
    color: colors.white,
  },

  // Key-Value row styles for read-only professional info
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: (colors.border || '#E5E7EB') + '70',
  },
  kvLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 160,
    paddingRight: 8,
  },
  kvLabel: {
    fontSize: typography.sizes?.xs || 12,
    color: colors.gray600 || '#6B7280',
    fontWeight: typography.weights?.medium || '500',
  },
  kvValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: typography.sizes?.sm || 14,
    color: colors.text || '#111827',
    paddingLeft: 12,
  },
  kvValueEmpty: {
    color: colors.gray400 || '#9CA3AF',
    fontStyle: 'italic',
  },
  kvMultiline: {
    fontSize: typography.sizes?.sm || 14,
    color: colors.text || '#111827',
    lineHeight: 18,
    marginTop: 2,
  },
  
  // Action button styles
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 16,
  },
actionButton: {
    flex: 1,
    backgroundColor: colors.primary || '#007AFF',
    borderRadius: 12,
 paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background || '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
  },
  actionButtonText: {
    fontSize: typography.sizes?.md || 16,
    fontWeight: typography.weights?.semibold || '600',
    color: colors.white || '#FFFFFF',
  },
  
  // Loading overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
 left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
});