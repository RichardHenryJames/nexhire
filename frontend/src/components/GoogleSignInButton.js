import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';

const GoogleSignInButton = ({ onPress, loading = false, disabled = false, style = {}, size = 'large' }) => {
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = () => {
    if (!loading && !disabled && onPress) {
      onPress();
    }
  };

  const buttonStyle = size === 'large' ? styles.button : styles.buttonSmall;
  const textStyle = size === 'large' ? styles.buttonText : styles.buttonTextSmall;
  const iconSize = size === 'large' ? 20 : 18;

  return (
    <TouchableOpacity
      style={[
        buttonStyle,
        disabled && styles.buttonDisabled,
        isPressed && styles.buttonPressed,
        style,
      ]}
      onPress={handlePress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      disabled={loading || disabled}
      activeOpacity={0.8}
    >
      <View style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator size="small" color="#757575" style={styles.icon} />
        ) : (
          <Ionicons 
            name="logo-google" 
            size={iconSize} 
            color="#4285F4" 
            style={styles.icon}
          />
        )}
        
        <Text style={[textStyle, disabled && styles.buttonTextDisabled]}>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonSmall: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonPressed: {
    backgroundColor: '#f8f9fa',
    borderColor: '#c4c7c5',
  },
  buttonDisabled: {
    backgroundColor: '#f1f3f4',
    borderColor: '#e8eaed',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 12,
  },
  buttonText: {
    color: '#3c4043',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    fontFamily: 'Roboto, sans-serif', // Google's font
  },
  buttonTextSmall: {
    color: '#3c4043',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    fontFamily: 'Roboto, sans-serif',
  },
  buttonTextDisabled: {
    color: '#9aa0a6',
  },
});

export default GoogleSignInButton;