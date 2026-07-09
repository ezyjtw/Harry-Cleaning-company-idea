import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Read the Rena terms of service governing your use of the Rena cleaning marketplace platform.',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl bg-page px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-newsreader text-4xl font-semibold tracking-tight text-ink">
        Terms of Service
      </h1>
      <p className="mt-4 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
        Last updated: 1 January 2025
      </p>

      <div className="mt-10 max-w-none">
        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">1. Agreement to Terms</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            By accessing or using the Rena platform (&quot;Platform&quot;), operated by Rena
            Cleaning Network (&quot;Rena&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;),
            you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree
            to these Terms, you must not use the Platform. These Terms apply to all users, including
            customers and cleaning service providers (&quot;Cleaners&quot;).
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">2. Description of Service</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            Rena is an online marketplace that connects customers with independent cleaning
            professionals. Rena is not a cleaning company and does not provide cleaning services
            directly. Cleaners on the Platform are independent service providers, not employees of
            Rena. Rena facilitates the connection between customers and cleaners, processes
            payments, and provides tools for booking management.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">3. Account Registration</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            To use certain features of the Platform, you must create an account. You agree to:
          </p>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
            <li>Provide accurate, current, and complete information</li>
            <li>Maintain and update your information to keep it accurate</li>
            <li>Keep your password secure and confidential</li>
            <li>Accept responsibility for all activity under your account</li>
            <li>Notify us immediately of any unauthorised use of your account</li>
          </ul>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            You must be at least 18 years old to create an account. We reserve the right to suspend
            or terminate accounts that violate these Terms.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">4. Bookings and Services</h2>
          <h3 className="mt-6 font-newsreader text-lg font-semibold text-ink">4.1 For Customers</h3>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
            <li>
              Bookings are requests for cleaning services and are subject to cleaner acceptance and
              availability.
            </li>
            <li>
              You agree to provide accurate information about your property, including size,
              condition, and any access requirements.
            </li>
            <li>You must ensure the cleaner has safe access to the property at the agreed time.</li>
            <li>
              You agree to treat cleaners with respect and provide a safe working environment.
            </li>
          </ul>

          <h3 className="mt-6 font-newsreader text-lg font-semibold text-ink">4.2 For Cleaners</h3>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
            <li>
              You represent that you are an independent contractor and not an employee of Rena.
            </li>
            <li>
              You agree to maintain valid public liability insurance at all times while offering
              services through the Platform.
            </li>
            <li>You agree to arrive on time and perform services to a professional standard.</li>
            <li>
              You are responsible for your own tax obligations, including self-assessment and
              National Insurance contributions.
            </li>
            <li>
              You agree to complete our verification process, including identity checks and
              background screening.
            </li>
          </ul>

          <h3 className="mt-6 font-newsreader text-lg font-semibold text-ink">
            4.3 Right to Substitution
          </h3>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            You may arrange for another individual to perform the Services on your behalf without
            our prior approval, provided that:
          </p>
          <ol className="mt-4 list-[lower-alpha] pl-6 space-y-2 font-jost font-normal text-ink-2">
            <li>The substitute has the legal right to work in the United Kingdom;</li>
            <li>
              The substitute&apos;s identity has been verified prior to attending the
              Customer&apos;s premises; and
            </li>
            <li>The substitute holds valid public liability insurance.</li>
          </ol>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            You remain responsible for ensuring these conditions are met and for the
            substitute&apos;s conduct during performance of the Services.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">5. Pricing and Payment</h2>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
            <li>
              Cleaners set their own rates which are listed on the platform. A 6% service fee is
              added at checkout to cover customer support, payment protection, and platform
              maintenance.
            </li>
            <li>
              All prices are displayed in British Pounds (GBP). The service fee is shown separately
              at checkout before you confirm.
            </li>
            <li>Payments are processed securely through our payment provider (Stripe).</li>
            <li>
              For first bookings with a new cleaner, payments may be held securely until the service
              is completed.
            </li>
            <li>Rena reserves the right to modify the service fee with 30 days prior notice.</li>
          </ul>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            Cleaners are free to set their own rates for all services including End of Tenancy and
            Airbnb cleaning. Rena publishes suggested rate guidance only. Cleaners are under no
            obligation to follow suggested rates and may charge above or below the suggested range
            at their sole discretion. Rena does not mandate, fix or control the prices charged by
            cleaners for any service.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            6. Cancellation and Refunds
          </h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            Cancellations are subject to the following policy:
          </p>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
            <li>
              <strong className="font-normal text-ink">48+ hours notice:</strong> Full refund to the
              customer.
            </li>
            <li>
              <strong className="font-normal text-ink">24-48 hours notice:</strong> 50% refund to
              the customer. The remaining 50% is paid to the cleaner as compensation.
            </li>
            <li>
              <strong className="font-normal text-ink">Less than 24 hours notice:</strong> No
              refund. The full amount is paid to the cleaner.
            </li>
            <li>
              <strong className="font-normal text-ink">Cleaner cancellation:</strong> If the cleaner
              cancels, the customer receives a full refund regardless of notice period.
            </li>
          </ul>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            Refunds for quality issues are handled through our satisfaction guarantee and dispute
            resolution process.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">7. Reviews and Ratings</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            After a completed booking, customers may leave a review and rating for the cleaner.
            Reviews must be honest, accurate, and based on the actual service received. We reserve
            the right to remove reviews that contain abusive language, discriminatory content,
            irrelevant information, or that we reasonably believe to be fraudulent. Cleaners may
            respond to reviews publicly through the Platform.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">8. Disputes</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            If a dispute arises between a customer and a cleaner, either party may raise a dispute
            through the Platform. Rena will review the dispute and aim to reach a resolution within
            48 hours. Rena&apos;s decision in dispute resolution is final and binding. Disputes must
            be raised within 7 days of the booking date.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">9. Prohibited Conduct</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">You agree not to:</p>
          <ul className="mt-4 list-disc pl-6 space-y-2 font-jost font-normal text-ink-2">
            <li>Use the Platform for any unlawful purpose</li>
            <li>
              Circumvent the Platform to arrange or pay for services directly, thereby avoiding
              platform fees
            </li>
            <li>Create fake accounts or post fraudulent reviews</li>
            <li>Harass, abuse, or discriminate against other users</li>
            <li>Upload malicious content, viruses, or attempt to compromise Platform security</li>
            <li>Scrape, crawl, or use automated systems to extract data from the Platform</li>
            <li>Impersonate another person or misrepresent your identity or qualifications</li>
          </ul>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">10. Intellectual Property</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            The Platform, including its design, logos, text, graphics, and software, is owned by
            Rena and protected by copyright, trademark, and other intellectual property laws. You
            may not copy, modify, distribute, or create derivative works from any part of the
            Platform without our prior written consent.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            11. Limitation of Liability
          </h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            To the fullest extent permitted by law, Rena shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising from your use of the
            Platform. Rena is a marketplace and is not responsible for the quality of cleaning
            services provided by independent cleaners, although we strive to maintain high standards
            through our vetting and review systems. Our total liability to you for any claim arising
            from these Terms shall not exceed the amount you have paid to Rena in the 12 months
            preceding the claim.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">12. Indemnification</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            You agree to indemnify, defend, and hold harmless Rena, its officers, directors,
            employees, and agents from any claims, liabilities, damages, losses, and expenses
            (including reasonable legal fees) arising from your use of the Platform, your violation
            of these Terms, or your violation of any rights of another party.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">13. Termination</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            We may suspend or terminate your access to the Platform at any time for any reason,
            including violation of these Terms. You may delete your account at any time through your
            account settings. Upon termination, outstanding bookings will be handled according to
            the cancellation policy, and any pending payments will be processed according to their
            terms.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">14. Governing Law</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            These Terms are governed by and construed in accordance with the laws of England and
            Wales. Any disputes arising from these Terms shall be subject to the exclusive
            jurisdiction of the courts of England and Wales.
          </p>
        </section>

        <section className="mt-8 border-b border-line pb-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">
            15. Changes to These Terms
          </h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            We may update these Terms from time to time. Material changes will be communicated via
            email or through a prominent notice on the Platform at least 30 days before they take
            effect. Your continued use of the Platform after changes take effect constitutes
            acceptance of the updated Terms.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-newsreader text-2xl font-semibold text-ink">16. Contact Information</h2>
          <p className="mt-4 font-jost font-normal text-ink-2 leading-relaxed">
            If you have questions about these Terms, please contact us:
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
