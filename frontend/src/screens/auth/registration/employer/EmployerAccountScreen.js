import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../../styles/theme';
import nexhireAPI from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';

export default function EmployerAccountScreen({ navigation, route }) {
  const { employerType = 'startup', selectedCompany, employerDetails } = route.params || {};
  const { user } = useAuth();

  const [firstName, setFirstName] = useState(user?.FirstName || '');
  const [lastName, setLastName] = useState(user?.LastName || '');
  const [email, setEmail] = useState(user?.Email || '');
  const [phone, setPhone] = useState(user?.Phone || '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    if (!firstName.trim() || !lastName.trim()) return 'Name is required';
    if (!email.trim()) return 'Email is required';
    if (!nexhireAPI.token) {
      if (!password || password.length < 6) return 'Password must be at least 6 characters';
      if (password !== confirmPassword) return 'Passwords do not match';
    }
    return null;
  };

  const onSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Validation', err);
      return;
    }

    try {
      setSubmitting(true);

      const organizationPayload = {
        organizationName: selectedCompany?.name || employerDetails?.organizationName || 'My Organization',
        organizationIndustry: selectedCompany?.industry || 'Technology',
        organizationSize: selectedCompany?.size || 'Small',
        organizationWebsite: selectedCompany?.website || '',
        organizationType: employerType === 'freelancer' ? 'Individual' : 'Company',
        jobTitle: employerDetails?.jobTitle || 'Hiring Manager',
        department: employerDetails?.department || 'Human Resources',
        linkedInProfile: employerDetails?.linkedInProfile || '',
        bio: employerDetails?.bio || '',
      };

      // If not authenticated yet: create the user and employer in one go
      if (!nexhireAPI.token) {
        const payload = {
          email: email.trim().toLowerCase(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          userType: 'Employer',
          ...(phone && { phone: phone.trim() }),
          ...(dateOfBirth && { dateOfBirth }),
          ...organizationPayload,
        };

        const reg = await nexhireAPI.register(payload);
        if (!reg?.success) throw new Error(reg?.error || 'Registration failed');

        // Auto-login
        const login = await nexhireAPI.login(email.trim().toLowerCase(), password);
        if (!login?.success) throw new Error(login?.error || 'Login failed');

        Alert.alert('Welcome', 'Your employer account is ready.', [
          { text: 'Continue', onPress: () => navigation.replace('Main') }
        ]);
        return;
      }

      // If already authenticated, best-effort: initialize employer profile if backend supports it, fallback to profile update
      try {
        const res = await nexhireAPI.initializeEmployerProfile(organizationPayload);
        if (!res?.success) throw new Error(res?.error || 'Init failed');
      } catch (_) {
        // Fallback: at least update basic profile
        await nexhireAPI.updateProfile({ firstName, lastName, phone });
      }

      Alert.alert('All set!', 'Employer onboarding steps completed.', [
        { text: 'Continue', onPress: () => navigation.replace('Main') }
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to complete setup');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 20 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingVertical: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>

        <Text style={styles.title}>Create your employer account</Text>
        <Text style={styles.subtitle}>We’ll set up your user and organization</Text>

        <View style={styles.row}>
          <View style={[styles.field,{flex:1,marginRight:6}]}> 
            <Text style={styles.label}>First Name</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />
          </View>
          <View style={[styles.field,{flex:1,marginLeft:6}]}> 
            <Text style={styles.label}>Last Name</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />
          </View>
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} />
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" />
        </View>

        {!nexhireAPI.token && (
          <>
            <View style={styles.field}> 
              <Text style={styles.label}>Password</Text>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
            </View>
            <View style={styles.field}> 
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
            </View>
          </>
        )}

        <TouchableOpacity style={[styles.primaryBtn, submitting && {opacity:.7}]} disabled={submitting} onPress={onSubmit}>
          <Text style={styles.primaryBtnText}>{submitting ? 'Submitting...' : 'Finish Setup'}</Text>
          <Ionicons name="checkmark" size={18} color={colors.white} />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  row: { flexDirection: 'row' },
  title: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.text, marginTop: 8 },
  subtitle: { color: colors.gray600, marginTop: 6, marginBottom: 16 },
  field: { marginTop: 12 },
  label: { color: colors.gray600, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.text },
  primaryBtn: { marginTop: 24, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  primaryBtnText: { color: colors.white, fontWeight: typography.weights.bold },
});
