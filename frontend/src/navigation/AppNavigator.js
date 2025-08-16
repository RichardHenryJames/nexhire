import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { colors, typography } from '../styles/theme';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Main Screens
import HomeScreen from '../screens/HomeScreen';
import JobsScreen from '../screens/jobs/JobsScreen';
import JobDetailsScreen from '../screens/jobs/JobDetailsScreen';
import ApplicationsScreen from '../screens/applications/ApplicationsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import CreateJobScreen from '../screens/jobs/CreateJobScreen';

// Loading Screen
import LoadingScreen from '../screens/LoadingScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator for authenticated users
function MainTabNavigator() {
  const { isEmployer, isJobSeeker } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Jobs') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
          } else if (route.name === 'Applications') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'CreateJob') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.medium,
        },
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: typography.weights.bold,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'NexHire' }}
      />
      <Tab.Screen 
        name="Jobs" 
        component={JobsScreen}
        options={{ title: 'Browse Jobs' }}
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
        options={{ 
          title: isEmployer ? 'Job Applications' : 'My Applications'
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// Auth Navigator for non-authenticated users
function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: typography.weights.bold,
        },
      }}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{ 
          title: 'Welcome to NexHire',
          headerShown: false // We'll handle the header in the component
        }}
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen}
        options={{ 
          title: 'Create Account',
          headerShown: true
        }}
      />
    </Stack.Navigator>
  );
}

// Main App Navigator
export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen 
            name="JobDetails" 
            component={JobDetailsScreen}
            options={{
              headerShown: true,
              title: 'Job Details',
              headerStyle: { backgroundColor: colors.primary },
              headerTintColor: colors.white,
              headerTitleStyle: { fontWeight: typography.weights.bold },
            }}
          />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}