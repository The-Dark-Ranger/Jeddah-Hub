# How it works

A walkthrough of the site's main flows, one diagram each. For the overview,
tech stack and setup, see the [README](../README.md).

- [1. How a public page loads](#1-how-a-public-page-loads)
- [2. Adding a member](#2-adding-a-member)
- [3. Signing in and roles](#3-signing-in-and-roles)
- [4. Initiatives: proposals, joining and leaving](#4-initiatives-proposals-joining-and-leaving)
- [5. Hub Activities and registration](#5-hub-activities-and-registration)
- [6. News posts](#6-news-posts)
- [7. Community Charter sign-off](#7-community-charter-sign-off)
- [8. Contact form and newsletter](#8-contact-form-and-newsletter)
- [9. Shipping a change](#9-shipping-a-change)
- [Where data lives](#where-data-lives)

---

## 1. How a public page loads

Public pages (Home, Who We Are, Initiatives, News, and each initiative,
activity and post) get their content from the server, inside the page
itself. The browser doesn't have to fetch it after loading, so content
shows immediately on any phone or network.

```mermaid
flowchart LR
    V([Visitor]) -->|opens /en/projects| P[Next.js page<br/>on Vercel]
    P --> C{Public data<br/>cached?}
    C -->|yes, under 60 s old| H[Render HTML<br/>with content]
    C -->|no| F[(Firestore<br/>REST API)]
    F -->|same public rules<br/>as visitors| X[Swap inline photos<br/>for /api/img links]
    X --> H
    H --> V
    V -->|each photo once| I["/api/img<br/>(CDN-cached for a year)"]
```

- [`src/lib/publicData.ts`](../src/lib/publicData.ts) reads the public collections
  without credentials, so [`firestore.rules`](../firestore.rules) still decide what's
  visible. Results are cached for 60 seconds: dashboard edits appear on public pages
  within a minute.
- Photos stored inline in a document are served by
  [`/api/img`](../src/app/api/img/%5Bcollection%5D/%5Bid%5D/%5Bfield%5D/route.ts).
  Their URL carries a hash of the photo, so a changed photo gets a new URL.
- If the server can't reach Firestore, each page falls back to loading the
  same data in the browser.

## 2. Adding a member

A curator adds someone in **Role Assignments**. The server creates their
login and lists them on Who We Are straight away.

```mermaid
sequenceDiagram
    actor C as Curator
    participant D as Dashboard<br/>(Role Assignments)
    participant A as /api/members/create-account
    participant Auth as Firebase Auth
    participant DB as Firestore
    participant M as /api/invite (Resend)

    C->>D: Name, email, role
    D->>A: POST with the curator's ID token
    A->>A: Curator or vice curator?<br/>(otherwise 401)
    A->>Auth: Create user, temporary password [removed]
    A->>DB: users/{uid}: role and name
    A->>DB: public_profiles/{uid}: name and role only
    D->>DB: role_assignments/{email}
    C->>D: Send Invite
    D->>M: Invite email with sign-in details
```

- Account creation needs admin rights, so it runs on the server with the
  `FIREBASE_SERVICE_ACCOUNT` key (a Vercel environment variable, never in the repo).
- Removing a **pending** assignment also deletes the unused login and the
  public listing, but only if the person has never signed in.

## 3. Signing in and roles

```mermaid
flowchart TD
    S[Sign in] --> U{users/uid<br/>has a role?}
    U -->|yes| R[Use it]
    U -->|no| A{role_assignments<br/>for this email?}
    A -->|yes| R2[Apply the assigned role]
    A -->|no| N[No role yet:<br/>dashboard shows nothing to manage]
    R --> PW{Signed in with<br/>temporary password?}
    R2 --> PW
    PW -->|yes| B[Banner: change your password<br/>→ My Profile]
    PW -->|no| D[Dashboard for the role]
    B --> D
```

| Role | Can |
|---|---|
| Shaper / Alumni | Edit their profile, join or leave initiatives, propose initiatives and activities, write posts, sign the Charter |
| Initiative lead | Everything above, plus edit their own initiative and handle its join, add and remove requests |
| Impact Officer | Manage initiatives and activities, publish posts, pick the spotlight |
| Curator / Vice Curator | Everything: roles and accounts, featured initiatives, messages, exports, Charter sign-off |

Each permission is enforced in the dashboard **and** in `firestore.rules`.
The rules are the real boundary: a member can never give themselves a higher
role, even by talking to Firestore directly.

## 4. Initiatives: proposals, joining and leaving

```mermaid
flowchart LR
    subgraph Propose
        P1[Member proposes<br/>an initiative] --> P2[(initiative_requests<br/>pending)]
        P2 -->|curator or impact<br/>officer approves| P3[(initiatives)]
    end
    subgraph Membership
        J1[Shaper asks to join] --> J2[(join_requests)]
        J2 -->|lead or curator accepts| J3[added to members]
        L1[Member asks to leave] --> L2[(leave_requests)] --> L3[removed from members]
        A1[Lead asks to add<br/>or remove someone] --> A2[(member_add_requests /<br/>removal_requests)]
        A2 -->|curator or impact<br/>officer approves| J3
    end
```

On the public Initiatives page, curators **feature** up to 3 initiatives on the
homepage. Curators and impact officers put one in the **Spotlight** card.

## 5. Hub Activities and registration

```mermaid
flowchart TD
    C[Curator creates or edits<br/>an activity] --> I[(initiatives<br/>type: hub_activity)]
    M[Member proposes<br/>an activity] --> Q[(activity_requests)]
    Q -->|curator or impact<br/>officer approves| I
    L[Initiative lead creates<br/>or edits one] --> R[(activity_change_requests)]
    R -->|curator or impact<br/>officer approves| I
    I --> H[Homepage activity section<br/>in the activity's colour,<br/>arrows when there are several]
    I --> P[/activities/name page/]
    P --> F{Registration<br/>open?}
    F -->|yes| V[Visitor fills the<br/>custom form] --> AR[(activity_responses)]
    F -->|no| X[Closed notice]
    AR --> E[Curator views responses<br/>and exports to Excel]
```

## 6. News posts

```mermaid
stateDiagram-v2
    [*] --> draft: member writes
    [*] --> published: curator or impact officer publishes directly
    draft --> pending_review: submit for review
    pending_review --> published: approve
    pending_review --> draft: reject
    published --> draft: unpublish
    note right of published
        Public at /news/post-title.
        Likes: one per person, enforced in the rules.
    end note
```

## 7. Community Charter sign-off

The Charter page reproduces the hub's official Google Form word for word.
Members confirm it the same way the form asks: their name plus *"I confirm
compliance with Community Charter"*.

```mermaid
flowchart TD
    C[Curator turns on<br/>'Require sign-off'] --> S[(settings/charter<br/>requireSignature: true)]
    S --> B{Active Shaper<br/>who hasn't signed?}
    B -->|yes| N[Dashboard banner:<br/>Read & sign] --> F[Charter page:<br/>name + confirm]
    B -->|no, or alumni| Q[No banner]
    F --> G[(charter_signatures/uid)]
    G --> P[Curator panel:<br/>X of Y Shapers signed]
    P -->|new term| R[Start a new signing round<br/>clears all signatures]
```

## 8. Contact form and newsletter

```mermaid
flowchart LR
    V([Visitor]) -->|starts typing| RC[reCAPTCHA loads]
    V -->|sends message| VR[/api/verify-recaptcha/] -->|passes| CM[(contact_messages)] --> CU[Curator: Messages]
    V -->|subscribes| NS[(newsletter_subscribers)] --> W[/api/newsletter/welcome/] --> E[Welcome email<br/>via Resend]
    NS --> X[Curator: Export Emails]
```

reCAPTCHA (around 350 KB) loads only when someone starts using a form, not on
every page.

## 9. Shipping a change

```mermaid
flowchart LR
    B[Branch] --> PR[Pull request] --> VP[Vercel preview<br/>build check]
    VP -->|passes| M[Squash-merge<br/>to main] --> PROD[Vercel deploys<br/>jeddahhub.org]
    M -->|firestore.rules changed| GA[GitHub Action<br/>deploys the rules]
```

The rules workflow needs the `FIREBASE_SERVICE_ACCOUNT` and `FIREBASE_PROJECT_ID`
repository secrets. Without them it skips itself, and rules are published by hand
with `npx firebase-tools deploy --only firestore:rules`.

---

## Where data lives

| Collection | What | Who can read |
|---|---|---|
| `initiatives` | Initiatives and Hub Activities (`type: hub_activity`) | Everyone |
| `public_profiles` | Name, Arabic name, photo, bios, socials, role. **Never email.** | Everyone |
| `users` | Full member record, including email and the real role | The member, curators, impact officers |
| `role_assignments` | Pending roles, keyed by email | The invitee, curators, impact officers |
| `blogs` | News posts | Everyone if published, otherwise the author and reviewers |
| `media` | Uploaded photos (served by `/api/media`) | Everyone |
| `activity_responses` | Registration form answers | Curators, impact officers |
| `contact_messages`, `newsletter_subscribers` | Inbound messages and sign-ups | Curators |
| `settings`, `charter_signatures` | Charter sign-off switch and signatures | Members / curators and impact officers |
| `*_requests`, `notifications` | Proposals and membership requests | The requester and whoever reviews them |

The authoritative version, with every condition explained, is
[`firestore.rules`](../firestore.rules).
