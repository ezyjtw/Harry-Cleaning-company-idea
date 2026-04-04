import React from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, type Review } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/ui/Card';

export default function ReviewsScreen() {
  const { api } = useAuth();
  const { data: reviews, isLoading, refetch } = useApi(() => api.getCleanerReviewsOwn(), []);

  const renderReview = ({ item }: { item: Review }) => (
    <Card style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <View style={styles.ratingRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Ionicons
              key={i}
              name={i < Math.round(item.rating) ? 'star' : 'star-outline'}
              size={16}
              color="#F59E0B"
            />
          ))}
          <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
        </View>
      </View>
      <Text style={styles.comment}>{item.comment}</Text>

      {item.categoryRatings && (
        <View style={styles.categoryGrid}>
          <CategoryBadge label="Thorough" value={item.categoryRatings.thoroughness} />
          <CategoryBadge label="Punctual" value={item.categoryRatings.punctuality} />
          <CategoryBadge label="Comms" value={item.categoryRatings.communication} />
          <CategoryBadge label="Value" value={item.categoryRatings.value} />
        </View>
      )}

      {item.cleanerReply && (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Your reply:</Text>
          <Text style={styles.replyText}>{item.cleanerReply}</Text>
        </View>
      )}

      <Text style={styles.date}>{item.date}</Text>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={reviews ?? []}
        renderItem={renderReview}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="star-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No reviews yet</Text>
              <Text style={styles.emptySubtext}>Reviews from customers will appear here</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

function CategoryBadge({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.categoryBadge}>
      <Text style={styles.categoryLabel}>{label}</Text>
      <Text style={styles.categoryValue}>{value.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16, paddingBottom: 40 },
  reviewCard: { marginBottom: 12 },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginLeft: 4 },
  comment: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryLabel: { fontSize: 12, color: Colors.textMuted },
  categoryValue: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  replyBox: {
    backgroundColor: `${Colors.primaryDark}08`,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  replyLabel: { fontSize: 12, fontWeight: '600', color: Colors.primaryDark },
  replyText: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  date: { fontSize: 12, color: Colors.textMuted, marginTop: 10 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, color: Colors.textSecondary, marginTop: 8 },
  emptySubtext: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
});
