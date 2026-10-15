# Jeddah Hub

The official website for **Jeddah Hub**, my local chapter of the [World Economic
Forum's Global Shapers Community](https://www.globalshapers.org/), a network of
young people driving grassroots change in their cities. I built this site to give
our hub a real public presence and a working operations tool at the same time: a
bilingual public website that tells our story and showcases our initiatives, and a
role-gated dashboard our Shapers and curators actually use to run the hub day to
day.

It's a single Next.js application that serves both halves. Nothing here is a
template or a demo: every feature exists because a specific need on the hub came
up and I built a way to handle it.

**Live site:** [jeddahhub.org](https://jeddahhub.org)

## What's on the site

### Public pages

- **Home**: the hub's story, our place in the World Economic Forum network,
  impact numbers, the current Hub Activity, curator-picked featured
  initiatives, our Shapers and partners.
- **Who We Are**: the current curatorship, active Shapers and alumni, each with
  a bio, photo and social links pulled live from the database.
- **Initiatives**: every project the hub runs or has run, searchable and
  filterable by area, with a detail page per initiative (challenge, goal,
  impact, key facts, timeline, gallery and team).
- **Hub Activities & Workshops**: a page per event, with an optional
  registration form the organisers build themselves. Responses land in the
  dashboard and export to Excel.
- **News**: articles written by Shapers and curators, with likes, sharing and
  related stories.
- **Become a Shaper**: the recruitment page, linking to the World Economic
  Forum's own application platform.
- **Contact**: a reCAPTCHA-protected message form, plus a newsletter signup
  with a real welcome email.
- **Privacy Policy** and **Terms of Use**.

Everything is available in English and Arabic (with full right-to-left layout)
and in light and dark themes.

### The dashboard

Every member signs in to one shared dashboard, but what they see depends on
their role:

| Role | What they can do |
|---|---|
| **Shaper / Alumni** | Manage their profile, browse and join initiatives, propose a new initiative or Hub Activity for review, and write blog posts. |
| **Initiative Lead** | Everything a Shaper can, plus manage their own initiative: edit its content and photos, review join requests, request that a member be added or removed, and export a member report. |
| **Curator / Vice Curator** | Full administrative control: approve proposals and membership requests, manage every initiative and Hub Activity, choose the homepage's featured initiatives, assign member roles, moderate posts, read contact messages and export the newsletter list. |
| **Impact Officer** | Manages initiatives and Hub Activities and publishes posts, without the curator-only tools (roles, messages, featuring, exports). |

Every permission is enforced twice: once in the UI, so people only see what's
relevant to them, and again in **Firestore Security Rules**
([`firestore.rules`](firestore.rules)), which is the actual authorization
boundary.

## Tech stack

- **[Next.js 16](https://nextjs.org)** (App Router), React 19 and TypeScript
- **[next-intl](https://next-intl.dev)** for English/Arabic with RTL layout
- **Firebase**: Authentication and Firestore (client SDK)
- **CSS Modules**: no UI framework, a hand-built design system
- **[Resend](https://resend.com)** for transactional email
- **Google reCAPTCHA v3** on the public forms
- **[ExcelJS](https://github.com/exceljs/exceljs)** for `.xlsx` exports
- Hosted on **[Vercel](https://vercel.com)**

## Project structure

```
src/
├── app/
│   ├── [locale]/            # Every localized route (/en, /ar): public pages
│   │   │                    # and the whole /dashboard tree
│   │   └── dashboard/
│   │       ├── curator/     # Curator / Vice Curator pages
│   │       ├── impact/      # Impact Officer pages
│   │       └── shaper/      # Pages shared by every signed-in member
│   └── api/                 # Server routes: invite emails, newsletter welcome,
│                            # reCAPTCHA verification, email validation
├── components/              # Shared UI (navbar, footer, form builders, …)
├── context/                 # Auth and theme providers
├── i18n/                    # next-intl routing and config
└── lib/                     # Firebase client, shared types and helpers

messages/
├── en.json                  # Every English string
└── ar.json                  # Its Arabic counterpart, kept in lockstep

firestore.rules              # The security boundary, documented inline
.github/workflows/           # Deploys firestore.rules when it changes
```

## Getting started

**Prerequisites:** Node.js 20+ and a Firebase project with **Authentication**
(Email/Password) and **Firestore** enabled.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

[`.env.example`](.env.example) lists every setting the site reads and where to
find each value. Without the Firebase values the public pages still render,
but no live data loads.

## Scripts

```bash
npm run dev        # Local dev server
npm run build      # Production build
npm run start      # Serve a production build locally
npm run lint       # ESLint
npm run typecheck  # TypeScript, no output
```

## Deployment

- **Website:** every push to `main` deploys to Vercel automatically. The
  environment variables from `.env.example` are set in the Vercel project.
- **Firestore rules:** the
  [Deploy Firestore Rules](.github/workflows/deploy-firebase-rules.yml)
  workflow publishes `firestore.rules` whenever it changes on `main`. It needs
  two repository secrets, `FIREBASE_SERVICE_ACCOUNT` (a service account JSON
  key with the *Firebase Rules Admin* role) and `FIREBASE_PROJECT_ID`. Until
  they're added the workflow skips itself; rules can also be published by hand
  with `npx firebase-tools deploy --only firestore`.

## A note on privacy

Shapers' names, photos, bios and event sign-ups live in Firestore, not in this
repository; nothing in the code or its history contains anyone's private
information or credentials. What each role can see and do is governed by
`firestore.rules`, and the site's Privacy Policy and Terms of Use describe what
is collected and why.

---

Built and maintained by Mohammed Alshawi, Curator of Jeddah Hub 2026/2027, part of the
[Global Shapers Community](https://www.globalshapers.org/), an initiative of
the [World Economic Forum](https://www.weforum.org/).
