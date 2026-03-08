import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  ScrollView, 
  Image,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../contexts/AuthContext';
import { useTheme } from '../../../../contexts/ThemeContext';
import { typography } from '../../../../styles/theme';
import { authDarkColors } from '../../../../styles/authDarkColors';
import useResponsive from '../../../../hooks/useResponsive';
import refopenAPI from '../../../../services/api';
import { showToast } from '../../../../components/Toast';
import RegistrationWrapper from '../../../../components/auth/RegistrationWrapper';

export default function EmployerPersonalDetailsScreen({ navigation, route }) {
  const colors = authDarkColors; // Always use dark colors for auth screens
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const { pendingGoogleAuth } = useAuth();
  const { employerType = 'startup', selectedCompany, fromGoogleAuth, skipEmailPassword } = route.params || {};

  // Check if this is a Google user
  const isGoogleUser = fromGoogleAuth || pendingGoogleAuth;
  const googleUser = pendingGoogleAuth?.user;

  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [linkedInProfile, setLinkedInProfile] = useState('');
  const [bio, setBio] = useState('');
  const [errors, setErrors] = useState({});

  // Reference dropdowns
  const [jobRoles, setJobRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingRef, setLoadingRef] = useState(true);

  const [showJobTitleModal, setShowJobTitleModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [jobTitleSearch, setJobTitleSearch] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');

  // Pre-populate some data for Google users
  useEffect(() => {
    if (isGoogleUser && googleUser) {
      
      
      // You could potentially derive job title from LinkedIn data if available
      // For now, we'll keep the defaults but could enhance this
    }
  }, [isGoogleUser, googleUser]);

  // Load JobRole + Department from ReferenceMetadata
  useEffect(() => {
    const loadReference = async () => {
      try {
        setLoadingRef(true);
        const res = await refopenAPI.getBulkReferenceMetadata(['JobRole', 'Department']);
        if (res?.success && res.data) {
          const jobRoleItems = Array.isArray(res.data.JobRole) ? res.data.JobRole : [];
          const departmentItems = Array.isArray(res.data.Department) ? res.data.Department : [];

          setJobRoles(jobRoleItems);
          setDepartments(departmentItems);

          // Default Department: Human Resources (only if user hasn't picked one)
          const defaultHrDept = departmentItems.find(d => (d?.Value || '').trim().toLowerCase() === 'human resources')?.Value;
          if (defaultHrDept) {
            setDepartment(current => (current ? current : defaultHrDept));
          }
        } else {
          setJobRoles([]);
          setDepartments([]);
        }
      } catch (e) {
        setJobRoles([]);
        setDepartments([]);
      } finally {
        setLoadingRef(false);
      }
    };
    loadReference();
  }, []);

  const normalizedDepartment = (department || '').trim().toLowerCase();
  const jobRolesForDepartment = normalizedDepartment === 'human resources'
    ? jobRoles.filter(item => (item?.Category || '').trim().toLowerCase() === 'human resources')
    : jobRoles;

  const filteredJobRoles = jobTitleSearch.trim()
    ? jobRolesForDepartment.filter(r => (r?.Value || '').toLowerCase().includes(jobTitleSearch.trim().toLowerCase()))
    : jobRolesForDepartment;

  const filteredDepartments = departmentSearch.trim()
    ? departments.filter(d => (d?.Value || '').toLowerCase().includes(departmentSearch.trim().toLowerCase()))
    : departments;

  const validateForm = () => {
    const newErrors = {};

    if (!jobTitle.trim()) {
      newErrors.jobTitle = 'Job title is required';
    }

    if (!department.trim()) {
      newErrors.department = 'Department is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onContinue = () => {
    if (!validateForm()) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    navigation.navigate('EmployerAccountScreen', {
      employerType,
      selectedCompany,
      fromGoogleAuth,
      skipEmailPassword,
      employerDetails: {
        jobTitle,
        department,
        linkedInProfile,
        bio,
      },
    });
  };

  return (
    <RegistrationWrapper currentStep={3} totalSteps={4} stepLabel="Your role" onBack={() => navigation.goBack()}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 24, maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 520 : '100%', width: '100%', alignSelf: 'center' }}>
        {/* Show Google user info if applicable */}
        {isGoogleUser && googleUser && (
          <View style={styles.googleUserInfo}>
            {googleUser.picture && (
              <Image 
                source={{ uri: googleUser.picture }} 
                style={styles.googleUserAvatar}
              />
            )}
            <View style={styles.googleUserTextContainer}>
              <Text style={styles.googleUserWelcome}>
                Setting up employer profile for
              </Text>
              <Text style={styles.googleUserName}>{googleUser.name}</Text>
              <Text style={styles.googleUserEmail}>{googleUser.email}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          </View>
        )}

        <Text style={styles.title}>
          {isGoogleUser ? 'Your Professional Details' : 'Your details'}
        </Text>
        <Text style={styles.subtitle}>
          {isGoogleUser 
            ? 'Tell us about your role at the company'
            : 'Tell us a little about your role'
          }
        </Text>

        <View style={styles.field}> 
          <Text style={styles.label}>
            Job Title <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.selectInput, errors.jobTitle && styles.inputError]}
            onPress={() => setShowJobTitleModal(true)}
            activeOpacity={0.8}
            disabled={loadingRef}
          >
            <Text style={[styles.selectInputText, !jobTitle && styles.selectInputPlaceholder]}>
              {loadingRef ? 'Loading job titles...' : (jobTitle || 'Select your job title')}
            </Text>
            {loadingRef ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-down" size={18} color={colors.gray500} />
            )}
          </TouchableOpacity>
          {errors.jobTitle && (
            <Text style={styles.errorText}>{errors.jobTitle}</Text>
          )}
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>
            Department <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.selectInput, errors.department && styles.inputError]}
            onPress={() => setShowDepartmentModal(true)}
            activeOpacity={0.8}
            disabled={loadingRef}
          >
            <Text style={[styles.selectInputText, !department && styles.selectInputPlaceholder]}>
              {loadingRef ? 'Loading departments...' : (department || 'Select your department')}
            </Text>
            {loadingRef ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-down" size={18} color={colors.gray500} />
            )}
          </TouchableOpacity>
          {errors.department && (
            <Text style={styles.errorText}>{errors.department}</Text>
          )}
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>LinkedIn Profile</Text>
          <TextInput 
            style={styles.input} 
            value={linkedInProfile} 
            onChangeText={setLinkedInProfile} 
            autoCapitalize="none"
            placeholder="https://linkedin.com/in/yourprofile"
            placeholderTextColor={colors.gray400}
            keyboardType="url"
          />
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>About You</Text>
          <TextInput 
            style={[styles.input, { height: 120, textAlignVertical: 'top' }]} 
            value={bio} 
            onChangeText={setBio} 
            multiline
            placeholder="Brief description of your role and hiring focus..."
            placeholderTextColor={colors.gray400}
          />
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={onContinue}>
          <Text style={styles.primaryBtnText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </TouchableOpacity>
      </ScrollView>

      {/* Job Title Picker */}
      <Modal
        visible={showJobTitleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowJobTitleModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowJobTitleModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Job Title</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalSearchRow}>
            <Ionicons name="search" size={18} color={colors.gray600} />
            <TextInput
              style={[styles.input, styles.modalSearchInput]}
              placeholder="Search job titles..."
              placeholderTextColor={colors.gray400}
              value={jobTitleSearch}
              onChangeText={setJobTitleSearch}
            />
          </View>

          <FlatList
            data={filteredJobRoles}
            keyExtractor={(item) => String(item.ReferenceID ?? item.Value)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const value = item?.Value || '';
              const selected = value === jobTitle;
              return (
                <TouchableOpacity
                  style={[styles.modalItem, selected && styles.modalItemSelected]}
                  onPress={() => {
                    setJobTitle(value);
                    setJobTitleSearch('');
                    setShowJobTitleModal(false);
                    if (errors.jobTitle) setErrors({ ...errors, jobTitle: null });
                  }}
                >
                  <Text style={[styles.modalItemText, selected && styles.modalItemTextSelected]}>{value}</Text>
                  {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name="briefcase" size={48} color={colors.gray400} />
                <Text style={styles.emptyText}>No job titles found</Text>
              </View>
            )}
          />
        </View>
      </Modal>

      {/* Department Picker */}
      <Modal
        visible={showDepartmentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDepartmentModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDepartmentModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Department</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalSearchRow}>
            <Ionicons name="search" size={18} color={colors.gray600} />
            <TextInput
              style={[styles.input, styles.modalSearchInput]}
              placeholder="Search departments..."
              placeholderTextColor={colors.gray400}
              value={departmentSearch}
              onChangeText={setDepartmentSearch}
            />
          </View>

          <FlatList
            data={filteredDepartments}
            keyExtractor={(item) => String(item.ReferenceID ?? item.Value)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const value = item?.Value || '';
              const selected = value === department;
              return (
                <TouchableOpacity
                  style={[styles.modalItem, selected && styles.modalItemSelected]}
                  onPress={() => {
                    setDepartment(value);
                    setDepartmentSearch('');
                    setShowDepartmentModal(false);
                    if (errors.department) setErrors({ ...errors, department: null });
                  }}
                >
                  <Text style={[styles.modalItemText, selected && styles.modalItemTextSelected]}>{value}</Text>
                  {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name="layers" size={48} color={colors.gray400} />
                <Text style={styles.emptyText}>No departments found</Text>
              </View>
            )}
          />
        </View>
      </Modal>
    </RegistrationWrapper>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  scroll: { flex: 1 },
  // Google user info styles
  googleUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.successGlowSubtle,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.successBorder,
  },
  googleUserAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  googleUserTextContainer: {
    flex: 1,
  },
  googleUserWelcome: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  googleUserName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  googleUserEmail: {
    fontSize: 13,
    color: colors.textMuted,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  field: { marginTop: 16 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  required: {
    color: colors.error,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 15,
  },
  selectInput: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectInputText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  selectInputPlaceholder: {
    color: colors.textMuted,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderThin,
    backgroundColor: colors.background,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalSearchRow: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: 12,
  },
  modalItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderFaint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalItemSelected: {
    backgroundColor: colors.primaryGlow,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  modalItemText: {
    fontSize: 15,
    color: colors.text,
  },
  modalItemTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  primaryBtn: {
    marginTop: 28,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
