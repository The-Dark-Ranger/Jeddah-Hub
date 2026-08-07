# Jeddah Hub

Website for the Jeddah Hub - a local chapter of the World Economic Forum's
Global Shapers Community. Built with Next.js (App Router) and Firebase.

Bilingual (English/Arabic, RTL-aware) with a public site (about, projects,
news, blog, impact reports) and a role-gated dashboard for shapers, curators,
and impact officers to manage initiatives, members, and content.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- [next-intl](https://next-intl.dev) for i18n (`en`/`ar`)
- Firebase Auth + Firestore (client SDK) — Firestore Security Rules
  (`firestore.rules`) are the authorization boundary; see that file for the
  full role model (shaper / alumni / curator / vice curator / impact
  officer)
- CSS Modules

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create a `.env.local` with:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

NEXT_PUBLIC_SITE_URL=

NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=

RESEND_API_KEY=
FROM_EMAIL=
```

None of these values are committed to the repo — `.env*` is git-ignored.

## Firestore rules deployment

`firestore.rules` and `firestore.indexes.json` deploy automatically via
`.github/workflows/deploy-firebase-rules.yml` on every push to `main`. That
workflow requires the `FIREBASE_SERVICE_ACCOUNT` and `FIREBASE_PROJECT_ID`
repository secrets to be configured; it no-ops safely if they're absent.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint
- `npx tsc --noEmit` — typecheck
