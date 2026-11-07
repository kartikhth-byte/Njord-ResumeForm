# Production release gate review

## Reviewed scope

Independent consolidated local review covered Holmes production baseline
`a1e62c1` through `cba25eb` and Needle `401ec6e0` through `2d8119c0`, including
the platform registry, identity/source transactions, company/ship/Draft schema,
dispatcher, consumer, operator boundaries and requirement modal. Private data
and production were outside the review. The earlier `ae5f45a` / `f31a705f` pair
alone omits the accepted modal.

## Findings and follow-up

| Priority | Finding | Reviewed fix |
|---|---|---|
| P1 | Existing authenticated INSERT/UPDATE grants let upload evidence bypass identity review via direct prospects writes | Additive 0617 uses an invoker trigger to require the effective table-owner role for creation/source mutation. Only the owner-only save helper reached through authenticated identity review supplies that path. Existing authorized contact/lifecycle edits retain their RLS checks. No JWT claim or caller-set session flag authorizes the write. |
| P2 | Direct reparent of a referenced ship invalidated reviewed requirements without history | 0617 makes ship ID/organization immutable and blocks company changes when any requirement references the ship. Correct the requirement to a reviewed ship via the existing audited RPC. Renames/archive remain available. |
| P2 | Twenty permanently failing oldest events blocked every later event | Dispatcher sorts by attempts, creation time, ID; failures stay pending, but healthy later registrations receive attempts. Receiver replay remains idempotent. |
| P2 | General search intentionally retained flagged PASS values that the strict requirement projection called confirmed | Requirement-only projection excludes unsafe mandatory families and explicit uncertain current rank/vessel metadata. Optional uncertainty remains allowed; general AI Search is unchanged. |

Focused independent follow-up found no remaining actionable issue in these fixes
and no active exposed RPC bypassing the new source boundary. This is code
review, not production deployment approval or model-quality acceptance.

## Verification

- SQL harness applies the actual baseline authenticated prospect grants and RLS,
  then the ordered candidate migrations through 0617. Direct INSERT and source
  UPDATE are denied; normal edits and reviewed new/link/replay work. Ship
  reparenting is denied and historical closure still works.
- Actual dispatcher regression has 21 events: 20 permanent receiver failures,
  then one healthy event. The healthy event is delivered on the next run.
- Actual LegacyGateEvaluator, analyzer, RunEngine and requirement projection
  exercise retained PASS with mandatory and optional uncertainty. Current fact
  metadata can withdraw a saved mandatory PASS.
- 138 focused/adjacent Needle Python tests pass. Holmes nine Node tests,
  requirement/Needle/platform bridge suites, platform SQL, lint and build pass.
- Existing normal-session staging visual evidence remains in the modal record.
  These fixes do not change layout; new deployed-domain smoke remains required.

## Read-only production preflight

Production migration history is missing Holmes 0604–0617 and Needle 024–026.
There are two open Holmes requirements needing explicit reviewed company/ship
mapping. The exact rows and expected versions are retained privately; labels
must not be used to guess identities. Needle has 1,643 documents and 1,629
current approved fact rows. No facts were approved by this preflight.

The new intake Functions and their three intake configuration names are absent
from production. Private service credentials, service ingress and scheduler are
not provisioned. The qualified local image is linux/arm64 and is not published;
build/pin the correct target platform before deployment. A local image ID is
not a registry digest. Fresh database dumps/restore receipts are private; their
completion must be verified before production writes.

## Remaining release sequence

1. Commit/refreeze the reviewed follow-ups on both isolated branches. KT decides
   promotion using the full amended manifest, not the earlier frozen pair.
2. Prepare a private CPU intake service on the selected host. Use the exact
   environment names in its README, correct image architecture, HTTPS ingress,
   mandatory scanner, bounded resource settings and no public Drive files.
   Approve any new paid service before provisioning it.
3. Install the private dispatcher header secret and stage a scheduled POST to
   the reviewed Function. Keep it inactive and `RESUME_INTAKE_ENABLED=false`
   during preparation. Do not put credentials in a cron URL or repository.
4. Verify fresh backups, apply only reviewed missing migrations and explicitly
   map the two open requirements with expected versions/reasons. The new exact
   gateway-off Function deployments require KT's approval as stated in the
   release manifest.
5. KT promotes Needle first, then bridge/Functions and Holmes; run the complete
   operator-only HTTPS/CORS/session/search/review/attachment/role smoke.

`NJORDHR_DRIVE_INTAKE_ENABLED=false` throughout. NuExtract/v18 hookup acceptance
and automatic intake reopening remain separate. Do not use a code-review pass
as permission to reopen intake.
