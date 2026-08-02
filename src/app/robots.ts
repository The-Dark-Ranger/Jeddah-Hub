import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/*/dashboard',
        '/*/login',
        '/api/',
        // Legacy duplicate of /news, never linked from anywhere in the site.
        '/*/blog',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
