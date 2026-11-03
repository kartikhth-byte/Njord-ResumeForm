# Project Status

## Current Milestone

- Stabilize recruiter/admin workflows, validate worksheet export fidelity, and close out recruiter-side compliance review

## Product Model

- Holmes is operated by Kartik Raghavan; Njordships is a customer organization (manning company), not the product operator; the principal is that organization's client receiving the Excel worksheet. Organization staff use the recruiter app, not platform-owner permissions. Full legal copy and contact details still need review.
- the product aims to serve additional organizations; the organization onboarding and data-isolation model remains to be defined
- product boundary: candidate portal owns candidate-maintained profiles and job discovery; Needle powers search/matching for candidates and recruiters; Holmes automates recruiter workflows after a match or job application
- Needle is the planned AI engine: a Holmes AI tab and requirement-level resume matching will search one canonical resume pool; Holmes applications are downstream, not a duplicate search source. See `docs/needle-integration.md`. This is designed, not implemented.
- future candidates maintain a profile/resume and can apply to listed jobs with a lightweight expression of interest; recruiter-sourced matches and job interest share a recruitment case for contact, availability, test, and interview
- recruiter discovery is inbound first: direct interest appears on its requirement and consented available candidates appear in a queue; Needle search is an additional way to find candidates, not a prerequisite for opening those leads
- the current long Holmes application is distinct: an authorized recruiter may explicitly invite it after a passed interview (following test pass or a reasoned waiver), without waiting for selection. The candidate must be told form completion is not selection; sensitive-data retention for unselected candidates remains to be approved. A recruiter may generate/download its Excel worksheet any time after form submission. Holmes does not send it to the principal: after offer acceptance and document verification, a recruiter records an audited manual-send attestation. A principal decline before hire is `rejected` with reason `principal_declined`; `hired` ends the Holmes case. The current export UI/service does not enforce submission as a minimum, and existing application/junction statuses need reconciliation.
- target flow and current implementation gaps are recorded in `docs/recruitment-flow.md`; the ordered implementation backlog is at the top of `docs/tasks.md`. This flow is not yet enforced in production.
- Needle remains independently developed; Holmes will consume a pinned, versioned service contract with staging compatibility/evaluation tests for periodic upgrades. See `docs/needle-integration.md`.

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
- applicant dashboard draft progress now uses the same required-field validation contract as the form sidebar, so empty repeatable record shells do not count as completed sections
- prospect-enrollment write RPC layer is implemented locally for notes, requirements, and junction workflows
- recruiter prospect enrollment workspace is implemented locally with create/attach, note, and transition controls
- prospect-enrollment SQL review fixes are applied locally: idempotent lookup seeds, master-only note visibility filters, requirement reopen cleanup, and RPC signature/validation cleanup
- prospect-enrollment workflow hardening is also applied locally: prospect versioning now flows through triggers, junction assigners are immutable, bulk withdrawal accepts optional expected versions, and junction transition notes attach to prospect notes instead of requirement remarks
- recruiter dashboard pipeline hub is implemented locally with conservative Operations/Prospects/Requirements/Funnel/KPI/Reports tabs plus recruiter prospect and requirement detail routes
- prospect-enrollment invite/reporting slice is implemented locally: invite request RPC, bounce webhook, deep-read/export RPCs, recent-export reporting, snapshot export buttons, and the requirement compliance overlay on the submitted application view
- export/download actions now audit before file delivery, respect format-specific export permissions, and keep prospect-detail application tokens hidden unless application access is explicitly granted
- recruiter shell redesign is implemented locally:
  - main nav now surfaces `Dashboard | Workspace | Requirements | Candidates | KPI | Expiry | Calendar | Search | Settings`
  - dashboard is a compact executive snapshot
  - workspace is split into requirements, candidates, and candidate pipeline tabs
  - candidate pipeline now uses application statuses (`under_review` through `withdrawn`) and keeps the concurrency version hidden in the control flow
  - KPI is a dedicated reporting page
  - the legacy prospect route now redirects into the workspace entry point
- crew recruitment KPI tracker is implemented locally as three dedicated pages, mirroring the "Crew Recruitment KPI Tracker" workbook:
  - `/recruiter/requirements` — requirements tracker with candidates joined, open positions, days open / days to close, target days, and on-time status calculated live; a requirement only closes when all required positions have joined
  - `/recruiter/candidates` — candidate funnel with derived stage (Contacted → Screened → Shortlisted → Interviewed → Approved → Joined, plus Rejected/Withdrawn), join flag, days to join, active-pipeline flag, and cycle completion
  - `/recruiter/kpi` — live management dashboard: open vs closed requirements, open positions, joined vs required, closure % (target ≥95%), contacted/joined today, contact-to-join conversion (target 8–12%), avg days to join, pipeline by stage, open requirement ageing, and a per-recruiter scorecard
  - all three pages compute from one shared live snapshot (`src/hooks/useKpiTrackerData.js` + `src/utils/kpiTracker.js`) so figures always agree; each page supports filtering and audited CSV export
- post-review hardening pass (2026-07-10) is implemented locally:
  - PDF export repaired app-wide: `jspdf-autotable` v5 no longer auto-patches jsPDF under ESM, so `applyPlugin(jsPDF)` is now called explicitly in the export service (previously every "Export PDF" threw at runtime)
  - CSV cells are now guarded against spreadsheet formula injection
  - `test-email.js` no longer hardcodes the Resend API key (reads `RESEND_API_KEY`; old key must be rotated)
  - export buttons on the tracker/KPI pages are gated on `canExportData()` so non-permitted roles no longer hit a guaranteed 403
  - `/recruiter/kpi` now enforces the analytics gate at page level, matching the nav visibility rule
  - tracker pages suppress metrics and show a retry state on load failure instead of rendering zeroed dashboards
  - workspace requirement edits no longer overwrite `owner_recruiter_id` (previously undid ownership transfers) and typed remarks are persisted on edit
  - workspace candidate rows now use the most recently updated application per prospect
  - `test_failed` counts as an active funnel stage (retakes supported), not a terminal rejection
  - Expiry/Calendar nav entries are hidden for `Coordinator`, matching their route guards
- live browser validation pass (2026-07-10, local dev against production Supabase):
  - remote DB was missing `2026060310`/`2026060311` (applied), the reference-data seeds (`2026071001_reseed_reference_data.sql` re-applies RBAC grants + countries/ranks/vessel_types), and had RLS wrongly enabled on the lookup catalogs (`2026071002_restore_lookup_visibility.sql` disables it) — all pushed and verified
  - the stray `20260317_remote_baseline.sql` no-op was retired to `supabase/20260317_remote_baseline.sql.disabled` after its remote history entry was repaired; migration pushes work normally now
  - workspace Candidate Pipeline redesigned: the "Application pipeline control" panel is gone; submitted-only applications render as an excel-style table styled as tiles (rounded card rows, navy border + shadow on hover, frozen ID/Name columns, sticky header) with columns ID, name, email, phone, present rank (latest sea-service rank held), applied rank, vessel applied for, status, handled by, actions, latest prospect note; inline `SequentialStatusControl` expands beneath the row; search + canonical status filter; drafts excluded; rank/vessel codes resolve to display names
- application handler tracking is implemented (2026-07-10):
  - `applications.handling_recruiter_id` (migration `2026071003`) records which recruiter is working the application; different stages can be handled by different recruiters
  - reusable `HandledBySelect` appears at every recruiter input point: the pipeline table column and inside `SequentialStatusControl` (so Search/Applications and ViewApplication get it automatically)
  - status changes auto-stamp the acting recruiter as handler when the application is unassigned
  - the KPI dashboard scorecard gained a "Handling" column (live submitted, non-terminal applications per handler) with an unassigned-count note
- KPI analytics expansion (2026-07-11):
  - KPI page now has Overview / Charts / Reports tabs
  - Overview gained a "Needs action now" panel: overdue and near-target requirements (linked), applications awaiting review >7 days, unassigned live applications, unclaimed invites >3 days, and today's scheduled events
  - Charts tab (dependency-free SVG): weekly contacts-vs-joins trend, funnel by stage, open requirements by age bucket, open positions by rank (demand map), and average days sitting in current pipeline status (bottleneck finder)
  - Reports tab: weekly management report (PDF), requirement closure (CSV), recruiter productivity (CSV), funnel drop-off (CSV) — all audit-logged and permission-gated
  - `application_status_history` table + trigger added (migration `2026071101`) so future analytics can use true time-in-stage
  - Settings moved out of the main nav into a topbar gear icon beside the user menu
  - Expiry page gained a "Send expiry warnings" button invoking `process-expiry-warnings` (previously the function was never invoked by anything); daily scheduling still needs to be enabled in Supabase
- Applications consolidation + data capture (2026-07-11):
  - Search and the workspace Candidate Pipeline merged into one Applications page (`/recruiter/applications`): pipeline-style tile table (frozen Reference/Name, present rank, notes, handled-by inside the status control) plus Search's compliance badges, advanced filters, pagination, and AI-search plumbing; the workspace tab was removed and `?tab=pipeline` redirects; nav item renamed Search → Applications
  - structured rejection capture: the previously-orphaned `RejectionModal` (9-category taxonomy, tags, keep-warm flag, notes, rejection email) is now the reject path in `SequentialStatusControl`, persisting to `applications.rejection_category/tags/notes/contact_for_future_roles` (migration `2026071102`)
  - contract end dates on hired applications (`applications.contract_end_date`) editable inline on the Applications page; KPI "Needs action now" warns when contracts end within 45 days
  - interview no-shows recorded via a third outcome in `InterviewResultModal` (`scheduled_events.outcome = 'no_show'`); application stays scheduled for rebooking
  - KPI overview gained an "Avg client response" card (junction submitted → customer decision)
- back-navigation is caller-aware (2026-07-10): requirement/prospect detail pages return to the exact page they were opened from (tracker pages, KPI ageing, workspace) via router state, with the old workspace-tab fallback for deep links
  - recruiter nav no longer overflows (hidden scrollbar + tighter spacing); all 9 items fit at laptop widths
  - verified in-browser: KPI dashboard, Requirements tracker (with a live TEST requirement `2026-Jul-001`), Candidates funnel, pipeline tiles, and requirement creation end-to-end

## Current Verification State

- Invite/bounce repair (2026-11-03): `2026110205_repair_invite_bounce_rpcs.sql` and `2026110206_fill_audit_log_action.sql` are applied to Holmes staging and production and are on pushed `main` at `2c074dd`. Staging originally lacked the active invite/bounce objects. After `0205`, bounce recording and email correction failed because legacy `audit_log.action` is NOT NULL; `0206` fills missing action from event_type. PGlite checks (22 + 6), staging database probes, and staging UI invite/email-correction/resend passed. A labelled synthetic production invite was delivered to the owner and recorded `invite_sent` with action; production correction, bounce delivery, and requirement deletion were not smoke-tested. The post-repair production and staging schema-only `public` dumps now match byte-for-byte after staging grant alignment. Case v1 (`0207`) may be tested on staging but is not production-approved; expiry (`0208`) is also unapplied. Canonical migration replay still needs the missing pre-migration `user_roles` baseline, and `auth`/`storage` were not compared.
- Production hotfix follow-up (2026-11-03): migrations `2026110200` and `2026110202`-`0204` are recorded remotely; `supabase db push --dry-run` reports up to date. Anonymous REST reads of `applications`, `application_data`, and `dashboard_applications` return 401; an old public photo URL returns 400/NoSuchBucket. Staging and production Google sign-in and new-user sign-ups are off. The live recruiter dashboard and worksheet download were verified. Production applicant submit remains untested to avoid sending email or mutating a real candidate. The production `playwright-draft-applicant@example.invalid` account was confirmed synthetic and banned until 2027-11-03 after the smoke setup reset it; the helper now requires an explicit non-production project ref and rejects production even when named.
- Production mail rotation (2026-11-03): `RESEND_API_KEY` was replaced with a separate sending-only production key. A `send-application-received` test to the owner's inbox returned HTTP 200, showed activity on that new key, and was received; it did not change an application or case. This legacy function is not called by the current submit UI: `ReviewSubmit` invokes `send-application-emails` to notify recruiters. The old production key stored in local `.env.local` is invalid. The temporary staging key remains active by owner decision; the unrelated old key visible in the current Resend account was not revoked.
- Production Data API hardening (2026-11-02): `2026110200_harden_public_table_access.sql` is applied to project `btbqdviuqcpauojmorvx`. Nine internal/backup tables now have RLS enabled and no `anon`/`authenticated` table grants; `profiles` has self/applicant-write and recruiter-read policies; `countries`, `ranks`, and `vessel_types` are read-only through RLS. Supabase's "Automatically expose new tables" setting is off and remained off after reload. The 13-table grants/RLS state was checked live; this is effective Data API privacy, not a physical move to a `private` schema. The recruitment-case migration `2026110201` was not applied by this change. Auth and Edge Function smoke checks remain pending.
- Hardening follow-up on 2026-05-06:
- remote Supabase project `btbqdviuqcpauojmorvx` has migration `2026050601_enforce_single_active_application_and_add_cors_helper` applied
- live DB validation passed with an isolated temporary applicant: second active application insert returned `23505` / `unique_active_application_per_user`, terminalizing the first application allowed a new active application, and cleanup left zero temporary validation applications
- live edge-function CORS validation passed for `https://njord-resume-form.vercel.app`: representative preflights return `204` with a matching `Access-Control-Allow-Origin`
- unlisted origins such as `http://localhost:5173` and `https://example.invalid` do not receive `Access-Control-Allow-Origin`; add local/dev origins to the `APP_URL` runtime setting only when browser QA from those origins is intended
- applicant draft/form smoke now uses a generated disposable draft applicant with no active pipeline conflict, while submitted-application checks keep using the stored Google applicant
- `npm run test:smoke` now runs reliably on the Codex macOS runtime after the Vite toolchain was switched to the Rollup WASM build; the latest canonical rerun passed (`77 passed, 2 skipped`)
- Review follow-up on 2026-03-30:
- applicant sign-out cleanup no longer throws `clearLoginIntent is not defined`
- applicant Google sign-in no longer waits on profile bootstrap before routing to `/dashboard`
- declaration step now routes at `/application/form/section/19` and the visible numbering is aligned across sidebar, dropdown, footer, review, and dashboard
- applicant submitted-application summary no longer exposes recruiter-oriented header copy or status-change controls
- `npm run lint` passes on the latest recruiter-shell diff
- `npm run build` passes on the latest recruiter-shell diff
- live post-migration Section 14 submitted-application sanity check passed
- CMA CGM writer prototype generated a visually correct Sections 1 and 2 export for live application `NJD-211280`
- current local code also includes the recruiter shell redesign and broader recruiter compliance logic, but this still needs manual product validation and a clean commit

## Current Role Model

- `Master Recruiter`
- `Recruiter`
- `Coordinator`

## Current Auth Model

- applicant: emailed magic link only (invite-only; `request-applicant-magic-link` edge function, requested from `/applicant/login`; Google OAuth login was removed from the UI on 2026-07-10)
- admin-generated applicant links contain an implicit session fragment; the browser client remains on PKCE and the token-hash callback exchanges a one-time token with `verifyOtp` (verified on Holmes staging, including a first-time approved applicant with self-service sign-ups disabled)
- recruiter: email/password
- recruiter password recovery requires a verified recruiter session; an existing applicant session gets an explanatory message instead of being redirected to `/unauthorized`
- the bare root URL and `/login` now route to the recruiter sign-in; applicants always arrive via emailed links

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

- deploy the frontend after the pushed single-active-application/CORS hardening and smoke-harness updates
- verify the second worksheet template and close worksheet export fidelity gaps
- manually verify the applicant submitted-application summary from the dashboard against applicant expectations
- manual QA of recruiter admin flows
- clean applicant test-data state and retest full applicant entry flow
- decide whether to harden the auth lock implementation further
- validate and deploy the prospect-enrollment backend slice (schema migrations plus RPC layer) once the consumer contract is ready
- validate the recruiter prospect enrollment workspace against the deployed backend and manually confirm the new workflow transitions

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
