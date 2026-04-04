import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@rena/shared';

export default function SettingsScreen() {
  const [pushEnabled, setPushEnabled] = React.useState(true);
  const [emailEnabled, setEmailEnabled] = React.useState(true);
  const [availableNow, setAvailableNow] = React.useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Availability</Text>
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>Available Now</Text>
            <Text style={styles.settingHint}>Show as available for same-day bookings</Text>
          </View>
          <Switch
            value={availableNow}
            onValueChange={setAvailableNow}
            trackColor={{ true: Colors.success }}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Push Notifications</Text>
          <Switch
            value={pushEnabled}
            onValueChange={setPushEnabled}
            trackColor={{ true: Colors.primaryDark }}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Email Notifications</Text>
          <Switch
            value={emailEnabled}
            onValueChange={setEmailEnabled}
            trackColor={{ true: Colors.primaryDark }}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Documents</Text>
      <View style={styles.section}>
        <LinkRow icon="document-text-outline" label="DBS Certificate" />
        <LinkRow icon="shield-outline" label="Right to Work" />
        <LinkRow icon="card-outline" label="Identity Verification" />
      </View>

      <Text style={styles.sectionTitle}>Legal</Text>
      <View style={styles.section}>
        <LinkRow icon="document-text-outline" label="Terms & Conditions" />
        <LinkRow icon="shield-outline" label="Privacy Policy" />
        <LinkRow icon="information-circle-outline" label="About Rena" />
      </View>

      <Text style={styles.sectionTitle}>Support</Text>
      <View style={styles.section}>
        <LinkRow icon="mail-outline" label="Contact Support" />
        <LinkRow icon="help-circle-outline" label="Help Centre" />
      </View>
    </ScrollView>
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
});
