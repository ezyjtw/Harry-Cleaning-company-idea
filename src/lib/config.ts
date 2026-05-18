function getEnvVar(name: string, required = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
}

export const config = {
  database: {
    url: getEnvVar('DATABASE_URL', false),
  },
  auth: {
    secret: getEnvVar('NEXTAUTH_SECRET', false),
    url: getEnvVar('NEXTAUTH_URL', false),
  },
  stripe: {
    publicKey: getEnvVar('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', false),
    secretKey: getEnvVar('STRIPE_SECRET_KEY', false),
    webhookSecret: getEnvVar('STRIPE_WEBHOOK_SECRET', false),
  },
  email: {
    host: getEnvVar('SMTP_HOST', false),
    port: parseInt(getEnvVar('SMTP_PORT', false) || '587'),
    user: getEnvVar('SMTP_USER', false),
    password: getEnvVar('SMTP_PASSWORD', false),
    from: getEnvVar('EMAIL_FROM', false),
  },
  app: {
    url: getEnvVar('NEXT_PUBLIC_APP_URL', false) || 'http://localhost:3000',
    name: getEnvVar('NEXT_PUBLIC_APP_NAME', false) || 'Rena Cleaning Network',
  },
} as const;
