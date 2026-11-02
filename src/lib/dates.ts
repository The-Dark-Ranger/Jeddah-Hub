/* Dates and numbers shown on the site. Public pages are rendered first on the
 * server and then again in the visitor's browser, and the two must produce the
 * same text, or React throws the page away and rebuilds it in the browser. */

/** The language tag for formatting. The calendar and digits are spelled out
 *  because the defaults differ: for Arabic, Node picks the Hijri calendar while
 *  browsers pick the Gregorian one. */
export const intlLocale = (locale: string) => (locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-arab' : 'en-US');

/** Dates are shown in the hub's time zone: the server's clock is on UTC, so
 *  near midnight it could otherwise show a different day from the browser. */
const HUB_TIME_ZONE = 'Asia/Riyadh';

export function formatDate(value: string | number | Date, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Date(value).toLocaleDateString(intlLocale(locale), { timeZone: HUB_TIME_ZONE, ...options });
}
