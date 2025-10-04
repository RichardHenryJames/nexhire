import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Alert, 
  Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../contexts/AuthContext';
import { colors, typography } from '../../../../styles/theme';

export default function EmployerPersonalDetailsScreen({ navigation, route }) {
  const { pendingGoogleAuth } = useAuth();
  const { employerType = 'startup', selectedCompany, fromGoogleAuth, skipEmailPassword } = route.params || {};

  // Check if this is a Google user
  const isGoogleUser = fromGoogleAuth || pendingGoogleAuth;
  const googleUser = pendingGoogleAuth?.user;

  const [jobTitle, setJobTitle] = useState('Hiring Manager');
  const [department, setDepartment] = useState('Human Resources');
  const [linkedInProfile, setLinkedInProfile] = useState('');
  const [bio, setBio] = useState('');

  // Pre-populate some data for Google users
  useEffect(() => {
    if (isGoogleUser && googleUser) {
      console.log('Setting up employer details for Google user:', googleUser.name);
      
      // You could potentially derive job title from LinkedIn data if available
      // For now, we'll keep the defaults but could enhance this
    }
  }, [isGoogleUser, googleUser]);

  const onContinue = () => {
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 20 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingVertical: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>

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
          <Text style={styles.label}>Job Title</Text>
          <TextInput 
            style={styles.input} 
            value={jobTitle} 
            onChangeText={setJobTitle}
            placeholder="e.g., CEO, HR Manager, Talent Acquisition Specialist"
          />
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>Department</Text>
          <TextInput 
            style={styles.input} 
            value={department} 
            onChangeText={setDepartment}
            placeholder="e.g., Human Resources, Engineering, Marketing"
          />
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>LinkedIn Profile (Optional)</Text>
          <TextInput 
            style={styles.input} 
            value={linkedInProfile} 
            onChangeText={setLinkedInProfile} 
            autoCapitalize="none"
            placeholder="https://linkedin.com/in/yourprofile"
            keyboardType="url"
          />
        </View>

        <View style={styles.field}> 
          <Text style={styles.label}>About You (Optional)</Text>
          <TextInput 
            style={[styles.input, { height: 120, textAlignVertical: 'top' }]} 
            value={bio} 
            onChangeText={setBio} 
            multiline
            placeholder="Brief description of your role and hiring focus..."
          />
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
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  scroll: { 
    flex: 1 
  },
  // Google user info styles
  googleUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.success,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
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
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 2,
  },
  googleUserName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 2,
  },
  googleUserEmail: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
  },
  title: { 
    fontSize: typography.sizes.xl, 
    fontWeight: typography.weights.bold, 
    color: colors.text, 
    marginTop: 8 
  },
  subtitle: { 
    color: colors.gray600, 
    marginTop: 6, 
    marginBottom: 16 
  },
  field: { 
    marginTop: 12 
  },
  label: { 
    color: colors.gray600, 
    marginBottom: 6,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  input: { 
    backgroundColor: colors.surface, 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 8, 
    padding: 12, 
    color: colors.text,
    fontSize: typography.sizes.md,
  },
  primaryBtn: { 
    marginTop: 24, 
    backgroundColor: colors.primary, 
    borderRadius: 10, 
    paddingVertical: 14, 
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 8 
  },
  primaryBtnText: { 
    color: colors.white, 
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.md,
  },
});
