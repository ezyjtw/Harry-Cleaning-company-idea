import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { LIVE_CHAT_ENABLED } from '@/lib/config/features';
import { getClientIp } from '@/lib/rate-limit';
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

PRICING (cleaners set their own rates — always give RANGES, never exact quotes)
- Regular cleaning: typically £14–£35/hr depending on the cleaner.
- Deep cleaning: typically £20–£51/hr depending on the cleaner.
- End of tenancy: fixed price by property size, typically £150 (studio) to £580 (5+ bed).
- Airbnb / short-let turnovers: fixed price by property size, typically £45 to £165.
- Same-day cleaning: NOT bookable yet — it's coming soon. NEVER quote a same-day price or multiplier. If someone asks, apologise, say it's coming soon, and point them to the postcode search on the homepage — entering their email there puts them on the launch list. Do NOT collect their email in this chat; nothing typed here reaches the team.
- Cleaner brings products: optional +£5 for your cleaner's supplies (shown as its own line at checkout).
- The exact price is always shown at checkout before payment — all-inclusive, no hidden charges.

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
- Same-Day: coming soon — not yet bookable.

GENERAL
- Cleaners are vetted, ID-verified, and rated by customers.
- Payments are handled securely through the platform.
- Browse cleaners at /cleaners. Book a service at /services.
- Contact page: /contact. Support email: support@renacleaning.co.uk.

If you cannot resolve something, advise the customer to email support@renacleaning.co.uk with their booking reference.`;

// Delegates to the shared, topology-aware resolver (cf-connecting-ip → rightmost
// XFF → x-real-ip, with TRUSTED_PROXY override). See src/lib/rate-limit.ts.
function getClientIP(request: NextRequest): string {
  return getClientIp(request);
}

export async function POST(request: NextRequest) {
  try {
    // H88: live chat is pulled from launch — no UI opens this, and the AI
    // endpoint must not stay quietly reachable while the widget is off.
    if (!LIVE_CHAT_ENABLED) {
      return NextResponse.json(
        { error: 'Live chat is not available. Please use the contact form at /contact.' },
        { status: 503 }
      );
    }

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
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      // eslint-disable-next-line no-console
      console.error('GROQ_API_KEY is not set');
      return NextResponse.json({ error: 'Chat service is not configured.' }, { status: 500 });
    }

    // Call Groq API (OpenAI-compatible)
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.map((msg: { role: string; content: string }) => ({
            role: msg.role,
            content: msg.content,
          })),
        ],
      }),
    });

    if (!groqResponse.ok) {
      const errorBody = await groqResponse.text();
      // eslint-disable-next-line no-console
      console.error('Groq API error:', groqResponse.status, errorBody);
      return NextResponse.json(
        { error: 'An unexpected error occurred. Please try again.' },
        { status: 500 }
      );
    }

    const data = await groqResponse.json();
    const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

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
