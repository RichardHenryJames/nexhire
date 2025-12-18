import React, { useState, useMemo, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { typography } from '../../styles/theme';
import ComplianceFooter from '../../components/ComplianceFooter';

const FAQItem = ({ question, answer, colors, styles }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View style={styles.faqCard}>
      <TouchableOpacity 
        style={styles.faqHeader}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
  <Text style={styles.question}>{question}</Text>
        <Ionicons 
          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
       size={24} 
  color={colors.primary} 
        />
      </TouchableOpacity>
      {isExpanded && (
    <View style={styles.answerContainer}>
 <Text style={styles.answer}>{answer}</Text>
     </View>
      )}
    </View>
  );
};

export default function FAQScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState('');

  // ✅ Navigation header with smart back button (hard-refresh safe)
  useEffect(() => {
    navigation.setOptions({
      title: 'FAQ',
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
  
  const faqData = [
    {
      category: 'About Refopen',
      questions: [
        {
          question: 'What is Refopen?',
          answer: 'Refopen is India\'s leading career networking platform that connects job seekers with employees who can provide job referrals and recruiters who are actively hiring. We help you access career opportunities through meaningful professional connections, making the job search process more efficient and effective.'
        },
        {
          question: 'How is Refopen different from other job portals?',
          answer: 'Unlike traditional job portals where you simply apply and wait, Refopen focuses on referrals. When you request a referral for a company, ALL employees from that organization on our platform receive your request. This significantly increases your visibility and chances of getting noticed by hiring managers. Studies show that referred candidates are 4x more likely to get hired.'
        },
        {
          question: 'Is Refopen available as a mobile app?',
          answer: 'Yes! Refopen is available as a Progressive Web App (PWA) that works on all devices - smartphones, tablets, and computers. You can install it directly from your browser for a native app-like experience. We are also working on dedicated iOS and Android apps coming soon.'
        },
        {
          question: 'Who can use Refopen?',
          answer: 'Refopen is for everyone in the professional ecosystem:\n• Job Seekers: Find jobs and request referrals\n• Employees: Help others by providing referrals and earn rewards\n• Recruiters/Employers: Post jobs and find quality candidates through referrals'
        }
      ]
    },
    {
      category: 'Getting Started',
      questions: [
        {
          question: 'How do I create an account?',
          answer: 'Creating an account is simple:\n1. Visit www.refopen.com or open the app\n2. Click "Sign Up"\n3. Choose your account type (Job Seeker or Employer)\n4. Sign up using your email, Google account, or LinkedIn\n5. Complete your profile with work experience, skills, and preferences\n6. Start exploring jobs and requesting referrals!'
        },
        {
          question: 'Is Refopen free to use?',
          answer: 'Yes! Basic features are completely free:\n• Creating and maintaining your profile\n• Browsing all job listings\n• Applying to jobs directly\n• Receiving referral requests (for employees)\n\nPremium features like referral requests, AI-powered job recommendations, and job posting are available on a pay-per-use basis through our wallet system.'
        },
        {
          question: 'How do I complete my profile?',
          answer: 'A complete profile increases your chances of getting referrals:\n1. Add a professional photo\n2. Write a compelling headline and summary\n3. Add your work experience with details\n4. List your skills and certifications\n5. Add your education details\n6. Set your job preferences (role, location, salary)\n7. Upload your resume\n\nProfiles with 100% completion get 3x more referral acceptances!'
        },
        {
          question: 'Can I use Refopen if I am currently employed?',
          answer: 'Absolutely! Many of our users are working professionals looking for better opportunities. Your job search is completely confidential. You can:\n• Hide your current company from searches\n• Set your profile to "Open to Opportunities" discreetly\n• Control who can see your activity\n• Receive referral requests from others at your company'
        }
      ]
    },
    {
      category: 'How Referrals Work',
      questions: [
        {
          question: 'How do I request a referral?',
          answer: 'Requesting a referral is easy:\n1. Find a job you are interested in\n2. Click "Ask for Referral"\n3. Your request is sent to ALL employees of that company on Refopen\n4. Employees review your profile and can choose to refer you\n5. You get notified when someone accepts your request\n6. The employee submits your referral through their company\'s system'
        },
        {
          question: 'Does getting a referral guarantee me a job?',
          answer: 'No, a referral does not guarantee a job offer. However, it significantly improves your chances:\n• Referred candidates are 4x more likely to be hired\n• Your resume gets priority review by recruiters\n• You skip the initial screening in many companies\n• You have an internal advocate for your application\n\nThe final hiring decision always rests with the employer based on your qualifications and interview performance.'
        },
        {
          question: 'What happens if no one accepts my referral request?',
          answer: 'If your referral request is not accepted:\n• You can try again after improving your profile\n• Apply directly to the job (always an option)\n• Request referrals for similar roles at other companies\n• Upgrade to Premium for higher visibility and priority placement\n• Your wallet credits are not deducted for unaccepted requests'
        },
        {
          question: 'How do I provide referrals to others?',
          answer: 'If you are an employee and want to help others:\n1. Enable "Open to Refer" in your profile settings\n2. You will receive notifications when someone requests a referral at your company\n3. Review the candidate\'s profile and resume\n4. Accept or decline the request\n5. If accepted, submit the referral through your company\'s internal system\n6. Earn rewards when your referral gets hired!'
        },
        {
          question: 'Do I get paid for providing referrals?',
          answer: 'Yes! Refopen has a rewards program for referrers:\n• Earn rewards when you accept and submit referrals\n• Additional bonus when your referred candidate gets hired\n• Many companies also offer internal referral bonuses\n• Build your reputation as a helpful connector\n• Rewards are credited to your Refopen wallet'
        },
        {
          question: 'Can I see who requested a referral at my company?',
          answer: 'Yes! When someone requests a referral for your company, you receive:\n• Their full profile including work experience and skills\n• Their resume/CV\n• The specific job they are interested in\n• Their cover message (if any)\n• You can then decide whether to provide the referral based on their qualifications.'
        }
      ]
    },
    {
      category: 'Jobs & Applications',
      questions: [
        {
          question: 'How do I search for jobs?',
          answer: 'Use our powerful search features:\n• Search by job title, company, or keywords\n• Filter by location, experience level, salary range\n• Filter by job type (Full-time, Contract, Remote)\n• Filter by top companies (Fortune 500)\n• Save searches for quick access\n• Enable job alerts to get notified of new matches'
        },
        {
          question: 'Can I apply directly without a referral?',
          answer: 'Yes! While referrals increase your chances, you can always:\n• Apply directly to any job listing\n• Send your application to the employer\n• Track your application status\n• Get notified of updates\n\nWe recommend requesting a referral alongside direct applications for the best results.'
        },
        {
          question: 'How do I track my job applications?',
          answer: 'Go to your Profile → My Applications to see:\n• All jobs you have applied to\n• Current application status\n• Referral request status\n• Interview schedules (if any)\n• Employer responses and messages'
        },
        {
          question: 'What types of jobs are available on Refopen?',
          answer: 'Refopen hosts jobs across all industries and experience levels:\n• Software Engineering, Data Science, AI/ML\n• Product Management, Design, Marketing\n• Finance, HR, Operations\n• Sales, Business Development\n• Entry-level to Senior Executive positions\n• Full-time, Part-time, Contract, Internships\n• On-site, Remote, and Hybrid roles'
        }
      ]
    },
    {
      category: 'Payments & Wallet',
      questions: [
        {
          question: 'What payment methods are accepted?',
          answer: 'We accept all major payment methods in India:\n• Credit Cards (Visa, Mastercard, Rupay)\n• Debit Cards\n• UPI (Google Pay, PhonePe, Paytm, etc.)\n• Net Banking (All major banks)\n• Digital Wallets\n\nAll payments are processed securely through RBI-compliant payment gateways (Razorpay, PhonePe, PayU, Cashfree).'
        },
        {
          question: 'How does the Refopen Wallet work?',
          answer: 'The Refopen Wallet is your in-app payment account:\n• Add money anytime using any payment method\n• Use credits for referral requests, subscriptions, and premium features\n• Track all transactions in wallet history\n• Receive rewards and cashback directly in wallet\n• Credits never expire while your account is active'
        },
        {
          question: 'Are my payments secure?',
          answer: 'Absolutely! We prioritize your security:\n• PCI-DSS compliant payment processing\n• SSL/TLS encryption for all transactions\n• No card details stored on our servers\n• Trusted payment partners (Razorpay, PhonePe)\n• Two-factor authentication available\n• Instant transaction confirmations via email and SMS'
        },
        {
          question: 'Do wallet credits expire?',
          answer: 'No, your wallet credits do not expire as long as your account remains active. You can use them anytime for:\n• Referral request fees\n• Premium subscriptions\n• Featured profile placements\n• Any other paid services'
        },
        {
          question: 'How do I get a refund?',
          answer: 'Refunds are processed as per our Refund Policy:\n• Request within 7 days of transaction\n• Email support@refopen.com with transaction details\n• Refunds for technical failures are automatic\n• Subscription refunds are pro-rated\n• Processing time: 5-7 business days\n\nNote: Referral fees for accepted requests are non-refundable.'
        }
      ]
    },
    {
      category: 'Subscriptions & Premium',
      questions: [
        {
          question: 'What are the premium subscription plans?',
          answer: 'We offer flexible plans:\n\n• Basic (Free): Browse jobs, apply directly, limited referral requests\n• Pro (₹299/month): Unlimited referral requests, priority visibility, advanced filters\n• Premium (₹599/month): All Pro features + featured profile, direct recruiter access, resume review\n\nAnnual plans available with up to 40% discount!'
        },
        {
          question: 'How do I subscribe or upgrade?',
          answer: 'Upgrading is easy:\n1. Go to Profile → Subscription\n2. Choose your preferred plan\n3. Select billing cycle (monthly/annual)\n4. Complete payment\n5. Features activated instantly!\n\nYou can upgrade, downgrade, or cancel anytime.'
        },
        {
          question: 'Can I cancel my subscription?',
          answer: 'Yes, you can cancel anytime:\n• Go to Profile → Subscription → Cancel\n• Access continues until the billing period ends\n• No refunds for partial periods\n• You can resubscribe whenever you want\n• Disable auto-renewal to prevent future charges'
        },
        {
          question: 'What happens when my subscription ends?',
          answer: 'When your subscription ends:\n• You retain access to basic free features\n• Saved preferences and data are preserved\n• You can continue applying to jobs\n• Premium features become unavailable\n• You can renew anytime to restore full access'
        }
      ]
    },
    {
      category: 'For Employers',
      questions: [
        {
          question: 'How do I post a job on Refopen?',
          answer: 'Posting jobs is simple:\n1. Sign up as an Employer\n2. Verify your organization\n3. Go to Dashboard → Post Job\n4. Fill in job details (title, description, requirements)\n5. Set salary range, location, and job type\n6. Preview and publish\n\nYour job is instantly visible to thousands of candidates!'
        },
        {
          question: 'How much does it cost to post jobs?',
          answer: 'We offer flexible pricing for employers:\n• Free Tier: Limited job posts per month\n• Starter: ₹999/job with 30-day visibility\n• Professional: ₹4,999/month for unlimited posts\n• Enterprise: Custom pricing for high-volume hiring\n\nContact partnerships@refopen.com for enterprise solutions.'
        },
        {
          question: 'How do I find candidates?',
          answer: 'Multiple ways to discover talent:\n• Receive applications directly on posted jobs\n• Get referred candidates (higher quality!)\n• Search our candidate database (Premium)\n• Use AI-powered candidate matching\n• Set up talent alerts for specific skills'
        },
        {
          question: 'What makes referred candidates better?',
          answer: 'Referred candidates are pre-vetted:\n• Recommended by your own employees\n• 4x more likely to be hired\n• Better cultural fit\n• Faster time-to-hire\n• Higher retention rates\n• Reduced hiring costs'
        }
      ]
    },
    {
      category: 'Account & Privacy',
      questions: [
        {
          question: 'How do I reset my password?',
          answer: 'To reset your password:\n1. Go to Login page\n2. Click "Forgot Password"\n3. Enter your registered email\n4. Check your inbox for reset link\n5. Click the link and set a new password\n\nIf you don\'t receive the email, check spam folder or contact support.'
        },
        {
          question: 'How do I delete my account?',
          answer: 'To delete your account:\n1. Go to Profile → Settings → Account\n2. Click "Delete Account"\n3. Confirm deletion\n\nNote: This action is permanent. All data will be deleted within 30 days. Unused wallet credits are forfeited. Download any data you need before deletion.'
        },
        {
          question: 'Is my data safe with Refopen?',
          answer: 'Yes, we take privacy seriously:\n• Data encrypted at rest and in transit\n• No selling of personal data to third parties\n• GDPR-compliant data handling\n• You control who sees your profile\n• Option to hide current employer\n• Delete your data anytime\n\nRead our full Privacy Policy for details.'
        },
        {
          question: 'Who can see my profile?',
          answer: 'You control your visibility:\n• Public: All recruiters and employers can view\n• Limited: Only when you apply or request referral\n• Hidden: Profile not searchable, only accessible via direct link\n\nYou can always hide sensitive information like current salary or employer.'
        },
        {
          question: 'How do I update my email or phone number?',
          answer: 'To update contact information:\n1. Go to Profile → Settings → Account\n2. Click on email or phone number\n3. Enter new information\n4. Verify via OTP sent to new email/phone\n5. Update confirmed!\n\nNote: You may need to re-verify your account after changing email.'
        }
      ]
    },
    {
      category: 'Troubleshooting',
      questions: [
        {
          question: 'I am not receiving notifications. What should I do?',
          answer: 'Check these settings:\n1. In-app: Profile → Settings → Notifications (enable all)\n2. Phone settings: Allow notifications for Refopen\n3. Email: Check spam folder, add @refopen.com to contacts\n4. Browser: Allow notifications when prompted\n\nIf issues persist, contact support@refopen.com.'
        },
        {
          question: 'My payment failed but money was deducted. What now?',
          answer: 'Don\'t worry! If payment was deducted:\n1. Wait 30 minutes for automatic processing\n2. Check your wallet for credit\n3. If not credited, email support@refopen.com with:\n   - Transaction ID\n   - Amount deducted\n   - Bank reference number\n4. Refunds processed within 5-7 business days'
        },
        {
          question: 'I cannot login to my account. Help!',
          answer: 'Try these steps:\n1. Reset password using "Forgot Password"\n2. Clear browser cache and cookies\n3. Try a different browser or device\n4. Check if your account was deactivated\n5. If using Google/LinkedIn login, ensure correct account\n\nStill stuck? Email support@refopen.com with your registered email.'
        },
        {
          question: 'The app is not loading properly.',
          answer: 'Try these solutions:\n1. Refresh the page (Ctrl+R or pull down on mobile)\n2. Clear browser cache\n3. Check internet connection\n4. Try incognito/private mode\n5. Update your browser to latest version\n6. Disable ad blockers or VPN temporarily\n\nIf issue persists, report to tech@refopen.com.'
        },
        {
          question: 'How do I report a fake job or scam?',
          answer: 'Your safety is our priority! To report suspicious activity:\n1. Click "Report" on the job listing or profile\n2. Select the reason (fake, scam, inappropriate)\n3. Add details about the issue\n4. Submit report\n\nOr email safety@refopen.com directly. We investigate all reports within 24 hours.'
        }
      ]
    }
  ];

  // Filter FAQs based on search query
  const filteredFaqData = useMemo(() => {
    if (!searchQuery.trim()) return faqData;
    const query = searchQuery.toLowerCase();
    return faqData.map(section => ({
      ...section,
      questions: section.questions.filter(
        q => q.question.toLowerCase().includes(query) || q.answer.toLowerCase().includes(query)
      )
    })).filter(section => section.questions.length > 0);
  }, [searchQuery, faqData]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.content}>
        <Text style={styles.title}>Frequently Asked Questions</Text>
        <Text style={styles.subtitle}>Everything you need to know about Refopen</Text>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search FAQs..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {filteredFaqData.length === 0 ? (
          <View style={styles.noResults}>
            <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.noResultsText}>No FAQs found for "{searchQuery}"</Text>
            <Text style={styles.noResultsSubtext}>Try different keywords or contact support@refopen.com</Text>
          </View>
        ) : null}

        {filteredFaqData.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.categoryTitle}>{section.category}</Text>
            {section.questions.map((faq, faqIndex) => (
              <FAQItem 
                key={faqIndex}
                question={faq.question}
                answer={faq.answer}
                colors={colors}
                styles={styles}
              />
            ))}
          </View>
        ))}

        <View style={styles.stillNeedHelp}>
          <Text style={styles.helpTitle}>Still Have Questions?</Text>
          <Text style={styles.helpText}>
            Our support team is here to help you with anything not covered above.
          </Text>
          <View style={styles.contactOptions}>
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
              <Text style={styles.contactItem}>support@refopen.com</Text>
            </View>
            <View style={styles.contactRow}>
              <Ionicons name="globe-outline" size={18} color={colors.primary} />
              <Text style={styles.contactItem}>www.refopen.com</Text>
            </View>
            <View style={styles.contactRow}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text style={styles.contactItem}>Response: 24-48 hours</Text>
            </View>
            <View style={styles.contactRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.contactItem}>Mon-Sat, 9 AM - 7 PM IST</Text>
            </View>
          </View>
        </View>

        <ComplianceFooter currentPage="faq" />
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: {
    marginBottom: 28,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  faqCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  question: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginRight: 12,
    lineHeight: 22,
  },
  answerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.gray50,
  },
  answer: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    paddingTop: 14,
  },
  stillNeedHelp: {
    backgroundColor: colors.primary + '12',
    padding: 20,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 24,
  },
  helpTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  contactOptions: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactItem: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 10,
  },
});
