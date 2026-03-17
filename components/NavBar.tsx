import Link from 'next/link';

export default function NavBar() {
  return (
    <nav className="bg-cream px-14 py-5" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}>
      <div className="flex items-center justify-between">
        <Link href="/" className="font-cormorant text-[22px] font-light tracking-widest text-ink">
          RENA
        </Link>
        <div className="flex items-center gap-8">
          <Link href="#how-it-works" className="font-jost text-[13px] font-light text-ink-2">
            How it works
          </Link>
          <Link href="/services" className="font-jost text-[13px] font-light text-ink-2">
            Services
          </Link>
          <Link href="/pricing" className="font-jost text-[13px] font-light text-ink-2">
            Pricing
          </Link>
          <Link href="/join" className="font-jost text-[13px] font-light text-ink-2">
            For cleaners
          </Link>
          <Link
            href="/book"
            className="bg-ink px-6 py-2.5 font-jost text-[13px] font-normal text-cream"
          >
            Book a clean
          </Link>
        </div>
      </div>
    </nav>
  );
}
