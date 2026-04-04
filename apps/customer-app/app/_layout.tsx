import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/AuthContext';
import { Colors } from '@rena/shared';

export default function RootLayout() {
  return (
    <AuthProvider>
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
        <Stack.Screen
          name="auth/forgot-password"
          options={{ title: 'Reset Password', presentation: 'modal' }}
        />
        <Stack.Screen name="cleaners/[id]" options={{ title: 'Cleaner Profile' }} />
        <Stack.Screen name="book/[id]" options={{ title: 'Book Cleaning' }} />
        <Stack.Screen name="booking/[id]" options={{ title: 'Booking Details' }} />
        <Stack.Screen name="messages/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="services" options={{ title: 'Our Services' }} />
        <Stack.Screen name="faq" options={{ title: 'FAQ' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile' }} />
        <Stack.Screen name="addresses" options={{ title: 'Saved Addresses' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      </Stack>
    </AuthProvider>
  );
}
