import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Platform } from "react-native";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import refopenAPI from "../services/api";
import LoadingScreen from "../screens/LoadingScreen";

// Auth Screens
import LoginScreen from "../screens/auth/LoginScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import ResetPasswordScreen from "../screens/auth/ResetPasswordScreen";

// Job Seeker Registration Flow
import ExperienceTypeSelectionScreen from "../screens/auth/registration/jobseeker/ExperienceTypeSelectionScreen";
import WorkExperienceScreen from "../screens/auth/registration/jobseeker/WorkExperienceScreen";
import EducationDetailsScreen from "../screens/auth/registration/jobseeker/EducationDetailsScreen";
import PersonalDetailsScreen from "../screens/auth/registration/jobseeker/PersonalDetailsScreen";

// Employer Registration Flow
import EmployerTypeSelectionScreen from "../screens/auth/registration/employer/EmployerTypeSelectionScreen";
import CreateOrganizationScreen from "../screens/auth/registration/employer/CreateOrganizationScreen";
import EmployerPersonalDetailsScreen from "../screens/auth/registration/employer/EmployerPersonalDetailsScreen";
import EmployerAccountScreen from "../screens/auth/registration/employer/EmployerAccountScreen";

// Organization Screen
import OrganizationDetailsScreen from "../screens/organization/OrganizationDetailsScreen";

// Main App Screens
import HomeScreen from "../screens/HomeScreen";
import JobsScreen from "../screens/jobs/JobsScreen";
import SavedJobsScreen from "../screens/jobs/SavedJobsScreen";
import EmployerJobsScreen from "../screens/employer/EmployerJobsScreen"; // NEW: Employer jobs screen
import JobDetailsScreen from "../screens/jobs/JobDetailsScreen";
import AIRecommendedJobsScreen from "../screens/jobs/AIRecommendedJobsScreen"; // NEW: AI Recommended Jobs screen
import CreateJobScreen from "../screens/jobs/CreateJobScreen";
import ApplicationsScreen from "../screens/applications/ApplicationsScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";
import SettingsScreen from "../screens/profile/SettingsScreen";
import ReferralScreen from "../screens/referral/ReferralScreen";
import AskReferralScreen from "../screens/referral/AskReferralScreen";
import MyReferralRequestsScreen from "../screens/referral/MyReferralRequestsScreen";
import ReferralTrackingScreen from "../screens/referral/ReferralTrackingScreen";
import ReferralPlansScreen from "../screens/referral/ReferralPlansScreen";
import PostReferralJobScreen from "../screens/referral/PostReferralJobScreen";
import BecomeReferrerScreen from "../screens/referral/BecomeReferrerScreen";
import PaymentScreen from "../screens/payment/PaymentScreen";
// ?? NEW: Messaging screens
import ConversationsScreen from "../screens/messaging/ConversationsScreen";
import ChatScreen from "../screens/messaging/ChatScreen";
// ?? NEW: Profile viewing screen
import ViewProfileScreen from "../screens/profile/ViewProfileScreen";
// ?? NEW: Profile Views screen (who viewed my profile)
import ProfileViewsScreen from "../screens/ProfileViewsScreen";
// Social Share Rewards
import SocialShareSubmitScreen from "../screens/SocialShareSubmitScreen";
import ShareEarnScreen from "../screens/ShareEarnScreen";
// ?? NEW: Wallet screens
import WalletScreen from "../screens/wallet/WalletScreen";
import WalletTransactionsScreen from "../screens/wallet/WalletTransactionsScreen";
import ManualRechargeScreen from "../screens/wallet/ManualRechargeScreen";
import SubmitPaymentScreen from "../screens/wallet/SubmitPaymentScreen";
import WithdrawalRequestsScreen from "../screens/wallet/WithdrawalRequestsScreen";
import PaymentSuccessScreen from "../screens/wallet/PaymentSuccessScreen";
import WalletHoldsScreen from "../screens/wallet/WalletHoldsScreen";
import PromoCodesScreen from "../screens/wallet/PromoCodesScreen";
import EarningsScreen from "../screens/earnings/EarningsScreen";
import PricingScreen from "../screens/pricing/PricingScreen";

// Legal/Compliance Screens
import TermsScreen from "../screens/legal/TermsScreen";
import PrivacyPolicyScreen from "../screens/legal/PrivacyPolicyScreen";
import AboutUsScreen from "../screens/about/AboutScreen";
import DisclaimerScreen from "../screens/legal/DisclaimerScreen";
import FAQScreen from "../screens/legal/FAQScreen";
import SupportScreen from "../screens/support/SupportScreen";

// Blog Screens (public)
import BlogListScreen from "../screens/blog/BlogListScreen";
import BlogArticleScreen from "../screens/blog/BlogArticleScreen";

// Admin Screens
import AdminActionCenterScreen from "../screens/admin/AdminActionCenterScreen";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import AdminVerificationsScreen from "../screens/admin/AdminVerificationsScreen";
import AdminSocialShareScreen from "../screens/admin/AdminSocialShareScreen";
import AdminPaymentsScreen from "../screens/admin/AdminPaymentsScreen";
import AdminSupportScreen from "../screens/admin/AdminSupportScreen";

// Notifications Screen
import NotificationsScreen from "../screens/NotificationsScreen";

// Tools Screen (Public AI-powered utilities)
import ResumeAnalyzerScreen from "../screens/tools/ResumeAnalyzerScreen";

// Services Screen (Career tools hub for job seekers)
import ServicesScreen from "../screens/ServicesScreen";
import GetVerifiedScreen from "../screens/GetVerifiedScreen";

// Service Placeholder Screens
import ATSBeatSheetScreen from "../screens/services/ATSBeatSheetScreen";
import InterviewDecodedScreen from "../screens/services/InterviewDecodedScreen";
import SalarySpyScreen from "../screens/services/SalarySpyScreen";
import OfferCoachScreen from "../screens/services/OfferCoachScreen";
import LinkedInOptimizerScreen from "../screens/services/LinkedInOptimizerScreen";
import BlindReviewScreen from "../screens/services/BlindReviewScreen";
import CareerSimulatorScreen from "../screens/services/CareerSimulatorScreen";
import MarketPulseScreen from "../screens/services/MarketPulseScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Deep Linking Configuration with unique paths
const linking = {
  prefixes: ["refopen://", "https://refopen.com", "https://www.refopen.com"],
  config: {
    screens: {
      // Public Legal/Compliance screens - accessible without auth
      Terms: "terms",
      PrivacyPolicy: "privacy",
      AboutUs: "about",
      Disclaimer: "disclaimer",
      FAQ: "faq",
      Pricing: "pricing",
      Support: "support",
      
      // Public Tools screens - accessible without auth
      // Primary SEO-friendly path (short and memorable)
      ResumeAnalyzer: "resume-analyzer",
      
      // Service sub-screens (public Stack.Screens at root)
      ATSBeatSheet: "services/resume-builder",
      InterviewDecoded: "services/interview-prep",
      SalarySpy: "services/salary-spy",
      OfferCoach: "services/offer-coach",
      LinkedInOptimizer: "services/linkedin-optimizer",
      BlindReview: "services/blind-review",
      CareerSimulator: "services/career-simulator",
      MarketPulse: "services/market-pulse",
      
      // Public Blog screens - accessible without auth
      Blog: "blog",
      BlogArticle: "blog/:articleId",
      
      // Public Job Details screen - accessible without auth but actions require login
      JobDetailsPublic: "job/:jobId",
      
      // Public Ask Referral screen - accessible without auth but actions require login
      AskReferralPublic: "ask-referral",
      
      // Public password reset - accessible without auth
      ResetPassword: "reset-password",
      ForgotPassword: "forgot-password",

      // Auth Stack
      Auth: {
        path: "auth",
        screens: {
          Login: "login",
          ForgotPassword: "forgot-password",
          ResetPassword: "reset-password",

          // Direct skip screens for web navigation
          PersonalDetailsScreenDirect: "register/complete-profile",
          EmployerAccountScreenDirect: "register/complete-employer",

          // Job Seeker Registration Flow
          JobSeekerFlow: {
            path: "register/jobseeker",
            screens: {
              ExperienceTypeSelection: "experience",
              WorkExperienceScreen: "work",
              EducationDetailsScreen: "education",
              PersonalDetails: "details",
            },
          },

          // Employer Registration Flow
          EmployerFlow: {
            path: "register/employer",
            screens: {
              EmployerTypeSelection: "type",
              OrganizationDetailsScreen: "organization",
              EmployerPersonalDetailsScreen: "details",
              EmployerAccountScreen: "account",
            },
          },
        },
      },

      // Main App Stack - requires authentication
      Main: {
        path: "",
        screens: {
          MainTabs: {
            path: "",
            screens: {
              Home: "",
              Jobs: "jobs",
              CreateJob: "create-job",
              AskReferral: "ask-for-referral",
              Notifications: "notifications",
              Admin: {
                path: "admin/:tab?",
                parse: {
                  tab: (tab) => tab || 'overview',
                },
                stringify: {
                  tab: (tab) => tab === 'overview' ? '' : tab,
                },
              },
              ActionCenter: "action-center",
              Services: "services",
            },
          },

          // Profile screen (slides from Home)
          Profile: "profile",

          // Modal/Stack screens
          JobDetails: "job-details/:jobId",
          AIRecommendedJobs: "ai-jobs",
          SavedJobs: "saved-jobs",
          Applications: "applications",
          Messages: "messages",
          ViewProfile: "profile/:userId",
          Chat: "chat/:conversationId",
          ReferralPlans: "plans",
          Payment: "payment",
          MyReferralRequests: "referrals/my-requests",
          ReferralTracking: "referrals/tracking/:requestId",
          Settings: "settings",
          
          // Organization screen with organizationId parameter
          OrganizationDetails: "OrganizationDetails/:organizationId",
          
          // Post referral job with organizationId
          PostReferralJob: "PostReferralJob/:organizationId",
          
          // Become a verified referrer
          BecomeReferrer: "become-referrer",
          
          // Provide Referral (verified referrers)
          Referral: "provide-referral",
          
          // Get Verified (blue tick)
          GetVerified: "get-verified",
          
          // Employer Jobs screen for verified referrers to view their draft/published jobs
          EmployerJobs: "my-jobs",

          // Wallet screens
          Wallet: "wallet",
          WalletTransactions: "wallet/transactions",
          WalletRecharge: "wallet/recharge",
          ManualRecharge: "wallet/manual-recharge",
          SubmitPayment: "wallet/submit-payment",
          WithdrawalRequests: "wallet/withdrawals",
          PaymentSuccess: "wallet/payment-success",
          WalletHolds: "wallet/holds",
          PromoCodes: "promo-codes",
          
          // Profile Views screen
          ProfileViews: "ProfileViews",
          
          // Share & Earn screen
          ShareEarn: "share-earn",
          // Earnings / Referrer Dashboard
          Earnings: "earnings",
          // Social Share Submit screen with platform parameter
          SocialShareSubmit: "SocialShareSubmit",

          // Admin Action Center sub-screens (stack screens, not tabs)
          AdminVerifications: "admin-verifications",
          AdminSocialShare: "admin-social-share",
          AdminPayments: "admin-payments",
          AdminSupport: "admin-support",

        },
      },
    },
  },
};

// Job Seeker Registration Flow
function JobSeekerFlow() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      <Stack.Screen
        name="ExperienceTypeSelection"
        component={ExperienceTypeSelectionScreen}
      />
      <Stack.Screen
        name="WorkExperienceScreen"
        component={WorkExperienceScreen}
      />
      <Stack.Screen
        name="EducationDetailsScreen"
        component={EducationDetailsScreen}
      />
      <Stack.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
    </Stack.Navigator>
  );
}

// Employer Registration Flow
function EmployerFlow() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      <Stack.Screen
        name="EmployerTypeSelection"
        component={EmployerTypeSelectionScreen}
      />
      <Stack.Screen
        name="CreateOrganizationScreen"
        component={CreateOrganizationScreen}
      />
      <Stack.Screen
        name="EmployerPersonalDetailsScreen"
        component={EmployerPersonalDetailsScreen}
      />
      <Stack.Screen
        name="EmployerAccountScreen"
        component={EmployerAccountScreen}
      />
    </Stack.Navigator>
  );
}

// Auth Stack Navigator with complete registration flows
function AuthStack() {
  const { hasPendingGoogleAuth, pendingGoogleAuth } = useAuth();
  const { colors } = useTheme();


  // FIXED: Better initial route logic
  const getInitialRoute = () => {
    if (hasPendingGoogleAuth) {
      return "JobSeekerFlow";
    }
    return "Login";
  };

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
      initialRouteName={getInitialRoute()}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign In - RefOpen Job Referral Platform' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen
        name="JobSeekerFlow"
        component={JobSeekerFlow}
        initialParams={
          hasPendingGoogleAuth
            ? {
                screen: "ExperienceTypeSelection",
                params: {
                  userType: "JobSeeker",
                  fromGoogleAuth: true,
                  googleUser: pendingGoogleAuth?.user,
                },
              }
            : undefined
        }
      />
      <Stack.Screen
        name="EmployerFlow"
        component={EmployerFlow}
        initialParams={
          hasPendingGoogleAuth
            ? {
                screen: "EmployerTypeSelection",
                params: {
                  userType: "Employer",
                  fromGoogleAuth: true,
                  googleUser: pendingGoogleAuth?.user,
                },
              }
            : undefined
        }
      />

      {/* NEW: Add PersonalDetails directly to AuthStack for skip navigation */}
      <Stack.Screen
        name="PersonalDetailsScreenDirect"
        component={PersonalDetailsScreen}
        options={{ title: "Complete Your Profile" }}
      />
      <Stack.Screen
        name="EmployerAccountScreenDirect"
        component={EmployerAccountScreen}
        options={{ title: "Complete Your Profile" }}
      />
    </Stack.Navigator>
  );
}

// Main App Tab Navigator
function MainTabNavigator() {
  const { userType, isEmployer, isJobSeeker, isAdmin, isVerifiedReferrer } = useAuth();
  const { colors } = useTheme();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const pollRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await refopenAPI.apiCall('/notifications/unread-count');
      if (res.success) {
        setUnreadNotifications(res.data?.count || 0);
      }
    } catch (e) {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    pollRef.current = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchUnreadCount]);

  // ⚡ PERF: Memoize screenOptions — without this, every 30s notification poll
  // creates a new screenOptions function, causing React Navigation to re-evaluate all tabs.
  const screenOptions = useMemo(() => ({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Jobs") {
            iconName = focused ? "briefcase" : "briefcase-outline";
          } else if (route.name === "CreateJob") {
            iconName = focused ? "add-circle" : "add-circle-outline";
          } else if (route.name === "AskReferral") {
            iconName = focused ? "person-add" : "person-add-outline";
          } else if (route.name === "Services") {
            iconName = focused ? "grid" : "grid-outline";
          } else if (route.name === "Notifications") {
            iconName = focused ? "notifications" : "notifications-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          } else if (route.name === "ActionCenter") {
            iconName = focused ? "flash" : "flash-outline";
          } else if (route.name === "Admin") {
            iconName = focused ? "stats-chart" : "stats-chart-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray500,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 84 : Platform.OS === 'web' ? 52 : 58,
          paddingBottom: Platform.OS === 'ios' ? 28 : Platform.OS === 'web' ? 4 : 6,
          paddingTop: Platform.OS === 'web' ? 4 : 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginBottom: Platform.OS === 'android' ? 2 : 0,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
        },
        headerShown: false,
        lazy: Platform.OS === 'web',
        freezeOnBlur: false,
        detachInactiveScreens: false,
        ...(Platform.OS !== 'web' ? { animationEnabled: false } : {}),
      }), [colors]);

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      {/* Show Home tab for all users including Admin */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "Home" }}
      />

      {/* FIXED: Use same tab name 'Jobs' for both to avoid deep linking conflicts */}
      {/* Hide Jobs tab for Admin users */}
      {!isAdmin && (
        <Tab.Screen
          name="Jobs"
          component={isEmployer ? EmployerJobsScreen : JobsScreen}
          options={{ title: "Jobs" }}
        />
      )}

      {isEmployer && (
        <Tab.Screen
          name="CreateJob"
          component={CreateJobScreen}
          options={{ title: "Post Job" }}
        />
      )}

      {isJobSeeker && (
        <Tab.Screen
          name="AskReferral"
          component={AskReferralScreen}
          options={{ title: "Ask Referral" }}
        />
      )}

      {/* All job seekers see Services tab */}
      {isJobSeeker && (
        <Tab.Screen
          name="Services"
          component={ServicesScreen}
          options={{ 
            title: "Services",
          }}
        />
      )}

      {isAdmin && (
        <Tab.Screen
          name="ActionCenter"
          component={AdminActionCenterScreen}
          options={{ title: "Action Center" }}
        />
      )}

      {isAdmin && (
        <Tab.Screen
          name="Admin"
          component={AdminDashboardScreen}
          options={{ title: "Analytics" }}
        />
      )}

      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: "Notifications",
          tabBarBadge: unreadNotifications > 0 ? (unreadNotifications > 99 ? '99+' : unreadNotifications) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#EF4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            lineHeight: 18,
          },
        }}
        listeners={{
          tabPress: () => {
            // Re-fetch after a short delay (screen will mark-all-read)
            setTimeout(fetchUnreadCount, 2000);
          },
        }}
      />
    </Tab.Navigator>
  );
}

// Main Stack Navigator with nested Tab Navigator
function MainStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="JobDetails"
        component={JobDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AIRecommendedJobs"
        component={AIRecommendedJobsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SavedJobs"
        component={SavedJobsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Applications"
        component={ApplicationsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MyReferralRequests"
        component={MyReferralRequestsScreen}
        options={{ headerShown: false }}
      />
      {/* ?? NEW: Referral Tracking screen */}
      <Stack.Screen
        name="ReferralTracking"
        component={ReferralTrackingScreen}
        options={{ headerShown: false }}
      />
      {/* ?? NEW: Chat screen for messaging */}
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: false, // Custom header in component
        }}
      />
      {/* 🆕 NEW: Messages/Conversations screen */}
      <Stack.Screen
        name="Messages"
        component={ConversationsScreen}
        options={{
          headerShown: false, // Custom header in component for sticky behavior on web
        }}
      />
      {/* ?? NEW: View other user's profile */}
      <Stack.Screen
        name="ViewProfile"
        component={ViewProfileScreen}
        options={{
          headerShown: false, // Custom header in component
        }}
      />
      {/* Settings Screen */}
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerShown: false, // Custom header in component
        }}
      />
      {/* ?? NEW: Profile Views - Who viewed my profile */}
      <Stack.Screen
        name="ProfileViews"
        component={ProfileViewsScreen}
        options={{
          headerShown: false, // Custom header in component
        }}
      />
      {/* Share & Earn Screen */}
      <Stack.Screen
        name="ShareEarn"
        component={ShareEarnScreen}
        options={{
          headerShown: false,
        }}
      />
      {/* Social Share Rewards - Submit social media posts for rewards */}
      <Stack.Screen
        name="SocialShareSubmit"
        component={SocialShareSubmitScreen}
        options={{
          headerShown: false,
        }}
      />
      {/* Organization Details Screen */}
      <Stack.Screen
        name="OrganizationDetails"
        component={OrganizationDetailsScreen}
        options={{ headerShown: false }}
      />
      {/* Admin Dashboard - Admin only */}
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminVerifications"
        component={AdminVerificationsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminSocialShare"
        component={AdminSocialShareScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminPayments"
        component={AdminPaymentsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminSupport"
        component={AdminSupportScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Referral"
        component={ReferralScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AskReferral"
        component={AskReferralScreen}
        options={{
          headerShown: false, // Custom sticky header in component
        }}
      />
      <Stack.Screen
        name="ReferralPlans"
        component={ReferralPlansScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BecomeReferrer"
        component={BecomeReferrerScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GetVerified"
        component={GetVerifiedScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PostReferralJob"
        component={PostReferralJobScreen}
        options={{ headerShown: false }}
      />
      {/* EmployerJobs - Separate stack screen for verified referrers to view their draft/published jobs */}
      <Stack.Screen
        name="EmployerJobs"
        component={EmployerJobsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ headerShown: false }}
      />
      {/* NEW: Wallet screens */}
      <Stack.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="WalletTransactions"
        component={WalletTransactionsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="WalletRecharge"
        component={ManualRechargeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SubmitPayment"
        component={SubmitPaymentScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="WithdrawalRequests"
        component={WithdrawalRequestsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PaymentSuccess"
        component={PaymentSuccessScreen}
        options={{
          headerShown: false,
          title: "Payment Successful",
          gestureEnabled: false, // Prevent swipe back
        }}
      />
      <Stack.Screen
        name="WalletHolds"
        component={WalletHoldsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PromoCodes"
        component={PromoCodesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// Root Navigator
export default function AppNavigator() {
  const { loading, isAuthenticated, hasPendingGoogleAuth } = useAuth();
  const { colors } = useTheme();


  // Show loading screen while checking authentication state
  if (loading) {
    return <LoadingScreen />;
  }

  // Determine initial route based on auth state
  // Logged-out users land on About page first (like a landing page)
  const initialRouteName = hasPendingGoogleAuth
    ? "Auth"
    : isAuthenticated
    ? "Main"
    : "AboutUs";

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      {/* Auth Stack - always present for deep linking */}
      <Stack.Screen
        name="Auth"
        component={AuthStack}
        options={{ headerShown: false }}
      />

      {/* Main App Stack - only registered when authenticated.
          This prevents '/' deep link from matching Main when logged out,
          so initialRouteName='AboutUs' takes effect with zero flicker. */}
      {isAuthenticated && (
        <Stack.Screen
          name="Main"
          component={MainStack}
          options={{ headerShown: false }}
        />
      )}

      {/* Public Legal/Compliance Routes - Always accessible */}
      <Stack.Screen
        name="Terms"
        component={TermsScreen}
        options={{ headerShown: false, title: 'Terms of Service' }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ headerShown: false, title: 'Privacy Policy' }}
      />
      <Stack.Screen
        name="AboutUs"
        component={AboutUsScreen}
        options={{
          headerShown: false,
          title: "About RefOpen - AI-Powered Job Referral Platform",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="Disclaimer"
        component={DisclaimerScreen}
        options={{ headerShown: false, title: 'Disclaimer' }}
      />
      <Stack.Screen
        name="FAQ"
        component={FAQScreen}
        options={{ headerShown: false, title: 'Frequently Asked Questions' }}
      />
      <Stack.Screen
        name="Pricing"
        component={PricingScreen}
        options={{
          headerShown: false,
          title: "Pricing - RefOpen Referral & AI Tools",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="Blog"
        component={BlogListScreen}
        options={{
          headerShown: false,
          title: "Career Blog - Job Search Tips & Advice",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="BlogArticle"
        component={BlogArticleScreen}
        options={{
          headerShown: false,
          title: "Blog Article",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{ headerShown: false, title: 'Help & Support' }}
      />
      
      {/* Public Resume Analyzer Tool - accessible without auth */}
      <Stack.Screen
        name="ResumeAnalyzer"
        component={ResumeAnalyzerScreen}
        options={{
          headerShown: false,
          title: "Resume Analyzer - AI Job Match Tool",
          headerBackTitleVisible: false,
        }}
      />

      {/* Service Screens */}
      <Stack.Screen name="ATSBeatSheet" component={ATSBeatSheetScreen} options={{ headerShown: false, title: 'ATS Resume Builder - Beat Tracking Systems' }} />
      <Stack.Screen name="InterviewDecoded" component={InterviewDecodedScreen} options={{ headerShown: false, title: 'Interview Prep - AI Mock Practice' }} />
      <Stack.Screen name="SalarySpy" component={SalarySpyScreen} options={{ headerShown: false, title: 'Salary Checker - Know Your Worth' }} />
      <Stack.Screen name="OfferCoach" component={OfferCoachScreen} options={{ headerShown: false, title: 'Offer Negotiation Coach' }} />
      <Stack.Screen name="LinkedInOptimizer" component={LinkedInOptimizerScreen} options={{ headerShown: false, title: 'LinkedIn Profile Optimizer' }} />
      <Stack.Screen name="BlindReview" component={BlindReviewScreen} options={{ headerShown: false, title: 'Blind Resume Review' }} />
      <Stack.Screen name="CareerSimulator" component={CareerSimulatorScreen} options={{ headerShown: false, title: 'Career Path Simulator' }} />
      <Stack.Screen name="MarketPulse" component={MarketPulseScreen} options={{ headerShown: false, title: 'Job Market Pulse - Hiring Trends' }} />
      
      {/* Public Ask Referral Screen - accessible without auth but actions require login */}
      <Stack.Screen
        name="AskReferralPublic"
        component={AskReferralScreen}
        options={{ headerShown: false, title: 'Ask for Referral' }}
      />
      
      {/* Public Job Details Screen - accessible without auth but actions require login */}
      <Stack.Screen
        name="JobDetailsPublic"
        component={JobDetailsScreen}
        options={{ headerShown: false, title: 'Job Details' }}
      />
      
      {/* Public Password Reset Screens - accessible without auth */}
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{
          headerShown: false,
          title: "Reset Password",
        }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          headerShown: false,
          title: "Forgot Password",
        }}
      />
    </Stack.Navigator>
  );
}

// Export linking config for use in App.js
export { linking };
