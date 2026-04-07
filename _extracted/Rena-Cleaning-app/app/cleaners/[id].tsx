import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, TierColors } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export default function CleanerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { api } = useAuth();

  const { data: cleaner, isLoading, error } = useApi(() => api.getCleaner(id ?? ''), [id]);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !cleaner) {
    return (
      <View style={styles.loader}>
        <Text style={styles.errorText}>{error || 'Cleaner not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={{ uri: cleaner.photo || 'https://via.placeholder.com/120' }}
          style={styles.avatar}
          accessible={true}
          accessibilityLabel={`${cleaner.name} avatar`}
        />
        <Text style={styles.name}>{cleaner.name}</Text>
        <View style={styles.badges}>
          <Badge
            label={cleaner.tier}
            backgroundColor={TierColors[cleaner.tier] || Colors.textMuted}
          />
          {cleaner.verified && <Badge label="Verified" backgroundColor={Colors.success} />}
          {cleaner.availableNow && <Badge label="Available Now" backgroundColor={Colors.info} />}
        </View>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={18} color="#F59E0B" />
          <Text style={styles.rating}>{cleaner.rating.toFixed(1)}</Text>
          <Text style={styles.reviewCount}>({cleaner.reviewCount} reviews)</Text>
        </View>
      </View>

      {/* Price & Book */}
      <Card style={styles.priceCard}>
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Hourly rate</Text>
            <Text style={styles.price}>
              {'\u00A3'}
              {cleaner.hourlyRate}/hr
            </Text>
          </View>
          <Button title="Book Now" onPress={() => router.push(`/book/${cleaner.id}`)} size="lg" />
        </View>
      </Card>

      {/* Bio */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.bio}>{cleaner.bio}</Text>
      </Card>

      {/* Details */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.detailGrid}>
          <DetailItem icon="location-outline" label="Location" value={cleaner.location} />
          <DetailItem
            icon="briefcase-outline"
            label="Experience"
            value={`${cleaner.yearsExperience} years`}
          />
          <DetailItem
            icon="checkmark-done-outline"
            label="Jobs completed"
            value={String(cleaner.completedJobs)}
          />
          <DetailItem icon="time-outline" label="Response time" value={cleaner.responseTime} />
          <DetailItem
            icon="language-outline"
            label="Languages"
            value={cleaner.languages.join(', ')}
          />
        </View>
      </Card>

      {/* Specialties */}
      {cleaner.specialties.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Specialties</Text>
          <View style={styles.tagRow}>
            {cleaner.specialties.map((s) => (
              <View key={s} style={styles.tag}>
                <Text style={styles.tagText}>{s}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Category Ratings */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Ratings Breakdown</Text>
        {Object.entries(cleaner.categoryRatings).map(([key, value]) => (
          <View key={key} style={styles.ratingBarRow}>
            <Text style={styles.ratingBarLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
            <View style={styles.ratingBar}>
              <View style={[styles.ratingBarFill, { width: `${(value / 5) * 100}%` }]} />
            </View>
            <Text style={styles.ratingBarValue}>{value.toFixed(1)}</Text>
          </View>
        ))}
      </Card>

      {/* Verification */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Verification</Text>
        <VerificationItem
          icon="shield-checkmark"
          label="Identity Verified"
          verified={cleaner.identityVerified}
        />
        <VerificationItem
          icon="document-text"
          label="Background Checked"
          verified={cleaner.backgroundChecked}
        />
        <VerificationItem icon="ribbon" label="Platform Verified" verified={cleaner.verified} />
      </Card>

      {/* Availability */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Availability</Text>
        <View style={styles.availabilityGrid}>
          {cleaner.availability.map((day) => (
            <View key={day} style={styles.availabilityDay}>
              <Text style={styles.availabilityDayText}>{day}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* CTA */}
      <Button
        title={`Book ${cleaner.name.split(' ')[0]}`}
        onPress={() => router.push(`/book/${cleaner.id}`)}
        size="lg"
        style={{ marginHorizontal: 20, marginBottom: 40 }}
      />
    </ScrollView>
  );
}

function DetailItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={Colors.textMuted} />
      <View>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function VerificationItem({
  icon,
  label,
  verified,
}: {
  icon: string;
  label: string;
  verified: boolean;
}) {
  return (
    <View style={styles.verificationRow}>
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={20}
        color={verified ? Colors.success : Colors.textMuted}
      />
      <Text style={[styles.verificationLabel, !verified && styles.unverified]}>{label}</Text>
      <Ionicons
        name={verified ? 'checkmark-circle' : 'close-circle'}
        size={20}
        color={verified ? Colors.success : Colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: Colors.error },
  header: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  name: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  badges: { flexDirection: 'row', gap: 8, marginTop: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  rating: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  reviewCount: { fontSize: 14, color: Colors.textSecondary },
  priceCard: { marginHorizontal: 20, marginTop: 16 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: 14, color: Colors.textSecondary },
  price: { fontSize: 28, fontWeight: '700', color: Colors.primary, marginTop: 2 },
  section: { marginHorizontal: 20, marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  bio: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  detailGrid: { gap: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailLabel: { fontSize: 12, color: Colors.textMuted },
  detailValue: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    backgroundColor: `${Colors.primary}10`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ratingBarLabel: { fontSize: 13, color: Colors.textSecondary, width: 100 },
  ratingBar: { flex: 1, height: 8, backgroundColor: Colors.border, borderRadius: 4 },
  ratingBarFill: { height: 8, backgroundColor: Colors.primary, borderRadius: 4 },
  ratingBarValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    width: 30,
    textAlign: 'right',
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  verificationLabel: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  unverified: { color: Colors.textMuted },
  availabilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  availabilityDay: {
    backgroundColor: `${Colors.success}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  availabilityDayText: { fontSize: 13, color: Colors.success, fontWeight: '500' },
});
