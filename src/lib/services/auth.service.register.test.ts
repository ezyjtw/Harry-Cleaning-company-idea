import { beforeEach, describe, expect, it, vi } from 'vitest';

// RENA-077 (James-ruled): signup still creates the account when the
// verification email fails, and says so honestly.
// A plain function rather than vi.fn: the runner's mock tracking reports a
// rejected return value as a failure, and one case here rejects on purpose.
let sendImpl: () => Promise<boolean> = async () => true;
vi.mock('@/lib/services/email.service', () => ({
  sendEmailVerification: () => sendImpl(),
  sendPasswordResetEmail: vi.fn(),
  sendSignupNotification: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/db/prisma', () => {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'u1',
        email: 'new@example.test',
        name: 'New Person',
        phone: '',
        role: 'CLIENT',
        createdAt: new Date('2026-10-06T12:00:00Z'),
      }),
    },
    verificationToken: { create: vi.fn().mockResolvedValue({}) },
    cleanerProfile: { create: vi.fn() },
  };
  return { default: prisma, prisma };
});

import { registerUser } from './auth.service';

const input = {
  email: 'new@example.test',
  password: 'Str0ng!Passw0rd',
  name: 'New Person',
  phone: '',
  role: 'CLIENT' as const,
};

describe('registerUser verification email (RENA-077)', () => {
  beforeEach(() => {
    sendImpl = async () => true;
  });

  it('creates the account and reports the failed send honestly', async () => {
    sendImpl = async () => false;
    const r = await registerUser(input);
    expect(r.success).toBe(true);
    expect(r.user?.id).toBe('u1');
    expect(r.verificationEmailSent).toBe(false);
    expect(r.message).toBe("Account created, but we couldn't send the verification email.");
    expect(r.message).not.toMatch(/check your email/i);
  });

  it('a thrown send counts as not sent', async () => {
    sendImpl = async () => {
      throw new Error('provider down');
    };
    const r = await registerUser(input);
    expect(r.success).toBe(true);
    expect(r.verificationEmailSent).toBe(false);
  });

  it('a real send says check your email', async () => {
    sendImpl = async () => true;
    const r = await registerUser(input);
    expect(r.verificationEmailSent).toBe(true);
    expect(r.message).toMatch(/check your email/i);
  });
});
