import type { MetadataRoute } from 'next';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { slugify } from '@/lib/slug';
import { SITE_URL, LOCALES } from '@/lib/seo';

/** Public, indexable static routes. Dashboard and login are intentionally
 *  excluded — see robots.ts for the matching disallow rules. */
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

function toEntries(path: string, lastModified: Date, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'], priority: number): MetadataRoute.Sitemap {
  return LOCALES.map(locale => ({
    url: `${SITE_URL}/${locale}${path}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(LOCALES.map(l => [l, `${SITE_URL}/${l}${path}`])),
    },
  }));
}

/** Individual initiative and Hub Activity pages both live in the
 *  `initiatives` collection (see firestore.rules), split by the `type`
 *  field — real initiatives never carry it, activities are tagged
 *  type:'hub_activity'. Published blog posts are their own collection. */
async function dynamicRoutes(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  try {
    const [initSnap, blogSnap] = await Promise.all([
      getDocs(collection(db, 'initiatives')),
      getDocs(query(collection(db, 'blogs'), where('status', '==', 'published'))),
    ]);

    const initiatives = initSnap.docs
      .map(d => d.data() as { type?: string; slug?: string; title?: string })
      .filter(d => !d.type)
      .flatMap(d => toEntries(`/projects/${d.slug || slugify(d.title || '')}`, lastModified, 'weekly', 0.6));

    const activities = initSnap.docs
      .map(d => d.data() as { type?: string; slug?: string; title?: string })
      .filter(d => d.type === 'hub_activity')
      .flatMap(d => toEntries(`/activities/${d.slug || slugify(d.title || '')}`, lastModified, 'monthly', 0.5));

    const posts = blogSnap.docs
      .flatMap(d => toEntries(`/news/${d.id}`, lastModified, 'monthly', 0.5));

    return [...initiatives, ...activities, ...posts];
  } catch {
    // Firestore unreachable at build time (e.g. no live credentials in this
    // environment) — fall back to just the static routes below rather than
    // failing the whole sitemap/build.
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticRoutes = ROUTES.flatMap(({ path, changeFrequency, priority }) =>
    toEntries(path, lastModified, changeFrequency, priority),
  );

  return [...staticRoutes, ...(await dynamicRoutes())];
}
