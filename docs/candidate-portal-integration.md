# Candidate portal integration — design note

Date: 2026-11-03 · Status: direction agreed, not built. Build only the "now" items below until portal work starts.

## Goal

- One gate: a candidate signs in once and sees everything (profile, documents, applications) in one dashboard.
- Growth: a candidate sent the Holmes long form who is not yet on the portal becomes a portal user by filling it.
- No candidate data is revealed to anyone without the candidate's consent.

## Owner decisions (2026-11-03)

1. **Consent:** no data is shown to any organization without the candidate's consent.
2. **Operator use:** the operator (Kartik Raghavan) may use the data to improve the app.
3. **Backend:** one backend (same Supabase project, same accounts).
4. **Three separate data stores:**
   1. **Long form** — what the candidate submits to an organization (today `application_data`).
   2. **Portal** — what the candidate uploads to the portal (CV and what is extracted from it).
   3. **Needle** — resume data extracted by Needle, as JSON.

## Design

### Stores stay separate; identity and the profile are shared

| Store | Source | Owner / who may see it | Notes |
|---|---|---|---|
| Long form | candidate, for one organization | that organization (submission snapshot) + the candidate | frozen at submission; one per organization × requirement |
| Portal | candidate, for themselves | the candidate; organizations only by share grant | living data the candidate maintains |
| Needle | extracted from resumes (incl. scraped) | the organization that sourced it + the operator | no consent from the person; never shown to other organizations or in any shared directory until the person claims a portal account and opts in (review finding F4) |

- **Separate schemas, one database.** Put each store in its own Postgres schema (e.g. `longform`, `portal`, `needle`) in the same project, each with its own access rules. Separate Supabase projects would make the shared identity and consent checks much harder.
- **One person record** (`person`) links the stores: a portal account, long-form submissions and Needle records for the same human point to the same person. Linking is proposed by verified email (plus phone or date of birth) and never auto-merged (review decision 5).
- **The profile the candidate sees** is a merged view with field-level source, in this order of trust: confirmed by the candidate > long form > portal CV extraction > Needle. The candidate confirms or corrects; nothing extracted is treated as confirmed.

### Consent

- **Share grants:** an organization sees portal data only through a grant the candidate gives (submitting to that organization, accepting an invite, or opting in to "Available"). Grants are recorded and revocable.
- **Consent record at first sign-in:** terms version, accepted purposes, timestamp.
- **Operator use for improving the app** must be a stated purpose in the portal terms and privacy notice, accepted at sign-in. Recommended limits: pseudonymize data used for evaluation or training sets; never use it to show a candidate to an organization without a grant; honour deletion requests across all three stores. Data gathered without consent (Needle, scraped) needs separate legal advice before any operator use.

### Long form as a portal touchpoint

1. A recruiter invites someone (in the portal or not). The email is a portal sign-in link opening on that organization's request.
2. **New person:** filling the long form creates their portal profile → new portal user.
3. **Existing portal user:** the form is prefilled from their profile; they check it, add that organization's extra fields, and submit.
4. Submitting creates the long-form snapshot and a share grant for that organization.

### Invite link → portal, by case

The long-form email stays a magic link; it signs the person in to the one shared account system (identified by email) and opens on that organization's request.

| Case | What happens |
|---|---|
| **No account** | The link creates the account on first use. First sign-in: accept portal terms (consent record). The invite is claimed for this person, the long form opens for that organization, and filling it builds their portal profile. Submit = snapshot + share grant. They are now a portal user. |
| **Has an account, same email** | The link signs in to the existing account. The invite is claimed for their person record; the long form opens prefilled from their profile ("from your profile — confirm"); they check it, add the organization's extra fields, submit. The request also appears in their portal dashboard, so they can act on it without the email. |
| **Has an account under another email** | The link creates a second account. At first sign-in, offer "Already on Holmes with another email? Link it": verify the other email by code, then attach the invite to the existing person and retire the new account. Never merged automatically. |
| **Found through the portal** (opted in to Available) | The recruiter invites from the portal side; same as "has an account". |

### Account rules (owner requirement 2026-11-03)

1. **The email is the username, and it is verified.** An account becomes usable only after the person opens a link (or enters a code) sent to that address, at every entry point: long-form invite, portal sign-up, invites to Needle-sourced candidates. A password can be added only after that. Bounced invite emails already flag the prospect (`bounce_flag`).
2. **One account per email.** All entry points use the same account system, which allows one account per email; emails are stored trimmed and lower-cased. Plus-addresses (`name+tag@…`) are different addresses and stay separate accounts.
3. **Every new account gets a profile.** One idempotent server step runs on every sign-in: if this account has no person record, create one, then attach pending invites for this verified email. Records matched only by name, phone or date of birth are proposed for linking, never merged automatically.
4. **Known gap:** one person using two different emails can still end up with two accounts. Covered by "link your other email" at sign-in (verified by code) and by recruiter-side duplicate suggestions.

### Mobile number as a second identifier (recommended, portal phase)

- Verified once by one-time code; stored in international (E.164) format, validated per country; **one verified number per person** (a second account claiming it is offered "link these accounts", never merged automatically).
- Used for duplicate checks and account recovery. **Email stays the username and main sign-in**: there is usually no mobile signal at sea, and numbers change or are reassigned.
- **International candidates:** offer SMS and WhatsApp; delivery and cost vary by country, and WhatsApp is not universal. If no code can be delivered, the account still works on email alone and the number stays unverified (not used for matching).
- Phone or WhatsApp sign-in can come later as an extra option on the same account.
- Candidates from several countries means several data-protection laws (e.g. EU GDPR, India DPDP, Philippines Data Privacy Act); the portal terms legal review should cover each market served and cross-border storage.

Changes needed when the portal starts (not now):
- The invite link carries the invite (case) so sign-in opens that request; the claim binds the person to it (F3).
- A "Requests" list in the candidate dashboard: every organization asking for a long form.
- Prefill from the profile using explicit field mappings only (review decision 8).
- A general portal sign-in. Today `request-applicant-magic-link` only sends a link to emails that belong to an approved prospect; portal users must be able to sign in without an invite.

## Build now (already on the plan; no extra scope)

1. Invite claim bound to the invite (review F3), in recruitment-case v1 — this is the "join" step.
2. When certificates, courses and sea service get their own tables, key them to the **person**, not the application. Keep `application_data` as the submission snapshot.
3. One sign-in for applicants and future portal users; the applicant sidebar is the portal shell. Rename `applicant` to `candidate` later.
4. Store a consent record at first sign-in (terms version, purposes).

## Not now

Portal features, profile editor, cross-organization search, merged-profile UI, Needle import.

## Open

- Candidate-facing brand: Holmes, or a separate consumer brand on the same backend.
- Legal review of portal terms: operator's right to use data for improvement, data controller roles (organization for applications and snapshots, operator for portal profiles), and any use of Needle data.
