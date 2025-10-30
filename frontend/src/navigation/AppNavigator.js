import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from '../screens/LoadingScreen';

// Auth Screens
import UserTypeSelectionScreen from '../screens/auth/registration/UserTypeSelectionScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Job Seeker Registration Flow
import ExperienceTypeSelectionScreen from '../screens/auth/registration/jobseeker/ExperienceTypeSelectionScreen';
import WorkExperienceScreen from '../screens/auth/registration/jobseeker/WorkExperienceScreen';
import EducationDetailsScreen from '../screens/auth/registration/jobseeker/EducationDetailsScreen';
import JobPreferencesScreen from '../screens/auth/registration/jobseeker/JobPreferencesScreen';
import PersonalDetailsScreen from '../screens/auth/registration/jobseeker/PersonalDetailsScreen';

// Employer Registration Flow  
import EmployerTypeSelectionScreen from '../screens/auth/registration/employer/EmployerTypeSelectionScreen';
import OrganizationDetailsScreen from '../screens/auth/registration/employer/OrganizationDetailsScreen';
import EmployerPersonalDetailsScreen from '../screens/auth/registration/employer/EmployerPersonalDetailsScreen';
import EmployerAccountScreen from '../screens/auth/registration/employer/EmployerAccountScreen';

// Main App Screens
import HomeScreen from '../screens/HomeScreen';
import JobsScreen from '../screens/jobs/JobsScreen';
import EmployerJobsScreen from '../screens/employer/EmployerJobsScreen'; // NEW: Employer jobs screen
import JobDetailsScreen from '../screens/jobs/JobDetailsScreen';
import CreateJobScreen from '../screens/jobs/CreateJobScreen';
import ApplicationsScreen from '../screens/applications/ApplicationsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import ReferralScreen from '../screens/referral/ReferralScreen';
import AskReferralScreen from '../screens/referral/AskReferralScreen';
import ReferralPlansScreen from '../screens/referral/ReferralPlansScreen';
import PaymentScreen from '../screens/payment/PaymentScreen';
// ?? NEW: Wallet screens
import WalletScreen from '../screens/wallet/WalletScreen';
import WalletTransactionsScreen from '../screens/wallet/WalletTransactionsScreen';
import WalletRechargeScreen from '../screens/wallet/WalletRechargeScreen';

// Legal/Compliance Screens
import TermsScreen from '../screens/legal/TermsScreen';
import PrivacyPolicyScreen from '../screens/legal/PrivacyPolicyScreen';
import RefundPolicyScreen from '../screens/legal/RefundPolicyScreen';
import ShippingDeliveryScreen from '../screens/legal/ShippingDeliveryScreen';
import ContactUsScreen from '../screens/legal/ContactUsScreen';
import AboutUsScreen from '../screens/legal/AboutUsScreen';
import DisclaimerScreen from '../screens/legal/DisclaimerScreen';
import FAQScreen from '../screens/legal/FAQScreen';

import { colors } from '../styles/theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// FIXED: Deep Linking Configuration with unique paths
const linking = {
  prefixes: [
    'refopen://',
    'https://refopen.com',
    'https://www.refopen.com',
  ],
  config: {
    screens: {
      // Public Legal/Compliance screens - accessible without auth
      Terms: 'terms',
      PrivacyPolicy: 'privacy',
      RefundPolicy: 'refund',
      ShippingDelivery: 'shipping',
      ContactUs: 'contact',
      AboutUs: 'about',
      Disclaimer: 'disclaimer',
      FAQ: 'faq',

      // Auth Stack
      Auth: {
      path: 'auth',
     screens: {
          Login: 'login',
 Register: 'register', 
          UserTypeSelection: 'register/select-type',
      
      // Direct skip screens for web navigation
          PersonalDetailsScreenDirect: 'register/complete-profile',
          EmployerAccountScreenDirect: 'register/complete-employer',
   
        // Job Seeker Registration Flow
       JobSeekerFlow: {
   path: 'register/jobseeker',
    screens: {
       ExperienceTypeSelection: 'experience',
    WorkExperienceScreen: 'work',
   EducationDetailsScreen: 'education',
    JobPreferencesScreen: 'preferences',
    PersonalDetails: 'details',
            },
          },
 
    // Employer Registration Flow
    EmployerFlow: {
      path: 'register/employer',
            screens: {
       EmployerTypeSelection: 'type',
       OrganizationDetailsScreen: 'organization',
              EmployerPersonalDetailsScreen: 'details',
              EmployerAccountScreen: 'account',
     },
          },
      },
      },
      
      // Main App Stack - requires authentication
      Main: {
        path: '',
        screens: {
        MainTabs: {
        path: '',
   screens: {
     Home: '',
  Jobs: 'jobs',
    CreateJob: 'create-job',
              Applications: 'applications',
           Referrals: 'referrals',
    Profile: 'profile',
       },
          },
          
     // Modal/Stack screens
   JobDetails: 'job/:jobId',
          AskReferral: 'ask-referral',
       ReferralPlans: 'plans',
     Payment: 'payment',
          
  // Wallet screens
  Wallet: 'wallet',
     WalletTransactions: 'wallet/transactions',
   WalletRecharge: 'wallet/recharge',
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
      <Stack.Screen name="ExperienceTypeSelection" component={ExperienceTypeSelectionScreen} />
      <Stack.Screen name="WorkExperienceScreen" component={WorkExperienceScreen} />
      <Stack.Screen name="EducationDetailsScreen" component={EducationDetailsScreen} />
      <Stack.Screen name="JobPreferencesScreen" component={JobPreferencesScreen} />
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
      <Stack.Screen name="EmployerTypeSelection" component={EmployerTypeSelectionScreen} />
      <Stack.Screen name="OrganizationDetailsScreen" component={OrganizationDetailsScreen} />
      <Stack.Screen name="EmployerPersonalDetailsScreen" component={EmployerPersonalDetailsScreen} />
      <Stack.Screen name="EmployerAccountScreen" component={EmployerAccountScreen} />
    </Stack.Navigator>
  );
}

// Auth Stack Navigator with complete registration flows
function AuthStack() {
  const { hasPendingGoogleAuth, pendingGoogleAuth } = useAuth();

  console.log('AuthStack state:', {
    hasPendingGoogleAuth,
    googleUserEmail: pendingGoogleAuth?.user?.email
  });

  // FIXED: Better initial route logic
  const getInitialRoute = () => {
    if (hasPendingGoogleAuth) {
      console.log('Google auth pending - starting at UserTypeSelection');
      return "UserTypeSelection";
    }
    console.log('No pending auth - starting at Login');
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
        initialParams={hasPendingGoogleAuth ? {
          googleUser: pendingGoogleAuth?.user,
          fromGoogleAuth: true
        } : undefined}
      />
      <Stack.Screen name="JobSeekerFlow" component={JobSeekerFlow} />
      <Stack.Screen name="EmployerFlow" component={EmployerFlow} />
      
      {/* NEW: Add PersonalDetails directly to AuthStack for skip navigation */}
      <Stack.Screen 
        name="PersonalDetailsScreenDirect" 
        component={PersonalDetailsScreen}
        options={{ title: 'Complete Your Profile' }}
      />
      <Stack.Screen 
        name="EmployerAccountScreenDirect" 
        component={EmployerAccountScreen}
        options={{ title: 'Complete Your Profile' }}
      />
    </Stack.Navigator>
  );
}

// Main App Tab Navigator
function MainTabNavigator() {
  const { userType, isEmployer, isJobSeeker } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Jobs') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
          } else if (route.name === 'CreateJob') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Applications') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Referrals') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray500,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.gray200,
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      
      {/* ? FIXED: Use same tab name 'Jobs' for both to avoid deep linking conflicts */}
      <Tab.Screen 
        name="Jobs" 
        component={isEmployer ? EmployerJobsScreen : JobsScreen}
        options={{ title: 'Jobs' }}
      />

      {isEmployer && (
        <Tab.Screen 
          name="CreateJob" 
          component={CreateJobScreen}
          options={{ title: 'Post Job' }}
        />
      )}
      
      <Tab.Screen 
        name="Applications" 
        component={ApplicationsScreen}
        options={{ title: 'Applications' }}
      />
      
      {/* ? CONDITIONAL: Only show Referrals tab for job seekers */}
      {isJobSeeker && (
        <Tab.Screen 
          name="Referrals" 
          component={ReferralScreen}
          options={{ title: 'Referrals' }}
        />
      )}
      
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// Main Stack Navigator with nested Tab Navigator
function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen 
        name="JobDetails" 
        component={JobDetailsScreen}
        options={{ 
          headerShown: true,
title: 'Job Details',
    headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen 
        name="Referral" 
  component={ReferralScreen}
        options={{ 
        headerShown: true,
  title: 'Referral',
          headerBackTitleVisible: false,
        }}
      />
 <Stack.Screen 
        name="AskReferral" 
      component={AskReferralScreen}
        options={{ 
  headerShown: true,
title: 'Ask for Referral',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen 
        name="ReferralPlans" 
        component={ReferralPlansScreen}
     options={{ 
          headerShown: true,
        title: 'Subscription Plans',
      headerBackTitleVisible: false,
  }}
      />
      <Stack.Screen 
        name="Payment" 
        component={PaymentScreen}
        options={{ 
  headerShown: true,
          title: 'Secure Payment',
          headerBackTitleVisible: false,
      }}
      />
{/* ?? NEW: Wallet screens */}
      <Stack.Screen 
  name="Wallet" 
        component={WalletScreen}
        options={{ 
          headerShown: true,
          title: 'My Wallet',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen 
  name="WalletTransactions" 
        component={WalletTransactionsScreen}
        options={{ 
          headerShown: true,
          title: 'Transaction History',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen 
        name="WalletRecharge" 
        component={WalletRechargeScreen}
        options={{ 
      headerShown: true,
          title: 'Add Money to Wallet',
     headerBackTitleVisible: false,
     }}
      />
    </Stack.Navigator>
  );
}

// Root Navigator
export default function AppNavigator() {
  const { loading, isAuthenticated, hasPendingGoogleAuth } = useAuth();

  console.log('AppNavigator state check:', {
    loading,
    isAuthenticated,
    hasPendingGoogleAuth
  });

  // Show loading screen while checking authentication state
  if (loading) {
    return <LoadingScreen />;
  }

  // Determine initial route based on auth state
  const initialRouteName = hasPendingGoogleAuth 
    ? 'Auth' 
    : isAuthenticated 
    ? 'Main' 
    : 'Auth';

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
      console.log('Main screen accessed without auth, redirecting to Auth');
     navigation.navigate('Auth');
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
          title: 'Terms & Conditions',
      headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen 
        name="PrivacyPolicy" 
        component={PrivacyPolicyScreen}
        options={{ 
          headerShown: true,
   title: 'Privacy Policy',
     headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen 
        name="RefundPolicy" 
 component={RefundPolicyScreen}
  options={{ 
          headerShown: true,
title: 'Refund Policy',
          headerBackTitleVisible: false,
     }}
      />
      <Stack.Screen 
        name="ShippingDelivery" 
        component={ShippingDeliveryScreen}
        options={{ 
          headerShown: true,
          title: 'Shipping & Delivery',
          headerBackTitleVisible: false,
   }}
    />
      <Stack.Screen 
      name="ContactUs" 
        component={ContactUsScreen}
        options={{ 
   headerShown: true,
   title: 'Contact Us',
    headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen 
      name="AboutUs" 
    component={AboutUsScreen}
     options={{ 
          headerShown: true,
          title: 'About Us',
          headerBackTitleVisible: false,
    }}
      />
      <Stack.Screen 
        name="Disclaimer" 
     component={DisclaimerScreen}
        options={{ 
          headerShown: true,
          title: 'Disclaimer',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen 
        name="FAQ" 
      component={FAQScreen}
        options={{ 
          headerShown: true,
          title: 'FAQ',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}

// Export linking config for use in App.js
export { linking };