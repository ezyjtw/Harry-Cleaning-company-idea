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

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/messages/${item.participantId}`)}
    >
      <Image
        source={{ uri: item.participantPhoto || 'https://via.placeholder.com/48' }}
        style={styles.avatar}
        accessible={true}
        accessibilityLabel={`${item.participantName} avatar`}
      />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.participantName}</Text>
          <Text style={styles.time}>
            {new Date(item.lastMessageAt).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
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
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Customer messages will appear here</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.border },
  info: { flex: 1 },
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
    backgroundColor: Colors.primaryDark,
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
  emptyText: { fontSize: 16, color: Colors.textSecondary, marginTop: 8 },
  emptySubtext: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
});
