# Decisions Log

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
