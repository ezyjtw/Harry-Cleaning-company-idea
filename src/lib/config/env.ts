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
    default: 'http://localhost:3000',
    description: 'NextAuth.js base URL',
  },
  { name: 'RYFT_SECRET_KEY', required: false, description: 'Ryft secret API key' },
  { name: 'RYFT_WEBHOOK_SECRET', required: false, description: 'Ryft webhook signing secret' },
  { name: 'NEXT_PUBLIC_RYFT_PUBLIC_KEY', required: false, description: 'Ryft publishable key' },
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
    default: 'http://localhost:3000',
    description: 'Public application URL',
  },
  {
    name: 'NEXT_PUBLIC_APP_NAME',
    required: false,
    default: 'Rena Cleaning Network',
    description: 'Application display name',
  },
  { name: 'SENTRY_DSN', required: false, description: 'Sentry error tracking DSN' },
  { name: 'REDIS_URL', required: false, description: 'Redis connection string for caching' },
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
