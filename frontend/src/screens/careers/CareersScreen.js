/**
 * CareersScreen — RefOpen's public careers page (Amazon/Google/Microsoft style)
 * 
 * Route: /careers (public, no auth required to view)
 * Auth required only to apply
 * 
 * Features:
 * - Hero with stock team image + RefOpen branding
 * - Search + filter (department, type)
 * - Rich job cards with HTML description preview → navigate to detail
 * - Applied status tracking with green badge
 * - Why RefOpen section with images
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
  RefreshControl,
  TextInput,
  Image,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import useResponsive from '../../hooks/useResponsive';
import { showToast } from '../../components/Toast';
import ComplianceFooter from '../../components/ComplianceFooter';
import refopenAPI from '../../services/api';

const BRAND = '#4F46E5';
const BRAND_LIGHT = '#6366F1';
const HERO_IMAGE = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80';

// Perk images from Unsplash (free to use)
const PERK_IMAGES = {
  impact: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&q=80',
  tech: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=80',
  remote: 'https://images.unsplash.com/photo-1521898284481-a5ec348cb555?w=400&q=80',
  learn: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&q=80',
  team: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80',
  growth: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&q=80',
};

export default function CareersScreen({ navigation }) {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const currentRoute = useRoute();
  const responsive = useResponsive();
  const { isMobile, isDesktop } = responsive;

  // Determine which stack we're in from the route name (not auth state)
  // A logged-in user visiting /careers lands on CareersPublic (root stack), not Careers (MainStack)
  const isPublicStack = currentRoute?.name?.endsWith('Public');
  const detailScreen = isPublicStack ? 'CareerJobDetailPublic' : 'CareerJobDetail';

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [appliedJobIds, setAppliedJobIds] = useState(new Set());
  const [myApplications, setMyApplications] = useState([]);
  const [showMyApps, setShowMyApps] = useState(false);

  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const loadJobs = useCallback(async () => {
    try {
      const result = await refopenAPI.getCareerJobs(1, 50);
      if (result?.success) setJobs(result.data || []);
      if (isAuthenticated) {
        try {
          const apps = await refopenAPI.getMyCareerApplications();
          if (apps?.success && apps.data) {
            setAppliedJobIds(new Set(apps.data.map(a => a.CareerJobID)));
            setMyApplications(apps.data);
          }
        } catch {}
      }
    } catch (e) { console.warn('Failed to load career jobs:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [isAuthenticated]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const departments = useMemo(() => ['All', ...new Set(jobs.map(j => j.Department).filter(Boolean))], [jobs]);
  const jobTypes = useMemo(() => ['All', ...new Set(jobs.map(j => j.JobType).filter(Boolean))], [jobs]);

  const filteredJobs = useMemo(() => jobs.filter(j => {
    if (selectedDept !== 'All' && j.Department !== selectedDept) return false;
    if (selectedType !== 'All' && j.JobType !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return [j.Title, j.Department, j.Skills, j.Location].some(f => (f || '').toLowerCase().includes(q));
    }
    return true;
  }), [jobs, selectedDept, selectedType, searchQuery]);

  const strip = (html) => html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';

  const fmtSalary = (min, max, jobType) => {
    if (!min && !max) return null;
    if (min === 0 && max === 0) return 'Unpaid • Perks + Incentives';
    const isMonthly = jobType === 'Internship' || (max && max < 100000) || (min && !max && min < 100000);
    const f = v => v >= 100000 ? `${(v / 100000).toFixed(1).replace(/\.0$/, '')}L` : v.toLocaleString('en-IN');
    const suffix = isMonthly ? '/month' : '/yr';
    return min && max ? `₹${f(min)} - ₹${f(max)}${suffix}` : min ? `₹${f(min)}+${suffix}` : `Up to ₹${f(max)}${suffix}`;
  };

  const ago = (d) => {
    if (!d) return '';
    const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
    if (h < 1) return 'Just posted';
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return days < 7 ? `${days}d ago` : `${Math.floor(days / 7)}w ago`;
  };

  const renderCard = (job) => {
    const applied = appliedJobIds.has(job.CareerJobID);
    const salary = fmtSalary(job.SalaryMin, job.SalaryMax, job.JobType);
    const skills = (job.Skills || '').split(',').map(s => s.trim()).filter(Boolean);
    const intern = job.JobType === 'Internship';
    const desc = strip(job.Description);

    return (
      <TouchableOpacity
        key={job.CareerJobID}
        style={styles.card}
        onPress={() => navigation.navigate(detailScreen, { jobId: job.CareerJobID })}
        activeOpacity={0.7}
      >
        {/* Card Header */}
        <View style={styles.cardHead}>
          <Image source={require('../../../public/favicon.png')} style={styles.cardLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>{job.Title}</Text>
            <Text style={styles.cardCo}>RefOpen • {job.Department}</Text>
          </View>
          {applied && (
            <View style={styles.appliedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
              <Text style={styles.appliedT}>Applied</Text>
            </View>
          )}
        </View>

        {/* Meta Row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}><Ionicons name="location-outline" size={14} color={colors.textSecondary} /><Text style={styles.metaT}>{job.Location}</Text></View>
          {(job.ExperienceMin != null) && (
            <View style={styles.metaItem}><Ionicons name="briefcase-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.metaT}>{job.ExperienceMin === 0 && job.ExperienceMax === 0 ? 'Freshers' : `${job.ExperienceMin}-${job.ExperienceMax} yrs`}</Text>
            </View>
          )}
          {salary && <View style={styles.metaItem}><Ionicons name="cash-outline" size={14} color={colors.textSecondary} /><Text style={styles.metaT}>{salary}</Text></View>}
          <View style={styles.metaItem}><Ionicons name="time-outline" size={14} color={colors.textSecondary} /><Text style={styles.metaT}>{ago(job.PublishedAt)}</Text></View>
        </View>

        {/* Tags */}
        <View style={styles.tags}>
          <Text style={[styles.tag, { backgroundColor: BRAND + '18', color: BRAND }]}>{job.JobType}</Text>
          <Text style={[styles.tag, { backgroundColor: colors.success + '18', color: colors.success }]}>{job.WorkplaceType}</Text>
          {intern && <Text style={[styles.tag, { backgroundColor: '#06b6d418', color: '#06b6d4' }]}>PPO Available</Text>}
        </View>

        {/* Skills */}
        {skills.length > 0 && (
          <View style={styles.skillsRow}>
            {skills.slice(0, 5).map((s, i) => <Text key={i} style={styles.skill}>{s}</Text>)}
            {skills.length > 5 && <Text style={[styles.skill, { backgroundColor: 'transparent', borderWidth: 0, color: colors.textSecondary }]}>+{skills.length - 5}</Text>}
          </View>
        )}

        {/* Description Preview */}
        <Text style={styles.preview} numberOfLines={3}>{desc}</Text>

        {/* Card Footer */}
        <View style={styles.cardFoot}>
          <View style={styles.viewDetailBtn}>
            <Text style={styles.viewDetailT}>View Details</Text>
            <Ionicons name="arrow-forward" size={14} color={BRAND} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const STATUS_COLORS = { 'Submitted': '#3b82f6', 'Under Review': '#f59e0b', 'Shortlisted': '#22c55e', 'Interview': '#8b5cf6', 'Offered': '#06b6d4', 'Hired': '#10b981', 'On Hold': '#f97316', 'Rejected': '#ef4444' };

  const LogoLink = ({ children }) => {
    const goHome = () => {
      if (isPublicStack) {
        navigation.navigate('AboutUs');
      } else {
        navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Home' } });
      }
    };
    if (Platform.OS === 'web') {
      return <a href="/" style={{ textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); goHome(); }}>{children}</a>;
    }
    return <TouchableOpacity onPress={goHome}>{children}</TouchableOpacity>;
  };

  const renderHeader = () => (
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
                onPress={() => { setShowMyApps(false); navigation.navigate(detailScreen, { jobId: app.CareerJobID }); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myAppTitle}>{app.Title || 'Position'}</Text>
                  <Text style={styles.myAppMeta}>{app.Department} • {app.Location}</Text>
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
      <View style={styles.loadingC}><ActivityIndicator size="large" color={BRAND} /><Text style={styles.loadingT}>Loading openings...</Text></View>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderMyAppsModal()}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadJobs(); }} />}
        showsVerticalScrollIndicator={false}>

        {/* Hero Section — Amazon/Google style */}
        <View style={styles.hero}>
          <Image source={{ uri: HERO_IMAGE }} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroInner}>
            <View style={styles.heroLogoWrap}>
              <Image source={require('../../../public/favicon.png')} style={styles.heroLogoImg} resizeMode="contain" />
            </View>
            <Text style={styles.heroTitle}>Join RefOpen</Text>
            <Text style={styles.heroSub}>
              Build the future of job referrals. Small team, big impact.{'\n'}
              Solving real problems for job seekers across India.
            </Text>
            <View style={styles.heroStats}>
              {[
                { icon: 'briefcase-outline', n: String(jobs.length), l: 'Open Roles' },
                { icon: 'home-outline', n: '🏠', l: 'Hybrid/Remote' },
                { icon: 'rocket-outline', n: '🚀', l: 'Early Stage' },
                { icon: 'code-slash-outline', n: '💻', l: 'Modern Stack' },
              ].map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <View style={styles.heroDiv} />}
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatN}>{s.n}</Text>
                    <Text style={styles.heroStatL}>{s.l}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        </View>

        {/* Search + Filters */}
        <View style={styles.filters}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput style={styles.searchInput} placeholder="Search by role, skill, or location..." placeholderTextColor={colors.textSecondary}
              value={searchQuery} onChangeText={setSearchQuery} />
            {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={18} color={colors.textSecondary} /></TouchableOpacity>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ gap: 8 }}>
            {departments.map(d => (
              <TouchableOpacity key={d} style={[styles.chip, selectedDept === d && styles.chipOn]} onPress={() => setSelectedDept(d)}>
                <Text style={[styles.chipT, selectedDept === d && styles.chipTOn]}>{d}</Text>
              </TouchableOpacity>
            ))}
            <View style={{ width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 4, alignSelf: 'center' }} />
            {jobTypes.map(t => (
              <TouchableOpacity key={t} style={[styles.chip, selectedType === t && styles.chipOn]} onPress={() => setSelectedType(t)}>
                <Text style={[styles.chipT, selectedType === t && styles.chipTOn]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.results}>
          <Text style={styles.resultsT}>{filteredJobs.length} {filteredJobs.length === 1 ? 'opening' : 'openings'}</Text>
        </View>

        {filteredJobs.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={48} color={colors.gray400} />
            <Text style={styles.emptyTitle}>No openings found</Text>
            <Text style={styles.emptySub}>Try adjusting your search or filters</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {isDesktop ? (
              // Desktop: 2-column grid
              <View style={styles.jobGrid}>
                {filteredJobs.map(renderCard)}
              </View>
            ) : (
              // Mobile: single column
              filteredJobs.map(renderCard)
            )}
          </View>
        )}

        {/* Why RefOpen — Enhanced with images */}
        <View style={styles.whySection}>
          <Text style={styles.whyTitle}>Why RefOpen?</Text>
          <Text style={styles.whySub}>Join a team that's building India's most impactful job referral platform</Text>

        {/* ── Explore RefOpen — Free Tools Section ── */}
        <View style={{ marginTop: 48, marginBottom: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 4 }}>More than just careers</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }}>Explore free tools used by 10,000+ job seekers</Text>

          {/* Ask Referral — TOP highlighted CTA */}
          <TouchableOpacity onPress={() => navigation.navigate(isPublicStack ? 'AskReferralPublic' : 'AskReferral')}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 14, backgroundColor: BRAND + '12', borderWidth: 1, borderColor: BRAND + '30' }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: BRAND + '20', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="rocket-outline" size={22} color={BRAND} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: BRAND }}>Get Referred to Google, Microsoft, Amazon & 500+ more</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Verified employees at top companies refer you directly</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={BRAND} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {[
              { icon: 'eye-outline', title: 'Blind Review', desc: 'Feedback from dream company employees', tag: 'FREE', screen: isPublicStack ? 'BlindReviewPublic' : 'BlindReview', color: '#f59e0b' },
              { icon: 'briefcase-outline', title: '45,000+ Jobs', desc: 'Apply to top MNCs', tag: 'FREE', screen: isAuthenticated ? 'Main' : 'AboutUs', color: '#10b981', params: isAuthenticated ? { screen: 'MainTabs', params: { screen: 'Jobs' } } : undefined },
              { icon: 'document-text-outline', title: 'Resume Analyzer', desc: 'AI scores your resume', tag: 'FREE', screen: isPublicStack ? 'ResumeAnalyzerPublic' : 'ResumeAnalyzer', color: '#3b82f6' },
              { icon: 'create-outline', title: 'Resume Builder', desc: 'ATS-friendly resume', tag: '1 FREE', screen: isPublicStack ? 'ResumeBuilderPublic' : 'ResumeBuilder', color: '#8b5cf6' },
              { icon: 'logo-linkedin', title: 'LinkedIn Optimizer', desc: 'Improve your profile', tag: 'FREE', screen: isPublicStack ? 'LinkedInOptimizerPublic' : 'LinkedInOptimizer', color: '#0077b5' },
            ].map((tool, i) => (
              <TouchableOpacity key={i} onPress={() => navigation.navigate(tool.screen, tool.params)}
                style={{ width: isMobile ? '100%' : 180, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? 12 : 6 }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: tool.color + '15', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name={tool.icon} size={20} color={tool.color} />
                </View>
                <View style={isMobile ? { flex: 1 } : { alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{tool.title}</Text>
                    <View style={{ backgroundColor: '#22c55e20', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: '#22c55e' }}>{tool.tag}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, textAlign: isMobile ? 'left' : 'center' }}>{tool.desc}</Text>
                </View>
                {isMobile && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
          <View style={styles.perksGrid}>
            {[
              { icon: 'rocket-outline', title: 'Early Stage Impact', desc: 'Your code ships to production daily. Shape the product from day one. Every engineer has a voice in architecture decisions.', img: PERK_IMAGES.impact },
              { icon: 'code-slash-outline', title: 'Modern Tech Stack', desc: 'React Native, Node.js, TypeScript, Azure, AI/ML — the stack top companies use. No legacy code, no tech debt.', img: PERK_IMAGES.tech },
              { icon: 'home-outline', title: 'Hybrid & Remote', desc: 'Full-time: 3 days office + 2 remote in Bengaluru. Internships: 100% remote from anywhere in India.', img: PERK_IMAGES.remote },
              { icon: 'school-outline', title: 'Learn & Grow', desc: 'Mentorship from senior engineers. Conference budget, Azure certifications, and course subscriptions included.', img: PERK_IMAGES.learn },
              { icon: 'people-outline', title: 'Small, Elite Team', desc: 'Work directly with founders. No bureaucracy, no red tape. Your ideas go from whiteboard to production in days.', img: PERK_IMAGES.team },
              { icon: 'trending-up-outline', title: 'Career Growth', desc: 'Fast-track promotions based on impact. Equity potential for early joiners. Build your career at a rocket ship.', img: PERK_IMAGES.growth },
            ].map((perk, i) => (
              <View key={i} style={styles.perkCard}>
                <Image source={{ uri: perk.img }} style={styles.perkImage} resizeMode="cover" />
                <View style={styles.perkContent}>
                  <View style={styles.perkIconWrap}>
                    <Ionicons name={perk.icon} size={20} color={BRAND} />
                  </View>
                  <Text style={styles.perkTitle}>{perk.title}</Text>
                  <Text style={styles.perkDesc}>{perk.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Life at RefOpen */}
        <View style={styles.lifeSection}>
          <Text style={styles.lifeTitle}>Life at RefOpen</Text>
          <View style={styles.lifeGrid}>
            {[
              { icon: 'laptop-outline', title: 'MacBook Pro', desc: 'Top-tier hardware for everyone' },
              { icon: 'medkit-outline', title: 'Health Insurance', desc: 'Coverage for you and family' },
              { icon: 'calendar-outline', title: 'Flexible Hours', desc: 'We trust you to manage your time' },
              { icon: 'cafe-outline', title: 'Free Snacks', desc: 'Stocked kitchen in office' },
              { icon: 'game-controller-outline', title: 'Fun Culture', desc: 'Game nights, team outings' },
              { icon: 'ribbon-outline', title: 'Recognition', desc: 'Shoutouts and quarterly awards' },
            ].map((item, i) => (
              <View key={i} style={styles.lifeItem}>
                <View style={styles.lifeIconWrap}>
                  <Ionicons name={item.icon} size={20} color={BRAND} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lifeItemTitle}>{item.title}</Text>
                  <Text style={styles.lifeItemDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Blog link */}
        <TouchableOpacity style={styles.blogBanner} onPress={() => navigation.navigate(isPublicStack ? 'BlogPublic' : 'Blog')}>
          <Ionicons name="newspaper-outline" size={22} color={BRAND} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.blogTitle}>Read our Career Blog</Text>
            <Text style={styles.blogSub}>Tips on interviews, resumes, and career growth</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={BRAND} />
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Don't see a role that fits?</Text>
          <Text style={styles.footerSub}>Reach us on our socials</Text>
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
        </View>

        <View style={{ maxWidth: isDesktop ? 900 : '100%', width: '100%', alignSelf: 'center' }}>
          <ComplianceFooter navigation={navigation} currentPage="careers" />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors, responsive = {}) => {
  const { isMobile = true, isDesktop = false } = responsive;
  const mw = isDesktop ? 900 : '100%';
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { alignItems: 'center' },
    loadingC: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingT: { marginTop: 12, color: colors.textSecondary },

    // Custom Header
    customHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
    headerLogo: { height: 32, width: 120 },
    headerLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerLinkT: { fontSize: 13, fontWeight: '600', color: BRAND },
    headerBadge: { backgroundColor: BRAND, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
    headerBadgeT: { fontSize: 10, fontWeight: '700', color: '#fff' },

    // My Applications Modal
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
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

    // Hero — full-width with background image
    hero: { width: '100%', position: 'relative', overflow: 'hidden' },
    heroImage: { width: '100%', height: isMobile ? 300 : 380, position: 'absolute', top: 0, left: 0 },
    heroOverlay: { width: '100%', height: isMobile ? 300 : 380, position: 'absolute', top: 0, left: 0, backgroundColor: 'rgba(79, 70, 229, 0.82)' },
    heroInner: {
      maxWidth: mw, width: '100%', alignSelf: 'center',
      paddingHorizontal: isMobile ? 20 : 32,
      paddingTop: isMobile ? 32 : 56,
      paddingBottom: isMobile ? 40 : 56,
      alignItems: 'center',
      position: 'relative',
      zIndex: 1,
    },
    heroLogoWrap: {
      width: 64, height: 64, borderRadius: 18, backgroundColor: '#fff',
      justifyContent: 'center', alignItems: 'center', marginBottom: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
    },
    heroLogoImg: { width: 42, height: 42, borderRadius: 10 },
    heroTitle: { fontSize: isMobile ? 30 : 40, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
    heroSub: { fontSize: isMobile ? 14 : 17, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: isMobile ? 20 : 26, maxWidth: 520 },
    heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 28, gap: isMobile ? 16 : 36 },
    heroStat: { alignItems: 'center' },
    heroStatN: { fontSize: 24, fontWeight: '700', color: '#fff' },
    heroStatL: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '500' },
    heroDiv: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)' },

    // Filters
    filters: { maxWidth: mw, width: '100%', paddingHorizontal: isMobile ? 16 : 0, marginTop: -20, zIndex: 1 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 16, height: 52, gap: 10, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6 },
    searchInput: { flex: 1, fontSize: 15, color: colors.text, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
    chips: { marginTop: 14, flexGrow: 0 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    chipOn: { backgroundColor: BRAND, borderColor: BRAND },
    chipT: { fontSize: 13, fontWeight: '600', color: colors.text },
    chipTOn: { color: '#fff' },

    results: { maxWidth: mw, width: '100%', paddingHorizontal: isMobile ? 16 : 0, marginTop: 22, marginBottom: 10 },
    resultsT: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },

    // Job cards
    list: { maxWidth: mw, width: '100%', paddingHorizontal: isMobile ? 16 : 0 },
    jobGrid: {
      ...(Platform.OS === 'web' ? {
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14,
      } : { gap: 14 }),
    },
    card: {
      backgroundColor: colors.surface, borderRadius: 14, padding: isMobile ? 18 : 22,
      borderWidth: 1, borderColor: colors.border,
      ...(isMobile ? { marginBottom: 14 } : {}),
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    cardLogo: { width: 44, height: 44, borderRadius: 12, backgroundColor: BRAND + '10' },
    cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 22 },
    cardCo: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    appliedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e12', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#22c55e25' },
    appliedT: { fontSize: 11, fontWeight: '600', color: '#22c55e' },

    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 10 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaT: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    tag: { fontSize: 11, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },

    skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    skill: { fontSize: 11, fontWeight: '500', color: colors.textSecondary, backgroundColor: colors.gray100 || colors.background, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: colors.border },

    preview: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 12 },

    cardFoot: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
    viewDetailBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: BRAND + '10' },
    viewDetailT: { fontSize: 13, color: BRAND, fontWeight: '600' },

    empty: { alignItems: 'center', paddingVertical: 48 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 12 },
    emptySub: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },

    footer: { maxWidth: mw, width: '100%', paddingHorizontal: isMobile ? 16 : 0, marginTop: 32, alignItems: 'center', paddingVertical: 24 },
    footerTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    footerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    socialRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 16 },

    // Why RefOpen — enhanced with images
    whySection: { maxWidth: mw, width: '100%', paddingHorizontal: isMobile ? 16 : 0, marginTop: 40 },
    whyTitle: { fontSize: isMobile ? 24 : 30, fontWeight: '800', color: colors.text, textAlign: 'center', letterSpacing: -0.5 },
    whySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 24 },
    perksGrid: {
      ...(Platform.OS === 'web' && !isMobile ? {
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
      } : { gap: 14 }),
    },
    perkCard: {
      backgroundColor: colors.surface, borderRadius: 14, overflow: 'hidden',
      borderWidth: 1, borderColor: colors.border,
      ...(isMobile ? { marginBottom: 0 } : {}),
    },
    perkImage: { width: '100%', height: isMobile ? 120 : 140 },
    perkContent: { padding: 16 },
    perkIconWrap: {
      width: 36, height: 36, borderRadius: 10, backgroundColor: BRAND + '12',
      justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    },
    perkTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
    perkDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

    // Life at RefOpen
    lifeSection: { maxWidth: mw, width: '100%', paddingHorizontal: isMobile ? 16 : 0, marginTop: 36 },
    lifeTitle: { fontSize: isMobile ? 22 : 26, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 20, letterSpacing: -0.5 },
    lifeGrid: {
      ...(Platform.OS === 'web' && !isMobile ? {
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
      } : { gap: 10 }),
    },
    lifeItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.surface, borderRadius: 12, padding: 16,
      borderWidth: 1, borderColor: colors.border,
    },
    lifeIconWrap: {
      width: 40, height: 40, borderRadius: 10, backgroundColor: BRAND + '12',
      justifyContent: 'center', alignItems: 'center',
    },
    lifeItemTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    lifeItemDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

    // Blog banner
    blogBanner: {
      maxWidth: mw, width: '100%', flexDirection: 'row', alignItems: 'center',
      backgroundColor: BRAND + '08', borderRadius: 14, padding: 18, marginTop: 28,
      borderWidth: 1, borderColor: BRAND + '20',
      ...(isMobile ? { marginHorizontal: 16 } : {}),
    },
    blogTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    blogSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  });
};
