import React, { useMemo, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import ComplianceFooter from '../../components/ComplianceFooter';

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);

  // ✅ Navigation header with smart back button (hard-refresh safe)
  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.surface, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
      headerTitleStyle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text },
      headerLeft: () => (
        <TouchableOpacity 
          style={{ marginLeft: 16 }} 
          onPress={() => {
            const navState = navigation.getState();
            const routes = navState?.routes || [];
            const currentIndex = navState?.index || 0;
            if (routes.length > 1 && currentIndex > 0) {
              navigation.goBack();
            } else {
              navigation.navigate('Main', { screen: 'MainTabs', params: { screen: 'Profile' } });
            }
          }} 
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  return (
    <View style={styles.container}>
    <ScrollView style={styles.scrollView}>
    <View style={styles.innerContainer}>
   <View style={styles.content}>
     <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>

        <Text style={styles.intro}>
        Refopen Solutions ("Refopen", "we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Refopen platform.
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        
        <Text style={styles.subsectionTitle}>1.1. Personal Information</Text>
        <Text style={styles.text}>
          When you register and use our platform, we collect:
     {'\n'}• Full name, email address, phone number
          {'\n'}• Professional information (work experience, education, skills)
          {'\n'}• Resume and career documents
     {'\n'}• Profile photograph
    {'\n'}• Location and preferred job locations
          {'\n'}• Employment preferences and career goals
          {'\n'}• Organization details (for employers)
        </Text>

        <Text style={styles.subsectionTitle}>1.2. Payment Information</Text>
     <Text style={styles.text}>
        When you make purchases or add money to your wallet, we collect:
      {'\n'}• Billing information
          {'\n'}• Transaction details
     {'\n'}• Payment method information (processed securely by third-party payment processors)
 </Text>

        <Text style={styles.subsectionTitle}>1.3. Usage Data</Text>
        <Text style={styles.text}>
          We automatically collect information about how you interact with our platform:
  {'\n'}• Device information (device type, operating system, browser)
    {'\n'}• IP address and location data
          {'\n'}• Pages visited and features used
 {'\n'}• Time and date of access
    {'\n'}• Referring websites and search terms
     {'\n'}• Application performance and error logs
        </Text>

        <Text style={styles.subsectionTitle}>1.4. Communications</Text>
   <Text style={styles.text}>
          We collect information from your interactions with other users and with us:
 {'\n'}• Messages and referral requests
   {'\n'}• Customer support communications
     {'\n'}• Feedback and survey responses
        </Text>

        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.text}>
          We use the collected information for:
        {'\n\n'}2.1. Service Provision
          {'\n'}• Creating and managing your account
   {'\n'}• Matching job seekers with opportunities
          {'\n'}• Facilitating referral connections
    {'\n'}• Processing payments and managing wallet transactions
      {'\n'}• Providing customer support
   {'\n\n'}2.2. Platform Improvement
   {'\n'}• Analyzing usage patterns and trends
      {'\n'}• Developing new features and services
          {'\n'}• Enhancing user experience
        {'\n'}• Troubleshooting technical issues
          {'\n\n'}2.3. Communication
  {'\n'}• Sending transactional emails (registration, payments, referrals)
    {'\n'}• Notifying you about platform updates
          {'\n'}• Sending marketing communications (with your consent)
          {'\n'}• Responding to your inquiries
    {'\n\n'}2.4. Safety and Security
          {'\n'}• Detecting and preventing fraud
       {'\n'}• Enforcing our Terms and Conditions
          {'\n'}• Protecting user safety
          {'\n'}• Complying with legal obligations
      </Text>

        <Text style={styles.sectionTitle}>3. Legal Basis for Processing (GDPR)</Text>
        <Text style={styles.text}>
          For users in the European Economic Area, we process personal data based on:
  {'\n'}• Contract Performance: To provide services you've requested
{'\n'}• Legitimate Interests: To improve our services and ensure platform security
    {'\n'}• Legal Obligations: To comply with applicable laws
          {'\n'}• Consent: For marketing communications and optional features
        </Text>

        <Text style={styles.sectionTitle}>4. Information Sharing and Disclosure</Text>

        <Text style={styles.subsectionTitle}>4.1. With Other Users</Text>
        <Text style={styles.text}>
          • Your profile information is visible to other users based on your privacy settings
       {'\n'}• When you request a referral, relevant profile information is shared with the referrer
          {'\n'}• Employers can view job seeker profiles when considering applications
        </Text>

        <Text style={styles.subsectionTitle}>4.2. Service Providers</Text>
      <Text style={styles.text}>
   We share information with trusted third parties who assist us:
 {'\n'}• Cloud hosting providers (Microsoft Azure)
          {'\n'}• Payment processors (Razorpay, PhonePe, PayU, Cashfree)
          {'\n'}• Email service providers
          {'\n'}• Analytics services
          {'\n'}• Customer support tools
  </Text>

     <Text style={styles.subsectionTitle}>4.3. Business Transfers</Text>
        <Text style={styles.text}>
          If Refopen is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change.
        </Text>

        <Text style={styles.subsectionTitle}>4.4. Legal Requirements</Text>
<Text style={styles.text}>
          We may disclose your information if required by law, court order, or government request, or to protect our rights, property, or safety.
   </Text>

    <Text style={styles.subsectionTitle}>4.5. With Your Consent</Text>
        <Text style={styles.text}>
          We may share your information for other purposes with your explicit consent.
        </Text>

  <Text style={styles.sectionTitle}>5. Data Security</Text>
        <Text style={styles.text}>
          We implement industry-standard security measures to protect your information:
          {'\n'}• SSL/TLS encryption for data transmission
  {'\n'}• Encrypted storage of sensitive data
          {'\n'}• Regular security audits and vulnerability assessments
          {'\n'}• Access controls and authentication mechanisms
          {'\n'}• Secure payment processing through PCI-DSS compliant providers
       {'\n\n'}However, no method of transmission over the internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
        </Text>

        <Text style={styles.sectionTitle}>6. Data Retention</Text>
        <Text style={styles.text}>
       We retain your information for as long as necessary to provide our services and comply with legal obligations:
          {'\n'}• Active accounts: Data retained while account is active
          {'\n'}• Closed accounts: Most data deleted within 90 days
          {'\n'}• Legal compliance: Some data retained longer for tax, legal, or accounting purposes
          {'\n'}• Transaction records: Retained for 7 years as per Indian law
        </Text>

        <Text style={styles.sectionTitle}>7. Your Privacy Rights</Text>
 
        <Text style={styles.subsectionTitle}>7.1. Access and Portability</Text>
        <Text style={styles.text}>
    You have the right to access your personal data and request a copy in a portable format.
   </Text>

        <Text style={styles.subsectionTitle}>7.2. Correction and Update</Text>
     <Text style={styles.text}>
    You can update your profile information at any time through your account settings.
    </Text>

 <Text style={styles.subsectionTitle}>7.3. Deletion</Text>
<Text style={styles.text}>
      You can request deletion of your account and personal data by contacting us at privacy@refopen.com. Some information may be retained as legally required.
        </Text>

        <Text style={styles.subsectionTitle}>7.4. Opt-Out of Marketing</Text>
  <Text style={styles.text}>
     You can unsubscribe from marketing emails using the unsubscribe link or through account settings.
        </Text>

        <Text style={styles.subsectionTitle}>7.5. Restrict Processing</Text>
<Text style={styles.text}>
        You can request restrictions on how we process your data in certain circumstances.
        </Text>

    <Text style={styles.subsectionTitle}>7.6. Object to Processing</Text>
    <Text style={styles.text}>
        You can object to processing of your data for direct marketing or based on legitimate interests.
        </Text>

        <Text style={styles.sectionTitle}>8. Cookies and Tracking Technologies</Text>
        <Text style={styles.text}>
        We use cookies and similar technologies to:
          {'\n'}• Remember your preferences and settings
{'\n'}• Understand how you use our platform
          {'\n'}• Improve our services
    {'\n'}• Provide personalized content
       {'\n\n'}You can control cookies through your browser settings. However, disabling cookies may limit platform functionality.
    </Text>

        <Text style={styles.sectionTitle}>9. Third-Party Links</Text>
        <Text style={styles.text}>
   Our platform may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies.
        </Text>

        <Text style={styles.sectionTitle}>10. Children's Privacy</Text>
        <Text style={styles.text}>
          Refopen is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we discover we have collected information from a child, we will delete it promptly.
 </Text>

  <Text style={styles.sectionTitle}>11. International Data Transfers</Text>
        <Text style={styles.text}>
      Your information may be transferred to and processed in countries other than India. We ensure appropriate safeguards are in place to protect your data in compliance with applicable laws.
        </Text>

<Text style={styles.sectionTitle}>12. Changes to Privacy Policy</Text>
        <Text style={styles.text}>
    We may update this Privacy Policy from time to time. We will notify you of material changes via email or platform notification. The "Last Updated" date at the top indicates when changes were made.
        </Text>

        <Text style={styles.sectionTitle}>13. Contact Us</Text>
        <Text style={styles.text}>
        For privacy-related questions or to exercise your privacy rights, contact us at:
          {'\n\n'}Refopen Solutions
          {'\n'}Email: privacy@refopen.com
   {'\n'}Data Protection Officer: dpo@refopen.com
      {'\n'}Support: support@refopen.com
          {'\n'}Website: www.refopen.com
    </Text>

        <Text style={styles.sectionTitle}>14. Consent</Text>
        <View style={styles.acknowledgment}>
 <Text style={styles.acknowledgmentText}>
  By using Refopen, you consent to the collection, use, and disclosure of your information as described in this Privacy Policy.
     </Text>
        </View>

   <ComplianceFooter currentPage="privacy" />
      </View>
    </View>
    </ScrollView>
    </View>
  );
}

const createStyles = (colors, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  innerContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 800 : '100%',
    alignSelf: 'center',
  },
  content: {
    padding: 20,
 paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  intro: {
fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 20,
  },
  sectionTitle: {
fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 20,
    marginBottom: 10,
  },
  subsectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  text: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  acknowledgment: {
    backgroundColor: colors.gray100,
    padding: 16,
borderRadius: 8,
    marginTop: 24,
    marginBottom: 30,
  },
  acknowledgmentText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
  },
});
