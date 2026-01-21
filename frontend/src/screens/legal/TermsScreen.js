import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import ComplianceFooter from '../../components/ComplianceFooter';

export default function TermsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
  const scrollRef = useRef(null);

  // Scroll to top when screen is focused
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

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
      <ScrollView ref={scrollRef} style={styles.scrollView}>
        <View style={styles.innerContainer}>
          <View style={styles.content}>
        <Text style={styles.title}>Terms and Conditions</Text>
        <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>

        <Text style={styles.intro}>
          Welcome to Refopen. These Terms and Conditions ("Terms") govern your access to and use of the Refopen platform operated by Refopen Solutions ("Refopen", "we", "us", or "our").
        </Text>

        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
      <Text style={styles.text}>
    By accessing or using the Refopen platform, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our services.
        </Text>

        <Text style={styles.sectionTitle}>2. Services Provided</Text>
        <Text style={styles.text}>
Refopen is a career networking platform that provides:
          {'\n'}• Job referral services connecting job seekers with employees of organizations
      {'\n'}• Direct connections with recruiters
          {'\n'}• Job search and application services
{'\n'}• Subscription-based premium features
       {'\n'}• Wallet services for in-platform transactions
        </Text>

  <Text style={styles.sectionTitle}>3. Eligibility</Text>
 <Text style={styles.text}>
          You must be at least 18 years of age to use our services. By using the platform, you represent and warrant that you meet this age requirement and have the legal capacity to enter into these Terms.
        </Text>

      <Text style={styles.sectionTitle}>4. User Accounts</Text>
     <Text style={styles.text}>
          4.1. Registration: You must create an account to access certain features. You agree to provide accurate, current, and complete information during registration.
        {'\n\n'}4.2. Account Security: You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
 {'\n\n'}4.3. Account Types: We offer separate account types for job seekers and employers, each with distinct features and obligations.
 </Text>

        <Text style={styles.sectionTitle}>5. User Conduct</Text>
        <Text style={styles.text}>
  You agree not to:
          {'\n'}• Provide false, misleading, or fraudulent information
          {'\n'}• Impersonate any person or entity
          {'\n'}• Upload malicious code or viruses
          {'\n'}• Scrape or harvest data from the platform
  {'\n'}• Interfere with the proper functioning of the platform
   {'\n'}• Use the platform for any illegal or unauthorized purpose
          {'\n'}• Harass, abuse, or harm other users
        </Text>

  <Text style={styles.sectionTitle}>6. Subscription Services</Text>
      <Text style={styles.text}>
          6.1. Paid Plans: We offer subscription plans with various features. Subscription fees are charged in advance on a recurring basis.
          {'\n\n'}6.2. Auto-Renewal: Subscriptions automatically renew unless cancelled before the renewal date.
 {'\n\n'}6.3. Price Changes: We reserve the right to modify subscription fees with 30 days' notice to existing subscribers.
        </Text>

   <Text style={styles.sectionTitle}>7. Wallet Services</Text>
        <Text style={styles.text}>
          7.1. Wallet Credits: Users can add money to their Refopen wallet for platform transactions.
    {'\n\n'}7.2. Usage: Wallet credits can be used for referral fees, premium features, and other platform services.
    {'\n\n'}7.3. Non-Refundable: Wallet credits are generally non-refundable except as specified in our Refund Policy.
  {'\n\n'}7.4. Validity: Wallet credits do not expire unless your account is terminated for violation of these Terms.
        </Text>

        <Text style={styles.sectionTitle}>8. Referral Services</Text>
        <Text style={styles.text}>
     8.1. Referral Requests: Job seekers can request referrals from employees of target organizations.
        {'\n\n'}8.2. Referral Fees: Certain referral services require payment of fees as displayed on the platform.
        {'\n\n'}8.3. No Guarantee: Paying for a referral request does not guarantee that a referral will be provided or that you will receive a job offer.
          {'\n\n'}8.4. Referrer Responsibilities: Employees providing referrals must ensure they have authority to do so within their organization.
        </Text>

        <Text style={styles.sectionTitle}>9. Job Postings</Text>
        <Text style={styles.text}>
      9.1. Employer Obligations: Employers posting jobs must ensure all information is accurate and comply with applicable employment laws.
          {'\n\n'}9.2. Content Rights: Employers retain ownership of job posting content but grant Refopen a license to display and promote such content.
    {'\n\n'}9.3. Prohibited Content: Job postings must not contain discriminatory, misleading, or illegal content.
        </Text>

        <Text style={styles.sectionTitle}>10. Payment Terms</Text>
        <Text style={styles.text}>
        10.1. Payment Processing: We use third-party payment processors including Razorpay, PhonePe, and others.
          {'\n\n'}10.2. Payment Methods: We accept credit/debit cards, UPI, net banking, and other methods as displayed.
          {'\n\n'}10.3. Currency: All prices are in Indian Rupees (INR) unless otherwise stated.
          {'\n\n'}10.4. Taxes: Prices include applicable GST and other taxes as required by law.
    </Text>

        <Text style={styles.sectionTitle}>11. Intellectual Property</Text>
        <Text style={styles.text}>
        11.1. Platform Rights: All content, features, and functionality of the Refopen platform are owned by Refopen Solutions and protected by intellectual property laws.
          {'\n\n'}11.2. User Content: You retain ownership of content you submit but grant us a worldwide, non-exclusive license to use, display, and distribute such content.
          {'\n\n'}11.3. Trademarks: "Refopen" and associated logos are trademarks of Refopen Solutions.
    </Text>

        <Text style={styles.sectionTitle}>12. Data Privacy</Text>
        <Text style={styles.text}>
          Your use of the platform is subject to our Privacy Policy, which describes how we collect, use, and protect your personal information. Please review our Privacy Policy carefully.
  </Text>

        <Text style={styles.sectionTitle}>13. Disclaimers</Text>
        <Text style={styles.text}>
     13.1. No Employment Guarantee: Refopen does not guarantee job placements, interviews, or employment outcomes.
   {'\n\n'}13.2. Third-Party Content: We are not responsible for the accuracy or reliability of information provided by users or third parties.
          {'\n\n'}13.3. Platform Availability: We do not guarantee uninterrupted or error-free service.
          {'\n\n'}13.4. AS-IS BASIS: The platform is provided "as is" and "as available" without warranties of any kind.
        </Text>

        <Text style={styles.sectionTitle}>14. Limitation of Liability</Text>
        <Text style={styles.text}>
  To the maximum extent permitted by law, Refopen Solutions shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform. Our total liability shall not exceed the amount you paid to us in the twelve months preceding the claim.
        </Text>

        <Text style={styles.sectionTitle}>15. Indemnification</Text>
        <Text style={styles.text}>
          You agree to indemnify and hold harmless Refopen Solutions, its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the platform or violation of these Terms.
        </Text>

        <Text style={styles.sectionTitle}>16. Termination</Text>
        <Text style={styles.text}>
          16.1. By You: You may terminate your account at any time through account settings or by contacting support.
        {'\n\n'}16.2. By Us: We may suspend or terminate your account immediately if you violate these Terms or engage in fraudulent activity.
          {'\n\n'}16.3. Effect of Termination: Upon termination, your right to use the platform ceases immediately. Unused wallet credits may be forfeited as per our Refund Policy.
        </Text>

        <Text style={styles.sectionTitle}>17. Dispute Resolution</Text>
        <Text style={styles.text}>
17.1. Governing Law: These Terms are governed by the laws of India.
          {'\n\n'}17.2. Jurisdiction: Any disputes shall be subject to the exclusive jurisdiction of courts in Bangalore, Karnataka, India.
          {'\n\n'}17.3. Arbitration: We encourage resolving disputes through binding arbitration before approaching courts.
        </Text>

        <Text style={styles.sectionTitle}>18. Changes to Terms</Text>
        <Text style={styles.text}>
          We reserve the right to modify these Terms at any time. We will notify you of material changes via email or platform notification. Your continued use of the platform after changes constitute acceptance of the modified Terms.
      </Text>

        <Text style={styles.sectionTitle}>19. Contact Information</Text>
        <Text style={styles.text}>
          For questions about these Terms, please contact us at:
          {'\n\n'}Refopen Solutions
          {'\n'}Support: Create a ticket via Help & Support
          {'\n'}Website: www.refopen.com
        </Text>

        <Text style={styles.sectionTitle}>20. Miscellaneous</Text>
        <Text style={styles.text}>
  20.1. Entire Agreement: These Terms constitute the entire agreement between you and Refopen regarding use of the platform.
   {'\n\n'}20.2. Severability: If any provision is found unenforceable, the remaining provisions continue in effect.
          {'\n\n'}20.3. Waiver: Our failure to enforce any right or provision does not constitute a waiver of such right or provision.
          {'\n\n'}20.4. Assignment: You may not assign these Terms without our consent. We may assign our rights without restriction.
  </Text>

        <View style={styles.acknowledgment}>
          <Text style={styles.acknowledgmentText}>
        By using Refopen, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
     </Text>
        </View>

 <ComplianceFooter currentPage="terms" />
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
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 900 : '100%',
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
