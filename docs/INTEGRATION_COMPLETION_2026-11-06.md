# Needle / Holmes integrated completion candidate

Updated 2026-11-07. **Local/staging pilot acceptance complete; not promoted.**
KT requested one integrated slice after the warm/KPI production pilot.
Bases remain Holmes `a1e62c1f176770541ef70bc38692183148595923` and Needle
`401ec6e0d472827ca014b2f32b9b2bfac0806725`; remote heads were checked again
on 2026-11-07. Production code, accounts, Functions and intake settings have
not been changed by this slice. KT promotes the reviewed candidates.

Worktrees:

- Holmes: `.local/worktrees/holmes-integration-completion`, branch
  `codex/holmes-integration-completion`.
- Needle: `.local/worktrees/needle-integration-completion`, branch
  `codex/needle-integration-completion`.

## Implemented candidate

1. Cached recruiter authorization waits for a bounded live lookup. Duplicate
   Auth events do not leave a spinner; late prior-session results cannot
   restore authorization after sign-out. The staging label is opt-in through
   `VITE_ENVIRONMENT_LABEL`; production has no rehearsal label.
2. New candidates require a name, a phone or email, and verified original PDF
   evidence. DOB, nationality, rank, vessel, experience and previous employer
   can be absent. Phone normalization assumes no country code. Zero months
   remains zero. Editable requirement rank/vessel suggestions are labelled;
   the server does not silently manufacture profile fields from a requirement.
3. The database requires phone, email, DOB and nationality before progressing
   past contacted. Existing candidates without a résumé remain visible and
   editable. Candidate detail includes canonical case links and blank-safe
   nullable fields; it does not use legacy junctions as the case authority.
4. Add to Holmes uses exact-origin/exact-frame messages containing source IDs
   only. The authenticated server bridge obtains prefill and source evidence
   from Needle. Bulk items are reviewed separately, with independently saved
   results. Matching email requires an explicit link; phone/name+DOB matches
   require review. Same-file adds reuse the existing person without overwriting
   their details. Cases, profile and source history save in one transaction.
5. Match resumes maps rank, vessel and supported nationality preferences from
   the server's requirement row. Unsupported mappings are reported as not
   applied; recruitment target days are not invented as a joining window.
   One owned search per recruiter/requirement retains versioned stages.
   Requirement/nationality edits increment the database version; an existing
   closure increment is not doubled. Concurrent clicks share a lease; known failures release it, and interrupted
   requests can retry after ten minutes. A returned failed evaluator outcome
   also releases its claim, retaining failed-stage evidence. An old lease cannot publish over a
   replacement. Repeated completed versions reuse their search/stage.
6. PDF upload validates readable/unlocked PDF bytes and the 10 MiB limit,
   calculates SHA-256, registers the original and pool membership atomically,
   and preserves prior versions. A distributed upload lease and deterministic
   Drive lookup prevent duplicate copies, including recovery after an orphaned
   Drive upload. Recovered files must match the incoming bytes' bounded length
   and SHA-256; a matching filename alone is insufficient. Registration does not convert, extract or approve facts.
   The worker reads registered document rows, so these uploads remain queued
   even though flat-folder discovery does not traverse child folders.
7. Linked résumé viewing has a short-lived viewer token scoped to the exact
   file and organization, independently of AI-search access. Viewer tokens
   cannot establish a search session. Processing status reads metadata only;
   pending/rejected facts never become searchable through that status path.
   Failed conversion/extraction remains visible with the stored original.
   Source provenance retains the observed engine/parser version and facts
   revision; where a facts revision is absent, `sha256:` identifies the exact
   canonical facts snapshot. Unknown historical versions say Not recorded.
8. Operator health shows observed worker freshness/intake state, corpus/review
   counts, email delivery webhook evidence, last instrumented expiry run and
   recorded failures. Unknown or stale evidence is not displayed as healthy.
   Organizations/users use Auth emails, not placeholder profile emails.
   Disable/reset operations have a ledger; existing Needle sessions are
   revoked by durable per-user state. Passwords are never accepted by the
   operator function. Master/operator access handover is a KT-reviewed step.
9. The operator audit excludes secret values and résumé contents. Support
   token use, runtime changes, account operations and job outcomes are visible.
   Expiry mail can be started by a scheduler/service credential or operator;
   normal users cannot trigger it. SeaJobs and intake credentials remain
   operator links to Needle's own screens, outside the recruiter workflow.
10. A recruiter explicitly links a submitted form to its exact candidate/case
    through a version-checked RPC. Drafts, another person's form, stale versions,
    replacing an existing link and pre-interview links are denied. Replays keep
    one link event. Principal send is a manual attestation with recipient, channel, worksheet
    version, send time, actor and idempotency/version checks. The submitted
    application gate and final hire/requirement closure rules remain in force.
    No principal email is sent by recording the attestation.
11. Applications no longer exposes the former embedding search. Its two
    Gemini proxy handlers return 410 and make no model request. The old
    embeddings table is retained: export/sign-off is required before dropping
    it. Unused historical source is not evidence of an active search path.

## Evidence completed so far

### Staging database and local joint browser

A complete staging dump and scratch payload-count verification preceded the
staging SQL changes. Exact SQL/hash receipts are private under
`.local/holmes-integration/operator-pilot-20261105/`.

Applied to **Holmes staging `dwslhetniuzpyuspuomy` only** in a guarded
transaction: missing foundations 2026110501/2026110502 and new migrations
2026110604/2026110605/2026110606. The acceptance review found the existing
submitted form was never linked to its case. Migration 2026110607 adds an
explicit, scoped/version-checked link and was applied separately to staging
after its SQL test passed, preserving candidate/case counts. Browser acceptance
also found ordinary requirement edits did not bump version. Migration 0608
adds tested row/nationality version triggers, applied to staging with the same
count guards. All five new SQL
files match private applied SHA-256 receipts. The approved dedicated staging Master has its
staging-only operator flag. Production operator remains
`kartik.neuralnet@gmail.com`; no production identity was changed here.

The real Holmes candidate on port 5205 uses real staging Auth/RLS/RPCs through
a local adapter, plus the real bridge handler source and a synthetic Needle
service on port 5207. The adapter does not prove a deployed Deno wrapper,
public gateway or Vercel production cutover. No production résumé, model or
Drive write is used by this rehearsal.

Observed:

- Staging Master normal sign-in and operator navigation pass.
- Reset diagnosis: the local adapter had duplicate CORS origin headers and
  omitted the SDK's profile headers. Both were corrected. Staging Auth then
  returned its actual reset-email quota error. It has no custom SMTP sender
  and a two-per-hour built-in email quota. A private one-use recovery link
  reached the password form; the user entered credentials privately and
  signed in. The consumed local link was removed. Normal reset email delivery
  is **not** proved by that assisted recovery; production was unaffected.
- Hosted `/ai/` build signs in inside Holmes. A narrow workspace now switches
  Search/Results without losing the composer; desktop keeps the split view.
- Filter-only synthetic search completes. No live parser/model accuracy claim
  is made: the synthetic analyzer supplies deterministic fixture decisions.
- Add to Holmes saved a minimal synthetic person with optional fields blank.
- View résumé opened a scoped PDF. Browser automation was barred from the
  `blob:` URL; KT confirmed both expected synthetic pages were readable.
- A second PDF version remained pending with the original retained. Repeating
  identical bytes left one person and two résumé versions.
- Requirement Match resumes opened the owned search with the actual rank and
  vessel constraints. Add to Holmes identified the same person and attached
  one case without overwriting the manually reviewed name.
- Contacted was allowed; progression beyond contacted was denied while DOB
  and nationality were missing, with the expected human-readable error. After
  saving the missing contact details, Confirm interest succeeded.
- Repeating Match resumes reopened the same owned search and completed stage.
- After the 0608 fix, a normal requirement edit created version 2. Match kept
  the same owned search and retained distinct version-1/version-2 stages.
- Two-item bulk review saved each independently: exact-source item reused the
  manually reviewed person and its case; the new synthetic item created one
  person/case. Both checkmarks displayed. Read-back found two people, two source
  links and exactly one case each for these sources/requirement.
- A normal dedicated Coordinator signed in through Chrome: linked candidate
  details were readable, edit/upload controls were absent, and scoped PDF
  response succeeded. Direct prepare, match, operator data and account-management
  calls returned 403; contact-edit RPC returned 42501. Direct Operator and AI
  pages redirected to No access. No browser token was extracted or forged.
- Operator health, organization/Auth-email inventory and audit loaded. The
  synthetic stale worker is shown as stale, unconfigured folders as unconfigured,
  and absent job/delivery evidence as unobserved. No account was disabled or
  reset merely to test the screen.
- A production zero-row read verified both status projections against actual
  schema columns; no résumé rows were retrieved and no production writes made.
- Explicitly linked the already-submitted synthetic form, then progressed the
  synthetic case through selection, offer, documents, manual handoff evidence
  and Hired. The one-position requirement closed and all eleven history events
  remained visible. The handoff recipient/channel identify this as a synthetic
  rehearsal with no email. No real hiring decision was made.

### CPU verification

Passing focused runs include the purpose-bound auth/API tests, upload/lease
and requirement retry tests, workspace persistence/ownership, worker tests,
metadata-only store tests, normal-user/Coordinator denial, proxy environment
separation, minimal fields/phone normalization, operator actions and expiry
job authorization. Record exact commands/results in the final manifest rather
than adding overlapping test counts together.

The narrow-pane React regression passes. A private React test of the actual
Holmes AuthProvider passes four cases: delayed new grant despite cached false,
live removal despite cached true, duplicate Auth events, and sign-out during a
late lookup; bounded-bootstrap timeout is included. Existing installed test
libraries were reused; no package upgrade was made.

Both production builds and Holmes lint have passed during implementation;
rerun the final changed suites/builds before KT commits. Existing bundle-size
and Browserslist notices are not new test failures. The CLI browser harness
has not been run in this turn; interactive browser checks use the approved
computer-use tools. Do not describe unrun Playwright cases as passed.

## Remaining KT promotion gates

- Local diff/privacy checks pass. Source freeze is KT's two local commits from
  `INTEGRATION_RELEASE_MANIFEST_2026-11-07.md`. Consolidated independent review
  closed the failed-match retry and orphan-file byte-verification findings;
  no remaining code blocker in the reviewed pilot scope. The 0608 follow-up
  review also passed its independent SQL run.
- The exact migration/Function/environment manifest and commit recipes are in
  that release manifest. Record fresh rollback deployment IDs and backups
  before production writes. KT must approve the concrete release;
  do not promote from a dirty or moving branch.
- Actual hosted `/ai` and gateway acceptance with the new candidates is an
  operator-only **production** gate, because KT has no staging Needle.
- Configure/validate `NJORDHR_HOLMES_UPLOAD_FOLDER_ID` as Njordships' existing
  intake folder or a dedicated child inside that customer's Drive tree. The
  engine's upload OAuth identity and the worker/document reader must both
  have the required access. A live synthetic registration/read-back remains
  part of the KT release smoke. An absent setting fails closed.

## Rollout and rollback boundaries

Keep `NJORDHR_DRIVE_INTAKE_ENABLED=false`,
`NEEDLE_AI_SEARCH_ACCESS=operator`, `VITE_FEATURE_AI_SEARCH=operator` and
Preview forwarding denied. Scope is one Njordships pilot. No model retraining,
new extractor hookup, automatic facts approval or other customer's onboarding
is authorized by this release.

The new candidate schema changes the entry contract. Coordinate its database,
Needle, Functions and web cutover in a write-maintenance window. Take fresh
complete production backups with verified scratch counts and private hashes;
record exact old/new service, Function and Vercel versions before writing.
Use only Needle migrations 024/025 and Holmes 2026110604–2026110608 after
preflight proves the foundations; never run an unrestricted production db push.

Changed/new Functions: needle-token, needle-integration, operator-accounts,
manage-runtime-settings, process-expiry-warnings, gemini-embedding-proxy and
gemini-reasoning-proxy. The first five verify current Auth/service permissions
inside their handlers and use gateway verification off for modern JWT support.
Exact deployment approval is required at promotion. The retired Gemini
handlers accept no work and make no outbound model call.

Rollback: turn AI access off, keep intake off and freeze new candidate writes;
restore the recorded web/Function/Needle versions. Keep additive tables, source
history, RLS and new profiles. Do not restore NOT NULL constraints over nullable
profiles or drop uploaded originals. The former entry RPC deliberately refuses
unverified candidates, so an old frontend rollback has **no new candidate
entry** until a compatible forward fix. Preserve this limitation in the final
KT handover instead of promising a transparent database downgrade.

NuExtract3/v18 hookup and conversion qualification still govern automatic
intake reopening. Until that separate gate, uploads are stored/pending and
recruiters enter missing fields manually; automatic post-extraction profile
backfill is not claimed. Real-applicant sender-domain/SMTP and sensitive-form
retention remain owner gates. N8b (additional customer folders/mailboxes and
workspace migration) remains deferred until a second customer.
