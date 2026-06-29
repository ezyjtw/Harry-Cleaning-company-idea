import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { sendContactConfirmation, sendSupportAlert } from '@/lib/services/email.service';
import { sanitizeHtml, RateLimiter } from '@/lib/utils/security';

// Rate limiter: 5 submissions per hour per IP
const contactRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
});

const VALID_SUBJECTS = ['General Enquiry', 'Booking Issue', 'Cleaner Issue', 'Billing', 'Other'];

// POST /api/contact - Submit a contact form
export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',').pop()?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const rateCheck = contactRateLimiter.check(ip);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateCheck.resetTime - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const { name, email, phone, subject, message, bookingRef } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Please provide a valid email address' }, { status: 400 });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.trim().length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (subject && !VALID_SUBJECTS.includes(subject)) {
      return NextResponse.json({ error: 'Invalid subject selected' }, { status: 400 });
    }

    // Sanitize all inputs
    const sanitized = {
      name: sanitizeHtml(name.trim()),
      email: email.trim().toLowerCase(),
      phone: phone ? sanitizeHtml(String(phone).trim()) : undefined,
      subject: subject && VALID_SUBJECTS.includes(subject) ? subject : 'General Enquiry',
      message: sanitizeHtml(message.trim()),
      bookingRef: bookingRef ? sanitizeHtml(String(bookingRef).trim()) : undefined,
    };

    // Send confirmation email to the user and alert to support (fire both in parallel)
    const [confirmationSent, alertSent] = await Promise.all([
      sendContactConfirmation(sanitized.email, sanitized.name, sanitized.subject),
      sendSupportAlert(sanitized),
    ]);

    if (!confirmationSent && !alertSent) {
      return NextResponse.json(
        { error: 'Failed to process your message. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Your message has been sent successfully.' },
      { status: 200 }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Contact API] Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}
