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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import useResponsive from '../../hooks/useResponsive';
import { useTheme } from '../../contexts/ThemeContext';
import refopenAPI from '../../services/api';
import ComplianceFooter from '../../components/ComplianceFooter';
import ResumeSection from '../../components/profile/ResumeSection';
import WorkExperienceSection from '../../components/profile/WorkExperienceSection';
import EducationSection from '../../components/profile/EducationSection';
import DatePicker from '../../components/DatePicker';
import { showToast } from '../../components/Toast';
import ModalToast from '../../components/ModalToast';

export default function SettingsScreen({ navigation, route }) {
  const { user, userType, logout, updateProfileSmart } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const styles = React.useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [workExpLoading, setWorkExpLoading] = useState(true); // Track work experience loading
  
  // Handle route params to auto-open modals
  useEffect(() => {
    if (route?.params?.openModal) {
      setActiveModal(route.params.openModal);
    }
  }, [route?.params?.openModal]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState({
    EmailEnabled: true,
    PushEnabled: true,
    ReferralRequestEmail: true,
    ReferralClaimedEmail: true,
    ReferralVerifiedEmail: true,
    MessageReceivedEmail: true,
    WeeklyDigestEmail: true,
    DailyJobRecommendationEmail: true,
    ReferrerNotificationEmail: true,
    MarketingEmail: true,
  });
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationSaveMessage, setNotificationSaveMessage] = useState(null); // { type: 'success' | 'error', text: string }

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

  // Sync profile state when user data loads or changes
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
      });
    }
  }, [user]);

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
    gpa: '',
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
        
        // For JobSeeker, applicant profile doesn't have user fields (Gender, Phone, DOB)
        // So preserve them from the user object
        setProfile({
          userID: data.UserID || user?.UserID || '',
          firstName: data.FirstName || user?.FirstName || '',
          lastName: data.LastName || user?.LastName || '',
          email: data.Email || user?.Email || '',
          phone: data.Phone || user?.Phone || '',
          userType: data.UserType || user?.UserType || '',
          dateOfBirth: data.DateOfBirth 
            ? new Date(data.DateOfBirth).toISOString().split('T')[0] 
            : (user?.DateOfBirth ? new Date(user.DateOfBirth).toISOString().split('T')[0] : ''),
          gender: data.Gender || user?.Gender || '',
          profilePictureURL: data.ProfilePictureURL || user?.ProfilePictureURL || '',
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
            gpa: data.GPA || '',
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

  // Notification preferences functions
  const loadNotificationPreferences = async () => {
    setLoadingNotifications(true);
    try {
      const response = await refopenAPI.getNotificationPreferences();
      if (response?.success && response?.preferences) {
        setNotificationPrefs(response.preferences);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const saveNotificationPreferences = async () => {
    setSavingNotifications(true);
    setNotificationSaveMessage(null);
    try {
      const response = await refopenAPI.updateNotificationPreferences(notificationPrefs);
      if (response?.success) {
        setNotificationSaveMessage({ type: 'success', text: 'Preferences saved!' });
        // Auto-hide after 3 seconds
        setTimeout(() => setNotificationSaveMessage(null), 3000);
      } else {
        setNotificationSaveMessage({ type: 'error', text: 'Failed to update preferences' });
      }
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      setNotificationSaveMessage({ type: 'error', text: 'Failed to update preferences' });
    } finally {
      setSavingNotifications(false);
    }
  };

  // Save functions
  const savePersonalDetails = async () => {
    setLoading(true);
    try {
      const result = await updateProfileSmart({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        dateOfBirth: profile.dateOfBirth || null,
        gender: profile.gender || null,
      });
      
      if (result?.success) {
        showToast('Personal details updated', 'success');
        setActiveModal(null);
      } else {
        showToast(result?.error || 'Failed to update personal details', 'error');
      }
    } catch (error) {
      console.error('Save error:', error);
      showToast('Failed to update personal details. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveProfessionalDetails = async () => {
    try {
      await updateProfileSmart({
        headline: jobSeekerProfile.headline,
        summary: jobSeekerProfile.summary,
        currentLocation: jobSeekerProfile.currentLocation,
        linkedInProfile: jobSeekerProfile.linkedInProfile,
        githubProfile: jobSeekerProfile.githubProfile,
        isOpenToWork: jobSeekerProfile.isOpenToWork,
        openToRefer: jobSeekerProfile.openToRefer,
      });
      showToast('Professional details updated', 'success');
      setActiveModal(null);
    } catch (error) {
      showToast('Failed to update professional details', 'error');
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
      showToast('Preferences updated successfully', 'success');
      setActiveModal(null);
    } catch (error) {
      showToast('Failed to update preferences', 'error');
    }
  };

  const saveEducationDetails = async () => {
    try {
      await refopenAPI.updateEducation({
        institution: jobSeekerProfile.institution,
        highestEducation: jobSeekerProfile.highestEducation,
        fieldOfStudy: jobSeekerProfile.fieldOfStudy,
        graduationYear: jobSeekerProfile.graduationYear,
        gpa: jobSeekerProfile.gpa,
      });
      showToast('Education details updated', 'success');
      setActiveModal(null);
    } catch (error) {
      showToast('Failed to update education details', 'error');
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    try {
      await logout();
    } catch (error) {
      showToast('Failed to logout', 'error');
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
        <View style={styles.modalInner}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Personal Details</Text>
            <TouchableOpacity 
              onPress={savePersonalDetails} 
              style={[styles.saveButton, loading && { opacity: 0.5 }]}
              disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
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
            <DatePicker
              value={profile.dateOfBirth}
              onChange={(date) => setProfile(prev => ({ ...prev, dateOfBirth: date }))}
              placeholder="Select date of birth"
              colors={colors}
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
        <View style={styles.modalInner}>
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

          {/* Work Experience Section */}
          <View style={styles.inputGroup}>
            <View style={styles.workExpHeader}>
              <Text style={styles.inputLabel}>Work Experience</Text>
              {workExpLoading && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
              )}
            </View>
            <WorkExperienceSection 
              editing={true} 
              showHeader={false} 
              onLoadingChange={setWorkExpLoading}
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
      </View>
    </Modal>
  );

  // Education Modal - uses same EducationSection component as Profile screen
  const renderEducationModal = () => (
    <Modal
      visible={activeModal === 'education'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setActiveModal(null)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalInner}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Education</Text>
            <TouchableOpacity onPress={saveEducationDetails} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
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
            />
          </ScrollView>
        </View>
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
        <View style={styles.modalInner}>
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
        <View style={styles.modalInner}>
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
      </View>
    </Modal>
  );

  // Notification Preferences Modal
  const renderNotificationsModal = () => (
    <Modal
      visible={activeModal === 'notifications'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setActiveModal(null)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalInner}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Notification Settings</Text>
            <TouchableOpacity 
              onPress={saveNotificationPreferences}
              disabled={savingNotifications}
              style={styles.saveButton}
            >
              {savingNotifications ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="checkmark" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Modal Toast for save feedback */}
        <ModalToast
          visible={!!notificationSaveMessage}
          message={notificationSaveMessage?.text || ''}
          type={notificationSaveMessage?.type || 'success'}
          onHide={() => setNotificationSaveMessage(null)}
        />

        <ScrollView style={styles.modalContent} contentContainerStyle={{ padding: 16 }}>
          {loadingNotifications ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ marginTop: 12, color: colors.textSecondary }}>Loading preferences...</Text>
            </View>
          ) : (
            <>
              {/* Global Toggles */}
              <Text style={styles.notifSectionHeader}>Global Settings</Text>
              
              <View style={styles.notifToggleRow}>
                <View style={styles.notifToggleLeft}>
                  <Ionicons name="mail-outline" size={20} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifToggleLabel}>Email Notifications</Text>
                    <Text style={styles.notifToggleDesc}>Master toggle for all email notifications</Text>
                  </View>
                </View>
                <Switch
                  value={notificationPrefs.EmailEnabled}
                  onValueChange={(value) => {
                    if (value) {
                      // Just enable global toggle
                      setNotificationPrefs(prev => ({ ...prev, EmailEnabled: true }));
                    } else {
                      // Disable global toggle AND all individual email toggles
                      setNotificationPrefs(prev => ({
                        ...prev,
                        EmailEnabled: false,
                        ReferralRequestEmail: false,
                        ReferralClaimedEmail: false,
                        ReferralVerifiedEmail: false,
                        MessageReceivedEmail: false,
                        WeeklyDigestEmail: false,
                        DailyJobRecommendationEmail: false,
                        ReferrerNotificationEmail: false,
                        MarketingEmail: false,
                      }));
                    }
                  }}
                  trackColor={{ false: colors.gray300, true: colors.primaryLight || colors.primary + '40' }}
                  thumbColor={notificationPrefs.EmailEnabled ? colors.primary : colors.gray100}
                />
              </View>

              <View style={styles.notifToggleRow}>
                <View style={styles.notifToggleLeft}>
                  <Ionicons name="notifications-outline" size={20} color={colors.text} />
                  <Text style={styles.notifToggleLabel}>Push Notifications</Text>
                </View>
                <Switch
                  value={notificationPrefs.PushEnabled}
                  onValueChange={(value) => setNotificationPrefs(prev => ({ ...prev, PushEnabled: value }))}
                  trackColor={{ false: colors.gray300, true: colors.primaryLight || colors.primary + '40' }}
                  thumbColor={notificationPrefs.PushEnabled ? colors.primary : colors.gray100}
                />
              </View>

              {/* For Job Seekers */}
              <Text style={styles.notifSectionHeader}>For Job Seekers</Text>
              
              <View style={styles.notifToggleRow}>
                <View style={styles.notifToggleLeft}>
                  <Ionicons name="briefcase-outline" size={20} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifToggleLabel}>Job Recommendations</Text>
                    <Text style={styles.notifToggleDesc}>Personalized job picks based on your preferences</Text>
                  </View>
                </View>
                <Switch
                  value={notificationPrefs.DailyJobRecommendationEmail}
                  onValueChange={(value) => setNotificationPrefs(prev => ({ 
                    ...prev, 
                    DailyJobRecommendationEmail: value,
                    ...(value ? { EmailEnabled: true } : {})
                  }))}
                  trackColor={{ false: colors.gray300, true: colors.primaryLight || colors.primary + '40' }}
                  thumbColor={notificationPrefs.DailyJobRecommendationEmail ? colors.primary : colors.gray100}
                />
              </View>

              <View style={styles.notifToggleRow}>
                <View style={styles.notifToggleLeft}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifToggleLabel}>Referral Submitted</Text>
                    <Text style={styles.notifToggleDesc}>When someone submits a referral for you</Text>
                  </View>
                </View>
                <Switch
                  value={notificationPrefs.ReferralClaimedEmail}
                  onValueChange={(value) => setNotificationPrefs(prev => ({ 
                    ...prev, 
                    ReferralClaimedEmail: value,
                    ...(value ? { EmailEnabled: true } : {})
                  }))}
                  trackColor={{ false: colors.gray300, true: colors.primaryLight || colors.primary + '40' }}
                  thumbColor={notificationPrefs.ReferralClaimedEmail ? colors.primary : colors.gray100}
                />
              </View>

              {/* For Referrers */}
              <Text style={styles.notifSectionHeader}>For Referrers</Text>
              
              <View style={styles.notifToggleRow}>
                <View style={styles.notifToggleLeft}>
                  <Ionicons name="hand-right-outline" size={20} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifToggleLabel}>New Referral Requests</Text>
                    <Text style={styles.notifToggleDesc}>When someone needs a referral at your company</Text>
                  </View>
                </View>
                <Switch
                  value={notificationPrefs.ReferralRequestEmail}
                  onValueChange={(value) => setNotificationPrefs(prev => ({ 
                    ...prev, 
                    ReferralRequestEmail: value,
                    ...(value ? { EmailEnabled: true } : {})
                  }))}
                  trackColor={{ false: colors.gray300, true: colors.primaryLight || colors.primary + '40' }}
                  thumbColor={notificationPrefs.ReferralRequestEmail ? colors.primary : colors.gray100}
                />
              </View>

              <View style={styles.notifToggleRow}>
                <View style={styles.notifToggleLeft}>
                  <Ionicons name="trophy-outline" size={20} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifToggleLabel}>Referral Verified</Text>
                    <Text style={styles.notifToggleDesc}>When you earn rewards for a referral</Text>
                  </View>
                </View>
                <Switch
                  value={notificationPrefs.ReferralVerifiedEmail}
                  onValueChange={(value) => setNotificationPrefs(prev => ({ 
                    ...prev, 
                    ReferralVerifiedEmail: value,
                    ...(value ? { EmailEnabled: true } : {})
                  }))}
                  trackColor={{ false: colors.gray300, true: colors.primaryLight || colors.primary + '40' }}
                  thumbColor={notificationPrefs.ReferralVerifiedEmail ? colors.primary : colors.gray100}
                />
              </View>

              <View style={styles.notifToggleRow}>
                <View style={styles.notifToggleLeft}>
                  <Ionicons name="people-outline" size={20} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifToggleLabel}>Referrer Notifications</Text>
                    <Text style={styles.notifToggleDesc}>Get notified about open referral requests</Text>
                  </View>
                </View>
                <Switch
                  value={notificationPrefs.ReferrerNotificationEmail}
                  onValueChange={(value) => setNotificationPrefs(prev => ({ 
                    ...prev, 
                    ReferrerNotificationEmail: value,
                    ...(value ? { EmailEnabled: true } : {})
                  }))}
                  trackColor={{ false: colors.gray300, true: colors.primaryLight || colors.primary + '40' }}
                  thumbColor={notificationPrefs.ReferrerNotificationEmail ? colors.primary : colors.gray100}
                />
              </View>

              {/* Other Notifications */}
              <Text style={styles.notifSectionHeader}>Other</Text>

              <View style={styles.notifToggleRow}>
                <View style={styles.notifToggleLeft}>
                  <Ionicons name="megaphone-outline" size={20} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifToggleLabel}>Marketing & Promotional</Text>
                    <Text style={styles.notifToggleDesc}>Tips, updates, and special offers</Text>
                  </View>
                </View>
                <Switch
                  value={notificationPrefs.MarketingEmail}
                  onValueChange={(value) => setNotificationPrefs(prev => ({ 
                    ...prev, 
                    MarketingEmail: value,
                    ...(value ? { EmailEnabled: true } : {})
                  }))}
                  trackColor={{ false: colors.gray300, true: colors.primaryLight || colors.primary + '40' }}
                  thumbColor={notificationPrefs.MarketingEmail ? colors.primary : colors.gray100}
                />
              </View>

              <View style={styles.notifToggleRow}>
                <View style={styles.notifToggleLeft}>
                  <Ionicons name="calendar-outline" size={20} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifToggleLabel}>Weekly Digest</Text>
                    <Text style={styles.notifToggleDesc}>Summary of activity and opportunities</Text>
                  </View>
                </View>
                <Switch
                  value={notificationPrefs.WeeklyDigestEmail}
                  onValueChange={(value) => setNotificationPrefs(prev => ({ 
                    ...prev, 
                    WeeklyDigestEmail: value,
                    ...(value ? { EmailEnabled: true } : {})
                  }))}
                  trackColor={{ false: colors.gray300, true: colors.primaryLight || colors.primary + '40' }}
                  thumbColor={notificationPrefs.WeeklyDigestEmail ? colors.primary : colors.gray100}
                />
              </View>

              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
        </View>
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
      <View style={styles.innerContainer}>
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

          {renderSectionCard(
            'Notification Settings',
            'notifications-outline',
            () => {
              loadNotificationPreferences();
              setActiveModal('notifications');
            },
            'Manage email & push notifications'
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
      </View>

      {/* Modals */}
      {renderPersonalModal()}
      {renderProfessionalModal()}
      {renderEducationModal()}
      {renderPreferencesModal()}
      {renderResumesModal()}
      {renderNotificationsModal()}
      {renderLogoutModal()}
    </View>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  innerContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 900 : '100%',
    flex: 1,
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
    backgroundColor: `${colors.primary}20`,
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
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  modalInner: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 900 : '100%',
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
    padding: 16,
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
  workExpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    gap: 16,
    marginTop: 8,
  },
  logoutModalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
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
  // Notification styles
  notifSectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 20,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notifToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notifToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  notifToggleLabel: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  notifToggleDesc: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
  saveButton: {
    width: 60,
    alignItems: 'flex-end',
    paddingRight: 8,
  },
});
