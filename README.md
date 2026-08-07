# Jeddah Hub

Website for the Jeddah Hub - a local chapter of the World Economic Forum's
Global Shapers Community. Built with Next.js (App Router) and Firebase.

Bilingual (English/Arabic, RTL-aware) with a public site (about, projects,
news, blog, impact reports) and a role-gated dashboard for the Shapers and to manage initiatives and content.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- [next-intl](https://next-intl.dev) for i18n (`en`/`ar`)
- Firebase Auth + Firestore (client SDK) — Firestore Security Rules
  (`firestore.rules`) are the authorization boundary.
  officer)
- CSS Modules

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — lint
- `npx tsc --noEmit` — typecheck
