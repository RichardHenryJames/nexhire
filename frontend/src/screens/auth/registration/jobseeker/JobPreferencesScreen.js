import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../../styles/theme';
import nexhireAPI from '../../../../services/api';

// CRITICAL FIX: Move JobTypeItem outside main component to prevent re-renders
const JobTypeItem = React.memo(({ jobType, isSelected, onToggle }) => {
  // Use a stable handler that doesn't change
  const handlePress = useCallback(() => {
    onToggle(jobType);
  }, [jobType, onToggle]);

  return (
    <TouchableOpacity
      style={[
        styles.jobTypeItem,
        isSelected && styles.jobTypeItemSelected
      ]}
      onPress={handlePress}
      activeOpacity={0.6}
      // CRITICAL: Prevent any event interference
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => false}
    >
      <View style={styles.jobTypeContent}>
        <Text style={[
          styles.jobTypeText,
          isSelected && styles.jobTypeTextSelected
        ]}>
          {jobType.Type}
        </Text>
        {/* <Text style={styles.jobTypeDescription}>
          {getJobTypeDescription(jobType.Type)}
        </Text> */}
      </View>
      
      <View style={[
        styles.checkbox,
        isSelected && styles.checkboxSelected
      ]}>
        {isSelected && (
          <Ionicons name="checkmark" size={16} color={colors.white} />
        )}
      </View>
    </TouchableOpacity>
  );
});

export default function JobPreferencesScreen({ navigation, route }) {
  // CRITICAL FIX: Use useRef to prevent unnecessary re-renders
  const [formData, setFormData] = useState({
    preferredJobTypes: [],
    workplaceType: '',
    preferredLocations: '',
  });
  
  const [jobTypes, setJobTypes] = useState([]);
  const [showJobTypesModal, setShowJobTypesModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const { userType, experienceType, workExperienceData, educationData } = route.params;

  const WORKPLACE_TYPES = React.useMemo(() => [
    { id: 'remote', name: 'Remote', icon: 'home', description: 'Work from anywhere' },
    { id: 'hybrid', name: 'Hybrid', icon: 'swap-horizontal', description: 'Mix of office and remote' },
    { id: 'onsite', name: 'On-site', icon: 'business', description: 'Work from office' },
  ], []);

  useEffect(() => {
    loadJobTypes();
  }, []);

  const loadJobTypes = async () => {
    try {
      setLoading(true);
      console.log('Loading job types from API...');
      const response = await nexhireAPI.getJobTypes();
      if (response.success) {
        setJobTypes(response.data);
        console.log(`? Loaded ${response.data.length} job types`);
      }
    } catch (error) {
      console.error('Error loading job types:', error);
      // Use fallback data
      setJobTypes([
        { JobTypeID: 1, Type: 'Full-Time' },
        { JobTypeID: 2, Type: 'Contract' },
        { JobTypeID: 3, Type: 'Part-Time' },
        { JobTypeID: 4, Type: 'Internship' },
        { JobTypeID: 5, Type: 'Freelance' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // CRITICAL FIX: Ultra-stable handlers with useCallback and dependency control
  const handleJobTypeToggle = useCallback((jobType) => {
    console.log('Toggling job type:', jobType.Type);
    setFormData(prevData => {
      const isSelected = prevData.preferredJobTypes.some(jt => jt.JobTypeID === jobType.JobTypeID);
      
      const newPreferredJobTypes = isSelected
        ? prevData.preferredJobTypes.filter(jt => jt.JobTypeID !== jobType.JobTypeID)
        : [...prevData.preferredJobTypes, jobType];
      
      console.log('Updated selection count:', newPreferredJobTypes.length);
      
      return {
        ...prevData,
        preferredJobTypes: newPreferredJobTypes
      };
    });
    // CRITICAL: Modal should NOT close here
  }, []);

  const handleJobTypesDone = useCallback(() => {
    console.log('Job types selection completed');
    setShowJobTypesModal(false);
  }, []);

  const handleModalClose = useCallback(() => {
    console.log('Modal closed via X button');
    setShowJobTypesModal(false);
  }, []);

  const openJobTypeModal = useCallback(() => {
    console.log('Opening job types modal');
    setShowJobTypesModal(true);
  }, []);

  const clearAllJobTypes = useCallback(() => {
    console.log('??? Clearing all job types');
    setFormData(prevData => ({
      ...prevData,
      preferredJobTypes: []
    }));
  }, []);

  // CRITICAL: Memoize selected IDs to prevent unnecessary re-renders
  const selectedJobTypeIds = useMemo(() => {
    return formData.preferredJobTypes.map(jt => jt.JobTypeID);
  }, [formData.preferredJobTypes]);

  // CRITICAL: Memoize job types to prevent re-renders
  const memoizedJobTypes = useMemo(() => jobTypes, [jobTypes]);
  
  // Memoize modal visibility state to prevent flicker
  const modalVisible = React.useMemo(() => showJobTypesModal, [showJobTypesModal]);

  const handleContinue = () => {
    if (formData.preferredJobTypes.length === 0) {
      Alert.alert('Required Field', 'Please select at least one job type');
      return;
    }
    if (!formData.workplaceType) {
      Alert.alert('Required Field', 'Please select your workplace preference');
      return;
    }

    console.log('Job preferences prepared:', formData);
    
    navigation.navigate('PersonalDetails', { 
      userType, 
      experienceType,
      workExperienceData,
      educationData,
      jobPreferences: formData
    });
  };

  const WorkplaceCard = ({ type, isSelected, onPress }) => (
    <TouchableOpacity
      style={[
        styles.workplaceCard,
        isSelected && styles.workplaceCardSelected
      ]}
      onPress={onPress}
    >
      <Ionicons 
        name={type.icon} 
        size={32} 
        color={isSelected ? colors.primary : colors.gray500} 
      />
      <Text style={[
        styles.workplaceTitle,
        isSelected && styles.workplaceTitleSelected
      ]}>
        {type.name}
      </Text>
      <Text style={styles.workplaceDescription}>{type.description}</Text>
      {isSelected && (
        <Ionicons 
          name="checkmark-circle" 
          size={20} 
          color={colors.primary} 
          style={styles.checkIcon}
        />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading job preferences...</Text>
      </View>
    );
  }

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

            <Text style={styles.title}>What type of work interests you?</Text>
            <Text style={styles.subtitle}>
              Tell us about your job preferences so we can show you relevant opportunities
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job Types *</Text>
            <TouchableOpacity 
              style={styles.selectionButton}
              onPress={openJobTypeModal}
            >
              <View style={styles.selectionContent}>
                <Text style={[
                  styles.selectionLabel,
                  formData.preferredJobTypes.length === 0 && styles.placeholderText
                ]}>
                  {formData.preferredJobTypes.length > 0 
                    ? `${formData.preferredJobTypes.length} type${formData.preferredJobTypes.length > 1 ? 's' : ''} selected`
                    : 'Select job types that interest you'
                  }
                </Text>
                {formData.preferredJobTypes.length > 0 && (
                  <View style={styles.selectedIndicator}>
                    <Text style={styles.selectedIndicatorText}>
                      {formData.preferredJobTypes.length}
                    </Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray500} />
            </TouchableOpacity>
            
            {formData.preferredJobTypes.length > 0 && (
              <View style={styles.selectedJobTypes}>
                {formData.preferredJobTypes.map((jobType, index) => (
                  <View key={jobType.JobTypeID} style={styles.jobTypeTag}>
                    <Text style={styles.jobTypeTagText}>{jobType.Type}</Text>
                    <TouchableOpacity
                      onPress={() => handleJobTypeToggle(jobType)}
                      style={styles.removeJobType}
                    >
                      <Ionicons name="close" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Work Style Preference *</Text>
            <View style={styles.workplaceGrid}>
              {WORKPLACE_TYPES.map((type) => (
                <WorkplaceCard
                  key={type.id}
                  type={type}
                  isSelected={formData.workplaceType === type.id}
                  onPress={() => setFormData({ ...formData, workplaceType: type.id })}
                />
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.continueButton,
              (formData.preferredJobTypes.length === 0 || !formData.workplaceType) && styles.continueButtonDisabled
            ]}
            onPress={handleContinue}
            disabled={formData.preferredJobTypes.length === 0 || !formData.workplaceType}
          >
            <Text style={[
              styles.continueButtonText,
              (formData.preferredJobTypes.length === 0 || !formData.workplaceType) && styles.continueButtonTextDisabled
            ]}>
              Continue
            </Text>
            <Ionicons 
              name="arrow-forward" 
              size={20} 
              color={
                (formData.preferredJobTypes.length === 0 || !formData.workplaceType) 
                  ? colors.gray400 
                  : colors.white
              } 
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ? RESTORED: Job Type Selection Modal */}
      <Modal
        visible={showJobTypesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleModalClose}
        supportedOrientations={['portrait']}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <TouchableOpacity onPress={handleModalClose}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalTitle}>Select Job Types</Text>
            
            <View style={styles.modalHeaderRight}>
              <TouchableOpacity 
                onPress={handleJobTypesDone}
                style={styles.doneButtonContainer}
              >
                <Text style={styles.doneButton}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            style={styles.modalContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
          >
            <View style={styles.modalSubtitleContainer}>
              <Text style={styles.modalSubtitle}>Choose all that interest you</Text>
              {selectedJobTypeIds.length > 0 && (
                <Text style={styles.selectedCount}>
                  {selectedJobTypeIds.length} selected
                </Text>
              )}
            </View>

            <View style={styles.instructionContainer}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={styles.instructionText}>
                Tap multiple options, then press "Done" when finished
              </Text>
            </View>
            
            {memoizedJobTypes.map((jobType) => {
              const isSelected = selectedJobTypeIds.includes(jobType.JobTypeID);
              return (
                <JobTypeItem
                  key={`jobtype-${jobType.JobTypeID}`}
                  jobType={jobType}
                  isSelected={isSelected}
                  onToggle={handleJobTypeToggle}
                />
              );
            })}
            
            {selectedJobTypeIds.length > 0 && (
              <TouchableOpacity
                style={styles.clearAllButton}
                onPress={clearAllJobTypes}
              >
                <Ionicons name="refresh" size={16} color={colors.danger} />
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            )}

            {selectedJobTypeIds.length > 0 && (
              <View style={styles.selectionSummary}>
                <Text style={styles.selectionSummaryText}>
                  {selectedJobTypeIds.length} job type{selectedJobTypeIds.length > 1 ? 's' : ''} selected
                </Text>
                <TouchableOpacity 
                  style={styles.doneButtonBottom}
                  onPress={handleJobTypesDone}
                >
                  <Text style={styles.doneButtonBottomText}>Done</Text>
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: typography.sizes.md,
    color: colors.gray600,
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
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.gray600,
    lineHeight: 22,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 16,
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
  selectionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionLabel: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    flex: 1,
  },
  placeholderText: {
    color: colors.gray400,
  },
  selectedIndicator: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  selectedIndicatorText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  selectedJobTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  jobTypeTag: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobTypeTagText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  removeJobType: {
    padding: 2,
  },
  workplaceGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  workplaceCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
  },
  workplaceCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  workplaceTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
  },
  workplaceTitleSelected: {
    color: colors.primary,
  },
  workplaceDescription: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    textAlign: 'center',
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  continueButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  continueButtonDisabled: {
    backgroundColor: colors.gray200,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  continueButtonTextDisabled: {
    color: colors.gray400,
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
  modalHeaderLeft: {
    width: 40,
  },
  modalHeaderRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  doneButtonContainer: {
    padding: 4,
  },
  doneButton: {
    fontSize: typography.sizes.base,
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSubtitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.gray600,
  },
  selectedCount: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  // CRITICAL: Add styles for optimized components
  jobTypeItem: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.border,
  },
  jobTypeItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  jobTypeContent: {
    flex: 1,
  },
  jobTypeText: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    marginBottom: 2,
  },
  jobTypeTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  jobTypeDescription: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  clearAllText: {
    fontSize: typography.sizes.base,
    color: colors.danger,
    fontWeight: typography.weights.medium,
  },
  // Enhanced: New styles for better multi-selection UX
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  instructionText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    flex: 1,
  },
  selectionSummary: {
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 12,
  },
  selectionSummaryText: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  doneButtonBottom: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doneButtonBottomText: {
    color: colors.white,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
});