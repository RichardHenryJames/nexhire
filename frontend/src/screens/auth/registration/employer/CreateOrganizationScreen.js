import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../../../styles/theme';
import { authDarkColors } from '../../../../styles/authDarkColors';
import useResponsive from '../../../../hooks/useResponsive';
import { showToast } from '../../../../components/Toast';
import RegistrationWrapper from '../../../../components/auth/RegistrationWrapper';

export default function CreateOrganizationScreen({ navigation, route }) {
  const colors = authDarkColors; // Always use dark colors for auth screens
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const { employerType = 'startup', selectedCompany = null } = route.params || {};

  const [organizationName, setOrganizationName] = useState(selectedCompany?.name || '');
  const [industry, setIndustry] = useState('Technology');
  const [size, setSize] = useState('1-10');
  const [website, setWebsite] = useState('');

  const onContinue = () => {
    if (!organizationName.trim()) {
      showToast('Please enter your organization name', 'error');
      return;
    }
    navigation.navigate('EmployerPersonalDetailsScreen', {
      employerType,
      selectedCompany: selectedCompany || {
        id: 'new',
        name: organizationName.trim(),
        industry,
        size,
        website: website.trim() || null,
      },
    });
  };

  return (
    <RegistrationWrapper currentStep={2} totalSteps={4} stepLabel="Organization details" onBack={() => navigation.goBack()}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 24 }}>
        <Text style={styles.title}>Tell us about your organization</Text>
        <Text style={styles.subtitle}>We will use this to set up your hiring workspace</Text>

        <View style={styles.field}> 
          <Text style={styles.label}>Organization Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Acme Innovations"
            placeholderTextColor={colors.gray400}
            value={organizationName}
            onChangeText={setOrganizationName}
          />
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>Industry</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Technology"
            placeholderTextColor={colors.gray400}
            value={industry}
            onChangeText={setIndustry}
          />
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>Company Size</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 1-10"
            placeholderTextColor={colors.gray400}
            value={size}
            onChangeText={setSize}
          />
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>Website</Text>
          <TextInput
            style={styles.input}
            placeholder="https://example.com"
            placeholderTextColor={colors.gray400}
            value={website}
            autoCapitalize="none"
            onChangeText={setWebsite}
          />
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={onContinue}>
          <Text style={styles.primaryBtnText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </TouchableOpacity>
      </ScrollView>
    </RegistrationWrapper>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  scroll: { flex: 1 },
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
  input: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 15,
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
