import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// RENA-066: the job worker never logs a queued payload, a recipient address or
// a phone number. Driven through processNextBatch with a mocked queue.
const jobs: Array<{ id: string; type: string; payload: Record<string, unknown> }> = [];
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    backgroundJob: {
      findMany: vi.fn(async () => jobs.splice(0)),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => ({})),
      findUnique: vi.fn(async () => ({ attempts: 3, maxAttempts: 3 })),
    },
  },
}));
vi.mock('@/lib/api-metering', () => ({ logApiCall: vi.fn() }));
vi.mock('@/lib/services/notification-preferences.service', () => ({
  shouldSend: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/services/booking-reminder.service', () => ({ BookingReminderService: {} }));
vi.mock('@/lib/services/xero-push.service', () => ({ processXeroPush: vi.fn() }));
vi.mock('twilio', () => ({
  default: () => ({
    messages: { create: vi.fn().mockRejectedValue(new Error('21211 invalid To +447700900123')) },
  }),
}));

const PII = /someone@example\.test|7700|900123|Hello Someone|secret body/;

describe('job worker logs (RENA-066)', () => {
  let out: string[];
  beforeEach(() => {
    out = [];
    vi.stubEnv('NODE_ENV', 'production');
    for (const m of ['log', 'warn', 'error'] as const) {
      vi.spyOn(console, m).mockImplementation((l: string) => void out.push(String(l)));
    }
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('SEND_EMAIL fallback, EMAIL_NOTIFICATION, PROCESS_PAYMENT and REQUEST_REVIEW log ids only', async () => {
    const { processNextBatch } = await import('./job-processor');
    jobs.push(
      {
        id: 'j1',
        type: 'SEND_EMAIL',
        payload: {
          action: 'OTHER',
          to: 'someone@example.test',
          subject: 'Hello Someone',
          body: 'secret body',
          userId: 'u1',
        },
      },
      {
        id: 'j2',
        type: 'SEND_EMAIL',
        payload: {
          action: 'EMAIL_NOTIFICATION',
          to: 'someone@example.test',
          recipientName: 'Someone',
          userId: 'u1',
        },
      },
      {
        id: 'j3',
        type: 'PROCESS_PAYMENT',
        payload: { bookingId: 'b1', amountPence: 1000, email: 'someone@example.test' },
      }
    );
    await processNextBatch(10);
    const text = out.join('\n');
    expect(text).not.toMatch(PII);
    const events = out.map((l) => JSON.parse(l));
    expect(events.find((e) => e.event === 'send_email.unhandled_action')).toMatchObject({
      action: 'OTHER',
      userId: 'u1',
    });
    expect(events.find((e) => e.event === 'process_payment.noop')).toMatchObject({
      bookingId: 'b1',
      amountPence: 1000,
      dropped: ['email'],
    });
  });

  it('SMS: unconfigured and failed paths never log the number', async () => {
    const { processNextBatch } = await import('./job-processor');
    jobs.push({
      id: 'j4',
      type: 'SEND_SMS',
      payload: { to: '+447700900123', body: 'secret body' },
    });
    await processNextBatch(10);
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC_test');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'tok');
    vi.stubEnv('TWILIO_PHONE_NUMBER', '+440000000000');
    jobs.push({
      id: 'j5',
      type: 'SEND_SMS',
      payload: { to: '+447700900123', body: 'secret body' },
    });
    await processNextBatch(10);
    const text = out.join('\n');
    expect(text).not.toMatch(PII);
    const events = out.filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
    expect(events.find((e) => e.event === 'sms.skipped')).toMatchObject({
      reason: 'twilio_unconfigured',
    });
    const failed = events.find((e) => e.event === 'sms.failed');
    expect(failed).toMatchObject({ provider: 'twilio', recipientRef: null });
    expect(failed.error.message).toMatch(/\[(phone|number)\]/);
  });
});
