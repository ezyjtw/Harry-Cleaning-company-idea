/** @type {import('next').NextConfig} */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// NEXTAUTH_URL must match the canonical domain users actually visit.
// Set NEXTAUTH_URL=https://www.renacleaning.co.uk in Railway env vars.
// Fallback to Railway's public domain only for preview/staging deployments.
if (!process.env.NEXTAUTH_URL) {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    process.env.NEXTAUTH_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
}

const nextConfig = {
  experimental: {
    instrumentationHook: true,
    // A13: keep pdfkit un-bundled so its runtime file reads resolve against the
    // real node_modules path (Next 14 key). Belt-and-suspenders — the statement
    // renderer also embeds its own fonts (base64) so it never reads pdfkit's
    // built-in .afm files.
    serverComponentsExternalPackages: ['pdfkit'],
  },

  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Performance
  poweredByHeader: false,
  compress: true,

  // Strict mode for catching bugs
  reactStrictMode: true,
};

module.exports = withNextIntl(nextConfig);
