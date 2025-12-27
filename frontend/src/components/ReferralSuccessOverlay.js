import React, { useEffect, useMemo } from 'react';
import {
  View,
  Image,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * 🎉 Referral Success Overlay
 * Shows a fullscreen overlay with the askrefsent.png image for 3 seconds
 * as a visual confirmation that the referral request was sent successfully.
 */
export default function ReferralSuccessOverlay({
  visible,
  onComplete,
  duration = 2000, // 2 seconds default
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, onComplete]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <Image
          source={require('../../assets/refsent.jpg')}
          style={styles.image}
          resizeMode="contain"
        />
      </View>
    </Modal>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.background || '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    image: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
    },
  });
