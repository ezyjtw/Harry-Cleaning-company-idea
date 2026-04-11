import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/ui/Card';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, isAuthenticated, api } = useAuth();

  const {
    data: stats,
    isLoading,
    refetch,
  } = useApi(
    () => (isAuthenticated ? api.getCleanerDashboard() : Promise.resolve(null)),
    [isAuthenticated]
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.guestContainer}>
        <Ionicons name="sparkles" size={64} color={Colors.primaryDark} />
        <Text style={styles.guestTitle}>Rena Cleaner</Text>
        <Text style={styles.guestText}>Log in to manage your jobs and earnings</Text>
        <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/auth/login')}>
          <Text style={styles.loginButtonText}>Log In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.signupButton} onPress={() => router.push('/auth/signup')}>
          <Text style={styles.signupButtonText}>Become a Cleaner</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi {user?.name?.split(' ')[0]}</Text>
        <TouchableOpacity onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Ionicons name="calendar-outline" size={24} color={Colors.primary} />
          <Text style={styles.statNumber}>{stats?.todayJobs ?? 0}</Text>
          <Text style={styles.statLabel}>Today's Jobs</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="briefcase-outline" size={24} color={Colors.info} />
          <Text style={styles.statNumber}>{stats?.weekJobs ?? 0}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="wallet-outline" size={24} color={Colors.success} />
          <Text style={styles.statNumber}>
            {'\u00A3'}
            {stats?.monthEarnings?.toFixed(0) ?? '0'}
          </Text>
          <Text style={styles.statLabel}>This Month</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="star-outline" size={24} color="#F59E0B" />
          <Text style={styles.statNumber}>{stats?.rating?.toFixed(1) ?? '0.0'}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </Card>
      </View>

      {/* Performance */}
      <Card style={styles.performanceCard}>
        <Text style={styles.sectionTitle}>Performance</Text>
        <PerformanceRow
          icon="checkmark-done"
          label="Jobs Completed"
          value={String(stats?.completedJobs ?? 0)}
          color={Colors.success}
        />
        <PerformanceRow
          icon="hourglass"
          label="Pending Jobs"
          value={String(stats?.pendingJobs ?? 0)}
          color={Colors.statusPending}
        />
        <PerformanceRow
          icon="close-circle"
          label="Cancellation Rate"
          value={`${stats?.cancellationRate?.toFixed(1) ?? '0.0'}%`}
          color={Colors.error}
        />
      </Card>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <ActionButton
          icon="briefcase"
          label="View Jobs"
          onPress={() => router.push('/(tabs)/jobs')}
        />
        <ActionButton
          icon="calendar"
          label="Availability"
          onPress={() => router.push('/availability')}
        />
        <ActionButton
          icon="wallet"
          label="Earnings"
          onPress={() => router.push('/(tabs)/earnings')}
        />
        <ActionButton icon="star" label="Reviews" onPress={() => router.push('/reviews')} />
      </View>

      {/* Earnings Summary */}
      <Card style={styles.earningsCard}>
        <View style={styles.earningsHeader}>
          <Text style={styles.sectionTitle}>Earnings Summary</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/earnings')}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.earningsRow}>
          <View>
            <Text style={styles.earningsLabel}>Total Earned</Text>
            <Text style={styles.earningsValue}>
              {'\u00A3'}
              {stats?.totalEarnings?.toFixed(2) ?? '0.00'}
            </Text>
          </View>
          <View style={styles.keepBadge}>
            <Text style={styles.keepText}>You keep 90%</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

function PerformanceRow({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.performanceRow}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={color} />
      <Text style={styles.performanceLabel}>{label}</Text>
      <Text style={styles.performanceValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <View style={styles.actionIcon}>
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={24}
          color={Colors.primaryDark}
        />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: Colors.white,
  },
  greeting: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 16,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  statNumber: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginTop: 8 },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  performanceCard: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  performanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  performanceLabel: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  performanceValue: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  actionsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 4,
  },
  actionButton: { flex: 1, alignItems: 'center' },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: `${Colors.primaryDark}12`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionLabel: { fontSize: 12, fontWeight: '500', color: Colors.textPrimary },
  earningsCard: { marginHorizontal: 16, marginTop: 20 },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAll: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsLabel: { fontSize: 14, color: Colors.textSecondary },
  earningsValue: { fontSize: 28, fontWeight: '700', color: Colors.success, marginTop: 4 },
  keepBadge: {
    backgroundColor: `${Colors.success}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  keepText: { fontSize: 13, fontWeight: '600', color: Colors.success },
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 40,
  },
  guestTitle: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, marginTop: 16 },
  guestText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
  loginButton: {
    marginTop: 24,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  loginButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  signupButton: {
    marginTop: 12,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
  },
  signupButtonText: { color: Colors.primaryDark, fontSize: 16, fontWeight: '600' },
});
