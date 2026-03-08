import Link from "next/link";

export default function HomePage() {
  return (
    <>
      {/* Hero banner */}
      <section className="bg-brand-600">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          <h1 className="text-4xl font-extrabold uppercase tracking-wider text-white sm:text-5xl lg:text-6xl">
            The Cleaner Exchange
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            Find trusted, independent cleaners in your area. Book in minutes,
            pay securely, enjoy a spotless home.
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            What type of clean do you need?
          </h2>

          {/* Regular Cleaning — hero card */}
          <Link
            href="/services/regular"
            className="group mt-10 flex flex-col items-center rounded-2xl border-2 border-brand-200 bg-gradient-to-b from-brand-50 to-white p-10 text-center shadow-sm transition hover:border-brand-500 hover:shadow-lg sm:p-14"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-100 text-5xl transition group-hover:bg-brand-200">
              &#128694;
            </div>
            <h3 className="mt-6 text-2xl font-bold text-gray-900 group-hover:text-brand-700 sm:text-3xl">
              Regular Cleaning
            </h3>
            <p className="mt-3 max-w-md text-gray-600">
              Recurring weekly or fortnightly cleans to keep your home
              consistently fresh. Lock in a lower rate with a regular schedule.
            </p>
            <span className="mt-6 inline-block rounded-lg bg-brand-600 px-8 py-3 text-sm font-semibold text-white transition group-hover:bg-brand-700">
              Get a Quote
            </span>
          </Link>

          {/* Other services */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                id: "one-off",
                title: "One-Off Cleaning",
                icon: "&#10024;",
              },
              {
                id: "same-day",
                title: "Same Day Cleaning",
                icon: "&#9889;",
              },
              {
                id: "deep",
                title: "Deep Cleaning",
                icon: "&#128171;",
              },
              {
                id: "airbnb",
                title: "AirBnB Cleaning",
                icon: "&#127968;",
              },
              {
                id: "end-of-tenancy",
                title: "End of Tenancy Cleaning",
                icon: "&#128230;",
              },
            ].map((svc) => (
              <Link
                key={svc.id}
                href={`/services/${svc.id}`}
                className="group flex flex-col items-center rounded-xl border border-gray-200 bg-white p-5 text-center transition hover:border-brand-400 hover:shadow-md"
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-2xl transition group-hover:bg-brand-100"
                  dangerouslySetInnerHTML={{ __html: svc.icon }}
                />
                <h4 className="mt-3 text-sm font-semibold text-gray-900 group-hover:text-brand-700">
                  {svc.title}
                </h4>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            How It Works
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
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
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
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

      {/* Trust */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: "\u00A3", title: "Only 10% Fee", desc: "Cleaners keep more, you pay less." },
              { icon: "\u2605", title: "Vetted Cleaners", desc: "ID-checked and reviewed by real customers." },
              { icon: "\uD83D\uDD12", title: "Secure Payments", desc: "Escrow protection on first bookings." },
              { icon: "\uD83D\uDCC5", title: "Flexible Scheduling", desc: "Pick a time or let us find the best fit." },
            ].map((f) => (
              <div key={f.title} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-2xl">
                  {f.icon}
                </div>
                <h3 className="mt-3 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-600 py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready for a spotless home?
          </h2>
          <p className="mt-3 text-white/80">
            Join thousands of happy customers who trust The Cleaner Exchange.
          </p>
          <Link
            href="/services/regular"
            className="mt-6 inline-block rounded-lg bg-white px-8 py-3 text-lg font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
          >
            Get Started
          </Link>
        </div>
      </section>
    </>
  );
}
