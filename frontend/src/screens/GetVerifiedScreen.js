/**
 * GetVerifiedScreen — Get blue tick verification
 * 
 * Steps:
 *   1. Intro / advantages of getting verified
 *   2. Choose method: Company Email (if working) / College Email / Aadhaar
 *   3A. Work Experience + Company Email OTP (reuses BecomeReferrer flow)
 *   3B. College Email OTP
 *   3C. Aadhaar photo + selfie upload
 *   4. Success / Pending (Aadhaar needs admin approval)
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet,
  Animated, Dimensions, Platform, ActivityIndicator, KeyboardAvoidingView, Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import useResponsive from '../hooks/useResponsive';
import { showToast } from '../components/Toast';
import refopenAPI from '../services/api';
import DatePicker from '../components/DatePicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Personal email domains blocked
const PERSONAL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'aol.com', 'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com',
  'ymail.com', 'gmx.com', 'rediffmail.com',
];

const normalizeCompanyName = (name) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(pvt|ltd|llp|inc|corp|limited|private|technologies|tech|solutions|consulting|services|group|india|global)/g, '').trim();
};

const isEmailDomainMatchingCompany = (email, companyName) => {
  if (!email || !companyName) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  const domainCompany = domain.split('.')[0];
  const normalized = normalizeCompanyName(companyName);
  return domainCompany === normalized ||
         normalized.startsWith(domainCompany) ||
         (normalized.length >= 3 && domain.split('.').some(part => part === normalized));
};

// Steps
const STEPS = { INTRO: 0, METHOD: 1, VERIFY: 2, SUCCESS: 3 };
const METHODS = { COMPANY_EMAIL: 'CompanyEmail', COLLEGE_EMAIL: 'CollegeEmail', AADHAAR: 'Aadhaar' };

export default function GetVerifiedScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { user, refreshVerificationStatus } = useAuth();
  const responsive = useResponsive();
  const isDesktop = responsive.isDesktop;

  // Step management
  const [step, setStep] = useState(STEPS.INTRO);
  const stepAnim = useRef(new Animated.Value(1)).current;
  const [method, setMethod] = useState(null);

  // Work experience state (for company email method)
  const [loading, setLoading] = useState(false);
  const [workExperiences, setWorkExperiences] = useState([]);
  const [selectedWork, setSelectedWork] = useState(null);
  const [companySearch, setCompanySearch] = useState('');
  const [companyResults, setCompanyResults] = useState([]);
  const [searchingCompany, setSearchingCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [organizationId, setOrganizationId] = useState(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobRoles, setJobRoles] = useState([]);
  const [showJobTitleDropdown, setShowJobTitleDropdown] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Company email OTP state
  const [companyEmail, setCompanyEmail] = useState('');
  const [emailDomain, setEmailDomain] = useState('');

  // College email state
  const [collegeEmail, setCollegeEmail] = useState('');
  const [collegeName, setCollegeName] = useState('');

  // Shared OTP state
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = [useRef(), useRef(), useRef(), useRef()];

  // Aadhaar state
  const [aadhaarPhoto, setAadhaarPhoto] = useState(null);
  const [selfiePhoto, setSelfiePhoto] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Existing verification status
  const [existingStatus, setExistingStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Success state
  const [successType, setSuccessType] = useState(null); // 'immediate' or 'pending'

  // Check existing status on mount
  useEffect(() => {
    checkExistingStatus();
    fetchWorkExperiences();
    fetchJobRoles();
  }, []);

  // Resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const checkExistingStatus = async () => {
    try {
      const res = await refopenAPI.apiCall('/verification/user/status');
      if (res.success) {
        setExistingStatus(res.data);
        if (res.data.isVerifiedUser) {
          showToast('You are already verified! ✅', 'success');
          navigation.goBack();
        }
      }
    } catch (err) {
      // silently fail
    } finally {
      setCheckingStatus(false);
    }
  };

  const fetchWorkExperiences = async () => {
    try {
      const res = await refopenAPI.getMyWorkExperiences();
      if (res.success && res.data?.length > 0) {
        setWorkExperiences(res.data);
        const current = res.data.find(w => w.IsCurrent === 1 || w.IsCurrent === true);
        if (current) {
          setSelectedWork(current);
          setCompanyName(current.CompanyName || '');
          setOrganizationId(current.OrganizationID || null);
          setJobTitle(current.JobTitle || '');
          setStartDate(current.StartDate ? current.StartDate.split('T')[0] : '');
          guessEmailDomain(current.CompanyName);
        }
      }
    } catch (err) {}
  };

  const fetchJobRoles = async () => {
    try {
      const res = await refopenAPI.getReferenceMetadata('JobRole');
      if (res?.success && Array.isArray(res.data)) {
        setJobRoles(res.data.sort((a, b) => (a.Value || '').localeCompare(b.Value || '')));
      }
    } catch (err) {}
  };

  const guessEmailDomain = (name) => {
    if (!name) return;
    const guess = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    setEmailDomain(guess);
  };

  // Company search
  const searchTimerRef = useRef(null);
  const handleCompanySearch = (text) => {
    setCompanySearch(text);
    setCompanyName(text);
    setOrganizationId(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (text.length < 2) { setCompanyResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearchingCompany(true);
      try {
        const res = await refopenAPI.getOrganizations(text, 6);
        if (res.success && res.data) setCompanyResults(res.data);
      } catch (err) {} finally { setSearchingCompany(false); }
    }, 300);
  };

  const selectCompany = (org) => {
    const name = org.name || org.Name;
    setCompanyName(name);
    setOrganizationId(org.id || org.OrganizationID);
    setCompanySearch(name);
    setCompanyResults([]);
    guessEmailDomain(name);
  };

  // Animate step transition
  const animateToStep = (nextStep) => {
    Animated.timing(stepAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(stepAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  };

  // ── Company Email: Save work exp then verify ──
  const handleWorkNext = async () => {
    if (!companyName.trim()) { showToast('Please enter your company name', 'error'); return; }
    if (!jobTitle.trim()) { showToast('Please enter your job title', 'error'); return; }
    if (!startDate) { showToast('Please select your start date', 'error'); return; }
    setLoading(true);
    try {
      if (selectedWork && !isEditing) {
        animateToStep(STEPS.VERIFY);
      } else {
        const workData = { companyName: companyName.trim(), organizationId, jobTitle: jobTitle.trim(), startDate, isCurrent: true, employmentType: 'Full-time' };
        let res;
        if (selectedWork && isEditing) {
          res = await refopenAPI.updateWorkExperienceById(selectedWork.WorkExperienceID, workData);
        } else {
          res = await refopenAPI.createWorkExperience(workData);
        }
        if (res.success) { setSelectedWork(res.data); setIsEditing(false); animateToStep(STEPS.VERIFY); }
        else showToast(res.error || 'Failed to save work experience', 'error');
      }
    } catch (err) { showToast('Something went wrong', 'error'); }
    finally { setLoading(false); }
  };

  // ── Send OTP (company or college) ──
  const handleSendOtp = async () => {
    setSendingOtp(true);
    setOtpError('');
    try {
      if (method === METHODS.COMPANY_EMAIL) {
        const fullEmail = companyEmail.includes('@') ? companyEmail : `${companyEmail}@${emailDomain}`;
        if (!fullEmail.includes('@') || !fullEmail.includes('.')) { showToast('Please enter a valid email', 'error'); setSendingOtp(false); return; }
        const domain = fullEmail.split('@')[1]?.toLowerCase();
        if (PERSONAL_DOMAINS.includes(domain)) { showToast('Personal emails not allowed', 'error'); setSendingOtp(false); return; }
        if (!isEmailDomainMatchingCompany(fullEmail, companyName)) { showToast(`Email domain doesn't match ${companyName}`, 'error'); setSendingOtp(false); return; }
        if (!selectedWork?.WorkExperienceID) { showToast('Work experience not found', 'error'); setSendingOtp(false); return; }
        const res = await refopenAPI.sendCompanyEmailOTP(selectedWork.WorkExperienceID, fullEmail);
        if (res.success) { setOtpSent(true); setResendTimer(120); showToast(`OTP sent to ${res.data?.email || fullEmail}`, 'success'); }
        else showToast(res.error || 'Failed to send OTP', 'error');
      } else if (method === METHODS.COLLEGE_EMAIL) {
        if (!collegeEmail.includes('@') || !collegeEmail.includes('.')) { showToast('Please enter a valid college email', 'error'); setSendingOtp(false); return; }
        const domain = collegeEmail.split('@')[1]?.toLowerCase();
        if (PERSONAL_DOMAINS.includes(domain)) { showToast('Personal emails not allowed. Use your college email.', 'error'); setSendingOtp(false); return; }
        if (!collegeName.trim()) { showToast('Please enter your college name', 'error'); setSendingOtp(false); return; }
        const res = await refopenAPI.apiCall('/verification/user/college-email/send-otp', { method: 'POST', body: JSON.stringify({ collegeEmail, collegeName: collegeName.trim() }) });
        if (res.success) { setOtpSent(true); setResendTimer(120); showToast(`OTP sent to ${res.data?.email || collegeEmail}`, 'success'); }
        else showToast(res.error || 'Failed to send OTP', 'error');
      }
    } catch (err) { showToast('Failed to send OTP', 'error'); }
    finally { setSendingOtp(false); }
  };

  // ── Verify OTP ──
  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 4) { setOtpError('Please enter the 4-digit OTP'); return; }
    setVerifying(true);
    setOtpError('');
    try {
      let res;
      if (method === METHODS.COMPANY_EMAIL) {
        res = await refopenAPI.verifyCompanyEmailOTP(selectedWork.WorkExperienceID, otpCode);
      } else {
        res = await refopenAPI.apiCall('/verification/user/college-email/verify-otp', { method: 'POST', body: JSON.stringify({ otp: otpCode }) });
      }
      if (res.success) {
        await refreshVerificationStatus();
        setSuccessType('immediate');
        animateToStep(STEPS.SUCCESS);
      } else {
        setOtpError(res.error || 'Invalid OTP');
        setOtp(['', '', '', '']);
        otpRefs[0].current?.focus();
      }
    } catch (err) { setOtpError('Verification failed'); }
    finally { setVerifying(false); }
  };

  // ── OTP input handlers ──
  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text.replace(/[^0-9]/g, '');
    setOtp(newOtp);
    setOtpError('');
    if (text && index < 3) otpRefs[index + 1].current?.focus();
  };
  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
      const newOtp = [...otp]; newOtp[index - 1] = ''; setOtp(newOtp);
    }
  };

  // ── Image pickers (Aadhaar) ──
  const pickAadhaarPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (!result.canceled && result.assets?.[0]) setAadhaarPhoto(result.assets[0]);
    } catch (err) { showToast('Failed to pick image', 'error'); }
  };

  const takeSelfie = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { showToast('Camera permission required', 'error'); return; }
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets?.[0]) setSelfiePhoto(result.assets[0]);
    } catch (err) {
      // Fallback to gallery on web
      if (Platform.OS === 'web') {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!result.canceled && result.assets?.[0]) setSelfiePhoto(result.assets[0]);
      } else {
        showToast('Failed to open camera', 'error');
      }
    }
  };

  // ── Submit Aadhaar ──
  const handleSubmitAadhaar = async () => {
    if (!aadhaarPhoto) { showToast('Please upload your Aadhaar card photo', 'error'); return; }
    if (!selfiePhoto) { showToast('Please take a selfie', 'error'); return; }
    setUploading(true);
    try {
      const aadhaarUpload = await refopenAPI.uploadFile(aadhaarPhoto.uri, 'verification-docs');
      if (!aadhaarUpload.success) throw new Error('Failed to upload Aadhaar photo');
      const selfieUpload = await refopenAPI.uploadFile(selfiePhoto.uri, 'verification-docs');
      if (!selfieUpload.success) throw new Error('Failed to upload selfie');
      const res = await refopenAPI.apiCall('/verification/user/aadhaar/submit', {
        method: 'POST',
        body: JSON.stringify({ aadhaarPhotoURL: aadhaarUpload.data.fileUrl, selfiePhotoURL: selfieUpload.data.fileUrl }),
      });
      if (res.success) { setSuccessType('pending'); animateToStep(STEPS.SUCCESS); }
      else showToast(res.error || 'Submission failed', 'error');
    } catch (err) { showToast(err.message || 'Upload failed', 'error'); }
    finally { setUploading(false); }
  };

  const styles = useMemo(() => makeStyles(colors, isDark, responsive), [colors, isDark, responsive]);

  // Check for pending Aadhaar
  const hasPendingAadhaar = existingStatus?.verifications?.some(v => v.Method === 'Aadhaar' && v.Status === 'Pending');
  const hasRejectedAadhaar = existingStatus?.verifications?.find(v => v.Method === 'Aadhaar' && v.Status === 'Rejected');

  if (checkingStatus) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ─── Step 0: Intro ────────────────
  const renderIntro = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#2563EB', '#7C3AED']} style={styles.heroBanner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Ionicons name="shield-checkmark" size={56} color="#fff" />
        <Text style={styles.heroTitle}>Get Verified</Text>
        <Text style={styles.heroSubtitle}>Earn the blue tick badge and stand out to recruiters & referrers</Text>
      </LinearGradient>

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Why Get Verified?</Text>
      {[
        { icon: 'checkmark-circle', color: '#10B981', title: 'Trusted Profile', desc: 'Blue tick shows you are who you say you are' },
        { icon: 'eye', color: '#3B82F6', title: 'More Visibility', desc: 'Verified profiles get 3x more views from recruiters' },
        { icon: 'people', color: '#8B5CF6', title: 'Priority Referrals', desc: 'Referrers prefer verified candidates' },
        { icon: 'shield-checkmark', color: '#F59E0B', title: 'Permanent Badge', desc: 'Once verified, your blue tick never expires' },
      ].map((item, i) => (
        <View key={i} style={styles.advantageCard}>
          <View style={[styles.advantageIcon, { backgroundColor: item.color + '15' }]}>
            <Ionicons name={item.icon} size={22} color={item.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.advantageTitle}>{item.title}</Text>
            <Text style={styles.advantageDesc}>{item.desc}</Text>
          </View>
        </View>
      ))}

      {hasPendingAadhaar && (
        <View style={[styles.warningBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
          <Ionicons name="time-outline" size={20} color="#D97706" />
          <Text style={[styles.warningText, { color: '#92400E' }]}>Your Aadhaar verification is pending admin review.</Text>
        </View>
      )}

      {hasRejectedAadhaar && (
        <View style={[styles.warningBanner, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
          <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.warningText, { color: '#991B1B' }]}>Aadhaar verification was rejected.</Text>
            {hasRejectedAadhaar.RejectionReason && <Text style={[styles.warningText, { color: '#B91C1C', fontSize: 12, marginTop: 2 }]}>Reason: {hasRejectedAadhaar.RejectionReason}</Text>}
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={() => animateToStep(STEPS.METHOD)} disabled={hasPendingAadhaar}>
        <Text style={styles.primaryButtonText}>{hasPendingAadhaar ? 'Pending Review...' : 'Get Started'}</Text>
        {!hasPendingAadhaar && <Ionicons name="arrow-forward" size={18} color="#fff" />}
      </TouchableOpacity>
    </ScrollView>
  );

  // ─── Step 1: Choose Method ────────────────
  const renderMethodChoice = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Choose Verification Method</Text>
      <Text style={[styles.sectionSubtitle, { marginBottom: 20 }]}>Any one method is enough to get your blue tick</Text>

      {/* Method 1: Company Email */}
      <TouchableOpacity style={[styles.methodCard, method === METHODS.COMPANY_EMAIL && styles.methodCardSelected]} onPress={() => setMethod(METHODS.COMPANY_EMAIL)}>
        <View style={[styles.methodIcon, { backgroundColor: '#3B82F615' }]}>
          <Ionicons name="business" size={24} color="#3B82F6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.methodTitle}>Company Email</Text>
          <Text style={styles.methodDesc}>Verify with your current work email (e.g., you@company.com)</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>Instant ⚡</Text></View>
        </View>
        <Ionicons name={method === METHODS.COMPANY_EMAIL ? 'radio-button-on' : 'radio-button-off'} size={22} color={method === METHODS.COMPANY_EMAIL ? colors.primary : colors.textSecondary} />
      </TouchableOpacity>

      {/* Method 2: College Email */}
      <TouchableOpacity style={[styles.methodCard, method === METHODS.COLLEGE_EMAIL && styles.methodCardSelected]} onPress={() => setMethod(METHODS.COLLEGE_EMAIL)}>
        <View style={[styles.methodIcon, { backgroundColor: '#8B5CF615' }]}>
          <Ionicons name="school" size={24} color="#8B5CF6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.methodTitle}>College Email</Text>
          <Text style={styles.methodDesc}>Verify with your college/university email (e.g., you@college.edu)</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>Instant ⚡</Text></View>
        </View>
        <Ionicons name={method === METHODS.COLLEGE_EMAIL ? 'radio-button-on' : 'radio-button-off'} size={22} color={method === METHODS.COLLEGE_EMAIL ? colors.primary : colors.textSecondary} />
      </TouchableOpacity>

      {/* Method 3: Aadhaar */}
      <TouchableOpacity style={[styles.methodCard, method === METHODS.AADHAAR && styles.methodCardSelected]} onPress={() => setMethod(METHODS.AADHAAR)}>
        <View style={[styles.methodIcon, { backgroundColor: '#F59E0B15' }]}>
          <MaterialCommunityIcons name="card-account-details" size={24} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.methodTitle}>Aadhaar Card</Text>
          <Text style={styles.methodDesc}>Upload Aadhaar card photo + selfie for manual verification</Text>
          <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}><Text style={[styles.badgeText, { color: '#92400E' }]}>24-48 hrs ⏱️</Text></View>
        </View>
        <Ionicons name={method === METHODS.AADHAAR ? 'radio-button-on' : 'radio-button-off'} size={22} color={method === METHODS.AADHAAR ? colors.primary : colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.primaryButton, !method && { opacity: 0.5 }]} onPress={() => { if (method) animateToStep(STEPS.VERIFY); }} disabled={!method}>
        <Text style={styles.primaryButtonText}>Continue</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </ScrollView>
  );

  // ─── Step 2: Company Email (work exp + OTP) ──
  const renderCompanyEmailVerify = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
        {/* If no current work — show work exp form */}
        {!selectedWork || isEditing ? (
          <>
            <Text style={styles.sectionTitle}>{isEditing ? 'Edit' : 'Add'} Current Work Experience</Text>
            <Text style={styles.inputLabel}>Company</Text>
            <TextInput style={styles.input} value={companySearch || companyName} onChangeText={handleCompanySearch} placeholder="Search company..." placeholderTextColor={colors.textSecondary} />
            {companyResults.length > 0 && (
              <View style={styles.dropdown}>
                {companyResults.map((org, i) => (
                  <TouchableOpacity key={i} style={styles.dropdownItem} onPress={() => selectCompany(org)}>
                    <Text style={styles.dropdownText}>{org.Name || org.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.inputLabel}>Job Title</Text>
            <TextInput style={styles.input} value={jobTitle} onChangeText={setJobTitle} placeholder="e.g., Software Engineer" placeholderTextColor={colors.textSecondary} />
            <Text style={styles.inputLabel}>Start Date</Text>
            <DatePicker value={startDate} onChange={setStartDate} placeholder="Select start date" maximumDate={new Date()} colors={colors} />
            <TouchableOpacity style={styles.primaryButton} onPress={handleWorkNext} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <><Text style={styles.primaryButtonText}>Next</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>}
            </TouchableOpacity>
          </>
        ) : !otpSent ? (
          <>
            <Text style={styles.sectionTitle}>Verify Company Email</Text>
            <View style={styles.workPreview}>
              <Ionicons name="business" size={20} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.workPreviewTitle}>{selectedWork.CompanyName || companyName}</Text>
                <Text style={styles.workPreviewSub}>{selectedWork.JobTitle || jobTitle}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsEditing(true)}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Company Email</Text>
            <View style={styles.emailInputRow}>
              <TextInput style={[styles.input, { flex: 1 }]} value={companyEmail} onChangeText={setCompanyEmail} placeholder="your.name" placeholderTextColor={colors.textSecondary} keyboardType="email-address" autoCapitalize="none" />
              {emailDomain && !companyEmail.includes('@') && (
                <Text style={styles.emailDomain}>@{emailDomain}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSendOtp} disabled={sendingOtp}>
              {sendingOtp ? <ActivityIndicator color="#fff" /> : <><Ionicons name="mail" size={18} color="#fff" /><Text style={styles.primaryButtonText}> Send OTP</Text></>}
            </TouchableOpacity>
          </>
        ) : renderOtpInput()
        }
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ─── Step 2: College Email (email + OTP) ──
  const renderCollegeEmailVerify = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
        {!otpSent ? (
          <>
            <Text style={styles.sectionTitle}>Verify College Email</Text>
            <Text style={[styles.sectionSubtitle, { marginBottom: 16 }]}>Use your college or university email to get verified instantly</Text>
            <Text style={styles.inputLabel}>College / University Name</Text>
            <TextInput style={styles.input} value={collegeName} onChangeText={setCollegeName} placeholder="e.g., IIT Bombay, VIT Vellore..." placeholderTextColor={colors.textSecondary} />
            <Text style={styles.inputLabel}>College Email</Text>
            <TextInput style={styles.input} value={collegeEmail} onChangeText={setCollegeEmail} placeholder="you@college.edu.in" placeholderTextColor={colors.textSecondary} keyboardType="email-address" autoCapitalize="none" />
            <TouchableOpacity style={styles.primaryButton} onPress={handleSendOtp} disabled={sendingOtp}>
              {sendingOtp ? <ActivityIndicator color="#fff" /> : <><Ionicons name="mail" size={18} color="#fff" /><Text style={styles.primaryButtonText}> Send OTP</Text></>}
            </TouchableOpacity>
          </>
        ) : renderOtpInput()}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ─── Shared OTP Input UI ──
  const renderOtpInput = () => (
    <>
      <Text style={styles.sectionTitle}>Enter Verification Code</Text>
      <Text style={[styles.sectionSubtitle, { marginBottom: 24 }]}>We sent a 4-digit code to your email</Text>
      <View style={styles.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={otpRefs[i]}
            style={[styles.otpBox, otpError && styles.otpBoxError]}
            value={digit}
            onChangeText={(text) => handleOtpChange(text, i)}
            onKeyPress={(e) => handleOtpKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
          />
        ))}
      </View>
      {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}
      <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyOtp} disabled={verifying}>
        {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.resendBtn} onPress={() => { setOtp(['', '', '', '']); setOtpSent(false); setOtpError(''); }} disabled={resendTimer > 0}>
        <Text style={[styles.resendText, resendTimer > 0 && { color: colors.textSecondary }]}>
          {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
        </Text>
      </TouchableOpacity>
    </>
  );

  // ─── Step 2: Aadhaar Upload ──
  const renderAadhaarVerify = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Aadhaar Verification</Text>
      <Text style={[styles.sectionSubtitle, { marginBottom: 20 }]}>Upload your Aadhaar card and take a selfie. Our team will review within 24-48 hours.</Text>

      {/* Aadhaar Photo */}
      <Text style={styles.inputLabel}>Aadhaar Card Photo</Text>
      <TouchableOpacity style={styles.uploadBox} onPress={pickAadhaarPhoto}>
        {aadhaarPhoto ? (
          <Image source={{ uri: aadhaarPhoto.uri }} style={styles.uploadPreview} resizeMode="cover" />
        ) : (
          <View style={styles.uploadPlaceholder}>
            <Ionicons name="camera" size={32} color={colors.textSecondary} />
            <Text style={styles.uploadText}>Tap to upload Aadhaar card</Text>
            <Text style={[styles.uploadText, { fontSize: 11, marginTop: 4 }]}>Front side with photo & name visible</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Selfie */}
      <Text style={[styles.inputLabel, { marginTop: 20 }]}>Your Selfie</Text>
      <TouchableOpacity style={styles.uploadBox} onPress={takeSelfie}>
        {selfiePhoto ? (
          <Image source={{ uri: selfiePhoto.uri }} style={[styles.uploadPreview, { borderRadius: 12 }]} resizeMode="cover" />
        ) : (
          <View style={styles.uploadPlaceholder}>
            <Ionicons name="person-circle" size={32} color={colors.textSecondary} />
            <Text style={styles.uploadText}>Tap to take a selfie</Text>
            <Text style={[styles.uploadText, { fontSize: 11, marginTop: 4 }]}>Clear face photo for identity match</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={[styles.warningBanner, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6', marginTop: 20 }]}>
        <Ionicons name="lock-closed" size={16} color="#2563EB" />
        <Text style={[styles.warningText, { color: '#1E40AF' }]}>Your documents are encrypted and stored securely. They will only be used for verification.</Text>
      </View>

      <TouchableOpacity style={[styles.primaryButton, (!aadhaarPhoto || !selfiePhoto) && { opacity: 0.5 }]} onPress={handleSubmitAadhaar} disabled={!aadhaarPhoto || !selfiePhoto || uploading}>
        {uploading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="cloud-upload" size={18} color="#fff" /><Text style={styles.primaryButtonText}> Submit for Review</Text></>}
      </TouchableOpacity>
    </ScrollView>
  );

  // ─── Step 3: Success ──
  const renderSuccess = () => (
    <View style={[styles.stepContainer, { justifyContent: 'center', alignItems: 'center', paddingTop: 60 }]}>
      <LinearGradient colors={successType === 'immediate' ? ['#10B981', '#059669'] : ['#F59E0B', '#D97706']} style={styles.successCircle}>
        <Ionicons name={successType === 'immediate' ? 'checkmark-circle' : 'time'} size={64} color="#fff" />
      </LinearGradient>
      <Text style={[styles.heroTitle, { color: colors.text, marginTop: 24 }]}>
        {successType === 'immediate' ? 'You\'re Verified! 🎉' : 'Submitted for Review'}
      </Text>
      <Text style={[styles.sectionSubtitle, { textAlign: 'center', paddingHorizontal: 32, marginTop: 8 }]}>
        {successType === 'immediate'
          ? 'Your blue tick badge is now active. You\'ll stand out on every interaction!'
          : 'Our team will review your documents within 24-48 hours. You\'ll be notified once verified.'}
      </Text>
      <TouchableOpacity style={[styles.primaryButton, { marginTop: 32 }]} onPress={() => navigation.goBack()}>
        <Text style={styles.primaryButtonText}>Back to Profile</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Step labels ──
  const stepLabels = ['Intro', 'Method', method === METHODS.COMPANY_EMAIL ? 'Work & OTP' : method === METHODS.COLLEGE_EMAIL ? 'Email OTP' : 'Upload', 'Done'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (step > 0) animateToStep(step - 1); else navigation.goBack(); }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Get Verified</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Step indicator */}
      {step < STEPS.SUCCESS && (
        <View style={styles.stepIndicator}>
          {stepLabels.slice(0, -1).map((label, idx) => (
            <View key={idx} style={styles.stepDotContainer}>
              <View style={[styles.stepDot, step >= idx && styles.stepDotActive]} />
              <Text style={[styles.stepLabel, step >= idx && styles.stepLabelActive]}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Content */}
      <Animated.View style={{ flex: 1, opacity: stepAnim }}>
        {step === STEPS.INTRO && renderIntro()}
        {step === STEPS.METHOD && renderMethodChoice()}
        {step === STEPS.VERIFY && method === METHODS.COMPANY_EMAIL && renderCompanyEmailVerify()}
        {step === STEPS.VERIFY && method === METHODS.COLLEGE_EMAIL && renderCollegeEmailVerify()}
        {step === STEPS.VERIFY && method === METHODS.AADHAAR && renderAadhaarVerify()}
        {step === STEPS.SUCCESS && renderSuccess()}
      </Animated.View>
    </View>
  );
}

// ─── Styles ──
function makeStyles(colors, isDark, responsive) {
  const isDesktop = responsive?.isDesktop;
  const maxW = isDesktop ? 560 : '100%';
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    stepContainer: { flex: 1 },
    stepContent: { padding: 20, maxWidth: maxW, width: '100%', alignSelf: 'center' },
    heroBanner: { borderRadius: 16, padding: 32, alignItems: 'center', marginBottom: 8 },
    heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 12 },
    heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 6, lineHeight: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
    sectionSubtitle: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    advantageCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
    advantageIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    advantageTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    advantageDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    methodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: colors.border },
    methodCardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
    methodIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    methodTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    methodDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
    badge: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginTop: 6 },
    badgeText: { fontSize: 11, fontWeight: '600', color: '#059669' },
    primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, marginTop: 20, gap: 6 },
    primaryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    inputLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 14 },
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text },
    dropdown: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: -4, marginBottom: 8, maxHeight: 180 },
    dropdownItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border + '40' },
    dropdownText: { fontSize: 14, color: colors.text },
    emailInputRow: { flexDirection: 'row', alignItems: 'center' },
    emailDomain: { fontSize: 14, color: colors.textSecondary, marginLeft: 4, fontWeight: '500' },
    workPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
    workPreviewTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    workPreviewSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 8 },
    otpBox: { width: 52, height: 56, borderWidth: 2, borderColor: colors.border, borderRadius: 12, textAlign: 'center', fontSize: 22, fontWeight: '700', color: colors.text, backgroundColor: colors.surface },
    otpBoxError: { borderColor: '#EF4444' },
    errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 8 },
    resendBtn: { alignItems: 'center', marginTop: 16 },
    resendText: { fontSize: 14, fontWeight: '600', color: colors.primary },
    uploadBox: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 14, height: 160, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    uploadPreview: { width: '100%', height: '100%' },
    uploadPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    uploadText: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
    warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 16 },
    warningText: { fontSize: 12, flex: 1, lineHeight: 16 },
    successCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
    stepIndicator: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, gap: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
    stepDotContainer: { alignItems: 'center', gap: 4 },
    stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
    stepDotActive: { backgroundColor: colors.primary },
    stepLabel: { fontSize: 10, color: colors.textSecondary },
    stepLabelActive: { color: colors.primary, fontWeight: '600' },
  });
}
