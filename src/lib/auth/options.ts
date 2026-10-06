import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import prisma from '@/lib/db/prisma';
import { claimGuestBookings } from '@/lib/services/auth.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            passwordHash: true,
            accountStatus: true,
            isSuspended: true,
            failedLoginCount: true,
            lockedUntil: true,
            emailVerified: true,
          },
        });

        if (!user || user.accountStatus !== 'ACTIVE' || user.isSuspended) return null;

        // Check account lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        if (!user.passwordHash) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isValid) {
          const newCount = user.failedLoginCount + 1;
          const updateData: Record<string, unknown> = { failedLoginCount: newCount };

          if (newCount >= MAX_FAILED_ATTEMPTS) {
            updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
          }

          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });

          return null;
        }

        // Successful login — reset failed count and lockout
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            failedLoginCount: 0,
            lockedUntil: null,
          },
        });

        // A16b-2b: claim-on-login for VERIFIED accounts — attaches guest bookings
        // made with this (verified) address. Uses the authenticated user's own
        // email, never a client-asserted one. Best-effort; never blocks login.
        if (user.emailVerified) {
          await claimGuestBookings(user.id, user.email).catch(() => {});
        }

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        // F6: issue-time marker — sessions minted before a later password
        // change are invalidated in getSessionUser (DB comparison).
        token.pwdAt = Math.floor(Date.now() / 1000);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.id = token.id;
        (session.user as { pwdAt?: number }).pwdAt = token.pwdAt as number | undefined;
      }
      return session;
    },
  },
  pages: { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  // H77: the default logger printed a 15-line anonymous stack for every stale
  // cookie that failed to decrypt — no way to tell WHICH device kept knocking.
  // One enriched line instead: IP, user-agent, and referer (the surface that
  // made the call), read from the request scope. The cookie's issued-at is by
  // definition unrecoverable — it's inside the payload that won't decrypt.
  // All other codes keep their default shape.
  logger: {
    error(code, metadata) {
      if (code === 'JWT_SESSION_ERROR') {
        let ctx = 'no request context';
        try {
          // Request-scoped in app-router handlers; throws outside — caught.
          const h = headers();
          const ip =
            h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown-ip';
          const ua = h.get('user-agent') ?? 'no-ua';
          const referer = h.get('referer') ?? 'no-referer';
          ctx = `ip=${ip} ua="${ua}" referer=${referer}`;
        } catch {
          /* outside a request scope — keep the fallback label */
        }
        // eslint-disable-next-line no-console
        console.error(`[Auth] Stale session cookie failed to decrypt (JWT_SESSION_ERROR) — ${ctx}`);
        return;
      }
      // eslint-disable-next-line no-console
      console.error(`[next-auth][error][${code}]`, metadata);
    },
    warn(code) {
      // eslint-disable-next-line no-console
      console.warn(`[next-auth][warn][${code}]`);
    },
    debug() {
      /* silent */
    },
  },
};
