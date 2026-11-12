# Project Status

## Recruitment workspace — staging verified, release pending (2026-11-12)

Added the dedicated workspace, case/task ownership and performer-based KPI activity. Recruitment defaults to collapsible Company → Ship → recruitment rows, with requirements in a column, filtered counts and automatic expansion when filters change. Existing case stages remain authoritative. Additive migration 2026111201 is staging-tested; independent review, 45 Node tests and 31 synthetic browser checks pass. Normal Master/Coordinator UI and authenticated Recruiter database checks passed. Production approval is pending. See `docs/RECRUITMENT_WORKSPACE_2026-11-12.md` for contract, verification and release state.

## Candidates directory — deployed and smoke verified (2026-11-11)

Candidates now has inline Add/Edit and Unattached/Attached tabs. Attached rows use
**Company → Ship → Candidates**, one person per ship, with requirement links and
stages in a Requirements column. Basic details can be saved without a CV using
the existing draft store; attachment requires an available reviewed CV. Uploads
remain held. New migration `2026111101` adds safe draft reads, versioned edits and
server-side CV attachment guards. Migration `2026111101` and Holmes `1a8f6ca`
are **deployed** after exact approval. Normal operator/Coordinator live smoke
passed: basic create/edit/reload, reviewed synthetic attachment, duplicate guard,
grouping, profile Back and original Drive PDF viewing. The smoke requirement was
closed with history preserved. Optional CV upload stays held. See
`docs/CANDIDATES_UI_2026-11-11.md` for checks and release gates.

The previous Companies & ships/existing-source release is deployed: Holmes
`b573bd8f`, Needle `49e30cf8`; its final production smoke is recorded in
`docs/COMPANIES_SHIPS_UI_2026-11-10.md`. Older local-only status entries below are
historical snapshots.

## Existing résumé attachment — local follow-up (2026-11-10)

Requirements now link to a filtered Candidates page by attached count, rather than
expanding candidate rows. Candidate rows list all distinct attached requirements
with company/ship/rank and stage. Reviewed existing-source attachment uses the
scoped Needle evidence bridge and new `review_existing_resume` RPC, independent
of new uploads. Identity review, duplicates and stale/open requirement guards
remain enforced. Migration `2026111002` and Function/frontend changes are local,
uncommitted and undeployed. Combined release details and verification are in
`docs/COMPANIES_SHIPS_UI_2026-11-10.md`.


## Companies & ships UI — local implementation (2026-11-10)

The approved dedicated directory and company → ship → requirement layout are
implemented in isolated `codex/companies-ships-ui-20261110`. Directory Add/Edit
uses inline rows; requirements retain the creation/matching modals. See
`docs/COMPANIES_SHIPS_UI_2026-11-10.md` (relative to repository root) for behavior,
role boundaries, validation and release/rollback steps. Migration `2026111001`
is prepared for ship type and version-checked directory writes; it is not
applied. Staging validation, exact release review and production promotion
remain. Intake stays off. Earlier release checkpoints below are historical.


## Production matching/review accepted — 2026-11-07

Holmes `b28d6c5` plus independently reviewed Needle `a4599657` pass the production
operator-only matching/review gate: positive rows/paging, original pages/zoom,
stale versions, strict search/tray/loyalty, held creation/add/attachment/uploads,
session recovery/logout, normal Coordinator read-only access and AI denial,
existing contacts/cases and unchanged KPI counts. The synthetic fixture is
restored and closed with no attachments, uploads or invitations. Exact evidence
and limits: `docs/MATCHING_REVIEW_RELEASE_2026-11-07.md`. Intake remains off and
hosting/connected-service/dispatcher qualification remains pending. Earlier
pending checkpoints below are historical.

## Resumed production smoke — 2026-11-07

Holmes `b28d6c5` and Needle `7a0670c4` were promoted before the demo pause;
the approved schema/Function cutover is complete. On resumption a missing
Function `NEEDLE_API_ORIGIN` was configured to the existing Needle origin.
The approved synthetic requirement was created, exercised and closed without
attachments, uploads or mail. Positive results remain gated on a local Needle
vessel-summary metadata correction: populated projected experience was marked
MISSING and therefore excluded by the modal. See the current top of
`docs/tasks.md`; the preparation statuses below are historical. Intake remains
off, AI operator-only, hosting deferred, and full live acceptance is not claimed.

## Matching/review first — accepted release split (2026-11-07)

KT approved releasing matching and original review while intake hosting remains
deferred. The Requirements row action opens the modal in place; New candidate,
embedded Add (including bulk), match Attach, uploads and intake entry queues
default off through `VITE_FEATURE_RESUME_INTAKE=off`. Existing candidates remain
usable. See `docs/MATCHING_REVIEW_RELEASE_2026-11-07.md` for the amended schema,
Function, backup, flag and live-smoke order. This local follow-up is not deployed.


## Creation modals — local follow-up (2026-11-07)

New requirement and New candidate now open accessible native modals. The UI-only
patch is based on deployed `747d434`, with a preserving port in the pending
platform checkout. Focus, pending-save dismissal, failure recovery, desktop and
narrow layout were checked using synthetic data; both platform forms also open
and cancel in the existing staging Master session. No production deployment or
schema change occurred. See `docs/CREATION_MODALS_2026-11-07.md`; refreeze/review
before promotion. Match resumes remains part of the unpromoted platform release.


## Production sidebar hotfix preserved (2026-11-07)

Holmes production is `747d434` (hover/focus labels, including unfocused Escape
dismissal), promoted and public assets verified. Its exact sidebar code is
merged into this pending platform candidate so a later promotion preserves it.
The hotfix passed independent review, lint/build and synthetic CUA hover,
keyboard, expanded and mobile checks. No platform intake deployment or database
write was included. The original Function approval still refers to unchanged
source at `e04c39e`; hosting remains preparation-only until KT chooses it.

## Production release gate review (2026-11-07)

The full pending Holmes/Needle release was independently reviewed. Four findings
were fixed and independently rechecked locally: candidate/source writes now
require the reviewed owner transaction (additive 0617), referenced ships cannot
be reparented, outbox retries do not starve later work, and uncertain mandatory
rank/vessel matches are excluded. See `docs/PRODUCTION_GATE_REVIEW_2026-11-07.md`
and the amended production manifest. Production remains unchanged. KT promotion,
production service/credentials/scheduler, reviewed requirement mapping and
deployed-domain acceptance remain gates. Automatic Drive intake remains false.

## Platform Resume Intake amendment (2026-11-07)

The current isolated candidate is on `codex/platform-resume-intake` (Holmes)
and `codex/needle-platform-intake` (Needle), based on committed `2c99634` and
`d20afe0a`. It implements the revised design §11: reviewed company/ship/Draft,
case-aware candidate views, platform-owned private Drive registry/extraction,
explicit identity review, draft leads outside the pool, and reviewed-version
index events. It retires Needle original upload and contact-based grouping.
Holmes migrations 0609–0616 are staging-only. Automatic Drive intake remains off.
No GPU/model call or production push/deployment occurred in this amendment.

Current acceptance/release/rollback authority:
`docs/PLATFORM_RESUME_INTAKE_SLICE_2026-11-07.md` and
`docs/PLATFORM_RESUME_INTAKE_RELEASE_2026-11-07.md`.
Older completion records below certify the earlier scope only.


## Current integrated candidate (2026-11-07)

Production is Holmes `747d434` and Needle `401ec6e0`. KT promoted the warm/KPI
release; the earlier preparation notes below are historical. Production
operator is `kartik.neuralnet@gmail.com`; staging has separate accounts and
passwords. Drive intake remains off and AI access remains operator-only.

The new isolated completion candidate implements candidate minimum fields,
reviewed Add to Holmes, requirement Match resumes, required PDF registration
and history, viewer-only PDF access, operator health/users/audit and manual
principal-send attestation. Its five new Holmes migrations are applied on
staging only. Joint rehearsal uses staging Auth/RLS plus synthetic local
Needle sources. Minimal entry, source-linked saving, identical-file dedupe,
PDF delivery, contact completion, normal Coordinator read/write denial and
explicit form link → synthetic principal handoff → hire/closure pass. Independent
code review passed after retry/source-integrity fixes; 0608 version triggers
passed follow-up review. Version/bulk browser acceptance and deduplicated
read-back pass. KT local commit/source freeze and production promotion remain.

Read `docs/INTEGRATION_COMPLETION_2026-11-06.md` for the exact boundaries,
reset-email quota finding, new Function/gateway manifest, rollout and rollback
limits. The new source is not committed, pushed or deployed. Stored uploads
stay pending; extractor hookup and intake reopening remain separate gates.

## Historical warm/KPI preparation checkpoint (2026-11-06)

Warm/KPI release preparation: KT accepted CMA Excel/print output. Final review
closed the case-transition retry authorization gap with additive migration
0603 and executable denied-role regression checks; it is on staging only. The
fresh post-cleanup production dump and scratch counts pass. See
`docs/WARM_KPI_KT_RELEASE_2026-11-06.md` for the exact ten-migration /
thirteen-Function package and coordinated KT promotion. Normal Coordinator
hosted worksheet denial passes (403); real-domain acceptance remains pending;
this is not production release completion.

The operator-only embed’s latest verified baseline is Holmes `21ac6a5` and
Needle `401ec6e0`.
The local `codex/holmes-warm-integration` candidate reconciles the committed
warm-theme line with that pilot; it is not a deployment. Read
`docs/WARM_NEEDLE_INTEGRATION_2026-11-06.md` before rollout. The original
working checkout remains untouched; its requested KPI/requirement-completion
slice was copied explicitly into this isolated candidate.
AI access stays operator-only and Drive intake stays false.

Staging rehearsal is complete for this KPI slice: live totals match SQL,
distinct-hire closure passes a rollback-only transaction, and audited CSV/PDF
downloads succeed. The missing `log-recruiter-export` function was deployed
only to staging with handler-side JWT/permission verification. A private local
proxy routes Functions requests to staging because this localhost origin is
outside staging’s CORS allowlist; deployed-domain acceptance remains open.
Final checks: 55 unit tests, 33 synthetic browser tests, lint and build pass.
Recruiter password recovery now follows Sign in, including keyboard order
and narrow-screen checks. No production release occurred.

Review follow-up: automatic requirement closure now has an additive prepared
migration, `2026110601`, to advance its version and reject stale status actions.
The isolated SQL fixture and a real staging rollback rehearsal pass; the latter
restored both rows and the original function. The migration is now permanently
applied on staging only; function/trigger
readback and a fresh rollback-only closure rehearsal pass. Production remains
unchanged. Include it after 0227 in the release manifest.

## Current Milestone

- Local warm/Needle integration checkpoint (2026-11-06): the isolated `codex/holmes-warm-integration` candidate now includes KT's requested case-aware KPI/requirement-completion slice and migration 0227. Filled-position totals deduplicate hired candidates per requirement; legacy contact/funnel metrics remain separate. Unit, isolated SQL and synthetic browser checks pass. This is not deployed; see `docs/WARM_NEEDLE_INTEGRATION_2026-11-06.md`.


- Stabilize recruiter/admin workflows, validate worksheet export fidelity, and close out recruiter-side compliance review

## Product Model

- Holmes is operated by Kartik Raghavan; Njordships is a customer organization (manning company), not the product operator; the principal is that organization's client receiving the Excel worksheet. Organization staff use the recruiter app, not platform-owner permissions. Full legal copy and contact details still need review.
- the product aims to serve additional organizations; the organization onboarding and data-isolation model remains to be defined
- product boundary: candidate portal owns candidate-maintained profiles and job discovery; Needle powers search/matching for candidates and recruiters; Holmes automates recruiter workflows after a match or job application
- Needle is the planned AI engine: a Holmes AI tab and requirement-level resume matching will search one canonical resume pool; Holmes applications are downstream, not a duplicate search source. See `docs/needle-integration.md`. This is designed, not implemented.
- future candidates maintain a profile/resume and can apply to listed jobs with a lightweight expression of interest; recruiter-sourced matches and job interest share a recruitment case for contact, availability, test, and interview
- recruiter discovery is inbound first: direct interest appears on its requirement and consented available candidates appear in a queue; Needle search is an additional way to find candidates, not a prerequisite for opening those leads
- the current long Holmes application is distinct: an authorized recruiter may explicitly invite it after a passed interview (following test pass or a reasoned waiver), without waiting for selection. The candidate must be told form completion is not selection; sensitive-data retention for unselected candidates remains to be approved. A recruiter may generate/download its Excel worksheet any time after form submission. Holmes does not send it to the principal: after offer acceptance and document verification, a recruiter records an audited manual-send attestation. A principal decline before hire is `rejected` with reason `principal_declined`; `hired` ends the Holmes case. The current export UI/service does not enforce submission as a minimum, and existing application/junction statuses need reconciliation.
- Invite-bound applicant identity is implemented in `2026110224` and the two magic-link Edge Functions on Holmes staging only. The callback verifies the OTP then redeems a one-use fingerprint against the request's exact prospect and organization; the applicant dashboard starts drafts only for a claimed prospect. Shared-email sign-in without a recruiter-specific invitation is suppressed. Local SQL checks, lint, and build pass; the isolated staging migration dry run is clean after applying `0224`, with `0222` still pending in the normal branch history. A fresh staging link opened `/dashboard` for synthetic prospect `99a1ccfb-4380-47d4-a38b-58cecd49d8ce`; Start application opened Section 1 and created exactly one unsubmitted draft linked to that prospect, with an `application_data` row. Reload showed Continue, which returned to the same Section 1; the draft count remained one. Reopening the used link in a fresh private window showed Link unavailable. Corrected-email and archived-link denials also passed against staging Auth and the claim RPC, with the synthetic candidate fully restored afterward. Shared-email ambiguity is covered locally but not live because a second organization must wait for tenant isolation. Production is unchanged; old unlinked submitted applications are not guessed into an organization.
- The follow-up `2026110225` case gate is on staging only: a recruiter must select a matching post-interview case before sending the long-form invite; repeat sign-in and new drafts require an eligible recorded invite. The email says completion is not selection. Focused `0226` grants the Edge Function's service role case-table SELECT after a live permission error, without adding anonymous access. A synthetic uninvited request was suppressed with no email. A signed-in Recruiter sent an invite for an Offered synthetic case; its case timestamp, bound request, `invite_sent` audit, and owner-inbox delivery were confirmed. The first click from a recruiter-signed-in browser claimed the link but landed on the recruiter dashboard; a second click correctly showed Link unavailable. `AuthCallback` now reloads a successfully redeemed applicant session at `/dashboard`; a fresh staging link in that same browser opened the applicant dashboard and was claimed once. Live staging Auth/RPC probes rejected corrected-email and archived links with `invalid_claim`, then restored the candidate and removed temporary records. On 2026-11-05, the Recruiter UI disabled Send when no eligible case existed; rollback-only staging SQL confirmed Contacted-case invite denial and new-draft denial after rejection of an invited case. Original case statuses were restored and no smoke event remained. The focused PGlite gate test passes; shared-email remains local-test only until tenant isolation. Lint/build and targeted callback browser tests pass. Both functions and migrations are on staging, and its isolated dry run is clean. Normal branch `db push` would also apply intentionally pending `0222`, so do not run it. Production is unchanged; retention for unselected candidates and tenant isolation still block release.
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
  - KPI Overview and Charts are readable by Master Recruiters, Recruiters, and Coordinators; Reports still requires a separate export permission
  - tracker pages suppress metrics and show a retry state on load failure instead of rendering zeroed dashboards
  - workspace requirement edits no longer overwrite `owner_recruiter_id` (previously undid ownership transfers) and typed remarks are persisted on edit
  - workspace candidate rows now use the most recently updated application per prospect
  - `test_failed` counts as an active funnel stage (retakes supported), not a terminal rejection
  - Expiry remains hidden for `Coordinator`; Calendar is available read-only to all three recruiter roles
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

- Interview-result follow-up (2026-11-05, staging only): the modal click layer was removed locally; a fake-backend browser regression passes for Passed and Failed outcomes, rating enforcement, save-before-email, and no mail after a zero-row save. The pass and retake paths use the Supabase function client and warn when notification fails after a successful save. `send-rejection-email`, `send-interview-passed`, and `send-test-retake-approved` are deployed on Holmes staging with the application-editor guard; unsigned probes return 401. Those functions and the existing test/interview invitation functions honor staging's `APPLICANT_NOTIFICATION_EMAIL` override so Resend's test key mails only the owner inbox. A signed-in staging recruiter moved synthetic `NJD-985347` to `interview_passed` and confirmed persistence; authenticated pass/rejection/retake probes returned success. Synthetic `STAGE-DRAFT-001` went through test and phone-interview scheduling, then failed interview in the UI; the application persisted as Rejected with a failed-interview reason. The owner confirmed receipt of a neutral rejection email without the internal SMOKE note or raw reason code. Resend records the passed-interview and retake probes as delivered and later opened, although the owner could not locate them in Gmail; inbox visibility is unconfirmed, and the retake probe's link was inert. Coordinator denial remains unverified. A further Recruiter staging sweep generated a valid `.xlsx` for submitted `NJD-985347` after starting the local worksheet service at `127.0.0.1:8766`; the service was stopped after the check. Template fidelity and overwrite behavior remain open. New phone/in-person events no longer receive a video-platform label in local source, and new requirement/candidate recruiter selection is restricted to Master Recruiter; these changes are not deployed. The applicant 19-section staging smoke passes after making each test reset its synthetic draft; production was untouched.
- Settings password follow-up (2026-11-05): Add member already had an 8-character HTML minimum; Edit member now has the same optional minimum, and `create-recruiter` rejects short passwords for bootstrap, create, and update before writing any account/profile fields. The Edge Function was deployed to staging; a short-password bootstrap probe returned HTTP 400 with no account created. Synthetic Add/Edit and reset-email UI checks remain open.
- Staging setup follow-up (2026-11-05): the local setup page now fails closed with Retry when status lookup fails; mocked public-route tests cover unavailable and locked states. `create-recruiter` was deployed to staging. Its live status reports zero Master Recruiters, so `/recruiter/setup` shows Create admin account; this is a staging fixture gap, not a missing endpoint. A live locked-state check still needs a synthetic Master Recruiter. Production was untouched.
- SECURITY DEFINER hardening (2026-11-04): `0209` through `0213` are applied on staging and production. `0212` closed the remaining unscoped global-count/close-prompt reads and made role predicates self-only; `0213` corrected Coordinator prospect-note exposure and filtered note/remark activity. The 33 callable entries remaining after `0211` have been reviewed by caller path; 11 + 9 new PGlite checks and schema-only production readback passed. Live role-based UI smoke and the broader RLS/storage audit remain. See `docs/security-definer-audit-2026-11-03.md`. `0208` remains unapplied.
- RLS/storage audit (2026-11-04): `0214`-`0219` are on staging and production. `0219` replaced eight event/team-role policy calls to the revoked `check_permission` helper; production readback found zero direct calls. Rollback-only role probes passed. Signed-in staging Recruiter, temporary Coordinator, and temporary Master UI reads passed for applications and protected photos; Coordinator status controls were absent. A Coordinator Calendar route denial was fixed locally so Calendar is read-only for that role. SQL confirmed the staging account was restored to Recruiter with the last-Master trigger enabled; a fresh Calendar navigation also showed Recruiter in the UI. Public-route smoke passed 6/6. Applicant and offer-letter function checks remain open. See `docs/rls-storage-audit-2026-11-04.md`. `0208` remains unapplied.
- Invite/bounce repair (2026-11-03): `2026110205_repair_invite_bounce_rpcs.sql` and `2026110206_fill_audit_log_action.sql` are applied to Holmes staging and production and are on pushed `main` at `2c074dd`. Staging originally lacked the active invite/bounce objects. After `0205`, bounce recording and email correction failed because legacy `audit_log.action` is NOT NULL; `0206` fills missing action from event_type. PGlite checks (22 + 6), staging database probes, and staging UI invite/email-correction/resend passed. A labelled synthetic production invite was delivered according to Resend and recorded `invite_sent` with action; production correction, bounce delivery, and requirement deletion were not smoke-tested. Before case v1, production and staging schema-only `public` dumps matched byte-for-byte after staging grant alignment. Canonical migration replay still needs the missing pre-migration `user_roles` baseline, and `auth`/`storage` were not compared.
- Recruitment case v1 staging (2026-11-03): `2026110207_recruitment_case_v1.sql` was applied only to Holmes staging from an isolated worktree; dry run listed only `0207` and was clean afterward. Its 27 in-memory checks and live rollback-only recruiter/applicant flow and RLS probes passed. One organization is seeded, with zero persistent case/event rows and no backfill links on staging. The case UI, invite integration, claim binding, worksheet attestation, and KPI parity are not yet verified. Production has no `0207`; expiry `0208` is unapplied everywhere. See `docs/production-baseline-audit.md`.
- Case-panel smoke setup (2026-11-04): synthetic staging requirement `0565f1ff-13af-4403-8360-f4124b8a26c1` was created, but attaching a prospect initially failed because `audit_log_typed_fk_check` rejected the three related IDs recorded for a junction event. `2026110220_allow_related_audit_context.sql` fixes that constraint; nine local regression checks passed. It was applied to staging only, confirmed by live constraint readback and a clean dry run. The attachment retry passed; production is unchanged.
- Case-panel smoke rerun (2026-11-04): synthetic candidate attachment and case checks A–E/G passed on staging. F did not reproduce a stale conflict because the second tab auto-refreshed. L exposed two UI gaps, both fixed locally and verified on staging: Previous employer now validates before insert unless First time at sea is true, and the Unattached candidate row links to its detail page. The candidate attached to the only eligible open requirement and could not be attached twice. A temporary staging Coordinator role check passed H/M (read-only case panel and detail pages), and Dashboard opened on Whole team. K found a Coordinator KPI access mismatch: the Dashboard's Open KPI link shows "KPI analytics is restricted." The account was restored to Recruiter and verified in staging SQL. Master checks J/K remain untested. Production is unchanged.
- Production hotfix follow-up (2026-11-03): migrations `2026110200` and `2026110202`-`0204` are recorded remotely; `supabase db push --dry-run` reports up to date. Anonymous REST reads of `applications`, `application_data`, and `dashboard_applications` return 401; an old public photo URL returns 400/NoSuchBucket. Staging and production Google sign-in and new-user sign-ups are off. The live recruiter dashboard and worksheet download were verified. Production applicant draft and submit passed on 2026-11-04 with a synthetic applicant; the recruiter view showed application `NJD-036898`, and the synthetic records were then deleted and verified absent. The production `playwright-draft-applicant@example.invalid` account was confirmed synthetic and banned until 2027-11-03 after the smoke setup reset it; the helper now requires an explicit non-production project ref and rejects production even when named.
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
- Supabase Admin recruiter invites and some recovery emails return an implicit session fragment even though the browser client uses PKCE. The recruiter reset page imports either session with `setSession`, clears the fragment, and waits for authorization before showing the password form. Auth state callbacks defer database authorization queries until after the Supabase auth event returns to avoid a lock deadlock; the staging Coordinator invite reached the password form on 2026-11-05.
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
- Coordinator application-workflow boundary (2026-11-04): `0216`-`0219` are applied on staging and production. The application UI hides decision controls, and four scheduling/notification functions enforce editor checks. Staging role simulations and signed-in read-only UI checks passed for Recruiter, Coordinator, and Master Recruiter. Calendar access for Coordinator was fixed locally; applicant/API and offer-letter checks remain open.
- Recruiter Workspace retired (2026-11-04, `ui/warm-theme`): its requirement and candidate actions moved to the Requirements and Candidates pages ("New requirement" / "New candidate") and to the detail pages (requirement: Edit, Close, Cancel, Archive, Delete; candidate: Attach to requirement, Archive, Delete; the application link stays in the candidate's invite panel). `/recruiter/workspace` redirects to Requirements, or Candidates for `?tab=candidates`; detail URLs under `/recruiter/workspace/...` are unchanged. Writes live in `src/services/recruiterRecordService.js`.
- Migration renumbering (2026-11-04): case v1 `2026110207` → `2026110221` and the expiry fix `2026110208` → `2026110222`, so both sort after the applied `0209`-`0220`. Staging recorded case v1 as `0207`; its history is repaired to `0221` without rerunning the SQL (`supabase migration repair --status reverted 2026110207`, then `--status applied 2026110221`). The case backfill key stays `backfill:2026110207` so reruns skip staging's existing rows. Production has neither migration.
- Case assessment/KPI build (2026-11-04, staging only): staging history repair is complete; `ui/warm-theme` was backed up to GitHub at `a529b28` before this build. New `0223` requires schedule/outcome timestamps and reasons for failed/no-show results on `recruitment_case_transition`, storing details in immutable case events. The requirement case panel records and displays them. KPI Overview shows case counts and assessment outcome rates; the stage chart and funnel CSV use cases where present. Older requirement/contact/application metrics still use legacy sources pending full parity. An isolated staging dry run listed only `0223`, then the migration was applied there without `0222`. A synthetic recruiter case passed test scheduling/result and interview scheduling/result in the browser; History and stage survived reload, and KPI Overview/Charts reflected them. New SQL/KPI tests and lint/build pass. `0222` remains pending on staging; neither `0222` nor `0223` is applied to production. This new build is not pushed.


## Expanded warm release checks (2026-11-06)

Fresh full production dump and scratch row-count checks passed (91 data tables /
7,689 rows; separate public schema/data restore: 48 tables / 959 rows). Hashes
and rollback Function sources are private. Normal staging Master and Coordinator
sign-ins now pass the team/read-only UI checks. Worksheet audit found stale
photo/signature reuse and added output-zone clearing plus preserved wrapping /
Excel text fitting; eleven focused tests pass. Hosted workbook fidelity, second
customer, applicant/email completion, application/storage HTTP denials and the final exact
release manifest/review remain open. See the integration release record for
limitations; nothing was promoted to production.

Coordinator normal-session invitation and export HTTP probes both return 403.
The first attempted non-owner recipient was blocked by Resend's unverified
test sender; the failed invitation was invalidated and staging's original
override restored. KT subsequently approved the account-owner inbox for
synthetic staging tests because no sending domain is owned yet.


KT subsequently approved the current Resend account-owner inbox for synthetic
staging emails, deferring a verified sender until a domain exists. Fresh invite
delivery/redemption and new draft creation pass. The submission-notification
function now verifies actual user JWT and submitted-application ownership before
form reads/token rotation; six new plus nine adjacent tests and focused review
pass. The function is now ACTIVE v1 on staging only. The synthetic applicant
completed declarations, submitted normally, and opened the read-only result;
one saved application has the correct user/prospect binding. Its notification
arrived at the approved owner inbox and the review link opened correctly in
the applicant session. The temporary notification override is restored.

Applicant HTTP checks deny submitted-form/application edits, foreign-record
reads/writes and foreign-owner photo upload; anonymous application/private-photo
reads are denied, while the own photo remains readable. A progress fix accepts
an explicit medical-history No without accepting unanswered fields or missing
consent. Four new tests and independent review pass. Final focused verification:
69 Node tests, 16 validation-contract checks, lint/build. Temporary probe pages
were removed. No production deployment is authorized by these staging results.

KT subsequently confirmed all Holmes records are test data and authorized
legacy cleanup. A fresh full dump and scratch restore passed (91 data objects /
7,691 rows; public DDL/data: 48 tables / 959 rows). Exact archived-row and
protected-inventory guards passed in a rollback rehearsal and committed cleanup:
151 unlinked applications / 199 dependent rows removed. Accounts, roles,
prospects, configuration, worksheet metadata and Storage bytes were retained.
No legacy login bridge is needed for that removed cohort. Serialize temporary
production CLI credential lookups during dumps to avoid password invalidation.

0602 removes only implicit old-draft adoption from invite claiming. Its expanded
PGlite fixture and independent review pass; staging application/readback passed,
production application is still pending. The staged worksheet service now runs
2e11d4a: 5,389 hosted/local cell/style comparisons and layout metadata match;
distinct stale photo/signature markers are cleared. Direct draft/applicant/
unsigned requests are denied. Valid anonymous review opens read-only; missing
and invalid tokens fail closed in fresh Incognito. All temporary probe pages
and the test-only private window are removed.

KT approved a CMA-only pilot and will review the downloaded workbook in Excel.
Second-customer acceptance is required before enabling a second layout. The
exact nine-migration/thirteen-Function manifest is prepared; final review, KT
promotion and real-domain smoke remain. Sender/retention decisions are required
before real-applicant use; AI stays operator-only and intake stays false.

## Production warm/KPI pilot (2026-11-06)

KT promoted `a1e62c1`; the ten migrations and thirteen exact Functions are
applied/read back. Vercel is Ready. The accepted CMA worksheet writer remains
pinned on Render at `2e11d4a`, with Auto-Deploy off after specific-commit deploy.
Normal production Recruiter/operator, Master and Coordinator sign-ins pass;
one explicitly approved coarse-profile correction preserved its existing role
and password. Synthetic invite/claim/draft/autosave/submission, owner mail,
read-only review, submitted-editor denial and CMA download pass. Temporary
mail routes are restored. Coordinator application/case/KPI reads work; workflow
and worksheet controls are absent and direct Operator/AI entries are denied.
Needle AI search completes through Vercel, and Repository/detail/original PDF,
review queue, Health and logout propagation pass.

The synthetic case stops at documents verified because principal-send UI is
deferred. Staging SQL closure/version/replay proofs do not establish a live
browser hire path. Full production Coordinator HTTP probes were not repeated;
the normal-session 403 evidence remains staging-only. A new-operator cache can
briefly bounce a direct deep link until live authorization refresh; server
checks still enforce access. Post-release full dump and scratch payload counts
pass (93 data objects / 7,377 rows); public DDL/data/CHECK restore also passes
(50 tables / 632 rows). Archive hash stays private. This excludes managed-schema
reconstruction, cluster globals and Storage file bytes. Live 375/640-pixel
embed fitting and mobile menu/Escape focus checks pass; viewport restored.
Current release details: `docs/WARM_KPI_KT_RELEASE_2026-11-06.md`.

# Requirement match modal follow-up — 2026-11-07

Local follow-up to the platform-intake candidates: requirement matches remain in
a modal, with criterion ratings, paged original review and reviewed attachment
locked to that requirement. Confirmed present rank AND vessel-type experience
are mandatory; nationality and other criteria are optional. No Open in AI Search
action. See `docs/REQUIREMENT_MATCH_MODAL_2026-11-07.md` for verification and the
Needle → bridge → frontend rollout dependency. Not promoted; intake stays off.
