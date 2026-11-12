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

## Sending-domain setup follow-up

Owner approved the DNS records, sender setup and synthetic retry. Three Resend-
provided records (one DKIM TXT and two sending CNAMEs) were added in Hostinger for
`mail.crewme.si`. Public DNS matches all three values; Resend reports Verified and
Ready. Existing website records and nameservers were preserved. Receiving and
tracking were not enabled. No subscription was added.

The approved runtime sender was applied with operator audit attribution. The normal
UI retry was rejected with HTTP 403 claiming the domain was not verified. The
verified browser account has no API logs, and its account identity differs from the
owner address returned by the existing key's earlier restriction error. This points
to a Resend account/key mismatch, not a DNS problem. The sender setting was restored
to its exact previous absent state. No email delivery is claimed.

Pending owner action: authorize use of the verified account and provide a domain-
restricted Sending-only key through the ignored private file. Credential creation
requires user handoff. After configuration, retry the authorized synthetic inbox
and complete emailed-link sign-in, form save/reload/submission and cleanup. DNS,
verification screenshots and sender before/apply/restore receipts are in ignored
`.local/invitation-eligibility-20261112/`. No key or private applicant data is recorded
in this document.

### Verified account connected; real delivery passed

Owner supplied the Sending-only key for the verified domain and authorized the
account switch. Runtime key and sender were changed together in one guarded
transaction, with operator audit attribution and a private backup of their previous
values. The key is marked secret and is not present in source or this document.

Normal signed-in UI retry returned “Invite sent successfully.” Resend showed the
authorized synthetic invitation as Delivered. This resolves the sending-domain/
account mismatch. No code or Function redeployment was needed.

The emailed-link applicant sign-in, form save/reload and final submission remain
pending user handoff. Existing recruiter sessions and the synthetic requirement/case
remain available for that check. Provider delivery is verified independently of
application webhook ingestion; the new account's webhook setup has not been verified.

### Applicant browser smoke — draft persistence verified

The owner completed normal applicant sign-in in Chrome. The original invitation
was first consumed on a phone; reusing that one-use link on the Mac correctly
failed. A subsequent normal sign-in reached the applicant dashboard. The failure
copy incorrectly directs an already-invited applicant to request another recruiter
invitation instead of explaining how to request a fresh sign-in link.

The browser created one draft for the invited synthetic requirement. Synthetic
personal details were autosaved, survived a full reload, and remained present after
returning to the dashboard and using Continue. Read-only database verification
confirmed exactly one application for the fixture, bound to the intended case and
requirement. Thirteen sections were persisted; all required sections except the
final declaration passed the form's current validation (92% progress).

Final declaration/consent and submission await action-time owner confirmation.
No live submission or completed application-task result is claimed yet. The case
and requirement remain open for that last check. All supplied form details are
fictional fixtures, explicitly labelled as a synthetic test with no reference
contact or background checks intended.

Smoke finding: medical history uses an unchecked checkbox for both unanswered and
No. The section remains incomplete until the checkbox is checked and unchecked.
Source inspection confirms a false UI default without an initial persisted answer;
the validator requires an explicit boolean. This needs an explicit Yes/No control
that preserves unanswered state. Also observed: Physical is marked complete before
its visually required sizing-system and coverall fields are filled; required labels
and shared validation need reconciliation. These findings are recorded, not patched
or deployed in this smoke.

### Real invitation flow completed

Owner approved the synthetic declarations and submission at the final step. The
normal applicant browser submitted successfully and displayed reference
`REF-317386`. Read-only database verification confirmed the same single application
changed from draft to submitted and retained its exact case/requirement binding.

Recruiter UI verification passed: Application form became Completed with the
submission timestamp; View application opened the submitted form and requirement
review findings; Back returned to the same Recruitment case. The Applications list
found the reference and grouped it under the expected synthetic company and ship,
with requirement `2026-Nov-004`. The document checks show missing training from
the deliberately minimal fixture; this is not a hiring or compliance approval.

View CV opened a new tab with the expected synthetic PDF title. Automated content
inspection was blocked by the browser URL policy for `blob:` URLs, so PDF rendering
was not reverified during this check. No workaround was attempted.

The synthetic case and requirement were closed through their normal UI actions.
The submitted application and test audit history are retained. No real reference
contact or background check was initiated. The earlier sign-in-copy, medical-history
answer and required-field consistency findings remain pending, as does verification
of webhook ingestion for the newly connected Resend account. Screenshots and
redacted query receipts remain in the ignored task directory.


### Applicant smoke follow-up — 2026-11-13 (deployed)

Owner visually confirmed the one-page synthetic résumé in the opened PDF tab.
This closes the rendering check with human evidence; automated blob inspection
remains policy-blocked and no workaround was attempted.

Root causes and fixes:

- The one-use-link error offered only another recruiter invitation. It now links
  to the existing applicant sign-in page, explains expiry/reuse and retained drafts,
  and retains recruiter-help guidance if eligibility prevents a new link.
  Authentication, claim checks and single-use-token behavior are unchanged.
- Medical history rendered an unchecked checkbox as if No, without persisting an
  answer. Explicit Yes/No radios now distinguish unanswered from saved false.
  No saves a boolean and clears conditional incident fields. Shared validation
  governs field feedback and completion, including incident date/description.
- Physical/uniform completion checked height and weight only, despite five other
  starred fields. All seven required fields now use the same field validator for
  progress and submission, with whitespace/nonfinite/nonpositive checks.

These changes apply to editable drafts; historical submitted data is not changed.
Final verification: 44 focused/adjacent browser and validation cases, lint and
build pass. Five focused browser cases also pass on the final screenshot capture;
settled medical, uniform and link-recovery layouts were visually inspected.
Independent review found no material issues and separately checked validation edge
cases. The owner subsequently approved exact commit `c6499bd2f58083583e53823d8f835906be83e4cb`;
main promotion and primary Vercel deployment `7746949878` succeeded. Live
submitted-application viewing, Back, recruitment and related page checks passed.
Editable applicant fields and expired-link recovery retain pre-release synthetic
coverage; no applicant session was changed during this smoke. No database,
Function, Needle, provider setting or intake change is part of this patch.
