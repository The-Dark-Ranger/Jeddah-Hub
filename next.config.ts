import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { withBotId } from 'botid/next/config';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// The Content Security Policy. What it allows, and why:
//  - scripts: the site's own, plus Google reCAPTCHA v3 (google.com and
//    gstatic.com, added on demand by src/lib/recaptcha.ts). 'unsafe-inline'
//    stays because Next.js streams each page's data in inline <script> tags;
//    removing it needs a per-request nonce, which turns off the CDN caching
//    of every public page. React escapes all text, inline event handlers are
//    refused (script-src-attr 'none') and links are checked
//    (src/lib/sanitize.ts), so injected markup has no way to run.
//  - connect: Firebase Auth and Firestore (googleapis.com) and reCAPTCHA.
//  - images: any https address plus data:, because members may link a photo
//    hosted elsewhere and older photos are stored inline.
//  - no plugins (object-src 'none'), no framing by other sites
//    (frame-ancestors 'none'), and forms only post to this site.
// In development only, 'unsafe-eval' lets React's debugging tools run (they
// call eval(), which a production build never does).
const isDev = process.env.NODE_ENV !== 'production';
// Local test runs talk to Firebase's emulators (src/lib/emulators.ts).
const emulatorHosts = isDev && process.env.NEXT_PUBLIC_USE_EMULATORS === '1'
  ? ' http://127.0.0.1:9099 http://127.0.0.1:8085 ws://127.0.0.1:8085'
  : '';

const CSP = [
  "default-src 'self'",
  // In development, Vercel Analytics and Speed Insights load debug versions
  // from va.vercel-scripts.com; a deployed site serves them from /_vercel/.
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' https://va.vercel-scripts.com " : ''}https://www.google.com https://www.gstatic.com`,
  // No inline event-handler attributes (onerror=, onclick=…): React never
  // writes them, so even injected HTML can't run code through them.
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: https:",
  // No Realtime Database here, so no firebaseio.com.
  `connect-src 'self' https://*.googleapis.com https://*.google.com https://*.gstatic.com${emulatorHosts}`,
  "frame-src https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  // Forms on this site only ever post to itself (fetch calls aren't affected).
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Never let a stray http:// asset load on the https site.
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

// The site uses none of these powerful features, deny them outright so an
// injected third-party script couldn't request them either.
const PERMISSIONS_POLICY = [
  'camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()',
  'magnetometer=()', 'gyroscope=()', 'accelerometer=()', 'browsing-topics=()',
].join(', ');

const nextConfig: NextConfig = {
  // Don't advertise the framework/version in an X-Powered-By header.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
          // Isolates the browsing context from cross-origin openers while
          // still allowing OAuth-style sign-in popups (Firebase Auth).
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
      {
        // API responses carry per-request data and should never be cached
        // by a shared cache, except /api/media and /api/img, which serve
        // immutable photos with their own long-lived Cache-Control.
        source: '/api/:path((?!media/|img/).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // Members-only and sign-in pages stay out of search engines (and so
        // out of search-based reconnaissance), not just out of robots.txt.
        source: '/:locale(en|ar)/:area(dashboard|login)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

// withBotId adds the same-origin paths Vercel BotID's invisible challenge
// loads through (with their own framing headers, which override the strict
// ones above for those paths only); see src/lib/botCheck.ts.
export default withBotId(withNextIntl(nextConfig));
