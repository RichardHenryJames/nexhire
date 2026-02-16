import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, Platform, Linking, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePricing } from '../../contexts/PricingContext';
import refopenAPI from '../../services/api';
import JobCard from '../../components/jobs/JobCard';
import WalletRechargeModal from '../../components/WalletRechargeModal';
import ConfirmPurchaseModal from '../../components/ConfirmPurchaseModal';
import { createStyles as createJobStyles } from '../jobs/JobsScreen.styles';
import { showToast } from '../../components/Toast';
import useResponsive from '../../hooks/useResponsive';

/*
EmployerJobsScreen
- Tabs: Draft, Published
- Filters: search text
- Shows jobs posted by the current user (employers and verified referrers)
*/

const TABS = [ 'draft', 'published' ];

export default function EmployerJobsScreen({ navigation, route }) {
  const { user, isVerifiedReferrer, loading: authLoading } = useAuth();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const { pricing } = usePricing(); // 💰 DB-driven pricing
  const jobStyles = useMemo(() => createJobStyles(colors, responsive), [colors, responsive]);
  const localStyles = useMemo(() => createLocalStyles(colors, responsive), [colors, responsive]);
  
  // Get user type
  const userType = user?.type;
  
  // Initialize activeTab from route params if provided, otherwise default to 'draft'
  const [activeTab, setActiveTab] = useState(() => {
    const initialTab = route.params?.initialTab;
    return initialTab && TABS.includes(initialTab) ? initialTab : 'draft';
  });
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page:1, pageSize:50, total:0, totalPages:1 });
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalData, setWalletModalData] = useState({ currentBalance: 0, requiredAmount: pricing.jobPublishCost });
  
  // 💎 NEW: Publish confirmation modal state
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState(false);
  const [publishConfirmData, setPublishConfirmData] = useState({ currentBalance: 0, requiredAmount: pricing.jobPublishCost, jobId: null, jobTitle: '' });
  
  const abortRef = useRef(null);

  // ✅ Smart back navigation - handle hard refresh scenario
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity 
          style={{ paddingLeft: 16 }} 
          onPress={() => {
            const navState = navigation.getState();
            const routes = navState?.routes || [];
            const currentIndex = navState?.index || 0;
            
            // If we have more than 1 route in the stack, go back normally
            if (routes.length > 1 && currentIndex > 0) {
              navigation.goBack();
            } else {
              // Hard refresh scenario - navigate to Referrals tab
              navigation.navigate('Main', {
                screen: 'MainTabs',
                params: {
                  screen: 'Referrals'
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

  // Access control: Only employers and verified referrers can access this screen
  // Job seekers who are not verified should be redirected away
  // Wait for auth loading to complete before checking access
  useEffect(() => {
    if (authLoading) return; // Don't check until auth is loaded
    
    const isEmployer = userType === 'Employer';
    const canAccess = isEmployer || isVerifiedReferrer;
    
    if (!canAccess) {
      // Redirect non-verified job seekers to Home
      showToast('You need to be a verified referrer to access this page', 'error');
      navigation.replace('Main', {
        screen: 'MainTabs',
        params: { screen: 'Home' }
      });
    }
  }, [userType, isVerifiedReferrer, authLoading, navigation]);

  // ? NEW: Listen for navigation params to switch tabs and update lists after publishing
  useEffect(() => {
    // Handle initialTab param (from Publish button on ReferralScreen)
    if (route.params?.initialTab && TABS.includes(route.params.initialTab)) {
      const newTab = route.params.initialTab;
      setActiveTab(newTab);
      navigation.setParams({ initialTab: undefined });
      // Note: The useEffect on activeTab will trigger load() automatically
    }
    
    if (route.params?.switchToTab) {
      const publishedJobId = route.params.publishedJobId;
      
      // Proactively remove the job from the draft list
      if (publishedJobId) {
        setJobs(prevJobs => prevJobs.filter(j => j.JobID !== publishedJobId));
      }
      
      // Switch to the published tab
      setActiveTab(route.params.switchToTab);
      
      // Show success message if provided
      if (route.params?.successMessage) {
        showToast(route.params.successMessage, 'success');
      }
      
      // Clear the params after processing
      navigation.setParams({ 
        switchToTab: undefined, 
        publishedJobId: undefined,
        successMessage: undefined 
      });
    }
  }, [route.params]);

  const load = useCallback(async (page=1)=>{
    if (!user) return;
    if (abortRef.current) { try { abortRef.current.abort(); } catch {} }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(page===1);
    try {
      // Build params with status filter based on active tab
      const params = {
        page,
        pageSize: pagination.pageSize,
        status: activeTab === 'draft' ? 'Draft' : 'Published',
        search: search.trim() || undefined,
      };
      
      // Use getMyPostedJobs - works for both employers and referrers
      const res = await refopenAPI.getMyPostedJobs(params);
      
      
      if (res?.success) {
        setJobs(res.data || []);
        setPagination(p => ({ ...p, page: res.meta?.page || page, total: res.meta?.total || res.data.length, totalPages: res.meta?.totalPages || 1 }));
      } else {
        showToast(res?.error || 'Failed to load jobs', 'error');
      }
    } catch(e){ if (e.name !== 'AbortError') console.error('Employer jobs load error', e); }
    finally { if (!controller.signal.aborted) { setLoading(false); setRefreshing(false);} }
  }, [user, activeTab, search, pagination.pageSize]);

  useEffect(()=>{ load(1); }, [activeTab]);

  const onRefresh = useCallback(()=>{ setRefreshing(true); load(1); }, [load]);

  const onSearchSubmit = () => load(1);

  // ✅ NEW: Delete job handler
  const handleDeleteJob = async (jobId) => {
    try {
      const res = await refopenAPI.deleteJob(jobId);
      if (res?.success) {
        showToast('Job deleted successfully', 'success');
        // Remove from list
        setJobs(prevJobs => prevJobs.filter(j => j.JobID !== jobId));
      } else {
        showToast(res?.error || 'Failed to delete job', 'error');
      }
    } catch (e) {
      console.error('Delete job error:', e);
      showToast(e?.message || 'Failed to delete job', 'error');
    }
  };

  const initiatePublishJob = async (jobId, jobTitle, postedByReferrer = false) => {
    const PUBLISH_JOB_FEE = pricing.jobPublishCost; // Dynamic from DB (default: ₹0 — free)

    try {
      // Check wallet balance
      const walletBalance = await refopenAPI.getWalletBalance();
      
      if (walletBalance?.success) {
        const balance = walletBalance.data?.balance || 0;
        
        // Show confirmation modal (works for both sufficient and insufficient balance)
        setPublishConfirmData({ 
          currentBalance: balance, 
          requiredAmount: PUBLISH_JOB_FEE,
          jobId: jobId,
          jobTitle: jobTitle || 'this job',
          postedByReferrer: postedByReferrer
        });
        setShowPublishConfirmModal(true);
      } else {
        console.error('Failed to check wallet balance:', walletBalance?.error);
        showToast('Unable to check wallet balance', 'error');
      }
    } catch (e) {
      console.error('Failed to check wallet balance:', e);
      showToast('Unable to check wallet balance', 'error');
    }
  };

  const handlePublishConfirmProceed = async () => {
    setShowPublishConfirmModal(false);
    const { jobId, currentBalance, requiredAmount, postedByReferrer } = publishConfirmData;

    // Referrer-posted jobs are FREE - skip wallet check
    // Only check balance for employer-posted jobs
    if (!postedByReferrer && currentBalance < requiredAmount) {
      setWalletModalData({ currentBalance, requiredAmount });
      setShowWalletModal(true);
      return;
    }

    try {
      const res = await refopenAPI.publishJob(jobId);
      if (res?.success) { 
        showToast('Job published! Use Copy Link to share.', 'success');
        
        // Remove published job from draft list immediately
        setJobs(prevJobs => prevJobs.filter(j => j.JobID !== jobId));
        
        // Reload and switch to Published tab
        setActiveTab('published');
        await load(1);
        return;
      }

      const message = res?.error || res?.message || 'Publish failed';
      showToast(message, 'error');
    } catch(e) { 
      console.error('Publish error:', e);
      showToast(e?.message || 'Publish failed', 'error');
    }
  };

  const openJob = (job) => navigation.navigate('JobDetails', { jobId: job.JobID });

  // ✅ Share message builder
  const buildShareMessage = (job) => {
    const jobUrl = `https://www.refopen.com/job/${job.JobID}`;
    return `I'm referring for the "${job.Title}" role at ${job.OrganizationName || 'my company'}. Please find the link below and submit your referral request:\n\n${jobUrl}`;
  };

  // ✅ WhatsApp share
  const handleShareWhatsApp = (job) => {
    const message = buildShareMessage(job);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    Linking.openURL(whatsappUrl).catch(() => {
      showToast('Could not open WhatsApp', 'error');
    });
  };

  // ✅ LinkedIn share
  const handleShareLinkedIn = (job) => {
    const jobUrl = `https://www.refopen.com/job/${job.JobID}`;
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`;
    Linking.openURL(linkedInUrl).catch(() => {
      showToast('Could not open LinkedIn', 'error');
    });
  };

  // ✅ Native share (copy link + system share sheet)
  const handleNativeShare = async (job) => {
    const message = buildShareMessage(job);
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: job.Title, text: message });
        } else {
          await navigator.clipboard.writeText(message);
          showToast('Job link copied!', 'success');
        }
      } else {
        await Share.share({ message });
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    }
  };

  const renderJob = (job) => {
    const isDraft = job.Status === 'Draft';
    const isPublished = !isDraft;
    const isReferrerPosted = job.PostedByType === 2;
    
    // ? CRITICAL FIX: Client-side filtering as safety net
    // Only show Draft jobs in Draft tab, Published jobs in Published tab
    const shouldShow = (activeTab === 'draft' && isDraft) || (activeTab === 'published' && isPublished);
    
    if (!shouldShow) {
      return null;
    }
    
    return (
      <View key={job.JobID} style={{ marginBottom:12 }}>
        <JobCard
          job={job}
          onPress={() => openJob(job)}
          hideApply // hide seeker actions
          hideReferral
          hideSave
          // ✅ Pass delete props to JobCard (only for drafts)
          showDelete={isDraft}
          onDelete={isDraft ? () => handleDeleteJob(job.JobID) : null}
          // ✅ Pass publish props to JobCard (only for drafts)
          showPublish={isDraft}
          onPublish={isDraft ? () => initiatePublishJob(job.JobID, job.Title, job.PostedByType === 2) : null}
          // ✅ Pass share props to JobCard (for all published jobs)
          showShare={isPublished}
          onShareWhatsApp={isPublished ? () => handleShareWhatsApp(job) : null}
          onShareLinkedIn={isPublished ? () => handleShareLinkedIn(job) : null}
          onShare={isPublished ? () => handleNativeShare(job) : null}
        />
      </View>
    );
  };

  return (
    <View style={localStyles.container}>
      <View style={localStyles.innerContainer}>
      {/* Search + Filter Bar */}
      <View style={jobStyles.searchHeader}>
        <View style={jobStyles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={{ marginRight:8 }} />
          <TextInput
            style={jobStyles.searchInput}
            placeholder="Search my jobs"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={onSearchSubmit}
            placeholderTextColor="#999"
          />
          {search.length>0 && (
            <TouchableOpacity onPress={()=>{ setSearch(''); load(1); }} style={jobStyles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection:'row', backgroundColor:colors.surface, borderBottomWidth:1, borderBottomColor:colors.border }}>
        {TABS.map(t => {
          const active = (activeTab === t);
          const label = t === 'draft' ? 'Draft' : 'Published';
          return (
            <TouchableOpacity key={t} onPress={()=> setActiveTab(t)} style={{ flex:1, paddingVertical:12, alignItems:'center', borderBottomWidth:2, borderBottomColor: active? colors.primary:'transparent' }}>
              <Text style={{ color: active? colors.primary:colors.textSecondary, fontWeight: active? '700':'600' }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={jobStyles.jobList} contentContainerStyle={{ paddingBottom: 100 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading && jobs.length===0 ? (
          <View style={jobStyles.loadingContainer}><Text style={jobStyles.loadingText}>Loading...</Text></View>
        ) : jobs.length===0 ? (
          <View style={jobStyles.emptyContainer}>
            <Ionicons 
              name={activeTab === 'draft' ? 'document-text-outline' : 'briefcase-outline'} 
              size={80} 
              color="#d1d5db" 
              style={{ marginBottom: 20 }}
            />
            <Text style={jobStyles.emptyTitle}>
              {activeTab === 'draft' ? 'No Draft Jobs' : 'No Published Jobs'}
            </Text>
            <Text style={jobStyles.emptyMessage}>
              {activeTab === 'draft' 
                ? "You haven't created any draft jobs yet. Start by creating a new job posting!"
                : "You haven't published any jobs yet. Publish your draft jobs to start receiving applications!"
              }
            </Text>
            {activeTab === 'draft' && (
              <TouchableOpacity 
                style={localStyles.createJobButton}
                onPress={() => navigation.navigate('CreateJob')}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={localStyles.createJobButtonText}>Create New Job</Text>
              </TouchableOpacity>
            )}
            {activeTab === 'published' && jobs.length === 0 && (
              <TouchableOpacity 
                style={localStyles.viewDraftsButton}
                onPress={() => setActiveTab('draft')}
              >
                <Ionicons name="document-text" size={20} color="#0066cc" />
                <Text style={localStyles.viewDraftsButtonText}>View Draft Jobs</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // ? FIXED: Filter out null values from renderJob (when job doesn't match active tab)
          jobs.map(renderJob).filter(Boolean)
        )}
      </ScrollView>
      </View>

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

      <ConfirmPurchaseModal
        visible={showPublishConfirmModal}
        currentBalance={publishConfirmData.currentBalance}
        requiredAmount={publishConfirmData.requiredAmount}
        contextType="publish-job"
        itemName={publishConfirmData.jobTitle}
        isFree={publishConfirmData.postedByReferrer}
        onProceed={handlePublishConfirmProceed}
        onCancel={() => setShowPublishConfirmModal(false)}
        onAddMoney={() => {
          setShowPublishConfirmModal(false);
          setWalletModalData({ 
            currentBalance: publishConfirmData.currentBalance, 
            requiredAmount: publishConfirmData.requiredAmount 
          });
          setShowWalletModal(true);
        }}
      />
    </View>
  );
}

const createLocalStyles = (colors, responsive = {}) => {
  const { isDesktop = false } = responsive;
  const MAX_CONTENT_WIDTH = 1200;
  
  return {
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: isDesktop ? 'center' : 'stretch',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: isDesktop ? MAX_CONTENT_WIDTH : '100%',
  },
  actionBtn:{
    flexDirection:'row',
    alignItems:'center',
    backgroundColor:'#0066cc',
    paddingHorizontal:14,
    paddingVertical:10,
    borderRadius:8,
    gap:6
  },
  actionText:{
    color:'#fff',
    fontSize:14,
    fontWeight:'600'
  },
  createJobButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0066cc',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createJobButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  viewDraftsButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  viewDraftsButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
};
};
