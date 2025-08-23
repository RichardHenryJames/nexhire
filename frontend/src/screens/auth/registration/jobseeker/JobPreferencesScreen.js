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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../../styles/theme';
import nexhireAPI from '../../../../services/api';

export default function JobPreferencesScreen({ navigation, route }) {
  const [formData, setFormData] = useState({
    preferredJobTypes: [],
    workplaceType: '',
    preferredLocations: '',
  });
  
  const [jobTypes, setJobTypes] = useState([]);
  const [showJobTypesModal, setShowJobTypesModal] = useState(false);
  const [showWorkplaceModal, setShowWorkplaceModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const { userType, experienceType, workExperienceData, educationData } = route.params;

  const WORKPLACE_TYPES = [
    { id: 'remote', name: 'Remote', icon: 'home', description: 'Work from anywhere' },
    { id: 'hybrid', name: 'Hybrid', icon: 'swap-horizontal', description: 'Mix of office and remote' },
    { id: 'onsite', name: 'On-site', icon: 'business', description: 'Work from office' },
  ];

  useEffect(() => {
    loadJobTypes();
  }, []);

  const loadJobTypes = async () => {
    try {
      setLoading(true);
      const response = await nexhireAPI.getJobTypes();
      if (response.success) {
        setJobTypes(response.data);
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

  const handleJobTypeToggle = (jobType) => {
    const isSelected = formData.preferredJobTypes.some(jt => jt.JobTypeID === jobType.JobTypeID);
    if (isSelected) {
      setFormData({
        ...formData,
        preferredJobTypes: formData.preferredJobTypes.filter(jt => jt.JobTypeID !== jobType.JobTypeID)
      });
    } else {
      setFormData({
        ...formData,
        preferredJobTypes: [...formData.preferredJobTypes, jobType]
      });
    }
  };

  const handleContinue = () => {
    if (formData.preferredJobTypes.length === 0) {
      Alert.alert('Required Field', 'Please select at least one job type');
      return;
    }
    if (!formData.workplaceType) {
      Alert.alert('Required Field', 'Please select your workplace preference');
      return;
    }

    navigation.navigate('PersonalDetails', { 
      userType, 
      experienceType,
      workExperienceData, // Pass along work experience data
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

  const JobTypeModal = () => (
    <Modal
      visible={showJobTypesModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowJobTypesModal(false)}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Select Job Types</Text>
          <TouchableOpacity onPress={() => setShowJobTypesModal(false)}>
            <Text style={styles.doneButton}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalSubtitle}>Choose all that interest you</Text>
          {jobTypes.map((jobType) => {
            const isSelected = formData.preferredJobTypes.some(jt => jt.JobTypeID === jobType.JobTypeID);
            return (
              <TouchableOpacity
                key={jobType.JobTypeID}
                style={[
                  styles.jobTypeItem,
                  isSelected && styles.jobTypeItemSelected
                ]}
                onPress={() => handleJobTypeToggle(jobType)}
              >
                <Text style={[
                  styles.jobTypeText,
                  isSelected && styles.jobTypeTextSelected
                ]}>
                  {jobType.Type}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Loading...</Text>
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
            </TouchableOpacity
            
            <Text style={styles.title}>What type of work interests you?</Text>
            <Text style={styles.subtitle}>
              Tell us about your job preferences so we can show you relevant opportunities
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Job Types *</Text>
            <TouchableOpacity 
              style={styles.selectionButton}
              onPress={() => setShowJobTypesModal(true)}
            >
              <Text style={styles.selectionLabel}>
                {formData.preferredJobTypes.length > 0 
                  ? `${formData.preferredJobTypes.length} types selected`
                  : 'Select job types'
                }
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.gray500} />
            </TouchableOpacity>
            
            {formData.preferredJobTypes.length > 0 && (
              <View style={styles.selectedJobTypes}>
                {formData.preferredJobTypes.map((jobType, index) => (
                  <View key={jobType.JobTypeID} style={styles.jobTypeTag}>
                    <Text style={styles.jobTypeTagText}>{jobType.Type}</Text>
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
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <JobTypeModal />
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
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
  selectionLabel: {
    fontSize: typography.sizes.md,
    color: colors.text,
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
  },
  jobTypeTagText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
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
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
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
  doneButton: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    marginBottom: 20,
  },
  jobTypeItem: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  jobTypeItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  jobTypeText: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  jobTypeTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
});