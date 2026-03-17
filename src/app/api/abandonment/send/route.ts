import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { sendAbandonmentEmail } from '@/lib/services/email.service';

// ─── Types ──────────────────────────────────────────────

interface AbandonedLead {
  email: string;
  cleanerId?: string;
  postcode?: string;
  step: string;
  emailSent: boolean;
  lastEmailedAt?: Date;
  createdAt: Date;
}

// ─── Rate-limit tracking (in-memory for now) ────────────

const lastEmailedMap = new Map<string, number>();
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function wasEmailedWithin24Hours(email: string): boolean {
  const lastEmailed = lastEmailedMap.get(email);
  if (!lastEmailed) return false;
  return Date.now() - lastEmailed < TWENTY_FOUR_HOURS_MS;
}

function markAsEmailed(email: string): void {
  lastEmailedMap.set(email, Date.now());
}

// ─── Personalized message generation ────────────────────

function generatePersonalizedMessage(lead: AbandonedLead): string {
  if (lead.cleanerId && lead.postcode) {
    return `Hi there! We noticed you were looking at a cleaner in the ${lead.postcode} area. They still have availability - come back and finish your booking!`;
  }

  if (lead.cleanerId) {
    return `Hi! You were checking out one of our top-rated cleaners. They're still available - why not complete your booking?`;
  }

  if (lead.postcode) {
    return `Hi! We have great cleaners available in ${lead.postcode}. Come back and find the perfect match for your home.`;
  }

  switch (lead.step) {
    case 'cleaner-selected':
      return `Hi! You found a great cleaner on Rena. Complete your booking in just a few clicks!`;
    case 'date-selected':
      return `Hi! You're so close to booking your clean. Just a few more details and you're done!`;
    case 'details-entered':
      return `Hi! Your booking is almost complete. Come back and confirm to secure your slot!`;
    default:
      return `Hi! We noticed you were browsing Rena Cleaning Network. Need help finding the right cleaner? We've got you covered!`;
  }
}

// ─── POST /api/abandonment/send ─────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Authenticate via CRON_SECRET
    const cronSecret = request.headers.get('x-cron-secret') || request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      // eslint-disable-next-line no-console
      console.error('[Abandonment Send] CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const providedSecret = cronSecret?.replace('Bearer ', '');
    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // In production, this would query Prisma for abandoned leads:
    // const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    // const leads = await prisma.abandonedLead.findMany({
    //   where: {
    //     emailSent: false,
    //     createdAt: { lt: thirtyMinutesAgo },
    //   },
    // });
    const leads: AbandonedLead[] = [];

    let processed = 0;

    for (const lead of leads) {
      // Rate limit: skip if emailed within 24 hours
      if (wasEmailedWithin24Hours(lead.email)) {
        // eslint-disable-next-line no-console
        console.log(`[Abandonment Send] Skipping ${lead.email} - emailed within 24 hours`);
        continue;
      }

      const personalizedMessage = generatePersonalizedMessage(lead);

      const sent = await sendAbandonmentEmail(lead.email, {
        cleanerName: lead.cleanerId, // In production, resolve to cleaner name
        postcode: lead.postcode,
        personalizedMessage,
      });

      if (sent) {
        markAsEmailed(lead.email);

        // In production, mark the lead as sent in Prisma:
        // await prisma.abandonedLead.update({
        //   where: { email: lead.email },
        //   data: {
        //     emailSent: true,
        //     lastEmailedAt: new Date(),
        //   },
        // });

        processed++;
      }
    }

    return NextResponse.json({
      processed,
      message:
        processed > 0 ? `Processed ${processed} abandonment email(s)` : 'No leads to process',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Abandonment Send] Error:', error);
    return NextResponse.json({ error: 'Failed to process abandonment emails' }, { status: 500 });
  }
}
