import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, type SavedAddress } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function AddressesScreen() {
  const { api } = useAuth();
  const { data: addresses, refetch } = useApi(() => api.getAddresses(), []);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');

  const handleAdd = async () => {
    if (!line1 || !city || !postcode) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    try {
      await api.createAddress({ label: label || 'Home', line1, city, postcode, isDefault: false });
      setShowForm(false);
      setLabel('');
      setLine1('');
      setCity('');
      setPostcode('');
      await refetch();
    } catch {
      Alert.alert('Error', 'Failed to save address');
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={addresses ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }: { item: SavedAddress }) => (
          <Card style={styles.addressCard}>
            <View style={styles.addressRow}>
              <Ionicons name="location" size={20} color={Colors.primary} />
              <View style={styles.addressInfo}>
                <Text style={styles.addressLabel}>{item.label}</Text>
                <Text style={styles.addressText}>
                  {item.line1}, {item.city}, {item.postcode}
                </Text>
              </View>
              {item.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultText}>Default</Text>
                </View>
              )}
            </View>
          </Card>
        )}
        ListFooterComponent={
          showForm ? (
            <Card style={styles.form}>
              <Input
                label="Label"
                placeholder="Home, Office..."
                value={label}
                onChangeText={setLabel}
              />
              <Input
                label="Address"
                placeholder="123 High Street"
                value={line1}
                onChangeText={setLine1}
              />
              <Input label="City" placeholder="London" value={city} onChangeText={setCity} />
              <Input
                label="Postcode"
                placeholder="E17 4PP"
                value={postcode}
                onChangeText={setPostcode}
                autoCapitalize="characters"
              />
              <View style={styles.formActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowForm(false)}
                  variant="outline"
                  style={{ flex: 1 }}
                />
                <Button title="Save" onPress={handleAdd} style={{ flex: 1 }} />
              </View>
            </Card>
          ) : (
            <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
              <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
              <Text style={styles.addText}>Add New Address</Text>
            </TouchableOpacity>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16, paddingBottom: 40 },
  addressCard: { marginBottom: 12 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addressInfo: { flex: 1 },
  addressLabel: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  addressText: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  defaultBadge: {
    backgroundColor: `${Colors.primary}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  defaultText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addText: { fontSize: 16, color: Colors.primary, fontWeight: '500' },
  form: { marginTop: 8 },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
