import { loadStripe, type Appearance } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

export default stripePromise;

// Single Stripe Elements appearance (B8, upgraded in the polish batch) — one
// source, passed at every Elements provider so the PaymentElement matches the
// site. stripeFonts loads REAL Jost inside Stripe's iframe (the iframe can't
// see our next/font CSS, but Elements accepts an external cssSrc it fetches
// itself); clients that block it degrade to the same web-safe fallbacks as
// before.
export const stripeFonts = [
  { cssSrc: 'https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500&display=swap' },
];
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
    '.Input:focus': {
      border: '1px solid #16296b',
      boxShadow: '0 0 0 1px #16296b',
    },
    '.Tab--selected': {
      border: '1px solid #16296b',
      boxShadow: 'none',
    },
    '.Label': {
      color: '#3D5170',
      fontWeight: '400',
    },
  },
};
