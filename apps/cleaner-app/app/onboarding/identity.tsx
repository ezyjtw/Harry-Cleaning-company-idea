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
import { Colors } from '@rena/shared';
import { useOnboarding, type RightToWorkDocType } from '@/context/OnboardingContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const TOTAL_STEPS = 7;
const CURRENT_STEP = 4;

const DOC_TYPE_OPTIONS: { id: RightToWorkDocType; label: string; icon: string }[] = [
  { id: 'uk_passport', label: 'UK Passport', icon: 'document-outline' },
  { id: 'irish_passport', label: 'Irish Passport', icon: 'document-outline' },
  { id: 'brp', label: 'Biometric Residence Permit', icon: 'card-outline' },
  { id: 'eu_settled', label: 'EU Settled Status', icon: 'shield-checkmark-outline' },
  { id: 'eu_pre_settled', label: 'EU Pre-Settled Status', icon: 'shield-outline' },
  { id: 'share_code', label: 'Share Code', icon: 'qr-code-outline' },
  { id: 'visa', label: 'Visa', icon: 'airplane-outline' },
];

const NEEDS_SHARE_CODE: RightToWorkDocType[] = ['eu_settled', 'eu_pre_settled', 'share_code'];
const NEEDS_EXPIRY: RightToWorkDocType[] = ['brp', 'eu_pre_settled', 'visa'];

export default function IdentityScreen() {
  const router = useRouter();
  const { formData, updateIdentity } = useOnboarding();
  const { identity } = formData;
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pickDocument = async (field: 'photoIdUri' | 'rightToWorkDocUri') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      updateIdentity({ [field]: result.assets[0].uri });
    }
  };

  const showShareCode = identity.rightToWorkDocType
    ? NEEDS_SHARE_CODE.includes(identity.rightToWorkDocType as RightToWorkDocType)
    : false;

  const showExpiry = identity.rightToWorkDocType
    ? NEEDS_EXPIRY.includes(identity.rightToWorkDocType as RightToWorkDocType)
    : false;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!identity.photoIdUri) {
      newErrors.photoIdUri = 'Please upload a photo ID.';
    }

    if (!identity.rightToWorkDocType) {
      newErrors.rightToWorkDocType = 'Please select a document type.';
    }

    if (!identity.rightToWorkDocUri) {
      newErrors.rightToWorkDocUri = 'Please upload your right to work document.';
    }

    if (showShareCode && !identity.shareCode.trim()) {
      newErrors.shareCode = 'Share code is required for this document type.';
    }

    if (showExpiry && !identity.expiryDate) {
      newErrors.expiryDate = 'Expiry date is required for this document type.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      router.push('/onboarding/dbs-check');
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

        <Text style={styles.title}>Identity & Right to Work</Text>
        <Text style={styles.subtitle}>
          We need to verify your identity and right to work in the UK.
        </Text>

        {/* Info notice */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              Your documents are encrypted and stored securely. We only use them for verification
              purposes.
            </Text>
          </View>
        </Card>

        {/* Photo ID Upload */}
        <Text style={styles.sectionLabel}>Photo ID</Text>
        {errors.photoIdUri && <Text style={styles.errorText}>{errors.photoIdUri}</Text>}
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => pickDocument('photoIdUri')}
        >
          {identity.photoIdUri ? (
            <View style={styles.uploadedRow}>
              <Image
                source={{ uri: identity.photoIdUri }}
                style={styles.uploadedThumb}
              />
              <View style={styles.uploadedInfo}>
                <Text style={styles.uploadedLabel}>Photo ID uploaded</Text>
                <Text style={styles.uploadedHint}>Tap to change</Text>
              </View>
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="cloud-upload-outline" size={28} color={Colors.primary} />
              <Text style={styles.uploadLabel}>Upload Photo ID</Text>
              <Text style={styles.uploadHint}>Passport, driving licence, or national ID card</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Right to Work Document Type */}
        <Text style={styles.sectionLabel}>Right to Work Document</Text>
        {errors.rightToWorkDocType && (
          <Text style={styles.errorText}>{errors.rightToWorkDocType}</Text>
        )}
        <View style={styles.docTypeGrid}>
          {DOC_TYPE_OPTIONS.map((docType) => {
            const selected = identity.rightToWorkDocType === docType.id;
            return (
              <TouchableOpacity
                key={docType.id}
                style={[styles.docTypeItem, selected && styles.docTypeItemSelected]}
                onPress={() =>
                  updateIdentity({
                    rightToWorkDocType: docType.id,
                    shareCode: '',
                    expiryDate: '',
                  })
                }
              >
                <Ionicons
                  name={docType.icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={selected ? Colors.white : Colors.textSecondary}
                />
                <Text
                  style={[styles.docTypeText, selected && styles.docTypeTextSelected]}
                  numberOfLines={2}
                >
                  {docType.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Document Upload */}
        {identity.rightToWorkDocType !== '' && (
          <>
            <Text style={styles.sectionLabel}>Upload Document</Text>
            {errors.rightToWorkDocUri && (
              <Text style={styles.errorText}>{errors.rightToWorkDocUri}</Text>
            )}
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => pickDocument('rightToWorkDocUri')}
            >
              {identity.rightToWorkDocUri ? (
                <View style={styles.uploadedRow}>
                  <Image
                    source={{ uri: identity.rightToWorkDocUri }}
                    style={styles.uploadedThumb}
                  />
                  <View style={styles.uploadedInfo}>
                    <Text style={styles.uploadedLabel}>Document uploaded</Text>
                    <Text style={styles.uploadedHint}>Tap to change</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                </View>
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="cloud-upload-outline" size={28} color={Colors.primary} />
                  <Text style={styles.uploadLabel}>Upload Document</Text>
                  <Text style={styles.uploadHint}>
                    Photo or scan of your right to work document
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Conditional: Share Code */}
        {showShareCode && (
          <Input
            label="Share Code"
            placeholder="e.g. ABC123XYZ"
            value={identity.shareCode}
            onChangeText={(text) => updateIdentity({ shareCode: text })}
            autoCapitalize="characters"
            error={errors.shareCode}
            icon={<Ionicons name="qr-code-outline" size={20} color={Colors.textMuted} />}
          />
        )}

        {/* Conditional: Expiry Date */}
        {showExpiry && (
          <Input
            label="Expiry Date (YYYY-MM-DD)"
            placeholder="2027-06-30"
            value={identity.expiryDate}
            onChangeText={(text) => updateIdentity({ expiryDate: text })}
            error={errors.expiryDate}
            icon={<Ionicons name="calendar-outline" size={20} color={Colors.textMuted} />}
          />
        )}

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
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 16 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 8,
  },
  errorText: { fontSize: 12, color: Colors.error, marginBottom: 4 },
  infoCard: { marginBottom: 20, backgroundColor: '#F0FDFA' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoText: { fontSize: 13, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  uploadButton: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    marginBottom: 16,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  uploadLabel: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  uploadHint: { fontSize: 12, color: Colors.textMuted },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  uploadedThumb: { width: 50, height: 50, borderRadius: 8 },
  uploadedInfo: { flex: 1 },
  uploadedLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  uploadedHint: { fontSize: 12, color: Colors.textMuted },
  docTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  docTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  docTypeItemSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  docTypeText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  docTypeTextSelected: { color: Colors.white },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  backButton: { flex: 0.4 },
  nextButton: { flex: 0.6 },
});
