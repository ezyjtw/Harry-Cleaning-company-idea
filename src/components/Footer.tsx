import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 md:grid-cols-4">
          {/* Customers */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">For Customers</h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link href="/services" className="text-sm text-gray-600 hover:text-brand-600">
                  Book a Clean
                </Link>
              </li>
              <li>
                <Link href="/cleaners" className="text-sm text-gray-600 hover:text-brand-600">
                  Find Cleaners
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-sm text-gray-600 hover:text-brand-600">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-gray-600 hover:text-brand-600">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-gray-600 hover:text-brand-600">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/guarantees" className="text-sm text-gray-600 hover:text-brand-600">
                  Our Guarantees
                </Link>
              </li>
            </ul>
          </div>

          {/* Cleaners */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">For Cleaners</h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link href="/join" className="text-sm text-gray-600 hover:text-brand-600">
                  Become a Cleaner
                </Link>
              </li>
              <li>
                <Link href="/cleaner" className="text-sm text-gray-600 hover:text-brand-600">
                  Cleaner Dashboard
                </Link>
              </li>
              <li>
                <Link href="/cleaner/earnings" className="text-sm text-gray-600 hover:text-brand-600">
                  Earnings
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Company</h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link href="/about" className="text-sm text-gray-600 hover:text-brand-600">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-gray-600 hover:text-brand-600">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/guarantees" className="text-sm text-gray-600 hover:text-brand-600">
                  Service Guarantees
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Legal</h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link href="/privacy" className="text-sm text-gray-600 hover:text-brand-600">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-gray-600 hover:text-brand-600">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-gray-200 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold uppercase tracking-wide text-brand-700">
                Rena
              </span>
              <span className="text-sm text-gray-500">Cleaning Network</span>
            </div>
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} Rena Cleaning Network. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
