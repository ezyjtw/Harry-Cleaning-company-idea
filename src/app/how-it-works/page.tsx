import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'Learn how Rena connects you with trusted, vetted cleaners. Simple booking, secure payments, and quality guaranteed.',
};

export default function HowItWorksPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-ink py-12 sm:py-16">
        <div className="container-page text-center">
          <h1 className="font-cormorant font-light text-cream">How Rena Works</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-jost font-light text-cream/80">
            Getting a clean home has never been easier. Here&apos;s how it works for customers and
            cleaners.
          </p>
        </div>
      </section>

      {/* For Customers */}
      <section className="section bg-cream">
        <div className="container-page">
          <h2 className="text-center font-cormorant font-light text-ink">For Customers</h2>
          <div className="mx-auto mt-4 flex justify-center">
            <div className="w-8 h-px bg-gold" />
          </div>
          <div className="mx-auto mt-10 max-w-2xl space-y-8">
            {[
              {
                step: '1',
                title: 'Browse & Search',
                desc: 'Search for cleaners by location, specialty, price, or availability. Read reviews from verified customers and find the perfect match for your needs.',
              },
              {
                step: '2',
                title: 'Book Instantly',
                desc: 'Select your service type, date, time, and duration. Submit your booking request and receive instant confirmation. No phone calls needed.',
              },
              {
                step: '3',
                title: 'Get Cleaned',
                desc: 'Your cleaner arrives at the scheduled time, fully equipped and ready to work. Sit back, relax, or head out while they transform your space.',
              },
              {
                step: '4',
                title: 'Pay & Review',
                desc: 'Payment is handled securely through the platform. After the job, leave a rating and review to help other customers and reward great cleaners.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-5">
                <div className="shrink-0 font-cormorant text-[40px] font-light text-cream-2 leading-none">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-normal text-ink font-jost">{item.title}</h3>
                  <p className="mt-1 font-jost font-light text-ink-2">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Cleaners */}
      <section className="section bg-cream-2">
        <div className="container-page">
          <h2 className="text-center font-cormorant font-light text-ink">For Cleaners</h2>
          <div className="mx-auto mt-4 flex justify-center">
            <div className="w-8 h-px bg-gold" />
          </div>
          <div className="mx-auto mt-10 max-w-2xl space-y-8">
            {[
              {
                step: '1',
                title: 'Sign Up & Create Your Profile',
                desc: 'Register as a cleaner and build your profile. Highlight your specialties, set your rates, and define your availability.',
              },
              {
                step: '2',
                title: 'Get Verified',
                desc: 'Complete our verification process including background check and identity confirmation. Verified cleaners get more bookings and earn trust faster.',
              },
              {
                step: '3',
                title: 'Receive Bookings',
                desc: 'Customers find you through our platform and book your services. You control your schedule and can accept or decline bookings.',
              },
              {
                step: '4',
                title: 'Earn & Grow',
                desc: 'Complete jobs, earn money, and build your reputation through reviews. Top-rated cleaners get featured and earn more bookings.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-5">
                <div className="shrink-0 font-cormorant text-[40px] font-light text-cream-2 leading-none">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-normal text-ink font-jost">{item.title}</h3>
                  <p className="mt-1 font-jost font-light text-ink-2">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section bg-cream">
        <div className="container-page">
          <div
            className="flex flex-col items-center gap-6 bg-cream-2 p-8 text-center sm:flex-row sm:justify-center sm:gap-8 sm:text-left"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <div>
              <h3 className="text-xl font-normal text-ink font-cormorant font-light">
                Ready to get started?
              </h3>
              <p className="mt-1 font-jost font-light text-ink-2">
                Whether you need a cleaner or want to offer your services.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/cleaners"
                className="inline-block bg-ink px-6 py-3 font-jost font-light text-cream text-sm uppercase tracking-[0.1em] transition-colors hover:bg-ink/90"
              >
                Find a Cleaner
              </Link>
              <Link
                href="/join"
                className="inline-block px-6 py-3 font-jost font-light text-ink text-sm uppercase tracking-[0.1em] transition-colors hover:bg-cream"
                style={{ border: '0.5px solid #0e0e0c' }}
              >
                Join as Cleaner
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
