import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authDarkColors } from '../../../../styles/authDarkColors';
import useResponsive from '../../../../hooks/useResponsive';
import refopenAPI from '../../../../services/api';
import { showToast } from '../../../../components/Toast';
import RegistrationWrapper from '../../../../components/auth/RegistrationWrapper';
import AnimatedFormStep from '../../../../components/auth/AnimatedFormStep';

// Debounce hook
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

  // ─── Form (slim: 2 fields) ──────────────────────────────────
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [organizationId, setOrganizationId] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null); // full org for logo

  // ─── Job role dropdown ───────────────────────────────────────
  const [jobRoles, setJobRoles] = useState([]);
  const [loadingJobRoles, setLoadingJobRoles] = useState(false);
  const [showJobTitleDropdown, setShowJobTitleDropdown] = useState(false);
  const [jobTitleSearch, setJobTitleSearch] = useState('');

  // ─── Company picker modal ────────────────────────────────────
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgQuery, setOrgQuery] = useState('');
  const debouncedOrgQuery = useDebounce(orgQuery, 300);
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [manualOrgMode, setManualOrgMode] = useState(false);

  // ─── Progressive reveal ──────────────────────────────────────
  const scrollRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(0); // 0=jobTitle, 1=company+continue

  const advanceTo = useCallback((step) => {
    setCurrentStep((prev) => (step > prev ? step : prev));
  }, []);

  useEffect(() => {
    if (jobTitle.trim().length >= 2) advanceTo(1);
  }, [jobTitle, advanceTo]);

  // ─── Load job roles ──────────────────────────────────────────
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

  // ─── Organization search ─────────────────────────────────────
  useEffect(() => {
    if (!showOrgModal || manualOrgMode) return;
    (async () => {
      try {
        setOrgLoading(true);
        const res = await refopenAPI.getOrganizations(debouncedOrgQuery || '', null);
        const raw = res?.success && Array.isArray(res.data) ? res.data : [];
        if (debouncedOrgQuery?.trim()) {
          const s = debouncedOrgQuery.toLowerCase();
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
  }, [debouncedOrgQuery, showOrgModal, manualOrgMode]);

  // ─── Handlers ────────────────────────────────────────────────
  const handleSelectOrg = (org) => {
    setOrganizationId(org.id);
    setCompanyName(org.name);
    setSelectedOrg(org);
    setShowOrgModal(false);
  };

  const handleContinue = () => {
    if (!jobTitle.trim()) {
      showToast('Please enter your job title', 'error');
      return;
    }

    const workExperienceData = [{
      jobTitle: jobTitle.trim(),
      companyName: companyName?.trim() || null,
      organizationId: organizationId || null,
      isCurrentPosition: true,
    }];

    navigation.navigate('EducationDetailsScreen', {
      userType,
      experienceType,
      totalSteps,
      workExperienceData,
      fromGoogleAuth: route?.params?.fromGoogleAuth,
      googleUser: route?.params?.googleUser,
    });
  };

  const isContinueEnabled = jobTitle.trim().length >= 2;

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
          <View style={styles.header}>
            <Text style={styles.emoji}>💼</Text>
            <Text style={styles.title}>Where do you work?</Text>
            <Text style={styles.subtitle}>Just 2 quick things — we'll use this for matching</Text>
          </View>

          {/* Step 0: Job Title */}
          <AnimatedFormStep
            visible={currentStep >= 0}
            question="What's your current role?"
            completed={jobTitle.trim().length >= 2}
          >
            <View style={{ position: 'relative', zIndex: 1000 }}>
              <TextInput
                style={[styles.textInput, jobTitle.trim().length >= 2 && styles.textInputCompleted]}
                placeholder="e.g. Software Engineer, Marketing Manager"
                placeholderTextColor={colors.textMuted}
                value={jobTitleSearch || jobTitle}
                onChangeText={(text) => {
                  setJobTitleSearch(text);
                  setJobTitle(text);
                  setShowJobTitleDropdown(text.length > 0);
                }}
                onFocus={() => { if (jobTitle) setJobTitleSearch(''); }}
                autoCorrect={false}
                spellCheck={false}
              />
              {showJobTitleDropdown && jobTitleSearch.length > 0 && (() => {
                const matches = jobRoles.filter((r) => r.Value?.toLowerCase().includes(jobTitleSearch.toLowerCase()));
                if (loadingJobRoles) return (
                  <View style={styles.dropdownContainer}>
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  </View>
                );
                if (matches.length > 0) return (
                  <View style={styles.dropdownContainer}>
                    <ScrollView style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled">
                      {matches.slice(0, 15).map((role) => (
                        <TouchableOpacity
                          key={role.ReferenceID}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setJobTitle(role.Value);
                            setJobTitleSearch('');
                            setShowJobTitleDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{role.Value}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                );
                return null;
              })()}
            </View>
          </AnimatedFormStep>

          {/* Step 1: Company + Continue */}
          <AnimatedFormStep
            visible={currentStep >= 1}
            question="Which company?"
            helpText="Optional — you can add this later"
            completed={!!companyName}
            skippable={!companyName}
            onSkip={() => {}} // no-op, company is optional
          >
            <TouchableOpacity
              style={[styles.choiceChip, companyName && styles.choiceChipCompleted]}
              onPress={() => { setShowOrgModal(true); setManualOrgMode(false); setOrgQuery(''); }}
              activeOpacity={0.7}
            >
              <View style={styles.choiceChipInner}>
                <View style={styles.choiceChipLeft}>
                  {selectedOrg?.logoURL ? (
                    <Image source={{ uri: selectedOrg.logoURL }} style={styles.orgLogo} resizeMode="contain" />
                  ) : companyName ? (
                    <View style={styles.orgLogoPlaceholder}>
                      <Ionicons name="business" size={14} color={colors.gray400} />
                    </View>
                  ) : null}
                  <Text style={[styles.choiceChipValue, !companyName && styles.choiceChipPlaceholder]} numberOfLines={1}>
                    {companyName || 'Select or search company'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={colors.gray400} />
              </View>
            </TouchableOpacity>
          </AnimatedFormStep>

          {/* Continue Button */}
          {currentStep >= 1 && (
            <Animated.View style={styles.continueWrap}>
              <TouchableOpacity
                style={[styles.continueButton, !isContinueEnabled && styles.continueButtonDisabled]}
                onPress={handleContinue}
                disabled={!isContinueEnabled}
                activeOpacity={0.85}
              >
                <Text style={[styles.continueButtonText, !isContinueEnabled && styles.continueButtonTextDisabled]}>
                  Continue
                </Text>
                <Ionicons name="arrow-forward" size={18} color={isContinueEnabled ? colors.white : colors.textMuted} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* Company Picker Modal */}
      <Modal visible={showOrgModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowOrgModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalAccentLine} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowOrgModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Company</Text>
              <View style={{ width: 36 }} />
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={colors.gray400} />
              <TextInput
                style={styles.searchInput}
                placeholder={manualOrgMode ? 'Type company name' : 'Search companies...'}
                placeholderTextColor={colors.gray400}
                value={orgQuery}
                onChangeText={setOrgQuery}
                autoCapitalize="words"
              />
              {manualOrgMode ? (
                <TouchableOpacity
                  onPress={() => {
                    const name = orgQuery.trim();
                    if (!name) { showToast('Type company name', 'error'); return; }
                    setOrganizationId(null);
                    setCompanyName(name);
                    setSelectedOrg(null);
                    setShowOrgModal(false);
                  }}
                >
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                </TouchableOpacity>
              ) : orgLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : null}
            </View>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}
              onPress={() => setManualOrgMode((v) => !v)}
            >
              <Ionicons name={manualOrgMode ? 'checkbox-outline' : 'square-outline'} size={18} color={colors.primary} />
              <Text style={{ color: colors.text, marginLeft: 8, fontSize: 14 }}>
                {manualOrgMode ? 'Type name above and tap ✓' : "Can't find your company? Enter manually"}
              </Text>
            </TouchableOpacity>

            {!manualOrgMode && (
              <FlatList
                data={orgResults}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.orgItem} onPress={() => handleSelectOrg(item)}>
                    {item.logoURL ? (
                      <Image source={{ uri: item.logoURL }} style={styles.orgItemLogo} resizeMode="contain" />
                    ) : (
                      <View style={styles.orgItemLogoPlaceholder}>
                        <Ionicons name="business" size={20} color={colors.gray400} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orgItemName}>{item.name}</Text>
                      {item.industry && item.industry !== 'Other' && (
                        <Text style={styles.orgItemIndustry}>{item.industry}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.gray500} />
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews
                windowSize={8}
              />
            )}
          </View>
        </View>
      </Modal>
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
      borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, fontSize: 15, color: colors.text,
    },
    textInputCompleted: { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.05)' },

    choiceChip: {
      backgroundColor: colors.inputBackground, borderRadius: 14,
      paddingVertical: 16, paddingHorizontal: 18,
      borderWidth: 1.5, borderColor: colors.border,
    },
    choiceChipCompleted: { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.05)' },
    choiceChipInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    choiceChipLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
    choiceChipValue: { fontSize: 15, color: colors.text, fontWeight: '500', flex: 1 },
    choiceChipPlaceholder: { color: colors.textMuted, fontWeight: '400' },
    orgLogo: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.white },
    orgLogoPlaceholder: { width: 24, height: 24, borderRadius: 6, backgroundColor: colors.borderFaint, alignItems: 'center', justifyContent: 'center' },

    dropdownContainer: {
      position: 'absolute', top: '100%', left: 0, right: 0,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, marginTop: 4, maxHeight: 250, zIndex: 9999, elevation: 10,
      shadowColor: colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12,
    },
    dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: colors.borderFaint },
    dropdownItemText: { fontSize: 15, color: colors.text },

    continueWrap: { marginTop: 24 },
    continueButton: {
      backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 18, paddingHorizontal: 24, borderRadius: 16, gap: 8,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
    },
    continueButtonDisabled: { backgroundColor: colors.surfaceElevated, shadowOpacity: 0, elevation: 0 },
    continueButtonText: { color: colors.white, fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
    continueButtonTextDisabled: { color: colors.textMuted },

    /* Modal */
    modalOverlay: {
      flex: 1, backgroundColor: colors.background,
      ...(Platform.OS === 'web' && responsive.isDesktop ? {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      } : {}),
    },
    modalCard: {
      flex: 1, backgroundColor: colors.surface,
      ...(Platform.OS === 'web' && responsive.isDesktop ? {
        flex: 'none', width: '100%', maxWidth: 560, height: '75vh',
        borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        borderWidth: 1, borderColor: colors.borderSubtle,
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
      } : {}),
    },
    modalAccentLine: { height: 3, width: '100%', backgroundColor: colors.primary },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 16,
      paddingTop: Platform.OS === 'ios' ? 56 : 16,
      borderBottomWidth: 1, borderBottomColor: colors.borderThin,
    },
    modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.overlayLight, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center', marginHorizontal: 8 },
    searchContainer: {
      flexDirection: 'row', alignItems: 'center', margin: 16,
      backgroundColor: colors.inputBackground, borderRadius: 12, paddingHorizontal: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 15, color: colors.text },
    orgItem: {
      flexDirection: 'row', alignItems: 'center', padding: 16, marginHorizontal: 12, marginBottom: 6,
      backgroundColor: colors.surfaceElevated, borderRadius: 12, borderWidth: 1, borderColor: colors.borderFaint,
    },
    orgItemLogo: { width: 40, height: 40, borderRadius: 10, marginRight: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderThin },
    orgItemLogoPlaceholder: { width: 40, height: 40, borderRadius: 10, marginRight: 12, backgroundColor: colors.borderFaint, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderThin },
    orgItemName: { fontSize: 15, fontWeight: '600', color: colors.text },
    orgItemIndustry: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  });
