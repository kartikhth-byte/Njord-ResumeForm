# Decisions Log

## 2026-11 - Needle Resume Pool Precedes Holmes Applications

Decision:
- integrate Needle's recruitment intelligence into a Holmes AI tab and requirement-level resume matching, excluding Seajobs download/local-agent workflows
- use one canonical resume pool across existing Needle resumes, direct intake, candidate-portal intake, and later customer-website intake
- do not treat a resume record as an already-verified candidate-owned profile; the future candidate login lets a person maintain that profile and resume
- distinguish a lightweight application/interest in a listed job from the existing long Holmes form, which is completed after test and interview pass to generate the customer Excel worksheet
- candidate portal owns the candidate-maintained profile and job discovery; Needle powers candidate job search and recruiter candidate/requirement search; Holmes owns recruiter workflow automation after a match or job application
- recruiter discovery is inbound first: direct interest and consented availability are visible without a search; Needle search extends discovery when obvious leads are insufficient
- keep Needle independently maintained; Holmes consumes a versioned, pinned service contract and owns only its adapter/workflow. Compatible Needle engine releases are promoted after contract/evaluation tests, not copied or merged wholesale into Holmes.
- track recruiter-sourced matches and candidate-initiated job interest on a candidate-requirement recruitment case; keep search results advisory and company-specific workflow data access-controlled

Why:
- avoids duplicate candidates and rankings caused by indexing both resumes and derived applications
- gives AI search and requirement matching a single resume evidence contract without conflating job interest, recruitment progress, and worksheet data collection

Implementation details and release gates: `docs/needle-integration.md`.

Implementation status: the target case progression is specified in `docs/recruitment-flow.md`, but the current prospect/junction/application schema and invite gate do not yet enforce it. Customer submission and offer ordering after the long form remain open.

## 2026-11 - Holmes Operator And Customer Identity

Decision:
- Holmes is the product name and is operated by its owner
- Njordships is a customer, not the operator of Holmes
- the product aims to serve additional customers; the deployment and customer data-isolation model is still open
- public legal-page operator wording remains pending owner approval of a legal name and contact method; generic placeholder wording is not approved for publication

Why:
- keeps product branding, operator identity, and customer identity distinct without inventing a legal entity

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
