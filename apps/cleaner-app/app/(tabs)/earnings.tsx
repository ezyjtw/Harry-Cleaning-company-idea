import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, type EarningsEntry } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/ui/Card';

export default function EarningsScreen() {
  const { api, isAuthenticated } = useAuth();

  const {
    data: earnings,
    isLoading,
    refetch,
  } = useApi(
    () => (isAuthenticated ? api.getCleanerEarnings() : Promise.resolve(null)),
    [isAuthenticated]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Earned</Text>
          <Text style={styles.summaryValue}>
            {'\u00A3'}
            {earnings?.totalEarnings?.toFixed(2) ?? '0.00'}
          </Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>This Week</Text>
          <Text style={[styles.summaryValue, { color: Colors.success }]}>
            {'\u00A3'}
            {earnings?.thisWeek?.toFixed(2) ?? '0.00'}
          </Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>This Month</Text>
          <Text style={[styles.summaryValue, { color: Colors.info }]}>
            {'\u00A3'}
            {earnings?.thisMonth?.toFixed(2) ?? '0.00'}
          </Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={[styles.summaryValue, { color: Colors.statusPending }]}>
            {'\u00A3'}
            {earnings?.pendingPayments?.toFixed(2) ?? '0.00'}
          </Text>
        </Card>
      </View>

      {/* Platform Fee Info */}
      <Card style={styles.feeCard}>
        <View style={styles.feeRow}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.feeText}>
            Rena charges just 10% platform fee. You keep 90% of every booking.
          </Text>
        </View>
      </Card>

      {/* Recent Payments */}
      <Text style={styles.sectionTitle}>Recent Payments</Text>
      {earnings?.recentPayments?.length ? (
        earnings.recentPayments.map((payment: EarningsEntry) => (
          <Card key={payment.id} style={styles.paymentCard}>
            <View style={styles.paymentHeader}>
              <View>
                <Text style={styles.paymentCustomer}>{payment.customerName}</Text>
                <Text style={styles.paymentService}>{payment.serviceType}</Text>
              </View>
              <View style={styles.paymentAmounts}>
                <Text style={styles.paymentNet}>
                  {'\u00A3'}
                  {payment.netEarnings.toFixed(2)}
                </Text>
                <Text style={styles.paymentFee}>
                  -{'\u00A3'}
                  {payment.platformFee.toFixed(2)} fee
                </Text>
              </View>
            </View>
            <View style={styles.paymentFooter}>
              <Text style={styles.paymentDate}>{payment.date}</Text>
              <View
                style={[
                  styles.paymentStatus,
                  {
                    backgroundColor:
                      payment.status === 'completed' ? Colors.success : Colors.statusPending,
                  },
                ]}
              >
                <Text style={styles.paymentStatusText}>{payment.status}</Text>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <View style={styles.empty}>
          <Ionicons name="wallet-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No payments yet</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryCard: { width: '47%', alignItems: 'center', paddingVertical: 20 },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary },
  summaryValue: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginTop: 4 },
  feeCard: { marginTop: 16 },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feeText: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 24,
    marginBottom: 12,
  },
  paymentCard: { marginBottom: 10 },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paymentCustomer: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  paymentService: {
    fontSize: 13,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  paymentAmounts: { alignItems: 'flex-end' },
  paymentNet: { fontSize: 18, fontWeight: '700', color: Colors.success },
  paymentFee: { fontSize: 12, color: Colors.textMuted },
  paymentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  paymentDate: { fontSize: 13, color: Colors.textMuted },
  paymentStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.white,
    textTransform: 'capitalize',
  },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: Colors.textMuted, marginTop: 8 },
});
