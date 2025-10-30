import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../styles/theme';

export default function ComplianceFooter({ currentPage }) {
  const navigation = useNavigation();

  const links = [
    { id: 'terms', label: 'Terms & Conditions', screen: 'Terms' },
    { id: 'privacy', label: 'Privacy Policy', screen: 'PrivacyPolicy' },
    { id: 'refund', label: 'Refund Policy', screen: 'RefundPolicy' },
    { id: 'shipping', label: 'Shipping & Delivery', screen: 'ShippingDelivery' },
    { id: 'disclaimer', label: 'Disclaimer', screen: 'Disclaimer' },
    { id: 'about', label: 'About Us', screen: 'AboutUs' },
  { id: 'contact', label: 'Contact Us', screen: 'ContactUs' },
    { id: 'faq', label: 'FAQ', screen: 'FAQ' },
  ];

  const handleLinkPress = (screen) => {
    navigation.navigate(screen);
  };

  const handleEmailPress = () => {
    Linking.openURL('mailto:support@refopen.com');
  };

  const handleWebsitePress = () => {
    Linking.openURL('https://www.refopen.com');
  };

  return (
  <View style={styles.footer}>
      <View style={styles.divider} />
      
  <View style={styles.footerContent}>
    <Text style={styles.footerTitle}>Refopen</Text>
        <Text style={styles.footerTagline}>Connecting Careers, Opening Doors</Text>

      <View style={styles.linksSection}>
          <Text style={styles.linksTitle}>Quick Links</Text>
          <View style={styles.linksGrid}>
            {links.map((link) => (
   <TouchableOpacity
      key={link.id}
    onPress={() => handleLinkPress(link.screen)}
       style={styles.linkItem}
        disabled={currentPage === link.id}
              >
            <Text 
                  style={[
  styles.linkText,
        currentPage === link.id && styles.linkTextActive
             ]}
         >
        {link.label}
        </Text>
              </TouchableOpacity>
     ))}
    </View>
     </View>

        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>Contact</Text>
          <TouchableOpacity onPress={handleEmailPress}>
 <Text style={styles.contactLink}>support@refopen.com</Text>
          </TouchableOpacity>
    <TouchableOpacity onPress={handleWebsitePress}>
            <Text style={styles.contactLink}>www.refopen.com</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.companyInfo}>
 <Text style={styles.companyName}>Refopen Technologies Pvt. Ltd.</Text>
          <Text style={styles.companyDetails}>Bangalore, Karnataka, India</Text>
        </View>

        <View style={styles.copyright}>
     <Text style={styles.copyrightText}>
     • {new Date().getFullYear()} Refopen Technologies Pvt. Ltd. All rights reserved.
          </Text>
      </View>

        <View style={styles.compliance}>
          <Text style={styles.complianceText}>
   By using Refopen, you agree to our Terms and Conditions and Privacy Policy.
   </Text>
   </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
  marginTop: 40,
    paddingTop: 20,
},
  divider: {
    height: 2,
    backgroundColor: colors.gray200,
    marginBottom: 20,
  },
  footerContent: {
    paddingBottom: 20,
  },
  footerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  footerTagline: {
    fontSize: 14,
 color: colors.gray600,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  linksSection: {
    marginBottom: 20,
  },
  linksTitle: {
    fontSize: 16,
 fontWeight: '600',
    color: colors.gray900,
    marginBottom: 12,
  },
  linksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  linkItem: {
    width: '50%',
    paddingVertical: 6,
  },
  linkText: {
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  linkTextActive: {
    color: colors.gray600,
    fontWeight: '600',
    textDecorationLine: 'none',
  },
  contactSection: {
    marginBottom: 20,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 8,
  },
  contactLink: {
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
    marginBottom: 4,
  },
  companyInfo: {
    marginBottom: 16,
  },
  companyName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray800,
    marginBottom: 4,
  },
  companyDetails: {
    fontSize: 13,
color: colors.gray600,
  },
  copyright: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    marginBottom: 12,
  },
  copyrightText: {
    fontSize: 12,
    color: colors.gray600,
    textAlign: 'center',
  },
  compliance: {
    backgroundColor: colors.gray50,
    padding: 12,
    borderRadius: 6,
  },
  complianceText: {
    fontSize: 11,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 16,
  },
});
