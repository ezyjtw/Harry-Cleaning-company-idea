import Link from "next/link";
import { ServiceCategory } from "@/lib/types";

const services: {
  id: ServiceCategory;
  title: string;
  description: string;
  icon: string;
  popular?: boolean;
}[] = [
  {
    id: "regular",
    title: "Regular Cleaning",
    description:
      "Recurring weekly or biweekly cleans to keep your home consistently fresh. Lock in a lower rate with a regular schedule.",
    icon: "&#128694;",
    popular: true,
  },
  {
    id: "one-off",
    title: "One-Off Cleaning",
    description:
      "A single clean for when you need a refresh. No commitment, no subscription — just a sparkling home.",
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
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
          What type of clean do you need?
        </h1>
        <p className="mt-3 text-gray-600">
          Select a service to get started with your booking.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <Link
            key={service.id}
            href={`/services/${service.id}`}
            className="group relative flex flex-col rounded-2xl border-2 border-gray-200 bg-white p-6 transition hover:border-brand-500 hover:shadow-lg"
          >
            {service.popular && (
              <span className="absolute -top-3 right-4 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">
                Most Popular
              </span>
            )}
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-3xl transition group-hover:bg-brand-100"
              dangerouslySetInnerHTML={{ __html: service.icon }}
            />
            <h2 className="mt-4 text-lg font-bold text-gray-900 group-hover:text-brand-700">
              {service.title}
            </h2>
            <p className="mt-2 flex-1 text-sm text-gray-600">
              {service.description}
            </p>
            <span className="mt-4 text-sm font-semibold text-brand-600 group-hover:text-brand-700">
              Select &rarr;
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
