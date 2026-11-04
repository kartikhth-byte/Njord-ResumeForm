# Decisions Log

## 2026-11-05 - All Hosted Needle Features In Holmes; Add To Holmes; Match Resumes

Decision:
- Holmes offers all of Needle's hosted features except Seajobs downloads (still excluded) and the Verified dashboard
- Needle's desktop pieces (desktop app, local agent, local folder scanning, old single-file UI) are not needed in Needle either
- Verify is replaced by **Add to Holmes**: a resume found by search becomes a Holmes candidate in the candidate pool, optionally attached to a requirement, with a duplicate check and a link back to the resume
- a requirement gets **Match resumes**: Holmes asks Needle to match the requirement to the resume pool, shows the ranked matches, and the recruiter adds the chosen ones so the recruitment flow starts for each
- Holmes reads Needle data only through Needle's API with the recruiter's token, never Needle's database

Why:
- the owner wants every Needle capability available to recruiters inside Holmes, with one shortlist (Holmes candidates and requirements) rather than two

Also decided 2026-11-05:
- embed Needle's own UI in the Holmes shell
- each customer searches only its own resume pool; the operator sees all
- a separate Operator role
- Coordinators cannot run AI searches (they can open a candidate's resume)
- retire Holmes's application-embedding search once Needle is embedded
- every Holmes candidate has a resume in the resume database; candidates enter with name, a phone or an email, and the resume; the recruiter completes phone, email, date of birth and nationality on the first call, before the candidate moves past contacted; email actions need an email

- the existing Needle resume pool becomes Njordships' pool
- each customer has its own Drive folder, the single way into its pool: uploads from Holmes are written there, the customer's resume mailbox saves attachments there, and a new customer bulk-moves its existing resumes there at onboarding; Needle's Drive intake reads each folder into that customer's pool
- per-customer folders and mailboxes arrive with Needle multi-tenancy; until then Needle's existing hosted email and Drive intake feed Njordships' one folder
- Needle is never customer-facing: it is served under Holmes's own address (Vercel forwards `/ai/*` to Needle) and Holmes stays on Vercel; Needle's direct login is for the operator only
- the development organization "Default organization" is renamed Njordships; there are no real Needle users, so existing Needle projects and chats are test data
- after an independent review: multi-tenancy splits into an organization tag before launch (N8a) and per-customer folders, mailboxes and the workspace move when a second customer signs (N8b); Match resumes opens Needle's own results; Operator is a platform flag rather than a role row; details in `docs/needle-in-holmes-design.md` §10

## 2026-11-02 - Contain Public Data API Exposure

Decision:
- keep browser-consumed tables in `public` for now, protecting them with explicit grants and RLS instead of breaking existing client and Edge Function paths with a schema move
- deny `anon` and `authenticated` direct table access to internal request/settings and backup tables; retain service-role access for server functions
- allow public read-only access to the three reference catalogs, and limit profile access to authenticated self/applicant writes and recruiter reads
- disable Supabase's automatic exposure of new tables; grant future Data API access deliberately, with RLS and role tests

Why:
- a private schema would remove tables from the Data API, but moving active tables without changing their callers would break live auth and recruiter workflows

Implementation: `2026110200_harden_public_table_access.sql` is live in project `btbqdviuqcpauojmorvx`; complete the remaining flow and security smoke checks in `docs/tasks.md`.

## 2026-11 - Needle Resume Pool Precedes Holmes Applications

Decision:
- integrate Needle's recruitment intelligence into a Holmes AI tab and requirement-level resume matching, excluding Seajobs download/local-agent workflows
- use one canonical resume pool across existing Needle resumes, direct intake, candidate-portal intake, and later organization-website intake
- do not treat a resume record as an already-verified candidate-owned profile; the future candidate login lets a person maintain that profile and resume
- distinguish a lightweight job interest from the existing long Holmes form, which may be invited after a passed interview and must be submitted before an Excel worksheet is sent to the principal
- candidate portal owns the candidate-maintained profile and job discovery; Needle powers candidate job search and recruiter candidate/requirement search; Holmes owns recruiter workflow automation after a match or job application
- recruiter discovery is inbound first: direct interest and consented availability are visible without a search; Needle search extends discovery when obvious leads are insufficient
- keep Needle independently maintained; Holmes consumes a versioned, pinned service contract and owns only its adapter/workflow. Compatible Needle engine releases are promoted after contract/evaluation tests, not copied or merged wholesale into Holmes.
- track recruiter-sourced matches and candidate-initiated job interest on a candidate-requirement recruitment case; keep search results advisory and company-specific workflow data access-controlled

Why:
- avoids duplicate candidates and rankings caused by indexing both resumes and derived applications
- gives AI search and requirement matching a single resume evidence contract without conflating job interest, recruitment progress, and worksheet data collection

Implementation details and release gates: `docs/needle-integration.md`.

Implementation status: the target case progression is specified in `docs/recruitment-flow.md`, but the current prospect/junction/application schema and invite gate do not yet enforce it. The offer, documents, and principal worksheet sequence is decided below; it is not implemented by today's application statuses.

## 2026-11-02 - Recruitment Case And Worksheet Order

Decision:
- use **operator** only for the Holmes owner/platform support, **organization** for a manning company using Holmes, **recruiter app** for that organization's staff screens, and **principal** for the organization's client receiving the Excel worksheet
- the case records contact, confirmation, test pass or a recruiter-recorded waiver with reason, and interview pass; a recruiter makes the selection decision after the interview
- an authorized recruiter may explicitly invite the long form any time after a passed interview, before or after selection; no case status change sends the invitation automatically
- selection is followed by offer, offer acceptance, documents submitted, documents verified, worksheet sent to the principal, and `hired`; Holmes stops at `hired`
- the long form runs in parallel after the interview; a recruiter may generate/download its worksheet any time after form submission, without waiting for selection, offer acceptance, or document verification
- first-slice working assumption pending owner sign-off: Holmes does not deliver worksheets to principals. After form submission, offer acceptance, and verified documents, an authorized recruiter attests that they sent the worksheet outside Holmes, recording actor, time, principal recipient, channel, and worksheet version. This gate controls the attestation, not an external email; generation alone does not send or advance the case
- proposed minimal outcome pending taxonomy sign-off: if the principal declines before hire, record `rejected` with reason code `principal_declined` and retain the stage for reporting
- before inviting the long form ahead of selection, tell the candidate that form completion does not imply selection; the retention policy for sensitive data from unselected candidates is still an open launch decision
- a principal portal and principal steps after `hired` are not in the current scope

Why:
- keeps early job interest, the recruitment case, the candidate-completed form, and principal handoff distinct without forcing form completion before a recruiter can make an offer

## 2026-11 - Holmes Operator And Organization Identity

Decision:
- Holmes is the product name and is operated by Kartik Raghavan; this does not assert a separate legal entity
- Njordships is a manning-company customer organization, not the operator of Holmes
- the product aims to serve additional organizations; the deployment and data-isolation model is still open
- the local Terms intro names Kartik Raghavan (`0150dc1`), but full legal copy, entity/contact details, and Privacy wording still need owner/legal review before wider rollout

Why:
- keeps product branding, operator identity, and organization identity distinct without inventing a legal entity

## 2026-03 - Recruiter Role Model Simplified

Decision:
- recruiter-side roles are limited to:
  - `Master Recruiter`
  - `Recruiter`
  - `Coordinator`

Why:
- avoids admin clutter
- aligns the UI and DB model more cleanly
- makes permissions easier to reason about

## 2026-03 - Applicant vs Recruiter Auth Split Preserved

Decision:
- applicants use Google OAuth
- recruiter-side users use email/password

Why:
- this matches current product expectations and existing operational workflows

## 2026-03 - Recruiter Bootstrap Uses Edge Function

Decision:
- first-time recruiter setup is routed through `create-recruiter` edge function
- setup status is also resolved through the edge function

Why:
- avoids fragile direct browser-side RLS-sensitive setup logic
- keeps bootstrap rules centralized

## 2026-03 - Supabase Auth Lock Override Kept

Decision:
- keep the no-op auth lock override in `src/lib/supabase.js` for now

Why:
- it removed a severe signed-in startup delay caused by auth lock contention

Trade-off:
- introduces multi-tab refresh-token race risk that should be revisited later

## 2026-03 - Recruiter Password Reset Uses Supabase Auth

Decision:
- recruiter password reset emails are sent via Supabase Auth
- not through Resend

Why:
- password reset is an auth concern, not a custom transactional-email concern

## 2026-03 - Shared Applicant Branding Updated To Njord Holmes

Decision:
- shared applicant header branding now uses:
  - real `njord_logo.png`
  - product name `Njord Holmes`

Why:
- align visible tool identity to requested branding

## 2026-05 - Single Active Applicant Pipeline

Decision:
- enforce one active application per applicant at the database layer
- treat `hired`, `rejected`, and `withdrawn` as terminal statuses that allow a future application

Why:
- prevents alternate clients or stale browser state from bypassing applicant dashboard guards
- keeps the applicant pipeline unambiguous for recruiters

## 2026-05 - Edge Function CORS Uses APP_URL Allowlist

Decision:
- edge functions use a shared request-origin CORS helper instead of wildcard origins
- allowed origins come from the comma-separated `APP_URL` runtime setting, with edge env vars as fallback
- `OPTIONS` preflights return bodyless `204` responses

Why:
- browser access is limited to intended frontend origins
- the shared helper keeps CORS behavior consistent across deployed functions

## 2026-06 - Recruiter Shell Split Into Dashboard, Workspace, and KPI

Decision:
- the recruiter shell now uses a dedicated `Dashboard` snapshot, a `Workspace` for requirements/candidates/pipeline work, and a separate `KPI` page
- the legacy prospect route remains as a redirect into `Workspace` for compatibility

Why:
- keeps the executive snapshot clean
- separates daily operations from reporting
- preserves older entry points while the UI transition settles

## 2026-06 - Vite Uses Rollup WASM In Codex

Decision:
- the local Vite toolchain resolves `rollup` to `@rollup/wasm-node` through the repository manifest
- Playwright smoke launches Vite via the local `./node_modules/.bin/vite` binary instead of `npm run dev`

Why:
- the Codex macOS Node runtime cannot load the signed native Rollup addon reliably in this environment
- the WASM build keeps `npm run dev` and the smoke server bootable without manual node_modules patching
- the direct local binary avoids PATH drift and makes the smoke auto-start path deterministic
## 2026-11 - Coordinator Is Read-Only in the Application Workflow

Decision:
- Coordinators may read applications, status history, schedules, photos, and offer letters, but cannot change those records or send test/interview/offer workflow mail
- Recruiter and Master Recruiter retain application workflow writes through `edit_junction_status`; applicant draft ownership rules remain separate

Why:
- `profiles.user_type = recruiter` includes Coordinators and is not an editor authorization check

