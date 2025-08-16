import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { JobProvider } from './src/contexts/JobContext';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/styles/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <JobProvider>
          <NavigationContainer>
            <StatusBar style="light" backgroundColor={colors.primary} />
            <AppNavigator />
          </NavigationContainer>
        </JobProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}