import { createHash } from 'crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import { computeCleanerOpenRanges, timeToMinutes } from '@/lib/availability/timesheet';
import { SAME_DAY_FEATURE_ENABLED } from '@/lib/config/features';
import { normalizeToPricingSlug, propertySizeSlugToEnum } from '@/lib/constants/services';
import prisma from '@/lib/db/prisma';
import { checkRateLimit, getClientIp, rateLimit } from '@/lib/rate-limit';
import { AuditService } from '@/lib/services/audit.service';
import { pricingService } from '@/lib/services/pricing.service';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';
import stripe from '@/lib/stripe';
import { isValidPostcode } from '@/lib/utils/postcode';
import { isSaneDurationHours, normalizeUkPostcode } from '@/lib/validation/inputs';

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    // B6: callers that aggregate over history (My Cleaners) can raise the page
    // size — capped so the route can't be asked for unbounded rows.
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 10));

    const where: Record<string, unknown> = {};

    // H38: ?as=client lets a CLEANER read their own CUSTOMER purchases (the
    // portal's "My Bookings" shelf) — same clientId filter and serialization
    // every customer gets; nothing role-special leaks in.
    if (user.role === 'CLEANER' && searchParams.get('as') !== 'client') {
      where.cleanerId = user.id;
    } else {
      where.clientId = user.id;
    }

    // H57: price-change approvals are fetched EXPLICITLY (like rescues) — a
    // pending provisional lives on cascadePhase, which no status filter sees.
    if (searchParams.get('approval') === 'pending') {
      where.cascadePhase = 'PROVISIONAL_APPROVAL';
    }

    if (status) {
      // B6: comma-separated statuses ("COMPLETED,REVIEWED") filter as a set —
      // reviewing a booking flips COMPLETED → REVIEWED, and single-status
      // callers were silently losing every reviewed booking.
      const statuses = status
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      where.status = statuses.length > 1 ? { in: statuses } : statuses[0];
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          address: true,
          cleaner: { select: { id: true, name: true, image: true } },
          client: { select: { id: true, name: true, image: true } },
          review: true,
          dispute: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.booking.count({ where }),
    ]);

    const allBackupIds = Array.from(new Set(bookings.flatMap((b) => b.backupCleanerIds)));
    const backupUsers =
      allBackupIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: allBackupIds } },
            select: { id: true, name: true },
          })
        : [];
    const backupNameMap = new Map(backupUsers.map((u) => [u.id, u.name || 'Cleaner']));

    const resolvedBookings = await Promise.all(
      bookings.map(async (b) => ({
        ...b,
        backupCleanerNames: b.backupCleanerIds.map((id) => backupNameMap.get(id) || 'Cleaner'),
        cleaner: { ...b.cleaner, image: await resolveProfileImageUrl(b.cleaner?.image) },
        client: { ...b.client, image: await resolveProfileImageUrl(b.client?.image) },
      }))
    );

    return NextResponse.json({
      data: resolvedBookings,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // General create limit (the price-tamper sub-path has its own stricter one).
    // Guest checkout creates DB rows + Stripe PaymentIntents, so bound abuse.
    const createRl = rateLimit(request, 'booking-create', 20, 60 * 60 * 1000);
    if (!createRl.ok) {
      return NextResponse.json(
        { error: 'Too many booking attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(createRl.retryAfter) } }
      );
    }

    const body = await request.json();
    if (body.duration !== undefined) {
      const dur = Number(body.duration);
      if (!isSaneDurationHours(dur)) {
        return NextResponse.json(
          { error: 'Duration must be between 1 and 12 hours.' },
          { status: 400 }
        );
      }
    }

    // A16b-1: buildReplay returns an already-created booking + its live
    // clientSecret (re-fetched from Stripe) so a double-submit / retry keeps
    // paying the SAME PaymentIntent. The idempotency key is derived SERVER-SIDE
    // below from the validated request + a time bucket — never trusted from the
    // client (a client-supplied key could wrongly collapse or be replayed).
    const buildReplay = async (bk: {
      id: string;
      stripePaymentIntentId: string | null;
      guestToken: string | null;
    }) => {
      let clientSecret: string | null = null;
      if (bk.stripePaymentIntentId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(bk.stripePaymentIntentId);
          clientSecret = pi.client_secret;
        } catch {
          /* PI not retrievable — return the booking; client can re-initiate payment */
        }
      }
      return NextResponse.json(
        {
          message: 'Booking already created',
          booking: {
            id: bk.id,
            stripePaymentIntentId: bk.stripePaymentIntentId,
            guestToken: bk.guestToken,
          },
          clientSecret,
          idempotentReplay: true,
        },
        { status: 200 }
      );
    };

    // 1. Validate required fields
    const required = ['cleanerId', 'name', 'email', 'date', 'time', 'duration', 'serviceType'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    // 1a. Email format — the confirmation + reminder emails depend on it. Reject
    // a malformed address at the door rather than storing an unreachable one.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }

    // 1b. Date validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.date)) {
      return NextResponse.json({ error: 'date must be in YYYY-MM-DD format.' }, { status: 400 });
    }

    const bookingDate = new Date(`${body.date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate <= today) {
      return NextResponse.json(
        {
          error:
            'Booking date must be in the future. Same-day bookings are not currently available.',
        },
        { status: 400 }
      );
    }

    if (!SAME_DAY_FEATURE_ENABLED && body.serviceType === 'same-day') {
      return NextResponse.json(
        { error: 'Same-day bookings are not currently available.' },
        { status: 400 }
      );
    }

    // H36 (James-ruled): a cleaner may book OTHER cleaners as a customer, but
    // never themselves — self-booking is a rating-inflation vector (verified
    // "native" review round-tripped to yourself for the fee).
    {
      const self = await getSessionUser();
      if (self && self.id === body.cleanerId) {
        return NextResponse.json({ error: "You can't book yourself." }, { status: 400 });
      }
    }

    // 2. Cleaner lookup with Stripe eligibility
    const cleaner = await prisma.user.findFirst({
      where: { id: body.cleanerId, role: 'CLEANER' },
      select: {
        id: true,
        name: true,
        email: true,
        cleanerProfile: {
          select: {
            stripeAccountId: true,
            stripeChargesEnabled: true,
            stripePayoutsEnabled: true,
            homePostcode: true,
            maxTravelMinutes: true,
          },
        },
      },
    });

    if (!cleaner) {
      return NextResponse.json({ error: 'Cleaner not found' }, { status: 404 });
    }

    // 3. TOCTOU slot re-validation — never trust the client's pre-filled slot.
    // Between discovery (time-first list OR the per-cleaner calendar) and this
    // request, the slot could have been taken. Re-check against the SAME timesheet
    // engine both of those use (single source of truth). Skipped for 'Flexible'.
    if (body.time !== 'Flexible') {
      const slotProfile = await prisma.cleanerProfile.findUnique({
        where: { userId: body.cleanerId },
        select: {
          id: true,
          bookingBufferMinutes: true,
          availabilitySlots: { select: { dayOfWeek: true, startTime: true, endTime: true } },
        },
      });
      if (slotProfile) {
        const dayStart = new Date(`${body.date}T00:00:00`);
        const dayEnd = new Date(`${body.date}T23:59:59.999`);
        const [dateSlots, overrides, dayBookings] = await Promise.all([
          prisma.availabilityDateSlot.findMany({
            where: { cleanerProfileId: slotProfile.id, date: { gte: dayStart, lte: dayEnd } },
            select: { date: true, startTime: true, endTime: true },
          }),
          prisma.availabilityOverride.findMany({
            where: {
              cleanerProfileId: slotProfile.id,
              date: { gte: dayStart, lte: dayEnd },
              isBlocked: true,
            },
            select: { date: true, startTime: true, endTime: true },
          }),
          prisma.booking.findMany({
            where: {
              cleanerId: body.cleanerId,
              date: { gte: dayStart, lte: dayEnd },
              status: { notIn: ['CANCELLED'] },
            },
            select: { date: true, startTime: true, duration: true },
          }),
        ]);
        const { openRanges } = computeCleanerOpenRanges({
          targetDate: bookingDate,
          bufferMins: slotProfile.bookingBufferMinutes,
          recurringSlots: slotProfile.availabilitySlots,
          dateSlots,
          overrides,
          bookings: dayBookings,
        });
        const startMin = timeToMinutes(body.time);
        const endMin = startMin + Number(body.duration) * 60;
        const fits = openRanges.some((r) => startMin >= r.start && endMin <= r.end);
        if (!fits) {
          return NextResponse.json(
            {
              error:
                'That time slot is no longer available for this cleaner. Please pick another slot.',
            },
            { status: 409 }
          );
        }
      }
    }

    // 4. Stripe eligibility check
    if (
      !cleaner.cleanerProfile?.stripeAccountId ||
      !cleaner.cleanerProfile?.stripeChargesEnabled ||
      !cleaner.cleanerProfile?.stripePayoutsEnabled
    ) {
      return NextResponse.json(
        {
          error:
            'This cleaner is not yet set up to receive payments. Please choose another cleaner.',
        },
        { status: 400 }
      );
    }

    // 4b. Service area defensive check
    if (
      !cleaner.cleanerProfile?.homePostcode ||
      cleaner.cleanerProfile?.maxTravelMinutes === null
    ) {
      return NextResponse.json(
        {
          error:
            'This cleaner has not set up their service area yet. Please choose another cleaner or try again later.',
        },
        { status: 400 }
      );
    }

    // 3. Service type validation
    const pricingSlug = normalizeToPricingSlug(body.serviceType);

    // H13: THE LAW — duration below the service's minimum is rejected here,
    // explicitly, instead of the pricing engine silently clamping it into a
    // price the customer never saw. Reads the reference-data row (the
    // deploy-synced source of truth the UI constant mirrors).
    if (body.duration !== undefined) {
      const serviceTypeRow = await prisma.serviceType.findUnique({
        where: { slug: pricingSlug },
        select: { minimumHours: true, name: true },
      });
      const minHours = serviceTypeRow?.minimumHours ?? null;
      if (minHours !== null && Number(body.duration) < minHours) {
        return NextResponse.json(
          {
            error: `${serviceTypeRow?.name ?? 'This service'} needs at least ${minHours} hours.`,
          },
          { status: 400 }
        );
      }
    }

    // 5. Price calculation — never trust client-submitted totals
    let quote;
    try {
      quote = await pricingService.calculateQuote({
        cleanerId: body.cleanerId,
        serviceSlug: pricingSlug,
        hours: body.duration ? Number(body.duration) : undefined,
        propertySize: body.propertySize || undefined,
        addons: body.addons || undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pricing error';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Price discrepancy detection
    const clientTotal = body.totalPrice ? Number(body.totalPrice) : null;
    if (clientTotal !== null) {
      const diff = Math.abs(clientTotal - quote.customerTotal);
      if (diff > 1.0) {
        const ip = getClientIp(request);
        const sessionUser = await getSessionUser();

        await AuditService.log({
          userId: sessionUser?.id,
          action: 'PRICE_DISCREPANCY_DETECTED',
          entityType: 'Booking',
          entityId: body.cleanerId,
          metadata: {
            clientTotal,
            serverTotal: quote.customerTotal,
            difference: diff,
            cleanerId: body.cleanerId,
            serviceType: body.serviceType,
            ip,
          },
          ipAddress: ip,
          userAgent: request.headers.get('user-agent') || undefined,
        });

        const tamperCheck = checkRateLimit(`price-discrepancy:${ip}`, 4, 60 * 60 * 1000);
        if (!tamperCheck.allowed) {
          await AuditService.log({
            userId: sessionUser?.id,
            action: 'PRICE_TAMPERING_SUSPECTED',
            entityType: 'Booking',
            entityId: body.cleanerId,
            metadata: { ip, discrepancyCount: 5 },
            ipAddress: ip,
          });
        }

        return NextResponse.json(
          {
            error: 'PRICE_MISMATCH',
            message:
              'The price has changed since this page was loaded. Please refresh and try again.',
            expectedTotal: quote.customerTotal,
          },
          { status: 409 }
        );
      }
    }

    let totalPrice = quote.customerTotal;
    const platformFee = quote.customerPlatformFee;
    const cleanerEarnings = quote.cleanerPayout;

    let discountPercent = 0;
    let discountAmount = 0;
    let promoCode: string | null = null;

    if (body.promoCode) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: body.promoCode.toUpperCase().trim() },
      });
      const now = new Date();
      if (
        promo &&
        promo.isActive &&
        (!promo.validUntil || promo.validUntil >= now) &&
        promo.validFrom <= now &&
        (!promo.maxUses || promo.usedCount < promo.maxUses)
      ) {
        discountPercent = promo.discountPercent;
        discountAmount = Math.round(totalPrice * (discountPercent / 100) * 100) / 100;
        totalPrice = Math.round((totalPrice - discountAmount) * 100) / 100;
        promoCode = promo.code;
        await prisma.promoCode.update({
          where: { id: promo.id },
          data: { usedCount: { increment: 1 } },
        });
      }
    }

    // ─── Backup cleaner validation ─────
    // H38: a customer can never list THEMSELVES as a backup — stripped
    // silently (same family as the H36 self-primary refusal).
    const bookerId = (await getSessionUser())?.id;
    const backupCleanerIds: string[] = (
      Array.isArray(body.backupCleanerIds) ? body.backupCleanerIds : []
    ).filter((id: string) => id !== bookerId);
    const autoAssignBackup: boolean = body.autoAssignBackup === true;

    if (backupCleanerIds.length > 3) {
      return NextResponse.json({ error: 'Maximum 3 backup cleaners allowed.' }, { status: 400 });
    }

    if (backupCleanerIds.length > 0) {
      if (new Set(backupCleanerIds).size !== backupCleanerIds.length) {
        return NextResponse.json(
          { error: 'Duplicate backup cleaner IDs are not allowed.' },
          { status: 400 }
        );
      }

      if (backupCleanerIds.includes(body.cleanerId)) {
        return NextResponse.json(
          { error: 'Primary cleaner cannot be in the backup list.' },
          { status: 400 }
        );
      }

      const backupProfiles = await prisma.cleanerProfile.findMany({
        where: { userId: { in: backupCleanerIds } },
        select: { userId: true },
      });
      const foundIds = new Set(backupProfiles.map((p) => p.userId));
      const missing = backupCleanerIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Invalid backup cleaner IDs: ${missing.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // H7: backups must pass the SAME gates the primary just did — static
    // offer-eligibility AND real slot availability for this exact date/time
    // (the UI pool is filtered too; this is the server enforcement). Failing
    // backups are silently dropped — they're best-effort insurance, and a 400
    // here would kill a valid booking over a stale slider.
    let attachedBackupIds = backupCleanerIds;
    if (backupCleanerIds.length > 0) {
      const { eligibleCleanerWhere } = await import('@/lib/services/area-search.service');
      const staticallyEligible = await prisma.cleanerProfile.findMany({
        where: { userId: { in: backupCleanerIds }, ...eligibleCleanerWhere(new Date()) },
        select: { userId: true },
      });
      const eligibleSet = new Set(staticallyEligible.map((p) => p.userId));
      attachedBackupIds = backupCleanerIds.filter((id) => eligibleSet.has(id));

      if (body.time !== 'Flexible' && attachedBackupIds.length > 0) {
        const { filterSlotAvailableCleaners } = await import('@/lib/availability/slot-eligibility');
        const slotFree = await filterSlotAvailableCleaners(attachedBackupIds, {
          date: bookingDate,
          startTime: body.time,
          durationHours: Number(body.duration),
        });
        attachedBackupIds = attachedBackupIds.filter((id) => slotFree.has(id));
      }

      if (attachedBackupIds.length < backupCleanerIds.length) {
        // eslint-disable-next-line no-console
        console.warn(
          `[Booking] Dropped ${backupCleanerIds.length - attachedBackupIds.length} backup(s) failing eligibility/slot checks`,
          backupCleanerIds.filter((id) => !attachedBackupIds.includes(id))
        );
      }
    }

    const sessionUser = await getSessionUser();

    // A12: resolve + validate the structured booking address. It is stored
    // DIRECTLY on the booking (Option A) so it works uniformly for guests and
    // registered users — the booking columns are the source of truth, never null.
    let addressId: string | null = null;
    let addressLine1 = typeof body.addressLine1 === 'string' ? body.addressLine1.trim() : '';
    let addressLine2 = typeof body.addressLine2 === 'string' ? body.addressLine2.trim() : '';
    let addressCity = typeof body.addressCity === 'string' ? body.addressCity.trim() : '';
    // H31: PERSIST the canonical form — "E47AP" is stored as "E4 7AP", so every
    // downstream consumer (coverage, area quotes, display) sees one spelling.
    const rawPostcode =
      typeof body.addressPostcode === 'string' ? body.addressPostcode.trim().toUpperCase() : '';
    let addressPostcode = normalizeUkPostcode(rawPostcode) ?? rawPostcode;

    // Saved address selected: copy its fields onto the booking (ownership-checked).
    if (body.addressId && sessionUser) {
      const saved = await prisma.address.findUnique({ where: { id: body.addressId } });
      if (saved && saved.userId === sessionUser.id) {
        addressId = saved.id;
        addressLine1 = saved.line1;
        addressLine2 = saved.line2 ?? '';
        addressCity = saved.city;
        addressPostcode = saved.postcode;
      }
    }

    // A cleaner can't be dispatched without a real address — hard requirement.
    if (!addressLine1 || !isValidPostcode(addressPostcode)) {
      return NextResponse.json(
        { error: 'A valid cleaning address (street and postcode) is required.' },
        { status: 400 }
      );
    }

    // For a logged-in user entering a NEW address, save it to their address book
    // (best-effort) so it's reusable. Never blocks the booking; the columns above
    // remain the source of truth regardless.
    if (sessionUser && !addressId) {
      try {
        const existing = await prisma.address.findFirst({
          where: { userId: sessionUser.id, line1: addressLine1, postcode: addressPostcode },
          select: { id: true },
        });
        addressId =
          existing?.id ??
          (
            await prisma.address.create({
              data: {
                userId: sessionUser.id,
                line1: addressLine1,
                line2: addressLine2 || null,
                city: addressCity,
                postcode: addressPostcode,
                isDefault: false,
              },
            })
          ).id;
      } catch {
        // address-book save is best-effort; booking columns are the source of truth
      }
    }

    // 6. Ensure customer has Stripe Customer ID (authenticated users only)
    let stripeCustomerId: string | null = null;

    if (sessionUser) {
      const dbUser = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { stripeCustomerId: true, email: true, name: true },
      });

      if (dbUser?.stripeCustomerId) {
        try {
          await stripe.customers.retrieve(dbUser.stripeCustomerId);
          stripeCustomerId = dbUser.stripeCustomerId;
        } catch {
          // Stripe Customer deleted — create a new one
        }
      }

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: dbUser?.email || sessionUser.email,
          name: dbUser?.name || undefined,
          metadata: { userId: sessionUser.id },
        });
        stripeCustomerId = customer.id;
        await prisma.user.update({
          where: { id: sessionUser.id },
          data: { stripeCustomerId: customer.id },
        });
      }
    }

    // 7. Fee breakdown is already computed by the pricing service
    // quote.customerPlatformFee = 6% service fee
    // quote.cleanerCommission = 10% or 15% commission from base
    // quote.cleanerPayout = base - commission
    // Full amount captured to platform balance; cleaner paid via transfer at release (A6).

    // A16b-1: derive a SERVER-SIDE idempotency key from the validated request +
    // a time bucket. The same intended booking (same guest/user, cleaner, slot,
    // service, amount) within the bucket → same key → the booking + its Stripe
    // PaymentIntent are reused instead of duplicated. This survives page reloads
    // and fresh clients (unlike a client-supplied key). A different slot/cleaner/
    // service/amount → different key → a distinct booking + PI.
    const identity = sessionUser?.id ?? String(body.email).toLowerCase().trim();
    const amountPence = Math.round(totalPrice * 100);
    const fingerprint = [
      identity,
      body.cleanerId,
      body.date,
      body.time,
      body.serviceType,
      amountPence,
    ].join('|');
    // Bucket = 5 minutes: long enough to catch frustrated re-clicks and a retry
    // after a 10–15s timeout; short enough that a genuine later re-booking isn't
    // collapsed (and the slot is taken after the first booking anyway). The
    // current+previous-bucket replay check gives an effective ~5–10 min window.
    const BUCKET_MS = 5 * 60 * 1000;
    const bucket = Math.floor(Date.now() / BUCKET_MS);
    const keyForBucket = (b: number) =>
      createHash('sha256').update(`${fingerprint}|${b}`).digest('hex');
    const idempotencyKey = keyForBucket(bucket);

    // Replay: check the current AND previous bucket so a retry that straddles the
    // bucket boundary still matches the original booking.
    const replayExisting = await prisma.booking.findFirst({
      where: { idempotencyKey: { in: [idempotencyKey, keyForBucket(bucket - 1)] } },
      select: { id: true, stripePaymentIntentId: true, guestToken: true },
    });
    if (replayExisting) return buildReplay(replayExisting);

    // 8. Create Booking record FIRST with paymentStatus: PENDING.
    // A16b-1: if a concurrent submit with the same idempotencyKey wins the race,
    // the unique constraint throws P2002 here — return the winner's booking.
    let booking: Awaited<ReturnType<typeof prisma.booking.create>>;
    try {
      booking = await prisma.booking.create({
        data: {
          clientId: sessionUser?.id || null,
          cleanerId: body.cleanerId,
          addressId,
          // A12: structured address columns — the source of truth (guest-safe).
          addressLine1,
          addressLine2: addressLine2 || null,
          addressCity,
          addressPostcode,
          guestEmail: !sessionUser ? body.email : null,
          guestName: !sessionUser ? body.name : null,
          guestPhone: !sessionUser ? body.phone : null,
          guestToken: !sessionUser ? crypto.randomUUID() : null,
          idempotencyKey,
          serviceType: body.serviceType,
          date: new Date(body.date),
          startTime: body.time,
          duration: body.duration,
          rooms: body.rooms || null,
          // Persist the SAME addon ids the quote priced — reconciliation and the
          // money-snapshot helper re-quote from booking.extras, so an
          // addons-only client (e.g. the products toggle) must round-trip.
          extras: body.extras?.length ? body.extras : body.addons || [],
          frequency: 'one_off',
          totalPrice,
          platformFee,
          cleanerEarnings,
          cleanerPayoutAmount: quote.cleanerPayout,
          // M2: promos are RENA-FUNDED. The discount comes entirely out of the
          // platform commission (which may go NEGATIVE); cleaner earnings are
          // sacred and never reduced by a promo. Statements/Xero therefore see
          // Rena's true (possibly negative) take on discounted bookings.
          platformCommissionAmount:
            Math.round((quote.cleanerCommission - discountAmount) * 100) / 100,
          platformFeeAmount: quote.customerPlatformFee,
          totalAmountCharged: totalPrice,
          customerSubtotal: quote.cleanerListedPrice,
          customerServiceFee: quote.customerPlatformFee,
          renaEarns:
            Math.round(
              (quote.cleanerCommission + quote.customerPlatformFee - discountAmount) * 100
            ) / 100,
          propertySize: propertySizeSlugToEnum(body.propertySize),
          notes: body.notes || null,
          paymentStatus: 'PENDING',
          backupCleanerIds: attachedBackupIds,
          autoAssignBackup,
        },
      });
    } catch (err) {
      if (idempotencyKey && (err as { code?: string }).code === 'P2002') {
        const existing = await prisma.booking.findUnique({
          where: { idempotencyKey },
          select: { id: true, stripePaymentIntentId: true, guestToken: true },
        });
        if (existing) return buildReplay(existing);
      }
      throw err;
    }

    // 9. Create Stripe PaymentIntent
    let clientSecret: string | null = null;
    try {
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: Math.round(totalPrice * 100),
          currency: 'gbp',
          ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
          metadata: {
            bookingId: booking.id,
            customerId: sessionUser?.id || '',
            cleanerId: cleaner.id,
            serviceType: body.serviceType,
          },
          automatic_payment_methods: { enabled: true },
        },
        // A16b-1: Stripe-level idempotency keyed on the SAME request-derived key
        // (not the booking id) — so two concurrent submits that both reach PI
        // creation before either booking is visible still yield ONE PaymentIntent.
        { idempotencyKey: `booking_pi_${idempotencyKey}` }
      );

      clientSecret = paymentIntent.client_secret;

      // 10. Update Booking with stripePaymentIntentId
      await prisma.booking.update({
        where: { id: booking.id },
        data: { stripePaymentIntentId: paymentIntent.id },
      });
      booking.stripePaymentIntentId = paymentIntent.id;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('PaymentIntent creation failed:', error);

      // Mark booking as failed — don't leave orphan PENDING bookings
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'FAILED',
          cancelledAt: new Date(),
          cancellationReason: 'Payment initialization failed',
        },
      });

      return NextResponse.json(
        { error: 'Failed to initialize payment. Please try again.' },
        { status: 500 }
      );
    }

    // Store promo code info on payment record
    if (discountPercent > 0) {
      await prisma.payment
        .create({
          data: {
            bookingId: booking.id,
            amount: totalPrice,
            discountPercent,
            discountAmount,
            promoCode,
          },
        })
        .catch(() => {});
    }

    // NO confirmation / cleaner-offer emails or notifications here. The booking
    // is still PENDING (unpaid) at this point. All "you're booked" side-effects —
    // guest/customer confirmation, cleaner assignment email, cleaner offer
    // notification, and the cascade offer going live — fire on payment success in
    // the payment_intent.succeeded webhook. An abandoned/unpaid booking therefore
    // never triggers a premature email, and is reaped after 60 minutes.

    return NextResponse.json(
      {
        message: 'Booking created successfully',
        booking,
        clientSecret,
      },
      { status: 201 }
    );
  } catch (error) {
    // Log full detail server-side only; never leak error messages/stack traces to
    // the client (the previous TEMPORARY DEBUG block returned the stack in prod).
    // eslint-disable-next-line no-console
    console.error('[POST /api/bookings] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
