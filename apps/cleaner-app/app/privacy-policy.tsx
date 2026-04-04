import React from 'react';
import { ScrollView, Text, StyleSheet, View, Linking, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@rena/shared';

const PRIVACY_URL = 'https://renacleaning.co.uk/privacy';

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.lastUpdated}>Last updated: March 2026</Text>

      <Section title="1. Who We Are">
        Rena Cleaning Network ("Rena", "we", "our") is a cleaning marketplace platform operated in
        the United Kingdom. We connect customers with independent cleaning professionals. This
        privacy policy explains how we collect, use, and protect your personal data in compliance
        with the UK GDPR and Data Protection Act 2018.
      </Section>

      <Section title="2. Data We Collect">
        {`\u2022 Account information: name, email, phone number, password (hashed)
\u2022 Address data: saved addresses for booking purposes
\u2022 Booking data: service type, dates, times, pricing, notes
\u2022 Payment data: processed securely via Ryft (we do not store card details)
\u2022 Messages: conversations between customers and cleaners
\u2022 Device data: device type, OS version, app version for analytics
\u2022 Location data: postcode for cleaner matching (only when you search)`}
      </Section>

      <Section title="3. How We Use Your Data">
        {`\u2022 To provide and improve our cleaning marketplace service
\u2022 To match you with suitable cleaners in your area
\u2022 To process payments securely via escrow
\u2022 To send booking confirmations and reminders
\u2022 To resolve disputes and handle complaints
\u2022 To comply with legal obligations`}
      </Section>

      <Section title="4. Data Sharing">
        We share your data only with:{'\n'}
        {`\u2022 Your assigned cleaner (name, address, booking details)
\u2022 Ryft (payment processor) for secure payment handling
\u2022 Resend (email provider) for notifications
\u2022 Railway (hosting) for infrastructure`}
        {'\n\n'}We never sell your personal data to third parties.
      </Section>

      <Section title="5. Data Retention">
        We retain your data for as long as your account is active. Booking records are kept for 6
        years for tax and legal compliance. You can request data deletion at any time through the
        app or by contacting us.
      </Section>

      <Section title="6. Your Rights">
        Under UK GDPR, you have the right to:{'\n'}
        {`\u2022 Access your personal data
\u2022 Rectify inaccurate data
\u2022 Request deletion of your data
\u2022 Object to or restrict processing
\u2022 Data portability (export your data)
\u2022 Withdraw consent at any time`}
      </Section>

      <Section title="7. Security">
        We use industry-standard security measures including encrypted storage, secure API
        communications (HTTPS), hashed passwords, and DBS certificate destruction after verification
        (metadata only retained).
      </Section>

      <Section title="8. Cookies & Analytics">
        The mobile app uses minimal analytics to improve the service. You can control analytics
        consent in your account settings. We do not use third-party advertising trackers.
      </Section>

      <Section title="9. Contact Us">
        {`Data Protection queries: privacy@renacleaning.co.uk
General enquiries: hello@renacleaning.co.uk`}
      </Section>

      <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL(PRIVACY_URL)}>
        <Ionicons name="open-outline" size={18} color={Colors.primary} />
        <Text style={styles.linkText}>View full policy on our website</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { padding: 24, paddingBottom: 60 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  lastUpdated: { fontSize: 13, color: Colors.textMuted, marginTop: 4, marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  sectionBody: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    marginTop: 12,
  },
  linkText: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
});
