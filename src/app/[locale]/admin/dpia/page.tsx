import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DPIA | Rena Admin',
  description: 'Data Protection Impact Assessment for Rena Cleaning Network.',
};

const dpiaItems = [
  {
    title: '1. Customer Personal Data',
    description: 'Name, email, phone, address for booking and communication.',
    lawfulBasis: 'Contract performance',
    risk: 'Medium',
    mitigations: [
      'Data encrypted in transit and at rest',
      'Access restricted to authenticated users and relevant cleaners',
      'Addresses only shared with assigned cleaner for the booking',
      'Automated anonymisation on account deletion',
    ],
  },
  {
    title: '2. Customer Location & Home Access',
    description:
      'Home addresses, postcodes, and property details shared with cleaners for service delivery.',
    lawfulBasis: 'Contract performance',
    risk: 'High',
    mitigations: [
      'Cleaner identity verified before receiving address',
      'Addresses not visible until booking confirmed',
      'Access logs track who viewed each address',
      'Address data redacted on account deletion',
    ],
  },
  {
    title: '3. Cleaner Identity Documents',
    description: 'Photo ID (passport, driving licence) used for identity verification.',
    lawfulBasis: 'Legal obligation / Legitimate interest',
    risk: 'High',
    mitigations: [
      'Documents stored in encrypted storage with restricted access',
      'Deleted within 30 days of account closure',
      'Admin access logged in audit trail',
      'Documents never shared with customers',
    ],
  },
  {
    title: '4. Right to Work Documents',
    description:
      'Passport, BRP, share codes, visa documents used to verify legal right to work in the UK.',
    lawfulBasis: 'Legal obligation (Immigration, Asylum and Nationality Act 2006)',
    risk: 'High',
    mitigations: [
      'Documents stored in encrypted storage',
      'Retained for engagement duration plus 2 years per Home Office guidance',
      'Access restricted to authorised admin staff only',
      'Verification status recorded; documents destroyed when retention period expires',
    ],
  },
  {
    title: '5. DBS Certificates',
    description:
      'Disclosure and Barring Service certificates voluntarily provided for trust purposes.',
    lawfulBasis: 'Consent / Legitimate interest',
    risk: 'High',
    mitigations: [
      'Certificate file destroyed within 6 months of verification',
      'Only certificate number, issue date, and outcome retained',
      'Destruction logged in DataRetentionLog',
      'Automated scheduled job handles destruction',
    ],
  },
  {
    title: '6. Payment Data',
    description: 'Payment card details processed via Ryft (PCI-DSS compliant processor).',
    lawfulBasis: 'Contract performance',
    risk: 'Medium',
    mitigations: [
      'Card details never stored on Rena servers',
      'All payment processing handled by PCI-DSS Level 1 compliant provider',
      'Only payment references and amounts stored locally',
    ],
  },
  {
    title: '7. Analytics & Behavioural Data',
    description:
      'Session tracking, funnel analytics, page views, form interactions, and drop-off events.',
    lawfulBasis: 'Consent (analytics cookies) / Legitimate interest (essential)',
    risk: 'Low',
    mitigations: [
      'Cookie consent banner requires opt-in for analytics',
      'IP addresses and user IDs anonymised after 2 years',
      'Session IDs are ephemeral (sessionStorage only)',
      'No cross-site tracking or third-party advertising trackers',
    ],
  },
  {
    title: '8. Communications Data',
    description: 'In-app messages between customers and cleaners.',
    lawfulBasis: 'Contract performance / Legitimate interest',
    risk: 'Medium',
    mitigations: [
      'Messages encrypted in transit',
      'Retained for 2 years then anonymised',
      'Only accessible to conversation participants and admin for disputes',
      'Included in data export and deletion requests',
    ],
  },
];

export default function DpiaPage() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/5 bg-white/50 px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <Link href="/admin" className="font-jost text-sm text-ink-3 hover:text-ink">
            &larr; Admin Dashboard
          </Link>
          <h1 className="mt-1 font-cormorant text-2xl font-light text-ink">
            Data Protection Impact Assessment
          </h1>
          <p className="mt-1 font-jost text-sm font-light text-ink-3">
            Required under UK GDPR Article 35 for high-risk processing activities. Review annually
            or when processing changes.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Overview */}
        <div className="mb-8 bg-white p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-xl font-light text-ink">Assessment Overview</h2>
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 font-jost text-sm">
            <div>
              <dt className="font-normal text-ink">Data Controller</dt>
              <dd className="font-light text-ink-2">Rena Cleaning Network</dd>
            </div>
            <div>
              <dt className="font-normal text-ink">Assessment Date</dt>
              <dd className="font-light text-ink-2">To be completed before launch</dd>
            </div>
            <div>
              <dt className="font-normal text-ink">Reviewed By</dt>
              <dd className="font-light text-ink-2">Data Protection Officer (to be appointed)</dd>
            </div>
            <div>
              <dt className="font-normal text-ink">Next Review</dt>
              <dd className="font-light text-ink-2">
                12 months from launch or on significant change
              </dd>
            </div>
          </dl>
        </div>

        {/* Processing Activities */}
        <h2 className="mb-4 font-cormorant text-xl font-light text-ink">Processing Activities</h2>
        <div className="space-y-4">
          {dpiaItems.map((item) => (
            <div
              key={item.title}
              className="bg-white p-5"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-jost text-sm font-normal text-ink">{item.title}</h3>
                <span
                  className={`shrink-0 px-2 py-0.5 font-jost text-xs ${
                    item.risk === 'High'
                      ? 'bg-red-100 text-red-700'
                      : item.risk === 'Medium'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                  }`}
                >
                  {item.risk} Risk
                </span>
              </div>
              <p className="mt-1 font-jost text-sm font-light text-ink-2">{item.description}</p>
              <p className="mt-2 font-jost text-xs text-ink-3">
                <strong className="font-normal">Lawful basis:</strong> {item.lawfulBasis}
              </p>
              <div className="mt-3">
                <p className="font-jost text-xs font-normal uppercase tracking-wider text-ink-3">
                  Mitigations
                </p>
                <ul className="mt-1 space-y-1">
                  {item.mitigations.map((m) => (
                    <li key={m} className="font-jost text-xs font-light text-ink-2">
                      &bull; {m}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Action Items */}
        <div className="mt-8 bg-cream-2 p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <h2 className="font-cormorant text-xl font-light text-ink">Pre-Launch Action Items</h2>
          <ul className="mt-4 space-y-2 font-jost text-sm font-light text-ink-2">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-ink-3">&#9744;</span>
              Appoint a Data Protection Officer or responsible person
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-ink-3">&#9744;</span>
              Register with the ICO (Information Commissioner&apos;s Office)
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-ink-3">&#9744;</span>
              Implement end-to-end encryption for document storage
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-ink-3">&#9744;</span>
              Set up automated DBS certificate destruction job (6-month cycle)
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-ink-3">&#9744;</span>
              Set up automated right to work expiry monitoring and alerts
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-ink-3">&#9744;</span>
              Complete penetration testing before launch
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-ink-3">&#9744;</span>
              Establish data breach response plan (72-hour ICO notification)
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-ink-3">&#9744;</span>
              Set up data processing agreements with all third-party services (Ryft, Resend,
              Railway)
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-ink-3">&#9744;</span>
              Train staff on data protection procedures
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
