import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { api } = useAuth();

  const { data: booking, isLoading } = useApi(() => api.getBooking(id ?? ''), [id]);

  if (isLoading || !booking) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const canCancel = ['PENDING', 'CONFIRMED'].includes(booking.status);
  const canMessage = !['CANCELLED', 'DISPUTED'].includes(booking.status);
  const isCompleted = booking.status === 'COMPLETED' || booking.status === 'REVIEWED';

  const handleCancel = () => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'Keep Booking', style: 'cancel' },
      { text: 'Cancel Booking', style: 'destructive', onPress: () => {} },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: getStatusColor(booking.status) }]}>
        <Ionicons name={getStatusIcon(booking.status)} size={20} color={Colors.white} />
        <Text style={styles.statusText}>{formatStatus(booking.status)}</Text>
      </View>

      {/* Service Info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Service Details</Text>
        <DetailRow icon="sparkles-outline" label="Service" value={booking.serviceType} />
        <DetailRow icon="calendar-outline" label="Date" value={booking.date} />
        <DetailRow icon="time-outline" label="Time" value={booking.time} />
        <DetailRow icon="hourglass-outline" label="Duration" value={`${booking.duration} hours`} />
        <DetailRow icon="location-outline" label="Address" value={booking.address} />
        {booking.notes && (
          <DetailRow icon="document-text-outline" label="Notes" value={booking.notes} />
        )}
      </Card>

      {/* Pricing */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Payment</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Total</Text>
          <Text style={styles.priceValue}>
            {'\u00A3'}
            {booking.totalPrice.toFixed(2)}
          </Text>
        </View>
        {booking.platformFee !== undefined && (
          <View style={styles.priceRow}>
            <Text style={styles.priceSubLabel}>incl. service fee</Text>
            <Text style={styles.priceSubValue}>
              {'\u00A3'}
              {booking.platformFee.toFixed(2)}
            </Text>
          </View>
        )}
        <View style={styles.escrowInfo}>
          <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
          <Text style={styles.escrowText}>Payment protected by Rena escrow</Text>
        </View>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        {canMessage && (
          <Button
            title="Message Cleaner"
            onPress={() => router.push(`/messages/${booking.cleanerId}`)}
            variant="outline"
            icon={<Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />}
          />
        )}
        {isCompleted && (
          <Button
            title="Leave a Review"
            onPress={() => {}}
            icon={<Ionicons name="star-outline" size={18} color={Colors.white} />}
          />
        )}
        {canCancel && (
          <Button
            title="Cancel Booking"
            onPress={handleCancel}
            variant="ghost"
            textStyle={{ color: Colors.error }}
            icon={<Ionicons name="close-circle-outline" size={18} color={Colors.error} />}
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
    case 'DISPUTED':
      return Colors.statusCancelled;
    default:
      return Colors.textMuted;
  }
}

function getStatusIcon(status: string): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case 'PENDING':
      return 'time-outline';
    case 'CONFIRMED':
    case 'ACCEPTED':
      return 'checkmark-circle-outline';
    case 'EN_ROUTE':
      return 'car-outline';
    case 'IN_PROGRESS':
      return 'sparkles-outline';
    case 'COMPLETED':
    case 'REVIEWED':
      return 'checkmark-done-outline';
    case 'CANCELLED':
      return 'close-circle-outline';
    default:
      return 'help-circle-outline';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: 8,
  },
  statusText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  section: { marginHorizontal: 20, marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 12, color: Colors.textMuted },
  detailValue: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary, marginTop: 2 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  priceLabel: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  priceValue: { fontSize: 22, fontWeight: '700', color: Colors.primary },
  priceSubLabel: { fontSize: 13, color: Colors.textMuted },
  priceSubValue: { fontSize: 13, color: Colors.textMuted },
  escrowInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  escrowText: { fontSize: 13, color: Colors.success },
  actions: { marginHorizontal: 20, marginTop: 24, gap: 12 },
});
