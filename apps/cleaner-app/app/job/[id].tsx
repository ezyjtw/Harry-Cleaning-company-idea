import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { api } = useAuth();
  const [actionLoading, setActionLoading] = useState('');

  const { data: job, isLoading, refetch } = useApi(() => api.getCleanerJob(id ?? ''), [id]);

  if (isLoading || !job) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primaryDark} />
      </View>
    );
  }

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      await api.updateJobStatus(id ?? '', action);
      await refetch();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading('');
    }
  };

  const isPending = job.status === 'PENDING';
  const isConfirmed = job.status === 'CONFIRMED' || job.status === 'ACCEPTED';
  const isEnRoute = job.status === 'EN_ROUTE';
  const isInProgress = job.status === 'IN_PROGRESS';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status */}
      <View style={[styles.statusBanner, { backgroundColor: getStatusColor(job.status) }]}>
        <Text style={styles.statusText}>{formatStatus(job.status)}</Text>
      </View>

      {/* Customer Info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <DetailRow icon="person-outline" label="Name" value={job.customerName} />
        <DetailRow icon="call-outline" label="Phone" value={job.customerPhone} />
        <DetailRow icon="mail-outline" label="Email" value={job.customerEmail} />
      </Card>

      {/* Job Details */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Job Details</Text>
        <DetailRow icon="sparkles-outline" label="Service" value={job.serviceType} />
        <DetailRow icon="calendar-outline" label="Date" value={job.date} />
        <DetailRow icon="time-outline" label="Time" value={job.time} />
        <DetailRow icon="hourglass-outline" label="Duration" value={`${job.duration} hours`} />
        <DetailRow icon="location-outline" label="Address" value={job.address} />
        {job.notes && <DetailRow icon="document-text-outline" label="Notes" value={job.notes} />}
      </Card>

      {/* Earnings */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Your Earnings</Text>
        <View style={styles.earningsRow}>
          <Text style={styles.earningsLabel}>Total booking</Text>
          <Text style={styles.earningsValue}>
            {'\u00A3'}
            {job.totalPrice.toFixed(2)}
          </Text>
        </View>
        {job.platformFee !== undefined && (
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Platform fee (10%)</Text>
            <Text style={styles.feeValue}>
              -{'\u00A3'}
              {job.platformFee.toFixed(2)}
            </Text>
          </View>
        )}
        <View style={[styles.earningsRow, styles.earningsTotal]}>
          <Text style={styles.totalLabel}>You earn</Text>
          <Text style={styles.totalValue}>
            {'\u00A3'}
            {job.cleanerEarnings?.toFixed(2) ?? (job.totalPrice * 0.9).toFixed(2)}
          </Text>
        </View>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        {isPending && (
          <>
            <Button
              title="Accept Job"
              onPress={() => handleAction('ACCEPT')}
              loading={actionLoading === 'ACCEPT'}
              icon={<Ionicons name="checkmark-circle-outline" size={18} color={Colors.white} />}
            />
            <Button
              title="Decline"
              onPress={() =>
                Alert.alert('Decline Job', 'Are you sure?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Decline', style: 'destructive', onPress: () => handleAction('REJECT') },
                ])
              }
              variant="outline"
              textStyle={{ color: Colors.error }}
              loading={actionLoading === 'REJECT'}
            />
          </>
        )}
        {isConfirmed && (
          <Button
            title="I'm On My Way"
            onPress={() => handleAction('CHECK_IN')}
            loading={actionLoading === 'CHECK_IN'}
            icon={<Ionicons name="car-outline" size={18} color={Colors.white} />}
          />
        )}
        {isEnRoute && (
          <Button
            title="Start Cleaning"
            onPress={() => handleAction('CHECK_IN')}
            loading={actionLoading === 'CHECK_IN'}
            icon={<Ionicons name="sparkles-outline" size={18} color={Colors.white} />}
          />
        )}
        {isInProgress && (
          <Button
            title="Complete Job"
            onPress={() =>
              Alert.alert('Complete Job', 'Mark this job as completed?', [
                { text: 'Not Yet', style: 'cancel' },
                { text: 'Complete', onPress: () => handleAction('COMPLETE') },
              ])
            }
            loading={actionLoading === 'COMPLETE'}
            icon={<Ionicons name="checkmark-done-outline" size={18} color={Colors.white} />}
          />
        )}

        {!['COMPLETED', 'CANCELLED', 'REVIEWED'].includes(job.status) && (
          <Button
            title="Message Customer"
            onPress={() => router.push(`/messages/${job.cleanerId}`)}
            variant="outline"
            icon={<Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />}
          />
        )}
      </View>
    </ScrollView>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={Colors.textMuted} />
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
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
  content: { paddingBottom: 40 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusBanner: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  statusText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  section: { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 12, color: Colors.textMuted },
  detailValue: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary, marginTop: 2 },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  earningsLabel: { fontSize: 14, color: Colors.textSecondary },
  earningsValue: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  feeValue: { fontSize: 14, color: Colors.error },
  earningsTotal: { borderBottomWidth: 0, marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  totalValue: { fontSize: 22, fontWeight: '700', color: Colors.success },
  actions: { marginHorizontal: 16, marginTop: 24, gap: 12 },
});
