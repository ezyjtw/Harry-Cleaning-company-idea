import React from 'react';
import { ScrollView, Text, StyleSheet, View, Linking, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@rena/shared';

const TERMS_URL = 'https://renacleaning.co.uk/terms';

export default function TermsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Terms & Conditions</Text>
      <Text style={styles.lastUpdated}>Last updated: March 2026</Text>

      <Section title="1. About Rena">
        Rena Cleaning Network is a marketplace platform that connects customers with independent
        cleaning professionals. We do not employ cleaners directly — they are self-employed
        individuals or companies who use our platform.
      </Section>

      <Section title="2. Using Our Service">
        {`\u2022 You must be at least 18 years old to use Rena
\u2022 You must provide accurate information when creating an account
\u2022 You are responsible for maintaining the security of your account
\u2022 You agree to treat cleaners with respect and professionalism`}
      </Section>

      <Section title="3. Bookings & Payments">
        {`\u2022 Prices are set by individual cleaners (hourly) or by property size (fixed)
\u2022 A 6% service fee is added to hourly bookings for the customer
\u2022 Cleaners pay a 10% platform fee — they keep 90% of earnings
\u2022 First bookings with a new cleaner are protected by escrow
\u2022 Escrow funds are released 24 hours after completion or on customer confirmation
\u2022 Cancellations within 24 hours of the booking may incur a fee`}
      </Section>

      <Section title="4. Satisfaction Guarantee">
        If you are unsatisfied with a clean, contact us within 24 hours. We will arrange a re-clean
        or full refund at our discretion. The escrow system protects your payment until the service
        is confirmed.
      </Section>

      <Section title="5. Cleaner Verification">
        All cleaners on Rena undergo identity verification, DBS background checks, and right-to-work
        verification. However, Rena provides the platform only and does not guarantee the quality of
        any individual clean.
      </Section>

      <Section title="6. Disputes">
        If a dispute arises between a customer and cleaner, both parties can raise a dispute through
        the platform. Rena will review evidence from both sides and make a fair resolution, which
        may include escrow release, refund, or split.
      </Section>

      <Section title="7. Liability">
        Rena acts as a marketplace platform. While we verify cleaners and provide payment
        protection, the cleaning service contract is between you and the cleaner. Our liability is
        limited to the platform fees collected.
      </Section>

      <Section title="8. Account Termination">
        We reserve the right to suspend or terminate accounts that violate these terms, engage in
        fraudulent activity, or receive repeated complaints.
      </Section>

      <Section title="9. Changes to Terms">
        We may update these terms from time to time. We will notify you of significant changes via
        email or in-app notification. Continued use of the app constitutes acceptance of updated
        terms.
      </Section>

      <Section title="10. Contact">
        {`Email: hello@renacleaning.co.uk
Address: Rena Cleaning Network, London, United Kingdom`}
      </Section>

      <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL(TERMS_URL)}>
        <Ionicons name="open-outline" size={18} color={Colors.primary} />
        <Text style={styles.linkText}>View full terms on our website</Text>
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
