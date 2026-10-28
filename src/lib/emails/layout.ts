/* The shared look of every email (header, footer, building blocks), in
 * English or Arabic. Email apps only understand simple tables and inline
 * styles, so everything here is built that way. No remote images: the
 * site's bot protection can block email apps from loading them, so the two
 * logos are attached inline (logos.ts). */
import { escapeHtml } from '@/lib/escapeHtml';
import { HUB_LOGO_CID, WEF_LOGO_CID } from './logos';

export type Lang = 'en' | 'ar';
export const SITE = 'https://jeddahhub.org';

const BLUE = '#0f5a9f';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';

const BRAND = {
  en: {
    network: 'Global Shapers Community', name: 'Jeddah Hub', tagline: 'From Jeddah to the Globe',
    about: 'A Global Shapers Community Hub, an initiative of the World Economic Forum, uniting passionate young leaders in Jeddah.',
    location: 'Jeddah, Saudi Arabia', copyright: 'Global Shapers Community, Jeddah Hub',
    links: [['Initiatives', '/projects'], ['News', '/news'], ['Who We Are', '/about'], ['Contact', '/contact']],
  },
  ar: {
    network: 'مجتمع صنّاع العالم', name: 'مركز جدة', tagline: 'من جدة إلى العالم',
    about: 'مركزٌ ضمن مجتمع صنّاع العالم، إحدى مبادرات المنتدى الاقتصادي العالمي، يجمع نخبةً من القادة الشباب الطموحين في جدة.',
    location: 'جدة، المملكة العربية السعودية', copyright: 'مجتمع صنّاع العالم، مركز جدة',
    links: [['المبادرات', '/projects'], ['الأخبار', '/news'], ['من نحن', '/about'], ['تواصل معنا', '/contact']],
  },
} as const;

const SOCIALS = [
  ['LinkedIn', 'https://www.linkedin.com/company/global-shapers-jeddah-hub'],
  ['X', 'https://x.com/JeddahHub'],
  ['Instagram', 'https://www.instagram.com/jeddahhub'],
] as const;

/** A link to a page of the site in the reader's language. */
export const siteUrl = (lang: Lang, path = '') => `${SITE}/${lang}${path}`;

const start = (lang: Lang) => (lang === 'ar' ? 'right' : 'left');

/* ── Building blocks ── */

export const heading = (text: string) =>
  `<h2 style="margin:0 0 14px;font-size:24px;line-height:1.35;font-weight:800;color:${INK};">${text}</h2>`;

export const paragraph = (html: string) =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:1.8;color:#475569;">${html}</p>`;

export const sectionTitle = (text: string) =>
  `<p style="margin:28px 0 14px;font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${BLUE};">${text}</p>`;

export const button = (href: string, label: string) => `
  <table cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:10px;background:${BLUE};">
    <a href="${href}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
  </td></tr></table>`;

/** A two-column summary (label: value); values must already be escaped. */
export const infoTable = (lang: Lang, rows: [string, string][]) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;border:1px solid ${LINE};border-radius:12px;border-collapse:separate;">
    ${rows.map(([k, v], i) => `
    <tr>
      <td style="padding:12px 16px;width:34%;font-size:13px;color:${MUTED};vertical-align:top;text-align:${start(lang)};${i ? `border-top:1px solid ${LINE};` : ''}">${k}</td>
      <td style="padding:12px 16px;font-size:14px;font-weight:600;color:${INK};text-align:${start(lang)};${i ? `border-top:1px solid ${LINE};` : ''}">${v}</td>
    </tr>`).join('')}
  </table>`;

/** A quoted block of the visitor's own words (escaped here, newlines kept).
 *  dir=auto + text-align:start: an Arabic message reads right-to-left even
 *  inside the English hub email. */
export const quote = (lang: Lang, text: string) => `
  <div dir="auto" style="margin:4px 0 8px;padding:18px 20px;border-radius:12px;background:#f8fafc;border:1px solid ${LINE};border-${start(lang)}:4px solid ${BLUE};font-size:15px;line-height:1.75;color:#334155;white-space:pre-wrap;text-align:start;">${escapeHtml(text)}</div>`;

/** Icon + title + description rows. */
export const featureList = (items: readonly (readonly [string, string, string])[]) => `
  <table width="100%" cellpadding="0" cellspacing="0">
    ${items.map(([icon, title, desc]) => `
    <tr><td style="padding:0 0 16px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="width:46px;vertical-align:top;font-size:22px;line-height:1.3;">${icon}</td>
        <td>
          <p style="margin:0 0 3px;font-size:15px;font-weight:700;color:${INK};">${title}</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">${desc}</p>
        </td>
      </tr></table>
    </td></tr>`).join('')}
  </table>`;

/** Numbered steps (what happens next). */
export const steps = (items: readonly (readonly [string, string])[]) => `
  <table width="100%" cellpadding="0" cellspacing="0">
    ${items.map(([title, desc], i) => `
    <tr><td style="padding:0 0 14px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="width:46px;vertical-align:top;">
          <div style="width:30px;height:30px;line-height:30px;border-radius:50%;background:#e8f1fa;color:${BLUE};font-size:14px;font-weight:800;text-align:center;">${i + 1}</div>
        </td>
        <td>
          <p style="margin:4px 0 3px;font-size:15px;font-weight:700;color:${INK};">${title}</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">${desc}</p>
        </td>
      </tr></table>
    </td></tr>`).join('')}
  </table>`;

/** A 2-column grid of linked cards. */
export const linkCards = (lang: Lang, items: readonly (readonly [string, string, string, string])[]) => {
  const cell = ([icon, title, desc, href]: readonly [string, string, string, string]) => `
    <td width="50%" style="padding:6px;vertical-align:top;">
      <a href="${href}" style="display:block;padding:16px;border:1px solid ${LINE};border-radius:12px;text-decoration:none;text-align:${start(lang)};">
        <span style="font-size:20px;">${icon}</span>
        <p style="margin:8px 0 4px;font-size:15px;font-weight:700;color:${BLUE};">${title}</p>
        <p style="margin:0;font-size:13px;line-height:1.55;color:${MUTED};">${desc}</p>
      </a>
    </td>`;
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(`<tr>${cell(items[i])}${items[i + 1] ? cell(items[i + 1]) : '<td></td>'}</tr>`);
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 -6px;">${rows.join('')}</table>`;
};

/* ── Frame ── */

/** A header logo. Shown at its display size from a 2x image; styled so it
 *  can't be dragged or selected where mail apps allow that, and its alt
 *  text stays readable on the blue header when images are turned off. */
const logo = (cid: string, width: number, height: number, alt: string) =>
  `<img src="cid:${cid}" width="${width}" height="${height}" alt="${alt}" draggable="false" ` +
  `style="display:block;width:${width}px;height:${height}px;border:0;outline:none;color:#ffffff;font-size:12px;font-weight:700;` +
  `-webkit-user-drag:none;user-select:none;-webkit-user-select:none;pointer-events:none;">`;

export function emailLayout({ lang, title, preheader, body, footerNote }: {
  lang: Lang; title: string; preheader: string; body: string; footerNote: string;
}): string {
  const b = BRAND[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const font = lang === 'ar' ? "Tahoma,'Segoe UI',Arial,sans-serif" : "'Segoe UI',Helvetica,Arial,sans-serif";
  const navLinks = b.links.map(([label, path]) =>
    `<a href="${siteUrl(lang, path)}" style="color:${BLUE};text-decoration:none;font-weight:600;">${label}</a>`).join('&nbsp;&nbsp;·&nbsp;&nbsp;');
  const socials = SOCIALS.map(([label, href]) =>
    `<a href="${href}" style="color:${MUTED};text-decoration:none;">${label}</a>`).join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:${font};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 28px rgba(15,23,42,0.08);text-align:${start(lang)};">
        <tr>
          <td style="background:${BLUE};background:linear-gradient(135deg,#0a3272 0%,${BLUE} 55%,#1a73e8 100%);padding:28px 40px 26px;">
            <table cellpadding="0" cellspacing="0" dir="ltr"><tr>
              <td style="vertical-align:middle;">${logo(HUB_LOGO_CID, 71, 68, `${b.network}, ${b.name}`)}</td>
              <td style="vertical-align:middle;padding:0 18px;"><div style="width:1px;height:46px;background:rgba(255,255,255,0.35);"></div></td>
              <td style="vertical-align:middle;">${logo(WEF_LOGO_CID, 74, 46, lang === 'ar' ? 'المنتدى الاقتصادي العالمي' : 'World Economic Forum')}</td>
            </tr></table>
            <p style="margin:16px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">${b.name} · ${b.tagline}</p>
          </td>
        </tr>
        <tr><td style="height:4px;background:#5ea3e0;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:36px 40px 30px;">${body}</td></tr>
        <tr>
          <td style="padding:22px 40px;border-top:1px solid ${LINE};background:#f8fafc;">
            <p style="margin:0 0 10px;font-size:14px;">${navLinks}</p>
            <p style="margin:0 0 14px;font-size:13px;">${socials}</p>
            <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#94a3b8;">${footerNote}</p>
            <p style="margin:0 0 4px;font-size:12px;line-height:1.6;color:#94a3b8;">${b.about}</p>
            <p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} ${b.copyright} · ${b.location}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** A date and time in Jeddah, written the way the reader's language does. */
export function jeddahTime(lang: Lang, at = new Date()): string {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-ca-gregory' : 'en-GB', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Riyadh',
  }).format(at);
}
