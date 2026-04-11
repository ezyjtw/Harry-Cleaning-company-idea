import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '@rena/shared';
import { OnboardingProvider } from '@/context/OnboardingContext';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.white },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { fontWeight: '600', fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="personal" options={{ title: 'Personal Info' }} />
        <Stack.Screen name="experience" options={{ title: 'Experience' }} />
        <Stack.Screen name="pricing" options={{ title: 'Pricing' }} />
        <Stack.Screen name="identity" options={{ title: 'Identity' }} />
        <Stack.Screen name="dbs-check" options={{ title: 'DBS Check' }} />
        <Stack.Screen name="payout" options={{ title: 'Payout' }} />
        <Stack.Screen name="review" options={{ title: 'Review' }} />
      </Stack>
    </OnboardingProvider>
  );
}
