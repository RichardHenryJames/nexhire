/**
 * ResumeBuilderScreen — Redesigned
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
  Animated,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useResponsive } from '../../hooks/useResponsive';
import { spacing } from '../../styles/theme';
import SubScreenHeader from '../../components/SubScreenHeader';
import SignInBottomSheet from '../../components/SignInBottomSheet';
import ConfirmPurchaseModal from '../../components/ConfirmPurchaseModal';
import { useCustomAlert } from '../../components/CustomAlert';
import { usePricing } from '../../contexts/PricingContext';
import refopenAPI from '../../services/api';

import * as ExpoPrint from 'expo-print';
import * as ExpoSharing from 'expo-sharing';
import { WebView } from 'react-native-webview';

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

// ── TEMPLATE GRADIENTS ──
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

// ── Thumbnail styles ──
const tpStyles = StyleSheet.create({
  page: { width: '100%', height: 160, borderRadius: 8, borderWidth: 1, backgroundColor: '#fff', overflow: 'hidden' },
});

// ── Helper: wrap HTML for thumbnail ──
const wrapThumbHtml = (html) => {
  if (!html) return '';
  if (html.includes('viewport')) return html;
  const meta = '<meta name="viewport" content="width=816">';
  if (html.includes('<head>')) return html.replace('<head>', '<head>' + meta);
  if (html.includes('</head>')) return html.replace('</head>', meta + '</head>');
  return '<html><head>' + meta + '</head><body>' + html + '</body></html>';
};

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════

export default function ResumeBuilderScreen({ navigation, route }) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { pricing } = usePricing();
  const { isDesktop, isTablet, isMobile, width: responsiveWidth } = useResponsive();
  const { showAlert, showConfirm } = useCustomAlert();
  const styles = useMemo(() => createStyles(colors, isMobile, isTablet, isDesktop), [colors, isMobile, isTablet, isDesktop]);

  const alert = (title, message) => showAlert({ title, message });

  // ── Auth Guard ──
  const requireAuth = (action) => {
    if (!user) {
      navigation.navigate('Auth', {
        screen: 'Login',
        params: { returnTo: 'ResumeBuilder', returnParams: route?.params },
      });
      return false;
    }
    return true;
  };

  // ── State ──
  const [currentView, setCurrentView] = useState(VIEW.LIST);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // List view
  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templatePreviews, setTemplatePreviews] = useState({});

  // Editor view
  const [activeProject, setActiveProject] = useState(null);
  const [personalInfo, setPersonalInfo] = useState({
    fullName: '', email: '', phone: '', location: '',
    linkedin: '', github: '', portfolio: '',
  });
  const [summary, setSummary] = useState('');
  const [sections, setSections] = useState([]);
  const [expandedSection, setExpandedSection] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [aiLoading, setAiLoading] = useState(null);

  // Template picker
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState('create');
  const [switchingTemplate, setSwitchingTemplate] = useState(false);

  // ATS check
  const [atsResult, setAtsResult] = useState(null);
  const [atsJobDesc, setAtsJobDesc] = useState('');
  const [showAtsModal, setShowAtsModal] = useState(false);

  // Preview
  const [previewHtml, setPreviewHtml] = useState('');

  // Premium state
  const [hasPremium, setHasPremium] = useState(false);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [paidTemplateSlugs, setPaidTemplateSlugs] = useState(new Set());
  const [walletBalance, setWalletBalance] = useState(0);

  // Load wallet balance
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const result = await refopenAPI.getWalletBalance();
        if (result?.success) setWalletBalance(result.data?.availableBalance ?? result.data?.balance ?? 0);
      } catch (e) { /* silent */ }
    })();
  }, [user]);

  // Get current template slug
  const currentTemplateSlug = useMemo(() => {
    if (!activeProject) return 'classic';
    return activeProject.templateSlug || activeProject.TemplateSlug ||
      templates.find(t => t.TemplateID === activeProject.TemplateID)?.Slug || 'classic';
  }, [activeProject, templates]);

  const isCurrentTemplateFree = currentTemplateSlug === 'classic';

  // Check access for current template
  useEffect(() => {
    if (!user || isCurrentTemplateFree) { setHasPremium(isCurrentTemplateFree); return; }
    if (paidTemplateSlugs.has(currentTemplateSlug)) { setHasPremium(true); return; }
    (async () => {
      try {
        const result = await refopenAPI.apiCall(`/access/status?type=resume_template&slug=${currentTemplateSlug}`);
        if (result?.success && result.data?.hasActiveAccess) {
          setHasPremium(true);
          setPaidTemplateSlugs(prev => new Set([...prev, currentTemplateSlug]));
        } else { setHasPremium(false); }
      } catch (e) { setHasPremium(false); }
    })();
  }, [user, currentTemplateSlug, isCurrentTemplateFree]);

  // Check access for ALL premium templates
  useEffect(() => {
    if (!user || templates.length === 0) return;
    const premiumTemplates = templates.filter(t => t.IsPremium);
    if (premiumTemplates.length === 0) return;
    (async () => {
      const paid = new Set(paidTemplateSlugs);
      await Promise.all(premiumTemplates.map(async (t) => {
        if (paid.has(t.Slug)) return;
        try {
          const result = await refopenAPI.apiCall(`/access/status?type=resume_template&slug=${t.Slug}`);
          if (result?.success && result.data?.hasActiveAccess) paid.add(t.Slug);
        } catch (e) { /* silent */ }
      }));
      if (paid.size > paidTemplateSlugs.size) setPaidTemplateSlugs(paid);
    })();
  }, [user, templates]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Watermark injection ──
  const injectWatermark = useCallback((html) => {
    if (!html) return html;
    const watermarkStyle = `<style>.refopen-watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:120px;font-weight:900;color:rgba(0,0,0,0.06);letter-spacing:12px;pointer-events:none;z-index:9999;white-space:nowrap;font-family:Arial,sans-serif;user-select:none;-webkit-user-select:none;}@media print{.refopen-watermark{display:block!important;}}</style>`;
    const watermarkDiv = '<div class="refopen-watermark">RefOpen</div>';
    return html.replace('</head>', watermarkStyle + '</head>').replace('</body>', watermarkDiv + '</body>');
  }, []);

  const displayPreviewHtml = useMemo(() => {
    if (hasPremium) return previewHtml;
    return injectWatermark(previewHtml);
  }, [previewHtml, hasPremium, injectWatermark]);

  // ── Premium purchase ──
  const handlePurchasePremium = useCallback(async () => {
    if (!user) { alert('Sign In Required', 'Please sign in to purchase premium.'); return; }
    try {
      setPremiumLoading(true);
      const cost = pricing.resumeBuilderPremiumCost || 49;
      const slug = currentTemplateSlug;
      const templateName = templates.find(t => t.Slug === slug)?.Name || slug;
      const debitResult = await refopenAPI.apiCall('/wallet/debit', {
        method: 'POST',
        body: JSON.stringify({
          amount: cost,
          source: `Resume_Template_${slug}`,
          description: `${templateName} resume template — ${pricing.resumeBuilderPremiumDurationDays || 7} days access`,
        }),
      });
      if (debitResult?.success) {
        setHasPremium(true);
        setPaidTemplateSlugs(prev => new Set([...prev, slug]));
        setShowPremiumModal(false);
        showAlert({ title: '🎉 Template Unlocked!', message: `You now have watermark-free access to the ${templateName} template for ${pricing.resumeBuilderPremiumDurationDays || 7} days.` });
      } else {
        showAlert({ title: 'Error', message: debitResult?.error || 'Failed to unlock template. Please try again.' });
      }
    } catch (e) {
      showAlert({ title: 'Error', message: 'Something went wrong. Please try again.' });
    } finally { setPremiumLoading(false); }
  }, [user, pricing, currentTemplateSlug, templates, showAlert]);

  // ── Load Data ──
  useEffect(() => {
    if (user) loadProjects();
    else setLoading(false);
    loadTemplates();
  }, [user]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const result = await refopenAPI.apiCall('/resume-builder/projects');
      setProjects(result?.data || []);
    } catch (e) { console.error('Failed to load projects:', e); }
    finally { setLoading(false); }
  };

  const loadTemplates = async () => {
    try {
      const result = await refopenAPI.apiCall('/resume-builder/templates');
      const tpls = result?.data || [];
      setTemplates(tpls);
      const previews = {};
      await Promise.all(tpls.map(async (t) => {
        try {
          const previewResult = await refopenAPI.apiCall(`/resume-builder/templates/${t.Slug}/preview`);
          previews[t.Slug] = previewResult?.message || previewResult || '';
        } catch (e) { previews[t.Slug] = ''; }
      }));
      setTemplatePreviews(previews);
    } catch (e) { console.error('Failed to load templates:', e); }
  };

  // ── Create Project ──
  const handleCreateProject = async (templateId = 1) => {
    if (!requireAuth('create resume')) return;
    try {
      setLoading(true);
      const result = await refopenAPI.apiCall('/resume-builder/projects', {
        method: 'POST',
        body: JSON.stringify({ templateId, title: 'My Resume' }),
      });
      if (result?.data) {
        try { await refopenAPI.apiCall(`/resume-builder/projects/${result.data.ProjectID}/auto-fill`, { method: 'POST' }); }
        catch (e) { console.log('Auto-fill optional step failed:', e); }
        await openProject(result.data.ProjectID);
      }
    } catch (e) { alert('Error', 'Failed to create project'); }
    finally { setLoading(false); }
  };

  // ── Switch Template ──
  const handleSwitchTemplate = async (templateId) => {
    if (!activeProject) return;
    try {
      setSwitchingTemplate(true); setSaving(true);
      await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}`, {
        method: 'PUT', body: JSON.stringify({ templateId }),
      });
      await openProject(activeProject.ProjectID);
      const result = await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}/preview`);
      const html = typeof result === 'string' ? result : (result?.data || result?.message || '<p>Preview unavailable</p>');
      setPreviewHtml(html);
      setCurrentView(VIEW.PREVIEW);
    } catch (e) { alert('Error', 'Failed to switch template'); }
    finally { setSaving(false); setSwitchingTemplate(false); }
  };

  // ── Open Project ──
  const openProject = async (projectId) => {
    try {
      setLoading(true);
      const result = await refopenAPI.apiCall(`/resume-builder/projects/${projectId}`);
      if (result?.data) {
        const p = result.data;
        setActiveProject(p);
        setPersonalInfo(p.PersonalInfo ? (typeof p.PersonalInfo === 'string' ? JSON.parse(p.PersonalInfo) : p.PersonalInfo) : {
          fullName: '', email: '', phone: '', location: '', linkedin: '', github: '', portfolio: '',
        });
        setSummary(p.Summary || '');
        setSections((p.sections || []).map(s => ({
          ...s,
          Content: typeof s.Content === 'string' ? JSON.parse(s.Content || '[]') : (s.Content || []),
        })));
        setCurrentView(VIEW.EDITOR);
      }
    } catch (e) { alert('Error', 'Failed to load project'); }
    finally { setLoading(false); }
  };

  // ── Save Project ──
  const saveProject = async () => {
    if (!activeProject) return;
    try {
      setSaving(true);
      await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}`, {
        method: 'PUT', body: JSON.stringify({ personalInfo, summary }),
      });
      for (const sec of sections) {
        await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}/sections/${sec.SectionID}`, {
          method: 'PUT',
          body: JSON.stringify({ content: sec.Content, sectionTitle: sec.SectionTitle, isVisible: sec.IsVisible !== false }),
        });
      }
    } catch (e) { console.error('Save failed:', e); }
    finally { setSaving(false); }
  };

  // ── Delete Project ──
  const handleDeleteProject = (projectId) => {
    showConfirm({
      title: 'Delete Resume', message: 'Are you sure you want to delete this resume?',
      icon: 'trash-outline', confirmText: 'Delete', destructive: true,
      onConfirm: async () => {
        try {
          await refopenAPI.apiCall(`/resume-builder/projects/${projectId}`, { method: 'DELETE' });
          setProjects(prev => prev.filter(p => p.ProjectID !== projectId));
        } catch (e) { alert('Error', 'Failed to delete resume'); }
      },
    });
  };

  // ── AI: Generate Summary ──
  const handleAiSummary = async () => {
    if (!activeProject) return;
    try {
      setAiLoading('summary');
      await saveProject();
      const result = await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}/ai/summary`, { method: 'POST' });
      if (result?.data?.summary) setSummary(result.data.summary);
    } catch (e) { alert('AI Error', 'Failed to generate summary'); }
    finally { setAiLoading(null); }
  };

  // ── AI: Rewrite Bullets ──
  const handleAiBullets = async (sectionId, itemIndex) => {
    const sec = sections.find(s => s.SectionID === sectionId);
    if (!sec) return;
    const item = sec.Content[itemIndex];
    if (!item?.bullets?.length) return;
    try {
      setAiLoading(`bullets-${sectionId}-${itemIndex}`);
      let cleanBullets = item.bullets.map(b => b.replace(/^\[?"?|"?,?\]?$/g, '').trim()).filter(Boolean);
      if (cleanBullets.length === 1 && cleanBullets[0].startsWith('[')) {
        try { cleanBullets = JSON.parse(cleanBullets[0]); } catch {}
      }
      const result = await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}/ai/bullets`, {
        method: 'POST',
        body: JSON.stringify({ bullets: cleanBullets, jobTitle: item.title || activeProject.TargetJobTitle || '' }),
      });
      if (result?.data?.bullets) {
        setSections(prev => prev.map(s => {
          if (s.SectionID !== sectionId) return s;
          const newContent = [...s.Content];
          newContent[itemIndex] = { ...newContent[itemIndex], bullets: result.data.bullets };
          return { ...s, Content: newContent };
        }));
      }
    } catch (e) { alert('AI Error', 'Failed to rewrite bullets'); }
    finally { setAiLoading(null); }
  };

  // ── AI: ATS Check ──
  const handleAtsCheck = async () => {
    if (!atsJobDesc.trim()) return;
    try {
      setAiLoading('ats');
      await saveProject();
      const result = await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}/ai/ats-check`, {
        method: 'POST', body: JSON.stringify({ jobDescription: atsJobDesc }),
      });
      if (result?.data) setAtsResult(result.data);
    } catch (e) { alert('AI Error', 'Failed to run ATS check'); }
    finally { setAiLoading(null); }
  };

  // ── Preview ──
  const handlePreview = async () => {
    if (!activeProject) return;
    try {
      setLoading(true);
      await saveProject();
      const result = await refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}/preview`);
      const html = typeof result === 'string' ? result : (result?.data || result?.message || '<p>Preview unavailable</p>');
      setPreviewHtml(html);
      setCurrentView(VIEW.PREVIEW);
    } catch (e) { alert('Error', 'Failed to generate preview'); }
    finally { setLoading(false); }
  };

  // ── Section Helpers ──
  const addItemToSection = (sectionId) => {
    setSections(prev => prev.map(s => {
      if (s.SectionID !== sectionId) return s;
      return { ...s, Content: [...s.Content, getEmptyItem(s.SectionType)] };
    }));
  };

  const removeItemFromSection = (sectionId, itemIndex) => {
    setSections(prev => prev.map(s => {
      if (s.SectionID !== sectionId) return s;
      return { ...s, Content: s.Content.filter((_, i) => i !== itemIndex) };
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
      newContent[itemIndex] = { ...newContent[itemIndex], bullets: [...(newContent[itemIndex].bullets || []), ''] };
      return { ...s, Content: newContent };
    }));
  };

  const removeBullet = (sectionId, itemIndex, bulletIndex) => {
    setSections(prev => prev.map(s => {
      if (s.SectionID !== sectionId) return s;
      const newContent = [...s.Content];
      newContent[itemIndex] = { ...newContent[itemIndex], bullets: (newContent[itemIndex].bullets || []).filter((_, i) => i !== bulletIndex) };
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

  // ── Back Handler ──
  const handleBack = () => {
    if (currentView === VIEW.PREVIEW) setCurrentView(VIEW.EDITOR);
    else if (currentView === VIEW.EDITOR) {
      saveProject();
      setCurrentView(VIEW.LIST);
      setActiveProject(null);
      loadProjects();
    } else {
      navigation.goBack();
    }
  };

  // ══════════════════════════════════════════════════════════
  // TEMPLATE PICKER MODAL
  // ══════════════════════════════════════════════════════════
  const [templateSearch, setTemplateSearch] = useState('');

  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (templateSearch.trim()) {
      const q = templateSearch.toLowerCase().trim();
      result = result.filter(t => {
        const searchable = [t.Name, t.Slug, t.Category, t.Description, t.SearchTags || ''].join(' ').toLowerCase();
        return q.split(/\s+/).every(word => searchable.includes(word));
      });
    }
    return [...result].sort((a, b) => {
      const aFree = !a.IsPremium;
      const bFree = !b.IsPremium;
      const aBought = a.IsPremium && paidTemplateSlugs.has(a.Slug);
      const bBought = b.IsPremium && paidTemplateSlugs.has(b.Slug);
      const aOrder = aFree ? 0 : aBought ? 1 : 2;
      const bOrder = bFree ? 0 : bBought ? 1 : 2;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.SortOrder || 0) - (b.SortOrder || 0);
    });
  }, [templates, templateSearch, paidTemplateSlugs]);

  const templatePickerModal = (
    <Modal visible={showTemplatePicker} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxWidth: isDesktop ? 720 : '95%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{pickerMode === 'switch' ? 'Switch Template' : 'Choose a Template'}</Text>
            <TouchableOpacity onPress={() => { setShowTemplatePicker(false); setTemplateSearch(''); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search templates..."
                placeholderTextColor={colors.textSecondary}
                value={templateSearch}
                onChangeText={setTemplateSearch}
                autoCapitalize="none"
              />
              {templateSearch.length > 0 && (
                <TouchableOpacity onPress={() => setTemplateSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {pickerMode === 'switch' && !templateSearch && (
            <Text style={[styles.captionText, { paddingHorizontal: 20, marginBottom: 12 }]}>
              Your content stays the same — only the design changes.
            </Text>
          )}

          {filteredTemplates.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="search-outline" size={36} color={colors.textSecondary} />
              <Text style={[styles.bodyText, { marginTop: 12 }]}>No templates match "{templateSearch}"</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.templateGrid}>
              {filteredTemplates.map(template => {
                const isActive = pickerMode === 'switch' && activeProject?.TemplateID === template.TemplateID;
                return (
                  <TouchableOpacity
                    key={template.TemplateID}
                    style={[styles.templateCard, isActive && { borderColor: colors.primary, borderWidth: 2 }]}
                    onPress={() => {
                      setShowTemplatePicker(false);
                      setTemplateSearch('');
                      if (pickerMode === 'switch') handleSwitchTemplate(template.TemplateID);
                      else handleCreateProject(template.TemplateID);
                    }}
                    activeOpacity={0.7}
                  >
                    {Platform.OS === 'web' && templatePreviews[template.Slug] ? (
                      <View style={[tpStyles.page, { borderColor: colors.border }]}>
                        <View style={{ width: 816, height: 1056, transform: [{ scale: 0.19 }], transformOrigin: 'top left' }}>
                          <iframe
                            srcDoc={templatePreviews[template.Slug]}
                            style={{ border: 'none', width: 816, height: 1056, pointerEvents: 'none', backgroundColor: '#FFFFFF' }}
                            title={template.Name}
                            scrolling="no"
                          />
                        </View>
                      </View>
                    ) : Platform.OS !== 'web' && templatePreviews[template.Slug] ? (
                      <View style={[tpStyles.page, { borderColor: colors.border }]}>
                        <View style={{ width: 816, height: 1056, transform: [{ scale: 0.19 }], transformOrigin: 'top left' }}>
                          <WebView
                            source={{ html: wrapThumbHtml(templatePreviews[template.Slug]) }}
                            style={{ width: 816, height: 1056, backgroundColor: '#FFFFFF' }}
                            scrollEnabled={false} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
                            originWhitelist={['*']} javaScriptEnabled scalesPageToFit={false}
                            setBuiltInZoomControls={false} nestedScrollEnabled={false}
                          />
                        </View>
                      </View>
                    ) : (
                      <LinearGradient colors={TEMPLATE_GRADIENTS[template.Slug] || TEMPLATE_GRADIENTS.classic} style={styles.templateThumb}>
                        <Ionicons name="document-text" size={32} color="rgba(255,255,255,0.7)" />
                      </LinearGradient>
                    )}
                    {/* Badge */}
                    <View style={[styles.templateBadge, { backgroundColor: template.IsPremium ? (paidTemplateSlugs.has(template.Slug) ? '#059669' : 'rgba(0,0,0,0.6)') : '#059669' }]}>
                      {template.IsPremium ? (
                        <Ionicons name={paidTemplateSlugs.has(template.Slug) ? 'lock-open' : 'lock-closed'} size={10} color="#fff" />
                      ) : (
                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>FREE</Text>
                      )}
                    </View>
                    <Text style={styles.templateName} numberOfLines={1}>{template.Name}</Text>
                    <Text style={styles.templateDesc} numberOfLines={2}>{template.Description || template.Category}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  // ══════════════════════════════════════════════════════════
  // FIELD RENDERERS
  // ══════════════════════════════════════════════════════════
  const renderField = (label, field, placeholder, item, sectionId, itemIndex, options = {}) => (
    <View style={[styles.fieldRow, options.fullWidth ? {} : (isDesktop ? { width: '48%' } : {})]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, options.multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={item[field] || ''}
        onChangeText={v => updateItemField(sectionId, itemIndex, field, v)}
        multiline={options.multiline}
        numberOfLines={options.multiline ? 3 : 1}
      />
    </View>
  );

  const renderItemFields = (sectionType, item, sectionId, idx) => {
    const f = (label, field, placeholder, opts) => renderField(label, field, placeholder, item, sectionId, idx, opts);
    switch (sectionType) {
      case 'experience':
        return (
          <View style={styles.fieldGrid}>
            {f('Job Title', 'title', 'Software Engineer')}
            {f('Company', 'company', 'Google')}
            {f('Location', 'location', 'Mountain View, CA')}
            {f('Start Date', 'startDate', 'Jan 2023')}
            {f('End Date', 'endDate', 'Present')}
          </View>
        );
      case 'education':
        return (
          <View style={styles.fieldGrid}>
            {f('Institution', 'institution', 'MIT')}
            {f('Degree', 'degree', 'B.Tech')}
            {f('Field of Study', 'field', 'Computer Science')}
            {f('GPA', 'gpa', '3.8/4.0')}
            {f('Graduation Year', 'graduationYear', '2023')}
          </View>
        );
      case 'skills':
        return (
          <View style={styles.fieldGrid}>
            {f('Category', 'category', 'Programming Languages')}
            <View style={[styles.fieldRow, isDesktop ? { width: '48%' } : {}]}>
              <Text style={styles.fieldLabel}>Skills (comma-separated)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="JavaScript, TypeScript, Python"
                placeholderTextColor={colors.textSecondary}
                value={(item.skills || []).join(', ')}
                onChangeText={v => updateItemField(sectionId, idx, 'skills', v.split(',').map(s => s.trim()).filter(Boolean))}
              />
            </View>
          </View>
        );
      case 'projects':
        return (
          <View style={styles.fieldGrid}>
            {f('Project Name', 'name', 'E-commerce Platform')}
            {f('URL', 'url', 'https://github.com/...')}
            {f('Description', 'description', 'Built a full-stack...', { multiline: true, fullWidth: true })}
            <View style={[styles.fieldRow, isDesktop ? { width: '48%' } : {}]}>
              <Text style={styles.fieldLabel}>Technologies (comma-separated)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="React, Node.js, PostgreSQL"
                placeholderTextColor={colors.textSecondary}
                value={(item.technologies || []).join(', ')}
                onChangeText={v => updateItemField(sectionId, idx, 'technologies', v.split(',').map(s => s.trim()).filter(Boolean))}
              />
            </View>
          </View>
        );
      case 'certifications':
        return (
          <View style={styles.fieldGrid}>
            {f('Certification', 'certName', 'AWS Solutions Architect')}
            {f('Issuer', 'issuer', 'Amazon Web Services')}
            {f('Date', 'date', 'Mar 2024')}
          </View>
        );
      default:
        return <View style={styles.fieldGrid}>{f('Content', 'text', 'Enter content...', { multiline: true, fullWidth: true })}</View>;
    }
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  // ── Loading state ──
  if (loading && currentView === VIEW.LIST && projects.length === 0) {
    return (
      <View style={styles.container}>
        <SubScreenHeader title="Resume Builder" fallbackTab="Services" />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.bodyText, { marginTop: 12 }]}>Loading your resumes...</Text>
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: MY RESUMES LIST
  // ══════════════════════════════════════════════════════════
  if (currentView === VIEW.LIST) {
    return (
      <View style={styles.container}>
        <SubScreenHeader title="Resume Builder" fallbackTab="Services" />
        <ScrollView contentContainerStyle={[styles.scrollPad, isDesktop && { alignItems: 'center' }]} showsVerticalScrollIndicator={false}>
          <View style={isDesktop ? { maxWidth: 900, width: '100%' } : { width: '100%' }}>

            {/* Hero card */}
            <View style={styles.heroCard}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="document-text-outline" size={40} color={colors.primary + '70'} />
                <View style={{ position: 'absolute', bottom: -2, right: -2 }}>
                  <Ionicons name="sparkles" size={20} color={colors.warning || '#F59E0B'} />
                </View>
              </View>
              <Text style={styles.heroTitle}>AI Resume Builder</Text>
              <Text style={[styles.bodyText, { textAlign: 'center', maxWidth: 400, marginTop: 6, lineHeight: 22 }]}>
                Build a stunning, ATS-optimized resume in minutes. Auto-fill from your profile and export as PDF.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                {[
                  { icon: 'flash-outline', label: 'AI-Powered' },
                  { icon: 'brush-outline', label: '10+ Templates' },
                  { icon: 'download-outline', label: 'PDF Export' },
                  { icon: 'shield-checkmark-outline', label: 'ATS Ready' },
                ].map((f, i) => (
                  <View key={i} style={styles.featureChip}>
                    <Ionicons name={f.icon} size={14} color={colors.primary} />
                    <Text style={[styles.captionText, { color: colors.primary, fontWeight: '600' }]}>{f.label}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => { setPickerMode('create'); setShowTemplatePicker(true); }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark || colors.primary]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.createBtnGradient}
                >
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.createBtnText}>Create New Resume</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* My Resumes */}
            {projects.length > 0 && (
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>My Resumes</Text>
                <Text style={styles.captionText}>{projects.length} resume{projects.length !== 1 ? 's' : ''}</Text>
              </View>
            )}

            <View style={styles.projectsGrid}>
              {projects.map((project) => (
                <TouchableOpacity
                  key={project.ProjectID}
                  style={styles.projectCard}
                  onPress={() => openProject(project.ProjectID)}
                  activeOpacity={0.7}
                >
                  <View style={styles.projectCardTop}>
                    <LinearGradient
                      colors={TEMPLATE_GRADIENTS[project.TemplateSlug] || TEMPLATE_GRADIENTS.classic}
                      style={styles.projectThumb}
                    >
                      <Ionicons name="document-text" size={24} color="rgba(255,255,255,0.8)" />
                    </LinearGradient>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteProject(project.ProjectID)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.projectTitle} numberOfLines={1}>{project.Title || 'Untitled Resume'}</Text>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (Platform.OS === 'web') {
                          const newTitle = window.prompt('Rename resume:', project.Title || 'My Resume');
                          if (newTitle?.trim()) {
                            setProjects(prev => prev.map(p => p.ProjectID === project.ProjectID ? { ...p, Title: newTitle.trim() } : p));
                            refopenAPI.apiCall(`/resume-builder/projects/${project.ProjectID}`, {
                              method: 'PUT', body: JSON.stringify({ title: newTitle.trim() }),
                            }).catch(() => {});
                          }
                        }
                      }}
                    >
                      <Ionicons name="create-outline" size={13} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.captionText}>
                    {project.TemplateName || 'Classic'} • Updated {new Date(project.UpdatedAt).toLocaleDateString()}
                  </Text>
                  <View style={styles.projectCta}>
                    <Text style={[styles.bodyTextBold, { color: colors.primary, fontSize: 13 }]}>Edit Resume</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {projects.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={56} color={colors.textSecondary + '60'} />
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>No resumes yet</Text>
                <Text style={[styles.bodyText, { textAlign: 'center', maxWidth: 280, marginTop: 6 }]}>
                  Create your first resume — it takes less than 5 minutes!
                </Text>
              </View>
            )}

            {/* Need Help */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Support')}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, marginBottom: 10 }}
            >
              <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Need Help?</Text>
            </TouchableOpacity>

            <View style={{ height: 80 }} />
          </View>
        </ScrollView>

        {templatePickerModal}
        <SignInBottomSheet title="Sign in to create your resume" subtitle="Save your work and access all professional templates" delayMs={2000} />
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: EDITOR
  // ══════════════════════════════════════════════════════════
  if (currentView === VIEW.EDITOR) {
    const templateName = activeProject?.templateName || activeProject?.TemplateName || templates.find(t => t.TemplateID === activeProject?.TemplateID)?.Name || 'Classic';

    return (
      <View style={styles.container}>
        <SubScreenHeader
          title={activeProject?.Title || 'Edit Resume'}
          onBack={handleBack}
          fallbackTab="Services"
          subtitle={
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
              onPress={() => {
                if (Platform.OS === 'web') {
                  const newTitle = window.prompt('Rename resume:', activeProject?.Title || 'My Resume');
                  if (newTitle?.trim()) {
                    setActiveProject(prev => ({ ...prev, Title: newTitle.trim() }));
                    refopenAPI.apiCall(`/resume-builder/projects/${activeProject.ProjectID}`, {
                      method: 'PUT', body: JSON.stringify({ title: newTitle.trim() }),
                    }).catch(() => {});
                  }
                }
              }}
            >
              <Ionicons name="create-outline" size={12} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>Rename</Text>
            </TouchableOpacity>
          }
          rightContent={
            <TouchableOpacity
              style={[styles.pillBtn, { backgroundColor: (saving || loading) ? colors.border : colors.primary }]}
              onPress={saveProject}
              disabled={saving || loading}
            >
              {(saving || loading) ? <ActivityIndicator size={14} color="#fff" /> : <Ionicons name="checkmark-circle" size={16} color="#fff" />}
              <Text style={styles.pillBtnText}>Save</Text>
            </TouchableOpacity>
          }
        />

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: 'center', flexGrow: 1, justifyContent: 'center' }}>
            <TouchableOpacity style={[styles.toolbarChip, styles.toolbarChipActive]} onPress={() => { setPickerMode('switch'); setShowTemplatePicker(true); }}>
              <Ionicons name="brush-outline" size={15} color={colors.primary} />
              <Text style={[styles.toolbarChipText, { color: colors.primary }]}>{templateName}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarChip} onPress={handlePreview}>
              <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.toolbarChipText}>Preview</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarChip} onPress={() => setShowAtsModal(true)}>
              <Ionicons name="shield-checkmark-outline" size={15} color={colors.textSecondary} />
              <Text style={styles.toolbarChipText}>ATS Check</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.scrollPad, isDesktop && { alignItems: 'center' }]} showsVerticalScrollIndicator={false}>
            <View style={isDesktop ? { maxWidth: 800, width: '100%' } : { width: '100%' }}>

              {/* Personal Info */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Ionicons name="person" size={18} color={colors.primary} />
                    <Text style={styles.cardTitle}>Personal Information</Text>
                  </View>
                </View>
                <View style={styles.fieldGrid}>
                  {[
                    { key: 'fullName', label: 'Full Name', icon: 'person-outline', ph: 'John Doe' },
                    { key: 'email', label: 'Email', icon: 'mail-outline', ph: 'john@example.com' },
                    { key: 'phone', label: 'Phone', icon: 'call-outline', ph: '+1 234 567 890' },
                    { key: 'location', label: 'Location', icon: 'location-outline', ph: 'New York, NY' },
                    { key: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin', ph: 'linkedin.com/in/johndoe' },
                    { key: 'github', label: 'GitHub', icon: 'logo-github', ph: 'github.com/johndoe' },
                  ].map(f => (
                    <View key={f.key} style={[styles.fieldRow, isDesktop && { width: '48%' }]}>
                      <Text style={styles.fieldLabel}>{f.label}</Text>
                      <View style={styles.fieldInputWrap}>
                        <Ionicons name={f.icon} size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.fieldInputInner}
                          placeholder={f.ph}
                          placeholderTextColor={colors.textSecondary}
                          value={personalInfo[f.key] || ''}
                          onChangeText={v => setPersonalInfo(prev => ({ ...prev, [f.key]: v }))}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Summary */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                    <Text style={styles.cardTitle}>Professional Summary</Text>
                  </View>
                  <TouchableOpacity style={styles.aiChip} onPress={handleAiSummary} disabled={aiLoading === 'summary'}>
                    {aiLoading === 'summary' ? <ActivityIndicator size="small" color="#7C3AED" /> : (
                      <><Ionicons name="flash" size={14} color="#7C3AED" /><Text style={styles.aiChipText}>AI Write</Text></>
                    )}
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.fieldInput, { minHeight: 100, marginHorizontal: 16, marginBottom: 16, textAlignVertical: 'top' }]}
                  multiline
                  numberOfLines={4}
                  placeholder="Write a 2-3 sentence professional summary..."
                  placeholderTextColor={colors.textSecondary}
                  value={summary}
                  onChangeText={setSummary}
                />
              </View>

              {/* Dynamic Sections */}
              {sections.map(section => (
                <View key={section.SectionID} style={styles.card}>
                  <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => setExpandedSection(expandedSection === section.SectionID ? null : section.SectionID)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardHeaderLeft}>
                      <Ionicons name={SECTION_ICONS[section.SectionType] || 'list'} size={18} color={colors.primary} />
                      <Text style={styles.cardTitle}>{section.SectionTitle}</Text>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{section.Content?.length || 0}</Text>
                      </View>
                    </View>
                    <Ionicons name={expandedSection === section.SectionID ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
                  </TouchableOpacity>

                  {expandedSection === section.SectionID && (
                    <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                      {(section.Content || []).map((item, idx) => (
                        <View key={idx} style={styles.itemCard}>
                          <View style={styles.itemHeader}>
                            <Text style={[styles.bodyTextBold, { color: colors.primary }]}>#{idx + 1}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              {section.SectionType === 'experience' && item.bullets?.length > 0 && (
                                <TouchableOpacity style={styles.aiChipSm} onPress={() => handleAiBullets(section.SectionID, idx)} disabled={aiLoading?.startsWith('bullets')}>
                                  {aiLoading === `bullets-${section.SectionID}-${idx}` ? <ActivityIndicator size={12} color="#7C3AED" /> : <Ionicons name="flash" size={12} color="#7C3AED" />}
                                  <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '600' }}>
                                    {aiLoading === `bullets-${section.SectionID}-${idx}` ? 'Rewriting...' : 'AI Rewrite'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity onPress={() => removeItemFromSection(section.SectionID, idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close-circle" size={20} color={colors.error} />
                              </TouchableOpacity>
                            </View>
                          </View>

                          {renderItemFields(section.SectionType, item, section.SectionID, idx)}

                          {/* Bullets (experience) */}
                          {section.SectionType === 'experience' && (
                            <View style={styles.bulletsWrap}>
                              <Text style={styles.fieldLabel}>Bullet Points</Text>
                              {(item.bullets || []).map((bullet, bIdx) => (
                                <View key={bIdx} style={styles.bulletRow}>
                                  <Text style={[styles.bodyTextBold, { color: colors.primary, fontSize: 16, marginRight: 6 }]}>•</Text>
                                  <TextInput
                                    style={[styles.fieldInput, { flex: 1, minHeight: 38 }]}
                                    value={bullet}
                                    onChangeText={v => updateBullet(section.SectionID, idx, bIdx, v)}
                                    placeholder="Describe your achievement..."
                                    placeholderTextColor={colors.textSecondary}
                                    multiline
                                  />
                                  <TouchableOpacity onPress={() => removeBullet(section.SectionID, idx, bIdx)} style={{ marginLeft: 6 }}>
                                    <Ionicons name="remove-circle-outline" size={18} color={colors.error} />
                                  </TouchableOpacity>
                                </View>
                              ))}
                              <TouchableOpacity style={styles.addDashedBtn} onPress={() => addBullet(section.SectionID, idx)}>
                                <Ionicons name="add" size={16} color={colors.primary} />
                                <Text style={[styles.bodyTextBold, { color: colors.primary, fontSize: 13 }]}>Add Bullet</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ))}

                      {/* Add Item */}
                      <TouchableOpacity style={styles.addDashedBtn} onPress={() => addItemToSection(section.SectionID)}>
                        <Ionicons name="add-circle" size={18} color={colors.primary} />
                        <Text style={[styles.bodyTextBold, { color: colors.primary }]}>
                          Add {section.SectionType === 'experience' ? 'Experience' : section.SectionType === 'education' ? 'Education' : section.SectionType === 'skills' ? 'Skill Group' : section.SectionType === 'projects' ? 'Project' : section.SectionType === 'certifications' ? 'Certification' : 'Item'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}

            </View>
            <View style={{ height: 80 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ATS Modal */}
        <Modal visible={showAtsModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: isDesktop ? 600 : '95%' }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                  <Text style={styles.modalTitle}>ATS Score Check</Text>
                </View>
                <TouchableOpacity onPress={() => { setShowAtsModal(false); setAtsResult(null); }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {!atsResult ? (
                <View style={{ padding: 16 }}>
                  <Text style={[styles.bodyText, { marginBottom: 8 }]}>
                    Paste the job description to check how well your resume matches:
                  </Text>
                  <TextInput
                    style={[styles.fieldInput, { minHeight: 150, textAlignVertical: 'top' }]}
                    multiline
                    placeholder="Paste the full job description here..."
                    placeholderTextColor={colors.textSecondary}
                    value={atsJobDesc}
                    onChangeText={setAtsJobDesc}
                  />
                  <TouchableOpacity
                    style={[styles.pillBtn, { backgroundColor: (!atsJobDesc.trim() || aiLoading === 'ats') ? colors.border : colors.primary, marginTop: 16, alignSelf: 'stretch', justifyContent: 'center' }]}
                    onPress={handleAtsCheck}
                    disabled={aiLoading === 'ats' || !atsJobDesc.trim()}
                  >
                    {aiLoading === 'ats' ? <ActivityIndicator size="small" color="#fff" /> : (
                      <><Ionicons name="flash" size={16} color="#fff" /><Text style={styles.pillBtnText}>Analyze Match</Text></>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={{ padding: 16, maxHeight: 400 }}>
                  <View style={styles.atsScoreBox}>
                    <Text style={[styles.atsScoreNum, { color: atsResult.score >= 70 ? '#059669' : atsResult.score >= 40 ? '#F59E0B' : colors.error }]}>
                      {atsResult.score}%
                    </Text>
                    <Text style={styles.captionText}>ATS Match Score</Text>
                  </View>
                  {atsResult.missingKeywords?.length > 0 && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={styles.bodyTextBold}>Missing Keywords</Text>
                      <View style={styles.chipWrap}>
                        {atsResult.missingKeywords.map((kw, i) => (
                          <View key={i} style={styles.chipRed}>
                            <Text style={{ fontSize: 12, color: colors.error, fontWeight: '600' }}>{kw}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  {atsResult.tips?.length > 0 && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={styles.bodyTextBold}>Improvement Tips</Text>
                      {atsResult.tips.map((tip, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 }}>
                          <Ionicons name="checkmark-circle" size={16} color="#059669" />
                          <Text style={[styles.bodyText, { flex: 1, lineHeight: 20 }]}>{tip}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <TouchableOpacity style={[styles.addDashedBtn, { marginTop: 16, alignSelf: 'center' }]} onPress={() => setAtsResult(null)}>
                    <Ionicons name="reload" size={16} color={colors.primary} />
                    <Text style={[styles.bodyTextBold, { color: colors.primary }]}>Check Again</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
        {templatePickerModal}
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: PREVIEW
  // ══════════════════════════════════════════════════════════
  if (currentView === VIEW.PREVIEW) {
    return (
      <View style={styles.container}>
        <SubScreenHeader
          title="Resume Preview"
          onBack={handleBack}
          fallbackTab="Services"
          rightContent={
            <TouchableOpacity
              style={[styles.pillBtn, { backgroundColor: hasPremium ? '#059669' : '#7C3AED' }]}
              onPress={async () => {
                if (!hasPremium) {
                  try {
                    const balResult = await refopenAPI.getWalletBalance();
                    if (balResult?.success) setWalletBalance(balResult.data?.availableBalance ?? balResult.data?.balance ?? 0);
                  } catch (e) { /* use cached */ }
                  setShowPremiumModal(true);
                  return;
                }
                if (Platform.OS === 'web') {
                  if (!previewHtml) { alert('Error', 'Preview not available.'); return; }
                  try {
                    const fileName = (personalInfo.fullName?.replace(/\s+/g, '_') || 'Resume') + '_Resume';
                    const printHtml = previewHtml.replace('</head>',
                      `<title>${fileName}</title><style>@media print{@page{margin:0;size:A4;}}</style></head>`
                    );
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) { alert('Popup Blocked', 'Please allow popups for this site, then try again.'); return; }
                    printWindow.document.write(printHtml);
                    printWindow.document.close();
                    printWindow.onload = () => { setTimeout(() => { printWindow.focus(); printWindow.print(); }, 800); };
                    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 2000);
                  } catch (e) { console.error('PDF error:', e); alert('Error', 'Failed to generate PDF.'); }
                } else {
                  if (!previewHtml) { alert('Error', 'Preview not available.'); return; }
                  try {
                    const fileName = (personalInfo.fullName?.replace(/\s+/g, '_') || 'Resume') + '_Resume';
                    const { uri } = await ExpoPrint.printToFileAsync({ html: previewHtml, base64: false });
                    const canShare = await ExpoSharing.isAvailableAsync();
                    if (canShare) await ExpoSharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Share ${fileName}`, UTI: 'com.adobe.pdf' });
                    else alert('Saved', `PDF saved to: ${uri}`);
                  } catch (e) { console.error('Native PDF error:', e); showAlert('Error', 'PDF generation failed: ' + (e.message || String(e))); }
                }
              }}
            >
              <Ionicons name={hasPremium ? 'download-outline' : 'lock-closed'} size={16} color="#fff" />
              <Text style={styles.pillBtnText}>{hasPremium ? 'Save as PDF' : 'Upgrade to Export'}</Text>
            </TouchableOpacity>
          }
        />

        {/* Template switch + instruction bar */}
        <View style={styles.toolbar}>
          <TouchableOpacity style={[styles.toolbarChip, styles.toolbarChipActive]} onPress={() => { setPickerMode('switch'); setShowTemplatePicker(true); }}>
            <Ionicons name="brush-outline" size={15} color={colors.primary} />
            <Text style={[styles.toolbarChipText, { color: colors.primary }]}>
              {activeProject?.templateName || activeProject?.TemplateName || templates.find(t => t.TemplateID === activeProject?.TemplateID)?.Name || 'Switch Template'}
            </Text>
          </TouchableOpacity>
          {Platform.OS === 'web' && (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.captionText, { flex: 1 }]}>
                Tap "Save as PDF" → Select <Text style={{ fontWeight: '700', color: colors.text }}>Save as PDF</Text> → Save.
              </Text>
            </View>
          )}
        </View>

        {Platform.OS === 'web' ? (
          <View style={styles.previewWrapper}>
            <View style={[styles.previewPaper, responsiveWidth < 850 && {
              transform: [{ scale: Math.min(1, (responsiveWidth - 32) / 816) }],
              transformOrigin: 'top center',
            }]}>
              <iframe
                srcDoc={displayPreviewHtml}
                style={{ border: 'none', width: '100%', height: '100%', backgroundColor: '#FFFFFF' }}
                title="Resume Preview"
                onLoad={(e) => {
                  try {
                    const iframe = e.target;
                    const contentHeight = iframe.contentDocument?.documentElement?.scrollHeight;
                    if (contentHeight && contentHeight > 1056) {
                      iframe.style.height = contentHeight + 'px';
                      iframe.parentElement.style.minHeight = contentHeight + 'px';
                    }
                  } catch (err) { /* cross-origin safety */ }
                }}
              />
            </View>
          </View>
        ) : displayPreviewHtml ? (
          <View style={{ flex: 1 }}>
            <WebView
              source={{ html: displayPreviewHtml }}
              style={{ flex: 1, backgroundColor: '#FFFFFF' }}
              scalesPageToFit originWhitelist={['*']} javaScriptEnabled showsHorizontalScrollIndicator={false}
            />
          </View>
        ) : (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.bodyText, { marginTop: 12 }]}>Loading preview...</Text>
          </View>
        )}

        {/* Switching overlay */}
        {switchingTemplate && (
          <View style={styles.switchOverlay}>
            <View style={[styles.card, { padding: 28, alignItems: 'center', gap: 12, minWidth: 200 }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.bodyTextBold}>Switching template...</Text>
              <Text style={styles.captionText}>Generating new preview</Text>
            </View>
          </View>
        )}

        {templatePickerModal}

        <ConfirmPurchaseModal
          visible={showPremiumModal}
          currentBalance={walletBalance}
          requiredAmount={pricing.resumeBuilderPremiumCost || 49}
          contextType="generic"
          itemName={`${templates.find(t => t.Slug === currentTemplateSlug)?.Name || 'Premium'} template — ${pricing.resumeBuilderPremiumDurationDays || 7} days access`}
          onProceed={async () => { setShowPremiumModal(false); await handlePurchasePremium(); }}
          onAddMoney={() => { setShowPremiumModal(false); navigation.navigate('WalletRecharge'); }}
          onCancel={() => setShowPremiumModal(false)}
        />
      </View>
    );
  }

  return null;
}

// ══════════════════════════════════════════════════════════
// STYLES (dynamic with theme colors)
// ══════════════════════════════════════════════════════════
const createStyles = (colors, isMobile, isTablet, isDesktop) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    scrollPad: {
      padding: isMobile ? 16 : 24,
      paddingBottom: 40,
    },

    // ── Typography ──
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    bodyText: { fontSize: 14, color: colors.textSecondary },
    bodyTextBold: { fontSize: 14, fontWeight: '600', color: colors.text },
    captionText: { fontSize: 12, color: colors.textSecondary },

    // ── Hero Card (LIST view) ──
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: 'center',
      marginBottom: 20,
      ...Platform.select({
        web: { boxShadow: '0 2px 12px rgba(0,0,0,0.05)' },
        default: { elevation: 2 },
      }),
    },
    heroIconWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
    heroTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 12 },
    featureChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary + '10',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    createBtn: { marginTop: 20, borderRadius: 14, overflow: 'hidden' },
    createBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 24,
      gap: 8,
      borderRadius: 14,
    },
    createBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

    // ── Section Row ──
    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },

    // ── Project Grid ──
    projectsGrid: {
      flexDirection: isDesktop ? 'row' : 'column',
      flexWrap: isDesktop ? 'wrap' : 'nowrap',
      gap: 12,
    },
    projectCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      width: isDesktop ? '48%' : '100%',
      ...Platform.select({
        web: { boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },
        default: { elevation: 2 },
      }),
    },
    projectCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    projectThumb: {
      width: 52,
      height: 68,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.error + '12',
    },
    projectTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
    projectCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingTop: 12,
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    // ── Empty State ──
    emptyState: { alignItems: 'center', justifyContent: 'center', padding: 48 },

    // ── Card (editor) ──
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
      overflow: 'hidden',
      ...Platform.select({
        web: { boxShadow: '0 1px 6px rgba(0,0,0,0.05)' },
        default: { elevation: 1 },
      }),
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
    },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    countBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: colors.primary + '15',
    },
    countBadgeText: { fontSize: 12, fontWeight: '700', color: colors.primary },

    // ── Fields ──
    fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
    fieldRow: { width: '100%' },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    fieldInput: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      minHeight: 42,
    },
    fieldInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      height: 44,
    },
    fieldInputInner: { flex: 1, fontSize: 14, color: colors.text, height: 42 },

    // ── Items ──
    itemCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 12,
      marginBottom: 10,
      overflow: 'hidden',
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },

    // ── Bullets ──
    bulletsWrap: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },

    // ── AI Chips ──
    aiChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: '#7C3AED15',
    },
    aiChipText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
    aiChipSm: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: '#7C3AED15',
    },

    // ── Dashed Add Button ──
    addDashedBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      marginTop: 4,
    },

    // ── Pill Button ──
    pillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    pillBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

    // ── Toolbar ──
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Platform.select({
        web: { boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
        default: { elevation: 2 },
      }),
    },
    toolbarChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    toolbarChipActive: {
      backgroundColor: colors.primary + '10',
      borderColor: colors.primary + '30',
    },
    toolbarChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

    // ── Modals ──
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
      borderRadius: 20,
      maxHeight: '85%',
      width: '100%',
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 40,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: colors.text },

    // ── Templates ──
    templateGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
    templateCard: {
      width: '47%',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 10,
      position: 'relative',
      overflow: 'hidden',
    },
    templateThumb: {
      width: '100%',
      height: 120,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    templateBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    templateName: { fontSize: 14, fontWeight: '600', color: colors.text },
    templateDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 15 },

    // ── ATS ──
    atsScoreBox: { borderRadius: 12, padding: 20, alignItems: 'center', backgroundColor: colors.background },
    atsScoreNum: { fontSize: 48, fontWeight: '800' },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    chipRed: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.error + '15',
      borderWidth: 1,
      borderColor: colors.error + '30',
      overflow: 'hidden',
    },

    // ── Preview ──
    previewWrapper: {
      flex: 1,
      backgroundColor: colors.border,
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      overflow: 'auto',
    },
    previewPaper: {
      width: 816,
      minHeight: 1056,
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
      ...Platform.select({
        web: { boxShadow: '0 4px 24px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.08)' },
        default: { elevation: 8 },
      }),
    },
    switchOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999,
    },
  });
