import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, type Booking } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/ui/Card';

const STATUS_FILTERS = ['All', 'PENDING', 'CONFIRMED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'];

export default function JobsScreen() {
  const router = useRouter();
  const { api, isAuthenticated } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');

  const { data, isLoading, refetch } = useApi(
    () =>
      isAuthenticated
        ? api.getCleanerJobs({ status: activeFilter === 'All' ? undefined : activeFilter })
        : Promise.resolve(null),
    [isAuthenticated, activeFilter]
  );

  const renderJob = ({ item }: { item: Booking }) => (
    <TouchableOpacity onPress={() => router.push(`/job/${item.id}`)}>
      <Card style={styles.jobCard}>
        <View style={styles.jobHeader}>
          <View>
            <Text style={styles.serviceType}>{item.serviceType}</Text>
            <Text style={styles.customerName}>{item.customerName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{formatStatus(item.status)}</Text>
          </View>
        </View>
        <View style={styles.jobDetails}>
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
        <View style={styles.jobFooter}>
          <Text style={styles.earnings}>
            {'\u00A3'}
            {item.cleanerEarnings?.toFixed(2) ?? item.totalPrice.toFixed(2)}
          </Text>
          <Text style={styles.earningsLabel}>Your earnings</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={data?.data ?? []}
        renderItem={renderJob}
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
              <Ionicons name="briefcase-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No jobs found</Text>
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
    case 'EN_ROUTE':
    case 'IN_PROGRESS':
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
  list: { padding: 16, paddingBottom: 40 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  filterText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  filterTextActive: { color: Colors.white },
  jobCard: { marginBottom: 12 },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceType: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'capitalize',
  },
  customerName: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600', color: Colors.white },
  jobDetails: { gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  jobFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'flex-end',
  },
  earnings: { fontSize: 20, fontWeight: '700', color: Colors.success },
  earningsLabel: { fontSize: 12, color: Colors.textMuted },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, color: Colors.textMuted, marginTop: 8 },
});
