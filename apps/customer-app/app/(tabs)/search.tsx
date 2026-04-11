import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, TierColors, type Cleaner } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postcode?: string }>();
  const { api } = useAuth();
  const [postcode, setPostcode] = useState(params.postcode ?? '');
  const [searchPostcode, setSearchPostcode] = useState(params.postcode ?? '');

  const { data, isLoading, error } = useApi(
    () => api.getCleaners({ postcode: searchPostcode || undefined, pageSize: 20 }),
    [searchPostcode]
  );

  const handleSearch = () => setSearchPostcode(postcode);

  const renderCleaner = ({ item }: { item: Cleaner }) => (
    <TouchableOpacity onPress={() => router.push(`/cleaners/${item.id}`)}>
      <Card style={styles.cleanerCard}>
        <View style={styles.cleanerRow}>
          <Image
            source={{ uri: item.photo || 'https://via.placeholder.com/80' }}
            style={styles.avatar}
            accessible={true}
            accessibilityLabel={`${item.name} avatar`}
          />
          <View style={styles.cleanerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.cleanerName}>{item.name}</Text>
              {item.verified && (
                <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
              )}
            </View>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.rating}>{item.rating.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>({item.reviewCount} reviews)</Text>
            </View>
            <View style={styles.detailsRow}>
              <Badge
                label={item.tier}
                backgroundColor={TierColors[item.tier] || Colors.textMuted}
              />
              {item.availableNow && (
                <Badge label="Available Now" backgroundColor={Colors.success} />
              )}
            </View>
            <Text style={styles.location}>
              <Ionicons name="location-outline" size={12} color={Colors.textMuted} />{' '}
              {item.location}
            </Text>
          </View>
          <View style={styles.priceCol}>
            <Text style={styles.price}>
              {'\u00A3'}
              {item.hourlyRate}
            </Text>
            <Text style={styles.priceLabel}>/hour</Text>
          </View>
        </View>
        {item.specialties.length > 0 && (
          <View style={styles.specialties}>
            {item.specialties.slice(0, 3).map((s) => (
              <View key={s} style={styles.specialtyTag}>
                <Text style={styles.specialtyText}>{s}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <View style={styles.searchInput}>
          <Input
            placeholder="Postcode (e.g. E17 4PP)"
            value={postcode}
            onChangeText={setPostcode}
            autoCapitalize="characters"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            icon={<Ionicons name="location-outline" size={20} color={Colors.textMuted} />}
          />
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Ionicons name="search" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />
      ) : error ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : !data?.data?.length ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>
            {searchPostcode
              ? 'No cleaners found in this area'
              : 'Enter a postcode to find cleaners'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data.data}
          renderItem={renderCleaner}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
    backgroundColor: Colors.white,
    paddingBottom: 8,
  },
  searchInput: { flex: 1 },
  searchButton: {
    backgroundColor: Colors.primary,
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  list: { padding: 16, paddingBottom: 40 },
  cleanerCard: { marginBottom: 12 },
  cleanerRow: { flexDirection: 'row', gap: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.border },
  cleanerInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cleanerName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rating: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  reviewCount: { fontSize: 12, color: Colors.textSecondary },
  detailsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  location: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  priceCol: { alignItems: 'flex-end' },
  price: { fontSize: 22, fontWeight: '700', color: Colors.primary },
  priceLabel: { fontSize: 12, color: Colors.textSecondary },
  specialties: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  specialtyTag: {
    backgroundColor: `${Colors.primary}10`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  specialtyText: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
  loader: { flex: 1, justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center', marginTop: 12 },
});
