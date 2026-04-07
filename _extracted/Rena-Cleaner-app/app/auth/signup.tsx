import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, validateEmail, validatePassword, validatePhone } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setError('');
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setError(emailResult.error ?? '');
      return;
    }
    if (phone) {
      const phoneResult = validatePhone(phone);
      if (!phoneResult.valid) {
        setError(phoneResult.error ?? '');
        return;
      }
    }
    const passResult = validatePassword(password);
    if (!passResult.valid) {
      setError(passResult.errors[0]);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, name.trim(), phone || undefined);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Become a Rena Cleaner</Text>
          <Text style={styles.subtitle}>Join our network and keep 90% of your earnings</Text>
        </View>

        {/* Value Props */}
        <View style={styles.valueProps}>
          {[
            { icon: 'wallet-outline', text: 'Keep 90% — only 10% platform fee' },
            { icon: 'time-outline', text: 'Set your own hours & rates' },
            { icon: 'people-outline', text: 'Build your client base' },
          ].map((prop) => (
            <View key={prop.text} style={styles.valueProp}>
              <Ionicons
                name={prop.icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={Colors.success}
              />
              <Text style={styles.valuePropText}>{prop.text}</Text>
            </View>
          ))}
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Input
          label="Full Name"
          placeholder="Jane Smith"
          value={name}
          onChangeText={setName}
          icon={<Ionicons name="person-outline" size={20} color={Colors.textMuted} />}
        />
        <Input
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          icon={<Ionicons name="mail-outline" size={20} color={Colors.textMuted} />}
        />
        <Input
          label="Phone"
          placeholder="07123 456789"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          icon={<Ionicons name="call-outline" size={20} color={Colors.textMuted} />}
        />
        <Input
          label="Password"
          placeholder="Min 8 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          icon={<Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} />}
        />
        <Input
          label="Confirm Password"
          placeholder="Re-enter password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          icon={<Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} />}
        />

        <Button title="Create Cleaner Account" onPress={handleSignUp} loading={loading} size="lg" />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already registered?</Text>
          <TouchableOpacity onPress={() => router.replace('/auth/login')}>
            <Text style={styles.footerLink}>Log In</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.terms}>
          By signing up, you agree to complete identity verification, DBS check, and right-to-work
          verification.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 16, marginTop: 16 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  valueProps: {
    gap: 8,
    marginBottom: 20,
    backgroundColor: `${Colors.success}08`,
    padding: 16,
    borderRadius: 12,
  },
  valueProp: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  valuePropText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: { fontSize: 14, color: Colors.error, flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 24 },
  footerText: { fontSize: 14, color: Colors.textSecondary },
  footerLink: { fontSize: 14, color: Colors.primaryDark, fontWeight: '600' },
  terms: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 16 },
});
