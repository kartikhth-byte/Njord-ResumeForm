# Case-based application invitation eligibility — 2026-11-12

## Live failure and cause

The owner-authorized synthetic invitation was rejected before email with “Only
approved prospects can be invited.” The candidate came through reviewed CV
attachment and its requirement-specific interview was passed. Its separate legacy
prospect status remained `open`, as intended by candidate creation.

The UI used case interview eligibility, while reservation, email, claim, reissue,
draft and submission retained an independent global approval requirement. Existing
SQL tests pre-seeded approved candidates; they did not compose the reviewed-CV
creation path with the invitation path. No manual status promotion is used to
hide this mismatch, and this change creates no selection/KPI event.

## Correction

Migration `2026111203_case_form_invite_eligibility.sql` introduces shared, private
candidate/case eligibility checks. A candidate needs active lifecycle state,
complete contact details and either legacy approval or a recorded résumé identity
review linked to the same person, organization and original. Registry presence
alone is insufficient. Both existing-corpus reviews and platform-version reviews
are supported; a fresh review may legitimately refer to new evidence while the
original résumé link retains its earlier evidence row.

A selected case must belong to that person and organization, have a passed
interview/post-interview stage and an open, unarchived requirement. Claim, reissue,
draft and submission additionally require an explicit form invitation. Existing
email/token ownership, expiration, replay, archive/deletion/bounce and exact-case
checks are preserved. Multiple invitations require selection. Incomplete legacy
approved contacts are now explicitly denied too, consistent with the current
contact-completion gate.

`reserve_case_form_invite` is service-only, takes the exact case and retains
reservation/cooldown fields. The previous reservation function remains unchanged
for deployment compatibility; the updated sender uses the new function. Reissue
uses a service-only eligible-identity lookup instead of filtering global approval.
HTTP reissue responses remain generic and rate-limited. No candidate statuses or
stored applications are backfilled.

Independent review also found that the sender's Resend `tags` payload used an
object instead of the documented array of `{name,value}`. The array and outgoing
payload regression are included. Source: https://resend.com/docs/api-reference/emails/send-email

## Verification

- SQL regression applies the actual candidate-review, current case-transition,
  claim, draft and submission implementations. It creates an `open` candidate
  through `review_existing_resume`, advances the case through its real RPC, then
  reserves, invites, claims and submits without pre-approval. Migration retry passes.
- Covers wrong candidate/case/organization, denied roles, incomplete contacts,
  unreviewed CV, missing original, bounced/archived/deleted/rejected records,
  platform review, fresh evidence on an existing résumé link, legacy approval,
  multiple invitations, token replay, stable draft retry and foreign-owner reads.
- Six offline tests execute the actual TypeScript Edge handlers with external
  services stubbed: reviewed open identity, failed/denied eligibility, payload,
  provider failure cleanup, reissue ambiguity/rate limiting and exact case binding.
- Six focused invitation browser checks pass, including exact redirect, multiple
  invitation selection, draft reload and failed-read retry.
- Sixteen adjacent Node checks pass (22 including Edge tests). The original
  invitation-binding SQL regression also passes. Lint and build pass; existing
  bundle-size and browser-data warnings remain.
- Real staging schema: new synthetic reviewed CV → actual case progression →
  reservation → claim → draft/retry → submission and reissue all pass inside one
  rolled-back transaction. Record counts and function state agree before/after.
  Synthetic provider evidence and SQL auth contexts are used; this is not an email
  delivery or normal browser sign-in claim. Earlier attempts stopped during fixture
  preflight (absent prior staging migration; role metadata needed service context),
  before exercising the product flow. Final run passes on the final migration.
- Independent review cleared the final source after payload and fresh-evidence
  join corrections. No production changes or new emails during this patch.

## Release order and remaining live check

1. Obtain exact production approval; take fresh backup and verify a restore.
2. Apply migration 1203 to Holmes production `btbqdviuqcpauojmorvx` (1202 already
   deployed). Verify definitions, permissions and rollback-only production guards.
3. Deploy `send-prospect-invite` and `request-applicant-magic-link` from the exact
   approved commit, preserving their existing public-entry gateway settings and
   handler authentication. Migration must precede both Functions.
4. Promote the same commit to main/Vercel to keep deployment/source inventory aligned.
5. Resume the retained synthetic case and authorized controlled inbox. Verify real
   email receipt, normal emailed-link sign-in, form save/reload and submission;
   check exact requirement link/task completion, then close the synthetic case and
   requirement. No alternate recipient, sender or delivery override is authorized.

No Needle, intake, storage, hosting, region or subscription changes. If rollback
is needed, restore the prior Functions first; legacy eligibility safely blocks new
open candidates. The additive migration can remain while investigating; it writes
no backfill data. Reverting changed SQL functions requires a reviewed rollback
using their pre-migration definitions, not deleting applicant records.

## Approved production release and live smoke

Owner approved exact `b10b7f6f6a56487c8c13fd6ca9026c0344469513`. Migration 1203
was applied before sender v9 and applicant-link v12; the same commit is deployed
on main/Vercel (primary deployment `7738798225`, success). Both Functions retain
`verify_jwt=false` and reviewed handler authentication; downloaded source and all
shared assets match the approved commit.

Fresh full dump and isolated COPY-payload restore verified 111 tables and 7,705
rows. Full managed-schema restoration is not verified. Initial parallel dump failed
on a temporary CLI login rejection; a fresh single-worker retry passed. Migration
left candidate/case counts unchanged. Production private/service RPC grants and
exact synthetic-case eligibility pass; candidate status remains `open`. The actual
reviewed-CV creation → case progression → invitation reservation → claim → draft/
retry → submission/reissue check passed in a fully rolled-back production transaction.

The normal signed-in UI send now passes eligibility and reaches Resend. Provider
HTTP 403 rejects the controlled applicant inbox because the current sender is
restricted to the provider-owner address until a sending domain is verified.
Failure invalidated the claim and released its reservation. An approved alternative
provider-owner inbox was checked before any change and has recruiter roles, so it
was not used. No recipient or account role was changed. Recipient details and proof
remain in ignored private receipts.

Remaining: configure an authorized verified sender, then retry the distinct applicant
inbox through real receipt, normal emailed-link sign-in, form save/reload/submission
and exact-case task verification. The synthetic requirement/case are retained open
for this check. Provider acceptance, delivery, browser sign-in and submission are
not claimed; the rollback-only database test is separate. No Needle, intake, hosting,
subscription or sender-configuration change was made during this release.
