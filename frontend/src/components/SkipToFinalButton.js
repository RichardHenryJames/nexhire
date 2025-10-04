import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';

export default function SkipToFinalButton({ 
  onSkip, 
  disabled = false, 
  userType = 'JobSeeker',
  selectedValue = null,
  requiredMessage = 'Please make a selection first'
}) {
  
  const handleSkip = () => {
    if (disabled || !selectedValue) {
      Alert.alert('Selection Required', requiredMessage);
      return;
    }

    const flowType = userType === 'JobSeeker' ? 'registration' : 'employer setup';
    
    Alert.alert(
      `Skip ${flowType} Steps?`,
      `You can complete your profile details now and add ${userType === 'JobSeeker' ? 'work/education' : 'organization'} information later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip to Profile',
          onPress: onSkip
        }
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.skipButton,
        (disabled || !selectedValue) && styles.skipButtonDisabled
      ]}
      onPress={handleSkip}
      disabled={disabled || !selectedValue}
    >
      <Ionicons 
        name="flash-outline" 
        size={20} 
        color={(disabled || !selectedValue) ? colors.gray400 : colors.primary} 
      />
      <Text style={[
        styles.skipButtonText,
        (disabled || !selectedValue) && styles.skipButtonTextDisabled
      ]}>
        Skip to Profile Completion
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  skipButtonDisabled: {
    borderColor: colors.gray300,
    backgroundColor: colors.gray100,
  },
  skipButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  skipButtonTextDisabled: {
    color: colors.gray400,
  },
});