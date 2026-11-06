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
main's responsive commit 21ac6a5 is being reconciled in this isolated worktree,
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
