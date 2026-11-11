# Companies & ships and grouped requirements — 2026-11-10

## Production release — 2026-11-11

KT approved the exact pair: Holmes `b573bd8f3fc48334a25819a198796fe3e2410b5d`
and Needle `49e30cf8cb7832614131a163e4ef0766636523ee`. Both are deployed.
Production migrations 2026111001/1002 applied with candidate/case counts unchanged;
`needle-integration` version 3 is ACTIVE with reviewed handler authentication.
Vercel deployment `2fiEc96kAgp5nZETr2ZWErhCH8AY` passed for the exact Holmes SHA.

Normal staging Master/Coordinator checks passed, including existing candidate
reuse, reviewed attachment and persisted company/ship/requirement links. Live
operator company/ship add/edit/reload, grouped requirement create, row matching
(124 matches; required rank + vessel), pagination, PDF pages 1/2 and zoom pass.
Production Coordinator can read/navigate but has no add/edit/match/attach controls.
Synthetic requirement `2026-Nov-002` was closed; its directory/history is retained.
Both deployed attachment authentication boundaries reject anonymous calls.

**Live attachment passed:** KT approved one synthetic PDF/test-facts fixture.
The production original renders in matching; reviewed attachment creates exactly
one candidate and consumes one fresh verification receipt (0.696 seconds from
verification to commit). The result shows Already attached. Profile and Candidates
row retain the requirement link after reload; Coordinator sees the row read-only.
The fixture adds one source (1,630 total; 125 matching this requirement). The
synthetic requirement was closed again, with candidate/case history retained.
No real person was attached and no invitations were sent. New intake remains off.

Smoke observations: first matching fetch failed, then Retry succeeded. The
synthetic folder needed placement under existing private production storage to
inherit the engine reader access. No permissions were changed. View résumé from
the saved profile was also visually verified in native Chrome using the normal
Coordinator session: one readable page with all synthetic source text visible.
Backups/restore limits and service IDs are in Needle's release inventory; private
receipts/screenshots reside in `.local/fleet-release-20261111/` under NjordHR.
The preparation sections below are historical.

## Scope and status

Implemented locally on `codex/companies-ships-ui-20261110`, isolated worktree
`holmes-companies-ships-ui`, based on Holmes `78afd54` (documentation after
production `b28d6c5`). No production migration, deployment, data change or paid
model call was performed. This record describes the UI and reviewed existing-source attachment slice.

## Accepted behavior

- `/recruiter/companies` is a separate sidebar destination. Add company is at
  the top; enter the name once. Add ship and Edit use inline Save/Cancel rows.
  Ships sit slightly to the right beneath their collapsible company.
- Companies require a name; ships require a name and catalog vessel type.
  Editing preserves identity and company ownership. This is a spelling/details
  correction, not a ship transfer. There is no delete/reparent action.
- Master Recruiters and operators with `edit_requirements` can maintain the
  directory. Recruiters/Coordinators with `view_requirements` can read and select
  entries. The new RPC enforces writes; UI visibility is not authorization.
- Requirements are grouped by explicit company/ship IDs, never inferred names.
  Company rows have a building icon and warm tint; ship rows have a ship icon
  and muted background; requirement rows have a clipboard icon and plain
  background. All three span the same width without indentation.
- Company and ship groups expand independently. Requirement expansion shows
  timing, saved names, recruiter and remarks. Requirement rows have an attached
  candidate count linking to the filtered Candidates page; no candidate list
  is expanded on the Requirements page.
- Add requirement retains its existing modal. The form selects existing fleet
  records; management opens a separate tab so unsaved requirement fields stay
  intact. Refresh updates choices without replacing form state. Selecting a
  different ship defaults its catalog vessel type; opening an existing
  requirement never rewrites its stored type.
- Existing status/recruiter/date/text filters, CSV, case-derived KPI counts and
  matching gates remain. Changing filters reveals the matching groups. Only
  groups containing visible requirements are shown. Open is the default;
  Draft/Closed/Cancelled/Archived/All remain available.
- Match résumés remains on each eligible requirement row and uses the existing
  versioned modal. Reviewed existing-résumé attachments are separated from
  the upload hold by the follow-up implementation below.
- Directory renames appear in group headings and search. Saved requirement
  labels remain visible in details. Unmapped legacy rows and Drafts remain in
  explicitly pending groups; no ownership backfill occurs. Archived identities
  remain readable for historical requirements and current saved selections.
- Version conflicts retain typed input and request refresh before another edit.
  Duplicate active company names, or ship names within a company, are rejected
  case-insensitively by the server. Failed reads/saves are visible with retry.
  Paginated fleet/requirement reads avoid silently omitting records at the
  default API row limit.

## Schema and release gate

Prepared migration: `2026111001_client_fleet_directory.sql`.

- Adds version columns to both directory tables and nullable ship vessel type.
  Existing ships are not assigned a type by guessing from requirements.
- Adds `save_client_fleet_record` with actor/permission/role and organization
  checks, version checks, name validation, duplicate prevention under an
  organization advisory transaction lock, active-company validation and fixed
  ship ownership. Existing ship-identity trigger remains active.
- Revokes authenticated direct INSERT/UPDATE on directory tables so callers
  cannot bypass version/role validation. Existing SELECT/RLS stays intact.
- No requirement/case/résumé records are rewritten. Existing service-role
  grants are unchanged. No tier, hosting, region or intake flag change.

Before deployment: review the exact candidate/migration, back up the two
fleet tables/schema, apply the migration in staging and verify normal-session
Master/operator write and Recruiter/Coordinator read/direct-RPC denial. Then
coordinate the approved production migration and frontend release. Old cached
frontends must refresh: their inline registration path cannot write after the
migration. No deployment approval is implied by these local checks.

Rollback: roll back the frontend and, only as part of that approved rollback,
restore the prior authenticated INSERT/UPDATE grants to the two fleet tables
if old registration is needed. Leave additive columns, IDs, saved records and
RPC in place; do not drop tables or replay old data over new edits. The old
RLS policies still enforce the previous `edit_requirements` boundary.

## Verification

- Focused/adjacent Node suite: 37 passing tests covering grouping identity,
  legacy/archived rows, matching eligibility and case/KPI derivation.
- Actual directory migration in isolated PGlite: CRUD, exact identity/history,
  duplicate/empty/long-name/type validation, stale versions, foreign-org and
  archived denial, Master/operator permission checks, Recruiter/Coordinator/
  applicant/anonymous denial and direct-write denial pass.
- Synthetic browser smoke and existing KPI suite: final result recorded in
  the completion update below. The fixture blocks all external hosts other
  than intercepted `supabase.invalid`. No stored live sessions are used;
  `--no-deps` skips applicant setup.
- Desktop and 390px screenshots reviewed for layout, full-width alignment,
  readable labels, no horizontal page overflow, modal behavior and focus.
- `npm run lint`, `npm run build`, `git diff --check` required before handoff.
  Build retains the existing bundle-size/Browserslist warnings.

Reproduction (use a clean local environment, never production configuration):

```sh
VITE_SUPABASE_URL=https://supabase.invalid VITE_SUPABASE_ANON_KEY=synthetic-local-anon VITE_FEATURE_AI_SEARCH=operator VITE_FEATURE_RESUME_INTAKE=off ./node_modules/.bin/vite --host 127.0.0.1 --port 5218 --strictPort
HOLMES_FLEET_SYNTHETIC_SMOKE=1 HOLMES_KPI_SYNTHETIC_SMOKE=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5218 npm run test:smoke -- fleet-directory.spec.js kpi-case-parity.spec.js --no-deps
node --test tests/requirementGroups.test.mjs tests/platformIntake.test.mjs tests/requirementMatch.test.mjs tests/kpiTracker.test.mjs tests/recruitmentCaseKpi.test.mjs
```

The SQL fixture imports `@electric-sql/pglite`, as do existing platform SQL
fixtures. For this run it was installed only under
`/private/tmp/holmes-fleet-sql-test`; a copy of the fixture was executed from
there with this worktree as the working directory. Shared dependencies and
production databases were not modified.

## Final local completion

Final source passes **17/17 synthetic browser checks** (8 directory/grouping/
matching flows and 9 adjacent KPI checks), **37 focused/adjacent Node tests**,
the isolated migration fixture, lint, build and diff whitespace validation.
Desktop/390px screenshots were inspected, including the expanded requirement
and corrected-name/current-group versus saved-name distinction. Browser checks
assert desktop sidebar inset and equal company/ship/requirement left edges and
widths. The final mobile headers give long names more space.

Only the authorized implementation files in this isolated worktree changed.
This slice remains uncommitted and unpromoted; no live schema was touched.


## Existing résumé attachment follow-up (2026-11-10, local only)

Approved user flow: Requirements lists requirements only. Clicking Match résumés
opens search rows; Review alone saves no candidate. Attach opens identity review,
reuses the exact existing source link or requires an explicit duplicate decision,
then creates/links a candidate and its case atomically. Success returns to the
results rows with “Candidate attached” and a View candidate link. The modal stays
open. Candidates lists each distinct attached requirement, with current directory
company/ship names (saved labels as fallback), rank and that requirement's stage.
An active case takes precedence over its historical cycles; history remains on the
candidate detail. Requirement counts link to `Candidates?view=all&requirement=…`.

### Existing sources versus new intake

- `prepareResumes` uses the authenticated `needle-integration/prepare` bridge.
  Needle verifies organization corpus membership and, when supplied, ownership
  and membership of saved search results. It returns approved/current searchable
  facts and availability of the existing original; no file is uploaded or copied.
- The bridge requires the exact requested set, ready facts, an original and a
  facts revision before creating actor-bound evidence. Private Drive references
  are stripped. Browser-supplied extraction is never trusted.
- New additive migration `2026111002_review_existing_resume.sql` exposes only
  the reviewed wrapper, not the owner-only `save_resume_candidate` helper.
  It checks actor/organization/source, permissions, explicit identity decision,
  24-hour evidence freshness, current revision/original readiness and a supplied
  requirement version. The existing transaction retains contact validation,
  exact/possible duplicate checks, locks, no overwrite of existing candidate
  fields, requirement open/ship/version guards, and idempotent case creation.
- `existing_resume_identity_reviews` stores the decision and reviewed fields
  privately. If the source already has a canonical platform version, the wrapper
  delegates to `review_platform_resume`, retaining its identity/audit rules.
- For existing Needle-only sources, original viewing continues through the
  existing scoped Needle viewer. This path does not invent a platform file/version,
  upload, extraction, or index event. Later registry adoption can link the same
  content hash to the existing candidate.
- Uploads, automatic Drive intake and the intake-service hosting choice remain
  held. This does not change AI Search role rollout or enable its currently gated
  Add to Holmes entry point; requirement matching is the verified entry point.

### Verification and release

Local synthetic browser smoke: 19/19 (directory, matching review-only, reviewed
new/existing/duplicate attachment, stale-save error, same person on two requirements,
filtered Candidates navigation, continued modal, upload hold, role and KPI checks).
The SQL fixture applies the actual migration chain through 0617 and new 1002:
actor/org/permission and anonymous denials, upload-evidence denial, stale revision,
expired evidence, missing original/contact, closed/stale requirements and atomic
failure, repeated saves, explicit linking without overwrite, private review records,
and canonical-platform delegation pass. Bridge tests cover malformed/partial/
duplicate upstream sets, readiness, private-reference stripping and denied roles.
Lint/build and focused UI-model tests also pass. No production writes were made.

Before release: independent review of the exact combined candidate; staging apply
1001 + 1002; verify normal signed-in roles and an actual stored source, then obtain
production cutover approval with backup/rollback records. Deploy the reviewed Needle source-verification endpoint first, then 1001 + 1002
and updated `needle-integration`, then the frontend. Old frontend stays held and safe
during that order. The final-save safeguard now requires a Needle application
deployment; no new hosting or intake activation is required.
Rollback: restore the preceding frontend/function, revoke authenticated execution
of `review_existing_resume` if disabling the capability, and retain all created
candidates, cases, résumé links and private audit rows. Do not delete saved work.


## 2026-11-11 final-save review and current verification

The current production frontend still has the previous requirements layout; this
combined candidate is local. The earlier synthetic test counts above describe the
preceding source and are retained as history.

Independent review found that Prepare evidence and registry state could both be
stale, and that a mapped original did not prove its bytes were still available.
The save boundary now enforces these checks for existing-corpus attachments:

1. `needle-integration/review_existing` loads actor/org-owned evidence and calls
   Needle `/api/holmes/verify-review` with its exact facts fingerprint.
2. Needle reads active membership, approved/current facts and active original
   mapping directly from Supabase, fetches original bytes without either cache,
   verifies the content hash and rereads the authority state to detect changes.
3. The bridge issues a private receipt bound to the actor, evidence, source,
   revision, exact identity decision/fields/link and requirement/version.
4. The normal caller's RPC checks a 60-second receipt and consumes it atomically
   with candidate/case creation and the private identity audit. Direct callers
   cannot mint receipts. The legacy public platform-review API accepts upload
   evidence only; canonical existing sources delegate to its private implementation
   after the same receipt check.

The recorded check is **verified as of its timestamp**, not a distributed lock
across Drive and both databases. Subsequent changes remain possible. Unavailable,
withdrawn or changed sources fail closed; existing candidates are not overwritten.
Strict publication stays off and needs separate fingerprint compatibility testing.
Private receipt/identity records follow the pending retention-policy gate; this
patch does not introduce automatic deletion.

Current verification:

- 41 focused/adjacent Node checks pass, including exact final-save request binding,
  source failure, role denial, safe duplicate/link/restore errors and existing
  matching/candidate/KPI behavior.
- Actual 1001 migration fixture and the platform chain through 1002 pass in local
  PGlite, including receipt replay/expiry/tampering, private-table/helper denial,
  canonical RPC bypass denial, upload compatibility and atomic rollback.
- Lint and build pass; existing bundle-size/Browserslist warnings remain.
- CUA synthetic browser smoke: inline company/ship creation and spelling edits;
  reload; new requirement with existing directory entries; matching modal;
  reviewed attachment; reuse of one candidate across two requirements; filtered
  Candidates navigation showing both attachments after reload. The revised Edge
  action was exercised again after restarting the synthetic fixture.
- The local original preview is a synthetic image fixture. This does **not** verify
  a live PDF or live authentication. Normal-session staging/production source and
  role checks remain release gates. No production data/schema/function changed.
- Proof is privately saved under `.local/company-workflow-smoke-20261111/` in the
  shared NjordHR checkout (`companies.png`, `candidates.png`, `attached.png`).

Independent rereview approved the patch after active-original and alternate-RPC
bypasses were closed. Production promotion still requires the exact release gate.
