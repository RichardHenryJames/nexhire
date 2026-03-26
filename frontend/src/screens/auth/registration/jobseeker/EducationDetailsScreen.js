import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authDarkColors } from '../../../../styles/authDarkColors';
import useResponsive from '../../../../hooks/useResponsive';
import refopenAPI from '../../../../services/api';
import { showToast } from '../../../../components/Toast';
import RegistrationWrapper from '../../../../components/auth/RegistrationWrapper';
import AnimatedFormStep from '../../../../components/auth/AnimatedFormStep';

// ─── Helpers ──────────────────────────────────────────────────
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

/** Strip dots, slashes, spaces for fuzzy matching: "btech" matches "B.Tech / B.E" */
const normalize = (s) => (s || '').toLowerCase().replace(/[.\s/\-_,()&]+/g, '');

// ─── Screen ───────────────────────────────────────────────────
export default function EducationDetailsScreen({ navigation, route }) {
  const colors = authDarkColors;
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const { userType, experienceType, workExperienceData, totalSteps = 3 } = route.params;

  // ─── Form state (slim: 3 fields) ────────────────────────────
  const [formData, setFormData] = useState({
    degreeType: '',
    degreeTypeKey: '',
    fieldOfStudy: '',
    graduationYear: '',
  });

  // ─── Reference data ──────────────────────────────────────────
  const [degreeTypes, setDegreeTypes] = useState([]);
  const [fieldsOfStudy, setFieldsOfStudy] = useState([]);
  const [loadingDegrees, setLoadingDegrees] = useState(true); // true: loading on mount
  const [loadingFields, setLoadingFields] = useState(false);

  // ─── Modal state ─────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [activeModal, setActiveModal] = useState(null); // 'degree' | 'field'
  const debouncedSearch = useDebounce(searchTerm, 300);

  // ─── Progressive reveal ──────────────────────────────────────
  const scrollRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(0); // 0=degree, 1=field, 2=gradYear+continue
  const stepLayouts = useRef({});

  const scrollToStep = useCallback((idx) => {
    setTimeout(() => {
      const y = stepLayouts.current[idx];
      if (y != null && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, y - 40), animated: true });
      }
    }, 250);
  }, []);

  const advanceTo = useCallback((step) => {
    setCurrentStep((prev) => {
      if (step > prev) { scrollToStep(step); return step; }
      return prev;
    });
  }, [scrollToStep]);

  // Degree selected → show field
  useEffect(() => {
    if (formData.degreeTypeKey) advanceTo(1);
  }, [formData.degreeTypeKey, advanceTo]);

  // Field selected → show gradYear
  useEffect(() => {
    if (formData.fieldOfStudy) advanceTo(2);
  }, [formData.fieldOfStudy, advanceTo]);

  // ─── Data loading ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoadingDegrees(true);
        const response = await refopenAPI.getBulkReferenceMetadata(['DegreeType']);
        if (response?.success && response.data?.DegreeType) {
          const items = response.data.DegreeType.filter((i) => i && i.Value).map((i) => ({
            id: i.Category || String(i.ReferenceID),
            name: i.Value,
            category: i.Description || 'Others',
          }));
          setDegreeTypes(items);
        }
      } catch (err) {
        console.error('Error loading degrees:', err);
      } finally {
        setLoadingDegrees(false);
      }
    })();
  }, []);

  const loadFieldsOfStudy = async (degreeKey) => {
    if (!degreeKey) { setFieldsOfStudy([]); return; }
    try {
      setLoadingFields(true);
      const response = await refopenAPI.getReferenceMetadata('FieldOfStudy', degreeKey);
      if (response.success && Array.isArray(response.data)) {
        setFieldsOfStudy(response.data.filter((i) => i && i.Value).map((i) => i.Value));
      }
    } catch (err) {
      console.error('Error loading fields:', err);
      setFieldsOfStudy([]);
    } finally {
      setLoadingFields(false);
    }
  };

  // ─── Filtered data for modals ────────────────────────────────
  const filteredData = useMemo(() => {
    if (activeModal === 'degree') {
      if (!debouncedSearch.trim()) {
        // Group by category
        const grouped = degreeTypes.reduce((acc, d) => {
          if (!acc[d.category]) acc[d.category] = [];
          acc[d.category].push(d);
          return acc;
        }, {});
        const result = [];
        Object.keys(grouped).forEach((cat) => {
          result.push({ type: 'header', category: cat });
          result.push(...grouped[cat]);
        });
        return result;
      }
      const s = normalize(debouncedSearch);
      return degreeTypes.filter((d) => normalize(d.name).includes(s) || normalize(d.category).includes(s));
    }
    if (activeModal === 'field') {
      if (!debouncedSearch.trim()) return fieldsOfStudy;
      const s = normalize(debouncedSearch);
      return fieldsOfStudy.filter((f) => normalize(f).includes(s));
    }
    return [];
  }, [activeModal, debouncedSearch, degreeTypes, fieldsOfStudy]);

  // ─── Validation ──────────────────────────────────────────────
  const isGradYearValid = /^\d{4}$/.test(String(formData.graduationYear || '').trim());
  const isContinueEnabled = Boolean(formData.degreeTypeKey && formData.fieldOfStudy && isGradYearValid);

  // ─── Handlers ────────────────────────────────────────────────
  const handleContinue = () => {
    if (!formData.degreeType) { showToast('Please select your degree type', 'error'); return; }
    if (!formData.fieldOfStudy) { showToast('Please select your field of study', 'error'); return; }
    if (!isGradYearValid) { showToast('Please enter a valid graduation year (YYYY)', 'error'); return; }

    const educationData = {
      degreeType: formData.degreeType,
      degreeTypeKey: formData.degreeTypeKey,
      fieldOfStudy: formData.fieldOfStudy,
      graduationYear: formData.graduationYear,
    };

    navigation.navigate('PersonalDetailsScreenDirect', {
      userType,
      experienceType,
      totalSteps,
      workExperienceData,
      educationData,
      fromGoogleAuth: route?.params?.fromGoogleAuth,
      googleUser: route?.params?.googleUser,
    });
  };

  const openModal = (type) => { setActiveModal(type); setSearchTerm(''); };
  const closeModal = () => { setActiveModal(null); setSearchTerm(''); };

  const handleSelection = (item, type) => {
    if (type === 'degree') {
      if (typeof item === 'string') {
        setFormData({ ...formData, degreeType: item, degreeTypeKey: '', fieldOfStudy: '' });
        setFieldsOfStudy([]);
      } else {
        setFormData({ ...formData, degreeType: item.name, degreeTypeKey: item.id, fieldOfStudy: '' });
        setFieldsOfStudy([]);
        loadFieldsOfStudy(item.id);
      }
    } else if (type === 'field') {
      setFormData({ ...formData, fieldOfStudy: item });
    }
    closeModal();
  };

  // ─── Display helpers ─────────────────────────────────────────
  const getModalTitle = () => activeModal === 'degree' ? 'Select Degree Type' : 'Select Field of Study';
  const getSearchPlaceholder = () => activeModal === 'degree' ? 'Search degree types...' : 'Search fields...';
  const isLoading = (activeModal === 'degree' && loadingDegrees) || (activeModal === 'field' && loadingFields);

  // ─── Shared ChoiceChip ───────────────────────────────────────
  const ChoiceChip = ({ value, placeholder, onPress, completed: done }) => (
    <TouchableOpacity
      style={[styles.choiceChip, done && styles.choiceChipCompleted]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.choiceChipInner}>
        <View style={styles.choiceChipLeft}>
          {done && (
            <View style={styles.choiceChipCheck}>
              <Ionicons name="checkmark" size={11} color="#fff" />
            </View>
          )}
          <Text style={[styles.choiceChipValue, !value && styles.choiceChipPlaceholder]} numberOfLines={1}>
            {value || placeholder}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.gray400} />
      </View>
    </TouchableOpacity>
  );

  // ─── Modal item renderer ─────────────────────────────────────
  const renderModalItem = ({ item, index }) => {
    if (item.type === 'header') {
      return (
        <View key={`h-${item.category}`} style={styles.categoryHeader}>
          <Text style={styles.categoryHeaderText}>{item.category}</Text>
        </View>
      );
    }
    const isDegree = activeModal === 'degree';
    const isString = typeof item === 'string';
    return (
      <TouchableOpacity
        key={`${activeModal}-${isString ? item : item.id}-${index}`}
        style={styles.modalItem}
        onPress={() => handleSelection(item, activeModal)}
        activeOpacity={0.7}
      >
        <View style={styles.modalItemContent}>
          <Text style={styles.modalItemText}>{isDegree ? item.name : item}</Text>
          {isDegree && item.category && <Text style={styles.modalItemSub}>{item.category}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const onStepLayout = (idx) => (e) => { stepLayouts.current[idx] = e.nativeEvent.layout.y; };

  // ─── RENDER ──────────────────────────────────────────────────
  const stepNumber = experienceType === 'Student' ? 2 : 3;

  return (
    <RegistrationWrapper
      currentStep={stepNumber}
      totalSteps={totalSteps}
      stepLabel="Education"
      onBack={() => navigation.goBack()}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.emoji}>🎓</Text>
            <Text style={styles.title}>Your education</Text>
            <Text style={styles.subtitle}>Just 3 quick questions about your academic background</Text>
          </View>

          {/* Step 0: Degree Type */}
          <AnimatedFormStep
            visible={currentStep >= 0}
            question="What degree are you pursuing?"
            completed={!!formData.degreeType}
            onLayout={onStepLayout(0)}
          >
            <ChoiceChip
              value={formData.degreeType}
              placeholder="Select degree type"
              onPress={() => openModal('degree')}
              completed={!!formData.degreeType}
            />
          </AnimatedFormStep>

          {/* Step 1: Field of Study */}
          <AnimatedFormStep
            visible={currentStep >= 1}
            question="What's your field of study?"
            helpText={formData.degreeType ? `Within ${formData.degreeType}` : undefined}
            completed={!!formData.fieldOfStudy}
            onLayout={onStepLayout(1)}
          >
            <ChoiceChip
              value={formData.fieldOfStudy}
              placeholder={`Select field for ${formData.degreeType || 'your degree'}`}
              onPress={() => {
                if (!fieldsOfStudy.length && !loadingFields) loadFieldsOfStudy(formData.degreeTypeKey);
                openModal('field');
              }}
              completed={!!formData.fieldOfStudy}
            />
          </AnimatedFormStep>

          {/* Step 2: Graduation Year + Continue */}
          <AnimatedFormStep
            visible={currentStep >= 2}
            question="Expected graduation year?"
            completed={isGradYearValid}
            onLayout={onStepLayout(2)}
          >
            <TextInput
              style={[styles.textInput, isGradYearValid && styles.textInputCompleted]}
              placeholder={experienceType === 'Student' ? 'e.g. 2025 (expected)' : 'e.g. 2022'}
              placeholderTextColor={colors.textMuted}
              value={formData.graduationYear}
              onChangeText={(text) => setFormData({ ...formData, graduationYear: text })}
              keyboardType="numeric"
              maxLength={6}
            />
          </AnimatedFormStep>

          {/* Continue Button */}
          {isGradYearValid && (
            <Animated.View style={styles.continueWrap}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipText}>{formData.degreeType}</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipText}>{formData.fieldOfStudy}</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipText}>{formData.graduationYear}</Text>
                </View>
              </View>

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

      {/* ── Universal Modal ─────────────────────────────────── */}
      <Modal visible={activeModal !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalAccentLine} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{getModalTitle()}</Text>
              <View style={{ width: 36 }} />
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={colors.gray400} />
              <TextInput
                style={styles.searchInput}
                placeholder={getSearchPlaceholder()}
                placeholderTextColor={colors.gray400}
                value={searchTerm}
                onChangeText={setSearchTerm}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={18} color={colors.gray400} />
                </TouchableOpacity>
              )}
            </View>

            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            )}

            {!isLoading && (
              <FlatList
                data={filteredData}
                keyExtractor={(item, index) => `${activeModal}-${typeof item === 'string' ? item : item.id || item.category}-${index}`}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={renderModalItem}
                ListEmptyComponent={() => (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="school" size={48} color={colors.gray400} />
                    <Text style={styles.emptyText}>
                      {debouncedSearch ? `No results for "${debouncedSearch}"` : 'No items available'}
                    </Text>
                  </View>
                )}
                initialNumToRender={20}
                maxToRenderPerBatch={10}
                windowSize={5}
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
    scrollContent: { flexGrow: 1, paddingBottom: 60 },
    content: {
      width: '100%',
      maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 560 : '100%',
      padding: 24, paddingTop: 12, alignSelf: 'center',
    },
    header: { marginBottom: 36 },
    emoji: { fontSize: 36, marginBottom: 12 },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.4, marginBottom: 6 },
    subtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },

    choiceChip: {
      backgroundColor: colors.inputBackground, borderRadius: 14,
      paddingVertical: 16, paddingHorizontal: 18,
      borderWidth: 1.5, borderColor: colors.border,
    },
    choiceChipCompleted: { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.05)' },
    choiceChipInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    choiceChipLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
    choiceChipCheck: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
    choiceChipValue: { fontSize: 15, color: colors.text, fontWeight: '500', flex: 1 },
    choiceChipPlaceholder: { color: colors.textMuted, fontWeight: '400' },

    textInput: {
      backgroundColor: colors.inputBackground, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, fontSize: 15, color: colors.text,
    },
    textInputCompleted: { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.05)' },

    continueWrap: { marginTop: 8 },
    summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    summaryChip: { backgroundColor: colors.primaryGlow, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.primaryGlowStrong },
    summaryChipText: { fontSize: 12, fontWeight: '600', color: colors.primaryLight },
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
    modalAccentLine: {
      height: 3, width: '100%',
      backgroundColor: colors.primary,
    },
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
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    loadingText: { fontSize: 14, color: colors.textSecondary, marginTop: 16 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 16 },
    modalItem: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, paddingHorizontal: 20,
      borderBottomWidth: 1, borderBottomColor: colors.borderFaint, minHeight: 56,
    },
    modalItemContent: { flex: 1 },
    modalItemText: { fontSize: 15, fontWeight: '500', color: colors.text, marginBottom: 2 },
    modalItemSub: { fontSize: 13, color: colors.textMuted },
    categoryHeader: { backgroundColor: colors.primaryGlow, paddingVertical: 8, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.borderFaint },
    categoryHeaderText: { fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  });
