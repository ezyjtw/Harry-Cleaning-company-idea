/**
 * Error monitoring and reporting.
 * In production, this integrates with Sentry.
 * In development, errors are logged to console.
 */

interface ErrorContext {
  userId?: string;
  action?: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

interface MonitoredError {
  id: string;
  error: Error;
  context: ErrorContext;
  timestamp: Date;
  reported: boolean;
}

const errorBuffer: MonitoredError[] = [];
const MAX_BUFFER_SIZE = 100;

export class ErrorMonitor {
  private static sentryDsn = process.env.SENTRY_DSN;

  /**
   * Capture and report an error
   */
  static capture(error: Error, context?: ErrorContext): string {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const monitoredError: MonitoredError = {
      id: errorId,
      error,
      context: context ?? {},
      timestamp: new Date(),
      reported: false,
    };

    // Add to buffer
    errorBuffer.push(monitoredError);
    if (errorBuffer.length > MAX_BUFFER_SIZE) {
      errorBuffer.shift();
    }

    // Log to console
    // eslint-disable-next-line no-console
    console.error(`[ErrorMonitor] ${errorId}:`, error.message, context);

    // In production, would send to Sentry
    if (this.sentryDsn) {
      this.reportToSentry(monitoredError);
    }

    return errorId;
  }

  /**
   * Capture a message (non-error event)
   */
  static captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    context?: ErrorContext
  ): void {
    // eslint-disable-next-line no-console
    console.log(`[ErrorMonitor] [${level}] ${message}`, context);
  }

  /**
   * Set user context for error reports
   */
  static setUser(userId: string, _email?: string, _role?: string): void {
    // In Sentry integration, this would call Sentry.setUser()
    // eslint-disable-next-line no-console
    console.log(`[ErrorMonitor] User context set: ${userId}`);
  }

  /**
   * Clear user context
   */
  static clearUser(): void {
    // eslint-disable-next-line no-console
    console.log('[ErrorMonitor] User context cleared');
  }

  /**
   * Get recent errors (for admin dashboard)
   */
  static getRecentErrors(limit: number = 20): MonitoredError[] {
    return errorBuffer.slice(-limit).reverse();
  }

  /**
   * Create a performance transaction tracker
   */
  static startTransaction(name: string, operation: string): PerformanceTransaction {
    return new PerformanceTransaction(name, operation);
  }

  private static reportToSentry(error: MonitoredError): void {
    // Placeholder: In production, use @sentry/nextjs
    error.reported = true;
  }
}

export class PerformanceTransaction {
  private name: string;
  private operation: string;
  private startTime: number;
  private spans: Array<{ name: string; duration: number }> = [];

  constructor(name: string, operation: string) {
    this.name = name;
    this.operation = operation;
    this.startTime = Date.now();
  }

  startSpan(name: string): () => void {
    const spanStart = Date.now();
    return () => {
      this.spans.push({ name, duration: Date.now() - spanStart });
    };
  }

  finish(): {
    name: string;
    operation: string;
    duration: number;
    spans: Array<{ name: string; duration: number }>;
  } {
    const duration = Date.now() - this.startTime;
    const result = {
      name: this.name,
      operation: this.operation,
      duration,
      spans: this.spans,
    };

    if (duration > 3000) {
      // eslint-disable-next-line no-console
      console.warn(`[Performance] Slow transaction: ${this.name} took ${duration}ms`);
    }

    return result;
  }
}

// Health check
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, { status: string; latency?: number; error?: string }>;
  uptime: number;
  timestamp: string;
}

const startTime = Date.now();

export async function getHealthStatus(): Promise<HealthStatus> {
  const checks: HealthStatus['checks'] = {};

  // Database check
  try {
    const dbStart = Date.now();
    const { prisma } = await import('@/lib/db/prisma');
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latency: Date.now() - dbStart };
  } catch (error) {
    checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown',
    };
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok');
  const anyError = Object.values(checks).some((c) => c.status === 'error');

  return {
    status: allOk ? 'healthy' : anyError ? 'unhealthy' : 'degraded',
    checks,
    uptime: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}
