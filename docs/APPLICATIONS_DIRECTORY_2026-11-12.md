# Applications directory — 2026-11-12

> Superseded in part by the owner's later clarification: remove the three views;
> applications originate in requirement-linked hiring. See
> `APPLICATION_INVITATION_BINDING_2026-11-12.md`. The release history below records
> the earlier deployed design and its frontend-only scope, not the new release.

## Approved design and scope

The owner approved Applications as a submitted-form review page, consistent with
Candidates/Requirements/Recruitment: Company → Ship → Applications. Requirements
are row links, not a third grouping level. All submitted / Linked / Not linked
views replace the old pipeline stage chips. Use Open recruitment for stage/task
work. Unlinked forms remain visible, including submitted terminal-status forms.

Rows show candidate/reference, linked requirements and broad case stage, applied
rank/vessel type, submission date, document-check summary and View application.
Document badges describe the existing submitted-form checks (Action needed,
Check details, Checks clear); they do not assert manual document verification.
There is no new review-completion state or database mutation.

## Link and data contract

- Only `recruitment_cases.application_id` + matching `prospect_id` link forms to
  requirements. Never infer from other cases for the candidate, résumé employers,
  or old textual company/ship labels. Missing fleet mappings are visibly distinct
  from an unlinked form.
- Group by IDs. One form per ship; preserve every case/cycle requirement link.
  Forms spanning ships appear in each applicable group but total/tab counts and
  pagination count unique forms. Group counts describe only the current page.
- Submitted forms and related rows are paginated in 500-row batches; ID lookups
  are chunked to 100 IDs. Read failures show retry, not false Not linked results.
- Search, fleet/requirement/check filters, view and applied advanced filters live
  in the URL. Filter changes reset pagination and reveal collapsed matches.
  Company/ship changes clear dependent selections. Invalid saved selections
  remain visibly unavailable until changed, rather than displaying All.
- Retain existing advanced-filter algorithms. The date filter now explicitly uses
  submission date. Saved `?status=` links remain visibly active and clearable.
  No schema, RLS, edge function, intake or Needle changes.

## Compatibility audit

The large page deletion is intentional: old list-stage chips, duplicate status
mutation controls and unused AI match/relevance columns are removed. Shared
SequentialStatusControl, ViewApplication, applicant form handling and other
callers are unchanged. Application detail's legacy workflow controls remain a
separate follow-up; this slice changes the directory only. Existing contract-end
editing for hired applications and latest notes remain available. The older
Teams OAuth return can still reopen its eligible interview modal; merely opening
or cancelling it does not send invitations.

## Verification

- Five directory unit checks cover exact links, same-placement filtering,
  missing metadata, saved filter/status parsing, 1,001-form pagination, lookup
  chunking and read failure propagation. With adjacent application progress,
  case, workspace and candidate tests: 23 passed.
- Eight Applications browser checks: grouping/collapse, unlinked/terminal forms,
  filters/reload, Coordinator read-only access, error/retry, saved status and
  advanced filters, overlapping refresh/filter requests, Teams-return cancellation,
  unique pagination and 390px layout. Nine adjacent Recruitment checks passed.
  Combined run: 16/17; the sole test failure misclassified the existing read-only
  runtime-config POST as a write. The fixture was corrected specifically for
  get_client_config and the targeted Teams test passed. Final grouping screenshot
  test also passed; no runtime source changes followed the combined run.
- Lint and production build passed (existing bundle/browser-data warnings only).
- Independent review found a refresh/filter loading-state race; fixed and covered
  with a delayed-request test. No remaining material findings.
- Read-only normal staging Master: four submitted forms; one exact linked form
  remains visible under Company/Ship not mapped, three unlinked forms retained.
  View application opens the correct submitted synthetic form and Back preserves
  the Linked tab. Open recruitment opens the exact Joined case. No records or
  invitations changed.
- Synthetic Coordinator checks do not claim a fresh normal-session Coordinator
  smoke. Source application/detail write permissions are unchanged.

## Production release and live smoke

Exact commit `59ff459a548dc57373a0cd8c9899718a8e61ad32` was approved and
fast-forward promoted to Holmes main. Primary Vercel deployment `7732373637`
succeeded at 2026-11-12 08:37:36 UTC; the secondary deployment also succeeded.
No migrations, backend release, intake activation or record changes occurred.

Read-only production Recruiter smoke passed:

- All submitted loads the one existing submitted synthetic form; Not linked
  retains it and Linked correctly shows zero. No relationship was inferred from
  the candidate's separate recruitment case.
- Reference search returns the expected form. Tab and search persist on reload.
- View application opens the correct synthetic form; its Back button preserves
  the filtered list context.
- Checks clear filters the action-needed form out; clearing the filter restores
  it. The list is left in All submitted with filters cleared.

Production has no exact linked forms, so live company/ship grouping and Open
recruitment navigation could not be exercised. Those paths passed staging and
synthetic checks above. This slice does not claim a fresh normal Coordinator
production check. Private screenshots remain in
`.local/applications-release-20261112/`; no form contents are committed.
Separate local Needle changes were untouched.
