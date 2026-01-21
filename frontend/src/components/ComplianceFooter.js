import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';

export default function ComplianceFooter({ currentPage }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const links = [
    { id: 'terms', label: 'Terms & Conditions', screen: 'Terms' },
    { id: 'privacy', label: 'Privacy Policy', screen: 'PrivacyPolicy' },
    { id: 'disclaimer', label: 'Disclaimer', screen: 'Disclaimer' },
    { id: 'about', label: 'About Us', screen: 'AboutUs' },
    { id: 'faq', label: 'FAQ', screen: 'FAQ' },
    { id: 'blog', label: 'Career Blog', screen: 'Blog' },
    { id: 'support', label: 'Help & Support', screen: 'Support' },
  ];

  const handleLinkPress = (screen) => {
    navigation.navigate(screen);
  };

  const handleEmailPress = () => {
    navigation.navigate('Support');
  };

  const handleWebsitePress = () => {
    Linking.openURL('https://www.refopen.com');
  };

  return (
    <View style={styles.footer}>
      <View style={styles.divider} />
      
      <View style={styles.footerContent}>
        <View style={styles.headerRow}>
          <Text style={styles.footerTitle}>Refopen</Text>
          <Text style={styles.footerTagline}>Your next career opportunity awaits</Text>
        </View>

        <View style={styles.linksGrid}>
          {links.map((link) => (
            <TouchableOpacity
              key={link.id}
              onPress={() => handleLinkPress(link.screen)}
              style={styles.linkItem}
              disabled={currentPage === link.id}
            >
              <Text style={[styles.linkText, currentPage === link.id && styles.linkTextActive]}>
                {link.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.contactRow}>
          <TouchableOpacity onPress={handleEmailPress}>
            <Text style={styles.contactLink}>Contact Support</Text>
          </TouchableOpacity>
          <Text style={styles.separator}>•</Text>
          <TouchableOpacity onPress={handleWebsitePress}>
            <Text style={styles.contactLink}>www.refopen.com</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.companyLine}>Refopen Solutions • Bangalore, India</Text>

        <Text style={styles.copyrightText}>
          © {new Date().getFullYear()} Refopen Solutions. All rights reserved.
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  footer: {
    marginTop: 16,
    paddingTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  footerContent: {
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  footerTagline: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  linkItem: {
    width: '50%',
    paddingVertical: 3,
  },
  linkText: {
    fontSize: 13,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  linkTextActive: {
    color: colors.textSecondary,
    fontWeight: '600',
    textDecorationLine: 'none',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  contactLink: {
    fontSize: 12,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  separator: {
    fontSize: 12,
    color: colors.textSecondary,
    marginHorizontal: 8,
  },
  companyLine: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  copyrightText: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
