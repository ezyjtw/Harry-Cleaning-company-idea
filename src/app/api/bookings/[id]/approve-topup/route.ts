import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { handleProvisionalFailure } from '@/lib/services/cascade.service';
import { TOPUP_WITHOUT_ASSIGNMENT, executeTopup } from '@/lib/services/topup.service';
import stripe from '@/lib/stripe';

type RouteContext = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// F5: guests approve top-ups too. Authorization = the booking's registered
// owner (session) OR its guest token (query/body) — the same capability-token
// model as the tracking page and the rescue route (F5/F3 pattern: every guest
// action works tokened, end to end).
function isAuthorized(
  booking: { clientId: string | null; guestToken: string | null },
  user: { id: string } | null,
  token: string | null
): boolean {
  if (user && booking.clientId && user.id === booking.clientId) return true;
  if (!booking.clientId && token && UUID_RE.test(token) && booking.guestToken === token) {
    return true;
  }
  return false;
}

// H57: the refusal must SAY WHY — a logged-out account-holder gets routed to
// sign-in (reason 'auth_required'), a wrong-party session gets honest copy
// (reason 'wrong_account'). A flat 403 stranded James at "not authorised"
// with no path forward.
function refusal(booking: { clientId: string | null }, user: { id: string } | null): NextResponse {
  if (booking.clientId && !user) {
    return NextResponse.json(
      { error: 'Sign in to review this price change.', reason: 'auth_required' },
      { status: 401 }
    );
  }
  if (booking.clientId) {
    return NextResponse.json(
      {
        error:
          'This booking belongs to a different account. Sign in with the account that made the booking to review the price change.',
        reason: 'wrong_account',
      },
      { status: 403 }
    );
  }
  // Guest booking, missing/invalid token — the approval link in the email
  // carries the token; without it there is nothing to honour.
  return NextResponse.json(
    {
      error:
        'This link is missing its access token. Please open the approval link from your email — it contains everything needed, no account required.',
      reason: 'guest_token_required',
    },
    { status: 403 }
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  const token = new URL(request.url).searchParams.get('token');

  const { id } = await context.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      guestToken: true,
      totalPrice: true,
      provisionalPrice: true,
      topupAmount: true,
      approvalExpiresAt: true,
      cascadePhase: true,
      topupApproved: true,
      provisionalSource: true,
      serviceType: true,
      date: true,
      startTime: true,
      topupRecords: {
        where: { status: 'SUCCEEDED' },
        select: { id: true, amount: true, failureReason: true },
      },
      cleaner: { select: { name: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // H57 matrix row 5: an admin session gets a READ-ONLY view — never the
  // approve/decline capability (the POST refuses admins outright).
  const isAdminViewer = !isAuthorized(booking, user, token) && user?.role === 'ADMIN';

  if (!isAuthorized(booking, user, token) && !isAdminViewer) {
    return refusal(booking, user);
  }

  // B3: the top-up was taken but the cleaner was no longer free
  // (TOPUP_WITHOUT_ASSIGNMENT). Neither the paid state nor the approved
  // confirmation is true for this visitor, in the window or after it, so the
  // link says what happened. A later clean top-up outranks the flag.
  const flagged = booking.topupRecords.filter((r) =>
    r.failureReason?.startsWith(TOPUP_WITHOUT_ASSIGNMENT)
  );
  if (flagged.length > 0 && flagged.length === booking.topupRecords.length) {
    return NextResponse.json({
      reason: 'resolved',
      outcome: 'taken_unassigned',
      topupAmount: Number(flagged[0].amount),
    });
  }

  if (booking.cascadePhase !== 'PROVISIONAL_APPROVAL') {
    // H67: a cleared provisional has TWO endings and they must not render
    // alike. A SUCCEEDED top-up record exists only on the approved-and-paid
    // path (writeTopupSuccess) — that visitor gets confirmation, not the
    // dead-link copy. Everything else (declined/expired/reverted) keeps the
    // calm H57 state, where "stands at its original price" is actually true.
    if (booking.topupRecords.length > 0) {
      return NextResponse.json({
        reason: 'resolved',
        outcome: 'approved',
        // Post-success totalPrice IS the new total (writeTopupSuccess).
        newPrice: Number(booking.totalPrice),
        topupAmount: Number(booking.topupRecords[0].amount),
        cleanerName: booking.cleaner?.name ?? null,
        serviceType: booking.serviceType,
        date: booking.date.toISOString().split('T')[0],
        time: booking.startTime,
      });
    }
    return NextResponse.json(
      { error: 'No pending approval', reason: 'resolved', outcome: 'closed' },
      { status: 400 }
    );
  }

  // R4 LANE 5A (James-ruled): the resumable door. An approved-but-unpaid
  // top-up used to strand the customer — the client secret existed only in
  // the Approve response, and every later Approve hit the 409 until expiry.
  // When the approval stands and a PENDING on-session record holds a
  // PaymentIntent, this guarded READ reissues that intent's client secret:
  // same authorisation as the rest of the GET (owner session / guest token),
  // window still open (cascadePhase checked above), NEVER minting a new
  // intent. A Stripe read failure reads as RETRY — never as expired.
  let resumeClientSecret: string | undefined;
  let resumeRetry: boolean | undefined;
  if (booking.topupApproved && !isAdminViewer) {
    const pending = await prisma.topupRecord.findFirst({
      where: {
        bookingId: booking.id,
        status: 'PENDING',
        paymentMethodType: 'on_session',
        stripePaymentIntentId: { not: null },
      },
      orderBy: { attempt: 'desc' },
      select: { stripePaymentIntentId: true },
    });
    if (pending?.stripePaymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(pending.stripePaymentIntentId);
        if (
          pi.client_secret &&
          ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(
            pi.status
          )
        ) {
          resumeClientSecret = pi.client_secret;
        }
        // succeeded/processing/canceled fall through: success lands as a
        // SUCCEEDED record via the webhook; nothing to resume here.
      } catch {
        resumeRetry = true;
      }
    }
  }

  return NextResponse.json({
    bookingId: booking.id,
    originalPrice: Number(booking.totalPrice),
    newPrice: Number(booking.provisionalPrice),
    topupAmount: Number(booking.topupAmount),
    expiresAt: booking.approvalExpiresAt?.toISOString(),
    alreadyApproved: booking.topupApproved,
    alreadyPaid: booking.topupRecords.length > 0,
    serviceType: booking.serviceType,
    date: booking.date.toISOString().split('T')[0],
    time: booking.startTime,
    readOnly: isAdminViewer,
    provisionalSource: booking.provisionalSource,
    resumeClientSecret,
    resumeRetry,
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();

  const { id } = await context.params;
  const body = await request.json();
  const { action } = body;
  const token = typeof body.guestToken === 'string' ? body.guestToken : null;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      guestToken: true,
      cascadePhase: true,
      approvalExpiresAt: true,
    },
  });

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // H57: the POST is the money door — the booking's customer (or its guest
  // token) ONLY. Admin sessions are read-only viewers and are refused here.
  if (!isAuthorized(booking, user, token)) {
    return refusal(booking, user);
  }

  if (booking.cascadePhase !== 'PROVISIONAL_APPROVAL') {
    return NextResponse.json({ error: 'No pending approval', reason: 'resolved' }, { status: 400 });
  }

  if (booking.approvalExpiresAt && booking.approvalExpiresAt < new Date()) {
    return NextResponse.json({ error: 'Approval window has expired' }, { status: 410 });
  }

  if (action === 'decline') {
    await handleProvisionalFailure(id, 'Customer declined');
    return NextResponse.json({ result: 'declined' });
  }

  if (action === 'approve') {
    // Atomic flag set — executeTopup checks this
    const claimed = await prisma.booking.updateMany({
      where: { id, cascadePhase: 'PROVISIONAL_APPROVAL', topupApproved: false },
      data: { topupApproved: true },
    });

    if (claimed.count === 0) {
      return NextResponse.json({ error: 'Already approved or no longer pending' }, { status: 409 });
    }

    const topupResult = await executeTopup(id);

    if (topupResult.outcome === 'SUCCEEDED') {
      return NextResponse.json({ result: 'paid', outcome: topupResult.outcome });
    }

    // B3: the charge went through but the cleaner could no longer be assigned.
    // The money is recorded and flagged for review; the booking is NOT failed
    // over (that would tell the customer the payment failed), and the copy
    // says what actually happened.
    if (topupResult.outcome === 'TAKEN_UNASSIGNED') {
      return NextResponse.json(
        {
          error:
            'Your payment went through, but that cleaner is no longer free at this time. Our team has been alerted and will contact you about it.',
          outcome: topupResult.outcome,
        },
        { status: 409 }
      );
    }

    if (topupResult.outcome === 'REQUIRES_ACTION' || topupResult.outcome === 'REQUIRES_CARD') {
      return NextResponse.json({
        result: 'requires_payment',
        outcome: topupResult.outcome,
        clientSecret: topupResult.clientSecret,
      });
    }

    await handleProvisionalFailure(
      id,
      `Top-up charge failed: ${topupResult.reason || 'Payment failed'}`
    );
    return NextResponse.json(
      { error: topupResult.reason || 'Payment failed', outcome: topupResult.outcome },
      { status: 400 }
    );
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
