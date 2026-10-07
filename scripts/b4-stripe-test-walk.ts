/* eslint-disable no-console */
/**
 * B4 gate item 8: the Stripe TEST-mode walk (five cases, James-ruled).
 *
 * Runs the real B4 money services (refundBooking, releaseBookingFunds,
 * handleChargeRefunded, startDisputeResolution) against Stripe's test API and
 * a LOCAL database, then reads Stripe back to check every amount
 * independently of the ledger's own arithmetic.
 *
 *   1. one payout across an original and a top-up charge (split transfer)
 *   2. a partial refund before release (unreleased share scaled, then paid)
 *   3. a post-release refund with proportional reversals across both slices
 *   4. a dispute resolved as refund-customer (money confirmed before RESOLVED)
 *   5. a partial Stripe-dashboard refund after a split release (the real
 *      charge.refunded event fed to the handler twice: applied once)
 *
 * Usage (a fresh session whose network secret authenticates api.stripe.com):
 *   DATABASE_URL=postgresql://rena:rena@127.0.0.1:5432/rena_b4_walk \
 *   STRIPE_SECRET_KEY=sk_test_proxy_injected \
 *   [B4_WALK_CONNECT_ACCOUNT=acct_...] \
 *   npx tsx scripts/b4-stripe-test-walk.ts
 *
 * Safety (refuses before any money call):
 *   - DATABASE_URL must point at 127.0.0.1 or localhost (never production);
 *     use a dedicated, freshly migrated database (prisma migrate deploy);
 *   - a STRIPE_SECRET_KEY that looks live (sk_live_, rk_live_) is refused;
 *   - Stripe must answer balance.retrieve with livemode false.
 * Prints ids and amounts only: no names, emails, addresses or keys.
 */

const WALK_TAG = `b4walk_${Date.now().toString(36)}`;

function refuse(msg: string): never {
  console.error(`REFUSED: ${msg}`);
  process.exit(2);
}

function preflightEnv() {
  const db = process.env.DATABASE_URL;
  if (!db) refuse('DATABASE_URL is not set');
  const host = new URL(db).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    refuse(`DATABASE_URL host ${host} is not local; the walk runs only against a local database`);
  }
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key) refuse('STRIPE_SECRET_KEY must be set (a placeholder when the proxy injects auth)');
  if (/^(sk|rk)_live_/.test(key)) refuse('STRIPE_SECRET_KEY is a live key');
}

type Result = { name: string; ok: boolean; lines: string[] };
const results: Result[] = [];

function check(r: Result, cond: boolean, label: string, detail = '') {
  r.lines.push(`  ${cond ? 'ok ' : 'BAD'}  ${label}${detail ? ` (${detail})` : ''}`);
  if (!cond) r.ok = false;
}

async function main() {
  preflightEnv();

  const stripe = (await import('../src/lib/stripe')).default;
  // The session's network secret is injected by the egress proxy. The SDK's
  // NodeHttpClient builds its own https.Agent and ignores HTTPS_PROXY, so it
  // would reach Stripe directly with the placeholder key (401). Route this
  // script's client through the proxy; src/ is untouched.
  if (process.env.HTTPS_PROXY) {
    const { default: HttpsProxyAgent } = await import('https-proxy-agent');
    (stripe.getApiField('httpClient') as unknown as { _agent: unknown })._agent =
      new HttpsProxyAgent(process.env.HTTPS_PROXY);
  }
  const balance = await stripe.balance.retrieve().catch((err: { statusCode?: number }) => {
    refuse(`Stripe did not authenticate (status ${err?.statusCode ?? 'unknown'})`);
  });
  if (balance.livemode !== false) refuse('Stripe answered in live mode');
  console.log(`Stripe test mode confirmed (livemode false). Walk tag ${WALK_TAG}.`);

  const prisma = (await import('../src/lib/db/prisma')).default;
  const refund = await import('../src/lib/services/refund.service');
  const transfer = await import('../src/lib/services/transfer.service');
  const dispute = await import('../src/lib/services/dispute-resolution.service');

  // ─── Connected account ───────────────────────────────────────────────
  let acct = process.env.B4_WALK_CONNECT_ACCOUNT;
  if (!acct) {
    const a = await stripe.accounts.create({
      type: 'custom',
      country: 'GB',
      business_type: 'individual',
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_profile: { mcc: '7349', product_description: 'B4 walk test cleaner' },
      individual: {
        first_name: 'Walk',
        last_name: 'Tester',
        dob: { day: 1, month: 1, year: 1901 },
        address: {
          line1: 'address_full_match',
          city: 'London',
          postal_code: 'E4 7AA',
          country: 'GB',
        },
        email: `${WALK_TAG}@integration.invalid`,
        phone: '+447700900000',
      },
      external_account: {
        object: 'bank_account',
        country: 'GB',
        currency: 'gbp',
        account_number: '00012345',
        routing_number: '108800',
      } as never,
      tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
      metadata: { b4Walk: WALK_TAG },
    });
    acct = a.id;
  }
  let transfersActive = false;
  for (let i = 0; i < 30 && !transfersActive; i++) {
    const a = await stripe.accounts.retrieve(acct);
    transfersActive = a.capabilities?.transfers === 'active';
    if (!transfersActive) {
      if (i === 29) {
        refuse(
          `connected account ${acct} transfers capability not active; currently due: ${(
            a.requirements?.currently_due ?? []
          ).join(', ')}. Pass B4_WALK_CONNECT_ACCOUNT=<an onboarded test acct_>`
        );
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.log(`Connected account ${acct}: transfers active.`);

  // ─── Fixtures (synthetic, @integration.invalid) ──────────────────────
  const email = (role: string) => `${WALK_TAG}-${role}@integration.invalid`;
  const customer = await prisma.user.create({
    data: { email: email('customer'), name: 'Walk Customer', role: 'CLIENT' },
  });
  const admin = await prisma.user.create({
    data: { email: email('admin'), name: 'Walk Admin', role: 'ADMIN' },
  });
  const cleaner = await prisma.user.create({
    data: {
      email: email('cleaner'),
      name: 'Walk Cleaner',
      role: 'CLEANER',
      cleanerProfile: {
        create: {
          verified: true,
          hourlyRateRegular: 18,
          stripeAccountId: acct,
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
        },
      },
    },
  });

  async function charge(pence: number, label: string) {
    const pi = await stripe.paymentIntents.create({
      amount: pence,
      currency: 'gbp',
      payment_method: 'pm_card_visa',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { b4Walk: WALK_TAG, label },
    });
    if (pi.status !== 'succeeded') throw new Error(`charge ${label} not succeeded: ${pi.status}`);
    const ch = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
    return { pi: pi.id, charge: ch as string };
  }

  /** A completed, paid booking: the original charge plus optional top-up charges. */
  async function booking(opts: {
    originalPence: number;
    topupPence?: number;
    earningsPence: number;
    status?: string;
    transferStatus?: string;
  }) {
    const o = await charge(opts.originalPence, 'original');
    const t = opts.topupPence ? await charge(opts.topupPence, 'topup') : null;
    const charged = opts.originalPence + (opts.topupPence ?? 0);
    const b = await prisma.booking.create({
      data: {
        clientId: customer.id,
        cleanerId: cleaner.id,
        serviceType: 'regular',
        date: new Date(Date.now() + 5 * 864e5),
        startTime: '10:00',
        duration: 3,
        totalPrice: charged / 100,
        totalAmountCharged: charged / 100,
        platformFee: (charged - opts.earningsPence) / 100,
        cleanerEarnings: opts.earningsPence / 100,
        status: (opts.status ?? 'COMPLETED') as never,
        paymentStatus: 'SUCCEEDED',
        transferStatus: (opts.transferStatus ?? 'PENDING') as never,
        stripePaymentIntentId: o.pi,
        stripeChargeId: o.charge,
        completedAt: new Date(),
        releaseDueAt: new Date(Date.now() - 60_000),
        addressPostcode: 'E4 7AA',
        addressCity: 'London',
      },
    });
    if (t) {
      await prisma.topupRecord.create({
        data: {
          bookingId: b.id,
          stripePaymentIntentId: t.pi,
          stripeChargeId: t.charge,
          amount: (opts.topupPence as number) / 100,
          reason: 'B4 walk top-up',
          status: 'SUCCEEDED',
        },
      });
    }
    return { id: b.id, original: o, topup: t, charged };
  }

  /** Every transfer slice of a booking, read back from Stripe. */
  async function transfersOf(bookingId: string) {
    const slices = await prisma.transferSlice.findMany({ where: { bookingId } });
    return Promise.all(
      slices
        .filter((s) => s.stripeTransferId)
        .map(async (s) => ({
          slice: s,
          t: await stripe.transfers.retrieve(s.stripeTransferId as string),
        }))
    );
  }

  async function reversedPence(bookingId: string) {
    const ts = await transfersOf(bookingId);
    let total = 0;
    for (const { t } of ts) {
      const revs = await stripe.transfers.listReversals(t.id, { limit: 100 });
      total += revs.data.reduce((s, r) => s + r.amount, 0);
    }
    return total;
  }

  async function unresolvedSlices(bookingId: string) {
    return prisma.refundSlice.count({
      where: {
        record: { bookingId },
        status: { in: ['PENDING', 'UNKNOWN', 'NEEDS_RECONCILE'] },
      },
    });
  }

  const share = (earnings: number, refundPence: number, basis: number) =>
    Math.round((earnings * refundPence) / basis);

  // ─── Case 1: payout across the original and a top-up ─────────────────
  const c1: Result = { name: '1. payout across original and top-up', ok: true, lines: [] };
  const a = await booking({ originalPence: 4000, topupPence: 2500, earningsPence: 5400 });
  const rel = await transfer.releaseBookingFunds(a.id, { trigger: 'ADMIN', actorId: admin.id });
  check(c1, rel.status === 'RELEASED', 'release RELEASED', rel.status);
  const ta = await transfersOf(a.id);
  check(c1, ta.length >= 2, 'one transfer per charge', `${ta.length} transfers`);
  check(
    c1,
    ta.reduce((s, x) => s + x.t.amount, 0) === 5400,
    'transfers sum to the cleaner earnings',
    `${ta.reduce((s, x) => s + x.t.amount, 0)} of 5400`
  );
  for (const { slice, t } of ta) {
    const src =
      typeof t.source_transaction === 'string' ? t.source_transaction : t.source_transaction?.id;
    check(
      c1,
      t.amount === slice.amountPence,
      `slice ${slice.id} amount equals Stripe`,
      `${t.amount}`
    );
    check(c1, t.destination === acct, `transfer ${t.id} to the cleaner account`);
    check(c1, t.transfer_group === a.id, `transfer ${t.id} grouped by booking`);
    if (src) {
      check(
        c1,
        src === a.original.charge || src === a.topup?.charge,
        `transfer ${t.id} anchored to one of the booking's charges`
      );
    }
  }
  results.push(c1);

  // ─── Case 2: partial refund before release ───────────────────────────
  const c2: Result = { name: '2. partial refund before release', ok: true, lines: [] };
  const b = await booking({ originalPence: 6000, earningsPence: 5400 });
  const r2 = await refund.refundBooking(b.id, 15, 'B4 walk partial', { triggeredBy: admin.id });
  check(c2, r2.status === 'PARTIALLY_REFUNDED', 'refund PARTIALLY_REFUNDED', r2.status);
  const rf2 = await stripe.refunds.list({ payment_intent: b.original.pi, limit: 10 });
  check(
    c2,
    rf2.data.length === 1 && rf2.data[0].amount === 1500 && rf2.data[0].status === 'succeeded',
    'Stripe holds exactly one 1500 refund, succeeded',
    rf2.data.map((r) => `${r.id}:${r.amount}:${r.status}`).join(' ')
  );
  const b2 = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
  const scaled = 5400 - share(5400, 1500, 6000);
  check(
    c2,
    Math.round(Number(b2.cleanerEarnings) * 100) === scaled,
    'unreleased cleaner amount scaled by the cleaner share',
    `${Math.round(Number(b2.cleanerEarnings) * 100)} expected ${scaled}`
  );
  const rel2 = await transfer.releaseBookingFunds(b.id, { trigger: 'ADMIN', actorId: admin.id });
  const tb = await transfersOf(b.id);
  check(
    c2,
    rel2.status === 'RELEASED' && tb.reduce((s, x) => s + x.t.amount, 0) === scaled,
    'release pays the scaled amount',
    `${tb.reduce((s, x) => s + x.t.amount, 0)}`
  );
  results.push(c2);

  // ─── Case 3: post-release refund with reversals ──────────────────────
  const c3: Result = { name: '3. post-release refund with reversals', ok: true, lines: [] };
  const r3 = await refund.refundBooking(a.id, 20, 'B4 walk post-release', {
    triggeredBy: admin.id,
  });
  check(c3, r3.status === 'PARTIALLY_REFUNDED', 'refund PARTIALLY_REFUNDED', r3.status);
  const onTopup = await stripe.refunds.list({ payment_intent: a.topup?.pi, limit: 10 });
  check(
    c3,
    onTopup.data.reduce((s, r) => s + r.amount, 0) === 2000,
    'LIFO: the 2000 refund landed on the top-up charge',
    `${onTopup.data.reduce((s, r) => s + r.amount, 0)}`
  );
  const want3 = share(5400, 2000, 6500);
  const rev3 = await reversedPence(a.id);
  check(c3, rev3 === want3, 'reversals equal the cleaner share', `${rev3} expected ${want3}`);
  const ta3 = await transfersOf(a.id);
  check(
    c3,
    ta3.filter((x) => x.t.amount_reversed > 0).length >= 2,
    'the reversal is spread across both transfer slices'
  );
  check(c3, (await unresolvedSlices(a.id)) === 0, 'no refund slice unresolved');
  results.push(c3);

  // ─── Case 4: dispute refund ──────────────────────────────────────────
  const c4: Result = { name: '4. dispute resolved as refund-customer', ok: true, lines: [] };
  const d = await booking({
    originalPence: 6000,
    earningsPence: 5400,
    status: 'DISPUTED',
    transferStatus: 'PAUSED',
  });
  const dRow = await prisma.dispute.create({
    data: {
      bookingId: d.id,
      raisedById: customer.id,
      reason: 'QUALITY',
      description: 'B4 walk dispute',
      status: 'UNDER_REVIEW',
    },
  });
  const r4 = await dispute.startDisputeResolution({
    disputeId: dRow.id,
    outcome: 'refund-customer',
    resolution: 'B4 walk refund',
    adminId: admin.id,
  });
  const d4 = await prisma.dispute.findUniqueOrThrow({ where: { id: dRow.id } });
  check(
    c4,
    d4.status === 'RESOLVED',
    'dispute RESOLVED',
    `${d4.status} ${r4.lastMoneyError ?? ''}`
  );
  const rf4 = await stripe.refunds.list({ payment_intent: d.original.pi, limit: 10 });
  check(
    c4,
    rf4.data.reduce((s, r) => s + (r.status === 'succeeded' ? r.amount : 0), 0) === 6000,
    'Stripe refunded the whole charge',
    rf4.data.map((r) => `${r.amount}:${r.status}`).join(' ')
  );
  const bk4 = await prisma.booking.findUniqueOrThrow({ where: { id: d.id } });
  check(c4, bk4.paymentStatus === 'REFUNDED', 'booking REFUNDED', bk4.paymentStatus);
  check(c4, (await transfersOf(d.id)).length === 0, 'no payout to the cleaner');
  results.push(c4);

  // ─── Case 5: partial dashboard refund after a split release ──────────
  const c5: Result = {
    name: '5. partial Stripe-dashboard refund after release',
    ok: true,
    lines: [],
  };
  const e = await booking({ originalPence: 4000, topupPence: 2500, earningsPence: 5400 });
  await transfer.releaseBookingFunds(e.id, { trigger: 'ADMIN', actorId: admin.id });
  const since = Math.floor(Date.now() / 1000) - 5;
  // A dashboard refund carries no Rena metadata: create it the same way.
  const dash = await stripe.refunds.create({ charge: e.original.charge, amount: 1625 });
  check(c5, dash.status === 'succeeded', 'dashboard-style refund succeeded', dash.status ?? '');
  let evtObject: unknown = null;
  for (let i = 0; i < 20 && !evtObject; i++) {
    const evs = await stripe.events.list({
      type: 'charge.refunded',
      created: { gte: since },
      limit: 20,
    });
    const hit = evs.data.find((x) => (x.data.object as { id: string }).id === e.original.charge);
    evtObject = hit ? hit.data.object : null;
    if (!evtObject) await new Promise((r) => setTimeout(r, 1500));
  }
  check(c5, !!evtObject, 'the real charge.refunded event was read from Stripe');
  const chargeObj = (evtObject ?? (await stripe.charges.retrieve(e.original.charge))) as Parameters<
    typeof refund.handleChargeRefunded
  >[0];
  await refund.handleChargeRefunded(chargeObj);
  await refund.handleChargeRefunded(chargeObj); // the duplicate delivery
  const recs = await prisma.refundRecord.findMany({
    where: { bookingId: e.id, triggeredBy: 'STRIPE_DASHBOARD' },
  });
  check(c5, recs.length === 1, 'one dashboard record (duplicate ignored)', `${recs.length}`);
  check(c5, !!recs[0]?.finalizedAt, 'the dashboard refund is applied to the cleaner side');
  const want5 = share(5400, 1625, 6500);
  const rev5 = await reversedPence(e.id);
  check(c5, rev5 === want5, 'reversals equal the cleaner share, once', `${rev5} expected ${want5}`);
  const bk5 = await prisma.booking.findUniqueOrThrow({ where: { id: e.id } });
  check(
    c5,
    bk5.paymentStatus === 'PARTIALLY_REFUNDED',
    'booking PARTIALLY_REFUNDED',
    bk5.paymentStatus
  );
  results.push(c5);

  // ─── Report ──────────────────────────────────────────────────────────
  console.log('');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
    for (const l of r.lines) console.log(l);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    `\nB4 Stripe test-mode walk: ${results.length - failed} of ${results.length} cases pass.`
  );
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('WALK ABORTED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
