import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePricing } from '../../contexts/PricingContext';
import useResponsive from '../../hooks/useResponsive';
import refopenAPI from '../../services/api';
import { typography } from '../../styles/theme';
import { showToast } from '../../components/Toast';
import WalletRechargeModal from '../../components/WalletRechargeModal';
import ResumeUploadModal from '../../components/ResumeUploadModal'; // ✅ NEW: Import ResumeUploadModal
import ReferralSuccessOverlay from '../../components/ReferralSuccessOverlay';
import ReferralConfirmModal from '../../components/ReferralConfirmModal';
import AdCard from '../../components/ads/AdCard'; // Google AdSense Ad

export default function AskReferralScreen({ navigation, route }) {
const { user, isJobSeeker, isAuthenticated } = useAuth();
const { colors } = useTheme();
const { pricing } = usePricing(); // 💰 DB-driven pricing
const responsive = useResponsive();
const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

// 🔐 Helper to check auth and redirect to login if needed
const requireAuth = (action) => {
  if (!isAuthenticated || !user) {
    // Save the current route to return after login
    navigation.navigate('Auth', {
      screen: 'Login',
      params: {
        returnTo: 'AskReferral',
        returnParams: route?.params,
      }
    });
    return false;
  }
  return true;
};
  
// ⚡ NEW: Separate loading states for lazy loading
const [loadingWallet, setLoadingWallet] = useState(true);
const [loadingResumes, setLoadingResumes] = useState(false);
const [loadingCompanies, setLoadingCompanies] = useState(false);
const [submitting, setSubmitting] = useState(false);
  
const [resumes, setResumes] = useState([]);

// 🎯 NEW: Dynamic Fortune 500 company showcase
const [fortune500Companies, setFortune500Companies] = useState([]);
const [currentCompanyIndex, setCurrentCompanyIndex] = useState(0);
const fadeAnim = useState(new Animated.Value(1))[0];
const [showRotationTick, setShowRotationTick] = useState(false);
const rotationTimeoutRef = useRef(null);
const tickTimeoutRef = useRef(null);

// NEW: Company/Organization state
const [companies, setCompanies] = useState([]);
const [showCompanyModal, setShowCompanyModal] = useState(false);
const [companySearchTerm, setCompanySearchTerm] = useState('');
const [selectedCompany, setSelectedCompany] = useState(null);

// ✅ Get pre-selected organization from route params
const preSelectedOrganization = route?.params?.preSelectedOrganization;

// Form state
const [formData, setFormData] = useState({
  jobId: '',
  jobTitle: '',
  jobUrl: '',
  referralMessage: '',
  selectedResumeId: '',
});

const [errors, setErrors] = useState({});
  
// Wallet-based eligibility instead of subscription
const [walletBalance, setWalletBalance] = useState(0);
const [walletModalData, setWalletModalData] = useState({ currentBalance: 0, requiredAmount: pricing.referralRequestCost });
const [showWalletModal, setShowWalletModal] = useState(false);
  
// ✅ NEW: Resume Upload Modal state
const [showResumeModal, setShowResumeModal] = useState(false);

// 🎉 NEW: Referral success overlay state
const [showReferralSuccessOverlay, setShowReferralSuccessOverlay] = useState(false);
const [referralCompanyName, setReferralCompanyName] = useState('');

// 🆕 NEW: Referral confirm modal state (like JobsScreen)
const [showReferralConfirmModal, setShowReferralConfirmModal] = useState(false);

  // ✅ FIX: Ensure navigation header is properly configured on mount and doesn't disappear after hard refresh
  useEffect(() => {
    navigation.setOptions({
      title: 'Ask for Referral',
      headerStyle: {
        backgroundColor: colors.surface,
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      },
      headerTitleStyle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.text,
      },
      headerLeft: () => (
        <TouchableOpacity 
          style={{ marginLeft: 16, padding: 4 }}
          onPress={() => {
            // ✅ Smart back navigation - go back if possible, otherwise go to Home tab
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              // Navigate to Main -> MainTabs -> Home (for hard refresh scenario)
              navigation.navigate('Main', {
                screen: 'MainTabs',
                params: {
                  screen: 'Home'
                }
              });
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  // Load initial data - ⚡ Staggered loading for optimal performance
  useEffect(() => {
    // Only load wallet and resumes if authenticated
    if (isAuthenticated && user) {
      loadWalletBalance(); // Load immediately for banner
      loadResumesLazily(); // Load resumes after a delay
    } else {
      // For unauthenticated users, set loading states to false
      setLoadingWallet(false);
      setLoadingResumes(false);
    }
    
    // Always load companies (public data)
    loadCompaniesInBackground(); // Load companies in background (includes Fortune 500)
    
    // ✅ NEW: Auto-select organization if passed from route params
    if (preSelectedOrganization) {
      setSelectedCompany(preSelectedOrganization);
      setFormData(prev => ({ ...prev, companyName: preSelectedOrganization.name }));
    }
  }, [preSelectedOrganization]);

  // 🎯 NEW: Filter and rotate Fortune 500 company logos with random timing
  useEffect(() => {
    // Filter Fortune 500 companies with logos from already loaded companies
    // Note: isFortune500 can be 1, true, "1", or "true" from backend
    const f500WithLogos = companies
      .filter(org => (org.isFortune500 === 1 || org.isFortune500 === true || org.isFortune500 === '1' || org.isFortune500 === 'true') && org.logoURL);
    
    if (f500WithLogos.length === 0) return;
    
    // Check if current time is between 9 AM and 1 AM (active hours)
    const checkActiveHours = () => {
      const now = new Date();
      const hour = now.getHours();
      // Show between 9 AM (9) and 1 AM (1) - that's 9-23 (11 PM) and 0 (midnight)
      return hour >= 9 || hour <= 1;
    };
    
    // Only show during active hours
    if (!checkActiveHours()) return;
    
    // Shuffle for random display (only once when companies load)
    let rotationCompanies = fortune500Companies;
    if (rotationCompanies.length === 0) {
      rotationCompanies = [...f500WithLogos].sort(() => Math.random() - 0.5);
      setFortune500Companies(rotationCompanies);
    }

    const getRandomDelayMs = () => {
      // 1s to 10s
      return Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000;
    };

    const scheduleNextRotation = () => {
      if (rotationTimeoutRef.current) {
        clearTimeout(rotationTimeoutRef.current);
      }
      rotationTimeoutRef.current = setTimeout(rotateCompany, getRandomDelayMs());
    };

    const rotateCompany = () => {
      // Check active hours before rotating
      if (!checkActiveHours()) return;
      if (!rotationCompanies || rotationCompanies.length === 0) return;
      
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        // Change company
        setCurrentCompanyIndex((prevIndex) => 
          (prevIndex + 1) % rotationCompanies.length
        );

        // Show tick briefly on every company change
        setShowRotationTick(true);
        if (tickTimeoutRef.current) {
          clearTimeout(tickTimeoutRef.current);
        }
        tickTimeoutRef.current = setTimeout(() => {
          setShowRotationTick(false);
        }, 2000);

        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();

        // Schedule next rotation with random delay (0.5-10 seconds)
        scheduleNextRotation();
      });
    };

    // Start first rotation
    scheduleNextRotation();

    return () => {
      if (rotationTimeoutRef.current) {
        clearTimeout(rotationTimeoutRef.current);
        rotationTimeoutRef.current = null;
      }
      if (tickTimeoutRef.current) {
        clearTimeout(tickTimeoutRef.current);
        tickTimeoutRef.current = null;
      }
    };
  }, [companies, fortune500Companies, fadeAnim]);

  // Debug useEffect to log form state changes
  useEffect(() => {
  }, [formData]);

  useEffect(() => {
    if (selectedCompany) {
    }
  }, [selectedCompany]);

  const loadResumesLazily = async () => {
    // ⚡ Small delay to let UI render first
    setTimeout(async () => {
      await loadResumes();
    }, 100);
  };

  // ⚡ Load companies in background after resumes (with delay)
  const loadCompaniesInBackground = async () => {
    // ⚡ Delay to let wallet and resumes load first
    setTimeout(async () => {
      await loadCompanies();
    }, 300);
  };

  const loadResumes = async () => {
    setLoadingResumes(true);
    try {
      // Load user's resumes
      const resumesRes = await refopenAPI.getUserResumes();
      if (resumesRes?.success && resumesRes.data) {
        const resumeList = resumesRes.data || [];
        
        // Sort resumes: Primary first, then by upload date (newest first)
        const sortedResumes = [...resumeList].sort((a, b) => {
          // Primary always comes first in the list
          if (a.IsPrimary && !b.IsPrimary) return -1;
          if (!a.IsPrimary && b.IsPrimary) return 1;
          // Then sort by upload date (newest first)
          const dateA = new Date(a.UploadedAt || a.CreatedAt || 0);
          const dateB = new Date(b.UploadedAt || b.CreatedAt || 0);
          return dateB - dateA;
        });
        setResumes(sortedResumes);
        
        // Auto-select the most recently uploaded resume (by date, not primary)
        const mostRecentResume = [...resumeList].sort((a, b) => {
          const dateA = new Date(a.UploadedAt || a.CreatedAt || 0);
          const dateB = new Date(b.UploadedAt || b.CreatedAt || 0);
          return dateB - dateA;
        })[0];
        
        if (mostRecentResume?.ResumeID) {
          setFormData(prev => ({ ...prev, selectedResumeId: mostRecentResume.ResumeID }));
        }
      } else {
        setResumes([]);
      }
    } catch (error) {
      console.error('Error loading resumes:', error);
      setResumes([]);
      Alert.alert('Error', 'Failed to load resumes. Please try again.');
    } finally {
      setLoadingResumes(false);
    }
  };

  // ⚡ Open company dropdown (companies already loaded in background)
  const handleCompanyDropdownOpen = () => {
    setShowCompanyModal(true);
  };

  const loadCompanies = async () => {
    setLoadingCompanies(true);
    
    // ⏱️ START: Track API response time
    const startTime = performance.now();
    
    try {
      // 🚀 OPTIMIZED: Fetch ALL organizations (no limit) - backend now uses covering index
      // The new IX_Organizations_Lookup_Optimized index makes this instant (0ms vs 169ms)
      const result = await refopenAPI.getOrganizations('');
      
      // ⏱️ END: Calculate response time
      const endTime = performance.now();
      const responseTime = (endTime - startTime).toFixed(2);
      
      
      if (result?.success && result.data && Array.isArray(result.data)) {
        // The API service already handles the mapping, so we can use the data directly
        setCompanies(result.data);
      } else {
        console.error('API call failed or returned invalid data:', result);
        setCompanies([]);
      }
    } catch (error) {
      // ⏱️ Calculate error response time
      const endTime = performance.now();
      const responseTime = (endTime - startTime).toFixed(2);
      console.error('❌ [PERFORMANCE] Organizations API failed after', responseTime, 'ms');
      console.error('Failed to load companies:', error);
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
      
      // ⏱️ Final timing log
      const totalTime = (performance.now() - startTime).toFixed(2);
    }
  };

  const loadWalletBalance = async () => {
    setLoadingWallet(true);
    try {
      const result = await refopenAPI.getWalletBalance();
      
      if (result?.success) {
        const balance = result.data?.balance || 0;
        setWalletBalance(balance);
      } else {
        console.error('Failed to load wallet balance:', result.error);
      }
    } catch (error) {
      console.error('Failed to load wallet balance:', error);
    } finally {
      setLoadingWallet(false);
    }
  };

  // ✅ NEW: Handle resume upload from modal
  const handleResumeSelected = async (resumeData) => {
    
    // Update form with selected resume
    setFormData(prev => ({ ...prev, selectedResumeId: resumeData.ResumeID }));
    
    // Reload resumes to get the updated list
    await loadResumes();
    
    // Close the modal
    setShowResumeModal(false);
    
    // Clear resume error if it was set
    if (errors.resume) {
      setErrors(prev => ({ ...prev, resume: null }));
    }
    
    showToast('Resume selected successfully', 'success');
  };

  const validateForm = () => {
    const newErrors = {};

    // Check company selection
    if (!selectedCompany) {
      newErrors.company = 'Company selection is required';
    }

    // Check job ID
    if (!formData.jobId || !formData.jobId.trim()) {
      newErrors.jobId = 'Job ID is required';
    }

    // Check job title
    if (!formData.jobTitle || !formData.jobTitle.trim()) {
      newErrors.jobTitle = 'Job title is required';
    }

    // Check resume selection
    if (!formData.selectedResumeId) {
      newErrors.resume = 'Please select a resume';
    }

    // Validate URL format if provided
    if (formData.jobUrl && formData.jobUrl.trim()) {
      try {
        new URL(formData.jobUrl);
      } catch {
        newErrors.jobUrl = 'Please enter a valid URL';
      }
    }

    const errorCount = Object.keys(newErrors).length;

    setErrors(newErrors);
    return errorCount === 0;
  };

  // 🆕 NEW: Handler when user clicks "Ask Referral" button - shows confirmation modal
  const handleAskReferralClick = () => {
    // 🔐 Check authentication first
    if (!requireAuth('ask referral')) {
      return;
    }
    
    // Validate form FIRST
    if (!validateForm()) {
      return;
    }
    
    // Show confirmation modal (handles both sufficient and insufficient balance)
    setShowReferralConfirmModal(true);
  };

  // 🆕 UPDATED: Called when user clicks "Proceed" in confirm modal
  const handleSubmit = async () => {
    
    try {
      setSubmitting(true);

      // ✅ NEW SCHEMA: Send extJobID (external) with jobID as null
      const requestData = {
        jobID: null, // Explicitly null for external referrals
        extJobID: formData.jobId, // External job identifier (STRING)
        resumeID: formData.selectedResumeId,
        jobTitle: formData.jobTitle,
        companyName: selectedCompany.name,
        organizationId: selectedCompany.id.toString(),
        jobUrl: formData.jobUrl || undefined,
        referralMessage: formData.referralMessage || undefined,
      };


      const result = await refopenAPI.createReferralRequest(requestData);

      if (result?.success) {
        
        // 🎉 Show fullscreen success overlay for 1 second
        setReferralCompanyName(selectedCompany?.name || '');
        setShowReferralSuccessOverlay(true);
        
        // ✅ NEW: Show wallet deduction info
        const amountDeducted = result.data?.amountDeducted || 39;
        const balanceAfter = result.data?.walletBalanceAfter;
        
        let message = 'Referral request submitted successfully!';
        if (balanceAfter !== undefined) {
          message = `Referral sent! ₹${amountDeducted} deducted. Balance: ₹${balanceAfter.toFixed(2)}`;
        }
        
        showToast(message, 'success');

        // Update local wallet balance
        if (balanceAfter !== undefined) {
          setWalletBalance(balanceAfter);
        } else {
          setWalletBalance(prev => Math.max(0, prev - 50));
        }

        // Reset form
        resetForm();
        
        // Navigate back after overlay completes (2 second delay)
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      } else {
        // ✅ NEW: Handle insufficient balance error
        if (result.errorCode === 'INSUFFICIENT_WALLET_BALANCE') {
          const currentBalance = result.data?.currentBalance || 0;
          const requiredAmount = result.data?.requiredAmount || pricing.referralRequestCost;
          
          // Show beautiful modal instead of ugly alert
          setWalletModalData({ currentBalance, requiredAmount });
          setShowWalletModal(true);
        } else {
          const errorMessage = result?.error || result?.message || 'Failed to submit referral request';
          console.error('❌ API returned error:', errorMessage);
          Alert.alert('Request Failed', errorMessage);
        }
      }
    } catch (error) {
      console.error('❌ Error in handleSubmit:', error);
      const errorMessage = error?.message || 'An unexpected error occurred. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleCompanySelect = (company) => {
    setSelectedCompany(company);
    setFormData(prev => ({ ...prev, companyName: company.name }));

    // Close modal after selection
    setShowCompanyModal(false);
  };

  const handleCompanySearch = async (searchTerm) => {
    setCompanySearchTerm(searchTerm);
    // For now, just filter the existing companies list
    // In the future, we could implement server-side search
  };

  const resetForm = () => {
    setFormData({
      jobId: '',
      jobTitle: '',
      jobUrl: '',
      referralMessage: '',
      selectedResumeId: '',
    });
    setSelectedCompany(null);
    setErrors({});
  };

  // ⚡ Remove the global loading screen - show form immediately
  // Only check if user is job seeker (allow unauthenticated users to see the form)
  if (isAuthenticated && !isJobSeeker) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="lock-closed" size={64} color={colors.gray400} />
        <Text style={styles.errorTitle}>Access Restricted</Text>
        <Text style={styles.errorText}>Only job seekers can request referrals.</Text>
      </View>
    );
  }

  // ✅ Calculate if wallet balance is sufficient and if form is ready
  const hasSufficientBalance = walletBalance >= 50;
  const isFormReady = !loadingWallet && !loadingResumes; // Form ready when wallet and resumes loaded

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.innerContainer}>
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 80 : 120 }}>
          {/* Google AdSense Ad at top - Referral page style */}
          <AdCard variant="referral" />

        {/* ✅ NEW: Dynamic Fortune 500 Company Showcase */}
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>🚀 Join Thousands Getting Referred</Text>
          <Text style={styles.introSubtitle}>
            Top companies accept referrals every day
          </Text>
          
          {/* Animated Company Logo Display */}
          {fortune500Companies.length > 0 && (
            <Animated.View style={[styles.companyShowcase, { opacity: fadeAnim }]}>
              <View style={styles.showcaseContent}>
                <View style={styles.showcaseLogoContainer}>
                  <Image
                    source={{ uri: fortune500Companies[currentCompanyIndex]?.logoURL }}
                    style={styles.showcaseLogo}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.showcaseTextContainer}>
                  <Text style={styles.showcaseText}>
                    Referral submitted for
                  </Text>
                  <Text style={styles.showcaseCompanyName}>
                    {fortune500Companies[currentCompanyIndex]?.name}
                  </Text>
                </View>
                <View style={styles.showcaseCheckmark}>
                  <View style={styles.tickSlot}>
                    {showRotationTick ? (
                      <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                    ) : null}
                  </View>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}
          
          {/* Value Proposition - Short & Impactful */}
          <Text style={styles.valueText}>
            Get referrals from employees working at your dream company who are ready to refer candidates. <Text style={styles.valueHighlight}>Increase your chances by 15x.</Text>
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Company Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Company <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.companySelector, errors.company && styles.inputError]}
              onPress={handleCompanyDropdownOpen}
            >
              {selectedCompany ? (
                <View style={styles.companySelectorContent}>
                  {selectedCompany.logoURL ? (
                    <Image
                      source={{ uri: selectedCompany.logoURL }}
                      style={styles.companySelectorLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.companySelectorLogoPlaceholder}>
                      <Ionicons name="business" size={16} color={colors.gray400} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.companySelectorText}>{selectedCompany.name}</Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.companySelectorText, styles.companySelectorPlaceholder]}>
                  Select company
                </Text>
              )}
              <Ionicons name="chevron-down" size={20} color={colors.gray500} />
            </TouchableOpacity>
            {errors.company && (
              <Text style={styles.errorText}>{errors.company}</Text>
            )}
          </View>

              {/* Job ID */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Job ID <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.jobId && styles.inputError]}
                  placeholder="e.g., job-12345, REQ-2024-001, or external job identifier"
                  placeholderTextColor={colors.gray500}
                  value={formData.jobId}
                  onChangeText={(value) => updateFormData('jobId', value)}
                  maxLength={100}
                />
                {errors.jobId && (
                  <Text style={styles.errorText}>{errors.jobId}</Text>
                )}
                <Text style={styles.helperText}>
                  Enter the job ID or reference number from the company's job posting
                </Text>
              </View>

              {/* Job Title */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Job Title <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.jobTitle && styles.inputError]}
                  placeholder="e.g., Senior Software Engineer, Product Manager"
                  placeholderTextColor={colors.gray500}
                  value={formData.jobTitle}
                  onChangeText={(value) => updateFormData('jobTitle', value)}
                  maxLength={200}
                />
                {errors.jobTitle && (
                  <Text style={styles.errorText}>{errors.jobTitle}</Text>
                )}
              </View>

              {/* Job URL */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Job URL</Text>
                <TextInput
                  style={[styles.input, errors.jobUrl && styles.inputError]}
                  placeholder="https://careers.company.com/job/12345"
                  placeholderTextColor={colors.gray500}
                  value={formData.jobUrl}
                  onChangeText={(value) => updateFormData('jobUrl', value)}
                  keyboardType="url"
                  autoCapitalize="none"
                />
                {errors.jobUrl && (
                  <Text style={styles.errorText}>{errors.jobUrl}</Text>
                )}
          </View>

              {/* Referral Message */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Referral Message</Text>
                <TextInput
                  style={[styles.textArea, errors.referralMessage && styles.inputError]}
                  placeholder="Tell referrer what makes you the ideal fit..."
                  placeholderTextColor={colors.gray500}
                  value={formData.referralMessage}
                  onChangeText={(value) => updateFormData('referralMessage', value)}
                  multiline
                  numberOfLines={4}
                  maxLength={1000}
                  textAlignVertical="top"
                />
                {errors.referralMessage && (
                  <Text style={styles.errorText}>{errors.referralMessage}</Text>
                )}
                <Text style={styles.helperText}>
                  (max 1000 characters)
                </Text>
              </View>

          {/* Resume Selection - ✅ Shows loading state */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Select Resume <Text style={styles.required}>*</Text>
            </Text>
            
            {loadingResumes ? (
              <View style={styles.resumeLoadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.resumeLoadingText}>Loading your resumes...</Text>
              </View>
            ) : resumes.length === 0 ? (
              <View style={styles.noResumeContainer}>
                <Ionicons name="document-outline" size={24} color={colors.gray400} />
                <Text style={styles.noResumeText}>No resumes found</Text>
                <TouchableOpacity
                  style={styles.uploadResumeButton}
                  onPress={() => {
                    if (requireAuth('upload resume')) {
                      setShowResumeModal(true);
                    }
                  }}
                >
                  <Text style={styles.uploadResumeText}>Upload Resume</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.resumeList}>
                {resumes.map((resume) => (
                  <TouchableOpacity
                    key={resume.ResumeID}
                    style={[
                      styles.resumeItem,
                      formData.selectedResumeId === resume.ResumeID && styles.resumeItemSelected
                    ]}
                    onPress={() => updateFormData('selectedResumeId', resume.ResumeID)}
                  >
                    <View style={styles.resumeItemContent}>
                      <Ionicons 
                        name="document-text" 
                        size={20} 
                        color={formData.selectedResumeId === resume.ResumeID ? colors.primary : colors.gray500} 
                      />
                      <View style={styles.resumeDetails}>
                        <Text style={[
                          styles.resumeLabel,
                          formData.selectedResumeId === resume.ResumeID && styles.resumeLabelSelected
                        ]}>
                          {resume.ResumeLabel}
                        </Text>
                        {resume.IsPrimary && (
                          <Text style={styles.primaryBadge}>Primary</Text>
                        )}
                      </View>
                    </View>
                    <View style={[
                      styles.radioButton,
                      formData.selectedResumeId === resume.ResumeID && styles.radioButtonSelected
                    ]}>
                      {formData.selectedResumeId === resume.ResumeID && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
                
                {/* Option to upload a new resume */}
                <TouchableOpacity
                  style={styles.uploadNewResumeButton}
                  onPress={() => {
                    if (requireAuth('upload resume')) {
                      setShowResumeModal(true);
                    }
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.uploadNewResumeText}>Upload New Resume</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {errors.resume && (
              <Text style={styles.errorText}>{errors.resume}</Text>
            )}
          </View>

          {/* Submit Button - Inside form */}
          <View style={styles.submitButtonContainer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled
              ]}
              onPress={handleAskReferralClick}
              disabled={!isFormReady || submitting || loadingWallet}
            >
              {(!isFormReady || loadingWallet) ? (
                <>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.submitButtonText}>Loading...</Text>
                </>
              ) : (
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting...' : 'Ask Referral'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      </View>

      {/* NEW: Company Selection Modal */}
      <Modal
        visible={showCompanyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCompanyModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Company</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCompanyModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.gray600} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.gray500} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search companies..."
              value={companySearchTerm}
              onChangeText={setCompanySearchTerm}
              placeholderTextColor={colors.gray500}
            />
          </View>

          {loadingCompanies ? (
            <View style={styles.modalLoadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.modalLoadingText}>Loading companies...</Text>
            </View>
          ) : (
            <FlatList
              data={companies.filter(company =>
                company.name?.toLowerCase()?.includes(companySearchTerm.toLowerCase())
              )}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.companyItem}
                  onPress={() => {
                    setSelectedCompany(item);
                    setShowCompanyModal(false);
                    setCompanySearchTerm('');
                    // Clear company error if set
                    if (errors.company) {
                      setErrors(prev => ({ ...prev, company: null }));
                    }
                  }}
                >
                  {/* Company Logo */}
                  {item.logoURL ? (
                    <Image
                      source={{ uri: item.logoURL }}
                      style={styles.companyLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.companyLogoPlaceholder}>
                      <Ionicons name="business" size={20} color={colors.gray400} />
                    </View>
                  )}
                  
                  <View style={styles.companyInfo}>
                    <Text style={styles.companyName}>{item.name}</Text>
                    {item.industry && item.industry !== 'Other' && (
                      <Text style={styles.companyIndustry}>{item.industry}</Text>
                    )}
                  </View>
                  {item.id === 999999 && (
                    <Ionicons name="add-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Ionicons name="business" size={48} color={colors.gray400} />
                  <Text style={styles.emptyText}>
                    {companySearchTerm ? 'No companies found' : 'No companies available'}
                  </Text>
                  {companySearchTerm && (
                    <Text style={styles.emptySubtext}>
                      Try searching with different keywords
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </Modal>
      
      {/* ✅ NEW: Resume Upload Modal */}
      <ResumeUploadModal
        visible={showResumeModal}
        onClose={() => setShowResumeModal(false)}
        onResumeSelected={handleResumeSelected}
        user={user}
        jobTitle={formData.jobTitle || 'External Job Application'}
      />
      
      {/* Beautiful Wallet Recharge Modal */}
      <WalletRechargeModal
        visible={showWalletModal}
        currentBalance={walletModalData.currentBalance}
        requiredAmount={walletModalData.requiredAmount}
        onAddMoney={() => {
          setShowWalletModal(false);
          navigation.navigate('WalletRecharge');
        }}
        onCancel={() => setShowWalletModal(false)}
      />

      {/* � Referral Confirm Modal - like JobsScreen */}
      <ReferralConfirmModal
        visible={showReferralConfirmModal}
        currentBalance={walletBalance}
        requiredAmount={pricing.referralRequestCost}
        jobTitle={formData.jobTitle || 'this job'}
        onProceed={async () => {
          setShowReferralConfirmModal(false);
          await handleSubmit();
        }}
        onAddMoney={() => {
          setShowReferralConfirmModal(false);
          navigation.navigate('WalletRecharge');
        }}
        onCancel={() => setShowReferralConfirmModal(false)}
      />

      {/* 🎉 Referral Success Overlay */}
      <ReferralSuccessOverlay
        visible={showReferralSuccessOverlay}
        onComplete={() => setShowReferralSuccessOverlay(false)}
        duration={3500}
        companyName={referralCompanyName}
      />
    </KeyboardAvoidingView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: colors.background,
  },
  errorTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    marginTop: 4,
  },
  scrollContainer: {
    flex: 1,
  },
  
  // ✅ ADDED: Header button style for navigation
  headerButton: {
    padding: 8,
  },
  
  // ✅ IMPROVED: Enhanced intro section styles with better spacing and visual appeal
  introSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  introTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  
  // 🎯 NEW: Company showcase styles
  companyShowcase: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary + '20',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  showcaseContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  showcaseLogoContainer: {
    width: 56,
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  showcaseLogo: {
    width: 48,
    height: 48,
  },
  showcaseTextContainer: {
    flex: 1,
  },
  showcaseText: {
    fontSize: typography.sizes.xs,
    color: colors.gray600,
    marginBottom: 2,
  },
  showcaseCompanyName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  showcaseCheckmark: {
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tickSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  liveText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.success,
    letterSpacing: 0.6,
  },
  
  valueText: {
    fontSize: typography.sizes.md,
    color: colors.gray700,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  
  valueHighlight: {
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  
  introText: {
    fontSize: typography.sizes.sm,
    color: colors.gray700,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  
  // ✅ NEW: Benefits container styles
  benefitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  benefitText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    marginLeft: 6,
  },
  
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  required: {
    color: colors.danger,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: typography.sizes.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.danger,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: typography.sizes.md,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 100,
  },
  charCount: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    textAlign: 'right',
    marginTop: 4,
  },
  // ⚡ NEW: Resume loading state
  resumeLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.gray100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resumeLoadingText: {
    marginLeft: 12,
    fontSize: typography.sizes.sm,
    color: colors.gray600,
  },
  noResumeContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.gray100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  noResumeText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginTop: 8,
    marginBottom: 12,
  },
  uploadResumeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  uploadResumeText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  uploadNewResumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  uploadNewResumeText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  resumeList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  resumeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resumeItemSelected: {
    backgroundColor: colors.primary + '10',
  },
  resumeItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  resumeDetails: {
    flex: 1,
    marginLeft: 12,
  },
  resumeLabel: {
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  resumeLabelSelected: {
    color: colors.primary,
  },
  primaryBadge: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontWeight: typography.weights.bold,
    marginTop: 2,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: colors.primary,
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: 16,
    padding: 16,
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: 4,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  submitButtonContainer: {
    marginTop: 24,
    marginBottom: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
    // On desktop, limit button width
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      maxWidth: 400,
      alignSelf: 'center',
      width: '100%',
    } : {}),
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  addMoneyButton: {
    backgroundColor: colors.warning,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  submitButtonTextDisabled: {
    color: colors.gray500,
  },
  // Company selector styles
  companySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  companySelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  companySelectorLogo: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: colors.surface,
  },
  companySelectorLogoPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  companySelectorText: {
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    flex: 1,
  },
  companySelectorPlaceholder: {
    color: colors.gray500,
  },
  preSelectedBadge: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  // Company modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  modalCloseButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: typography.sizes.md,
    color: colors.text,
    outlineStyle: 'none',
  },
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 12,
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  companyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  companyLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  companyLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
  },
  companyIndustry: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 4,
  },
  helperText: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    marginTop: 4,
  },
  // ✅ NEW: Enhanced wallet balance banner styles
  quotaBanner: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  quotaBannerSuccess: {
    backgroundColor: colors.success + '15',
    borderColor: colors.success + '30',
  },
  quotaBannerWarning: {
    backgroundColor: colors.warning + '15',
    borderColor: colors.warning + '30',
  },
  quotaBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quotaBannerIcon: {
    marginRight: 12,
  },
  quotaBannerText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    lineHeight: 18,
  },
  quotaBannerSuccessText: {
    color: colors.success,
  },
  quotaBannerWarningText: {
    color: colors.warning,
  },
  addMoneyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  addMoneyText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.warning,
  },
});

