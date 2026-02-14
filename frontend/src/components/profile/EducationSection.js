import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../styles/theme';
import { useTheme } from '../../contexts/ThemeContext';
import refopenAPI from '../../services/api';

export default function EducationSection({ profile, setProfile, onSave }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [colleges, setColleges] = useState([]);
  const [countries, setCountries] = useState([]);
  const [degreeTypes, setDegreeTypes] = useState([]);
  const [fieldsOfStudy, setFieldsOfStudy] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('India');
  
  // Loading states
  const [loadingColleges, setLoadingColleges] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingDegrees, setLoadingDegrees] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedCountry) loadColleges();
  }, [selectedCountry]);

  // Load all initial data in parallel
  const loadInitialData = async () => {
    setLoadingCountries(true);
    setLoadingDegrees(true);
    setLoadingColleges(true);

    try {
      // Load countries, colleges, and degree types in parallel
      const [countriesRes, collegesRes, refDataRes] = await Promise.all([
        refopenAPI.getCountries(),
        refopenAPI.getColleges(selectedCountry),
        refopenAPI.getBulkReferenceMetadata(['DegreeType']),
      ]);

      // Process countries
      if (countriesRes.success && countriesRes.data.countries) {
        setCountries(countriesRes.data.countries.map(c => ({ code: c.name, name: c.name, flag: c.flag })));
      } else {
        setCountries([
          { code: 'India', name: 'India', flag: '🇮🇳' },
          { code: 'United States', name: 'United States', flag: '🇺🇸' },
          { code: 'United Kingdom', name: 'United Kingdom', flag: '🇬🇧' },
        ]);
      }

      // Process colleges
      if (collegesRes.success) {
        setColleges(collegesRes.data.map(i => ({ id: i.id, name: i.name, type: i.type, state: i.state, country: i.country })));
      }

      // Process degree types from bulk reference data
      if (refDataRes?.success && refDataRes?.data?.DegreeType) {
        const items = Array.isArray(refDataRes.data.DegreeType) ? refDataRes.data.DegreeType : [];
        setDegreeTypes(items.filter(item => item?.Value).map(item => ({
          id: item.Category || String(item.ReferenceID),
          name: item.Value,
          category: item.Description || 'Others',
        })));
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoadingCountries(false);
      setLoadingDegrees(false);
      setLoadingColleges(false);
    }
  };

  const loadColleges = async () => {
    try {
      setLoadingColleges(true);
      const response = await refopenAPI.getColleges(selectedCountry);
      if (response.success) {
        setColleges(response.data.map(i => ({ id: i.id, name: i.name, type: i.type, state: i.state, country: i.country })));
      }
    } catch (error) {
      console.error('Error loading colleges:', error);
    } finally {
      setLoadingColleges(false);
    }
  };

  // Load fields of study from API based on selected degree
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
        setFieldsOfStudy([]);
      }
    } catch (error) {
      console.error('Error loading fields of study:', error);
      setFieldsOfStudy([]);
    } finally {
      setLoadingFields(false);
    }
  };

  const handleSelect = async (item, type) => {
    let updatedProfile = { ...profile };
    
    if (type === 'country') {
      setSelectedCountry(item.code);
      setActiveModal(null);
      setSearchTerm('');
      return;
    }
    
    if (type === 'institution') {
      updatedProfile.institution = item.name;
    }
    
    if (type === 'degree') {
      updatedProfile.highestEducation = item.name;
      updatedProfile.fieldOfStudy = '';
      // Load fields of study for this degree
      loadFieldsOfStudy(item.id);
    }
    
    if (type === 'field') {
      updatedProfile.fieldOfStudy = item;
    }
    
    setProfile(updatedProfile);
    setActiveModal(null);
    setSearchTerm('');
  };

  const handleTextChange = (field, value) => {
    const updatedProfile = { ...profile, [field]: value };
    setProfile(updatedProfile);
  };

  const getFilteredData = () => {
    const search = searchTerm.toLowerCase();
    
    if (activeModal === 'country') {
      return countries.filter(c => !search || c.name.toLowerCase().includes(search));
    }
    
    if (activeModal === 'institution') {
      return colleges.filter(c => !search || c.name.toLowerCase().includes(search) || (c.state && c.state.toLowerCase().includes(search)));
    }
    
    if (activeModal === 'degree') {
      const filtered = degreeTypes.filter(d => !search || d.name.toLowerCase().includes(search) || d.category.toLowerCase().includes(search));
      if (!search) {
        // Group by category
        const grouped = {};
        filtered.forEach(d => {
          if (!grouped[d.category]) grouped[d.category] = [];
          grouped[d.category].push(d);
        });
        const result = [];
        Object.keys(grouped).forEach(cat => {
          result.push({ type: 'header', category: cat });
          result.push(...grouped[cat]);
        });
        return result;
      }
      return filtered;
    }
    
    if (activeModal === 'field') {
      return fieldsOfStudy.filter(f => !search || f.toLowerCase().includes(search));
    }
    
    return [];
  };

  const getCountryDisplay = () => {
    const c = countries.find(c => c.code === selectedCountry);
    return c ? `${c.flag} ${c.name}` : selectedCountry;
  };

  const isLoading = () => {
    if (activeModal === 'country') return loadingCountries;
    if (activeModal === 'institution') return loadingColleges;
    if (activeModal === 'degree') return loadingDegrees;
    if (activeModal === 'field') return loadingFields;
    return false;
  };

  const SelectionButton = ({ label, value, placeholder, onPress, icon }) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.selectionButton} onPress={onPress}>
        <Text style={[styles.selectionValue, !value && styles.placeholder]}>{value || placeholder}</Text>
        <Ionicons name={icon || 'chevron-down'} size={20} color={colors.gray500} />
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryHeaderText}>{item.category}</Text>
        </View>
      );
    }

    const isString = typeof item === 'string';
    const text = activeModal === 'country' ? `${item.flag} ${item.name}` : (isString ? item : item.name);

    return (
      <TouchableOpacity style={styles.modalItem} onPress={() => handleSelect(item, activeModal)}>
        <View>
          <Text style={styles.modalItemText}>{text}</Text>
          {activeModal === 'institution' && item.state && (
            <Text style={styles.modalItemSub}>{item.state}, {item.country}</Text>
          )}
          {activeModal === 'degree' && item.category && (
            <Text style={styles.modalItemSub}>{item.category}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const getModalTitle = () => {
    if (activeModal === 'country') return 'Select Country';
    if (activeModal === 'institution') return `Universities in ${selectedCountry}`;
    if (activeModal === 'degree') return 'Select Degree';
    if (activeModal === 'field') return 'Select Field of Study';
    return '';
  };

  const openFieldModal = () => {
    // Load fields if not already loaded and we have a degree selected
    const selectedDegree = degreeTypes.find(d => d.name === profile.highestEducation);
    if (selectedDegree && fieldsOfStudy.length === 0 && !loadingFields) {
      loadFieldsOfStudy(selectedDegree.id);
    }
    setActiveModal('field');
    setSearchTerm('');
  };

  return (
    <View>
      <SelectionButton
        label="Country/Region"
        value={getCountryDisplay()}
        placeholder="Select country"
        onPress={() => { setActiveModal('country'); setSearchTerm(''); }}
        icon="earth"
      />

      <SelectionButton
        label="Institution"
        value={profile.institution}
        placeholder="Select your institution"
        onPress={() => { setActiveModal('institution'); setSearchTerm(''); }}
        icon="school"
      />

      <SelectionButton
        label="Highest Education"
        value={profile.highestEducation}
        placeholder="Select degree type"
        onPress={() => { setActiveModal('degree'); setSearchTerm(''); }}
        icon="ribbon"
      />

      {profile.highestEducation && (
        <SelectionButton
          label="Field of Study"
          value={profile.fieldOfStudy}
          placeholder="Select field of study"
          onPress={openFieldModal}
          icon="library"
        />
      )}

      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>Graduation Year (Optional)</Text>
        <TextInput
          style={styles.textInput}
          value={profile.graduationYear || ''}
          onChangeText={(t) => handleTextChange('graduationYear', t)}
          placeholder="e.g., 2024"
          placeholderTextColor={colors.gray400}
          keyboardType="numeric"
          maxLength={4}
        />
      </View>

      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>GPA/Grade (Optional)</Text>
        <TextInput
          style={styles.textInput}
          value={profile.gpa || ''}
          onChangeText={(t) => handleTextChange('gpa', t)}
          placeholder="e.g., 3.8/4.0, 85%"
          placeholderTextColor={colors.gray400}
        />
      </View>

      <Modal
        visible={activeModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setActiveModal(null)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{getModalTitle()}</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.gray500} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor={colors.gray400}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <Ionicons name="close-circle" size={20} color={colors.gray400} />
              </TouchableOpacity>
            )}
          </View>

          {isLoading() ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (
            <FlatList
              data={getFilteredData()}
              keyExtractor={(item, i) => `${activeModal}-${typeof item === 'string' ? item : item.id || item.code}-${i}`}
              renderItem={renderItem}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No results found</Text>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
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
  selectionValue: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    flex: 1,
  },
  placeholder: {
    color: colors.gray400,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
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
    margin: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemText: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  modalItemSub: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    marginTop: 4,
  },
  categoryHeader: {
    backgroundColor: colors.primary + '15',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  categoryHeaderText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.gray600,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.gray500,
  },
});
