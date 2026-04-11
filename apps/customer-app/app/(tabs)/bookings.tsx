import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, type Booking } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/ui/Card';

const STATUS_FILTERS = ['All', 'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function BookingsScreen() {
  const router = useRouter();
  const { isAuthenticated, api } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');

  const { data, isLoading, refetch } = useApi(
    () =>
      isAuthenticated
        ? api.getBookings({ status: activeFilter === 'All' ? undefined : activeFilter })
        : Promise.resolve(null),
    [isAuthenticated, activeFilter]
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.empty}>
        <Ionicons name="calendar-outline" size={64} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>No bookings yet</Text>
        <Text style={styles.emptyText}>Log in to see your bookings</Text>
        <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/auth/login')}>
          <Text style={styles.loginButtonText}>Log In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderBooking = ({ item }: { item: Booking }) => (
    <TouchableOpacity onPress={() => router.push(`/booking/${item.id}`)}>
      <Card style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <Text style={styles.serviceType}>{item.serviceType}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{formatStatus(item.status)}</Text>
          </View>
        </View>
        <View style={styles.bookingDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>
              {item.date} at {item.time}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText}>{item.duration} hours</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.detailText} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        </View>
        <View style={styles.bookingFooter}>
          <Text style={styles.price}>
            {'\u00A3'}
            {item.totalPrice.toFixed(2)}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={data?.data ?? []}
        renderItem={renderBooking}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListHeaderComponent={
          <View style={styles.filterRow}>
            {STATUS_FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text
                  style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}
                >
                  {filter === 'All' ? 'All' : formatStatus(filter)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No bookings found</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
    case 'DISPUTED':
      return Colors.statusCancelled;
    default:
      return Colors.textMuted;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16, paddingBottom: 40 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  filterTextActive: { color: Colors.white },
  bookingCard: { marginBottom: 12 },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceType: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'capitalize',
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600', color: Colors.white },
  bookingDetails: { gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  price: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 16, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' },
  loginButton: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  loginButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});
