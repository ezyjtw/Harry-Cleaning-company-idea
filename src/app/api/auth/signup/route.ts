import { NextResponse } from 'next/server';

import { generateApiToken, generateBridgeCode } from '@/lib/auth/session';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { AuditService } from '@/lib/services/audit.service';
import { registerUser } from '@/lib/services/auth.service';
import { displayName } from '@/lib/utils/name';

const MAX_SIGNUP_ATTEMPTS = 3;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`signup:${ip}`, MAX_SIGNUP_ATTEMPTS, SIGNUP_WINDOW_MS);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }
    const body = await request.json();
    const { email, password, name: rawName, phone, role } = body;
    // Name casing heals on save (shared helper — 'james wright' → 'James Wright').
    const name = typeof rawName === 'string' ? displayName(rawName) : rawName;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required.' },
        { status: 400 }
      );
    }

    const validRoles = ['CLIENT', 'CLEANER'] as const;
    const userRole = validRoles.includes(role) ? role : 'CLIENT';

    const result = await registerUser({
      email,
      password,
      name,
      phone: phone || '',
      role: userRole,
    });

    if (!result.success || !result.user) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    const token = generateApiToken({
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
    });

    await AuditService.log({
      userId: result.user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: result.user.id,
      metadata: { role: userRole, email },
      ipAddress: ip,
    });

    return NextResponse.json(
      {
        user: result.user,
        token,
        bridgeCode: generateBridgeCode({ id: result.user.id }),
        message: result.message,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
