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
import { useOnboarding, type DbsOption } from '@/context/OnboardingContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const TOTAL_STEPS = 7;
const CURRENT_STEP = 5;

export default function DbsCheckScreen() {
  const router = useRouter();
  const { formData, updateDbsCheck } = useOnboarding();
  const { dbsCheck } = formData;
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectOption = (option: DbsOption) => {
    updateDbsCheck({
      dbsOption: option,
      dbsCertNumber: '',
      dbsIssueDate: '',
      dbsCertFileUri: '',
    });
  };

  const pickCert = async () => {
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
      updateDbsCheck({ dbsCertFileUri: result.assets[0].uri });
    }
  };

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your camera for the liveness check.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]) {
      updateDbsCheck({ selfieUri: result.assets[0].uri });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!dbsCheck.dbsOption) {
      newErrors.dbsOption = 'Please select a DBS check option.';
    }

    if (dbsCheck.dbsOption === 'existing') {
      if (!dbsCheck.dbsCertNumber.trim()) {
        newErrors.dbsCertNumber = 'DBS certificate number is required.';
      } else if (!/^\d{12}$/.test(dbsCheck.dbsCertNumber.trim())) {
        newErrors.dbsCertNumber = 'DBS certificate number must be 12 digits.';
      }

      if (!dbsCheck.dbsIssueDate) {
        newErrors.dbsIssueDate = 'Issue date is required.';
      }

      if (!dbsCheck.dbsCertFileUri) {
        newErrors.dbsCertFileUri = 'Please upload your DBS certificate.';
      }
    }

    if (!dbsCheck.selfieUri) {
      newErrors.selfieUri = 'Please take a selfie for the liveness check.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      router.push('/onboarding/payout');
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

        <Text style={styles.title}>DBS & Background Check</Text>
        <Text style={styles.subtitle}>
          A DBS check is required for all cleaners on the Rena platform.
        </Text>

        {/* DBS Option Selection */}
        {errors.dbsOption && <Text style={styles.errorText}>{errors.dbsOption}</Text>}

        {/* Option A: Existing DBS */}
        <TouchableOpacity
          style={[
            styles.optionCard,
            dbsCheck.dbsOption === 'existing' && styles.optionCardSelected,
          ]}
          onPress={() => selectOption('existing')}
        >
          <View style={styles.optionHeader}>
            <View
              style={[
                styles.radioOuter,
                dbsCheck.dbsOption === 'existing' && styles.radioOuterSelected,
              ]}
            >
              {dbsCheck.dbsOption === 'existing' && <View style={styles.radioInner} />}
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>I have an existing DBS certificate</Text>
              <Text style={styles.optionHint}>
                Enter your certificate details and upload a copy.
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Existing DBS Fields */}
        {dbsCheck.dbsOption === 'existing' && (
          <Card style={styles.fieldsCard}>
            <Input
              label="DBS Certificate Number"
              placeholder="123456789012"
              value={dbsCheck.dbsCertNumber}
              onChangeText={(text) => updateDbsCheck({ dbsCertNumber: text })}
              keyboardType="numeric"
              maxLength={12}
              error={errors.dbsCertNumber}
              icon={<Ionicons name="document-text-outline" size={20} color={Colors.textMuted} />}
            />

            <Input
              label="Issue Date (YYYY-MM-DD)"
              placeholder="2024-01-15"
              value={dbsCheck.dbsIssueDate}
              onChangeText={(text) => updateDbsCheck({ dbsIssueDate: text })}
              error={errors.dbsIssueDate}
              icon={<Ionicons name="calendar-outline" size={20} color={Colors.textMuted} />}
            />

            {/* Certificate Upload */}
            <Text style={styles.fieldLabel}>DBS Certificate</Text>
            {errors.dbsCertFileUri && (
              <Text style={styles.errorText}>{errors.dbsCertFileUri}</Text>
            )}
            <TouchableOpacity style={styles.uploadButton} onPress={pickCert}>
              {dbsCheck.dbsCertFileUri ? (
                <View style={styles.uploadedRow}>
                  <Image
                    source={{ uri: dbsCheck.dbsCertFileUri }}
                    style={styles.uploadedThumb}
                  />
                  <View style={styles.uploadedInfo}>
                    <Text style={styles.uploadedLabel}>Certificate uploaded</Text>
                    <Text style={styles.uploadedHint}>Tap to change</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                </View>
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="cloud-upload-outline" size={28} color={Colors.primary} />
                  <Text style={styles.uploadLabel}>Upload DBS Certificate</Text>
                </View>
              )}
            </TouchableOpacity>
          </Card>
        )}

        {/* Option B: Need new DBS */}
        <TouchableOpacity
          style={[
            styles.optionCard,
            dbsCheck.dbsOption === 'new' && styles.optionCardSelected,
          ]}
          onPress={() => selectOption('new')}
        >
          <View style={styles.optionHeader}>
            <View
              style={[
                styles.radioOuter,
                dbsCheck.dbsOption === 'new' && styles.radioOuterSelected,
              ]}
            >
              {dbsCheck.dbsOption === 'new' && <View style={styles.radioInner} />}
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionTitle}>I need a new DBS check</Text>
              <Text style={styles.optionHint}>
                We will guide you through the application process.
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {dbsCheck.dbsOption === 'new' && (
          <Card style={styles.fieldsCard}>
            <View style={styles.infoRow}>
              <Ionicons name="information-circle" size={20} color={Colors.info} />
              <Text style={styles.infoBodyText}>
                After you submit your application, Rena will send you a link to complete your DBS
                check through our verified partner. The process typically takes 2-5 working days.
                You can start receiving bookings once your check is complete.
              </Text>
            </View>
          </Card>
        )}

        {/* Liveness Check Section */}
        <View style={styles.livenessSection}>
          <Text style={styles.sectionTitle}>Liveness Check</Text>
          <Text style={styles.sectionSubtitle}>
            Take a selfie so we can verify your identity against your photo ID.
          </Text>
          {errors.selfieUri && <Text style={styles.errorText}>{errors.selfieUri}</Text>}

          {dbsCheck.selfieUri ? (
            <TouchableOpacity style={styles.selfieContainer} onPress={takeSelfie}>
              <Image source={{ uri: dbsCheck.selfieUri }} style={styles.selfieImage} />
              <View style={styles.selfieOverlay}>
                <Ionicons name="camera" size={20} color={Colors.white} />
                <Text style={styles.selfieOverlayText}>Retake</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.selfieButton} onPress={takeSelfie}>
              <Ionicons name="camera-outline" size={32} color={Colors.primary} />
              <Text style={styles.selfieButtonLabel}>Take a Selfie</Text>
              <Text style={styles.selfieButtonHint}>
                Use the front camera in good lighting
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info notice */}
        <Card style={styles.noticeCard}>
          <View style={styles.infoRow}>
            <Ionicons name="lock-closed" size={18} color={Colors.primary} />
            <Text style={styles.infoBodyText}>
              Your selfie and documents are processed securely and only used for identity
              verification. They are never shared with customers.
            </Text>
          </View>
        </Card>

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
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 20 },
  errorText: { fontSize: 12, color: Colors.error, marginBottom: 4 },
  optionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F0FDFA',
  },
  optionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioOuterSelected: { borderColor: Colors.primary },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  optionHint: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  fieldsCard: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  uploadButton: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.background,
    overflow: 'hidden',
    marginBottom: 8,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  uploadLabel: { fontSize: 14, fontWeight: '600', color: Colors.primary },
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
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoBodyText: { fontSize: 13, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  livenessSection: { marginTop: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  selfieButton: {
    alignItems: 'center',
    paddingVertical: 28,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: Colors.white,
    gap: 4,
  },
  selfieButtonLabel: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  selfieButtonHint: { fontSize: 12, color: Colors.textMuted },
  selfieContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: Colors.success,
  },
  selfieImage: { width: '100%', height: '100%' },
  selfieOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  selfieOverlayText: { fontSize: 12, color: Colors.white, fontWeight: '600' },
  noticeCard: { marginBottom: 20, backgroundColor: '#F0FDFA' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  backButton: { flex: 0.4 },
  nextButton: { flex: 0.6 },
});
