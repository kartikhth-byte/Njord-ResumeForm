# Requirement-bound applications — 2026-11-12

## Root cause and scope

The recruiter invitation already stored `applicant_magic_link_requests.case_id`.
Claim redemption returned only prospect/organization, and draft creation checked
whether any invited post-interview case existed. It inserted the application but
never set `recruitment_cases.application_id`. Generic sign-in reissue also discarded
case context. The directory accurately exposed missing links, but presented them
as a normal workflow. The owner clarified that all long forms arise during hiring
for an attached requirement.

## Implemented contract

- One submitted-form list, grouped Company → Ship, with requirement links. Saved
  tab URLs no longer hide rows. Existing missing links are labelled for correction;
  no association is inferred from name, candidate identity or latest requirement.
- Migration **2026111202** supplies exact-case applicant claims and
  `start_claimed_application_for_case`. It validates applicant ownership, prospect
  state and organization, invite, case stage and open requirement. Draft, supporting
  data, case link/version and history event are written atomically.
- Repeated starts on the same bound draft return it without overwriting data.
  Applicant profile locks serialize simultaneous starts. Existing active-application
  constraints remain. The old RPC delegates only for a unique eligible case.
- Case-specific claim redemption retains token/identity/expiry/replay guards and
  validates the exact invited case. Generic reissue retains a unique eligible case;
  several invitations lead to explicit requirement selection, never first-row choice.
- A database trigger rejects new submissions without an eligible exact link,
  including direct writes. Closed/archived requirements and withdrawn/rejected/closed
  cases cannot authorize new forms. A separate guard rejects invites on unavailable
  requirements before the send function delivers mail.
- Existing submitted records remain readable/editable; no historical backfill.
  Existing unlinked drafts are preserved with guidance to contact the recruiter,
  or explicitly discard an obsolete draft and start from a current invitation.
  The prior automatic deletion of empty drafts on dashboard load is removed.
- Draft linkage is not completion. Recruitment and KPI pending work use the linked
  form's `submitted_at`; application-task assignment remains possible while draft.
  The completion footer shows actual submission time, without attributing it to the
  invitation/draft-start recorder. Other recruiter task credits remain unchanged.

## Verification

- PGlite: real case/claim/workspace migration chain plus 1202 (including rerun),
  exact case, multiple invitations, wrong identity, anonymous/non-applicant denial,
  token replay/expiry, draft retry/data preservation, closed/withdrawn/no-invite gates,
  privileged and applicant submission enforcement, legacy preservation, and task
  assignment before/after submission: passed.
- 20 focused/adjacent Node tests passed (directory, application progress, case,
  workspace and KPI).
- Final expanded browser run: **24/24 passed**, including invite redemption and
  the independent review's submission-attribution correction. Desktop/mobile
  screenshot checks passed; final copy-only shortening followed that run.
- Lint, production build, edge TypeScript syntax transpile and diff whitespace
  checks passed. Build reports only the existing bundle/browser-data warnings.
- Signed-in staging Master read-only check: four submitted forms, one exact linked
  form and three correction exceptions; no view tabs. Open recruitment reaches the
  exact historical Joined case, with View application, Completed application task
  and the actual submitted timestamp. This is separate from the rolled-back
  applicant database test; no normal applicant email session was exercised.
- Actual staging `dwslhetniuzpyuspuomy`: migration compiled against managed schema;
  authenticated applicant draft creation, retry and submission succeeded with the
  exact synthetic case. All changes were rolled back; application/case/request
  counts and function/migration state remained unchanged. An initial test-only
  role-reset failure was corrected; no application source change was needed.
- Independent review found misleading application-completion attribution to the
  draft/invitation event. Fixed with actual submission timestamp and browser coverage;
  no remaining material source findings reported.
- Synthetic fixtures do not claim real email delivery or deployed reissue behavior.
  No invitations, paid model calls, production changes or intake activation occurred.
  Private staging receipts remain outside Git.

## Release gate and order

This is **not a frontend-only release**. Obtain exact production approval before
applying schema or deploying:

1. Fresh production backup and existing isolated restore verification.
2. Apply `2026111202_application_invitation_binding.sql` to Holmes production.
3. Deploy this candidate's `request-applicant-magic-link` Function with the existing
   verified authentication configuration. `send-prospect-invite` source is unchanged;
   it already records the exact case before mailing, and the new database guard
   protects its invite RPC.
4. Promote the reviewed frontend commit to main/Vercel.
5. Live smoke: directory grouping/correction visibility, permissions, exact invited
   draft link, submission/reload, Recruitment task status/time and submitted-form
   navigation. Use approved synthetic fixtures. Do not send emails without explicit
   authorization; state any normal-session/email coverage limitation.

Older clients fail safely on ambiguous starts. For rollback, prefer a forward fix;
keep the link/submission guards and compatible draft-aware task rendering together.
Do not erase new links, drafts or history to roll back. No Needle/hosting/region/tier
change is part of this release.
