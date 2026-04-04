import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, type Conversation } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';

export default function MessagesScreen() {
  const router = useRouter();
  const { isAuthenticated, api } = useAuth();

  const {
    data: conversations,
    isLoading,
    refetch,
  } = useApi(
    () => (isAuthenticated ? api.getConversations() : Promise.resolve([])),
    [isAuthenticated]
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.empty}>
        <Ionicons name="chatbubbles-outline" size={64} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>Messages</Text>
        <Text style={styles.emptyText}>Log in to see your conversations</Text>
        <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/auth/login')}>
          <Text style={styles.loginButtonText}>Log In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationRow}
      onPress={() => router.push(`/messages/${item.participantId}`)}
    >
      <Image
        source={{ uri: item.participantPhoto || 'https://via.placeholder.com/48' }}
        style={styles.avatar}
        accessible={true}
        accessibilityLabel={`${item.participantName} avatar`}
      />
      <View style={styles.conversationInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.participantName}</Text>
          <Text style={styles.time}>{formatTime(item.lastMessageAt)}</Text>
        </View>
        <View style={styles.messageRow}>
          <Text
            style={[styles.lastMessage, item.unreadCount > 0 && styles.unread]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations ?? []}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={conversations?.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Messages with your cleaners will appear here</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString('en-GB', { weekday: 'short' });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  emptyContainer: { flex: 1 },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.border },
  conversationInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  time: { fontSize: 12, color: Colors.textMuted },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  lastMessage: { fontSize: 14, color: Colors.textSecondary, flex: 1, marginRight: 8 },
  unread: { fontWeight: '600', color: Colors.textPrimary },
  unreadBadge: {
    backgroundColor: Colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 80 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 16, color: Colors.textSecondary, marginTop: 8 },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loginButton: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  loginButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});
