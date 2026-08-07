import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Kept permissive on script/connect/frame sources deliberately — this app
// talks to Firebase Auth/Firestore (googleapis.com), Google reCAPTCHA v3
// (google.com/gstatic.com, loaded as a classic <script> in layout.tsx), and
// Google Fonts, and lets curators paste arbitrary external image URLs
// (ImageUploader) alongside the base64 data-URI images it also stores —
// hence img-src allows any https origin plus data:. A CSP that's too tight
// to verify against a live Firebase project from this sandbox risks
// silently breaking login; the meaningful hardening here is object-src
// 'none' and frame-ancestors 'none' (clickjacking), not a narrow allowlist.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.googleapis.com https://*.google.com https://*.gstatic.com https://*.firebaseio.com wss://*.firebaseio.com",
  "frame-src https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
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
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
