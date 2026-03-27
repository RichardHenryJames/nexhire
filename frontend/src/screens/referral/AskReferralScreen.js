import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePricing } from '../../contexts/PricingContext';
import useResponsive from '../../hooks/useResponsive';
import refopenAPI from '../../services/api';
import { typography } from '../../styles/theme';
import { showToast } from '../../components/Toast';
import { invalidateCache, CACHE_KEYS } from '../../utils/homeCache';
import WalletRechargeModal from '../../components/WalletRechargeModal';
import ResumeUploadModal from '../../components/ResumeUploadModal';
import ReferralSuccessOverlay from '../../components/ReferralSuccessOverlay';
import ConfirmPurchaseModal from '../../components/ConfirmPurchaseModal';
import TabHeader from '../../components/TabHeader';
import CachedImage from '../../components/CachedImage';
import AnimatedFormStep from '../../components/auth/AnimatedFormStep';

const useDebounce = (v, d = 300) => { const [db, s] = useState(v); useEffect(() => { const h = setTimeout(() => s(v), d); return () => clearTimeout(h); }, [v, d]); return db; };

export default function AskReferralScreen({ navigation, route }) {
  const { user, isJobSeeker, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const { pricing } = usePricing();
  const responsive = useResponsive();
  const isDesktop = Platform.OS === 'web' && responsive.isDesktop;
  const s = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const requireAuth = (a) => { if (!isAuthenticated || !user) { navigation.navigate('Auth', { screen: 'Login', params: { returnTo: 'AskReferral', returnParams: route?.params } }); return false; } return true; };

  // ── States ───────────────────────────────────────────────────
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [companies, setCompanies] = useState([]);
  const [openToAny, setOpenToAny] = useState(true);

  // Company
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanyDD, setShowCompanyDD] = useState(false);
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const debouncedCS = useDebounce(companySearch, 300);
  const preSelectedOrg = route?.params?.preSelectedOrganization;

  // Form
  const [jobTitle, setJobTitle] = useState('');
  const [jobId, setJobId] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [referralMessage, setReferralMessage] = useState('');
  const [minSalary, setMinSalary] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('INR');
  const [salaryPeriod, setSalaryPeriod] = useState('Annual');
  const [preferredLocations, setPreferredLocations] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [errors, setErrors] = useState({});

  // Modals
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletModalData, setWalletModalData] = useState({ currentBalance: 0, requiredAmount: 0 });
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [referralCompanyName, setReferralCompanyName] = useState('');
  const [referralBroadcastTime, setReferralBroadcastTime] = useState(null);

  // Progressive reveal
  const [step, setStep] = useState(0);
  const advance = useCallback((n) => setStep(p => n > p ? n : p), []);

  // Social proof
  const [fortune500, setFortune500] = useState([]);
  const [tickerIdx, setTickerIdx] = useState(0);
  const tickerFade = useRef(new Animated.Value(1)).current;

  // Scroll-based sticky mode pill
  const [showStickyMode, setShowStickyMode] = useState(false);
  const stickyAnim = useRef(new Animated.Value(0)).current;
  const tickerVisibility = useRef(new Animated.Value(1)).current;
  const segmentY = useRef(0);

  const handleScroll = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    const shouldStick = y > segmentY.current + 50;
    if (shouldStick !== showStickyMode) {
      setShowStickyMode(shouldStick);
      Animated.parallel([
        Animated.spring(stickyAnim, { toValue: shouldStick ? 1 : 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(tickerVisibility, { toValue: shouldStick ? 0 : 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [showStickyMode]);

  const dailyRefCount = useMemo(() => {
    const d = new Date(); const seed = d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
    const hash = Math.abs(Math.floor(Math.sin(seed*2)*10000));
    const hr = d.getHours(), min = d.getMinutes();
    const R = [.3,.2,.2,.1,.1,.2,.5,1.2,2,3,3.8,4.2,4.5,4.3,4,3.5,3,2.5,2,1.5,1,.7,.5,.4];
    const C = R.reduce((a,v) => { a.push((a.length?a[a.length-1]:0)+v); return a; }, []);
    return Math.max(5, Math.round((150+(hash%200)) * (((hr>0?C[hr-1]:0)+R[hr]*(min/60))/C[C.length-1])));
  }, []);

  const [referrersOnline, setReferrersOnline] = useState(() => {
    const d = new Date(); const seed = d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
    const hash = Math.abs(Math.floor(Math.sin(seed*6)*10000));
    const hr = d.getHours(), min = d.getMinutes();
    const TOD = [.08,.06,.05,.04,.04,.06,.12,.25,.45,.65,.82,.95,1,.98,.95,.88,.78,.65,.5,.38,.28,.2,.14,.1];
    const tm = TOD[hr]+(TOD[(hr+1)%24]-TOD[hr])*(min/60);
    return Math.max(1000,Math.round(3000+(hash%5000)+13000*tm+((Math.abs(Math.floor(Math.sin((seed+Math.floor((hr*60+min)/2))*11)*100))%201)-100)));
  });

  // Ticker
  useEffect(() => {
    const f = companies.filter(o => (o.isFortune500===1||o.isFortune500===true||o.isFortune500==='1') && o.logoURL);
    if (!f.length) return;
    if (!fortune500.length) setFortune500([...f].sort(() => Math.random()-.5));
    const iv = setInterval(() => {
      Animated.timing(tickerFade, {toValue:0,duration:400,useNativeDriver:true}).start(() => {
        setTickerIdx(p => (p+1)%(fortune500.length||1));
        Animated.timing(tickerFade, {toValue:1,duration:400,useNativeDriver:true}).start();
      });
    }, 4000);
    return () => clearInterval(iv);
  }, [companies, fortune500]);

  useEffect(() => { const iv = setInterval(() => {
    const d = new Date(); const seed = d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
    const hash = Math.abs(Math.floor(Math.sin(seed*6)*10000));
    const hr = d.getHours(), min = d.getMinutes();
    const TOD = [.08,.06,.05,.04,.04,.06,.12,.25,.45,.65,.82,.95,1,.98,.95,.88,.78,.65,.5,.38,.28,.2,.14,.1];
    const tm = TOD[hr]+(TOD[(hr+1)%24]-TOD[hr])*(min/60);
    setReferrersOnline(Math.max(1000,Math.round(3000+(hash%5000)+13000*tm+((Math.abs(Math.floor(Math.sin((seed+Math.floor((hr*60+min)/2))*11)*100))%201)-100))));
  }, 120000); return () => clearInterval(iv); }, []);

  // Pricing
  const effectiveCost = useMemo(() => {
    if (openToAny) return pricing.openToAnyReferralCost;
    const t = selectedCompany?.tier||'Standard';
    if (t==='Elite') return pricing.eliteReferralCost||199;
    if (t==='Premium') return pricing.premiumReferralCost||99;
    return pricing.referralRequestCost;
  }, [openToAny, selectedCompany, pricing]);

  // Progressive reveal triggers
  useEffect(() => { advance(1); }, []); // show first field immediately
  useEffect(() => {
    if (openToAny && jobTitle.trim().length >= 2) advance(2);
    if (!openToAny && selectedCompany) advance(2);
  }, [openToAny, jobTitle, selectedCompany]);
  useEffect(() => {
    if (!openToAny && selectedCompany && jobTitle.trim().length >= 2) advance(3);
  }, [openToAny, selectedCompany, jobTitle]);

  // Effects
  useEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);
  useEffect(() => {
    if (isAuthenticated && user) { loadWalletBalance(); loadResumes(); } else setLoadingWallet(false);
    loadCompanies();
    if (preSelectedOrg) { setSelectedCompany(preSelectedOrg); setOpenToAny(false); }
  }, [preSelectedOrg]);

  const loadResumes = async (forceSelectId) => { setLoadingResumes(true); try { const r = await refopenAPI.getUserResumes(); if (r?.success&&r.data) { const sorted=[...r.data].sort((a,b)=>{if(a.IsPrimary&&!b.IsPrimary)return-1;if(!a.IsPrimary&&b.IsPrimary)return 1;return new Date(b.UploadedAt||0)-new Date(a.UploadedAt||0);}); setResumes(sorted); if(forceSelectId) setSelectedResumeId(forceSelectId); else if(!selectedResumeId&&sorted[0]?.ResumeID) setSelectedResumeId(sorted[0].ResumeID); }}catch(e){}finally{setLoadingResumes(false);}};
  const loadWalletBalance = async () => { setLoadingWallet(true); try { const r = await refopenAPI.getWalletBalance(); if(r?.success) setWalletBalance(r.data?.availableBalance??r.data?.balance??0); }catch(e){}finally{setLoadingWallet(false);}};
  const loadCompanies = async () => { try { const r = await refopenAPI.getOrganizations(''); if(r?.success&&Array.isArray(r.data)) setCompanies(r.data); }catch(e){} };

  // Company search
  useEffect(() => {
    if (!showCompanyDD) return;
    (async () => { setOrgLoading(true); try {
      const r = await refopenAPI.getOrganizations(debouncedCS||'',null);
      const raw = r?.success&&Array.isArray(r.data)?r.data:[];
      if (debouncedCS?.trim()) { const q=debouncedCS.toLowerCase(); const m=raw.filter(o=>o.name?.toLowerCase().includes(q)); m.sort((a,b)=>(a.name?.toLowerCase().startsWith(q)?0:1)-(b.name?.toLowerCase().startsWith(q)?0:1)); setOrgResults(m); }
      else setOrgResults(raw);
    }catch(e){setOrgResults([]);}finally{setOrgLoading(false);}})();
  }, [debouncedCS, showCompanyDD]);

  // Handlers
  const handleSelectCompany = (org) => { setSelectedCompany(org); setCompanySearch(''); setShowCompanyDD(false); if(errors.company) setErrors(p=>({...p,company:null})); advance(2); };
  const handleResumeSelected = async (d) => { setSelectedResumeId(d.ResumeID); await loadResumes(d.ResumeID); setShowResumeModal(false); if(errors.resume) setErrors(p=>({...p,resume:null})); showToast('Resume selected','success'); };
  const switchMode = (isOpen) => { setOpenToAny(isOpen); if(isOpen){setSelectedCompany(null);setJobId('');setErrors({});} setStep(1); };

  const validateForm = () => { const e={}; if(!openToAny&&!selectedCompany) e.company='Select a company'; if(!jobTitle.trim()) e.jobTitle='Required'; if(!openToAny&&!jobId.trim()) e.jobId='Required'; if(!selectedResumeId) e.resume='Select a resume'; setErrors(e); return Object.keys(e).length===0; };
  const handleAskReferral = () => { if(!requireAuth('ask referral')) return; if(!validateForm()) return; setShowConfirmModal(true); };

  const handleSubmit = async () => {
    const t0=Date.now(); setSubmitting(true);
    try {
      const rd = { jobID:null, extJobID:openToAny?undefined:jobId, resumeID:selectedResumeId, jobTitle:jobTitle.trim(), companyName:selectedCompany?.name||undefined, organizationId:selectedCompany?.id?.toString()||undefined, referralMessage:referralMessage||undefined, openToAnyCompany:openToAny||undefined, ...(!openToAny&&jobUrl?.trim()?{jobUrl:jobUrl.trim()}:{}), ...(openToAny&&minSalary?{minSalary:parseFloat(minSalary),salaryCurrency,salaryPeriod}:{}), ...(openToAny&&preferredLocations?.trim()?{preferredLocations:preferredLocations.trim()}:{}) };
      const result = await refopenAPI.createReferralRequest(rd);
      if (result?.success) {
        setReferralCompanyName(openToAny?'All Companies':(selectedCompany?.name||'')); setReferralBroadcastTime((Date.now()-t0)/1000); setShowSuccessOverlay(true);
        invalidateCache(CACHE_KEYS.REFERRER_REQUESTS,CACHE_KEYS.WALLET_BALANCE,CACHE_KEYS.DASHBOARD_STATS);
        if(result.data?.availableBalanceAfter!==undefined) setWalletBalance(result.data.availableBalanceAfter);
        setJobTitle('');setJobId('');setJobUrl('');setReferralMessage('');setSelectedCompany(null);setOpenToAny(true);setMinSalary('');setPreferredLocations('');setErrors({});setStep(1);
      } else if (result.errorCode==='INSUFFICIENT_WALLET_BALANCE') {
        setWalletModalData({currentBalance:result.data?.currentBalance||0,requiredAmount:result.data?.requiredAmount||effectiveCost}); setShowWalletModal(true);
      } else showToast(result?.error||'Failed','error');
    }catch(e){showToast(e?.message||'Error','error');}finally{setSubmitting(false);}
  };

  const selectedResume = resumes.find(r=>r.ResumeID===selectedResumeId);
  const tickerCompany = fortune500[tickerIdx];

  if (isAuthenticated && !isJobSeeker) return (<View style={s.gate}><Ionicons name="lock-closed" size={64} color={colors.gray400} /><Text style={s.gateTitle}>Access Restricted</Text><Text style={s.gateSub}>Only job seekers can request referrals.</Text></View>);

  // ── Summary panel (desktop sidebar / mobile bottom) ──────────
  const summaryJSX = (
    <View style={s.summary}>
      {/* Social proof ticker (top of sidebar — hidden when sticky pill visible) */}
      {tickerCompany && !showStickyMode && (
        <Animated.View style={[s.sideProof, { opacity: tickerFade, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 16 }]}>
          <View style={s.proofDot} />
          <Text style={s.proofOnline}>{referrersOnline.toLocaleString('en-IN')}</Text>
          <Text style={s.proofLabel}>online</Text>
          <Text style={s.proofSep}>·</Text>
          <Text style={s.proofCount}>{dailyRefCount}</Text>
          <Text style={s.proofLabel}>today</Text>
          <Text style={s.proofSep}>·</Text>
          <CachedImage source={{ uri: tickerCompany.logoURL }} style={s.tickerLogo} resizeMode="contain" />
          <Text style={s.tickerCompany} numberOfLines={1}>{tickerCompany.name}</Text>
        </Animated.View>
      )}

      {/* Mode highlight badge */}
      <View style={[s.modeBadge, openToAny ? { backgroundColor: '#8B5CF6' + '12', borderColor: '#8B5CF6' + '30' } : { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
        <View style={[s.modeBadgeIcon, { backgroundColor: openToAny ? '#8B5CF6' + '20' : colors.primary + '20' }]}>
          <Ionicons name={openToAny ? 'globe-outline' : 'business-outline'} size={20} color={openToAny ? '#8B5CF6' : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.modeBadgeTitle, { color: openToAny ? '#8B5CF6' : colors.primary }]}>
            {openToAny ? 'Open Referral' : 'Specific Company'}
          </Text>
          <Text style={s.modeBadgeDesc}>
            {openToAny
              ? 'Get referred by employees from multiple companies with a single request'
              : 'Targeted referral from an employee at a specific company'}
          </Text>
        </View>
      </View>

      {/* Refund badge (right after mode badge) */}
      <View style={s.refundBadge}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
        <Text style={s.refundText}>Full refund if no referral received</Text>
      </View>

      <Text style={s.summaryTitle}>Order Summary</Text>
      <View style={s.summaryDivider} />

      <View style={s.summaryRow}>
        <Ionicons name={openToAny?'globe-outline':'business-outline'} size={16} color={openToAny?'#8B5CF6':colors.primary} />
        <Text style={s.summaryLabel}>{openToAny?'Open to Any':'Specific Company'}</Text>
      </View>

      {jobTitle.trim() ? <View style={s.summaryRow}><Ionicons name="briefcase-outline" size={16} color={colors.textSecondary} /><Text style={s.summaryValue} numberOfLines={1}>{jobTitle}</Text></View> : null}
      {selectedCompany ? <View style={s.summaryRow}><Ionicons name="business" size={16} color={colors.textSecondary} /><Text style={s.summaryValue} numberOfLines={1}>{selectedCompany.name}</Text></View> : null}
      {selectedResume ? <View style={s.summaryRow}><Ionicons name="document-text" size={16} color={colors.textSecondary} /><Text style={s.summaryValue} numberOfLines={1}>{selectedResume.ResumeLabel}</Text></View> : null}

      <View style={s.summaryDivider} />

      <View style={s.summaryPriceRow}>
        <Text style={s.summaryPriceLabel}>Total</Text>
        <Text style={[s.summaryPrice, openToAny && { color: '#8B5CF6' }]}>₹{effectiveCost}</Text>
      </View>

      <View style={s.summaryWalletRow}>
        <Ionicons name="wallet-outline" size={14} color={colors.success} />
        <Text style={s.summaryWalletText}>{loadingWallet?'...': `₹${walletBalance.toFixed(0)} available`}</Text>
      </View>

      <TouchableOpacity style={[s.summaryBtn, openToAny && { backgroundColor: '#8B5CF6' }, submitting && { opacity: 0.6 }]} onPress={handleAskReferral} disabled={submitting} activeOpacity={0.85}>
        {submitting ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="paper-plane" size={18} color="#fff" /><Text style={s.summaryBtnText}>Send Request</Text></>}
      </TouchableOpacity>
    </View>
  );

  // ── Form fields ──────────────────────────────────────────────
  const formJSX = (
    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: isDesktop ? 40 : 120 }} keyboardShouldPersistTaps="handled" onScroll={handleScroll} scrollEventThrottle={16}>

      {/* Backdrop for company dropdown */}
      {showCompanyDD && <Pressable style={Platform.OS==='web'?{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9990}:{position:'absolute',top:-1000,left:-1000,right:-1000,bottom:-1000,zIndex:9990}} onPress={() => { setShowCompanyDD(false); setCompanySearch(''); }} />}

      {/* Social proof (mobile only) */}
      {!isDesktop && tickerCompany && (
        <Animated.View style={[s.proofBar, { opacity: Animated.multiply(tickerFade, tickerVisibility) }]}>
          <View style={s.proofDot} />
          <Text style={s.proofOnline}>{referrersOnline.toLocaleString('en-IN')}</Text>
          <Text style={s.proofLabel}>online</Text>
          <Text style={s.proofSep}>·</Text>
          <Text style={s.proofCount}>{dailyRefCount}</Text>
          <Text style={s.proofLabel}>referrals today</Text>
          <Text style={s.proofSep}>·</Text>
          <CachedImage source={{ uri: tickerCompany.logoURL }} style={s.tickerLogo} resizeMode="contain" />
          <Text style={s.tickerCompany} numberOfLines={1}>{tickerCompany.name}</Text>
        </Animated.View>
      )}

      {/* Header (desktop only — mobile uses TabHeader title) */}
      {isDesktop && (
        <View style={s.header}>
          <Text style={s.headerTitle}>Get Referred</Text>
        </View>
      )}

      {/* Mode selector (pills with info inside) */}
      <View style={s.segment} onLayout={(e) => { segmentY.current = e.nativeEvent.layout.y; }}>
        <TouchableOpacity style={[s.segBtn, openToAny && s.segBtnActive, openToAny && { backgroundColor: '#8B5CF6'+'12', borderColor: '#8B5CF6' }]} onPress={() => switchMode(true)} activeOpacity={0.8}>
          {openToAny && <View style={s.recBadge}><Text style={s.recBadgeText}>RECOMMENDED</Text></View>}
          <View style={s.segBtnRow}>
            <Ionicons name="globe-outline" size={18} color={openToAny ? '#8B5CF6' : colors.gray400} />
            <Text style={[s.segBtnTitle, openToAny && { color: '#8B5CF6' }]}>Open</Text>
            {isDesktop && <Text style={[s.segBtnFromInline, openToAny && { color: '#8B5CF6' }]}>₹{pricing.openToAnyReferralCost}</Text>}
          </View>
          {!isDesktop && <Text style={s.segBtnDesc}>Get referred by employees from multiple companies with a single request</Text>}
          {!isDesktop && <Text style={[s.segBtnFrom, openToAny && { color: '#8B5CF6' }]}>₹{pricing.openToAnyReferralCost}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.segBtn, !openToAny && s.segBtnActive]} onPress={() => switchMode(false)} activeOpacity={0.8}>
          <View style={s.segBtnRow}>
            <Ionicons name="business-outline" size={18} color={!openToAny ? colors.primary : colors.gray400} />
            <Text style={[s.segBtnTitle, !openToAny && { color: colors.primary }]}>Specific</Text>
            {isDesktop && <Text style={[s.segBtnFromInline, !openToAny && { color: colors.primary }]}>from ₹{pricing.referralRequestCost}</Text>}
          </View>
          {!isDesktop && <Text style={s.segBtnDesc}>Targeted referral from an employee at a specific company</Text>}
          {!isDesktop && <Text style={s.segBtnFrom}>from ₹{pricing.referralRequestCost}</Text>}
        </TouchableOpacity>
      </View>

      {/* Refund badge (mobile only) */}
      {!isDesktop && (
        <View style={s.refundBadgeMobile}>
          <Ionicons name="shield-checkmark-outline" size={13} color={colors.success} />
          <Text style={s.refundTextMobile}>Full refund if no referral received</Text>
        </View>
      )}

      {/* ── Fields (progressive reveal) ──────────────── */}

      {/* Company (Specific only) */}
      {!openToAny && step >= 1 && (
        <AnimatedFormStep visible question="Which company?" completed={!!selectedCompany && !showCompanyDD} colors={colors} style={{ zIndex: showCompanyDD ? 9999 : 1, paddingHorizontal: 16 }}>
          <View style={{ position:'relative', zIndex: showCompanyDD?9999:1 }}>
            <View style={[s.searchWrap, selectedCompany && !showCompanyDD && s.searchWrapDone]}>
              <Ionicons name="search" size={18} color={selectedCompany&&!showCompanyDD?colors.success:colors.gray400} style={{marginRight:10}} />
              <TextInput style={s.searchInner} placeholder="Search company..." placeholderTextColor={colors.gray500}
                value={showCompanyDD?companySearch:(selectedCompany?.name||'')}
                onChangeText={t=>{setCompanySearch(t);if(!showCompanyDD){setShowCompanyDD(true);setSelectedCompany(null);}}}
                onFocus={()=>{setShowCompanyDD(true);setCompanySearch('');}}
                autoCorrect={false} autoCapitalize="words" />
            </View>
            {selectedCompany&&!showCompanyDD && <TouchableOpacity style={s.clearBtn} onPress={()=>{setSelectedCompany(null);setShowCompanyDD(true);setCompanySearch('');}}><Ionicons name="close-circle" size={18} color={colors.gray400} /></TouchableOpacity>}
            {showCompanyDD && (
              <View style={s.dropdown}>
                {orgLoading ? <View style={s.ddLoad}><ActivityIndicator size="small" color={colors.primary}/><Text style={s.ddLoadText}>Searching...</Text></View>
                : orgResults.length > 0 ? <ScrollView style={{maxHeight:250}} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {orgResults.slice(0,15).map(org => (
                    <TouchableOpacity key={org.id} style={s.ddItem} onPress={() => handleSelectCompany(org)}>
                      {org.logoURL ? <CachedImage source={{uri:org.logoURL}} style={s.ddLogo} resizeMode="contain"/> : <View style={s.ddLogoP}><Ionicons name="business" size={16} color={colors.gray400}/></View>}
                      <View style={{flex:1}}><Text style={s.ddName}>{org.name}</Text>{org.industry&&org.industry!=='Other'&&<Text style={s.ddIndustry}>{org.industry}</Text>}</View>
                    </TouchableOpacity>))}
                </ScrollView>
                : companySearch.length>1 ? <View style={s.ddEmpty}><Ionicons name="alert-circle-outline" size={16} color={colors.textMuted}/><Text style={s.ddEmptyText}>No company found. Check spelling.</Text></View>
                : null}
              </View>
            )}
          </View>
          {errors.company && <Text style={s.fieldError}>{errors.company}</Text>}
        </AnimatedFormStep>
      )}

      {/* Job Title */}
      <AnimatedFormStep visible={step >= (openToAny ? 1 : 2)} question="What job role are you looking for?" completed={jobTitle.trim().length>=2} colors={colors} style={{ paddingHorizontal: 16 }}>
        <TextInput style={[s.fieldInput, errors.jobTitle && s.fieldInputErr]} placeholder="e.g. Senior Software Engineer" placeholderTextColor={colors.gray500} value={jobTitle} onChangeText={t=>{setJobTitle(t);if(errors.jobTitle)setErrors(p=>({...p,jobTitle:null}));}} maxLength={200} />
        {errors.jobTitle && <Text style={s.fieldError}>{errors.jobTitle}</Text>}
      </AnimatedFormStep>

      {/* Job ID (Specific) */}
      {!openToAny && (
        <AnimatedFormStep visible={step >= 3} question="Job ID / Reference" completed={jobId.trim().length>=2} colors={colors} style={{ paddingHorizontal: 16 }}>
          <TextInput style={[s.fieldInput, errors.jobId && s.fieldInputErr]} placeholder="e.g. REQ-2024-001" placeholderTextColor={colors.gray500} value={jobId} onChangeText={t=>{setJobId(t);if(errors.jobId)setErrors(p=>({...p,jobId:null}));}} maxLength={100} />
          <Text style={s.fieldHint}>Find this on the company's career page</Text>
          {errors.jobId && <Text style={s.fieldError}>{errors.jobId}</Text>}
        </AnimatedFormStep>
      )}

      {/* Resume */}
      <AnimatedFormStep visible={step >= 2} question="Your resume" completed={!!selectedResumeId} colors={colors} style={{ paddingHorizontal: 16 }}>
        {loadingResumes ? <View style={s.resumeLoad}><ActivityIndicator size="small" color={colors.primary}/><Text style={s.resumeLoadText}>Loading...</Text></View>
        : selectedResume ? (
          <View style={s.resumePill}>
            <Ionicons name="document-text" size={18} color={colors.primary}/>
            <View style={{flex:1,marginLeft:10}}><Text style={s.resumeName} numberOfLines={1}>{selectedResume.ResumeLabel}</Text>{selectedResume.IsPrimary&&<Text style={s.resumePrimary}>Primary</Text>}</View>
            <TouchableOpacity style={s.resumeChangeBtn} onPress={()=>{if(requireAuth('resume'))setShowResumeModal(true);}}><Text style={s.resumeChangeBtnText}>Change</Text></TouchableOpacity>
          </View>
        ) : resumes.length > 0 ? (
          <View style={s.resumeList}>
            {resumes.slice(0,3).map(r=>(
              <TouchableOpacity key={r.ResumeID} style={[s.resumeItem,selectedResumeId===r.ResumeID&&s.resumeItemActive]} onPress={()=>setSelectedResumeId(r.ResumeID)}>
                <Ionicons name="document-text" size={16} color={selectedResumeId===r.ResumeID?colors.primary:colors.gray400}/>
                <Text style={[s.resumeItemLabel,selectedResumeId===r.ResumeID&&{color:colors.primary}]} numberOfLines={1}>{r.ResumeLabel}</Text>
                <View style={[s.radio,selectedResumeId===r.ResumeID&&s.radioActive]}>{selectedResumeId===r.ResumeID&&<View style={s.radioInner}/>}</View>
              </TouchableOpacity>))}
          </View>
        ) : (
          <TouchableOpacity style={s.uploadCTA} onPress={()=>{if(requireAuth('upload'))setShowResumeModal(true);}}>
            <Ionicons name="cloud-upload-outline" size={24} color={colors.primary}/><Text style={s.uploadCTATitle}>Upload resume</Text><Text style={s.uploadCTASub}>PDF or DOC, max 5MB</Text>
          </TouchableOpacity>
        )}
        {errors.resume && <Text style={s.fieldError}>{errors.resume}</Text>}
      </AnimatedFormStep>

      {/* Optional fields — always visible with friendly labels */}
      {step >= 2 && (
        <View style={{ paddingHorizontal: 16 }}>
          {/* Job URL (Specific mode) */}
          {!openToAny && (
            <View style={s.fg}>
              <Text style={s.fLabel}>Job listing URL <Text style={s.optLabel}>(optional)</Text></Text>
              <TextInput style={s.fieldInput} placeholder="https://careers.company.com/job/12345" placeholderTextColor={colors.gray500} value={jobUrl} onChangeText={setJobUrl} keyboardType="url" autoCapitalize="none" />
            </View>
          )}

          {/* Salary (Open mode) */}
          {openToAny && (
            <View style={s.fg}>
              <Text style={s.fLabel}>Expected salary? <Text style={s.optLabel}>(optional)</Text></Text>
              <View style={s.salaryRow}>
                <TouchableOpacity style={s.salPre} onPress={()=>setSalaryCurrency(c=>c==='INR'?'USD':'INR')}><Text style={s.salPreText}>{salaryCurrency==='INR'?'₹':'$'}</Text></TouchableOpacity>
                <TextInput style={s.salInput} placeholder={salaryCurrency==='INR'?'15,00,000':'120,000'} placeholderTextColor={colors.gray500} value={minSalary} onChangeText={v=>setMinSalary(v.replace(/[^0-9]/g,''))} keyboardType="numeric" maxLength={10}/>
                <TouchableOpacity style={s.salSuf} onPress={()=>setSalaryPeriod(p=>p==='Annual'?'Monthly':'Annual')}><Text style={s.salSufText}>{salaryPeriod==='Annual'?'/yr':'/mo'}</Text></TouchableOpacity>
              </View>
            </View>
          )}

          {/* Locations (Open mode) */}
          {openToAny && (
            <View style={s.fg}>
              <Text style={s.fLabel}>Preferred locations? <Text style={s.optLabel}>(optional)</Text></Text>
              <TextInput style={s.fieldInput} placeholder="e.g. Bangalore, Hyderabad, Remote" placeholderTextColor={colors.gray500} value={preferredLocations} onChangeText={setPreferredLocations} maxLength={200}/>
            </View>
          )}

          {/* Message */}
          <View style={s.fg}>
            <Text style={s.fLabel}>Message for the referrer? <Text style={s.optLabel}>(optional)</Text></Text>
            <TextInput style={s.textArea} placeholder="Why you're a great fit for this role..." placeholderTextColor={colors.gray500} value={referralMessage} onChangeText={setReferralMessage} multiline numberOfLines={3} maxLength={1000} textAlignVertical="top"/>
          </View>
        </View>
      )}
    </ScrollView>
  );

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS==='ios'?'padding':'height'}>
      <TabHeader navigation={navigation} title={!isDesktop ? 'Get Referred' : undefined} />

        {/* Sticky mode pill (appears on scroll) */}
        {showStickyMode && (
          <Animated.View style={[s.stickyModePill, { transform: [{ translateY: stickyAnim.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] }) }] }]}>
            <View style={[s.stickyModeActive, openToAny ? { backgroundColor: '#8B5CF6' + '15', borderColor: '#8B5CF6' + '40' } : { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
              <Ionicons name={openToAny ? 'globe-outline' : 'business-outline'} size={16} color={openToAny ? '#8B5CF6' : colors.primary} />
              <Text style={[s.stickyModeText, { color: openToAny ? '#8B5CF6' : colors.primary }]}>{openToAny ? 'Open' : 'Specific'}</Text>
            </View>
            {isDesktop && <Text style={s.stickyTitle}>Get Referred</Text>}
            <TouchableOpacity style={[s.stickyModeSwitch, { backgroundColor: openToAny ? colors.primary + '10' : '#8B5CF6' + '10' }]} onPress={() => switchMode(!openToAny)} activeOpacity={0.7}>
              <Ionicons name="swap-horizontal" size={14} color={openToAny ? colors.primary : '#8B5CF6'} />
              <Text style={[s.stickySwitchText, { color: openToAny ? colors.primary : '#8B5CF6' }]}>{openToAny ? 'Switch to Specific' : 'Switch to Open'}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

      {isDesktop ? (
        /* ── DESKTOP: Split layout ──────────────────────── */
        <View style={s.desktopLayout}>
          <View style={s.desktopLeft}>{formJSX}</View>
          <View style={s.desktopRight}>{summaryJSX}</View>
        </View>
      ) : (
        /* ── MOBILE: Single column + sticky bottom ──────── */
        <View style={s.inner}>
          {formJSX}
          <View style={s.stickyBottom}>
            <View style={s.stickySummary}>
              <Text style={s.stickyLabel}>Total</Text>
              <Text style={[s.stickyPrice, openToAny&&{color:'#8B5CF6'}]}>₹{effectiveCost}</Text>
            </View>
            <TouchableOpacity style={s.stickyWallet} onPress={() => navigation.navigate('WalletRecharge')} activeOpacity={0.7}><Ionicons name="wallet-outline" size={14} color={colors.success}/><Text style={s.stickyBalance}>{loadingWallet?'...': `₹${walletBalance.toFixed(0)}`}</Text></TouchableOpacity>
            <TouchableOpacity style={[s.stickyBtn, openToAny&&{backgroundColor:'#8B5CF6'}, submitting&&{opacity:0.6}]} onPress={handleAskReferral} disabled={submitting} activeOpacity={0.85}>
              {submitting ? <ActivityIndicator size="small" color="#fff"/> : <><Ionicons name="paper-plane" size={16} color="#fff"/><Text style={s.stickyBtnText}>Send</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ResumeUploadModal visible={showResumeModal} onClose={()=>setShowResumeModal(false)} onResumeSelected={handleResumeSelected} user={user} jobTitle={jobTitle||'Job Application'}/>
      <WalletRechargeModal visible={showWalletModal} currentBalance={walletModalData.currentBalance} requiredAmount={walletModalData.requiredAmount} onAddMoney={()=>{setShowWalletModal(false);navigation.navigate('WalletRecharge');}} onCancel={()=>setShowWalletModal(false)}/>
      <ConfirmPurchaseModal visible={showConfirmModal} currentBalance={walletBalance} requiredAmount={effectiveCost} contextType="referral" itemName={jobTitle||'this job'} onProceed={async()=>{setShowConfirmModal(false);await handleSubmit();}} onAddMoney={()=>{setShowConfirmModal(false);navigation.navigate('WalletRecharge');}} onCancel={()=>setShowConfirmModal(false)}/>
      <ReferralSuccessOverlay visible={showSuccessOverlay} onComplete={()=>{setShowSuccessOverlay(false);navigation.goBack();}} duration={3500} companyName={referralCompanyName} broadcastTime={referralBroadcastTime} isOpenToAny={referralCompanyName==='All Companies'}/>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c, r = {}) => {
  const isD = Platform.OS === 'web' && r.isDesktop;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    /* Desktop split */
    desktopLayout: { flex: 1, flexDirection: 'row', maxWidth: 1100, width: '100%', alignSelf: 'center' },
    desktopLeft: { flex: 3, borderRightWidth: 1, borderRightColor: c.border },
    desktopRight: { flex: 2, maxWidth: 380 },

    /* Mobile */
    inner: { flex: 1 },
    scroll: { flex: 1 },

    /* Sticky mode pill */
    stickyModePill: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 8,
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    stickyModeActive: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      borderWidth: 1,
    },
    stickyModeText: { fontSize: 13, fontWeight: '700' },
    stickyTitle: { fontSize: 18, fontWeight: '700', color: c.text, letterSpacing: -0.3 },
    stickyModeSwitch: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
      backgroundColor: c.primary + '10',
    },
    stickySwitchText: { fontSize: 12, fontWeight: '600', color: c.primary },

    /* Social proof (single row) */
    proofBar: { marginHorizontal: 16, marginTop: 8, marginBottom: 4, backgroundColor: c.surface, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'center' },
    proofDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.success },
    proofOnline: { fontSize: 11, color: c.success, fontWeight: '700' },
    proofLabel: { fontSize: 11, color: c.textMuted },
    proofSep: { fontSize: 10, color: c.textMuted },
    proofCount: { fontSize: 11, color: c.primary, fontWeight: '700' },
    tickerLogo: { width: 18, height: 18, borderRadius: 4, backgroundColor: c.background },
    tickerCompany: { fontSize: 11, fontWeight: '700', color: c.text },


    /* Header */
    header: { padding: 20, paddingTop: 16, paddingBottom: 8 },
    headerTitle: { fontSize: 26, fontWeight: '700', color: c.text, letterSpacing: -0.4, marginBottom: 4 },
    headerSub: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },

    /* Segmented control (expanded pills) */
    segment: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 8, alignItems: 'stretch' },
    segBtn: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface, position: 'relative', overflow: 'hidden', justifyContent: 'space-between' },
    segBtnActive: { borderColor: c.primary, backgroundColor: c.primary+'08' },
    segBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    segBtnTitle: { fontSize: 15, fontWeight: '700', color: c.textMuted, flex: 1 },
    segBtnDesc: { fontSize: 12, color: c.textSecondary, lineHeight: 16, marginTop: 6 },
    segBtnFrom: { fontSize: 11, color: c.textMuted, marginTop: 'auto', paddingTop: 4, textAlign: 'right' },
    segBtnFromInline: { fontSize: 12, fontWeight: '600', color: c.textMuted },
    recBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#8B5CF6', paddingHorizontal: 8, paddingVertical: 3, borderBottomLeftRadius: 8 },
    recBadgeText: { fontSize: 8, fontWeight: '700', color: '#fff', letterSpacing: 0.8 },

    /* Refund badge (mobile) */
    refundBadgeMobile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginHorizontal: 16, marginBottom: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: (c.success||'#22C55E')+'08', borderRadius: 8, borderWidth: 1, borderColor: (c.success||'#22C55E')+'18' },
    refundTextMobile: { fontSize: 12, fontWeight: '600', color: c.success||'#22C55E' },

    /* Fields */
    fieldInput: { borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: c.text, backgroundColor: c.surface },
    fieldInputErr: { borderColor: c.danger||'#EF4444' },
    fieldError: { fontSize: 12, color: c.danger||'#EF4444', marginTop: 4 },
    fieldHint: { fontSize: 11, color: c.textMuted, marginTop: 4 },
    textArea: { borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: c.text, backgroundColor: c.surface, minHeight: 80 },
    fg: { marginBottom: 16 },
    fLabel: { fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 8 },
    optLabel: { fontWeight: '400', fontSize: 12, color: c.textMuted },

    /* Company */
    searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
    searchWrapDone: { borderColor: (c.success||'#22C55E')+'50', backgroundColor: (c.success||'#22C55E')+'08' },
    searchInner: { flex: 1, paddingVertical: 12, fontSize: 15, color: c.text },
    clearBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
    dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: c.surfaceElevated||'#2D2D2D', borderWidth: 1, borderColor: c.border, borderRadius: 12, marginTop: 6, maxHeight: 260, zIndex: 9999, elevation: 10, shadowColor: '#000', shadowOffset:{width:0,height:8}, shadowOpacity: 0.3, shadowRadius: 16, overflow: 'hidden' },
    ddLoad: { padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    ddLoadText: { fontSize: 13, color: c.textMuted },
    ddEmpty: { padding: 16, alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center' },
    ddEmptyText: { fontSize: 13, color: c.textMuted },
    ddItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    ddLogo: { width: 32, height: 32, borderRadius: 8, marginRight: 12, backgroundColor: c.background },
    ddLogoP: { width: 32, height: 32, borderRadius: 8, marginRight: 12, backgroundColor: c.gray100||'#2D2D2D', justifyContent: 'center', alignItems: 'center' },
    ddName: { fontSize: 15, fontWeight: '600', color: c.text },
    ddIndustry: { fontSize: 12, color: c.textMuted, marginTop: 1 },

    /* Resume */
    resumeLoad: { flexDirection:'row',alignItems:'center',justifyContent:'center',padding:20,backgroundColor:c.surface,borderRadius:12,borderWidth:1,borderColor:c.border },
    resumeLoadText: { marginLeft:10,fontSize:13,color:c.textMuted },
    resumePill: { flexDirection:'row',alignItems:'center',backgroundColor:c.primaryBg||(c.primary+'08'),borderRadius:12,padding:14,borderWidth:1,borderColor:c.primary+'30' },
    resumeName: { fontSize:14,fontWeight:'600',color:c.text },
    resumePrimary: { fontSize:10,fontWeight:'700',color:c.success||'#22C55E',marginTop:1 },
    resumeChangeBtn: { paddingHorizontal:12,paddingVertical:6,borderRadius:8,backgroundColor:c.textSecondary+'20' },
    resumeChangeBtnText: { fontSize:13,fontWeight:'600',color:c.textSecondary },
    resumeList: { borderWidth:1,borderColor:c.border,borderRadius:12,overflow:'hidden' },
    resumeItem: { flexDirection:'row',alignItems:'center',padding:14,gap:10,borderBottomWidth:1,borderBottomColor:c.border },
    resumeItemActive: { backgroundColor:c.primaryBg||(c.primary+'08') },
    resumeItemLabel: { flex:1,fontSize:14,color:c.text },
    radio: { width:18,height:18,borderRadius:9,borderWidth:2,borderColor:c.gray400,justifyContent:'center',alignItems:'center' },
    radioActive: { borderColor:c.primary },
    radioInner: { width:8,height:8,borderRadius:4,backgroundColor:c.primary },
    uploadCTA: { alignItems:'center',padding:24,borderWidth:1,borderColor:c.border,borderRadius:12,borderStyle:'dashed',backgroundColor:c.surface },
    uploadCTATitle: { fontSize:15,fontWeight:'600',color:c.primary,marginTop:8 },
    uploadCTASub: { fontSize:12,color:c.textMuted,marginTop:2 },

    /* Optional */
    /* Salary */
    salaryRow: { flexDirection:'row',alignItems:'center' },
    salPre: { backgroundColor:c.surface,borderWidth:1,borderColor:c.border,borderTopLeftRadius:12,borderBottomLeftRadius:12,paddingHorizontal:14,paddingVertical:14 },
    salPreText: { fontSize:16,fontWeight:'700',color:c.text },
    salInput: { flex:1,borderWidth:1,borderColor:c.border,borderLeftWidth:0,borderRightWidth:0,paddingHorizontal:14,paddingVertical:14,fontSize:15,color:c.text,backgroundColor:c.surface },
    salSuf: { backgroundColor:c.surface,borderWidth:1,borderColor:c.border,borderTopRightRadius:12,borderBottomRightRadius:12,paddingHorizontal:14,paddingVertical:14 },
    salSufText: { fontSize:14,fontWeight:'600',color:c.textSecondary },

    /* Summary panel (desktop sidebar) */
    summary: { padding: 24, position: 'sticky', top: 0 },
    modeBadge: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 20, gap: 12 },
    modeBadgeIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    modeBadgeTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    modeBadgeDesc: { fontSize: 12, color: c.textSecondary, lineHeight: 16 },
    summaryTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 16 },
    summaryDivider: { height: 1, backgroundColor: c.border, marginVertical: 12 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    summaryLabel: { fontSize: 14, fontWeight: '600', color: c.text },
    summaryValue: { fontSize: 14, color: c.textSecondary, flex: 1 },
    summaryPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    summaryPriceLabel: { fontSize: 14, color: c.textMuted },
    summaryPrice: { fontSize: 28, fontWeight: '700', color: c.primary },
    summaryWalletRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
    summaryWalletText: { fontSize: 12, fontWeight: '600', color: c.success||'#22C55E' },
    summaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, paddingVertical: 16, borderRadius: 14, marginBottom: 12, shadowColor: c.primary, shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:8, elevation:4 },
    summaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    refundBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, backgroundColor: (c.success||'#22C55E')+'08', borderRadius: 10, borderWidth: 1, borderColor: (c.success||'#22C55E')+'20', marginBottom: 20 },
    refundText: { fontSize: 12, fontWeight: '600', color: c.success||'#22C55E', flex: 1 },
    sideProof: { backgroundColor: c.surface, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: c.border },

    /* Sticky bottom (mobile) */
    stickyBottom: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface, gap: 12 },
    stickySummary: {},
    stickyLabel: { fontSize: 10, color: c.textMuted },
    stickyPrice: { fontSize: 20, fontWeight: '700', color: c.primary },
    stickyWallet: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    stickyBalance: { fontSize: 11, fontWeight: '600', color: c.success||'#22C55E' },
    stickyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.primary, paddingVertical: 14, borderRadius: 12 },
    stickyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    gate: { flex:1,justifyContent:'center',alignItems:'center',padding:24,backgroundColor:c.background },
    gateTitle: { fontSize:20,fontWeight:'700',color:c.text,marginTop:16 },
    gateSub: { fontSize:15,color:c.textSecondary,marginTop:4 },
  });
};
