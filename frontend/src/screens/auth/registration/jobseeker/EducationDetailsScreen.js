import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { colors, typography } from '../../../../styles/theme';
import nexhireAPI from '../../../../services/api';

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

const DEGREE_TYPES = [
  'Bachelor\'s Degree',
  'Master\'s Degree',
  'PhD/Doctorate',
  'Associate Degree',
  'Certificate Program',
  'Diploma',
  'Other'
];

const FIELDS_OF_STUDY = [
  'Computer Science',
  'Engineering',
  'Business Administration',
  'Medicine',
  'Law',
  'Psychology',
  'Biology',
  'Chemistry',
  'Physics',
  'Mathematics',
  'English Literature',
  'History',
  'Economics',
  'Marketing',
  'Finance',
  'Accounting',
  'Graphic Design',
  'Art',
  'Music',
  'Other'
];

const YEARS_IN_COLLEGE = [
  'First Year (Freshman)',
  'Second Year (Sophomore)',
  'Third Year (Junior)',
  'Fourth Year (Senior)',
  'Graduate Student',
  'Recently Graduated (0-1 year)',
  'Other'
];

export default function EducationDetailsScreen({ navigation, route }) {
  const [formData, setFormData] = useState({
    college: null,
    customCollege: '',
    degreeType: '',
    fieldOfStudy: '',
    yearInCollege: '',
    selectedCountry: 'India',
  });
  
  const [allColleges, setAllColleges] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [error, setError] = useState(null);
  
  // ?? CRITICAL FIX: Single search term with modal type tracking
  const [searchTerm, setSearchTerm] = useState('');
  const [activeModal, setActiveModal] = useState(null); // 'college', 'country', 'degree', 'field', 'year'
  
  // ?? CRITICAL FIX: Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // ?? CRITICAL FIX: Prevent modal state conflicts
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
  }, []);

  useEffect(() => {
    if (formData.selectedCountry) {
      loadColleges();
    }
  }, [formData.selectedCountry]);

  const loadCountries = async () => {
    try {
      setLoadingCountries(true);
      console.log('?? Loading countries from API...');
      
      const response = await nexhireAPI.getCountries();
      
      if (response.success && response.data.countries) {
        const transformedCountries = response.data.countries.map(country => ({
          code: country.name,
          name: country.name,
          flag: country.flag,
          region: country.region,
          id: country.id
        }));
        
        setCountries(transformedCountries);
        console.log(`? Loaded ${transformedCountries.length} countries with flag emojis`);
      } else {
        throw new Error(response.error || 'Failed to load countries');
      }
    } catch (error) {
      console.error('? Error loading countries:', error);
      
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
      console.log('?? Using fallback countries due to API error');
    } finally {
      setLoadingCountries(false);
    }
  };

  const loadColleges = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`?? Loading colleges for country: ${formData.selectedCountry}`);
      
      const response = await nexhireAPI.getColleges(formData.selectedCountry);
      
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
        console.log(`? Loaded ${transformedColleges.length} colleges`);
      } else {
        throw new Error(response.error || 'Failed to load educational institutions');
      }
    } catch (error) {
      console.error('? Error loading colleges:', error);
      setError(error.message);
      
      const fallbackColleges = [
        { id: 999999, name: 'Other', type: 'Other', country: 'Various' }
      ];
      setAllColleges(fallbackColleges);
    } finally {
      setLoading(false);
    }
  };

  // ?? CRITICAL FIX: Memoized filtering with proper dependencies
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
      if (!debouncedSearchTerm.trim()) return DEGREE_TYPES;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return DEGREE_TYPES.filter(degree => degree.toLowerCase().includes(searchLower));
    } else if (activeModal === 'field') {
      if (!debouncedSearchTerm.trim()) return FIELDS_OF_STUDY;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return FIELDS_OF_STUDY.filter(field => field.toLowerCase().includes(searchLower));
    } else if (activeModal === 'year') {
      if (!debouncedSearchTerm.trim()) return YEARS_IN_COLLEGE;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return YEARS_IN_COLLEGE.filter(year => year.toLowerCase().includes(searchLower));
    }
    return [];
  }, [activeModal, debouncedSearchTerm, allColleges, countries]);

  const handleContinue = async () => {
    if (!formData.college && !formData.customCollege) {
      Alert.alert('Required Field', 'Please select your college/school');
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

    const finalFormData = {
      ...formData,
      yearInCollege: experienceType === 'Student' ? formData.yearInCollege : 'Recently Graduated (0-1 year)'
    };

    console.log('?? Education data prepared for registration:', finalFormData);
    
    navigation.navigate('JobPreferencesScreen', { 
      userType, 
      experienceType,
      workExperienceData,
      educationData: finalFormData
    });
  };

  // ?? CRITICAL FIX: Unified modal control functions
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

  // ?? CRITICAL FIX: Safe selection handlers
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
        setFormData({ ...formData, degreeType: item });
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

  // ?? CRITICAL FIX: Render item function with proper keys
  const renderModalItem = ({ item, index }) => {
    const isCountry = activeModal === 'country';
    const isCollege = activeModal === 'college';
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
             isString ? item : item.name}
          </Text>
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

  const SelectionButton = ({ label, value, onPress, placeholder }) => (
    <TouchableOpacity style={styles.selectionButton} onPress={onPress}>
      <Text style={styles.selectionLabel}>{label}</Text>
      <View style={styles.selectionValueContainer}>
        <Text style={[
          styles.selectionValue,
          !value && styles.selectionPlaceholder
        ]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.gray500} />
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
            />

            <SelectionButton
              label="College/University *"
              value={getCollegeDisplayText()}
              placeholder="Search and select your institution"
              onPress={() => openModal('college')}
            />

            <SelectionButton
              label="Degree Type *"
              value={formData.degreeType}
              placeholder="Select degree type"
              onPress={() => openModal('degree')}
            />

            <SelectionButton
              label="Field of Study *"
              value={formData.fieldOfStudy}
              placeholder="Select your major/field"
              onPress={() => openModal('field')}
            />

            {experienceType === 'Student' && (
              <SelectionButton
                label="Current Year *"
                value={formData.yearInCollege}
                placeholder="Select your current year"
                onPress={() => openModal('year')}
              />
            )}

            {formData.college?.name === 'Other' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>College/School Name *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your college/school name"
                  value={formData.customCollege}
                  onChangeText={(text) => setFormData({ ...formData, customCollege: text })}
                />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ?? CRITICAL FIX: Single Universal Modal */}
      <Modal
        visible={activeModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color={colors.text} />
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

          {((loading && activeModal === 'college') || (loadingCountries && activeModal === 'country')) && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>
                {activeModal === 'country' ? 'Loading countries with flag emojis...' : `Loading universities from ${formData.selectedCountry}...`}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
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
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.sizes.md,
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
  selectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray600,
    marginBottom: 8,
  },
  selectionValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionValue: {
    fontSize: typography.sizes.md,
    color: colors.text,
    flex: 1,
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
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: typography.sizes.md,
    color: colors.text,
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
  continueButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
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
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
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
    fontSize: typography.sizes.md,
    color: colors.text,
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
    fontSize: typography.sizes.md,
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
    fontSize: typography.sizes.md,
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
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
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
    fontSize: typography.sizes.md,
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
});