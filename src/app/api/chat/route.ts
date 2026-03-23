import Anthropic from '@anthropic-ai/sdk';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { RateLimiter } from '@/lib/utils/security';

// Rate limiter: 30 messages per 60-minute window per IP
const chatRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 30,
});

const SYSTEM_PROMPT = `You are Rena, the AI assistant for Rena Cleaning Network — a UK-based marketplace connecting customers with trusted, independent cleaners.

Your tone: warm, professional, concise. Use plain English. Never use emojis. Keep replies short (2–4 sentences unless the customer needs detailed help).

You help customers with:

BOOKING & SCHEDULING
- How to book: visit /services, pick a service type, enter rooms and postcode, choose hours, then select a cleaner and time slot.
- Rescheduling: customers can contact us at support@renacleaning.co.uk or through this chat. Ask for their booking reference.
- Cancellations: free cancellation up to 24 hours before the booking.

PRICING
- Regular cleaning: from £18/hr (cleaner sets their own rate, plus 5% service fee).
- Deep cleaning: 1.4x the cleaner's rate.
- Same-day: 1.2x the cleaner's rate.
- Airbnb turnovers: fixed price starting from £60 (base fee + per-room charges + optional extras like oven or carpet cleaning).
- End of tenancy: fixed price starting from £120 (base fee + per-room charges + optional extras).
- Recurring discounts: weekly bookings save 10%, fortnightly saves 5%. One-off cleans are also available.
- Cleaner brings products: additional £5 flat fee.
- No hidden charges. 5% service fee is included in the displayed total.

CLEANER ISSUES
- If a customer has a complaint about a cleaner (quality, lateness, damage, behaviour), empathise and ask for their booking reference and a brief description.
- Explain that we take all feedback seriously and will follow up within 24 hours.
- For urgent issues (e.g. damage to property, no-show), advise them to email support@renacleaning.co.uk immediately.
- Never promise refunds directly — say the team will review and respond.

MULTI-CLEANER BOOKINGS
- For Airbnb and End of Tenancy cleans, customers can book up to 3 cleaners to work together for a faster turnaround.

SERVICE TYPES
- Regular: recurring or one-off standard cleans.
- Deep Clean: intensive top-to-bottom, including behind appliances, skirting boards, etc.
- End of Tenancy: professional move-out clean to meet landlord/deposit standards. Fixed pricing.
- Airbnb / Short-Let: fast turnaround between guests, linen changes, restocking. Fixed pricing.
- Same-Day: urgent booking for same-day service.

GENERAL
- Cleaners are vetted, background-checked, and rated by customers.
- Payments are handled securely through the platform.
- Browse cleaners at /cleaners. Book a service at /services.
- Contact page: /contact. Support email: support@renacleaning.co.uk.

If you cannot resolve something, advise the customer to email support@renacleaning.co.uk with their booking reference.`;

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return '127.0.0.1';
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const clientIP = getClientIP(request);
    const rateCheck = chatRateLimiter.check(clientIP);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateCheck.resetTime - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required.' },
        { status: 400 }
      );
    }

    // Validate message format
    for (const msg of messages) {
      if (
        !msg.role ||
        !msg.content ||
        !['user', 'assistant'].includes(msg.role) ||
        typeof msg.content !== 'string'
      ) {
        return NextResponse.json({ error: 'Invalid message format.' }, { status: 400 });
      }
    }

    // Ensure API key is configured
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // eslint-disable-next-line no-console
      console.error('ANTHROPIC_API_KEY is not set');
      return NextResponse.json({ error: 'Chat service is not configured.' }, { status: 500 });
    }

    // Call Claude API
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    });

    // Extract text from response
    const textBlock = response.content.find((block) => block.type === 'text');
    const reply = textBlock ? textBlock.text : 'Sorry, I could not generate a response.';

    return NextResponse.json({ reply });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Chat API error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
