import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';

export default function GoogleUserInfoBanner({ 
  googleUser, 
  showSkipButton = false, 
  onSkip = null,
  size = 'small' // 'small', 'medium', 'large'
}) {
  if (!googleUser) return null;

  const styles = getStyles(size);

  return (
    <View style={styles.container}>
      {googleUser.picture && (
        <Image 
          source={{ uri: googleUser.picture }} 
          style={styles.avatar}
        />
      )}
      <View style={styles.textContainer}>
        <Text style={styles.welcome}>
           ✅ Google Account Connected
        </Text>
        <Text style={styles.name}>{googleUser.name}</Text>
        <Text style={styles.email}>{googleUser.email}</Text>
        {size === 'large' && (
          <Text style={styles.note}>
            Your basic info has been captured from Google
          </Text>
        )}
      </View>
      <Ionicons 
        name="checkmark-circle" 
        size={size === 'large' ? 24 : 20} 
        color={colors.success} 
      />
    </View>
  );
}

const getStyles = (size) => {
  const isLarge = size === 'large';
  const isMedium = size === 'medium';
  
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: isLarge ? 24 : 16,
      padding: isLarge ? 20 : 16,
      backgroundColor: colors.success + '10',
      borderRadius: isLarge ? 16 : 12,
      borderWidth: isLarge ? 2 : 1,
      borderColor: colors.success,
      ...(isLarge && {
        shadowColor: colors.success,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }),
    },
    avatar: {
      width: isLarge ? 56 : isMedium ? 48 : 40,
      height: isLarge ? 56 : isMedium ? 48 : 40,
      borderRadius: isLarge ? 28 : isMedium ? 24 : 20,
      marginRight: isLarge ? 16 : 12,
      ...(isLarge && {
        borderWidth: 2,
        borderColor: colors.success,
      }),
    },
    textContainer: {
      flex: 1,
    },
    welcome: {
      fontSize: isLarge ? typography.sizes.sm : typography.sizes.xs,
      fontWeight: typography.weights.bold,
      color: colors.success,
      marginBottom: isLarge ? 4 : 2,
    },
    name: {
      fontSize: isLarge ? typography.sizes.lg : isMedium ? typography.sizes.md : typography.sizes.sm,
      fontWeight: typography.weights.bold,
      color: colors.text,
      marginBottom: isLarge ? 2 : 1,
    },
    email: {
      fontSize: isLarge ? typography.sizes.sm : typography.sizes.xs,
      color: colors.gray600,
      marginBottom: isLarge ? 4 : 0,
    },
    note: {
      fontSize: typography.sizes.xs,
      color: colors.gray500,
      fontStyle: 'italic',
    },
  });
};