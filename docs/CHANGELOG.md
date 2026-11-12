# Changelog

What changed on the site, newest first. Each line links to its pull request,
which has the full description and how it was tested.

## November 2026

### 12 November
- Up to date and patched: Next.js 16.4.6, which fixes seven security problems in Next.js (among them a way past the image service's refusal of SVG files); Firebase 13.2, which fixes errors when a sign-in is restored from the browser's storage; Speed Insights 2.1 and Playwright 1.65. A library the Admin SDK uses is patched too, so the security audit is back to 0 known vulnerabilities.
- Emails escape the names they carry everywhere, including the hidden preview line and the title, so a name can never add markup to an email. The plain-text version of an invite shows names as typed (an apostrophe used to show as "&#39;").
- Photo previews in the dashboard only load addresses a photo can come from: an uploaded photo, an inline one, or an http(s) link.
- Profile photos are saved as their own photo, like initiative photos, instead of inside the profile, so the profiles every public page reads get smaller as members update their photos.
- Public pages read the database with three tries of 10 seconds instead of two of 20, after the server logs showed occasional dropped connections to Firestore. Visitors keep seeing the last copy while a refresh fails.
- The sign-in page no longer reads "Keep me signed in" while the server builds the page, which logged a warning on every visit.
- GitHub: CodeQL now checks every change for security problems, and the empty wiki tab is gone. The README, developer guide and How it works now describe the sign-in and session rules from 10 November.
- Cleanup: an unused style, the Realtime Database addresses in the content security policy (the site doesn't use one) and out-of-date comments.

### 11 November
- Phones: with the menu open, the page underneath no longer scrolls and the top bar no longer slides away, which left the menu hanging below a gap. Closing the menu returns to the same place on the page.
- Phones and tablets: Member Login now sits only in the menu, like the Dashboard and Sign out buttons, so the top bar shows just the logo, theme, language and menu.

### 10 November
- Only confirmed email addresses get in: a member whose address isn't confirmed is sent a link when they sign in and sees nothing else until they open it. The database and the server refuse an unconfirmed account too, so this can't be skipped.
- Sessions have limits: every sign-in ends after 14 days, and on a shared computer ("Keep me signed in" unticked) after 30 minutes without activity. The sign-in page says why a session ended.
- Signing out everywhere takes effect at once: when a curator sends a member a new password or removes them, every session that member had stops working straight away, not up to an hour later. Open pages notice within minutes, or as soon as the tab is used again.
- Sign-in is slower to attack: each wrong password makes the next try wait (1, 2, 4, then 8 seconds) before the lockout, and the server answers repeated attempts on one account more slowly. The server now checks the sign-in form's hidden bot field and fill time too.
- Forged requests are refused everywhere: any change sent from another website's page (a hidden form in a member's browser, for example) is turned away before it reaches any route or page, not only the forms.
- Admin changes have daily limits that hold across every server: account changes (create, reset, remove) and refreshing the public pages, alongside the existing limits on invites and photo uploads.

### 8 November
- Previews stay private: the code no longer names the preview address or the Vercel account. The bot check recognises a preview by the address it is reached at.

### 3 November
- Sign-in is stronger: the server now limits attempts (10 per account every 15 minutes, 60 per network an hour), and clearing the browser can't reset that. A disabled account answers like a wrong password. A failed password is cleared from the field. "Keep me signed in on this device" can be unticked on a shared computer, which ends the session when the browser closes. The page warns when Caps Lock is on, and a member who is already signed in goes straight to the dashboard.

### 2 November
- Active Projects: opening a team no longer stretches the project's photo, and the whole photo now shows instead of being cropped; the team opens below with room for two columns of members. Adding a member is a search by name (English or Arabic), alphabetical, and no longer offers someone already asked for. Larger buttons on phones, and the search no longer makes phones zoom in. In dark mode, page content no longer shows through the navbar.
- Community Charter: Read & sign now opens the Charter at the top, so members read down to the sign-off, and the Curator and Vice Curator can download who has signed as Excel or CSV.
- Active Projects: projects now use the page's full width, one per row with the photo beside the text and more space, and stack neatly on tablets and phones.
- My Profile: removed the extra Change password button; the form and the one-time password reminder stay.
- Hub Activities: every member can propose an activity or workshop from My Hub Activities with the same full form leads have (photos, dates, highlights, registration and feedback forms). A Curator or Vice Curator approves it before it goes live. Members follow what happened to each request, can correct one while it waits, see the reviewer's note if it is declined and send it again, and can ask for changes to activities they proposed. Curators get one review queue with search and counts, see only what would change on a live activity, and approving saves everything at once.
- News: posts can have a cover photo and up to 12 more photos, shown on the News page, at the top of the post and as a gallery. A shared post now shows its own title, summary and picture.
- Community Charter: members type the name on their account (a different name has to be typed again) and tick one box saying they have read the Charter and will adhere to it. The record holds the account name and the server's time, and can't be edited afterwards.
- Change password: the button now goes down to the form, from My Profile and from the reminder, including right after signing in with a one-time password. 
- Initiatives page: removed the summary strip (active initiatives, Shapers involved, focus areas).
- Fixes found by the new browser tests: the X, LinkedIn and WhatsApp buttons on a news post shared an empty link; Arabic pages showed Hijri dates and different digits from the server, which made the browser rebuild the whole page (dates are now the same everywhere); on phones up to 400px wide the news header's wave covered its subtitle; signing in with a one-time password now opens the Change password form; the sign-in page no longer refuses someone on a slow phone as "too fast".
- Other fixes: a curator opening a post waiting for review sees its real status; the post editor's button says what it will do (save a draft, submit, publish); downloads work in Safari and Firefox; published and removed posts and activities show on the public site straight away; legacy-format team members count on the dashboard home; the activity editor closes with Esc, only asks before discarding real changes, fills a phone's screen, and catches a bad button link before saving.
- Faster: the dashboard home reads the initiatives once instead of up to five times, and news cards load a small version of each photo. Tidier: the dashboard sidebar fills its column and the role badge stays on one line.
- Up to date: Vercel Analytics and Speed Insights 2, BotID 1.5.12, jose 6.2.15, and a dependency fix that takes the security audit to 0 known vulnerabilities.
- New browser tests (`npm run test:e2e`) follow the main functions from start to finish, and open every page in both languages on phone and desktop sizes; more security-rules tests.

## October 2026

### 29 October
- The repository is marked all rights reserved (`LICENSE`): the code can be viewed on GitHub but not used, copied or shared without permission.
- Repository cleanup: a detailed README, a developer guide (docs/DEVELOPMENT.md), a security policy, security-rules tests (`npm run test:rules`) and one-command rules deploys (`npm run deploy:rules`); the unused rules-deploy workflow, dead translation strings and local AI-assistant files removed from the repository; the four request queues on the Initiatives dashboard share one component (approving a member addition now uses the green button).
- Phones and desktop: project pages no longer scroll sideways on phones (long names in the team grid end in "…"); no text renders smaller than 12px; footer links, "Back to top", share buttons, the Roster role picker and dashboard "Manage" links are finger-sized; dashboards no longer jump when the Community Charter reminder appears; form labels are linked to their fields (tapping a label focuses it; screen readers announce it); the newsletter box and photo-URL box have names; the spreadsheet code (about 900 KB) loads only when a report is downloaded, not with Active Projects and the initiative dashboards.
- Curators can email a member a new one-time password from Role Assignments → Members (it signs them out everywhere; the curator never sees it); the login page no longer has "Forgot password?".
- Penetration test fixes: accounts still on the old default password were reset or signed out; colours and photo addresses can no longer inject styles into public pages; photos upload through the server with a daily limit and can't be listed in bulk; leads can't change a project's web address; "Incoming" members have no public profile until they sign in; posts from other websites to the forms are refused; links in the visitor's copy of a contact message are no longer clickable; a crash in the image route is fixed; `security.txt` added.
- Security audit fixes: a lead can only add a plain Member (wherever it sits in the list) and can't remove another lead; members' own posts accept only the editor's fields, with size limits and no self-added likes; guest likes must be a real guest id (no oversized values); only the Curator can create, reset or remove an account a Curator role is waiting for.

### 28 October
- Roster: team roles are editable in place. Curators change them directly; initiative leads get the Roster for their own teams and their role changes wait for Curator or Vice Curator approval (count on the dashboard's Roster card).
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
