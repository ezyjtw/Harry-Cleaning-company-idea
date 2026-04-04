import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, type Notification } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';

export default function NotificationsScreen() {
  const { api } = useAuth();
  const { data: notifications, isLoading, refetch } = useApi(() => api.getNotifications(), []);

  const getNotificationIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'BOOKING_CONFIRMED':
        return 'checkmark-circle';
      case 'BOOKING_CANCELLED':
        return 'close-circle';
      case 'BOOKING_COMPLETED':
        return 'checkmark-done';
      case 'PAYMENT_RECEIVED':
        return 'card';
      case 'NEW_MESSAGE':
        return 'chatbubble';
      case 'NEW_REVIEW':
        return 'star';
      default:
        return 'notifications';
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notification, !item.read && styles.unread]}
      onPress={() => api.markNotificationRead(item.id)}
    >
      <View style={[styles.iconCircle, !item.read && styles.iconCircleUnread]}>
        <Ionicons
          name={getNotificationIcon(item.type)}
          size={20}
          color={!item.read ? Colors.primary : Colors.textMuted}
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, !item.read && styles.notificationTitleUnread]}>
          {item.title}
        </Text>
        <Text style={styles.notificationBody} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.notificationTime}>
          {new Date(item.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications ?? []}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  notification: { flexDirection: 'row', gap: 12, padding: 16 },
  unread: { backgroundColor: `${Colors.primary}05` },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleUnread: { backgroundColor: `${Colors.primary}15` },
  notificationContent: { flex: 1 },
  notificationTitle: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  notificationTitleUnread: { fontWeight: '700' },
  notificationBody: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  notificationTime: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  separator: { height: 1, backgroundColor: Colors.border },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, color: Colors.textMuted, marginTop: 8 },
});
