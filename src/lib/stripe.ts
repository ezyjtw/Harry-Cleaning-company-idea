import Stripe from 'stripe';

import { attachStripeMetering } from '@/lib/api-metering';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-05-27.dahlia',
});

// R9 (HQ API room): count every SDK call via the 'response' event — no
// call-site changes, and metering can never touch a money path (the listener
// only logs, fail-silent by law).
attachStripeMetering(stripe);

export default stripe;
