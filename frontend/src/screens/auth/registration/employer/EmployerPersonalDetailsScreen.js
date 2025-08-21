import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../../styles/theme';

export default function EmployerPersonalDetailsScreen({ navigation, route }) {
  const { employerType = 'startup', selectedCompany } = route.params || {};

  const [jobTitle, setJobTitle] = useState('Hiring Manager');
  const [department, setDepartment] = useState('Human Resources');
  const [linkedInProfile, setLinkedInProfile] = useState('');
  const [bio, setBio] = useState('');

  const onContinue = () => {
    navigation.navigate('EmployerAccountScreen', {
      employerType,
      selectedCompany,
      employerDetails: {
        jobTitle,
        department,
        linkedInProfile,
        bio,
      },
    });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 20 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingVertical: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>

        <Text style={styles.title}>Your details</Text>
        <Text style={styles.subtitle}>Tell us a little about your role</Text>

        <View style={styles.field}> 
          <Text style={styles.label}>Job Title</Text>
          <TextInput style={styles.input} value={jobTitle} onChangeText={setJobTitle} />
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>Department</Text>
          <TextInput style={styles.input} value={department} onChangeText={setDepartment} />
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>LinkedIn</Text>
          <TextInput style={styles.input} value={linkedInProfile} onChangeText={setLinkedInProfile} autoCapitalize="none" />
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>About You</Text>
          <TextInput style={[styles.input,{height:120,textAlignVertical:'top'}]} value={bio} onChangeText={setBio} multiline />
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={onContinue}>
          <Text style={styles.primaryBtnText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  title: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.text, marginTop: 8 },
  subtitle: { color: colors.gray600, marginTop: 6, marginBottom: 16 },
  field: { marginTop: 12 },
  label: { color: colors.gray600, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, color: colors.text },
  primaryBtn: { marginTop: 24, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  primaryBtnText: { color: colors.white, fontWeight: typography.weights.bold },
});
