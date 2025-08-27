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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography } from '../../styles/theme';
import nexhireAPI from '../../services/api';
import EducationSection from '../../components/profile/EducationSection';
import SalaryBreakdownSection from '../../components/profile/SalaryBreakdownSection';
import ProfileSection, { useEditing } from '../../components/profile/ProfileSection';
import UserProfileHeader from '../../components/profile/UserProfileHeader';

export default function ProfileScreen() {
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
    preferredLocations: '',
    
    // Social Profiles
    linkedInProfile: '',
    githubProfile: '',
    
    // Documents
    primaryResumeURL: '',
    additionalDocuments: '',
    
    // Education (? Enhanced with GraduationYear and GPA)
    highestEducation: '',
    fieldOfStudy: '',
    institution: '',
    graduationYear: '>',
    gpa: '',
    
    // Professional Information
    headline: '',
    summary: '',
    currentJobTitle: '',
    currentCompany: '',
    yearsOfExperience: 0,
    noticePeriod: 30,
    totalWorkExperience: '',
    
    // Job Preferences
    preferredJobTypes: '',
    preferredWorkTypes: '',
    preferredRoles: '',
    preferredIndustries: '',
    minimumSalary: 0, // ? ENSURE CORRECT FIELD NAME
    preferredCompanySize: '',
    
    // Skills and Experience - ? UPDATED: secondarySkills as array
    primarySkills: [],
    secondarySkills: [], // ? CHANGED: Now an array like primarySkills
    languages: '',
    certifications: '',
    workExperience: '',
    
    // Availability and Preferences
    immediatelyAvailable: false,
    willingToRelocate: false,
    jobSearchStatus: '',
    
    // ? Privacy Settings (THE MAIN FIX!)
    allowRecruitersToContact: true,
    hideCurrentCompany: false,      // This will now work!
    hideSalaryDetails: false,       // This will now work!
    
    // Status Fields
    isOpenToWork: true,
    isFeatured: false,
    featuredUntil: null,
    
    // Additional
    tags: '',
    
    // Legacy fields (kept for backward compatibility)
    expectedSalary: '',
    currencyPreference: 'USD',
    location: '',
    relocatable: false,
    remotePreference: 'Hybrid',
    workAuthorization: '',
    resumeURL: '',
    portfolioURL: '',
    personalWebsite: '',
    bio: '',
    industries: [],
  });

  const [employerProfile, setEmployerProfile] = useState({
    jobTitle: '',
    department: '',
    organizationName: '',
    organizationSize: '',
    industry: '',
    canPostJobs: true,
    canManageApplications: true,
    canViewAnalytics: false,
    recruitmentFocus: '',
    linkedInProfile: '',
    bio: '',
  });

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

  const validatePhoneNumber = (phone) => {
    if (!phone) return true; // Optional field
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
      const result = await nexhireAPI.updateEmployerProfile(user.UserID, updatedData);
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
      console.log(`??? Toggling ${setting} to ${value} using smart update...`);
      
      const result = await togglePrivacySetting(setting, value);
      
      if (result.success) {
        // Update local state immediately
        setJobSeekerProfile(prev => ({ ...prev, [setting]: value }));
        
        // Show success message
        const settingNames = {
          hideCurrentCompany: 'Hide Current Company',
          hideSalaryDetails: 'Hide Salary Details',
          allowRecruitersToContact: 'Allow Recruiters to Contact',
          isOpenToWork: 'Open to Work'
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

  // ??? Privacy Settings Content 
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
    }
  }, [user]);

  const loadExtendedProfile = async () => {
    try {
      setRefreshing(true);
      if (userType === 'JobSeeker') {
        const response = await nexhireAPI.getApplicantProfile(user.UserID);
        if (response.success) {
          setJobSeekerProfile({
            // Personal Information
            nationality: response.data.Nationality || '',
            currentLocation: response.data.CurrentLocation || '',
            preferredLocations: response.data.PreferredLocations || '',
            
            // Social Profiles
            linkedInProfile: response.data.LinkedInProfile || '',
            githubProfile: response.data.GithubProfile || '',
            
            // Documents
            primaryResumeURL: response.data.PrimaryResumeURL || '',
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
            currentCompany: response.data.CurrentCompany || '',
            yearsOfExperience: response.data.YearsOfExperience || 0,
            noticePeriod: response.data.NoticePeriod || 30,
            totalWorkExperience: response.data.TotalWorkExperience || '',
            
            // Job Preferences
            preferredJobTypes: response.data.PreferredJobTypes || '',
            preferredWorkTypes: response.data.PreferredWorkTypes || '',
            preferredRoles: response.data.PreferredRoles || '',
            preferredIndustries: response.data.PreferredIndustries || '',
            minimumSalary: response.data.MinimumSalary || 0, // ? ENSURE CORRECT FIELD NAME
            preferredCompanySize: response.data.PreferredCompanySize || '',
            
            // Skills and Experience
            primarySkills: response.data.PrimarySkills ? response.data.PrimarySkills.split(',').map(s => s.trim()).filter(s => s) : [],
            secondarySkills: response.data.SecondarySkills ? response.data.SecondarySkills.split(',').map(s => s.trim()).filter(s => s) : [], // ? UPDATED: Parse as array
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
            
            // Status Fields
            isOpenToWork: response.data.IsOpenToWork !== false,
            isFeatured: response.data.IsFeatured || false,
            featuredUntil: response.data.FeaturedUntil || null,
            
            // Additional
            tags: response.data.Tags || '',
            salaryBreakdown: response.data.salaryBreakdown || { current: [], expected: [] },
            
            // Legacy fields (for backward compatibility)
            expectedSalary: response.data.minimumSalary?.toString() || '',
            currencyPreference: 'USD',
            location: response.data.CurrentLocation || '',
            relocatable: response.data.WillingToRelocate || false,
            remotePreference: response.data.PreferredWorkTypes || 'Hybrid',
            workAuthorization: '',
            resumeURL: response.data.PrimaryResumeURL || '',
            portfolioURL: '',
            personalWebsite: '',
            bio: response.data.Summary || '',
            industries: response.data.PreferredIndustries ? response.data.PreferredIndustries.split(',').map(s => s.trim()).filter(s => s) : [],
          });
        }
      } else if (userType === 'Employer') {
        const response = await nexhireAPI.getEmployerProfile(user.UserID);
        if (response.success) {
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
        }
      }
    } catch (error) {
      console.error('Error loading extended profile:', error);
    } finally {
      setRefreshing(false);
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

  // Render the profile screen UI
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadExtendedProfile}
            colors={[colors.primary]}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* ? BEAUTIFUL USER PROFILE HEADER CARD */}
        <UserProfileHeader
          user={user}
          profile={profile}
          jobSeekerProfile={jobSeekerProfile}
          employerProfile={employerProfile}
          userType={userType}
          onProfileUpdate={(updatedProfile) => {
            setProfile(prev => ({ ...prev, ...updatedProfile }));
            // Refresh the extended profile to get updated completeness
            loadExtendedProfile();
          }}
        />
        
        {/* PROFILE SECTIONS */}
        {userType === 'JobSeeker' ? (
          <>
            {/* 1. EDUCATION (Most Important) */}
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
              editing={editing}
              onUpdate={(updatedEducation) => {
                console.log('Education updated:', updatedEducation);
              }}
            />

            {/* 2. PROFESSIONAL INFORMATION (Second Priority) */}
            <ProfileSection 
              title="Professional Information" 
              icon="briefcase"
              editing={editing}
              onUpdate={(updatedData) => console.log('Professional info updated:', updatedData)}
              onSave={() => saveProfessionalInfo(jobSeekerProfile)}
            >
              <ProfileField fieldKey="headline" label="Professional Headline" placeholder="e.g., Senior Software Engineer" options={{ profileType: 'jobSeeker' }} />
              <ProfileField fieldKey="currentJobTitle" label="Current Job Title" placeholder="Your current position" options={{ profileType: 'jobSeeker' }} />
              <ProfileField fieldKey="currentCompany" label="Current Company" placeholder="Where you work now" options={{ profileType: 'jobSeeker' }} />
              <ProfileField fieldKey="yearsOfExperience" label="Years of Experience" placeholder="0" options={{ keyboardType: 'numeric', profileType: 'jobSeeker' }} />
              <ProfileField fieldKey="currentLocation" label="Current Location" placeholder="City, Country" options={{ profileType: 'jobSeeker' }} />
              <ProfileField fieldKey="summary" label="Professional Summary" placeholder="Tell us about yourself..." options={{ multiline: true, profileType: 'jobSeeker' }} />
            </ProfileSection>

            {/* 3. SKILLS & EXPERTISE (Third Priority) */}
            <ProfileSection 
              title="Skills & Expertise" 
              icon="bulb"
              editing={editing}
              onUpdate={(updatedData) => console.log('Skills updated:', updatedData)}
              onSave={() => saveSkillsExpertise(jobSeekerProfile)}
            >
              <SkillsSection />
              <ProfileField fieldKey="languages" label="Languages" placeholder="e.g., English (Fluent), Spanish (Basic)" options={{ profileType: 'jobSeeker' }} />
              <ProfileField fieldKey="certifications" label="Certifications" placeholder="Professional certifications" options={{ multiline: true, profileType: 'jobSeeker' }} />
            </ProfileSection>

            {/* 4. WORK PREFERENCES (Fourth Priority) */}
            <ProfileSection 
              title="Work Preferences" 
              icon="settings"
              editing={editing}
              onUpdate={(updatedData) => console.log('Preferences updated:', updatedData)}
              onSave={() => saveWorkPreferences(jobSeekerProfile)}
            >
              <ProfileField fieldKey="minimumSalary" label="Minimum Salary" placeholder="0" options={{ keyboardType: 'numeric', profileType: 'jobSeeker' }} />
              <ProfileField fieldKey="preferredWorkTypes" label="Work Style Preference" placeholder="" options={{ 
                choices: ['Remote', 'Hybrid', 'On-site'], 
                profileType: 'jobSeeker' 
              }} />
              <ProfileField fieldKey="preferredJobTypes" label="Preferred Job Types" placeholder="e.g., Full-time, Contract" options={{ profileType: 'jobSeeker' }} />
              <ProfileField fieldKey="preferredLocations" label="Preferred Locations" placeholder="Cities/countries you'd like to work in" options={{ profileType: 'jobSeeker' }} />
              <ProfileField fieldKey="preferredCompanySize" label="Preferred Company Size" placeholder="e.g., Startup, Mid-size, Enterprise" options={{ profileType: 'jobSeeker' }} />
            </ProfileSection>

            {/* 5. SALARY BREAKDOWN SECTION */}
            <SalaryBreakdownSection
              profile={{
                UserID: user?.UserID,
                salaryBreakdown: jobSeekerProfile.salaryBreakdown
              }}
              setProfile={(updatedProfile) => {
                if (updatedProfile.salaryBreakdown) {
                  setJobSeekerProfile(prev => ({
                    ...prev,
                    salaryBreakdown: updatedProfile.salaryBreakdown
                  }));
                }
              }}
              editing={editing}
              onUpdate={(updatedData) => {
                console.log('Salary breakdown updated:', updatedData);
                if (updatedData.salaryBreakdown) {
                  setJobSeekerProfile(prev => ({
                    ...prev,
                    salaryBreakdown: updatedData.salaryBreakdown
                  }));
                }
              }}
            />

            {/* 6. ONLINE PRESENCE (Fifth Priority) */}
            <ProfileSection 
              title="Online Presence" 
              icon="link"
              editing={editing}
              onUpdate={(updatedData) => console.log('Online presence updated:', updatedData)}
              onSave={() => saveOnlinePresence(jobSeekerProfile)}
            >
              <ProfileField fieldKey="primaryResumeURL" label="Resume URL" placeholder="Link to your resume" options={{ profileType: 'jobSeeker' }} />
              <ProfileField fieldKey="linkedInProfile" label="LinkedIn Profile" placeholder="linkedin.com/in/yourprofile" options={{ profileType: 'jobSeeker' }} />
              <ProfileField fieldKey="githubProfile" label="GitHub Profile" placeholder="github.com/yourusername" options={{ profileType: 'jobSeeker' }} />
            </ProfileSection>

            {/* 7. PERSONAL INFORMATION (Basic Info) */}
            <ProfileSection 
              title="Personal Information" 
              icon="person"
              editing={editing}
              onUpdate={(updatedData) => console.log('Personal info updated:', updatedData)}
              onSave={() => savePersonalInfo({ ...profile, ...jobSeekerProfile })}
            >
              <ProfileField fieldKey="firstName" label="First Name *" placeholder="Enter your first name" />
              <ProfileField fieldKey="lastName" label="Last Name *" placeholder="Enter your last name" />
              <ProfileField fieldKey="email" label="Email Address *" placeholder="Enter your email" options={{ keyboardType: 'email-address', editable: false }} />
              <ProfileField fieldKey="phone" label="Phone Number" placeholder="Enter your phone number" options={{ keyboardType: 'phone-pad' }} />
              <ProfileField fieldKey="dateOfBirth" label="Date of Birth" placeholder="YYYY-MM-DD" options={{ keyboardType: 'numeric' }} />
              <ProfileField fieldKey="gender" label="Gender" placeholder="" options={{ choices: genderOptions }} />
            </ProfileSection>

            {/* 8. ACCOUNT SETTINGS */}
            <ProfileSection 
              title="Account Settings" 
              icon="cog"
              editing={editing}
              onUpdate={(updatedData) => console.log('Account settings updated:', updatedData)}
              onSave={() => saveAccountSettings(profile)}
            >
              <ProfileField fieldKey="userType" label="Account Type" placeholder="" options={{ editable: false }} />
              <ProfileField fieldKey="profileVisibility" label="Profile Visibility" placeholder="" options={{ choices: visibilityOptions }} />
            </ProfileSection>

            {/* 9. PRIVACY SETTINGS (Moved to Bottom) */}
            <ProfileSection 
              title="Privacy Settings" 
              icon="shield-checkmark"
              editing={editing}
              onUpdate={(updatedData) => console.log('??? Privacy settings updated:', updatedData)}
              onSave={() => Promise.resolve(true)} // Privacy settings use immediate saves via toggles
            >
              {renderPrivacySettingsContent()}
            </ProfileSection>
          </>
        ) : (
          <>
            {/* EMPLOYER PROFILE SECTIONS */}
            
            {/* 1. ORGANIZATION INFORMATION (Most Important) */}
            <ProfileSection 
              title="Organization Information" 
              icon="business"
              editing={editing}
              onUpdate={(updatedData) => console.log('Organization info updated:', updatedData)}
              onSave={() => saveEmployerData(employerProfile)}
            >
              <ProfileField fieldKey="jobTitle" label="Job Title" placeholder="Your position" options={{ profileType: 'employer' }} />
              <ProfileField fieldKey="department" label="Department" placeholder="HR, Engineering, etc." options={{ profileType: 'employer' }} />
              <ProfileField fieldKey="organizationName" label="Organization Name" placeholder="Company name" options={{ profileType: 'employer' }} />
              <ProfileField fieldKey="organizationSize" label="Organization Size" placeholder="" options={{ 
                choices: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'], 
                profileType: 'employer' 
              }} />
              <ProfileField fieldKey="industry" label="Industry" placeholder="" options={{ 
                choices: ['Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing', 'Retail', 'Other'], 
                profileType: 'employer' 
              }} />
              <ProfileField fieldKey="recruitmentFocus" label="Recruitment Focus" placeholder="What roles do you typically hire for?" options={{ 
                multiline: true, 
                profileType: 'employer' 
              }} />
              <ProfileField fieldKey="bio" label="About Me" placeholder="Tell us about yourself..." options={{ multiline: true, profileType: 'employer' }} />
            </ProfileSection>

            {/* 2. ONLINE PRESENCE */}
            <ProfileSection 
              title="Online Presence" 
              icon="link"
              editing={editing}
              onUpdate={(updatedData) => console.log('Online presence updated:', updatedData)}
              onSave={() => saveEmployerData(employerProfile)}
            >
              <ProfileField fieldKey="linkedInProfile" label="LinkedIn Profile" placeholder="linkedin.com/in/yourprofile" options={{ profileType: 'employer' }} />
            </ProfileSection>

            {/* 3. PERSONAL INFORMATION */}
            <ProfileSection 
              title="Personal Information" 
              icon="person"
              editing={editing}
              onUpdate={(updatedData) => console.log('Personal info updated:', updatedData)}
              onSave={() => savePersonalInfo({ ...profile, ...employerProfile })}
            >
              <ProfileField fieldKey="firstName" label="First Name *" placeholder="Enter your first name" />
              <ProfileField fieldKey="lastName" label="Last Name *" placeholder="Enter your last name" />
              <ProfileField fieldKey="email" label="Email Address *" placeholder="Enter your email" options={{ keyboardType: 'email-address', editable: false }} />
              <ProfileField fieldKey="phone" label="Phone Number" placeholder="Enter your phone number" options={{ keyboardType: 'phone-pad' }} />
              <ProfileField fieldKey="dateOfBirth" label="Date of Birth" placeholder="YYYY-MM-DD" options={{ keyboardType: 'numeric' }} />
              <ProfileField fieldKey="gender" label="Gender" placeholder="" options={{ choices: genderOptions }} />
            </ProfileSection>

            {/* 4. ACCOUNT SETTINGS */}
            <ProfileSection 
              title="Account Settings" 
              icon="cog"
              editing={editing}
              onUpdate={(updatedData) => console.log('Account settings updated:', updatedData)}
              onSave={() => saveAccountSettings(profile)}
            >
              <ProfileField fieldKey="userType" label="Account Type" placeholder="" options={{ editable: false }} />
              <ProfileField fieldKey="profileVisibility" label="Profile Visibility" placeholder="" options={{ choices: visibilityOptions }} />
            </ProfileSection>

            {/* 5. PERMISSIONS (Moved to Bottom) */}
            <ProfileSection 
              title="Permissions" 
              icon="shield-checkmark"
              editing={editing}
              onUpdate={(updatedData) => console.log('??? Permissions updated:', updatedData)}
              onSave={() => saveEmployerData(employerProfile)}
            >
              <View style={styles.switchContainer}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>Can Post Jobs</Text>
                  <Text style={styles.switchDescription}>
                    You can create and publish job postings
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.switch, employerProfile.canPostJobs && styles.switchActive]}
                  onPress={() => editing && setEmployerProfile({...employerProfile, canPostJobs: !employerProfile.canPostJobs})}
                >
                  <View style={[styles.switchThumb, employerProfile.canPostJobs && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>

              <View style={styles.switchContainer}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>Can Manage Applications</Text>
                  <Text style={styles.switchDescription}>
                    You can review and manage job applications
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.switch, employerProfile.canManageApplications && styles.switchActive]}
                  onPress={() => editing && setEmployerProfile({...employerProfile, canManageApplications: !employerProfile.canManageApplications})}
                >
                  <View style={[styles.switchThumb, employerProfile.canManageApplications && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>

              <View style={styles.switchContainer}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>Can View Analytics</Text>
                  <Text style={styles.switchDescription}>
                    You can access job posting analytics and insights
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.switch, employerProfile.canViewAnalytics && styles.switchActive]}
                  onPress={() => editing && setEmployerProfile({...employerProfile, canViewAnalytics: !employerProfile.canViewAnalytics})}
                >
                  <View style={[styles.switchThumb, employerProfile.canViewAnalytics && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
            </ProfileSection>
          </>
        )}
        
        {/* GLOBAL ACTIONS - Only show save/cancel buttons when editing */}
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

        {/* ? FIX: Add missing logout button at bottom when not editing */}
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
        
        {/* LOADING INDICATOR */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12, // Reduced from 24 since we have the profile header
    paddingHorizontal: 4,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20, // Reduced from 24
    fontWeight: '600', // Reduced from bold
    color: colors.text,
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
  
  // ? FIX: Add missing logout section styles
  logoutSection: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#E0E0E0',
    alignItems: 'center',
  },
  logoutMainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger || '#FF3B30',
    backgroundColor: (colors.danger || '#FF3B30') + '10',
    minWidth: 150,
  },
  logoutMainButtonText: {
    fontSize: typography.sizes?.md || 16,
    color: colors.danger || '#FF3B30',
    fontWeight: typography.weights?.medium || '500',
  },
  
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
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
});