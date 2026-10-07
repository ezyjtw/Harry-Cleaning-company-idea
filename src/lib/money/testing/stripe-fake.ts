// B4.11 (RENA-016): a scripted Stripe fake at the SDK boundary, for the money
// ledger tests (vi.mock('@/lib/stripe')). Test-only; never imported by app
// code. It keeps an in-memory Stripe: payment intents, refunds, transfers and
// reversals, honours idempotency keys (the same key returns the original
// object, as Stripe does), and records every call with its key.
//
// Each method takes a script of outcomes, consumed one per call, default ok:
//   'ok'              the call succeeds
//   'definitive'      a card or invalid-request error (nothing happened)
//   'connection'      a connection error before Stripe received the call
//   'lost'            Stripe executed the call, the response was lost
//                     (a connection error after landing: the unknown outcome)

export type Outcome = 'ok' | 'definitive' | 'connection' | 'lost';

type Method =
  | 'refunds.create'
  | 'transfers.create'
  | 'transfers.createReversal'
  | 'paymentIntents.create'
  | 'paymentIntents.cancel'
  | 'reads';

interface FakeRefund {
  id: string;
  object: 'refund';
  amount: number;
  payment_intent: string;
  charge: string | null;
  status: string;
  metadata: Record<string, string>;
  created: number;
}

interface FakeTransfer {
  id: string;
  object: 'transfer';
  amount: number;
  amount_reversed: number;
  destination: string;
  source_transaction: string | null;
  transfer_group: string | null;
  metadata: Record<string, string>;
  created: number;
}

interface FakeReversal {
  id: string;
  object: 'transfer_reversal';
  amount: number;
  transfer: string;
  metadata: Record<string, string>;
}

interface FakePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  amount_received: number;
  currency: string;
  status: string;
  customer: string | null;
  payment_method: string | null;
  latest_charge: string | null;
  last_payment_error: { message: string } | null;
  metadata: Record<string, string>;
  created: number;
}

export interface Call {
  method: string;
  key?: string;
  params?: unknown;
  outcome: Outcome;
}

function connectionError(): Error {
  const e = new Error('Fake: connection to Stripe failed') as Error & { type: string };
  e.type = 'StripeConnectionError';
  return e;
}

function definitiveError(message = 'Fake: request refused'): Error {
  const e = new Error(message) as Error & { type: string; code: string };
  e.type = 'StripeInvalidRequestError';
  e.code = 'resource_missing';
  return e;
}

export class StripeFake {
  calls: Call[] = [];
  private scripts = new Map<Method, Outcome[]>();
  private seq = 0;
  private byKey = new Map<string, unknown>();
  paymentIntentsById = new Map<string, FakePaymentIntent>();
  refundsById = new Map<string, FakeRefund>();
  transfersById = new Map<string, FakeTransfer>();
  reversalsById = new Map<string, FakeReversal>();
  /** Refund status written on create (ok); 'pending' leaves slices PENDING. */
  refundStatusOnCreate = 'succeeded';

  reset(): void {
    this.calls = [];
    this.scripts.clear();
    this.byKey.clear();
    this.paymentIntentsById.clear();
    this.refundsById.clear();
    this.transfersById.clear();
    this.reversalsById.clear();
    this.refundStatusOnCreate = 'succeeded';
  }

  script(method: Method, ...outcomes: Outcome[]): void {
    this.scripts.set(method, [...(this.scripts.get(method) ?? []), ...outcomes]);
  }

  private next(method: Method): Outcome {
    const q = this.scripts.get(method);
    return q && q.length ? (q.shift() as Outcome) : 'ok';
  }

  private id(prefix: string): string {
    this.seq += 1;
    return `${prefix}_fake${this.seq.toString().padStart(5, '0')}`;
  }

  /** Run a mutating call through its scripted outcome and its idempotency key. */
  private mutate<T>(method: Method, key: string | undefined, params: unknown, exec: () => T): T {
    const outcome = this.next(method);
    this.calls.push({ method, key, params, outcome });
    if (outcome === 'connection') throw connectionError();
    if (outcome === 'definitive') throw definitiveError();
    if (key && this.byKey.has(key)) {
      const prior = this.byKey.get(key) as T;
      if (outcome === 'lost') throw connectionError();
      return prior;
    }
    const result = exec();
    if (key) this.byKey.set(key, result);
    if (outcome === 'lost') throw connectionError();
    return result;
  }

  private read<T>(method: string, exec: () => T): T {
    const outcome = this.next('reads');
    this.calls.push({ method, outcome });
    if (outcome === 'connection' || outcome === 'lost') throw connectionError();
    if (outcome === 'definitive') throw definitiveError();
    return exec();
  }

  // ─── Fixture helpers ────────────────────────────────────────

  addPaymentIntent(pi: Partial<FakePaymentIntent> & { id: string; amount: number }): void {
    this.paymentIntentsById.set(pi.id, {
      object: 'payment_intent',
      amount_received: pi.status === 'succeeded' || !pi.status ? pi.amount : 0,
      currency: 'gbp',
      status: 'succeeded',
      customer: null,
      payment_method: null,
      latest_charge: null,
      last_payment_error: null,
      metadata: {},
      created: Math.floor(Date.now() / 1000),
      ...pi,
    });
  }

  /** A refund made outside the platform (the Stripe dashboard). */
  addDashboardRefund(pi: string, charge: string, amount: number): FakeRefund {
    const r: FakeRefund = {
      id: this.id('re'),
      object: 'refund',
      amount,
      payment_intent: pi,
      charge,
      status: 'succeeded',
      metadata: {},
      created: Math.floor(Date.now() / 1000),
    };
    this.refundsById.set(r.id, r);
    return r;
  }

  refundsFor(pi: string): FakeRefund[] {
    return Array.from(this.refundsById.values()).filter((r) => r.payment_intent === pi);
  }

  /** A charge.refunded event payload for one charge. */
  chargeRefundedEvent(chargeId: string, pi: string, amount: number) {
    const refunds = Array.from(this.refundsById.values()).filter(
      (r) => r.charge === chargeId || (r.charge === null && r.payment_intent === pi)
    );
    return {
      id: chargeId,
      payment_intent: pi,
      amount,
      amount_refunded: refunds.reduce((s, r) => s + r.amount, 0),
      refunds: { data: refunds },
    };
  }

  callsTo(method: string): Call[] {
    return this.calls.filter((c) => c.method === method);
  }

  // ─── The SDK surface the money code uses ────────────────────

  refunds = {
    create: async (
      params: {
        payment_intent: string;
        amount: number;
        metadata?: Record<string, string>;
      },
      opts?: { idempotencyKey?: string }
    ) =>
      this.mutate('refunds.create', opts?.idempotencyKey, params, () => {
        const pi = this.paymentIntentsById.get(params.payment_intent);
        const r: FakeRefund = {
          id: this.id('re'),
          object: 'refund',
          amount: params.amount,
          payment_intent: params.payment_intent,
          charge: pi?.latest_charge ?? null,
          status: this.refundStatusOnCreate,
          metadata: { ...(params.metadata ?? {}) },
          created: Math.floor(Date.now() / 1000),
        };
        this.refundsById.set(r.id, r);
        return r;
      }),
    retrieve: async (id: string) =>
      this.read('refunds.retrieve', () => {
        const r = this.refundsById.get(id);
        if (!r) throw definitiveError('No such refund');
        return r;
      }),
    list: async (params: { payment_intent?: string; charge?: string }) =>
      this.read('refunds.list', () => ({
        data: params.payment_intent
          ? this.refundsFor(params.payment_intent)
          : Array.from(this.refundsById.values()).filter((r) => r.charge === params.charge),
      })),
  };

  transfers = {
    create: async (
      params: {
        amount: number;
        destination: string;
        source_transaction?: string;
        transfer_group?: string;
        metadata?: Record<string, string>;
      },
      opts?: { idempotencyKey?: string }
    ) =>
      this.mutate('transfers.create', opts?.idempotencyKey, params, () => {
        const t: FakeTransfer = {
          id: this.id('tr'),
          object: 'transfer',
          amount: params.amount,
          amount_reversed: 0,
          destination: params.destination,
          source_transaction: params.source_transaction ?? null,
          transfer_group: params.transfer_group ?? null,
          metadata: { ...(params.metadata ?? {}) },
          created: Math.floor(Date.now() / 1000),
        };
        this.transfersById.set(t.id, t);
        return t;
      }),
    list: async (params: { transfer_group: string }) =>
      this.read('transfers.list', () => ({
        data: Array.from(this.transfersById.values()).filter(
          (t) => t.transfer_group === params.transfer_group
        ),
      })),
    retrieve: async (id: string) =>
      this.read('transfers.retrieve', () => {
        const t = this.transfersById.get(id);
        if (!t) throw definitiveError('No such transfer');
        return t;
      }),
    createReversal: async (
      transferId: string,
      params: { amount: number; metadata?: Record<string, string> },
      opts?: { idempotencyKey?: string }
    ) =>
      this.mutate('transfers.createReversal', opts?.idempotencyKey, params, () => {
        const t = this.transfersById.get(transferId);
        if (!t) throw definitiveError('No such transfer');
        if (t.amount_reversed + params.amount > t.amount) {
          throw definitiveError('Reversal exceeds the transfer');
        }
        t.amount_reversed += params.amount;
        const v: FakeReversal = {
          id: this.id('trr'),
          object: 'transfer_reversal',
          amount: params.amount,
          transfer: transferId,
          metadata: { ...(params.metadata ?? {}) },
        };
        this.reversalsById.set(v.id, v);
        return v;
      }),
    listReversals: async (transferId: string) =>
      this.read('transfers.listReversals', () => ({
        data: Array.from(this.reversalsById.values()).filter((v) => v.transfer === transferId),
      })),
  };

  paymentIntents = {
    retrieve: async (id: string) =>
      this.read('paymentIntents.retrieve', () => {
        const pi = this.paymentIntentsById.get(id);
        if (!pi) throw definitiveError('No such payment intent');
        return pi;
      }),
    cancel: async (id: string) =>
      this.mutate('paymentIntents.cancel', undefined, { id }, () => {
        const pi = this.paymentIntentsById.get(id);
        if (!pi) throw definitiveError('No such payment intent');
        if (pi.status === 'succeeded') {
          throw definitiveError('This PaymentIntent has already succeeded');
        }
        pi.status = 'canceled';
        return pi;
      }),
    create: async (
      params: {
        amount: number;
        customer?: string;
        payment_method?: string;
        metadata?: Record<string, string>;
      },
      opts?: { idempotencyKey?: string }
    ) =>
      this.mutate('paymentIntents.create', opts?.idempotencyKey, params, () => {
        const id = this.id('pi');
        const charge = this.id('ch');
        const pi: FakePaymentIntent = {
          id,
          object: 'payment_intent',
          amount: params.amount,
          amount_received: params.amount,
          currency: 'gbp',
          status: 'succeeded',
          customer: params.customer ?? null,
          payment_method: params.payment_method ?? null,
          latest_charge: charge,
          last_payment_error: null,
          metadata: { ...(params.metadata ?? {}) },
          created: Math.floor(Date.now() / 1000),
        };
        this.paymentIntentsById.set(id, pi);
        return pi;
      }),
    list: async (params: { customer?: string }) =>
      this.read('paymentIntents.list', () => ({
        data: Array.from(this.paymentIntentsById.values()).filter(
          (p) => !params.customer || p.customer === params.customer
        ),
      })),
  };

  paymentMethods = {
    retrieve: async (id: string) =>
      this.read('paymentMethods.retrieve', () => ({ id, customer: this.methodCustomer.get(id) })),
  };

  /** Saved card owners, for the recurring charge's reusable-card check. */
  methodCustomer = new Map<string, string>();
}

/** The one fake a test file shares with its vi.mock('@/lib/stripe') factory. */
export const sharedFake = new StripeFake();
