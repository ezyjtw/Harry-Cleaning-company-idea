import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // A1-P1: transactional/authed surfaces are crawl waste — keep bots on
        // the marketing + directory pages. '/cleaner/' (portal) does NOT match
        // '/cleaners' (public directory) — the trailing slash is load-bearing.
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/account/',
          '/book/',
          '/booking/',
          '/booking-confirmation/',
          '/messages',
          '/notifications',
          '/cleaner/',
          '/disputes',
          '/verify',
          '/unsubscribe',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
