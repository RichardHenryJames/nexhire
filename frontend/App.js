import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { JobProvider } from './src/contexts/JobContext';
import AppNavigator, { linking } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { ToastHost } from './src/components/Toast';
import { colors } from './src/styles/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <JobProvider>
          <NavigationContainer ref={navigationRef} linking={linking}>
            <StatusBar style="light" backgroundColor={colors.primary} />
            <AppNavigator />
            {/* Global toast overlay */}
            <ToastHost />
          </NavigationContainer>
        </JobProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}