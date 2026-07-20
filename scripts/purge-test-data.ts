/* eslint-disable no-console */
// Block 5 (James-ruled): pre-launch purge. EVERYTHING dies except the
// support@renacleaning.co.uk User and its admin essentials — audit rows
// INCLUDED — so launch starts with a clean ledger.
//
// Usage:
//   npx tsx scripts/purge-test-data.ts             # dry-run (default): counts
//                                                  # manifest + R2 inventory,
//                                                  # writes NOTHING
//   npx tsx scripts/purge-test-data.ts --execute   # the real purge
//
// Safety:
//   • HARD-REFUSES to run (either mode) when STRIPE_SECRET_KEY is a LIVE key
//     (sk_live_/rk_live_) — the same guard pattern as the Xero test-push flag.
//     This purge must never be runnable after launch.
//   • --execute deletes DB rows first (FK-ordered, one transaction), THEN the
//     R2 objects — an R2 outage can never leave the DB half-purged. Any R2
//     object it can't delete is reported, never silently skipped.
//   • Kept rows: the support@ User, its NotificationPreference and Account
//     rows, and the four deploy-seeded reference tables (ServiceType,
//     FixedServicePrice, ServiceAddon, PlatformConfig) — the app refuses to
//     boot without them and they are re-synced on every deploy anyway.

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const KEEP_USER_EMAIL = 'support@renacleaning.co.uk';

const execute = process.argv.includes('--execute');

// ─── Guard: never against a live-Stripe environment ─────────────────────────

function stripeIsLive(): boolean {
  return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? '');
}

// ─── Table registry ─────────────────────────────────────────────────────────
// EVERY model in schema.prisma appears exactly once below, either in
// PURGE_ORDER (children before parents — the delete runs top to bottom) or in
// KEPT_TABLES. A model added to the schema later will show up in the drift
// check and abort the run until it is classified here.

type TableSpec = {
  model: string; // Prisma model name (drift check against DMMF)
  delegate: string; // prisma.<delegate>
  // Optional where for partial purges (support@-owned rows survive).
  where?: () => Promise<object> | object;
  note?: string; // shown in the manifest
};

let keepUserId: string | null = null;

const PURGE_ORDER: TableSpec[] = [
  // Evidence before their parents
  { model: 'ComplaintEvidence', delegate: 'complaintEvidence' },
  { model: 'DisputeEvidence', delegate: 'disputeEvidence' },
  { model: 'Complaint', delegate: 'complaint' },
  { model: 'Dispute', delegate: 'dispute' },
  // Message tree
  { model: 'MessageReport', delegate: 'messageReport' },
  { model: 'Message', delegate: 'message' },
  // Reviews (written + imported)
  { model: 'Review', delegate: 'review' },
  { model: 'ImportedReview', delegate: 'importedReview' },
  // Money records hanging off bookings
  { model: 'RefundRecord', delegate: 'refundRecord' },
  { model: 'TopupRecord', delegate: 'topupRecord' },
  { model: 'Payment', delegate: 'payment' },
  // Booking satellites
  { model: 'BookingAddon', delegate: 'bookingAddon' },
  { model: 'BookingCleanerQueue', delegate: 'bookingCleanerQueue' },
  { model: 'StuckJobCase', delegate: 'stuckJobCase' },
  { model: 'Booking', delegate: 'booking' },
  { model: 'PromoCode', delegate: 'promoCode' },
  // Cleaner-profile satellites
  { model: 'AvailabilitySlot', delegate: 'availabilitySlot' },
  { model: 'AvailabilityOverride', delegate: 'availabilityOverride' },
  { model: 'AvailabilityDateSlot', delegate: 'availabilityDateSlot' },
  { model: 'RateModifier', delegate: 'rateModifier' },
  { model: 'CleanerProfile', delegate: 'cleanerProfile' },
  // User satellites
  { model: 'Address', delegate: 'address' },
  { model: 'Notification', delegate: 'notification' },
  {
    model: 'NotificationPreference',
    delegate: 'notificationPreference',
    where: () => ({ userId: { not: keepUserId ?? '' } }),
    note: `support@ row kept`,
  },
  { model: 'PushSubscription', delegate: 'pushSubscription' },
  { model: 'DeviceToken', delegate: 'deviceToken' },
  { model: 'UserBlock', delegate: 'userBlock' },
  { model: 'DocumentUpload', delegate: 'documentUpload' },
  { model: 'GdprConsent', delegate: 'gdprConsent' },
  { model: 'AgreementAcceptance', delegate: 'agreementAcceptance' },
  { model: 'DataRetentionLog', delegate: 'dataRetentionLog' },
  { model: 'DataDeletionRequest', delegate: 'dataDeletionRequest' },
  // Org structures
  { model: 'TeamMember', delegate: 'teamMember' },
  { model: 'Company', delegate: 'company' },
  { model: 'Provider', delegate: 'provider' },
  // Auth
  {
    model: 'Account',
    delegate: 'account',
    where: () => ({ userId: { not: keepUserId ?? '' } }),
    note: `support@ rows kept`,
  },
  { model: 'Session', delegate: 'session' },
  { model: 'VerificationToken', delegate: 'verificationToken' },
  // Users last among the FK families
  {
    model: 'User',
    delegate: 'user',
    where: () => ({ email: { not: KEEP_USER_EMAIL } }),
    note: `${KEEP_USER_EMAIL} kept`,
  },
  // Standalone ledgers and logs — audit rows die too (James-ruled)
  { model: 'AuditLog', delegate: 'auditLog' },
  { model: 'BackgroundJob', delegate: 'backgroundJob' },
  { model: 'Lead', delegate: 'lead' },
  { model: 'WaitlistEntry', delegate: 'waitlistEntry' },
  { model: 'AbandonedLead', delegate: 'abandonedLead' },
  { model: 'AnalyticsEvent', delegate: 'analyticsEvent' },
  { model: 'StripeWebhookEvent', delegate: 'stripeWebhookEvent' },
  { model: 'XeroPushLog', delegate: 'xeroPushLog' },
  { model: 'XeroConnection', delegate: 'xeroConnection' },
  { model: 'PricingRule', delegate: 'pricingRule' },
  { model: 'PricingZone', delegate: 'pricingZone' },
  {
    model: 'DpaAgreement',
    delegate: 'dpaAgreement',
    note: 'company records — if these rows are REAL, re-enter after purge',
  },
  {
    model: 'BreachIncident',
    delegate: 'breachIncident',
    note: 'company records — if these rows are REAL, re-enter after purge',
  },
  {
    model: 'IcoRegistration',
    delegate: 'icoRegistration',
    note: 'company records — if these rows are REAL, re-enter after purge',
  },
];

const KEPT_TABLES: TableSpec[] = [
  { model: 'ServiceType', delegate: 'serviceType', note: 'reference — deploy-seeded' },
  { model: 'FixedServicePrice', delegate: 'fixedServicePrice', note: 'reference — deploy-seeded' },
  { model: 'ServiceAddon', delegate: 'serviceAddon', note: 'reference — deploy-seeded' },
  { model: 'PlatformConfig', delegate: 'platformConfig', note: 'reference — deploy-seeded' },
];

// ─── R2 inventory ───────────────────────────────────────────────────────────
// An R2 object key is anything stored that is not an http(s) URL, a data: URI,
// or an absolute app path.

function looksLikeR2Key(v: string | null | undefined): v is string {
  return Boolean(v && !v.startsWith('http') && !v.startsWith('data:') && !v.startsWith('/'));
}

async function collectR2Keys(): Promise<{ source: string; keys: string[] }[]> {
  const [users, docs, disputeEv, complaintEv, importedReviews] = await Promise.all([
    prisma.user.findMany({
      where: { email: { not: KEEP_USER_EMAIL } },
      select: { image: true },
    }),
    prisma.documentUpload.findMany({ select: { storagePath: true } }),
    prisma.disputeEvidence.findMany({ select: { url: true } }),
    prisma.complaintEvidence.findMany({ select: { url: true } }),
    prisma.importedReview.findMany({ select: { evidenceUrl: true } }),
  ]);
  const uniq = (keys: string[]) => [...new Set(keys)];
  return [
    {
      source: 'profile photos (User.image)',
      keys: uniq(users.map((u) => u.image).filter(looksLikeR2Key)),
    },
    {
      source: 'documents (DocumentUpload.storagePath)',
      keys: uniq(docs.map((d) => d.storagePath).filter(looksLikeR2Key)),
    },
    {
      source: 'dispute evidence (DisputeEvidence.url)',
      keys: uniq(disputeEv.map((e) => e.url).filter(looksLikeR2Key)),
    },
    {
      source: 'complaint evidence (ComplaintEvidence.url)',
      keys: uniq(complaintEv.map((e) => e.url).filter(looksLikeR2Key)),
    },
    {
      source: 'review-import evidence (ImportedReview.evidenceUrl)',
      keys: uniq(importedReviews.map((r) => r.evidenceUrl).filter(looksLikeR2Key)),
    },
  ];
}

// ─── Manifest ───────────────────────────────────────────────────────────────

async function countTable(spec: TableSpec): Promise<{ total: number; toDelete: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[spec.delegate];
  const total = await delegate.count();
  const toDelete = spec.where ? await delegate.count({ where: await spec.where() }) : total;
  return { total, toDelete };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

async function printManifest(title: string): Promise<number> {
  console.log(`\n═══ ${title} ═══`);
  console.log(pad('TABLE', 26) + pad('ROWS', 8) + pad('DELETES', 9) + 'NOTE');
  let grand = 0;
  for (const spec of PURGE_ORDER) {
    const { total, toDelete } = await countTable(spec);
    grand += toDelete;
    const marker = toDelete > 0 ? '' : ' ·';
    console.log(
      pad(spec.model, 26) +
        pad(String(total), 8) +
        pad(String(toDelete), 9) +
        (spec.note ?? '') +
        marker
    );
  }
  console.log('─'.repeat(60));
  for (const spec of KEPT_TABLES) {
    const { total } = await countTable(spec);
    console.log(pad(spec.model, 26) + pad(String(total), 8) + pad('KEPT', 9) + (spec.note ?? ''));
  }
  console.log(`TOTAL rows to delete: ${grand}`);
  return grand;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Guard first — before touching anything.
  if (stripeIsLive()) {
    console.error(
      'REFUSED: STRIPE_SECRET_KEY is a LIVE key (sk_live_/rk_live_). ' +
        'The purge script must never run against a live environment. Nothing was read or written.'
    );
    process.exit(1);
  }

  // Drift check: every schema model must be classified exactly once.
  const dmmfModels = Prisma.dmmf.datamodel.models.map((m) => m.name.toLowerCase());
  const classified = [...PURGE_ORDER, ...KEPT_TABLES].map((s) => s.model.toLowerCase());
  const missing = dmmfModels.filter((m) => !classified.includes(m));
  const unknown = classified.filter((c) => !dmmfModels.includes(c));
  if (missing.length || unknown.length) {
    console.error(
      `REFUSED: schema drift — unclassified models: [${missing.join(', ')}], ` +
        `unknown entries: [${unknown.join(', ')}]. Classify them in PURGE_ORDER or KEPT_TABLES first.`
    );
    process.exit(1);
  }

  const keepUser = await prisma.user.findUnique({
    where: { email: KEEP_USER_EMAIL },
    select: { id: true, role: true },
  });
  if (!keepUser) {
    console.error(
      `REFUSED: keep-user ${KEEP_USER_EMAIL} not found in this database. ` +
        'The purge would leave zero users — aborting. Nothing was written.'
    );
    process.exit(1);
  }
  keepUserId = keepUser.id;
  console.log(`Keep-user: ${KEEP_USER_EMAIL} (id ${keepUser.id}, role ${keepUser.role})`);
  console.log(
    `Mode: ${execute ? 'EXECUTE — this will delete data' : 'DRY-RUN (default) — read-only'}`
  );

  await printManifest('PRE-PURGE MANIFEST');

  const r2Inventory = await collectR2Keys();
  console.log('\n═══ R2 OBJECT INVENTORY ═══');
  let r2Total = 0;
  for (const group of r2Inventory) {
    console.log(`${group.source}: ${group.keys.length}`);
    for (const k of group.keys) console.log(`  ${k}`);
    r2Total += group.keys.length;
  }
  console.log(`TOTAL R2 objects to delete: ${r2Total}`);

  if (!execute) {
    console.log('\nDRY-RUN complete — nothing was deleted. Re-run with --execute to purge.');
    return;
  }

  // ── EXECUTE ──
  // DB first, in one FK-ordered transaction; R2 after (an R2 outage can never
  // leave the DB half-purged, and a DB failure rolls everything back).
  console.log('\n═══ EXECUTING DB PURGE (single transaction, FK order) ═══');
  await prisma.$transaction(
    async (tx) => {
      for (const spec of PURGE_ORDER) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const delegate = (tx as any)[spec.delegate];
        const where = spec.where ? await spec.where() : undefined;
        const result = await delegate.deleteMany(where ? { where } : undefined);
        console.log(`  ${pad(spec.model, 26)} deleted ${result.count}`);
      }
    },
    { timeout: 10 * 60 * 1000 }
  );

  console.log('\n═══ DELETING R2 OBJECTS ═══');
  const unreachable: string[] = [];
  let deleted = 0;
  if (r2Total > 0) {
    const hasR2 =
      process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;
    if (!hasR2) {
      console.warn('R2 credentials not configured in this environment — objects NOT deleted:');
      r2Inventory.forEach((g) => g.keys.forEach((k) => unreachable.push(k)));
    } else {
      const { deleteObject } = await import('../src/lib/storage/r2-client');
      for (const group of r2Inventory) {
        for (const key of group.keys) {
          try {
            await deleteObject(key);
            deleted++;
          } catch (err) {
            unreachable.push(key);
            console.warn(`  could not delete ${key}: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    }
  }
  console.log(`R2 objects deleted: ${deleted}; unreachable: ${unreachable.length}`);
  if (unreachable.length) {
    console.warn('UNREACHABLE R2 OBJECTS (delete manually in the Cloudflare dashboard):');
    unreachable.forEach((k) => console.warn(`  ${k}`));
  }

  const remaining = await printManifest('POST-PURGE MANIFEST');
  const usersLeft = await prisma.user.count();
  console.log(`\nUsers remaining: ${usersLeft} (expected 1: ${KEEP_USER_EMAIL})`);
  if (remaining > 0 || usersLeft !== 1) {
    console.error('WARNING: post-purge state is not clean — inspect the manifest above.');
    process.exit(1);
  }
  console.log('Purge complete — clean ledger.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Purge script failed (transaction rolled back, nothing partially deleted):', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
