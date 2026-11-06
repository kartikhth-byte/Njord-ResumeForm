# KT warm-theme / KPI release

Status: promoted by KT at `a1e62c1`; production acceptance is in progress.
This is the current CMA-only pilot release;
candidate-field relaxation, Add to Holmes and Match resumes follow it.
The exact SQL/Function roster is in `WARM_RELEASE_MANIFEST_2026-11-06.md`.

## Current production checkpoint

- The ten migrations and thirteen reviewed Functions are applied and read back.
  Do not rerun the original baseline-guarded preparation/deployment helpers.
- Vercel deployment `dpl_2nEHbcBRa3CQmzDvcRYZvs2cNDY7` is Ready at
  `a1e62c1f176770541ef70bc38692183148595923`.
- Render deployment `dep-dbmvu6ijnfac73bjs9ag` runs the accepted worksheet
  source `2e11d4a209bf61071baf7c2b2bdf6a31d0bf65e8`. Deploying that specific
  commit disabled Render Auto-Deploy; it remains pinned. A main push currently
  does not update Render automatically.
- Normal production Recruiter/operator and Master sign-in pass. An approved,
  privately archived one-account correction aligned an existing Master role
  with the coarse recruiter profile type; no password or role was changed.
- Live AI search completed through Vercel; Repository, candidate detail, original
  four-page PDF in Chrome, fault-dialog opening, review queue, Operator Health
  and logout propagation pass. The fault form was closed without a false report.
- The labelled synthetic workflow reached interview passed through normal UI
  actions. Owner-only invitation delivery, production claim, one new draft and
  rank autosave after reload pass. KT explicitly approved the synthetic
  declarations/signature; submission, owner notification and emailed read-only
  review pass. Direct editor entry after submission redirects to Dashboard.
  Original mail settings are restored. Production CMA export downloads normally;
  its three sheets, ZIP integrity, synthetic identity/document cells and absence
  of stored formula errors were checked. KT's prior Excel/print acceptance
  remains the layout evidence; the new download was not reopened in Excel here.
- Normal production Coordinator sign-in passes. Application/case/KPI reads
  work, case actions and worksheet controls are absent, and direct Operator/AI
  routes return No access. The normal-session worksheet/invite HTTP 403 probes
  are staging evidence; they were not repeated by copying production tokens.
- The production synthetic case stops at documents verified. The plan explicitly
  defers the principal-send UI from this slice, so no principal attestation or
  hire was fabricated. Distinct-hire closure/version/replay checks are the
  existing staging SQL evidence, not a completed production browser hire flow.
- A cached non-operator flag can briefly reject a newly granted operator's
  direct deep link before live authorization refresh. Re-entering from Dashboard
  works; server authorization remains enforced. Track the bounded cache-loading
  UX correction separately; do not count it as a passed cold-start deep link.
- Complete post-release dump and scratch verification pass: 93 table data
  objects / 7,377 rows; all snapshot counts match restored payload counts.
  The separate extension-compatible public DDL/data/CHECK restore also passes:
  50 tables / 632 rows. Archive SHA-256 and receipts remain private. Managed
  Supabase schema/global reconstruction and Storage file bytes are outside this
  restore certification; do not describe it as a full disaster-recovery drill.
- Live responsive embed checks pass at 375 and 640 pixels without horizontal
  document overflow. The mobile search menu opens and Escape closes it with
  focus returned to the trigger; the browser viewport was restored afterward.

The numbered instructions below preserve the original release sequence. Steps
1–5 are complete for this release. Private receipts hold account identifiers,
mail-routing restoration state and backup hashes; keep them out of Git.

## Before the release window

- KT's Excel/print acceptance passed. Consolidated review closed the 0602 and
  0603 findings. Keep the manifest's exact source hashes and staging receipts.
- Keep AI search operator-only, Preview `NEEDLE_ORIGIN` unset, and
  `NJORDHR_DRIVE_INTAKE_ENABLED=false`. This release does not enable intake.
- Restrict worksheet use to the accepted CMA layout. Validate any other layout
  before enabling it. Real-applicant use still needs an approved sender and
  sensitive-form retention/deletion policy; use synthetic pilot records meanwhile.
- Avoid application/project edits during the backend release window. Never run
  unrestricted `supabase db push`, deploy all Functions, or force push.
- Record the current Vercel, Render and Function versions again if they drift.
  The recorded baseline is `main@21ac6a51ae58d8a5867966e3e83b72aaabdc127c`.
  At the initial baseline Render auto-deployed `main`; the specific-commit
  deployment disabled that setting (see the current checkpoint above).

## 1. Read-only KT preflight

Run in your Terminal. The helper is private and is not part of Git. It validates
the frozen candidate, ten SQL hashes, recursive Function imports, current
production history/Function versions, and the backup hash and restored counts.
It only prepares a private SQL file unless `--apply-db` is explicitly supplied.

```bash
cd /Users/kartikraghavan/Tools/NjordHR/.local/worktrees/holmes-warm-integration
git status --short
git --no-pager log -1 --oneline
git ls-remote origin refs/heads/main
python3 /Users/kartikraghavan/Tools/NjordHR/.local/holmes-integration/operator-pilot-20261105/prepare_warm_release.private.py
```

Stop on any mismatch. The backup must be under two hours old and public counts
must still match it. Refresh the full snapshot and scratch verification if it
is stale; update the private receipt pointer only after that verification.

## 2. Production database — KT approval/action

After accepting the exact manifest and successful preflight:

```bash
python3 /Users/kartikraghavan/Tools/NjordHR/.local/holmes-integration/operator-pilot-20261105/prepare_warm_release.private.py --apply-db
```

This applies only the ten named migrations in one transaction and records their
history atomically. It does not delete data, approve facts, send email, deploy
Functions or promote either app. Stop if it fails; do not bypass its guards.

## 3. Exact Edge Functions — KT action

Use the same frozen Holmes worktree. The new handlers enforce caller identity
and permissions themselves; their reviewed gateway setting is false. Do not
apply this setting to old code. Do not deploy the other Functions incidentally.

```bash
cd /Users/kartikraghavan/Tools/NjordHR/.local/worktrees/holmes-warm-integration
for warm_function in \
  create-recruiter send-prospect-invite request-applicant-magic-link \
  send-application-emails log-recruiter-export schedule-event \
  send-event-notification send-test-invitation send-interview-invitation \
  send-rejection-email send-interview-passed send-test-retake-approved \
  send-offer-letter
do
  supabase functions deploy "$warm_function" \
    --project-ref btbqdviuqcpauojmorvx --no-verify-jwt || break
done
supabase functions list --project-ref btbqdviuqcpauojmorvx
```

Read back all thirteen versions and gateway settings before proceeding. A
partial deployment is a stop condition, not permission to promote the frontend.
Preserve production mail/origin settings; remove staging-only recipient routes.
Do not send real-applicant workflow emails as a smoke test.

## 4. Worksheet service — KT action

The hosted acceptance used exact commit `2e11d4a` on the separate staging service.
The final candidate preserves those writer/service bytes. Push the frozen
candidate to its candidate branch if needed (this does not promote `main`):

```bash
cd /Users/kartikraghavan/Tools/NjordHR/.local/worktrees/holmes-warm-integration
git push origin codex/holmes-warm-integration:refs/heads/codex/holmes-warm-integration
```

In Render production service `srv-d761128ule4c73cn58v0`, deploy that tested
commit with **Manual Deploy → Deploy a specific commit**, preserving production
Supabase credentials and production-only `APP_URL`. Confirm `/health`, `/ready`
and the deployed source commit. Do not deploy the latest `ui/warm-theme` branch.

Before frontend promotion, confirm runtime setting
`WORKSHEET_SERVICE_URL=https://njord-worksheet-service.onrender.com` and the
production Supabase project `btbqdviuqcpauojmorvx`. Staging data/config must not
be copied to production. Read back Render's actual Auto-Deploy setting and source
before smoke testing; this release's service is pinned with Auto-Deploy off.

## 5. Frontend promotion — KT only

After the backend readbacks and worksheet readiness pass, use the full frozen
commit recorded in the private manifest. Stop if `main` changed or the candidate
differs. This is a normal fast-forward push, never a force push.

```bash
cd /Users/kartikraghavan/Tools/NjordHR/.local/worktrees/holmes-warm-integration
python3 - <<'PY'
import json, pathlib, subprocess
m = json.loads(pathlib.Path('/Users/kartikraghavan/Tools/NjordHR/.local/holmes-integration/operator-pilot-20261105/warm-release-manifest.private.json').read_text())
head = subprocess.check_output(['git','rev-parse','HEAD'], text=True).strip()
remote = subprocess.check_output(['git','ls-remote','origin','refs/heads/main'], text=True).split()[0]
if head != m['candidate_commit'] or remote != m['production_frontend_base']:
    raise SystemExit('STOP: candidate or production main changed')
subprocess.run(['git','push','origin',head+':refs/heads/main'], check=True)
PY
```

Wait for Vercel and the pinned Render worksheet source to report healthy. This
does not push Needle `railway-m1`; its deployed operator pilot stays unchanged.

## 6. Real-domain acceptance

Before admitting recruiters, record actual deployment IDs and perform:

- Recruiter/Master/Coordinator sign-in and role denial; Coordinator cannot mutate
  workflow, export, manage members or open Operator/AI.
- Warm desktop and narrow-pane layout, sidebar/menu keyboard navigation,
  password recovery placement, KPI/case counts and export authorization.
- Synthetic requirement/case transitions through documents verified. Retain
  the staging SQL stale-version, authorized/unauthorized replay and distinct-hire
  closure proofs. Repeat the full browser hire/closure path when the deferred
  principal-send UI is implemented; it is not currently reachable from this UI.
- An explicitly approved synthetic invite → claim → draft → submission flow;
  owner-inbox delivery and read-only review, invalid/missing link denial.
- CMA submitted export, rejected draft/Coordinator/applicant export, readable
  workbook and private photo access. No other customer layout is accepted yet.
- Operator-only AI streaming to completion through Vercel, Repository navigation,
  original PDF, review queue, route sync, session renewal and logout.

Use normal signed-in sessions. Do not manufacture user JWTs or invoke the
production-writing default smoke harness. Keep any synthetic declarations and
email destinations explicitly authorized. A failed smoke pauses rollout.

## Rollback

- Vercel previous production: `dpl_F3XeXkYufUm2eZEmCQpQUQvuugvu` at `21ac6a5`.
- Render previous production: `dep-dbmmkuuc6qcc73b9k68g`, same commit. Suspend
  automatic redeployment while restoring a known deployment if needed, so a
  queued main deploy cannot overwrite rollback. KT controls that setting.
- Restore the thirteen Function source snapshots with their recorded gateway
  settings: all previous versions used gateway JWT verification except
  `request-applicant-magic-link`. Keep source and setting paired. Snapshots and
  rollback deploy commands live privately with the release evidence.
- Keep additive case/event/application data. Do not restore a full old database
  over new records, drop the case tables, or delete customer/test data as rollback.
  Disable affected entry points, restore compatible code and reconcile forward.
- Keep intake false and turn AI off if needed. Re-run access/read smoke after
  rollback and record the actual restored deployment IDs.

Production approval and post-deployment acceptance are separate from passing
local/staging checks. Begin candidate-field changes only after this release's
status is explicitly closed or KT directs work to proceed alongside its rollout.
