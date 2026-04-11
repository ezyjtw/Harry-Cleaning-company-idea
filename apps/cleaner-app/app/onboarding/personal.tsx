import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, validateEmail, validatePhone, validatePostcode } from '@rena/shared';
import { useOnboarding } from '@/context/OnboardingContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const TOTAL_STEPS = 7;
const CURRENT_STEP = 1;

export default function PersonalScreen() {
  const router = useRouter();
  const { formData, updatePersonal } = useOnboarding();
  const { personal } = formData;
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      updatePersonal({ profilePhotoUri: result.assets[0].uri });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!personal.fullName.trim()) {
      newErrors.fullName = 'Full name is required.';
    }

    const emailResult = validateEmail(personal.email);
    if (!emailResult.valid) {
      newErrors.email = emailResult.error ?? 'Invalid email.';
    }

    const phoneResult = validatePhone(personal.phone);
    if (!phoneResult.valid) {
      newErrors.phone = phoneResult.error ?? 'Invalid phone number.';
    }

    const postcodeResult = validatePostcode(personal.postcode);
    if (!postcodeResult.valid) {
      newErrors.postcode = postcodeResult.error ?? 'Invalid postcode.';
    }

    if (!personal.dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required.';
    } else {
      const dob = new Date(personal.dateOfBirth);
      const age = Math.floor(
        (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
      if (age < 18) {
        newErrors.dateOfBirth = 'You must be at least 18 years old.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      router.push('/onboarding/experience');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Progress */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepLabel}>Step {CURRENT_STEP} of {TOTAL_STEPS}</Text>
          <View style={styles.progressBar}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressSegment,
                  i < CURRENT_STEP && styles.progressSegmentActive,
                ]}
              />
            ))}
          </View>
        </View>

        <Text style={styles.title}>Personal Information</Text>
        <Text style={styles.subtitle}>Tell us about yourself to get started.</Text>

        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoButton} onPress={pickPhoto}>
            {personal.profilePhotoUri ? (
              <Image source={{ uri: personal.profilePhotoUri }} style={styles.photoImage} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.photoText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Input
          label="Full Name"
          placeholder="Jane Smith"
          value={personal.fullName}
          onChangeText={(text) => updatePersonal({ fullName: text })}
          error={errors.fullName}
          icon={<Ionicons name="person-outline" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="Email"
          placeholder="you@example.com"
          value={personal.email}
          onChangeText={(text) => updatePersonal({ email: text })}
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
          icon={<Ionicons name="mail-outline" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="Phone Number"
          placeholder="07123 456789"
          value={personal.phone}
          onChangeText={(text) => updatePersonal({ phone: text })}
          keyboardType="phone-pad"
          error={errors.phone}
          icon={<Ionicons name="call-outline" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="Postcode"
          placeholder="SW1A 1AA"
          value={personal.postcode}
          onChangeText={(text) => updatePersonal({ postcode: text })}
          autoCapitalize="characters"
          error={errors.postcode}
          icon={<Ionicons name="location-outline" size={20} color={Colors.textMuted} />}
        />

        <Input
          label="Date of Birth (YYYY-MM-DD)"
          placeholder="1990-01-15"
          value={personal.dateOfBirth}
          onChangeText={(text) => updatePersonal({ dateOfBirth: text })}
          error={errors.dateOfBirth}
          icon={<Ionicons name="calendar-outline" size={20} color={Colors.textMuted} />}
        />

        <View style={styles.buttonRow}>
          <Button title="Next" onPress={handleNext} size="lg" style={styles.nextButton} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 24, paddingBottom: 40 },
  progressContainer: { marginBottom: 24 },
  stepLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8 },
  progressBar: { flexDirection: 'row', gap: 4 },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  progressSegmentActive: {
    backgroundColor: Colors.primary,
  },
  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 24 },
  photoSection: { alignItems: 'center', marginBottom: 24 },
  photoButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  photoImage: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  photoText: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  nextButton: { flex: 1 },
});
