# Developer guide

How the code is organised, the conventions it follows, and step-by-step
recipes for the most common changes. For setup see the
[README](../README.md); for the flows behind each feature see
[HOW-IT-WORKS.md](HOW-IT-WORKS.md).

- [Workflow](#workflow)
- [Conventions](#conventions)
- [Recipes](#recipes)
- [Security rules](#security-rules)
- [Shared helpers](#shared-helpers)

## Workflow

1. Branch from `main` (`feature/…`, `fix/…`, `docs/…`).
2. Make the change, then run `npm run check`, plus `npm run test:rules` if
   `firestore.rules` changed.
3. Open a pull request. Vercel builds a preview; `main` only accepts the merge
   once that check passes.
4. Squash-merge. Vercel deploys `jeddahhub.org`. If the rules changed, run
   `npm run deploy:rules`.
5. Add a line to [CHANGELOG.md](CHANGELOG.md) describing the change in plain
   words.

## Conventions

**Files**
- A public page is a server `page.tsx` (loads data, sets metadata) plus an
  interactive `*Client.tsx` when it needs the browser.
- Dashboard pages live under `src/app/[locale]/dashboard/<role>/`. A piece of
  UI used only by one page sits next to it (for example
  `curator/initiatives/RequestQueue.tsx`); shared pieces go in
  `src/components/` or `src/components/dashboard/`.
- Every file starts with a short comment saying what it is and why it exists.
  Comments explain *why*, not *what*.

**Styling**
- CSS Modules next to the component (`Name.module.css`). Colours, radii and
  shadows come from the design tokens in `src/app/globals.css`; dark mode is the
  `[data-theme="dark"]` override there.
- Use logical properties (`margin-inline-start`, `inset-inline-end`, …) so the
  Arabic right-to-left layout mirrors automatically.
- Text is never smaller than 12 px: write small sizes as
  `font-size: max(12px, 0.75rem)`. Buttons and links on phones are at least
  40 px tall.
- Anything built from stored data that reaches a `style` must go through
  `safeColor` (`lib/activityTypes.ts`) or `cssUrl` (`lib/sanitize.ts`).

**Text and languages**
- Every visible string lives in `messages/en.json` **and**
  `messages/ar.json` under the same key, read with
  `useTranslations('Namespace')`. Both files always have exactly the same keys.
- Dates and numbers use the page's locale (`toLocaleDateString(locale)`).

**Data**
- Public pages read through `src/lib/publicData.ts` (server-side, cached for
  60 s, tagged `public-data`). After a dashboard change that affects public
  pages, call `refreshPublicPages()` (`lib/spotlight.ts`).
- Dashboards use the Firebase client SDK; `firestore.rules` decides what each
  person may read or write.
- Anything that must not depend on the browser's honesty (accounts, public
  forms, uploads, emails) is an API route using the Admin SDK.

## Recipes

### Add a string
Add the key to both `messages/en.json` and `messages/ar.json` in the same
namespace, then use `t('key')`. Placeholders look like `{name}` and are passed
as `t('key', { name })`.

### Add a public page
1. Create `src/app/[locale]/<name>/page.tsx` (server). Export its metadata,
   with `alternateLanguages()` from `lib/seo.ts` for the English/Arabic links.
2. Put browser-only parts in a `*Client.tsx` beside it.
3. Add the link to the navbar or footer and, if it should be indexed, to
   `src/app/sitemap.ts`.

### Add a dashboard page
1. Create it under `src/app/[locale]/dashboard/<role>/<name>/page.tsx`.
2. Add it to the role's menu in `src/app/[locale]/dashboard/layout.tsx`
   (`nav`).
3. Check the role at the top of the page for the interface, and make sure
   `firestore.rules` allows exactly what the page writes (see below).

### Add an API route
Follow the existing routes in `src/app/api/`:
- **Members only:** `requireRole(req, [...roles])` from `lib/serverAuth.ts`.
- **Public form:** `isCrossSite`, `isBotSubmission` and `json` from
  `lib/formGuard.ts`; `isRateLimited` (one server) and `withinLimit` (all
  servers) for limits; `verifyRecaptchaToken`; `isBlockedBot` for BotID (and
  add the path to `lib/botidRoutes.ts`).
- Read the body with `readJsonBody` (`lib/http.ts`), which caps its size.
- Never trust a value the browser sends for anything that decides access.

### Send a new kind of email
Add a template in `src/lib/emails/` built from the pieces in `layout.ts`.
Those pieces take HTML, so pass every value a person typed through
`escapeHtml` first (as `contact.ts` does). Send it with `sendEmail` from
`lib/email.ts`. Emails visitors can trigger also go through
`withinEmailBudget()`.

### Add an environment variable
Read it on the server (only `NEXT_PUBLIC_*` reaches the browser), document it
in `.env.example` and the README table, and set it in the Vercel project.

## Security rules

`firestore.rules` is the real authorization boundary; the interface only
hides what a person can't use. When you change it:

1. Edit the rule, keeping its comment accurate.
2. Add or update a case in `tests/firestore-rules/rules.test.mjs`. Test both
   the action you mean to allow and the ways around it.
3. `npm run test:rules` (starts the emulator; needs Java 17+).
4. After merging, `npm run deploy:rules`.

## Shared helpers

| Need | Use |
|---|---|
| Verify a member in an API route | `requireRole` (`lib/serverAuth.ts`) |
| Rate limits | `isRateLimited`, `clientIp` (`lib/rateLimit.ts`); `withinLimit`, `withinEmailBudget` (`lib/persistentLimit.ts`) |
| Bot checks | `isBotSubmission`, `isCrossSite` (`lib/formGuard.ts`); `verifyRecaptchaToken` (`lib/serverRecaptcha.ts`); `isBlockedBot` (`lib/botCheck.ts`) |
| Safe links, styles and exports | `safeExternalUrl`, `cssUrl`, `spreadsheetSafe` (`lib/sanitize.ts`); `safeColor` (`lib/activityTypes.ts`) |
| Team roles | `TEAM_ROLES`, `isLeadRole`, `toTeamRole`, `withTeamRole` (`lib/types.ts`) |
| Member roles | `normalizeRole` (`lib/role.ts`), `useRoleLabel` (`lib/roleLabel.tsx`) |
| Photos | `uploadMedia` (`lib/media.ts`), `compressToDataUrl` (`lib/imageCompress.ts`) |
| Spreadsheet reports | `downloadReport` (`lib/initiativeReport.ts`, loads ExcelJS on demand) |
| Email | `sendEmail` (`lib/email.ts`); templates in `lib/emails/` |
