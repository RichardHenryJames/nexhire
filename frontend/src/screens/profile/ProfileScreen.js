import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography } from '../../styles/theme';
import nexhireAPI from '../../services/api';

export default function ProfileScreen() {
  const { 
    user, 
    logout, 
    userType,
    // ?? NEW: Use smart methods directly from AuthContext (THE FIX!)
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
    
    // Education
    highestEducation: '',
    fieldOfStudy: '',
    institution: '',
    
    // Professional Information
    headline: '',
    summary: '',
    currentJobTitle: '',
    currentCompany: '',
    currentSalary: 0,
    currentSalaryUnit: '',
    currentCurrencyID: 0,
    yearsOfExperience: 0,
    noticePeriod: 30,
    totalWorkExperience: '',
    
    // Job Preferences
    preferredJobTypes: '',
    preferredWorkTypes: '',
    expectedSalaryMin: 0,
    expectedSalaryMax: 0,
    expectedSalaryUnit: 0,
    preferredRoles: '',
    preferredIndustries: '',
    preferredMinimumSalary: 0,
    
    // Skills and Experience
    primarySkills: [],
    secondarySkills: '',
    languages: '',
    certifications: '',
    workExperience: '',
    
    // Availability and Preferences
    immediatelyAvailable: false,
    willingToRelocate: false,
    jobSearchStatus: '',
    
    // ?? Privacy Settings (THE MAIN FIX!)
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
            
            // Professional Information
            headline: response.data.Headline || '',
            summary: response.data.Summary || '',
            currentJobTitle: response.data.CurrentJobTitle || '',
            currentCompany: response.data.CurrentCompany || '',
            currentSalary: response.data.CurrentSalary || 0,
            currentSalaryUnit: response.data.CurrentSalaryUnit || '',
            currentCurrencyID: response.data.CurrentCurrencyID || 0,
            yearsOfExperience: response.data.YearsOfExperience || 0,
            noticePeriod: response.data.NoticePeriod || 30,
            totalWorkExperience: response.data.TotalWorkExperience || '',
            
            // Job Preferences
            preferredJobTypes: response.data.PreferredJobTypes || '',
            preferredWorkTypes: response.data.PreferredWorkTypes || '',
            expectedSalaryMin: response.data.ExpectedSalaryMin || 0,
            expectedSalaryMax: response.data.ExpectedSalaryMax || 0,
            expectedSalaryUnit: response.data.ExpectedSalaryUnit || 0,
            preferredRoles: response.data.PreferredRoles || '',
            preferredIndustries: response.data.PreferredIndustries || '',
            preferredMinimumSalary: response.data.PreferredMinimumSalary || 0,
            
            // Skills and Experience
            primarySkills: response.data.PrimarySkills ? response.data.PrimarySkills.split(',').map(s => s.trim()).filter(s => s) : [],
            secondarySkills: response.data.SecondarySkills || '',
            languages: response.data.Languages || '',
            certifications: response.data.Certifications || '',
            workExperience: response.data.WorkExperience || '',
            
            // Availability and Preferences
            immediatelyAvailable: response.data.ImmediatelyAvailable || false,
            willingToRelocate: response.data.WillingToRelocate || false,
            jobSearchStatus: response.data.JobSearchStatus || '',
            
            // ?? Privacy Settings (with correct mapping)
            allowRecruitersToContact: response.data.AllowRecruitersToContact !== false,
            hideCurrentCompany: response.data.HideCurrentCompany === 1 || response.data.HideCurrentCompany === true,
            hideSalaryDetails: response.data.HideSalaryDetails === 1 || response.data.HideSalaryDetails === true,
            
            // Status Fields
            isOpenToWork: response.data.IsOpenToWork !== false,
            isFeatured: response.data.IsFeatured || false,
            featuredUntil: response.data.FeaturedUntil || null,
            
            // Additional
            tags: response.data.Tags || '',
            
            // Legacy fields (for backward compatibility)
            expectedSalary: response.data.ExpectedSalaryMin?.toString() || '',
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

  // ?? SMART UPDATE METHODS (THE MAIN FIX!)
  
  /**
   * Quick privacy setting toggle using smart routing
   */
  const handlePrivacyToggle = async (setting, value) => {
    try {
      console.log(`?? Toggling ${setting} to ${value} using smart update...`);
      
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

  /**
   * Smart profile save using field routing
   */
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
      } else {
        Alert.alert('Update Failed', result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Smart profile save error:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhoneNumber = (phone) => {
    if (!phone) return true; // Optional field
    const phoneRegex = /^\+?[\d\s\-()]+$/;
    return phoneRegex.test(phone);
  };

  const validateForm = () => {
    const newErrors = {};

    // Required field validation - match backend validation
    if (!profile.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (profile.firstName.length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    } else if (profile.firstName.length > 100) {
      newErrors.firstName = 'First name must be less than 100 characters';
    }

    if (!profile.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (profile.lastName.length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    } else if (profile.lastName.length > 100) {
      newErrors.lastName = 'Last name must be less than 100 characters';
    }

    if (!profile.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(profile.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Optional field validations
    if (profile.phone && !validatePhoneNumber(profile.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (profile.dateOfBirth) {
      const dob = new Date(profile.dateOfBirth);
      const today = new Date();
      if (dob >= today) {
        newErrors.dateOfBirth = 'Date of birth must be in the past';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addSkill = () => {
    if (newSkill.trim() && !jobSeekerProfile.primarySkills.includes(newSkill.trim())) {
      setJobSeekerProfile({
        ...jobSeekerProfile,
        primarySkills: [...jobSeekerProfile.primarySkills, newSkill.trim()]
      });
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

  const renderField = (key, label, placeholder, options = {}) => {
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

    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {editing && editable ? (
          choices ? (
            <View style={styles.choicesContainer}>
              {choices.map((choice) => (
                <TouchableOpacity
                  key={choice}
                  style={[
                    styles.choiceButton,
                    currentProfile[key] === choice && styles.choiceButtonActive
                  ]}
                  onPress={() => {
                    setCurrentProfile({ ...currentProfile, [key]: choice });
                  }}
                >
                  <Text style={[
                    styles.choiceButtonText,
                    currentProfile[key] === choice && styles.choiceButtonTextActive
                  ]}>
                    {choice}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TextInput
              style={[styles.fieldInput, multiline && styles.multilineInput]}
              value={currentProfile[key]?.toString() || ''}
              onChangeText={(text) => {
                setCurrentProfile({ ...currentProfile, [key]: text });
              }}
              placeholder={placeholder}
              multiline={multiline}
              numberOfLines={multiline ? 4 : 1}
              keyboardType={keyboardType}
              secureTextEntry={secure}
              autoCapitalize={key === 'email' ? 'none' : 'words'}
              autoCorrect={false}
            />
          )
        ) : (
          <Text style={styles.fieldValue}>
            {currentProfile[key]?.toString() || 'Not specified'}
          </Text>
        )}
        {errors[key] && <Text style={styles.errorText}>{errors[key]}</Text>}
      </View>
    );
  };

  const renderSkillsSection = () => (
    <View style={styles.skillsSection}>
      <View style={styles.skillsHeader}>
        <Text style={styles.fieldLabel}>Skills</Text>
        {editing && (
          <TouchableOpacity
            style={styles.addSkillButton}
            onPress={() => setShowSkillsModal(true)}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addSkillText}>Add Skill</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.skillsContainer}>
        {jobSeekerProfile.primarySkills.map((skill, index) => (
          <View key={index} style={styles.skillTag}>
            <Text style={styles.skillText}>{skill}</Text>
            {editing && (
              <TouchableOpacity
                style={styles.removeSkillButton}
                onPress={() => removeSkill(skill)}
              >
                <Ionicons name="close" size={14} color={colors.white} />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </View>
  );

  // ?? ENHANCED: Privacy Settings with Smart Updates
  const renderPrivacySection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Privacy Settings (Smart Update)</Text>
        <View style={styles.smartBadge}>
          <Ionicons name="flash" size={14} color={colors.primary} />
          <Text style={styles.smartBadgeText}>INSTANT</Text>
        </View>
      </View>

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
    </View>
  );

  const renderJobSeekerProfile = () => (
    <>
      {/* ?? NEW: Privacy Settings First (Most Important) */}
      {renderPrivacySection()}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Professional Information</Text>
        
        {renderField('headline', 'Professional Headline', 'e.g., Senior Software Engineer', { profileType: 'jobSeeker' })}
        {renderField('currentJobTitle', 'Current Job Title', 'Your current position', { profileType: 'jobSeeker' })}
        {renderField('currentCompany', 'Current Company', 'Where you work now', { profileType: 'jobSeeker' })}
        {renderField('yearsOfExperience', 'Years of Experience', '0', { keyboardType: 'numeric', profileType: 'jobSeeker' })}
        {renderField('currentLocation', 'Current Location', 'City, Country', { profileType: 'jobSeeker' })}
        {renderField('summary', 'Professional Summary', 'Tell us about yourself...', { multiline: true, profileType: 'jobSeeker' })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Education</Text>
        
        {renderField('institution', 'Institution', 'University/College name', { profileType: 'jobSeeker' })}
        {renderField('highestEducation', 'Highest Education', 'e.g., Bachelor\'s Degree, Master\'s Degree', { profileType: 'jobSeeker' })}
        {renderField('fieldOfStudy', 'Field of Study', 'e.g., Computer Science, Business', { profileType: 'jobSeeker' })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Skills & Expertise</Text>
        {renderSkillsSection()}
        {renderField('secondarySkills', 'Secondary Skills', 'Additional skills (comma-separated)', { profileType: 'jobSeeker' })}
        {renderField('languages', 'Languages', 'e.g., English (Fluent), Spanish (Basic)', { profileType: 'jobSeeker' })}
        {renderField('certifications', 'Certifications', 'Professional certifications', { multiline: true, profileType: 'jobSeeker' })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Work Preferences</Text>
        
        {renderField('expectedSalaryMin', 'Expected Salary (Min)', '0', { keyboardType: 'numeric', profileType: 'jobSeeker' })}
        {renderField('expectedSalaryMax', 'Expected Salary (Max)', '0', { keyboardType: 'numeric', profileType: 'jobSeeker' })}
        {renderField('preferredWorkTypes', 'Work Style Preference', '', { 
          choices: ['Remote', 'Hybrid', 'On-site'], 
          profileType: 'jobSeeker' 
        })}
        {renderField('preferredJobTypes', 'Preferred Job Types', 'e.g., Full-time, Contract', { profileType: 'jobSeeker' })}
        {renderField('preferredLocations', 'Preferred Locations', 'Cities/countries you\'d like to work in', { profileType: 'jobSeeker' })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Online Presence</Text>
        
        {renderField('primaryResumeURL', 'Resume URL', 'Link to your resume', { profileType: 'jobSeeker' })}
        {renderField('linkedInProfile', 'LinkedIn Profile', 'linkedin.com/in/yourprofile', { profileType: 'jobSeeker' })}
        {renderField('githubProfile', 'GitHub Profile', 'github.com/yourusername', { profileType: 'jobSeeker' })}
      </View>
    </>
  );

  const renderEmployerProfile = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Organization Information</Text>
        
        {renderField('jobTitle', 'Job Title', 'Your position', { profileType: 'employer' })}
        {renderField('department', 'Department', 'HR, Engineering, etc.', { profileType: 'employer' })}
        {renderField('organizationName', 'Organization Name', 'Company name', { profileType: 'employer' })}
        {renderField('organizationSize', 'Organization Size', '', { 
          choices: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'], 
          profileType: 'employer' 
        })}
        {renderField('industry', 'Industry', '', { 
          choices: ['Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing', 'Retail', 'Other'], 
          profileType: 'employer' 
        })}
        {renderField('recruitmentFocus', 'Recruitment Focus', 'What roles do you typically hire for?', { 
          multiline: true, 
          profileType: 'employer' 
        })}
        {renderField('bio', 'About Me', 'Tell us about yourself...', { multiline: true, profileType: 'employer' })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Online Presence</Text>
        {renderField('linkedInProfile', 'LinkedIn Profile', 'linkedin.com/in/yourprofile', { profileType: 'employer' })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permissions</Text>
        
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Can Post Jobs</Text>
          <TouchableOpacity
            style={[styles.switch, employerProfile.canPostJobs && styles.switchActive]}
            onPress={() => editing && setEmployerProfile({...employerProfile, canPostJobs: !employerProfile.canPostJobs})}
          >
            <View style={[styles.switchThumb, employerProfile.canPostJobs && styles.switchThumbActive]} />
          </TouchableOpacity>
        </View>

        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Can Manage Applications</Text>
          <TouchableOpacity
            style={[styles.switch, employerProfile.canManageApplications && styles.switchActive]}
            onPress={() => editing && setEmployerProfile({...employerProfile, canManageApplications: !employerProfile.canManageApplications})}
          >
            <View style={[styles.switchThumb, employerProfile.canManageApplications && styles.switchThumbActive]} />
          </TouchableOpacity>
        </View>

        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Can View Analytics</Text>
          <TouchableOpacity
            style={[styles.switch, employerProfile.canViewAnalytics && styles.switchActive]}
            onPress={() => editing && setEmployerProfile({...employerProfile, canViewAnalytics: !employerProfile.canViewAnalytics})}
          >
            <View style={[styles.switchThumb, employerProfile.canViewAnalytics && styles.switchThumbActive]} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];
  const visibilityOptions = ['Public', 'Private', 'Professional'];

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={loadExtendedProfile}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile.firstName?.[0]?.toUpperCase()}{profile.lastName?.[0]?.toUpperCase()}
              </Text>
            </View>
            {editing && (
              <TouchableOpacity style={styles.editAvatarButton}>
                <Ionicons name="camera" size={20} color={colors.white} />
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.userName}>
            {profile.firstName} {profile.lastName}
          </Text>
          
          {userType === 'JobSeeker' && jobSeekerProfile.headline ? (
            <Text style={styles.userHeadline}>{jobSeekerProfile.headline}</Text>
          ) : null}
          
          {userType === 'Employer' && employerProfile.jobTitle ? (
            <Text style={styles.userHeadline}>{employerProfile.jobTitle}</Text>
          ) : null}
          
          <Text style={styles.userType}>{profile.userType}</Text>
          <Text style={styles.userEmail}>{profile.email}</Text>
          
          {userType === 'JobSeeker' && jobSeekerProfile.currentLocation ? (
            <View style={styles.locationContainer}>
              <Ionicons name="location" size={16} color={colors.white + 'CC'} />
              <Text style={styles.locationText}>{jobSeekerProfile.currentLocation}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.content}>
          {/* ?? Smart Update Info Banner */}
          <View style={styles.infoBanner}>
            <View style={styles.infoBannerIcon}>
              <Ionicons name="flash" size={20} color={colors.primary} />
            </View>
            <View style={styles.infoBannerContent}>
              <Text style={styles.infoBannerTitle}>Smart Profile Updates</Text>
              <Text style={styles.infoBannerText}>
                Privacy settings now save instantly! Toggle them anytime - no form submission needed.
              </Text>
            </View>
          </View>

          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            {renderField('firstName', 'First Name *', 'Enter your first name')}
            {renderField('lastName', 'Last Name *', 'Enter your last name')}
            {renderField('email', 'Email Address *', 'Enter your email', { keyboardType: 'email-address', editable: false })}
            {renderField('phone', 'Phone Number', 'Enter your phone number', { keyboardType: 'phone-pad' })}
            {renderField('dateOfBirth', 'Date of Birth', 'YYYY-MM-DD', { keyboardType: 'numeric' })}
            {renderField('gender', 'Gender', '', { choices: genderOptions })}
          </View>

          {/* User Type Specific Sections */}
          {userType === 'JobSeeker' && renderJobSeekerProfile()}
          {userType === 'Employer' && renderEmployerProfile()}

          {/* Account Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Settings</Text>
            
            {renderField('userType', 'Account Type', '', { editable: false })}
            {renderField('profileVisibility', 'Profile Visibility', '', { choices: visibilityOptions })}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            {editing ? (
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setEditing(false);
                    setErrors({});
                    loadExtendedProfile();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.saveButton, loading && styles.buttonDisabled]}
                  onPress={handleSmartSave}
                  disabled={loading}
                >
                  <Ionicons name="flash" size={16} color={colors.white} style={{ marginRight: 8 }} />
                  <Text style={styles.saveButtonText}>
                    {loading ? 'Saving...' : 'Smart Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditing(true)}
              >
                <Ionicons name="create" size={20} color={colors.white} />
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.logoutButton} onPress={() => setShowLogoutModal(true)}>
              <Ionicons name="log-out" size={20} color={colors.danger} />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
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
            <Text style={styles.modalTitle}>Add Skill</Text>
            <TouchableOpacity onPress={addSkill}>
              <Text style={styles.addButton}>Add</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <TextInput
              style={styles.skillInput}
              value={newSkill}
              onChangeText={setNewSkill}
              placeholder="Enter a skill..."
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
  scrollContainer: {
    flex: 1,
  },
  header: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    padding: 30,
    paddingTop: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginBottom: 4,
  },
  userHeadline: {
    fontSize: typography.sizes.md,
    color: colors.white + 'EE',
    marginBottom: 4,
    textAlign: 'center',
  },
  userType: {
    fontSize: typography.sizes.md,
    color: colors.white + 'CC',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: typography.sizes.sm,
    color: colors.white + '99',
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: typography.sizes.sm,
    color: colors.white + 'CC',
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  
  // ?? NEW: Smart Update Styles
  infoBanner: {
    backgroundColor: colors.primary + '10',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoBannerIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  smartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  smartBadgeText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.bold,
    marginLeft: 4,
  },
  privacyContainer: {
    gap: 16,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchDescription: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    lineHeight: 18,
    marginTop: 2,
  },
  
  // ... rest of existing styles ...
  section: {
    backgroundColor: colors.surface,
    margin: 16,
    marginBottom: 8,
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray600,
    marginBottom: 8,
  },
  fieldValue: {
    fontSize: typography.sizes.md,
    color: colors.text,
    paddingVertical: 4,
  },
  fieldInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
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
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  choiceButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  choiceButtonTextActive: {
    color: colors.white,
  },
  skillsSection: {
    marginBottom: 20,
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
    color: colors.primary,
    fontSize: typography.sizes.sm,
    marginLeft: 4,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
  },
  removeSkillButton: {
    marginLeft: 8,
    padding: 2,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: typography.sizes.md,
    color: colors.text,
    fontWeight: typography.weights.medium,
    marginBottom: 4,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.gray300,
    justifyContent: 'center',
    padding: 2,
    marginTop: 4,
  },
  switchActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
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
  actionSection: {
    padding: 16,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  editButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  editButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginLeft: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  logoutButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.danger,
    marginLeft: 8,
  },
  buttonDisabled: {
    backgroundColor: colors.gray400,
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
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  addButton: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  modalContent: {
    padding: 20,
  },
  skillInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: typography.sizes.md,
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
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  logoutModalMessage: {
    fontSize: typography.sizes.md,
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
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
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
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
});