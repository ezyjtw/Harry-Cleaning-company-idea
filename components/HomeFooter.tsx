import Link from 'next/link';

const links = [
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'For cleaners', href: '/join' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

function VisaIcon() {
  return (
    <svg viewBox="0 0 48 32" className="h-6 w-9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="32" rx="4" fill="#1A1F71" />
      <path d="M19.5 21H17L18.75 11H21.25L19.5 21Z" fill="white" />
      <path
        d="M28.5 11.25C28 11.05 27.2 10.8 26.2 10.8C23.7 10.8 21.95 12.1 21.93 13.95C21.9 15.35 23.2 16.12 24.18 16.58C25.18 17.05 25.5 17.35 25.5 17.75C25.48 18.38 24.72 18.65 24 18.65C23 18.65 22.47 18.5 21.65 18.15L21.3 17.98L20.92 20.35C21.55 20.62 22.72 20.88 23.95 20.9C26.6 20.9 28.32 19.62 28.35 17.65C28.37 16.55 27.68 15.7 26.2 15.02C25.3 14.58 24.75 14.28 24.75 13.85C24.78 13.45 25.2 13.05 26.15 13.05C26.95 13.02 27.55 13.22 28 13.42L28.25 13.55L28.5 11.25Z"
        fill="white"
      />
      <path
        d="M32.25 11H30.25C29.6 11 29.12 11.18 28.85 11.85L25.15 21H27.8L28.32 19.55H31.5L31.8 21H34.15L32.25 11ZM29.05 17.55C29.25 17.02 30.15 14.72 30.15 14.72C30.13 14.75 30.35 14.18 30.48 13.82L30.65 14.62C30.65 14.62 31.2 17.15 31.32 17.55H29.05Z"
        fill="white"
      />
      <path
        d="M16.75 11L14.25 17.85L14 16.55C13.5 15.05 12.1 13.4 10.5 12.58L12.75 21H15.42L19.42 11H16.75Z"
        fill="white"
      />
      <path
        d="M12.5 11H8.55L8.5 11.2C11.7 12 13.8 13.85 14 16.55L13.25 11.88C13.12 11.2 12.65 11.02 12.5 11Z"
        fill="#F9A533"
      />
    </svg>
  );
}

function MastercardIcon() {
  return (
    <svg viewBox="0 0 48 32" className="h-6 w-9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="32" rx="4" fill="#252525" />
      <circle cx="20" cy="16" r="8" fill="#EB001B" />
      <circle cx="28" cy="16" r="8" fill="#F79E1B" />
      <path
        d="M24 10.08C25.87 11.58 27 13.65 27 16C27 18.35 25.87 20.42 24 21.92C22.13 20.42 21 18.35 21 16C21 13.65 22.13 11.58 24 10.08Z"
        fill="#FF5F00"
      />
    </svg>
  );
}

function AmexIcon() {
  return (
    <svg viewBox="0 0 48 32" className="h-6 w-9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="32" rx="4" fill="#2E77BC" />
      <path
        d="M8 20H10.2L10.7 18.8H11.8L12.3 20H17V19L17.45 20H20.1L20.55 18.95V20H31.5L33.35 18.05L35.05 20H40.5L36.35 16.05L40.5 12.2H35.15L33.35 14.1L31.7 12.2H20.1L19.1 14.45L18.05 12.2H15.8V13.15L15.3 12.2H11.05L8 19.2V20Z"
        fill="white"
      />
      <path
        d="M11.7 13.4L9.3 18.9H10.85L11.3 17.8H13.6L14.05 18.9H15.75L13.35 13.4H11.7ZM11.75 16.7L12.45 15.05L13.15 16.7H11.75Z"
        fill="#2E77BC"
      />
      <path d="M15.95 18.9V13.4L18.1 13.4L19.6 17.15L21.05 13.4H23.15V18.9H21.75V14.7L20.1 18.9H18.95L17.3 14.7V18.9H15.95Z" fill="#2E77BC" />
      <path
        d="M24.15 18.9V13.4H29.2V14.55H25.6V15.6H29.1V16.7H25.6V17.75H29.2V18.9H24.15Z"
        fill="#2E77BC"
      />
      <path
        d="M30 18.9L32.5 16.1L29.95 13.4H31.75L33.35 15.2L34.95 13.4H36.65L34.15 16.05L36.7 18.9H34.85L33.2 17L31.55 18.9H30Z"
        fill="#2E77BC"
      />
    </svg>
  );
}

function MaestroIcon() {
  return (
    <svg viewBox="0 0 48 32" className="h-6 w-9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="32" rx="4" fill="#fff" />
      <circle cx="20" cy="16" r="8" fill="#0099DF" />
      <circle cx="28" cy="16" r="8" fill="#ED0006" />
      <path
        d="M24 10.08C25.87 11.58 27 13.65 27 16C27 18.35 25.87 20.42 24 21.92C22.13 20.42 21 18.35 21 16C21 13.65 22.13 11.58 24 10.08Z"
        fill="#6C6BBD"
      />
    </svg>
  );
}

export default function HomeFooter() {
  return (
    <footer className="bg-ink px-5 py-8 md:px-14 md:py-9">
      <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
        <Link href="/" className="font-etna text-[22px] font-semibold tracking-widest text-white">
          RENA
        </Link>
        <div className="flex flex-wrap justify-center gap-4 md:gap-7">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="font-jost text-[12px] tracking-wide text-white/50 transition-colors hover:text-white/80"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <span className="font-jost text-[12px] tracking-wide text-white/25">© 2026 Rena</span>
      </div>
      <div className="mt-6 flex flex-col items-center gap-2 border-t border-white/10 pt-6">
        <p className="font-jost text-[11px] tracking-wide text-white/40">Accepted payment methods</p>
        <div className="flex gap-2">
          <VisaIcon />
          <MastercardIcon />
          <AmexIcon />
          <MaestroIcon />
        </div>
      </div>
    </footer>
  );
}
