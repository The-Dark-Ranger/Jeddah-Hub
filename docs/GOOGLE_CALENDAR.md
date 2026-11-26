# Linking the hub's Google Calendar

The Calendar (Dashboard > Calendar) sends its invites through the hub's Google
account, jeddahglobalshapers@gmail.com. Each event is copied into that
account's calendar with the invited members as guests. Google emails the
invites, members reply Yes / No / Maybe from their own calendar app, and the
replies show on the site. Until this is set up, events still save, but no
invites go out.

This is a one-time setup of about 15 minutes, and it is free: no billing
account or card is needed. If Google Cloud offers a free trial or asks to
enable billing, skip it. The site gets
one permission only, "see and edit events" on the hub's calendar. It can't
read the hub's email, contacts or files, or anyone's personal calendar.

## 1. Create the Google Cloud project (as the hub account)

Sign in to <https://console.cloud.google.com> **as jeddahglobalshapers@gmail.com**,
not a personal account, so the hub owns the project.

1. At the top, open the project picker and choose **New project**. Name it
   `Jeddah Hub Calendar`, then **Create**, and make sure it is selected.
2. Go to **APIs & Services > Library**, search for **Google Calendar API**,
   open it and choose **Enable**.

## 2. Set up the sign-in screen

Go to **Google Auth Platform** (also listed as **APIs & Services > OAuth
consent screen**) and choose **Get started**.

1. **App information:** app name `Jeddah Hub`, support email
   jeddahglobalshapers@gmail.com.
2. **Audience:** **External**.
3. **Contact information:** jeddahglobalshapers@gmail.com. Agree to the
   policy and choose **Create**.
4. **Data access > Add or remove scopes:** paste
   `https://www.googleapis.com/auth/calendar.events` into **Manually add
   scopes**, then **Add to table**, **Update** and **Save**.
5. **Audience > Publish app**, and confirm. This matters: while the app is
   in "Testing", Google cuts the link every 7 days. Google's review is not
   needed, because only the hub account ever signs in.

## 3. Create the website's key

1. In **Google Auth Platform > Clients**, choose **Create client**.
2. **Application type:** Web application. **Name:** `Jeddah Hub website`.
3. Under **Authorized redirect URIs**, add exactly:
   `https://www.jeddahhub.org/api/calendar/google/callback`
   (the site's address as set in `NEXT_PUBLIC_SITE_URL`, followed by
   `/api/calendar/google/callback`).
   To test on a Vercel preview, also add that preview's address followed
   by the same path. A preview uses its own Firebase project, so it is
   linked separately and invites only the members in that project.
4. Choose **Create**, and copy the **Client ID** and **Client secret**.

## 4. Give the key to the site

In Vercel, open the project's **Settings > Environment Variables** and add
these for Production (and Preview, to test there):

| Name | Value |
| --- | --- |
| `GOOGLE_OAUTH_CLIENT_ID` | the Client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | the Client secret |

Then redeploy, so the site picks them up.

`FIREBASE_SERVICE_ACCOUNT` must also be set. It already is, for creating
member accounts.

If the database rules were not published since the calendar was added,
publish them now: `npm run deploy:rules`.

## 5. Link it

1. On the site, sign in as a curator or vice curator and open
   **Dashboard > Calendar**.
2. Choose **Link Google Calendar**, sign in as jeddahglobalshapers@gmail.com
   and allow access to the calendar.
3. Google may warn "Google hasn't verified this app". That is expected for
   the hub's own app: choose **Advanced**, then **Go to Jeddah Hub**.
4. Back on the Calendar, it says **Linked**. Events already on the calendar
   get their invites within a few minutes.

## Afterwards

- **Unlinking:** signed in as the hub account, open
  <https://myaccount.google.com/permissions>, choose Jeddah Hub and remove
  its access. The Calendar then shows **Link Google Calendar** again.
- **If invites stop** (the hub account's password changed, or access was
  removed), the Calendar shows curators "needs linking again". Link it again
  as in step 5.
- **Limits:** Google allows a Gmail account to send invites to a few
  hundred people a day, which is far more than the hub needs. Members can
  invite at most 15 people per event; leads (for their initiatives) and
  curators have no limit.
- **How it works**, for whoever maintains the site: see
  `src/lib/calendarGoogle.ts`.
