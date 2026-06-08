# Platform Test Plan

## Automated Baseline

Required baseline:

```bash
npm run lint
npm run build
npm run test:smoke
```

Current known passing state in this phase:
- `npm run lint` passes on the 2026-06-08 cleanup snapshot
- `npm run build` passes on the 2026-06-08 cleanup snapshot
- `npm run test:smoke` passes on the 2026-06-08 cleanup snapshot (`77 passed, 2 skipped`)

## Client Form Export Prototype

Current prototype command:

```bash
npm run prototype:cma-cgm -- --template '/Users/kartikraghavan/Downloads/CMA CGM form 1.numbers' --public-token '<public-token>' --output '<output.xlsx>'
```

Current scope:
- populates Sections 1 and 2 on the `Main` sheet
- embeds the applicant photo into `G5:H14`

Prototype verification completed:
- Sections 1 and 2 cells populated correctly for live application `NJD-211280`
- applicant photo embedded into `G5:H14`
- output workbook preserved visible template formatting on manual inspection
- target Section 1 and Section 2 cells retained their original template style IDs after writing

Prototype caveats:
- live generation requires Supabase network access
- `.numbers` template normalization currently depends on local macOS Numbers
- there is not yet automated regression coverage for the writer prototype

## Hosted Worksheet Export Validation

Manual validation required for each supported customer template:
- upload a normalized `.xlsx` template in recruiter settings
- confirm the active template file name is shown correctly in settings
- open a submitted application as recruiter and launch `Generate Worksheet`
- confirm the modal shows the selected customer, active template name, and upload timestamp
- confirm generation starts only when an active template exists
- confirm the download starts with the expected generated filename format
- confirm the browser receives the generated file instead of a generic fallback name
- confirm mapped cells are overwritten even when the uploaded template already contains old sample data
- confirm visible workbook formatting is preserved after population
- confirm the export uses the current application values, not stale data from a prior run

Per-customer verification matrix:
- CMA CGM: upload template, generate workbook, manually inspect `Main`, `History`, and `End`
- Sonangol: upload template, generate workbook, manually inspect `Main`, `History`, and `End`

Specific worksheet checks:
- active template metadata displayed in recruiter UI matches the uploaded file
- generated workbook opens cleanly in Excel/Numbers
- `Main` sheet remains the active first-use sheet
- no stale `Export Summary` sheet remains in the generated workbook
- prefilled template sample values are overwritten in every mapped output region
- applicant photo, when present, is populated correctly

## Applicant Test Strategy

### Automated

- applicant authenticated smoke
- applicant section route smoke across all 19 sections
- applicant autofill smoke
- draft/form smoke uses a generated disposable applicant state at `PLAYWRIGHT_DRAFT_APPLICANT_STORAGE_STATE` so the submitted-application test account can keep an active pipeline application

### Manual

- wipe applicant test data
- log in via Google OAuth
- complete every section manually
- validate autosave, navigation, and review behavior
- from applicant dashboard, open a submitted application and confirm the summary is read-only and does not expose recruiter workflow controls
- confirm unauthenticated recruiter email review links require the secure expiring `access` token and fail cleanly when the token is missing or expired
- for export work, verify the source application’s review page values against the generated workbook section being implemented
- for single-active-application enforcement, verify that a second active draft/submission for the same applicant returns `unique_active_application_per_user` and that the dashboard/review-submit UI shows the applicant-facing conflict message

## Edge Function CORS Validation

Manual checks:
- confirm the `APP_URL` runtime setting contains every intended browser origin, comma-separated when more than one origin is valid
- send representative `OPTIONS` preflights from the production frontend origin and confirm `204` plus matching `Access-Control-Allow-Origin`
- send representative `OPTIONS` preflights from an unlisted origin and confirm no `Access-Control-Allow-Origin` is returned
- for worksheet downloads, confirm `Access-Control-Expose-Headers` includes `Content-Disposition`

## Prospect Enrollment Validation

Manual checks:
- from the recruiter prospect detail page, edit the prospect email, clear any bounce state, and send a new invite
- confirm the invite button respects recruiter permissions and that the invite reservation prevents duplicate sends in a short resend window
- confirm bounced invite emails set the prospect bounce flag and that correcting the email clears the flag before resend
- on the recruiter dashboard Reports tab, export the current prospect queue as CSV and the requirement / funnel snapshots as PDF
- confirm CSV and PDF export buttons only appear for the matching export permissions, and that the file downloads only after the audit row is recorded
- confirm the Recent exports panel shows the latest export audit rows
- open a submitted application as recruiter and confirm the generic compliance panel and requirement overlay render side by side when a linked requirement is present
- confirm the requirement overlay stays hidden when the application has no linked prospect/requirement context
- on the prospect detail page, confirm linked applications are shown without tokens unless application access is explicitly granted

## Recruiter Test Strategy

### Automated

- recruiter authenticated smoke
- public-route smoke

### Manual

- login as `Master Recruiter`
- verify team-management visibility and actions
- verify create recruiter/coordinator
- verify role restrictions
- verify reset-password flows
- open submitted application from recruiter flows and confirm recruiter review controls still appear
- open a recruiter review email link and confirm the secure token grants access without exposing recruiter-only controls to applicants

## Bootstrap / Setup Validation

Manual checks:
- setup unlocked when there is no `Master Recruiter`
- setup locks after first master recruiter is created
- bootstrap path works through the UI, not only via direct function invocation

## Branding Validation

Manual checks:
- real logo appears undistorted
- `Njord Holmes` name is visible where intended
- recruiter/public surfaces are reviewed for consistency
