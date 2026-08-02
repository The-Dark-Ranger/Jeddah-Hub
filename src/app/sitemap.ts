import type { MetadataRoute } from 'next';
import { SITE_URL, LOCALES } from '@/lib/seo';

/** Public, indexable routes. Dashboard, login, and legacy /blog (superseded
 *  by /news, never linked) are intentionally excluded — see robots.ts for
 *  the matching disallow rules. */
const ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '',                 changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/about',           changeFrequency: 'monthly', priority: 0.8 },
  { path: '/projects',        changeFrequency: 'weekly',  priority: 0.9 },
  { path: '/news',            changeFrequency: 'daily',   priority: 0.7 },
  { path: '/become-a-shaper', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/contact',         changeFrequency: 'yearly',  priority: 0.5 },
  { path: '/privacy-policy',  changeFrequency: 'yearly',  priority: 0.3 },
  { path: '/terms-of-use',    changeFrequency: 'yearly',  priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return ROUTES.flatMap(({ path, changeFrequency, priority }) =>
    LOCALES.map(locale => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified,
      changeFrequency,
      priority,
      alternates: {
        languages: Object.fromEntries(LOCALES.map(l => [l, `${SITE_URL}/${l}${path}`])),
      },
    })),
  );
}
