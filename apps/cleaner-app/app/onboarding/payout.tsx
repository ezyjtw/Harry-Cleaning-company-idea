import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PLATFORM_FEE_PERCENT } from '@rena/shared';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const TOTAL_STEPS = 7;
const CURRENT_STEP = 6;

export default function PayoutScreen() {
  const router = useRouter();
  const { formData } = useOnboarding();
  const { api, user } = useAuth();
  const { pricing } = formData;
  const [sliderHours, setSliderHours] = useState(20);
  const [settingUp, setSettingUp] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState<'not_started' | 'pending' | 'active'>('not_started');

  const hourlyRate = parseFloat(pricing.hourlyRate) || 20;
  const takeHomeRate = hourlyRate * (1 - PLATFORM_FEE_PERCENT / 100);
  const weeklyEarnings = takeHomeRate * sliderHours;
  const monthlyEarnings = weeklyEarnings * 4.33;

  const handleSetUpRyft = async () => {
    setSettingUp(true);
    try {
      const response = await api.post('/api/cleaners/payout', {
        cleanerId: user?.id,
      });

      if (response.mock) {
        Alert.alert(
          'Payout Setup',
          'Ryft payouts are not yet configured for this environment. You can complete onboarding now and set up payouts later from your profile.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (response.status === 'active') {
        setPayoutStatus('active');
        Alert.alert('Already Set Up', 'Your payout account is already active.');
        return;
      }

      if (response.onboardingUrl) {
        setPayoutStatus('pending');
        await Linking.openURL(response.onboardingUrl);
      }
    } catch {
      Alert.alert(
        'Setup Error',
        'Could not connect to payout service. You can set this up later from your profile settings.',
        [{ text: 'OK' }]
      );
    } finally {
      setSettingUp(false);
    }
  };

  const increaseHours = () => {
    if (sliderHours < 60) setSliderHours((prev) => Math.min(prev + 5, 60));
  };

  const decreaseHours = () => {
    if (sliderHours > 5) setSliderHours((prev) => Math.max(prev - 5, 5));
  };

  return (
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

      <Text style={styles.title}>Payout Setup</Text>
      <Text style={styles.subtitle}>Set up how you get paid for your work.</Text>

      {/* Ryft Info Card */}
      <Card style={styles.ryftCard}>
        <View style={styles.ryftHeader}>
          <View style={styles.ryftIconContainer}>
            <Ionicons name="wallet-outline" size={28} color={Colors.primary} />
          </View>
          <View style={styles.ryftInfo}>
            <Text style={styles.ryftTitle}>Powered by Ryft</Text>
            <Text style={styles.ryftSubtitle}>Secure, fast payouts to your bank account</Text>
          </View>
        </View>

        <View style={styles.ryftFeatures}>
          {[
            { icon: 'flash-outline', text: 'Fast payouts within 2 business days' },
            { icon: 'shield-checkmark-outline', text: 'FCA-regulated payment provider' },
            { icon: 'card-outline', text: 'Direct to your UK bank account' },
          ].map((feature) => (
            <View key={feature.text} style={styles.featureRow}>
              <Ionicons
                name={feature.icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={Colors.success}
              />
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>

        {payoutStatus === 'active' ? (
          <View style={styles.activeRow}>
            <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
            <Text style={styles.activeText}>Payout account is active</Text>
          </View>
        ) : (
          <Button
            title={settingUp ? 'Setting up...' : payoutStatus === 'pending' ? 'Continue Setup' : 'Set Up Ryft'}
            onPress={handleSetUpRyft}
            size="lg"
            disabled={settingUp}
            icon={settingUp
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Ionicons name="arrow-forward" size={18} color={Colors.white} />
            }
          />
        )}
        <Text style={styles.ryftNote}>
          You can also set this up later from your profile settings.
        </Text>
      </Card>

      {/* Earnings Calculator */}
      <Card style={styles.calculatorCard}>
        <Text style={styles.calculatorTitle}>Earnings Calculator</Text>
        <Text style={styles.calculatorSubtitle}>
          See how much you could earn at your rate of {'\u00A3'}{hourlyRate.toFixed(0)}/hr
        </Text>

        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>Hours per week</Text>
          <View style={styles.sliderRow}>
            <Button
              title="-"
              onPress={decreaseHours}
              variant="outline"
              size="sm"
              style={styles.sliderButton}
            />
            <View style={styles.sliderValueContainer}>
              <Text style={styles.sliderValue}>{sliderHours}</Text>
              <Text style={styles.sliderUnit}>hrs/wk</Text>
            </View>
            <Button
              title="+"
              onPress={increaseHours}
              variant="outline"
              size="sm"
              style={styles.sliderButton}
            />
          </View>
        </View>

        <View style={styles.earningsGrid}>
          <View style={styles.earningsItem}>
            <Text style={styles.earningsItemLabel}>Weekly</Text>
            <Text style={styles.earningsItemValue}>
              {'\u00A3'}{weeklyEarnings.toFixed(0)}
            </Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsItem}>
            <Text style={styles.earningsItemLabel}>Monthly</Text>
            <Text style={[styles.earningsItemValue, styles.earningsHighlight]}>
              {'\u00A3'}{monthlyEarnings.toFixed(0)}
            </Text>
          </View>
        </View>

        <Text style={styles.calculatorDisclaimer}>
          Estimates based on your hourly rate after the {PLATFORM_FEE_PERCENT}% platform fee.
          Actual earnings depend on bookings received.
        </Text>
      </Card>

      <View style={styles.buttonRow}>
        <Button
          title="Back"
          onPress={() => router.back()}
          variant="outline"
          size="lg"
          style={styles.backButton}
        />
        <Button
          title="Next"
          onPress={() => router.push('/onboarding/review')}
          size="lg"
          style={styles.nextButton}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  ryftCard: { marginBottom: 24 },
  ryftHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  ryftIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ryftInfo: { flex: 1 },
  ryftTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  ryftSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  ryftFeatures: { gap: 10, marginBottom: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  ryftNote: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
  },
  calculatorCard: { marginBottom: 24 },
  calculatorTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  calculatorSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },
  sliderContainer: { marginBottom: 20 },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  sliderButton: { width: 44, height: 44, paddingHorizontal: 0 },
  sliderValueContainer: { alignItems: 'center' },
  sliderValue: { fontSize: 36, fontWeight: '700', color: Colors.primary },
  sliderUnit: { fontSize: 12, color: Colors.textMuted },
  earningsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  earningsItem: { flex: 1, alignItems: 'center' },
  earningsItemLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  earningsItemValue: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  earningsDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  earningsHighlight: { color: Colors.primary },
  calculatorDisclaimer: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
  },
  activeText: { fontSize: 15, fontWeight: '600', color: Colors.success },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  backButton: { flex: 0.4 },
  nextButton: { flex: 0.6 },
});
