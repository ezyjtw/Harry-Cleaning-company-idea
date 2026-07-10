import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk';

export const metadata: Metadata = {
  alternates: { canonical: `${BASE_URL}/privacy` },
  title: 'Privacy Policy',
  description:
    'Read the Rena privacy policy to understand how we collect, use, and protect your personal data.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl bg-page px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-newsreader text-4xl font-semibold tracking-tight text-ink">Privacy Policy</h1>
      <p className="mt-4 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
        Last updated: 1 March 2026
      </p>

      <div className="mt-10 max-w-none">
        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">1. Introduction</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            Rena Cleaning Network (&quot;Rena&quot;, &quot;we&quot;, &quot;our&quot;, or
            &quot;us&quot;) is committed to protecting
            your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you use our website, mobile application, and services
            (collectively, the &quot;Platform&quot;). Please read this policy carefully. By using
            the Platform, you consent to the practices described in this Privacy Policy.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">2. Information We Collect</h2>
          <h3 className="mt-6 font-newsreader text-lg font-semibold text-ink">
            2.1 Information You Provide
          </h3>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
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
            <li>
              <strong className="font-normal text-ink">Right to Work Documents:</strong> Passport,
              Biometric Residence Permit, Home Office share code, visa, or EU settlement status
              documentation to verify legal eligibility to work in the UK (for cleaners).
            </li>
            <li>
              <strong className="font-normal text-ink">DBS Certificates:</strong> Disclosure and
              Barring Service certificates voluntarily provided by cleaners to enhance trust.
            </li>
          </ul>

          <h3 className="mt-6 font-newsreader text-lg font-semibold text-ink">
            2.2 Information Collected Automatically
          </h3>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
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

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            3. How We Use Your Information
          </h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            We use the information we collect to:
          </p>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
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

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            4. How We Share Your Information
          </h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            We may share your information with:
          </p>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
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
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            We do not sell your personal information to third parties.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">5. Data Retention</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            We retain your personal information for as long as your account is active or as needed
            to provide you with services. Specific retention periods are as follows:
          </p>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
            <li>
              <strong className="font-normal text-ink">Account data:</strong> Retained while your
              account is active and for 6 years after account closure (to comply with HMRC
              requirements and for legal claims).
            </li>
            <li>
              <strong className="font-normal text-ink">Booking and payment records:</strong>{' '}
              Retained for 6 years after the booking date for tax and legal compliance.
            </li>
            <li>
              <strong className="font-normal text-ink">Right to work documents:</strong> Retained
              for the duration of the cleaner&apos;s engagement plus 2 years after, in line with
              Home Office guidance.
            </li>
            <li>
              <strong className="font-normal text-ink">DBS certificates:</strong> Used only for
              verification purposes. The certificate itself is securely destroyed within 6 months of
              verification. We retain only the date of issue, certificate number, and verification
              outcome, not the certificate content.
            </li>
            <li>
              <strong className="font-normal text-ink">Identity documents (Photo ID):</strong>{' '}
              Retained for the duration of the cleaner&apos;s active account. Securely deleted
              within 30 days of account closure or upon a valid deletion request.
            </li>
            <li>
              <strong className="font-normal text-ink">Messages and communications:</strong>{' '}
              Retained for 2 years after the last message, then anonymised.
            </li>
            <li>
              <strong className="font-normal text-ink">Analytics data:</strong> IP addresses and
              user identifiers are anonymised after 2 years. Aggregated, non-identifiable analytics
              data may be retained indefinitely.
            </li>
            <li>
              <strong className="font-normal text-ink">Audit logs:</strong> Retained for 7 years for
              regulatory compliance and fraud prevention.
            </li>
          </ul>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            When information is no longer needed, we securely delete or anonymise it. You may
            request early deletion of your data at any time (see Section 6), though some data may
            need to be retained where we have a legal obligation to do so.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">6. Your Rights</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            Under UK data protection law (UK GDPR), you have the right to:
          </p>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
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
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            To exercise any of these rights, please contact us at{' '}
            <a
              href="mailto:legal@renacleaning.co.uk"
              className="text-primary underline hover:text-primary-hover"
            >
              legal@renacleaning.co.uk
            </a>
            . We will respond within 30 days.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">7. Cookies</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            We use cookies and similar technologies on the Platform. When you first visit, you will
            be shown a cookie consent banner where you can choose which types of cookies to accept.
          </p>

          <h3 className="mt-6 font-newsreader text-lg font-semibold text-ink">7.1 Essential Cookies</h3>
          <p className="mt-2 font-jost font-normal text-ink-2 leading-relaxed">
            These are necessary for the Platform to function and cannot be disabled. They include
            session cookies to keep you signed in and security cookies to prevent fraud.
          </p>

          <h3 className="mt-6 font-newsreader text-lg font-semibold text-ink">7.2 Analytics Cookies</h3>
          <p className="mt-2 font-jost font-normal text-ink-2 leading-relaxed">
            With your consent, we use analytics cookies to understand how you use the Platform,
            which pages you visit, and where you experience difficulties. This data helps us improve
            the booking experience. Analytics data is anonymised after 2 years.
          </p>

          <h3 className="mt-6 font-newsreader text-lg font-semibold text-ink">7.3 Marketing Cookies</h3>
          <p className="mt-2 font-jost font-normal text-ink-2 leading-relaxed">
            With your consent, we may use marketing cookies to show you relevant content and measure
            the effectiveness of our communications. You can withdraw consent at any time.
          </p>

          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            You can change your cookie preferences at any time by clicking &quot;Cookie
            Settings&quot; in the footer of any page, or through your browser settings. Disabling
            essential cookies may affect the functionality of the Platform.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">8. Data Security</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            We implement appropriate technical and organisational measures to protect your personal
            information, including encryption of data in transit (TLS/SSL), secure storage of
            credentials, regular security assessments, and access controls. However, no method of
            transmission over the internet is 100% secure, and we cannot guarantee absolute
            security.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            9. International Transfers
          </h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            Your data is primarily stored and processed in the United Kingdom. Where we use
            third-party services that process data outside the UK, we ensure appropriate safeguards
            are in place, such as Standard Contractual Clauses or adequacy decisions.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            10. Children&apos;s Privacy
          </h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            The Platform is not intended for children under 18. We do not knowingly collect personal
            information from children under 18. If you believe we have inadvertently collected
            information from a child, please contact us immediately.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            11. Changes to This Policy
          </h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by posting the updated policy on the Platform and updating the &quot;Last
            updated&quot; date. Your continued use of the Platform after changes constitutes
            acceptance of the updated policy.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            12. Legal Basis for Processing
          </h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            We process your personal data under the following legal bases:
          </p>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
            <li>
              <strong className="font-normal text-ink">Contract:</strong> Processing necessary to
              perform our contract with you (e.g. processing bookings, payments, managing your
              account).
            </li>
            <li>
              <strong className="font-normal text-ink">Legal obligation:</strong> Processing
              required to comply with the law (e.g. right to work checks, tax records, fraud
              prevention).
            </li>
            <li>
              <strong className="font-normal text-ink">Legitimate interests:</strong> Processing
              necessary for our legitimate interests where these are not overridden by your rights
              (e.g. platform security, service improvement, dispute resolution).
            </li>
            <li>
              <strong className="font-normal text-ink">Consent:</strong> Where you have given
              explicit consent (e.g. marketing emails, analytics cookies). You may withdraw consent
              at any time.
            </li>
          </ul>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            13. Data Protection Impact Assessments
          </h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            We conduct Data Protection Impact Assessments (DPIAs) for processing activities that are
            likely to result in a high risk to individuals&apos; rights and freedoms. This includes
            our handling of location data, home access information, identity documents, and right to
            work verification. DPIAs are reviewed annually and whenever we introduce significant
            changes to our data processing activities.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">14. Contact Us</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            If you have questions about this Privacy Policy or our data practices, please contact
            us:
          </p>
          <div className="mt-4 rounded-xl border border-line bg-primary-soft p-6 font-jost font-normal text-ink-2">
            <p>
              <strong className="font-normal text-ink">Rena Cleaning Network</strong>
            </p>
            <p className="mt-2">
              Email:{' '}
              <a
                href="mailto:legal@renacleaning.co.uk"
                className="text-primary underline hover:text-primary-hover"
              >
                legal@renacleaning.co.uk
              </a>
            </p>
            <p className="mt-1">Registered office: 66 Paul Street, London EC2A 4NA, United Kingdom</p>
          </div>
        </section>
      </div>
    </div>
  );
}
