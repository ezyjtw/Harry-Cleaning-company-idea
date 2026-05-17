import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export const dynamic = 'force-dynamic';

import AIChatWidget from '@/components/AIChatWidget';
import CookieConsent from '@/components/CookieConsent';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import Navbar from '@/components/Navbar';
import AuthProvider from '@/components/providers/AuthProvider';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import { routing } from '@/i18n/routing';
import { generateOrganizationSchema } from '@/lib/seo/structured-data';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return {
    title: {
      default: t('title'),
      template: '%s | Rena Cleaning Network',
    },
    description: t('description'),
    openGraph: {
      type: 'website',
      locale: locale === 'pl' ? 'pl_PL' : 'en_GB',
      siteName: 'Rena Cleaning Network',
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale} className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/icons/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144x144.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#2563EB" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="preload" as="image" href="/images/hero-banner.jpg" fetchPriority="high" />
        <JsonLd data={generateOrganizationSchema()} />
      </head>
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
          >
            Skip to main content
          </a>
          <ServiceWorkerRegistration />
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
          <AIChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
