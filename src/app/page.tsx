import Link from "next/link";

export default function HomePage() {
  return (
    <>
      {/* Hero with role selection */}
      <section className="bg-gradient-to-br from-brand-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Your home deserves to{" "}
              <span className="text-brand-600">sparkle</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 sm:text-xl">
              Find trusted, independent cleaners in your area. Book in minutes,
              pay securely, and enjoy a spotless home.
            </p>

            <div className="mt-12">
              <p className="text-sm font-medium uppercase tracking-wider text-gray-500">
                I am a...
              </p>
              <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:justify-center">
                {/* Customer card */}
                <Link
                  href="/services"
                  className="group relative flex flex-col items-center rounded-2xl border-2 border-gray-200 bg-white px-10 py-10 shadow-sm transition hover:border-brand-500 hover:shadow-lg sm:w-72"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-4xl transition group-hover:bg-brand-200">
                    &#127968;
                  </div>
                  <h2 className="mt-5 text-xl font-bold text-gray-900">
                    Customer
                  </h2>
                  <p className="mt-2 text-sm text-gray-500 text-center">
                    I need my home or property cleaned
                  </p>
                  <span className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition group-hover:bg-brand-700">
                    Book a Clean
                  </span>
                </Link>

                {/* Cleaner card */}
                <Link
                  href="/join"
                  className="group relative flex flex-col items-center rounded-2xl border-2 border-gray-200 bg-white px-10 py-10 shadow-sm transition hover:border-green-500 hover:shadow-lg sm:w-72"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl transition group-hover:bg-green-200">
                    &#129529;
                  </div>
                  <h2 className="mt-5 text-xl font-bold text-gray-900">
                    Cleaner
                  </h2>
                  <p className="mt-2 text-sm text-gray-500 text-center">
                    I want to offer my cleaning services
                  </p>
                  <span className="mt-6 inline-block rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition group-hover:bg-green-700">
                    Join as a Cleaner
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            How It Works
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Choose Your Service",
                desc: "Regular, one-off, deep clean, AirBnB turnaround, or end of tenancy. Tell us what you need.",
              },
              {
                step: "2",
                title: "Customise & Book",
                desc: "Tell us your rooms, pick your hours, choose a cleaner you like, and find a time that works.",
              },
              {
                step: "3",
                title: "Sit Back & Relax",
                desc: "Your vetted cleaner arrives on time. Rate them after, and rebook with one tap.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
                  {item.step}
                </div>
                <h3 className="mt-4 text-xl font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust features */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Built on Trust &amp; Transparency
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
                $
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Only 10% Fee</h3>
              <p className="mt-2 text-sm text-gray-600">
                We take just 10% — half the industry standard. Cleaners keep
                more, you pay less.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-2xl">
                &#9733;
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Vetted Cleaners</h3>
              <p className="mt-2 text-sm text-gray-600">
                Every cleaner is verified with ID checks and reviews from real
                customers.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-2xl">
                &#128274;
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Secure Payments</h3>
              <p className="mt-2 text-sm text-gray-600">
                Escrow protection on first bookings. Your money is safe until
                the job is done.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-2xl">
                &#128197;
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">Flexible Scheduling</h3>
              <p className="mt-2 text-sm text-gray-600">
                Pick an exact time or tell us you&apos;re flexible. We&apos;ll
                find the best fit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-brand-700 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 text-center md:grid-cols-4">
            {[
              { value: "2,500+", label: "Trusted Cleaners" },
              { value: "50,000+", label: "Happy Customers" },
              { value: "4.8", label: "Average Rating" },
              { value: "120,000+", label: "Cleanings Completed" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <div className="mt-1 text-sm text-brand-200">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Ready for a spotless home?
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Join thousands of happy customers who trust Sparkle for their
            cleaning needs.
          </p>
          <div className="mt-8">
            <Link
              href="/services"
              className="inline-block rounded-lg bg-brand-600 px-8 py-3 text-lg font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
