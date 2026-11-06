# Warm-theme and live Needle integration

Status: local integration candidate; **not promoted**. Branch
`codex/holmes-warm-integration` merges production pilot `ea97b2a` with the
committed `ui/warm-theme@3e3566a`. KT subsequently requested the pending KPI
code as well. Its case-aware requirement totals and completion slice (0227)
are now included from a hash-recorded local snapshot. The shared checkout and
its unrelated pending design/candidate changes remain untouched.

## What is reconciled

- Warm recruiter sidebar, applicant/recruiter auth layouts and theme tokens.
- AI Search and Operator navigation, with a collapsed Holmes rail while AI is
  open; the saved rail preference returns on leaving AI. Operator uses dark
  theme, including its first paint.
- Existing Ed25519 exchange, `/ai` routing middleware, operator-only client and
  function flags, bounded renewal/Retry, logout and scoped Needle APIs.
- Organization Settings retains Team and Worksheet templates. Its old
  Integrations link redirects to the operator console only for operators;
  platform-settings function authorization remains operator-only.
- Coordinator read-only Calendar aliases and the existing team URL redirect.
- Warm case/invite/worksheet code is retained, with its staging-first gates.
  Add to Holmes, Match resumes and candidate-field relaxation are not built
  by this merge.

The embedded Needle build also needs the separate
`codex/needle-embed-responsive` change: mobile Search menu replaces its fixed
sidebar below 768 pixels. The production-based Holmes responsive hotfix can
ship before this larger candidate. Merge that reviewed hotfix into this branch
before final promotion rather than overwriting a newer production main.

## Verification and production preflight

Local checks: lint and production build; 43 client/access/middleware/KPI tests;
27 case-v1 database assertions, assessment and invite/claim SQL fixtures; and
22 synthetic browser checks covering public auth, operator/Coordinator gates,
review/PDF delivery, scopes, desktop rail, mobile menus, route sync, renewal,
Retry and logout. Narrow-pane checks include 311, 375 and 640 pixels.
The final drawer keyboard focus checks also pass. These
are local results, not live warm-theme workflow acceptance.

Read-only production preflight on 2026-11-06 confirmed migrations through
0219 plus operator migrations 0501/0502, Njordships' seed, and **no case tables**.
Migration 0220, case v1 0221, assessments 0223, invite binding 0224, case gate
0225 and service-role case read 0226 remain a coordinated backend rollout.
Expiry migration **0222 is intentionally excluded**. Do not run unrestricted
`supabase db push` or mass-deploy functions. The new KPI slice includes 0227;
recheck its current staging/production state before applying it. Migration 0228
and the other pending record/ship-design changes are outside this slice.

Before a production release:

1. Complete the shared warm work's remaining staging acceptance in `docs/tasks.md`
   (roles, applicant flow, case/KPI parity, worksheet and email delivery). Use
   synthetic records and an owner-controlled inbox. Do not reset real accounts.
2. Recount migration/object state and take/verify a fresh private full backup
   with scratch row-count restore evidence. Independently review the final
   exact candidate and schema/function manifest before any production write.
3. KT approves and applies only the reviewed missing migrations in dependency
   order. Test the already-present Njordships organization shape and name.
   Never replay 0501/0502 or apply 0222 incidentally.
4. Reconcile the changed function handlers and their shared dependencies;
   deploy the invite/claim functions with their migrations and frontend as one
   coordinated release. Modern secret keys use apikey only; user JWTs still
   use Authorization. Keep `manage-runtime-settings` operator-only. Record
   each previous deployed function version and gateway JWT configuration.
5. Promote the worksheet service with its submitted-form gate separately;
   keep production URL/keys and sender distinct from staging. Remove test
   recipient overrides only after production recipients/from-address review.
6. KT promotes the reviewed frontend after checking remote main has not moved.
   Keep both AI flags at `operator`, Preview forwarding denied and Drive intake
   false. Test actual Vercel/PDF behavior and the case/applicant/worksheet flows
   before admitting a recruiter.

No production migration, function deployment, service setting or candidate row
was changed by preparing this candidate. No GPU/model work is included.

## Rollback

Record the current Vercel, function and worksheet versions before promotion.
Restore compatible previous frontend/functions/service together, turn AI flags
off if necessary, and keep intake false. Additive case/invite schema and data
remain in place; do not drop case events or restore a whole database over new
legitimate work. A schema/data restore requires a separately reviewed plan.
Needle's responsive-only release uses the prior Railway deployments for rollback
and does not require a database rollback.


## KPI addition — 2026-11-06 (local only)

KT requested adding the warm checkout's pending KPI work. Five code/test files
matched its committed base before applying the exact source snapshot; 0227 and
its SQL fixture were added explicitly. The source checkout was not edited or
committed. Snapshot hashes live privately under the operator-pilot evidence
folder, not in Git. Separate candidate-case UI, 0228, company/ship design,
reference PDFs and unrelated documentation edits were not imported.

Included behavior:

- KPI, Dashboard and Requirements share distinct hired-person totals per
  requirement when case tables are available. Repeated cycles for one person
  count once on that requirement. Empty case tables mean zero hires; missing
  case tables retain the legacy joined-junction path. Permission errors remain
  visible and do not silently select legacy totals.
- Requirement detail uses the same hire rule for its early-close warning,
  shows the case list once, and refreshes the requirement after a case change.
- 0227 closes an open requirement on the last distinct hire in the same
  transaction. It preserves manual closure and cancellation; it does not
  retroactively close already fully hired open requirements. Inventory those
  separately before rollout. No database was accessed by this local work.
- Report source wording distinguishes these filled-position totals and case
  assessment metrics from still-legacy contact, candidate-funnel and scorecard
  metrics. Full case/legacy KPI parity is not claimed by this slice.

Verification: 35 Node unit tests, the isolated PGlite closure fixture (including
repeated-person cycles and transaction rollback), and seven synthetic browser
checks pass. The browser suite checks all three surfaces, recruiter filtering,
refresh, missing/empty cases, fail-closed permission errors and Coordinator
read-only charts without reports/exports. No production records, credentials,
model calls, email or deployment were used. Lint/build pass; existing bundle-size
and Browserslist warnings remain.

Focused checks:

```sh
node --test tests/kpiTracker.test.mjs tests/recruitmentCaseKpi.test.mjs \
  tests/recruitmentCase.test.mjs tests/kpiAccess.test.mjs
# SQL: run close_filled_requirements_from_cases.test.mjs in an isolated PGlite
# environment, passing 2026110227_close_filled_requirements_from_cases.sql.
# Browser: run kpi-case-parity.spec.js with HOLMES_KPI_SYNTHETIC_SMOKE=1,
# VITE_SUPABASE_URL=https://supabase.invalid and a synthetic publishable key.
# Use a dedicated local Vite server and no applicant/auth setup dependencies.
npm run lint
npm run build
```

The combined warm/KPI merge was committed locally as `cc210f5`. Production
main's responsive commit 21ac6a5 was reconciled in local merge `79aa020`,
preserving the warm sidebar and the mobile/keyboard regression checks. No production promotion is
part of adding this code. Rehearse the exact case migrations through 0227 and
function/frontend/service bundle on staging, then obtain KT's approval for
production writes. The prior staging 0227 result in the source documentation
is historical evidence, not a fresh environment readback from this run.


## Staging preparation checkpoint — 2026-11-06

Read-only staging catalog check for `dwslhetniuzpyuspuomy` confirms migrations
0220, 0221 and 0223–0227, both case tables and the enabled closure trigger.
0222 remains absent. Operator tables are absent on staging; no new operator
access or AI forwarding is needed for the case/KPI rehearsal. Do not point a
staging/Preview build at production Needle. No migration was applied by this
preflight. The existing case function definitions were captured privately for
comparison; no candidate rows or credentials were printed.

The local merge review confirms all 37 deletions are inherited from the warm
branch. Credential-pattern/private-path scanning found no staged matches.
The six access/middleware/case/KPI unit files pass 46 tests. This is self-review
and local evidence; the final production promotion review is still required.


## Completed KPI staging rehearsal and sign-in follow-up — 2026-11-06

This checkpoint supersedes the earlier local test counts above. Local commits
`cc210f5` and `79aa020` contain the warm/KPI integration and live responsive
hotfix reconciliation. The original warm checkout and its unrelated work remain
untouched. No production setting, schema, data or deployment changed.

- **Live staging KPI:** database aggregates and signed-in UI agree: two
  requirements, one open, three required positions, zero distinct hires, two
  open positions; two active cases and one closed case. Dashboard and
  Requirements also load. These are staging fixtures, not production totals.
- **Actual closure rehearsal:** a rollback-only staging transaction verifies
  that the first distinct hire leaves a two-position requirement open, a repeat
  cycle for that person adds no position, and the second distinct hire closes
  it. Transition retry is idempotent; authenticated direct case UPDATE is
  denied. No rehearsal prospect/requirement remains after rollback.
- **Exports:** staging lacked `log-recruiter-export`. Its request logic was
  extracted into a tested handler. Gateway `verify_jwt=false` supports modern
  signing keys; `auth.getUser` still verifies the user JWT and export
  permissions are checked before any audit insert. Missing/invalid
  authorization and permission failures deny access. Only this function was
  deployed to staging: ACTIVE, version 1. The refreshed inventory has 14
  functions. No other function was deployed during this rehearsal.
- **Real downloads:** CSV and PDF download through the signed-in staging UI.
  CSV has 47 metric rows and matches SQL totals; PDF opens as a valid one-page
  management report with the expected headings. Copies and SHA-256 values are
  private. This does not certify worksheet/template fidelity.
- **CORS boundary:** staging’s APP_URL does not allow localhost:5197. The local
  rehearsal uses a private Vite proxy pinned to staging Functions only;
  Auth/REST still go directly to staging. No CORS/runtime setting changed and
  no traffic forwards to production Needle. The deployed-domain path remains
  a release check.
- **Function comparison:** the previous 13 deployed staging handlers match
  this candidate except for import-order/trailing-whitespace differences and
  `manage-runtime-settings`, whose candidate authorization is operator-only.
  It was not redeployed: staging lacks operator tables. This rehearsal does
  not certify every warm email/calendar/worksheet flow.
- **Sign-in:** `Forgot password?` is centered below Sign in. Keyboard order is
  email, password, Sign in, recovery. Checks at 311 and 1280 pixels cover
  placement, horizontal overflow and empty-email validation. No reset email
  or credential change was performed for those checks.

Final verification: **55 Node tests**, **33 synthetic browser tests**, lint and
build pass. Browser coverage includes audited CSV/PDF downloads, denial before
file generation, KPI permission failures, Coordinator read-only charts,
embedded navigation/session recovery and public auth. Existing bundle-size
and Browserslist notices remain. Private evidence is in the ignored
operator-pilot folder; no credentials or applicant contents are in this record.

### Remaining production gates

1. Complete broader warm acceptance in `docs/tasks.md`: applicant, role,
   worksheet and owner-inbox email flows. Live Coordinator denial,
   same-candidate Preview isolation and ordinary-Chrome inline PDF checks
   remain open; synthetic coverage does not close these checks.
2. Refresh production schema/function inventory, take a fresh complete private
   backup and verify scratch-restore row counts. Independently review the exact
   candidate and deployment manifest before production writes.
3. Obtain KT approval for only the reviewed missing migrations (currently
   expected 0220, 0221, 0223–0227 and follow-up 2026110601); exclude
   0222/0228. Coordinate invite/claim
   Functions, export logger, frontend and worksheet service, recording previous
   versions. Do not use unrestricted `db push`.
4. KT promotes; repeat real-domain smoke before admitting recruiters. Keep AI
   operator-only, Preview forwarding denied and Drive intake false. Add to
   Holmes, Match resumes and optional candidate fields remain separate work.

Rollback still restores compatible prior frontend/Functions/service together,
retains additive case data and keeps intake off. Do not restore an old full
database over legitimate new work.


### Review follow-up: automatic closure concurrency

The independent review found that 0227 changed requirement status without
advancing its optimistic-concurrency version. A client holding an older
version could therefore submit a stale status action. Preserve already-applied
0227 and apply the focused additive migration
`2026110601_version_case_requirement_closure.sql` after it. The replacement
function increments version atomically only on actual automatic closure; it
changes no historical requirement rows.

The expanded isolated SQL fixture applies both migrations, checks exactly one
version increment, and invokes the original status RPC to prove stale-version
rejection. It also checks unchanged version on a non-final hire/retry and atomic
rollback. A real staging rehearsal temporarily replaced the function inside a
transaction: distinct-hire closure, version, stale RPC denial and retry passed.
Rollback restored the original function definition (hash checked) and removed
all synthetic rows. **2026110601 is now permanently applied on staging only** (2026-11-06).
The enabled closure trigger and function were read back, then the distinct-hire
rollback rehearsal passed again without leaving fixture rows. Production still
needs this migration explicitly in the reviewed release manifest.
The 55 unit / 33 browser results above remain applicable; this follow-up changes
only the SQL function, its fixture and release records.

Independent local review is complete for the requested KPI addition, responsive
reconciliation, export authentication and recovery placement. One P2 version
finding was raised and closed after reviewing the follow-up above. No further
blocker was found in that scope; 52 focused Node tests were independently run.
This does not certify the broader warm applicant/email/worksheet flows or
approve a production deployment. Recheck the exact release manifest against a
fresh production inventory before promotion.


### Expanded release rehearsal (2026-11-06)

- Refreshed the full production backup from a consistent snapshot: 91 table
  data objects / 7,689 rows. Scratch COPY restore matched every table count.
  A separate extension-compatible public schema/data restore matched 48 tables
  / 959 rows. SHA-256 and receipts remain private. This does not certify managed
  extension/post-data DDL, database globals, or Storage object bytes.
- Read production migration history and 33 deployed Function versions. The
  missing migration manifest is 2026110220, 2026110221, 2026110223–2026110227,
  and 2026110601. Exclude 0222/0228. No production write was performed.
- Preserved downloaded source for 32 production Functions privately for exact
  comparison and rollback. `normalize-worksheet-template` advertises version 1
  but source download returns `Function store not found` (404). It is outside
  this rollout; do not redeploy or remove it as part of the warm release.
- Dedicated synthetic Master and Coordinator users signed in normally on
  staging. Master team management loaded. Coordinator Dashboard, KPI Overview,
  Charts, case history, submitted application and protected photo reads loaded;
  settings, reports, exports and case-write controls were absent. The case panel
  explicitly showed `read only`. Two direct HTTP checks using this normal
  Coordinator session returned 403: `send-prospect-invite` and
  `log-recruiter-export`. The invite probe had no valid case/prospect IDs; no
  email could be sent. Application/storage write denials remain separate.
- The original invitation callback could not load because localhost:3000 was
  not running. The isolated staging candidate now also serves that port. Only
  local rehearsal origins were added to staging Auth's redirect allowlist;
  production Auth and staging Site URL were unchanged. The default Auth email
  quota is two per hour; the Coordinator's consumed link was recovered by the
  Master UI, with KT entering the password locally. No password is recorded.
- The active staging workbook was an almost-empty synthetic transport fixture,
  so that export did not establish customer-format fidelity. An offline run on
  the normalized CMA reference checked 261 static labels/styles, mapped values,
  and overwrite clearing. Main, History and End were rendered privately.
- That check found retained applicant images in a reused template. The writer
  now clears the photo and signature output zones before filling a new record,
  preserves logos outside those zones, and fails on unlocatable image anchors.
  It never reuses a template signature as the new applicant's signature.
  Existing wrapping is preserved; single-line output cells request Excel text
  fitting. Eleven focused service/writer tests pass. Actual Excel text fitting,
  second-customer layout and hosted service acceptance remain open; the preview
  renderer and a Numbers import still clip a narrow rank cell despite the
  Excel fitting flag. Excel/print validation has not been substituted by those
  previews.

No production migration, Function deployment, frontend promotion or worksheet
service promotion was performed in this rehearsal. The synthetic applicant
fixture is explicitly prepositioned at Interview passed for invitation testing;
it is not evidence of the earlier interview/test transition workflow.


#### Email acceptance blocker (superseded for owner-inbox staging tests)

The first synthetic invitation was accepted under staging's existing owner-inbox
override. An attempt to use KT's newly approved test inbox was rejected by
Resend with HTTP 403: its test sender permits only the account-owner address.
The failed claim request is invalidated/unclaimed and the prior staging mail
override was restored. KT initially chose a verified sender, then confirmed no
domain is owned and approved the Resend account-owner inbox for synthetic
staging tests. The acceptance below supersedes this blocker for that inbox only.
Candidate-facing production mail still needs an approved sender configuration.

Independent worksheet follow-up review closed two findings: overlap checks now
use image extents/offsets (including saved OneCellAnchor drawings), and geometry
reads preserve default/grouped column and row dimensions without creating new
ones. Eleven focused service/writer tests pass; the reviewer independently ran
all six new writer tests and the original overlap/dimension repros.
Lint and frontend build pass again; existing bundle-size/Browserslist notices
remain. The local-only authorization probe page was removed after evidence was
saved. No diagnostic route is part of the application release.


### Submission notification ownership gate (2026-11-06)

KT approved using the Resend account-owner inbox for synthetic staging workflow
emails while a sending domain is unavailable. The fresh invitation was delivered
and redeemed into the intended applicant account; Start application created a
new draft. The completed submission checks are recorded below.

Before deploying the missing staging submission notifier, source review found
that it did not verify the caller owned the submitted application. The handler
now verifies the user JWT with Auth and scopes the application read to its
verified owner and a non-null submitted_at, before reading form data or rotating
review tokens. Missing, unsubmitted and another person's records fail closed.
Gateway verify_jwt=false supports modern JWT signing; it does not bypass the
handler's JWT verification. There is no service-role caller bypass.

Six new authorization tests and nine adjacent export/key tests pass. Independent
local review found no blocker and reran all 15 tests. The function was deployed
only to staging: ACTIVE, version 1, gateway verification off with handler JWT
verification enforced. Production deployment remains a KT release step.

### Applicant submission and HTTP acceptance (2026-11-06)

- KT approved submitting the fully synthetic application, including declarations
  and electronic signature. The normal invited applicant reviewed 100% progress,
  submitted through the confirmation dialog, and opened the read-only result.
  A read-only database check found exactly one application for that test user,
  correctly bound to the claimed prospect and marked submitted with a reference.
- The form payload was preloaded from a synthetic fixture. Normal UI checks
  cover rank/vessel selection, autosave, the negative medical-history answer,
  declaration blocking/completion, submission and the read-only result. This is
  not a claim of manually entering every field across all nineteen sections.
- The test exposed a progress bug: an explicit medical-history No was treated
  as empty before validation. Mandatory sections now reach their validators;
  missing/invalid answers and unchecked declarations remain blocked. Four new
  regression tests and independent review pass; optional-section semantics are
  unchanged.
- The submission notification arrived at the approved account-owner inbox and
  its review link opened the correct read-only application in the existing
  applicant session. This does not establish anonymous review-token isolation.
  The temporary recruiter-notification override was restored immediately after
  delivery. No notification was sent to other staging recruiters.
- Normal-session HTTP probes for the notifier returned 401 without auth and
  404 for an own draft or another applicant's submitted record, before writes.
- Normal applicant HTTP probes affected zero rows when attempting same-value
  updates to the submitted application/form or another synthetic application;
  another applicant's application/form reads returned zero rows. Anonymous
  application read returned 401; private photo read returned 400; foreign-owner
  photo upload returned 403. Own private-photo download succeeded. These checks
  do not resolve the separate post-submission photo-replacement policy decision.
- All temporary local probe pages were removed. Final verification: 69 Node
  tests, 16 applicant-validation contract checks, lint and build pass. The
  default write-capable smoke harness was not run against production.

Read-only production inventory found 151 legacy applications without a prospect
link (21 submitted). KT subsequently confirmed these are all test data and
authorized removing the legacy records; the separate cleanup below supersedes
the reconciliation requirement for that removed cohort. Never infer a future
person/case association from email alone.

Still open before promotion: hosted actual-template/Excel/second-customer
worksheet acceptance, final exact release manifest/review, and KT's retention
decision for sensitive forms from unselected candidates. Production deployment
and real-domain smoke remain KT release steps; no release is approved by the
staging results above. The later checkpoint narrows the pilot to CMA only.

### Hosted worksheet, legacy-test cleanup and final manifest checkpoint

- Committed applicant checkpoint `2e11d4a` was pushed only to the isolated
  candidate branch, not production main. The separate staging worksheet service
  now runs that exact commit at Render deploy `dep-dbmv0orncjis73ajeer0`.
  Previous deploy `dep-dbmag9142hec73e4icgg` / `8a2a0bc` is recorded for rollback.
  Staging APP_URL was extended to local port 5197 after an actual preflight
  lacked its origin; production settings were not changed. The browser then
  downloaded the workbook through the normal signed-in recruiter UI.
- The hosted test used a real normalized CMA layout populated only with
  synthetic data. Its old blue test photo and red signature rectangle were
  replaced/removed correctly. All 5,389 cell values/styles, sheet names,
  dimensions, merges and print settings match the local writer. The new
  applicant values are present and unused sea-service rows are empty. These
  assertions do not certify rendered Excel text fitting or print pagination.
- Normal-session direct requests to the hosted service deny a recruiter draft
  with HTTP 409, an applicant export with 403 and unsigned requests with 403.
  The existing Coordinator role/UI and invite/export logger denials remain
  separate evidence; no normal Coordinator request to the worksheet endpoint
  was performed in this checkpoint.
- KT approved a **CMA-only pilot** and will review the downloaded workbook in
  Excel. A second customer is outside this pilot; validate its mapping/layout
  before enabling that customer. Excel sign-off remains pending.
- In a fresh Chrome Incognito window, the valid emailed review link opened the
  read-only synthetic application without an authenticated session. Removing
  its access token or supplying an invalid one showed Application Not Found.
  The temporary private window and all local probe pages were removed.
- KT explicitly confirmed all Holmes database records are test data and allowed
  legacy cleanup. A new consistent full production dump completed: 91 table
  data objects / 7,691 rows; every COPY payload restored with exact scratch
  counts. Extension-compatible public DDL/data restore matched 48 tables / 959
  rows, with CHECK constraints restored and validated. Archive hashes and exact
  targeted row archives are private. Managed post-data/global restoration and
  Storage bytes remain outside this verification.
- The first fresh attempt lost its CLI temporary password because another
  production login was minted concurrently. Serializing production credential
  lookups fixed it. Stock PostgreSQL lacks the vector extension; the existing
  network-isolated Supabase scratch image completed the public restore.
  Do not run another production CLI credential lookup during a parallel dump.
- A reviewed, count/data-guarded transaction first rehearsed with rollback, then
  removed exactly **151 unlinked test applications and 199 dependent rows**.
  Accounts, roles, prospects, requirements, settings, organizations and
  worksheet metadata fingerprints stayed unchanged. Storage bytes were not
  deleted. This was an explicitly authorized test-data write, not an application
  deployment or a schema promotion. No legacy viewing bridge was implemented.
- Independent review found 0224 would also adopt old unlinked drafts at claim
  time. Additive `2026110602_do_not_adopt_unlinked_applications_on_claim.sql`
  removes only that application UPDATE, preserving the claim's identity,
  organization, locking, expiry and replay checks. The expanded PGlite fixture
  checks same-owner draft/submitted, foreign-owner and already-linked rows all
  remain unchanged across a valid cross-organization claim. Review closed the
  finding; 0602 is applied/read back on staging only. Include it after 0601 in
  the coordinated production manifest; do not rewrite already-applied 0224.

The exact proposed nine-migration / thirteen-Function bundle and exclusions are
in `WARM_RELEASE_MANIFEST_2026-11-06.md`; private per-file hashes pin its SQL and
recursive Function dependencies. Versions were refreshed read-only: 15 staging
Functions, 33 production Functions, with no production drift from the recorded
manifest. The protected Function paths check their callers independently of
gateway JWT verification; the manifest explicitly records public bootstrap and
trusted service-role exceptions.

Remaining pilot release gates: KT's Excel review, consolidated final review and
KT's coordinated migration/Function/service/frontend promotion, then real-domain
smoke. Real applicant use additionally needs the sender and sensitive-form
retention decisions. The pilot results do not approve customer rollout or intake;
AI stays operator-only and Drive intake stays false. Candidate-field changes,
Add to Holmes and Match resumes follow the current release gates.


## Final review and KT Excel acceptance

KT confirmed that the exported CMA workbook's three sheets and print layout
pass in Excel. The consolidated reviewer reran 69 Node and 11 worksheet tests
and found one additional SQL issue: 0223's idempotency shortcut could return a
case row before permission checks. Additive migration 0603 moves the role gate
ahead of that shortcut, without rewriting 0223 or historical rows. Its PGlite
fixture checks unauthenticated, applicant, read-only and withdraw-only non-exit
or null-target denials, authorized retries, legitimate withdraw-only exits and
no duplicate events. The reviewer closed the finding. Staging application and
function readback passed; production schema is unchanged.

A fresh post-cleanup full production snapshot and scratch restore pass:
91 table-data objects / 7,341 rows, with 48 public tables / 609 rows restored
using the extension-compatible scratch image. The private receipt contains the
archive SHA-256. Managed post-data/globals and Storage bytes are not certified.
Production Vercel and Render rollback IDs were refreshed from their dashboards.

The exact package now has **ten migrations** (0603 last) and thirteen Functions.
KT's coordinated promotion and real-domain smoke remain release steps. A normal
staging Coordinator session now receives HTTP 403 from the hosted worksheet
endpoint for the submitted synthetic application. Its visible role, status and
screenshot are recorded privately; the temporary probe page was removed.
CMA-only acceptance does not enable another customer layout. Real applicant use
still needs the production sender and sensitive-form retention decisions.
Candidate-field changes → Add to Holmes → Match resumes follow this release.
