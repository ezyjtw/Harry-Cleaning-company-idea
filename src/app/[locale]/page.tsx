import { getTranslations, setRequestLocale } from 'next-intl/server';

import JsonLd from '@/components/JsonLd';
import { generateLocalBusinessSchema, generateServiceSchema } from '@/lib/seo/structured-data';

import CleanerCTA from '../../../components/CleanerCTA';
import FooterCTA from '../../../components/FooterCTA';
import GuaranteeSection from '../../../components/GuaranteeSection';
import HeroSection from '../../../components/HeroSection';
import HomeFooter from '../../../components/HomeFooter';
import HowItWorks from '../../../components/HowItWorks';
import LayoutHider from '../../../components/LayoutHider';
import NavBar from '../../../components/NavBar';
import ReviewsSection from '../../../components/ReviewsSection';
import ServicesSection from '../../../components/ServicesSection';
import StatsBar from '../../../components/StatsBar';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('ogDescription'),
      type: 'website',
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
      <LayoutHider />
      <NavBar />
      <HeroSection />
      <StatsBar />
      <ServicesSection />
      <HowItWorks />
      <GuaranteeSection />
      <ReviewsSection />
      <CleanerCTA />
      <FooterCTA />
      <HomeFooter />
    </>
  );
}
