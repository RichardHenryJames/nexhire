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
import JobDetailsScreen from '../screens/jobs/JobDetailsScreen';
import CreateJobScreen from '../screens/jobs/CreateJobScreen';
import ApplicationsScreen from '../screens/applications/ApplicationsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import ReferralScreen from '../screens/referral/ReferralScreen';
import ReferralPlansScreen from '../screens/referral/ReferralPlansScreen';
import PaymentScreen from '../screens/payment/PaymentScreen';

import { colors } from '../styles/theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

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
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="UserTypeSelection" component={UserTypeSelectionScreen} />
      <Stack.Screen name="JobSeekerFlow" component={JobSeekerFlow} />
      <Stack.Screen name="EmployerFlow" component={EmployerFlow} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// Main App Tab Navigator
function MainTabNavigator() {
  const { userType, isEmployer } = useAuth();

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
      <Tab.Screen 
        name="Jobs" 
        component={JobsScreen}
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
      {/* NEW: Referrals Tab - positioned between Applications and Profile */}
      <Tab.Screen 
        name="Referrals" 
        component={ReferralScreen}
        options={{ title: 'Referrals' }}
      />
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
  const { loading, isAuthenticated } = useAuth();

  // Show loading screen while checking authentication state
  if (loading) {
    return <LoadingScreen />;
  }

  // Show appropriate stack based on authentication state
  return isAuthenticated ? <MainStack /> : <AuthStack />;
}