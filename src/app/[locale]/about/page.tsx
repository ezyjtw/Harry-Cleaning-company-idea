import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Rena — Our Mission to Transform Home Cleaning',
  description:
    'Learn about Rena, the cleaning marketplace that puts cleaners first. One all-inclusive price for customers, and cleaners keep 90%. Discover our mission, values, and how we vet every cleaner.',
  openGraph: {
    title: 'About Rena — Our Mission to Transform Home Cleaning',
    description:
      'Learn about Rena, the cleaning marketplace that puts cleaners first. One all-inclusive price for customers.',
  },
};

const values = [
  {
    title: 'Transparency',
    description:
      'No hidden fees, no surprise charges. Every price is shown upfront so you know exactly what you are paying and cleaners know exactly what they are earning.',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="#b8975a"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Fairness',
    description:
      'Our model means cleaners keep 90% of their rate and customers pay one fair, all-inclusive price — far less than other platforms. Cleaners earn more, customers pay less. Everyone wins.',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="#b8975a"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z"
        />
      </svg>
    ),
  },
  {
    title: 'Trust & Safety',
    description:
      'Every cleaner is ID-verified and personally vetted. Held payments protect first bookings, and our review system keeps standards high.',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="#b8975a"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
  },
  {
    title: 'Community',
    description:
      'We are building a community where cleaners are valued professionals. Better treatment leads to better service for everyone.',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="#b8975a"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
        />
      </svg>
    ),
  },
];

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-ink py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-semibold tracking-tight text-cream font-newsreader sm:text-5xl">
            Cleaning Done Right, for Everyone
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-jost font-light text-cream/80">
            Rena is a cleaning marketplace built on a simple idea: cleaners deserve better, and
            customers deserve transparency. We connect trusted professionals with homeowners who
            value quality.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold text-ink font-newsreader">Our Story</h2>
          <div className="mt-4 w-8 h-px bg-gold" />
          <div className="mt-6 space-y-4 text-lg font-jost font-light text-ink-2 leading-relaxed">
            <p>
              We are James and Harry Wright, the founders of Rena. We grew up in a family of five,
              and our mum always wanted a tidy house. She would always be telling us off about the
              mess, and we would always say that we needed to get a cleaner in.
            </p>
            <p>
              She would always come back with the famous line: &ldquo;A cleaner cleans but
              doesn&rsquo;t tidy, so they would be no good for our mess.&rdquo;
            </p>
            <p>
              But as we grew older, we kept asking the question — why does she work all day and then
              come home and kill herself cleaning instead of getting a cleaner? The answer was
              always the same: <strong>TRUST</strong>. She never felt like she could trust who was
              coming into her house. She never had that peace of mind. She had booked cleaning
              companies before but never knew who was actually turning up at her door.
            </p>
            <p>
              At Rena, we have changed that. You get to choose a cleaner that fits your needs, talk
              to them before they arrive, and have the trust that they have been correctly vetted —
              all with the ease of ordering with a few touches of an app or clicks on a website.
              Payment is held securely on your first clean so you have that peace of mind that our
              mum never had.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="bg-cream-2 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold text-ink font-newsreader">Our Mission</h2>
          <div className="mt-4 w-8 h-px bg-gold" />
          <div className="mt-6 space-y-4 text-lg font-jost font-light text-ink-2 leading-relaxed">
            <p>
              The cleaning industry is broken. Leading platforms in the industry take 20-30% of what
              customers pay, leaving cleaners with less than they deserve. Customers often have no
              say in who cleans their home, and there is little accountability when things go wrong.
            </p>
            <p>
              We started Rena to fix this. Customers pay one fair, all-inclusive price — enough to
              run a great service, while ensuring cleaners keep the vast majority of their earnings.
              This attracts the best cleaners, which means a better experience for you.
            </p>
            <p>
              We believe that when cleaners are treated fairly, they do better work. When customers
              can choose their cleaner and see real reviews, they get a service they can trust. Rena
              is where those two things meet.
            </p>
          </div>
        </div>
      </section>

      {/* How Rena is Different */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold text-ink font-newsreader">How Rena is Different</h2>
          <div className="mt-4 w-8 h-px bg-gold" />
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div className="bg-cream p-8" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
              <h3 className="text-lg font-semibold text-ink font-newsreader">
                Leading Platforms in the Industry
              </h3>
              <ul className="mt-4 space-y-3 font-jost font-light text-ink-2">
                <li className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="#0e0e0c"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>20-30% commission fees</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="#0e0e0c"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>No choice in who cleans your home</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="#0e0e0c"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Opaque pricing structures</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="#0e0e0c"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Limited accountability</span>
                </li>
              </ul>
            </div>
            <div className="bg-cream p-8" style={{ border: '0.5px solid #b8975a' }}>
              <h3 className="text-lg font-semibold text-gold font-newsreader">Rena</h3>
              <ul className="mt-4 space-y-3 font-jost font-light text-ink-2">
                <li className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="#b8975a"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>One all-inclusive price — no hidden charges</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="#b8975a"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>You choose your cleaner</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="#b8975a"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Fully transparent pricing</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="#b8975a"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Real reviews and verified cleaners</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Vetting Process */}
      <section className="bg-cream-2 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold text-ink font-newsreader">
            Our Cleaner Vetting Process
          </h2>
          <div className="mt-4 w-8 h-px bg-gold" />
          <p className="mt-4 text-lg font-jost font-light text-ink-2">
            Every cleaner on Rena goes through a rigorous multi-step verification process before
            they can accept bookings.
          </p>
          <div className="mt-10 space-y-8">
            {[
              {
                step: '1',
                title: 'Identity Verification',
                desc: 'Government-issued photo ID is verified to confirm the cleaner is who they say they are.',
              },
              {
                step: '2',
                title: 'Reference Check',
                desc: 'We contact previous clients or employers to verify cleaning experience and reliability.',
              },
              {
                step: '3',
                title: 'Right to Work',
                desc: 'We verify that every cleaner has the legal right to work in the United Kingdom.',
              },
              {
                step: '4',
                title: 'Insurance Coverage',
                desc: 'Rena provides insurance coverage so both cleaners and customers are protected on every booking.',
              },
              {
                step: '5',
                title: 'Ongoing Quality Monitoring',
                desc: 'Cleaner performance is continuously monitored through customer reviews and ratings. Consistently low-rated cleaners are removed from the platform.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-6">
                <div className="shrink-0 font-newsreader text-[40px] font-medium text-cream-2 leading-none">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink font-newsreader">{item.title}</h3>
                  <p className="mt-1 font-jost font-light text-ink-2">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-cream py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-semibold text-ink font-newsreader">Our Values</h2>
          <div className="mx-auto mt-4 flex justify-center">
            <div className="w-8 h-px bg-gold" />
          </div>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {values.map((value) => (
              <div
                key={value.title}
                className="bg-cream p-6"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <div className="flex h-12 w-12 items-center justify-center">{value.icon}</div>
                <h3 className="mt-4 text-lg font-semibold text-ink font-newsreader">{value.title}</h3>
                <p className="mt-2 font-jost font-light text-ink-2">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-cream font-newsreader sm:text-3xl">
            Ready to experience the difference?
          </h2>
          <p className="mt-3 font-jost font-light text-cream/70">
            Join a growing community of customers and cleaners building something fairer, one clean at a time.
          </p>
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/cleaners"
              className="inline-block bg-cream px-8 py-3 font-jost font-light text-ink text-sm uppercase tracking-[0.1em] transition-colors hover:bg-cream-2"
            >
              Find a Cleaner
            </Link>
            <Link
              href="/join"
              className="inline-block px-8 py-3 font-jost font-light text-cream text-sm uppercase tracking-[0.1em] transition-colors hover:bg-cream/10"
              style={{ border: '0.5px solid #faf8f4' }}
            >
              Join as a Cleaner
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
