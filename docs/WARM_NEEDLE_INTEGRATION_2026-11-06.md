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
all synthetic rows. **2026110601 is not permanently applied on staging or
production yet**; include it explicitly in the reviewed release manifest.
The 55 unit / 33 browser results above remain applicable; this follow-up changes
only the SQL function, its fixture and release records.

Independent local review is complete for the requested KPI addition, responsive
reconciliation, export authentication and recovery placement. One P2 version
finding was raised and closed after reviewing the follow-up above. No further
blocker was found in that scope; 52 focused Node tests were independently run.
This does not certify the broader warm applicant/email/worksheet flows or
approve a production deployment. Recheck the exact release manifest against a
fresh production inventory before promotion.
