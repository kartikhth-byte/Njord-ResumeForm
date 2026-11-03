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
