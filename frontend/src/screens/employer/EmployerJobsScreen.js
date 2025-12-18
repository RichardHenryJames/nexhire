import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePricing } from '../../contexts/PricingContext';
import refopenAPI from '../../services/api';
import JobCard from '../../components/jobs/JobCard';
import WalletRechargeModal from '../../components/WalletRechargeModal';
import PublishJobConfirmModal from '../../components/PublishJobConfirmModal';
import { createStyles as createJobStyles } from '../jobs/JobsScreen.styles';
import { showToast } from '../../components/Toast';

/*
EmployerJobsScreen
- Tabs: Draft, Published
- Filters: search text + radio (My Jobs vs All Org Jobs)
- Only for employers; if job seeker opens redirect to Jobs screen.
*/

const TABS = [ 'draft', 'published' ];

export default function EmployerJobsScreen({ navigation, route }) {
  const { user, isJobSeeker } = useAuth();
  const { colors } = useTheme();
  const { pricing } = usePricing(); // 💰 DB-driven pricing
  const jobStyles = useMemo(() => createJobStyles(colors), [colors]);
  const localStyles = useMemo(() => createLocalStyles(colors), [colors]);
  
  const [activeTab, setActiveTab] = useState('draft');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(true);
  const [pagination, setPagination] = useState({ page:1, pageSize:50, total:0, totalPages:1 });
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalData, setWalletModalData] = useState({ currentBalance: 0, requiredAmount: pricing.jobPublishCost });
  
  // 💎 NEW: Publish confirmation modal state
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState(false);
  const [publishConfirmData, setPublishConfirmData] = useState({ currentBalance: 0, requiredAmount: pricing.jobPublishCost, jobId: null, jobTitle: '' });
  
  const abortRef = useRef(null);

  // Redirect job seekers
  useEffect(()=>{ if (isJobSeeker) { navigation.replace('Jobs'); } }, [isJobSeeker]);

  // ? NEW: Listen for navigation params to switch tabs and update lists after publishing
  useEffect(() => {
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
    if (!user || isJobSeeker) return;
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
        postedByUserId: onlyMine ? (user.userId || user.id || user.sub || user.UserID) : undefined
      };
      
      
      const res = await refopenAPI.getOrganizationJobs(params, { signal: controller.signal });
      
      
      if (res?.success) {
        setJobs(res.data || []);
        setPagination(p => ({ ...p, page: res.meta?.page || page, total: res.meta?.total || res.data.length, totalPages: res.meta?.totalPages || 1 }));
      } else {
        showToast(res?.error || 'Failed to load jobs', 'error');
      }
    } catch(e){ if (e.name !== 'AbortError') console.error('Employer jobs load error', e); }
    finally { if (!controller.signal.aborted) { setLoading(false); setRefreshing(false);} }
  }, [user, isJobSeeker, activeTab, search, onlyMine, pagination.pageSize]);

  useEffect(()=>{ load(1); }, [activeTab, onlyMine]);

  const onRefresh = useCallback(()=>{ setRefreshing(true); load(1); }, [load]);

  const onSearchSubmit = () => load(1);

  const initiatePublishJob = async (jobId, jobTitle) => {
    const PUBLISH_JOB_FEE = 50;

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
          jobTitle: jobTitle || 'this job'
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
    const { jobId, currentBalance, requiredAmount } = publishConfirmData;

    // Double check balance (though modal handles UI, logic safety)
    if (currentBalance < requiredAmount) {
      setWalletModalData({ currentBalance, requiredAmount });
      setShowWalletModal(true);
      return;
    }

    try {
      const res = await refopenAPI.publishJob(jobId);
      if (res?.success) { 
        showToast('Job published successfully', 'success');
        
        // Remove published job from current list immediately
        setJobs(prevJobs => prevJobs.filter(j => j.JobID !== jobId));
        
        // Reload BOTH tabs to ensure data is fresh
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

  const renderJob = (job) => {
    const isDraft = job.Status === 'Draft';
    
    // ? CRITICAL FIX: Client-side filtering as safety net
    // Only show Draft jobs in Draft tab, Published jobs in Published tab
    const shouldShow = (activeTab === 'draft' && isDraft) || (activeTab === 'published' && !isDraft);
    
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
          // ? NEW: Pass publish props to JobCard
          showPublish={isDraft}
          onPublish={isDraft ? () => initiatePublishJob(job.JobID, job.Title) : null}
        />
      </View>
    );
  };

  return (
    <View style={jobStyles.container}>
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
        {/* Toggle mine/all org */}
        <TouchableOpacity style={localStyles.toggleScope} onPress={()=> setOnlyMine(m => !m)}>
          <Ionicons name={onlyMine? 'person' : 'people-outline'} size={20} color={onlyMine? '#0066cc':'#666'} />
          <Text style={[localStyles.toggleText, onlyMine && { color:'#0066cc', fontWeight:'600' }]}>
            {onlyMine? 'My Jobs' : 'All Org'}
          </Text>
        </TouchableOpacity>
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
                ? onlyMine 
                  ? "You haven't created any draft jobs yet. Start by creating a new job posting!"
                  : "Your organization has no draft jobs at the moment."
                : onlyMine
                  ? "You haven't published any jobs yet. Publish your draft jobs to start receiving applications!"
                  : "Your organization has no published jobs at the moment."
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

      <PublishJobConfirmModal
        visible={showPublishConfirmModal}
        currentBalance={publishConfirmData.currentBalance}
        requiredAmount={publishConfirmData.requiredAmount}
        jobTitle={publishConfirmData.jobTitle}
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

const createLocalStyles = (colors) => ({
  toggleScope:{
    marginLeft:8,
    backgroundColor:colors.surface,
    flexDirection:'row',
    alignItems:'center',
    paddingHorizontal:12,
    borderRadius:8,
    borderWidth:1,
    borderColor:colors.border
  },
  toggleText:{
    marginLeft:6,
    color:colors.textSecondary
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
  }
});
