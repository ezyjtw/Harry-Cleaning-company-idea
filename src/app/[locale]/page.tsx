import { getTranslations, setRequestLocale } from 'next-intl/server';

// C2: the reviews section reads live data — revalidate hourly so real reviews
// appear as the pool grows without forcing a full-dynamic homepage.
export const revalidate = 3600;

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
