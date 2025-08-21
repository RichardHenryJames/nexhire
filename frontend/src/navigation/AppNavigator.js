import React from 'react';
import { View, Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { colors } from '../styles/theme';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import UserTypeSelectionScreen from '../screens/auth/registration/UserTypeSelectionScreen';

// Job Seeker Registration Flow
import ExperienceTypeSelectionScreen from '../screens/auth/registration/jobseeker/ExperienceTypeSelectionScreen';
import EducationDetailsScreen from '../screens/auth/registration/jobseeker/EducationDetailsScreen';
import JobPreferencesScreen from '../screens/auth/registration/jobseeker/JobPreferencesScreen';
import PersonalDetailsScreen from '../screens/auth/registration/jobseeker/PersonalDetailsScreen';

// Employer Registration Flow
import EmployerTypeSelectionScreen from '../screens/auth/registration/employer/EmployerTypeSelectionScreen';
import OrganizationDetailsScreen from '../screens/auth/registration/employer/OrganizationDetailsScreen';
import EmployerPersonalDetailsScreen from '../screens/auth/registration/employer/EmployerPersonalDetailsScreen';
import EmployerAccountScreen from '../screens/auth/registration/employer/EmployerAccountScreen';

// FIXED: Main App Screens - using correct paths
import HomeScreen from '../screens/HomeScreen';
import JobsScreen from '../screens/jobs/JobsScreen';
import JobDetailsScreen from '../screens/jobs/JobDetailsScreen';
import CreateJobScreen from '../screens/jobs/CreateJobScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Job Seeker Registration Stack
function JobSeekerRegistrationStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen 
        name="ExperienceTypeSelection" 
        component={ExperienceTypeSelectionScreen} 
      />
      <Stack.Screen 
        name="EducationDetailsScreen" 
        component={EducationDetailsScreen} 
      />
      <Stack.Screen 
        name="JobPreferencesScreen" 
        component={JobPreferencesScreen} 
      />
      <Stack.Screen 
        name="PersonalDetailsScreen" 
        component={PersonalDetailsScreen} 
      />
    </Stack.Navigator>
  );
}

// Employer Registration Stack
function EmployerRegistrationStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen 
        name="EmployerTypeSelection" 
        component={EmployerTypeSelectionScreen} 
      />
      <Stack.Screen 
        name="OrganizationDetailsScreen" 
        component={OrganizationDetailsScreen} 
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

// Authentication Stack
function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen 
        name="UserTypeSelection" 
        component={UserTypeSelectionScreen} 
      />
      <Stack.Screen 
        name="JobSeekerFlow" 
        component={JobSeekerRegistrationStack} 
      />
      <Stack.Screen 
        name="EmployerFlow" 
        component={EmployerRegistrationStack} 
      />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

// Main App Tabs
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#999',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'home';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          if (route.name === 'Jobs') iconName = focused ? 'briefcase' : 'briefcase-outline';
          if (route.name === 'Create Job') iconName = focused ? 'add-circle' : 'add-circle-outline';
          if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Jobs" component={JobsScreen} />
      <Tab.Screen name="Create Job" component={CreateJobScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <MainTabs /> : <AuthStack />;
}