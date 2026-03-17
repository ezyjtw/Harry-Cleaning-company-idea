import Anthropic from '@anthropic-ai/sdk';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { RateLimiter } from '@/lib/utils/security';

// Rate limiter: 30 messages per 60-minute window per IP
const chatRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 30,
});

const SYSTEM_PROMPT = `You are Rena, the AI assistant for Rena Cleaning Network, a UK-based cleaning marketplace. Help customers with: finding cleaners in their area, understanding pricing (rates start from £25/hr for regular cleans, £35/hr for deep cleans), booking process (choose a cleaner, pick date/time, pay securely), service types (Regular, Deep Clean, End of Tenancy, AirBnB, Same-day), and general FAQs. Be friendly, concise, and helpful. If the customer hasn't shared their email, politely ask for it so you can send them relevant info. Always recommend they visit /cleaners to browse available cleaners.`;

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
