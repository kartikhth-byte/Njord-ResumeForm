# Holmes UI refinement — 2026-11-15

This pass applies the layout and visual clarity suggestions from the owner's
presentation to the current shared-list branch. It leaves AI Search outside
scope and keeps the established Company → Ship grouping, application link
authority, task ownership, and separate KPI attribution intact.

## Applied

- Shared tabs use a consistent underline treatment. Wide tables have light
  column dividers, visible horizontal scrollbars, and keyboard scroll focus.
- Requirements, Candidates, Recruitment, and Applications keep their stable
  IDs, serials, dates, notes, and group headers. Empty filtered lists provide
  a clear-filter action. Application link exceptions stay in the main list,
  with the row outlined and the reason available on hover or keyboard focus.
- Requirement and candidate forms offer searchable selectors where option
  lists can grow. Candidate attachment also searches company, ship, and
  requirement ID while preserving the selected requirement.
- The Home alert area links to individual records. Recruitment tasks appear
  as ordered rows in the case panel. Application checks display counts that
  explain their status. New résumé intake guidance is shorter, while résumé
  source stays visible and technical metadata is expandable.
- Calendar has a compact month/Today/search toolbar, line grid, event
  previews, and upcoming events when a selected day is empty. Expiry uses
  time-window tabs. Operator health displays evidence in a table; raw
  diagnostics remain expandable. Settings puts team actions in a More menu
  with Remove last. Login shows its error beside the password field.
- Visible shared views revalidate after returning to the tab (throttled to
  one read per 30 seconds). Directory dates use a common day-month-year
  presentation.

## Presentation faults 2–6 follow-up

- Fault 2: shared tabs and visible Refresh controls use common components or
  styles on the reviewed recruiter and Operator screens. Refresh stays available
  for an explicit retry; shared views also revalidate on focus.
- Fault 3: the reviewed pages have tighter hierarchy, but the application does
  not yet enforce the presentation's five-size type scale. That remains a
  separate design-system change.
- Fault 4: the listed explanatory copy is removed or shortened, and Operator
  diagnostics are disclosed on demand. A full terminology pass across every
  applicant and administrative screen remains outstanding.
- Fault 5: KPI values are neutral and application check statuses use words.
  The proposal to reserve red solely for machine doubt is not applied globally:
  the product also uses red for destructive actions and failures. A global
  colour reassignment needs a reviewed semantic and accessibility pass.
- Fault 6: Rank and Vessel type are searchable in requirement and candidate
  forms; the ship editor, candidate Rank filter, and Applications filters are
  searchable too. The applicant's first form section now searches its long
  Rank and Vessel type lists. The collapsed Recruitment icon differs from
  Requirements, and the problem-report launcher uses a bug icon instead of a
  plus. Dates are consistent in the reviewed shared directories. The Company →
  Ship grouping and explicit Refresh remain by product decision. Focus
  revalidation does not update an open tab continuously.

## Deliberate boundaries

- Company → Ship grouping remains the primary structure on shared lists;
  flattening it would remove the agreed handover context.
- KPI source cohort and task performer credit remain separate. Colors still
  distinguish warnings, failures, and selected controls.
- Candidate sea-service fields and Settings last-active timestamps are not
  fabricated from unrelated data. They need an authoritative field/query
  before those presentation elements can be added.
- This is a local UI change. It does not change database policies, release
  resources, or production data.

## Verification

Lint and build pass. The four synthetic directory/workspace smoke specs cover
38 cases (32 on the first complete run, then all six changed-selector cases
passed on rerun). Nine KPI parity browser cases pass (eight on the full run,
then the updated Requirements selector passed). The adjacent application,
KPI, and recruitment Node suites pass 38 cases. Three new synthetic checks
pass for Calendar, Operator, and Settings; their screenshots were reviewed
and the Operator table width was corrected. Desktop and narrow-width
screenshots from the directory smoke run were reviewed for grouping, columns,
and exception-row treatment. The browser run used fake Supabase values and
the local AI Search feature flag; no live services or data were touched.
Release promotion remains a separate step.

The fault follow-up passes lint/build, 11 fleet browser cases, seven candidate
browser cases, eight AI rail cases, three UI refinement cases and 18 problem
report cases. The problem-report suite first failed because its test-only app
version flag was absent and its Coordinator route still targeted Companies &
ships; rerunning with the expected flag and current Coordinator route passed.
The Applications search-filter follow-up passes lint, build, and two focused
synthetic browser checks. An initial browser attempt was blocked by the macOS
sandbox; the same checks passed when Chrome was allowed to start.
The applicant-form follow-up passes lint, build, and one focused synthetic
browser check from invitation through the first form section.

## Checklist follow-up — 2026-11-15

- Company, Ship, Requirement and recruiter filters now narrow their options as
  the user types. This includes Applications, Recruitment, Requirements,
  Candidates, Home, KPI, the fleet navigation/forms, and Recruitment assignment
  controls. The current selection stays in the dropdown while searching.
- Requirement/fleet forms no longer repeat the Draft/opening-date and refresh
  instructions beside controls that already show those actions. The shared
  date formatter is now used for applicant summary/review, sea-service rows,
  test invitation/retake dates, compliance findings, rejection history and
  problem-report history as well as the shared directories.
- Report warnings/errors and the Send button now use the theme's semantic
  colors. Arbitrary 11, 13 and 15 pixel text classes were mapped to the
  existing theme sizes. The theme still defines seven sizes and keeps red for
  errors/destructive states, following `docs/ui-theme-spec.md`; a wholesale
  five-size remap was not applied without visual and contrast evidence.
- The remaining authenticated applicant form sections and detail screens need
  separate visual/copy review. The local smoke uses intercepted data; signed-in
  staging visibility, ID backfill and note permissions remain unverified.
- The full agreed synthetic suite passes 96/96. Separate saved-draft route
  checks for applicant sections 2–19 pass 18/18, and the requirement-detail
  route passes 1/1. Adjacent Node suites pass 38/38; lint/build pass.
