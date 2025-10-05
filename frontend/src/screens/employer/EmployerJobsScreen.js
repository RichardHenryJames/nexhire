import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import nexhireAPI from '../../services/api';
import JobCard from '../../components/jobs/JobCard';
import { styles as jobStyles } from '../jobs/JobsScreen.styles';
import { showToast } from '../../components/Toast';

/*
EmployerJobsScreen
- Tabs: Draft, Published
- Filters: search text + radio (My Jobs vs All Org Jobs)
- Only for employers; if job seeker opens redirect to Jobs screen.
*/

const TABS = [ 'draft', 'published' ];

export default function EmployerJobsScreen({ navigation }) {
  const { user, isJobSeeker } = useAuth();
  const [activeTab, setActiveTab] = useState('draft');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(true);
  const [pagination, setPagination] = useState({ page:1, pageSize:50, total:0, totalPages:1 });
  const abortRef = useRef(null);

  // Redirect job seekers
  useEffect(()=>{ if (isJobSeeker) { navigation.replace('Jobs'); } }, [isJobSeeker]);

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
      
      // ?? DEBUG: Log the params being sent
      console.log('?? EmployerJobsScreen loading jobs with params:', {
        activeTab,
        status: params.status,
        page: params.page,
        onlyMine,
        postedByUserId: params.postedByUserId,
        search: params.search
      });
      
      const res = await nexhireAPI.getOrganizationJobs(params, { signal: controller.signal });
      
      // ?? DEBUG: Log the response
      console.log('?? API response:', {
        success: res?.success,
        jobsCount: res?.data?.length,
        firstJobStatus: res?.data?.[0]?.Status,
        allStatuses: res?.data?.map(j => j.Status)
      });
      
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

  const publishJob = async (jobId) => {
    try {
      console.log('?? Publishing job:', jobId);
      const res = await nexhireAPI.publishJob(jobId);
      if (res?.success) { 
        showToast('Job published', 'success');
        
        // ? CRITICAL FIX: Remove published job from current list immediately
        setJobs(prevJobs => prevJobs.filter(j => j.JobID !== jobId));
        
        // ? CRITICAL FIX: Reload BOTH tabs to ensure data is fresh
        console.log('?? Reloading jobs after publish...');
        await load(1);
        
        // ? OPTIONAL: Auto-switch to Published tab to show the newly published job
        // setTimeout(() => setActiveTab('published'), 500);
      }
      else Alert.alert('Error', res.error || 'Publish failed');
    } catch(e) { 
      console.error('? Publish error:', e);
      Alert.alert('Error', e.message || 'Publish failed'); 
    }
  };

  const openJob = (job) => navigation.navigate('JobDetails', { jobId: job.JobID });

  const renderJob = (job) => {
    const isDraft = job.Status === 'Draft';
    
    // ? CRITICAL FIX: Client-side filtering as safety net
    // Only show Draft jobs in Draft tab, Published jobs in Published tab
    const shouldShow = (activeTab === 'draft' && isDraft) || (activeTab === 'published' && !isDraft);
    
    if (!shouldShow) {
      console.log(`?? Filtering out job "${job.Title}" (Status: ${job.Status}) from ${activeTab} tab`);
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
          onPublish={isDraft ? () => publishJob(job.JobID) : null}
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
      <View style={{ flexDirection:'row', backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#e9ecef' }}>
        {TABS.map(t => {
          const active = (activeTab === t);
          const label = t === 'draft' ? 'Draft' : 'Published';
          return (
            <TouchableOpacity key={t} onPress={()=> setActiveTab(t)} style={{ flex:1, paddingVertical:12, alignItems:'center', borderBottomWidth:2, borderBottomColor: active? '#0066cc':'transparent' }}>
              <Text style={{ color: active? '#0066cc':'#555', fontWeight: active? '700':'600' }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={jobStyles.jobList} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>        
        {loading && jobs.length===0 ? (
          <View style={jobStyles.loadingContainer}><Text style={jobStyles.loadingText}>Loading...</Text></View>
        ) : jobs.length===0 ? (
          <View style={jobStyles.emptyContainer}>
            <Text style={jobStyles.emptyTitle}>No jobs</Text>
            <Text style={jobStyles.emptyMessage}>No {activeTab} jobs found.</Text>
          </View>
        ) : (
          // ? FIXED: Filter out null values from renderJob (when job doesn't match active tab)
          jobs.map(renderJob).filter(Boolean)
        )}
      </ScrollView>
    </View>
  );
}

const localStyles = {
  toggleScope:{
    marginLeft:8,
    backgroundColor:'#fff',
    flexDirection:'row',
    alignItems:'center',
    paddingHorizontal:12,
    borderRadius:8,
    borderWidth:1,
    borderColor:'#e1e5e9'
  },
  toggleText:{
    marginLeft:6,
    color:'#555'
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
  }
};
