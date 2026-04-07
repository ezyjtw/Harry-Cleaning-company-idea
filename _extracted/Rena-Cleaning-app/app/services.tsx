import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, ServiceTypes } from '@rena/shared';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const SERVICE_DETAILS: Record<string, { description: string; features: string[] }> = {
  regular: {
    description:
      'Our most popular service. Keep your home sparkling with regular weekly or fortnightly cleans.',
    features: [
      'Dusting & polishing',
      'Vacuuming & mopping',
      'Kitchen surfaces',
      'Bathroom sanitising',
      'Bed making',
    ],
  },
  deep: {
    description: 'A thorough top-to-bottom clean for when your home needs extra attention.',
    features: [
      'Everything in regular',
      'Inside cupboards',
      'Behind appliances',
      'Skirting boards',
      'Light fittings',
      'Window sills',
    ],
  },
  eot: {
    description:
      'Professional end-of-tenancy clean to get your deposit back. Fixed pricing by property size.',
    features: [
      'Full deep clean',
      'Oven & hob',
      'Inside all cupboards',
      'Windows (interior)',
      'Walls spot-cleaned',
      'Carpet freshening',
    ],
  },
  airbnb: {
    description: 'Fast turnaround cleans between guests for your Airbnb or holiday let.',
    features: [
      'Full clean & reset',
      'Linen change',
      'Welcome setup',
      'Toiletry restock check',
      'Check for damage',
    ],
  },
  'same-day': {
    description:
      'Need a clean today? Our same-day service connects you with available cleaners near you.',
    features: [
      'Available within hours',
      'Verified cleaners only',
      'Standard clean coverage',
      'Flexible scheduling',
    ],
  },
};

export default function ServicesScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>What we offer</Text>
      <Text style={styles.subheader}>
        All our cleaners are verified, background-checked, and keep 90% of what you pay.
      </Text>

      {ServiceTypes.map((service) => {
        const details = SERVICE_DETAILS[service.slug];
        if (!details) return null;
        return (
          <Card key={service.slug} style={styles.serviceCard}>
            <View style={styles.serviceHeader}>
              <View style={styles.iconBox}>
                <Ionicons
                  name={service.icon as keyof typeof Ionicons.glyphMap}
                  size={28}
                  color={Colors.primary}
                />
              </View>
              <Text style={styles.serviceName}>{service.name}</Text>
            </View>
            <Text style={styles.serviceDesc}>{details.description}</Text>
            <View style={styles.featureList}>
              {details.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="checkmark" size={16} color={Colors.success} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
            <Button
              title="Find Cleaners"
              onPress={() => router.push('/(tabs)/search')}
              variant="outline"
              size="sm"
            />
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  header: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  subheader: { fontSize: 16, color: Colors.textSecondary, marginTop: 8, marginBottom: 24 },
  serviceCard: { marginBottom: 16 },
  serviceHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceName: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  serviceDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  featureList: { gap: 6, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 14, color: Colors.textPrimary },
});
