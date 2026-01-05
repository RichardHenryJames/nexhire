import React, { useMemo, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
import { typography } from '../../styles/theme';
import ComplianceFooter from '../../components/ComplianceFooter';

export default function RefundPolicyScreen() {
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
 <Text style={styles.title}>Refund and Cancellation Policy</Text>
        <Text style={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>

  <Text style={styles.intro}>
      This Refund and Cancellation Policy outlines the terms under which Refopen Solutions ("Refopen") processes refunds and cancellations for services purchased on our platform.
        </Text>

        <Text style={styles.sectionTitle}>1. General Refund Policy</Text>
        <Text style={styles.text}>
    As Refopen provides digital services that are delivered immediately upon purchase, most transactions are non-refundable. However, we understand that certain circumstances warrant refunds, as outlined in this policy.
  </Text>

        <Text style={styles.sectionTitle}>2. Subscription Plans</Text>
        
        <Text style={styles.subsectionTitle}>2.1. Cancellation of Subscription</Text>
  <Text style={styles.text}>
          • You may cancel your subscription at any time through your account settings
       {'\n'}• Cancellation takes effect at the end of your current billing period
    {'\n'}• You retain access to premium features until the end of the paid period
          {'\n'}• No refunds are provided for partial subscription periods
          {'\n'}• Auto-renewal can be disabled to prevent future charges
     </Text>

        <Text style={styles.subsectionTitle}>2.2. Refunds for Subscription</Text>
    <Text style={styles.text}>
          Refunds for subscription fees may be granted in the following cases:
  {'\n\n'}• Technical Issues: If you experience significant technical problems that prevent you from using the service within 7 days of purchase
          {'\n'}• Duplicate Charges: If you were charged multiple times for the same subscription
  {'\n'}• Unauthorized Charges: If charges were made without your authorization
   {'\n\n'}Refund requests must be submitted within 7 days of the transaction date.
        </Text>

   <Text style={styles.sectionTitle}>3. Referral Services</Text>
     
<Text style={styles.subsectionTitle}>3.1. Referral Request Fees</Text>
      <Text style={styles.text}>
      • Referral request fees are generally non-refundable once the request is sent
          {'\n'}• Payment for a referral request does not guarantee a referral will be provided
          {'\n'}• We do not guarantee job interviews or employment outcomes
 </Text>

        <Text style={styles.subsectionTitle}>3.2. Refund Eligibility for Referral Fees</Text>
        <Text style={styles.text}>
          Refunds may be considered in the following situations:
          {'\n\n'}• Technical Failure: If the referral request was not delivered due to platform error
          {'\n'}• Duplicate Payment: If you were charged multiple times for the same referral request
          {'\n'}• Service Not Rendered: If the referral request was not processed within 48 hours due to platform issues
          {'\n\n'}No refunds will be provided if:
          {'\n'}• The referrer declines your request
          {'\n'}• You do not receive a job interview or offer
        {'\n'}• You change your mind after sending the request
  {'\n'}• The job posting is closed or filled
      </Text>

 <Text style={styles.sectionTitle}>4. Wallet Credits</Text>
        
        <Text style={styles.subsectionTitle}>4.1. Adding Money to Wallet</Text>
    <Text style={styles.text}>
   • Wallet credits are added instantly upon successful payment
          {'\n'}• Credits can be used for referral fees, subscriptions, and other platform services
     {'\n'}• Wallet credits do not expire unless your account is terminated
      </Text>

 <Text style={styles.subsectionTitle}>4.2. Wallet Refunds</Text>
        <Text style={styles.text}>
          • Unused wallet credits are generally non-refundable
          {'\n'}• Refunds to original payment method may be processed in exceptional cases:
          {'\n'}  - Technical error resulting in incorrect wallet credit
          {'\n'}  - Duplicate wallet recharge
     {'\n'}  - Unauthorized wallet transaction
          {'\n\n'}• Refund requests must be made within 7 days of the transaction
    {'\n'}• Wallet credits used for services cannot be refunded
        </Text>

        <Text style={styles.sectionTitle}>5. Promotional Credits and Discounts</Text>
   <Text style={styles.text}>
          • Promotional credits, bonuses, and discounts are non-refundable
          {'\n'}• These credits cannot be converted to cash or withdrawn
  {'\n'}• They expire according to the terms of the specific promotion
          {'\n'}• Promotional credits are forfeited if the account is closed or terminated
        </Text>

        <Text style={styles.sectionTitle}>6. Job Posting Fees (For Employers)</Text>
        <Text style={styles.text}>
          • Job posting fees are non-refundable once the job is published
          {'\n'}• If a job posting fails to publish due to platform error, a full refund or repost will be provided
          {'\n'}• No refunds if the job is filled quickly or receives no applications
      {'\n'}• Refund requests must be made within 48 hours of posting with valid reason
        </Text>

        <Text style={styles.sectionTitle}>7. Refund Request Process</Text>
        
        <Text style={styles.subsectionTitle}>7.1. How to Request a Refund</Text>
        <Text style={styles.text}>
          To request a refund:
          {'\n\n'}1. Email: support@refopen.com
          {'\n'}2. Subject: "Refund Request - [Transaction ID]"
          {'\n'}3. Include:
       {'\n'}   • Your registered email address
          {'\n'}   • Transaction ID and date
          {'\n'}   • Reason for refund request
        {'\n'}   • Supporting documentation (screenshots, error messages)
   {'\n\n'}4. Our team will review your request within 3-5 business days
        </Text>

        <Text style={styles.subsectionTitle}>7.2. Refund Processing Time</Text>
        <Text style={styles.text}>
          Once a refund is approved:
          {'\n\n'}• Wallet Credits: Instant refund to your Refopen wallet
          {'\n'}• UPI/Debit Card/Credit Card: 5-7 business days
          {'\n'}• Net Banking: 5-7 business days
          {'\n'}• Payment Gateway delays: May take up to 10 business days
          {'\n\n'}The timeline depends on your bank or payment provider. Refopen initiates refunds within 3 business days of approval.
        </Text>

        <Text style={styles.sectionTitle}>8. Cancellation Policy</Text>
        
<Text style={styles.subsectionTitle}>8.1. Cancellation by User</Text>
   <Text style={styles.text}>
          • Subscription: Can be cancelled anytime; remains active until period end
          {'\n'}• Referral Request: Cannot be cancelled once sent; no refund
          {'\n'}• Wallet Recharge: Cannot be cancelled after successful transaction
          {'\n'}• Job Application: Can be withdrawn before employer reviews; no fees
        </Text>

        <Text style={styles.subsectionTitle}>8.2. Cancellation by Refopen</Text>
    <Text style={styles.text}>
    We reserve the right to cancel or suspend services if:
          {'\n'}• You violate our Terms and Conditions
      {'\n'}• We detect fraudulent activity
          {'\n'}• Your account is used for illegal purposes
    {'\n'}• Payment is disputed or reversed
{'\n\n'}In case of cancellation due to policy violations, no refunds will be provided.
        </Text>

        <Text style={styles.sectionTitle}>9. Disputed Transactions</Text>
        <Text style={styles.text}>
   If you dispute a transaction with your bank or payment provider:
      {'\n\n'}• Contact us first at support@refopen.com to resolve the issue
{'\n'}• Chargebacks may result in immediate account suspension
          {'\n'}• We will provide transaction records to verify legitimate charges
          {'\n'}• Account access may be restored once the dispute is resolved
    {'\n'}• Fraudulent chargeback claims may result in permanent ban
        </Text>

        <Text style={styles.sectionTitle}>10. Failed Transactions</Text>
        <Text style={styles.text}>
     If payment is deducted but service is not activated:
          {'\n\n'}• Wait 30 minutes for automatic processing
       {'\n'}• Check your email for transaction confirmation
       {'\n'}• If issue persists, contact support@refopen.com with:
          {'\n'}  - Transaction ID
          {'\n'}  - Payment receipt/screenshot
    {'\n'}  - Bank reference number
    {'\n\n'}• Refunds for failed transactions are processed within 5-7 business days
        </Text>

        <Text style={styles.sectionTitle}>11. Partial Refunds</Text>
   <Text style={styles.text}>
    In certain cases, we may offer partial refunds:
     {'\n\n'}• If you used part of a service before requesting cancellation
          {'\n'}• For pro-rated subscription cancellations (at our discretion)
    {'\n'}• When technical issues affected service quality but didn't prevent usage
          {'\n\n'}Partial refund amounts are determined on a case-by-case basis.
        </Text>

        <Text style={styles.sectionTitle}>12. Exceptions and Special Cases</Text>
        <Text style={styles.text}>
          • Force Majeure: No refunds for service disruptions due to events beyond our control
     {'\n'}• Policy Changes: New policies do not apply to existing subscriptions
          {'\n'}• Account Termination: No refunds for services already consumed
          {'\n'}• Legal Compliance: We may process refunds as required by law or court order
     </Text>

  <Text style={styles.sectionTitle}>13. No Refund Situations</Text>
        <Text style={styles.text}>
          Refunds will NOT be provided in the following cases:
    {'\n\n'}• Change of mind after service delivery
        {'\n'}• Dissatisfaction with job search outcomes
          {'\n'}• Not receiving job interviews or offers
     {'\n'}• Referrers declining your request
        {'\n'}• Account suspension due to policy violations
     {'\n'}• Services already consumed or utilized
       {'\n'}• Expiry of promotional credits
          {'\n'}• User error in purchasing wrong service
 </Text>

   <Text style={styles.sectionTitle}>14. GST and Tax Refunds</Text>
 <Text style={styles.text}>
  • Refunds include the proportional GST amount paid
          {'\n'}• Tax invoices will be updated to reflect refunded amounts
          {'\n'}• GST refunds follow the same timeline as the primary refund
  </Text>

   <Text style={styles.sectionTitle}>15. Contact for Refund Queries</Text>
        <Text style={styles.text}>
     For questions about refunds or cancellations:
          {'\n\n'}Refopen Solutions
  {'\n'}Email: support@refopen.com
   {'\n'}Refund Department: refunds@refopen.com
          {'\n'}Phone: Available through app support
          {'\n'}Website: www.refopen.com
          {'\n\n'}Response Time: We aim to respond within 24-48 hours on business days.
  </Text>

  <View style={styles.acknowledgment}>
          <Text style={styles.acknowledgmentText}>
 By making a purchase on Refopen, you acknowledge that you have read and agree to this Refund and Cancellation Policy.
 </Text>
     </View>

    <ComplianceFooter currentPage="refund" />
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
