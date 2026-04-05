import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { typography } from '../styles/theme';
import { useTheme } from '../contexts/ThemeContext';

const LinkedInSignInButton = ({ onPress, loading = false, disabled = false, style = {}, size = 'large' }) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
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
          <ActivityIndicator size="small" color="#fff" style={styles.icon} />
        ) : (
          <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" style={styles.icon}>
            <Path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#ffffff" />
          </Svg>
        )}
        <Text style={[textStyle, disabled && styles.buttonTextDisabled]}>
          {loading ? 'Signing in...' : 'Continue with LinkedIn'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors) => StyleSheet.create({
  button: {
    backgroundColor: '#0A66C2',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonSmall: {
    backgroundColor: '#0A66C2',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonPressed: {
    backgroundColor: '#004182',
  },
  buttonDisabled: {
    backgroundColor: '#0A66C280',
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
    color: '#ffffff',
    fontSize: typography?.sizes?.base || 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonTextSmall: {
    color: '#ffffff',
    fontSize: typography?.sizes?.sm || 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonTextDisabled: {
    opacity: 0.7,
  },
});

export default LinkedInSignInButton;
