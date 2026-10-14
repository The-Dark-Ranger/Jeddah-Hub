import { notFound } from 'next/navigation';

/** Any URL under a locale that no route matches lands here, so it renders
 *  the localized [locale]/not-found.tsx inside the site layout. */
export default function CatchAll() {
  notFound();
}
