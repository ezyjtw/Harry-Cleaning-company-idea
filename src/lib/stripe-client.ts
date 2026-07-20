import { loadStripe, type Appearance } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

export default stripePromise;

// Single Stripe Elements appearance (B8, upgraded in the polish batch) — one
// source, passed at every Elements provider so the PaymentElement matches the
// site. stripeFonts loads REAL Jost inside Stripe's iframe (the iframe can't
// see our next/font CSS).
//
// H84: the old cssSrc pointed at fonts.googleapis.com — stripe-js FETCHES the
// cssSrc from the parent page at runtime, which our connect-src rightly
// blocks (the CSP was doing its job; we don't widen it). Self-hosted instead:
// one Jost VARIABLE woff2 in public/fonts serves all three weights, fetched
// by the iframe itself (CORS-enabled for /fonts in next.config). Degrades to
// the same web-safe fallbacks if blocked.
// Absolute URL — the iframe resolves relative srcs against js.stripe.com.
const JOST_SRC = `url(${process.env.NEXT_PUBLIC_APP_URL ?? ''}/fonts/jost-latin-var.woff2)`;
export const stripeFonts = [
  { family: 'Jost', src: JOST_SRC, weight: '300' },
  { family: 'Jost', src: JOST_SRC, weight: '400' },
  { family: 'Jost', src: JOST_SRC, weight: '500' },
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
