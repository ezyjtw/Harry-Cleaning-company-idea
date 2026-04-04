import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@rena/shared';

const FAQ_ITEMS = [
  {
    q: 'How does Rena work?',
    a: 'Rena connects you with trusted, verified cleaners in your area. Search by postcode, pick a cleaner, and book online. Your cleaner arrives at the agreed time, and payment is handled securely through the platform.',
  },
  {
    q: 'Are cleaners background-checked?',
    a: 'Yes. All cleaners on Rena undergo identity verification, DBS background checks, and right-to-work verification before they can accept bookings.',
  },
  {
    q: 'How much does it cost?',
    a: 'Cleaners set their own hourly rates (typically \u00A314\u2013\u00A335/hr). A small 6% service fee is added to your total. For fixed-price services (End of Tenancy, Airbnb), pricing is based on property size.',
  },
  {
    q: 'What is the escrow system?',
    a: 'For your first booking with a cleaner, your payment is held in escrow. It\u2019s released to the cleaner 24 hours after the clean, or earlier if you confirm satisfaction. This protects both parties.',
  },
  {
    q: 'Can I cancel a booking?',
    a: 'Yes. You can cancel for free up to 24 hours before the booking. Cancellations within 24 hours may incur a fee.',
  },
  {
    q: 'What if I\u2019m not happy with the clean?',
    a: 'We offer a satisfaction guarantee. If you\u2019re unhappy, contact us within 24 hours and we\u2019ll arrange a redo or refund.',
  },
  {
    q: 'How do I pay?',
    a: 'All payments are processed securely through Ryft. We accept all major debit and credit cards, as well as Apple Pay and Google Pay.',
  },
  {
    q: 'What areas do you cover?',
    a: 'We currently operate in North East London and Essex, with plans to expand across London and the UK.',
  },
];

export default function FAQScreen() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Frequently Asked Questions</Text>
      {FAQ_ITEMS.map((item, i) => (
        <TouchableOpacity
          key={i}
          style={styles.faqItem}
          onPress={() => setExpanded(expanded === i ? null : i)}
          activeOpacity={0.7}
        >
          <View style={styles.questionRow}>
            <Text style={styles.question}>{item.q}</Text>
            <Ionicons
              name={expanded === i ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.textMuted}
            />
          </View>
          {expanded === i && <Text style={styles.answer}>{item.a}</Text>}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  header: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },
  faqItem: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  questionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  answer: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginTop: 12 },
});
