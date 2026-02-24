/**
 * Resume Analyzer Screen - Optimized & Compact
 * 
 * Features:
 * - Responsive two-column layout on desktop (input left, results right)
 * - Compact design - see everything without scrolling on desktop
 * - PDF resume upload with drag & drop support
 * - Job source selection (RefOpen Job ID, External URL, or paste description)
 * - Beautiful results display with match score, tips, and missing keywords
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import SubScreenHeader from '../../components/SubScreenHeader';
import { useResponsive } from '../../hooks/useResponsive';
import { useAuth } from '../../contexts/AuthContext';
import { typography, spacing, borderRadius } from '../../styles/theme';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import ComplianceFooter from '../../components/ComplianceFooter';
// Toast removed - using inline error display instead
import refopenAPI from '../../services/api';

// Job source types
const JOB_SOURCES = {
  JOB_URL: 'url',
  DESCRIPTION: 'description',
};

// Helper to extract RefOpen job ID from URL
const extractRefOpenJobId = (url) => {
  try {
    const urlObj = new URL(url);
    // Check if it's a RefOpen domain
    if (urlObj.hostname.includes('refopen.com') || urlObj.hostname.includes('refopen.io')) {
      // Match /job-details/UUID or /job/UUID
      const match = urlObj.pathname.match(/\/(?:job-details|job)\/([a-fA-F0-9-]+)/i);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch (e) {
    // Invalid URL, return null
  }
  return null;
};

// Score color helper
const getScoreColor = (score, colors) => {
  if (score >= 80) return colors.success;
  if (score >= 60) return '#22C55E';
  if (score >= 40) return colors.warning;
  return colors.error;
};

// Score label helper
const getScoreLabel = (score) => {
  if (score >= 80) return 'Excellent Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Fair Match';
  return 'Needs Improvement';
};

// Parse **bold** markdown into styled Text segments
const renderBoldText = (text, baseStyle, boldStyle) => {
  if (!text || typeof text !== 'string') return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return <Text style={baseStyle}>{text}</Text>;
  return (
    <Text style={baseStyle}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <Text key={i} style={[baseStyle, { fontWeight: '700' }, boldStyle]}>{part.slice(2, -2)}</Text>;
        }
        return part;
      })}
    </Text>
  );
};

/**
 * SEO Meta Tags for Resume Analyzer
 * Sets page title and meta description for search engine visibility
 */
const setSEOMetaTags = () => {
  if (Platform.OS !== 'web') return;
  
  // Set page title - optimized for search queries
  document.title = 'Free Resume Analyzer - AI Resume Checker & ATS Score | RefOpen';
  
  // Set or update meta description
  const metaDescription = document.querySelector('meta[name="description"]');
  const descriptionContent = 'Free AI-powered resume analyzer. Check your resume against any job description, get ATS compatibility score, find missing keywords, and get improvement tips. No sign-up required.';
  
  if (metaDescription) {
    metaDescription.setAttribute('content', descriptionContent);
  } else {
    const meta = document.createElement('meta');
    meta.name = 'description';
    meta.content = descriptionContent;
    document.head.appendChild(meta);
  }
  
  // Set keywords meta tag
  let metaKeywords = document.querySelector('meta[name="keywords"]');
  const keywordsContent = 'resume analyzer, resume checker, ATS checker, resume score, resume feedback, job match score, resume keywords, resume tips, AI resume review, free resume analysis, resume proofread, resume scanner, CV analyzer';
  
  if (!metaKeywords) {
    metaKeywords = document.createElement('meta');
    metaKeywords.name = 'keywords';
    document.head.appendChild(metaKeywords);
  }
  metaKeywords.setAttribute('content', keywordsContent);
  
  // Open Graph tags for social sharing
  const ogTags = {
    'og:title': 'Free Resume Analyzer - AI Resume Checker | RefOpen',
    'og:description': 'Analyze your resume against any job description. Get instant ATS score, missing keywords, and improvement tips.',
    'og:type': 'website',
    'og:url': 'https://refopen.com/resume-analyzer',
  };
  
  Object.entries(ogTags).forEach(([property, content]) => {
    let meta = document.querySelector(`meta[property="${property}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('property', property);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  });
};

export default function ResumeAnalyzerScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { width, isMobile, isTablet, isDesktop } = useResponsive();
  const styles = useMemo(() => createStyles(colors, width, isMobile, isTablet, isDesktop), [colors, width, isMobile, isTablet, isDesktop]);

  // Auth context for logged-in user
  const { user, loginWithGoogle, googleAuthAvailable } = useAuth();
  
  // Get userId from route params or auth context
  const userId = route?.params?.userId || user?.UserID || null;
  
  // Bottom sheet animation for non-logged-in users
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // State
  const [selectedFile, setSelectedFile] = useState(null);
  const [userResumes, setUserResumes] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [jobSource, setJobSource] = useState(JOB_SOURCES.JOB_URL);
  const [jobUrlInput, setJobUrlInput] = useState('');
  const [jobDescriptionInput, setJobDescriptionInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const scrollViewRef = useRef(null);
  const formRef = useRef(null);

  // Analyzing steps for progress display
  const analyzingSteps = [
    { icon: 'document-text', label: 'Reading your resume...' },
    { icon: 'search', label: 'Extracting keywords...' },
    { icon: 'git-compare', label: 'Matching with job description...' },
    { icon: 'bulb', label: 'Generating insights...' },
  ];
  const [analyzingStep, setAnalyzingStep] = useState(0);
  const stepOpacity = useRef(new Animated.Value(1)).current;

  // Cycle through analyzing steps
  useEffect(() => {
    if (isAnalyzing) {
      setAnalyzingStep(0);
      stepOpacity.setValue(1);
      const interval = setInterval(() => {
        // Fade out
        Animated.timing(stepOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setAnalyzingStep(prev => (prev + 1) % analyzingSteps.length);
          // Fade in
          Animated.timing(stepOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        });
      }, 2500);
      return () => clearInterval(interval);
    } else {
      setAnalyzingStep(0);
    }
  }, [isAnalyzing]);

  // FAQ data
  const faqData = [
    {
      question: 'What is the Resume Analyzer?',
      answer: 'The Resume Analyzer is a free AI-powered tool that compares your resume against a specific job description. It gives you a match score, highlights your strengths, flags missing keywords, and provides tips to improve your resume before applying.'
    },
    {
      question: 'Is my resume kept private?',
      answer: 'Absolutely. Your resume is automatically anonymized before analysis — personal details like name, email, and phone number are stripped out. The content is processed in real-time by our AI and is never stored on any server. Once the analysis is complete, the data is discarded immediately. Your privacy is our top priority.'
    },
    {
      question: 'Is it free to use?',
      answer: 'Yes, completely free with no limits. You can analyze your resume as many times as you want against different job postings.'
    },
    {
      question: 'How is the match score calculated?',
      answer: 'The AI compares your resume against the job description and scores it from 0 to 100%. It looks at keyword alignment, relevant skills, experience match, and overall resume quality for that specific role.'
    },

    {
      question: 'What file formats are supported?',
      answer: 'We support PDF resumes up to 10MB. You can upload a new file or select a resume already saved to your RefOpen profile.'
    },
    {
      question: 'What job sources can I use?',
      answer: 'You can paste a job URL from any platform — RefOpen, LinkedIn, Indeed, Naukri, or any other site. You can also paste the job description text directly.'
    },
  ];

  // Set SEO meta tags on mount
  useEffect(() => {
    setSEOMetaTags();
  }, []);

  // Show bottom sheet for non-logged-in users after 3 seconds
  useEffect(() => {
    if (!user && googleAuthAvailable) {
      const timer = setTimeout(() => {
        setShowBottomSheet(true);
        Animated.spring(bottomSheetAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }).start();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, googleAuthAvailable, bottomSheetAnim]);

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      // skipRedirect: true to stay on this screen after login
      const result = await loginWithGoogle({ skipRedirect: true });
      if (result?.success) {
        // Close bottom sheet on success
        Animated.timing(bottomSheetAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowBottomSheet(false));
      }
    } catch (err) {
      // Error handled by auth context
    } finally {
      setGoogleLoading(false);
    }
  };

  // Dismiss bottom sheet
  const dismissBottomSheet = () => {
    Animated.timing(bottomSheetAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowBottomSheet(false));
  };

  // Load user's resumes if logged in
  useEffect(() => {
    const loadUserResumes = async () => {
      if (!userId) return;
      
      setLoadingResumes(true);
      try {
        const result = await refopenAPI.getUserResumes();
        if (result?.success && result.data?.length > 0) {
          // Sort by date (newest first), then primary
          const sorted = [...result.data].sort((a, b) => {
            if (a.IsPrimary && !b.IsPrimary) return -1;
            if (!a.IsPrimary && b.IsPrimary) return 1;
            const dateA = new Date(a.UploadedAt || a.CreatedAt || 0);
            const dateB = new Date(b.UploadedAt || b.CreatedAt || 0);
            return dateB - dateA;
          });
          setUserResumes(sorted);
          
          // Auto-select the most recent resume (primary first, then by date)
          const primaryOrMostRecent = sorted[0];
          if (primaryOrMostRecent?.ResumeURL) {
            // Pre-select the resume
            setSelectedFile({
              name: primaryOrMostRecent.ResumeLabel || 'Resume.pdf',
              size: null, // Size not available from DB
              resumeUrl: primaryOrMostRecent.ResumeURL,
              resumeId: primaryOrMostRecent.ResumeID,
              isFromProfile: true,
            });
          }
        }
      } catch (err) {
        // Silent fail - user can still upload manually
      } finally {
        setLoadingResumes(false);
      }
    };
    
    loadUserResumes();
  }, [userId]);

  // Handle file selection
  const handleSelectFile = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,application/pdf';
        input.style.display = 'none';
        document.body.appendChild(input);
        
        input.onchange = (e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (file.size > 10 * 1024 * 1024) {
              setError('File too large. Maximum size is 10MB.');
              document.body.removeChild(input);
              return;
            }
            if (!file.type.includes('pdf')) {
              setError('Please select a PDF file.');
              document.body.removeChild(input);
              return;
            }
            setSelectedFile({ name: file.name, size: file.size, file });
            setError(null);
            setAnalysisResult(null);
          }
          document.body.removeChild(input);
        };
        input.click();
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        if (file.size > 10 * 1024 * 1024) {
          setError('File too large. Maximum size is 10MB.');
          return;
        }
        setSelectedFile({ name: file.name, size: file.size, uri: file.uri, mimeType: file.mimeType });
        setError(null);
        setAnalysisResult(null);
      }
    } catch (err) {
      setError('Failed to select file. Please try again.');
    }
  };

  // Handle analysis
  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('Please select a resume PDF first.');
      return;
    }

    let jobData = {};
    if (jobSource === JOB_SOURCES.JOB_URL) {
      if (!jobUrlInput.trim()) { setError('Please enter a job URL.'); return; }
      const url = jobUrlInput.trim();
      // Check if it's a RefOpen URL
      const refOpenJobId = extractRefOpenJobId(url);
      if (refOpenJobId) {
        // It's a RefOpen URL - use jobId to fetch from DB
        jobData.jobId = refOpenJobId;
      } else {
        // External URL - use Jina AI
        jobData.jobUrl = url;
      }
    } else {
      if (!jobDescriptionInput.trim()) { setError('Please enter a job description.'); return; }
      jobData.jobDescription = jobDescriptionInput.trim();
    }

    // Add userId if available (for logged-in users navigating from HomeScreen)
    if (userId) {
      jobData.userId = userId;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await refopenAPI.analyzeResume(selectedFile, jobData);
      if (result.success) {
        setAnalysisResult(result.data);
      } else {
        setError(result.error || 'Analysis failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Failed to analyze resume. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setSelectedFile(null);
    setJobUrlInput('');
    setJobDescriptionInput('');
    setAnalysisResult(null);
    setError(null);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Handle selecting a resume from user's profile
  const handleSelectProfileResume = (resume) => {
    setSelectedFile({
      name: resume.ResumeLabel || 'Resume.pdf',
      size: null,
      resumeUrl: resume.ResumeURL,
      resumeId: resume.ResumeID,
      isFromProfile: true,
    });
    setError(null);
    setAnalysisResult(null);
  };

  // Input Panel JSX
  const renderInputPanel = (styleOverride) => (
    <View style={[styles.inputPanel, styleOverride]}>
      {/* File Upload - Compact */}
      {loadingResumes ? (
        <View style={[styles.uploadArea, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.uploadText, { marginTop: 8 }]}>Loading your resumes...</Text>
        </View>
      ) : selectedFile ? (
        <View style={[styles.uploadArea, styles.uploadAreaSelected]}>
          <View style={styles.selectedFileRow}>
            <Ionicons 
              name={selectedFile.isFromProfile ? "person-circle" : "document"} 
              size={24} 
              color={colors.primary} 
            />
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>{selectedFile.name}</Text>
              <Text style={styles.fileSize}>
                {selectedFile.isFromProfile ? 'From your profile' : formatFileSize(selectedFile.size)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setSelectedFile(null); setAnalysisResult(null); }}>
              <Ionicons name="close-circle" size={22} color={colors.error} />
            </TouchableOpacity>
          </View>
          
          {/* Show other resumes if user has multiple */}
          {userResumes.length > 1 && (
            <View style={styles.otherResumesContainer}>
              <Text style={styles.otherResumesLabel}>Or select another resume:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.resumeChips}>
                {userResumes.filter(r => r.ResumeID !== selectedFile.resumeId).map((resume) => (
                  <TouchableOpacity
                    key={resume.ResumeID}
                    style={styles.resumeChip}
                    onPress={() => handleSelectProfileResume(resume)}
                  >
                    <Ionicons name="document-text" size={14} color={colors.primary} />
                    <Text style={styles.resumeChipText} numberOfLines={1}>
                      {resume.ResumeLabel || 'Resume'}
                    </Text>
                    {resume.IsPrimary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.resumeChip} onPress={handleSelectFile}>
                  <Ionicons name="cloud-upload" size={14} color={colors.gray500} />
                  <Text style={[styles.resumeChipText, { color: colors.gray500 }]}>Upload new</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.uploadArea}
          onPress={handleSelectFile}
          activeOpacity={0.7}
        >
          <View style={styles.uploadPlaceholder}>
            <Ionicons name="cloud-upload" size={32} color={colors.gray400} />
            <Text style={styles.uploadText}>Upload PDF Resume</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Job Details - Compact */}
      <Text style={styles.sectionLabel}>Job Details</Text>

      {/* Source Tabs - Compact */}
      <View style={styles.sourceTabs}>
        {[
          { key: JOB_SOURCES.JOB_URL, icon: 'link', label: 'Job URL' },
          { key: JOB_SOURCES.DESCRIPTION, icon: 'create', label: 'Paste Job Detail' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.sourceTab, jobSource === tab.key && styles.sourceTabActive]}
            onPress={() => setJobSource(tab.key)}
          >
            <Ionicons name={tab.icon} size={14} color={jobSource === tab.key ? colors.white : colors.gray500} />
            <Text style={[styles.sourceTabText, jobSource === tab.key && styles.sourceTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Input based on source */}
      {jobSource === JOB_SOURCES.JOB_URL && (
        <TextInput
          style={styles.textInput}
          placeholder="Paste job URL (RefOpen, Indeed, LinkedIn, etc.)"
          placeholderTextColor={colors.gray400}
          value={jobUrlInput}
          onChangeText={setJobUrlInput}
          autoCapitalize="none"
          keyboardType="url"
        />
      )}

      {jobSource === JOB_SOURCES.DESCRIPTION && (
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="Paste job description here..."
          placeholderTextColor={colors.gray400}
          value={jobDescriptionInput}
          onChangeText={setJobDescriptionInput}
          multiline
          numberOfLines={isDesktop ? 6 : 5}
          textAlignVertical="top"
          scrollEnabled={true}
          blurOnSubmit={false}
        />
      )}

      {/* Analyze Button */}
      <TouchableOpacity
        onPress={handleAnalyze}
        disabled={!selectedFile || isAnalyzing}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={(!selectedFile || isAnalyzing) ? [colors.gray300, colors.gray300] : [colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.analyzeButton}
        >
          {isAnalyzing ? (
            <Text style={styles.analyzeButtonText}>Analyzing...</Text>
          ) : (
            <>
              <Text style={{ fontSize: 16 }}>✨</Text>
              <Text style={styles.analyzeButtonText}>Analyze Resume</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Error */}
      {error && !isAnalyzing && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

    </View>
  );

  // Convenience alias
  const inputPanelContent = renderInputPanel();

  // Results Panel JSX — only used in side-by-side desktop mode (when results are showing)
  const resultsPanelContent = (
    <View style={styles.resultsPanel}>
      {isAnalyzing && (
        <View style={styles.analyzingContainer}>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: spacing.md }} />
          <Animated.View style={{ opacity: stepOpacity, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={analyzingSteps[analyzingStep].icon} size={18} color={colors.primary} />
            <Text style={styles.analyzingText}>{analyzingSteps[analyzingStep].label}</Text>
          </Animated.View>
          <View style={styles.analyzingStepDots}>
            {analyzingSteps.map((_, idx) => (
              <View key={idx} style={[styles.analyzingDot, idx === analyzingStep && styles.analyzingDotActive]} />
            ))}
          </View>
        </View>
      )}

      {analysisResult && !isAnalyzing && (
        <ScrollView style={styles.resultsScroll} showsVerticalScrollIndicator={false}>
          {/* Score Card - Compact */}
          <View style={styles.scoreCard}>
            <View style={[styles.scoreCircle, { borderColor: getScoreColor(analysisResult.matchScore, colors) }]}>
              <Text style={[styles.scoreText, { color: getScoreColor(analysisResult.matchScore, colors) }]}>
                {analysisResult.matchScore}%
              </Text>
            </View>
            <View style={styles.scoreInfo}>
              <Text style={styles.scoreLabel}>{getScoreLabel(analysisResult.matchScore)}</Text>
              {analysisResult.jobTitle && (
                <Text style={styles.jobTitleText} numberOfLines={1}>
                  {analysisResult.jobTitle}{analysisResult.companyName ? ` at ${analysisResult.companyName}` : ''}
                </Text>
              )}
            </View>
          </View>

          {/* Assessment */}
          {analysisResult.overallAssessment && (
            <View style={styles.resultCard}>
              <View style={styles.resultCardHeader}>
                <Ionicons name="clipboard" size={16} color={colors.primary} />
                <Text style={styles.resultCardTitle}>Assessment</Text>
              </View>
              {renderBoldText(analysisResult.overallAssessment, styles.assessmentText)}
            </View>
          )}

          {/* Two Column Layout for Strengths & Keywords */}
          <View style={styles.twoColumnRow}>
            {/* Strengths */}
            {analysisResult.strengths?.length > 0 && (
              <View style={[styles.resultCard, styles.halfCard]}>
                <View style={styles.resultCardHeader}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.resultCardTitle}>Strengths</Text>
                </View>
                {analysisResult.strengths.slice(0, 4).map((strength, idx) => (
                  <View key={idx} style={styles.listItem}>
                    <View style={[styles.listBullet, { backgroundColor: colors.success }]} />
                    {renderBoldText(strength, styles.listText)}
                  </View>
                ))}
              </View>
            )}

            {/* Missing Keywords */}
            {analysisResult.missingKeywords?.length > 0 && (
              <View style={[styles.resultCard, styles.halfCard]}>
                <View style={styles.resultCardHeader}>
                  <Ionicons name="key" size={16} color={colors.warning} />
                  <Text style={styles.resultCardTitle}>Missing Keywords</Text>
                </View>
                <View style={styles.keywordsContainer}>
                  {analysisResult.missingKeywords.slice(0, 8).map((keyword, idx) => (
                    <View key={idx} style={styles.keywordBadge}>
                      <Text style={styles.keywordText}>{keyword}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Tips */}
          {analysisResult.tips?.length > 0 && (
            <View style={styles.resultCard}>
              <View style={styles.resultCardHeader}>
                <Ionicons name="bulb" size={16} color={colors.primary} />
                <Text style={styles.resultCardTitle}>Tips to Improve</Text>
              </View>
              {analysisResult.tips.slice(0, 5).map((tip, idx) => (
                <View key={idx} style={styles.tipItem}>
                  <View style={styles.tipNumber}>
                    <Text style={styles.tipNumberText}>{idx + 1}</Text>
                  </View>
                  {renderBoldText(tip, styles.tipText)}
                </View>
              ))}
            </View>
          )}

          {/* Reset Button */}
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={styles.resetButtonText}>Analyze Another</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );

  return (
    <ScreenWrapper withKeyboard>
    <View style={styles.container}>
      <SubScreenHeader title="Resume Analyzer" fallbackTab="Services" />

      {isDesktop ? (
        // Desktop layout — always side-by-side, right panel content changes
        <ScrollView ref={scrollViewRef} style={styles.mobileScroll} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.desktopLayout}>
            {inputPanelContent}

            {/* Right panel: hero when idle, results when analyzing/done */}
            {analysisResult || isAnalyzing ? (
              resultsPanelContent
            ) : (
              <View style={styles.desktopRightPanel}>
                <View style={styles.heroSectionDesktop}>
                  <Text style={styles.heroTitle}>
                    Check how well your{"\n"}resume matches a job with
                  </Text>
                  <Text style={styles.heroTitleAccent}>AI Resume Analyzer ✨</Text>
                  <Text style={styles.heroSubtitle}>
                    Upload your resume, paste a job link or description, and get an instant match score with personalized feedback.
                  </Text>

                  <View style={styles.featuresGrid}>
                    {[
                      { icon: 'speedometer', color: colors.primary, title: 'Match Score', desc: 'See how well you fit the role' },
                      { icon: 'key', color: '#F59E0B', title: 'Missing Keywords', desc: 'Find keywords to add' },
                      { icon: 'checkmark-circle', color: '#10B981', title: 'Your Strengths', desc: 'Know what stands out' },
                      { icon: 'bulb', color: '#8B5CF6', title: 'Improvement Tips', desc: 'Get specific suggestions' },
                    ].map((feat, idx) => (
                      <View key={idx} style={styles.featureCard}>
                        <View style={[styles.featureIconCircle, { backgroundColor: feat.color + '18' }]}>
                          <Ionicons name={feat.icon} size={22} color={feat.color} />
                        </View>
                        <Text style={styles.featureTitle}>{feat.title}</Text>
                        <Text style={styles.featureDesc}>{feat.desc}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.footer}>
                    <Ionicons name="shield-checkmark" size={14} color={colors.gray400} />
                    <Text style={styles.footerText}>Resume is anonymized. Data is never stored.</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* FAQ + Footer — full width below side-by-side */}
          <View style={styles.desktopBottomSection}>
            <View style={styles.faqSection}>
              <Text style={styles.faqSectionTitle}>Frequently asked questions</Text>
              <View style={styles.faqSubtitleRow}>
                <Text style={styles.faqSectionSubtitle}>
                  Have a question? Find answers below or{' '}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Support')}>
                  <Text style={styles.faqSupportLink}>contact support</Text>
                </TouchableOpacity>
              </View>
              {faqData.map((faq, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.faqItem}
                  onPress={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  activeOpacity={0.7}
                >
                  <View style={styles.faqQuestionRow}>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Ionicons
                      name={expandedFaq === idx ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                  {expandedFaq === idx && (
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <ComplianceFooter navigation={navigation} />
          </View>
        </ScrollView>
      ) : (
        // Mobile/Tablet: Stacked layout with scroll
        <ScrollView ref={scrollViewRef} style={styles.mobileScroll} contentContainerStyle={styles.mobileContent}>
          {/* Hero Showcase - always visible on mobile */}
          <View style={styles.heroSection}>
              <Text style={styles.heroTitle}>
                Check how well your{"\n"}resume matches a job with
              </Text>
              <Text style={styles.heroTitleAccent}>AI Resume Analyzer ✨</Text>
              <Text style={styles.heroSubtitle}>
                Upload your resume, paste a job link or description, and get an instant match score with personalized feedback to strengthen your application.
              </Text>

              {/* Feature highlights */}
              <View style={styles.featuresGrid}>
                {[
                  { icon: 'speedometer', color: colors.primary, title: 'Match Score', desc: 'See how well you fit the role' },
                  { icon: 'key', color: '#F59E0B', title: 'Missing Keywords', desc: 'Find keywords to add' },
                  { icon: 'checkmark-circle', color: '#10B981', title: 'Your Strengths', desc: 'Know what stands out' },
                  { icon: 'bulb', color: '#8B5CF6', title: 'Improvement Tips', desc: 'Get specific suggestions' },
                ].map((feat, idx) => (
                  <View key={idx} style={styles.featureCard}>
                    <View style={[styles.featureIconCircle, { backgroundColor: feat.color + '18' }]}>
                      <Ionicons name={feat.icon} size={22} color={feat.color} />
                    </View>
                    <Text style={styles.featureTitle}>{feat.title}</Text>
                    <Text style={styles.featureDesc}>{feat.desc}</Text>
                  </View>
                ))}
              </View>

              {!analysisResult && !isAnalyzing && (
              <TouchableOpacity
                style={styles.getStartedButton}
                onPress={() => {
                  formRef.current?.measureLayout?.(
                    scrollViewRef.current?.getInnerViewNode?.(),
                    (x, y) => scrollViewRef.current?.scrollTo({ y, animated: true }),
                    () => scrollViewRef.current?.scrollToEnd({ animated: true })
                  );
                  // Web fallback
                  if (Platform.OS === 'web' && formRef.current) {
                    formRef.current.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.getStartedGradient}
                >
                  <Text style={styles.getStartedText}>Get started</Text>
                  <Ionicons name="arrow-down" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              )}
            </View>

          <View ref={formRef} collapsable={false}>
            {inputPanelContent}
          </View>
          {(analysisResult || isAnalyzing) && resultsPanelContent}

          <View style={styles.footer}>
            <Ionicons name="shield-checkmark" size={14} color={colors.gray400} />
            <Text style={styles.footerText}>Resume is anonymized. Data is never stored.</Text>
          </View>

          {/* FAQ Section */}
          <View style={styles.faqSection}>
              <Text style={styles.faqSectionTitle}>Frequently asked{"\n"}questions</Text>
              <View style={styles.faqSubtitleRow}>
                <Text style={styles.faqSectionSubtitle}>
                  Have a question? Find answers below or{' '}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Support')}>
                  <Text style={styles.faqSupportLink}>contact support</Text>
                </TouchableOpacity>
              </View>

              {faqData.map((faq, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.faqItem}
                  onPress={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  activeOpacity={0.7}
                >
                  <View style={styles.faqQuestionRow}>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    <Ionicons
                      name={expandedFaq === idx ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                  {expandedFaq === idx && (
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  )}
                </TouchableOpacity>
              ))}
          </View>

          {/* Compliance Footer */}
          <ComplianceFooter navigation={navigation} currentPage="Resume Analyzer" />
        </ScrollView>
      )}

      {/* Bottom Sheet for non-logged-in users */}
      {showBottomSheet && !user && (
        <Animated.View 
          style={[
            styles.bottomSheet,
            {
              transform: [{
                translateY: bottomSheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [300, 0],
                }),
              }],
              opacity: bottomSheetAnim,
            },
          ]}
        >
          <TouchableOpacity style={styles.bottomSheetDismiss} onPress={dismissBottomSheet}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          
          <View style={styles.bottomSheetContent}>
            <Ionicons name="person-circle-outline" size={40} color={colors.primary} />
            <Text style={styles.bottomSheetTitle}>Sign in for a better experience</Text>
            <Text style={styles.bottomSheetSubtitle}>
              Track analysis history and get personalized recommendations
            </Text>
            
            <GoogleSignInButton
              onPress={handleGoogleSignIn}
              loading={googleLoading}
              style={styles.googleButton}
            />
            
            <TouchableOpacity onPress={dismissBottomSheet}>
              <Text style={styles.bottomSheetDismissText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
    </ScreenWrapper>
  );
}

const createStyles = (colors, width, isMobile, isTablet, isDesktop) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // Desktop Layout
    desktopLayout: {
      flexDirection: 'row',
      padding: spacing.lg,
      gap: spacing.lg,
      maxWidth: 1400,
      alignSelf: 'center',
      width: '100%',
      minHeight: 500,
    },
    desktopRightPanel: {
      flex: 0.6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroSectionDesktop: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.md,
    },
    desktopBottomSection: {
      maxWidth: 900,
      alignSelf: 'center',
      width: '100%',
      paddingHorizontal: spacing.lg,
    },
    inputPanel: {
      flex: isDesktop ? 0.4 : 1,
      minWidth: isDesktop ? 380 : undefined,
      maxWidth: isDesktop ? 450 : undefined,
      alignSelf: isDesktop ? 'flex-start' : undefined,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      padding: isDesktop ? spacing.lg : spacing.md,
      ...Platform.select({
        web: isDesktop ? { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' } : {},
      }),
    },

    resultsPanel: {
      flex: isDesktop ? 0.6 : undefined,
      backgroundColor: isDesktop ? colors.surface : 'transparent',
      borderRadius: isDesktop ? borderRadius.xl : 0,
      padding: isDesktop ? spacing.lg : spacing.xs,
      marginTop: isDesktop ? 0 : spacing.xs,
      overflow: 'hidden',
      ...(isDesktop && Platform.select({
        web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
      })),
    },
    resultsScroll: {
      flex: 1,
    },
    // Mobile Layout
    mobileScroll: {
      flex: 1,
    },
    mobileContent: {
      padding: isTablet ? spacing.md : spacing.sm,
      paddingBottom: spacing.lg,
    },
    // Screen Header with back button
    screenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    screenHeaderTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    screenHeaderTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    // Upload Area - Compact
    uploadArea: {
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      backgroundColor: colors.background,
    },
    uploadAreaSelected: {
      borderColor: colors.primary,
      borderStyle: 'solid',
      backgroundColor: colors.primary + '08',
    },
    uploadPlaceholder: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    uploadText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
    },
    selectedFileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    fileInfo: {
      flex: 1,
    },
    fileName: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
    fileSize: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
    },
    // Other Resumes Container
    otherResumesContainer: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    otherResumesLabel: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    resumeChips: {
      flexDirection: 'row',
    },
    resumeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.gray100,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      marginRight: spacing.xs,
      gap: 4,
    },
    resumeChipText: {
      fontSize: typography.sizes.xs,
      color: colors.text,
      maxWidth: 100,
    },
    primaryBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: borderRadius.xs,
      marginLeft: 2,
    },
    primaryBadgeText: {
      fontSize: 8,
      color: colors.white,
      fontWeight: typography.weights.bold,
    },
    // Section Label
    sectionLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    // Source Tabs - Compact
    sourceTabs: {
      flexDirection: 'row',
      backgroundColor: colors.gray100,
      borderRadius: borderRadius.md,
      padding: 3,
      marginBottom: spacing.sm,
    },
    sourceTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      borderRadius: borderRadius.sm,
      gap: 4,
    },
    sourceTabActive: {
      backgroundColor: colors.primary,
    },
    sourceTabText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium,
      color: colors.gray500,
    },
    sourceTabTextActive: {
      color: colors.white,
    },
    // Input
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      fontSize: typography.sizes.sm,
      color: colors.text,
      backgroundColor: colors.background,
      marginBottom: spacing.md,
    },
    textArea: {
      minHeight: isDesktop ? 120 : (isTablet ? 110 : 100),
      maxHeight: isDesktop ? 200 : (isTablet ? 180 : 150),
      textAlignVertical: 'top',
      ...(Platform.OS === 'web' && {
        overflow: 'auto',
      }),
    },
    // Analyze Button - Gradient
    analyzeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm + 4,
      borderRadius: borderRadius.lg,
      gap: spacing.xs,
    },
    analyzeButtonText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
      color: colors.white,
      letterSpacing: 0.3,
    },
    // Hero Section
    heroSection: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.lg,
    },
    heroTitle: {
      fontSize: isMobile ? 26 : 32,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
      lineHeight: isMobile ? 34 : 42,
    },
    heroTitleAccent: {
      fontSize: isMobile ? 28 : 36,
      fontWeight: typography.weights.bold,
      color: colors.primary,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    heroSubtitle: {
      fontSize: isMobile ? 14 : 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: isMobile ? 22 : 26,
      maxWidth: 500,
      marginBottom: spacing.lg,
    },
    // Features Grid
    featuresGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
      width: '100%',
      maxWidth: 500,
    },
    featureCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      width: isMobile ? '47%' : '46%',
      ...Platform.select({
        web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
        default: { elevation: 2 },
      }),
    },
    featureIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    featureTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 2,
    },
    featureDesc: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    // Get Started Button
    getStartedButton: {
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
    },
    getStartedGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm + 4,
      paddingHorizontal: spacing.xl + spacing.md,
      borderRadius: borderRadius.lg,
      gap: spacing.xs,
    },
    getStartedText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
      color: '#fff',
    },
    // FAQ Section
    faqSection: {
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.sm,
    },
    faqSectionTitle: {
      fontSize: isMobile ? 24 : 28,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    faqSectionSubtitle: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    faqSubtitleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
      maxWidth: 400,
      alignSelf: 'center',
    },
    faqSupportLink: {
      fontSize: typography.sizes.sm,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
      textDecorationLine: 'underline',
      lineHeight: 22,
    },
    faqItem: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: spacing.md,
    },
    faqQuestionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    faqQuestion: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      flex: 1,
      marginRight: spacing.sm,
    },
    faqAnswer: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 22,
      marginTop: spacing.sm,
    },
    // Error
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.error + '12',
      padding: spacing.sm,
      borderRadius: borderRadius.md,
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    errorText: {
      flex: 1,
      fontSize: typography.sizes.xs,
      color: colors.error,
    },
    // Empty Results
    emptyResults: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: isDesktop ? spacing.xl : spacing.md,
      minHeight: isDesktop ? 200 : 80,
    },
    emptyResultsText: {
      fontSize: typography.sizes.sm,
      color: colors.gray400,
      textAlign: 'center',
      marginTop: spacing.md,
      maxWidth: 250,
    },
    // Analyzing
    analyzingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: isDesktop ? spacing.xl : spacing.lg,
      minHeight: isDesktop ? 200 : 100,
    },
    analyzingText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginTop: 0,
    },
    analyzingStepDots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.md,
    },
    analyzingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.gray300,
    },
    analyzingDotActive: {
      backgroundColor: colors.primary,
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    // Score Card - Compact Horizontal
    scoreCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: borderRadius.lg,
      padding: isDesktop ? spacing.md : spacing.sm,
      marginBottom: spacing.sm,
      gap: isMobile ? spacing.xs : spacing.sm,
    },
    scoreCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    scoreText: {
      fontSize: 22,
      fontWeight: typography.weights.bold,
    },
    scoreInfo: {
      flex: 1,
    },
    scoreLabel: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    jobTitleText: {
      fontSize: typography.sizes.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
    // Result Cards - Compact
    resultCard: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      padding: spacing.sm + 2,
      marginBottom: spacing.sm,
    },
    halfCard: {
      flex: isDesktop || isTablet ? 1 : undefined,
    },
    twoColumnRow: {
      flexDirection: isDesktop || isTablet ? 'row' : 'column',
      gap: spacing.sm,
    },
    resultCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
      gap: spacing.xs,
    },
    resultCardTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    assessmentText: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    // List Items - Compact
    listItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    listBullet: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      marginTop: 6,
      marginRight: spacing.xs,
    },
    listText: {
      flex: 1,
      fontSize: typography.sizes.xs,
      color: colors.text,
      lineHeight: 18,
    },
    // Keywords - Compact
    keywordsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: spacing.xs,
    },
    keywordBadge: {
      backgroundColor: colors.warning + '20',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: borderRadius.full,
      marginBottom: 2,
    },
    keywordText: {
      fontSize: 11,
      color: colors.warning,
      fontWeight: typography.weights.semibold,
    },
    // Tips - Compact
    tipItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.xs,
    },
    tipNumber: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.xs,
    },
    tipNumberText: {
      fontSize: 10,
      fontWeight: typography.weights.bold,
      color: colors.white,
    },
    tipText: {
      flex: 1,
      fontSize: typography.sizes.xs,
      color: colors.text,
      lineHeight: 18,
    },
    // Reset Button - Compact
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderColor: colors.primary,
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    resetButtonText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.primary,
    },
    // Footer
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
      gap: 4,
    },
    footerText: {
      fontSize: 10,
      color: colors.gray400,
    },
    // Bottom Sheet Styles
    bottomSheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingBottom: 40,
      paddingTop: spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 20,
      zIndex: 1000,
    },
    bottomSheetDismiss: {
      alignSelf: 'flex-end',
      padding: spacing.xs,
    },
    bottomSheetContent: {
      alignItems: 'center',
      paddingHorizontal: spacing.md,
    },
    bottomSheetTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    bottomSheetSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
      textAlign: 'center',
      lineHeight: 20,
    },
    googleButton: {
      width: '100%',
      marginBottom: spacing.md,
    },
    bottomSheetDismissText: {
      fontSize: 14,
      color: colors.textSecondary,
      paddingVertical: spacing.sm,
    },
  });
