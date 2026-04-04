import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, type Notification } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';

export default function NotificationsScreen() {
  const { api } = useAuth();
  const { data: notifications, isLoading, refetch } = useApi(() => api.getNotifications(), []);

  const getIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'BOOKING_REQUEST':
        return 'add-circle';
      case 'BOOKING_CONFIRMED':
        return 'checkmark-circle';
      case 'BOOKING_CANCELLED':
        return 'close-circle';
      case 'PAYMENT_SENT':
        return 'wallet';
      case 'NEW_MESSAGE':
        return 'chatbubble';
      case 'NEW_REVIEW':
        return 'star';
      default:
        return 'notifications';
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications ?? []}
        renderItem={({ item }: { item: Notification }) => (
          <TouchableOpacity
            style={[styles.row, !item.read && styles.unread]}
            onPress={() => api.markNotificationRead(item.id)}
          >
            <View style={[styles.iconCircle, !item.read && styles.iconUnread]}>
              <Ionicons
                name={getIcon(item.type)}
                size={20}
                color={!item.read ? Colors.primaryDark : Colors.textMuted}
              />
            </View>
            <View style={styles.content}>
              <Text style={[styles.title, !item.read && styles.titleBold]}>{item.title}</Text>
              <Text style={styles.body} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={styles.time}>
                {new Date(item.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No notifications</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  row: { flexDirection: 'row', gap: 12, padding: 16 },
  unread: { backgroundColor: `${Colors.primaryDark}05` },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconUnread: { backgroundColor: `${Colors.primaryDark}15` },
  content: { flex: 1 },
  title: { fontSize: 15, color: Colors.textPrimary },
  titleBold: { fontWeight: '700' },
  body: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  time: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  separator: { height: 1, backgroundColor: Colors.border },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, color: Colors.textMuted, marginTop: 8 },
});
