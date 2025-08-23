import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../../styles/theme';

const EXPERIENCE_LEVELS = [
  '0-1 years',
  '1-3 years', 
  '3-5 years',
  '5-10 years',
  '10+ years'
];

const JOB_TYPES = [
  'Full-time',
  'Part-time', 
  'Contract',
  'Freelance',
  'Internship',
  'Temporary'
];

const WORK_ARRANGEMENTS = [
  'On-site',
  'Remote',
  'Hybrid'
];

export default function WorkExperienceScreen({ navigation, route }) {
  const [formData, setFormData] = useState({
    currentJobTitle: '',
    currentCompany: '',
    yearsOfExperience: '',
    previousJobTitle: '',
    previousCompany: '',
    workArrangement: '',
    jobType: '',
    primarySkills: '',
    secondarySkills: '',
    isCurrentlyWorking: true,
    summary: '',
  });

  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [showJobTypeModal, setShowJobTypeModal] = useState(false);
  const [showWorkArrangementModal, setShowWorkArrangementModal] = useState(false);

  const { userType, experienceType } = route.params;

  const handleContinue = () => {
    // Validate required fields
    if (!formData.currentJobTitle.trim()) {
      Alert.alert('Required Field', 'Please enter your current or most recent job title');
      return;
    }
    if (!formData.currentCompany.trim()) {
      Alert.alert('Required Field', 'Please enter your current or most recent company');
      return;
    }
    if (!formData.yearsOfExperience) {
      Alert.alert('Required Field', 'Please select your years of experience');
      return;
    }
    if (!formData.primarySkills.trim()) {
      Alert.alert('Required Field', 'Please enter your primary skills');
      return;
    }

    // Continue to education details (even experienced professionals need education info)
    navigation.navigate('EducationDetailsScreen', { 
      userType, 
      experienceType,
      workExperienceData: formData
    });
  };

  const SelectionModal = ({ visible, onClose, title, data, onSelect, currentValue }) => (
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
              onPress={() => {
                onSelect(item);
                onClose();
              }}
            >
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

  const SelectionButton = ({ label, value, onPress, placeholder, required = false }) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TouchableOpacity style={styles.selectionButton} onPress={onPress}>
        <Text style={[
          styles.selectionValue,
          !value && styles.selectionPlaceholder
        ]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.gray500} />
      </TouchableOpacity>
    </View>
  );

  const InputField = ({ label, value, onChangeText, placeholder, multiline = false, required = false }) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[styles.textInput, multiline && styles.multilineInput]}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );

  const ToggleButton = ({ label, value, onToggle }) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleOption,
            value === true && styles.toggleOptionSelected
          ]}
          onPress={() => onToggle(true)}
        >
          <Text style={[
            styles.toggleText,
            value === true && styles.toggleTextSelected
          ]}>
            Currently Working
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleOption,
            value === false && styles.toggleOptionSelected
          ]}
          onPress={() => onToggle(false)}
        >
          <Text style={[
            styles.toggleText,
            value === false && styles.toggleTextSelected
          ]}>
            Previously Worked
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
            
            <Text style={styles.title}>Tell us about your work experience</Text>
            <Text style={styles.subtitle}>
              This helps us understand your professional background and match you with relevant opportunities
            </Text>
          </View>

          <View style={styles.form}>
            <ToggleButton
              label="Employment Status"
              value={formData.isCurrentlyWorking}
              onToggle={(value) => setFormData({ ...formData, isCurrentlyWorking: value })}
            />

            <InputField
              label={formData.isCurrentlyWorking ? "Current Job Title" : "Most Recent Job Title"}
              value={formData.currentJobTitle}
              onChangeText={(text) => setFormData({ ...formData, currentJobTitle: text })}
              placeholder="e.g. Software Engineer, Marketing Manager"
              required
            />

            <InputField
              label={formData.isCurrentlyWorking ? "Current Company" : "Most Recent Company"}
              value={formData.currentCompany}
              onChangeText={(text) => setFormData({ ...formData, currentCompany: text })}
              placeholder="e.g. Google, Microsoft, Startup Inc."
              required
            />

            <SelectionButton
              label="Total Years of Experience"
              value={formData.yearsOfExperience}
              placeholder="Select experience level"
              onPress={() => setShowExperienceModal(true)}
              required
            />

            <SelectionButton
              label="Work Arrangement"
              value={formData.workArrangement}
              placeholder="Select work arrangement"
              onPress={() => setShowWorkArrangementModal(true)}
            />

            <SelectionButton
              label="Job Type"
              value={formData.jobType}
              placeholder="Select job type"
              onPress={() => setShowJobTypeModal(true)}
            />

            {!formData.isCurrentlyWorking && (
              <>
                <InputField
                  label="Previous Job Title"
                  value={formData.previousJobTitle}
                  onChangeText={(text) => setFormData({ ...formData, previousJobTitle: text })}
                  placeholder="Your previous role"
                />

                <InputField
                  label="Previous Company"
                  value={formData.previousCompany}
                  onChangeText={(text) => setFormData({ ...formData, previousCompany: text })}
                  placeholder="Your previous company"
                />
              </>
            )}

            <InputField
              label="Primary Skills"
              value={formData.primarySkills}
              onChangeText={(text) => setFormData({ ...formData, primarySkills: text })}
              placeholder="e.g. JavaScript, React, Node.js, Project Management"
              multiline
              required
            />

            <InputField
              label="Secondary Skills"
              value={formData.secondarySkills}
              onChangeText={(text) => setFormData({ ...formData, secondarySkills: text })}
              placeholder="e.g. Python, AWS, Team Leadership, Agile"
              multiline
            />

            <InputField
              label="Professional Summary"
              value={formData.summary}
              onChangeText={(text) => setFormData({ ...formData, summary: text })}
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

      {/* Modals */}
      <SelectionModal
        visible={showExperienceModal}
        onClose={() => setShowExperienceModal(false)}
        title="Select Experience Level"
        data={EXPERIENCE_LEVELS}
        currentValue={formData.yearsOfExperience}
        onSelect={(value) => setFormData({ ...formData, yearsOfExperience: value })}
      />

      <SelectionModal
        visible={showJobTypeModal}
        onClose={() => setShowJobTypeModal(false)}
        title="Select Job Type"
        data={JOB_TYPES}
        currentValue={formData.jobType}
        onSelect={(value) => setFormData({ ...formData, jobType: value })}
      />

      <SelectionModal
        visible={showWorkArrangementModal}
        onClose={() => setShowWorkArrangementModal(false)}
        title="Select Work Arrangement"
        data={WORK_ARRANGEMENTS}
        currentValue={formData.workArrangement}
        onSelect={(value) => setFormData({ ...formData, workArrangement: value })}
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
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemSelected: {
    backgroundColor: colors.primary + '08',
  },
  modalItemText: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  modalItemTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
});