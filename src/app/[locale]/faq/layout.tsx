import JsonLd from '@/components/JsonLd';
import { PAGE_METADATA } from '@/lib/seo/metadata';
import { generateFAQSchema } from '@/lib/seo/structured-data';

export const metadata = PAGE_METADATA.faq;

const faqs = [
  {
    question: 'What is Rena?',
    answer:
      'Rena is a cleaning marketplace that connects you with trusted, vetted independent cleaners in your area.',
  },
  {
    question: 'How much does a cleaning cost?',
    answer:
      'Cleaners set their own hourly rates, typically £14–£25/hr. A 6% service fee is added at checkout with no hidden charges.',
  },
  {
    question: 'How are cleaners vetted?',
    answer:
      'Every cleaner goes through identity verification, right-to-work checks, and reference checks before earning the Verified badge.',
  },
  {
    question: 'Can I book a same-day clean?',
    answer:
      'Yes, same-day bookings are available if requested before 12pm, subject to cleaner availability.',
  },
  {
    question: 'Are cleaners insured?',
    answer: 'All cleaners on Rena are required to have public liability insurance.',
  },
  {
    question: 'How do payments work?',
    answer:
      'Payments are processed securely. For first-time bookings, funds are held securely and released after job completion.',
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={generateFAQSchema(faqs)} />
      {children}
    </>
  );
}
