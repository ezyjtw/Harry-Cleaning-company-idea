import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Learn how Rena connects you with trusted, vetted cleaners. Simple booking, secure payments, and quality guaranteed.",
};

export default function HowItWorksPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-gray-50 py-12 sm:py-16">
        <div className="container-page text-center">
          <h1>How Rena Works</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Getting a clean home has never been easier. Here&apos;s how it works
            for customers and cleaners.
          </p>
        </div>
      </section>

      {/* For Customers */}
      <section className="section bg-white">
        <div className="container-page">
          <h2 className="text-center">For Customers</h2>
          <div className="mx-auto mt-10 max-w-2xl space-y-8">
            {[
              {
                step: "1",
                title: "Browse & Search",
                desc: "Search for cleaners by location, specialty, price, or availability. Read reviews from verified customers and find the perfect match for your needs.",
              },
              {
                step: "2",
                title: "Book Instantly",
                desc: "Select your service type, date, time, and duration. Submit your booking request and receive instant confirmation. No phone calls needed.",
              },
              {
                step: "3",
                title: "Get Cleaned",
                desc: "Your cleaner arrives at the scheduled time, fully equipped and ready to work. Sit back, relax, or head out while they transform your space.",
              },
              {
                step: "4",
                title: "Pay & Review",
                desc: "Payment is handled securely through the platform. After the job, leave a rating and review to help other customers and reward great cleaners.",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Cleaners */}
      <section className="section bg-gray-50">
        <div className="container-page">
          <h2 className="text-center">For Cleaners</h2>
          <div className="mx-auto mt-10 max-w-2xl space-y-8">
            {[
              {
                step: "1",
                title: "Sign Up & Create Your Profile",
                desc: "Register as a cleaner and build your profile. Highlight your specialties, set your rates, and define your availability.",
              },
              {
                step: "2",
                title: "Get Verified",
                desc: "Complete our verification process including background check and identity confirmation. Verified cleaners get more bookings and earn trust faster.",
              },
              {
                step: "3",
                title: "Receive Bookings",
                desc: "Customers find you through our platform and book your services. You control your schedule and can accept or decline bookings.",
              },
              {
                step: "4",
                title: "Earn & Grow",
                desc: "Complete jobs, earn money, and build your reputation through reviews. Top-rated cleaners get featured and earn more bookings.",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 font-bold text-white">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section bg-white">
        <div className="container-page">
          <div className="flex flex-col items-center gap-6 rounded-2xl bg-brand-50 p-8 text-center sm:flex-row sm:justify-center sm:gap-8 sm:text-left">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Ready to get started?
              </h3>
              <p className="mt-1 text-gray-600">
                Whether you need a cleaner or want to offer your services.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/cleaners" className="btn-primary btn-md">
                Find a Cleaner
              </Link>
              <Link href="/join" className="btn-secondary btn-md">
                Join as Cleaner
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
