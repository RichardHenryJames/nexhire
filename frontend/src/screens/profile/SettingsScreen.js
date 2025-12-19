import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  TextInput,
  Alert,
  Switch,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import refopenAPI from '../../services/api';
import ComplianceFooter from '../../components/ComplianceFooter';
import ResumeSection from '../../components/profile/ResumeSection';

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

export default function SettingsScreen({ navigation }) {
  const { user, userType, logout, updateProfileSmart } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Profile state
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
  });

  // Job seeker profile state
  const [jobSeekerProfile, setJobSeekerProfile] = useState({
    headline: '',
    summary: '',
    currentJobTitle: '',
    currentCompanyName: '',
    totalExperienceMonths: 0,
    currentLocation: '',
    linkedInProfile: '',
    githubProfile: '',
    portfolioURL: '',
    highestEducation: '',
    fieldOfStudy: '',
    institution: '',
    graduationYear: '',
    primarySkills: [],
    secondarySkills: [],
    isOpenToWork: false,
    openToRefer: false,
    preferredJobTypes: [],
    preferredWorkTypes: [],
    preferredLocations: [],
    preferredIndustries: [],
    expectedSalary: '',
    noticePeriod: '',
    immediatelyAvailable: false,
    willingToRelocate: false,
    allowRecruitersToContact: true,
    hideCurrentCompany: false,
    hideSalaryDetails: false,
    resumes: [],
  });

  // Reference data for dropdowns
  const [referenceData, setReferenceData] = useState({
    industries: [],
    workTypes: [],
    jobTypes: [],
    locations: [],
  });

  useEffect(() => {
    loadExtendedProfile();
  }, []);

  const loadExtendedProfile = async () => {
    try {
      setLoading(true);
      const response = userType === 'JobSeeker' 
        ? await refopenAPI.getApplicantProfile(user?.UserID)
        : await refopenAPI.getProfile();
      
      if (response.success && response.data) {
        const data = response.data;
        
        setProfile({
          userID: data.UserID || user?.UserID || '',
          firstName: data.FirstName || '',
          lastName: data.LastName || '',
          email: data.Email || '',
          phone: data.Phone || '',
          userType: data.UserType || '',
          dateOfBirth: data.DateOfBirth ? new Date(data.DateOfBirth).toISOString().split('T')[0] : '',
          gender: data.Gender || '',
          profilePictureURL: data.ProfilePictureURL || '',
        });

        if (userType === 'JobSeeker') {
          // Parse skills
          let primarySkills = [];
          let secondarySkills = [];
          try {
            primarySkills = typeof data.PrimarySkills === 'string' ? JSON.parse(data.PrimarySkills) : (data.PrimarySkills || []);
          } catch { primarySkills = []; }
          try {
            secondarySkills = typeof data.SecondarySkills === 'string' ? JSON.parse(data.SecondarySkills) : (data.SecondarySkills || []);
          } catch { secondarySkills = []; }

          // Parse arrays
          let preferredJobTypes = [];
          let preferredWorkTypes = [];
          let preferredLocations = [];
          let preferredIndustries = [];
          try { preferredJobTypes = data.PreferredJobTypes ? data.PreferredJobTypes.split(',').map(s => s.trim()) : []; } catch {}
          try { preferredWorkTypes = data.PreferredWorkTypes ? data.PreferredWorkTypes.split(',').map(s => s.trim()) : []; } catch {}
          try { preferredLocations = data.PreferredLocations ? data.PreferredLocations.split(',').map(s => s.trim()) : []; } catch {}
          try { preferredIndustries = data.PreferredIndustries ? data.PreferredIndustries.split(',').map(s => s.trim()) : []; } catch {}

          setJobSeekerProfile({
            headline: data.Headline || '',
            summary: data.Summary || '',
            currentJobTitle: data.CurrentJobTitle || '',
            currentCompanyName: data.CurrentCompanyName || '',
            totalExperienceMonths: data.TotalExperienceMonths || 0,
            currentLocation: data.CurrentLocation || '',
            linkedInProfile: data.LinkedInProfile || '',
            githubProfile: data.GithubProfile || '',
            portfolioURL: data.PortfolioURL || '',
            highestEducation: data.HighestEducation || '',
            fieldOfStudy: data.FieldOfStudy || '',
            institution: data.Institution || '',
            graduationYear: data.GraduationYear || '',
            primarySkills,
            secondarySkills,
            isOpenToWork: data.IsOpenToWork || false,
            openToRefer: data.OpenToRefer || false,
            preferredJobTypes,
            preferredWorkTypes,
            preferredLocations,
            preferredIndustries,
            expectedSalary: data.MinimumSalary ? String(data.MinimumSalary) : '',
            noticePeriod: data.NoticePeriod ? String(data.NoticePeriod) : '',
            immediatelyAvailable: data.ImmediatelyAvailable || false,
            willingToRelocate: data.WillingToRelocate || false,
            allowRecruitersToContact: data.AllowRecruitersToContact !== false,
            hideCurrentCompany: data.HideCurrentCompany || false,
            hideSalaryDetails: data.HideSalaryDetails || false,
            resumes: data.resumes || [],
          });
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load reference data
  useEffect(() => {
    if (activeModal === 'preferences') {
      loadPreferencesReferenceData();
    }
  }, [activeModal]);

  const loadPreferencesReferenceData = async () => {
    try {
      const response = await refopenAPI.getBulkReferenceMetadata(['Industry', 'WorkplaceType', 'JobType']);
      if (response?.success && response?.data) {
        setReferenceData({
          industries: response.data.Industry || [],
          workTypes: response.data.WorkplaceType || [],
          jobTypes: response.data.JobType || [],
          locations: referenceData.locations,
        });
      }
    } catch (error) {
      console.error('Error loading preferences reference data:', error);
    }
  };

  // Save functions
  const savePersonalDetails = async () => {
    try {
      await updateProfileSmart({
        FirstName: profile.firstName,
        LastName: profile.lastName,
        Phone: profile.phone,
        DateOfBirth: profile.dateOfBirth || null,
        Gender: profile.gender || null,
      });
      Alert.alert('Success', 'Personal details updated');
      setActiveModal(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to update personal details');
    }
  };

  const saveProfessionalDetails = async () => {
    try {
      await updateProfileSmart({
        Headline: jobSeekerProfile.headline,
        Summary: jobSeekerProfile.summary,
        CurrentJobTitle: jobSeekerProfile.currentJobTitle,
        CurrentCompanyName: jobSeekerProfile.currentCompanyName,
        CurrentLocation: jobSeekerProfile.currentLocation,
        LinkedInProfile: jobSeekerProfile.linkedInProfile,
        GithubProfile: jobSeekerProfile.githubProfile,
        PortfolioURL: jobSeekerProfile.portfolioURL,
        IsOpenToWork: jobSeekerProfile.isOpenToWork,
        OpenToRefer: jobSeekerProfile.openToRefer,
      });
      Alert.alert('Success', 'Professional details updated');
      setActiveModal(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to update professional details');
    }
  };

  const saveEducation = async () => {
    try {
      await updateProfileSmart({
        HighestEducation: jobSeekerProfile.highestEducation,
        FieldOfStudy: jobSeekerProfile.fieldOfStudy,
        Institution: jobSeekerProfile.institution,
        GraduationYear: jobSeekerProfile.graduationYear,
      });
      Alert.alert('Success', 'Education updated successfully');
      setActiveModal(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to update education');
    }
  };

  const savePreferences = async () => {
    try {
      await updateProfileSmart({
        preferredJobTypes: jobSeekerProfile.preferredJobTypes.join(','),
        preferredWorkTypes: jobSeekerProfile.preferredWorkTypes.join(','),
        preferredLocations: jobSeekerProfile.preferredLocations.join(','),
        preferredIndustries: jobSeekerProfile.preferredIndustries.join(','),
        minimumSalary: jobSeekerProfile.expectedSalary ? parseFloat(jobSeekerProfile.expectedSalary) : null,
        noticePeriod: jobSeekerProfile.noticePeriod ? parseInt(jobSeekerProfile.noticePeriod) : null,
        immediatelyAvailable: jobSeekerProfile.immediatelyAvailable,
        willingToRelocate: jobSeekerProfile.willingToRelocate,
        allowRecruitersToContact: jobSeekerProfile.allowRecruitersToContact,
        hideCurrentCompany: jobSeekerProfile.hideCurrentCompany,
        hideSalaryDetails: jobSeekerProfile.hideSalaryDetails,
      });
      Alert.alert('Success', 'Preferences updated successfully');
      setActiveModal(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to update preferences');
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    try {
      await logout();
    } catch (error) {
      Alert.alert('Error', 'Failed to logout');
    }
  };

  // Render section card
  const renderSectionCard = (title, icon, onPress, subtitle) => (
    <TouchableOpacity style={styles.sectionCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.sectionCardIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.sectionCardContent}>
        <Text style={styles.sectionCardTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionCardSubtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
    </TouchableOpacity>
  );

  // Render toggle card
  const renderToggleCard = (title, icon, value, onToggle, subtitle) => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.sectionCardContent}>
        <Text style={styles.sectionCardTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionCardSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.gray300, true: colors.primary }}
        thumbColor="#FFF"
      />
    </View>
  );

  // Personal Details Modal
  const renderPersonalModal = () => (
    <Modal
      visible={activeModal === 'personal'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setActiveModal(null)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Personal Details</Text>
          <TouchableOpacity onPress={savePersonalDetails} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={{ padding: 16 }}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>First Name</Text>
            <TextInput
              style={styles.textInput}
              value={profile.firstName}
              onChangeText={(text) => setProfile(prev => ({ ...prev, firstName: text }))}
              placeholder="Enter first name"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Last Name</Text>
            <TextInput
              style={styles.textInput}
              value={profile.lastName}
              onChangeText={(text) => setProfile(prev => ({ ...prev, lastName: text }))}
              placeholder="Enter last name"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.gray100 }]}
              value={profile.email}
              editable={false}
              placeholder="Email"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone</Text>
            <TextInput
              style={styles.textInput}
              value={profile.phone}
              onChangeText={(text) => setProfile(prev => ({ ...prev, phone: text }))}
              placeholder="Enter phone number"
              placeholderTextColor={colors.gray400}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date of Birth</Text>
            <TextInput
              style={styles.textInput}
              value={profile.dateOfBirth}
              onChangeText={(text) => setProfile(prev => ({ ...prev, dateOfBirth: text }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Gender</Text>
            <View style={styles.chipContainer}>
              {['Male', 'Female', 'Other'].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, profile.gender === g && styles.chipSelected]}
                  onPress={() => setProfile(prev => ({ ...prev, gender: g }))}
                >
                  <Text style={[styles.chipText, profile.gender === g && styles.chipTextSelected]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  // Professional Details Modal
  const renderProfessionalModal = () => (
    <Modal
      visible={activeModal === 'professional'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setActiveModal(null)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Professional Details</Text>
          <TouchableOpacity onPress={saveProfessionalDetails} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={{ padding: 16 }}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Headline</Text>
            <TextInput
              style={styles.textInput}
              value={jobSeekerProfile.headline}
              onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, headline: text }))}
              placeholder="E.g., Senior Software Engineer"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Summary</Text>
            <TextInput
              style={[styles.textInput, { height: 100 }]}
              value={jobSeekerProfile.summary}
              onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, summary: text }))}
              placeholder="Brief professional summary"
              placeholderTextColor={colors.gray400}
              multiline
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Current Job Title</Text>
            <TextInput
              style={styles.textInput}
              value={jobSeekerProfile.currentJobTitle}
              onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, currentJobTitle: text }))}
              placeholder="E.g., Software Engineer"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Current Company</Text>
            <TextInput
              style={styles.textInput}
              value={jobSeekerProfile.currentCompanyName}
              onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, currentCompanyName: text }))}
              placeholder="E.g., Google"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Location</Text>
            <TextInput
              style={styles.textInput}
              value={jobSeekerProfile.currentLocation}
              onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, currentLocation: text }))}
              placeholder="E.g., Bangalore, India"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>LinkedIn Profile</Text>
            <TextInput
              style={styles.textInput}
              value={jobSeekerProfile.linkedInProfile}
              onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, linkedInProfile: text }))}
              placeholder="https://linkedin.com/in/username"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>GitHub Profile</Text>
            <TextInput
              style={styles.textInput}
              value={jobSeekerProfile.githubProfile}
              onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, githubProfile: text }))}
              placeholder="https://github.com/username"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Open to Work</Text>
              <Text style={styles.toggleDescription}>Let recruiters know you're looking</Text>
            </View>
            <Switch
              value={jobSeekerProfile.isOpenToWork}
              onValueChange={(v) => setJobSeekerProfile(prev => ({ ...prev, isOpenToWork: v }))}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Open to Refer</Text>
              <Text style={styles.toggleDescription}>Help others get referrals at your company</Text>
            </View>
            <Switch
              value={jobSeekerProfile.openToRefer}
              onValueChange={(v) => setJobSeekerProfile(prev => ({ ...prev, openToRefer: v }))}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  // Education Modal
  const renderEducationModal = () => (
    <Modal
      visible={activeModal === 'education'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setActiveModal(null)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Education</Text>
          <TouchableOpacity onPress={saveEducation} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={{ padding: 16 }}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Highest Education</Text>
            <View style={styles.chipContainer}>
              {EDUCATION_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[styles.chip, jobSeekerProfile.highestEducation === level && styles.chipSelected]}
                  onPress={() => setJobSeekerProfile(prev => ({ ...prev, highestEducation: level }))}
                >
                  <Text style={[styles.chipText, jobSeekerProfile.highestEducation === level && styles.chipTextSelected]}>
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Field of Study</Text>
            <TextInput
              style={styles.textInput}
              value={jobSeekerProfile.fieldOfStudy}
              onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, fieldOfStudy: text }))}
              placeholder="E.g., Computer Science"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Institution</Text>
            <TextInput
              style={styles.textInput}
              value={jobSeekerProfile.institution}
              onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, institution: text }))}
              placeholder="E.g., Stanford University"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Graduation Year</Text>
            <TextInput
              style={styles.textInput}
              value={jobSeekerProfile.graduationYear}
              onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, graduationYear: text }))}
              placeholder="E.g., 2020"
              placeholderTextColor={colors.gray400}
              keyboardType="numeric"
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  // Preferences Modal
  const renderPreferencesModal = () => (
    <Modal
      visible={activeModal === 'preferences'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setActiveModal(null)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Preferences</Text>
          <TouchableOpacity onPress={savePreferences} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={{ padding: 16 }}>
          {/* Privacy Settings */}
          <Text style={styles.sectionHeader}>Privacy Settings</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Allow Recruiters to Contact</Text>
              <Text style={styles.toggleDescription}>Let recruiters message you directly</Text>
            </View>
            <Switch
              value={jobSeekerProfile.allowRecruitersToContact}
              onValueChange={(v) => setJobSeekerProfile(prev => ({ ...prev, allowRecruitersToContact: v }))}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Hide Current Company</Text>
              <Text style={styles.toggleDescription}>Hide your company from public profile</Text>
            </View>
            <Switch
              value={jobSeekerProfile.hideCurrentCompany}
              onValueChange={(v) => setJobSeekerProfile(prev => ({ ...prev, hideCurrentCompany: v }))}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Hide Salary Details</Text>
              <Text style={styles.toggleDescription}>Hide salary from public profile</Text>
            </View>
            <Switch
              value={jobSeekerProfile.hideSalaryDetails}
              onValueChange={(v) => setJobSeekerProfile(prev => ({ ...prev, hideSalaryDetails: v }))}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>

          {/* Job Preferences */}
          <Text style={[styles.sectionHeader, { marginTop: 24 }]}>Job Preferences</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Preferred Job Types</Text>
            <View style={styles.chipContainer}>
              {(referenceData.jobTypes || []).map((type) => (
                <TouchableOpacity
                  key={type.MetadataID || type.Value}
                  style={[
                    styles.chip,
                    jobSeekerProfile.preferredJobTypes.includes(type.Value) && styles.chipSelected
                  ]}
                  onPress={() => {
                    const val = type.Value;
                    setJobSeekerProfile(prev => ({
                      ...prev,
                      preferredJobTypes: prev.preferredJobTypes.includes(val)
                        ? prev.preferredJobTypes.filter(v => v !== val)
                        : [...prev.preferredJobTypes, val]
                    }));
                  }}
                >
                  <Text style={[
                    styles.chipText,
                    jobSeekerProfile.preferredJobTypes.includes(type.Value) && styles.chipTextSelected
                  ]}>
                    {type.Value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Preferred Work Types</Text>
            <View style={styles.chipContainer}>
              {(referenceData.workTypes || []).map((type) => (
                <TouchableOpacity
                  key={type.MetadataID || type.Value}
                  style={[
                    styles.chip,
                    jobSeekerProfile.preferredWorkTypes.includes(type.Value) && styles.chipSelected
                  ]}
                  onPress={() => {
                    const val = type.Value;
                    setJobSeekerProfile(prev => ({
                      ...prev,
                      preferredWorkTypes: prev.preferredWorkTypes.includes(val)
                        ? prev.preferredWorkTypes.filter(v => v !== val)
                        : [...prev.preferredWorkTypes, val]
                    }));
                  }}
                >
                  <Text style={[
                    styles.chipText,
                    jobSeekerProfile.preferredWorkTypes.includes(type.Value) && styles.chipTextSelected
                  ]}>
                    {type.Value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Expected Salary (Annual)</Text>
            <TextInput
              style={styles.textInput}
              value={jobSeekerProfile.expectedSalary}
              onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, expectedSalary: text }))}
              placeholder="E.g., 1500000"
              placeholderTextColor={colors.gray400}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notice Period (Days)</Text>
            <TextInput
              style={styles.textInput}
              value={jobSeekerProfile.noticePeriod}
              onChangeText={(text) => setJobSeekerProfile(prev => ({ ...prev, noticePeriod: text }))}
              placeholder="E.g., 30"
              placeholderTextColor={colors.gray400}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Immediately Available</Text>
              <Text style={styles.toggleDescription}>Can join without notice period</Text>
            </View>
            <Switch
              value={jobSeekerProfile.immediatelyAvailable}
              onValueChange={(v) => setJobSeekerProfile(prev => ({ ...prev, immediatelyAvailable: v }))}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Willing to Relocate</Text>
              <Text style={styles.toggleDescription}>Open to jobs in other cities</Text>
            </View>
            <Switch
              value={jobSeekerProfile.willingToRelocate}
              onValueChange={(v) => setJobSeekerProfile(prev => ({ ...prev, willingToRelocate: v }))}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  // Resume Preferences Modal
  const renderResumesModal = () => (
    <Modal
      visible={activeModal === 'resumes'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setActiveModal(null)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Resumes & Documents</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={{ padding: 16 }}>
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
            editing={true}
          />
        </ScrollView>
      </View>
    </Modal>
  );

  // Logout Modal
  const renderLogoutModal = () => (
    <Modal
      visible={showLogoutModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowLogoutModal(false)}
    >
      <View style={styles.logoutModalOverlay}>
        <View style={styles.logoutModalContent}>
          <Ionicons name="log-out-outline" size={48} color="#FF3B30" />
          <Text style={styles.logoutModalTitle}>Logout?</Text>
          <Text style={styles.logoutModalSubtitle}>Are you sure you want to logout?</Text>
          <View style={styles.logoutModalButtons}>
            <TouchableOpacity
              style={[styles.logoutModalButton, styles.logoutModalButtonCancel]}
              onPress={() => setShowLogoutModal(false)}
            >
              <Text style={styles.logoutModalButtonCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logoutModalButton, styles.logoutModalButtonConfirm]}
              onPress={handleLogout}
            >
              <Text style={styles.logoutModalButtonConfirmText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading && !profile.firstName) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            // ✅ Smart back navigation - check if we have meaningful navigation history
            const navState = navigation.getState();
            const routes = navState?.routes || [];
            const currentIndex = navState?.index || 0;
            
            // If we have more than 1 route in the stack, go back normally
            if (routes.length > 1 && currentIndex > 0) {
              navigation.goBack();
            } else {
              // Hard refresh scenario - navigate to Profile tab
              navigation.navigate('Main', {
                screen: 'MainTabs',
                params: {
                  screen: 'Profile'
                }
              });
            }
          }} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }}>
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

        {/* My Activity Section */}
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
            <Text style={styles.sectionHeading}>App Preferences</Text>
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
      </ScrollView>

      {/* Modals */}
      {renderPersonalModal()}
      {renderProfessionalModal()}
      {renderEducationModal()}
      {renderPreferencesModal()}
      {renderResumesModal()}
      {renderLogoutModal()}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIndicator: {
    width: 4,
    height: 20,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginRight: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray600,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryLight || `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionCardContent: {
    flex: 1,
  },
  sectionCardTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  sectionCardSubtitle: {
    fontSize: 13,
    color: colors.gray500,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.text,
  },
  chipTextSelected: {
    color: '#FFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 13,
    color: colors.gray500,
  },
  // Logout modal styles
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoutModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  logoutModalSubtitle: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: 24,
  },
  logoutModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  logoutModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutModalButtonCancel: {
    backgroundColor: colors.gray100,
  },
  logoutModalButtonConfirm: {
    backgroundColor: '#FF3B30',
  },
  logoutModalButtonCancelText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  logoutModalButtonConfirmText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
