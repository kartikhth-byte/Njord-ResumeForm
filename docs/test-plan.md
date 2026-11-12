# Platform Test Plan

## Recruitment workspace (2026-11-12)

Run `tests/recruitmentWorkspace.test.mjs`, case/KPI/directory adjacent Node suites, `supabase/tests/recruitment_workspace.test.mjs` with PGlite and the absolute migrations directory, and `recruitment-workspace.spec.js` plus candidate/fleet/KPI synthetic browser suites. Cover takeover preserving independent task ownership, stale writes, immutable actor/performer attribution, denied roles/org/anon, parallel tasks, reload, exact-case links, KPI attribution, closed-case/requirement guards and mobile side panel. Normal signed-in staging checks remain a separate gate.

## Candidates directory regression (2026-11-11)

Run `candidate-directory.spec.js`, `fleet-directory.spec.js` and
`kpi-case-parity.spec.js` on the synthetic-only Vite server with their synthetic
environment flags and `--no-deps`. Cover basic save/edit/reload, duplicate and
stale saves, CV-missing denial, fresh CV recheck on attachment, history, one
candidate per ship/multiple requirements, same-case filtering, profile Back,
Coordinator read-only controls and 390px layout. Screenshots must disable
animations so shell transitions do not obscure content.

Run the candidateDirectory, requirementGroups, recruitmentCase,
recruitmentCaseKpi and kpiTracker Node tests, plus the isolated PGlite
`platform_resume_intake.test.mjs` fixture. The SQL fixture applies `2026111101`
and checks draft note preservation, versions, org/role/anonymous restrictions,
converted drafts and actual case/junction CV guards. Mocks do not replace
normal-session staging or production release smoke.

2026-11-11: all 25 synthetic browser checks, 40 focused/adjacent Node checks,
PGlite migration chain, lint and build passed. Normal staging Master/Coordinator
checks passed with the synthetic Needle bridge; see `CANDIDATES_UI_2026-11-11.md`
for scope, fixture cleanup, review fixes and the remaining production gate.

## Existing-source attachment regression (2026-11-10)

Run the fleet-directory and KPI synthetic browser suites with uploads off; verify
Review writes nothing, Attach requires identity confirmation, duplicate choice is
explicit, saves return to result rows, existing identity fields remain unchanged,
and a candidate linked to two requirements appears once with both links. Verify
count navigation filters Candidates and no candidate list appears in Requirements.
Run `supabase/tests/needle-integration.test.mjs`, `requirement-match.test.mjs` and
PGlite `platform_resume_intake.test.mjs <absolute migrations directory>`. That
fixture includes new 1002 plus the real reviewed-source boundary migrations.
Verify actor/org/role denial, exact response set, original/facts readiness, stale
revision/evidence/requirement, missing contact, closed requirement rollback,
repeat saves, existing canonical delegation and no new index/storage records.
Live deployed-role/source smoke is still a release gate, not claimed by mocks.


## Company directory and grouped requirements (2026-11-10)

Use the synthetic `fleet-directory.spec.js` plus adjacent `kpi-case-parity.spec.js`
with `--no-deps`, fake Supabase configuration and their explicit synthetic flags.
Check inline Add/Edit/Cancel, duplicate/failure/stale handling, company/ship
identity, separate read-only roles, current versus saved names, full-width
company/ship/requirement alignment, independent collapse/filter reveal, Draft
and legacy visibility, modal matching scope/focus and held attachments. Check
390px and desktop screenshots. Run the actual new migration in the isolated
`supabase/tests/client_fleet_directory.test.mjs`; do not substitute HTTP mocks
for its authorization/version/organization tests. Staging/deployed acceptance
remains separate. Exact commands and release boundaries:
`COMPANIES_SHIPS_UI_2026-11-10.md`.


## Matching/review-only phase (2026-11-07)

Use `MATCHING_REVIEW_RELEASE_2026-11-07.md` for this phase. Check the row action,
versioned modal/original paging, mandatory present-rank and vessel matches,
optional missing nationality, held single/bulk Add and uploads, existing-candidate
access and Coordinator denial. Fixture checks do not close the deployed HTTPS,
Functions and Vercel gate. Manual/automatic intake remain off.


## Platform intake amendment gate (2026-11-07)

Use the actual ordered SQL migrations 0604, 0608–0616 in
`supabase/tests/platform_resume_intake.test.mjs` (PGlite). Check Draft/open,
legacy/direct attachment denial, audit/version conflicts, private registry RLS,
immutable extraction attempts, new/link/hold and review-before-outbox. Run
`node supabase/tests/resume-intake.test.mjs`, Python intake tests and platform
case/KPI tests. Browser acceptance uses existing normal staging Master and
Coordinator sessions, actual private synthetic Drive files, local Tesseract and
real ClamAV; no admin-generated user session or password is required.

Do not run write-capable suites against the separate production-configured
Documents checkout. The CLI Playwright suite is not used as browser evidence
in this run; the recorded CUA checks and exact limitations are authoritative.
A local adapter does not qualify deployed Edge CORS or Vercel forwarding.


## Integrated completion acceptance — 2026-11-07

Use `INTEGRATION_COMPLETION_2026-11-06.md` for current source, receipts and
open gates. New Node handler checks cover normal auth, Coordinator denial,
server-only source/prefill, viewer scopes, account audit/revocation and expiry
mail authorization. Isolated SQL checks cover minimal entry, duplicates,
contact completion, stale versions, principal evidence, grants and redaction.
Needle tests cover purpose-bound tokens, ownership/pool scope, source uploads,
retry leases, metadata-only status and narrow workspace switching. Joint
interactive smoke must use real staging roles and synthetic sources only.

Required browser checks: single/bulk Add, exact-file/email/phone identity
review, required upload failures and retry, preserved source history,
Coordinator PDF without search/edit/operator, requirement reuse/version
changes, missing-contact denial then successful completion, and manual
principal send through hire/KPI closure. Do not sum overlapping CPU suite
counts or treat a local adapter as a deployed Deno/Vercel gate. There is no
staging Needle; final hosted acceptance is operator-only production after KT's
exact-candidate approval. The existing CLI browser suite has not run in this
turn; record the actual interactive checks and any remaining gates explicitly.

## KPI integration acceptance (2026-11-06)

The local `tests/smoke/kpi-case-parity.spec.js` is synthetic-only. Check distinct hired candidates on KPI, Dashboard and Requirements, recruiter filtering/refresh, zero hires with available empty cases, legacy fallback only for missing tables, visible permission failures, and Coordinator Overview/Charts without reports/exports. The 0227 SQL fixture checks last-hire closure, duplicate cycles, cancellation/manual close and transactional rollback. Local PASS does not replace the coordinated staging case/applicant/worksheet acceptance. See `docs/WARM_NEEDLE_INTEGRATION_2026-11-06.md`.


## Automated Baseline

Required baseline:

```bash
npm run lint
npm run build
npm run test:smoke
```

Current known passing state in this phase:
- `npm run lint` passes on the 2026-06-08 cleanup snapshot
- `npm run build` passes on the 2026-06-08 cleanup snapshot
- `npm run test:smoke` passes on the 2026-06-08 cleanup snapshot (`77 passed, 2 skipped`)

## Public Data API Hardening Gate

For `2026110200`, run `supabase/tests/harden_public_table_access.test.sql` against an isolated PostgreSQL test database, then verify live catalog metadata: all 13 affected tables have RLS enabled; internal tables have no `anon` or `authenticated` grants; `profiles` has no anonymous access and only self/applicant-write or recruiter-read policies; reference catalogs permit anonymous read but no write. Confirm "Automatically expose new tables" is off after a settings-page reload. Smoke-test recruiter login/profile reads, applicant magic-link profile creation, reference catalog reads, and the service-role magic-link request function. Do not use real applicant data for write tests. These checks are separate from, and do not apply, the pending recruitment-case migration.

For Coordinator read-only access, run the `0219` regression test, then use
separate staging logins for Master Recruiter, Recruiter, Coordinator, and
applicant. Confirm that Coordinator can read application/event/photo/offer
details but cannot alter statuses, drafts, schedules, photos, or offer letters
or send invitations; both recruiter editor roles retain those controls and the
applicant retains only their own draft path. Use synthetic data and do not
trigger email or status changes during a read-only smoke. A transaction-scoped
role simulation is useful database evidence but does not replace signed-in
browser/API checks. Never run the default write-capable smoke suite against
production; use `tests/smoke/public.spec.js --no-deps` for public routes.
Do not temporarily promote the only staging recruiter to Master Recruiter:
the last-Master guard prevents ordinary demotion when staging had no Master
before the test. Use a dedicated synthetic Master account for future smoke,
and verify any temporary role change is restored with the guard enabled.

## Future Candidate Identity And Deduplication Gate

Before the candidate portal and Needle-backed recruiter directory go live, test exact resume re-upload, revised resume version, one person arriving from two sources, ambiguous identity held for review, candidate account claim, and repeated apply/add actions for one requirement. Confirm provenance remains visible and cross-company private records cannot be inferred through duplicate checks. See `docs/needle-integration.md`.

## Target Recruitment Flow Gate

Before switching live workflow, test the three entry paths in `docs/recruitment-flow.md` against one case contract: direct job interest, recruiter choice from Available, and a Needle match. Each must be visible without duplicate active cases. Confirm test/interview history can exist before a long-form row; a test waiver needs a recruiter and reason; failed, rejected, withdrawn, and no-show cases cannot be invited; an interview pass alone sends no email; an authorized explicit invite after that pass creates only one candidate draft, even before selection. Verify a recruiter can generate/download a worksheet after form submission at any case stage, including before selection or offer; draft forms cannot be exported. Generation must not send to the principal or advance the case. Verify that recording a recruiter-attested external send requires the submitted candidate-confirmed form, offer acceptance, and verified documents, and captures actor, time, recipient, channel, and worksheet version; Holmes does not claim to deliver it. A principal decline before hire becomes `rejected` with reason `principal_declined`, distinguishable in reporting; `hired` is final. Check legacy application history and cross-organization denial at DB/API/UI/storage layers. Rollout must be additive and reversible.

Before early long-form invitations ship, verify the candidate sees a clear notice that form completion is not selection and that the approved retention/deletion policy covers sensitive fields for unselected candidates. Assert organization recruiter permissions never imply platform-owner support access; test support access separately with audit evidence. Invite redemption for the same email in two organizations must bind to the signed invite's prospect and organization. Needle intake must propose, not auto-merge, identities sharing one phone/email, and imported resumes must not appear in a shared directory without the required rights and opt-in.

For `2026110224`, run `supabase/tests/bind_applicant_claim_to_invite.test.mjs` in an isolated PGlite database. On staging only, send a fresh recruiter invite to a synthetic approved prospect, redeem its direct link in a private browser, and confirm `prospects.applicant_user_id` and the draft's `prospect_id` match that invitation. Retry the same link and confirm it fails. Confirm ordinary email-only repeat sign-in works for one eligible prospect, but shared-email ambiguity sends no link; use a distinct recruiter invite for each organization. Test a corrected/archived prospect and an expired link fail closed. Do not expose a second organization to real recruiters until full tenant RLS and storage isolation are in place. Deploy the migration, `send-prospect-invite`, `request-applicant-magic-link`, and frontend together; old unbound links will no longer redeem.

For `2026110225`, pass both `0224` and `0225` migration paths to the PGlite test. On staging, verify a Recruiter cannot send the form invite before an interview pass or from an unrelated case, and can send exactly one explicit invite after the pass. Confirm the email says completion is not selection, the case records `form_invited`, and a fresh link opens only the matching prospect's draft. Confirm an uninvited or later-rejected case cannot start a new draft, while an already submitted application remains viewable. Repeat sign-in must be suppressed until a recorded eligible invite. Do not run this smoke against production; `0222` remains pending on staging and must not be applied incidentally.
Open the fresh applicant link once in a browser already signed in as a Recruiter. The successful claim must switch to the applicant dashboard, and a second use of the link must fail. A prior staging run consumed the link but briefly routed to the recruiter dashboard because the old role state was still in memory; the callback now reloads after redemption.

For the case-v1 requirement-page smoke, use synthetic staging records only. Confirm that linked prospects can be attached from the candidate detail page, case triage and forward steps preserve history, and stale case versions cannot overwrite a newer transition. Check Recruiter and Master actions against Coordinator read-only controls on Requirements, Candidates, their detail pages, Dashboard, and KPI. Creating a candidate must require Previous employer unless First time at sea is checked; test both the client validation and a successful save, Unattached listing, and attachment to an eligible open requirement.
For Coordinator KPI access, confirm the KPI sidebar item and direct URL show Overview and Charts with live counts, the scorecard and recruiter filter exclude Coordinators, and Reports and download actions remain hidden without export permission.

For assessment recording (`2026110223`), test on staging only after the migration is explicitly applied: a schedule needs a date/time, failed and no-show results need both occurrence time and reason, and History must show the entered date/location/note/reason after reload. Check that stale version and Coordinator writes are denied, retries do not add duplicate events, and no application status or email is changed. On KPI, compare current case-stage counts and assessment outcomes to case/event rows for all recruiters and one recruiter filter. Period filters use the event recording date; repeated attempts count separately. Confirm that the legacy requirement/contact metrics are still clearly separate. Production has no case tables yet; its KPI page must continue to load with the case section hidden.

## Needle Upgrade Gate

For every promoted Needle release, record the source tag/commit and run the Needle unit/evaluation suite plus Holmes API-contract, authorization, cross-tenant, dedup, requirement-mapping, and browser smoke tests in staging. Compare ranking and explanations on the reviewed resume/requirement benchmark, verify stored facts/schema compatibility, and confirm a rollback to the previous release works. A compatible engine release should not require copying Needle source into Holmes. See `docs/needle-integration.md`.

## Client Form Export Prototype

Current prototype command:

```bash
npm run prototype:cma-cgm -- --template '/Users/kartikraghavan/Downloads/CMA CGM form 1.numbers' --public-token '<public-token>' --output '<output.xlsx>'
```

Current scope:
- populates Sections 1 and 2 on the `Main` sheet
- embeds the applicant photo into `G5:H14`

Prototype verification completed:
- Sections 1 and 2 cells populated correctly for live application `NJD-211280`
- applicant photo embedded into `G5:H14`
- output workbook preserved visible template formatting on manual inspection
- target Section 1 and Section 2 cells retained their original template style IDs after writing

Prototype caveats:
- live generation requires Supabase network access
- `.numbers` template normalization currently depends on local macOS Numbers
- there is not yet automated regression coverage for the writer prototype

## Hosted Worksheet Export Validation

Staging hosted-service smoke (2026-11-05): separate Render service `njord-worksheet-service-staging` deployed commit `4361477` from `ui/warm-theme`, with `/ready` returning HTTP 200. Only staging's `WORKSHEET_SERVICE_URL` was changed to the hosted URL. A signed-in Recruiter generated and downloaded the synthetic customer's XLSX for submitted `STAGE-SUBMITTED-001`; its archive integrity check passed. A direct request for unsubmitted synthetic application `45eb5031-10f1-4945-9f6d-ead69c82f203` returned HTTP 409 with `Submit the application before generating a worksheet`. The production service was not redeployed. Template fidelity remains open.

- as an export-permitted recruiter, confirm the Worksheet action appears only for a submitted application
- POST a draft application ID directly to the worksheet service with an authorized recruiter session; expect HTTP 409 and no template download or workbook generation
- confirm a submitted application still exports after a later case/status change such as Rejected

Manual validation required for each supported customer template:
- upload a normalized `.xlsx` template in recruiter settings
- confirm the active template file name is shown correctly in settings
- open a submitted application as recruiter and launch `Generate Worksheet`
- confirm the modal shows the selected customer, active template name, and upload timestamp
- confirm generation starts only when an active template exists
- confirm the download starts with the expected generated filename format
- confirm the browser receives the generated file instead of a generic fallback name
- confirm mapped cells are overwritten even when the uploaded template already contains old sample data
- confirm visible workbook formatting is preserved after population
- confirm the export uses the current application values, not stale data from a prior run

Per-customer verification matrix:
- CMA CGM: upload template, generate workbook, manually inspect `Main`, `History`, and `End`
- Sonangol: upload template, generate workbook, manually inspect `Main`, `History`, and `End`

Specific worksheet checks:
- active template metadata displayed in recruiter UI matches the uploaded file
- generated workbook opens cleanly in Excel/Numbers
- `Main` sheet remains the active first-use sheet
- no stale `Export Summary` sheet remains in the generated workbook
- prefilled template sample values are overwritten in every mapped output region
- applicant photo, when present, is populated correctly

## Applicant Test Strategy

### Automated

- Run write-capable applicant smoke only against a non-production Supabase project. Set `PLAYWRIGHT_DRAFT_TEST_PROJECT_REF` to that project's ref and point `VITE_SUPABASE_URL` at the same project. The setup helper rejects the production project even if the ref is explicitly supplied; cached auth state is tied to the project ref.
- Each write-capable applicant smoke resets its own synthetic staging draft before the test; a cached login state alone does not reset a previously filled form. The production guard applies to this reset too.
- Public-route checks against a production-backed local build must use `npm run test:smoke -- tests/smoke/public.spec.js --no-deps` so the applicant setup dependency does not write data.
- The former `/privacy-policy` and `/terms-conditions` routes were retired by owner decision in `079ebf3`; public-route smoke checks that they redirect to recruiter sign-in. Legal copy still needs review before wider customer rollout.
- applicant authenticated smoke
- applicant section route smoke across all 19 sections
- applicant autofill smoke
- draft/form smoke uses a generated disposable applicant state at `PLAYWRIGHT_DRAFT_APPLICANT_STORAGE_STATE` so the submitted-application test account can keep an active pipeline application

### Manual

- wipe applicant test data
- log in via Google OAuth
- complete every section manually
- validate autosave, navigation, and review behavior
- from applicant dashboard, open a submitted application and confirm the summary is read-only and does not expose recruiter workflow controls
- confirm unauthenticated recruiter email review links require the secure expiring `access` token and fail cleanly when the token is missing or expired
- for export work, verify the source application’s review page values against the generated workbook section being implemented
- for single-active-application enforcement, verify that a second active draft/submission for the same applicant returns `unique_active_application_per_user` and that the dashboard/review-submit UI shows the applicant-facing conflict message

## Edge Function CORS Validation

Manual checks:
- confirm the `APP_URL` runtime setting contains every intended browser origin, comma-separated when more than one origin is valid
- send representative `OPTIONS` preflights from the production frontend origin and confirm `204` plus matching `Access-Control-Allow-Origin`
- send representative `OPTIONS` preflights from an unlisted origin and confirm no `Access-Control-Allow-Origin` is returned
- for worksheet downloads, confirm `Access-Control-Expose-Headers` includes `Content-Disposition`

## Prospect Enrollment Validation

Manual checks:
- from the recruiter prospect detail page, edit the prospect email, clear any bounce state, and send a new invite
- confirm the invite button respects recruiter permissions and that the invite reservation prevents duplicate sends in a short resend window
- confirm bounced invite emails set the prospect bounce flag and that correcting the email clears the flag before resend
- on the recruiter dashboard Reports tab, export the current prospect queue as CSV and the requirement / funnel snapshots as PDF
- confirm CSV and PDF export buttons only appear for the matching export permissions, and that the file downloads only after the audit row is recorded
- confirm the Recent exports panel shows the latest export audit rows
- open a submitted application as recruiter and confirm the generic compliance panel and requirement overlay render side by side when a linked requirement is present
- confirm the requirement overlay stays hidden when the application has no linked prospect/requirement context
- on the prospect detail page, confirm linked applications are shown without tokens unless application access is explicitly granted

## Recruiter Test Strategy

For the interview result and rejection email smoke, run the current frontend against Holmes staging on an origin allowed by its `APP_URL` setting (currently `http://localhost:3000`). Use only synthetic applications and an inbox controlled by the owner. Staging's `APPLICANT_NOTIFICATION_EMAIL` override must point to that inbox while Resend uses its testing sender; remove the override before any customer deployment. Verify both outcome buttons stay interactive; Passed requires a rating, then persists `interview_passed` and sends the candidate email without internal recommendation; Failed persists `rejected` and sends a neutral reason after the save. Check a retake's notification separately. An unsigned call to each staging function must return 401; signed-in Coordinator calls must be denied. A 401, CORS failure, or function success response alone is not evidence that a candidate email reached the inbox.

### Automated

- recruiter authenticated smoke
- public-route smoke

### Manual

- login as `Master Recruiter`
- verify team-management visibility and actions
- verify create recruiter/coordinator
- verify Add/Edit member reject passwords shorter than 8 characters before any account or profile changes (including direct `create-recruiter` calls); an empty Edit password leaves the existing password unchanged
- verify role restrictions
- verify reset-password flows
- for a new staging Coordinator invite or recovery email, open the newest link in a private browser, confirm the recruiter password form appears (not an expired-link message) and its URL no longer contains session tokens; set the password yourself, sign in, check read-only controls, then disable the synthetic account
- open submitted application from recruiter flows and confirm recruiter review controls still appear
- open a recruiter review email link and confirm the secure token grants access without exposing recruiter-only controls to applicants

## Bootstrap / Setup Validation

Manual checks:
- setup unlocked when there is no `Master Recruiter`
- setup locks after first master recruiter is created
- bootstrap path works through the UI, not only via direct function invocation

## Branding Validation

Manual checks:
- real logo appears undistorted
- `Njord Holmes` name is visible where intended
- recruiter/public surfaces are reviewed for consistency

## Needle operator pilot gate (2026-11-05)

Run the synthetic `tests/smoke/needle-embed.spec.js` against Needle's local fixture with fake Supabase endpoints; no production credentials. It checks operator access without recruiter roles, source page/PDF links under /ai, scoped repository, stream completion, Back/refresh, expired-session renewal/Retry and logout. Run `tests/needleAccess.test.mjs` and `tests/needleMiddleware.test.mjs`, including an inherited production origin in Preview (must be denied). The joint PGlite fixture in Needle checks additive DDL/RLS/server grants/membership and operator escalation denial.

After KT's operator-only production deployment, repeat through real Vercel with the real secure cookie and one actual corpus search; local proxy results are not a substitute. Verify ordinary users/Coordinators are denied, and that the new review queue and original PDF work. Keep both recruiter rollout and intake off pending separate acceptance. See `docs/needle-embed-rollout.md`.


## Warm/KPI follow-up — 2026-11-06

55 focused Node tests and 33 synthetic browser checks pass, including report
download/audit denial, case-aware totals and recovery-link placement/tab order
at 311/1280px. The real staging transaction rehearsal rolled back fully;
signed-in KPI aggregates match SQL and CSV/PDF downloads succeed.
`log-recruiter-export` is deployed on staging only and verifies the user JWT
plus export permission despite gateway verification being off. Local Functions
requests use a private staging-only proxy because the new localhost origin is
not in staging CORS; repeat on the deployed domain before release. This does
not close applicant, worksheet fidelity, live Coordinator, Preview isolation
or full legacy/case metric parity gates. See
`WARM_NEEDLE_INTEGRATION_2026-11-06.md` for evidence and remaining checks.


The automatic-closure fixture now applies historical 0227 and follow-up
2026110601 in order. Verify one requirement version increment on final hire,
no increment before final hire/on retry, actual status-RPC stale-version denial,
and rollback of status/version/case together. These pass in isolated PGlite;
a staging rollback rehearsal also verified the original function definition
was restored in that earlier rehearsal. On 2026-11-06 the follow-up migration
was permanently applied to staging only, then the rollback-only closure checks
passed again; it remains unapplied in production.


## Reused worksheet regression gate (2026-11-06)

Run `python3 -m unittest discover -s services/worksheet-service -p 'test_*.py' -v`.
A previous export used as a template must not retain its applicant photo or
signature. Check one replacement photo only, no-photo clearing, branding-image
preservation, boundary-crossing drawings and a loud failure for unlocatable
image anchors. Preserve explicit wrapping and fixed column widths; single-line
output cells use Excel text fitting. Static-label/style and mapped-value checks
on the normalized reference passed, but actual Excel/hosted and second-customer
visual checks remain required. A minimal synthetic transport template is not
customer-format evidence.
