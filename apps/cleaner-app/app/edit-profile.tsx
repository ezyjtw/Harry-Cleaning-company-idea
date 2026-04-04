import React, { useState } from 'react';
import { Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, validatePhone } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function EditProfileScreen() {
  const router = useRouter();
  const { api } = useAuth();
  const { data: profile } = useApi(() => api.getCleanerProfile(), []);

  const [bio, setBio] = useState(profile?.bio ?? '');
  const [hourlyRate, setHourlyRate] = useState(String(profile?.hourlyRate ?? ''));
  const [phone, setPhone] = useState('');
  const [postcode, setPostcode] = useState('');
  const [specialties, setSpecialties] = useState(profile?.specialties?.join(', ') ?? '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (phone) {
      const phoneResult = validatePhone(phone);
      if (!phoneResult.valid) {
        Alert.alert('Error', phoneResult.error ?? '');
        return;
      }
    }
    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate < 14 || rate > 35) {
      Alert.alert('Error', 'Hourly rate must be between \u00A314 and \u00A335');
      return;
    }

    setLoading(true);
    try {
      await api.updateCleanerProfile({
        bio,
        hourlyRate: rate,
        specialties: specialties
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      } as never);
      Alert.alert('Saved', 'Profile updated successfully');
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Input
        label="Bio"
        placeholder="Tell customers about yourself and your experience..."
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={4}
      />
      <Input
        label="Hourly Rate (\u00A3)"
        placeholder="20"
        value={hourlyRate}
        onChangeText={setHourlyRate}
        keyboardType="numeric"
        icon={<Text style={{ fontSize: 18, color: Colors.textMuted }}>{'\u00A3'}</Text>}
      />
      <Text style={styles.rateHint}>Min \u00A314 / Max \u00A335 per hour</Text>

      <Input
        label="Phone"
        placeholder="07123 456789"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        icon={<Ionicons name="call-outline" size={20} color={Colors.textMuted} />}
      />
      <Input
        label="Postcode"
        placeholder="E17 4PP"
        value={postcode}
        onChangeText={setPostcode}
        autoCapitalize="characters"
        icon={<Ionicons name="location-outline" size={20} color={Colors.textMuted} />}
      />
      <Input
        label="Specialties (comma-separated)"
        placeholder="Deep Cleaning, End of Tenancy, Airbnb"
        value={specialties}
        onChangeText={setSpecialties}
      />

      <Button title="Save Profile" onPress={handleSave} loading={loading} size="lg" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { padding: 24, paddingBottom: 40 },
  rateHint: { fontSize: 12, color: Colors.textMuted, marginTop: -12, marginBottom: 16 },
});
