import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ─── Helpers ─────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitize(input: string): string {
  return input.trim().replace(/[<>]/g, '').slice(0, 500);
}

// ─── POST /api/abandonment/capture ──────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, cleanerId, postcode, step } = body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const sanitizedEmail = sanitize(email).toLowerCase();

    if (!EMAIL_REGEX.test(sanitizedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate step
    if (!step || typeof step !== 'string') {
      return NextResponse.json({ error: 'step is required' }, { status: 400 });
    }

    // Sanitize optional inputs
    const sanitizedData = {
      email: sanitizedEmail,
      cleanerId: cleanerId ? sanitize(String(cleanerId)) : undefined,
      postcode: postcode ? sanitize(String(postcode)).toUpperCase() : undefined,
      step: sanitize(step),
      createdAt: new Date().toISOString(),
    };

    // In production, this would upsert an AbandonedLead in Prisma:
    // await prisma.abandonedLead.upsert({
    //   where: { email: sanitizedData.email },
    //   update: {
    //     cleanerId: sanitizedData.cleanerId,
    //     postcode: sanitizedData.postcode,
    //     step: sanitizedData.step,
    //     updatedAt: new Date(),
    //   },
    //   create: {
    //     email: sanitizedData.email,
    //     cleanerId: sanitizedData.cleanerId,
    //     postcode: sanitizedData.postcode,
    //     step: sanitizedData.step,
    //     emailSent: false,
    //   },
    // });

    // eslint-disable-next-line no-console
    console.log('[Abandonment] Captured lead:', sanitizedData);

    return NextResponse.json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Abandonment] Capture error:', error);
    return NextResponse.json({ error: 'Failed to capture abandonment data' }, { status: 500 });
  }
}
