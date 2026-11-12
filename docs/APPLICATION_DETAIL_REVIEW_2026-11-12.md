# Submitted-form review — 2026-11-12

## Scope

Application detail is a read-only review of the submitted form, document checks
and review findings. Full existing form sections and worksheet/print exports are
preserved. Scheduling, stage changes and reopening are accessed in Recruitment;
the legacy application status controller and reopen action are removed here.

- Original CV access reuses authenticated `openCandidateResume`, with explicit
  missing/error/retry states. No new uploads, storage or intake activation.
- Recruitment links use `recruitment_cases.application_id` exactly. The old
  latest `prospect_requirements` lookup is removed. Several linked cases require
  selection; requirement-specific findings follow that selection. Missing links
  are correction exceptions, never inferred from the candidate's other cases.
- Back returns to the originating filtered Applications list, candidate profile
  or selected Recruitment case. Direct visits safely return to Applications.
  Case selection preserves router state; section links scroll without replacing
  it. Reload preserves the selected case and source destination.
- Section shortcuts and wrapping/scrollable content support narrow screens.
  Document failures no longer accompany a green “No review flags” message.
- Recruiter permission checks precede form reads. Coordinator remains read only;
  applicant ownership filtering and secure anonymous review RPC are preserved.
  Loaded data is keyed to user/type/token; authorization changes hide stale content
  immediately and stale asynchronous reads cannot replace the new principal's data.

## Verification

- Focused synthetic browser suite covers Master/Recruiter/Coordinator, exact links,
  original PDF retrieval/download, missing/error states, multiple-case selection,
  reload/Back/section links, unauthorized denial, applicant-only form and cross-tab
  account switch while authorization is pending.
- Adjacent Applications directory and Recruitment workspace browser checks pass.
  The initial combined run was 27/27; reviewer-found navigation/auth cases were
  added and rerun separately on the final source: **10/10 passed**.
- 16 adjacent Node tests pass. Lint/build pass, with existing bundle/browser-data
  warnings. Synthetic tests intercept all service traffic and mutate no live data.
- Normal staging Master session: submitted form and exact historical requirement
  findings load, missing CV is explicit, Back returns to the originating case.
- Independent review identified case-selection state loss, native anchor state
  loss and stale form visibility during authorization changes. Fixes and focused
  regressions are included; final independent source review reports no remaining
  actionable findings.

## Separate invitation smoke

Owner authorized a real invitation flow to a controlled inbox. Only the existing
clearly labelled synthetic CV candidate and a new synthetic requirement are used.
The recipient, record IDs and screenshots stay in ignored private records. This
check exercises the already deployed requirement-bound invitation implementation;
its result is separate from the approved detail-page deployment.

## Production release and read-only smoke

Owner approved exact commit `f3b015edc9d0b20aaf87b803801a3fa300a10052`.
It was promoted to Holmes main/Vercel; production deployment `7736259856`
reports success. No database, Function, Needle, hosting or intake changes.

Normal signed-in production smoke passed: submitted form/review findings/full
sections load; missing CV and missing exact recruitment link are explicit; legacy
hiring controls are absent. Documents section navigation followed by reload and
Back preserves the original Applications search (`q=REF-553102`). The existing
historical form remains unlinked; exact linked-case/CV and role variants were
verified in staging/synthetic tests, not claimed as new live coverage.

## Real invitation test — blocked before email

Using the normal production UI, the synthetic CV candidate was attached to a new
synthetic requirement, contacted, confirmed, test-waived with a synthetic reason,
and advanced through a synthetic scheduled/passed interview. The owner-authorized
invitation attempt returned **Only approved prospects can be invited**. No email
was sent, and email receipt/sign-in/form/submission remain unverified. The open
synthetic requirement/case are retained to resume this exact test; record IDs and
recipient are in the ignored private receipt.

Root cause: the UI offers a form invitation based on the selected case's passed
interview, while `reserve_prospect_invite` still requires the separate legacy
`prospects.status = approved`. Case progression does not update that legacy state.
The email Function and downstream claim/start/submission checks also retain the
legacy requirement. Changing only the button or reservation would not resolve
this consistently. The existing SQL fixture pre-seeds approved prospects, which
explains why it did not catch the normal reviewed-CV-to-invitation path.

Follow-up requires a separate reviewed backend correction and exact production
approval. Align eligibility across invitation, reissue, claim, draft and submission
with the current case workflow while retaining identity review, organization,
archive/deletion/bounce, open-requirement and applicant-ownership protections. Add
an integration regression starting from the actual reviewed-CV candidate creation
path; do not bypass the failure by manually approving this synthetic record.

### Follow-up status

The separate repair `b10b7f6` is now deployed with migration 1203 and both email
Functions. It resolves the legacy approval mismatch without changing candidate
status. Normal UI sending reaches Resend; delivery is blocked by its unverified
sender policy. The provider-owner address has recruiter roles and was not reused
for the applicant smoke. See `APPLICATION_INVITATION_ELIGIBILITY_2026-11-12.md`
for production evidence and the remaining real-email handoff.
