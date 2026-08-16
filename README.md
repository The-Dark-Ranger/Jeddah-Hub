# Jeddah Hub

The official website for **Jeddah Hub**, my local chapter of the [World Economic
Forum's Global Shapers Community](https://www.globalshapers.org/) — a network of
young people driving grassroots change in their cities. I built this site to give
our hub a real public presence and a working operations tool at the same time: a
bilingual public website that tells our story and showcases our initiatives, and a
role-gated dashboard our Shapers and curators actually use to run the hub day to
day.

It's a single Next.js application that serves both halves. Nothing here is a
template or a demo — every feature exists because a specific need on the hub
came up and I built a way to handle it: role-based access built around how a
volunteer-run organization actually operates, initiative and event management
with a full lifecycle from proposal to approval, and an editorial pipeline for
blog posts and impact reports for our transparency.

## Live site

**[jeddahhub.org](https://jeddahhub.org)**

## What's on the site

### Public pages

- **Home** — the hub's story, a rotating spotlight of active initiatives, and a
  live-updating stats section.
- **Who We Are** — the current curatorship, active Shapers, and alumni, each
  with a bio, photo, and social links pulled live from the database.
- **Initiatives** — every project the hub runs or has run, filterable by
  category, with a full detail page per initiative (problem, objective, impact,
  photo gallery, and team).
- **Hub Activities & Workshops** — a public events page. Each activity can carry
  a custom registration form a curator builds question by question (short
  answer, long answer, dropdown, yes/no), and responses land straight in the
  curator's dashboard.
- **News / Blog** — articles written by Shapers and curators, with likes and
  comments open to the whole community, guests included.
- **Become a Shaper** — the recruitment page, linking out to the World Economic
  Forum's own application platform.
- **Contact** — a message form protected by reCAPTCHA, plus a newsletter
  signup with a real welcome email.
- **Privacy Policy** and **Terms of Use** — because a site that collects real
  people's names, photos, and event registrations should actually say so.

### The dashboard

Every member signs in to one shared dashboard, but what they see depends on
their role:

| Role | What they can do |
|---|---|
| **Shaper / Alumni** | Manage their profile, browse and join initiatives, propose a brand-new initiative or Hub Activity for review, and write blog posts. |
| **Initiative Lead** | Everything a Shaper can, plus manage their own initiative: edit its content and photos, review join requests, request that a member be added or removed, and export a member report. |
| **Curator / Vice Curator** | Full administrative control — approve or decline initiative and activity proposals and membership requests, manage every initiative and Hub Activity, assign member roles, moderate blog posts, read contact messages, and export the newsletter list. |
| **Impact Officer** | A curator-adjacent role focused on projects and impact reporting — manages initiatives and publishes impact reports without the full curator toolset. |

Every one of those permissions is enforced twice: once in the UI (so people
only see what's relevant to them) and again in **Firestore Security Rules**
(`firestore.rules`), which is the actual authorization boundary — the UI layer
is just for a good experience, not the thing keeping data safe.

## Tech stack

- **[Next.js 16](https://nextjs.org)** (App Router) + React 19 + TypeScript
- **[next-intl](https://next-intl.dev)** for full bilingual support (English /
  Arabic) — every page, form, and email template is translated, with proper
  RTL layout for Arabic
- **Firebase** — Authentication and Firestore (client SDK); Firestore Security
  Rules are the real access-control layer, not the app code
- **CSS Modules** — no UI framework dependency, hand-built design system
- **[Resend](https://resend.com)** for transactional email (newsletter welcome
  emails, invite emails)
- **Google reCAPTCHA v3** on public-facing forms
- **[ExcelJS](https://github.com/exceljs/exceljs)** for exporting member lists,
  activity responses, and reports to `.xlsx`
- Deployed on **[Vercel](https://vercel.com)**

## Project structure

```
src/
├── app/
│   ├── [locale]/            # Every localized route (en/ar) — public pages
│   │   │                    # and the entire /dashboard tree live here
│   │   └── dashboard/
│   │       ├── curator/     # Curator/Vice Curator-only pages
│   │       ├── impact/      # Impact Officer-only pages
│   │       └── shaper/      # Shared by every signed-in member
│   └── api/                 # Server routes: invite emails, newsletter,
│                             # reCAPTCHA verification, email validation
├── components/               # Shared UI: navbar, footer, uploaders, modals
├── context/                  # Auth and theme React context providers
├── i18n/                     # next-intl routing/config
└── lib/                      # Firebase client, Firestore helpers, export
                               # utilities, validation, and small shared logic

messages/
├── en.json                   # Every English string in the app
└── ar.json                   # Its Arabic counterpart, kept in lockstep

firestore.rules               # The actual security boundary — every
                               # collection's read/write rules, documented
                               # inline with the reasoning behind each one
```

## Getting started

### Prerequisites

- Node.js 20+
- A Firebase project with **Authentication** (Email/Password) and
  **Firestore** enabled

### Setup

```bash
git clone https://github.com/The-Dark-Ranger/Jeddah-Hub.git
cd Jeddah-Hub
npm install
```

Create a `.env.local` file in the project root with the following:

```bash
# Firebase client config — from your Firebase project settings
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Public canonical site URL, used for SEO metadata and the sitemap
NEXT_PUBLIC_SITE_URL=https://jeddahhub.org

# Google reCAPTCHA v3 — protects the contact form and newsletter signup
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=

# Resend — sends the newsletter welcome email and member invite emails
RESEND_API_KEY=
FROM_EMAIL="Jeddah Hub <newsletter@jeddahhub.org>"
```

Then start the dev server:

```bash
npm run dev
```

The site will be running at `http://localhost:3000`.

### Firestore Security Rules

`firestore.rules` in the repo root is the source of truth for every
permission in the app. It deploys automatically on every push to `main`
via `.github/workflows/deploy-firebase-rules.yml`, using two GitHub Actions
secrets: `FIREBASE_SERVICE_ACCOUNT` and `FIREBASE_PROJECT_ID`. If those
aren't configured on a fork, the workflow skips itself rather than failing
the build — but the rules then need to be pasted into the Firebase Console
manually to take effect.

## Available scripts

```bash
npm run dev         # Start the local dev server
npm run build        # Production build
npm run start         # Run a production build locally
npm run lint          # Lint the codebase
npx tsc --noEmit      # Typecheck without emitting output
```

## Deployment

The site is deployed on Vercel, connected directly to this repository — every
push to `main` deploys to production, and every pull request gets its own
preview deployment automatically.

## A note on privacy

Real Shapers' names, photos, bios, and event sign-ups live in Firestore, not
in this repository — nothing in the codebase or its history contains anyone's
private information. What each role can see and do is governed entirely by
`firestore.rules`, and the site's own Privacy Policy and Terms of Use pages
describe exactly what's collected and why.

---

Built and maintained by the Jeddah Hub curatorship, part of the
[Global Shapers Community](https://www.globalshapers.org/), an initiative of
the [World Economic Forum](https://www.weforum.org/).
