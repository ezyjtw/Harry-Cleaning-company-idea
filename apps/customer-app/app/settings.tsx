import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@rena/shared';

export default function SettingsScreen() {
  const [pushEnabled, setPushEnabled] = React.useState(true);
  const [emailEnabled, setEmailEnabled] = React.useState(true);
  const [marketingEnabled, setMarketingEnabled] = React.useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.section}>
        <SettingRow label="Push Notifications" value={pushEnabled} onToggle={setPushEnabled} />
        <SettingRow label="Email Notifications" value={emailEnabled} onToggle={setEmailEnabled} />
        <SettingRow
          label="Marketing Emails"
          value={marketingEnabled}
          onToggle={setMarketingEnabled}
        />
      </View>

      <Text style={styles.sectionTitle}>Legal</Text>
      <View style={styles.section}>
        <LinkRow icon="document-text-outline" label="Terms of Service" />
        <LinkRow icon="shield-outline" label="Privacy Policy" />
        <LinkRow icon="information-circle-outline" label="About Rena" />
      </View>

      <Text style={styles.sectionTitle}>Support</Text>
      <View style={styles.section}>
        <LinkRow icon="mail-outline" label="Contact Us" />
        <LinkRow icon="help-circle-outline" label="Help Centre" />
      </View>
    </ScrollView>
  );
}

function SettingRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch value={value} onValueChange={onToggle} trackColor={{ true: Colors.primary }} />
    </View>
  );
}

function LinkRow({ icon, label }: { icon: string; label: string }) {
  return (
    <TouchableOpacity style={styles.linkRow}>
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
});
