import React from "react";
import { TouchableOpacity, Platform } from "react-native";
import { createStackNavigator, CardStyleInterpolators } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import LoadingScreen from "../screens/LoadingScreen";

// Auth Screens
import UserTypeSelectionScreen from "../screens/auth/registration/UserTypeSelectionScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";

// Job Seeker Registration Flow
import ExperienceTypeSelectionScreen from "../screens/auth/registration/jobseeker/ExperienceTypeSelectionScreen";
import WorkExperienceScreen from "../screens/auth/registration/jobseeker/WorkExperienceScreen";
import EducationDetailsScreen from "../screens/auth/registration/jobseeker/EducationDetailsScreen";
import JobPreferencesScreen from "../screens/auth/registration/jobseeker/JobPreferencesScreen";
import PersonalDetailsScreen from "../screens/auth/registration/jobseeker/PersonalDetailsScreen";

// Employer Registration Flow
import EmployerTypeSelectionScreen from "../screens/auth/registration/employer/EmployerTypeSelectionScreen";
import EmployerOrganizationDetailsScreen from "../screens/auth/registration/employer/OrganizationDetailsScreen";
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
import ProfileScreen from "../screens/profile/ProfileScreenNew";
import SettingsScreen from "../screens/profile/SettingsScreen";
import ReferralScreen from "../screens/referral/ReferralScreen";
import AskReferralScreen from "../screens/referral/AskReferralScreen";
import MyReferralRequestsScreen from "../screens/referral/MyReferralRequestsScreen";
import ReferralPlansScreen from "../screens/referral/ReferralPlansScreen";
import PaymentScreen from "../screens/payment/PaymentScreen";
// ?? NEW: Messaging screens
import ConversationsScreen from "../screens/messaging/ConversationsScreen";
import ChatScreen from "../screens/messaging/ChatScreen";
// ?? NEW: Profile viewing screen
import ViewProfileScreen from "../screens/profile/ViewProfileScreen";
// ?? NEW: Profile Views screen (who viewed my profile)
import ProfileViewsScreen from "../screens/ProfileViewsScreen";
// ?? NEW: Wallet screens
import WalletScreen from "../screens/wallet/WalletScreen";
import WalletTransactionsScreen from "../screens/wallet/WalletTransactionsScreen";
import WalletRechargeScreen from "../screens/wallet/WalletRechargeScreen";

// Legal/Compliance Screens
import TermsScreen from "../screens/legal/TermsScreen";
import PrivacyPolicyScreen from "../screens/legal/PrivacyPolicyScreen";
import RefundPolicyScreen from "../screens/legal/RefundPolicyScreen";
import ShippingDeliveryScreen from "../screens/legal/ShippingDeliveryScreen";
import ContactUsScreen from "../screens/legal/ContactUsScreen";
import AboutUsScreen from "../screens/legal/AboutUsScreen";
import DisclaimerScreen from "../screens/legal/DisclaimerScreen";
import FAQScreen from "../screens/legal/FAQScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// FIXED: Deep Linking Configuration with unique paths
const linking = {
  prefixes: ["refopen://", "https://refopen.com", "https://www.refopen.com"],
  config: {
    screens: {
      // Public Legal/Compliance screens - accessible without auth
      Terms: "terms",
      PrivacyPolicy: "privacy",
      RefundPolicy: "refund",
      ShippingDelivery: "shipping",
      ContactUs: "contact",
      AboutUs: "about",
      Disclaimer: "disclaimer",
      FAQ: "faq",

      // Auth Stack
      Auth: {
        path: "auth",
        screens: {
          Login: "login",
          Register: "register",
          UserTypeSelection: "register/select-type",

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
              JobPreferencesScreen: "preferences",
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
              AskReferral: "ask-referral",
              Referrals: "referrals",
              Profile: "profile",
            },
          },

          // Modal/Stack screens
          JobDetails: "job/:jobId",
          AIRecommendedJobs: "ai-jobs",
          SavedJobs: "saved-jobs",
          Applications: "applications",
          Messages: "messages",
          ViewProfile: "profile/:userId",
          Chat: "chat/:conversationId",
          ReferralPlans: "plans",
          Payment: "payment",
          MyReferralRequests: "referrals/my-requests",
          Settings: "settings",
          
          // Organization screen with organizationId parameter
          OrganizationDetails: "OrganizationDetails/:organizationId",

          // Wallet screens
          Wallet: "wallet",
          WalletTransactions: "wallet/transactions",
          WalletRecharge: "wallet/recharge",
          
          // Profile Views screen
          ProfileViews: "ProfileViews",
        },
      },
    },
  },
};

// Job Seeker Registration Flow
function JobSeekerFlow() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
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
      <Stack.Screen
        name="JobPreferencesScreen"
        component={JobPreferencesScreen}
      />
      <Stack.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
    </Stack.Navigator>
  );
}

// Employer Registration Flow
function EmployerFlow() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="EmployerTypeSelection"
        component={EmployerTypeSelectionScreen}
      />
      <Stack.Screen
        name="OrganizationDetailsScreen"
        component={EmployerOrganizationDetailsScreen}
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
      }}
      initialRouteName={getInitialRoute()}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen
        name="UserTypeSelection"
        component={UserTypeSelectionScreen}
        // Pass Google user data automatically when coming from Google auth
        initialParams={
          hasPendingGoogleAuth
            ? {
                googleUser: pendingGoogleAuth?.user,
                fromGoogleAuth: true,
              }
            : undefined
        }
      />
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
  const { userType, isEmployer, isJobSeeker } = useAuth();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
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
          } else if (route.name === "Referrals") {
            iconName = focused ? "people" : "people-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray500,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
          ...(Platform.OS === 'web'
            ? {
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
              }
            : null),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "Home" }}
      />

      {/* FIXED: Use same tab name 'Jobs' for both to avoid deep linking conflicts */}
      <Tab.Screen
        name="Jobs"
        component={isEmployer ? EmployerJobsScreen : JobsScreen}
        options={{ title: "Jobs" }}
      />

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

      {isJobSeeker && (
        <Tab.Screen
          name="Referrals"
          component={ReferralScreen}
          options={{ title: "Requests" }}
        />
      )}

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile" }}
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
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="ProfileFromHome"
        component={ProfileScreen}
        initialParams={{ openedFromHome: true }}
        options={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: "horizontal-inverted",
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <Stack.Screen
        name="JobDetails"
        component={JobDetailsScreen}
        options={{
          headerShown: true,
          title: "Job Details",
          headerBackTitleVisible: false,
        }}
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
        options={{
          headerShown: true,
          title: "Saved Jobs",
          headerBackTitleVisible: false,
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            color: colors.text,
          },
        }}
      />
      <Stack.Screen
        name="Applications"
        component={ApplicationsScreen}
        options={{
          headerShown: true,
          title: "My Applications",
          headerBackTitleVisible: false,
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            color: colors.text,
          },
        }}
      />
      <Stack.Screen
        name="MyReferralRequests"
        component={MyReferralRequestsScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: "My Requests",
          headerBackTitleVisible: false,
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            color: colors.text,
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                const navState = navigation.getState();
                const routes = navState?.routes || [];
                const currentIndex = navState?.index || 0;

                if (navigation.canGoBack() && routes.length > 1 && currentIndex > 0) {
                  navigation.goBack();
                  return;
                }

                navigation.navigate('Main', {
                  screen: 'MainTabs',
                  params: {
                    screen: 'AskReferral',
                  },
                });
              }}
              style={{ paddingLeft: 16 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        })}
      />
      {/* ?? NEW: Chat screen for messaging */}
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: false, // Custom header in component
        }}
      />
      {/* ?? NEW: Messages/Conversations screen */}
      <Stack.Screen
        name="Messages"
        component={ConversationsScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: "Messages",
          headerBackTitleVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                const navState = navigation.getState();
                const routes = navState?.routes || [];
                const currentIndex = navState?.index || 0;
                
                // If we have more than 1 route in the stack, go back normally
                if (routes.length > 1 && currentIndex > 0) {
                  navigation.goBack();
                } else {
                  // Hard refresh scenario - navigate to Home tab
                  navigation.navigate('Main', {
                    screen: 'MainTabs',
                    params: {
                      screen: 'Home'
                    }
                  });
                }
              }}
              style={{ paddingLeft: 16 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        })}
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
      {/* Organization Details Screen */}
      <Stack.Screen
        name="OrganizationDetails"
        component={OrganizationDetailsScreen}
        options={{
          headerShown: true,
          title: "Company Details",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="Referral"
        component={ReferralScreen}
        options={{
          headerShown: true,
          title: "Referral",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="AskReferral"
        component={AskReferralScreen}
        options={{
          headerShown: true,
          title: "Ask for Referral",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="ReferralPlans"
        component={ReferralPlansScreen}
        options={{
          headerShown: true,
          title: "Subscription Plans",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{
          headerShown: true,
          title: "Secure Payment",
          headerBackTitleVisible: false,
        }}
      />
      {/* NEW: Wallet screens */}
      <Stack.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          headerShown: true,
          title: "My Wallet",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="WalletTransactions"
        component={WalletTransactionsScreen}
        options={{
          headerShown: true,
          title: "Transaction History",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="WalletRecharge"
        component={WalletRechargeScreen}
        options={{
          headerShown: true,
          title: "Add Money to Wallet",
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}

// Root Navigator
export default function AppNavigator() {
  const { loading, isAuthenticated, hasPendingGoogleAuth } = useAuth();


  // Show loading screen while checking authentication state
  if (loading) {
    return <LoadingScreen />;
  }

  // Determine initial route based on auth state
  const initialRouteName = hasPendingGoogleAuth
    ? "Auth"
    : isAuthenticated
    ? "Main"
    : "Auth";

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Auth Stack - always present for deep linking */}
      <Stack.Screen
        name="Auth"
        component={AuthStack}
        options={{ headerShown: false }}
      />

      {/* Main App Stack - protected, requires authentication */}
      <Stack.Screen
        name="Main"
        component={MainStack}
        options={{ headerShown: false }}
        listeners={({ navigation }) => ({
          focus: () => {
            // Redirect to Auth if not authenticated
            if (!isAuthenticated) {
              navigation.navigate("Auth");
            }
          },
        })}
      />

      {/* Public Legal/Compliance Routes - Always accessible */}
      <Stack.Screen
        name="Terms"
        component={TermsScreen}
        options={{
          headerShown: true,
          title: "Terms & Conditions",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          headerShown: true,
          title: "Privacy Policy",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="RefundPolicy"
        component={RefundPolicyScreen}
        options={{
          headerShown: true,
          title: "Refund Policy",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="ShippingDelivery"
        component={ShippingDeliveryScreen}
        options={{
          headerShown: true,
          title: "Shipping & Delivery",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="ContactUs"
        component={ContactUsScreen}
        options={{
          headerShown: true,
          title: "Contact Us",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="AboutUs"
        component={AboutUsScreen}
        options={{
          headerShown: true,
          title: "About Us",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="Disclaimer"
        component={DisclaimerScreen}
        options={{
          headerShown: true,
          title: "Disclaimer",
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="FAQ"
        component={FAQScreen}
        options={{
          headerShown: true,
          title: "FAQ",
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}

// Export linking config for use in App.js
export { linking };
