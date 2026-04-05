/**
 * Auth API Tests
 * Tests authentication flow including signup and login route handlers
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(false),
}));

// Mock email service
jest.mock('@/lib/services/email.service', () => ({
  sendEmailVerification: jest.fn().mockResolvedValue(undefined),
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
}));

// Mock rate limiting to always allow
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 5, resetAt: Date.now() + 60000 }),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

describe('Auth API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/signup', () => {
    it('should require email, password, and name for signup', async () => {
      const { POST } = await import('@/app/api/auth/signup/route');

      const request = new Request('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'TestPass123!', name: 'Test User' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should require password for signup', async () => {
      const { POST } = await import('@/app/api/auth/signup/route');

      const request = new Request('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', name: 'Test User' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should require name for signup', async () => {
      const { POST } = await import('@/app/api/auth/signup/route');

      const request = new Request('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'StrongPass123!' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should reject weak passwords (less than 8 characters)', async () => {
      const { POST } = await import('@/app/api/auth/signup/route');

      // Mock registerUser to return password-too-short error
      const prisma = (await import('@/lib/db/prisma')).default;
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: '123',
          name: 'Test User',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should reject duplicate email addresses', async () => {
      const { POST } = await import('@/app/api/auth/signup/route');

      const prisma = (await import('@/lib/db/prisma')).default;
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
      });

      const request = new Request('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'StrongPass123!',
          name: 'Test User',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should require email and password for login', async () => {
      const { POST } = await import('@/app/api/auth/login/route');

      const request = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should require email for login', async () => {
      const { POST } = await import('@/app/api/auth/login/route');

      const request = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'SomePassword123!' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});
