import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * TermsContent — Pure legal text, no navigation/screen wrapper.
 * Used by both TermsScreen and TermsConsentModal.
 *
 * @param {object} [styleOverrides] - optional style overrides for compact/modal use
 */
export default function TermsContent({ compact = false }) {
  const { colors } = useTheme();
  const s = compact ? compactStyles(colors) : defaultStyles(colors);

  return (
    <View>
      <Text style={s.title}>Terms and Conditions</Text>
      <Text style={s.lastUpdated}>Version 1.1 — Last Updated: 12 February 2026</Text>

      <Text style={s.intro}>
        Welcome to Refopen. These Terms and Conditions ("Terms") govern your access to and use of the Refopen platform operated by Refopen Solutions, a sole proprietorship based in Bangalore, Karnataka, India ("Refopen", "we", "us", or "our").
      </Text>

      <Text style={s.sectionTitle}>1. Acceptance of Terms</Text>
      <Text style={s.text}>
        By accessing or using the Refopen platform, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our services.
      </Text>

      <Text style={s.sectionTitle}>2. Services Provided</Text>
      <Text style={s.text}>
        Refopen is a career networking platform that provides:
        {'\n'}• Job referral services connecting job seekers with employees of organizations
        {'\n'}• Direct connections with recruiters
        {'\n'}• Job search and application services
        {'\n'}• Subscription-based premium features
        {'\n'}• Wallet services for in-platform transactions
      </Text>

      <Text style={s.sectionTitle}>3. Eligibility</Text>
      <Text style={s.text}>
        You must be at least 18 years of age to use our services. By using the platform, you represent and warrant that you meet this age requirement and have the legal capacity to enter into these Terms.
      </Text>

      <Text style={s.sectionTitle}>4. User Accounts</Text>
      <Text style={s.text}>
        4.1. Registration: You must create an account to access certain features. You agree to provide accurate, current, and complete information during registration.
        {'\n\n'}4.2. Account Security: You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
        {'\n\n'}4.3. Account Types: We offer separate account types for job seekers and employers, each with distinct features and obligations.
      </Text>

      <Text style={s.sectionTitle}>5. User Conduct</Text>
      <Text style={s.text}>
        You agree not to:
        {'\n'}• Provide false, misleading, or fraudulent information
        {'\n'}• Impersonate any person or entity
        {'\n'}• Upload malicious code or viruses
        {'\n'}• Scrape or harvest data from the platform
        {'\n'}• Interfere with the proper functioning of the platform
        {'\n'}• Use the platform for any illegal or unauthorized purpose
        {'\n'}• Harass, abuse, or harm other users
      </Text>

      <Text style={s.sectionTitle}>6. Premium Services</Text>
      <Text style={s.text}>
        6.1. Paid Features: We offer premium features such as AI-powered job recommendations, profile views, and other services. Fees for these features are displayed on the platform before purchase and are deducted from your wallet balance.
        {'\n\n'}6.2. Time-Limited Access: Certain premium features provide access for a fixed duration (e.g., 15 days). Access expires automatically at the end of the period without auto-renewal unless you choose to purchase again.
        {'\n\n'}6.3. Price Changes: We reserve the right to modify fees for premium features. Updated prices will be displayed on the platform before purchase.
      </Text>

      <Text style={s.sectionTitle}>7. Wallet Services</Text>
      <Text style={s.text}>
        7.1. Wallet Credits: Users can add money to their Refopen wallet for platform transactions via UPI, net banking, or other supported methods.
        {'\n\n'}7.2. Usage: Wallet credits can be used for referral request fees, premium features, and other platform services.
        7.3. Non-Refundable: Wallet credits added via recharge (UPI, net banking, etc.) are generally non-refundable and non-withdrawable. They can only be used for platform services. Exceptions are detailed in Section 9 (Refund and Cancellation Policy) of these Terms.
        {'\n\n'}7.4. Holds: When you submit a referral request, the fee amount is placed on hold in your wallet. The hold is only converted to a charge upon successful referral. See Section 8 for details.
        {'\n\n'}7.5. Validity: Wallet credits do not expire unless your account is terminated for violation of these Terms.
        {'\n\n'}7.6. Withdrawable vs Non-Withdrawable Balance: Your wallet may contain both withdrawable and non-withdrawable funds. Only earnings from verified referrals ("Referral Earnings") are withdrawable as real money. All other credits — including welcome bonuses, signup bonuses, social share rewards, recharge amounts, and promotional credits — are non-withdrawable and can only be used for platform services. See Section 7A for withdrawal details.
      </Text>

      <Text style={s.sectionTitle}>7A. Wallet Withdrawals</Text>
      <Text style={s.text}>
        7A.1. Eligibility: Only "Referral Earnings" — i.e., rewards earned by providing verified referrals to job seekers — are eligible for withdrawal as real money. No other wallet credits (including recharged amounts, welcome bonuses, signup bonuses, social share rewards, promotional credits, or converted referral points) can be withdrawn.
        {'\n\n'}7A.2. Minimum Withdrawal: The minimum withdrawal amount is ₹10. You may only withdraw up to the total of your available Referral Earnings minus any amounts previously withdrawn.
        {'\n\n'}7A.3. Withdrawal Methods: Withdrawals can be requested via UPI ID or bank transfer (requiring account number, IFSC code, and account holder name). You are solely responsible for providing accurate payment details.
        {'\n\n'}7A.4. Processing: Withdrawal requests are reviewed and processed within 2–3 business days. We reserve the right to verify your identity and payment details before processing any withdrawal.
        {'\n\n'}7A.5. Deduction on Request: When you submit a withdrawal request, the requested amount is immediately deducted from your wallet balance and held pending approval.
        {'\n\n'}7A.6. Approval and Rejection: If your withdrawal is approved, the amount is transferred to your specified UPI or bank account. If rejected (e.g., due to incorrect payment details, suspected fraud, or policy violation), the full amount is refunded back to your wallet balance.
        {'\n\n'}7A.7. No Fees: Refopen currently does not charge any fees for withdrawals. We reserve the right to introduce withdrawal fees in the future, which will be clearly communicated before taking effect.
        {'\n\n'}7A.8. Tax Obligations: Withdrawal of referral earnings may attract tax obligations under Indian law. See Section 14 for details on tax responsibilities, TDS, and PAN requirements.
      </Text>

      <Text style={s.sectionTitle}>8. Referral Services</Text>
      <Text style={s.text}>
        8.1. Referral Requests: Job seekers can request referrals from employees of target organizations. The fee per referral request is displayed on the platform before submission.
        {'\n\n'}8.2. Hold-Based Payment: When you submit a referral request, the fee (e.g., ₹49–₹99 depending on request type) is placed on hold in your wallet — it is NOT immediately deducted. The hold is converted to a charge only when a verified employee successfully provides you a referral. If no one refers you within 14 days, the hold is automatically released back to your wallet at no cost.
        {'\n\n'}8.3. Cancellation: You may cancel a pending referral request at any time before a referral is provided. Upon cancellation, the held amount is released back to your wallet.
        8.4. Referrer Rewards: Employees who provide verified referrals earn monetary rewards credited to their wallet as "Referral Earnings". Reward amounts vary based on response time and platform settings, and are credited upon successful verification by the job seeker. Referral Earnings are the only wallet funds eligible for withdrawal as real money (see Section 7A).
        {'\n\n'}8.5. No Guarantee: Submitting a referral request does not guarantee that a referral will be provided, or that any referral will result in an interview or job offer. Refopen acts solely as a platform connecting job seekers and referrers.
        {'\n\n'}8.6. Referrer Responsibilities: Employees providing referrals must ensure they have the authority to do so within their organization. Refopen is not liable for any consequences arising from a referrer's actions within their company.
      </Text>

      <Text style={s.sectionTitle}>9. Refund and Cancellation Policy</Text>
      <Text style={s.text}>
        9.1. Referral Request Holds: If no referral is provided within 14 days, the held amount is automatically released to your wallet in full. No action is required from your side.
        {'\n\n'}9.2. Cancelled Requests: If you cancel a pending referral request before a referral is provided, the held amount is released back to your wallet.
        {'\n\n'}9.3. Successful Referrals: Once a referral has been successfully provided and verified, the fee is non-refundable as the service has been delivered.
        {'\n\n'}9.4. Wallet Recharges: Amounts added to your wallet via UPI, net banking, or other payment methods are generally non-refundable. In exceptional circumstances (e.g., duplicate payments, technical errors), you may request a refund by contacting us through the in-app Help & Support feature within 7 days of the transaction.
        {'\n\n'}9.5. Premium Feature Purchases: Fees for premium features (e.g., AI job recommendations, profile views) are non-refundable once activated, as the service begins immediately upon purchase.
        {'\n\n'}9.6. Refund Processing: Approved refunds will be processed within 5–7 business days and credited back to the original payment method or your Refopen wallet, at our discretion.
        {'\n\n'}9.7. How to Request: To request a refund or raise a dispute, use the Help & Support feature within the Refopen app.
      </Text>

      <Text style={s.sectionTitle}>10. Job Postings</Text>
      <Text style={s.text}>
        10.1. Employer Obligations: Employers posting jobs must ensure all information is accurate and comply with applicable employment laws.
        {'\n\n'}10.2. Content Rights: Employers retain ownership of job posting content but grant Refopen a license to display and promote such content.
        {'\n\n'}10.3. Prohibited Content: Job postings must not contain discriminatory, misleading, or illegal content.
      </Text>

      <Text style={s.sectionTitle}>11. Payment Terms</Text>
      <Text style={s.text}>
        11.1. Payment Processing: We use Razorpay as our primary third-party payment processor. All payment transactions are subject to Razorpay's terms of service.
        {'\n\n'}11.2. Payment Methods: We accept UPI, net banking, credit/debit cards, and other methods as displayed on the platform.
        {'\n\n'}11.3. Currency: All prices are in Indian Rupees (INR).
        {'\n\n'}11.4. Taxes: All prices displayed on the platform are inclusive of applicable taxes. If we are required to collect GST or other taxes in the future, the applicable amounts will be clearly displayed before you confirm any transaction.
      </Text>

      <Text style={s.sectionTitle}>12. Intellectual Property</Text>
      <Text style={s.text}>
        12.1. Platform Rights: All content, features, and functionality of the Refopen platform are owned by Refopen Solutions and protected by intellectual property laws.
        {'\n\n'}12.2. User Content: You retain ownership of content you submit but grant us a worldwide, non-exclusive license to use, display, and distribute such content on the platform.
        {'\n\n'}12.3. Trademarks: "Refopen" and associated logos are trademarks of Refopen Solutions.
      </Text>

      <Text style={s.sectionTitle}>13. Data Privacy</Text>
      <Text style={s.text}>
        Your use of the platform is subject to our Privacy Policy, which describes how we collect, use, and protect your personal information in accordance with the Digital Personal Data Protection Act, 2023 (DPDPA) and other applicable laws. Please review our Privacy Policy carefully.
      </Text>

      <Text style={s.sectionTitle}>14. Referrer Earnings and Tax Obligations</Text>
      <Text style={s.text}>
        14.1. Tax Responsibility: Any rewards, credits, or money earned by referrers through the Refopen platform may constitute taxable income under applicable Indian tax laws. It is the sole responsibility of the referrer to report and pay any taxes due on their earnings.
        {'\n\n'}14.2. No Tax Advice: Refopen does not provide tax advice. We recommend consulting a qualified tax professional regarding your obligations.
        {'\n\n'}14.3. TDS: If required by law, Refopen may deduct Tax Deducted at Source (TDS) on referrer payouts. Any TDS deducted will be reflected in your transaction history.
        {'\n\n'}14.4. PAN Requirement: We may require your Permanent Account Number (PAN) for payouts above thresholds prescribed by Indian tax law.
      </Text>

      <Text style={s.sectionTitle}>15. Disclaimers</Text>
      <Text style={s.text}>
        15.1. No Employment Guarantee: Refopen does not guarantee job placements, interviews, or employment outcomes.
        {'\n\n'}15.2. Third-Party Content: We are not responsible for the accuracy or reliability of information provided by users or third parties.
        {'\n\n'}15.3. Platform Availability: We do not guarantee uninterrupted or error-free service.
        {'\n\n'}15.4. AS-IS BASIS: The platform is provided "as is" and "as available" without warranties of any kind, whether express or implied.
      </Text>

      <Text style={s.sectionTitle}>16. Limitation of Liability</Text>
      <Text style={s.text}>
        To the maximum extent permitted by law, Refopen Solutions shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform. Our total liability shall not exceed the amount you paid to us in the twelve months preceding the claim.
      </Text>

      <Text style={s.sectionTitle}>17. Indemnification</Text>
      <Text style={s.text}>
        You agree to indemnify and hold harmless Refopen Solutions, its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the platform or violation of these Terms.
      </Text>

      <Text style={s.sectionTitle}>18. Termination</Text>
      <Text style={s.text}>
        18.1. By You: You may terminate your account at any time through account settings or by contacting support via the in-app Help & Support feature.
        {'\n\n'}18.2. By Us: We may suspend or terminate your account immediately if you violate these Terms or engage in fraudulent activity.
        {'\n\n'}18.3. Effect of Termination: Upon termination, your right to use the platform ceases immediately. Any pending referral holds will be released. Withdrawable wallet earnings can be withdrawn before account closure. Non-withdrawable bonus credits will be forfeited.
      </Text>

      <Text style={s.sectionTitle}>19. Dispute Resolution</Text>
      <Text style={s.text}>
        19.1. Governing Law: These Terms are governed by and construed in accordance with the laws of India.
        {'\n\n'}19.2. Jurisdiction: Any disputes shall be subject to the exclusive jurisdiction of courts in Bangalore, Karnataka, India.
        {'\n\n'}19.3. Arbitration: Before approaching courts, parties are encouraged to resolve disputes through arbitration in accordance with the Arbitration and Conciliation Act, 1996, with the seat of arbitration in Bangalore, Karnataka.
      </Text>

      <Text style={s.sectionTitle}>20. Grievance Redressal</Text>
      <Text style={s.text}>
        In accordance with the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020, if you have any grievances regarding the platform, you may contact our Grievance Officer:
        {'\n\n'}Designation: Grievance Officer, Refopen Solutions
        {'\n'}Contact: Via the Help & Support feature in the Refopen app
        {'\n'}Response Time: We will acknowledge your grievance within 48 hours and endeavour to resolve it within 30 days from the date of receipt.
      </Text>

      <Text style={s.sectionTitle}>21. Changes to Terms</Text>
      <Text style={s.text}>
        We reserve the right to modify these Terms at any time. We will notify you of material changes via email or in-app notification at least 15 days before they take effect. If the changes are significant, we may require you to re-accept the updated Terms. Your continued use of the platform after the effective date constitutes acceptance of the modified Terms.
      </Text>

      <Text style={s.sectionTitle}>22. Contact Information</Text>
      <Text style={s.text}>
        For questions about these Terms, please contact us through:
        {'\n\n'}Refopen Solutions
        {'\n'}Bangalore, Karnataka, India
        {'\n'}Support: Use the Help & Support feature within the Refopen app
        {'\n'}Website: www.refopen.com
      </Text>

      <Text style={s.sectionTitle}>23. Miscellaneous</Text>
      <Text style={s.text}>
        23.1. Entire Agreement: These Terms, together with our Privacy Policy and any other policies referenced herein, constitute the entire agreement between you and Refopen regarding use of the platform.
        {'\n\n'}23.2. Severability: If any provision is found unenforceable, the remaining provisions continue in effect.
        {'\n\n'}23.3. Waiver: Our failure to enforce any right or provision does not constitute a waiver of such right or provision.
        {'\n\n'}23.4. Assignment: You may not assign these Terms without our consent. We may assign our rights without restriction.
      </Text>

      {!compact && (
        <View style={s.acknowledgment}>
          <Text style={s.acknowledgmentText}>
            By using Refopen, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
          </Text>
        </View>
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
    text: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, marginBottom: 8 },
  });
