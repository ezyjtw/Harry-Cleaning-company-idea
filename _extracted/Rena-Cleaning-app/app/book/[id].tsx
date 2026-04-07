import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, ServiceTypes, PropertySizes, Frequencies } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Step = 'service' | 'details' | 'schedule' | 'review';
const STEPS: Step[] = ['service', 'details', 'schedule', 'review'];

export default function BookingFlowScreen() {
  const { id: cleanerId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { api, isAuthenticated } = useAuth();

  const { data: cleaner } = useApi(() => api.getCleaner(cleanerId ?? ''), [cleanerId]);

  const [step, setStep] = useState<Step>('service');
  const [serviceType, setServiceType] = useState('');
  const [propertySize, setPropertySize] = useState('');
  const [frequency, setFrequency] = useState('ONE_OFF');
  const [hours, setHours] = useState('3');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const currentStepIndex = STEPS.indexOf(step);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex]);
    }
  };

  const handleBook = async () => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    setLoading(true);
    try {
      const booking = await api.createBooking({
        cleanerId: cleanerId ?? '',
        serviceType,
        date,
        time,
        duration: parseFloat(hours),
        address: `${address}, ${postcode}`,
        notes,
        totalPrice: 0, // calculated server-side
      } as never);
      router.replace(`/booking/${booking.id}`);
    } catch (err) {
      Alert.alert('Booking Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Progress */}
      <View style={styles.progressRow}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.progressItem}>
            <View style={[styles.progressDot, i <= currentStepIndex && styles.progressDotActive]} />
            <Text
              style={[styles.progressLabel, i <= currentStepIndex && styles.progressLabelActive]}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </View>
        ))}
      </View>

      {/* Step: Service */}
      {step === 'service' && (
        <View>
          <Text style={styles.stepTitle}>What type of clean?</Text>
          {ServiceTypes.map((service) => (
            <TouchableOpacity
              key={service.slug}
              style={[styles.optionCard, serviceType === service.slug && styles.optionCardActive]}
              onPress={() => setServiceType(service.slug)}
            >
              <Ionicons
                name={service.icon as keyof typeof Ionicons.glyphMap}
                size={24}
                color={serviceType === service.slug ? Colors.primary : Colors.textMuted}
              />
              <Text
                style={[styles.optionText, serviceType === service.slug && styles.optionTextActive]}
              >
                {service.name}
              </Text>
              {serviceType === service.slug && (
                <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
              )}
            </TouchableOpacity>
          ))}
          <Button
            title="Continue"
            onPress={handleNext}
            disabled={!serviceType}
            style={styles.ctaButton}
          />
        </View>
      )}

      {/* Step: Details */}
      {step === 'details' && (
        <View>
          <Text style={styles.stepTitle}>Property details</Text>

          <Text style={styles.fieldLabel}>Property size</Text>
          <View style={styles.chipRow}>
            {PropertySizes.map((size) => (
              <TouchableOpacity
                key={size.value}
                style={[styles.chip, propertySize === size.value && styles.chipActive]}
                onPress={() => setPropertySize(size.value)}
              >
                <Text
                  style={[styles.chipText, propertySize === size.value && styles.chipTextActive]}
                >
                  {size.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>How often?</Text>
          <View style={styles.chipRow}>
            {Frequencies.map((freq) => (
              <TouchableOpacity
                key={freq.value}
                style={[styles.chip, frequency === freq.value && styles.chipActive]}
                onPress={() => setFrequency(freq.value)}
              >
                <Text style={[styles.chipText, frequency === freq.value && styles.chipTextActive]}>
                  {freq.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Duration (hours)"
            value={hours}
            onChangeText={setHours}
            keyboardType="numeric"
          />

          <View style={styles.navRow}>
            <Button title="Back" onPress={handleBack} variant="outline" style={styles.navButton} />
            <Button title="Continue" onPress={handleNext} style={styles.navButton} />
          </View>
        </View>
      )}

      {/* Step: Schedule */}
      {step === 'schedule' && (
        <View>
          <Text style={styles.stepTitle}>When and where?</Text>

          <Input label="Date" placeholder="DD/MM/YYYY" value={date} onChangeText={setDate} />
          <Input label="Preferred time" placeholder="09:00" value={time} onChangeText={setTime} />
          <Input
            label="Address"
            placeholder="123 High Street"
            value={address}
            onChangeText={setAddress}
          />
          <Input
            label="Postcode"
            placeholder="E17 4PP"
            value={postcode}
            onChangeText={setPostcode}
            autoCapitalize="characters"
          />
          <Input
            label="Special instructions (optional)"
            placeholder="Any notes for the cleaner..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          <View style={styles.navRow}>
            <Button title="Back" onPress={handleBack} variant="outline" style={styles.navButton} />
            <Button title="Review" onPress={handleNext} style={styles.navButton} />
          </View>
        </View>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <View>
          <Text style={styles.stepTitle}>Review your booking</Text>

          <Card style={styles.reviewCard}>
            {cleaner && (
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Cleaner</Text>
                <Text style={styles.reviewValue}>{cleaner.name}</Text>
              </View>
            )}
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Service</Text>
              <Text style={styles.reviewValue}>{serviceType}</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Property</Text>
              <Text style={styles.reviewValue}>
                {PropertySizes.find((p) => p.value === propertySize)?.label || '-'}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Frequency</Text>
              <Text style={styles.reviewValue}>
                {Frequencies.find((f) => f.value === frequency)?.label || '-'}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Duration</Text>
              <Text style={styles.reviewValue}>{hours} hours</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Date & Time</Text>
              <Text style={styles.reviewValue}>
                {date} at {time}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Address</Text>
              <Text style={styles.reviewValue}>
                {address}, {postcode}
              </Text>
            </View>
            {notes ? (
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Notes</Text>
                <Text style={styles.reviewValue}>{notes}</Text>
              </View>
            ) : null}
          </Card>

          {cleaner && (
            <Card style={[styles.reviewCard, { marginTop: 12 }]}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Rate</Text>
                <Text style={styles.reviewValue}>
                  {'\u00A3'}
                  {cleaner.hourlyRate}/hr
                </Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Duration</Text>
                <Text style={styles.reviewValue}>{hours} hrs</Text>
              </View>
              <View style={[styles.reviewRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.reviewLabel, { fontWeight: '700' }]}>Estimated Total</Text>
                <Text style={[styles.reviewValue, { fontWeight: '700', color: Colors.primary }]}>
                  {'\u00A3'}
                  {(cleaner.hourlyRate * parseFloat(hours || '0')).toFixed(2)}
                </Text>
              </View>
              <Text style={styles.feeNote}>
                A 6% service fee will be added at checkout. Your cleaner keeps 90%.
              </Text>
            </Card>
          )}

          <View style={styles.navRow}>
            <Button title="Back" onPress={handleBack} variant="outline" style={styles.navButton} />
            <Button
              title="Confirm Booking"
              onPress={handleBook}
              loading={loading}
              style={styles.navButton}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  progressItem: { alignItems: 'center', flex: 1 },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
    marginBottom: 4,
  },
  progressDotActive: { backgroundColor: Colors.primary },
  progressLabel: { fontSize: 11, color: Colors.textMuted },
  progressLabelActive: { color: Colors.primary, fontWeight: '600' },
  stepTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.white,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  optionCardActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}08` },
  optionText: { flex: 1, fontSize: 16, fontWeight: '500', color: Colors.textPrimary },
  optionTextActive: { color: Colors.primary },
  ctaButton: { marginTop: 20 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}08` },
  chipText: { fontSize: 14, color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontWeight: '600' },
  navRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  navButton: { flex: 1 },
  reviewCard: { padding: 16 },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reviewLabel: { fontSize: 14, color: Colors.textSecondary },
  reviewValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  feeNote: { fontSize: 12, color: Colors.textMuted, marginTop: 10, textAlign: 'center' },
});
