import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import prisma from '@/lib/db/prisma';
import { resolveClientIp } from '@/lib/http/client-ip';
import { log } from '@/lib/log';
import { claimGuestBookings } from '@/lib/services/auth.service';

import {
  createWebSessionRow,
  legacyTokensAccepted,
  upgradeLegacyWebSession,
} from './device-session';

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
        // D-g: every website sign-in is a WEB DeviceSession row; the cookie
        // carries its jti (sid) and the user's sessionVersion (sv). A row
        // that cannot be written fails the sign-in rather than issuing an
        // untracked session.
        const row = await createWebSessionRow({ userId: user.id, label: 'web' });
        token.sid = row.jti;
        token.sv = row.sv;
      } else if (!token.sid && token.id && legacyTokensAccepted()) {
        // Grandfather: a live pre-B1a cookie gains a row on its next read,
        // keyed by the cookie's own jti so repeated reads upsert one row.
        // sv stays 0 by law. Best effort: on failure the token stays legacy
        // and the per-request check keeps treating it as such.
        const cookieJti = (token as { jti?: string }).jti;
        if (cookieJti) {
          const row = await upgradeLegacyWebSession({ userId: token.id, cookieJti }).catch(
            () => null
          );
          if (row) {
            token.sid = row.jti;
            token.sv = 0;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.id = token.id;
        session.user.pwdAt = token.pwdAt;
        session.user.sid = token.sid;
        session.user.sv = token.sv;
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
        // RENA-066: "which device kept knocking" correlates by a keyed
        // pseudonym of the address (null without LOG_HMAC_KEY), the coarse
        // client kind and the referring path; never the raw IP, the full user
        // agent or a query string.
        const fields: Record<string, unknown> = { code };
        try {
          // Request-scoped in app-router handlers; throws outside — caught.
          const h = headers();
          fields.clientRef = log.pseudonym(resolveClientIp(h) ?? null);
          const ua = h.get('user-agent') ?? '';
          fields.platform = /RenaPro\//.test(ua)
            ? 'rena-pro'
            : /RenaApp\//.test(ua)
              ? 'rena-app'
              : ua
                ? 'web'
                : 'none';
          const referer = h.get('referer');
          if (referer) {
            try {
              fields.route = new URL(referer).pathname;
            } catch {
              /* unparseable referer: omitted */
            }
          }
        } catch {
          /* outside a request scope — no context fields */
        }
        log.warn('auth', 'stale_session_cookie', fields);
        return;
      }
      const meta = metadata as { error?: unknown } | undefined;
      log.error('auth', 'nextauth_error', { code }, meta?.error ?? metadata);
    },
    warn(code) {
      log.warn('auth', 'nextauth_warning', { code });
    },
    debug() {
      /* silent */
    },
  },
};
