import { loadStripe, type Appearance } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

export default stripePromise;

// Single Stripe Elements appearance (B8) — one source, passed at every Elements
// provider so the PaymentElement matches the site. The Stripe iframe can't load our
// next/font Jost, so we pass the family name with web-safe fallbacks; it degrades to
// system fonts if Jost isn't available to the iframe (acceptable).
export const stripeAppearance: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#16296b',
    colorText: '#1B2A4A',
    colorTextSecondary: '#3D5170',
    colorBackground: '#ffffff',
    colorDanger: '#dc2626',
    borderRadius: '10px',
    fontFamily: 'Jost, system-ui, Arial, sans-serif',
  },
  rules: {
    '.Input': {
      border: '1px solid #E4E9F0',
    },
  },
};
