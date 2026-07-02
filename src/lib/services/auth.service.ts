import crypto from 'crypto';

import bcrypt from 'bcryptjs';

import prisma from '@/lib/db/prisma';
import {
  sendEmailVerification,
  sendPasswordReset as sendPasswordResetEmail,
  sendSignupNotification,
} from '@/lib/services/email.service';
import { validatePasswordPolicy } from '@/lib/utils/password-policy';

const SALT_ROUNDS = 12;
const RESET_TOKEN_EXPIRY_HOURS = 1;
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'CLIENT' | 'CLEANER';
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'CLIENT' | 'CLEANER' | 'ADMIN';
  createdAt: string;
}

export interface AuthResult {
  success: boolean;
  message: string;
  user?: AuthUser;
}

/**
 * Register a new user account.
 */
export async function registerUser(input: RegisterUserInput): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();

  // Check for existing user
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, message: 'An account with this email already exists.' };
  }

  // Validate password strength
  const pwCheck = validatePasswordPolicy(input.password);
  if (!pwCheck.valid) {
    return { success: false, message: pwCheck.errors[0] };
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: input.name,
      phone: input.phone,
      role: input.role,
    },
  });

  // Create verification token
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  });

  // If the user is a cleaner, create their cleaner profile
  if (input.role === 'CLEANER') {
    await prisma.cleanerProfile.create({
      data: { userId: user.id },
    });
  }

  // Send verification email (fire and forget — don't block registration)
  sendEmailVerification(email, token).catch(() => {});

  sendSignupNotification({
    name: input.name,
    email,
    phone: input.phone,
    role: input.role,
    createdAt: user.createdAt.toISOString(),
  }).catch(() => {});

  return {
    success: true,
    message: 'Account created successfully. Please check your email to verify your account.',
    user: {
      id: user.id,
      email: user.email,
      name: user.name || '',
      phone: user.phone || '',
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  };
}

/**
 * Authenticate a user with email and password.
 */
export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      passwordHash: true,
      accountStatus: true,
      isSuspended: true,
      failedLoginCount: true,
      lockedUntil: true,
      createdAt: true,
      emailVerified: true,
    },
  });

  if (!user || !user.passwordHash) {
    return { success: false, message: 'Invalid email or password.' };
  }

  if (user.accountStatus !== 'ACTIVE' || user.isSuspended) {
    return { success: false, message: 'This account has been suspended or deactivated.' };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { success: false, message: 'Account is temporarily locked. Please try again later.' };
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    const newCount = user.failedLoginCount + 1;
    const updateData: Record<string, unknown> = { failedLoginCount: newCount };
    if (newCount >= 5) {
      updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
    await prisma.user.update({ where: { id: user.id }, data: updateData });
    return { success: false, message: 'Invalid email or password.' };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });

  // A16b-2b: claim-on-login for VERIFIED accounts — catches guest bookings made
  // with this address after the account was verified. Uses the authenticated
  // user's own (verified) email, never a client-asserted one.
  if (user.emailVerified) {
    await claimGuestBookings(user.id, user.email).catch(() => {});
  }

  return {
    success: true,
    message: 'Login successful.',
    user: {
      id: user.id,
      email: user.email,
      name: user.name || '',
      phone: user.phone || '',
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  };
}

/**
 * Send a password reset email.
 */
export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; message: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  // Always return success to avoid email enumeration
  const successMessage =
    'If an account exists for this email, a password reset link has been sent.';

  if (!user) {
    return { success: true, message: successMessage };
  }

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.verificationToken.create({
    data: {
      identifier: `reset:${normalizedEmail}`,
      token,
      expires: new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  });

  // Send password reset email (fire and forget)
  sendPasswordResetEmail(normalizedEmail, token).catch(() => {});

  return { success: true, message: successMessage };
}

/**
 * Reset password using a valid token.
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const pwCheck = validatePasswordPolicy(newPassword);
  if (!pwCheck.valid) {
    return { success: false, message: pwCheck.errors[0] };
  }

  const record = await prisma.verificationToken.findUnique({ where: { token } });

  if (!record || record.expires < new Date() || !record.identifier.startsWith('reset:')) {
    return { success: false, message: 'Invalid or expired reset token.' };
  }

  const email = record.identifier.replace('reset:', '');
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { email },
    data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
  });

  // Delete the used token
  await prisma.verificationToken.delete({
    where: { token },
  });

  return { success: true, message: 'Your password has been reset successfully.' };
}

/**
 * A16b-2b: attach a newly-verified user's guest bookings to their account.
 *
 * SECURITY: `verifiedEmail` MUST be the account's own verified email (server-known
 * — from the token identifier at verification, or the authenticated user's row at
 * login). Never pass a client-asserted email. Only unclaimed bookings
 * (clientId IS NULL) whose guestEmail matches (case-insensitive) are linked, so a
 * user can only ever claim bookings sent to the address they proved they own.
 * Returns the number of bookings claimed.
 */
export async function claimGuestBookings(userId: string, verifiedEmail: string): Promise<number> {
  const email = verifiedEmail.toLowerCase().trim();
  if (!email) return 0;
  const result = await prisma.booking.updateMany({
    where: { clientId: null, guestEmail: { equals: email, mode: 'insensitive' } },
    data: { clientId: userId },
  });
  return result.count;
}

export type VerifyEmailStatus = 'verified' | 'already_verified' | 'expired' | 'invalid';

/**
 * A16b-2a: consume an email-verification token (one-click GET link).
 *
 * Idempotent + prefetch-safe: the token is NOT deleted on success, because email
 * clients pre-fetch links and users re-click. A re-hit therefore returns
 * `already_verified` (friendly) instead of a confusing `invalid`. The token only
 * flips the email-verified flag (harmless to re-run) and expires naturally after
 * VERIFICATION_TOKEN_EXPIRY_HOURS. The matched user is always resolved from the
 * server-stored token identifier — never from a client-asserted email.
 */
export async function verifyEmail(token: string): Promise<VerifyEmailStatus> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });

  // Not found: bad token, or one already cleaned up. Can't identify a user → invalid.
  if (!record || record.identifier.startsWith('reset:')) return 'invalid';

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
    return 'expired';
  }

  // Identity comes from the token record (server-known), not the request.
  const user = await prisma.user.findUnique({
    where: { email: record.identifier },
    select: { id: true, emailVerified: true },
  });
  if (!user) return 'invalid';

  if (user.emailVerified) return 'already_verified';

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date(), emailVerifiedAt: new Date() },
  });

  // A16b-2b: email ownership is now proven → attach any guest bookings made with
  // this address. Uses the server-known token identifier, never a client email.
  await claimGuestBookings(user.id, record.identifier).catch(() => {});

  return 'verified';
}

/**
 * A16b-2a: re-issue a verification email. Enumeration-safe — callers always get a
 * generic success; a fresh token is only created/sent when an unverified account
 * matches. Rate-limiting is applied at the route.
 */
export async function resendEmailVerification(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { emailVerified: true },
  });
  if (!user || user.emailVerified) return; // no account, or already verified → no-op

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.verificationToken.create({
    data: {
      identifier: normalized,
      token,
      expires: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
    },
  });
  sendEmailVerification(normalized, token).catch(() => {});
}

/**
 * Change an authenticated user's password.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const pwCheck = validatePasswordPolicy(newPassword);
  if (!pwCheck.valid) {
    return { success: false, message: pwCheck.errors[0] };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return { success: false, message: 'User not found.' };
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return { success: false, message: 'Current password is incorrect.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return { success: true, message: 'Your password has been changed successfully.' };
}

/**
 * Delete a user's account (soft-delete with GDPR compliance).
 */
export async function deleteAccount(
  userId: string
): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  // Cancel any active/pending bookings
  await prisma.booking.updateMany({
    where: {
      clientId: userId,
      status: {
        in: ['PENDING', 'AWAITING_CLEANER', 'CONFIRMED', 'ACCEPTED', 'CASCADE_EXHAUSTED'],
      },
    },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: 'Account deleted by user',
    },
  });

  // Soft-delete: mark as deleted, anonymise PII
  await prisma.user.update({
    where: { id: userId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      accountStatus: 'DEACTIVATED',
      name: '[deleted]',
      phone: null,
      email: `deleted_${userId}@deleted.rena.com`,
      passwordHash: null,
    },
  });

  // Log the deletion for GDPR audit
  await prisma.dataRetentionLog.create({
    data: {
      entityType: 'User',
      entityId: userId,
      action: 'ANONYMISED',
      reason: 'user_request',
    },
  });

  return { success: true, message: 'Your account has been deleted.' };
}
