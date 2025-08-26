import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../styles/theme';
import nexhireAPI from '../../services/api';

// Import the same data structures from EducationDetailsScreen
const DEGREE_TYPES = [
  // Engineering & Technology
  { id: 'btech', name: 'B.Tech / B.E', category: 'Engineering & Technology' },
  { id: 'mtech', name: 'M.Tech / M.E', category: 'Engineering & Technology' },
  { id: 'diploma_eng', name: 'Diploma (Engineering)', category: 'Engineering & Technology' },
  
  // Medical & Health Sciences
  { id: 'mbbs', name: 'MBBS', category: 'Medical & Health Sciences' },
  { id: 'bds', name: 'BDS', category: 'Medical & Health Sciences' },
  { id: 'bams', name: 'BAMS', category: 'Medical & Health Sciences' },
  { id: 'bhms', name: 'BHMS', category: 'Medical & Health Sciences' },
  { id: 'bpt', name: 'BPT', category: 'Medical & Health Sciences' },
  { id: 'md', name: 'MD/MS', category: 'Medical & Health Sciences' },
  { id: 'nursing', name: 'B.Sc Nursing', category: 'Medical & Health Sciences' },
  
  // Business & Economics
  { id: 'bba', name: 'BBA', category: 'Business & Economics' },
  { id: 'bcom', name: 'B.Com', category: 'Business & Economics' },
  { id: 'mba', name: 'MBA', category: 'Business & Economics' },
  { id: 'mcom', name: 'M.Com', category: 'Business & Economics' },
  
  // Arts & Sciences
  { id: 'ba', name: 'B.A', category: 'Arts & Sciences' },
  { id: 'bsc', name: 'B.Sc', category: 'Arts & Sciences' },
  { id: 'ma', name: 'M.A', category: 'Arts & Sciences' },
  { id: 'msc', name: 'M.Sc', category: 'Arts & Sciences' },
  
  // Law & Public Policy
  { id: 'llb', name: 'LLB', category: 'Law & Public Policy' },
  { id: 'llm', name: 'LLM', category: 'Law & Public Policy' },
  { id: 'jd', name: 'JD (US)', category: 'Law & Public Policy' },
  
  // Architecture & Design
  { id: 'barch', name: 'B.Arch', category: 'Architecture & Design' },
  { id: 'bdes', name: 'B.Des', category: 'Architecture & Design' },
  { id: 'march', name: 'M.Arch', category: 'Architecture & Design' },
  { id: 'mdes', name: 'M.Des', category: 'Architecture & Design' },
  
  // PhD & Research
  { id: 'phd', name: 'PhD/Doctorate', category: 'Research' },
  
  // Certificate & Others
  { id: 'certificate', name: 'Certificate Program', category: 'Others' },
  { id: 'diploma', name: 'Diploma', category: 'Others' },
  { id: 'other', name: 'Other', category: 'Others' }
];

const FIELDS_OF_STUDY = {
  'btech': [
    'Computer Science & Engineering',
    'Information Technology', 
    'Electronics & Communication Engineering',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Aerospace Engineering',
    'Data Science',
    'Cybersecurity',
    'Artificial Intelligence',
    'Robotics Engineering',
    'Environmental Engineering',
    'Biotechnology Engineering'
  ],
  'mtech': [
    'Computer Science & Engineering',
    'Information Technology',
    'Electronics & Communication Engineering',
    'Artificial Intelligence & Machine Learning',
    'Cloud Computing',
    'Quantum Computing',
    'Renewable Energy',
    'Biomedical Engineering'
  ],
  'mbbs': [
    'General Medicine',
    'Surgery',
    'Pediatrics',
    'Orthopedics',
    'Cardiology',
    'Neurology',
    'Oncology',
    'Dermatology',
    'Psychiatry',
    'Emergency Medicine'
  ],
  'bba': [
    'General Management',
    'Finance',
    'Marketing',
    'Human Resources',
    'International Business'
  ],
  'mba': [
    'Finance',
    'Marketing',
    'Human Resources',
    'Operations Management',
    'Business Analytics',
    'International Business',
    'Entrepreneurship',
    'IT Management',
    'Healthcare Management'
  ],
  'ba': [
    'English Literature',
    'History',
    'Political Science',
    'Sociology',
    'Psychology',
    'Philosophy',
    'Economics',
    'Journalism & Mass Communication'
  ],
  'bsc': [
    'Physics',
    'Chemistry',
    'Mathematics',
    'Computer Science',
    'Electronics',
    'Biotechnology',
    'Environmental Science',
    'Data Science'
  ],
  'llb': [
    'Criminal Law',
    'Corporate Law',
    'International Law',
    'Constitutional Law',
    'Intellectual Property Law',
    'Cyber Law'
  ],
  'barch': [
    'Urban Planning',
    'Interior Design',
    'Landscape Architecture',
    'Sustainable Architecture'
  ],
  'phd': [
    'Engineering Research',
    'Medical Research',
    'Management Research',
    'Science Research',
    'Humanities Research'
  ],
  'other': [
    'Custom Field of Study'
  ]
};

// Debounce hook
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

export default function EducationSection({ 
  profile, 
  setProfile, 
  editing = false, 
  onUpdate 
}) {
  const [loading, setLoading] = useState(false);
  const [allColleges, setAllColleges] = useState([]);
  const [countries, setCountries] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('India');
  const [localEditing, setLocalEditing] = useState(false); // ? NEW: Local editing state
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Enhanced: Check if core education fields are already filled
  const hasEducationData = profile.institution && profile.highestEducation && profile.fieldOfStudy;
  const isEducationFieldEditable = (fieldName) => {
    const currentEditMode = editing || localEditing; // ? Use either global or local editing state
    if (!currentEditMode) return false;
    
    // Core education fields become non-editable once filled
    const coreFields = ['institution', 'highestEducation', 'fieldOfStudy'];
    if (coreFields.includes(fieldName) && hasEducationData) {
      return false;
    }
    
    return true;
  };

  useEffect(() => {
    loadCountries();
    loadColleges();
  }, []);

  useEffect(() => {
    if (selectedCountry) {
      loadColleges();
    }
  }, [selectedCountry]);

  const loadCountries = async () => {
    try {
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
      } else {
        // Fallback countries
        const fallbackCountries = [
          { code: 'India', name: 'India', flag: '????', region: 'Asia' },
          { code: 'United States', name: 'United States', flag: '????', region: 'Americas' },
          { code: 'United Kingdom', name: 'United Kingdom', flag: '????', region: 'Europe' },
          { code: 'Canada', name: 'Canada', flag: '????', region: 'Americas' },
          { code: 'Australia', name: 'Australia', flag: '????', region: 'Oceania' },
        ];
        setCountries(fallbackCountries);
      }
    } catch (error) {
      console.error('Error loading countries:', error);
    }
  };

  const loadColleges = async () => {
    try {
      setLoading(true);
      const response = await nexhireAPI.getColleges(selectedCountry);
      
      if (response.success) {
        const transformedColleges = response.data.map(institution => ({
          id: institution.id,
          name: institution.name,
          type: institution.type,
          country: institution.country,
          state: institution.state,
          website: institution.website,
        }));
        
        setAllColleges(transformedColleges);
      }
    } catch (error) {
      console.error('Error loading colleges:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = React.useMemo(() => {
    if (activeModal === 'institution') {
      if (!debouncedSearchTerm.trim()) return allColleges;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return allColleges.filter(college => 
        college.name.toLowerCase().includes(searchLower) ||
        (college.state && college.state.toLowerCase().includes(searchLower))
      );
    } else if (activeModal === 'country') {
      if (!debouncedSearchTerm.trim()) return countries;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return countries.filter(country =>
        country.name.toLowerCase().includes(searchLower)
      );
    } else if (activeModal === 'degree') {
      if (!debouncedSearchTerm.trim()) {
        // Group degrees by category
        const groupedDegrees = DEGREE_TYPES.reduce((acc, degree) => {
          if (!acc[degree.category]) {
            acc[degree.category] = [];
          }
          acc[degree.category].push(degree);
          return acc;
        }, {});
        
        const result = [];
        Object.keys(groupedDegrees).forEach(category => {
          result.push({ type: 'header', category });
          result.push(...groupedDegrees[category]);
        });
        return result;
      }
      
      const searchLower = debouncedSearchTerm.toLowerCase();
      return DEGREE_TYPES.filter(degree => 
        degree.name.toLowerCase().includes(searchLower) ||
        degree.category.toLowerCase().includes(searchLower)
      );
    } else if (activeModal === 'field') {
      // Get fields based on selected degree
      const selectedDegree = DEGREE_TYPES.find(d => d.name === profile.highestEducation);
      const availableFields = selectedDegree ? FIELDS_OF_STUDY[selectedDegree.id] || [] : [];
      
      if (!debouncedSearchTerm.trim()) return availableFields;
      const searchLower = debouncedSearchTerm.toLowerCase();
      return availableFields.filter(field => field.toLowerCase().includes(searchLower));
    }
    return [];
  }, [activeModal, debouncedSearchTerm, allColleges, countries, profile.highestEducation]);

  const openModal = (modalType) => {
    setActiveModal(modalType);
    setSearchTerm('');
  };

  const closeModal = () => {
    setActiveModal(null);
    setSearchTerm('');
  };

  const handleSelection = (item, type) => {
    const updatedProfile = { ...profile };
    
    switch (type) {
      case 'country':
        setSelectedCountry(item.code);
        break;
      case 'institution':
        updatedProfile.institution = item.name;
        break;
      case 'degree':
        updatedProfile.highestEducation = typeof item === 'string' ? item : item.name;
        // Reset field of study when degree changes
        updatedProfile.fieldOfStudy = '';
        break;
      case 'field':
        updatedProfile.fieldOfStudy = item;
        break;
    }
    
    if (type !== 'country') {
      setProfile(updatedProfile);
      if (onUpdate) {
        onUpdate(updatedProfile);
      }
    }
    
    closeModal();
  };

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
    const isInstitution = activeModal === 'institution';
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
          {isInstitution && item.type && (
            <Text style={styles.modalItemType}>{item.type}</Text>
          )}
          {isInstitution && item.state && (
            <Text style={styles.modalItemLocation}>
              {item.state}, {item.country}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const SelectionButton = ({ 
    label, 
    value, 
    onPress, 
    placeholder, 
    disabled = false,
    icon = 'chevron-down',
    fieldName = ''
  }) => {
    const currentEditMode = editing || localEditing; // ? Use either global or local editing state
    const isFieldEditable = isEducationFieldEditable(fieldName);
    const isDisabled = disabled || !isFieldEditable;
    
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>
          {label}
        </Text>
        <TouchableOpacity 
          style={[
            styles.selectionButton,
            isDisabled && styles.selectionButtonDisabled,
            !currentEditMode && styles.selectionButtonReadonly,
            !isFieldEditable && hasEducationData && styles.selectionButtonLocked
          ]} 
          onPress={isDisabled ? null : onPress}
          disabled={isDisabled}
        >
          <Text style={[
            styles.selectionValue,
            !value && styles.selectionPlaceholder,
            isDisabled && styles.selectionValueDisabled
          ]}>
            {value || placeholder}
          </Text>
          {currentEditMode && isFieldEditable && (
            <Ionicons 
              name={icon} 
              size={20} 
              color={isDisabled ? colors.gray300 : colors.gray500} 
            />
          )}
          {!isFieldEditable && hasEducationData && (
            <Ionicons 
              name="lock-closed" 
              size={20} 
              color={colors.gray400} 
            />
          )}
        </TouchableOpacity>
        {!isFieldEditable && hasEducationData && (
          <Text style={styles.lockedFieldNote}>
            Core education details cannot be changed once set. Contact support if needed.
          </Text>
        )}
      </View>
    );
  };

  const getModalTitle = () => {
    switch (activeModal) {
      case 'country': return 'Select Country/Region';
      case 'institution': return `Universities in ${selectedCountry}`;
      case 'degree': return 'Select Degree Type';
      case 'field': return 'Select Field of Study';
      default: return '';
    }
  };

  const getSearchPlaceholder = () => {
    switch (activeModal) {
      case 'country': return 'Search countries...';
      case 'institution': return 'Search universities...';
      case 'degree': return 'Search degree types...';
      case 'field': return 'Search fields...';
      default: return 'Search...';
    }
  };

  const getSelectedCountryDisplay = () => {
    const country = countries.find(c => c.code === selectedCountry);
    return country ? `${country.flag} ${country.name}` : selectedCountry;
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerLeft}>
          <Ionicons name="school" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Education</Text>
        </View>
        {!editing && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setLocalEditing(!localEditing)}
          >
            <Ionicons name="create" size={16} color={colors.primary} />
            <Text style={styles.editButtonText}>{localEditing ? 'Done' : 'Edit'}</Text>
          </TouchableOpacity>
        )}
        {(editing || localEditing) && (
          <View style={styles.smartBadge}>
            <Ionicons name="school" size={14} color={colors.primary} />
            <Text style={styles.smartBadgeText}>ENHANCED</Text>
          </View>
        )}
      </View>

      {/* Info Card for Enhanced Features */}
      {(editing || localEditing) && hasEducationData && (
        <View style={styles.infoCard}>
          <View style={styles.infoCardIcon}>
            <Ionicons name="lock-closed" size={20} color={colors.warning} />
          </View>
          <View style={styles.infoCardContent}>
            <Text style={styles.infoCardTitle}>Core Education Fields Locked</Text>
            <Text style={styles.infoCardText}>
              Your institution, degree, and field of study are locked to maintain data integrity. You can still update graduation year and GPA.
            </Text>
          </View>
        </View>
      )}

      {(editing || localEditing) && !hasEducationData && (
        <View style={styles.infoCard}>
          <View style={styles.infoCardIcon}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
          </View>
          <View style={styles.infoCardContent}>
            <Text style={styles.infoCardTitle}>Enhanced Education Search</Text>
            <Text style={styles.infoCardText}>
              Search from thousands of universities worldwide and select from categorized degree types.
            </Text>
          </View>
        </View>
      )}

      {(editing || localEditing) && (
        <View style={styles.countrySelector}>
          <SelectionButton
            label="Country/Region"
            value={getSelectedCountryDisplay()}
            placeholder="Select country"
            onPress={() => openModal('country')}
            icon="earth"
          />
        </View>
      )}

      <SelectionButton
        label="Institution"
        value={profile.institution}
        placeholder="Search and select your institution"
        onPress={() => openModal('institution')}
        icon="school"
        fieldName="institution"
      />

      <SelectionButton
        label="Highest Education"
        value={profile.highestEducation}
        placeholder="Select degree type"
        onPress={() => openModal('degree')}
        icon="school"
        fieldName="highestEducation"
      />

      <SelectionButton
        label="Field of Study"
        value={profile.fieldOfStudy}
        placeholder={
          profile.highestEducation 
            ? `Select field for ${profile.highestEducation}` 
            : "Select degree type first"
        }
        onPress={() => {
          if (!profile.highestEducation) {
            Alert.alert('Select Degree First', 'Please select your degree type before choosing field of study');
            return;
          }
          openModal('field');
        }}
        disabled={!profile.highestEducation}
        icon="library"
        fieldName="fieldOfStudy"
      />

      {/* Enhanced Education Details with Database Support */}
      {(editing || localEditing) && (
        <>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Graduation Year (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={profile.graduationYear || ''}
              onChangeText={(text) => {
                const updatedProfile = { ...profile, graduationYear: text };
                setProfile(updatedProfile);
                if (onUpdate) onUpdate(updatedProfile);
              }}
              placeholder="e.g., 2024"
              keyboardType="numeric"
              maxLength={4}
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>GPA/Grade (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={profile.gpa || ''}
              onChangeText={(text) => {
                const updatedProfile = { ...profile, gpa: text };
                setProfile(updatedProfile);
                if (onUpdate) onUpdate(updatedProfile);
              }}
              placeholder="e.g., 3.8/4.0, 85%, First Class"
            />
          </View>
        </>
      )}

      {/* Read-only display for graduation year and GPA */}
      {!(editing || localEditing) && (profile.graduationYear || profile.gpa) && (
        <View style={styles.additionalDetailsContainer}>
          {profile.graduationYear && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Graduation Year:</Text>
              <Text style={styles.detailValue}>{profile.graduationYear}</Text>
            </View>
          )}
          {profile.gpa && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>GPA/Grade:</Text>
              <Text style={styles.detailValue}>{profile.gpa}</Text>
            </View>
          )}
        </View>
      )}

      {/* NOTE: GraduationYear and GPA removed as they don't exist in database schema */}

      {/* Enhanced Modal */}
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
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.gray500} />
            <TextInput
              style={styles.searchInput}
              placeholder={getSearchPlaceholder()}
              value={searchTerm}
              onChangeText={setSearchTerm}
              autoCorrect={false}
              autoCapitalize="none"
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

          {loading && activeModal === 'institution' && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>
                Loading universities from {selectedCountry}...
              </Text>
            </View>
          )}

          {!loading && (
            <FlatList
              data={filteredData}
              keyExtractor={(item, index) => `${activeModal}-${typeof item === 'string' ? item : item.id || item.code}-${index}`}
              renderItem={renderModalItem}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Ionicons 
                    name="school" 
                    size={48} 
                    color={colors.gray400} 
                  />
                  <Text style={styles.emptyText}>
                    {debouncedSearchTerm ? `No items found for "${debouncedSearchTerm}"` : 'No items available'}
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface || '#FFFFFF',
    margin: 16,
    marginBottom: 8,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  editButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  smartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  smartBadgeText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.bold,
    marginLeft: 4,
  },
  countrySelector: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray600,
    marginBottom: 8,
  },
  selectionButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionButtonDisabled: {
    backgroundColor: colors.gray100,
    borderColor: colors.gray200,
  },
  selectionButtonReadonly: {
    backgroundColor: colors.gray50,
  },
  selectionButtonLocked: {
    backgroundColor: colors.gray100,
    borderColor: colors.gray300,
    borderStyle: 'dashed',
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
  lockedFieldIndicator: {
    fontSize: typography.sizes.xs,
    color: colors.warning,
    fontWeight: typography.weights.medium,
  },
  lockedFieldNote: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    marginTop: 4,
    fontStyle: 'italic',
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
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 70,
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
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  additionalDetailsContainer: {
    backgroundColor: colors.gray50,
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    fontWeight: typography.weights.medium,
  },
  detailValue: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  infoCard: {
    backgroundColor: colors.primary + '10',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoCardIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: 4,
  },
  infoCardText: {
    fontSize: typography.sizes.xs,
    color: colors.gray600,
    lineHeight: 16,
  },
});