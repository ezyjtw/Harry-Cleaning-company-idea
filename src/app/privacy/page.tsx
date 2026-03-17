import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Rena',
  description:
    'Read the Rena privacy policy to understand how we collect, use, and protect your personal data.',
};

export default function PrivacyPage() {
  return (
    <div className="bg-cream mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-cormorant text-4xl font-light tracking-tight text-ink">Privacy Policy</h1>
      <p className="mt-4 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
        Last updated: 1 January 2025
      </p>

      <div className="mt-10 max-w-none">
        <section className="mt-8 pb-8" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}>
          <h2 className="font-cormorant text-2xl font-light text-ink">1. Introduction</h2>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            Rena (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting
            your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you use our website, mobile application, and services
            (collectively, the &quot;Platform&quot;). Please read this policy carefully. By using
            the Platform, you consent to the practices described in this Privacy Policy.
          </p>
        </section>

        <section className="mt-8 pb-8" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}>
          <h2 className="font-cormorant text-2xl font-light text-ink">2. Information We Collect</h2>
          <h3 className="mt-6 font-cormorant text-lg font-light text-ink">
            2.1 Information You Provide
          </h3>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-light text-ink-2">
            <li>
              <strong className="font-normal text-ink">Account Information:</strong> Name, email
              address, phone number, and password when you create an account.
            </li>
            <li>
              <strong className="font-normal text-ink">Profile Information:</strong> Profile photo,
              bio, specialisations, and hourly rates (for cleaners).
            </li>
            <li>
              <strong className="font-normal text-ink">Address Information:</strong> Postal
              addresses for service delivery.
            </li>
            <li>
              <strong className="font-normal text-ink">Payment Information:</strong> Credit/debit
              card details processed securely through our payment provider (Stripe). We do not store
              full card numbers on our servers.
            </li>
            <li>
              <strong className="font-normal text-ink">Communications:</strong> Messages sent
              through the Platform, support requests, and feedback.
            </li>
            <li>
              <strong className="font-normal text-ink">Verification Documents:</strong> Identity
              documents, background check information, and insurance certificates (for cleaners).
            </li>
          </ul>

          <h3 className="mt-6 font-cormorant text-lg font-light text-ink">
            2.2 Information Collected Automatically
          </h3>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-light text-ink-2">
            <li>
              <strong className="font-normal text-ink">Device Information:</strong> Browser type,
              operating system, device identifiers, and screen resolution.
            </li>
            <li>
              <strong className="font-normal text-ink">Usage Data:</strong> Pages viewed, features
              used, search queries, booking patterns, and time spent on the Platform.
            </li>
            <li>
              <strong className="font-normal text-ink">Location Data:</strong> Approximate location
              based on IP address or postcode for matching you with local cleaners.
            </li>
            <li>
              <strong className="font-normal text-ink">Cookies and Similar Technologies:</strong> We
              use cookies and similar tracking technologies to enhance your experience. See Section
              7 for more details.
            </li>
          </ul>
        </section>

        <section className="mt-8 pb-8" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}>
          <h2 className="font-cormorant text-2xl font-light text-ink">
            3. How We Use Your Information
          </h2>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            We use the information we collect to:
          </p>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-light text-ink-2">
            <li>Provide, maintain, and improve the Platform</li>
            <li>Process bookings and facilitate payments</li>
            <li>Match customers with cleaners in their area</li>
            <li>Verify cleaner identities and conduct background checks</li>
            <li>Send booking confirmations, reminders, and updates</li>
            <li>Respond to support requests and resolve disputes</li>
            <li>
              Send marketing communications (with your consent, which you can withdraw at any time)
            </li>
            <li>Detect, prevent, and address fraud and security issues</li>
            <li>Comply with legal obligations</li>
            <li>Analyse usage patterns to improve our services</li>
          </ul>
        </section>

        <section className="mt-8 pb-8" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}>
          <h2 className="font-cormorant text-2xl font-light text-ink">
            4. How We Share Your Information
          </h2>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            We may share your information with:
          </p>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-light text-ink-2">
            <li>
              <strong className="font-normal text-ink">Cleaners/Customers:</strong> When you make a
              booking, we share relevant details (name, address, contact information) with the
              cleaner or customer as needed to fulfil the service.
            </li>
            <li>
              <strong className="font-normal text-ink">Payment Processors:</strong> We share payment
              details with Stripe to process transactions securely.
            </li>
            <li>
              <strong className="font-normal text-ink">Background Check Providers:</strong> Cleaner
              information is shared with our vetted background check partners.
            </li>
            <li>
              <strong className="font-normal text-ink">Service Providers:</strong> We may use
              third-party services for hosting, analytics, email delivery, and customer support.
            </li>
            <li>
              <strong className="font-normal text-ink">Legal Requirements:</strong> We may disclose
              information if required by law, regulation, or legal process.
            </li>
          </ul>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            We do not sell your personal information to third parties.
          </p>
        </section>

        <section className="mt-8 pb-8" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}>
          <h2 className="font-cormorant text-2xl font-light text-ink">5. Data Retention</h2>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            We retain your personal information for as long as your account is active or as needed
            to provide you with services. We may also retain certain information as required by law
            or for legitimate business purposes, such as resolving disputes and enforcing our
            agreements. When information is no longer needed, we securely delete or anonymise it.
          </p>
        </section>

        <section className="mt-8 pb-8" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}>
          <h2 className="font-cormorant text-2xl font-light text-ink">6. Your Rights</h2>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            Under UK data protection law (UK GDPR), you have the right to:
          </p>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-light text-ink-2">
            <li>
              <strong className="font-normal text-ink">Access:</strong> Request a copy of the
              personal data we hold about you.
            </li>
            <li>
              <strong className="font-normal text-ink">Rectification:</strong> Request correction of
              inaccurate or incomplete personal data.
            </li>
            <li>
              <strong className="font-normal text-ink">Erasure:</strong> Request deletion of your
              personal data (&quot;right to be forgotten&quot;).
            </li>
            <li>
              <strong className="font-normal text-ink">Restriction:</strong> Request restriction of
              processing of your personal data.
            </li>
            <li>
              <strong className="font-normal text-ink">Portability:</strong> Request transfer of
              your data in a structured, commonly used format.
            </li>
            <li>
              <strong className="font-normal text-ink">Objection:</strong> Object to processing of
              your personal data for certain purposes.
            </li>
            <li>
              <strong className="font-normal text-ink">Withdraw Consent:</strong> Where processing
              is based on consent, withdraw your consent at any time.
            </li>
          </ul>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            To exercise any of these rights, please contact us at{' '}
            <a href="mailto:privacy@rena.com" className="text-gold hover:text-gold/80 underline">
              privacy@rena.com
            </a>
            . We will respond within 30 days.
          </p>
        </section>

        <section className="mt-8 pb-8" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}>
          <h2 className="font-cormorant text-2xl font-light text-ink">7. Cookies</h2>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            We use cookies and similar technologies to:
          </p>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-light text-ink-2">
            <li>Keep you signed in to your account</li>
            <li>Remember your preferences and settings</li>
            <li>Understand how you use the Platform</li>
            <li>Improve our services based on usage patterns</li>
          </ul>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            You can control cookie settings through your browser. Disabling certain cookies may
            affect the functionality of the Platform.
          </p>
        </section>

        <section className="mt-8 pb-8" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}>
          <h2 className="font-cormorant text-2xl font-light text-ink">8. Data Security</h2>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            We implement appropriate technical and organisational measures to protect your personal
            information, including encryption of data in transit (TLS/SSL), secure storage of
            credentials, regular security assessments, and access controls. However, no method of
            transmission over the internet is 100% secure, and we cannot guarantee absolute
            security.
          </p>
        </section>

        <section className="mt-8 pb-8" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}>
          <h2 className="font-cormorant text-2xl font-light text-ink">
            9. International Transfers
          </h2>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            Your data is primarily stored and processed in the United Kingdom. Where we use
            third-party services that process data outside the UK, we ensure appropriate safeguards
            are in place, such as Standard Contractual Clauses or adequacy decisions.
          </p>
        </section>

        <section className="mt-8 pb-8" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}>
          <h2 className="font-cormorant text-2xl font-light text-ink">
            10. Children&apos;s Privacy
          </h2>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            The Platform is not intended for children under 18. We do not knowingly collect personal
            information from children under 18. If you believe we have inadvertently collected
            information from a child, please contact us immediately.
          </p>
        </section>

        <section className="mt-8 pb-8" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}>
          <h2 className="font-cormorant text-2xl font-light text-ink">
            11. Changes to This Policy
          </h2>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by posting the updated policy on the Platform and updating the &quot;Last
            updated&quot; date. Your continued use of the Platform after changes constitutes
            acceptance of the updated policy.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-cormorant text-2xl font-light text-ink">12. Contact Us</h2>
          <p className="mt-4 font-jost font-light text-ink-2 leading-relaxed">
            If you have questions about this Privacy Policy or our data practices, please contact
            us:
          </p>
          <div
            className="mt-4 bg-cream-2 p-6 font-jost font-light text-ink-2"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <p>
              <strong className="font-normal text-ink">Rena Cleaning Network</strong>
            </p>
            <p className="mt-2">
              Email:{' '}
              <a href="mailto:privacy@rena.com" className="text-gold hover:text-gold/80 underline">
                privacy@rena.com
              </a>
            </p>
            <p className="mt-1">Address: London, United Kingdom</p>
          </div>
        </section>
      </div>
    </div>
  );
}
