import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  Animated,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authDarkColors } from '../../../../styles/authDarkColors';
import useResponsive from '../../../../hooks/useResponsive';
import refopenAPI from '../../../../services/api';
import { showToast } from '../../../../components/Toast';
import RegistrationWrapper from '../../../../components/auth/RegistrationWrapper';
import AnimatedFormStep from '../../../../components/auth/AnimatedFormStep';
import DatePicker from '../../../../components/DatePicker';

const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
};

export default function WorkExperienceScreen({ navigation, route }) {
  const colors = authDarkColors;
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const { userType, experienceType, totalSteps = 4 } = route.params;

  // ─── Form ────────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState('');
  const [organizationId, setOrganizationId] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [jobTitle, setJobTitle] = useState('');
  const [isCurrent, setIsCurrent] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ─── Company inline dropdown ─────────────────────────────────
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const debouncedCompanySearch = useDebounce(companySearch, 300);

  // ─── Job role inline dropdown ────────────────────────────────
  const [jobRoles, setJobRoles] = useState([]);
  const [loadingJobRoles, setLoadingJobRoles] = useState(false);
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [jobSearch, setJobSearch] = useState('');

  // ─── Progressive reveal ──────────────────────────────────────
  // 0=company, 1=jobTitle, 2=toggle+startDate+endDate, 3=continue
  const scrollRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(0);

  const advanceTo = useCallback((step) => {
    setCurrentStep((prev) => (step > prev ? step : prev));
  }, []);

  // Company selected → show job title
  useEffect(() => {
    if (companyName.trim().length >= 2 && !showCompanyDropdown) advanceTo(1);
  }, [companyName, showCompanyDropdown, advanceTo]);

  // Job title filled → show dates
  useEffect(() => {
    if (jobTitle.trim().length >= 2 && !showJobDropdown) advanceTo(2);
  }, [jobTitle, showJobDropdown, advanceTo]);

  // Start date filled (and end date if not current) → show continue
  useEffect(() => {
    if (startDate && (isCurrent || endDate)) advanceTo(3);
  }, [startDate, isCurrent, endDate, advanceTo]);

  // ─── Load job roles on mount ─────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoadingJobRoles(true);
        const response = await refopenAPI.getReferenceMetadata('JobRole');
        if (response.success && Array.isArray(response.data)) {
          setJobRoles(response.data.sort((a, b) => (a.Value || '').localeCompare(b.Value || '')));
        }
      } catch (err) {
        console.error('Error loading job roles:', err);
      } finally {
        setLoadingJobRoles(false);
      }
    })();
  }, []);

  // ─── Company search ──────────────────────────────────────────
  useEffect(() => {
    if (!showCompanyDropdown) return;
    (async () => {
      try {
        setOrgLoading(true);
        const res = await refopenAPI.getOrganizations(debouncedCompanySearch || '', null);
        const raw = res?.success && Array.isArray(res.data) ? res.data : [];
        if (debouncedCompanySearch?.trim()) {
          const s = debouncedCompanySearch.toLowerCase();
          setOrgResults(raw.filter((o) => o.name?.toLowerCase().includes(s)));
        } else {
          setOrgResults(raw);
        }
      } catch (e) {
        setOrgResults([]);
      } finally {
        setOrgLoading(false);
      }
    })();
  }, [debouncedCompanySearch, showCompanyDropdown]);

  // ─── Handlers ────────────────────────────────────────────────
  const handleSelectOrg = (org) => {
    setOrganizationId(org.id);
    setCompanyName(org.name);
    setSelectedOrg(org);
    setCompanySearch('');
    setShowCompanyDropdown(false);
    advanceTo(1);
  };

  const handleSelectJob = (role) => {
    setJobTitle(role.Value);
    setJobSearch('');
    setShowJobDropdown(false);
    advanceTo(2);
  };

  const handleContinue = () => {
    if (!companyName.trim()) { showToast('Please enter your company', 'error'); return; }
    if (!jobTitle.trim()) { showToast('Please enter your job title', 'error'); return; }
    if (!startDate) { showToast('Please select a start date', 'error'); return; }
    if (!isCurrent && !endDate) { showToast('Please select an end date', 'error'); return; }

    const workExperienceData = [{
      jobTitle: jobTitle.trim(),
      companyName: companyName.trim(),
      organizationId: organizationId || null,
      startDate: startDate,
      endDate: isCurrent ? null : endDate,
      isCurrentPosition: isCurrent,
    }];

    navigation.navigate('EducationDetailsScreen', {
      userType, experienceType, totalSteps, workExperienceData,
      fromGoogleAuth: route?.params?.fromGoogleAuth,
      googleUser: route?.params?.googleUser,
    });
  };

  const isContinueEnabled = companyName.trim().length >= 2 && jobTitle.trim().length >= 2 && !!startDate && (isCurrent || !!endDate);

  // Filtered lists
  const filteredJobs = useMemo(() => {
    if (!jobSearch.trim()) return jobRoles;
    const s = jobSearch.toLowerCase();
    const matches = jobRoles.filter((r) => r.Value?.toLowerCase().includes(s));
    // Sort: starts-with first, then contains
    matches.sort((a, b) => {
      const aStarts = a.Value?.toLowerCase().startsWith(s) ? 0 : 1;
      const bStarts = b.Value?.toLowerCase().startsWith(s) ? 0 : 1;
      return aStarts - bStarts;
    });
    return matches;
  }, [jobSearch, jobRoles]);

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <RegistrationWrapper
      currentStep={2}
      totalSteps={totalSteps}
      stepLabel="Work experience"
      onBack={() => navigation.goBack()}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Backdrop to close dropdowns — accepts typed text */}
          {(showJobDropdown || showCompanyDropdown) && (
            <Pressable
              style={Platform.OS === 'web'
                ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9990 }
                : { position: 'absolute', top: -1000, left: -1000, right: -1000, bottom: -1000, zIndex: 9990 }}
              onPress={() => {
                // Accept typed company text on outside click
                if (showCompanyDropdown && companySearch.trim().length >= 2) {
                  setCompanyName(companySearch.trim());
                  setOrganizationId(null);
                  setSelectedOrg(null);
                  advanceTo(1);
                }
                if (showJobDropdown && jobSearch.trim().length >= 2) {
                  setJobTitle(jobSearch.trim());
                  advanceTo(2);
                }
                setShowJobDropdown(false);
                setShowCompanyDropdown(false);
                setCompanySearch('');
                setJobSearch('');
              }}
            />
          )}

          <View style={styles.header}>
            <Text style={styles.emoji}>💼</Text>
            <Text style={styles.title}>Your work experience</Text>
            <Text style={styles.subtitle}>Tell us about your current or most recent role</Text>
          </View>

          {/* ── Step 0: Company (required, inline dropdown) ──── */}
          <AnimatedFormStep
            visible={currentStep >= 0}
            question="Which company do you work at?"
            completed={companyName.trim().length >= 2 && !showCompanyDropdown}
            style={{ zIndex: showCompanyDropdown ? 9999 : 1 }}
          >
            <View style={{ position: 'relative', zIndex: showCompanyDropdown ? 9999 : 1 }}>
              <View style={[styles.searchInputWrap, companyName && !showCompanyDropdown && styles.searchInputWrapCompleted]}>
                <Ionicons name="search" size={18} color={companyName && !showCompanyDropdown ? colors.success : colors.gray400} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.searchInputInner}
                  placeholder="Search or type company name"
                  placeholderTextColor={colors.textMuted}
                  value={showCompanyDropdown ? companySearch : companyName}
                  onChangeText={(text) => {
                    setCompanySearch(text);
                    if (!showCompanyDropdown) {
                      setShowCompanyDropdown(true);
                      setCompanyName('');
                      setOrganizationId(null);
                      setSelectedOrg(null);
                    }
                  }}
                  onFocus={() => {
                    setShowCompanyDropdown(true);
                    setCompanySearch('');
                  }}
                  onBlur={() => {
                    // Accept typed text on blur if no dropdown selection made
                    if (showCompanyDropdown && companySearch.trim().length >= 2 && !companyName) {
                      setCompanyName(companySearch.trim());
                      setOrganizationId(null);
                      setSelectedOrg(null);
                      setShowCompanyDropdown(false);
                      setCompanySearch('');
                      advanceTo(1);
                    }
                  }}
                  autoCorrect={false}
                  autoCapitalize="words"
                />
              </View>
              {companyName && !showCompanyDropdown && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => { setCompanyName(''); setOrganizationId(null); setSelectedOrg(null); setShowCompanyDropdown(true); setCompanySearch(''); }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.gray400} />
                </TouchableOpacity>
              )}

              {showCompanyDropdown && (
                <View style={styles.dropdownContainer}>
                  {orgLoading ? (
                    <View style={styles.dropdownLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.dropdownLoadingText}>Searching...</Text>
                    </View>
                  ) : orgResults.length > 0 ? (
                    <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {orgResults.slice(0, 15).map((org) => (
                        <TouchableOpacity key={org.id} style={styles.orgDropdownItem} onPress={() => handleSelectOrg(org)}>
                          {org.logoURL ? (
                            <Image source={{ uri: org.logoURL }} style={styles.orgDropdownLogo} resizeMode="contain" />
                          ) : (
                            <View style={styles.orgDropdownLogoPlaceholder}>
                              <Ionicons name="business" size={16} color={colors.gray400} />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.dropdownItemText}>{org.name}</Text>
                            {org.industry && org.industry !== 'Other' && (
                              <Text style={styles.dropdownItemSub}>{org.industry}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : companySearch.length > 1 && !orgLoading ? (
                    <View style={styles.dropdownEmpty}>
                      <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                      <Text style={styles.dropdownEmptyText}>
                        Click outside to use "{companySearch.trim()}"
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </AnimatedFormStep>

          {/* ── Step 1: Job Title (inline dropdown) ──── */}
          <AnimatedFormStep
            visible={currentStep >= 1}
            question="What's your role?"
            helpText={companyName ? `At ${companyName}` : undefined}
            completed={jobTitle.trim().length >= 2 && !showJobDropdown}
            style={{ zIndex: showJobDropdown ? 9999 : 1 }}
          >
            <View style={{ position: 'relative', zIndex: showJobDropdown ? 9999 : 1 }}>
              <TextInput
                style={[styles.textInput, jobTitle.trim().length >= 2 && !showJobDropdown && styles.textInputCompleted]}
                placeholder="e.g. Software Engineer, Marketing Manager"
                placeholderTextColor={colors.textMuted}
                value={showJobDropdown ? jobSearch : jobTitle}
                onChangeText={(text) => {
                  setJobSearch(text);
                  if (!showJobDropdown) {
                    setShowJobDropdown(true);
                    setJobTitle(text);
                  } else {
                    setJobTitle(text);
                  }
                }}
                onFocus={() => { setShowJobDropdown(true); setJobSearch(''); }}
                autoCorrect={false}
                spellCheck={false}
              />
              {jobTitle && !showJobDropdown && (
                <TouchableOpacity style={styles.clearBtn} onPress={() => { setJobTitle(''); setShowJobDropdown(true); setJobSearch(''); }}>
                  <Ionicons name="close-circle" size={18} color={colors.gray400} />
                </TouchableOpacity>
              )}

              {showJobDropdown && (
                <View style={styles.dropdownContainer}>
                  {loadingJobRoles ? (
                    <View style={styles.dropdownLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.dropdownLoadingText}>Loading roles...</Text>
                    </View>
                  ) : filteredJobs.length > 0 ? (
                    <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {filteredJobs.slice(0, 15).map((role) => (
                        <TouchableOpacity key={role.ReferenceID} style={styles.dropdownItem} onPress={() => handleSelectJob(role)}>
                          <Text style={styles.dropdownItemText}>{role.Value}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : jobSearch.length > 0 ? (
                    <View style={styles.dropdownEmpty}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={styles.dropdownEmptyText}>"{jobSearch}" will be used</Text>
                      <TouchableOpacity style={styles.dropdownUseBtn} onPress={() => { setJobTitle(jobSearch); setJobSearch(''); setShowJobDropdown(false); advanceTo(2); }}>
                        <Text style={styles.dropdownUseBtnText}>Use this title</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </AnimatedFormStep>

          {/* ── Step 2: Current toggle + Dates ──── */}
          <AnimatedFormStep
            visible={currentStep >= 2}
            question="When did you start?"
            completed={!!startDate && (isCurrent || !!endDate)}
            style={{ zIndex: 0 }}
          >
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, isCurrent && styles.toggleBtnActive]}
                onPress={() => { setIsCurrent(true); setEndDate(''); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleBtnText, isCurrent && styles.toggleBtnTextActive]}>Currently here</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, !isCurrent && styles.toggleBtnActive]}
                onPress={() => setIsCurrent(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleBtnText, !isCurrent && styles.toggleBtnTextActive]}>Past role</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 16 }}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
                placeholder="Select start date"
                required
                maximumDate={new Date()}
                colors={colors}
              />
            </View>

            {!isCurrent && (
              <View style={{ marginTop: 12 }}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="Select end date"
                  required
                  maximumDate={new Date()}
                  colors={colors}
                />
              </View>
            )}
          </AnimatedFormStep>

          {/* ── Continue ─────────────────────────── */}
          {currentStep >= 3 && (
            <Animated.View style={styles.continueWrap}>
              <TouchableOpacity
                style={[styles.continueButton, !isContinueEnabled && styles.continueButtonDisabled]}
                onPress={handleContinue}
                disabled={!isContinueEnabled}
                activeOpacity={0.85}
              >
                <Text style={[styles.continueButtonText, !isContinueEnabled && styles.continueButtonTextDisabled]}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color={isContinueEnabled ? colors.white : colors.textMuted} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </RegistrationWrapper>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const createStyles = (colors, responsive = {}) =>
  StyleSheet.create({
    scrollContainer: { flex: 1 },
    content: {
      width: '100%',
      maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 560 : '100%',
      padding: 24, paddingTop: 12, alignSelf: 'center',
    },
    header: { marginBottom: 36 },
    emoji: { fontSize: 36, marginBottom: 12 },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.4, marginBottom: 6 },
    subtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },

    textInput: {
      backgroundColor: colors.inputBackground, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18,
      paddingRight: 44, fontSize: 15, color: colors.text,
    },
    textInputCompleted: { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.05)' },
    clearBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },

    /* Search input with icon */
    searchInputWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.inputBackground, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 14, paddingVertical: 4, paddingHorizontal: 16,
    },
    searchInputWrapCompleted: { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.05)' },
    searchInputInner: {
      flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text,
    },

    /* Dropdown */
    dropdownContainer: {
      position: 'absolute', top: '100%', left: 0, right: 0,
      backgroundColor: '#2D2D2D', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
      borderRadius: 14, marginTop: 6, maxHeight: 280, zIndex: 9999, elevation: 10,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20,
      overflow: 'hidden',
    },
    dropdownScroll: { maxHeight: 280 },
    dropdownItem: {
      paddingVertical: 14, paddingHorizontal: 18,
      borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: '#2D2D2D',
    },
    dropdownItemText: { fontSize: 15, fontWeight: '500', color: colors.text },
    dropdownItemSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    dropdownLoading: { padding: 24, alignItems: 'center', gap: 8, backgroundColor: '#2D2D2D' },
    dropdownLoadingText: { fontSize: 13, color: colors.textMuted },
    dropdownEmpty: { padding: 20, alignItems: 'center', gap: 8, backgroundColor: '#2D2D2D' },
    dropdownEmptyText: { fontSize: 13, color: colors.success },
    dropdownEmptyHint: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
    dropdownUseBtn: {
      backgroundColor: colors.primaryGlow, borderRadius: 10,
      paddingVertical: 10, paddingHorizontal: 18,
      borderWidth: 1, borderColor: colors.primaryGlowStrong,
    },
    dropdownUseBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },

    /* Org dropdown */
    orgDropdownItem: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 12, paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: '#2D2D2D',
    },
    orgDropdownLogo: {
      width: 32, height: 32, borderRadius: 8, marginRight: 12,
      backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderFaint,
    },
    orgDropdownLogoPlaceholder: {
      width: 32, height: 32, borderRadius: 8, marginRight: 12,
      backgroundColor: colors.borderFaint, alignItems: 'center', justifyContent: 'center',
    },

    /* Toggle */
    toggleRow: { flexDirection: 'row', gap: 10 },
    toggleBtn: {
      flex: 1, paddingVertical: 12, borderRadius: 12,
      borderWidth: 1.5, borderColor: colors.border,
      backgroundColor: colors.inputBackground, alignItems: 'center',
    },
    toggleBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryGlow },
    toggleBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
    toggleBtnTextActive: { color: colors.primary },

    /* Continue */
    continueWrap: { marginTop: 24, position: 'relative', zIndex: 0 },
    continueButton: {
      backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 18, paddingHorizontal: 24, borderRadius: 16, gap: 8,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
    },
    continueButtonDisabled: { backgroundColor: colors.surfaceElevated, shadowOpacity: 0, elevation: 0 },
    continueButtonText: { color: colors.white, fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
    continueButtonTextDisabled: { color: colors.textMuted },
  });
