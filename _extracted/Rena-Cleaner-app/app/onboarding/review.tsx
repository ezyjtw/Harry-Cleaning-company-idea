import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PLATFORM_FEE_PERCENT } from '@rena/shared';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const TOTAL_STEPS = 7;
const CURRENT_STEP = 7;

const DOC_TYPE_LABELS: Record<string, string> = {
  uk_passport: 'UK Passport',
  irish_passport: 'Irish Passport',
  brp: 'Biometric Residence Permit',
  eu_settled: 'EU Settled Status',
  eu_pre_settled: 'EU Pre-Settled Status',
  share_code: 'Share Code',
  visa: 'Visa',
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  standard: 'Standard Clean',
  deep: 'Deep Clean',
  eot: 'End of Tenancy',
  airbnb: 'AirBnB Turnaround',
};

export default function ReviewScreen() {
  const router = useRouter();
  const { formData, updateReview, clearOnboarding } = useOnboarding();
  const { api } = useAuth();
  const { personal, experience, pricing, identity, dbsCheck, review } = formData;
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const appendFileToForm = async (
    form: globalThis.FormData,
    fieldName: string,
    uri: string | undefined,
    filename: string
  ) => {
    if (!uri) return;
    const response = await fetch(uri);
    const blob = await response.blob();
    form.append(fieldName, blob, filename);
  };

  const handleSubmit = async () => {
    if (!review.agreedToTerms) {
      Alert.alert('Terms Required', 'Please agree to the Terms & Conditions to continue.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const form = new FormData();

      // Text fields
      form.append('name', personal.fullName);
      form.append('email', personal.email);
      form.append('phone', personal.phone);
      form.append('postcode', personal.postcode);
      if (personal.dateOfBirth) form.append('dateOfBirth', personal.dateOfBirth);
      if (experience.bio) form.append('bio', experience.bio);
      form.append('hourlyRate', String(parseFloat(pricing.hourlyRate) || 15));
      form.append('sameDayRate', String(parseFloat(pricing.sameDayRate) || parseFloat(pricing.hourlyRate) || 15));
      form.append('hoursPerWeek', String(parseFloat(pricing.hoursPerWeek) || 0));
      form.append('yearsExperience', String(parseInt(experience.yearsOfExperience, 10) || 0));
      form.append('serviceTypes', JSON.stringify(experience.serviceTypes));
      form.append('specialties', JSON.stringify(experience.specialties));
      form.append('languages', JSON.stringify(experience.languages));

      // Identity & DBS
      if (identity.rightToWorkDocType) form.append('rightToWorkDocType', identity.rightToWorkDocType);
      if (identity.shareCode) form.append('shareCode', identity.shareCode);
      if (identity.expiryDate) form.append('expiryDate', identity.expiryDate);
      if (dbsCheck.dbsOption) form.append('dbsOption', dbsCheck.dbsOption);
      if (dbsCheck.dbsCertNumber) form.append('dbsCertNumber', dbsCheck.dbsCertNumber);
      if (dbsCheck.dbsIssueDate) form.append('dbsIssueDate', dbsCheck.dbsIssueDate);

      // File uploads
      await Promise.all([
        appendFileToForm(form, 'profilePhoto', personal.profilePhotoUri, 'profile_photo.jpg'),
        appendFileToForm(form, 'photoId', identity.photoIdUri, 'photo_id.jpg'),
        appendFileToForm(form, 'rightToWorkDoc', identity.rightToWorkDocUri, 'right_to_work.pdf'),
        appendFileToForm(form, 'dbsCertFile', dbsCheck.dbsCertFileUri, 'dbs_certificate.pdf'),
        appendFileToForm(form, 'selfiePhoto', dbsCheck.selfieUri, 'selfie.jpg'),
      ]);

      await api.postForm('/api/cleaners/onboarding', form);
      await clearOnboarding();
      setSubmitted(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to submit application. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Success Screen ──────────────────────────────────────────

  if (submitted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.successContent}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
        </View>
        <Text style={styles.successTitle}>Application Submitted!</Text>
        <Text style={styles.successSubtitle}>
          Thank you for applying to join Rena. We will review your application and verify your
          documents. You will receive an email once your account is approved.
        </Text>

        <Card style={styles.successCard}>
          <Text style={styles.successCardTitle}>What happens next?</Text>
          {[
            { step: '1', text: 'We verify your identity and right to work documents' },
            { step: '2', text: 'Your DBS check is processed (if applicable)' },
            { step: '3', text: 'Your account is activated and you can start receiving bookings' },
          ].map((item) => (
            <View key={item.step} style={styles.successStep}>
              <View style={styles.successStepNumber}>
                <Text style={styles.successStepNumberText}>{item.step}</Text>
              </View>
              <Text style={styles.successStepText}>{item.text}</Text>
            </View>
          ))}
        </Card>

        <Button
          title="Go to Dashboard"
          onPress={() => router.replace('/(tabs)')}
          size="lg"
          style={styles.successButton}
        />
      </ScrollView>
    );
  }

  // ─── Review Screen ───────────────────────────────────────────

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

      <Text style={styles.title}>Review & Submit</Text>
      <Text style={styles.subtitle}>
        Please review all your information before submitting.
      </Text>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={20} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Personal Summary */}
      <SummaryCard
        title="Personal Information"
        icon="person-outline"
        onEdit={() => router.push('/onboarding/personal')}
      >
        {personal.profilePhotoUri ? (
          <Image source={{ uri: personal.profilePhotoUri }} style={styles.reviewPhoto} />
        ) : null}
        <SummaryRow label="Name" value={personal.fullName} />
        <SummaryRow label="Email" value={personal.email} />
        <SummaryRow label="Phone" value={personal.phone} />
        <SummaryRow label="Postcode" value={personal.postcode} />
        <SummaryRow label="Date of Birth" value={personal.dateOfBirth} />
      </SummaryCard>

      {/* Experience Summary */}
      <SummaryCard
        title="Experience & Skills"
        icon="ribbon-outline"
        onEdit={() => router.push('/onboarding/experience')}
      >
        <SummaryRow label="Years of Experience" value={experience.yearsOfExperience} />
        <Text style={styles.summaryLabel}>Service Types</Text>
        <View style={styles.badgeRow}>
          {experience.serviceTypes.map((s) => (
            <Badge key={s} label={SERVICE_TYPE_LABELS[s] || s} />
          ))}
        </View>
        {experience.specialties.length > 0 && (
          <>
            <Text style={styles.summaryLabel}>Specialties</Text>
            <View style={styles.badgeRow}>
              {experience.specialties.map((s) => (
                <Badge
                  key={s}
                  label={s}
                  backgroundColor={Colors.background}
                  color={Colors.textPrimary}
                />
              ))}
            </View>
          </>
        )}
        {experience.languages.length > 0 && (
          <SummaryRow label="Languages" value={experience.languages.join(', ')} />
        )}
        <SummaryRow label="Bio" value={experience.bio} />
      </SummaryCard>

      {/* Pricing Summary */}
      <SummaryCard
        title="Pricing & Availability"
        icon="cash-outline"
        onEdit={() => router.push('/onboarding/pricing')}
      >
        <SummaryRow label="Hourly Rate" value={`\u00A3${pricing.hourlyRate}/hr`} />
        {pricing.sameDayRate ? (
          <SummaryRow label="Same-Day Rate" value={`\u00A3${pricing.sameDayRate}/hr`} />
        ) : null}
        {pricing.hoursPerWeek ? (
          <SummaryRow label="Hours Per Week" value={pricing.hoursPerWeek} />
        ) : null}
        <SummaryRow
          label="Take-Home Rate"
          value={`\u00A3${(
            (parseFloat(pricing.hourlyRate) || 0) *
            (1 - PLATFORM_FEE_PERCENT / 100)
          ).toFixed(2)}/hr`}
          highlight
        />
      </SummaryCard>

      {/* Identity Summary */}
      <SummaryCard
        title="Identity & Right to Work"
        icon="shield-checkmark-outline"
        onEdit={() => router.push('/onboarding/identity')}
      >
        <SummaryRow
          label="Photo ID"
          value={identity.photoIdUri ? 'Uploaded' : 'Not uploaded'}
          success={!!identity.photoIdUri}
        />
        <SummaryRow
          label="Document Type"
          value={DOC_TYPE_LABELS[identity.rightToWorkDocType] || 'Not selected'}
        />
        <SummaryRow
          label="Document"
          value={identity.rightToWorkDocUri ? 'Uploaded' : 'Not uploaded'}
          success={!!identity.rightToWorkDocUri}
        />
        {identity.shareCode ? (
          <SummaryRow label="Share Code" value={identity.shareCode} />
        ) : null}
        {identity.expiryDate ? (
          <SummaryRow label="Expiry Date" value={identity.expiryDate} />
        ) : null}
      </SummaryCard>

      {/* DBS Summary */}
      <SummaryCard
        title="DBS & Background Check"
        icon="finger-print-outline"
        onEdit={() => router.push('/onboarding/dbs-check')}
      >
        <SummaryRow
          label="DBS Option"
          value={
            dbsCheck.dbsOption === 'existing'
              ? 'Existing certificate'
              : dbsCheck.dbsOption === 'new'
                ? 'New check required'
                : 'Not selected'
          }
        />
        {dbsCheck.dbsOption === 'existing' && (
          <>
            <SummaryRow label="Certificate Number" value={dbsCheck.dbsCertNumber} />
            <SummaryRow label="Issue Date" value={dbsCheck.dbsIssueDate} />
            <SummaryRow
              label="Certificate"
              value={dbsCheck.dbsCertFileUri ? 'Uploaded' : 'Not uploaded'}
              success={!!dbsCheck.dbsCertFileUri}
            />
          </>
        )}
        <SummaryRow
          label="Selfie (Liveness)"
          value={dbsCheck.selfieUri ? 'Captured' : 'Not taken'}
          success={!!dbsCheck.selfieUri}
        />
      </SummaryCard>

      {/* Terms & Conditions */}
      <TouchableOpacity
        style={styles.termsRow}
        onPress={() => updateReview({ agreedToTerms: !review.agreedToTerms })}
      >
        <View
          style={[
            styles.checkbox,
            review.agreedToTerms && styles.checkboxChecked,
          ]}
        >
          {review.agreedToTerms && (
            <Ionicons name="checkmark" size={16} color={Colors.white} />
          )}
        </View>
        <Text style={styles.termsText}>
          I agree to the{' '}
          <Text
            style={styles.termsLink}
            onPress={() => router.push('/terms')}
          >
            Terms & Conditions
          </Text>{' '}
          and{' '}
          <Text
            style={styles.termsLink}
            onPress={() => router.push('/privacy-policy')}
          >
            Privacy Policy
          </Text>
        </Text>
      </TouchableOpacity>

      <View style={styles.buttonRow}>
        <Button
          title="Back"
          onPress={() => router.back()}
          variant="outline"
          size="lg"
          style={styles.backButton}
        />
        <Button
          title="Submit Application"
          onPress={handleSubmit}
          loading={loading}
          size="lg"
          style={styles.nextButton}
          icon={<Ionicons name="checkmark-circle" size={20} color={Colors.white} />}
        />
      </View>
    </ScrollView>
  );
}

// ─── Helper Components ─────────────────────────────────────────

function SummaryCard({
  title,
  icon,
  onEdit,
  children,
}: {
  title: string;
  icon: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card style={summaryStyles.card}>
      <View style={summaryStyles.cardHeader}>
        <View style={summaryStyles.cardTitleRow}>
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={Colors.primary}
          />
          <Text style={summaryStyles.cardTitle}>{title}</Text>
        </View>
        <TouchableOpacity onPress={onEdit} style={summaryStyles.editButton}>
          <Ionicons name="pencil" size={16} color={Colors.primary} />
          <Text style={summaryStyles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>
      {children}
    </Card>
  );
}

function SummaryRow({
  label,
  value,
  success,
  highlight,
}: {
  label: string;
  value: string;
  success?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={summaryStyles.row}>
      <Text style={summaryStyles.label}>{label}</Text>
      <Text
        style={[
          summaryStyles.value,
          success === true && summaryStyles.successValue,
          success === false && summaryStyles.errorValue,
          highlight && summaryStyles.highlightValue,
        ]}
        numberOfLines={3}
      >
        {value || '-'}
      </Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const summaryStyles = StyleSheet.create({
  card: { marginBottom: 16 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  label: { fontSize: 13, color: Colors.textSecondary, flex: 0.4 },
  value: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary, flex: 0.6, textAlign: 'right' },
  successValue: { color: Colors.success },
  errorValue: { color: Colors.error },
  highlightValue: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
});

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
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 20 },
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
  reviewPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignSelf: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 4,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
    marginTop: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  termsText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
  buttonRow: { flexDirection: 'row', gap: 12 },
  backButton: { flex: 0.3 },
  nextButton: { flex: 0.7 },
  // Success screen
  successContent: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  successIcon: { marginTop: 40, marginBottom: 20 },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  successCard: { width: '100%', marginBottom: 32 },
  successCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  successStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  successStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successStepNumberText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  successStepText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
    marginTop: 3,
  },
  successButton: { width: '100%' },
});
