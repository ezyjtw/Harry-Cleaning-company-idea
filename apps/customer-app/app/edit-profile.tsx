import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, validateEmail, validatePhone } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      Alert.alert('Error', emailResult.error ?? '');
      return;
    }
    if (phone) {
      const phoneResult = validatePhone(phone);
      if (!phoneResult.valid) {
        Alert.alert('Error', phoneResult.error ?? '');
        return;
      }
    }
    setLoading(true);
    try {
      // API call to update profile
      Alert.alert('Success', 'Profile updated successfully');
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
        label="Full Name"
        value={name}
        onChangeText={setName}
        icon={<Ionicons name="person-outline" size={20} color={Colors.textMuted} />}
      />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        icon={<Ionicons name="mail-outline" size={20} color={Colors.textMuted} />}
      />
      <Input
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        icon={<Ionicons name="call-outline" size={20} color={Colors.textMuted} />}
      />
      <Button title="Save Changes" onPress={handleSave} loading={loading} size="lg" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { padding: 24 },
});
