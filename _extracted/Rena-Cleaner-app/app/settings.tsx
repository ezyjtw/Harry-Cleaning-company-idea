import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Linking,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@rena/shared';
import { useLanguage, SUPPORTED_LANGUAGES } from '@/context/LanguageContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language, setLanguage, currentLanguage } = useLanguage();
  const [pushEnabled, setPushEnabled] = React.useState(true);
  const [emailEnabled, setEmailEnabled] = React.useState(true);
  const [availableNow, setAvailableNow] = React.useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{t('settings.availability')}</Text>
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>{t('settings.availableNow')}</Text>
            <Text style={styles.settingHint}>{t('settings.availableNowHint')}</Text>
          </View>
          <Switch
            value={availableNow}
            onValueChange={setAvailableNow}
            trackColor={{ true: Colors.success }}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => setShowLanguagePicker(true)}
        >
          <Ionicons name="language-outline" size={20} color={Colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.linkLabel}>{t('settings.selectLanguage')}</Text>
            <Text style={styles.settingHint}>
              {currentLanguage.nativeName} ({currentLanguage.name})
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>{t('settings.pushNotifications')}</Text>
          <Switch
            value={pushEnabled}
            onValueChange={setPushEnabled}
            trackColor={{ true: Colors.primaryDark }}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>{t('settings.emailNotifications')}</Text>
          <Switch
            value={emailEnabled}
            onValueChange={setEmailEnabled}
            trackColor={{ true: Colors.primaryDark }}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t('settings.documents')}</Text>
      <View style={styles.section}>
        <LinkRow icon="document-text-outline" label={t('settings.dbsCertificate')} onPress={() => {}} />
        <LinkRow icon="shield-outline" label={t('settings.rightToWork')} onPress={() => {}} />
        <LinkRow icon="card-outline" label={t('settings.identityVerification')} onPress={() => {}} />
      </View>

      <Text style={styles.sectionTitle}>{t('settings.legal')}</Text>
      <View style={styles.section}>
        <LinkRow
          icon="document-text-outline"
          label={t('settings.terms')}
          onPress={() => router.push('/terms')}
        />
        <LinkRow
          icon="shield-outline"
          label={t('settings.privacy')}
          onPress={() => router.push('/privacy-policy')}
        />
        <LinkRow
          icon="information-circle-outline"
          label={t('settings.about')}
          onPress={() => Linking.openURL('https://renacleaning.co.uk/about')}
        />
      </View>

      <Text style={styles.sectionTitle}>{t('settings.support')}</Text>
      <View style={styles.section}>
        <LinkRow
          icon="mail-outline"
          label={t('settings.contactSupport')}
          onPress={() => Linking.openURL('mailto:cleaners@renacleaning.co.uk')}
        />
        <LinkRow
          icon="help-circle-outline"
          label={t('settings.helpCentre')}
          onPress={() => Linking.openURL('https://renacleaning.co.uk/faq')}
        />
      </View>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.selectLanguage')}</Text>
              <TouchableOpacity onPress={() => setShowLanguagePicker(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={SUPPORTED_LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.languageRow,
                    item.code === language && styles.languageRowActive,
                  ]}
                  onPress={async () => {
                    await setLanguage(item.code);
                    setShowLanguagePicker(false);
                  }}
                >
                  <View>
                    <Text
                      style={[
                        styles.languageName,
                        item.code === language && styles.languageNameActive,
                      ]}
                    >
                      {item.nativeName}
                    </Text>
                    <Text style={styles.languageNameEn}>{item.name}</Text>
                  </View>
                  {item.code === language && (
                    <Ionicons name="checkmark" size={22} color={Colors.primaryDark} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function LinkRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.linkRow} onPress={onPress}>
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={20}
        color={Colors.textSecondary}
      />
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  section: { backgroundColor: Colors.white },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingLabel: { fontSize: 16, color: Colors.textPrimary },
  settingHint: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  linkLabel: { flex: 1, fontSize: 16, color: Colors.textPrimary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  languageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  languageRowActive: {
    backgroundColor: `${Colors.primaryDark}08`,
  },
  languageName: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  languageNameActive: {
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  languageNameEn: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
