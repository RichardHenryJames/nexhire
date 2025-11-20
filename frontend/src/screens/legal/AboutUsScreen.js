import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { colors } from '../../styles/theme';
import ComplianceFooter from '../../components/ComplianceFooter';

export default function AboutUsScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
  <Text style={styles.title}>About Refopen</Text>
 <Text style={styles.tagline}>Connecting Careers, Opening Doors</Text>

   <Text style={styles.intro}>
      Refopen is a revolutionary career networking platform that bridges the gap between job seekers, employees, and recruiters, making job referrals accessible and career growth achievable for everyone.
        </Text>

        <Text style={styles.sectionTitle}>Our Story</Text>
        <Text style={styles.text}>
  Founded with a vision to democratize job referrals, Refopen was born from the understanding that many qualified candidates miss opportunities simply because they lack connections within their target companies.
          {'\n\n'}We recognized that traditional job applications often get lost in the crowd, while employee referrals significantly increase the chances of landing interviews. Refopen bridges this gap by creating a trusted platform where job seekers can connect with employees willing to provide referrals, and where recruiters can directly discover talent.
        </Text>

    <Text style={styles.sectionTitle}>Our Mission</Text>
        <View style={styles.highlightBox}>
    <Text style={styles.highlightText}>
    To empower every job seeker with access to quality referrals and direct recruiter connections, making career advancement fair, transparent, and accessible to all.
   </Text>
        </View>

    <Text style={styles.sectionTitle}>Our Vision</Text>
    <View style={styles.highlightBox}>
          <Text style={styles.highlightText}>
 To become India's most trusted career networking platform, where talent meets opportunity through meaningful connections.
    </Text>
        </View>

        <Text style={styles.sectionTitle}>What We Do</Text>
 
        <View style={styles.featureCard}>
     <Text style={styles.featureTitle}>🤝 Job Referrals</Text>
     <Text style={styles.featureText}>
            Request referrals for jobs you are interested in. All employees from that company on Refopen receive instant notifications about your request, dramatically increasing your chances of getting a referral and landing an interview.
     </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>💼 Direct Recruiter Access</Text>
          <Text style={styles.featureText}>
            Bypass traditional application queues by connecting directly with recruiters actively seeking candidates for their organizations.
 </Text>
 </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>🔍 Job Discovery</Text>
    <Text style={styles.featureText}>
          Browse thousands of job opportunities across industries, experience levels, and locations, all in one place.
          </Text>
      </View>

   <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>📈 Career Growth</Text>
      <Text style={styles.featureText}>
            Access premium features, personalized job recommendations, and career resources to accelerate your professional journey.
          </Text>
  </View>

     <Text style={styles.sectionTitle}>Why Choose Refopen?</Text>
    
        <View style={styles.valueCard}>
          <Text style={styles.valueTitle}>✓ Authentic Connections</Text>
          <Text style={styles.valueText}>
      Every employee and recruiter on our platform is verified, ensuring genuine referrals and legitimate opportunities.
       </Text>
        </View>

        <View style={styles.valueCard}>
   <Text style={styles.valueTitle}>✓ Transparent Process</Text>
 <Text style={styles.valueText}>
            Clear pricing, honest service delivery, and no hidden charges. You know exactly what you're paying for.
     </Text>
</View>

        <View style={styles.valueCard}>
          <Text style={styles.valueTitle}>✓ Secure & Private</Text>
          <Text style={styles.valueText}>
   Your data is protected with industry-standard security. We never share your information without consent.
          </Text>
        </View>

        <View style={styles.valueCard}>
          <Text style={styles.valueTitle}>✓ Fair Opportunity</Text>
          <Text style={styles.valueText}>
     We believe everyone deserves a fair shot at their dream job, regardless of their existing network or connections.
       </Text>
        </View>

    <View style={styles.valueCard}>
          <Text style={styles.valueTitle}>✓ User-First Approach</Text>
<Text style={styles.valueText}>
            Our platform is designed with you in mind - intuitive, responsive customer support, and continuous improvements based on feedback.
          </Text>
        </View>

   <Text style={styles.sectionTitle}>Our Values</Text>
    <Text style={styles.text}>
    <Text style={styles.bold}>Integrity:</Text> We operate with honesty and transparency in all our dealings.
          {'\n\n'}<Text style={styles.bold}>Inclusivity:</Text> We believe in equal opportunities for all job seekers, regardless of background.
     {'\n\n'}<Text style={styles.bold}>Innovation:</Text> We continuously evolve our platform to meet the changing needs of the job market.
  {'\n\n'}<Text style={styles.bold}>Community:</Text> We foster a supportive community where professionals help each other grow.
          {'\n\n'}<Text style={styles.bold}>Excellence:</Text> We strive for the highest quality in service delivery and user experience.
    </Text>

        <Text style={styles.sectionTitle}>Who We Serve</Text>
        
        <View style={styles.audienceCard}>
    <Text style={styles.audienceTitle}>Job Seekers</Text>
      <Text style={styles.audienceText}>
      Whether you're a fresh graduate, experienced professional, or career changer, Refopen helps you access opportunities through valuable referrals and direct recruiter connections.
          </Text>
 </View>

        <View style={styles.audienceCard}>
        <Text style={styles.audienceTitle}>Employees</Text>
          <Text style={styles.audienceText}>
      Help talented candidates while earning through our referral rewards program. Make a positive impact by connecting job seekers with opportunities at your company.
    </Text>
    </View>

        <View style={styles.audienceCard}>
<Text style={styles.audienceTitle}>Employers & Recruiters</Text>
       <Text style={styles.audienceText}>
            Access a pool of pre-vetted, motivated candidates. Post jobs, receive quality applications, and hire faster through our efficient platform.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Our Impact</Text>
        <View style={styles.statsBox}>
    <View style={styles.statItem}>
        <Text style={styles.statNumber}>10,000+</Text>
       <Text style={styles.statLabel}>Active Users</Text>
     </View>
          <View style={styles.statItem}>
      <Text style={styles.statNumber}>500+</Text>
     <Text style={styles.statLabel}>Partner Companies</Text>
       </View>
      <View style={styles.statItem}>
          <Text style={styles.statNumber}>5,000+</Text>
       <Text style={styles.statLabel}>Successful Referrals</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>98%</Text>
            <Text style={styles.statLabel}>User Satisfaction</Text>
          </View>
        </View>

   <Text style={styles.sectionTitle}>Our Technology</Text>
   <Text style={styles.text}>
          Refopen is built on cutting-edge technology:
      {'\n\n'}• Robust cloud infrastructure powered by Microsoft Azure
     {'\n'}• Mobile-first design for seamless experience across devices
     {'\n'}• Advanced matching algorithms to connect the right people
      {'\n'}• Secure payment processing with trusted payment gateways
      {'\n'}• Real-time notifications and updates
     {'\n'}• Data encryption and privacy protection
        </Text>

<Text style={styles.sectionTitle}>Our Commitment</Text>
        <Text style={styles.text}>
  We are committed to:
   {'\n\n'}• Maintaining a safe, respectful, and professional platform
          {'\n'}• Protecting your privacy and personal information
  {'\n'}• Providing excellent customer support
       {'\n'}• Continuously improving based on user feedback
          {'\n'}• Operating ethically and transparently
       {'\n'}• Supporting career growth for all our users
    {'\n'}• Building a sustainable and scalable business
   </Text>

        <Text style={styles.sectionTitle}>Looking Ahead</Text>
 <Text style={styles.text}>
   As we grow, we're expanding our services to include:
          {'\n\n'}• AI-powered job matching and recommendations
{'\n'}• Career counseling and mentorship programs
     {'\n'}• Skill development resources and courses
          {'\n'}• Salary negotiation support
 {'\n'}• Interview preparation tools
          {'\n'}• Extended geographic reach across India and beyond
      </Text>

   <Text style={styles.sectionTitle}>Meet the Team</Text>
        <Text style={styles.text}>
  Refopen is powered by a passionate team of technologists, HR professionals, and career experts dedicated to transforming the job search experience. Our diverse team brings expertise in software development, recruitment, user experience, and customer success.
</Text>

   <Text style={styles.sectionTitle}>Join Our Community</Text>
    <Text style={styles.text}>
   Whether you're looking for your next opportunity, wanting to help others succeed, or seeking quality talent for your organization, Refopen is your partner in career growth.
          {'\n\n'}Download our app, create your profile, and start connecting with opportunities today.
        </Text>

        <Text style={styles.sectionTitle}>Company Information</Text>
        <View style={styles.infoBox}>
<Text style={styles.text}>
       <Text style={styles.bold}>Legal Name:</Text> Refopen Technologies Pvt. Ltd.
          {'\n'}<Text style={styles.bold}>Headquarters:</Text> Bangalore, Karnataka, India
     {'\n'}<Text style={styles.bold}>Founded:</Text> 2024
        {'\n'}<Text style={styles.bold}>Industry:</Text> Career Networking & Job Referral Platform
          {'\n'}<Text style={styles.bold}>Website:</Text> www.refopen.com
       {'\n'}<Text style={styles.bold}>Email:</Text> hello@refopen.com
    </Text>
   </View>

  <View style={styles.acknowledgment}>
          <Text style={styles.acknowledgmentText}>
 Thank you for choosing Refopen. Together, let's build careers and create opportunities.
   </Text>
 </View>

<ComplianceFooter currentPage="about" />
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
  tagline: {
 fontSize: 18,
  color: colors.gray600,
    fontStyle: 'italic',
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
  text: {
    fontSize: 15,
    color: colors.gray700,
    lineHeight: 22,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '600',
    color: colors.gray900,
  },
  highlightBox: {
    backgroundColor: colors.primary + '15',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    marginBottom: 12,
  },
  highlightText: {
    fontSize: 16,
    color: colors.gray900,
    lineHeight: 24,
    fontWeight: '500',
  },
  featureCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 8,
marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
featureTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.gray900,
  marginBottom: 8,
  },
  featureText: {
    fontSize: 15,
    color: colors.gray700,
    lineHeight: 22,
  },
  valueCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  valueTitle: {
    fontSize: 16,
fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  valueText: {
    fontSize: 15,
    color: colors.gray700,
    lineHeight: 22,
  },
  audienceCard: {
    backgroundColor: colors.gray50,
    padding: 16,
    borderRadius: 8,
marginBottom: 12,
  },
  audienceTitle: {
    fontSize: 17,
    fontWeight: '600',
 color: colors.primary,
 marginBottom: 8,
  },
  audienceText: {
  fontSize: 15,
    color: colors.gray700,
    lineHeight: 22,
  },
  statsBox: {
 flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    backgroundColor: colors.gray50,
  padding: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  statItem: {
alignItems: 'center',
  width: '45%',
    marginBottom: 16,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: colors.gray600,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: colors.gray50,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
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
