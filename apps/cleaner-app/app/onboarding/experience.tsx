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
import { Colors } from '@rena/shared';
import { useOnboarding } from '@/context/OnboardingContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const TOTAL_STEPS = 7;
const CURRENT_STEP = 2;

const SERVICE_TYPE_OPTIONS = [
  { id: 'standard', label: 'Standard Clean', icon: 'home-outline' as const },
  { id: 'deep', label: 'Deep Clean', icon: 'sparkles' as const },
  { id: 'eot', label: 'End of Tenancy', icon: 'key-outline' as const },
  { id: 'airbnb', label: 'AirBnB Turnaround', icon: 'bed-outline' as const },
];

const SPECIALTY_OPTIONS = [
  'Oven Cleaning',
  'Carpet Cleaning',
  'Window Cleaning',
  'Ironing',
  'Laundry',
  'Fridge Cleaning',
  'Organising',
  'Pet-Friendly',
];

const LANGUAGE_OPTIONS = [
  'English',
  'Polish',
  'Romanian',
  'Portuguese',
  'Spanish',
  'French',
  'Hindi',
  'Urdu',
  'Arabic',
  'Bengali',
];

export default function ExperienceScreen() {
  const router = useRouter();
  const { formData, updateExperience } = useOnboarding();
  const { experience } = formData;
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleArrayItem = (
    field: 'serviceTypes' | 'specialties' | 'languages',
    item: string
  ) => {
    const current = experience[field];
    const updated = current.includes(item)
      ? current.filter((v) => v !== item)
      : [...current, item];
    updateExperience({ [field]: updated });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!experience.yearsOfExperience) {
      newErrors.yearsOfExperience = 'Please enter your years of experience.';
    } else {
      const years = parseInt(experience.yearsOfExperience, 10);
      if (isNaN(years) || years < 0 || years > 50) {
        newErrors.yearsOfExperience = 'Please enter a valid number (0-50).';
      }
    }

    if (experience.serviceTypes.length === 0) {
      newErrors.serviceTypes = 'Please select at least one service type.';
    }

    if (!experience.bio.trim()) {
      newErrors.bio = 'Please write a short bio.';
    } else if (experience.bio.trim().length < 20) {
      newErrors.bio = 'Bio must be at least 20 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      router.push('/onboarding/pricing');
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

        <Text style={styles.title}>Experience & Skills</Text>
        <Text style={styles.subtitle}>Help customers understand your expertise.</Text>

        <Input
          label="Years of Experience"
          placeholder="3"
          value={experience.yearsOfExperience}
          onChangeText={(text) => updateExperience({ yearsOfExperience: text })}
          keyboardType="numeric"
          error={errors.yearsOfExperience}
          icon={<Ionicons name="time-outline" size={20} color={Colors.textMuted} />}
        />

        {/* Service Types */}
        <Text style={styles.sectionLabel}>Service Types</Text>
        {errors.serviceTypes && <Text style={styles.errorText}>{errors.serviceTypes}</Text>}
        <View style={styles.chipGrid}>
          {SERVICE_TYPE_OPTIONS.map((service) => {
            const selected = experience.serviceTypes.includes(service.id);
            return (
              <TouchableOpacity
                key={service.id}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleArrayItem('serviceTypes', service.id)}
              >
                <Ionicons
                  name={service.icon}
                  size={18}
                  color={selected ? Colors.white : Colors.textSecondary}
                />
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {service.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Specialties */}
        <Text style={styles.sectionLabel}>Specialties (optional)</Text>
        <View style={styles.chipGrid}>
          {SPECIALTY_OPTIONS.map((specialty) => {
            const selected = experience.specialties.includes(specialty);
            return (
              <TouchableOpacity
                key={specialty}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleArrayItem('specialties', specialty)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {specialty}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Languages */}
        <Text style={styles.sectionLabel}>Languages Spoken</Text>
        <View style={styles.chipGrid}>
          {LANGUAGE_OPTIONS.map((lang) => {
            const selected = experience.languages.includes(lang);
            return (
              <TouchableOpacity
                key={lang}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleArrayItem('languages', lang)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {lang}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bio */}
        <Input
          label="Bio"
          placeholder="Tell customers about yourself, your approach to cleaning, and what makes you stand out..."
          value={experience.bio}
          onChangeText={(text) => updateExperience({ bio: text })}
          multiline
          numberOfLines={5}
          error={errors.bio}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />

        <View style={styles.buttonRow}>
          <Button
            title="Back"
            onPress={() => router.back()}
            variant="outline"
            size="lg"
            style={styles.backButton}
          />
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
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 8,
  },
  errorText: { fontSize: 12, color: Colors.error, marginBottom: 4 },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  chipTextSelected: { color: Colors.white },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  backButton: { flex: 0.4 },
  nextButton: { flex: 0.6 },
});
