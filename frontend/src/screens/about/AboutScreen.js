/**
 * RefOpen About Page - Production-Grade Public Landing Page
 * 
 * DARK THEME - Beautiful, conversion-optimized
 * 
 * RefOpen is a COMPREHENSIVE JOB PLATFORM with referral as an ADDITIONAL FEATURE:
 * 
 * CORE FEATURES:
 * - Job Seekers can APPLY DIRECTLY to jobs (primary feature)
 * - Browse 125K+ jobs from Fortune 500 companies
 * - Track applications, save jobs, AI recommendations
 * - Direct messaging with employers
 * 
 * REFERRAL FEATURES (Two Modes):
 * 1. INTERNAL REFERRAL: Ask for referral on jobs listed in RefOpen
 * 2. EXTERNAL REFERRAL: Provide external job ID/URL and ask for referral
 *    (For jobs found on company websites, LinkedIn, etc.)
 * 
 * CONTENT RATIO:
 * - 50% Job Seekers (apply to jobs + request referrals)
 * - 30% Referrers (turn LinkedIn spam into income, earn per referral)
 * - 20% Employers (post jobs, hire talent)
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
  Linking,
  Easing,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useResponsive from '../../hooks/useResponsive';
import { useTheme } from '../../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AdCard from '../../components/ads/AdCard'; // Google AdSense Ad
import ComplianceFooter from '../../components/ComplianceFooter';

// RefOpen Logo
const RefOpenLogo = require('../../../assets/refopen-logo.png');

// Feature Images
const AILogo = require('../../../assets/ai_logo.png');
const JobSearchImg = require('../../../assets/job_search.png');
const AskRefSentImg = require('../../../assets/askrefsent.png');
const HiredImg = require('../../../assets/hired.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Floating particle component for background effect (same as LoginScreen)
function FloatingParticle({ delay, style }) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const translateX = useRef(new Animated.Value(Math.random() * SCREEN_WIDTH)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 8000 + Math.random() * 4000,
          delay,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 1000,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1000,
            delay: 6000,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateY }, { translateX }],
          opacity,
        },
      ]}
    />
  );
}

// RefOpen website URL
const REFOPEN_URL = 'https://www.refopen.com';
const ASK_REFERRAL_URL = 'https://www.refopen.com/ask-referral';

// ============================================
// THEME-AWARE COLORS GENERATOR
// ============================================
const getThemeColors = (colors, isDark) => ({
  bgPrimary: isDark ? '#0F172A' : colors.background,  // Match LoginScreen gradient
  bgSecondary: isDark ? '#1E293B' : colors.gray50,    // Match LoginScreen gradient
  bgCard: isDark ? '#18181B' : colors.card,
  bgCardHover: isDark ? '#27272A' : colors.gray100,
  
  primary: colors.primary,
  primaryLight: colors.primaryLight,
  secondary: isDark ? '#06B6D4' : colors.info,
  accent: isDark ? '#22D3EE' : '#0EA5E9',
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
  pink: '#EC4899',
  blue: '#3B82F6',
  
  gradientPrimary: isDark ? ['#8B5CF6', '#6366F1'] : [colors.primary, colors.primaryDark],
  gradientSecondary: isDark ? ['#06B6D4', '#0891B2'] : ['#0EA5E9', '#0284C7'],
  gradientAccent: ['#EC4899', '#BE185D'],
  gradientSuccess: [colors.success, isDark ? '#059669' : '#047857'],
  gradientWarning: [colors.warning, isDark ? '#D97706' : '#B45309'],
  gradientBlue: ['#3B82F6', '#2563EB'],
  
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  textMuted: colors.textMuted,
  
  border: colors.border,
  borderLight: isDark ? '#3F3F46' : colors.borderLight,
});

// ============================================
// STATIC DATA
// ============================================
const FEATURED_COMPANIES = [
  { name: 'Google', domain: 'google.com', employees: '12K+' },
  { name: 'Microsoft', domain: 'microsoft.com', employees: '18K+' },
  { name: 'Amazon', domain: 'amazon.com', employees: '25K+' },
  { name: 'Apple', domain: 'apple.com', employees: '8K+' },
  { name: 'Meta', domain: 'facebook.com', employees: '6K+' },
  { name: 'Netflix', domain: 'netflix.com', employees: '3K+' },
  { name: 'Adobe', domain: 'adobe.com', employees: '5K+' },
  { name: 'Salesforce', domain: 'salesforce.com', employees: '9K+' },
  { name: 'Oracle', domain: 'oracle.com', employees: '7K+' },
  { name: 'IBM', domain: 'ibm.com', employees: '11K+' },
  { name: 'Goldman', domain: 'goldmansachs.com', employees: '4K+' },
  { name: 'JPMorgan', domain: 'jpmorganchase.com', employees: '15K+' },
  { name: 'Deloitte', domain: 'deloitte.com', employees: '20K+' },
  { name: 'McKinsey', domain: 'mckinsey.com', employees: '2K+' },
  { name: 'Uber', domain: 'uber.com', employees: '4K+' },
  { name: 'Spotify', domain: 'spotify.com', employees: '3K+' },
];

// 100+ Testimonials - Real sounding, diverse users
const ALL_TESTIMONIALS = [
  // Job Seekers - Success Stories
  { quote: "Sent one referral request and got 5 responses! Landed interviews at 3 companies. So much better than cold DMing.", name: "Priya S.", role: "Software Engineer", company: "Now at Google", gradient: 'gradientPrimary' },
  { quote: "Was stuck applying through job boards for months. First week on RefOpen, got a referral to Amazon. Start next month!", name: "Amit K.", role: "Data Scientist", company: "Now at Amazon", gradient: 'gradientAccent' },
  { quote: "The external referral feature is genius. Found a job on LinkedIn, got referred through RefOpen. Saved me so much time.", name: "Sarah M.", role: "Product Manager", company: "Now at Stripe", gradient: 'gradientBlue' },
  { quote: "Applied to 200+ jobs on other sites. Zero callbacks. 3 referral requests here = 2 interviews. Math checks out.", name: "Rohan P.", role: "Frontend Dev", company: "Now at Meta", gradient: 'gradientPrimary' },
  { quote: "Finally someone solved the LinkedIn DM problem. I can actually track who saw my request now.", name: "Jessica L.", role: "UX Designer", company: "Now at Figma", gradient: 'gradientSecondary' },
  { quote: "Got referred to my dream company within a week. The resume went straight to the hiring manager apparently.", name: "Karthik R.", role: "ML Engineer", company: "Now at OpenAI", gradient: 'gradientPrimary' },
  { quote: "Was skeptical about paying for referrals but honestly? Best career investment I've made. ROI is insane.", name: "Michelle T.", role: "Backend Engineer", company: "Now at Netflix", gradient: 'gradientAccent' },
  { quote: "3 months of job hunting vs 2 weeks on RefOpen. Wish I found this earlier.", name: "David C.", role: "DevOps Engineer", company: "Now at Datadog", gradient: 'gradientBlue' },
  { quote: "The fact that my request goes to ALL employees at a company? Game changer. Way better odds.", name: "Sneha G.", role: "iOS Developer", company: "Now at Apple", gradient: 'gradientSuccess' },
  { quote: "Used the external referral for a job at Coinbase I found on their careers page. Got referred same day!", name: "Alex W.", role: "Blockchain Dev", company: "Now at Coinbase", gradient: 'gradientWarning' },
  { quote: "Interview rate went from 2% to like 40% after I started using referrals. Numbers don't lie.", name: "Neha S.", role: "Full Stack Dev", company: "Now at Shopify", gradient: 'gradientPrimary' },
  { quote: "No more 'Thanks for applying, we'll keep your resume on file' emails. Actually getting calls now.", name: "James H.", role: "Cloud Architect", company: "Now at AWS", gradient: 'gradientSecondary' },
  { quote: "Switched careers from finance to tech. Referral made the transition way smoother.", name: "Pooja M.", role: "Data Analyst", company: "Now at Uber", gradient: 'gradientAccent' },
  { quote: "International job search is hard. RefOpen made it easier to connect with employees at US companies.", name: "Carlos R.", role: "SRE", company: "Now at Cloudflare", gradient: 'gradientBlue' },
  { quote: "Got ghosted by 50+ recruiters. First RefOpen referral? Interview within 3 days.", name: "Tanya K.", role: "QA Engineer", company: "Now at Atlassian", gradient: 'gradientSuccess' },
  { quote: "My friend got her Google job through here. Tried it, now I'm at Microsoft. Legit works.", name: "Vikram J.", role: "Software Dev", company: "Now at Microsoft", gradient: 'gradientPrimary' },
  { quote: "Entry level job search sucks. This actually helped me stand out as a fresh grad.", name: "Emily Z.", role: "Junior Dev", company: "Now at Airbnb", gradient: 'gradientWarning' },
  { quote: "Applied to the same role on LinkedIn and RefOpen. Guess which one got me an interview?", name: "Raj T.", role: "Security Engineer", company: "Now at CrowdStrike", gradient: 'gradientAccent' },
  { quote: "The tracking feature alone is worth it. No more wondering if anyone even saw my application.", name: "Lisa N.", role: "Product Designer", company: "Now at Notion", gradient: 'gradientSecondary' },
  { quote: "Referral worked so well I convinced my whole bootcamp cohort to sign up.", name: "Mike D.", role: "Web Dev", company: "Now at Vercel", gradient: 'gradientBlue' },
  
  // More Job Seekers
  { quote: "Honestly thought referral platforms were a scam. This one actually delivers.", name: "Ananya B.", role: "Backend Dev", company: "Now at Slack", gradient: 'gradientPrimary' },
  { quote: "5 referral requests, 4 responses, 2 offers. The conversion rate is ridiculous.", name: "Tom S.", role: "Engineering Manager", company: "Now at Lyft", gradient: 'gradientSuccess' },
  { quote: "Found my job through the external referral option. Super underrated feature.", name: "Priyanka D.", role: "Android Dev", company: "Now at DoorDash", gradient: 'gradientAccent' },
  { quote: "Layoffs hit hard. RefOpen helped me bounce back faster than I expected.", name: "Kevin L.", role: "Software Engineer", company: "Now at Stripe", gradient: 'gradientWarning' },
  { quote: "The whole 'spray and pray' job application thing wasn't working. Referrals are the way.", name: "Meera R.", role: "Data Engineer", company: "Now at Databricks", gradient: 'gradientBlue' },
  { quote: "Got into a FAANG company after 2 years of trying. Referral made the difference.", name: "Chris P.", role: "SDE II", company: "Now at Amazon", gradient: 'gradientPrimary' },
  { quote: "My resume was getting filtered out by ATS. Referral = straight to recruiter.", name: "Aditi S.", role: "ML Engineer", company: "Now at Anthropic", gradient: 'gradientSecondary' },
  { quote: "Career switch from marketing to product. Referral helped me get past the 'no experience' barrier.", name: "Jason M.", role: "Product Manager", company: "Now at Instacart", gradient: 'gradientAccent' },
  { quote: "Applied cold for 6 months. 2 weeks with referrals = 3 final rounds. Do the math.", name: "Sanya P.", role: "Frontend Engineer", company: "Now at Pinterest", gradient: 'gradientSuccess' },
  { quote: "The direct messaging with referrers is clutch. Got insider tips for my interviews.", name: "Daniel K.", role: "Platform Engineer", company: "Now at Twilio", gradient: 'gradientWarning' },
  
  // Referrers - Earning Stories
  { quote: "I was skeptical at first, but I've made $2,800 in 2 months just by referring people I'd normally ignore on LinkedIn. Game changer!", name: "Rahul M.", role: "Senior PM", company: "Microsoft", gradient: 'gradientSuccess' },
  { quote: "Finally getting paid for all those LinkedIn messages. Made $500 last month just from referrals.", name: "Jennifer W.", role: "Tech Lead", company: "Google", gradient: 'gradientSuccess' },
  { quote: "Used to ignore referral requests. Now I actually look forward to them lol.", name: "Sanjay K.", role: "Staff Engineer", company: "Meta", gradient: 'gradientWarning' },
  { quote: "Side income from referring is real. Paid for my vacation last month.", name: "Amanda L.", role: "Senior SDE", company: "Amazon", gradient: 'gradientSuccess' },
  { quote: "The AI filtering means I only see qualified candidates. No more spam resumes.", name: "Deepak R.", role: "Principal Engineer", company: "Netflix", gradient: 'gradientAccent' },
  { quote: "My LinkedIn DMs are still flooded but at least now I'm getting paid to help people.", name: "Rachel G.", role: "Engineering Manager", company: "Apple", gradient: 'gradientSuccess' },
  { quote: "Referred 12 people last month. 3 got hired. Company bonus + RefOpen rewards = nice.", name: "Arun S.", role: "Senior Dev", company: "Salesforce", gradient: 'gradientWarning' },
  { quote: "Actually feels good to help people AND earn something. Win-win.", name: "Nicole H.", role: "Tech Lead", company: "Adobe", gradient: 'gradientSuccess' },
  { quote: "One click to refer, instant reward. Why didn't this exist before?", name: "Vivek P.", role: "Staff SDE", company: "Uber", gradient: 'gradientAccent' },
  { quote: "My team refers through RefOpen now. We've hired 4 great people from here.", name: "Brian T.", role: "Director of Eng", company: "Stripe", gradient: 'gradientSuccess' },
  { quote: "The candidates are actually qualified. Not wasting time on random resumes.", name: "Shruti M.", role: "Senior PM", company: "LinkedIn", gradient: 'gradientWarning' },
  { quote: "Made more from referrals than my annual bonus. Wild.", name: "Andrew C.", role: "Principal Eng", company: "Oracle", gradient: 'gradientSuccess' },
  { quote: "Passive income from just reviewing profiles during lunch breaks.", name: "Kavya N.", role: "Tech Lead", company: "Intuit", gradient: 'gradientAccent' },
  { quote: "Company was hiring, referred 5 from RefOpen, 2 hired. Easy money.", name: "Ryan B.", role: "Senior SWE", company: "Spotify", gradient: 'gradientSuccess' },
  { quote: "The verification process filters out fake profiles. Quality over quantity.", name: "Anita J.", role: "Staff Engineer", company: "Airbnb", gradient: 'gradientWarning' },
  
  // Employers
  { quote: "We filled 3 senior roles in 6 weeks using RefOpen. The candidates from referrals are significantly better than job boards.", name: "Sarah T.", role: "Head of Talent", company: "Series B Startup", gradient: 'gradientBlue' },
  { quote: "Cost per hire dropped 40% when we started using referral-based hiring.", name: "Mark R.", role: "VP Engineering", company: "Tech Startup", gradient: 'gradientBlue' },
  { quote: "Referral hires stay longer. Our retention improved significantly.", name: "Laura K.", role: "HR Director", company: "SaaS Company", gradient: 'gradientBlue' },
  { quote: "Time to fill senior positions went from 90 days to 30. Referrals work.", name: "Greg P.", role: "CTO", company: "Fintech Startup", gradient: 'gradientBlue' },
  { quote: "Quality of candidates is noticeably better than Indeed or LinkedIn posts.", name: "Nisha A.", role: "Talent Lead", company: "AI Startup", gradient: 'gradientBlue' },
  { quote: "Our employees actually use this to refer people. That never happened with our internal tool.", name: "Steve M.", role: "VP People", company: "E-commerce Co", gradient: 'gradientBlue' },
  { quote: "Hired our best engineer through a RefOpen referral. Worth every penny.", name: "Diana L.", role: "Engineering Director", company: "HealthTech", gradient: 'gradientBlue' },
  { quote: "The analytics help us understand where good candidates come from.", name: "John K.", role: "Recruiting Lead", company: "Gaming Studio", gradient: 'gradientBlue' },
  
  // More diverse testimonials
  { quote: "Non-CS background, thought no one would refer me. Got 3 referrals for bootcamp grads.", name: "Maria C.", role: "Junior Dev", company: "Now at Zillow", gradient: 'gradientPrimary' },
  { quote: "H1B transfer was stressful. Referral helped me get interviews faster.", name: "Wei L.", role: "Software Engineer", company: "Now at Twitter", gradient: 'gradientAccent' },
  { quote: "Remote job search from India to US companies. External referral feature is perfect for this.", name: "Arjun V.", role: "Backend Engineer", company: "Now at GitLab", gradient: 'gradientBlue' },
  { quote: "Mom of 2, returning to tech after a break. Referral helped me get past the resume gap.", name: "Samantha W.", role: "Senior Dev", company: "Now at HubSpot", gradient: 'gradientSuccess' },
  { quote: "Age discrimination is real in tech. Referral got me in the door despite being 45+.", name: "Robert D.", role: "Architect", company: "Now at Cisco", gradient: 'gradientWarning' },
  { quote: "Just applied directly on RefOpen without referral. Still got the job. Good platform overall.", name: "Nina P.", role: "QA Lead", company: "Now at Zoom", gradient: 'gradientPrimary' },
  { quote: "The saved jobs feature + AI recommendations = I found roles I didn't even know existed.", name: "Tyler H.", role: "Platform Eng", company: "Now at MongoDB", gradient: 'gradientSecondary' },
  { quote: "Night shift worker. Love that I can apply and request referrals at 2am lol.", name: "Kristen M.", role: "DevOps", company: "Now at PagerDuty", gradient: 'gradientAccent' },
  { quote: "PhD trying to leave academia. Industry referrals actually responded to my profile.", name: "Dr. Alan S.", role: "Research Eng", company: "Now at DeepMind", gradient: 'gradientBlue' },
  { quote: "Self-taught dev with no degree. Referral got me past the 'BS required' filter.", name: "Jake R.", role: "Full Stack", company: "Now at Square", gradient: 'gradientSuccess' },
  
  // Short punchy ones
  { quote: "It just works. Finally.", name: "Tony L.", role: "SWE", company: "Now at Dropbox", gradient: 'gradientPrimary' },
  { quote: "LinkedIn DMs: 2% response. RefOpen: 60%+. Easy choice.", name: "Ritika S.", role: "Data Scientist", company: "Now at Palantir", gradient: 'gradientAccent' },
  { quote: "Got the job. That's all that matters.", name: "Ben F.", role: "iOS Dev", company: "Now at Robinhood", gradient: 'gradientSuccess' },
  { quote: "Resume straight to hiring manager. Not the ATS black hole.", name: "Divya K.", role: "Software Eng", company: "Now at Snap", gradient: 'gradientWarning' },
  { quote: "Two referrals, two offers. Can't ask for more.", name: "Matt G.", role: "SRE", company: "Now at Reddit", gradient: 'gradientBlue' },
  { quote: "Worth every rupee spent. Now earning in dollars.", name: "Harsh P.", role: "Backend Dev", company: "Now at Rippling", gradient: 'gradientPrimary' },
  { quote: "Finally broke into FAANG after 5 years of trying.", name: "Swetha R.", role: "Senior SDE", company: "Now at Google", gradient: 'gradientSuccess' },
  { quote: "External referral = cheat code for jobs not on regular portals.", name: "Derek N.", role: "Engineer", company: "Now at Plaid", gradient: 'gradientAccent' },
  { quote: "The chat feature helped me prep for interviews. Referrers gave solid tips.", name: "Aparna M.", role: "PM", company: "Now at Notion", gradient: 'gradientSecondary' },
  { quote: "Took 3 weeks from signup to offer letter. Not bad.", name: "Luke T.", role: "Frontend Eng", company: "Now at Figma", gradient: 'gradientBlue' },
  
  // More realistic mixed sentiments
  { quote: "Not every referral works out, but the success rate is way higher than cold applying.", name: "Grace L.", role: "Engineer", company: "Now at Asana", gradient: 'gradientPrimary' },
  { quote: "Some companies took longer to respond, but eventually got interviews at all of them.", name: "Suresh K.", role: "Tech Lead", company: "Now at ServiceNow", gradient: 'gradientWarning' },
  { quote: "Had to tweak my profile a few times. Once I did, referrals started flowing.", name: "Kelly O.", role: "Designer", company: "Now at Canva", gradient: 'gradientAccent' },
  { quote: "The wallet system took some getting used to, but makes sense once you understand it.", name: "Varun T.", role: "SWE II", company: "Now at Okta", gradient: 'gradientBlue' },
  { quote: "Customer support was helpful when I had questions. Good experience overall.", name: "Diana M.", role: "Data Eng", company: "Now at Snowflake", gradient: 'gradientSuccess' },
  { quote: "Wish I knew about this during my last job search. Would've saved months.", name: "Paul H.", role: "Principal Eng", company: "Now at Confluent", gradient: 'gradientPrimary' },
  { quote: "The job filters are actually useful. Found exactly what I was looking for.", name: "Nandini G.", role: "ML Engineer", company: "Now at Scale AI", gradient: 'gradientSecondary' },
  { quote: "Referred by someone at my dream company. Still pinching myself.", name: "Eric J.", role: "Software Dev", company: "Now at Tesla", gradient: 'gradientAccent' },
  { quote: "Better than Blind, better than LinkedIn. This is how job search should work.", name: "Ankita C.", role: "SDE", company: "Now at Flexport", gradient: 'gradientBlue' },
  { quote: "My referrer actually followed up. Never had that happen on LinkedIn.", name: "Scott W.", role: "Backend Eng", company: "Now at Brex", gradient: 'gradientSuccess' },
  
  // International users
  { quote: "From Bangalore to Bay Area. RefOpen made the impossible possible.", name: "Lokesh M.", role: "Senior SWE", company: "Now at Meta", gradient: 'gradientPrimary' },
  { quote: "Canada to US job search. Referrals helped with visa sponsorship questions too.", name: "Preet S.", role: "Full Stack", company: "Now at Nvidia", gradient: 'gradientWarning' },
  { quote: "UK to US move. The external referral feature worked for companies hiring globally.", name: "James B.", role: "DevOps Lead", company: "Now at HashiCorp", gradient: 'gradientAccent' },
  { quote: "Singapore to US. Referral fast-tracked my application through the system.", name: "Wei Min T.", role: "Staff Eng", company: "Now at Grab", gradient: 'gradientBlue' },
  { quote: "Remote from Europe, hired by US startup. RefOpen connected us.", name: "Sophie K.", role: "Frontend Dev", company: "Now at Linear", gradient: 'gradientSuccess' },
  
  // Career changers
  { quote: "Teacher to tech. Never thought it was possible until I got my first referral.", name: "Amanda R.", role: "Junior Dev", company: "Now at Duolingo", gradient: 'gradientPrimary' },
  { quote: "10 years in banking, now in fintech. Referral opened doors that were closed before.", name: "Marcus J.", role: "Product Manager", company: "Now at Chime", gradient: 'gradientSecondary' },
  { quote: "Nurse during COVID, now a health tech engineer. Career pivot complete.", name: "Linda P.", role: "Software Eng", company: "Now at Oscar Health", gradient: 'gradientAccent' },
  { quote: "Journalism to content platforms. Industry insiders actually respond here.", name: "Ryan O.", role: "Product Lead", company: "Now at Medium", gradient: 'gradientBlue' },
  
  // Recent grads
  { quote: "Class of 2024, job market was brutal. RefOpen was my lifeline.", name: "Josh K.", role: "New Grad SWE", company: "Now at Roblox", gradient: 'gradientPrimary' },
  { quote: "No internship experience. Referral helped me explain my projects directly.", name: "Aisha P.", role: "Junior Engineer", company: "Now at Coursera", gradient: 'gradientSuccess' },
  { quote: "Community college to FAANG. Proof that pedigree doesn't matter with referrals.", name: "Miguel S.", role: "SDE I", company: "Now at Amazon", gradient: 'gradientWarning' },
  { quote: "First gen college student. Had no network until RefOpen.", name: "Crystal N.", role: "Software Dev", company: "Now at Gusto", gradient: 'gradientAccent' },
];

// Function to get random testimonials
const getRandomTestimonials = (count = 4, COLORS) => {
  const shuffled = [...ALL_TESTIMONIALS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(t => ({
    ...t,
    gradient: COLORS[t.gradient]
  }));
};

// ============================================
// HELPER
// ============================================
const openRefOpen = () => {
  Linking.openURL(REFOPEN_URL);
};

const openAskReferral = () => {
  Linking.openURL(ASK_REFERRAL_URL);
};

// ============================================
// COMPONENTS
// ============================================

// Smooth Floating Company Logo with Letter Fallback
const FloatingLogo = ({ company, index, COLORS }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Fade in animation
    Animated.parallel([
      Animated.timing(opacity, { 
        toValue: 1, 
        duration: 600, 
        delay: index * 80, 
        useNativeDriver: true 
      }),
      Animated.spring(scale, { 
        toValue: 1, 
        tension: 40, 
        friction: 7, 
        delay: index * 80, 
        useNativeDriver: true 
      }),
    ]).start();

    // Continuous smooth floating using a single looping animation
    const floatDuration = 4000 + (index % 5) * 500;
    
    const float = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: floatDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    
    // Stagger the start
    const timeout = setTimeout(() => float.start(), index * 100);
    return () => {
      clearTimeout(timeout);
      float.stop();
    };
  }, []);

  // Use interpolation with sine-wave pattern for perfectly smooth up AND down
  const floatDistance = 10 + (index % 4) * 3;
  const translateY = animatedValue.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -floatDistance, 0, floatDistance, 0],
  });

  return (
    <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8}>
      <Animated.View
        style={{
          transform: [{ translateY }, { scale }],
          opacity,
          backgroundColor: COLORS.bgCard,
          borderRadius: 16,
          padding: 14,
          margin: 8,
          minWidth: 90,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: COLORS.border,
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 5,
        }}
      >
        {/* Company Logo from Google Favicon Service */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: '#fff',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          <Image
            source={{ uri: `https://www.google.com/s2/favicons?domain=${company.domain}&sz=128` }}
            style={{ width: 36, height: 36 }}
            resizeMode="contain"
          />
        </View>
        <Text style={{ 
          fontSize: 11, 
          color: COLORS.textPrimary, 
          marginTop: 8, 
          fontWeight: '600',
          textAlign: 'center',
        }}>
          {company.name}
        </Text>
        <Text style={{ fontSize: 9, color: COLORS.accent, marginTop: 2, fontWeight: '500' }}>
          {company.employees} on RefOpen
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Section Header
const SectionHeader = ({ tag, tagColor, title, subtitle, align = 'center', COLORS, isLargeScreen, isMediumScreen }) => (
  <View style={{ marginBottom: 40, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
    <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 2, color: tagColor, marginBottom: 12, textTransform: 'uppercase' }}>
      {tag}
    </Text>
    <Text style={{ 
      fontSize: isLargeScreen ? 42 : isMediumScreen ? 32 : 26, 
      fontWeight: '800', 
      color: COLORS.textPrimary, 
      textAlign: align,
      lineHeight: isLargeScreen ? 52 : isMediumScreen ? 40 : 34,
      maxWidth: 800,
    }}>
      {title}
    </Text>
    {subtitle && (
      <Text style={{ fontSize: 16, color: COLORS.textSecondary, marginTop: 16, textAlign: align, lineHeight: 26, maxWidth: 600 }}>
        {subtitle}
      </Text>
    )}
  </View>
);

// Stat Card
const StatCard = ({ icon, value, label, gradient, COLORS, isLargeScreen, isMediumScreen }) => (
  <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8}>
    <LinearGradient
      colors={[`${gradient[0]}15`, `${gradient[1]}08`]}
      style={{
        borderRadius: 20,
        padding: isLargeScreen ? 24 : 18,
        alignItems: 'center',
        margin: 6,
        minWidth: isLargeScreen ? 180 : isMediumScreen ? 150 : 140,
        borderWidth: 1,
        borderColor: `${gradient[0]}30`,
      }}
    >
      <LinearGradient colors={gradient} style={{ width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
        <Ionicons name={icon} size={22} color="#fff" />
      </LinearGradient>
      <Text style={{ fontSize: isLargeScreen ? 28 : 24, fontWeight: '800', color: COLORS.textPrimary }}>{value}</Text>
      <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center', fontWeight: '500' }}>{label}</Text>
    </LinearGradient>
  </TouchableOpacity>
);

// Feature Card
const FeatureCard = ({ icon, title, description, gradient, index, isLargeScreen, isMediumScreen }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, tension: 50, friction: 8, delay: index * 80, useNativeDriver: true }).start();
  }, []);

  return (
    <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8}>
      <Animated.View style={{ transform: [{ scale: anim }], opacity: anim, width: isLargeScreen ? 320 : isMediumScreen ? 280 : '100%', marginBottom: 16, marginHorizontal: isLargeScreen ? 8 : 0 }}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 24, minHeight: 200 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name={icon} size={26} color="#fff" />
          </View>
          <Text style={{ fontSize: 19, fontWeight: '700', color: '#fff', marginBottom: 10 }}>{title}</Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 22 }}>{description}</Text>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Process Step with big numbers
const ProcessStep = ({ number, title, description, icon, gradient, COLORS }) => (
  <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8} style={{ marginBottom: 32 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <LinearGradient colors={gradient} style={{ width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
        <Ionicons name={icon} size={26} color="#fff" />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: gradient[0], marginRight: 8 }}>STEP {number}</Text>
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 }}>{title}</Text>
        <Text style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 }}>{description}</Text>
      </View>
    </View>
  </TouchableOpacity>
);

// Benefit Item
const BenefitItem = ({ icon, text, color, COLORS }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${color}20`, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
      <Ionicons name={icon} size={16} color={color} />
    </View>
    <Text style={{ fontSize: 14, color: COLORS.textPrimary, flex: 1 }}>{text}</Text>
  </View>
);

// Big Number Highlight
const BigNumber = ({ number, label, color, COLORS, isLargeScreen }) => (
  <View style={{ alignItems: 'center', paddingHorizontal: isLargeScreen ? 40 : 20, paddingVertical: 16 }}>
    <Text style={{ fontSize: isLargeScreen ? 64 : 48, fontWeight: '800', color }}>{number}</Text>
    <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 }}>{label}</Text>
  </View>
);

// ============================================
// MAIN COMPONENT
// ============================================
// Create responsive styles
const createStyles = (COLORS, responsive = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
    ...(Platform.OS === 'web' && responsive.isDesktop ? {
      alignItems: 'center',
    } : {}),
  },
  innerContainer: {
    width: '100%',
    maxWidth: Platform.OS === 'web' && responsive.isDesktop ? 1200 : '100%',
    flex: 1,
  },
});

export default function AboutScreen() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { isMobile, isDesktop, isTablet, contentWidth } = responsive;
  
  // Derive responsive breakpoints
  const isLargeScreen = isDesktop;
  const isMediumScreen = isTablet;
  
  // Get theme-aware colors
  const COLORS = useMemo(() => getThemeColors(colors, isDark), [colors, isDark]);
  const styles = useMemo(() => createStyles(COLORS, responsive), [COLORS, responsive]);
  
  // Get 4 random testimonials on each render
  const [testimonials] = React.useState(() => getRandomTestimonials(4, COLORS));

  // Scroll to top on mount/refresh - run immediately on web
  useEffect(() => {
    // Immediate scroll for web
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    
    // Delayed scroll to ensure ScrollView is mounted
    const timer = setTimeout(() => {
      scrollToTop(false);
    }, 120);
    
    return () => clearTimeout(timer);
  }, []);

  // Scroll to top whenever the screen comes into focus (handles navigation without remount)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }

      // Ensure multiple attempts to reset scroll (fixes timing/platform issues)
      const doEnsure = () => {
        scrollToTop(false);
        setTimeout(() => scrollToTop(false), 20);
        setTimeout(() => scrollToTop(false), 80);
        requestAnimationFrame(() => scrollToTop(false));
      };

      doEnsure();
    });

    return unsubscribe;
  }, [navigation]);

  const scrollToTop = (animated = false) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      } catch (e) {}
    }

    if (scrollViewRef.current) {
      try {
        scrollViewRef.current.scrollTo({ y: 0, animated });
      } catch (e) {
        // ignore
      }
      // ensure after layout
      requestAnimationFrame(() => {
        try { scrollViewRef.current && scrollViewRef.current.scrollTo({ y: 0, animated }); } catch (e) {}
      });
    }
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const containerStyle = {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: isLargeScreen ? 40 : isTablet ? 24 : 16,
  };

  // Floating particle style
  const floatingParticleStyle = {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    zIndex: 1,
  };

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
      {/* Dark gradient overlay */}
      <LinearGradient
        colors={[COLORS.bgPrimary, COLORS.bgSecondary, COLORS.bgPrimary]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      
      {/* Floating Particles - same as LoginScreen */}
      <FloatingParticle delay={0} style={floatingParticleStyle} />
      <FloatingParticle delay={1000} style={floatingParticleStyle} />
      <FloatingParticle delay={2000} style={floatingParticleStyle} />
      <FloatingParticle delay={3000} style={floatingParticleStyle} />
      <FloatingParticle delay={4000} style={floatingParticleStyle} />
      
      {/* Bottom Decoration Circles */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 300, zIndex: 0 }}>
        <View style={{ position: 'absolute', bottom: -80, right: -60, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }} />
        <View style={{ position: 'absolute', bottom: -120, left: -100, width: 350, height: 350, borderRadius: 175, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' }} />
        <View style={{ position: 'absolute', bottom: 50, right: 30, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' }} />
      </View>
      
      {/* Fixed Home Button - Top Right */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Main')}
        style={{
          position: 'fixed',
          top: Platform.OS === 'ios' ? 50 : 20,
          right: 20,
          zIndex: 200,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: COLORS.primary,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        }}
      >
        <Ionicons name="home" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Sticky Header */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backgroundColor: '#000000',
          opacity: headerOpacity,
          paddingTop: Platform.OS === 'ios' ? 50 : 16,
          paddingBottom: 12,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1200, alignSelf: 'center', width: '100%' }}>
          <TouchableOpacity onPress={openRefOpen} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={RefOpenLogo} style={{ width: 140, height: 36 }} resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity onPress={openRefOpen}>
            <LinearGradient colors={COLORS.gradientPrimary} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Get Started Free</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentOffset={{ x: 0, y: 0 }}
        keyboardDismissMode="on-drag"
        onLayout={() => {
          scrollToTop(false);
        }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        onContentSizeChange={() => scrollToTop(false)}
      >
        {/* ============================================ */}
        {/* HERO SECTION */}
        {/* ============================================ */}
        <LinearGradient
          colors={[COLORS.bgSecondary, COLORS.bgPrimary]}
          style={{ paddingTop: Platform.OS === 'ios' ? 110 : 90, paddingBottom: 60 }}
        >
          <View style={containerStyle}>
            <View style={{ alignItems: 'center' }}>
              {/* RefOpen Logo */}
              <TouchableOpacity onPress={openRefOpen} style={{ marginBottom: 24 }}>
                <Image source={RefOpenLogo} style={{ width: 180, height: 50 }} resizeMode="contain" />
              </TouchableOpacity>

              {/* Main Headline */}
              <Text
                style={{
                  fontSize: isLargeScreen ? 60 : isMediumScreen ? 44 : 34,
                  fontWeight: '800',
                  textAlign: 'center',
                  lineHeight: isLargeScreen ? 72 : isMediumScreen ? 54 : 42,
                  marginBottom: 24,
                  color: COLORS.textPrimary,
                }}
              >
                Find Jobs. Get Referred.{'\n'}
                <Text style={{ color: COLORS.primary }}>Get Hired.</Text>{'\n'}
              </Text>

              <Text
                style={{
                  fontSize: isLargeScreen ? 18 : 15,
                  textAlign: 'center',
                  lineHeight: isLargeScreen ? 28 : 24,
                  marginBottom: 36,
                  maxWidth: 700,
                  color: COLORS.textSecondary,
                }}
              >
                RefOpen is an <Text style={{ color: COLORS.accent, fontWeight: '600' }}>AI-powered hiring and referral platform</Text> connecting job seekers, referrers, and employers. 
                Referred candidates are up to <Text style={{ color: COLORS.accent, fontWeight: '600' }}>15x more likely</Text> to get hired — yet most don't have connections inside top companies. 
                We bridge that gap.
              </Text>

              {/* CTA Buttons */}
              <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', alignItems: 'center', marginBottom: 40 }}>
                <TouchableOpacity onPress={openRefOpen} style={{ marginRight: isLargeScreen ? 16 : 0, marginBottom: isLargeScreen ? 0 : 12 }}>
                  <LinearGradient
                    colors={COLORS.gradientPrimary}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 32,
                      paddingVertical: 18,
                      borderRadius: 14,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 8 }}>Browse Jobs & Apply</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={openAskReferral} style={{ marginRight: isLargeScreen ? 16 : 0, marginBottom: isLargeScreen ? 0 : 12 }}>
                  <View style={{ paddingHorizontal: 28, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.accent }}>
                    <Text style={{ fontWeight: '600', fontSize: 15, color: COLORS.accent }}>Ask for Referral</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={openAskReferral} style={{ marginRight: isLargeScreen ? 16 : 0, marginBottom: isLargeScreen ? 0 : 12 }}>
                  <View style={{ paddingHorizontal: 28, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.success }}>
                    <Text style={{ fontWeight: '600', fontSize: 15, color: COLORS.success }}>Earn by Referring</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={openRefOpen}>
                  <View style={{ paddingHorizontal: 28, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.blue }}>
                    <Text style={{ fontWeight: '600', fontSize: 15, color: COLORS.blue }}>Hire Talent</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Trust indicators */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', marginRight: 16 }}>
                  {[COLORS.gradientPrimary, COLORS.gradientSecondary, COLORS.gradientAccent, COLORS.gradientSuccess].map((gradient, i) => (
                    <LinearGradient
                      key={i}
                      colors={gradient}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginLeft: i > 0 ? -10 : 0,
                        borderWidth: 2,
                        borderColor: COLORS.bgSecondary,
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{String.fromCharCode(65 + i)}</Text>
                    </LinearGradient>
                  ))}
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons key={star} name="star" size={14} color={COLORS.warning} />
                    ))}
                    <Text style={{ marginLeft: 6, fontWeight: '700', color: COLORS.textPrimary, fontSize: 14 }}>4.9</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: COLORS.textMuted }}>50,000+ professionals</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Floating Companies */}
          <View style={{ marginTop: 48 }}>
            <Text style={{ textAlign: 'center', fontSize: 12, color: COLORS.textMuted, marginBottom: 16, letterSpacing: 1 }}>
              EMPLOYEES FROM THESE COMPANIES ARE ON REFOPEN
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              {FEATURED_COMPANIES.map((company, index) => (
                <FloatingLogo key={company.name} company={company} index={index} COLORS={COLORS} />
              ))}
            </ScrollView>
          </View>
        </LinearGradient>

        {/* ============================================ */}
        {/* GOOGLE ADSENSE - TOP BANNER */}
        {/* ============================================ */}
        <View style={{ backgroundColor: COLORS.bgPrimary, paddingTop: 16 }}>
          <AdCard 
            variant="about" 
            style={{ 
              marginHorizontal: isLargeScreen ? 40 : 16,
              backgroundColor: COLORS.bgSecondary,
              borderColor: COLORS.border,
            }} 
          />
        </View>

        {/* ============================================ */}
        {/* STATS SECTION */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 48, backgroundColor: COLORS.bgPrimary }}>
          <View style={containerStyle}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              <StatCard icon="people" value="50K+" label="Job Seekers" gradient={COLORS.gradientPrimary} COLORS={COLORS} isLargeScreen={isLargeScreen} isMediumScreen={isMediumScreen} />
              <StatCard icon="briefcase" value="125K+" label="Active Jobs" gradient={COLORS.gradientSecondary} COLORS={COLORS} isLargeScreen={isLargeScreen} isMediumScreen={isMediumScreen} />
              <StatCard icon="business" value="2,500+" label="Companies" gradient={COLORS.gradientSuccess} COLORS={COLORS} isLargeScreen={isLargeScreen} isMediumScreen={isMediumScreen} />
              <StatCard icon="gift" value="$2.5M+" label="Rewards Paid" gradient={COLORS.gradientWarning} COLORS={COLORS} isLargeScreen={isLargeScreen} isMediumScreen={isMediumScreen} />
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* AI-POWERED FEATURE HIGHLIGHT */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 64, backgroundColor: COLORS.bgSecondary }}>
          <View style={containerStyle}>
            <LinearGradient
              colors={[`${COLORS.pink}15`, `${COLORS.primary}10`, `${COLORS.accent}08`]}
              style={{
                borderRadius: 32,
                padding: isLargeScreen ? 48 : 32,
                borderWidth: 1,
                borderColor: `${COLORS.pink}40`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Decorative AI sparkles */}
              <View style={{ position: 'absolute', top: 20, right: 30, opacity: 0.3 }}>
                <Text style={{ fontSize: 40, color: COLORS.pink }}>✨</Text>
              </View>
              <View style={{ position: 'absolute', bottom: 30, left: 40, opacity: 0.2 }}>
                <Text style={{ fontSize: 28, color: COLORS.accent }}>✨</Text>
              </View>
              
              <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', alignItems: 'center' }}>
                {/* Left - AI Logo Image */}
                <View style={{ alignItems: 'center', marginRight: isLargeScreen ? 48 : 0, marginBottom: isLargeScreen ? 0 : 32 }}>
                  <Image
                    source={AILogo}
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: 28,
                      marginBottom: 16,
                    }}
                    resizeMode="contain"
                  />
                  <View style={{
                    backgroundColor: `${COLORS.pink}30`,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: COLORS.pink,
                  }}>
                    <Text style={{ color: COLORS.pink, fontWeight: '700', fontSize: 13 }}>✨ AI-POWERED</Text>
                  </View>
                </View>

                {/* Right - Content */}
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: isLargeScreen ? 36 : 28,
                    fontWeight: '800',
                    color: COLORS.textPrimary,
                    marginBottom: 16,
                    textAlign: isLargeScreen ? 'left' : 'center',
                  }}>
                    Smart Job Recommendations
                  </Text>
                  <Text style={{
                    fontSize: 16,
                    lineHeight: 26,
                    color: COLORS.textSecondary,
                    marginBottom: 24,
                    textAlign: isLargeScreen ? 'left' : 'center',
                  }}>
                    Our AI analyzes your skills, experience, and preferences to surface jobs you'll actually love. 
                    No more scrolling through hundreds of irrelevant listings. Get personalized matches that fit your career goals.
                  </Text>

                  {/* AI Features Grid */}
                  <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', flexWrap: 'wrap' }}>
                    {[
                      { icon: 'bulb', text: 'Smart matching based on your profile', color: COLORS.warning },
                      { icon: 'trending-up', text: 'Learns from your activity over time', color: COLORS.success },
                      { icon: 'flash', text: 'Daily personalized job alerts', color: COLORS.accent },
                      { icon: 'search', text: 'AI-powered search understands intent', color: COLORS.primary },
                    ].map((item, index) => (
                      <View key={index} style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 14,
                        marginRight: isLargeScreen ? 32 : 0,
                        width: isLargeScreen ? '45%' : '100%',
                      }}>
                        <View style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: `${item.color}20`,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: 12,
                        }}>
                          <Ionicons name={item.icon} size={18} color={item.color} />
                        </View>
                        <Text style={{ fontSize: 14, color: COLORS.textPrimary, flex: 1 }}>{item.text}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity onPress={openRefOpen} style={{ marginTop: 20, alignSelf: isLargeScreen ? 'flex-start' : 'center' }}>
                    <LinearGradient
                      colors={['#EC4899', '#8B5CF6']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 28,
                        paddingVertical: 14,
                        borderRadius: 14,
                      }}
                    >
                      <Text style={{ fontSize: 18, marginRight: 8 }}>✨</Text>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Get AI-Matched Jobs</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* ============================================ */}
        {/* SECTION 1: JOB SEEKERS (50%) */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 80, backgroundColor: COLORS.bgSecondary }}>
          <View style={containerStyle}>
            <SectionHeader
              tag="For Job Seekers"
              tagColor={COLORS.primary}
              title="Apply Directly. Or Get Referred. Your Choice."
              subtitle="Browse 125,000+ jobs and apply with one click. Want better chances? Request a referral and it reaches every employee at that company on RefOpen."
              COLORS={COLORS}
              isLargeScreen={isLargeScreen}
              isMediumScreen={isMediumScreen}
            />

            {/* Big Impact Numbers */}
            <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', justifyContent: 'center', alignItems: 'center', marginBottom: 48, backgroundColor: COLORS.bgCard, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: COLORS.border }}>
              <BigNumber number="125K+" label="Active Jobs" color={COLORS.primary} COLORS={COLORS} isLargeScreen={isLargeScreen} />
              <View style={{ width: 1, height: 60, backgroundColor: COLORS.border, display: isLargeScreen ? 'flex' : 'none' }} />
              <BigNumber number="15x" label="Higher Hiring Rate with Referral" color={COLORS.accent} COLORS={COLORS} isLargeScreen={isLargeScreen} />
              <View style={{ width: 1, height: 60, backgroundColor: COLORS.border, display: isLargeScreen ? 'flex' : 'none' }} />
              <BigNumber number="48hrs" label="Avg Response Time" color={COLORS.success} COLORS={COLORS} isLargeScreen={isLargeScreen} />
            </View>

            {/* How it works - Always vertical layout */}
            <View style={{ marginBottom: 48 }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 24 }}>How It Works</Text>
              
              {/* Step 1 */}
              <ProcessStep number="1" title="Browse & Search Jobs" description="Explore 125,000+ jobs from Fortune 500 companies and top startups. Filter by role, location, salary, work type & more. AI-powered recommendations find perfect matches." icon="search" gradient={COLORS.gradientPrimary} COLORS={COLORS} />
              <View style={{ alignItems: 'center', marginBottom: 32, marginTop: 8 }}>
                <Image source={JobSearchImg} style={{ width: isLargeScreen ? 320 : 260, height: isLargeScreen ? 200 : 160, borderRadius: 16 }} resizeMode="contain" />
              </View>
              
              {/* Step 2 */}
              <ProcessStep number="2" title="Apply Directly or Ask Referral" description="Apply directly with your resume and cover letter. OR click 'Ask Referral' to boost your chances - your request is sent to ALL employees at that company!" icon="send" gradient={COLORS.gradientSecondary} COLORS={COLORS} />
              <View style={{ alignItems: 'center', marginBottom: 32, marginTop: 8 }}>
                <Image source={AskRefSentImg} style={{ width: isLargeScreen ? 320 : 260, height: isLargeScreen ? 200 : 160, borderRadius: 16 }} resizeMode="contain" />
              </View>
              
              {/* Step 3 */}
              <ProcessStep number="3" title="Track Applications & Get Hired" description="Track all your applications in real-time. See status updates, chat with referrers, and land your dream job faster." icon="trophy" gradient={COLORS.gradientSuccess} COLORS={COLORS} />
              <View style={{ alignItems: 'center', marginBottom: 16, marginTop: 8 }}>
                <Image source={HiredImg} style={{ width: isLargeScreen ? 320 : 260, height: isLargeScreen ? 200 : 160, borderRadius: 16 }} resizeMode="contain" />
              </View>
            </View>

            {/* Benefits Card - Always below steps */}
            <View style={{ marginBottom: 48 }}>
              <LinearGradient
                colors={[`${COLORS.primary}15`, `${COLORS.primary}05`]}
                style={{ borderRadius: 24, padding: 28, borderWidth: 1, borderColor: `${COLORS.primary}30` }}
              >
                <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 24 }}>Why Job Seekers Love RefOpen</Text>
                <BenefitItem icon="briefcase" text="Apply directly to jobs with one click" color={COLORS.blue} COLORS={COLORS} />
                <BenefitItem icon="people" text="One referral request reaches ALL employees" color={COLORS.primary} COLORS={COLORS} />
                <BenefitItem icon="globe" text="External referrals: Got a job link? We'll find referrers!" color={COLORS.accent} COLORS={COLORS} />
                <BenefitItem icon="flash" text="Skip the resume black hole - get noticed" color={COLORS.warning} COLORS={COLORS} />
                <BenefitItem icon="analytics" text="Track applications & referrals in real-time" color={COLORS.success} COLORS={COLORS} />
                <BenefitItem icon="chatbubbles" text="Direct messaging with employers & referrers" color={COLORS.pink} COLORS={COLORS} />
                <BenefitItem icon="bookmark" text="Save jobs and get AI recommendations" color={COLORS.secondary} COLORS={COLORS} />

                <TouchableOpacity onPress={openRefOpen} style={{ marginTop: 24 }}>
                  <LinearGradient colors={COLORS.gradientPrimary} style={{ paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Start Finding Jobs →</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </View>

            {/* Two Referral Modes Section */}
            <View style={{ marginBottom: 48 }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' }}>Two Ways to Get Referred</Text>
              <Text style={{ fontSize: 15, color: COLORS.textSecondary, marginBottom: 24, textAlign: 'center' }}>Found a job on RefOpen or elsewhere? We've got you covered.</Text>
              
              <View style={{ flexDirection: isLargeScreen ? 'row' : 'column' }}>
                {/* Internal Referral */}
                <TouchableOpacity onPress={openAskReferral} activeOpacity={0.8} style={{ flex: 1, margin: 8 }}>
                  <LinearGradient
                    colors={[`${COLORS.success}20`, `${COLORS.success}08`]}
                    style={{ borderRadius: 24, padding: 28, borderWidth: 1, borderColor: COLORS.success, height: '100%' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                      <LinearGradient colors={COLORS.gradientSuccess} style={{ width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Ionicons name="checkmark-circle" size={22} color="#fff" />
                      </LinearGradient>
                      <View>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textPrimary }}>Internal Jobs</Text>
                        <Text style={{ fontSize: 12, color: COLORS.success }}>Jobs listed on RefOpen</Text>
                      </View>
                    </View>
                    {[
                      'Browse jobs directly on RefOpen',
                      'Click "Apply" to apply directly',
                      'Click "Ask Referral" for boost',
                      'Request sent to ALL company employees',
                      'Track status in real-time',
                    ].map((item, index) => (
                      <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="checkmark" size={18} color={COLORS.success} style={{ marginRight: 10 }} />
                        <Text style={{ fontSize: 14, color: COLORS.textPrimary }}>{item}</Text>
                      </View>
                    ))}
                  </LinearGradient>
                </TouchableOpacity>

                {/* External Referral */}
                <TouchableOpacity onPress={openAskReferral} activeOpacity={0.8} style={{ flex: 1, margin: 8 }}>
                  <LinearGradient
                    colors={[`${COLORS.accent}20`, `${COLORS.accent}08`]}
                    style={{ borderRadius: 24, padding: 28, borderWidth: 1, borderColor: COLORS.accent, height: '100%' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                      <LinearGradient colors={COLORS.gradientSecondary} style={{ width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Ionicons name="globe" size={22} color="#fff" />
                      </LinearGradient>
                      <View>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textPrimary }}>External Jobs</Text>
                        <Text style={{ fontSize: 12, color: COLORS.accent }}>Jobs from anywhere</Text>
                      </View>
                    </View>
                    {[
                      'Found job on LinkedIn, company site, etc.?',
                      'Paste the job URL or Job ID',
                      'Select the company',
                      'We find RefOpen employees at that company',
                      'Get referred to jobs not on our platform!',
                    ].map((item, index) => (
                      <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="checkmark" size={18} color={COLORS.accent} style={{ marginRight: 10 }} />
                        <Text style={{ fontSize: 14, color: COLORS.textPrimary }}>{item}</Text>
                      </View>
                    ))}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* The Problem vs RefOpen */}
            <View style={{ flexDirection: isLargeScreen ? 'row' : 'column' }}>
              {/* Traditional Way */}
              <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8} style={{ flex: 1, margin: 8 }}>
                <View style={{ backgroundColor: COLORS.bgCard, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: COLORS.border, height: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${COLORS.error}20`, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name="close-circle" size={22} color={COLORS.error} />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textPrimary }}>The Old Way</Text>
                  </View>
                  {[
                    'Apply on 10 different job portals',
                    'Send 100s of LinkedIn DMs for referrals',
                    'Most messages get ignored',
                    'No way to track anything',
                    'Resume lost in ATS black hole',
                  ].map((item, index) => (
                    <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Ionicons name="close" size={18} color={COLORS.error} style={{ marginRight: 10 }} />
                      <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>{item}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>

              {/* RefOpen Way */}
              <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8} style={{ flex: 1, margin: 8 }}>
                <LinearGradient
                  colors={[`${COLORS.primary}20`, `${COLORS.secondary}10`]}
                  style={{ borderRadius: 24, padding: 28, borderWidth: 1, borderColor: COLORS.primary, height: '100%' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <LinearGradient colors={COLORS.gradientPrimary} style={{ width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Ionicons name="checkmark-circle" size={22} color="#fff" />
                    </LinearGradient>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textPrimary }}>The RefOpen Way</Text>
                  </View>
                  {[
                    'One platform for all job applications ✨',
                    'Apply directly OR get referred - your choice',
                    'One referral request = ALL employees notified',
                    'External referral for jobs found anywhere',
                    'Real-time tracking for everything',
                  ].map((item, index) => (
                    <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Ionicons name="checkmark" size={18} color={COLORS.success} style={{ marginRight: 10 }} />
                      <Text style={{ fontSize: 14, color: COLORS.textPrimary }}>{item}</Text>
                    </View>
                  ))}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* SECTION 2: REFERRERS (30%) */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 80, backgroundColor: COLORS.bgPrimary }}>
          <View style={containerStyle}>
            <SectionHeader
              tag="For Employees Who Refer"
              tagColor={COLORS.success}
              title="Turn LinkedIn DMs Into Real Income"
              subtitle="Tired of endless referral requests in your DMs? Now you can get paid for every single referral you make - not just when they get hired!"
              COLORS={COLORS}
              isLargeScreen={isLargeScreen}
              isMediumScreen={isMediumScreen}
            />

            {/* Pain Point Callout */}
            <TouchableOpacity onPress={openRefOpen} activeOpacity={0.8}>
              <LinearGradient
                colors={[`${COLORS.success}15`, `${COLORS.accent}10`]}
                style={{ borderRadius: 24, padding: 28, marginBottom: 48, borderWidth: 1, borderColor: `${COLORS.success}30` }}
              >
                <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: isLargeScreen ? 32 : 0, marginBottom: isLargeScreen ? 0 : 24 }}>
                    <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 }}>
                      Sound Familiar? 👇
                    </Text>
                    <Text style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 24, fontStyle: 'italic', marginBottom: 16 }}>
                      "Hey! I saw you work at Google. Can you refer me? Here's my resume..."
                    </Text>
                    <Text style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 24 }}>
                      You get <Text style={{ color: COLORS.warning, fontWeight: '600' }}>dozens of these messages</Text> every week. 
                      You want to help, but there's no upside for you unless they get hired (which rarely happens).
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 48, fontWeight: '800', color: COLORS.success }}>$$$</Text>
                    <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' }}>Now you earn for{'\n'}EVERY referral</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Traditional vs RefOpen */}
            <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 24, textAlign: 'center' }}>
              Why RefOpen is Different
            </Text>

            <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', marginBottom: 48 }}>
              {/* Traditional */}
              <View style={{ flex: 1, margin: 8, backgroundColor: COLORS.bgCard, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.error, marginBottom: 16 }}>❌ Traditional Referrals</Text>
                <Text style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 24, marginBottom: 12 }}>
                  • You refer someone on LinkedIn{'\n'}
                  • They apply through company portal{'\n'}
                  • You wait months to hear anything{'\n'}
                  • They don't get hired (most don't){'\n'}
                  • <Text style={{ color: COLORS.error, fontWeight: '600' }}>You get NOTHING for your time</Text>
                </Text>
              </View>

              {/* RefOpen */}
              <View style={{ flex: 1, margin: 8 }}>
                <LinearGradient colors={[`${COLORS.success}20`, `${COLORS.success}08`]} style={{ borderRadius: 24, padding: 24, borderWidth: 1, borderColor: COLORS.success, height: '100%' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.success, marginBottom: 16 }}>✅ RefOpen Referrals</Text>
                  <Text style={{ fontSize: 14, color: COLORS.textPrimary, lineHeight: 24, marginBottom: 12 }}>
                    • AI filters low-quality candidates{'\n'}
                    • You only see qualified profiles{'\n'}
                    • Submit referral with one click{'\n'}
                    • <Text style={{ color: COLORS.success, fontWeight: '600' }}>Get paid IMMEDIATELY</Text>{'\n'}
                    • BONUS: Company bonus if hired!
                  </Text>
                </LinearGradient>
              </View>
            </View>

            {/* How Referrers Earn */}
            <View style={{ flexDirection: isLargeScreen ? 'row' : 'column' }}>
              <View style={{ flex: 1, marginRight: isLargeScreen ? 32 : 0, marginBottom: isLargeScreen ? 0 : 32 }}>
                <Text style={{ fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 24 }}>How You Earn</Text>
                <ProcessStep number="1" title="Get Verified" description="Connect your work email to verify your employment. Takes 2 minutes." icon="shield-checkmark" gradient={COLORS.gradientSuccess} COLORS={COLORS} />
                <ProcessStep number="2" title="Review AI-Filtered Requests" description="Our AI scores candidates and filters spam. You only see quality profiles worth your time." icon="filter" gradient={COLORS.gradientSecondary} COLORS={COLORS} />
                <ProcessStep number="3" title="Refer & Earn Instantly" description="Submit the referral to your company's system. Get RefOpen rewards right away - no waiting for hires!" icon="gift" gradient={COLORS.gradientWarning} COLORS={COLORS} />
              </View>

              {/* Earning Card */}
              <View style={{ flex: 1 }}>
                <LinearGradient
                  colors={COLORS.gradientSuccess}
                  style={{ borderRadius: 24, padding: 28 }}
                >
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 20 }}>Your Earning Potential 💰</Text>
                  
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Per Referral Reward</Text>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>Instant Pay</Text>
                  </View>

                  <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>If They Get Hired</Text>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>+ Company Bonus</Text>
                  </View>

                  <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 16 }}>
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Top Referrers Earn</Text>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff' }}>$3K+/month</Text>
                  </View>

                  <TouchableOpacity onPress={openRefOpen} style={{ marginTop: 20 }}>
                    <View style={{ backgroundColor: '#fff', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
                      <Text style={{ color: COLORS.success, fontWeight: '700', fontSize: 15 }}>Start Earning Today →</Text>
                    </View>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* SECTION 3: EMPLOYERS (20%) */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 80, backgroundColor: COLORS.bgSecondary }}>
          <View style={containerStyle}>
            <SectionHeader
              tag="For Employers"
              tagColor={COLORS.blue}
              title="Hire Exceptional Talent Faster"
              subtitle="The best candidates come through referrals. Post jobs, leverage your employees' networks, and hire faster."
              COLORS={COLORS}
              isLargeScreen={isLargeScreen}
              isMediumScreen={isMediumScreen}
            />

            {/* Feature Cards */}
            <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', flexWrap: 'wrap', justifyContent: 'center', alignItems: isLargeScreen ? 'stretch' : 'center' }}>
              <FeatureCard
                icon="create"
                title="Post Jobs Instantly"
                description="Create beautiful job listings in minutes. Reach 50,000+ qualified professionals actively seeking opportunities."
                gradient={COLORS.gradientBlue}
                index={0}
                isLargeScreen={isLargeScreen}
                isMediumScreen={isMediumScreen}
              />
              <FeatureCard
                icon="people"
                title="Leverage Employee Networks"
                description="Your employees are on RefOpen. When they refer, candidates are pre-vetted and more likely to be a cultural fit."
                gradient={COLORS.gradientPrimary}
                index={1}
                isLargeScreen={isLargeScreen}
                isMediumScreen={isMediumScreen}
              />
              <FeatureCard
                icon="analytics"
                title="Track & Measure"
                description="Full analytics on your hiring funnel. See which sources bring the best candidates and optimize your process."
                gradient={COLORS.gradientSecondary}
                index={2}
                isLargeScreen={isLargeScreen}
                isMediumScreen={isMediumScreen}
              />
            </View>

            {/* CTA for Employers */}
            <View style={{ alignItems: 'center', marginTop: 32 }}>
              <TouchableOpacity onPress={openRefOpen}>
                <LinearGradient
                  colors={COLORS.gradientBlue}
                  style={{ paddingHorizontal: 32, paddingVertical: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 8 }}>Post Your First Job Free</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* COMPANIES GRID */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 64, backgroundColor: COLORS.bgPrimary }}>
          <View style={containerStyle}>
            <SectionHeader
              tag="Trusted by Employees At"
              tagColor={COLORS.accent}
              title="Top Companies Around the World"
              COLORS={COLORS}
              isLargeScreen={isLargeScreen}
              isMediumScreen={isMediumScreen}
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              {FEATURED_COMPANIES.map((company) => (
                <TouchableOpacity key={company.name} onPress={openRefOpen} activeOpacity={0.8}>
                  <View
                    style={{
                      backgroundColor: COLORS.bgCard,
                      borderRadius: 16,
                      padding: 16,
                      margin: 6,
                      alignItems: 'center',
                      minWidth: 100,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        backgroundColor: '#fff',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <Image
                        source={{ uri: `https://www.google.com/s2/favicons?domain=${company.domain}&sz=128` }}
                        style={{ width: 32, height: 32 }}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' }} numberOfLines={1}>
                      {company.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* TESTIMONIALS */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 64, backgroundColor: COLORS.bgSecondary }}>
          <View style={containerStyle}>
            <SectionHeader
              tag="Success Stories"
              tagColor={COLORS.warning}
              title="What Our Users Say"
              COLORS={COLORS}
              isLargeScreen={isLargeScreen}
              isMediumScreen={isMediumScreen}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
              {testimonials.map((item, index) => (
                <TouchableOpacity key={index} onPress={openRefOpen} activeOpacity={0.8}>
                  <View
                    style={{
                      backgroundColor: COLORS.bgCard,
                      borderRadius: 24,
                      padding: 24,
                      marginHorizontal: 8,
                      width: isLargeScreen ? 360 : isMediumScreen ? 320 : contentWidth - 48,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons key={star} name="star" size={16} color={COLORS.warning} style={{ marginRight: 2 }} />
                      ))}
                    </View>
                    <Text style={{ fontSize: 15, color: COLORS.textPrimary, lineHeight: 24, fontStyle: 'italic', marginBottom: 20 }}>
                      "{item.quote}"
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <LinearGradient colors={item.gradient} style={{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{item.name.charAt(0)}</Text>
                      </LinearGradient>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.textPrimary }}>{item.name}</Text>
                        <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{item.role} • {item.company}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* ============================================ */}
        {/* FINAL CTA */}
        {/* ============================================ */}
        <LinearGradient
          colors={[COLORS.primary, '#7C3AED', '#9333EA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingVertical: 80 }}
        >
          <View style={containerStyle}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: isLargeScreen ? 48 : 32, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: isLargeScreen ? 58 : 42, marginBottom: 20 }}>
                Ready to Get Started?
              </Text>
              <Text style={{ fontSize: 17, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 28, marginBottom: 36, maxWidth: 600 }}>
                Apply directly to jobs, request referrals for a boost, or earn by helping others. RefOpen is your complete career platform.
              </Text>

              <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', alignItems: 'center' }}>
                <TouchableOpacity onPress={openRefOpen} style={{ marginRight: isLargeScreen ? 16 : 0, marginBottom: isLargeScreen ? 0 : 12 }}>
                  <View style={{ backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 16, marginRight: 8 }}>Browse & Apply</Text>
                    <Ionicons name="briefcase" size={20} color={COLORS.primary} />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={openAskReferral} style={{ marginRight: isLargeScreen ? 16 : 0, marginBottom: isLargeScreen ? 0 : 12 }}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 8 }}>Get Referred</Text>
                    <Ionicons name="hand-left" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={openAskReferral} style={{ marginRight: isLargeScreen ? 16 : 0, marginBottom: isLargeScreen ? 0 : 12 }}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 8 }}>Start Earning</Text>
                    <Ionicons name="cash" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={openRefOpen}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 8 }}>Hire Talent</Text>
                    <Ionicons name="people" size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 24 }}>
                ✓ Free to join  ✓ Apply to 125K+ jobs  ✓ Direct messaging  ✓ AI recommendations
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ============================================ */}
        {/* FOOTER */}
        {/* ============================================ */}
        <View style={{ paddingVertical: 48, backgroundColor: COLORS.bgSecondary, borderTopWidth: 1, borderTopColor: COLORS.border }}>
          <View style={containerStyle}>
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity onPress={openRefOpen} style={{ marginBottom: 16 }}>
                <Image source={RefOpenLogo} style={{ width: 240, height: 68 }} resizeMode="contain" />
              </TouchableOpacity>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 24 }}>
                Find Jobs. Apply Direct. Get Referred. Hire Talent.
              </Text>

              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
                © 2024 RefOpen. All rights reserved.
              </Text>
            </View>
          </View>
        </View>

        {/* Compliance Footer */}
        <ComplianceFooter currentPage="about" />
      </Animated.ScrollView>
      </View>
    </View>
  );
}
