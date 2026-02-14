/**
 * BecomeReferrerScreen — Beautiful, simple flow to become a verified referrer
 * 
 * Steps:
 *   1. Hero + advantages of becoming a referrer
 *   2. Current work experience (auto-fetched or user adds/edits)
 *   3. Company email OTP verification
 *   4. Success celebration
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import useResponsive from '../../hooks/useResponsive';
import { showToast } from '../../components/Toast';
import refopenAPI from '../../services/api';
import VerifiedReferrerOverlay from '../../components/VerifiedReferrerOverlay';
import DatePicker from '../../components/DatePicker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Personal email domains that are blocked
const PERSONAL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'icloud.com', 'mail.com', 'protonmail.com', 'ymail.com', 'aol.com', 'zoho.com', 'rediffmail.com'];

// Smart domain-company matching (same logic as WorkExperienceSection)
const normalizeCompanyName = (name) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const isEmailDomainMatchingCompany = (email, companyName) => {
  if (!email || !companyName) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;

  const domainCompany = domain.split('.')[0];
  let normalized = normalizeCompanyName(companyName);

  // Strip common company suffixes
  const suffixes = ['inc', 'llc', 'ltd', 'pvtltd', 'pvt', 'corp', 'corporation', 'limited', 'company', 'technologies', 'tech', 'software', 'solutions', 'services', 'group', 'india', 'global'];
  suffixes.forEach(s => {
    normalized = normalized.replace(new RegExp(s + '$', 'i'), '');
  });

  // Match: domain matches company, or company starts with domain, or domain contains normalized company
  return domainCompany === normalized ||
         normalized.startsWith(domainCompany) ||
         (normalized.length >= 3 && domain.split('.').some(part => part === normalized));
};

// Steps
const STEPS = { INTRO: 0, WORK: 1, VERIFY: 2, SUCCESS: 3 };

export default function BecomeReferrerScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { user, currentWork, refreshVerificationStatus, isVerifiedReferrer } = useAuth();
  const responsive = useResponsive();
  const isDesktop = responsive.isDesktop;

  // Step management
  const [step, setStep] = useState(STEPS.INTRO);
  const stepAnim = useRef(new Animated.Value(0)).current;

  // Work experience state
  const [loading, setLoading] = useState(false);
  const [workExperiences, setWorkExperiences] = useState([]);
  const [selectedWork, setSelectedWork] = useState(null);
  const [companySearch, setCompanySearch] = useState('');
  const [companyResults, setCompanyResults] = useState([]);
  const [searchingCompany, setSearchingCompany] = useState(false);

  // Form fields for new/edit work
  const [companyName, setCompanyName] = useState('');
  const [organizationId, setOrganizationId] = useState(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobTitleSearch, setJobTitleSearch] = useState('');
  const [jobRoles, setJobRoles] = useState([]);
  const [showJobTitleDropdown, setShowJobTitleDropdown] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // OTP verification state
  const [companyEmail, setCompanyEmail] = useState('');
  const [emailDomain, setEmailDomain] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = [useRef(), useRef(), useRef(), useRef()];

  // Success state
  const [showSuccess, setShowSuccess] = useState(false);

  // Smart navigation helper - detect if opened via deep link / page refresh
  const smartGoBack = () => {
    const navState = navigation.getState();
    const routes = navState?.routes || [];
    const currentIndex = navState?.index || 0;
    if (routes.length > 1 && currentIndex > 0) {
      navigation.goBack();
    } else {
      navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Home' } });
    }
  };

  // If opened via deep link / page refresh (no navigation history), redirect to Home
  useEffect(() => {
    if (!user) {
      navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Home' } });
      return;
    }
    const navState = navigation.getState();
    const routes = navState?.routes || [];
    const currentIndex = navState?.index || 0;
    if (routes.length <= 1 || currentIndex === 0) {
      navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Home' } });
      return;
    }
    if (isVerifiedReferrer) {
      showToast('You are already a verified referrer! 🎉', 'success');
      navigation.goBack();
    }
  }, []);

  // Fetch existing work experiences and job roles on mount
  useEffect(() => {
    fetchWorkExperiences();
    fetchJobRoles();
  }, []);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const fetchWorkExperiences = async () => {
    setLoading(true);
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
          // Guess email domain from company name
          guessEmailDomain(current.CompanyName);
        }
      }
    } catch (err) {
      console.error('Error fetching work experiences:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobRoles = async () => {
    try {
      const res = await refopenAPI.getReferenceMetadata('JobRole');
      if (res?.success && Array.isArray(res.data)) {
        setJobRoles(res.data.sort((a, b) => (a.Value || '').localeCompare(b.Value || '')));
      }
    } catch (err) {
      console.error('Failed to load job roles:', err);
    }
  };

  const guessEmailDomain = (name) => {
    if (!name) return;
    // Simple domain guess: lowercase, remove spaces, add .com
    const guess = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    setEmailDomain(guess);
  };

  // Company search with debounce
  const searchTimerRef = useRef(null);
  const handleCompanySearch = (text) => {
    setCompanySearch(text);
    setCompanyName(text);
    setOrganizationId(null);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (text.length < 2) {
      setCompanyResults([]);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearchingCompany(true);
      try {
        const res = await refopenAPI.getOrganizations(text, 6);
        if (res.success && res.data) {
          setCompanyResults(res.data);
        }
      } catch (err) {
        console.error('Company search error:', err);
      } finally {
        setSearchingCompany(false);
      }
    }, 300);
  };

  const selectCompany = (org) => {
    const name = org.name || org.Name;
    const id = org.id || org.OrganizationID;
    setCompanyName(name);
    setOrganizationId(id);
    setCompanySearch(name);
    setCompanyResults([]);
    guessEmailDomain(name);
  };

  // Animate step transition
  const animateToStep = (nextStep) => {
    Animated.timing(stepAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      Animated.timing(stepAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  };

  useEffect(() => {
    stepAnim.setValue(1);
  }, []);

  // Save or use existing work experience, then go to verify step
  const handleWorkNext = async () => {
    if (!companyName.trim()) {
      showToast('Please enter your company name', 'error');
      return;
    }
    if (!jobTitle.trim()) {
      showToast('Please enter your job title', 'error');
      return;
    }
    if (!startDate) {
      showToast('Please select your start date', 'error');
      return;
    }

    setLoading(true);
    try {
      if (selectedWork && !isEditing) {
        // Use existing current work
        animateToStep(STEPS.VERIFY);
      } else {
        // Create or update work experience
        const workData = {
          companyName: companyName.trim(),
          organizationId: organizationId,
          jobTitle: jobTitle.trim(),
          startDate: startDate,
          isCurrent: true,
          employmentType: 'Full-time',
        };

        let res;
        if (selectedWork && isEditing) {
          res = await refopenAPI.updateWorkExperienceById(selectedWork.WorkExperienceID, workData);
        } else {
          res = await refopenAPI.createWorkExperience(workData);
        }

        if (res.success) {
          const saved = res.data;
          setSelectedWork(saved);
          setIsEditing(false);
          animateToStep(STEPS.VERIFY);
        } else {
          showToast(res.error || 'Failed to save work experience', 'error');
        }
      }
    } catch (err) {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Send OTP
  const handleSendOtp = async () => {
    const fullEmail = companyEmail.includes('@') ? companyEmail : `${companyEmail}@${emailDomain}`;
    
    // Validate
    if (!fullEmail || !fullEmail.includes('@') || !fullEmail.includes('.')) {
      showToast('Please enter a valid company email', 'error');
      return;
    }

    const domain = fullEmail.split('@')[1]?.toLowerCase();
    if (PERSONAL_DOMAINS.includes(domain)) {
      showToast('Personal emails are not allowed. Please use your company email.', 'error');
      return;
    }

    // Validate email domain matches selected company
    if (!isEmailDomainMatchingCompany(fullEmail, companyName)) {
      showToast(`This email domain doesn't match ${companyName}. Please use your ${companyName} work email.`, 'error');
      return;
    }

    if (!selectedWork?.WorkExperienceID) {
      showToast('Work experience not found. Please go back and try again.', 'error');
      return;
    }

    setSendingOtp(true);
    setOtpError('');
    try {
      const res = await refopenAPI.sendCompanyEmailOTP(selectedWork.WorkExperienceID, fullEmail);
      if (res.success) {
        setOtpSent(true);
        setResendTimer(120);
        showToast(`OTP sent to ${res.data?.email || fullEmail}`, 'success');
      } else {
        showToast(res.error || 'Failed to send OTP', 'error');
      }
    } catch (err) {
      showToast('Failed to send OTP. Please try again.', 'error');
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 4) {
      setOtpError('Please enter the 4-digit OTP');
      return;
    }

    setVerifying(true);
    setOtpError('');
    try {
      const res = await refopenAPI.verifyCompanyEmailOTP(selectedWork.WorkExperienceID, otpCode);
      if (res.success) {
        // Refresh auth context
        await refreshVerificationStatus();
        setShowSuccess(true);
      } else {
        setOtpError(res.error || 'Invalid OTP. Please try again.');
        setOtp(['', '', '', '']);
        otpRefs[0].current?.focus();
      }
    } catch (err) {
      setOtpError('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // OTP input handler
  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text.replace(/[^0-9]/g, '');
    setOtp(newOtp);
    setOtpError('');

    if (text && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  // Styles
  const styles = makeStyles(colors, isDark, responsive);

  // ─── Step 1: Intro / Advantages ────────────────
  const renderIntro = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.heroBlock}>
        <LinearGradient
          colors={[colors.primary + '15', colors.primary + '05']}
          style={styles.heroBg}
        >
          <View style={styles.heroIconCircle}>
            <Ionicons name="shield-checkmark" size={48} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Become a Verified Referrer</Text>
          <Text style={styles.heroSubtitle}>
            Earn money by referring candidates to your company. Verify your employment in just 2 minutes.
          </Text>
        </LinearGradient>
      </View>

      {/* Advantages */}
      <Text style={styles.sectionTitle}>Why become a referrer?</Text>
      
      {[
        { icon: 'cash-outline', color: '#10B981', title: 'Earn upto ₹100 & exciting RefPoints', desc: 'Get paid for every successful referral you make' },
        { icon: 'briefcase-outline', color: '#EC4899', title: 'Post jobs for free', desc: 'Post referral jobs at your company at no cost' },
        { icon: 'ribbon-outline', color: '#8B5CF6', title: 'Verified badge', desc: 'Stand out with a verified referrer badge on your profile' },
        { icon: 'people-outline', color: colors.primary, title: 'Help job seekers', desc: 'Make a real impact by referring talented candidates' },
        { icon: 'notifications-outline', color: '#F59E0B', title: 'Get notified instantly', desc: 'Receive alerts when someone needs a referral at your company' },
      ].map((item, idx) => (
        <View key={idx} style={styles.advantageCard}>
          <View style={[styles.advantageIcon, { backgroundColor: item.color + '15' }]}>
            <Ionicons name={item.icon} size={22} color={item.color} />
          </View>
          <View style={styles.advantageContent}>
            <Text style={styles.advantageTitle}>{item.title}</Text>
            <Text style={styles.advantageDesc}>{item.desc}</Text>
          </View>
        </View>
      ))}

      {/* How it works */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>How it works</Text>
      
      {[
        { step: '1', title: 'Confirm your company', desc: 'Tell us where you currently work' },
        { step: '2', title: 'Verify with company email', desc: 'Enter your work email to receive an OTP' },
        { step: '3', title: 'Start referring!', desc: 'You\'re verified — start earning rewards' },
      ].map((item, idx) => (
        <View key={idx} style={styles.howItWorksRow}>
          <View style={styles.stepBubble}>
            <Text style={styles.stepBubbleText}>{item.step}</Text>
          </View>
          <View style={styles.howItWorksContent}>
            <Text style={styles.howItWorksTitle}>{item.title}</Text>
            <Text style={styles.howItWorksDesc}>{item.desc}</Text>
          </View>
        </View>
      ))}

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  // ─── Step 2: Work Experience ───────────────────
  const renderWork = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Where do you work?</Text>
      <Text style={styles.stepDesc}>
        {selectedWork && !isEditing
          ? 'We found your current work experience. Confirm or edit it.'
          : 'Enter your current company and role to get verified.'}
      </Text>

      {/* If existing work found and not editing — show card */}
      {selectedWork && !isEditing ? (
        <View style={styles.workCard}>
          <View style={styles.workCardHeader}>
            <Ionicons name="business" size={24} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.workCardCompany}>{selectedWork.CompanyName || companyName}</Text>
              <Text style={styles.workCardTitle}>{selectedWork.JobTitle || jobTitle}</Text>
              {selectedWork.StartDate && (
                <Text style={styles.workCardDate}>
                  Since {new Date(selectedWork.StartDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Form for new/edit work */
        <View style={styles.formContainer}>
          {/* Company */}
          <View style={{ position: 'relative', zIndex: 2000 }}>
            <Text style={styles.fieldLabel}>Company *</Text>
            <TextInput
              style={styles.input}
              placeholder="Search your company..."
              placeholderTextColor={colors.gray400}
              value={companySearch || companyName}
              onChangeText={handleCompanySearch}
              autoCapitalize="words"
            />
            {/* Search results dropdown */}
            {companyResults.length > 0 && (
              <View style={styles.dropdown}>
                {companyResults.map((org) => (
                  <TouchableOpacity key={org.id || org.OrganizationID} style={styles.dropdownItem} onPress={() => selectCompany(org)}>
                    {org.logoURL ? (
                      <Image source={{ uri: org.logoURL }} style={styles.dropdownLogo} resizeMode="contain" />
                    ) : (
                      <View style={styles.dropdownLogoPlaceholder}>
                        <Ionicons name="business" size={16} color={colors.gray400} />
                      </View>
                    )}
                    <Text style={styles.dropdownText}>{org.name || org.Name}</Text>
                    {(org.verifiedReferrersCount || org.VerifiedReferrersCount) > 0 && (
                      <Text style={styles.dropdownBadge}>{org.verifiedReferrersCount || org.VerifiedReferrersCount} referrers</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {searchingCompany && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 4 }} />
            )}
          </View>

          {/* Job Title - with searchable dropdown */}
          <View style={{ position: 'relative', zIndex: 1000, marginTop: 16 }}>
            <Text style={styles.fieldLabel}>Job Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Software Engineer"
              placeholderTextColor={colors.gray400}
              value={jobTitleSearch || jobTitle}
              onChangeText={(text) => {
                setJobTitleSearch(text);
                setJobTitle(text);
                setShowJobTitleDropdown(text.length > 0);
              }}
              onFocus={() => {
                if (jobTitle) {
                  setJobTitleSearch('');
                }
              }}
              autoCapitalize="words"
              autoCorrect={false}
              spellCheck={false}
            />
            {showJobTitleDropdown && jobTitleSearch.length > 0 && (
              <View style={styles.dropdown}>
                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                  {jobRoles
                    .filter(role => role.Value && role.Value.toLowerCase().includes(jobTitleSearch.toLowerCase()))
                    .slice(0, 15)
                    .map((role) => (
                      <TouchableOpacity
                        key={role.ReferenceID}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setJobTitle(role.Value);
                          setJobTitleSearch('');
                          setShowJobTitleDropdown(false);
                        }}
                      >
                        <Ionicons name="briefcase-outline" size={16} color={colors.gray400} style={{ marginRight: 10 }} />
                        <Text style={[styles.dropdownText, { marginLeft: 0 }]}>{role.Value}</Text>
                      </TouchableOpacity>
                    ))
                  }
                  {jobRoles.filter(role => role.Value && role.Value.toLowerCase().includes(jobTitleSearch.toLowerCase())).length === 0 && (
                    <View style={{ paddingVertical: 14, paddingHorizontal: 14, alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>No matches — keep typing</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Start Date */}
          <View style={{ marginTop: 16 }}>
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(date) => setStartDate(date)}
              placeholder="When did you join?"
              required
              maximumDate={new Date()}
              colors={colors}
            />
          </View>

          {isEditing && (
            <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setIsEditing(false)}>
              <Text style={styles.cancelEditText}>Cancel editing</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  // ─── Step 3: Email Verification ────────────────
  const renderVerify = () => {
    const fullEmail = companyEmail.includes('@') ? companyEmail : (companyEmail ? `${companyEmail}@${emailDomain}` : '');

    return (
      <ScrollView style={styles.stepContainer} contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
        <View style={styles.verifyHeader}>
          <View style={styles.companyBadge}>
            <Ionicons name="business" size={20} color={colors.primary} />
            <Text style={styles.companyBadgeText}>{companyName}</Text>
          </View>
          <Text style={styles.stepTitle}>Verify your company email</Text>
          <Text style={styles.stepDesc}>
            Enter your work email address. We'll send a 4-digit OTP to verify you work at {companyName}. Your email is used once and never stored.
          </Text>
        </View>

        {/* Email input */}
        {!otpSent ? (
          <View style={styles.emailInputContainer}>
            <Text style={styles.fieldLabel}>Company Email</Text>
            <View style={styles.emailRow}>
              <TextInput
                style={[styles.input, styles.emailPrefix]}
                placeholder="yourname"
                placeholderTextColor={colors.gray400}
                value={companyEmail}
                onChangeText={setCompanyEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              <View style={styles.emailDomainBox}>
                <Text style={styles.emailDomainText}>@{emailDomain}</Text>
              </View>
            </View>
            
            <TouchableOpacity onPress={() => {
              // Toggle to full email input
              if (emailDomain) {
                setCompanyEmail(companyEmail ? `${companyEmail}@${emailDomain}` : '');
                setEmailDomain('');
              }
            }}>
              <Text style={styles.customDomainLink}>
                {emailDomain ? 'Use a different domain?' : ''}
              </Text>
            </TouchableOpacity>

            <Text style={styles.emailNote}>
              <Ionicons name="lock-closed" size={12} color={colors.gray400} /> Personal emails (Gmail, Yahoo, etc.) are not accepted
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, (!companyEmail || sendingOtp) && styles.primaryButtonDisabled]}
              onPress={handleSendOtp}
              disabled={!companyEmail || sendingOtp}
            >
              {sendingOtp ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="mail" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>Send OTP</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* OTP Input */
          <View style={styles.otpContainer}>
            <View style={styles.otpSentBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={styles.otpSentText}>OTP sent to {fullEmail}</Text>
            </View>

            <Text style={styles.fieldLabel}>Enter 4-digit OTP</Text>
            <View style={styles.otpRow}>
              {otp.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={otpRefs[idx]}
                  style={[styles.otpBox, digit && styles.otpBoxFilled, otpError && styles.otpBoxError]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, idx)}
                  onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                />
              ))}
            </View>

            {otpError ? (
              <Text style={styles.otpErrorText}>{otpError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, (otp.join('').length !== 4 || verifying) && styles.primaryButtonDisabled]}
              onPress={handleVerifyOtp}
              disabled={otp.join('').length !== 4 || verifying}
            >
              {verifying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>Verify & Become Referrer</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Resend */}
            <TouchableOpacity
              style={styles.resendButton}
              onPress={() => {
                setOtpSent(false);
                setOtp(['', '', '', '']);
                setOtpError('');
              }}
              disabled={resendTimer > 0}
            >
              <Text style={[styles.resendText, resendTimer > 0 && { color: colors.gray400 }]}>
                {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Change email or resend OTP'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Need Help */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Support')}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, marginTop: 24 }}
        >
          <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Need Help?</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  // ─── Bottom Navigation Bar ─────────────────────
  const renderBottomBar = () => {
    if (step === STEPS.SUCCESS) return null;

    return (
      <View style={styles.bottomBar}>
        {/* Step indicators */}
        <View style={styles.stepIndicators}>
          {['Intro', 'Work', 'Verify'].map((label, idx) => (
            <View key={idx} style={styles.stepIndicatorItem}>
              <View style={[styles.stepDot, step >= idx && styles.stepDotActive]} />
              <Text style={[styles.stepLabel, step >= idx && styles.stepLabelActive]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.bottomActions}>
          {step > STEPS.INTRO && (
            <TouchableOpacity style={styles.backButton} onPress={() => animateToStep(step - 1)}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          {step === STEPS.INTRO && (
            <TouchableOpacity
              style={[styles.nextButton, { flex: 1 }]}
              onPress={() => animateToStep(STEPS.WORK)}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark || colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextButtonGradient}
              >
                <Text style={styles.nextButtonText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {step === STEPS.WORK && (
            <TouchableOpacity
              style={[styles.nextButton, { flex: 1 }, (!companyName || !jobTitle || loading) && { opacity: 0.5 }]}
              onPress={handleWorkNext}
              disabled={!companyName || !jobTitle || loading}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark || colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>Continue to Verify</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={smartGoBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a Referrer</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <Animated.View style={[{ flex: 1 }, { opacity: stepAnim }]}>
          {step === STEPS.INTRO && renderIntro()}
          {step === STEPS.WORK && renderWork()}
          {step === STEPS.VERIFY && renderVerify()}
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Bottom bar */}
      {renderBottomBar()}

      {/* Success overlay */}
      <VerifiedReferrerOverlay
        visible={showSuccess}
        onClose={() => {
          setShowSuccess(false);
          smartGoBack();
        }}
        companyName={companyName}
      />
    </View>
  );
}

function makeStyles(colors, isDark, responsive = {}) {
  const isDesktop = Platform.OS === 'web' && responsive.isDesktop;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      ...(isDesktop ? { alignItems: 'center' } : {}),
    },
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'web' ? 16 : 44,
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border || (isDark ? '#333' : '#E5E7EB'),
      width: '100%',
      ...(isDesktop ? { maxWidth: 900, alignSelf: 'center' } : {}),
    },
    headerBack: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    // Step container
    stepContainer: {
      flex: 1,
    },
    stepContent: {
      paddingHorizontal: isDesktop ? 40 : 20,
      paddingTop: 24,
      maxWidth: isDesktop ? 900 : 500,
      alignSelf: 'center',
      width: '100%',
    },
    // Hero
    heroBg: {
      borderRadius: 16,
      padding: 28,
      alignItems: 'center',
    },
    heroBlock: {
      marginBottom: 24,
    },
    heroIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    heroSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    // Section title
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    // Advantage cards
    advantageCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: isDark ? colors.border || '#333' : '#F3F4F6',
    },
    advantageIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    advantageContent: {
      flex: 1,
      marginLeft: 12,
    },
    advantageTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    advantageDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    // How it works
    howItWorksRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    stepBubble: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBubbleText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },
    howItWorksContent: {
      flex: 1,
      marginLeft: 12,
    },
    howItWorksTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    howItWorksDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    // Step header
    stepTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    stepDesc: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 20,
    },
    // Work card
    workCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1.5,
      borderColor: colors.primary + '40',
    },
    workCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    workCardCompany: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    workCardTitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    workCardDate: {
      fontSize: 12,
      color: colors.gray400,
      marginTop: 2,
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginTop: 12,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: colors.primary + '10',
    },
    editButtonText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
      marginLeft: 4,
    },
    // Form
    formContainer: {
      marginTop: 4,
      width: '100%',
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? '#444' : '#E5E7EB',
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 14 : 11,
      fontSize: 15,
      color: colors.text,
    },
    dropdown: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? '#444' : '#E5E7EB',
      marginTop: 4,
      overflow: 'hidden',
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: isDark ? '#333' : '#F3F4F6',
    },
    dropdownLogo: {
      width: 28,
      height: 28,
      borderRadius: 6,
    },
    dropdownLogoPlaceholder: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: isDark ? '#333' : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dropdownText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      marginLeft: 10,
    },
    dropdownBadge: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '600',
      marginLeft: 8,
    },
    cancelEditBtn: {
      alignSelf: 'center',
      marginTop: 16,
    },
    cancelEditText: {
      fontSize: 13,
      color: colors.textSecondary,
      textDecorationLine: 'underline',
    },
    // Verify
    verifyHeader: {
      marginBottom: 20,
    },
    companyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary + '12',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      alignSelf: 'flex-start',
      marginBottom: 12,
      gap: 6,
    },
    companyBadgeText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    emailInputContainer: {
      marginTop: 4,
    },
    emailRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    emailPrefix: {
      flex: 1,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      borderRightWidth: 0,
    },
    emailDomainBox: {
      backgroundColor: isDark ? '#2A2A2A' : '#F3F4F6',
      borderWidth: 1,
      borderLeftWidth: 0,
      borderColor: isDark ? '#444' : '#E5E7EB',
      borderTopRightRadius: 10,
      borderBottomRightRadius: 10,
      paddingHorizontal: 12,
      justifyContent: 'center',
    },
    emailDomainText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    customDomainLink: {
      fontSize: 12,
      color: colors.primary,
      marginTop: 6,
    },
    emailNote: {
      fontSize: 12,
      color: colors.gray400,
      marginTop: 10,
      marginBottom: 20,
    },
    // Primary button
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      gap: 8,
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
    // OTP
    otpContainer: {
      marginTop: 4,
    },
    otpSentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#10B981' + '15',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      marginBottom: 20,
      gap: 6,
    },
    otpSentText: {
      fontSize: 13,
      color: '#10B981',
      fontWeight: '600',
      flex: 1,
    },
    otpRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      marginVertical: 16,
    },
    otpBox: {
      width: 52,
      height: 56,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: isDark ? '#444' : '#E5E7EB',
      backgroundColor: colors.surface,
      textAlign: 'center',
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    otpBoxFilled: {
      borderColor: colors.primary,
    },
    otpBoxError: {
      borderColor: colors.error || '#EF4444',
    },
    otpErrorText: {
      fontSize: 13,
      color: colors.error || '#EF4444',
      textAlign: 'center',
      marginBottom: 12,
    },
    resendButton: {
      alignItems: 'center',
      marginTop: 16,
    },
    resendText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '500',
    },
    // Bottom bar
    bottomBar: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#333' : '#E5E7EB',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 30 : 16,
      width: '100%',
      ...(isDesktop ? { maxWidth: 900, alignSelf: 'center' } : {}),
    },
    stepIndicators: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 24,
      marginBottom: 12,
    },
    stepIndicatorItem: {
      alignItems: 'center',
      gap: 4,
    },
    stepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: isDark ? '#555' : '#D1D5DB',
    },
    stepDotActive: {
      backgroundColor: colors.primary,
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    stepLabel: {
      fontSize: 11,
      color: colors.gray400,
    },
    stepLabelActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    bottomActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: isDark ? '#333' : '#F3F4F6',
      gap: 4,
    },
    backButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    nextButton: {
      flex: 1,
    },
    nextButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    nextButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
  });
}
