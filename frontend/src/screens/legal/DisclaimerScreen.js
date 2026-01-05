import React, { useMemo, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import ComplianceFooter from '../../components/ComplianceFooter';

export default function DisclaimerScreen() {
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
        <Text style={styles.title}>Disclaimer</Text>
    <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>

    <Text style={styles.intro}>
  This disclaimer governs the use of the Refopen platform (website, mobile applications, and related services). By accessing or using Refopen, you acknowledge and agree to the terms outlined below.
        </Text>

        <View style={styles.warningBox}>
      <Text style={styles.warningText}>
      ⚠️ IMPORTANT: Refopen does NOT guarantee job placements, interviews, or employment outcomes.
     </Text>
        </View>
  <Text style={styles.text}>
      Refopen is a platform that facilitates connections between job seekers, employees, and recruiters. We provide tools and services to assist in your job search, but we cannot and do not guarantee:
        {'\n\n'}• That you will receive job referrals
          {'\n'}• That referrals will lead to interviews
{'\n'}• That interviews will result in job offers
          {'\n'}• That you will be hired by any company
   {'\n'}• Any specific career outcomes or results
        </Text>

        <Text style={styles.sectionTitle}>2. Referral Services Disclaimer</Text>
        <Text style={styles.text}>
          2.1. Referral Requests: Paying for a referral request does not guarantee that a referral will be provided or accepted by an employee.
 {'\n\n'}2.2. Employee Discretion: Employees on our platform have complete discretion to accept or decline referral requests.
{'\n\n'}2.3. Company Policies: Even if a referral is provided, the hiring decision rests solely with the employer and is subject to their internal policies, requirements, and hiring processes.
          {'\n\n'}2.4. No Control Over Outcomes: Refopen has no control over or influence on hiring decisions made by companies.
        </Text>

        <Text style={styles.sectionTitle}>3. Platform as Intermediary</Text>
        <Text style={styles.text}>
          Refopen acts solely as an intermediary platform connecting job seekers, employees, and recruiters. We:
    {'\n\n'}• Do not employ or represent job seekers
          {'\n'}• Are not agents of employers or recruiters
  {'\n'}• Do not control or validate job postings beyond basic verification
      {'\n'}• Are not responsible for the accuracy of information provided by users
 {'\n'}• Cannot verify every detail of user profiles or job listings
 </Text>

   <Text style={styles.sectionTitle}>4. Third-Party Content</Text>
        <Text style={styles.text}>
          4.1. User-Generated Content: All job postings, profiles, and communications between users are created by third parties. Refopen does not endorse, verify, or guarantee the accuracy, completeness, or reliability of such content.
   {'\n\n'}4.2. External Links: Our platform may contain links to external websites or resources. We are not responsible for the content, privacy practices, or terms of third-party sites.
       {'\n\n'}4.3. Company Information: Details about companies, job roles, and salaries are provided by users or publicly available sources. We cannot guarantee their accuracy.
        </Text>

        <Text style={styles.sectionTitle}>5. No Professional Advice</Text>
        <View style={styles.warningBox}>
        <Text style={styles.warningText}>
        Refopen does not provide professional career counseling, legal advice, or financial advisory services.
  </Text>
        </View>
        <Text style={styles.text}>
          Any information, tips, or guidance provided through the platform is for general informational purposes only and should not be considered professional advice. Always consult qualified professionals for career, legal, or financial decisions.
  </Text>

        <Text style={styles.sectionTitle}>6. Service Availability</Text>
 <Text style={styles.text}>
          6.1. Uptime: While we strive for maximum availability, we do not guarantee uninterrupted or error-free access to the platform.
          {'\n\n'}6.2. Maintenance: The platform may be unavailable during scheduled or emergency maintenance.
      {'\n\n'}6.3. Technical Issues: We are not liable for service disruptions caused by technical failures, network issues, or third-party service providers.
      {'\n\n'}6.4. Feature Changes: We reserve the right to modify, suspend, or discontinue any feature without prior notice.
        </Text>

      <Text style={styles.sectionTitle}>7. Information Accuracy</Text>
    <Text style={styles.text}>
     While we make reasonable efforts to ensure accuracy, we do not warrant that:
   {'\n\n'}• Platform content is accurate, complete, or current
 {'\n'}• Job postings are genuine or remain available
      {'\n'}• Company information is up-to-date
     {'\n'}• User profiles are truthful or verified
     {'\n'}• Search results are comprehensive or error-free
  </Text>

        <Text style={styles.sectionTitle}>8. User Responsibility</Text>
   <Text style={styles.text}>
   You are responsible for:
 {'\n\n'}• Verifying the accuracy of job postings and company information
{'\n'}• Conducting your own due diligence before accepting job offers
{'\n'}• Protecting your account credentials and personal information
          {'\n'}• Complying with applicable laws in your jurisdiction
    {'\n'}• Your interactions and agreements with other users
     {'\n'}• Ensuring your resume and profile information are accurate
  </Text>

        <Text style={styles.sectionTitle}>9. Financial Disclaimer</Text>
  <Text style={styles.text}>
          9.1. No Refunds for Outcomes: Payments for referral requests, subscriptions, or other services are non-refundable based on employment outcomes.
          {'\n\n'}9.2. Payment Processing: We use third-party payment processors. We are not responsible for delays, failures, or errors in payment processing.
 {'\n\n'}9.3. Pricing Changes: We reserve the right to modify pricing at any time. Existing subscriptions are honored at original pricing until renewal.
          {'\n\n'}9.4. Taxation: Users are responsible for any applicable taxes on services purchased.
 </Text>

     <Text style={styles.sectionTitle}>10. Limitation of Liability</Text>
    <View style={styles.warningBox}>
          <Text style={styles.warningText}>
   TO THE MAXIMUM EXTENT PERMITTED BY LAW, REFOPEN SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.
          </Text>
        </View>
   <Text style={styles.text}>
     This includes but is not limited to:
          {'\n\n'}• Loss of employment opportunities
          {'\n'}• Lost wages or income
{'\n'}• Emotional distress or reputational damage
  {'\n'}• Business losses or lost profits
          {'\n'}• Data loss or corruption
    {'\n'}• Costs of alternative services
     {'\n\n'}Our total liability for any claim shall not exceed the amount you paid to Refopen in the 12 months preceding the claim.
   </Text>

        <Text style={styles.sectionTitle}>11. "As-Is" and "As-Available" Basis</Text>
        <Text style={styles.text}>
          The Refopen platform and all services are provided on an "as-is" and "as-available" basis without warranties of any kind, either express or implied, including but not limited to:
      {'\n\n'}• Warranties of merchantability
          {'\n'}• Fitness for a particular purpose
{'\n'}• Non-infringement
       {'\n'}• Security or accuracy
  {'\n'}• Uninterrupted or error-free operation
     </Text>

        <Text style={styles.sectionTitle}>12. Security Disclaimer</Text>
   <Text style={styles.text}>
          While we implement security measures to protect your data, we cannot guarantee absolute security. You acknowledge that:
     {'\n\n'}• Internet transmission is never 100% secure
  {'\n'}• Unauthorized access, hacking, or data breaches may occur
    {'\n'}• You share information at your own risk
        {'\n'}• You should use strong passwords and enable security features
     </Text>

      <Text style={styles.sectionTitle}>13. Fraudulent Activity Disclaimer</Text>
     <Text style={styles.text}>
       We actively monitor for fraud but cannot detect all fraudulent activity. Be cautious of:
        {'\n\n'}• Fake job postings or offers requiring upfront payment
  {'\n'}• Requests for personal financial information
    {'\n'}• Too-good-to-be-true offers or guarantees
     {'\n'}• Suspicious or unprofessional communications
     {'\n\n'}Report any suspicious activity to safety@refopen.com immediately.
        </Text>

        <Text style={styles.sectionTitle}>14. Geographic Limitations</Text>
        <Text style={styles.text}>
   Services may vary by location. Some features may not be available in all regions. Job opportunities are subject to local employment laws and regulations. Refopen makes no representation that all content is appropriate or available for use in all locations.
        </Text>

  <Text style={styles.sectionTitle}>15. Indemnification</Text>
        <Text style={styles.text}>
        You agree to indemnify and hold harmless Refopen Solutions, its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including legal fees) arising from:
      {'\n\n'}• Your use of the platform
 {'\n'}• Your violation of these terms or disclaimers
       {'\n'}• Your violation of any rights of third parties
      {'\n'}• Your content or information submitted to the platform
</Text>

<Text style={styles.sectionTitle}>16. No Partnership or Agency</Text>
        <Text style={styles.text}>
    Nothing in the use of Refopen creates any partnership, joint venture, employment, or agency relationship between you and Refopen or between you and other users.
        </Text>

        <Text style={styles.sectionTitle}>17. Results May Vary</Text>
        <Text style={styles.text}>
     Success in job searching depends on numerous factors including qualifications, experience, market conditions, competition, and individual performance. Past success stories do not guarantee similar results for you.
        </Text>

        <Text style={styles.sectionTitle}>18. Platform Changes</Text>
        <Text style={styles.text}>
          We reserve the right to:
          {'\n\n'}• Modify, suspend, or discontinue any aspect of the platform
 {'\n'}• Change eligibility requirements
  {'\n'}• Alter features, pricing, or service structure
       {'\n'}• Terminate or suspend accounts at our discretion
   {'\n\n'}Such changes may be made without prior notice or liability.
</Text>

   <Text style={styles.sectionTitle}>19. Force Majeure</Text>
        <Text style={styles.text}>
     Refopen shall not be liable for any failure to perform due to circumstances beyond our reasonable control, including but not limited to acts of God, war, terrorism, civil unrest, labor disputes, pandemics, government actions, internet or telecommunications failures, or power outages.
        </Text>

        <Text style={styles.sectionTitle}>20. Governing Law</Text>
     <Text style={styles.text}>
       This disclaimer is governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Bangalore, Karnataka, India.
        </Text>

        <Text style={styles.sectionTitle}>21. Changes to Disclaimer</Text>
     <Text style={styles.text}>
  We may update this disclaimer at any time. Continued use of the platform after changes constitute acceptance of the updated disclaimer. Check this page periodically for updates.
 </Text>

        <Text style={styles.sectionTitle}>22. Severability</Text>
        <Text style={styles.text}>
      If any provision of this disclaimer is found invalid or unenforceable, the remaining provisions shall continue in full force and effect.
        </Text>

      <Text style={styles.sectionTitle}>23. Contact</Text>
        <Text style={styles.text}>
          For questions about this disclaimer:
          {'\n\n'}Refopen Solutions
  {'\n'}Email: legal@refopen.com
       {'\n'}Website: www.refopen.com
     </Text>

        <View style={styles.acknowledgment}>
          <Text style={styles.acknowledgmentText}>
      By using Refopen, you acknowledge that you have read, understood, and agree to be bound by this disclaimer. Use the platform at your own risk and discretion.
</Text>
        </View>

        <ComplianceFooter currentPage="disclaimer" />
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
  text: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  marginBottom: 12,
  },
  warningBox: {
    backgroundColor: colors.warning + '20',
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  padding: 16,
    borderRadius: 8,
    marginBottom: 12,
},
  warningText: {
    fontSize: 15,
    color: colors.text,
  fontWeight: '600',
    lineHeight: 22,
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
