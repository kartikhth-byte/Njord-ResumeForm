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
it does not authorize deploying this new detail-page candidate.

## Release gate

Frontend-only candidate: no database migration, Edge Function, Needle, hosting or
intake change. Obtain exact production approval after final review/commit, then
promote to main/Vercel and perform read-only live detail smoke. Email test completion
and any user sign-in handoff must be reported separately from deployment status.
