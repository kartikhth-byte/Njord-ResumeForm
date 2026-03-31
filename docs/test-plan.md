# Platform Test Plan

## Automated Baseline

Required baseline:

```bash
npm run lint
npm run build
npm run test:smoke
```

Current known passing state in this phase:
- `npm run lint` passes on the 2026-03-30 follow-up snapshot
- `npm run build` passes on the 2026-03-30 follow-up snapshot
- `npm run test:smoke` passes on the 2026-03-30 follow-up snapshot (`75 passed, 2 skipped`)

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

## Applicant Test Strategy

### Automated

- applicant authenticated smoke
- applicant section route smoke across all 19 sections
- applicant autofill smoke

### Manual

- wipe applicant test data
- log in via Google OAuth
- complete every section manually
- validate autosave, navigation, and review behavior
- from applicant dashboard, open a submitted application and confirm the summary is read-only and does not expose recruiter workflow controls
- confirm unauthenticated recruiter email review links require the secure expiring `access` token and fail cleanly when the token is missing or expired
- for export work, verify the source application’s review page values against the generated workbook section being implemented

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
