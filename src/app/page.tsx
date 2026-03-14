import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rena — Find Trusted Cleaners Near You",
  description:
    "Connect with vetted, independent cleaners in your area. Book in minutes, pay securely, and enjoy a spotless home. Only 10% platform fee.",
  openGraph: {
    title: "Rena — Find Trusted Cleaners Near You",
    description:
      "Connect with vetted, independent cleaners in your area. Book in minutes, pay securely.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <>
      {/* Hero banner */}
      <section className="relative bg-brand-600">
        <div
          className="absolute inset-0 bg-cover"
          style={{
            backgroundImage: "url('/images/hero-banner.jpg')",
            backgroundPosition: "70% center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
        <div className="relative mx-auto flex min-h-[60vh] max-w-7xl items-center px-6 py-16 sm:min-h-[70vh] sm:px-8 sm:py-24 lg:px-10">
          <div className="max-w-lg">
            <h1 className="text-4xl font-extrabold uppercase tracking-wide text-white drop-shadow-lg sm:text-5xl lg:text-6xl">
              RENA
            </h1>
            <p className="mt-2 text-lg font-semibold text-white/90 drop-shadow sm:mt-3 sm:text-2xl lg:text-3xl">
              Choose the cleaner that&apos;s right for you
            </p>
            <p className="mt-4 hidden max-w-md text-base text-white/80 drop-shadow sm:block sm:text-lg">
              Our mission is to connect you with trusted, vetted cleaners in
              your area — so you can find the right person for your home,
              someone you can rely on and trust.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
              <Link
                href="/services"
                className="btn-primary btn-lg text-center"
              >
                Book a Clean
              </Link>
              <Link
                href="/how-it-works"
                className="btn btn-lg border border-white/30 bg-white/10 text-center text-white backdrop-blur-sm hover:bg-white/20"
              >
                How It Works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b border-gray-100 bg-white py-6">
        <div className="container-page">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 sm:gap-10">
            <div className="flex items-center gap-2">
              <span className="text-lg">&#9989;</span>
              <span>Vetted &amp; ID-Checked</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">&#128274;</span>
              <span>Secure Payments</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">&#11088;</span>
              <span>Rated by Real Customers</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">&#128176;</span>
              <span>Only 10% Platform Fee</span>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section bg-white">
        <div className="container-page">
          <div className="section-header">
            <h2>What type of clean do you need?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-600">
              From regular weekly cleans to deep end-of-tenancy jobs, we&apos;ve
              got you covered.
            </p>
          </div>

          {/* Regular Cleaning — hero card */}
          <Link
            href="/services/regular"
            className="group flex flex-col items-center rounded-2xl border-2 border-brand-200 bg-gradient-to-b from-brand-50 to-white p-8 text-center shadow-sm transition hover:border-brand-500 hover:shadow-lg sm:p-12"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-4xl transition group-hover:bg-brand-200 sm:h-24 sm:w-24 sm:text-5xl">
              &#128694;
            </div>
            <h3 className="mt-5 text-xl font-bold text-gray-900 group-hover:text-brand-700 sm:text-2xl">
              Regular Cleaning
            </h3>
            <p className="mt-2 max-w-md text-sm text-gray-600 sm:text-base">
              Recurring weekly or fortnightly cleans to keep your home
              consistently fresh. Lock in a lower rate with a regular schedule.
            </p>
            <span className="mt-5 inline-block rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition group-hover:bg-brand-700 sm:px-8 sm:py-3">
              Get a Quote
            </span>
          </Link>

          {/* Other services */}
          <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
            {[
              { id: "one-off", title: "One-Off Clean", icon: "&#10024;" },
              { id: "same-day", title: "Same Day Clean", icon: "&#9889;" },
              { id: "deep", title: "Deep Clean", icon: "&#128171;" },
              { id: "airbnb", title: "AirBnB Clean", icon: "&#127968;" },
              { id: "end-of-tenancy", title: "End of Tenancy", icon: "&#128230;" },
            ].map((svc) => (
              <Link
                key={svc.id}
                href={`/services/${svc.id}`}
                className="group flex flex-col items-center rounded-xl border border-gray-200 bg-white p-4 text-center transition hover:border-brand-400 hover:shadow-md sm:p-5"
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-xl transition group-hover:bg-brand-100 sm:h-12 sm:w-12 sm:text-2xl"
                  dangerouslySetInnerHTML={{ __html: svc.icon }}
                />
                <h4 className="mt-2.5 text-sm font-semibold text-gray-900 group-hover:text-brand-700">
                  {svc.title}
                </h4>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section bg-gray-50">
        <div className="container-page">
          <div className="section-header">
            <h2>How It Works</h2>
            <p className="mx-auto mt-3 max-w-xl text-gray-600">
              Three simple steps to a spotless home
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Tell Us What You Need",
                desc: "Enter your postcode, tell us your rooms, and we\u2019ll suggest the right amount of time.",
              },
              {
                step: "2",
                title: "Choose Your Cleaner",
                desc: "Browse cleaners in your area with reviews, languages, and availability. Pick one you like.",
              },
              {
                step: "3",
                title: "Sit Back & Relax",
                desc: "Your cleaner arrives on time. Rate them after, and rebook with one tap.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white shadow-sm">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Rena */}
      <section className="section bg-white">
        <div className="container-page">
          <div className="section-header">
            <h2>Why Choose Rena?</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: "\u2605",
                title: "Vetted Cleaners",
                desc: "Every cleaner is ID-checked and reviewed by real customers before they join.",
              },
              {
                icon: "\uD83D\uDD12",
                title: "Secure Payments",
                desc: "Escrow protection on first bookings. Your money is safe until the job is done.",
              },
              {
                icon: "\uD83D\uDCC5",
                title: "Flexible Scheduling",
                desc: "Pick a time that works for you, or find cleaners available for same-day bookings.",
              },
              {
                icon: "\uD83D\uDCB0",
                title: "Fair Pricing",
                desc: "Only 10% platform fee — cleaners keep more, you pay less compared to other platforms.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-2xl">
                  {f.icon}
                </div>
                <h3 className="mt-3 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cleaner CTA */}
      <section className="section bg-gray-900">
        <div className="container-page text-center">
          <h2 className="text-white">Are you a cleaner?</h2>
          <p className="mx-auto mt-3 max-w-xl text-gray-400">
            Join Rena and keep 90% of what you earn. Set your own hours, choose
            your clients, and grow your business with our platform.
          </p>
          <Link
            href="/join"
            className="btn-primary btn-lg mt-6 inline-block"
          >
            Become a Cleaner
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="section bg-brand-600">
        <div className="container-page text-center">
          <h2 className="text-white">Ready for a spotless home?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">
            Join thousands of happy customers who trust Rena.
          </p>
          <Link
            href="/services/regular"
            className="mt-6 inline-block rounded-lg bg-white px-8 py-3 text-lg font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
          >
            Get Started
          </Link>
        </div>
      </section>
    </>
  );
}
