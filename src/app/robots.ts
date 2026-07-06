import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk'
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/dashboard/', '/account/'] },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
