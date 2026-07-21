import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';

export const dynamic = 'force-dynamic';

import AIChatWidget from '@/components/AIChatWidget';
import ContactFab from '@/components/ContactFab';
import CookieConsent from '@/components/CookieConsent';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import NavProgress from '@/components/nav/NavProgress';
import Navbar from '@/components/Navbar';
import AuthProvider from '@/components/providers/AuthProvider';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import { routing } from '@/i18n/routing';
import { LIVE_CHAT_ENABLED } from '@/lib/config/features';
import { fontVariables } from '@/lib/fonts';
import { generateOrganizationSchema } from '@/lib/seo/structured-data';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk';

  return {
    title: {
      default: t('title'),
      template: '%s | Rena Cleaning Network',
    },
    description: t('description'),
    openGraph: {
      type: 'website',
      locale: 'en_GB',
      siteName: 'Rena Cleaning Network',
      // Site-wide default share image (pages with their own openGraph set
      // their own): the hero photograph, ruled at the polish gate.
      images: [{ url: `${baseUrl}/og-image.png`, width: 1200, height: 630, alt: t('title') }],
    },
    twitter: {
      card: 'summary_large_image',
      images: [`${baseUrl}/og-image.png`],
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} className={`scroll-smooth ${fontVariables}`}>
      <head>
        {/* Polish gate (James-ruled): favicon.ico (16/32/48) is his
            white-R-on-navy mark, scaled only; the large set is the full RENA
            logo. Sources canonicalised at public/favicon-source.png and
            public/rena-logo.png. */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#16296b" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
        {/* Fonts are self-hosted via next/font (see src/app/layout.tsx) — no Google Fonts link. */}
        {/* H87: no manual hero preload — the hero renders via next/image with
            `priority`, which preloads the OPTIMISED /_next/image URL itself; a
            raw-file preload here was never used and warned in the console. */}
        <JsonLd data={generateOrganizationSchema()} />
      </head>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[10px] focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
            >
              Skip to main content
            </a>
            <ServiceWorkerRegistration />
            <NavProgress />
            <div id="layout-nav">
              <Navbar />
            </div>
            <main id="main-content" className="flex-1" role="main">
              {children}
            </main>
            <div id="layout-footer">
              <Footer />
            </div>
            <CookieConsent />
            {/* H88 (James-ruled): live chat is pulled from launch — the same
                bottom-right FAB opens the contact form until the flag flips. */}
            {LIVE_CHAT_ENABLED ? <AIChatWidget /> : <ContactFab />}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
