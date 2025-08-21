import React, { useState, useEffect } from 'react';
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

// Popular countries for university search
const COUNTRIES = [
  { code: 'India', name: 'India', flag: '????' },
  { code: 'United States', name: 'United States', flag: '????' },
  { code: 'United Kingdom', name: 'United Kingdom', flag: '????' },
  { code: 'Canada', name: 'Canada', flag: '????' },
  { code: 'Australia', name: 'Australia', flag: '????' },
  { code: 'Germany', name: 'Germany', flag: '????' },
  { code: 'France', name: 'France', flag: '????' },
  { code: 'Singapore', name: 'Singapore', flag: '????' },
];

export default function EducationDetailsScreen({ navigation, route }) {
  const [formData, setFormData] = useState({
    college: null,
    customCollege: '',
    degreeType: '',
    fieldOfStudy: '',
    yearInCollege: '',
    selectedCountry: 'India', // Default to India
  });
  
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [showCollegeModal, setShowCollegeModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showDegreeModal, setShowDegreeModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { userType, experienceType } = route.params;

  useEffect(() => {
    loadColleges();
  }, [formData.selectedCountry]);

  const loadColleges = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`Loading colleges for country: ${formData.selectedCountry}`);
      
      // Call the API with country parameter
      const response = await nexhireAPI.getColleges(formData.selectedCountry);
      
      if (response.success) {
        // Transform API response to match expected format
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
        
        setColleges(transformedColleges);
        console.log(`Loaded ${transformedColleges.length} colleges`);
      } else {
        throw new Error(response.error || 'Failed to load educational institutions');
      }
    } catch (error) {
      console.error('Error loading colleges:', error);
      setError(error.message);
      
      // Fallback to basic list if API fails
      setColleges([
        { id: 999999, name: 'Other', type: 'Other', country: 'Various' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredColleges = colleges.filter(college => {
    const searchLower = searchTerm.toLowerCase();
    return college.name.toLowerCase().includes(searchLower) ||
           (college.country && college.country.toLowerCase().includes(searchLower)) ||
           (college.state && college.state.toLowerCase().includes(searchLower)) ||
           (college.type && college.type.toLowerCase().includes(searchLower));
  });

  const handleContinue = async () => {
    // Validate required fields
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
    if (!formData.yearInCollege) {
      Alert.alert('Required Field', 'Please select your year in college');
      return;
    }

    try {
      setLoading(true);
      
      // Save education data to database via API
      console.log('Saving education data:', formData);
      
      const response = await nexhireAPI.updateEducation(formData);
      
      if (response.success) {
        console.log('? Education data saved successfully');
        
        // Continue to next screen
        navigation.navigate('JobPreferencesScreen', { 
          userType, 
          experienceType,
          educationData: formData
        });
      } else {
        throw new Error(response.error || 'Failed to save education data');
      }
      
    } catch (error) {
      console.error('? Error saving education data:', error);
      Alert.alert(
        'Save Error', 
        'Failed to save your education information. Please try again.',
        [
          { text: 'Retry', onPress: handleContinue },
          { text: 'Continue anyway', onPress: () => {
            navigation.navigate('JobPreferencesScreen', { 
              userType, 
              experienceType,
              educationData: formData
            });
          }}
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCountryChange = (country) => {
    setFormData({ 
      ...formData, 
      selectedCountry: country.code,
      college: null, // Reset college selection when country changes
      customCollege: ''
    });
    setShowCountryModal(false);
  };

  const SelectionModal = ({ visible, onClose, title, data, onSelect, searchable = false, isCollegeModal = false, isCountryModal = false }) => (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{title}</Text>
          {isCollegeModal && (
            <TouchableOpacity onPress={loadColleges} disabled={loading}>
              <Ionicons 
                name="refresh" 
                size={24} 
                color={loading ? colors.gray400 : colors.primary} 
              />
            </TouchableOpacity>
          )}
        </View>

        {searchable && (
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.gray500} />
            <TextInput
              style={styles.searchInput}
              placeholder={isCollegeModal ? "Search universities..." : "Search..."}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>
        )}

        {loading && isCollegeModal && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading universities from {formData.selectedCountry}...</Text>
          </View>
        )}

        {error && isCollegeModal && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={24} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadColleges}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && (
          <FlatList
            data={data}
            keyExtractor={(item, index) => item.id?.toString() || item.code || index.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  onSelect(item);
                  onClose();
                  setSearchTerm('');
                }}
              >
                <View style={styles.modalItemContent}>
                  <Text style={styles.modalItemText}>
                    {isCountryModal ? `${item.flag} ${item.name}` : 
                     typeof item === 'string' ? item : item.name}
                  </Text>
                  {typeof item === 'object' && item.type && !isCountryModal && (
                    <Text style={styles.modalItemType}>{item.type}</Text>
                  )}
                  {typeof item === 'object' && item.state && item.country && !isCountryModal && (
                    <Text style={styles.modalItemLocation}>
                      {item.state}, {item.country}
                    </Text>
                  )}
                  {typeof item === 'object' && item.website && !isCountryModal && (
                    <Text style={styles.modalItemWebsite}>
                      {item.website}
                    </Text>
                  )}
                  {typeof item === 'object' && item.globalRanking && !isCountryModal && (
                    <Text style={styles.modalItemRanking}>
                      Global Ranking: #{item.globalRanking}
                    </Text>
                  )}
                </View>
                {typeof item === 'object' && item.id === 999999 && (
                  <Ionicons name="add-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name="school" size={48} color={colors.gray400} />
                <Text style={styles.emptyText}>
                  {searchTerm ? 'No institutions found' : 'No institutions available'}
                </Text>
                {searchTerm && (
                  <Text style={styles.emptySubtext}>
                    Try searching with different keywords
                  </Text>
                )}
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );

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
    const country = COUNTRIES.find(c => c.code === formData.selectedCountry);
    return country ? `${country.flag} ${country.name}` : formData.selectedCountry;
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
              onPress={() => setShowCountryModal(true)}
            />

            <SelectionButton
              label="College/University *"
              value={getCollegeDisplayText()}
              placeholder="Search and select your institution"
              onPress={() => setShowCollegeModal(true)}
            />

            <SelectionButton
              label="Degree Type *"
              value={formData.degreeType}
              placeholder="Select degree type"
              onPress={() => setShowDegreeModal(true)}
            />

            <SelectionButton
              label="Field of Study *"
              value={formData.fieldOfStudy}
              placeholder="Select your major/field"
              onPress={() => setShowFieldModal(true)}
            />

            <SelectionButton
              label="Current Year *"
              value={formData.yearInCollege}
              placeholder="Select your current year"
              onPress={() => setShowYearModal(true)}
            />

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

      {/* Modals */}
      <SelectionModal
        visible={showCountryModal}
        onClose={() => setShowCountryModal(false)}
        title="Select Country/Region"
        data={COUNTRIES}
        onSelect={handleCountryChange}
        searchable={false}
        isCountryModal={true}
      />

      <SelectionModal
        visible={showCollegeModal}
        onClose={() => setShowCollegeModal(false)}
        title={`Universities in ${formData.selectedCountry}`}
        data={filteredColleges}
        onSelect={(college) => setFormData({ ...formData, college, customCollege: '' })}
        searchable={true}
        isCollegeModal={true}
      />

      <SelectionModal
        visible={showDegreeModal}
        onClose={() => setShowDegreeModal(false)}
        title="Select Degree Type"
        data={DEGREE_TYPES}
        onSelect={(degree) => setFormData({ ...formData, degreeType: degree })}
      />

      <SelectionModal
        visible={showFieldModal}
        onClose={() => setShowFieldModal(false)}
        title="Select Field of Study"
        data={FIELDS_OF_STUDY}
        onSelect={(field) => setFormData({ ...formData, fieldOfStudy: field })}
      />

      <SelectionModal
        visible={showYearModal}
        onClose={() => setShowYearModal(false)}
        title="Select Current Year"
        data={YEARS_IN_COLLEGE}
        onSelect={(year) => setFormData({ ...formData, yearInCollege: year })}
      />
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
  apiInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  apiInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    flex: 1,
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
  modalItemRanking: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
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