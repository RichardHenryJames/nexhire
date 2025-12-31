import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../../../styles/theme';
import { authDarkColors } from '../../../../styles/authDarkColors';
import useResponsive from '../../../../hooks/useResponsive';

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
      Alert.alert('Organization Name Required', 'Please enter your organization name');
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.innerContainer}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 20 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingVertical: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>

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
  scroll: { flex: 1 },
  title: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.text, marginTop: 8 },
  subtitle: { color: colors.gray600, marginTop: 6, marginBottom: 16 },
  field: { marginTop: 12 },
  label: { color: colors.gray600, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.text },
  primaryBtn: { marginTop: 24, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  primaryBtnText: { color: colors.white, fontWeight: typography.weights.bold },
});
