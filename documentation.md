# Project Status

## Current Milestone

- Stabilize recruiter/admin workflows, validate worksheet export fidelity, and close out recruiter-side compliance review

## Completed

- recruiter/applicant auth hardening
- recruiter RBAC cleanup and role normalization
- recruiter bootstrap/setup repair
- recruiter password reset flow
- Playwright smoke suite implementation and stabilization
- recruiter team-management fixes
- applicant shared-header branding update using the real `njord_logo.png`
- recruiter status-update modals now keep background scroll locked and allow the modal body to scroll
- recruiter status updates now refresh application lists/counts in the background instead of flashing the full workspace loader
- duplicate emergency-contact section removed from the applicant form flow
- declaration is now a real `section19` route/data key instead of the previous `section20` workaround
- applicant dashboard submitted-application view now renders an applicant-facing read-only summary and hides recruiter-only workflow controls
- recruiter review emails now issue expiring secure application links instead of relying on raw `public_token` access alone
- recruiter review emails now support a `RECRUITER_NOTIFICATION_EMAIL` runtime setting for development; if set, all recruiter submission emails are sent only to that address instead of profile-derived recruiter recipients
- Section 14 simplified so course metadata is system-managed from the course map, deprecated fields were removed, and existing data was normalized through DB migration
- applicant auth refresh fixture repaired so smoke can regenerate applicant session state reliably
- CMA CGM worksheet export path wired through the hosted worksheet service and recruiter download flow
- recruiter-side compliance review implemented locally on the submitted application view and recruiter applications workspace
- DB-level single-active-application enforcement is live: applicants can have only one non-terminal application at a time
- Supabase edge functions now use a shared request-origin CORS helper backed by the `APP_URL` runtime setting

## Current Verification State

- Hardening follow-up on 2026-05-06:
- remote Supabase project `btbqdviuqcpauojmorvx` has migration `2026050601_enforce_single_active_application_and_add_cors_helper` applied
- live DB validation passed with an isolated temporary applicant: second active application insert returned `23505` / `unique_active_application_per_user`, terminalizing the first application allowed a new active application, and cleanup left zero temporary validation applications
- live edge-function CORS validation passed for `https://njord-resume-form.vercel.app`: representative preflights return `204` with a matching `Access-Control-Allow-Origin`
- unlisted origins such as `http://localhost:5173` and `https://example.invalid` do not receive `Access-Control-Allow-Origin`; add local/dev origins to the `APP_URL` runtime setting only when browser QA from those origins is intended
- `npm run test:smoke` currently fails against the stored applicant account because that account has active submitted application `NJD-211280`, so draft-start smoke helpers cannot find a start/resume button under the new single-active rule; refresh smoke data with a dedicated applicant or terminal test data before expecting the full applicant smoke suite to pass
- Review follow-up on 2026-03-30:
- applicant sign-out cleanup no longer throws `clearLoginIntent is not defined`
- applicant Google sign-in no longer waits on profile bootstrap before routing to `/dashboard`
- declaration step now routes at `/application/form/section/19` and the visible numbering is aligned across sidebar, dropdown, footer, review, and dashboard
- applicant submitted-application summary no longer exposes recruiter-oriented header copy or status-change controls
- `npm run lint` passes
- `npm run build` passes
- `npm run test:smoke` passes (`75 passed, 2 skipped`) on top of the latest diff
- live post-migration Section 14 submitted-application sanity check passed
- CMA CGM writer prototype generated a visually correct Sections 1 and 2 export for live application `NJD-211280`
- current local code also includes broader recruiter compliance logic and recruiter applications compliance triage UI, but this still needs manual product validation and a clean commit

## Current Role Model

- `Master Recruiter`
- `Recruiter`
- `Coordinator`

## Current Auth Model

- applicant: Google OAuth
- recruiter: email/password

## Important Commands

- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run test:smoke`
- `npm run test:auth:applicant`
- `npm run prototype:cma-cgm -- --template '/Users/kartikraghavan/Downloads/CMA CGM form 1.numbers' --public-token '<public-token>' --output '<output.xlsx>'`
  historical prototype command; current product path uses the hosted worksheet service and uploaded normalized `.xlsx` templates

## Known Issues / Risks

- multi-tab auth behavior has residual risk because the Supabase auth lock was overridden to eliminate a severe startup stall
- full branding consistency across all recruiter/public pages still needs a final pass
- recruiter admin/manual validation still needs a short human QA pass beyond smoke automation
- worksheet export still needs end-to-end fidelity validation against the second customer template and against prefilled template overwrite behavior
- local docs still contain some historical prototype language and should be kept aligned with the hosted worksheet service path
- do not carry the development `RECRUITER_NOTIFICATION_EMAIL` override into customer deployment; production must route recruiter emails to real recruiter inboxes/profile emails using a verified Resend domain/from-address
- local browser calls to edge functions will fail CORS unless the local origin is intentionally included in the comma-separated `APP_URL` runtime setting

## Immediate Next Steps

- commit and push the single-active-application/CORS hardening changes after final local checks
- verify the second worksheet template and close worksheet export fidelity gaps
- manually verify the applicant submitted-application summary from the dashboard against applicant expectations
- manual QA of recruiter admin flows
- clean applicant test-data state and retest full applicant entry flow
- decide whether to harden the auth lock implementation further

## Recruiter Compliance Review Spec

### Goal

Add a recruiter-only compliance and expiry review panel on the submitted application view so each application surfaces:

- red / amber / green readiness indicators
- missing or expiring documents and courses
- rank-aware training checks using existing form data
- recruiter red flags such as sea-service gaps greater than 6 months

### First Implementation Slice

Phase 1 uses only fields already captured in the application. No schema changes are required.

Display location:

- recruiter-only panel on `ViewApplication`
- placed high on the page, before the long section-by-section review content

Statuses:

- `red`: missing required item, expired item, or critical red flag
- `amber`: expiring soon or warning item requiring recruiter review
- `green`: currently valid / satisfied

Current thresholds:

- passport: minimum 12 months validity remaining
- CoC near-expiry warning: less than 6 months remaining
- medical, CDC, training certificates, endorsements, visas: expiring within 30 days = amber
- sea-service gap red flag: greater than 6 months

### Current Data Mapping

Primary sources already present in the form:

- applied rank: `section1.appliedForRank`
- preferred vessel type: `section1.vesselType`
- passport: `section3`
- CDC / seaman book: `section4`
- visas: `section5.visas[]`
- CoC certificates: `section8.certificates[]`
- GMDSS certificates: `section9.gmdss[]`
- medical fitness: `section10.medicalFitness[]`
- vaccinations: `section10.vaccinations`
- marine courses / STCW courses: `section14.courses[]`
- flag-state endorsements: `section15.endorsements[]`
- sea service and engine-family history: `section16.seaService[]`

### Compliance Scope In Phase 1

Core statutory documents:

- passport
- CDC / seaman book
- medical fitness certificate
- latest CoC
- latest GMDSS certificate when available
- latest flag-state endorsement when available
- visa coverage as a warning-oriented review item
- vaccination records as a warning-oriented review item

Core STCW / security checks from `section14`:

- Basic Training
- Personal Survival Techniques - BASIC TRAINING
- Basic Fire Fighting - BASIC TRAINING
- Elementary First Aid - BASIC TRAINING
- Personal Safety & Social Responsibilities (Human Relationship) - BASIC TRAINING
- Vessel security training course
- Ship Security Officer (SSO) when rank applicability is clear

Rank-aware checks using existing data:

- Deck officers:
  - Advanced Fire Fighting
  - Medical First Aid or Medical Care
  - ECDIS
  - ARPA / NCC or Radar Simulator
  - GMDSS
- Engine officers:
  - Advanced Fire Fighting
  - High Voltage Training

Sea-service red flags:

- list all detected gaps greater than 6 months
- flag CoC records nearing expiry in less than 6 months

### Deliberately Deferred / Later Phases

These should be treated as follow-up phases, not guessed in Phase 1:

- ratings-specific watchkeeping / able-seafarer rules where the source is not yet normalized enough
- tanker / IGF / passenger applicability rules tied to exact vessel history and endorsement requirements
- route/flag/port-specific vaccination and visa logic
- recruiter workflow automation on submit or status change
- DB-level storage of computed compliance snapshots

### Output Shape For The UI

The panel should expose:

- overall summary counts for red / amber / green items
- grouped checklist sections
- explicit red-flag list
- source-aware detail text for each item, including expiry date where available

### Next Technical Step After Current Local Compliance Implementation

Once the recruiter-facing panel and applications-list triage are validated, decide whether a persisted snapshot is needed for:

- dashboard summaries
- recruiter filtering / search
- automatic checks at submission time
