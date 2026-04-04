import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, TierColors } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAuthenticated, api, logout } = useAuth();

  const { data: profile } = useApi(
    () => (isAuthenticated ? api.getCleanerProfile() : Promise.resolve(null)),
    [isAuthenticated]
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.guestContainer}>
        <Ionicons name="person-circle-outline" size={80} color={Colors.textMuted} />
        <Text style={styles.guestTitle}>Cleaner Profile</Text>
        <Text style={styles.guestText}>Log in to manage your profile</Text>
        <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/auth/login')}>
          <Text style={styles.loginButtonText}>Log In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <Image
          source={{ uri: user?.image || 'https://via.placeholder.com/100' }}
          style={styles.avatar}
          accessible={true}
          accessibilityLabel="Profile avatar"
        />
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {profile && (
          <View style={styles.badges}>
            <Badge
              label={profile.tier as string}
              backgroundColor={TierColors[profile.tier as string] || Colors.textMuted}
            />
            {profile.verified && <Badge label="Verified" backgroundColor={Colors.success} />}
          </View>
        )}
        {profile && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={18} color="#F59E0B" />
            <Text style={styles.rating}>{profile.rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({profile.reviewCount} reviews)</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      {profile && (
        <View style={styles.statsRow}>
          <Card style={styles.statItem}>
            <Text style={styles.statValue}>{profile.completedJobs}</Text>
            <Text style={styles.statLabel}>Jobs Done</Text>
          </Card>
          <Card style={styles.statItem}>
            <Text style={styles.statValue}>
              {'\u00A3'}
              {profile.hourlyRate}
            </Text>
            <Text style={styles.statLabel}>Hourly Rate</Text>
          </Card>
          <Card style={styles.statItem}>
            <Text style={styles.statValue}>{profile.yearsExperience}y</Text>
            <Text style={styles.statLabel}>Experience</Text>
          </Card>
        </View>
      )}

      {/* Menu */}
      <View style={styles.menu}>
        <MenuItem
          icon="create-outline"
          label="Edit Profile"
          onPress={() => router.push('/edit-profile')}
        />
        <MenuItem
          icon="calendar-outline"
          label="Availability"
          onPress={() => router.push('/availability')}
        />
        <MenuItem icon="star-outline" label="My Reviews" onPress={() => router.push('/reviews')} />
        <MenuItem
          icon="notifications-outline"
          label="Notifications"
          onPress={() => router.push('/notifications')}
        />
        <MenuItem
          icon="settings-outline"
          label="Settings"
          onPress={() => router.push('/settings')}
        />
      </View>

      <View style={styles.menu}>
        <MenuItem icon="help-circle-outline" label="Help & Support" onPress={() => {}} />
        <MenuItem icon="document-text-outline" label="Terms & Conditions" onPress={() => {}} />
        <MenuItem icon="shield-outline" label="Privacy Policy" onPress={() => {}} />
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Rena Cleaner v1.0.0</Text>
    </ScrollView>
  );
}

function MenuItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={22}
        color={Colors.textPrimary}
      />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  name: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  email: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  rating: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  ratingCount: { fontSize: 14, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 16 },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  menu: { marginTop: 20, backgroundColor: Colors.white },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuLabel: { flex: 1, fontSize: 16, color: Colors.textPrimary },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: Colors.error },
  version: { textAlign: 'center', fontSize: 12, color: Colors.textMuted, marginTop: 20 },
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 40,
  },
  guestTitle: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginTop: 16 },
  guestText: { fontSize: 16, color: Colors.textSecondary, marginTop: 8 },
  loginButton: {
    marginTop: 24,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
  },
  loginButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});
