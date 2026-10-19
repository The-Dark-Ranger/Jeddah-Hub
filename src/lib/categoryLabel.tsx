import { useTranslations } from 'next-intl';

/** Translation key for a stored category: "Economic Empowerment" ->
 *  "economic_empowerment", "Arts & Culture" -> "arts_culture". */
export function categoryKey(category: string): string {
  return category.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** A category in the current language, for use directly in JSX. */
export function CategoryLabel({ category }: { category: string }) {
  return useCategoryLabel()(category);
}

/** Returns a function that shows a category in the current language.
 *  Categories are stored in English; known ones get their translation
 *  (messages → Categories), custom ones show as typed. */
export function useCategoryLabel() {
  const tc = useTranslations('Categories');
  return (category: string) => {
    const key = categoryKey(category);
    return key && tc.has(key as 'all') ? tc(key as 'all') : category;
  };
}
