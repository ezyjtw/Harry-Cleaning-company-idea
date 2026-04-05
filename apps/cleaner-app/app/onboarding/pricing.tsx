import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, MIN_HOURLY_RATE, MAX_HOURLY_RATE, PLATFORM_FEE_PERCENT } from '@rena/shared';
import { useOnboarding } from '@/context/OnboardingContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const TOTAL_STEPS = 7;
const CURRENT_STEP = 3;

export default function PricingScreen() {
  const router = useRouter();
  const { formData, updatePricing } = useOnboarding();
  const { pricing } = formData;
  const [errors, setErrors] = useState<Record<string, string>>({});

  const hourlyRateNum = parseFloat(pricing.hourlyRate) || 0;
  const platformFee = hourlyRateNum * (PLATFORM_FEE_PERCENT / 100);
  const takeHome = hourlyRateNum - platformFee;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const rate = parseFloat(pricing.hourlyRate);
    if (!pricing.hourlyRate || isNaN(rate)) {
      newErrors.hourlyRate = 'Hourly rate is required.';
    } else if (rate < MIN_HOURLY_RATE || rate > MAX_HOURLY_RATE) {
      newErrors.hourlyRate = `Hourly rate must be between \u00A3${MIN_HOURLY_RATE} and \u00A3${MAX_HOURLY_RATE}.`;
    }

    if (pricing.sameDayRate) {
      const sameDayNum = parseFloat(pricing.sameDayRate);
      if (isNaN(sameDayNum) || sameDayNum < rate) {
        newErrors.sameDayRate = 'Same-day rate must be at least your hourly rate.';
      }
    }

    if (pricing.hoursPerWeek) {
      const hours = parseFloat(pricing.hoursPerWeek);
      if (isNaN(hours) || hours < 1 || hours > 80) {
        newErrors.hoursPerWeek = 'Hours per week must be between 1 and 80.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      router.push('/onboarding/identity');
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

        <Text style={styles.title}>Pricing & Availability</Text>
        <Text style={styles.subtitle}>Set your rates and typical working hours.</Text>

        <Input
          label="Hourly Rate (GBP)"
          placeholder="20"
          value={pricing.hourlyRate}
          onChangeText={(text) => updatePricing({ hourlyRate: text })}
          keyboardType="numeric"
          error={errors.hourlyRate}
          icon={<Text style={styles.poundIcon}>{'\u00A3'}</Text>}
        />
        <Text style={styles.hint}>
          Min \u00A3{MIN_HOURLY_RATE} / Max \u00A3{MAX_HOURLY_RATE} per hour
        </Text>

        {/* Earnings breakdown card */}
        {hourlyRateNum > 0 && (
          <Card style={styles.earningsCard}>
            <Text style={styles.earningsTitle}>Your Earnings Breakdown</Text>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>Customer pays</Text>
              <Text style={styles.earningsValue}>\u00A3{hourlyRateNum.toFixed(2)}/hr</Text>
            </View>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>
                Platform fee ({PLATFORM_FEE_PERCENT}%)
              </Text>
              <Text style={[styles.earningsValue, { color: Colors.error }]}>
                -\u00A3{platformFee.toFixed(2)}/hr
              </Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsRow}>
              <Text style={[styles.earningsLabel, { fontWeight: '700' }]}>You take home</Text>
              <Text style={[styles.earningsValue, styles.earningsHighlight]}>
                \u00A3{takeHome.toFixed(2)}/hr
              </Text>
            </View>
          </Card>
        )}

        <Input
          label="Same-Day Premium Rate (GBP, optional)"
          placeholder="25"
          value={pricing.sameDayRate}
          onChangeText={(text) => updatePricing({ sameDayRate: text })}
          keyboardType="numeric"
          error={errors.sameDayRate}
          icon={<Ionicons name="flash-outline" size={20} color={Colors.textMuted} />}
        />
        <Text style={styles.hint}>
          Higher rate for last-minute bookings. Leave blank to use your standard rate.
        </Text>

        <Input
          label="Typical Hours Per Week"
          placeholder="20"
          value={pricing.hoursPerWeek}
          onChangeText={(text) => updatePricing({ hoursPerWeek: text })}
          keyboardType="numeric"
          error={errors.hoursPerWeek}
          icon={<Ionicons name="time-outline" size={20} color={Colors.textMuted} />}
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
  poundIcon: { fontSize: 18, color: Colors.textMuted },
  hint: { fontSize: 12, color: Colors.textMuted, marginTop: -12, marginBottom: 16 },
  earningsCard: { marginBottom: 24, backgroundColor: '#F0FDFA' },
  earningsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  earningsLabel: { fontSize: 14, color: Colors.textSecondary },
  earningsValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  earningsDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  earningsHighlight: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  backButton: { flex: 0.4 },
  nextButton: { flex: 0.6 },
});
