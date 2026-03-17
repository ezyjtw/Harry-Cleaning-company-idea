import type { Metadata } from 'next';

import FooterCTA from '../../components/FooterCTA';
import GuaranteeSection from '../../components/GuaranteeSection';
import HeroSection from '../../components/HeroSection';
import HomeFooter from '../../components/HomeFooter';
import HowItWorks from '../../components/HowItWorks';
import LayoutHider from '../../components/LayoutHider';
import NavBar from '../../components/NavBar';
import ReviewsSection from '../../components/ReviewsSection';
import ServicesSection from '../../components/ServicesSection';
import StatsBar from '../../components/StatsBar';

export const metadata: Metadata = {
  title: 'Rena — Find Trusted Cleaners Near You',
  description:
    'Connect with vetted, independent cleaners in your area. Book in minutes, pay securely, and enjoy a spotless home.',
  openGraph: {
    title: 'Rena — Find Trusted Cleaners Near You',
    description:
      'Connect with vetted, independent cleaners in your area. Book in minutes, pay securely.',
    type: 'website',
  },
};

export default function HomePage() {
  return (
    <>
      <LayoutHider />
      <NavBar />
      <HeroSection />
      <StatsBar />
      <ServicesSection />
      <HowItWorks />
      <GuaranteeSection />
      <ReviewsSection />
      <FooterCTA />
      <HomeFooter />
    </>
  );
}
