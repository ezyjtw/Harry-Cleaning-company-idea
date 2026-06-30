type EnvVarConfig = {
  name: string;
  required: boolean;
  default?: string;
  validate?: (value: string) => boolean;
  description: string;
};

const ENV_SCHEMA: EnvVarConfig[] = [
  { name: 'DATABASE_URL', required: true, description: 'PostgreSQL connection string' },
  { name: 'NEXTAUTH_SECRET', required: true, description: 'NextAuth.js secret for JWT signing' },
  {
    name: 'NEXTAUTH_URL',
    required: true,
    default: process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000',
    description: 'NextAuth.js base URL',
  },
  {
    name: 'SMTP_HOST',
    required: false,
    default: 'smtp.gmail.com',
    description: 'SMTP server host',
  },
  {
    name: 'SMTP_PORT',
    required: false,
    default: '587',
    description: 'SMTP server port',
    validate: (v) => !isNaN(parseInt(v)),
  },
  { name: 'SMTP_USER', required: false, description: 'SMTP username' },
  { name: 'SMTP_PASSWORD', required: false, description: 'SMTP password' },
  {
    name: 'EMAIL_FROM',
    required: false,
    default: 'noreply@rena.com',
    description: 'Default sender email',
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: false,
    default: process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'http://localhost:3000',
    description: 'Public application URL',
  },
  {
    name: 'NEXT_PUBLIC_APP_NAME',
    required: false,
    default: 'Rena Cleaning Network',
    description: 'Application display name',
  },
  { name: 'RESEND_API_KEY', required: true, description: 'Resend API key for transactional email' },
  {
    name: 'RESEND_FROM_EMAIL',
    required: true,
    description: 'Verified sender address for Resend (e.g. "Rena <noreply@yourdomain.com>")',
  },
  {
    name: 'RESEND_NOTIFICATION_EMAIL',
    required: true,
    description: 'Founder email address for signup notification alerts',
  },
  { name: 'SENTRY_DSN', required: false, description: 'Sentry error tracking DSN' },
  { name: 'REDIS_URL', required: false, description: 'Redis connection string for caching' },
  {
    name: 'GETADDRESS_API_KEY',
    required: false,
    description:
      'getAddress.io API key for postcode→address autocomplete (server-side only). When unset, the address lookup endpoint returns 503 and the booking UI falls back to manual structured entry.',
  },
  { name: 'R2_ACCOUNT_ID', required: true, description: 'Cloudflare R2 account ID' },
  { name: 'R2_ACCESS_KEY_ID', required: true, description: 'Cloudflare R2 access key ID' },
  { name: 'R2_SECRET_ACCESS_KEY', required: true, description: 'Cloudflare R2 secret access key' },
  { name: 'R2_BUCKET_NAME', required: true, description: 'Cloudflare R2 bucket name' },
  {
    name: 'DOCUMENT_ENCRYPTION_KEY',
    required: true,
    description: 'Master encryption key for document storage (min 32 chars)',
    validate: (v) => v.length >= 32,
  },
  { name: 'STRIPE_SECRET_KEY', required: true, description: 'Stripe secret API key for Connect' },
  {
    name: 'STRIPE_PUBLISHABLE_KEY',
    required: true,
    description: 'Stripe publishable key (server-side)',
  },
  {
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    required: true,
    description: 'Stripe publishable key (client-side, exposed to browser)',
  },
  { name: 'STRIPE_WEBHOOK_SECRET', required: true, description: 'Stripe webhook signing secret' },
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_SCHEMA) {
    const value = process.env[envVar.name];

    if (envVar.required && !value) {
      errors.push(`Missing required environment variable: ${envVar.name} - ${envVar.description}`);
    } else if (!envVar.required && !value && !envVar.default) {
      warnings.push(
        `Optional environment variable not set: ${envVar.name} - ${envVar.description}`
      );
    }

    if (value && envVar.validate && !envVar.validate(value)) {
      errors.push(`Invalid value for ${envVar.name}: validation failed`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name];
  if (!value) {
    const schema = ENV_SCHEMA.find((e) => e.name === name);
    return fallback ?? schema?.default ?? '';
  }
  return value;
}

export function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
