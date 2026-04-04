import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/AuthContext';
import { UpdateChecker } from '@/components/UpdateChecker';
import { Colors } from '@rena/shared';

export default function RootLayout() {
  return (
    <AuthProvider>
      <UpdateChecker />
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.white },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ title: 'Log In', presentation: 'modal' }} />
        <Stack.Screen name="auth/signup" options={{ title: 'Sign Up', presentation: 'modal' }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Job Details' }} />
        <Stack.Screen name="messages/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="availability" options={{ title: 'Availability' }} />
        <Stack.Screen name="reviews" options={{ title: 'My Reviews' }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="privacy-policy" options={{ title: 'Privacy Policy' }} />
        <Stack.Screen name="terms" options={{ title: 'Terms & Conditions' }} />
      </Stack>
    </AuthProvider>
  );
}
