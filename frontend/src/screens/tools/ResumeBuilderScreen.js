/**
 * ResumeBuilderScreen — State-of-the-art Resume Builder
 * 
 * Flow:
 *   1. My Resumes grid (list projects)
 *   2. Tap "Create New" → pick template → auto-fill from profile
 *   3. Editor: sections list with inline editing, AI assist, live preview
 *   4. Export PDF / share
 * 
 * Architecture:
 *   - Single screen with 3 "views": LIST → EDITOR → PREVIEW
 *   - All data persisted via API (ResumeBuilderProjects + Sections)
 *   - AI powered by Gemini (summary, bullet rewrite, ATS check)
 *   - HTML preview via iframe/WebView
 * 
 * @since 2026-02-23
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Dimensions,
  Alert,
  Animated,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useResponsive } from '../../hooks/useResponsive';
import SubScreenHeader from '../../components/SubScreenHeader';
import refopenAPI from '../../services/api';

const { width: screenWidth } = Dimensions.get('window');

// ── Cross-platform alert (Alert.alert doesn't work on web) ──
const showAlert = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(message || title);
  } else {
    Alert.alert(title, message);
  }
};

// ── VIEWS ─────────────────────────────────────────────────
const VIEW = { LIST: 'list', EDITOR: 'editor', PREVIEW: 'preview' };

// ── SECTION ICONS ──────────────────────────────────────────
const SECTION_ICONS = {
  experience: 'briefcase',
  education: 'school',
  skills: 'code-slash',
  projects: 'rocket',
  certifications: 'ribbon',
  custom: 'list',
};

// ── TEMPLATE THUMBNAILS (fallback gradients) ───────────────
const TEMPLATE_GRADIENTS = {
  classic: ['#1E3A5F', '#2C5F8A'],
  modern: ['#7C3AED', '#A78BFA'],
  minimal: ['#374151', '#6B7280'],
  ats_optimized: ['#059669', '#34D399'],
  executive: ['#1F2937', '#4B5563'],
  creative: ['#EC4899', '#F472B6'],
  tech: ['#2563EB', '#60A5FA'],
  startup: ['#F59E0B', '#FBBF24'],
  academic: ['#7C3AED', '#C084FC'],
  indian_corporate: ['#DC2626', '#F87171'],
};

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════

export default function ResumeBuilderScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { isDesktop, isMobile } = useResponsive();

  // ── State ────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState(VIEW.LIST);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // List view
  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState([]);

  // Editor view
  const [activeProject, setActiveProject] = useState(null);
  const [personalInfo, setPersonalInfo] = useState({
    fullName: '', email: '', phone: '', location: '',
    linkedin: '', github: '', portfolio: '',
  });
  const [summary, setSummary] = useState('');
  const [sections, setSections] = useState([]);
  const [expandedSection, setExpandedSection] = useState(null);
  const [editingItem, setEditingItem] = useState(null); // { sectionId, itemIndex }
  const [aiLoading, setAiLoading] = useState(null); // 'summary' | 'bullets' | 'ats'

  // Template picker
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('create'); // 'create' or 'switch'

  // ATS check
  const [atsResult, setAtsResult] = useState(null);
  const [atsJobDesc, setAtsJobDesc] = useState('');
  const [showAtsModal, setShowAtsModal] = useState(false);

  // Preview
  const [previewHtml, setPreviewHtml] = useState('');

  // ── Load Data ────────────────────────────────────────────
  useEffect(() => {
    loadProjects();
    loadTemplates();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const result = await refopenAPI.apiCall('/resume-builder/projects');
      setProjects(result?.data || []);
    } catch (e) {
      console.error('Failed to load projects:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const result = await refopenAPI.apiCall('/resume-builder/templates');
      setTemplates(result?.data || []);
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  };

  // ── Create Project ───────────────────────────────────────
  const handleCreateProject = async (templateId = 1) => {
    try {
      setLoading(true);
      const result = await refopenAPI.apiCall('/resume-builder/projects', {
        method: 'POST',
        body: JSON.stringify({ templateId, title: 'My Resume' }),
      });
      if (result?.data) {
        // Auto-fill from profile
        try {
          await refopenAPI.apiCall(`/resume-builder/projects/${result.data.ProjectID}/auto-fill`, {
            method: 'POST',
          });
        } catch (e) {
          console.log('Auto-fill optional step failed:', e);
        }
        await openProject(result.data.ProjectID);
      }
    } catch (e) {
      showAlert('Error', 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  // ── Switch Template on existing project ───────────────────
  const handleSwitchTemplate = async (templateId) => {
    if (!activeProject) return;
    try {
      setSaving(true);
      await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}`, {
        method: 'PUT',
        body: JSON.stringify({ templateId }),
      });
      // Reload project to pick up new template
      await openProject(activeProject.ProjectID);
    } catch (e) {
      showAlert('Error', 'Failed to switch template');
    } finally {
      setSaving(false);
    }
  };

  // ── Open Project for Editing ─────────────────────────────
  const openProject = async (projectId) => {
    try {
      setLoading(true);
      const result = await refopenAPI.apiCall(`/resume-builder/projects/${projectId}`);
      if (result?.data) {
        const p = result.data;
        setActiveProject(p);
        setPersonalInfo(p.PersonalInfo ? (typeof p.PersonalInfo === 'string' ? JSON.parse(p.PersonalInfo) : p.PersonalInfo) : {
          fullName: '', email: '', phone: '', location: '',
          linkedin: '', github: '', portfolio: '',
        });
        setSummary(p.Summary || '');
        setSections((p.sections || []).map(s => ({
          ...s,
          Content: typeof s.Content === 'string' ? JSON.parse(s.Content || '[]') : (s.Content || []),
        })));
        setCurrentView(VIEW.EDITOR);
      }
    } catch (e) {
      showAlert('Error', 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  // ── Save Project ─────────────────────────────────────────
  const saveProject = async () => {
    if (!activeProject) return;
    try {
      setSaving(true);
      // Save personal info + summary
      await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}`, {
        method: 'PUT',
        body: JSON.stringify({
          personalInfo,
          summary,
        }),
      });
      // Save each section
      for (const sec of sections) {
        await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}/sections/${sec.SectionID}`, {
          method: 'PUT',
          body: JSON.stringify({
            content: sec.Content,
            sectionTitle: sec.SectionTitle,
            isVisible: sec.IsVisible !== false,
          }),
        });
      }
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete Project ───────────────────────────────────────
  const handleDeleteProject = (projectId) => {
    const doDelete = async () => {
      try {
        await refopenAPI.apiCall(`/resume-builder/projects/${projectId}`, { method: 'DELETE' });
        setProjects(prev => prev.filter(p => p.ProjectID !== projectId));
      } catch (e) {
        if (Platform.OS === 'web') {
          showAlert('Error', 'Failed to delete resume');
        } else {
          showAlert('Error', 'Failed to delete');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this resume?')) {
        doDelete();
      }
    } else {
      Alert.alert('Delete Resume', 'Are you sure you want to delete this resume?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ── AI: Generate Summary ─────────────────────────────────
  const handleAiSummary = async () => {
    if (!activeProject) return;
    try {
      setAiLoading('summary');
      await saveProject(); // save current data first
      const result = await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}/ai/summary`, {
        method: 'POST',
      });
      if (result?.data?.summary) {
        setSummary(result.data.summary);
      }
    } catch (e) {
      showAlert('AI Error', 'Failed to generate summary');
    } finally {
      setAiLoading(null);
    }
  };

  // ── AI: Rewrite Bullets ──────────────────────────────────
  const handleAiBullets = async (sectionId, itemIndex) => {
    const sec = sections.find(s => s.SectionID === sectionId);
    if (!sec) return;
    const item = sec.Content[itemIndex];
    if (!item?.bullets?.length) return;
    try {
      setAiLoading('bullets');
      const result = await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}/ai/bullets`, {
        method: 'POST',
        body: JSON.stringify({
          bullets: item.bullets,
          jobTitle: item.title || activeProject.TargetJobTitle || '',
        }),
      });
      if (result?.data?.bullets) {
        setSections(prev => prev.map(s => {
          if (s.SectionID !== sectionId) return s;
          const newContent = [...s.Content];
          newContent[itemIndex] = { ...newContent[itemIndex], bullets: result.data.bullets };
          return { ...s, Content: newContent };
        }));
      }
    } catch (e) {
      showAlert('AI Error', 'Failed to rewrite bullets');
    } finally {
      setAiLoading(null);
    }
  };

  // ── AI: ATS Check ────────────────────────────────────────
  const handleAtsCheck = async () => {
    if (!atsJobDesc.trim()) return;
    try {
      setAiLoading('ats');
      await saveProject();
      const result = await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}/ai/ats-check`, {
        method: 'POST',
        body: JSON.stringify({ jobDescription: atsJobDesc }),
      });
      if (result?.data) {
        setAtsResult(result.data);
      }
    } catch (e) {
      showAlert('AI Error', 'Failed to run ATS check');
    } finally {
      setAiLoading(null);
    }
  };

  // ── Preview ──────────────────────────────────────────────
  const handlePreview = async () => {
    if (!activeProject) return;
    try {
      setLoading(true);
      await saveProject();
      const result = await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}/preview`);
      // API returns { message: "<html>..." } for non-JSON content types
      const html = typeof result === 'string' ? result : (result?.data || result?.message || '<p>Preview unavailable</p>');
      setPreviewHtml(html);
      setCurrentView(VIEW.PREVIEW);
    } catch (e) {
      showAlert('Error', 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  // ── Section Helpers ──────────────────────────────────────
  const addItemToSection = (sectionId) => {
    setSections(prev => prev.map(s => {
      if (s.SectionID !== sectionId) return s;
      const newItem = getEmptyItem(s.SectionType);
      return { ...s, Content: [...s.Content, newItem] };
    }));
  };

  const removeItemFromSection = (sectionId, itemIndex) => {
    setSections(prev => prev.map(s => {
      if (s.SectionID !== sectionId) return s;
      const newContent = s.Content.filter((_, i) => i !== itemIndex);
      return { ...s, Content: newContent };
    }));
  };

  const updateItemField = (sectionId, itemIndex, field, value) => {
    setSections(prev => prev.map(s => {
      if (s.SectionID !== sectionId) return s;
      const newContent = [...s.Content];
      newContent[itemIndex] = { ...newContent[itemIndex], [field]: value };
      return { ...s, Content: newContent };
    }));
  };

  const updateBullet = (sectionId, itemIndex, bulletIndex, value) => {
    setSections(prev => prev.map(s => {
      if (s.SectionID !== sectionId) return s;
      const newContent = [...s.Content];
      const bullets = [...(newContent[itemIndex].bullets || [])];
      bullets[bulletIndex] = value;
      newContent[itemIndex] = { ...newContent[itemIndex], bullets };
      return { ...s, Content: newContent };
    }));
  };

  const addBullet = (sectionId, itemIndex) => {
    setSections(prev => prev.map(s => {
      if (s.SectionID !== sectionId) return s;
      const newContent = [...s.Content];
      const bullets = [...(newContent[itemIndex].bullets || []), ''];
      newContent[itemIndex] = { ...newContent[itemIndex], bullets };
      return { ...s, Content: newContent };
    }));
  };

  const removeBullet = (sectionId, itemIndex, bulletIndex) => {
    setSections(prev => prev.map(s => {
      if (s.SectionID !== sectionId) return s;
      const newContent = [...s.Content];
      const bullets = (newContent[itemIndex].bullets || []).filter((_, i) => i !== bulletIndex);
      newContent[itemIndex] = { ...newContent[itemIndex], bullets };
      return { ...s, Content: newContent };
    }));
  };

  const getEmptyItem = (sectionType) => {
    switch (sectionType) {
      case 'experience': return { title: '', company: '', location: '', startDate: '', endDate: '', current: false, bullets: [''] };
      case 'education': return { institution: '', degree: '', field: '', gpa: '', graduationYear: '' };
      case 'skills': return { category: '', skills: [] };
      case 'projects': return { name: '', description: '', technologies: [], url: '' };
      case 'certifications': return { certName: '', issuer: '', date: '' };
      default: return { text: '' };
    }
  };

  // ── Back Handler ─────────────────────────────────────────
  const handleBack = () => {
    if (currentView === VIEW.PREVIEW) {
      setCurrentView(VIEW.EDITOR);
    } else if (currentView === VIEW.EDITOR) {
      saveProject();
      setCurrentView(VIEW.LIST);
      setActiveProject(null);
      loadProjects();
    } else {
      navigation.goBack();
    }
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  // ── Loading ──────────────────────────────────────────────
  if (loading && currentView === VIEW.LIST && projects.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SubScreenHeader title="Resume Builder" onBack={() => navigation.goBack()} fallbackTab="Services" />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your resumes...</Text>
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: MY RESUMES LIST
  // ══════════════════════════════════════════════════════════

  if (currentView === VIEW.LIST) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SubScreenHeader title="Resume Builder" onBack={() => navigation.goBack()} fallbackTab="Services" />

        <ScrollView contentContainerStyle={[styles.scrollContent, isDesktop && { alignItems: 'center' }]} showsVerticalScrollIndicator={false}>

          {/* ── Hero Banner ─────────────────────────────── */}
          <LinearGradient colors={['#7C3AED', '#A78BFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.heroBanner, isDesktop && { maxWidth: 900, borderRadius: 16, marginTop: 16 }]}>
            <View style={styles.heroContent}>
              <View style={styles.heroIconRow}>
                <View style={styles.heroIconBg}>
                  <Ionicons name="document-text" size={22} color="#FFFFFF" />
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>AI-POWERED</Text>
                </View>
              </View>
              <Text style={styles.heroTitle}>Resume Builder</Text>
              <Text style={styles.heroSubtitle}>
                Build a stunning, ATS-optimized resume in minutes. Auto-fill from your profile, AI-powered bullet points, and instant PDF export.
              </Text>
              <TouchableOpacity
                style={styles.heroCta}
                onPress={() => { setPickerMode('create'); setShowTemplatePicker(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={20} color="#7C3AED" />
                <Text style={styles.heroCtaText}>Create New Resume</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* ── My Resumes ──────────────────────────────── */}
          {projects.length > 0 && (
            <View style={[styles.sectionHeader, isDesktop && { maxWidth: 900 }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>My Resumes</Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>{projects.length} resume{projects.length !== 1 ? 's' : ''}</Text>
            </View>
          )}

          <View style={[styles.projectsGrid, isDesktop && { maxWidth: 900, flexDirection: 'row', flexWrap: 'wrap' }]}>
            {projects.map((project, index) => (
              <TouchableOpacity
                key={project.ProjectID}
                style={[styles.projectCard, { backgroundColor: colors.surface, borderColor: colors.border }, isDesktop && { width: '48%' }]}
                onPress={() => openProject(project.ProjectID)}
                activeOpacity={0.7}
              >
                <View style={styles.projectCardTop}>
                  <LinearGradient
                    colors={TEMPLATE_GRADIENTS[project.TemplateSlug] || TEMPLATE_GRADIENTS.classic}
                    style={styles.projectThumb}
                  >
                    <Ionicons name="document-text" size={28} color="rgba(255,255,255,0.8)" />
                  </LinearGradient>
                  <TouchableOpacity
                    style={[styles.deleteBtn, { backgroundColor: colors.error + '15' }]}
                    onPress={() => handleDeleteProject(project.ProjectID)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.projectTitle, { color: colors.text }]} numberOfLines={1}>{project.Title || 'Untitled Resume'}</Text>
                <Text style={[styles.projectMeta, { color: colors.textSecondary }]}>
                  {project.TemplateName || 'Classic'} • Updated {new Date(project.UpdatedAt).toLocaleDateString()}
                </Text>
                <View style={[styles.projectCta, { borderTopColor: colors.border }]}>
                  <Text style={[styles.projectCtaText, { color: colors.primary }]}>Edit Resume</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {projects.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={colors.gray400} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No resumes yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Create your first resume — it takes less than 5 minutes!
              </Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── Template Picker Modal ────────────────────── */}
        <Modal visible={showTemplatePicker} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, maxWidth: isDesktop ? 700 : '95%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{pickerMode === 'switch' ? 'Switch Template' : 'Choose a Template'}</Text>
                <TouchableOpacity onPress={() => setShowTemplatePicker(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              {pickerMode === 'switch' && (
                <Text style={{ color: colors.textSecondary, fontSize: 13, paddingHorizontal: 20, marginBottom: 12 }}>Your content stays the same — only the design changes.</Text>
              )}
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.templateGrid}>
                {templates.map(template => (
                  <TouchableOpacity
                    key={template.TemplateID}
                    style={[
                      styles.templateCard,
                      { backgroundColor: colors.background, borderColor: colors.border },
                      pickerMode === 'switch' && activeProject?.TemplateID === template.TemplateID && { borderColor: colors.primary, borderWidth: 2 },
                    ]}
                    onPress={() => {
                      setShowTemplatePicker(false);
                      if (pickerMode === 'switch') {
                        handleSwitchTemplate(template.TemplateID);
                      } else {
                        handleCreateProject(template.TemplateID);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={TEMPLATE_GRADIENTS[template.Slug] || TEMPLATE_GRADIENTS.classic}
                      style={styles.templateThumb}
                    >
                      <Ionicons name="document-text" size={32} color="rgba(255,255,255,0.7)" />
                      {template.IsPremium && (
                        <View style={styles.premiumBadge}>
                          <Ionicons name="star" size={10} color="#FBBF24" />
                        </View>
                      )}
                    </LinearGradient>
                    <Text style={[styles.templateName, { color: colors.text }]} numberOfLines={1}>{template.Name}</Text>
                    <Text style={[styles.templateCat, { color: colors.textSecondary }]} numberOfLines={1}>{template.Category}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: EDITOR
  // ══════════════════════════════════════════════════════════

  if (currentView === VIEW.EDITOR) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SubScreenHeader
          title={activeProject?.Title || 'Edit Resume'}
          onBack={handleBack}
          rightContent={
            <View style={styles.headerActions}>
              {saving && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />}
              <TouchableOpacity
                style={[styles.headerBtn, { backgroundColor: colors.primary + '15' }]}
                onPress={() => { setPickerMode('switch'); setShowTemplatePicker(true); }}
              >
                <Ionicons name="brush-outline" size={16} color={colors.primary} />
                {!isMobile && <Text style={[styles.headerBtnText, { color: colors.primary }]}>Template</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerBtn, { backgroundColor: colors.primary + '15' }]}
                onPress={() => setShowAtsModal(true)}
              >
                <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
                <Text style={[styles.headerBtnText, { color: colors.primary }]}>ATS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerBtn, { backgroundColor: colors.primary + '15' }]}
                onPress={handlePreview}
              >
                <Ionicons name="eye" size={16} color={colors.primary} />
                <Text style={[styles.headerBtnText, { color: colors.primary }]}>Preview</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={saveProject}
              >
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          }
        />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.editorScroll, isDesktop && { alignItems: 'center' }]} showsVerticalScrollIndicator={false}>
            <View style={[styles.editorContainer, isDesktop && { maxWidth: 800 }]}>

              {/* ── Personal Info Section ──────────────── */}
              <View style={[styles.editorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.editorCardHeader}>
                  <View style={styles.editorCardHeaderLeft}>
                    <Ionicons name="person" size={18} color={colors.primary} />
                    <Text style={[styles.editorCardTitle, { color: colors.text }]}>Personal Information</Text>
                  </View>
                </View>
                <View style={styles.fieldGrid}>
                  {[
                    { key: 'fullName', label: 'Full Name', icon: 'person-outline', placeholder: 'John Doe' },
                    { key: 'email', label: 'Email', icon: 'mail-outline', placeholder: 'john@example.com' },
                    { key: 'phone', label: 'Phone', icon: 'call-outline', placeholder: '+1 234 567 890' },
                    { key: 'location', label: 'Location', icon: 'location-outline', placeholder: 'New York, NY' },
                    { key: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin', placeholder: 'linkedin.com/in/johndoe' },
                    { key: 'github', label: 'GitHub', icon: 'logo-github', placeholder: 'github.com/johndoe' },
                  ].map(field => (
                    <View key={field.key} style={[styles.fieldRow, isDesktop && { width: '48%' }]}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{field.label}</Text>
                      <View style={[styles.fieldInputWrap, { backgroundColor: colors.inputBackground || colors.gray50, borderColor: colors.border }]}>
                        <Ionicons name={field.icon} size={16} color={colors.gray400} style={{ marginRight: 8 }} />
                        <TextInput
                          style={[styles.fieldInput, { color: colors.text }]}
                          placeholder={field.placeholder}
                          placeholderTextColor={colors.gray400}
                          value={personalInfo[field.key] || ''}
                          onChangeText={v => setPersonalInfo(prev => ({ ...prev, [field.key]: v }))}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* ── Summary Section ────────────────────── */}
              <View style={[styles.editorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.editorCardHeader}>
                  <View style={styles.editorCardHeaderLeft}>
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                    <Text style={[styles.editorCardTitle, { color: colors.text }]}>Professional Summary</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.aiBtn, { backgroundColor: '#7C3AED15' }]}
                    onPress={handleAiSummary}
                    disabled={aiLoading === 'summary'}
                  >
                    {aiLoading === 'summary' ? (
                      <ActivityIndicator size="small" color="#7C3AED" />
                    ) : (
                      <>
                        <Ionicons name="flash" size={14} color="#7C3AED" />
                        <Text style={[styles.aiBtnText, { color: '#7C3AED' }]}>AI Write</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.summaryInput, { color: colors.text, backgroundColor: colors.inputBackground || colors.gray50, borderColor: colors.border }]}
                  multiline
                  numberOfLines={4}
                  placeholder="Write a 2-3 sentence professional summary highlighting your key strengths and career objectives..."
                  placeholderTextColor={colors.gray400}
                  value={summary}
                  onChangeText={setSummary}
                  textAlignVertical="top"
                />
              </View>

              {/* ── Dynamic Sections ───────────────────── */}
              {sections.map(section => (
                <View key={section.SectionID} style={[styles.editorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.editorCardHeader}
                    onPress={() => setExpandedSection(expandedSection === section.SectionID ? null : section.SectionID)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.editorCardHeaderLeft}>
                      <Ionicons name={SECTION_ICONS[section.SectionType] || 'list'} size={18} color={colors.primary} />
                      <Text style={[styles.editorCardTitle, { color: colors.text }]}>
                        {section.SectionTitle}
                      </Text>
                      <View style={[styles.itemCount, { backgroundColor: colors.primary + '15' }]}>
                        <Text style={[styles.itemCountText, { color: colors.primary }]}>{section.Content?.length || 0}</Text>
                      </View>
                    </View>
                    <Ionicons
                      name={expandedSection === section.SectionID ? 'chevron-up' : 'chevron-down'}
                      size={20} color={colors.gray400}
                    />
                  </TouchableOpacity>

                  {expandedSection === section.SectionID && (
                    <View style={styles.sectionContent}>
                      {(section.Content || []).map((item, idx) => (
                        <View key={idx} style={[styles.itemCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          {/* Item header with delete */}
                          <View style={styles.itemHeader}>
                            <Text style={[styles.itemNumber, { color: colors.primary }]}>#{idx + 1}</Text>
                            <View style={styles.itemActions}>
                              {section.SectionType === 'experience' && item.bullets?.length > 0 && (
                                <TouchableOpacity
                                  style={[styles.aiSmallBtn, { backgroundColor: '#7C3AED15' }]}
                                  onPress={() => handleAiBullets(section.SectionID, idx)}
                                  disabled={aiLoading === 'bullets'}
                                >
                                  <Ionicons name="flash" size={12} color="#7C3AED" />
                                  <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '600' }}>AI Rewrite</Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                onPress={() => removeItemFromSection(section.SectionID, idx)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="close-circle" size={20} color={colors.error} />
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Section-specific fields */}
                          {renderItemFields(section.SectionType, item, section.SectionID, idx, colors)}

                          {/* Bullets (experience only) */}
                          {section.SectionType === 'experience' && (
                            <View style={styles.bulletsContainer}>
                              <Text style={[styles.bulletsLabel, { color: colors.textSecondary }]}>Bullet Points</Text>
                              {(item.bullets || []).map((bullet, bIdx) => (
                                <View key={bIdx} style={styles.bulletRow}>
                                  <Text style={[styles.bulletDot, { color: colors.primary }]}>•</Text>
                                  <TextInput
                                    style={[styles.bulletInput, { color: colors.text, backgroundColor: colors.inputBackground || colors.gray50, borderColor: colors.border }]}
                                    value={bullet}
                                    onChangeText={v => updateBullet(section.SectionID, idx, bIdx, v)}
                                    placeholder="Describe your achievement..."
                                    placeholderTextColor={colors.gray400}
                                    multiline
                                  />
                                  <TouchableOpacity onPress={() => removeBullet(section.SectionID, idx, bIdx)}>
                                    <Ionicons name="remove-circle-outline" size={18} color={colors.error} />
                                  </TouchableOpacity>
                                </View>
                              ))}
                              <TouchableOpacity
                                style={[styles.addBulletBtn, { borderColor: colors.border }]}
                                onPress={() => addBullet(section.SectionID, idx)}
                              >
                                <Ionicons name="add" size={16} color={colors.primary} />
                                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>Add Bullet</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ))}

                      {/* Add Item Button */}
                      <TouchableOpacity
                        style={[styles.addItemBtn, { borderColor: colors.primary }]}
                        onPress={() => addItemToSection(section.SectionID)}
                      >
                        <Ionicons name="add-circle" size={18} color={colors.primary} />
                        <Text style={[styles.addItemText, { color: colors.primary }]}>
                          Add {section.SectionType === 'experience' ? 'Experience' :
                            section.SectionType === 'education' ? 'Education' :
                            section.SectionType === 'skills' ? 'Skill Group' :
                            section.SectionType === 'projects' ? 'Project' :
                            section.SectionType === 'certifications' ? 'Certification' : 'Item'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}

            </View>
            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── ATS Check Modal ──────────────────────────── */}
        <Modal visible={showAtsModal} animationType="slide" transparent>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, maxWidth: isDesktop ? 600 : '95%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.primary} /> ATS Score Check
                </Text>
                <TouchableOpacity onPress={() => { setShowAtsModal(false); setAtsResult(null); }}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              {!atsResult ? (
                <View style={{ padding: 16 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
                    Paste the job description to check how well your resume matches:
                  </Text>
                  <TextInput
                    style={[styles.summaryInput, { color: colors.text, backgroundColor: colors.inputBackground || colors.gray50, borderColor: colors.border, minHeight: 150 }]}
                    multiline
                    placeholder="Paste the full job description here..."
                    placeholderTextColor={colors.gray400}
                    value={atsJobDesc}
                    onChangeText={setAtsJobDesc}
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 16, alignSelf: 'stretch', justifyContent: 'center' }]}
                    onPress={handleAtsCheck}
                    disabled={aiLoading === 'ats' || !atsJobDesc.trim()}
                  >
                    {aiLoading === 'ats' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="flash" size={16} color="#FFFFFF" />
                        <Text style={styles.saveBtnText}>Analyze Match</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={{ padding: 16, maxHeight: 400 }}>
                  {/* Score */}
                  <View style={[styles.atsScoreCard, { backgroundColor: colors.background }]}>
                    <Text style={[styles.atsScoreNumber, { color: atsResult.matchScore >= 70 ? '#059669' : atsResult.matchScore >= 40 ? '#F59E0B' : colors.error }]}>
                      {atsResult.matchScore}%
                    </Text>
                    <Text style={[styles.atsScoreLabel, { color: colors.textSecondary }]}>ATS Match Score</Text>
                  </View>
                  {/* Missing Keywords */}
                  {atsResult.missingKeywords?.length > 0 && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={[styles.atsResultTitle, { color: colors.text }]}>Missing Keywords</Text>
                      <View style={styles.keywordsWrap}>
                        {atsResult.missingKeywords.map((kw, i) => (
                          <View key={i} style={[styles.keywordBadge, { backgroundColor: colors.error + '15' }]}>
                            <Text style={{ fontSize: 12, color: colors.error, fontWeight: '600' }}>{kw}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  {/* Tips */}
                  {atsResult.tips?.length > 0 && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={[styles.atsResultTitle, { color: colors.text }]}>Improvement Tips</Text>
                      {atsResult.tips.map((tip, i) => (
                        <View key={i} style={styles.tipRow}>
                          <Ionicons name="checkmark-circle" size={16} color="#059669" />
                          <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.addItemBtn, { borderColor: colors.primary, marginTop: 16, alignSelf: 'center' }]}
                    onPress={() => setAtsResult(null)}
                  >
                    <Ionicons name="reload" size={16} color={colors.primary} />
                    <Text style={[styles.addItemText, { color: colors.primary }]}>Check Again</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: PREVIEW
  // ══════════════════════════════════════════════════════════

  if (currentView === VIEW.PREVIEW) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SubScreenHeader
          title="Resume Preview"
          onBack={handleBack}
          rightContent={
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#059669' }]}
              onPress={() => {
                if (Platform.OS === 'web' && previewHtml) {
                  // Open resume HTML in a new window and trigger print (Save as PDF)
                  const printWindow = window.open('', '_blank', 'width=900,height=1100');
                  if (printWindow) {
                    printWindow.document.write(previewHtml);
                    printWindow.document.close();
                    // Small delay to let fonts/styles load, then trigger print
                    setTimeout(() => {
                      printWindow.focus();
                      printWindow.print();
                    }, 600);
                  } else {
                    showAlert('Popup Blocked', 'Please allow popups for this site to download PDF.');
                  }
                } else {
                  showAlert('PDF Download', 'Use the Preview on web to download as PDF via your browser\'s print dialog.');
                }
              }}
            >
              <Ionicons name="download" size={16} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Download PDF</Text>
            </TouchableOpacity>
          }
        />
        {Platform.OS === 'web' ? (
          <View style={styles.previewWrapper}>
            <View style={[
              styles.previewPaper,
              // Scale down on mobile to fit within viewport
              screenWidth < 850 && {
                transform: [{ scale: Math.min(1, (screenWidth - 32) / 816) }],
                transformOrigin: 'top center',
              },
            ]}>
              <iframe
                srcDoc={previewHtml}
                style={{ border: 'none', width: '100%', height: '100%', backgroundColor: '#FFFFFF' }}
                title="Resume Preview"
              />
            </View>
          </View>
        ) : (
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <View style={[styles.previewPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="document-text" size={48} color={colors.gray400} />
              <Text style={[styles.previewPlaceholderText, { color: colors.textSecondary }]}>
                Preview is best viewed on web. Your resume has been saved.
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  return null;

  // ══════════════════════════════════════════════════════════
  // FIELD RENDERERS
  // ══════════════════════════════════════════════════════════

  function renderItemFields(sectionType, item, sectionId, itemIndex, colors) {
    const renderField = (label, field, placeholder, options = {}) => (
      <View style={[styles.fieldRow, options.fullWidth ? {} : (isDesktop ? { width: '48%' } : {})]}>
        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
        <TextInput
          style={[styles.inlineInput, { color: colors.text, backgroundColor: colors.inputBackground || colors.gray50, borderColor: colors.border }]}
          placeholder={placeholder}
          placeholderTextColor={colors.gray400}
          value={item[field] || ''}
          onChangeText={v => updateItemField(sectionId, itemIndex, field, v)}
          multiline={options.multiline}
          numberOfLines={options.multiline ? 3 : 1}
          textAlignVertical={options.multiline ? 'top' : 'center'}
        />
      </View>
    );

    switch (sectionType) {
      case 'experience':
        return (
          <View style={[styles.fieldGrid, { marginTop: 8 }]}>
            {renderField('Job Title', 'title', 'Software Engineer')}
            {renderField('Company', 'company', 'Google')}
            {renderField('Location', 'location', 'Mountain View, CA')}
            {renderField('Start Date', 'startDate', 'Jan 2023')}
            {renderField('End Date', 'endDate', 'Present')}
          </View>
        );
      case 'education':
        return (
          <View style={[styles.fieldGrid, { marginTop: 8 }]}>
            {renderField('Institution', 'institution', 'MIT')}
            {renderField('Degree', 'degree', 'B.Tech')}
            {renderField('Field of Study', 'field', 'Computer Science')}
            {renderField('GPA', 'gpa', '3.8/4.0')}
            {renderField('Graduation Year', 'graduationYear', '2023')}
          </View>
        );
      case 'skills':
        return (
          <View style={[styles.fieldGrid, { marginTop: 8 }]}>
            {renderField('Category', 'category', 'Programming Languages')}
            <View style={[styles.fieldRow, isDesktop ? { width: '48%' } : {}]}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Skills (comma-separated)</Text>
              <TextInput
                style={[styles.inlineInput, { color: colors.text, backgroundColor: colors.inputBackground || colors.gray50, borderColor: colors.border }]}
                placeholder="JavaScript, TypeScript, Python"
                placeholderTextColor={colors.gray400}
                value={(item.skills || []).join(', ')}
                onChangeText={v => updateItemField(sectionId, itemIndex, 'skills', v.split(',').map(s => s.trim()).filter(Boolean))}
              />
            </View>
          </View>
        );
      case 'projects':
        return (
          <View style={[styles.fieldGrid, { marginTop: 8 }]}>
            {renderField('Project Name', 'name', 'E-commerce Platform')}
            {renderField('URL', 'url', 'https://github.com/...')}
            {renderField('Description', 'description', 'Built a full-stack...', { multiline: true, fullWidth: true })}
            <View style={[styles.fieldRow, isDesktop ? { width: '48%' } : {}]}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Technologies (comma-separated)</Text>
              <TextInput
                style={[styles.inlineInput, { color: colors.text, backgroundColor: colors.inputBackground || colors.gray50, borderColor: colors.border }]}
                placeholder="React, Node.js, PostgreSQL"
                placeholderTextColor={colors.gray400}
                value={(item.technologies || []).join(', ')}
                onChangeText={v => updateItemField(sectionId, itemIndex, 'technologies', v.split(',').map(s => s.trim()).filter(Boolean))}
              />
            </View>
          </View>
        );
      case 'certifications':
        return (
          <View style={[styles.fieldGrid, { marginTop: 8 }]}>
            {renderField('Certification', 'certName', 'AWS Solutions Architect')}
            {renderField('Issuer', 'issuer', 'Amazon Web Services')}
            {renderField('Date', 'date', 'Mar 2024')}
          </View>
        );
      default:
        return (
          <View style={{ marginTop: 8 }}>
            {renderField('Content', 'text', 'Enter content...', { multiline: true, fullWidth: true })}
          </View>
        );
    }
  }
}

// ══════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 14 },
  scrollContent: { paddingBottom: 40 },

  // Hero
  heroBanner: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 24 : 20, paddingBottom: 24 },
  heroContent: { zIndex: 2 },
  heroIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  heroIconBg: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  heroBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20, marginBottom: 18, maxWidth: 500 },
  heroCta: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, alignSelf: 'flex-start' },
  heroCtaText: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },

  // Section header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 22, marginBottom: 14, width: '100%' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionSub: { fontSize: 13, fontWeight: '500' },

  // Projects grid
  projectsGrid: { paddingHorizontal: 16, gap: 12, width: '100%' },
  projectCard: { borderRadius: 14, borderWidth: 1, padding: 16, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 }, web: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' } }) },
  projectCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  projectThumb: { width: 56, height: 72, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  projectTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  projectMeta: { fontSize: 13, marginBottom: 12 },
  projectCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 12, borderTopWidth: 1 },
  projectCtaText: { fontSize: 13, fontWeight: '700' },

  // Empty state
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { borderRadius: 20, maxHeight: '85%', width: '100%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '700' },

  // Templates
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  templateCard: { width: '47%', borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center' },
  templateThumb: { width: '100%', height: 120, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 8, position: 'relative' },
  premiumBadge: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  templateName: { fontSize: 14, fontWeight: '600' },
  templateCat: { fontSize: 12, marginTop: 2 },

  // Editor
  editorScroll: { paddingBottom: 40 },
  editorContainer: { padding: 16, width: '100%' },
  editorCard: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  editorCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  editorCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  editorCardTitle: { fontSize: 16, fontWeight: '700' },
  itemCount: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  itemCountText: { fontSize: 12, fontWeight: '700' },

  // Header actions
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  headerBtnText: { fontSize: 12, fontWeight: '600' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // AI button
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  aiBtnText: { fontSize: 12, fontWeight: '700' },
  aiSmallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

  // Fields
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  fieldRow: { width: '100%' },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 44 },
  fieldInput: { flex: 1, fontSize: 14, height: 42 },
  inlineInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 42 },

  // Summary
  summaryInput: { marginHorizontal: 16, marginBottom: 16, borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 100, lineHeight: 20 },

  // Section content
  sectionContent: { paddingHorizontal: 16, paddingBottom: 16 },
  itemCard: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 10 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemNumber: { fontSize: 13, fontWeight: '700' },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Bullets
  bulletsContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  bulletsLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  bulletDot: { fontSize: 18, lineHeight: 22, fontWeight: '700' },
  bulletInput: { flex: 1, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, minHeight: 38 },
  addBulletBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed' },

  // Add item
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 4 },
  addItemText: { fontSize: 14, fontWeight: '600' },

  // ATS
  atsScoreCard: { borderRadius: 12, padding: 20, alignItems: 'center' },
  atsScoreNumber: { fontSize: 48, fontWeight: '800' },
  atsScoreLabel: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  atsResultTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  keywordsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  keywordBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Preview
  previewWrapper: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    overflow: 'auto',
  },
  previewPaper: {
    width: 816, // 8.5in at 96dpi
    minHeight: 1056, // 11in at 96dpi
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 24px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.08)',
      },
      default: {
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
    overflow: 'hidden',
  },
  previewPlaceholder: { borderRadius: 14, borderWidth: 1, padding: 48, alignItems: 'center', justifyContent: 'center' },
  previewPlaceholderText: { marginTop: 16, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
