import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * PrivacyContent — Pure legal text, no navigation/screen wrapper.
 * Used by both PrivacyPolicyScreen and TermsConsentModal.
 *
 * @param {boolean} [compact] - use smaller font sizes for modal context
 */
export default function PrivacyContent({ compact = false }) {
  const { colors } = useTheme();
  const s = compact ? compactStyles(colors) : defaultStyles(colors);

  return (
    <View>
      <Text style={s.title}>Privacy Policy</Text>
      <Text style={s.lastUpdated}>Version 1.0 — Last Updated: 8 February 2026</Text>

      <Text style={s.intro}>
        Refopen Solutions, a sole proprietorship based in Bangalore, Karnataka, India ("Refopen", "we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Refopen platform, in accordance with the Digital Personal Data Protection Act, 2023 (DPDPA) and other applicable laws.
      </Text>

      <Text style={s.sectionTitle}>1. Information We Collect</Text>

      <Text style={s.subsectionTitle}>1.1. Personal Information</Text>
      <Text style={s.text}>
        When you register and use our platform, we collect:
        {'\n'}• Full name, email address, phone number
        {'\n'}• Professional information (work experience, education, skills)
        {'\n'}• Resume and career documents
        {'\n'}• Profile photograph
        {'\n'}• Location and preferred job locations
        {'\n'}• Employment preferences and career goals
        {'\n'}• Organization details (for employers)
      </Text>

      <Text style={s.subsectionTitle}>1.2. Payment Information</Text>
      <Text style={s.text}>
        When you make purchases or add money to your wallet, we collect:
        {'\n'}• Billing information
        {'\n'}• Transaction details
        {'\n'}• Payment method information (processed securely by third-party payment processors)
      </Text>

      <Text style={s.subsectionTitle}>1.3. Usage Data</Text>
      <Text style={s.text}>
        We automatically collect information about how you interact with our platform:
        {'\n'}• Device information (device type, operating system, browser)
        {'\n'}• IP address and location data
        {'\n'}• Pages visited and features used
        {'\n'}• Time and date of access
        {'\n'}• Referring websites and search terms
        {'\n'}• Application performance and error logs
      </Text>

      <Text style={s.subsectionTitle}>1.4. Communications</Text>
      <Text style={s.text}>
        We collect information from your interactions with other users and with us:
        {'\n'}• Messages and referral requests
        {'\n'}• Customer support communications
        {'\n'}• Feedback and survey responses
      </Text>

      <Text style={s.sectionTitle}>2. How We Use Your Information</Text>
      <Text style={s.text}>
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

      <Text style={s.sectionTitle}>3. Legal Basis for Processing</Text>
      <Text style={s.text}>
        Under the Digital Personal Data Protection Act, 2023 (India) and the GDPR (for users in the European Economic Area), we process personal data based on:
        {'\n'}• Consent: You provide consent when you create an account and accept our Terms of Service and Privacy Policy
        {'\n'}• Contract Performance: To provide the services you have requested
        {'\n'}• Legitimate Interests: To improve our services, ensure platform security, and prevent fraud
        {'\n'}• Legal Obligations: To comply with applicable Indian and international laws
        {'\n'}• Consent: For marketing communications and optional features (which you can withdraw at any time)
      </Text>

      <Text style={s.sectionTitle}>4. Information Sharing and Disclosure</Text>

      <Text style={s.subsectionTitle}>4.1. With Other Users</Text>
      <Text style={s.text}>
        • Your profile information is visible to other users based on your privacy settings
        {'\n'}• When you request a referral, relevant profile information is shared with the referrer
        {'\n'}• Employers can view job seeker profiles when considering applications
      </Text>

      <Text style={s.subsectionTitle}>4.2. Service Providers</Text>
      <Text style={s.text}>
        We share information with trusted third parties who assist us in operating the platform:
        {'\n'}• Cloud hosting and infrastructure (Microsoft Azure)
        {'\n'}• Payment processors (Razorpay, CashFree)
        {'\n'}• Communication services (Azure Communication Services)
        {'\n'}• AI-powered resume analysis and job matching (Google Gemini, Groq)
        {'\n'}• Job data aggregation (Adzuna)
        {'\n'}• Web content processing (Jina AI)
        {'\n'}• Analytics services (Azure Application Insights)
        {'\n\n'}These service providers are contractually bound to use your information only for the purposes of providing services to us and are required to maintain appropriate security measures.
      </Text>

      <Text style={s.subsectionTitle}>4.3. Business Transfers</Text>
      <Text style={s.text}>
        If Refopen is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change.
      </Text>

      <Text style={s.subsectionTitle}>4.4. Legal Requirements</Text>
      <Text style={s.text}>
        We may disclose your information if required by law, court order, or government request, or to protect our rights, property, or safety.
      </Text>

      <Text style={s.subsectionTitle}>4.5. With Your Consent</Text>
      <Text style={s.text}>
        We may share your information for other purposes with your explicit consent.
      </Text>

      <Text style={s.sectionTitle}>5. Data Security</Text>
      <Text style={s.text}>
        We implement industry-standard security measures to protect your information:
        {'\n'}• SSL/TLS encryption for data transmission
        {'\n'}• Encrypted storage of sensitive data
        {'\n'}• Regular security audits and vulnerability assessments
        {'\n'}• Access controls and authentication mechanisms
        {'\n'}• Secure payment processing through PCI-DSS compliant providers
        {'\n\n'}However, no method of transmission over the internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
      </Text>

      <Text style={s.sectionTitle}>6. Data Retention</Text>
      <Text style={s.text}>
        We retain your information for as long as necessary to provide our services and comply with legal obligations:
        {'\n'}• Active accounts: Data retained while account is active
        {'\n'}• Closed accounts: Most data deleted within 90 days
        {'\n'}• Legal compliance: Some data retained longer for tax, legal, or accounting purposes
        {'\n'}• Transaction records: Retained for 7 years as per Indian law
      </Text>

      <Text style={s.sectionTitle}>7. Your Privacy Rights</Text>

      <Text style={s.subsectionTitle}>7.1. Access and Portability</Text>
      <Text style={s.text}>
        You have the right to access your personal data and request a copy in a portable format.
      </Text>

      <Text style={s.subsectionTitle}>7.2. Correction and Update</Text>
      <Text style={s.text}>
        You can update your profile information at any time through your account settings.
      </Text>

      <Text style={s.subsectionTitle}>7.3. Deletion</Text>
      <Text style={s.text}>
        You can request deletion of your account and personal data by contacting us through the Help & Support feature in the Refopen app. Upon receiving your request, we will delete your data within 30 days, except where retention is required by law (e.g., transaction records retained for 7 years under Indian tax law).
      </Text>

      <Text style={s.subsectionTitle}>7.4. Opt-Out of Marketing</Text>
      <Text style={s.text}>
        You can unsubscribe from marketing emails using the unsubscribe link or through account settings.
      </Text>

      <Text style={s.subsectionTitle}>7.5. Restrict Processing</Text>
      <Text style={s.text}>
        You can request restrictions on how we process your data in certain circumstances.
      </Text>

      <Text style={s.subsectionTitle}>7.6. Object to Processing</Text>
      <Text style={s.text}>
        You can object to processing of your data for direct marketing or based on legitimate interests.
      </Text>

      <Text style={s.sectionTitle}>8. Cookies and Tracking Technologies</Text>
      <Text style={s.text}>
        We use cookies and similar technologies to:
        {'\n'}• Remember your preferences and settings
        {'\n'}• Understand how you use our platform
        {'\n'}• Improve our services
        {'\n'}• Provide personalized content
        {'\n\n'}You can control cookies through your browser settings. However, disabling cookies may limit platform functionality.
      </Text>

      <Text style={s.sectionTitle}>9. Third-Party Links</Text>
      <Text style={s.text}>
        Our platform may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies.
      </Text>

      <Text style={s.sectionTitle}>10. Children's Privacy</Text>
      <Text style={s.text}>
        Refopen is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we discover we have collected information from a child, we will delete it promptly.
      </Text>

      <Text style={s.sectionTitle}>11. International Data Transfers</Text>
      <Text style={s.text}>
        Your information may be transferred to and processed in countries other than India. We ensure appropriate safeguards are in place to protect your data in compliance with applicable laws.
      </Text>

      <Text style={s.sectionTitle}>12. Changes to Privacy Policy</Text>
      <Text style={s.text}>
        We may update this Privacy Policy from time to time. We will notify you of material changes via email or platform notification. The "Last Updated" date at the top indicates when changes were made.
      </Text>

      <Text style={s.sectionTitle}>13. Grievance Redressal</Text>
      <Text style={s.text}>
        In accordance with the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000, if you have any grievances regarding how your data is handled, you may contact our Grievance Officer:
        {'\n\n'}Designation: Grievance Officer / Data Protection Officer, Refopen Solutions
        {'\n'}Contact: Via the Help & Support feature in the Refopen app
        {'\n'}Response Time: We will acknowledge your grievance within 48 hours and endeavour to resolve it within 30 days.
      </Text>

      <Text style={s.sectionTitle}>14. Contact Us</Text>
      <Text style={s.text}>
        For privacy-related questions or to exercise your privacy rights, contact us through:
        {'\n\n'}Refopen Solutions
        {'\n'}Bangalore, Karnataka, India
        {'\n'}Support: Use the Help & Support feature within the Refopen app
        {'\n'}Website: www.refopen.com
      </Text>

      <Text style={s.sectionTitle}>15. Consent</Text>
      {!compact ? (
        <View style={s.acknowledgment}>
          <Text style={s.acknowledgmentText}>
            By creating an account and using Refopen, you consent to the collection, use, and disclosure of your information as described in this Privacy Policy. You may withdraw your consent at any time by deleting your account, though this may limit your ability to use the platform.
          </Text>
        </View>
      ) : (
        <Text style={s.text}>
          By creating an account and using Refopen, you consent to the collection, use, and disclosure of your information as described in this Privacy Policy. You may withdraw your consent at any time by deleting your account, though this may limit your ability to use the platform.
        </Text>
      )}
    </View>
  );
}

const defaultStyles = (colors) =>
  StyleSheet.create({
    title: { fontSize: 28, fontWeight: 'bold', color: colors.primary, marginBottom: 8 },
    lastUpdated: { fontSize: 14, color: colors.textSecondary, marginBottom: 20 },
    intro: { fontSize: 16, color: colors.text, lineHeight: 24, marginBottom: 20 },
    sectionTitle: { fontSize: 20, fontWeight: '600', color: colors.text, marginTop: 20, marginBottom: 10 },
    subsectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 12, marginBottom: 8 },
    text: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 12 },
    acknowledgment: { backgroundColor: colors.gray100, padding: 16, borderRadius: 8, marginTop: 24, marginBottom: 30 },
    acknowledgmentText: { fontSize: 15, color: colors.text, fontWeight: '500', lineHeight: 22, textAlign: 'center' },
  });

const compactStyles = (colors) =>
  StyleSheet.create({
    title: { fontSize: 22, fontWeight: '700', color: colors.primary, marginBottom: 4 },
    lastUpdated: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
    intro: { fontSize: 14, color: colors.text, lineHeight: 21, marginBottom: 14 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 18, marginBottom: 6 },
    subsectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 10, marginBottom: 4 },
    text: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, marginBottom: 8 },
  });
