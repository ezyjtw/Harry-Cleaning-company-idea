/**
 * Stripe Payment Service
 *
 * Handles creating payment intents and verifying webhooks via Stripe's REST API.
 * Docs: https://docs.stripe.com
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY  — your Stripe secret API key
 *   STRIPE_WEBHOOK_SECRET — webhook signing secret
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — client-side publishable key
 */

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export interface StripePaymentSession {
  id: string;
  status:
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'succeeded'
    | 'canceled';
  amount: number;
  currency: string;
  clientSecret: string;
  returnUrl?: string;
}

export interface CreatePaymentParams {
  amount: number; // in pounds (e.g. 85.50)
  bookingId: string;
  customerEmail: string;
  customerName: string;
  description?: string;
  returnUrl: string;
}

/**
 * Create a Stripe PaymentIntent.
 * Amount is converted from pounds to pence for the API.
 */
export async function createPaymentSession(
  params: CreatePaymentParams
): Promise<StripePaymentSession> {
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('STRIPE_SECRET_KEY is required in production');
    }
    // eslint-disable-next-line no-console
    console.warn('[Stripe] No STRIPE_SECRET_KEY set — returning mock payment session (dev only)');
    return {
      id: `pi_mock_${Date.now()}`,
      status: 'requires_payment_method',
      amount: Math.round(params.amount * 100),
      currency: 'gbp',
      clientSecret: `pi_mock_${Date.now()}_secret_mock`,
      returnUrl: params.returnUrl,
    };
  }

  const body = new URLSearchParams({
    amount: String(Math.round(params.amount * 100)),
    currency: 'gbp',
    'automatic_payment_methods[enabled]': 'true',
    receipt_email: params.customerEmail,
    'metadata[bookingId]': params.bookingId,
    'metadata[customerName]': params.customerName,
    return_url: params.returnUrl,
  });

  if (params.description) {
    body.append('description', params.description);
  }

  const res = await fetch(`${STRIPE_API_BASE}/payment_intents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${apiKey}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    // eslint-disable-next-line no-console
    console.error('[Stripe] PaymentIntent creation failed:', res.status, errorBody);
    throw new Error(`Stripe API error: ${res.status}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    status: data.status,
    amount: data.amount,
    currency: data.currency,
    clientSecret: data.client_secret,
    returnUrl: params.returnUrl,
  };
}

/**
 * Retrieve a PaymentIntent by ID.
 */
export async function getPaymentSession(sessionId: string): Promise<StripePaymentSession | null> {
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('STRIPE_SECRET_KEY is required in production');
    }
    return {
      id: sessionId,
      status: sessionId.startsWith('pi_mock_') ? 'succeeded' : 'requires_payment_method',
      amount: 0,
      currency: 'gbp',
      clientSecret: '',
    };
  }

  const res = await fetch(`${STRIPE_API_BASE}/payment_intents/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return {
    id: data.id,
    status: data.status,
    amount: data.amount,
    currency: data.currency,
    clientSecret: data.client_secret,
  };
}

/**
 * Verify a Stripe webhook signature.
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return false;

  try {
    // Stripe uses HMAC-SHA256 with a timestamp scheme:
    // Signature header: t=<timestamp>,v1=<sig>
    const parts = signature.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='));
    const sigPart = parts.find((p) => p.startsWith('v1='));
    if (!timestampPart || !sigPart) return false;

    const timestamp = timestampPart.replace('t=', '');
    const expectedSig = sigPart.replace('v1=', '');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    const signedPayload = `${timestamp}.${payload}`;
    const computed = nodeCrypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

    return nodeCrypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(computed));
  } catch {
    return false;
  }
}
