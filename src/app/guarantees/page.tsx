import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Service Guarantees — Your Protection with Rena',
  description:
    'Rena protects every booking with a satisfaction guarantee, escrow payments, insurance coverage, and a fair cancellation policy. Book with confidence.',
  openGraph: {
    title: 'Service Guarantees — Your Protection with Rena',
    description:
      'Rena protects every booking with a satisfaction guarantee, escrow payments, and insurance coverage.',
  },
};

export default function GuaranteesPage() {
  return (
    <div className="bg-cream">
      {/* Hero */}
      <section className="bg-ink py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="font-cormorant text-4xl font-light tracking-tight text-cream sm:text-5xl">
            Book with Confidence
          </h1>
          <p className="mx-auto mt-6 max-w-2xl font-jost text-lg font-light text-cream/90">
            Every Rena booking is backed by our comprehensive protection policies. Your satisfaction
            and safety are our top priorities.
          </p>
        </div>
      </section>

      {/* Satisfaction Guarantee */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-6">
            <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center bg-cream-2">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="#b8975a"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-cormorant text-3xl font-light text-ink">
                Satisfaction Guarantee
              </h2>
              <div className="mt-4 space-y-4 font-jost font-light text-ink-2 leading-relaxed">
                <p>
                  If you are not completely satisfied with your clean, let us know within 24 hours
                  of the service being completed. We will work with you to make it right.
                </p>
                <div
                  className="bg-cream-2 p-6"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  <h3 className="font-jost font-normal text-ink">How it works:</h3>
                  <ol className="mt-3 list-decimal pl-5 space-y-2 font-jost font-light text-ink-2">
                    <li>
                      Contact us within 24 hours of your cleaning via your booking page or email.
                    </li>
                    <li>
                      Describe the areas you are not satisfied with and provide photos if possible.
                    </li>
                    <li>
                      We will arrange a free re-clean within 48 hours, or issue a full refund — your
                      choice.
                    </li>
                  </ol>
                </div>
                <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  The satisfaction guarantee applies to all service types. Claims must be submitted
                  within 24 hours of the cleaning being completed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        className="mx-auto max-w-4xl"
        style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}
      />

      {/* Escrow Protection */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-6">
            <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center bg-cream-2">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="#b8975a"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-cormorant text-3xl font-light text-ink">
                Escrow Payment Protection
              </h2>
              <div className="mt-4 space-y-4 font-jost font-light text-ink-2 leading-relaxed">
                <p>
                  For your first booking with any new cleaner, your payment is held in secure
                  escrow. The cleaner only receives payment after the job is completed and you are
                  satisfied.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div
                    className="p-4 text-center"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  >
                    <div className="font-cormorant text-2xl font-light text-gold">1</div>
                    <p className="mt-2 font-jost text-sm font-light text-ink-2">
                      You pay at booking
                    </p>
                  </div>
                  <div
                    className="p-4 text-center"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  >
                    <div className="font-cormorant text-2xl font-light text-gold">2</div>
                    <p className="mt-2 font-jost text-sm font-light text-ink-2">
                      Funds held securely
                    </p>
                  </div>
                  <div
                    className="p-4 text-center"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  >
                    <div className="font-cormorant text-2xl font-light text-gold">3</div>
                    <p className="mt-2 font-jost text-sm font-light text-ink-2">
                      Released after completion
                    </p>
                  </div>
                </div>
                <p>
                  Once you have an established relationship with a cleaner (after your first
                  successful booking), payments are processed directly for faster payouts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        className="mx-auto max-w-4xl"
        style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}
      />

      {/* Insurance */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-6">
            <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center bg-cream-2">
              <svg
                className="h-7 w-7"
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
            </div>
            <div>
              <h2 className="font-cormorant text-3xl font-light text-ink">Insurance Coverage</h2>
              <div className="mt-4 space-y-4 font-jost font-light text-ink-2 leading-relaxed">
                <p>
                  All cleaners on the Rena platform are required to hold valid public liability
                  insurance. This protects you in the unlikely event of accidental damage to your
                  property during a clean.
                </p>
                <div
                  className="bg-cream-2 p-6"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  <h3 className="font-jost font-normal text-ink">What is covered:</h3>
                  <ul className="mt-3 space-y-2">
                    <li className="flex items-start gap-3">
                      <svg
                        className="mt-0.5 h-5 w-5 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="#b8975a"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                      <span>Accidental damage to property or belongings</span>
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                      <span>Breakage of household items during cleaning</span>
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                      <span>Water damage from cleaning activities</span>
                    </li>
                  </ul>
                </div>
                <p>
                  In the event of damage, report it through your booking page within 48 hours. Our
                  team will coordinate with the cleaner and their insurance provider to resolve the
                  claim.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        className="mx-auto max-w-4xl"
        style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}
      />

      {/* Re-clean Policy */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-6">
            <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center bg-cream-2">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="#b8975a"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M4.031 9.865l4.992-.001"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-cormorant text-3xl font-light text-ink">Re-Clean Policy</h2>
              <div className="mt-4 space-y-4 font-jost font-light text-ink-2 leading-relaxed">
                <p>
                  If specific areas of your home were not cleaned to the agreed standard, we will
                  arrange a free re-clean of those areas. This is separate from the full
                  satisfaction guarantee and applies to partial issues.
                </p>
                <div
                  className="bg-cream-2 p-6"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  <h3 className="font-jost font-normal text-ink">Re-clean conditions:</h3>
                  <ul className="mt-3 space-y-2 font-jost font-light text-ink-2">
                    <li>Must be reported within 24 hours of the clean</li>
                    <li>Photos of the areas in question are helpful but not required</li>
                    <li>Re-clean will be scheduled within 48 hours</li>
                    <li>
                      The same cleaner or a replacement will be arranged based on your preference
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        className="mx-auto max-w-4xl"
        style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}
      />

      {/* Cancellation Policy */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-6">
            <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center bg-cream-2">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="#b8975a"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-cormorant text-3xl font-light text-ink">Cancellation Policy</h2>
              <div className="mt-4 space-y-4 font-jost font-light text-ink-2 leading-relaxed">
                <p>
                  We understand plans change. Our cancellation policy is designed to be fair to both
                  customers and cleaners.
                </p>
                <div
                  className="overflow-hidden"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  <table className="min-w-full">
                    <thead className="bg-cream-2">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal"
                        >
                          When you cancel
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 font-normal"
                        >
                          Refund
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}>
                        <td className="px-6 py-4 font-jost text-sm font-light text-ink-2">
                          48+ hours before the booking
                        </td>
                        <td className="px-6 py-4 font-jost text-sm font-normal text-green-600">
                          Full refund
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}>
                        <td className="px-6 py-4 font-jost text-sm font-light text-ink-2">
                          24–48 hours before the booking
                        </td>
                        <td className="px-6 py-4 font-jost text-sm font-normal text-yellow-600">
                          50% refund
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 font-jost text-sm font-light text-ink-2">
                          Less than 24 hours before
                        </td>
                        <td className="px-6 py-4 font-jost text-sm font-normal text-red-600">
                          No refund
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  If a cleaner cancels on you, you will always receive a full refund regardless of
                  timing. We will also help you find an alternative cleaner as quickly as possible.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink py-14">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-cormorant text-2xl font-light text-cream sm:text-3xl">
            Protected on every booking
          </h2>
          <p className="mt-3 font-jost font-light text-cream/80">
            Book with confidence knowing you are covered by our guarantees.
          </p>
          <Link
            href="/cleaners"
            className="mt-6 inline-block bg-cream px-8 py-3 font-jost font-normal text-ink transition-colors hover:bg-cream-2"
          >
            Find a Cleaner
          </Link>
        </div>
      </section>
    </div>
  );
}
