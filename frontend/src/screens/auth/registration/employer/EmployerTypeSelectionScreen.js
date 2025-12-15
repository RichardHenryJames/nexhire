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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../../styles/theme';
import refopenAPI from '../../../../services/api';

// Debounce (EXACT same implementation as job seeker WorkExperienceScreen)
const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
};

export default function EmployerTypeSelectionScreen({ navigation, route }) {
  const { userType = 'Employer', fromGoogleAuth, googleUser } = route?.params || {};

  // Employer type selection
  const [selectedType, setSelectedType] = useState(null); // 'company' | 'startup' | 'freelancer'

  // Selected org results stored separately for established vs startup/new
  const [selectedCompany, setSelectedCompany] = useState(null); // Established company
  const [startupCompany, setStartupCompany] = useState(null);   // Startup / new company (optional)

  // Unified ORG PICKER (EXACT pattern from job seeker WorkExperienceScreen)
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgPickerContext, setOrgPickerContext] = useState(null); // 'established' | 'startup'
  const [orgQuery, setOrgQuery] = useState('');
  const debouncedOrgQuery = useDebounce(orgQuery, 300);
  const [orgResults, setOrgResults] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [manualOrgMode, setManualOrgMode] = useState(false);

  // Helper: filter (exactly same logic)
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

  // Debounced fetch (copy pattern)
  useEffect(() => {
    const search = async () => {
      if (!showOrgModal || manualOrgMode) return; // skip when manual entry mode or closed
      try {
        setOrgLoading(true);
        const res = await refopenAPI.getOrganizations(debouncedOrgQuery || '', null); // No limit
        const raw = (res && res.success && Array.isArray(res.data)) ? res.data : [];
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

  const openOrgModal = (context) => {
    setOrgPickerContext(context); // 'established' or 'startup'
    setShowOrgModal(true);
    setManualOrgMode(false);
    if (orgResults.length === 0) setOrgQuery('');
  };
  const closeOrgModal = () => setShowOrgModal(false);

  const handleSelectOrganization = (org) => {
    // EXACT same selection style; adapt to context
    if (orgPickerContext === 'established') {
      setSelectedCompany({
        id: org.id,
        name: org.name,
        industry: org.industry || 'Unknown',
        logoURL: org.logoURL || null,
      });
    } else if (orgPickerContext === 'startup') {
      setStartupCompany({
        id: org.id,
        name: org.name,
        industry: org.industry || 'Unknown',
        logoURL: org.logoURL || null,
      });
    }
    closeOrgModal();
  };

  const submitManualOrganization = () => {
    const name = (orgQuery || '').trim();
    if (!name) { Alert.alert('Enter company name', 'Type your company name above'); return; }
    if (orgPickerContext === 'established') {
      setSelectedCompany({ id: null, name, logoURL: null });
    } else if (orgPickerContext === 'startup') {
      setStartupCompany({ id: null, name, logoURL: null });
    }
    closeOrgModal();
  };

  const handleContinue = () => {
    if (!selectedType) {
      Alert.alert('Selection Required', 'Please select your organization type');
      return;
    }
    if (selectedType === 'company' && !selectedCompany) {
      Alert.alert('Selection Required', 'Please select or enter your company');
      return;
    }

    const routeParams = {
      userType,
      employerType: selectedType,
      ...(selectedType === 'company' && selectedCompany && { selectedCompany }),
      ...(selectedType === 'startup' && startupCompany && { selectedCompany: startupCompany })
    };

    if (selectedType === 'company') {
      navigation.navigate('EmployerPersonalDetailsScreen', routeParams);
    } else if (selectedType === 'startup') {
      // Startup/new company always routes to organization details to allow extra info
      navigation.navigate('OrganizationDetailsScreen', routeParams);
    } else if (selectedType === 'freelancer') {
      navigation.navigate('EmployerPersonalDetailsScreen', routeParams);
    }
  };

  const handleSwitchToJobSeeker = () => {
    const parentNav = navigation.getParent?.();
    const target = {
      screen: 'ExperienceTypeSelection',
      params: {
        userType: 'JobSeeker',
        fromGoogleAuth,
        googleUser,
      },
    };

    if (parentNav?.replace) {
      parentNav.replace('JobSeekerFlow', target);
      return;
    }

    navigation.navigate('JobSeekerFlow', target);
  };

  const EmployerTypeCard = ({ type, title, subtitle, icon, description, showOrgButton = false, orgContext }) => (
    <TouchableOpacity
      style={[styles.card, selectedType === type && styles.cardSelected]}
      onPress={() => setSelectedType(type)}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={40} color={selectedType === type ? colors.primary : colors.gray500} />
        <View style={styles.cardTitleContainer}>
          <Text style={[styles.cardTitle, selectedType === type && styles.cardTitleSelected]}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        {selectedType === type && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
      </View>
      <Text style={styles.cardDescription}>{description}</Text>

      {showOrgButton && selectedType === type && (
        <TouchableOpacity
          style={styles.companySelector}
            onPress={() => openOrgModal(orgContext)}
        >
          <View style={styles.companySelectorLeft}>
            {orgContext === 'established' ? (
              selectedCompany?.name ? (
                selectedCompany?.logoURL ? (
                  <Image source={{ uri: selectedCompany.logoURL }} style={styles.selectedCompanyLogo} resizeMode="contain" />
                ) : (
                  <View style={styles.selectedCompanyLogoPlaceholder}>
                    <Ionicons name="business" size={14} color={colors.gray400} />
                  </View>
                )
              ) : null
            ) : (
              startupCompany?.name ? (
                startupCompany?.logoURL ? (
                  <Image source={{ uri: startupCompany.logoURL }} style={styles.selectedCompanyLogo} resizeMode="contain" />
                ) : (
                  <View style={styles.selectedCompanyLogoPlaceholder}>
                    <Ionicons name="business" size={14} color={colors.gray400} />
                  </View>
                )
              ) : null
            )}

            <Text style={styles.companySelectorLabel}>
              {orgContext === 'established'
                ? (selectedCompany ? selectedCompany.name : 'Select or search company')
                : (startupCompany ? startupCompany.name : 'Select or search company (optional)')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.title}>What type of organization are you with?</Text>
            <Text style={styles.subtitle}>This helps us set up your hiring profile correctly</Text>
          </View>

          <View style={styles.cardsContainer}>
            <EmployerTypeCard
              type="company"
              title="Established Company"
              subtitle="I work for an existing company"
              icon="business"
              description="Part of a registered company that's already established"
              showOrgButton={true}
              orgContext="established"
            />
            <EmployerTypeCard
              type="startup"
              title="Startup / New Company"
              subtitle="I'm with a startup or founding a company"
              icon="rocket"
              description="Building something new or working with a startup"
              showOrgButton={true}
              orgContext="startup"
            />
            <EmployerTypeCard
              type="freelancer"
              title="Freelancer / Consultant"
              subtitle="I work independently"
              icon="person"
              description="Independent professional hiring for projects or clients"
              showOrgButton={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.continueButton, (!selectedType || (selectedType === 'company' && !selectedCompany)) && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!selectedType || (selectedType === 'company' && !selectedCompany)}
          >
            <Text style={[styles.continueButtonText, (!selectedType || (selectedType === 'company' && !selectedCompany)) && styles.continueButtonTextDisabled]}>Continue</Text>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={(!selectedType || (selectedType === 'company' && !selectedCompany)) ? colors.gray400 : colors.white}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchFlowButton}
            onPress={handleSwitchToJobSeeker}
            activeOpacity={0.8}
          >
            <Ionicons name="search-outline" size={18} color={colors.primary} />
            <Text style={styles.switchFlowButtonText}>I'm looking for jobs</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* UNIFIED ORG PICKER MODAL (EXACT pattern from job seeker) */}
      <Modal
        visible={showOrgModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeOrgModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeOrgModal}>
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
              value={orgQuery}
              onChangeText={setOrgQuery}
              autoCapitalize="words"
            />
            {manualOrgMode ? (
              <TouchableOpacity onPress={submitManualOrganization}>
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              </TouchableOpacity>
            ) : (orgLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : null)}
          </View>

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
                    {item.website ? (
                      <Text style={[styles.modalItemText, { color: colors.gray600, fontSize: typography.sizes.sm }]}>
                        {item.website}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.gray500} />
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews
              windowSize={8}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Ionicons name="business" size={48} color={colors.gray400} />
                  <Text style={styles.emptyText}>
                    {orgLoading ? 'Searching...' : (orgQuery ? 'No companies found' : 'Start typing to search')}
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContainer: { flex: 1 },
  content: { padding: 20, paddingTop: 20 },
  header: { marginBottom: 32 },
  backButton: { alignSelf: 'flex-start', padding: 8, marginBottom: 16 },
  title: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: typography.sizes.md, color: colors.gray600, lineHeight: 22 },
  cardsContainer: { gap: 16, marginBottom: 32 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, borderWidth: 2, borderColor: colors.border },
  cardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitleContainer: { flex: 1, marginLeft: 16 },
  cardTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text, marginBottom: 2 },
  cardTitleSelected: { color: colors.primary },
  cardSubtitle: { fontSize: typography.sizes.sm, color: colors.gray500, fontWeight: typography.weights.medium },
  cardDescription: { fontSize: typography.sizes.md, color: colors.gray600, lineHeight: 20, marginBottom: 8 },
  companySelector: { backgroundColor: colors.background, borderRadius: 8, padding: 12, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.primary },
  companySelectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 10 },
  selectedCompanyLogo: { width: 22, height: 22, borderRadius: 6 },
  selectedCompanyLogoPlaceholder: { width: 22, height: 22, borderRadius: 6, backgroundColor: colors.gray200, justifyContent: 'center', alignItems: 'center' },
  companySelectorLabel: { fontSize: typography.sizes.sm, color: colors.primary, fontWeight: typography.weights.medium, flexShrink: 1 },
  continueButton: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 8 },
  continueButtonDisabled: { backgroundColor: colors.gray300 },
  continueButtonText: { color: colors.white, fontSize: typography.sizes.md, fontWeight: typography.weights.bold },
  continueButtonTextDisabled: { color: colors.gray400 },
  switchFlowButton: {
    marginTop: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  switchFlowButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text },
  textInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 16, fontSize: typography.sizes.md, color: colors.text },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalItemText: { fontSize: typography.sizes.md, color: colors.text },
  companyLogo: { width: 40, height: 40, borderRadius: 8, marginRight: 12 },
  companyLogoPlaceholder: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.gray200, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  companyInfo: { flex: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 40 },
  emptyText: { fontSize: typography.sizes.md, color: colors.gray600, textAlign: 'center', marginTop: 16 },
});