import { NextResponse } from 'next/server';

import { loginUser } from '@/lib/services/auth.service';
import { generateApiToken } from '@/lib/auth/session';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`login:${ip}`, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const result = await loginUser(email, password);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 401 });
    }

    const token = generateApiToken({
      id: result.user!.id,
      email: result.user!.email,
      name: result.user!.name,
      role: result.user!.role,
    });

    return NextResponse.json({
      user: result.user,
      token,
      message: result.message,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
