import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, ServiceTypes } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function HomeScreen() {
  const router = useRouter();
  const { isAuthenticated, user, api } = useAuth();
  const [postcode, setPostcode] = useState('');

  const {
    data: recentBookings,
    isLoading,
    refetch,
  } = useApi(
    () => (isAuthenticated ? api.getBookings({ page: 1 }) : Promise.resolve(null)),
    [isAuthenticated]
  );

  const handleSearch = () => {
    router.push({ pathname: '/(tabs)/search', params: { postcode } });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      {/* Hero Section */}
      <View style={styles.hero}>
        <Text style={styles.greeting}>
          {isAuthenticated ? `Hi ${user?.name?.split(' ')[0] ?? 'there'}` : 'Welcome to Rena'}
        </Text>
        <Text style={styles.subtitle}>Find trusted, verified cleaners near you</Text>

        <View style={styles.searchBox}>
          <Input
            placeholder="Enter your postcode"
            value={postcode}
            onChangeText={setPostcode}
            autoCapitalize="characters"
            icon={<Ionicons name="location-outline" size={20} color={Colors.textMuted} />}
          />
          <Button title="Find Cleaners" onPress={handleSearch} />
        </View>
      </View>

      {/* Service Types */}
      <Text style={styles.sectionTitle}>Our Services</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.servicesRow}>
        {ServiceTypes.map((service) => (
          <TouchableOpacity
            key={service.slug}
            style={styles.serviceCard}
            onPress={() => router.push({ pathname: '/services', params: { type: service.slug } })}
          >
            <View style={styles.serviceIcon}>
              <Ionicons
                name={service.icon as keyof typeof Ionicons.glyphMap}
                size={28}
                color={Colors.primary}
              />
            </View>
            <Text style={styles.serviceName}>{service.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>10%</Text>
          <Text style={styles.statLabel}>Low platform fee</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>90%</Text>
          <Text style={styles.statLabel}>Cleaners keep</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="shield-checkmark" size={24} color={Colors.success} />
          <Text style={styles.statLabel}>All verified</Text>
        </Card>
      </View>

      {/* How It Works */}
      <Text style={styles.sectionTitle}>How It Works</Text>
      <Card style={styles.stepsCard}>
        {[
          {
            icon: 'search-outline',
            title: 'Find',
            desc: 'Search by postcode to find local cleaners',
          },
          {
            icon: 'calendar-outline',
            title: 'Book',
            desc: 'Choose your date, time and service type',
          },
          {
            icon: 'sparkles-outline',
            title: 'Relax',
            desc: 'Your verified cleaner takes care of the rest',
          },
        ].map((step, i) => (
          <View key={step.title} style={[styles.step, i < 2 && styles.stepBorder]}>
            <View style={styles.stepIcon}>
              <Ionicons
                name={step.icon as keyof typeof Ionicons.glyphMap}
                size={24}
                color={Colors.primary}
              />
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Recent Bookings (if logged in) */}
      {isAuthenticated && recentBookings?.data && recentBookings.data.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Bookings</Text>
          {recentBookings.data.slice(0, 3).map((booking) => (
            <TouchableOpacity
              key={booking.id}
              onPress={() => router.push(`/booking/${booking.id}`)}
            >
              <Card style={styles.bookingCard}>
                <View style={styles.bookingRow}>
                  <View>
                    <Text style={styles.bookingService}>{booking.serviceType}</Text>
                    <Text style={styles.bookingDate}>
                      {booking.date} at {booking.time}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(booking.status) },
                    ]}
                  >
                    <Text style={styles.statusText}>{booking.status}</Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* CTA */}
      {!isAuthenticated && (
        <Card style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Ready to get started?</Text>
          <Text style={styles.ctaDesc}>
            Create an account to book your first clean with our satisfaction guarantee.
          </Text>
          <Button
            title="Sign Up Free"
            onPress={() => router.push('/auth/signup')}
            style={{ marginTop: 12 }}
          />
        </Card>
      )}
    </ScrollView>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'PENDING':
      return Colors.statusPending;
    case 'CONFIRMED':
    case 'ACCEPTED':
      return Colors.statusConfirmed;
    case 'IN_PROGRESS':
    case 'EN_ROUTE':
      return Colors.statusInProgress;
    case 'COMPLETED':
    case 'REVIEWED':
      return Colors.statusCompleted;
    case 'CANCELLED':
      return Colors.statusCancelled;
    default:
      return Colors.textMuted;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  hero: { backgroundColor: Colors.white, padding: 24, paddingTop: 16 },
  greeting: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginTop: 4, marginBottom: 20 },
  searchBox: { gap: 12 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 24,
    marginTop: 28,
    marginBottom: 12,
  },
  servicesRow: { paddingLeft: 24 },
  serviceCard: {
    alignItems: 'center',
    marginRight: 16,
    width: 100,
  },
  serviceIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  serviceName: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary, textAlign: 'center' },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginTop: 20,
  },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statNumber: { fontSize: 24, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  stepsCard: { marginHorizontal: 24 },
  step: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16 },
  stepBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  stepDesc: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  bookingCard: { marginHorizontal: 24, marginBottom: 12 },
  bookingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bookingService: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    textTransform: 'capitalize',
  },
  bookingDate: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600', color: Colors.white },
  ctaCard: { marginHorizontal: 24, marginTop: 24, alignItems: 'center', padding: 24 },
  ctaTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  ctaDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
});
