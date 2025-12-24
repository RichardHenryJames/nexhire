import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../contexts/ThemeContext';
import { typography } from '../../../../styles/theme';
import { authDarkColors } from '../../../../styles/authDarkColors';
import refopenAPI from '../../../../services/api';

// Add debounce hook for smooth search
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Degree types and fields of study are fetched from ReferenceMetadata.
// RefType values:
//  - DegreeType (Category = degreeKey, Description = group/category label)
//  - FieldOfStudy (Category = degreeKey)

export default function EducationDetailsScreen({ navigation, route }) {
  const colors = authDarkColors; // Always use dark colors for auth screens
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [formData, setFormData] = useState({
    college: null,
    customCollege: '',
    degreeType: '',
    degreeTypeKey: '',
    fieldOfStudy: '',
    yearInCollege: '',
    selectedCountry: 'India',
    graduationYear: '',  // NEW: Add graduation year
    gpa: '',            // NEW: Add GPA
  });

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
  
  // CRITICAL FIX: Single search term with modal type tracking
  const [searchTerm, setSearchTerm] = useState('');
  const [activeModal, setActiveModal] = useState(null); // 'college', 'country', 'degree', 'field', 'year'
  
  // CRITICAL FIX: Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // CRITICAL FIX: Prevent modal state conflicts
  const modalRefs = useRef({
    college: false,
    country: false,
    degree: false,
    field: false,
    year: false
  });
  
  const { userType, experienceType, workExperienceData } = route.params;

  useEffect(() => {
    loadCountries();
    loadColleges();
    loadEducationReferenceData();
  }, []);

  useEffect(() => {
    if (formData.selectedCountry) {
      loadColleges();
    }
  }, [formData.selectedCountry]);

  const loadReferenceTypes = async (types) => {
    const wantsDegrees = Array.isArray(types) && types.includes('DegreeType');
    const wantsYears = Array.isArray(types) && types.includes('YearInCollege');

    try {
      if (wantsDegrees) setLoadingDegrees(true);
      if (wantsYears) setLoadingYears(true);

      // ✅ OPTIMIZED: Use bulk endpoint to fetch multiple types in one call
      const response = await refopenAPI.getBulkReferenceMetadata(types);

      if (!response?.success || !response?.data) {
        throw new Error(response?.error || 'Failed to load reference metadata');
      }

      if (wantsDegrees) {
        const items = Array.isArray(response.data.DegreeType) ? response.data.DegreeType : [];
        const transformed = items
          .filter(item => item && item.Value)
          .map(item => ({
            id: item.Category || String(item.ReferenceID),
            name: item.Value,
            category: item.Description || 'Others',
          }));
        setDegreeTypes(transformed);
      }

      if (wantsYears) {
        const items = Array.isArray(response.data.YearInCollege) ? response.data.YearInCollege : [];
        const transformed = items
          .filter(item => item && item.Value)
          .map(item => item.Value);
        setYearsInCollege(transformed);
      }
    } catch (error) {
      console.error('Error loading reference metadata:', error);
      if (wantsDegrees) setDegreeTypes([]);
      if (wantsYears) setYearsInCollege([]);
    } finally {
      if (wantsDegrees) setLoadingDegrees(false);
      if (wantsYears) setLoadingYears(false);
    }
  };

  const loadEducationReferenceData = async () => {
    return loadReferenceTypes(['DegreeType', 'YearInCollege']);
  };

  const loadDegreeTypes = async () => {
    return loadReferenceTypes(['DegreeType']);
  };

  const loadFieldsOfStudy = async (degreeKey) => {
    if (!degreeKey) {
      setFieldsOfStudy([]);
      return;
    }

    try {
      setLoadingFields(true);
      const response = await refopenAPI.getReferenceMetadata('FieldOfStudy', degreeKey);

      if (response.success && Array.isArray(response.data)) {
        const transformed = response.data
          .filter(item => item && item.Value)
          .map(item => item.Value);
        setFieldsOfStudy(transformed);
      } else {
        throw new Error(response.error || 'Failed to load fields of study');
      }
    } catch (error) {
      console.error('Error loading fields of study:', error);
      setFieldsOfStudy([]);
    } finally {
      setLoadingFields(false);
    }
  };

  const loadYearsInCollege = async () => {
    return loadReferenceTypes(['YearInCollege']);
  };

  const loadCountries = async () => {
    try {
      setLoadingCountries(true);
      
      
      const response = await refopenAPI.getCountries();
      
      if (response.success && response.data.countries) {
        const transformedCountries = response.data.countries.map(country => ({
          code: country.name,
          name: country.name,
          flag: country.flag,
          region: country.region,
          id: country.id
        }));
        
        setCountries(transformedCountries);
        
      } else {
        throw new Error(response.error || 'Failed to load countries');
      }
    } catch (error) {
      console.error('Error loading countries:', error);
      
      const fallbackCountries = [
        { code: 'India', name: 'India', flag: '????', region: 'Asia' },
        { code: 'United States', name: 'United States', flag: '????', region: 'Americas' },
        { code: 'United Kingdom', name: 'United Kingdom', flag: '????', region: 'Europe' },
        { code: 'Canada', name: 'Canada', flag: '????', region: 'Americas' },
        { code: 'Australia', name: 'Australia', flag: '????', region: 'Oceania' },
        { code: 'Germany', name: 'Germany', flag: '????', region: 'Europe' },
        { code: 'France', name: 'France', flag: '????', region: 'Europe' },
        { code: 'Singapore', name: 'Singapore', flag: '????', region: 'Asia' },
      ];
      
      setCountries(fallbackCountries);
      
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
        const transformedColleges = response.data.map(institution => ({
          id: institution.id,
          name: institution.name,
          type: institution.type,
          country: institution.country,
          state: institution.state,
          city: institution.city,
          website: institution.website,
          domains: institution.domains || [],
          establishedYear: institution.establishedYear,
          globalRanking: institution.globalRanking,
          description: institution.description,
          alpha_two_code: institution.alpha_two_code
        }));
        
        setAllColleges(transformedColleges);
        
      } else {
        throw new Error(response.error || 'Failed to load educational institutions');
      }
    } catch (error) {
      console.error('Error loading colleges:', error);
      setError(error.message);
      
      const fallbackColleges = [
        { id: 999999, name: 'Other', type: 'Other', country: 'Various' }
      ];
      setAllColleges(fallbackColleges);
    } finally {
      setLoading(false);
    }
  };

  // CRITICAL FIX: Memoized filtering with proper dependencies
  const filteredData = React.useMemo(() => {
    if (activeModal === 'college') {
      if (!debouncedSearchTerm.trim()) return allColleges;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return allColleges.filter(college => 
        college.name.toLowerCase().includes(searchLower) ||
        (college.country && college.country.toLowerCase().includes(searchLower)) ||
        (college.state && college.state.toLowerCase().includes(searchLower)) ||
        (college.type && college.type.toLowerCase().includes(searchLower))
      );
    } else if (activeModal === 'country') {
      if (!debouncedSearchTerm.trim()) return countries;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return countries.filter(country =>
        country.name.toLowerCase().includes(searchLower) ||
        (country.region && country.region.toLowerCase().includes(searchLower))
      );
    } else if (activeModal === 'degree') {
      if (!debouncedSearchTerm.trim()) {
        // Group degrees by category for better organization
        const groupedDegrees = degreeTypes.reduce((acc, degree) => {
          if (!acc[degree.category]) {
            acc[degree.category] = [];
          }
          acc[degree.category].push(degree);
          return acc;
        }, {});
        
        // Flatten with category headers
        const result = [];
        Object.keys(groupedDegrees).forEach(category => {
          result.push({ type: 'header', category });
          result.push(...groupedDegrees[category]);
        });
        return result;
      }
      
      const searchLower = debouncedSearchTerm.toLowerCase();
      return degreeTypes.filter(degree => 
        degree.name.toLowerCase().includes(searchLower) ||
        degree.category.toLowerCase().includes(searchLower)
      );
    } else if (activeModal === 'field') {
      const availableFields = fieldsOfStudy;

      if (!debouncedSearchTerm.trim()) return availableFields;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return availableFields.filter(field => field.toLowerCase().includes(searchLower));
    } else if (activeModal === 'year') {
      if (!debouncedSearchTerm.trim()) return yearsInCollege;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return yearsInCollege.filter(year => year.toLowerCase().includes(searchLower));
    }
    return [];
  }, [activeModal, debouncedSearchTerm, allColleges, countries, degreeTypes, fieldsOfStudy, yearsInCollege]);

  const isCollegeProvided = (() => {
    const customCollege = String(formData.customCollege || '').trim();
    if (!formData.college) return !!customCollege;
    if (formData.college?.name === 'Other') return !!customCollege;
    return true;
  })();

  const isGraduationYearValid = (() => {
    if (experienceType !== 'Student') return true;
    const year = String(formData.graduationYear || '').trim();
    return /^\d{4}$/.test(year);
  })();

  const isContinueEnabled = Boolean(
    isCollegeProvided &&
      formData.degreeTypeKey &&
      formData.degreeType &&
      formData.fieldOfStudy &&
      (experienceType !== 'Student' || formData.yearInCollege) &&
      isGraduationYearValid
  );

  const handleContinue = async () => {
    const customCollege = String(formData.customCollege || '').trim();

    if (!formData.college && !customCollege) {
      Alert.alert('Required Field', 'Please select your college/school');
      return;
    }
    if (formData.college?.name === 'Other' && !customCollege) {
      Alert.alert('Required Field', 'Please enter your college/school name');
      return;
    }
    if (!formData.degreeType) {
      Alert.alert('Required Field', 'Please select your degree type');
      return;
    }
    if (!formData.fieldOfStudy) {
      Alert.alert('Required Field', 'Please select your field of study');
      return;
    }
    if (experienceType === 'Student' && !formData.yearInCollege) {
      Alert.alert('Required Field', 'Please select your current year');
      return;
    }
    if (experienceType === 'Student' && !/^\d{4}$/.test(String(formData.graduationYear || '').trim())) {
      Alert.alert('Required Field', 'Please enter a valid graduation year (YYYY)');
      return;
    }

    // Enhanced: Include graduation year and GPA in the final data
    const finalFormData = {
      ...formData,
      yearInCollege: experienceType === 'Student' ? formData.yearInCollege : 'Recently Graduated (0-1 year)',
      graduationYear: formData.graduationYear || '', // Always include, even if empty
      gpa: formData.gpa || '' // Always include, even if empty
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

  // CRITICAL FIX: Unified modal control functions
  const openModal = (modalType) => {
    setActiveModal(modalType);
    setSearchTerm('');
    modalRefs.current[modalType] = true;
  };

  const closeModal = () => {
    const currentModal = activeModal;
    setActiveModal(null);
    setSearchTerm('');
    if (currentModal) {
      modalRefs.current[currentModal] = false;
    }
  };

  // CRITICAL FIX: Safe selection handlers
  const handleSelection = (item, type) => {
    switch (type) {
      case 'country':
        setFormData({ 
          ...formData, 
          selectedCountry: item.code,
          college: null,
          customCollege: ''
        });
        break;
      case 'college':
        setFormData({ ...formData, college: item, customCollege: '' });
        break;
      case 'degree':
        // Reset field of study when degree changes since fields are degree-dependent
        if (typeof item === 'string') {
          setFormData({ 
            ...formData, 
            degreeType: item,
            degreeTypeKey: '',
            fieldOfStudy: ''
          });
          setFieldsOfStudy([]);
        } else {
          setFormData({ 
            ...formData, 
            degreeType: item.name,
            degreeTypeKey: item.id,
            fieldOfStudy: '' // Reset field when degree changes
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

  // CRITICAL FIX: Render item function with proper keys
  const renderModalItem = ({ item, index }) => {
    // Handle category headers for degree types
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
            {isCountry ? `${item.flag} ${item.name}` : 
             isDegree ? item.name :
             isString ? item : item.name}
          </Text>
          {isDegree && item.category && !debouncedSearchTerm && (
            <Text style={styles.modalItemType}>{item.category}</Text>
          )}
          {isCollege && item.type && (
            <Text style={styles.modalItemType}>{item.type}</Text>
          )}
          {isCollege && item.state && item.country && (
            <Text style={styles.modalItemLocation}>
              {item.state}, {item.country}
            </Text>
          )}
          {isCollege && item.website && (
            <Text style={styles.modalItemWebsite} numberOfLines={1}>
              {item.website}
            </Text>
          )}
          {isCountry && item.region && (
            <Text style={styles.modalItemRegion}>{item.region}</Text>
          )}
        </View>
        {isCollege && item.id === 999999 && (
          <Ionicons name="add-circle" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  const SelectionButton = ({ label, value, onPress, placeholder, disabled = false, required = false }) => (
    <TouchableOpacity 
      style={[
        styles.selectionButton,
        disabled && styles.selectionButtonDisabled
      ]} 
      onPress={disabled ? null : onPress}
      disabled={disabled}
    >
      <Text style={[
        styles.selectionLabel,
        disabled && styles.selectionLabelDisabled
      ]}>
        {label} {required && <Text style={styles.requiredAsterisk}>*</Text>}
      </Text>
      <View style={styles.selectionValueContainer}>
        <Text style={[
          styles.selectionValue,
          !value && styles.selectionPlaceholder,
          disabled && styles.selectionValueDisabled
        ]}>
          {value || placeholder}
        </Text>
        <Ionicons 
          name="chevron-down" 
          size={20} 
          color={disabled ? colors.gray300 : colors.gray500} 
        />
      </View>
    </TouchableOpacity>
  );

  const getCollegeDisplayText = () => {
    if (formData.college) {
      let text = formData.college.name;
      if (formData.college.state && formData.college.country !== 'Various') {
        text += ` (${formData.college.state}, ${formData.college.country})`;
      } else if (formData.college.country && formData.college.country !== 'Various') {
        text += ` (${formData.college.country})`;
      }
      return text;
    }
    return formData.customCollege || null;
  };

  const getSelectedCountryDisplay = () => {
    const country = countries.find(c => c.code === formData.selectedCountry);
    return country ? `${country.flag} ${country.name}` : formData.selectedCountry;
  };

  const getModalTitle = () => {
    switch (activeModal) {
      case 'country': return 'Select Country/Region';
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

  const shouldShowSearch = () => {
    return activeModal === 'country' || activeModal === 'college' || activeModal === 'degree' || activeModal === 'field' || activeModal === 'year';
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>

            <Text style={styles.title}>Tell us about your education</Text>
            <Text style={styles.subtitle}>
              Search from thousands of universities worldwide using our real-time database
            </Text>
          </View>

          <View style={styles.form}>
            <SelectionButton
              label="Country/Region"
              value={getSelectedCountryDisplay()}
              placeholder="Select country"
              onPress={() => openModal('country')}
              required={false}
            />

            <SelectionButton
              label="College/University"
              value={getCollegeDisplayText()}
              placeholder="Search and select your institution"
              onPress={() => openModal('college')}
              required={true}
            />

            <SelectionButton
              label="Degree Type"
              value={formData.degreeType}
              placeholder="Select degree type"
              onPress={() => openModal('degree')}
              required={true}
            />

            {!!formData.degreeTypeKey && (
              <SelectionButton
                label="Field of Study"
                value={formData.fieldOfStudy}
                placeholder={`Select field for ${formData.degreeType || 'your degree'}`}
                onPress={() => {
                  if (!fieldsOfStudy.length && !loadingFields) {
                    loadFieldsOfStudy(formData.degreeTypeKey);
                  }
                  openModal('field');
                }}
                required={true}
              />
            )}

            {experienceType === 'Student' && (
              <SelectionButton
                label="Current Year"
                value={formData.yearInCollege}
                placeholder="Select your current year"
                onPress={() => {
                  if (!yearsInCollege.length && !loadingYears) {
                    loadYearsInCollege();
                  }
                  openModal('year');
                }}
                required={true}
              />
            )}

            {/* Enhanced: Graduation Year and GPA fields for BOTH Students and Experienced */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                Graduation Year {experienceType === 'Student' && <Text style={styles.required}>*</Text>}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={experienceType === 'Student' ? "e.g., 2025 (expected)" : "e.g., 2022"}
                placeholderTextColor={colors.gray400}
                value={formData.graduationYear}
                onChangeText={(text) => setFormData({ ...formData, graduationYear: text })}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                GPA/Grade
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., 3.8/4.0, 85%, First Class"
                placeholderTextColor={colors.gray400}
                value={formData.gpa}
                onChangeText={(text) => setFormData({ ...formData, gpa: text })}
              />
            </View>

            {formData.college?.name === 'Other' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  College/School Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your college/school name"
                  placeholderTextColor={colors.gray400}
                  value={formData.customCollege}
                  onChangeText={(text) => setFormData({ ...formData, customCollege: text })}
                />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.continueButton, !isContinueEnabled && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!isContinueEnabled}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* CRITICAL FIX: Single Universal Modal */}
      <Modal
        visible={activeModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{getModalTitle()}</Text>
            {activeModal === 'college' && (
              <TouchableOpacity onPress={loadColleges} disabled={loading}>
                <Ionicons 
                  name="refresh" 
                  size={24} 
                  color={loading ? colors.gray400 : colors.primary} 
                />
              </TouchableOpacity>
            )}
            {activeModal === 'country' && (
              <TouchableOpacity onPress={loadCountries} disabled={loadingCountries}>
                <Ionicons 
                  name="refresh" 
                  size={24} 
                  color={loadingCountries ? colors.gray400 : colors.primary} 
                />
              </TouchableOpacity>
            )}
            {activeModal !== 'college' && activeModal !== 'country' && (
              <View style={{ width: 24 }} />
            )}
          </View>

          {shouldShowSearch() && (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={colors.gray500} />
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
                <TouchableOpacity 
                  onPress={() => setSearchTerm('')}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={20} color={colors.gray400} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {((loading && activeModal === 'college') || (loadingCountries && activeModal === 'country') || (loadingDegrees && activeModal === 'degree') || (loadingFields && activeModal === 'field') || (loadingYears && activeModal === 'year')) && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>
                {activeModal === 'country' ? 'Loading countries with flag emojis...' :
                 activeModal === 'college' ? `Loading universities from ${formData.selectedCountry}...` :
                 activeModal === 'degree' ? 'Loading degree types...' :
                 activeModal === 'year' ? 'Loading years...' :
                 'Loading fields of study...'}
              </Text>
            </View>
          )}

          {error && activeModal === 'college' && (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={24} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadColleges}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!((loading && activeModal === 'college') || (loadingCountries && activeModal === 'country')) && !error && (
            <FlatList
              data={filteredData}
              keyExtractor={(item, index) => `${activeModal}-${typeof item === 'string' ? item : item.id || item.code}-${index}`}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={renderModalItem}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Ionicons 
                    name={activeModal === 'country' ? "earth" : "school"} 
                    size={48} 
                    color={colors.gray400} 
                  />
                  <Text style={styles.emptyText}>
                    {debouncedSearchTerm ? `No items found for "${debouncedSearchTerm}"` : 'No items available'}
                  </Text>
                  {debouncedSearchTerm && (
                    <Text style={styles.emptySubtext}>
                      Try searching with different keywords
                    </Text>
                  )}
                </View>
              )}
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              getItemLayout={(data, index) => ({
                length: 80,
                offset: 80 * index,
                index,
              })}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 20,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.gray600,
    lineHeight: 22,
  },
  form: {
    gap: 20,
    marginBottom: 32,
  },
  selectionButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectionButtonDisabled: {
    backgroundColor: colors.gray100,
    borderColor: colors.gray200,
  },
  selectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray600,
    marginBottom: 8,
  },
  selectionLabelDisabled: {
    color: colors.gray400,
  },
  requiredAsterisk: {
    color: colors.danger,
    fontWeight: typography.weights.bold,
  },
  selectionValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionValue: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    flex: 1,
  },
  selectionValueDisabled: {
    color: colors.gray400,
  },
  selectionPlaceholder: {
    color: colors.gray400,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray600,
  },
  required: {
    color: colors.danger,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  continueButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    marginLeft: 8,
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.gray600,
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: typography.sizes.base,
    color: colors.danger,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 80,
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalItemType: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    marginBottom: 2,
  },
  modalItemLocation: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 2,
  },
  modalItemWebsite: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    marginBottom: 2,
  },
  modalItemRegion: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.gray600,
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 8,
  },
  categoryHeader: {
    backgroundColor: colors.primary + '10',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryHeaderText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldHelpContainer: {
    backgroundColor: colors.gray50,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldHelpText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    textAlign: 'center',
  },
  requiredAsterisk: {
    color: colors.danger,
    fontWeight: typography.weights.bold,
  },
});