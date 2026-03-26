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

// ─── Debounce hook ────────────────────────────────────────────
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

export default function EducationDetailsScreen({ navigation, route }) {
  const colors = authDarkColors;
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // ─── Form state ──────────────────────────────────────────────
  const [formData, setFormData] = useState({
    college: null,
    customCollege: '',
    degreeType: '',
    degreeTypeKey: '',
    fieldOfStudy: '',
    yearInCollege: '',
    selectedCountry: 'India',
    graduationYear: '',
    gpa: '',
  });

  // ─── Reference data state ────────────────────────────────────
  const [degreeTypes, setDegreeTypes] = useState([]);
  const [fieldsOfStudy, setFieldsOfStudy] = useState([]);
  const [yearsInCollege, setYearsInCollege] = useState([]);
  const [loadingDegrees, setLoadingDegrees] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);

  const [allColleges, setAllColleges] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [error, setError] = useState(null);

  // ─── Modal state ─────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [activeModal, setActiveModal] = useState(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const modalRefs = useRef({
    college: false,
    country: false,
    degree: false,
    field: false,
    year: false,
  });

  const { userType, experienceType, workExperienceData } = route.params;

  // ─── Progressive reveal state ────────────────────────────────
  // Steps: 0=country, 1=college, 2=degree, 3=field, 4=year(students), 5=gradYear, 6=gpa+continue
  const scrollRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(0);
  const stepLayouts = useRef({});

  // Auto-scroll to newly revealed step
  const scrollToStep = useCallback((stepIdx) => {
    setTimeout(() => {
      const y = stepLayouts.current[stepIdx];
      if (y != null && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, y - 40), animated: true });
      }
    }, 250);
  }, []);

  const advanceTo = useCallback((step) => {
    setCurrentStep((prev) => {
      if (step > prev) {
        scrollToStep(step);
        return step;
      }
      return prev;
    });
  }, [scrollToStep]);

  // ─── Progressive reveal triggers ────────────────────────────
  // Country is pre-filled → auto-advance to college on mount
  useEffect(() => {
    if (formData.selectedCountry) {
      const timer = setTimeout(() => advanceTo(1), 350);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSkipCollege = useCallback(() => {
    advanceTo(2);
  }, [advanceTo]);

  // When college is selected → advance to degree
  useEffect(() => {
    if (formData.college) advanceTo(2);
  }, [formData.college, advanceTo]);

  // Degree selected → advance to field of study
  useEffect(() => {
    if (formData.degreeTypeKey) advanceTo(3);
  }, [formData.degreeTypeKey, advanceTo]);

  // Field selected → advance to year (students) or gradYear (experienced)
  useEffect(() => {
    if (formData.fieldOfStudy) {
      advanceTo(experienceType === 'Student' ? 4 : 5);
    }
  }, [formData.fieldOfStudy, experienceType, advanceTo]);

  // Year selected (students) → advance to gradYear
  useEffect(() => {
    if (formData.yearInCollege) advanceTo(5);
  }, [formData.yearInCollege, advanceTo]);

  // Graduation year entered → advance to GPA + Continue
  useEffect(() => {
    if (/^\d{4}$/.test(String(formData.graduationYear || '').trim())) advanceTo(6);
  }, [formData.graduationYear, advanceTo]);

  // ─── Data loading ────────────────────────────────────────────
  useEffect(() => {
    loadCountries();
    loadColleges();
    loadEducationReferenceData();
  }, []);

  useEffect(() => {
    if (formData.selectedCountry) loadColleges();
  }, [formData.selectedCountry]);

  const loadReferenceTypes = async (types) => {
    const wantsDegrees = Array.isArray(types) && types.includes('DegreeType');
    const wantsYears = Array.isArray(types) && types.includes('YearInCollege');

    try {
      if (wantsDegrees) setLoadingDegrees(true);
      if (wantsYears) setLoadingYears(true);

      const response = await refopenAPI.getBulkReferenceMetadata(types);
      if (!response?.success || !response?.data) {
        throw new Error(response?.error || 'Failed to load reference metadata');
      }

      if (wantsDegrees) {
        const items = Array.isArray(response.data.DegreeType) ? response.data.DegreeType : [];
        const transformed = items
          .filter((item) => item && item.Value)
          .map((item) => ({
            id: item.Category || String(item.ReferenceID),
            name: item.Value,
            category: item.Description || 'Others',
          }));
        setDegreeTypes(transformed);
      }

      if (wantsYears) {
        const items = Array.isArray(response.data.YearInCollege) ? response.data.YearInCollege : [];
        const transformed = items.filter((item) => item && item.Value).map((item) => item.Value);
        setYearsInCollege(transformed);
      }
    } catch (err) {
      console.error('Error loading reference metadata:', err);
      if (wantsDegrees) setDegreeTypes([]);
      if (wantsYears) setYearsInCollege([]);
    } finally {
      if (wantsDegrees) setLoadingDegrees(false);
      if (wantsYears) setLoadingYears(false);
    }
  };

  const loadEducationReferenceData = () => loadReferenceTypes(['DegreeType', 'YearInCollege']);

  const loadFieldsOfStudy = async (degreeKey) => {
    if (!degreeKey) {
      setFieldsOfStudy([]);
      return;
    }
    try {
      setLoadingFields(true);
      const response = await refopenAPI.getReferenceMetadata('FieldOfStudy', degreeKey);
      if (response.success && Array.isArray(response.data)) {
        setFieldsOfStudy(response.data.filter((i) => i && i.Value).map((i) => i.Value));
      } else {
        throw new Error(response.error || 'Failed to load fields of study');
      }
    } catch (err) {
      console.error('Error loading fields of study:', err);
      setFieldsOfStudy([]);
    } finally {
      setLoadingFields(false);
    }
  };

  const loadCountries = async () => {
    try {
      setLoadingCountries(true);
      const response = await refopenAPI.getCountries();
      if (response.success && response.data.countries) {
        setCountries(
          response.data.countries.map((c) => ({
            code: c.name,
            name: c.name,
            flag: c.flag,
            region: c.region,
            id: c.id,
          }))
        );
      } else {
        throw new Error(response.error || 'Failed to load countries');
      }
    } catch (err) {
      console.error('Error loading countries:', err);
      setCountries([
        { code: 'India', name: 'India', flag: '🇮🇳', region: 'Asia' },
        { code: 'United States', name: 'United States', flag: '🇺🇸', region: 'Americas' },
        { code: 'United Kingdom', name: 'United Kingdom', flag: '🇬🇧', region: 'Europe' },
        { code: 'Canada', name: 'Canada', flag: '🇨🇦', region: 'Americas' },
        { code: 'Australia', name: 'Australia', flag: '🇦🇺', region: 'Oceania' },
        { code: 'Germany', name: 'Germany', flag: '🇩🇪', region: 'Europe' },
        { code: 'Singapore', name: 'Singapore', flag: '🇸🇬', region: 'Asia' },
      ]);
    } finally {
      setLoadingCountries(false);
    }
  };

  const loadColleges = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await refopenAPI.getColleges(formData.selectedCountry);
      if (response.success) {
        setAllColleges(
          response.data.map((inst) => ({
            id: inst.id,
            name: inst.name,
            type: inst.type,
            country: inst.country,
            state: inst.state,
            city: inst.city,
            website: inst.website,
            domains: inst.domains || [],
            establishedYear: inst.establishedYear,
            globalRanking: inst.globalRanking,
            description: inst.description,
            alpha_two_code: inst.alpha_two_code,
          }))
        );
      } else {
        throw new Error(response.error || 'Failed to load institutions');
      }
    } catch (err) {
      console.error('Error loading colleges:', err);
      setError(err.message);
      setAllColleges([{ id: 999999, name: 'Other', type: 'Other', country: 'Various' }]);
    } finally {
      setLoading(false);
    }
  };

  // ─── Filtered data for modals ────────────────────────────────
  const filteredData = useMemo(() => {
    if (activeModal === 'college') {
      if (!debouncedSearchTerm.trim()) return allColleges;
      const s = debouncedSearchTerm.toLowerCase();
      return allColleges.filter(
        (c) =>
          c.id === 999999 ||
          c.name.toLowerCase().includes(s) ||
          (c.country && c.country.toLowerCase().includes(s)) ||
          (c.state && c.state.toLowerCase().includes(s)) ||
          (c.type && c.type.toLowerCase().includes(s))
      );
    }
    if (activeModal === 'country') {
      if (!debouncedSearchTerm.trim()) return countries;
      const s = debouncedSearchTerm.toLowerCase();
      return countries.filter(
        (c) => c.name.toLowerCase().includes(s) || (c.region && c.region.toLowerCase().includes(s))
      );
    }
    if (activeModal === 'degree') {
      if (!debouncedSearchTerm.trim()) {
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
      const s = debouncedSearchTerm.toLowerCase();
      return degreeTypes.filter(
        (d) => d.name.toLowerCase().includes(s) || d.category.toLowerCase().includes(s)
      );
    }
    if (activeModal === 'field') {
      if (!debouncedSearchTerm.trim()) return fieldsOfStudy;
      const s = debouncedSearchTerm.toLowerCase();
      return fieldsOfStudy.filter((f) => f.toLowerCase().includes(s));
    }
    if (activeModal === 'year') {
      if (!debouncedSearchTerm.trim()) return yearsInCollege;
      const s = debouncedSearchTerm.toLowerCase();
      return yearsInCollege.filter((y) => y.toLowerCase().includes(s));
    }
    return [];
  }, [activeModal, debouncedSearchTerm, allColleges, countries, degreeTypes, fieldsOfStudy, yearsInCollege]);

  // ─── Validation helpers ──────────────────────────────────────
  const isGraduationYearValid = /^\d{4}$/.test(String(formData.graduationYear || '').trim());

  const isContinueEnabled = Boolean(
    formData.degreeTypeKey &&
      formData.degreeType &&
      formData.fieldOfStudy &&
      (experienceType !== 'Student' || formData.yearInCollege) &&
      isGraduationYearValid
  );

  // ─── Handlers ────────────────────────────────────────────────
  const handleContinue = () => {
    const customCollege = String(formData.customCollege || '').trim();
    if (formData.college?.name === 'Other' && !customCollege) {
      showToast('Please enter your college/school name', 'error');
      return;
    }
    if (!formData.degreeType) {
      showToast('Please select your degree type', 'error');
      return;
    }
    if (!formData.fieldOfStudy) {
      showToast('Please select your field of study', 'error');
      return;
    }
    if (experienceType === 'Student' && !formData.yearInCollege) {
      showToast('Please select your current year', 'error');
      return;
    }
    if (!isGraduationYearValid) {
      showToast('Please enter a valid graduation year (YYYY)', 'error');
      return;
    }

    const resolvedInstitution =
      formData.college?.name === 'Other'
        ? customCollege
        : formData.college?.name || customCollege || '';

    const finalFormData = {
      ...formData,
      institution: resolvedInstitution,
      yearInCollege:
        experienceType === 'Student'
          ? formData.yearInCollege
          : 'Recently Graduated (0-1 year)',
      graduationYear: formData.graduationYear || '',
      gpa: formData.gpa || '',
    };

    navigation.navigate('PersonalDetailsScreenDirect', {
      userType,
      experienceType,
      workExperienceData,
      educationData: finalFormData,
      fromGoogleAuth: route?.params?.fromGoogleAuth,
      googleUser: route?.params?.googleUser,
    });
  };

  // ─── Modal helpers ───────────────────────────────────────────
  const openModal = (modalType) => {
    setActiveModal(modalType);
    setSearchTerm('');
    modalRefs.current[modalType] = true;
  };

  const closeModal = () => {
    const current = activeModal;
    setActiveModal(null);
    setSearchTerm('');
    if (current) modalRefs.current[current] = false;
  };

  const handleSelection = (item, type) => {
    switch (type) {
      case 'country':
        setFormData({ ...formData, selectedCountry: item.code, college: null, customCollege: '' });
        break;
      case 'college':
        if (item.name === 'Other' && searchTerm.trim()) {
          setFormData({ ...formData, college: item, customCollege: searchTerm.trim() });
        } else {
          setFormData({ ...formData, college: item, customCollege: '' });
        }
        break;
      case 'degree':
        if (typeof item === 'string') {
          setFormData({ ...formData, degreeType: item, degreeTypeKey: '', fieldOfStudy: '' });
          setFieldsOfStudy([]);
        } else {
          setFormData({
            ...formData,
            degreeType: item.name,
            degreeTypeKey: item.id,
            fieldOfStudy: '',
          });
          setFieldsOfStudy([]);
          loadFieldsOfStudy(item.id);
        }
        break;
      case 'field':
        setFormData({ ...formData, fieldOfStudy: item });
        break;
      case 'year':
        setFormData({ ...formData, yearInCollege: item });
        break;
    }
    closeModal();
  };

  // ─── Display helpers ─────────────────────────────────────────
  const getCollegeDisplayText = () => {
    if (formData.college) {
      if (formData.college.name === 'Other') return formData.customCollege || 'Enter your college name below';
      let text = formData.college.name;
      if (formData.college.state && formData.college.country !== 'Various')
        text += ` (${formData.college.state}, ${formData.college.country})`;
      else if (formData.college.country && formData.college.country !== 'Various')
        text += ` (${formData.college.country})`;
      return text;
    }
    return formData.customCollege || null;
  };

  const getSelectedCountryDisplay = () => {
    const c = countries.find((x) => x.code === formData.selectedCountry);
    return c ? `${c.flag} ${c.name}` : formData.selectedCountry;
  };

  const getModalTitle = () => {
    switch (activeModal) {
      case 'country': return 'Select Country / Region';
      case 'college': return `Universities in ${formData.selectedCountry}`;
      case 'degree': return 'Select Degree Type';
      case 'field': return 'Select Field of Study';
      case 'year': return 'Select Current Year';
      default: return '';
    }
  };

  const getSearchPlaceholder = () => {
    switch (activeModal) {
      case 'country': return 'Search countries...';
      case 'college': return 'Search universities...';
      case 'degree': return 'Search degree types...';
      case 'field': return 'Search fields...';
      case 'year': return 'Search years...';
      default: return 'Search...';
    }
  };

  // ─── Shared inline components ────────────────────────────────
  const ChoiceChip = ({ label, value, placeholder, onPress, completed: isCompleted }) => (
    <TouchableOpacity
      style={[styles.choiceChip, isCompleted && styles.choiceChipCompleted]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.choiceChipInner}>
        <View style={styles.choiceChipLeft}>
          {isCompleted && (
            <View style={styles.choiceChipCheck}>
              <Ionicons name="checkmark" size={11} color="#fff" />
            </View>
          )}
          <Text
            style={[styles.choiceChipValue, !value && styles.choiceChipPlaceholder]}
            numberOfLines={1}
          >
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
        <View key={`header-${item.category}`} style={styles.categoryHeader}>
          <Text style={styles.categoryHeaderText}>{item.category}</Text>
        </View>
      );
    }

    const isCountry = activeModal === 'country';
    const isCollege = activeModal === 'college';
    const isDegree = activeModal === 'degree';
    const isString = typeof item === 'string';

    return (
      <TouchableOpacity
        key={`${activeModal}-${isString ? item : item.id || item.code}-${index}`}
        style={styles.modalItem}
        onPress={() => handleSelection(item, activeModal)}
        activeOpacity={0.7}
      >
        <View style={styles.modalItemContent}>
          <Text style={styles.modalItemText}>
            {isCountry
              ? `${item.flag} ${item.name}`
              : isDegree
              ? item.name
              : isString
              ? item
              : isCollege && item.id === 999999
              ? "Can't find your college? Add it"
              : item.name}
          </Text>
          {isDegree && item.category && <Text style={styles.modalItemSub}>{item.category}</Text>}
          {isCollege && item.type && item.id !== 999999 && (
            <Text style={styles.modalItemSub}>{item.type}</Text>
          )}
          {isCollege && item.state && item.country && (
            <Text style={styles.modalItemSub}>
              {item.state}, {item.country}
            </Text>
          )}
          {isCollege && item.website && (
            <Text style={[styles.modalItemSub, { color: colors.primary }]} numberOfLines={1}>
              {item.website}
            </Text>
          )}
          {isCountry && item.region && (
            <Text style={[styles.modalItemSub, { fontStyle: 'italic' }]}>{item.region}</Text>
          )}
        </View>
        {isCollege && item.id === 999999 && (
          <Ionicons name="add-circle" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  // ─── Layout measurement callback for auto-scroll ─────────────
  const onStepLayout = (stepIdx) => (event) => {
    stepLayouts.current[stepIdx] = event.nativeEvent.layout.y;
  };

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <RegistrationWrapper
      currentStep={experienceType === 'Student' ? 2 : 3}
      totalSteps={4}
      stepLabel="Education details"
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
          {/* ── Header ──────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={styles.emoji}>🎓</Text>
            <Text style={styles.title}>Your education</Text>
            <Text style={styles.subtitle}>
              Let's build your academic profile — one step at a time
            </Text>
          </View>

          {/* ── Step 0: Country ─────────────────────────── */}
          <AnimatedFormStep
            visible={currentStep >= 0}
            question="Where are you studying?"
            completed={!!formData.selectedCountry}
            onLayout={onStepLayout(0)}
          >
            <ChoiceChip
              value={getSelectedCountryDisplay()}
              placeholder="Select country"
              onPress={() => openModal('country')}
              completed={!!formData.selectedCountry}
            />
          </AnimatedFormStep>

          {/* ── Step 1: College ─────────────────────────── */}
          <AnimatedFormStep
            visible={currentStep >= 1}
            question="Which university or college?"
            helpText="Search from thousands of institutions worldwide"
            completed={!!formData.college}
            skippable={!formData.college && currentStep < 2}
            onSkip={handleSkipCollege}
            onLayout={onStepLayout(1)}
          >
            <ChoiceChip
              value={getCollegeDisplayText()}
              placeholder="Search and select your institution"
              onPress={() => openModal('college')}
              completed={!!formData.college}
            />
            {formData.college?.name === 'Other' && !formData.customCollege && (
              <View style={styles.inlineInput}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your college / school name"
                  placeholderTextColor={colors.textMuted}
                  value={formData.customCollege}
                  onChangeText={(text) => setFormData({ ...formData, customCollege: text })}
                  autoFocus
                />
              </View>
            )}
          </AnimatedFormStep>

          {/* ── Step 2: Degree Type ─────────────────────── */}
          <AnimatedFormStep
            visible={currentStep >= 2}
            question="What degree are you pursuing?"
            helpText={formData.college?.name ? `At ${formData.college.name}` : undefined}
            completed={!!formData.degreeType}
            onLayout={onStepLayout(2)}
          >
            <ChoiceChip
              value={formData.degreeType}
              placeholder="Select degree type"
              onPress={() => openModal('degree')}
              completed={!!formData.degreeType}
            />
          </AnimatedFormStep>

          {/* ── Step 3: Field of Study ──────────────────── */}
          <AnimatedFormStep
            visible={currentStep >= 3}
            question="What's your field of study?"
            helpText={formData.degreeType ? `Within ${formData.degreeType}` : undefined}
            completed={!!formData.fieldOfStudy}
            onLayout={onStepLayout(3)}
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

          {/* ── Step 4: Current Year (students only) ────── */}
          {experienceType === 'Student' && (
            <AnimatedFormStep
              visible={currentStep >= 4}
              question="Which year are you in?"
              completed={!!formData.yearInCollege}
              onLayout={onStepLayout(4)}
            >
              <ChoiceChip
                value={formData.yearInCollege}
                placeholder="Select your current year"
                onPress={() => {
                  if (!yearsInCollege.length && !loadingYears) loadReferenceTypes(['YearInCollege']);
                  openModal('year');
                }}
                completed={!!formData.yearInCollege}
              />
            </AnimatedFormStep>
          )}

          {/* ── Step 5: Graduation Year ─────────────────── */}
          <AnimatedFormStep
            visible={currentStep >= 5}
            question="Expected graduation year?"
            completed={isGraduationYearValid}
            onLayout={onStepLayout(5)}
          >
            <TextInput
              style={[styles.textInput, isGraduationYearValid && styles.textInputCompleted]}
              placeholder={experienceType === 'Student' ? 'e.g. 2025 (expected)' : 'e.g. 2022'}
              placeholderTextColor={colors.textMuted}
              value={formData.graduationYear}
              onChangeText={(text) => setFormData({ ...formData, graduationYear: text })}
              keyboardType="numeric"
              maxLength={6}
            />
          </AnimatedFormStep>

          {/* ── Step 6: GPA + Continue ──────────────────── */}
          <AnimatedFormStep
            visible={currentStep >= 6}
            question="GPA or Grade (optional)"
            helpText="Almost done! This is optional."
            completed={!!formData.gpa}
            onLayout={onStepLayout(6)}
          >
            <TextInput
              style={[styles.textInput, formData.gpa && styles.textInputCompleted]}
              placeholder="e.g. 3.8/4.0, 85%, First Class"
              placeholderTextColor={colors.textMuted}
              value={formData.gpa}
              onChangeText={(text) => setFormData({ ...formData, gpa: text })}
            />
          </AnimatedFormStep>

          {/* ── Continue Button ──────────────────────────── */}
          {currentStep >= 6 && (
            <Animated.View style={styles.continueWrap}>
              {/* Summary chips */}
              {isContinueEnabled && (
                <View style={styles.summaryRow}>
                  {formData.degreeType && (
                    <View style={styles.summaryChip}>
                      <Text style={styles.summaryChipText}>{formData.degreeType}</Text>
                    </View>
                  )}
                  {formData.fieldOfStudy && (
                    <View style={styles.summaryChip}>
                      <Text style={styles.summaryChipText}>{formData.fieldOfStudy}</Text>
                    </View>
                  )}
                  {formData.graduationYear && (
                    <View style={styles.summaryChip}>
                      <Text style={styles.summaryChipText}>{formData.graduationYear}</Text>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.continueButton, !isContinueEnabled && styles.continueButtonDisabled]}
                onPress={handleContinue}
                disabled={!isContinueEnabled}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.continueButtonText,
                    !isContinueEnabled && styles.continueButtonTextDisabled,
                  ]}
                >
                  Continue
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={isContinueEnabled ? colors.white : colors.textMuted}
                />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* ── Universal Modal ─────────────────────────────────── */}
      <Modal
        visible={activeModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalInner}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{getModalTitle()}</Text>
              {activeModal === 'college' ? (
                <TouchableOpacity onPress={loadColleges} disabled={loading}>
                  <Ionicons name="refresh" size={22} color={loading ? colors.gray400 : colors.primary} />
                </TouchableOpacity>
              ) : activeModal === 'country' ? (
                <TouchableOpacity onPress={loadCountries} disabled={loadingCountries}>
                  <Ionicons
                    name="refresh"
                    size={22}
                    color={loadingCountries ? colors.gray400 : colors.primary}
                  />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 22 }} />
              )}
            </View>

            {/* Search */}
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
                autoFocus={false}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setSearchTerm('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={18} color={colors.gray400} />
                </TouchableOpacity>
              )}
            </View>

            {/* Loading */}
            {((loading && activeModal === 'college') ||
              (loadingCountries && activeModal === 'country') ||
              (loadingDegrees && activeModal === 'degree') ||
              (loadingFields && activeModal === 'field') ||
              (loadingYears && activeModal === 'year')) && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>
                  {activeModal === 'country'
                    ? 'Loading countries...'
                    : activeModal === 'college'
                    ? `Loading universities from ${formData.selectedCountry}...`
                    : activeModal === 'degree'
                    ? 'Loading degree types...'
                    : activeModal === 'year'
                    ? 'Loading years...'
                    : 'Loading fields of study...'}
                </Text>
              </View>
            )}

            {/* Error */}
            {error && activeModal === 'college' && (
              <View style={styles.loadingContainer}>
                <Ionicons name="warning" size={24} color={colors.danger} />
                <Text style={[styles.loadingText, { color: colors.error }]}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadColleges}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* List */}
            {!((loading && activeModal === 'college') || (loadingCountries && activeModal === 'country')) &&
              !error && (
                <FlatList
                  data={filteredData}
                  keyExtractor={(item, index) =>
                    `${activeModal}-${typeof item === 'string' ? item : item.id || item.code}-${index}`
                  }
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  renderItem={renderModalItem}
                  ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                      <Ionicons
                        name={activeModal === 'country' ? 'earth' : 'school'}
                        size={48}
                        color={colors.gray400}
                      />
                      <Text style={styles.emptyText}>
                        {debouncedSearchTerm
                          ? `No items found for "${debouncedSearchTerm}"`
                          : 'No items available'}
                      </Text>
                      {debouncedSearchTerm && (
                        <Text style={styles.emptySubtext}>
                          {activeModal === 'college'
                            ? 'Scroll down and select "Other" to enter manually'
                            : 'Try different keywords'}
                        </Text>
                      )}
                    </View>
                  )}
                  initialNumToRender={20}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  removeClippedSubviews={true}
                  getItemLayout={(data, index) => ({ length: 76, offset: 76 * index, index })}
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
      padding: 24,
      paddingTop: 12,
      alignSelf: 'center',
    },

    /* ── Header ─────────────────────────── */
    header: { marginBottom: 36 },
    emoji: { fontSize: 36, marginBottom: 12 },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.4, marginBottom: 6 },
    subtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },

    /* ── Choice Chip ─────────────────────── */
    choiceChip: {
      backgroundColor: colors.inputBackground,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 18,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    choiceChipCompleted: {
      borderColor: 'rgba(34, 197, 94, 0.3)',
      backgroundColor: 'rgba(34, 197, 94, 0.05)',
    },
    choiceChipInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    choiceChipLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 8,
    },
    choiceChipCheck: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    choiceChipValue: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
      flex: 1,
    },
    choiceChipPlaceholder: {
      color: colors.textMuted,
      fontWeight: '400',
    },

    /* ── Text Input ──────────────────────── */
    textInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 18,
      fontSize: 15,
      color: colors.text,
    },
    textInputCompleted: {
      borderColor: 'rgba(34, 197, 94, 0.3)',
      backgroundColor: 'rgba(34, 197, 94, 0.05)',
    },
    inlineInput: { marginTop: 12 },

    /* ── Summary + Continue ──────────────── */
    continueWrap: { marginTop: 8 },
    summaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 20,
    },
    summaryChip: {
      backgroundColor: colors.primaryGlow,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.primaryGlowStrong,
    },
    summaryChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primaryLight,
    },
    continueButton: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      paddingHorizontal: 24,
      borderRadius: 16,
      gap: 8,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    continueButtonDisabled: {
      backgroundColor: colors.surfaceElevated,
      shadowOpacity: 0,
      elevation: 0,
    },
    continueButtonText: {
      color: colors.white,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    continueButtonTextDisabled: { color: colors.textMuted },

    /* ── Modal ────────────────────────────── */
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
      ...(Platform.OS === 'web' && responsive.isDesktop
        ? {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 9999,
          }
        : {}),
    },
    modalInner: {
      flex: 1,
      backgroundColor: colors.background,
      ...(Platform.OS === 'web' && responsive.isDesktop
        ? {
            flex: 'none',
            width: '100%',
            maxWidth: 560,
            height: '80vh',
            borderRadius: 20,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }
        : {}),
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      paddingTop: Platform.OS === 'ios' ? 56 : 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderThin,
    },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.overlayLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: 8,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 10,
      fontSize: 15,
      color: colors.text,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 16,
      textAlign: 'center',
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
      marginTop: 12,
    },
    retryButtonText: { color: colors.white, fontSize: 14, fontWeight: '600' },
    modalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderFaint,
      minHeight: 64,
    },
    modalItemContent: { flex: 1 },
    modalItemText: { fontSize: 15, fontWeight: '500', color: colors.text, marginBottom: 2 },
    modalItemSub: { fontSize: 13, color: colors.textMuted, marginBottom: 1 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 16 },
    emptySubtext: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
    categoryHeader: {
      backgroundColor: colors.primaryGlow,
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderFaint,
    },
    categoryHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
  });
