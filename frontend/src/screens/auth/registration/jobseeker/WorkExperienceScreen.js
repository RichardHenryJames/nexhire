import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../contexts/ThemeContext';
import { typography } from '../../../../styles/theme';
import { authDarkColors } from '../../../../styles/authDarkColors';
import useResponsive from '../../../../hooks/useResponsive';
import refopenAPI from '../../../../services/api';
import DatePicker from '../../../../components/DatePicker';
import { showToast } from '../../../../components/Toast';

// Debounce like college picker
const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
};

const EXPERIENCE_LEVELS = [
  '0-1 years',
  '1-3 years', 
  '3-5 years',
  '5-10 years',
  '10+ years'
];

export default function WorkExperienceScreen({ navigation, route }) {
  const colors = authDarkColors; // Always use dark colors for auth screens
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  // Load job types and workplace types from database
  const [jobTypes, setJobTypes] = useState([]);
  const [workplaceTypes, setWorkplaceTypes] = useState([]);
  const [loadingReferenceData, setLoadingReferenceData] = useState(true);
  
  // Job Roles for dropdown
  const [jobRoles, setJobRoles] = useState([]);
  const [loadingJobRoles, setLoadingJobRoles] = useState(false);
  const [showJobTitleDropdown, setShowJobTitleDropdown] = useState(false);
  const [jobTitleSearch, setJobTitleSearch] = useState('');

  // NEW: Separate state for current and previous work experiences
  const [currentWorkData, setCurrentWorkData] = useState({
    currentJobTitle: '',
    organizationId: null,
    currentCompany: '',
    startDate: '',
    yearsOfExperience: '',
    workArrangement: '',
    jobType: '',
    summary: '',
  });

  const [previousWorkData, setPreviousWorkData] = useState({
    currentJobTitle: '',
    organizationId: null,
    currentCompany: '',
    startDate: '',
    endDate: '',
    yearsOfExperience: '',
    workArrangement: '',
    jobType: '',
    summary: '',
  });

  // NEW: Store selected organization objects to preserve logo URLs
  const [selectedOrganization, setSelectedOrganization] = useState(null);

  // Track which tab is active
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'previous'

  // NEW: Computed formData based on active tab
  const formData = activeTab === 'current' ? currentWorkData : previousWorkData;
  const setFormData = activeTab === 'current' ? setCurrentWorkData : setPreviousWorkData;

  // Modals
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [showJobTypeModal, setShowJobTypeModal] = useState(false);
  const [showWorkArrangementModal, setShowWorkArrangementModal] = useState(false);

  // Company picker state (GLOBAL MODAL like education screen)
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgQuery, setOrgQuery] = useState('');
  const debouncedOrgQuery = useDebounce(orgQuery, 300);
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [manualOrgMode, setManualOrgMode] = useState(false);

  const { userType, experienceType } = route.params;

  // Load reference data from database on mount
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        setLoadingReferenceData(true);
        const [refData, jobRolesData] = await Promise.all([
          refopenAPI.getBulkReferenceMetadata(['JobType', 'WorkplaceType']),
          refopenAPI.getReferenceMetadata('JobRole')
        ]);
        
        if (refData?.success && refData.data) {
          // Transform JobType data
          if (refData.data.JobType) {
            const transformedJobTypes = refData.data.JobType.map(item => item.Value);
            setJobTypes(transformedJobTypes);
          }
          
          // Transform WorkplaceType data
          if (refData.data.WorkplaceType) {
            const transformedWorkplaceTypes = refData.data.WorkplaceType.map(item => item.Value);
            setWorkplaceTypes(transformedWorkplaceTypes);
          }
        }
        
        // Load job roles for dropdown
        if (jobRolesData?.success && Array.isArray(jobRolesData.data)) {
          setJobRoles(jobRolesData.data.sort((a, b) => 
            (a.Value || '').localeCompare(b.Value || '')
          ));
        }
      } catch (error) {
        console.error('Failed to load reference data:', error);
        // Set default values as fallback
        setJobTypes(['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Temporary']);
        setWorkplaceTypes(['On-site', 'Remote', 'Hybrid']);
      } finally {
        setLoadingReferenceData(false);
      }
    };

    loadReferenceData();
  }, []);

  const updateField = useCallback((field, value) => {
    setFormData(prevData => ({
      ...prevData,
      [field]: value
    }));
  }, [setFormData]);

  const InputField = useMemo(() => React.memo(({ label, value, onChangeText, placeholder, multiline = false, required = false, keyboardType = 'default' }) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[styles.textInput, multiline && styles.multilineInput]}
        placeholder={placeholder}
        placeholderTextColor={colors.gray400}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
        returnKeyType={multiline ? 'default' : 'next'}
        blurOnSubmit={!multiline}
        autoCorrect={false}
        spellCheck={false}
        selectTextOnFocus={false}
      />
    </View>
  )), []);

  const SelectionModal = ({ visible, onClose, title, data, onSelect, currentValue }) => (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>

        <FlatList
          data={data}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.modalItem,
                currentValue === item && styles.modalItemSelected
              ]}
              onPress={() => onSelect(item)}
            >
              {/* NEW: Show company logo if available */}
              {item.logoUrl ? (
                <Image source={{ uri: item.logoUrl }} style={styles.logoImage} />
              ) : (
                <Ionicons name="business" size={24} color={colors.gray400} />
              )}
              
              <Text style={[
                styles.modalItemText,
                currentValue === item && styles.modalItemTextSelected
              ]}>
                {item}
              </Text>
              {currentValue === item && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );

  // Organization helpers
  const applyOrgFilter = (list, q) => {
    if (!Array.isArray(list)) return [];
    if (!q || !q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter(o =>
      (o.name && o.name.toLowerCase().includes(s)) ||
      (o.website && o.website.toLowerCase().includes(s)) ||
      (o.industry && o.industry.toLowerCase().includes(s))
    );
  };

  // Debounced organization search using a single modal at root
  const orgFirstLoad = useRef(false);
  useEffect(() => {
    const search = async () => {
      if (!showOrgModal || manualOrgMode) return; // skip fetching when manual mode
      try {
        setOrgLoading(true);
        const res = await refopenAPI.getOrganizations(debouncedOrgQuery || '', null); // No limit
        const raw = (res && res.success && Array.isArray(res.data)) ? res.data : [];
        // Apply client-side filter for better UX and to support partial matches
        const filtered = applyOrgFilter(raw, debouncedOrgQuery);
        setOrgResults(filtered);
      } catch (e) {
        setOrgResults([]);
      } finally {
        setOrgLoading(false);
      }
    };
    search();
  }, [debouncedOrgQuery, showOrgModal, manualOrgMode]);

  const openOrgModal = () => {
    setShowOrgModal(true);
    setManualOrgMode(false);
    if (orgResults.length === 0) setOrgQuery('');
  };
  const closeOrgModal = () => setShowOrgModal(false);

  const handleSelectOrganization = (org) => {
    if (org.id === 999999) {
      updateField('organizationId', null);
      setSelectedOrganization(null);
    } else {
      updateField('organizationId', org.id);
      updateField('currentCompany', org.name);
      setSelectedOrganization(org); // Store the complete org object for logo access
    }
    closeOrgModal();
  };

  // NEW: Validate and prepare work experience data
  const prepareWorkExperienceData = () => {
    const workExperiences = [];

    // Add current work if filled
    if (currentWorkData.currentJobTitle?.trim()) {
      workExperiences.push({
        jobTitle: currentWorkData.currentJobTitle.trim(),
        companyName: currentWorkData.currentCompany?.trim() || null,
        organizationId: currentWorkData.organizationId || null,
        startDate: currentWorkData.startDate?.trim() || null,
        endDate: null, // Current work has no end date
        isCurrentPosition: true,
        workArrangement: currentWorkData.workArrangement || null,
        jobType: currentWorkData.jobType || null,
        summary: currentWorkData.summary?.trim() || null,
      });
    }

    // Add previous work if filled
    if (previousWorkData.currentJobTitle?.trim()) {
      workExperiences.push({
        jobTitle: previousWorkData.currentJobTitle.trim(),
        companyName: previousWorkData.currentCompany?.trim() || null,
        organizationId: previousWorkData.organizationId || null,
        startDate: previousWorkData.startDate?.trim() || null,
        endDate: previousWorkData.endDate?.trim() || null,
        isCurrentPosition: false,
        workArrangement: previousWorkData.workArrangement || null,
        jobType: previousWorkData.jobType || null,
        summary: previousWorkData.summary?.trim() || null,
      });
    }

    return workExperiences;
  };

  const handleContinue = () => {
    // Validate at least current OR previous is filled
    const hasCurrentWork = currentWorkData.currentJobTitle?.trim();
    const hasPreviousWork = previousWorkData.currentJobTitle?.trim();

    if (!hasCurrentWork && !hasPreviousWork) {
      showToast('Please enter at least one work experience (current or previous)', 'error');
      return;
    }

    // Validate current work if filled
    if (hasCurrentWork && !currentWorkData.startDate?.trim()) {
      showToast('Please enter start date for your current position', 'error');
      return;
    }

    // Validate previous work if filled
    if (hasPreviousWork) {
      if (!previousWorkData.startDate?.trim()) {
        showToast('Please enter start date for your previous position', 'error');
        return;
      }
      if (!previousWorkData.endDate?.trim()) {
        showToast('Please enter end date for your previous position', 'error');
        return;
      }
    }

    // NEW: Pass array of work experiences
    const workExperiences = prepareWorkExperienceData();

    navigation.navigate('EducationDetailsScreen', { 
      userType, 
      experienceType,
      workExperienceData: workExperiences, // Now an array!
    });
  };

  const OrgPickerButton = () => {
    return (
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Company</Text>
        <TouchableOpacity style={styles.selectionButton} onPress={openOrgModal}>
          {formData.currentCompany ? (
            <View style={styles.companySelectorContent}>
              {selectedOrganization?.logoURL ? (
                <Image
                  source={{ uri: selectedOrganization.logoURL }}
                  style={styles.companySelectorLogo}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.companySelectorLogoPlaceholder}>
                  <Ionicons name="business" size={16} color={colors.gray400} />
                </View>
              )}
              <Text style={styles.selectionValue}>{formData.currentCompany}</Text>
            </View>
          ) : (
            <Text style={[styles.selectionValue, styles.selectionPlaceholder]}>
              Select or search company
            </Text>
          )}
          <Ionicons name="chevron-down" size={20} color={colors.gray500} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.innerContainer}>
      <ScrollView 
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            
            <Text style={styles.title}>Tell us about your work experience</Text>
            <Text style={styles.subtitle}>
              This helps us understand your professional background and match you with relevant opportunities
            </Text>
          </View>

          <View style={styles.form}>
            {/* Employment Status */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Employment Status</Text>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[styles.toggleOption, activeTab === 'current' && styles.toggleOptionSelected]}
                  onPress={() => setActiveTab('current')}
                >
                  <Text style={[styles.toggleText, activeTab === 'current' && styles.toggleTextSelected]}>
                    Currently Working
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleOption, activeTab === 'previous' && styles.toggleOptionSelected]}
                  onPress={() => setActiveTab('previous')}
                >
                  <Text style={[styles.toggleText, activeTab === 'previous' && styles.toggleTextSelected]}>
                    Previously Worked
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Job Title (required) - with searchable dropdown */}
            <View style={[styles.inputContainer, { position: 'relative', zIndex: 1000 }]}>
              <Text style={styles.inputLabel}>
                {activeTab === 'current' ? "Current Job Title" : "Most Recent Job Title"} <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Software Engineer, Marketing Manager"
                placeholderTextColor={colors.gray400}
                value={jobTitleSearch || formData.currentJobTitle}
                onChangeText={(text) => {
                  setJobTitleSearch(text);
                  updateField('currentJobTitle', text);
                  setShowJobTitleDropdown(text.length > 0);
                }}
                onFocus={() => {
                  if (formData.currentJobTitle) {
                    setJobTitleSearch('');
                  }
                }}
                returnKeyType="next"
                blurOnSubmit={false}
                autoCorrect={false}
                spellCheck={false}
              />
              {showJobTitleDropdown && jobTitleSearch.length > 0 && (
                <View style={styles.dropdownContainer}>
                  {loadingJobRoles ? (
                    <View style={styles.dropdownLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  ) : (
                    <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
                      {jobRoles
                        .filter(role => role.Value && role.Value.toLowerCase().includes(jobTitleSearch.toLowerCase()))
                        .slice(0, 15)
                        .map((role) => (
                          <TouchableOpacity
                            key={role.ReferenceID}
                            style={styles.dropdownItem}
                            onPress={() => {
                              updateField('currentJobTitle', role.Value);
                              setJobTitleSearch('');
                              setShowJobTitleDropdown(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{role.Value}</Text>
                          </TouchableOpacity>
                        ))
                      }
                      {jobRoles.filter(role => role.Value && role.Value.toLowerCase().includes(jobTitleSearch.toLowerCase())).length === 0 && (
                        <View style={styles.dropdownEmpty}>
                          <Text style={styles.dropdownEmptyText}>No matches - keep typing</Text>
                        </View>
                      )}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>

            {/* Company (Org Picker + manual) */}
            <View style={{ position: 'relative', zIndex: 1 }}>
              <OrgPickerButton />
            </View>

            {/* Start/End Dates - ? REPLACED with DatePicker */}
            <DatePicker
              label="Start Date"
              value={formData.startDate}
              onChange={(date) => updateField('startDate', date)}
              placeholder="Select start date"
              required
              maximumDate={new Date()} // Can't start in the future
              colors={colors}
            />
            
            {/* FIXED: Only show End Date field when on "Previously Worked" tab */}
            {activeTab === 'previous' && (
              <DatePicker
                label="End Date"
                value={formData.endDate}
                onChange={(date) => updateField('endDate', date)}
                placeholder="Select end date"
                required
                minimumDate={formData.startDate ? new Date(formData.startDate) : undefined} // End date must be after start date
                maximumDate={new Date()} // Can't end in the future
                colors={colors}
              />
            )}

            <InputField
              label="Professional Summary"
              value={formData.summary}
              onChangeText={(text) => updateField('summary', text)}
              placeholder="Brief overview of your professional experience and achievements"
              multiline
            />
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

      {/* COMPANY PICKER MODAL (global) with inline manual entry */}
      <Modal
        visible={showOrgModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOrgModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalInnerContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowOrgModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Company</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="search" size={18} color={colors.gray600} />
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder={manualOrgMode ? 'Enter company name' : 'Search companies...'}
              placeholderTextColor={colors.gray400}
              value={orgQuery}
              onChangeText={setOrgQuery}
              autoCapitalize="words"
            />
            {manualOrgMode ? (
              <TouchableOpacity
                onPress={() => {
                  const name = (orgQuery || '').trim();
                  if (!name) { showToast('Type your company name above', 'error'); return; }
                  updateField('organizationId', null);
                  updateField('currentCompany', name);
                  setShowOrgModal(false);
                }}
              >
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              </TouchableOpacity>
            ) : (orgLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <TouchableOpacity onPress={() => setOrgQuery(orgQuery)}>
                <Ionicons name="refresh" size={18} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Manual toggle */}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}
            onPress={() => setManualOrgMode(v => !v)}
          >
            <Ionicons name={manualOrgMode ? 'checkbox-outline' : 'square-outline'} size={18} color={colors.primary} />
            <Text style={{ color: colors.text, marginLeft: 8 }}>My company is not listed</Text>
          </TouchableOpacity>

          {!manualOrgMode && (
            <FlatList
              data={orgResults}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectOrganization(item)}>
                  {/* Company Logo */}
                  {item.logoURL ? (
                    <Image
                      source={{ uri: item.logoURL }}
                      style={styles.companyLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.companyLogoPlaceholder}>
                      <Ionicons name="business" size={20} color={colors.gray400} />
                    </View>
                  )}
                  
                  <View style={styles.companyInfo}>
                    <Text style={styles.modalItemText}>{item.name}</Text>
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

      {/* OTHER PICKERS */}
      <SelectionModal
        visible={showExperienceModal}
        onClose={() => setShowExperienceModal(false)}
        title="Select Experience Level"
        data={EXPERIENCE_LEVELS}
        currentValue={formData.yearsOfExperience}
        onSelect={(value) => {
          updateField('yearsOfExperience', value);
          setShowExperienceModal(false);
        }}
      />

      <SelectionModal
        visible={showJobTypeModal}
        onClose={() => setShowJobTypeModal(false)}
        title="Select Job Type"
        data={jobTypes}
        currentValue={formData.jobType}
        onSelect={(value) => {
          updateField('jobType', value);
          setShowJobTypeModal(false);
        }}
      />

      <SelectionModal
        visible={showWorkArrangementModal}
        onClose={() => setShowWorkArrangementModal(false)}
        title="Select Work Arrangement"
        data={workplaceTypes}
        currentValue={formData.workArrangement}
        onSelect={(value) => {
          updateField('workArrangement', value);
          setShowWorkArrangementModal(false);
        }}
      />
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  innerContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 600 : '100%',
    flex: 1,
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
    gap: 16,
    marginBottom: 32,
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
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectionButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
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
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  toggleOption: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 12,
    alignItems: 'center',
  },
  toggleOptionSelected: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  toggleTextSelected: {
    color: colors.white,
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
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      zIndex: 9999,
    } : {}),
  },
  modalInnerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      flex: 'none',
      width: '100%',
      maxWidth: 600,
      height: '80vh',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    } : {}),
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
    color: colors.text,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemSelected: {
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  modalItemText: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  modalItemTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  // Company selector styles with logo support
  companySelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  companySelectorLogo: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: colors.white,
  },
  companySelectorLogoPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  companyLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  companyInfo: {
    flex: 1,
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 250,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  dropdownScroll: {
    maxHeight: 250,
  },
  dropdownLoading: {
    padding: 20,
    alignItems: 'center',
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemText: {
    fontSize: 15,
    color: colors.text,
  },
  dropdownEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    fontSize: 14,
    color: colors.gray400,
    fontStyle: 'italic',
  },
});