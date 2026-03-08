/**
 * CareerJobDetailScreen — Full-page job detail view (Amazon/Google careers style)
 * 
 * Route: /careers/job/:jobId (public, no auth required to view)
 * Auth required only to apply
 * 
 * Features:
 * - Full HTML job description rendering with react-native-render-html
 * - Company info sidebar / header
 * - Apply button with auth guard
 * - Applied status tracking
 * - Similar roles section
 * - Share / bookmark actions
 * - Responsive: mobile + desktop
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Image,
  Pressable,
  Modal,
  TextInput,
  Share,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import useResponsive from '../../hooks/useResponsive';
import ResumeUploadModal from '../../components/ResumeUploadModal';
import { showToast } from '../../components/Toast';
import ComplianceFooter from '../../components/ComplianceFooter';
import refopenAPI from '../../services/api';

const BRAND = '#4F46E5';
const BRAND_LIGHT = '#6366F1';
const HERO_IMAGE = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80';

const ABOUT_REFOPEN_HTML = `
<h3>About RefOpen</h3>
<p>RefOpen isn't just another job portal. We have built <strong>India's first all-in-one career platform</strong> — a single app that handles every step of your job search journey, from finding the right opportunity to landing the offer.</p>

<h4>The Problem We Solved</h4>
<p>India has 900+ million working-age people, yet the job search experience was broken. Job portals are flooded with spam listings. Referrals — the #1 way people actually get hired — were gatekept by personal networks. Resume tools are expensive. Interview prep is scattered across YouTube videos and random PDFs. There was no single platform that truly helps a candidate go from "I need a job" to "I got the offer." <strong>RefOpen changed that.</strong></p>

<h4>Referral Marketplace (Our Core)</h4>
<p>We've built India's largest verified employee referral network. Job seekers can request referrals directly from real employees at Google, Amazon, Microsoft, Flipkart, Swiggy, Razorpay, and 500+ top companies — no connections needed. Referrals increase your chances of getting hired by 10x, and we've made them accessible to everyone, not just IIT alumni with LinkedIn networks.</p>

<h4>AI-Powered Career Tools Suite</h4>
<p>Beyond referrals, we've built a complete suite of AI-powered tools that no other Indian platform offers in one place:</p>
<ul>
<li><strong>AI Resume Analyzer</strong> — Instant ATS compatibility score, keyword gap analysis, and AI-powered improvement suggestions.</li>
<li><strong>AI Resume Builder</strong> — Create stunning, ATS-optimized resumes with professional templates and AI-generated bullet points.</li>
<li><strong>Interview Decoded</strong> — AI-powered mock interviews with real-time feedback and company-specific question banks.</li>
<li><strong>Salary Spy</strong> — Research real market compensation data across roles, companies, and experience levels.</li>
<li><strong>Offer Negotiation Coach</strong> — AI-guided strategies to negotiate better compensation packages.</li>
<li><strong>LinkedIn Profile Optimizer</strong> — AI analysis with actionable suggestions to rank higher in recruiter searches.</li>
<li><strong>Blind Resume Review</strong> — Unbiased, anonymous feedback on your resume from peers.</li>
<li><strong>Career Path Simulator</strong> — Explore career trajectories and identify skill gaps with AI.</li>
<li><strong>Job Market Pulse</strong> — Real-time hiring trends, in-demand skills, and salary benchmarks.</li>
</ul>

<h4>The Numbers</h4>
<ul>
<li>125,000+ active job listings aggregated and enriched daily from across India</li>
<li>500+ companies with verified employee referrers on the platform</li>
<li>Thousands of active job seekers using our tools every day</li>
<li>Cross-platform app serving Android, iOS, and Web from a single codebase</li>
</ul>

<h4>The Tech</h4>
<p>We're a tech-first company built on a modern stack that rivals FAANG engineering standards: React Native (Expo), Node.js, TypeScript, Azure Functions (serverless), SQL Server, Azure SignalR (real-time), and AI/ML integrations with Google Gemini and Groq. We ship to production daily, run automated data pipelines that index thousands of listings, and use AI to enrich every job posting with salary estimates, company insights, and skill matching.</p>

<h4>The Vision</h4>
<p>We built the platform we wish existed when we were job hunting. One app where you can find the right job, get a referral, build a perfect resume, practice for interviews, research salaries, negotiate your offer, and track everything — all without switching between 10 different tools. We're growing fast, and every person who joins now gets to shape what this becomes.</p>
<p>RefOpen is based in Bengaluru, India. We're a small, elite team that moves fast, ships often, and believes talent should be discovered on merit — not connections.</p>
`;

export default function CareerJobDetailScreen({ route, navigation }) {
  const jobId = route?.params?.jobId;
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const responsive = useResponsive();
  const { isMobile, isDesktop } = responsive;
  const { width: windowWidth } = useWindowDimensions();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allJobs, setAllJobs] = useState([]);
  const [appliedJobIds, setAppliedJobIds] = useState(new Set());
  const [myApplications, setMyApplications] = useState([]);
  const [showMyApps, setShowMyApps] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [selectedResume, setSelectedResume] = useState(null);

  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const contentWidth = useMemo(() => Math.min(windowWidth, isDesktop ? 800 : windowWidth) - (isMobile ? 32 : 0), [windowWidth, isDesktop, isMobile]);

  const loadJob = useCallback(async () => {
    try {
      const result = await refopenAPI.getCareerJobById(jobId);
      if (result?.success) setJob(result.data);
      // Load all jobs for similar roles
      const allResult = await refopenAPI.getCareerJobs(1, 50);
      if (allResult?.success) setAllJobs(allResult.data || []);
      // Load applied status
      if (isAuthenticated) {
        try {
          const apps = await refopenAPI.getMyCareerApplications();
          if (apps?.success && apps.data) {
            setAppliedJobIds(new Set(apps.data.map(a => a.CareerJobID)));
            setMyApplications(apps.data);
          }
        } catch {}
      }
    } catch (e) { console.warn('Failed to load career job:', e); }
    finally { setLoading(false); }
  }, [jobId, isAuthenticated]);

  useEffect(() => { loadJob(); }, [loadJob]);

  const applied = job ? appliedJobIds.has(job.CareerJobID) : false;

  const similarJobs = useMemo(() => {
    if (!job || !allJobs.length) return [];
    return allJobs
      .filter(j => j.CareerJobID !== job.CareerJobID && (j.Department === job.Department || j.JobType === job.JobType))
      .slice(0, 4);
  }, [job, allJobs]);

  const fmtSalary = (min, max) => {
    if (!min && !max) return null;
    const f = v => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v.toLocaleString();
    return min && max ? `₹${f(min)} - ₹${f(max)}/yr` : min ? `₹${f(min)}+/yr` : `Up to ₹${f(max)}/yr`;
  };

  const ago = (d) => {
    if (!d) return '';
    const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
    if (h < 1) return 'Just posted';
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return days < 7 ? `${days}d ago` : `${Math.floor(days / 7)}w ago`;
  };

  const handleApply = () => {
    if (!isAuthenticated) { navigation.navigate('Auth'); showToast('Please log in to apply', 'info'); return; }
    if (applied) { showToast('Already applied', 'info'); return; }
    setCoverLetter(''); setSelectedResume(null); setShowApplyModal(true);
  };

  const submitApp = async () => {
    if (!selectedResume?.ResumeURL && !selectedResume?.resumeURL) { showToast('Please select a resume', 'error'); return; }
    setApplying(true);
    try {
      const r = await refopenAPI.applyToCareerJob({
        careerJobId: job.CareerJobID,
        resumeURL: selectedResume.ResumeURL || selectedResume.resumeURL,
        coverLetter: coverLetter.trim() || undefined,
        fullName: `${user?.FirstName || ''} ${user?.LastName || ''}`.trim(),
        email: user?.Email,
      });
      if (r?.success) {
        setAppliedJobIds(prev => new Set([...prev, job.CareerJobID]));
        setMyApplications(prev => [{ CareerJobID: job.CareerJobID, Title: job.Title, Department: job.Department, Location: job.Location, Status: 'Submitted', AppliedAt: new Date().toISOString() }, ...prev]);
        setShowApplyModal(false);
        showToast('Application submitted! 🎉', 'success');
      } else { showToast(r?.error || r?.message || 'Failed', 'error'); }
    } catch (e) {
      if (e?.message?.includes('already applied')) {
        setAppliedJobIds(prev => new Set([...prev, job.CareerJobID]));
        showToast('Already applied', 'info');
      } else { showToast('Failed. Please try again.', 'error'); }
    } finally { setApplying(false); }
  };

  const handleShare = async () => {
    try {
      const url = Platform.OS === 'web'
        ? window.location.href
        : `https://app.refopen.com/careers/job/${jobId}`;
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: job.Title, text: `${job.Title} at RefOpen`, url });
        } else {
          await navigator.clipboard.writeText(url);
          showToast('Link copied!', 'success');
        }
      } else {
        await Share.share({ message: `${job.Title} at RefOpen — ${url}` });
      }
    } catch {}
  };

  // HTML rendering config for react-native-render-html
  const htmlTagsStyles = useMemo(() => ({
    h2: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8, marginTop: 0, lineHeight: 30 },
    h3: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 6, marginTop: 20, lineHeight: 24 },
    h4: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4, marginTop: 14, lineHeight: 22 },
    p: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 8, marginTop: 0 },
    li: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 4 },
    ul: { marginBottom: 8, paddingLeft: 4, color: colors.textSecondary },
    ol: { marginBottom: 8, paddingLeft: 4, color: colors.textSecondary },
    strong: { fontWeight: '700', color: colors.text },
    em: { fontStyle: 'italic' },
  }), [colors]);

  const htmlRenderersProps = useMemo(() => ({
    ul: { markerTextStyle: { color: colors.textSecondary } },
    ol: { markerTextStyle: { color: colors.textSecondary } },
  }), [colors]);

  const htmlSystemFonts = Platform.OS === 'web'
    ? ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif']
    : undefined;

  const STATUS_COLORS = { 'Submitted': '#3b82f6', 'Under Review': '#f59e0b', 'Shortlisted': '#22c55e', 'Interview': '#8b5cf6', 'Offered': '#06b6d4', 'Hired': '#10b981', 'On Hold': '#f97316', 'Rejected': '#ef4444' };

  const LogoLink = ({ children }) => {
    if (Platform.OS === 'web') {
      return <a href="/" style={{ textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); navigation.navigate('Main'); }}>{children}</a>;
    }
    return <TouchableOpacity onPress={() => navigation.navigate('Main')}>{children}</TouchableOpacity>;
  };

  const renderHeader = () => (
    <View>
      <View style={styles.customHeader}>
        <LogoLink>
          <Image source={require('../../../assets/refopen-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </LogoLink>
        <TouchableOpacity style={styles.headerLink} onPress={() => {
          if (!isAuthenticated) { navigation.navigate('Auth'); showToast('Please log in to view your applications', 'info'); return; }
          if (myApplications.length === 0) { showToast('No applications yet. Apply to a role first!', 'info'); return; }
          setShowMyApps(true);
        }}>
          <Text style={styles.headerLinkT}>My Applications</Text>
          {myApplications.length > 0 && <View style={styles.headerBadge}><Text style={styles.headerBadgeT}>{myApplications.length}</Text></View>}
        </TouchableOpacity>
      </View>
      <View style={styles.breadcrumb}>
        <TouchableOpacity onPress={() => navigation.navigate('Careers')}><Text style={styles.breadcrumbLink}>Careers</Text></TouchableOpacity>
        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
        <Text style={styles.breadcrumbCurrent} numberOfLines={1}>{job?.Title || 'Job Details'}</Text>
      </View>
    </View>
  );

  const renderMyAppsModal = () => (
    <Modal visible={showMyApps} transparent animationType="fade" onRequestClose={() => setShowMyApps(false)}>
      <Pressable style={styles.overlay} onPress={() => setShowMyApps(false)}>
        <Pressable style={styles.myAppsModal} onPress={e => e.stopPropagation()}>
          <View style={styles.myAppsModalHead}>
            <Text style={styles.myAppsModalTitle}>My Applications</Text>
            <TouchableOpacity onPress={() => setShowMyApps(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {myApplications.map((app, i) => (
              <TouchableOpacity key={app.ApplicationID || i} style={styles.myAppItem}
                onPress={() => { setShowMyApps(false); navigation.push('CareerJobDetail', { jobId: app.CareerJobID }); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myAppTitle}>{app.Title || 'Position'}</Text>
                  <Text style={styles.myAppMeta}>{app.Department} \u2022 {app.Location}</Text>
                  <Text style={styles.myAppDate}>Applied {app.AppliedAt ? new Date(app.AppliedAt).toLocaleDateString() : ''}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[app.Status] || '#6b7280') + '18', borderColor: (STATUS_COLORS[app.Status] || '#6b7280') + '40' }]}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[app.Status] || '#6b7280' }]} />
                  <Text style={[styles.statusText, { color: STATUS_COLORS[app.Status] || '#6b7280' }]}>{app.Status || 'Submitted'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );

  if (loading) return (
    <View style={styles.container}>
      {renderHeader()}
      <View style={styles.loadingC}><ActivityIndicator size="large" color={BRAND} /><Text style={styles.loadingT}>Loading job details...</Text></View>
    </View>
  );

  if (!job) return (
    <View style={styles.container}>
      {renderHeader()}
      <View style={styles.loadingC}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.gray400} />
        <Text style={styles.emptyTitle}>Job not found</Text>
        <Text style={styles.emptySub}>This position may no longer be available</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Careers')}>
          <Text style={styles.backBtnT}>Browse all openings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const salary = fmtSalary(job.SalaryMin, job.SalaryMax);
  const skills = (job.Skills || '').split(',').map(s => s.trim()).filter(Boolean);
  const intern = job.JobType === 'Internship';

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderMyAppsModal()}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <Image source={{ uri: HERO_IMAGE }} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <View style={styles.heroLogoWrap}>
              <Image source={require('../../../public/favicon.png')} style={styles.heroLogo} resizeMode="contain" />
            </View>
            <Text style={styles.heroCompany}>RefOpen</Text>
          </View>
        </View>

        {/* Job Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobTitle}>{job.Title}</Text>
              <Text style={styles.jobCompany}>RefOpen • {ago(job.PublishedAt)}</Text>
            </View>
            {applied && (
              <View style={styles.appliedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                <Text style={styles.appliedT}>Applied</Text>
              </View>
            )}
          </View>

          {/* Meta pills */}
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Ionicons name="location-outline" size={14} color={BRAND} />
              <Text style={styles.metaT}>{job.Location}</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="briefcase-outline" size={14} color={BRAND} />
              <Text style={styles.metaT}>{job.JobType}</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="business-outline" size={14} color={BRAND} />
              <Text style={styles.metaT}>{job.WorkplaceType}</Text>
            </View>
            {job.ExperienceMin != null && (
              <View style={styles.metaPill}>
                <Ionicons name="school-outline" size={14} color={BRAND} />
                <Text style={styles.metaT}>
                  {job.ExperienceMin === 0 && job.ExperienceMax === 0 ? 'Freshers' : `${job.ExperienceMin}-${job.ExperienceMax} yrs`}
                </Text>
              </View>
            )}
            {salary && (
              <View style={styles.metaPill}>
                <Ionicons name="cash-outline" size={14} color={BRAND} />
                <Text style={styles.metaT}>{salary}</Text>
              </View>
            )}
            {job.Department && (
              <View style={styles.metaPill}>
                <Ionicons name="grid-outline" size={14} color={BRAND} />
                <Text style={styles.metaT}>{job.Department}</Text>
              </View>
            )}
            {intern && (
              <View style={[styles.metaPill, { backgroundColor: '#06b6d418', borderColor: '#06b6d440' }]}>
                <Ionicons name="star-outline" size={14} color="#06b6d4" />
                <Text style={[styles.metaT, { color: '#06b6d4' }]}>PPO Available</Text>
              </View>
            )}
          </View>

          {/* Skills */}
          {skills.length > 0 && (
            <View style={styles.skillsRow}>
              {skills.map((s, i) => <Text key={i} style={styles.skill}>{s}</Text>)}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.applyBtn, applied && styles.applyBtnDone]}
              onPress={handleApply}
              disabled={applied}
            >
              <Ionicons name={applied ? 'checkmark-circle' : 'paper-plane-outline'} size={18} color={applied ? '#22c55e' : '#fff'} />
              <Text style={[styles.applyBtnT, applied && { color: '#22c55e' }]}>
                {applied ? 'Applied' : 'Apply Now'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={18} color={BRAND} />
              <Text style={styles.shareBtnT}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content — Desktop: 2-column, Mobile: single column */}
        <View style={styles.mainContent}>
          {/* Left column — Job Description */}
          <View style={styles.descColumn}>
            {/* Full Job Description with HTML rendering */}
            <View style={styles.section}>
              <RenderHtml
                contentWidth={contentWidth}
                source={{ html: job.Description || '<p>No description available.</p>' }}
                tagsStyles={htmlTagsStyles}
                renderersProps={htmlRenderersProps}
                systemFonts={htmlSystemFonts}
                defaultTextProps={{ selectable: true }}
                enableExperimentalMarginCollapsing
              />
            </View>

            {/* Requirements — show in left column on mobile only (desktop shows in sidebar) */}
            {!isDesktop && job.Requirements && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Requirements</Text>
                <RenderHtml
                  contentWidth={contentWidth}
                  source={{ html: job.Requirements }}
                  tagsStyles={htmlTagsStyles}
                  renderersProps={htmlRenderersProps}
                  systemFonts={htmlSystemFonts}
                  defaultTextProps={{ selectable: true }}
                />
              </View>
            )}

            {/* Responsibilities — show in left column on mobile only */}
            {!isDesktop && job.Responsibilities && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Responsibilities</Text>
                <RenderHtml
                  contentWidth={contentWidth}
                  source={{ html: job.Responsibilities }}
                  tagsStyles={htmlTagsStyles}
                  renderersProps={htmlRenderersProps}
                  systemFonts={htmlSystemFonts}
                  defaultTextProps={{ selectable: true }}
                />
              </View>
            )}
          </View>

          {/* Right column — Company Info (desktop only) */}
          {isDesktop && (
            <View style={styles.sideColumn}>
              <View style={styles.sideCard}>
                <Image source={require('../../../public/favicon.png')} style={styles.sideLogoImg} resizeMode="contain" />
                <Text style={styles.sideCompanyName}>RefOpen</Text>
                <Text style={styles.sideCompanyTag}>All-in-One Career Platform</Text>
                <View style={styles.sideDivider} />
                <View style={styles.sideInfoRow}>
                  <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.sideInfoT}>50-100 employees</Text>
                </View>
                <View style={styles.sideInfoRow}>
                  <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.sideInfoT}>Bengaluru, India</Text>
                </View>
                <View style={styles.sideInfoRow}>
                  <Ionicons name="globe-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.sideInfoT}>refopen.com</Text>
                </View>
                <View style={styles.sideInfoRow}>
                  <Ionicons name="rocket-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.sideInfoT}>Early Stage Startup</Text>
                </View>
                <View style={styles.sideDivider} />
                <Text style={styles.sideAbout}>
                  India's first all-in-one career platform. Get referred to 500+ top companies, build ATS-optimized resumes with AI, prep for interviews, check salaries, and more — all in one app.
                </Text>
              </View>

              {/* Sticky Apply on Sidebar */}
              <TouchableOpacity
                style={[styles.sideApplyBtn, applied && styles.sideApplyBtnDone]}
                onPress={handleApply}
                disabled={applied}
              >
                <Ionicons name={applied ? 'checkmark-circle' : 'paper-plane-outline'} size={18} color={applied ? '#22c55e' : '#fff'} />
                <Text style={[styles.sideApplyBtnT, applied && { color: '#22c55e' }]}>
                  {applied ? 'Already Applied' : 'Apply for this role'}
                </Text>
              </TouchableOpacity>

              {/* Requirements in sidebar (desktop) */}
              {job.Requirements && (
                <View style={[styles.sideCard, { marginTop: 16, alignItems: 'flex-start' }]}>
                  <Text style={[styles.sideCompanyName, { fontSize: 16, marginBottom: 10 }]}>Requirements</Text>
                  <RenderHtml
                    contentWidth={240}
                    source={{ html: job.Requirements }}
                    tagsStyles={htmlTagsStyles}
                    renderersProps={htmlRenderersProps}
                    systemFonts={htmlSystemFonts}
                    defaultTextProps={{ selectable: true }}
                  />
                </View>
              )}

              {/* Responsibilities in sidebar (desktop) */}
              {job.Responsibilities && (
                <View style={[styles.sideCard, { marginTop: 12, alignItems: 'flex-start' }]}>
                  <Text style={[styles.sideCompanyName, { fontSize: 16, marginBottom: 10 }]}>Responsibilities</Text>
                  <RenderHtml
                    contentWidth={240}
                    source={{ html: job.Responsibilities }}
                    tagsStyles={htmlTagsStyles}
                    renderersProps={htmlRenderersProps}
                    systemFonts={htmlSystemFonts}
                    defaultTextProps={{ selectable: true }}
                  />
                </View>
              )}
            </View>
          )}
        </View>

        {/* About RefOpen — full width, below both columns */}
        <View style={styles.aboutSection}>
          <View style={styles.section}>
            <RenderHtml
              contentWidth={Math.min(windowWidth, isDesktop ? 900 : windowWidth) - (isMobile ? 32 : 0)}
              source={{ html: ABOUT_REFOPEN_HTML }}
              tagsStyles={htmlTagsStyles}
              renderersProps={htmlRenderersProps}
              systemFonts={htmlSystemFonts}
              defaultTextProps={{ selectable: true }}
            />
          </View>
        </View>

        {/* Similar Roles */}
        {similarJobs.length > 0 && (
          <View style={styles.similarSection}>
            <Text style={styles.similarTitle}>Similar Roles at RefOpen</Text>
            <View style={styles.similarGrid}>
              {similarJobs.map((sj) => {
                const sjApplied = appliedJobIds.has(sj.CareerJobID);
                const sjSalary = fmtSalary(sj.SalaryMin, sj.SalaryMax);
                return (
                  <TouchableOpacity
                    key={sj.CareerJobID}
                    style={styles.similarCard}
                    onPress={() => navigation.push('CareerJobDetail', { jobId: sj.CareerJobID })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.similarCardHead}>
                      <Image source={require('../../../public/favicon.png')} style={styles.similarLogo} resizeMode="contain" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.similarCardTitle} numberOfLines={2}>{sj.Title}</Text>
                        <Text style={styles.similarCardCo}>RefOpen</Text>
                      </View>
                      {sjApplied && (
                        <View style={styles.miniAppliedBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
                        </View>
                      )}
                    </View>
                    <View style={styles.similarMeta}>
                      <Text style={styles.similarMetaT}>{sj.Location}</Text>
                      <Text style={styles.similarMetaT}>•</Text>
                      <Text style={styles.similarMetaT}>{sj.JobType}</Text>
                      {sjSalary && <><Text style={styles.similarMetaT}>•</Text><Text style={styles.similarMetaT}>{sjSalary}</Text></>}
                    </View>
                    <View style={styles.similarTags}>
                      <Text style={[styles.similarTag, { backgroundColor: BRAND + '15', color: BRAND }]}>{sj.Department}</Text>
                      <Text style={[styles.similarTag, { backgroundColor: colors.success + '15', color: colors.success }]}>{sj.WorkplaceType}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* CTA Banner */}
        <View style={styles.ctaBanner}>
          <Text style={styles.ctaTitle}>Don't see a perfect fit?</Text>
          <Text style={styles.ctaSub}>Reach us on our socials or browse all openings</Text>
          <View style={styles.socialRow}>
            <TouchableOpacity onPress={() => Linking.openURL('https://www.linkedin.com/company/refopen')}>
              <Ionicons name="logo-linkedin" size={24} color={BRAND} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://www.instagram.com/refopensolutions')}>
              <Ionicons name="logo-instagram" size={24} color={BRAND} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://x.com/refopensolution')}>
              <Ionicons name="logo-twitter" size={24} color={BRAND} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate('Careers')}>
            <Ionicons name="arrow-back" size={16} color="#fff" />
            <Text style={styles.ctaBtnT}>View All Openings</Text>
          </TouchableOpacity>
        </View>

        <View style={{ maxWidth: isDesktop ? 900 : '100%', width: '100%', alignSelf: 'center' }}>
          <ComplianceFooter navigation={navigation} currentPage="careers" />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Apply Modal */}
      <Modal visible={showApplyModal} transparent animationType="fade" onRequestClose={() => setShowApplyModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowApplyModal(false)}>
          <Pressable style={styles.modal} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Apply for {job?.Title}</Text>
              <TouchableOpacity onPress={() => setShowApplyModal(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Resume *</Text>
            {selectedResume ? (
              <View style={styles.resumeRow}>
                <Ionicons name="document-text" size={20} color={BRAND} />
                <Text style={styles.resumeName} numberOfLines={1}>{selectedResume.ResumeLabel || 'Resume selected'}</Text>
                <TouchableOpacity onPress={() => setShowResumeModal(true)}><Text style={{ color: BRAND, fontSize: 13 }}>Change</Text></TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadBtn} onPress={() => setShowResumeModal(true)}>
                <Ionicons name="cloud-upload-outline" size={20} color={BRAND} />
                <Text style={styles.uploadT}>Select or Upload Resume</Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.label, { marginTop: 16 }]}>Cover Letter (optional)</Text>
            <TextInput style={styles.coverInput} placeholder="Why are you interested?" placeholderTextColor={colors.textSecondary}
              value={coverLetter} onChangeText={setCoverLetter} multiline numberOfLines={5} maxLength={2000} textAlignVertical="top" />
            <View style={styles.modalActs}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowApplyModal(false)}>
                <Text style={styles.cancelT}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, applying && { opacity: 0.6 }]} onPress={submitApp} disabled={applying}>
                {applying ? <ActivityIndicator size="small" color="#fff" /> : (
                  <><Ionicons name="paper-plane-outline" size={16} color="#fff" /><Text style={styles.submitT}>Submit</Text></>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ResumeUploadModal visible={showResumeModal} onClose={() => setShowResumeModal(false)}
        onResumeSelected={(r) => { setSelectedResume(r); setShowResumeModal(false); }} user={user} jobTitle={job?.Title} />
    </View>
  );
}

const createStyles = (colors, responsive = {}) => {
  const { isMobile = true, isDesktop = false } = responsive;
  const mw = isDesktop ? 900 : '100%';

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { alignItems: 'center' },
    loadingC: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
    loadingT: { marginTop: 12, color: colors.textSecondary },

    // Custom Header
    customHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
    headerLogo: { height: 32, width: 120 },
    headerLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerLinkT: { fontSize: 13, fontWeight: '600', color: BRAND },
    headerBadge: { backgroundColor: BRAND, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
    headerBadgeT: { fontSize: 10, fontWeight: '700', color: '#fff' },
    breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
    breadcrumbLink: { fontSize: 13, fontWeight: '600', color: BRAND },
    breadcrumbCurrent: { fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 },
    myAppsModal: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 500, maxHeight: '80%' },
    myAppsModalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    myAppsModalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    myAppItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
    myAppTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
    myAppMeta: { fontSize: 12, color: colors.textSecondary },
    myAppDate: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, marginLeft: 10 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 11, fontWeight: '600' },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 12 },
    emptySub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    backBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: BRAND },
    backBtnT: { fontSize: 14, fontWeight: '600', color: '#fff' },

    // Hero Banner
    heroBanner: { width: '100%', height: isMobile ? 140 : 200, position: 'relative', overflow: 'hidden' },
    heroImage: { width: '100%', height: '100%' },
    heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(79, 70, 229, 0.7)' },
    heroContent: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    heroLogoWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
    heroLogo: { width: 36, height: 36, borderRadius: 8 },
    heroCompany: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 8 },

    // Header Card
    headerCard: { maxWidth: mw, width: '100%', backgroundColor: colors.surface, marginTop: -20, borderRadius: 16, padding: isMobile ? 20 : 28, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 6, zIndex: 1, ...(isMobile ? { marginHorizontal: 16 } : { alignSelf: 'center' }) },
    headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
    jobTitle: { fontSize: isMobile ? 22 : 26, fontWeight: '800', color: colors.text, lineHeight: isMobile ? 28 : 34 },
    jobCompany: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },

    appliedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#22c55e15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#22c55e30' },
    appliedT: { fontSize: 13, fontWeight: '600', color: '#22c55e' },

    // Meta pills
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: BRAND + '10', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: BRAND + '20' },
    metaT: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },

    // Skills
    skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
    skill: { fontSize: 11, fontWeight: '500', color: BRAND, backgroundColor: BRAND + '12', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: BRAND + '25', overflow: 'hidden' },

    // Action buttons
    actionRow: { flexDirection: 'row', gap: 12 },
    applyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND, paddingVertical: 14, borderRadius: 12, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    applyBtnDone: { backgroundColor: '#22c55e15', shadowOpacity: 0 },
    applyBtnT: { fontSize: 16, fontWeight: '700', color: '#fff' },
    shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: BRAND + '40', backgroundColor: BRAND + '08' },
    shareBtnT: { fontSize: 14, fontWeight: '600', color: BRAND },

    // Main content layout
    mainContent: { maxWidth: mw, width: '100%', flexDirection: isDesktop ? 'row' : 'column', gap: isDesktop ? 24 : 0, paddingHorizontal: isMobile ? 16 : 0, marginTop: 24, alignSelf: 'center' },
    descColumn: { flex: isDesktop ? 1 : undefined },
    sideColumn: { width: 280, flexShrink: 0 },

    // Sections
    section: { marginBottom: 24, backgroundColor: colors.surface, borderRadius: 12, padding: isMobile ? 16 : 24, borderWidth: 1, borderColor: colors.border },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border },

    // Sidebar
    sideCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginBottom: 16 },
    sideLogoImg: { width: 52, height: 52, borderRadius: 12, marginBottom: 10 },
    sideCompanyName: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 2 },
    sideCompanyTag: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
    sideDivider: { width: '100%', height: 1, backgroundColor: colors.border, marginVertical: 12 },
    sideInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', paddingVertical: 4 },
    sideInfoT: { fontSize: 13, color: colors.textSecondary },
    sideAbout: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, textAlign: 'center' },
    sideApplyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND, paddingVertical: 14, borderRadius: 12, width: '100%', shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    sideApplyBtnDone: { backgroundColor: '#22c55e15', shadowOpacity: 0 },
    sideApplyBtnT: { fontSize: 15, fontWeight: '700', color: '#fff' },

    // Similar Roles
    // About RefOpen — full width
    aboutSection: { maxWidth: mw, width: '100%', paddingHorizontal: isMobile ? 16 : 0, marginTop: 32, alignSelf: 'center' },

    // Similar Roles
    similarSection: { maxWidth: mw, width: '100%', paddingHorizontal: isMobile ? 16 : 0, marginTop: 32, alignSelf: 'center' },
    similarTitle: { fontSize: isMobile ? 20 : 22, fontWeight: '800', color: colors.text, marginBottom: 16 },
    similarGrid: {
      ...(Platform.OS === 'web' && isDesktop ? {
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
      } : { gap: 12 }),
    },
    similarCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
    similarCardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    similarLogo: { width: 32, height: 32, borderRadius: 8 },
    similarCardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    similarCardCo: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
    miniAppliedBadge: { backgroundColor: '#22c55e15', padding: 4, borderRadius: 10 },
    similarMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    similarMetaT: { fontSize: 12, color: colors.textSecondary },
    similarTags: { flexDirection: 'row', gap: 6 },
    similarTag: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },

    // CTA
    ctaBanner: { maxWidth: mw, width: '100%', paddingHorizontal: isMobile ? 16 : 0, marginTop: 32, alignItems: 'center', paddingVertical: 32, alignSelf: 'center' },
    ctaTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
    ctaSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 12 },
    socialRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 16 },
    ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BRAND, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
    ctaBtnT: { fontSize: 14, fontWeight: '600', color: '#fff' },

    // Apply Modal
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modal: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 500, maxHeight: '85%' },
    modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1, marginRight: 12 },
    label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
    resumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, backgroundColor: BRAND + '10', borderWidth: 1, borderColor: BRAND + '30' },
    resumeName: { flex: 1, fontSize: 13, color: colors.text },
    uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: BRAND },
    uploadT: { fontSize: 14, color: BRAND, fontWeight: '500' },
    coverInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 14, color: colors.text, backgroundColor: colors.background, minHeight: 100, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
    modalActs: { flexDirection: 'row', gap: 12, marginTop: 20 },
    cancelBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    cancelT: { fontSize: 14, fontWeight: '600', color: colors.text },
    submitBtn: { flex: 1, flexDirection: 'row', gap: 6, padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND },
    submitT: { fontSize: 14, fontWeight: '600', color: '#fff' },
  });
};
