import { getEnvVar } from './env';

export const appConfig = {
  database: {
    url: getEnvVar('DATABASE_URL'),
  },
  auth: {
    secret: getEnvVar('NEXTAUTH_SECRET'),
    url: getEnvVar('NEXTAUTH_URL'),
  },
  stripe: {
    publicKey: getEnvVar('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
    secretKey: getEnvVar('STRIPE_SECRET_KEY'),
    webhookSecret: getEnvVar('STRIPE_WEBHOOK_SECRET'),
  },
  email: {
    host: getEnvVar('SMTP_HOST', 'smtp.gmail.com'),
    port: parseInt(getEnvVar('SMTP_PORT', '587')),
    user: getEnvVar('SMTP_USER'),
    password: getEnvVar('SMTP_PASSWORD'),
    from: getEnvVar('EMAIL_FROM', 'noreply@rena.com'),
  },
  app: {
    url: getEnvVar('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
    name: getEnvVar('NEXT_PUBLIC_APP_NAME', 'Rena Cleaning Network'),
  },
  redis: {
    url: getEnvVar('REDIS_URL'),
  },
  sentry: {
    dsn: getEnvVar('SENTRY_DSN'),
  },
} as const;

export { validateEnvironment, getEnvVar, requireEnvVar } from './env';
