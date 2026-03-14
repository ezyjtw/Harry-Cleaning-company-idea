/**
 * Structured logging utility.
 * Outputs JSON-formatted logs for production,
 * human-readable logs for development.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  requestId?: string;
  userId?: string;
  duration?: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const isProduction = process.env.NODE_ENV === 'production';
const minLevel = isProduction ? 'info' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

function formatLog(entry: LogEntry): string {
  if (isProduction) {
    return JSON.stringify(entry);
  }

  const timestamp = new Date(entry.timestamp).toLocaleTimeString();
  const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`;
  const context = entry.context ? ` [${entry.context}]` : '';
  const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  const error = entry.error ? ` Error: ${entry.error.message}` : '';
  const duration = entry.duration ? ` (${entry.duration}ms)` : '';

  return `${prefix}${context} ${entry.message}${data}${error}${duration}`;
}

function log(
  level: LogLevel,
  message: string,
  options?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>
) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...options,
  };

  const formatted = formatLog(entry);

  switch (level) {
    case 'debug':
    case 'info':
      // eslint-disable-next-line no-console
      console.log(formatted);
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(formatted);
      break;
    case 'error':
    case 'fatal':
      // eslint-disable-next-line no-console
      console.error(formatted);
      break;
  }
}

export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => log('debug', message, { data }),
  info: (message: string, data?: Record<string, unknown>) => log('info', message, { data }),
  warn: (message: string, data?: Record<string, unknown>) => log('warn', message, { data }),
  error: (message: string, error?: Error | unknown, data?: Record<string, unknown>) => {
    const errorInfo =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error
          ? { message: String(error) }
          : undefined;
    log('error', message, { error: errorInfo, data });
  },
  fatal: (message: string, error?: Error | unknown) => {
    const errorInfo =
      error instanceof Error ? { message: error.message, stack: error.stack } : undefined;
    log('fatal', message, { error: errorInfo });
  },

  // Context-specific loggers
  withContext: (context: string) => ({
    debug: (message: string, data?: Record<string, unknown>) =>
      log('debug', message, { context, data }),
    info: (message: string, data?: Record<string, unknown>) =>
      log('info', message, { context, data }),
    warn: (message: string, data?: Record<string, unknown>) =>
      log('warn', message, { context, data }),
    error: (message: string, error?: Error | unknown, data?: Record<string, unknown>) => {
      const errorInfo =
        error instanceof Error ? { message: error.message, stack: error.stack } : undefined;
      log('error', message, { context, error: errorInfo, data });
    },
  }),

  // Request logging
  request: (method: string, url: string, statusCode: number, duration: number, userId?: string) => {
    log('info', `${method} ${url} ${statusCode}`, {
      context: 'HTTP',
      duration,
      userId,
      data: { method, url, statusCode },
    });
  },

  // Booking event logging
  booking: (action: string, bookingId: string, data?: Record<string, unknown>) => {
    log('info', `Booking ${action}: ${bookingId}`, {
      context: 'Booking',
      data: { bookingId, ...data },
    });
  },

  // Payment logging
  payment: (action: string, paymentId: string, amount?: number) => {
    log('info', `Payment ${action}: ${paymentId}`, {
      context: 'Payment',
      data: { paymentId, amount },
    });
  },
};

// Export for use as default
export default logger;
