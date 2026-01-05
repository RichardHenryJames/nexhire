import React, { useState, useMemo, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import useResponsive from '../../hooks/useResponsive';
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
  const responsive = useResponsive();
  const styles = useMemo(() => createStyles(colors, responsive), [colors, responsive]);
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
          answer: 'Unlike traditional job portals where you simply apply and wait, Refopen focuses on referrals. When you request a referral for a company, ALL employees from that organization on our platform receive your request. This significantly increases your visibility and chances of getting noticed by hiring managers. Studies show that referred candidates are 15x more likely to get hired.'
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
          answer: 'Creating an account is simple:\n1. Visit www.refopen.com or open the app\n2. Click "Sign Up"\n3. Sign up using your email or Google account\n4. Complete your profile with work experience, skills, and preferences\n5. Start exploring jobs and requesting referrals!'
        },
        {
          question: 'Is Refopen free to use?',
          answer: 'Yes! Basic features are completely free:\n• Creating and maintaining your profile\n• Browsing all job listings\n• Applying to jobs directly\n• Receiving referral requests (for employees)\n\nReferral requests cost ₹39 per request (paid from wallet credits). New users get ₹50 welcome bonus on signup!\n\nAdd money to wallet via bank transfer or UPI.'
        },
        {
          question: 'How do I complete my profile?',
          answer: 'A complete profile increases your chances of getting referrals:\n1. Add a professional photo\n2. Write a compelling headline and summary\n3. Add your work experience with details\n4. List your skills and certifications\n5. Add your education details\n6. Set your job preferences (role, location, salary)\n7. Upload your resume\n\nProfiles with 100% completion get 3x more referral acceptances!'
        },
        {
          question: 'Can I use Refopen if I am currently employed?',
          answer: 'Absolutely! Many of our users are working professionals looking for better opportunities. Your job search is completely confidential. You can:\n• Toggle \"Hide Current Company\" to keep your employer hidden\n• Set \"Open to Work\" in your profile settings\n• Control your profile visibility (Public/Private)\n• Help others by providing referrals while searching yourself'
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
          answer: 'No, a referral does not guarantee a job offer. However, it significantly improves your chances:\n• Referred candidates are 15x more likely to be hired\n• Your resume gets priority review by recruiters\n• You skip the initial screening in many companies\n• You have an internal advocate for your application\n\nThe final hiring decision always rests with the employer based on your qualifications and interview performance.'
        },
        {
          question: 'What happens if no one accepts my referral request?',
          answer: 'If your referral request is not accepted:\n• Your wallet credits are still deducted (referral fee is non-refundable)\n• You can try again after improving your profile\n• Apply directly to the job (always an option)\n• Request referrals for similar roles at other companies\n• Make sure your resume and profile are complete to increase acceptance chances'
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
          answer: 'Use our powerful search features:\n• Search by job title, company, or keywords\n• Filter by location, experience level, salary range\n• Filter by job type (Full-time, Part-time, Contract)\n• Filter by workplace type (Remote, On-site, Hybrid)\n• Filter by top companies (Fortune 500)\n• Use AI-powered job recommendations for personalized matches'
        },
        {
          question: 'Can I apply directly without a referral?',
          answer: 'Yes! While referrals increase your chances, you can always:\n• Apply directly to any job listing\n• Send your application to the employer\n• Track your application status\n• Get notified of updates\n\nWe recommend requesting a referral alongside direct applications for the best results.'
        },
        {
          question: 'How do I track my job applications?',
          answer: 'Go to the Applications tab to see:\n• All jobs you have applied to\n• Current application status (Applied, In Review, Interview, etc.)\n• Referral request status\n• Filter by status to quickly find specific applications'
        },
        {
          question: 'What is AI Jobs feature?',
          answer: 'AI Jobs uses your profile to find personalized job matches:\n• Analyzes your skills, experience, and preferences\n• Recommends jobs that best match your profile\n• Costs ₹99 for 15 days of access\n• Access from the Home screen → AI Jobs section\n\nThis helps you discover opportunities you might have missed!'
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
          answer: 'We accept the following payment methods:\n• Bank Transfer (NEFT/IMPS/RTGS)\n• UPI Transfer\n\nSimply transfer the amount to our bank account or UPI ID, then submit your payment proof for verification.'
        },
        {
          question: 'How does the Refopen Wallet work?',
          answer: 'The Refopen Wallet is your in-app payment account:\n1. Go to Wallet → Add Money\n2. Note down our bank account details or UPI ID\n3. Transfer the desired amount using your preferred method\n4. Submit payment proof with transaction reference number\n5. Our team verifies and credits your wallet within 24 hours\n6. Use wallet credits for referral requests (₹39 each) and AI Jobs (₹99 for 15 days)\n\nCredits never expire while your account is active.'
        },
        {
          question: 'How do I add money to my wallet?',
          answer: 'Adding money is simple:\n1. Go to Wallet → Add Money\n2. You will see our bank account details and UPI ID\n3. Transfer the amount via Bank Transfer or UPI\n4. Click "Submit Payment Proof"\n5. Enter the amount, transaction reference number, and payment date\n6. Submit the form\n7. Once verified, credits are added to your wallet\n\nProcessing time: Typically within 24 hours (business days).'
        },
        {
          question: 'Are my payments secure?',
          answer: 'Absolutely! We prioritize your security:\n• All transfers go directly to our verified company bank account\n• SSL/TLS encryption for all data transmission\n• Payment verification by our dedicated team\n• Instant confirmation once payment is verified\n• Transaction history available in your wallet'
        },
        {
          question: 'How long does payment verification take?',
          answer: 'Payment verification typically takes:\n• 2-4 hours during business hours (9 AM - 6 PM IST)\n• Up to 24 hours for payments submitted outside business hours\n• Weekend submissions processed on next business day\n\nYou will receive a notification once your payment is verified and wallet is credited.'
        },
        {
          question: 'Do wallet credits expire?',
          answer: 'No, your wallet credits do not expire as long as your account remains active. You can use them anytime for:\n• Referral request fees (₹39 per request)\n• AI-powered job recommendations (₹99 for 15-day access)\n• Future premium features'
        },
        {
          question: 'How do I get a refund?',
          answer: 'Refunds are processed as per our Refund Policy:\n• Email support@refopen.com with transaction details\n• Refunds for technical failures are processed automatically\n• Processing time: 5-7 business days\n\nNote: Referral request fees and AI Jobs access fees are non-refundable once service is used. Wallet recharge amounts can be refunded if unused.'
        },
        {
          question: 'What if my payment verification is rejected?',
          answer: 'If your payment proof is rejected:\n• Check the rejection reason in your submissions history\n• Common reasons: incorrect reference number, amount mismatch, unclear details\n• Resubmit with correct information\n• For issues, contact support@refopen.com with your transaction details\n\nNote: If the transfer was successful but rejected due to wrong details, your money is safe and we will help resolve it.'
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
          answer: 'Job posting is currently free for employers during our launch phase. Contact partnerships@refopen.com for enterprise solutions and bulk posting options.'
        },
        {
          question: 'How do I find candidates?',
          answer: 'Multiple ways to discover talent:\n• Receive applications directly on posted jobs\n• Get referred candidates (higher quality!)\n• View candidate profiles with work history and skills\n• Review resumes attached to applications'
        },
        {
          question: 'What makes referred candidates better?',
          answer: 'Referred candidates are pre-vetted:\n• Recommended by your own employees\n• 15x more likely to be hired\n• Better cultural fit\n• Faster time-to-hire\n• Higher retention rates\n• Reduced hiring costs'
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
          answer: 'To delete your account, please email support@refopen.com with your registered email and request for account deletion.\n\nNote: This action is permanent. All data will be deleted within 30 days as per our data retention policy. Unused wallet credits are forfeited.'
        },
        {
          question: 'Is my data safe with Refopen?',
          answer: 'Yes, we take privacy seriously:\n• Data encrypted at rest and in transit\n• No selling of personal data to third parties\n• GDPR-compliant data handling\n• You control who sees your profile\n• Option to hide current employer\n• Delete your data anytime\n\nRead our full Privacy Policy for details.'
        },
        {
          question: 'Who can see my profile?',
          answer: 'You control your visibility:\n• Public: Your profile is visible to recruiters and employers\n• Private: Your profile is hidden from searches\n\nAdditional privacy controls:\n• Toggle "Hide Current Company" to keep your job search confidential\n• Toggle "Hide Salary" to keep compensation private\n\nThese settings are in Profile → Privacy Settings section.'
        },
        {
          question: 'How do I update my email or phone number?',
          answer: 'To update your contact information, please email support@refopen.com with:\n• Your current registered email\n• The new email/phone number you want to use\n• Brief reason for change\n\nOur team will verify and update your account within 24-48 hours.'
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
          question: 'I transferred money but my wallet is not credited. What now?',
          answer: 'Don\'t worry! Your money is safe. Here\'s what to check:\n1. Ensure you submitted the payment proof with correct transaction reference number\n2. Check your submission status in Wallet → My Submissions\n3. Verification typically takes 2-4 hours during business hours\n4. If rejected, check the reason and resubmit with correct details\n5. If still not resolved, email support@refopen.com with:\n   - Transaction reference number\n   - Amount transferred\n   - Date of transfer\n   - Screenshot of bank transaction'
        },
        {
          question: 'I cannot login to my account. Help!',
          answer: 'Try these steps:\n1. Reset password using "Forgot Password"\n2. Clear browser cache and cookies\n3. Try a different browser or device\n4. Check if your account was deactivated\n5. If using Google login, ensure you are using the correct Google account\n\nStill stuck? Email support@refopen.com with your registered email.'
        },
        {
          question: 'The app is not loading properly.',
          answer: 'Try these solutions:\n1. Refresh the page (Ctrl+R or pull down on mobile)\n2. Clear browser cache\n3. Check internet connection\n4. Try incognito/private mode\n5. Update your browser to latest version\n6. Disable ad blockers or VPN temporarily\n\nIf issue persists, report to tech@refopen.com.'
        },
        {
          question: 'How do I report a fake job or scam?',
          answer: 'Your safety is our priority! To report suspicious activity, email safety@refopen.com with:\n• The job title and company name\n• Reason for concern (fake posting, scam, inappropriate content)\n• Any screenshots or details\n\nWe investigate all reports within 24 hours and take appropriate action.'
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
    <View style={styles.container}>
    <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }}>
    <View style={styles.innerContainer}>
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
          
          {/* Create Support Ticket Button */}
          <TouchableOpacity 
            style={styles.supportButton}
            onPress={() => navigation.navigate('Support')}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
            <Text style={styles.supportButtonText}>Create Support Ticket</Text>
          </TouchableOpacity>
          
          <View style={styles.contactOptions}>
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
              <Text style={styles.contactItem}>support@refopen.com</Text>
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
  supportButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  supportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
