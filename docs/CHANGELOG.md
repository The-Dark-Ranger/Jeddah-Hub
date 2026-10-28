# Changelog

What changed on the site, newest first. Each line links to its pull request,
which has the full description and how it was tested.

## October 2026

### 28 October
- Vercel BotID: an invisible bot check on the contact, newsletter and activity forms and the login; automated requests are refused. (#191)
- Vercel Speed Insights: real visitors' page-load speed (Core Web Vitals), anonymous; Privacy Policy updated.
- Vercel Web Analytics: anonymous visit statistics (no cookies); Privacy Policy updated to say so.
- Members whose Role Assignments note says "Incoming" stay off Who We Are and the member counts until their first sign-in.
- Every invite is recorded: an email to the hub inbox (who, role, by whom, when; never the password) and an "Invited" note with a count in Role Assignments; the invite's role and name come from the saved assignment.
- Co-Lead team role with the same rights as a Lead; team roles are picked from a list; the Impact Officer team panel now grants lead rights; leads can change the team one plain member at a time.
- Activity registration and feedback forms now go through a protected server route (reCAPTCHA, limits, answers validated, one response per email); direct database writes are refused.
- Rate limits that hold across every server instance, a daily budget for visitor-triggered email, and stricter email address checks.
- Branded invite email with the sign-in address and one-time password, in the dashboard language; logins are created automatically before inviting.
- Alumni can be dismissed from Pending Assignments and reviewed later (invite, restore or remove).
- Loading screen stays one second and follows the light or dark theme; only that theme's small logo is downloaded.
- Server code moved to Vercel's Mumbai region, next to our visitors and the database (it ran in the US).
- Readable filled buttons in dark mode and an accessible language switch (accessibility score 100).
- Cleanup: one shared activity editor and initiative form (Impact Officers now get the full form, and their new initiatives get readable addresses), a data-driven dashboard menu, one legal-page template, a shared bot-trap field, and unused styles and strings removed.

- Premium loading screen on reload: frosted logo, ring of light, live progress, smoother exit. (#183)
- Jeddah Hub and World Economic Forum logos in every email. (#182)
- Contact form checked for bots and spam on the server; browsers can no longer write messages directly. (#181)
- Newsletter keeps each address once, with server-side bot checks. (#180)

### 27 October
- Contact form emails: a copy to the hub and a receipt to the visitor, in their language; separate senders per email type; richer bilingual templates. (#176, #177)
- Newsletter welcome no longer lists "Global updates"; reply forwarding tried and removed. (#178, #179)
- Sending domain jeddahhub.org verified with Resend.

### 26 October
- One shared role-coloured banner for the dashboard home and My Profile; blog drafts kept on the device until saved. (#175)
- Each role has its own colour on Who We Are and the dashboards. (#174)
- Faster for visitors: Firebase only loads when needed; initiative photos moved out of the records. (#173)
- Error screens instead of crashes; dashboards checked on every device. (#172)

### 25 October (later)
- Privacy Policy and Terms of Use rewritten for visitors. (#169 to #171)
- Mobile menu tidied. (#168)

### 25 October
- Code cleanup: typed Firestore records, zero lint warnings, header comments on every file, unused code removed, dependencies updated (Next.js 16.4.3, Firebase 13). (#167)
- Removed em dashes and machine-sounding wording; one Arabic spelling throughout. (#166)
- Initiatives page: summary strip, swipeable filters on phones, designed covers; tidier initiative dashboards with search. (#165)
- Mobile navigation drawer redesigned, with labelled theme and language switches. (#164)
- After-event feedback form for activities, with star ratings and separate exports. (#163)
- Members panel: remove any member from the Hub with a confirmed click. (#162)
- One-time passwords for new members instead of a shared password. (#161)

### 20 October
- Show-password eye on every password field; fixed a blank Arabic login page. (#160)
- Blocked spoofed names and emails, refused scanner probes, enabled bot protection. (#159)
- Sanitised links and spreadsheet exports; login protected against bots. (#158)

### 19 October
- Members who have signed in leave Pending Assignments automatically. (#157)
- Lighter theme reveal animation on phones. (#156)
- Hardened role management; phone fixes for switches, colour swatches and the roster. (#155)
- "View more" for long assignment and status lists. (#154)
- Spotlight clears when removed; 600-character bios; phone fixes. (#153)
- Shaper/Alumni status for curators; dashboards fit on phones. (#152)
- Flowchart docs, refreshed README, dead code removed. (#151)
- Searchable member and initiative pickers. (#150)
- Selectable spotlight, Community Charter sign-off, live member counts, clean news URLs. (#148, #149)
- Public pages load their content on the server, so they show instantly on any device. (#147)
- New members appear on Who We Are automatically; accounts created on the server. (#143 to #146)

### 15 October
- Simpler registration forms, curator-picked featured initiatives, larger photos. (#136 to #142)
- 404 page, richer articles, contact and legal pages, scroll reveal, dashboard search. (#135)

### 11 to 14 October
- World Economic Forum design, activity pictures and colours, richer dashboard, splash screen. (#132 to #134)
- Security, performance and UX overhaul: dependencies, API hardening, transitions, theme, navigation. (#130, #131)

## Earlier

For everything before October 2026, see the
[commit history](https://github.com/The-Dark-Ranger/Jeddah-Hub/commits/main).
