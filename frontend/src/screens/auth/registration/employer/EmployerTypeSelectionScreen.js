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

export default function EmployerTypeSelectionScreen({ navigation, route }) {
  const [selectedType, setSelectedType] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Safe default for nested navigation
  const { userType = 'Employer' } = route?.params || {};

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await nexhireAPI.getOrganizations();
      
      if (response.success) {
        // Transform API response to match expected format
        const transformedCompanies = response.data.map(org => ({
          id: org.id,
          name: org.name,
          industry: org.industry || 'Unknown',
          size: org.size || 'Unknown',
          type: org.type,
          logoURL: org.logoURL,
          website: org.website
        }));
        
        setCompanies(transformedCompanies);
      } else {
        throw new Error(response.error || 'Failed to load organizations');
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
      setError(error.message);
      
      // Fallback to basic list if API fails
      setCompanies([
        { id: 999999, name: 'My company is not listed', industry: 'Other', size: 'Unknown' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.industry.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleContinue = () => {
    if (!selectedType) {
      Alert.alert('Selection Required', 'Please select your employment type');
      return;
    }

    if (selectedType === 'company' && !selectedCompany) {
      Alert.alert('Selection Required', 'Please select your company');
      return;
    }

    const routeParams = {
      userType,
      employerType: selectedType,
      ...(selectedCompany && { selectedCompany })
    };

    if (selectedType === 'startup' || selectedCompany?.id === 999999) {
      navigation.navigate('OrganizationDetailsScreen', routeParams);
    } else {
      navigation.navigate('EmployerPersonalDetailsScreen', routeParams);
    }
  };

  const CompanyModal = () => (
    <Modal
      visible={showCompanyModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowCompanyModal(false)}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Select Your Company</Text>
          <TouchableOpacity onPress={loadOrganizations} disabled={loading}>
            <Ionicons 
              name="refresh" 
              size={24} 
              color={loading ? colors.gray400 : colors.primary} 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.gray500} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search companies..."
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading organizations...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={24} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadOrganizations}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && (
          <FlatList
            data={filteredCompanies}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.companyItem}
                onPress={() => {
                  setSelectedCompany(item);
                  setShowCompanyModal(false);
                  setSearchTerm('');
                }}
              >
                <View style={styles.companyInfo}>
                  <Text style={styles.companyName}>{item.name}</Text>
                  <View style={styles.companyMeta}>
                    <Text style={styles.companyMetaText}>{item.industry}</Text>
                    <Text style={styles.companyMetaText}>•</Text>
                    <Text style={styles.companyMetaText}>{item.size} employees</Text>
                  </View>
                </View>
                {item.id === 999999 && (
                  <Ionicons name="add-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name="business" size={48} color={colors.gray400} />
                <Text style={styles.emptyText}>
                  {searchTerm ? 'No companies found' : 'No organizations available'}
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

  const EmployerTypeCard = ({ type, title, subtitle, icon, description, showCompanySelection = false }) => (
    <TouchableOpacity
      style={[
        styles.card,
        selectedType === type && styles.cardSelected
      ]}
      onPress={() => setSelectedType(type)}
    >
      <View style={styles.cardHeader}>
        <Ionicons 
          name={icon} 
          size={40} 
          color={selectedType === type ? colors.primary : colors.gray500} 
        />
        <View style={styles.cardTitleContainer}>
          <Text style={[
            styles.cardTitle,
            selectedType === type && styles.cardTitleSelected
          ]}>
            {title}
          </Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        {selectedType === type && (
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
        )}
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
      
      {showCompanySelection && selectedType === type && (
        <TouchableOpacity 
          style={styles.companySelector}
          onPress={() => setShowCompanyModal(true)}
        >
          <Text style={styles.companySelectorLabel}>
            {selectedCompany ? selectedCompany.name : 'Select your company'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
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
            
            <Text style={styles.title}>What type of organization are you with?</Text>
            <Text style={styles.subtitle}>
              This helps us set up your hiring profile correctly
            </Text>
          </View>

          <View style={styles.cardsContainer}>
            <EmployerTypeCard
              type="company"
              title="Established Company"
              subtitle="I work for an existing company"
              icon="business"
              description="Part of a registered company that's already established"
              showCompanySelection={true}
            />

            <EmployerTypeCard
              type="startup"
              title="Startup / New Company"
              subtitle="I'm with a startup or founding a company"
              icon="rocket"
              description="Building something new or working with a startup"
            />

            <EmployerTypeCard
              type="freelancer"
              title="Freelancer / Consultant"
              subtitle="I work independently"
              icon="person"
              description="Independent professional hiring for projects or clients"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.continueButton,
              !selectedType && styles.continueButtonDisabled,
              (selectedType === 'company' && !selectedCompany) && styles.continueButtonDisabled
            ]}
            onPress={handleContinue}
            disabled={!selectedType || (selectedType === 'company' && !selectedCompany)}
          >
            <Text style={[
              styles.continueButtonText,
              (!selectedType || (selectedType === 'company' && !selectedCompany)) && styles.continueButtonTextDisabled
            ]}>
              Continue
            </Text>
            <Ionicons 
              name="arrow-forward" 
              size={20} 
              color={(!selectedType || (selectedType === 'company' && !selectedCompany)) ? colors.gray400 : colors.white} 
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CompanyModal />
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
  cardsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleContainer: {
    flex: 1,
    marginLeft: 16,
  },
  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  cardTitleSelected: {
    color: colors.primary,
  },
  cardSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    fontWeight: typography.weights.medium,
  },
  cardDescription: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    lineHeight: 20,
    marginBottom: 8,
  },
  companySelector: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  companySelectorLabel: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  continueButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 24, // ADDED: Equal spacing above button
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
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
  companyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: 4,
  },
  companyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  companyMetaText: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
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