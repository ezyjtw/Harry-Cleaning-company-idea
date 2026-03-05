import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-center text-4xl font-bold text-gray-900">
        How Sparkle Works
      </h1>
      <p className="mt-4 text-center text-lg text-gray-600">
        Getting a clean home has never been easier. Here&apos;s how it works for
        customers and cleaners.
      </p>

      {/* For Customers */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold text-gray-900">For Customers</h2>
        <div className="mt-8 space-y-8">
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
            <div key={item.step} className="flex gap-6">
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
      </section>

      {/* For Cleaners */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold text-gray-900">For Cleaners</h2>
        <div className="mt-8 space-y-8">
          {[
            {
              step: "1",
              title: "Sign Up & Create Your Profile",
              desc: "Register as a cleaner and build your profile. Highlight your specialties, set your rates, and define your availability. Stand out with a great bio.",
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
              desc: "Complete jobs, earn money, and build your reputation through reviews. Top-rated cleaners get featured on our homepage and earn more bookings.",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-6">
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
      </section>

      {/* CTA */}
      <div className="mt-16 flex flex-col items-center gap-4 rounded-xl bg-brand-50 p-8 text-center sm:flex-row sm:justify-center sm:text-left">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Ready to get started?</h3>
          <p className="mt-1 text-gray-600">
            Whether you need a cleaner or want to offer your services.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/cleaners"
            className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
          >
            Find a Cleaner
          </Link>
          <Link
            href="/join"
            className="rounded-lg border border-brand-600 px-5 py-2.5 font-semibold text-brand-700 hover:bg-brand-50"
          >
            Join as Cleaner
          </Link>
        </div>
      </div>
    </div>
  );
}
