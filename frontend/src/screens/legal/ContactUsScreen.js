import React from 'react';
import { ScrollView, View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { colors } from '../../styles/theme';
import ComplianceFooter from '../../components/ComplianceFooter';

export default function ContactUsScreen() {
  const handleEmailPress = (email) => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleWebsitePress = () => {
    Linking.openURL('https://www.refopen.com');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
     <Text style={styles.title}>Contact Us</Text>
      <Text style={styles.subtitle}>We're here to help!</Text>

        <Text style={styles.intro}>
          Have questions, feedback, or need assistance? The Refopen team is ready to support you. Reach out to us through any of the following channels.
        </Text>

<Text style={styles.sectionTitle}>Company Information</Text>
  <View style={styles.infoBox}>
          <Text style={styles.companyName}>Refopen Technologies Pvt. Ltd.</Text>
          <Text style={styles.text}>
 A career networking platform connecting job seekers with employees and recruiters for meaningful career opportunities.
          </Text>
        </View>

      <Text style={styles.sectionTitle}>Customer Support</Text>
        <View style={styles.contactCard}>
          <Text style={styles.contactLabel}>General Support</Text>
     <TouchableOpacity onPress={() => handleEmailPress('support@refopen.com')}>
       <Text style={styles.contactValue}>support@refopen.com</Text>
          </TouchableOpacity>
          <Text style={styles.contactDescription}>
            For account issues, technical problems, subscription queries, and general assistance.
          </Text>
   <Text style={styles.responseTime}>Response Time: 24-48 hours</Text>
     </View>

        <Text style={styles.sectionTitle}>Specialized Departments</Text>
        
  <View style={styles.contactCard}>
      <Text style={styles.contactLabel}>Technical Support</Text>
          <TouchableOpacity onPress={() => handleEmailPress('tech@refopen.com')}>
            <Text style={styles.contactValue}>tech@refopen.com</Text>
    </TouchableOpacity>
        <Text style={styles.contactDescription}>
         Platform bugs, app crashes, login issues, and technical troubleshooting.
     </Text>
     </View>

   <View style={styles.contactCard}>
      <Text style={styles.contactLabel}>Payment & Billing</Text>
       <TouchableOpacity onPress={() => handleEmailPress('billing@refopen.com')}>
    <Text style={styles.contactValue}>billing@refopen.com</Text>
      </TouchableOpacity>
     <Text style={styles.contactDescription}>
            Payment failures, refund requests, invoice queries, and subscription billing.
 </Text>
    </View>

        <View style={styles.contactCard}>
          <Text style={styles.contactLabel}>Refund Department</Text>
          <TouchableOpacity onPress={() => handleEmailPress('refunds@refopen.com')}>
            <Text style={styles.contactValue}>refunds@refopen.com</Text>
       </TouchableOpacity>
          <Text style={styles.contactDescription}>
      Refund requests, cancellation queries, and payment disputes.
     </Text>
     </View>

<View style={styles.contactCard}>
          <Text style={styles.contactLabel}>Privacy & Data Protection</Text>
   <TouchableOpacity onPress={() => handleEmailPress('privacy@refopen.com')}>
            <Text style={styles.contactValue}>privacy@refopen.com</Text>
   </TouchableOpacity>
  <Text style={styles.contactDescription}>
 Data privacy concerns, GDPR requests, data deletion, and privacy policy questions.
   </Text>
        </View>

        <View style={styles.contactCard}>
          <Text style={styles.contactLabel}>Data Protection Officer</Text>
        <TouchableOpacity onPress={() => handleEmailPress('dpo@refopen.com')}>
            <Text style={styles.contactValue}>dpo@refopen.com</Text>
   </TouchableOpacity>
          <Text style={styles.contactDescription}>
      Formal data protection queries and compliance matters.
        </Text>
    </View>

        <View style={styles.contactCard}>
          <Text style={styles.contactLabel}>Legal & Compliance</Text>
    <TouchableOpacity onPress={() => handleEmailPress('legal@refopen.com')}>
            <Text style={styles.contactValue}>legal@refopen.com</Text>
          </TouchableOpacity>
        <Text style={styles.contactDescription}>
            Legal notices, terms of service questions, compliance matters, and legal disputes.
      </Text>
        </View>

        <View style={styles.contactCard}>
 <Text style={styles.contactLabel}>Business & Partnerships</Text>
      <TouchableOpacity onPress={() => handleEmailPress('partnerships@refopen.com')}>
<Text style={styles.contactValue}>partnerships@refopen.com</Text>
    </TouchableOpacity>
          <Text style={styles.contactDescription}>
            Corporate partnerships, bulk licensing, enterprise solutions, and business collaborations.
     </Text>
        </View>

        <View style={styles.contactCard}>
 <Text style={styles.contactLabel}>Media & Press</Text>
      <TouchableOpacity onPress={() => handleEmailPress('media@refopen.com')}>
   <Text style={styles.contactValue}>media@refopen.com</Text>
 </TouchableOpacity>
 <Text style={styles.contactDescription}>
      Press inquiries, media kits, interview requests, and brand partnerships.
  </Text>
  </View>

      <View style={styles.contactCard}>
  <Text style={styles.contactLabel}>Careers at Refopen</Text>
          <TouchableOpacity onPress={() => handleEmailPress('careers@refopen.com')}>
     <Text style={styles.contactValue}>careers@refopen.com</Text>
          </TouchableOpacity>
          <Text style={styles.contactDescription}>
     Job opportunities at Refopen, internships, and joining our team.
          </Text>
   </View>

        <Text style={styles.sectionTitle}>Online Support</Text>
     <View style={styles.infoBox}>
    <Text style={styles.contactLabel}>Website</Text>
       <TouchableOpacity onPress={handleWebsitePress}>
        <Text style={styles.contactValue}>www.refopen.com</Text>
          </TouchableOpacity>
    <Text style={[styles.text, {marginTop: 12}]}>
         Visit our website to access your account, browse jobs, and manage your profile.
          </Text>
      </View>

  <View style={styles.infoBox}>
      <Text style={styles.contactLabel}>In-App Support</Text>
       <Text style={styles.text}>
     Access the Help & Support section within the Refopen mobile or web app for:
 {'\n'}• FAQs and knowledge base
       {'\n'}• Submit support tickets
 {'\n'}• Live chat (when available)
         {'\n'}• Account troubleshooting guides
     </Text>
    </View>

        <Text style={styles.sectionTitle}>Social Media</Text>
    <Text style={styles.text}>
      Follow us for updates, tips, and community engagement:
        </Text>
    <View style={styles.socialBox}>
<Text style={styles.socialItem}>📘 Facebook: @Refopen</Text>
    <Text style={styles.socialItem}>📸 Instagram: @refopen.official</Text>
          <Text style={styles.socialItem}>🐦 Twitter/X: @RefOpenJobs</Text>
          <Text style={styles.socialItem}>💼 LinkedIn: Refopen Technologies</Text>
   <Text style={styles.socialItem}>📹 YouTube: Refopen Careers</Text>
        </View>

        <Text style={styles.sectionTitle}>Business Hours</Text>
   <View style={styles.infoBox}>
        <Text style={styles.text}>
        <Text style={styles.bold}>Customer Support:</Text> Monday - Saturday, 9:00 AM - 7:00 PM IST
     {'\n\n'}<Text style={styles.bold}>Platform Access:</Text> 24/7 (Always available)
          {'\n\n'}<Text style={styles.bold}>Email Support:</Text> Monitored 24/7, responses within 24-48 hours
            {'\n\n'}<Text style={styles.bold}>Holidays:</Text> Support may be limited on national holidays
     </Text>
        </View>

  <Text style={styles.sectionTitle}>Mailing Address</Text>
        <View style={styles.infoBox}>
          <Text style={styles.text}>
 Refopen Technologies Pvt. Ltd.
 {'\n'}[Corporate Office Address]
      {'\n'}Bangalore, Karnataka
    {'\n'}India
     </Text>
 <Text style={styles.note}>
       Note: We are a digital-first company. For fastest response, please use email or in-app support rather than postal mail.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>GST Information</Text>
        <View style={styles.infoBox}>
       <Text style={styles.text}>
            <Text style={styles.bold}>Company:</Text> Refopen Technologies Pvt. Ltd.
   {'\n'}<Text style={styles.bold}>GST Number:</Text> [GST Number]
       {'\n'}<Text style={styles.bold}>PAN:</Text> [PAN Number]
          </Text>
          <Text style={styles.note}>
For GST-related queries, contact: billing@refopen.com
       </Text>
    </View>

     <Text style={styles.sectionTitle}>Feedback & Suggestions</Text>
  <View style={styles.infoBox}>
    <TouchableOpacity onPress={() => handleEmailPress('feedback@refopen.com')}>
            <Text style={styles.contactValue}>feedback@refopen.com</Text>
    </TouchableOpacity>
          <Text style={[styles.text, {marginTop: 8}]}>
  We value your input! Share your ideas, feature requests, and suggestions to help us improve Refopen.
      </Text>
        </View>

     <Text style={styles.sectionTitle}>Report Abuse or Safety Concerns</Text>
 <View style={styles.infoBox}>
    <TouchableOpacity onPress={() => handleEmailPress('safety@refopen.com')}>
        <Text style={styles.contactValue}>safety@refopen.com</Text>
       </TouchableOpacity>
   <Text style={[styles.text, {marginTop: 8}]}>
 Report fraudulent profiles, harassment, spam, or any safety concerns. We take user safety seriously.
      </Text>
        </View>

        <Text style={styles.sectionTitle}>Before You Contact Us</Text>
  <Text style={styles.text}>
  To help us serve you better, please:
     {'\n\n'}? Check our FAQ section for quick answers
    {'\n'}? Include your registered email address
          {'\n'}? Provide transaction IDs for payment queries
       {'\n'}? Attach screenshots for technical issues
  {'\n'}? Be specific about the problem you're facing
  {'\n'}? Mention your device and app version
    </Text>

        <View style={styles.acknowledgment}>
        <Text style={styles.acknowledgmentText}>
    Your satisfaction is our priority. We're committed to responding promptly and resolving your concerns effectively.
          </Text>
        </View>

        <ComplianceFooter currentPage="contact" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
 backgroundColor: colors.white,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
 color: colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: colors.gray600,
    marginBottom: 16,
  },
  intro: {
    fontSize: 16,
    color: colors.gray800,
    lineHeight: 24,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
 color: colors.gray900,
    marginTop: 24,
    marginBottom: 12,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 8,
  },
  infoBox: {
    backgroundColor: colors.gray50,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  contactCard: {
backgroundColor: colors.white,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  contactLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginBottom: 6,
  },
  contactValue: {
    fontSize: 16,
    color: colors.primary,
    textDecorationLine: 'underline',
    marginBottom: 8,
  },
  contactDescription: {
    fontSize: 14,
    color: colors.gray600,
    lineHeight: 20,
  },
  responseTime: {
fontSize: 13,
    color: colors.gray500,
    fontStyle: 'italic',
    marginTop: 6,
  },
  text: {
    fontSize: 15,
    color: colors.gray700,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '600',
    color: colors.gray900,
  },
  note: {
    fontSize: 13,
    color: colors.gray500,
    fontStyle: 'italic',
    marginTop: 8,
  },
socialBox: {
    backgroundColor: colors.gray50,
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  socialItem: {
    fontSize: 15,
    color: colors.gray700,
    marginBottom: 8,
  },
  acknowledgment: {
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
    marginBottom: 30,
  },
  acknowledgmentText: {
    fontSize: 15,
  color: colors.primary,
 fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
  },
});
