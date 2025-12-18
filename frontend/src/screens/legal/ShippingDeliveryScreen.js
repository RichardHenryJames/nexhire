import React, { useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import ComplianceFooter from '../../components/ComplianceFooter';

export default function ShippingDeliveryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Shipping and Delivery Policy</Text>
      <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>

        <Text style={styles.intro}>
          Refopen Solutions ("Refopen") provides digital services exclusively. This policy explains how our digital products and services are delivered to users.
        </Text>

        <Text style={styles.sectionTitle}>1. Nature of Services</Text>
      <Text style={styles.text}>
          Refopen is a career networking and job referral platform providing 100% digital services. We do not sell or ship physical products. All our services are delivered electronically through:
        {'\n\n'}• Web application (www.refopen.com)
     {'\n'}• Mobile application (iOS and Android)
    {'\n'}• Email notifications
          {'\n'}• In-app messaging and notifications
        </Text>

  <Text style={styles.sectionTitle}>2. Digital Service Delivery</Text>
      
   <Text style={styles.subsectionTitle}>2.1. Account Activation</Text>
        <Text style={styles.text}>
          • Account access is provided immediately upon successful registration
     {'\n'}• Verification emails are sent within minutes of registration
    {'\n'}• Account activation typically takes less than 5 minutes
   {'\n'}• No physical delivery or shipping address required
        </Text>

        <Text style={styles.subsectionTitle}>2.2. Subscription Activation</Text>
        <Text style={styles.text}>
          • Premium features are activated instantly upon successful payment
  {'\n'}• Subscription benefits are available immediately after transaction confirmation
          {'\n'}• Confirmation email sent within 5 minutes of purchase
          {'\n'}• Access to premium features reflected in your account dashboard instantly
        </Text>

   <Text style={styles.subsectionTitle}>2.3. Wallet Credits</Text>
        <Text style={styles.text}>
    • Wallet recharges are processed in real-time
    {'\n'}• Credits reflect in your account within seconds of successful payment
          {'\n'}• Transaction history updated immediately
    {'\n'}• Instant confirmation via email and in-app notification
        </Text>

        <Text style={styles.subsectionTitle}>2.4. Referral Services</Text>
        <Text style={styles.text}>
          • Referral requests are delivered to referrers immediately upon submission
   {'\n'}• Notification sent to referrer within minutes
    {'\n'}• Status updates provided in real-time through the platform
          {'\n'}• Email notifications for all referral status changes
        </Text>

        <Text style={styles.sectionTitle}>3. Delivery Timelines</Text>
        
        <Text style={styles.subsectionTitle}>3.1. Immediate Delivery Services</Text>
        <Text style={styles.text}>
          The following are delivered instantly (within seconds to 5 minutes):
  {'\n\n'}• Account registration and access
        {'\n'}• Subscription activation
          {'\n'}• Wallet credit addition
          {'\n'}• Premium feature unlocking
          {'\n'}• Profile updates and changes
          {'\n'}• Job application submissions
  </Text>

        <Text style={styles.subsectionTitle}>3.2. Service-Dependent Delivery</Text>
   <Text style={styles.text}>
          Some services depend on actions by other users or manual review:
        {'\n\n'}• Referral Responses: 24-72 hours (depends on referrer availability)
  {'\n'}• Job Applications: Processed by employers at their discretion
          {'\n'}• Profile Verification: 24-48 hours for manual verification if required
       {'\n'}• Support Responses: 24-48 hours on business days
      </Text>

 <Text style={styles.sectionTitle}>4. Delivery Confirmation</Text>
  <Text style={styles.text}>
          You will receive confirmation of service delivery through:
          {'\n\n'}• Email notification to your registered email address
          {'\n'}• In-app notification on mobile and web
          {'\n'}• SMS alerts for critical transactions (optional)
          {'\n'}• Transaction history in your account dashboard
    {'\n'}• Payment receipt via email
  </Text>

        <Text style={styles.sectionTitle}>5. Delivery Channels</Text>
        
        <Text style={styles.subsectionTitle}>5.1. Platform Access</Text>
        <Text style={styles.text}>
          Services are accessible 24/7 through:
      {'\n\n'}• Web Browser: www.refopen.com (desktop and mobile web)
  {'\n'}• iOS App: Available on Apple App Store
     {'\n'}• Android App: Available on Google Play Store
        {'\n'}• Progressive Web App: Installable from browser
        </Text>

        <Text style={styles.subsectionTitle}>5.2. System Requirements</Text>
      <Text style={styles.text}>
          To access our services, you need:
          {'\n\n'}• Stable internet connection (minimum 2G, recommended 4G/WiFi)
          {'\n'}• Modern web browser (Chrome, Safari, Firefox, Edge - latest 2 versions)
          {'\n'}• Mobile OS: iOS 12+ or Android 8.0+
      {'\n'}• Valid email address for notifications
{'\n'}• Phone number for verification (optional but recommended)
    </Text>

  <Text style={styles.sectionTitle}>6. Delivery Failures and Resolution</Text>
        
        <Text style={styles.subsectionTitle}>6.1. Common Issues</Text>
        <Text style={styles.text}>
          Delivery may be delayed due to:
  {'\n\n'}• Payment gateway processing delays
          {'\n'}• Internet connectivity issues
          {'\n'}• Email filtering or spam folders
          {'\n'}• Incorrect email address provided
{'\n'}• Server maintenance or technical issues
        </Text>

        <Text style={styles.subsectionTitle}>6.2. Resolution Steps</Text>
        <Text style={styles.text}>
          If you don't receive service access after payment:
 {'\n\n'}1. Wait 15-30 minutes for payment gateway processing
      {'\n'}2. Check your spam/junk folder for confirmation emails
  {'\n'}3. Refresh your account page or log out and log back in
    {'\n'}4. Verify payment deduction from your bank account
          {'\n'}5. Contact support with transaction details if issue persists
        </Text>

        <Text style={styles.subsectionTitle}>6.3. Support Assistance</Text>
        <Text style={styles.text}>
          For delivery-related issues, contact:
          {'\n\n'}• Email: support@refopen.com
        {'\n'}• Include: Transaction ID, registered email, service purchased
          {'\n'}• Response time: 24-48 hours on business days
          {'\n'}• Urgent issues: Marked as "High Priority" in subject line
        </Text>

        <Text style={styles.sectionTitle}>7. No Physical Shipping</Text>
      <Text style={styles.text}>
          Important Notice:
     {'\n\n'}• Refopen does NOT ship any physical products
          {'\n'}• No physical goods, merchandise, or documents are sent
          {'\n'}• We do not require shipping addresses for service delivery
 {'\n'}• All services are digital and accessed online
   {'\n'}• No shipping fees or delivery charges apply
          {'\n'}• No customs, import duties, or physical delivery logistics
        </Text>

        <Text style={styles.sectionTitle}>8. Service Availability</Text>
    <Text style={styles.text}>
        • Platform available 24/7 with 99.5% uptime target
          {'\n'}• Scheduled maintenance announced 48 hours in advance
  {'\n'}• Emergency maintenance may occur with minimal notice
          {'\n'}• Mobile apps remain functional offline with limited features
          {'\n'}• Data syncs automatically when connection restored
        </Text>

        <Text style={styles.sectionTitle}>9. Document Downloads</Text>
        <Text style={styles.text}>
   While our services are digital, you can download:
          {'\n\n'}• Transaction receipts and invoices (PDF format)
      {'\n'}• Your uploaded resumes and documents
          {'\n'}• Subscription confirmation and renewal receipts
          {'\n'}• Tax invoices with GST details
          {'\n\n'}These are available instantly in your account's "Documents" or "Transactions" section.
     </Text>

        <Text style={styles.sectionTitle}>10. Email Delivery</Text>
     
        <Text style={styles.subsectionTitle}>10.1. Notification Emails</Text>
        <Text style={styles.text}>
          We send various emails for service delivery:
          {'\n\n'}• Registration confirmation
          {'\n'}• Payment receipts
        {'\n'}• Subscription reminders
      {'\n'}• Referral status updates
       {'\n'}• Security alerts
    </Text>

        <Text style={styles.subsectionTitle}>10.2. Email Issues</Text>
        <Text style={styles.text}>
 If you're not receiving emails:
    {'\n\n'}• Check spam/junk/promotions folders
          {'\n'}• Add notifications@refopen.com to contacts
  {'\n'}• Whitelist @refopen.com domain
          {'\n'}• Verify email address in account settings
          {'\n'}• Update email preferences in account settings
        </Text>

<Text style={styles.sectionTitle}>11. Service Accessibility</Text>
        <Text style={styles.text}>
      We ensure our services are accessible:
          {'\n\n'}• Mobile-responsive design for all devices
          {'\n'}• Cross-platform compatibility
      {'\n'}• Multiple language support (where available)
          {'\n'}• Accessibility features for users with disabilities
   {'\n'}• Low-bandwidth mode for slower connections
        </Text>

        <Text style={styles.sectionTitle}>12. Geographic Availability</Text>
    <Text style={styles.text}>
          • Services available globally where internet access exists
{'\n'}• Primary focus on Indian market
          {'\n'}• Payment methods may vary by region
  {'\n'}• Some features may be region-specific
          {'\n'}• Compliance with local laws in operating regions
        </Text>

   <Text style={styles.sectionTitle}>13. Data Security During Delivery</Text>
        <Text style={styles.text}>
          All digital services are delivered securely:
          {'\n\n'}• SSL/TLS encryption for all data transmission
     {'\n'}• Secure authentication and authorization
     {'\n'}• Payment data handled by PCI-DSS compliant processors
     {'\n'}• No sensitive data sent via unencrypted channels
     {'\n'}• Regular security audits and monitoring
        </Text>

        <Text style={styles.sectionTitle}>14. Delivery Guarantee</Text>
        <Text style={styles.text}>
          We guarantee:
        {'\n\n'}• Instant activation of paid services upon successful payment
          {'\n'}• Full refund if service is not delivered due to our technical error
{'\n'}• Alternative delivery methods if primary channels fail
  {'\n'}• 24/7 platform access except during scheduled maintenance
  {'\n'}• Reliable notification system for all service updates
        </Text>

    <Text style={styles.sectionTitle}>15. Third-Party Services</Text>
        <Text style={styles.text}>
      Our delivery infrastructure uses:
          {'\n\n'}• Cloud hosting: Microsoft Azure (99.9% uptime SLA)
          {'\n'}• Email delivery: Professional email service providers
      {'\n'}• Payment processing: Razorpay, PhonePe, PayU, Cashfree
          {'\n'}• SMS services: Licensed SMS gateway providers
          {'\n\n'}We are not responsible for delays caused by third-party service disruptions beyond our control.
      </Text>

        <Text style={styles.sectionTitle}>16. Delivery vs. Service Performance</Text>
  <Text style={styles.text}>
    Important Distinction:
 {'\n\n'}• "Delivery" means making the service accessible to you
      {'\n'}• It does NOT guarantee specific outcomes (job offers, referrals, interviews)
          {'\n'}• We deliver the platform features, not employment results
          {'\n'}• Service delivery is instant; results depend on market conditions and user engagement
        </Text>

        <Text style={styles.sectionTitle}>17. Contact for Delivery Issues</Text>
     <Text style={styles.text}>
          For any service delivery concerns:
          {'\n\n'}Refopen Solutions
       {'\n'}Email: support@refopen.com
          {'\n'}Technical Support: tech@refopen.com
          {'\n'}Website: www.refopen.com
       {'\n'}In-App Support: Available through help section
    </Text>

        <View style={styles.acknowledgment}>
          <Text style={styles.acknowledgmentText}>
    As a digital-only platform, Refopen ensures instant and secure delivery of all services. No physical shipping or waiting periods apply.
          </Text>
        </View>

   <ComplianceFooter currentPage="shipping" />
      </View>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  backgroundColor: colors.background,
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
