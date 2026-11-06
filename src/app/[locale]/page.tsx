import { getTranslations, setRequestLocale } from 'next-intl/server';

// C2: the reviews section reads live data.
// RENA-051 (B6.3, named for James's ruling): kept per request, as in
// production today. Railway builds without the private network (and before
// the deploy's migrations), so a build-time render of this database-reading
// page would cache an empty fallback until it revalidated (benched: /cleaners
// served its no-data build render on the first request after start).
export const dynamic = 'force-dynamic';

import JsonLd from '@/components/JsonLd';
import { generateLocalBusinessSchema, generateServiceSchema } from '@/lib/seo/structured-data';

import CleanerCTA from '../../../components/CleanerCTA';
import FooterCTA from '../../../components/FooterCTA';
import GuaranteeSection from '../../../components/GuaranteeSection';
import HeroSection from '../../../components/HeroSection';
import HowItWorks from '../../../components/HowItWorks';
import ReviewsSection from '../../../components/ReviewsSection';
import ServicesSection from '../../../components/ServicesSection';
import StatsBar from '../../../components/StatsBar';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  // A1-P2: canonical + OG image were missing on the highest-value page.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk';
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: baseUrl },
    openGraph: {
      title: t('title'),
      description: t('ogDescription'),
      type: 'website',
      url: baseUrl,
      images: [{ url: `${baseUrl}/og-image.png`, width: 1200, height: 630, alt: t('title') }],
    },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return (
    <>
      <JsonLd data={generateLocalBusinessSchema('North-East London and Essex')} />
      <JsonLd
        data={generateServiceSchema({
          name: t('serviceName'),
          description: t('serviceDescription'),
          price: 14,
        })}
      />
      <HeroSection />
      <StatsBar />
      <ServicesSection />
      <HowItWorks />
      <GuaranteeSection />
      <ReviewsSection />
      <CleanerCTA />
      <FooterCTA />
    </>
  );
}
