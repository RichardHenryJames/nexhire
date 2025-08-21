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
  const { user, updateProfile, logout, userType } = useAuth();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState({});
  const [extendedProfile, setExtendedProfile] = useState(null);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
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

  // Extended profile for job seekers and employers
  const [jobSeekerProfile, setJobSeekerProfile] = useState({
    headline: '',
    currentJobTitle: '',
    currentCompany: '',
    yearsOfExperience: 0,
    expectedSalary: '',
    currencyPreference: 'USD',
    location: '',
    relocatable: false,
    remotePreference: 'Hybrid',
    primarySkills: [],
    secondarySkills: [],
    workAuthorization: '',
    noticePeriod: '',
    resumeURL: '',
    portfolioURL: '',
    linkedInProfile: '',
    githubProfile: '',
    personalWebsite: '',
    bio: '',
    isOpenToWork: true,
    allowRecruitersToContact: true,
    hideCurrentCompany: false,
    preferredJobTypes: [],
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
            headline: response.data.Headline || '',
            currentJobTitle: response.data.CurrentJobTitle || '',
            currentCompany: response.data.CurrentCompany || '',
            yearsOfExperience: response.data.YearsOfExperience || 0,
            expectedSalary: response.data.ExpectedSalary?.toString() || '',
            currencyPreference: response.data.CurrencyPreference || 'USD',
            location: response.data.Location || '',
            relocatable: response.data.WillingToRelocate || false,
            remotePreference: response.data.RemotePreference || 'Hybrid',
            primarySkills: response.data.PrimarySkills ? response.data.PrimarySkills.split(',').map(s => s.trim()) : [],
            secondarySkills: response.data.SecondarySkills ? response.data.SecondarySkills.split(',').map(s => s.trim()) : [],
            workAuthorization: response.data.WorkAuthorization || '',
            noticePeriod: response.data.NoticePeriod || '',
            resumeURL: response.data.ResumeURL || '',
            portfolioURL: response.data.PortfolioURL || '',
            linkedInProfile: response.data.LinkedInProfile || '',
            githubProfile: response.data.GithubProfile || '',
            personalWebsite: response.data.PersonalWebsite || '',
            bio: response.data.Bio || '',
            isOpenToWork: response.data.IsOpenToWork !== false,
            allowRecruitersToContact: response.data.AllowRecruitersToContact !== false,
            hideCurrentCompany: response.data.HideCurrentCompany || false,
            preferredJobTypes: response.data.PreferredJobTypes ? response.data.PreferredJobTypes.split(',').map(s => s.trim()) : [],
            industries: response.data.Industries ? response.data.Industries.split(',').map(s => s.trim()) : [],
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

  const handleCompleteEmployer = async () => {
    try {
      setLoading(true);
      const payload = {
        organizationName: `${profile.firstName} ${profile.lastName}`.trim() ? `${profile.firstName} ${profile.lastName}'s Company` : 'My Organization',
        organizationIndustry: 'Technology',
        organizationSize: '1-10',
        organizationWebsite: '',
        organizationType: 'Company',
        jobTitle: 'Hiring Manager',
        department: 'Human Resources',
        linkedInProfile: '',
        bio: '',
      };
      const res = await nexhireAPI.initializeEmployerProfile(payload);
      if (!res?.success) throw new Error(res?.error || 'Failed');
      Alert.alert('Success', 'Employer profile initialized');
      setProfile(p => ({ ...p, userType: 'Employer' }));
      await loadExtendedProfile();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not complete employer setup');
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

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving');
      return;
    }

    setLoading(true);
    try {
      // Prepare data according to backend schema (User interface)
      const updateData = {
        userID: profile.userID,
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        email: profile.email.trim().toLowerCase(),
        userType: profile.userType,
        ...(profile.phone && { phone: profile.phone.trim() }),
        ...(profile.dateOfBirth && { dateOfBirth: new Date(profile.dateOfBirth) }),
        ...(profile.gender && { gender: profile.gender }),
        ...(profile.profilePictureURL && { profilePictureURL: profile.profilePictureURL.trim() }),
        profileVisibility: profile.profileVisibility,
      };

      const result = await updateProfile(updateData);
      
      if (result.success) {
        // Also update extended profile
        if (userType === 'JobSeeker') {
          await saveJobSeekerProfile();
        } else if (userType === 'Employer') {
          await saveEmployerProfile();
        }
        
        setEditing(false);
        Alert.alert('Success', 'Profile updated successfully!');
      } else {
        Alert.alert('Update Failed', result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const saveJobSeekerProfile = async () => {
    try {
      const profileData = {
        ...jobSeekerProfile,
        primarySkills: jobSeekerProfile.primarySkills.join(', '),
        secondarySkills: jobSeekerProfile.secondarySkills.join(', '),
        preferredJobTypes: jobSeekerProfile.preferredJobTypes.join(', '),
        industries: jobSeekerProfile.industries.join(', '),
      };

      await nexhireAPI.updateApplicantProfile(user.UserID, profileData);
    } catch (error) {
      console.error('Error saving job seeker profile:', error);
    }
  };

  const saveEmployerProfile = async () => {
    try {
      await nexhireAPI.updateEmployerProfile(user.UserID, employerProfile);
    } catch (error) {
      console.error('Error saving employer profile:', error);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !jobSeekerProfile.primarySkills.includes(newSkill.trim())) {
      setJobSeekerProfile({
        ...jobSeekerProfile,
        primarySkills: [...jobSeekerProfile.primarySkills, newSkill.trim()]
      });
      setNewSkill('');
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
      profileType = 'basic' // 'basic', 'jobSeeker', 'employer'
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

  const renderJobSeekerProfile = () => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Professional Information</Text>
        
        {renderField('headline', 'Professional Headline', 'e.g., Senior Software Engineer', { profileType: 'jobSeeker' })}
        {renderField('currentJobTitle', 'Current Job Title', 'Your current position', { profileType: 'jobSeeker' })}
        {renderField('currentCompany', 'Current Company', 'Where you work now', { profileType: 'jobSeeker' })}
        {renderField('yearsOfExperience', 'Years of Experience', '0', { keyboardType: 'numeric', profileType: 'jobSeeker' })}
        {renderField('location', 'Location', 'City, Country', { profileType: 'jobSeeker' })}
        {renderField('bio', 'Professional Summary', 'Tell us about yourself...', { multiline: true, profileType: 'jobSeeker' })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Skills & Expertise</Text>
        {renderSkillsSection()}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Work Preferences</Text>
        
        {renderField('expectedSalary', 'Expected Salary', '0', { keyboardType: 'numeric', profileType: 'jobSeeker' })}
        {renderField('currencyPreference', 'Currency', '', { 
          choices: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'], 
          profileType: 'jobSeeker' 
        })}
        {renderField('remotePreference', 'Work Style Preference', '', { 
          choices: ['Remote', 'Hybrid', 'On-site'], 
          profileType: 'jobSeeker' 
        })}
        {renderField('noticePeriod', 'Notice Period', 'e.g., 2 weeks, 1 month', { profileType: 'jobSeeker' })}
        {renderField('workAuthorization', 'Work Authorization', 'e.g., US Citizen, Work Visa', { profileType: 'jobSeeker' })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Online Presence</Text>
        
        {renderField('resumeURL', 'Resume URL', 'Link to your resume', { profileType: 'jobSeeker' })}
        {renderField('portfolioURL', 'Portfolio URL', 'Your portfolio website', { profileType: 'jobSeeker' })}
        {renderField('linkedInProfile', 'LinkedIn Profile', 'linkedin.com/in/yourprofile', { profileType: 'jobSeeker' })}
        {renderField('githubProfile', 'GitHub Profile', 'github.com/yourusername', { profileType: 'jobSeeker' })}
        {renderField('personalWebsite', 'Personal Website', 'Your personal website', { profileType: 'jobSeeker' })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy Settings</Text>
        
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Open to Work</Text>
          <TouchableOpacity
            style={[styles.switch, jobSeekerProfile.isOpenToWork && styles.switchActive]}
            onPress={() => editing && setJobSeekerProfile({...jobSeekerProfile, isOpenToWork: !jobSeekerProfile.isOpenToWork})}
          >
            <View style={[styles.switchThumb, jobSeekerProfile.isOpenToWork && styles.switchThumbActive]} />
          </TouchableOpacity>
        </View>

        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Allow Recruiters to Contact</Text>
          <TouchableOpacity
            style={[styles.switch, jobSeekerProfile.allowRecruitersToContact && styles.switchActive]}
            onPress={() => editing && setJobSeekerProfile({...jobSeekerProfile, allowRecruitersToContact: !jobSeekerProfile.allowRecruitersToContact})}
          >
            <View style={[styles.switchThumb, jobSeekerProfile.allowRecruitersToContact && styles.switchThumbActive]} />
          </TouchableOpacity>
        </View>

        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Hide Current Company</Text>
          <TouchableOpacity
            style={[styles.switch, jobSeekerProfile.hideCurrentCompany && styles.switchActive]}
            onPress={() => editing && setJobSeekerProfile({...jobSeekerProfile, hideCurrentCompany: !jobSeekerProfile.hideCurrentCompany})}
          >
            <View style={[styles.switchThumb, jobSeekerProfile.hideCurrentCompany && styles.switchThumbActive]} />
          </TouchableOpacity>
        </View>
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
          
          {userType === 'JobSeeker' && jobSeekerProfile.location ? (
            <View style={styles.locationContainer}>
              <Ionicons name="location" size={16} color={colors.white + 'CC'} />
              <Text style={styles.locationText}>{jobSeekerProfile.location}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.content}>
          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            {renderField('firstName', 'First Name *', 'Enter your first name')}
            {renderField('lastName', 'Last Name *', 'Enter your last name')}
            {renderField('email', 'Email Address *', 'Enter your email', { keyboardType: 'email-address' })}
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
                    loadExtendedProfile(); // Reload original data
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.saveButton, loading && styles.buttonDisabled]}
                  onPress={handleSave}
                  disabled={loading}
                >
                  <Text style={styles.saveButtonText}>
                    {loading ? 'Saving...' : 'Save Changes'}
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

            {profile.userType !== 'Employer' && (
              <TouchableOpacity style={styles.completeEmployerButton} onPress={handleCompleteEmployer} disabled={loading}>
                <Ionicons name="briefcase" size={20} color={colors.white} />
                <Text style={styles.completeEmployerButtonText}>{loading ? 'Please wait...' : 'Complete Employer Profile'}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.logoutButton} onPress={() => {
              Alert.alert(
                'Logout',
                'Are you sure you want to logout?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Logout', style: 'destructive', onPress: logout },
                ]
              );
            }}>
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
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: typography.sizes.md,
    color: colors.text,
    flex: 1,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.gray300,
    justifyContent: 'center',
    padding: 2,
  },
  switchActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
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
  completeEmployerButton: {
    flexDirection: 'row',
    backgroundColor: colors.success,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  completeEmployerButtonText: {
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
});