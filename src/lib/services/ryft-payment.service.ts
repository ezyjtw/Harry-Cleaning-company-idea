/**
 * Ryft Payment Service
 *
 * Handles creating payment sessions and verifying webhooks via Ryft's REST API.
 * Docs: https://docs.ryftpay.com
 *
 * Environment variables required:
 *   RYFT_SECRET_KEY  — your Ryft secret API key
 *   RYFT_WEBHOOK_SECRET — webhook signing secret
 *   NEXT_PUBLIC_RYFT_PUBLIC_KEY — client-side publishable key (used in Drop-in UI)
 */

const RYFT_API_BASE = 'https://api.ryftpay.com/v1';

export interface RyftPaymentSession {
  id: string;
  status: 'PendingPayment' | 'PendingAction' | 'Approved' | 'Captured' | 'Refunded' | 'Failed';
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
 * Create a Ryft payment session.
 * Amount is converted from pounds to pence for the API.
 */
export async function createPaymentSession(
  params: CreatePaymentParams
): Promise<RyftPaymentSession> {
  const apiKey = process.env.RYFT_SECRET_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RYFT_SECRET_KEY is required in production');
    }
    // Dev mode — return a fake session so the flow works without real keys
    // eslint-disable-next-line no-console
    console.warn('[Ryft] No RYFT_SECRET_KEY set — returning mock payment session (dev only)');
    return {
      id: `ps_mock_${Date.now()}`,
      status: 'PendingPayment',
      amount: Math.round(params.amount * 100),
      currency: 'GBP',
      clientSecret: `cs_mock_${Date.now()}`,
      returnUrl: params.returnUrl,
    };
  }

  const res = await fetch(`${RYFT_API_BASE}/payment-sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
    },
    body: JSON.stringify({
      amount: Math.round(params.amount * 100), // pence
      currency: 'GBP',
      customerEmail: params.customerEmail,
      metadata: {
        bookingId: params.bookingId,
        customerName: params.customerName,
      },
      returnUrl: params.returnUrl,
      ...(params.description ? { description: params.description } : {}),
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    // eslint-disable-next-line no-console
    console.error('[Ryft] Payment session creation failed:', res.status, errorBody);
    throw new Error(`Ryft API error: ${res.status}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    status: data.status,
    amount: data.amount,
    currency: data.currency,
    clientSecret: data.clientSecret,
    returnUrl: data.returnUrl,
  };
}

/**
 * Retrieve a payment session by ID.
 */
export async function getPaymentSession(sessionId: string): Promise<RyftPaymentSession | null> {
  const apiKey = process.env.RYFT_SECRET_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RYFT_SECRET_KEY is required in production');
    }
    return {
      id: sessionId,
      status: sessionId.startsWith('ps_mock_') ? 'Captured' : 'PendingPayment',
      amount: 0,
      currency: 'GBP',
      clientSecret: '',
    };
  }

  const res = await fetch(`${RYFT_API_BASE}/payment-sessions/${sessionId}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
    },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return {
    id: data.id,
    status: data.status,
    amount: data.amount,
    currency: data.currency,
    clientSecret: data.clientSecret,
  };
}

/**
 * Verify a Ryft webhook signature.
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.RYFT_WEBHOOK_SECRET;
  if (!secret) return false;

  try {
    // Ryft uses HMAC-SHA256
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto');
    const expected = nodeCrypto.createHmac('sha256', secret).update(payload).digest('hex');
    return nodeCrypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
