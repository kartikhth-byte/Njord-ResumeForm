# Platform Resume Intake release candidate

**Staging qualified; not promoted.** This manifest supersedes the earlier
`INTEGRATION_RELEASE_MANIFEST_2026-11-07.md` recipes for the amended design §11.
Do not promote the old `2c99634` / `d20afe0a` pair alone. The two amended branches
include those commits and their existing candidate/operator security fixes.

Branches/worktrees:

- Holmes `codex/platform-resume-intake`, `.local/worktrees/holmes-integration-completion`.
- Needle `codex/needle-platform-intake`, `.local/worktrees/needle-integration-completion`.

Remote baselines read back on 2026-11-07: Holmes main `a1e62c1f176770541ef70bc38692183148595923`,
Needle railway-m1 `401ec6e0d472827ca014b2f32b9b2bfac0806725`.
No push/deployment/production schema write was performed by this amendment.
KT owns production promotion; never force-push either branch.

## Exact additive schema list

Retain the **prior** release's reviewed missing production migrations:
Holmes 2026110604–2026110608 and Needle 024–025, as enumerated in the earlier
manifest. Recheck actual migration history/objects before applying anything.
This amendment adds the following, in order:

| Holmes migration | Purpose |
|---|---|
| 2026110609_company_ship_drafts | Stable company/ship IDs, Draft/open fields, audited correction, atomic requirement save and case wrapper |
| 2026110610_platform_resume_intake | Private registry, leases, versions, review transaction, file immutability, review queue |
| 2026110611_append_only_extraction_attempts | Append-only retry evidence |
| 2026110612_requirement_creator_choice | Preserve Master-only new requirement recruiter choice without owner overrides on edits |
| 2026110613_guard_all_requirement_attachments | Guard both canonical cases and historical attachment paths |
| 2026110614_resume_lead_drafts | Phone/email leads outside prospects; reviewed conversion transaction |
| 2026110615_review_before_index_registration | Commit registration only after new/link review; preserve delivered history |
| 2026110616_allow_historical_ship_close | Permit historical closure with an archived ship/company; keep new opening/attachment gates |

Needle adds `026_platform_resume_events.sql`: immutable original references,
logical/event idempotency and explicit indexing queue, including existing hashes.
No facts are approved or person identities inferred by registration.

Holmes 0609–0616 are applied and hash-read back on **staging only**. Needle 026
was tested in an isolated PostgreSQL harness; no staging Needle database exists.
The production list must include the tested follow-ups in order; do not apply
0609/0610 alone or substitute the separate checkout's older 0228 function.

## Functions, service and flags

Preserve the earlier release's exact Functions. Update `needle-integration`
(legacy upload retired, reviewed/open match guard, private references stripped)
and add `resume-intake`, `resume-index-dispatch`. Shared signing gains a distinct
`resume-intake` audience. Both new Function entrypoints contain handler-level
security boundaries. Their checked-in gateway setting is false; KT must review
and explicitly approve those exact deployments before production. Do not infer
that an earlier approval of other Functions covers these two.

Provision the CPU-only platform service from `services/resume-intake/Dockerfile`.
Use its README for the exact secret names, mandatory scanner, PDF/OCR bounds,
private folder and credential access. Qualification used an existing normal
Drive login and a dedicated synthetic-only folder. No new production credential
was created or shared. Publish/pin a reviewed image digest before rollout;
a local image ID is not a published deployment digest.

Edge environment:

- `RESUME_INTAKE_ORIGIN`: bare HTTPS origin of the platform service.
- `RESUME_INTAKE_ENABLED=false` until the connected rollout is qualified.
- Existing `NEEDLE_API_ORIGIN`, `NEEDLE_ORG_ID`, `NEEDLE_TOKEN_PRIVATE_KEY`.
- `RESUME_INDEX_DISPATCH_SECRET`: private random 32+ byte scheduler credential.

Schedule private POST delivery to `resume-index-dispatch` at a short interval.
The scheduler secret belongs in a private header, never a URL/browser/Git/log.
The outbox is durable, retries independent of candidate save, and records
attempts/outcomes. Configure the scheduler before enabling intake. Monitor
pending/delivery-failure counts; do not treat delivered as approved/indexed facts.

Keep Railway `NJORDHR_DRIVE_INTAKE_ENABLED=false` and both AI access flags
operator-only. This release does not connect the selected NuExtract/v18 model,
resume automatic intake, change any GPU endpoint, or run a résumé backfill.

## KT production order

1. Consolidated independent review of the exact frozen amended commits. Keep
   source receipts and backups private; review every migration/Function/gateway
   boundary. Reconcile any changed remote head before preparing commands.
2. Fresh production backups and rollback identifiers; count-guarded rehearsal.
   Apply only the reviewed missing migrations, in exact order, with intake off.
3. Map existing open requirements to **reviewed** company/ship records. Legacy
   labels remain readable, but unreviewed rows cannot take new cases or match.
   Use the correction RPC with expected version and a reason; never infer by name.
4. Deploy/pin the platform service with private Drive credentials that can read
   both its new folder and eligible legacy originals. Scanner/unsigned/audience
   failures must fail closed. Deploy the exact reviewed Functions and scheduler.
5. KT promotes Needle and Holmes (including warm/KPI), with flags still held.
   Do not run old frozen push recipes against the new branches.
6. Operator-only deployed-domain smoke: real HTTPS/Edge CORS, Vercel long search
   streaming and cookie renewal; new/uploaded and existing-corpus source reuse;
   native and scanned multi-page evidence; hold/manual failure recovery; explicit
   identity/version review; queued registration and current-approved-only search;
   Coordinator PDF read and direct mutation/search/operator denials. Read back
   source hashes, row/event counts and legacy/case KPI agreement privately.
7. Only then enable the approved manual platform entry flag. Automatic Drive
   intake remains off until KT's separate extractor decision and acceptance.

## Rollback / pause

Set `RESUME_INTAKE_ENABLED=false` to block new upload/prepare/extraction retry and
scheduled dispatch. Authenticated original view/status remain available if the
service is healthy. Existing authorized review receipts are not revoked by this
flag; a full write freeze requires a separately reviewed database grant change.
Keep `NJORDHR_DRIVE_INTAKE_ENABLED=false`. Set AI access flags off if needed.

Preserve registry rows, originals, review history, extraction attempts and outbox.
Never drop the new tables to roll back. The old Needle uploader returns 410 and
must not be re-enabled as a fallback. Rolling the UI/API all the way back across
candidate-field relaxation or revoked save RPCs requires compatibility review;
it is not a safe one-command rollback. Prefer a forward fix with entry held.

## Evidence boundaries

See `PLATFORM_RESUME_INTAKE_SLICE_2026-11-07.md`. Normal staging Master and
Coordinator sessions were reused; no interactive login, password collection,
admin-generated user session, public Drive file, hosted model or production
write was needed. A local Functions adapter is not proof of deployed Deno CORS,
and a synthetic Needle fixture is not production model/extractor acceptance.
