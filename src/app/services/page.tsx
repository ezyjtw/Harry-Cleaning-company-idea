import Link from "next/link";
import type { Metadata } from "next";
import { ServiceCategory } from "@/lib/types";

export const metadata: Metadata = {
  title: "Our Services",
  description:
    "Browse our range of cleaning services — from regular weekly cleans to deep end-of-tenancy jobs. Book in minutes.",
};

const services: {
  id: ServiceCategory;
  title: string;
  description: string;
  icon: string;
  featured?: boolean;
}[] = [
  {
    id: "regular",
    title: "Regular Cleaning",
    description:
      "Recurring weekly or fortnightly cleans to keep your home consistently fresh. Lock in a lower rate with a regular schedule.",
    icon: "&#128694;",
    featured: true,
  },
  {
    id: "one-off",
    title: "One-Off Cleaning",
    description:
      "A single clean for when you need a refresh. No commitment, no subscription — just a spotless home.",
    icon: "&#10024;",
  },
  {
    id: "same-day",
    title: "Same Day Cleaning",
    description:
      "Need a clean today? We'll match you with available cleaners near you for a same-day booking.",
    icon: "&#9889;",
  },
  {
    id: "deep",
    title: "Deep Cleaning",
    description:
      "A thorough, top-to-bottom clean. Inside cupboards, behind appliances, skirting boards — the works.",
    icon: "&#128171;",
  },
  {
    id: "airbnb",
    title: "AirBnB Cleaning",
    description:
      "Fast turnaround cleans between guests. Linen changes, restocking, and a spotless space for your next visitors.",
    icon: "&#127968;",
  },
  {
    id: "end-of-tenancy",
    title: "End of Tenancy Cleaning",
    description:
      "Moving out? Get your deposit back with a professional end-of-tenancy deep clean that meets landlord standards.",
    icon: "&#128230;",
  },
];

export default function ServicesPage() {
  const featured = services.find((s) => s.featured);
  const others = services.filter((s) => !s.featured);

  return (
    <>
      <section className="bg-gray-50 py-12 sm:py-16">
        <div className="container-page text-center">
          <h1>What type of clean do you need?</h1>
          <p className="mx-auto mt-3 max-w-xl text-gray-600">
            Select a service to get started with your booking.
          </p>
        </div>
      </section>

      <section className="section bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {/* Featured: Regular Cleaning */}
          {featured && (
            <Link
              href={`/services/${featured.id}`}
              className="group flex flex-col items-center rounded-2xl border-2 border-brand-200 bg-gradient-to-b from-brand-50 to-white p-8 text-center shadow-sm transition hover:border-brand-500 hover:shadow-lg sm:p-12"
            >
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-4xl transition group-hover:bg-brand-200 sm:h-24 sm:w-24 sm:text-5xl"
                dangerouslySetInnerHTML={{ __html: featured.icon }}
              />
              <h2 className="mt-5 text-xl font-bold text-gray-900 group-hover:text-brand-700 sm:text-2xl">
                {featured.title}
              </h2>
              <p className="mt-2 max-w-md text-sm text-gray-600 sm:text-base">
                {featured.description}
              </p>
              <span className="mt-5 inline-block rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition group-hover:bg-brand-700 sm:px-8 sm:py-3">
                Get a Quote
              </span>
            </Link>
          )}

          {/* Other services */}
          <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((service) => (
              <Link
                key={service.id}
                href={`/services/${service.id}`}
                className="group flex flex-col rounded-xl border-2 border-gray-200 bg-white p-5 transition hover:border-brand-500 hover:shadow-lg sm:p-6"
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl transition group-hover:bg-brand-100 sm:h-14 sm:w-14 sm:text-3xl"
                  dangerouslySetInnerHTML={{ __html: service.icon }}
                />
                <h2 className="mt-3 text-base font-bold text-gray-900 group-hover:text-brand-700 sm:mt-4 sm:text-lg">
                  {service.title}
                </h2>
                <p className="mt-1.5 flex-1 text-sm text-gray-600">
                  {service.description}
                </p>
                <span className="mt-3 text-sm font-semibold text-brand-600 group-hover:text-brand-700 sm:mt-4">
                  Get a Quote &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
