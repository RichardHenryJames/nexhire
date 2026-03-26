import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
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

/** Strip dots, slashes, spaces for fuzzy matching: "btech" matches "B.Tech / B.E" */
const normalize = (s) => (s || '').toLowerCase().replace(/[.\s/\-_,()&]+/g, '');

export default function EducationDetailsScreen({ navigation, route }) {
  const colors = authDarkColors;
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  const { userType, experienceType, workExperienceData, totalSteps = 3 } = route.params;

  // ─── Form state ──────────────────────────────────────────────
  const [degreeType, setDegreeType] = useState('');
  const [degreeTypeKey, setDegreeTypeKey] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [graduationYear, setGraduationYear] = useState('');

  // ─── Degree dropdown ─────────────────────────────────────────
  const [degreeTypes, setDegreeTypes] = useState([]);
  const [loadingDegrees, setLoadingDegrees] = useState(true);
  const [degreeSearch, setDegreeSearch] = useState('');
  const [showDegreeDropdown, setShowDegreeDropdown] = useState(false);

  // ─── Field of study dropdown ─────────────────────────────────
  const [fieldsOfStudy, setFieldsOfStudy] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);

  // ─── Progressive reveal ──────────────────────────────────────
  const scrollRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(0); // 0=degree, 1=field, 2=gradYear

  const advanceTo = useCallback((step) => {
    setCurrentStep((prev) => (step > prev ? step : prev));
  }, []);

  // Degree selected + dropdown closed → show field
  useEffect(() => {
    if (degreeTypeKey && !showDegreeDropdown) advanceTo(1);
  }, [degreeTypeKey, showDegreeDropdown, advanceTo]);

  // Field selected + dropdown closed → show gradYear
  useEffect(() => {
    if (fieldOfStudy && !showFieldDropdown) advanceTo(2);
  }, [fieldOfStudy, showFieldDropdown, advanceTo]);

  // ─── Load degree types on mount ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoadingDegrees(true);
        const response = await refopenAPI.getBulkReferenceMetadata(['DegreeType']);
        if (response?.success && response.data?.DegreeType) {
          setDegreeTypes(
            response.data.DegreeType.filter((i) => i?.Value).map((i) => ({
              id: i.Category || String(i.ReferenceID),
              name: i.Value,
              category: i.Description || 'Others',
            }))
          );
        }
      } catch (err) {
        console.error('Error loading degrees:', err);
      } finally {
        setLoadingDegrees(false);
      }
    })();
  }, []);

  // ─── Load fields when degree changes ─────────────────────────
  const loadFieldsOfStudy = async (key) => {
    if (!key) { setFieldsOfStudy([]); return; }
    try {
      setLoadingFields(true);
      const response = await refopenAPI.getReferenceMetadata('FieldOfStudy', key);
      if (response.success && Array.isArray(response.data)) {
        setFieldsOfStudy(response.data.filter((i) => i?.Value).map((i) => i.Value));
      }
    } catch (err) {
      setFieldsOfStudy([]);
    } finally {
      setLoadingFields(false);
    }
  };

  // ─── Filtered lists ──────────────────────────────────────────
  const filteredDegrees = useMemo(() => {
    if (!degreeSearch.trim()) return degreeTypes;
    const s = normalize(degreeSearch);
    return degreeTypes.filter((d) => normalize(d.name).includes(s) || normalize(d.category).includes(s));
  }, [degreeSearch, degreeTypes]);

  const filteredFields = useMemo(() => {
    if (!fieldSearch.trim()) return fieldsOfStudy;
    const s = normalize(fieldSearch);
    return fieldsOfStudy.filter((f) => normalize(f).includes(s));
  }, [fieldSearch, fieldsOfStudy]);

  // ─── Handlers ────────────────────────────────────────────────
  const handleSelectDegree = (item) => {
    setDegreeType(item.name);
    setDegreeTypeKey(item.id);
    setDegreeSearch('');
    setShowDegreeDropdown(false);
    // Reset field since it depends on degree
    setFieldOfStudy('');
    setFieldSearch('');
    setFieldsOfStudy([]);
    loadFieldsOfStudy(item.id);
    advanceTo(1);
  };

  const handleSelectField = (item) => {
    setFieldOfStudy(item);
    setFieldSearch('');
    setShowFieldDropdown(false);
    advanceTo(2);
  };

  const isGradYearValid = /^\d{4}$/.test(String(graduationYear || '').trim());
  const isContinueEnabled = Boolean(degreeTypeKey && fieldOfStudy && isGradYearValid);

  const handleContinue = () => {
    if (!degreeType) { showToast('Please select your degree type', 'error'); return; }
    if (!fieldOfStudy) { showToast('Please select your field of study', 'error'); return; }
    if (!isGradYearValid) { showToast('Enter a valid graduation year (YYYY)', 'error'); return; }

    navigation.navigate('PersonalDetailsScreenDirect', {
      userType,
      experienceType,
      totalSteps,
      workExperienceData,
      educationData: { degreeType, degreeTypeKey, fieldOfStudy, graduationYear },
      fromGoogleAuth: route?.params?.fromGoogleAuth,
      googleUser: route?.params?.googleUser,
    });
  };

  const stepNumber = experienceType === 'Student' ? 2 : 3;

  // ─── RENDER ──────────────────────────────────────────────────
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
            <Text style={styles.subtitle}>Just 3 quick questions</Text>
          </View>

          {/* ── Step 0: Degree Type (inline dropdown) ──── */}
          <AnimatedFormStep
            visible={currentStep >= 0}
            question="What degree are you pursuing?"
            completed={!!degreeType && !showDegreeDropdown}
          >
            <View style={{ position: 'relative', zIndex: 3000 }}>
              <TextInput
                style={[styles.textInput, degreeType && !showDegreeDropdown && styles.textInputCompleted]}
                placeholder="Search degree type..."
                placeholderTextColor={colors.textMuted}
                value={showDegreeDropdown ? degreeSearch : degreeType}
                onChangeText={(text) => {
                  setDegreeSearch(text);
                  if (!showDegreeDropdown) {
                    setShowDegreeDropdown(true);
                    setDegreeType('');
                    setDegreeTypeKey('');
                  }
                }}
                onFocus={() => {
                  setShowDegreeDropdown(true);
                  setDegreeSearch('');
                }}
                autoCorrect={false}
              />
              {degreeType && !showDegreeDropdown && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => { setDegreeType(''); setDegreeTypeKey(''); setShowDegreeDropdown(true); setDegreeSearch(''); }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.gray400} />
                </TouchableOpacity>
              )}

              {showDegreeDropdown && (
                <View style={styles.dropdownContainer}>
                  {loadingDegrees ? (
                    <View style={styles.dropdownLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.dropdownLoadingText}>Loading degrees...</Text>
                    </View>
                  ) : filteredDegrees.length > 0 ? (
                    <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {filteredDegrees.slice(0, 20).map((item, idx) => (
                        <TouchableOpacity
                          key={`deg-${item.id}-${idx}`}
                          style={styles.dropdownItem}
                          onPress={() => handleSelectDegree(item)}
                        >
                          <Text style={styles.dropdownItemText}>{item.name}</Text>
                          <Text style={styles.dropdownItemSub}>{item.category}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.dropdownEmpty}>
                      <Text style={styles.dropdownEmptyText}>
                        {degreeSearch ? `No results for "${degreeSearch}"` : 'No degree types available'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </AnimatedFormStep>

          {/* ── Step 1: Field of Study (inline dropdown) ── */}
          <AnimatedFormStep
            visible={currentStep >= 1}
            question="What's your field of study?"
            helpText={degreeType ? `Within ${degreeType}` : undefined}
            completed={!!fieldOfStudy && !showFieldDropdown}
          >
            <View style={{ position: 'relative', zIndex: 2000 }}>
              <TextInput
                style={[styles.textInput, fieldOfStudy && !showFieldDropdown && styles.textInputCompleted]}
                placeholder={`Search field for ${degreeType || 'your degree'}...`}
                placeholderTextColor={colors.textMuted}
                value={showFieldDropdown ? fieldSearch : fieldOfStudy}
                onChangeText={(text) => {
                  setFieldSearch(text);
                  if (!showFieldDropdown) {
                    setShowFieldDropdown(true);
                    setFieldOfStudy('');
                  }
                }}
                onFocus={() => {
                  setShowFieldDropdown(true);
                  setFieldSearch('');
                  if (!fieldsOfStudy.length && degreeTypeKey && !loadingFields) {
                    loadFieldsOfStudy(degreeTypeKey);
                  }
                }}
                autoCorrect={false}
              />
              {fieldOfStudy && !showFieldDropdown && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => { setFieldOfStudy(''); setShowFieldDropdown(true); setFieldSearch(''); }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.gray400} />
                </TouchableOpacity>
              )}

              {showFieldDropdown && (
                <View style={styles.dropdownContainer}>
                  {loadingFields ? (
                    <View style={styles.dropdownLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.dropdownLoadingText}>Loading fields...</Text>
                    </View>
                  ) : filteredFields.length > 0 ? (
                    <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {filteredFields.slice(0, 20).map((item, idx) => (
                        <TouchableOpacity
                          key={`field-${item}-${idx}`}
                          style={styles.dropdownItem}
                          onPress={() => handleSelectField(item)}
                        >
                          <Text style={styles.dropdownItemText}>{item}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.dropdownEmpty}>
                      <Text style={styles.dropdownEmptyText}>
                        {fieldSearch ? `No results for "${fieldSearch}"` : 'No fields available'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </AnimatedFormStep>

          {/* ── Step 2: Graduation Year ─────────────────── */}
          <AnimatedFormStep
            visible={currentStep >= 2}
            question="Expected graduation year?"
            completed={isGradYearValid}
          >
            <TextInput
              style={[styles.textInput, isGradYearValid && styles.textInputCompleted]}
              placeholder={experienceType === 'Student' ? 'e.g. 2025 (expected)' : 'e.g. 2022'}
              placeholderTextColor={colors.textMuted}
              value={graduationYear}
              onChangeText={setGraduationYear}
              keyboardType="numeric"
              maxLength={6}
            />
          </AnimatedFormStep>

          {/* ── Continue ────────────────────────────────── */}
          {isGradYearValid && (
            <Animated.View style={styles.continueWrap}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipText}>{degreeType}</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipText}>{fieldOfStudy}</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipText}>{graduationYear}</Text>
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

    textInput: {
      backgroundColor: colors.inputBackground, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18,
      paddingRight: 44, // room for clear button
      fontSize: 15, color: colors.text,
    },
    textInputCompleted: { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.05)' },
    clearBtn: {
      position: 'absolute', right: 14, top: 0, bottom: 0,
      justifyContent: 'center',
    },

    /* Dropdown */
    dropdownContainer: {
      position: 'absolute', top: '100%', left: 0, right: 0,
      backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
      borderRadius: 14, marginTop: 6, maxHeight: 280, zIndex: 9999, elevation: 10,
      shadowColor: colors.black, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16,
      overflow: 'hidden',
    },
    dropdownScroll: { maxHeight: 280 },
    dropdownItem: {
      paddingVertical: 14, paddingHorizontal: 18,
      borderBottomWidth: 1, borderBottomColor: colors.borderFaint,
    },
    dropdownItemText: { fontSize: 15, fontWeight: '500', color: colors.text },
    dropdownItemSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    dropdownLoading: {
      padding: 24, alignItems: 'center', gap: 8,
    },
    dropdownLoadingText: { fontSize: 13, color: colors.textMuted },
    dropdownEmpty: { padding: 24, alignItems: 'center' },
    dropdownEmptyText: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },

    /* Summary + Continue */
    continueWrap: { marginTop: 8 },
    summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    summaryChip: {
      backgroundColor: colors.primaryGlow, borderRadius: 20,
      paddingVertical: 6, paddingHorizontal: 14,
      borderWidth: 1, borderColor: colors.primaryGlowStrong,
    },
    summaryChipText: { fontSize: 12, fontWeight: '600', color: colors.primaryLight },
    continueButton: {
      backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 18, paddingHorizontal: 24, borderRadius: 16, gap: 8,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
    },
    continueButtonDisabled: { backgroundColor: colors.surfaceElevated, shadowOpacity: 0, elevation: 0 },
    continueButtonText: { color: colors.white, fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
    continueButtonTextDisabled: { color: colors.textMuted },
  });
