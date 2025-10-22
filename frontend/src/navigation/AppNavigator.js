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

import { colors } from '../styles/theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// FIXED: Deep Linking Configuration with unique paths
const linking = {
  prefixes: [
    'nexhire://',
    'https://nexhire.com',
    'https://www.nexhire.com',
  ],
  config: {
    screens: {
      // Auth screens - no nesting conflicts
      Login: 'login',
      Register: 'register', 
      UserTypeSelection: 'register/select-type',
      
      // NEW: Direct skip screens for web navigation
      PersonalDetailsScreenDirect: 'register/complete-profile',
      EmployerAccountScreenDirect: 'register/complete-employer',
      
      // Job Seeker Registration Flow - unique paths
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
      
      // Employer Registration Flow - unique paths
      EmployerFlow: {
        path: 'register/employer',
        screens: {
          EmployerTypeSelection: 'type',
          OrganizationDetailsScreen: 'organization',
          EmployerPersonalDetailsScreen: 'details',
          EmployerAccountScreen: 'account',
        },
      },
      
      // Main App - simplified structure
      // ? FIXED: Only define the paths that actually exist in the tab navigator
      // Since Jobs/EmployerJobs are conditionally rendered, we don't need to define both
      MainTabs: {
        path: '',
        screens: {
          Home: '',
          Jobs: 'jobs', // This will match whichever screen is actually rendered (Jobs or EmployerJobs)
          CreateJob: 'create-job',
          Applications: 'applications',
          Referrals: 'referrals',
          Profile: 'profile',
        },
      },
      
      // Modal/Stack screens - unique paths
      JobDetails: 'job/:jobId',
      AskReferral: 'ask-referral',
      ReferralPlans: 'plans',
      Payment: 'payment',
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

  // FIXED: Better logic for handling Google registration flow
  // Priority:
  // 1. If user has pending Google auth (new Google user) -> show AuthStack to complete registration
  // 2. If user is authenticated and no pending Google auth -> show MainStack 
  // 3. Otherwise -> show AuthStack for login/registration

  if (hasPendingGoogleAuth) {
    console.log('Pending Google auth detected - showing registration flow');
    return <AuthStack />;
  }

  if (isAuthenticated) {
    console.log('? User authenticated - showing main app');
    return <MainStack />;
  }

  console.log('User not authenticated - showing auth flow');
  return <AuthStack />;
}

// Export linking config for use in App.js
export { linking };