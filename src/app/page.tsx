import Link from "next/link";
import CleanerCard from "@/components/CleanerCard";
import { cleaners } from "@/lib/mock-data";

export default function HomePage() {
  const topCleaners = cleaners.slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Your home deserves to{" "}
              <span className="text-brand-600">sparkle</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 sm:text-xl">
              Find trusted, independent cleaners in your area. Book in minutes,
              pay securely, and enjoy a spotless home. We connect you directly
              with vetted cleaning professionals.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/cleaners"
                className="rounded-lg bg-brand-600 px-6 py-3 text-center text-lg font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                Find a Cleaner
              </Link>
              <Link
                href="/join"
                className="rounded-lg border border-brand-600 px-6 py-3 text-center text-lg font-semibold text-brand-700 hover:bg-brand-50"
              >
                Become a Cleaner
              </Link>
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
                title: "Search",
                desc: "Browse trusted cleaners in your area. Filter by rating, price, specialty, and availability.",
              },
              {
                step: "2",
                title: "Book",
                desc: "Choose your date, time, and service type. Confirm your booking in just a few clicks.",
              },
              {
                step: "3",
                title: "Enjoy",
                desc: "Sit back while your cleaner works their magic. Rate and review after the job is done.",
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

      {/* Top cleaners */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold text-gray-900">Top Cleaners</h2>
            <Link
              href="/cleaners"
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {topCleaners.map((cleaner) => (
              <CleanerCard key={cleaner.id} cleaner={cleaner} />
            ))}
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
            cleaning needs. Book your first cleaning today.
          </p>
          <div className="mt-8">
            <Link
              href="/cleaners"
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
