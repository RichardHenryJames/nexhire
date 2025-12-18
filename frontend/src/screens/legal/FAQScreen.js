import React, { useState, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const faqData = [
    {
      category: 'Getting Started',
      questions: [
     {
          question: 'What is Refopen?',
          answer: 'Refopen is a career networking platform that connects job seekers with employees who can provide job referrals and recruiters who are actively hiring. We help you access opportunities through meaningful professional connections.'
        },
        {
     question: 'How do I create an account?',
   answer: 'Download the Refopen app or visit www.refopen.com, click Sign Up, choose your user type (Job Seeker or Employer), and complete your profile. You can sign up using email, Google, or LinkedIn.'
        },
  {
   question: 'Is Refopen free to use?',
    answer: 'Basic features like creating a profile, browsing jobs, and applying are free. Premium features like unlimited referral requests, priority support, and advanced search require a paid subscription.'
        }
      ]
    },
    {
      category: 'Referrals',
      questions: [
        {
          question: 'How do referrals work?',
          answer: 'When you find a job you are interested in, you can request a referral for that specific company. All employees from that company who are registered on Refopen will receive a notification about your referral request. This increases your chances of getting a referral as multiple employees can see and respond to your request.'
        },
        {
          question: 'Does a referral guarantee a job?',
          answer: 'No. A referral increases your chances of being noticed by recruiters, but it does not guarantee an interview or job offer. Hiring decisions are made solely by the employer.'
        },
        {
          question: 'What if no one accepts my referral request?',
answer: 'If no employee accepts your referral request within a certain timeframe, you can try requesting again or apply directly to the job. You can also reach out to more employees by upgrading your subscription for increased visibility.'
        },
        {
question: 'Can I provide referrals and earn rewards?',
          answer: 'Yes! If you are an employee, you can enable notifications to receive referral requests from job seekers interested in your company. You can choose which requests to accept and earn rewards for successful referrals.'
        },
        {
          question: 'How will I know if someone wants a referral at my company?',
     answer: 'When a job seeker requests a referral for your company, you will receive a push notification and email alert. You can review their profile and decide whether to provide the referral.'
        }
      ]
    },
    {
   category: 'Payments',
      questions: [
        {
      question: 'What payment methods do you accept?',
      answer: 'We accept credit/debit cards, UPI, net banking, and various digital wallets through our secure payment partners (Razorpay, PhonePe, PayU, Cashfree).'
     },
      {
          question: 'Do wallet credits expire?',
          answer: 'No, wallet credits do not expire as long as your account remains active. They are yours to use whenever you need them.'
        }
      ]
    },
    {
      category: 'Support',
      questions: [
        {
  question: 'How do I contact support?',
     answer: 'Email: support@refopen.com | In-app: Go to Profile then Help & Support | Response time: 24-48 hours on business days.'
        },
        {
    question: 'What are your support hours?',
          answer: 'Our support team is available Monday-Saturday, 9 AM - 7 PM IST. Email support is monitored 24/7, but responses may be delayed on Sundays and holidays.'
        }
   ]
    }
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
<Text style={styles.title}>Frequently Asked Questions</Text>
  <Text style={styles.subtitle}>Find answers to common questions about Refopen</Text>

    <View style={styles.searchTip}>
    <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
     <Text style={styles.searchTipText}>
       Tap any question to view the answer. Cannot find what you are looking for? Contact support@refopen.com
 </Text>
    </View>

        {faqData.map((section, sectionIndex) => (
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
   <Text style={styles.helpTitle}>Still Need Help?</Text>
          <Text style={styles.helpText}>
      If you could not find the answer to your question, our support team is here to help!
          </Text>
          <View style={styles.contactOptions}>
            <Text style={styles.contactItem}>Email: support@refopen.com</Text>
   <Text style={styles.contactItem}>In-App: Profile - Help & Support</Text>
            <Text style={styles.contactItem}>Response Time: 24-48 hours</Text>
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
    marginBottom: 20,
  },
  searchTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '10',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  searchTipText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  faqCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginRight: 8,
  lineHeight: 22,
  },
  answerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
 backgroundColor: colors.gray50,
  },
  answer: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  paddingTop: 12,
  },
  stillNeedHelp: {
    backgroundColor: colors.primary + '10',
    padding: 20,
    borderRadius: 8,
    marginTop: 24,
    marginBottom: 30,
  },
  helpTitle: {
    fontSize: 20,
    fontWeight: '600',
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
    padding: 12,
 borderRadius: 6,
  },
  contactItem: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
    lineHeight: 20,
  },
});
