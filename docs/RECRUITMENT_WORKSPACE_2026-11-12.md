# Recruitment workspace and activity attribution

## Scope

Implementation of the 2026-11-12 owner-approved discussion. After exact release
approval, migration 2026111201 was applied to production, then Holmes commit
`c89a0c2c6fdb1767b4b10f7c9eab2b08e170739a` was promoted to main/Vercel.
Production deployment and synthetic live smoke are complete.

- Recruitment page: one row per candidate/requirement/cycle; URL-backed search,
  company/ship/requirement/recruiter filters, My work, overdue/unassigned attention,
  default Company → Ship grouping, and an accessible side panel. Company and ship
  headers collapse independently; rows retain the requirement column and full
  table width. Group counts reflect filtered rows and distinguish active cases.
  Filters reveal matching groups; My work includes row ownership or unfinished
  task assignment. Group identity uses company/ship IDs, never names.
- Six display stages are derived from the existing case status. No second stage
  column or replacement state machine. Existing assessment, contact, application,
  principal-handoff and CV guards continue to apply.
- Tasks derive outcomes from existing transition events and the linked submitted
  application. No inferred historic completions. Preparatory tasks may be owned
  in parallel; completing them still follows the existing workflow gates.
- New assignment rows hold case/task assignee, due date and start time. A row
  takeover does not reassign its tasks. Any workflow-authorized recruiter can
  claim their own work; Master Recruiters can assign another eligible recruiter
  or clear an assignment. Coordinator accounts are read-only.
- Assignment changes are version-checked under a case lock and recorded in
  immutable history. Closed cases cannot be assigned. Closed/archived requirements
  cannot start tasks or progress further (closing the case remains possible).
- The signed-in account is always the recorder. A separate performer can be
  selected when recording work done by another eligible recruiter. Credits link
  to immutable case events. Old events without performer data retain recorder
  attribution, explicitly labelled in the KPI page.
- Candidate directory retains Add/Edit/Attach/CV and gains broad stage labels
  and exact-case workspace links. Requirement details link to the workspace.
  The earlier candidate column-alignment fix is included.
- KPI adds current assigned rows, pending/overdue tasks and period activity by
  performer (contacts, completed test/interview attempts and document checks).
  No-show/waiver are not completed-attempt credit. Historical sourcing cohorts
  are labelled separately. Team hires retain existing distinct-candidate rules;
  no arbitrary individual placement-credit allocation is introduced.

## Database and authorization

Additive migration 2026111201: assignments, assignment history and event-linked
performer credits; SELECT-only client grants, RLS and server-only write RPCs.
Existing recruitment_case_transition is reused through a scoped wrapper.
Idempotent replay cannot cross actor, performer or target status. No historical
facts or events are rewritten. The existing single pilot organization scope is
preserved; this slice does not claim multi-tenant membership support.

New UI deploys after this migration. Rollback frontend leaves additive assignment
and credit history intact. No intake, Needle, Functions, model, hosting or
subscription change. No invitations or external communications are automatic.

## Verification and release gate

Final source checks on 2026-11-12:

- 45 focused/adjacent Node tests passed (workspace, case, case KPI, KPI tracker,
  candidate directory and requirement groups).
- 31 synthetic browser checks passed across Recruitment, Candidates,
  Companies/Requirements and KPI parity; desktop/mobile layout included.
- Lint, production build and diff whitespace checks passed.
- Isolated PGlite checks load the real case, transition and principal-handoff
  migrations. They verify caller-bound permissions, banned/ineligible assignees,
  Coordinator/anonymous/cross-organisation denials, stale versions, immutable
  credits, replay checks, completed-task guards, and closed-requirement guards
  through both existing and new transition/handoff entry points.
- Independent release review found three issues: existing RPCs bypassed the new
  closed-requirement guard, principal handoff ignored performer selection, and
  task display preferred recording time over occurrence time. All were fixed;
  follow-up review found no remaining material issues.

Before production approval, migration 2026111201 was verified on staging
`dwslhetniuzpyuspuomy`.
Normal signed-in Master and Coordinator sessions verified grouping, filters,
row assignment/takeover, independent interview assignment/due date, contact
completion, reload, and Coordinator read-only controls. The completed contact
retains Stage Recruiter as performer and Master as recorder after row handover
back to Master; the KPI page shows that performer credit and independent task
workload. A rolled-back authenticated database check separately verified normal
Recruiter self-takeover, denial of assigning another recruiter, Coordinator reads
and write denial. This database check is not a normal Recruiter browser session.

Live staging exposed that `has_permission(other_user, ...)` intentionally rejects
other-user probes. Assignee eligibility now uses a private security-definer
helper with the existing permission policy, recruiter identity and ban checks;
actor authorization still uses the caller-bound function. Independent follow-up
review and the final Node/browser/SQL checks include this correction.

Smoke used an existing synthetic candidate and requirement only. The synthetic
case is closed, preserving handover and performer history. No emails, invitations,
CV intake or external assessment scheduling occurred. The synthetic requirement is also confirmed Closed in the UI; cleanup evidence
is retained privately.

Fresh production backup completed (108 table-data objects / 7,644 rows), with
isolated COPY-payload restore/count verification. Full public-schema-plus-data
restore was not verified because the scratch environment lacks managed-service
dependencies. Private receipts and screenshots are retained outside Git. This is
not a claim of a full disaster-recovery restore rehearsal.

## Production release and live smoke — 2026-11-12

- Exact approved commit `c89a0c2c6fdb1767b4b10f7c9eab2b08e170739a` is deployed.
  GitHub Production deployment `7728166005` reports success; the primary domain
  serves the new Recruitment workspace. Migration 2026111201 is recorded on
  production `btbqdviuqcpauojmorvx`; candidate/case counts were unchanged by it.
- Normal signed-in Recruiter and Coordinator sessions verified company/ship
  grouping, requirement-scoped navigation, row takeover, independent task
  ownership, contact completion, interview due-date saving and reload.
- Required contact details correctly blocked progression until the synthetic
  fixture was completed. No real candidate was changed.
- Contact/confirmation credits record the selected recruiter as performer and
  the signed-in operator as recorder. KPI shows activity credit independently
  from current row ownership. Assignment, task state and credits survived reload.
- Coordinator sees task details and KPI but no assignment, takeover or stage
  mutation controls. A separate authenticated database check, rolled back in
  full, verified Recruiter self-takeover, denial of assigning another recruiter,
  Coordinator read/write boundaries and unchanged performer credits after
  handover. This is not a normal browser session for that second Recruiter.
- The production Candidates directory uses aligned shared columns; Coordinator
  has no Add/Edit/Attach controls. Production Master browser checks were not
  repeated; normal staging Master checks and database authorization tests cover
  those paths.
- The existing labelled synthetic case and requirement `2026-Nov-003` are both
  Closed, with history and credits retained. Final UI readback confirmed the
  requirement closure. No new candidate, case or PDF was created. No emails,
  invitations, assessment scheduling, model calls or intake activation occurred.

Private deployment, role-check, cleanup receipts and production screenshots are
retained under `.local/recruitment-release-20261112/` in the NjordHR workspace.
Runtime source was unchanged during smoke. Frontend rollback target is
`1a8f6caf24143f3ba84dddcf7fccb660e305c45c`; rollback preserves additive task/history
data and the database requirement-progress protection. No Needle, Function,
subscription, region or hosting change was made.

## UI walkthrough corrections — deployed and verified

- Consistent filter label spacing and control heights, including Needs attention.
  Attention help states its existing unassigned-row/overdue-task meaning.
- Search placeholder shortened to “Name or reference…”. Work wording remains
  unchanged; the alternative labels were discussed but not selected.
- “Joining preparation” becomes “Pre-joining” in Recruitment and Candidates.
  Old saved stage-filter URLs retain their results. Stored case statuses are unchanged.
- Task progress is a separate line for each task, with text and decorative icons:
  green for completed, amber for scheduled/in-progress, grey for not started or
  waived, red for failed/no-show/declined outcomes. No inferred completion from
  broad stages; a linked application is explicitly shown as Completed.
- Verification: 15 adjacent Node tests, six synthetic browser checks (including
  saved stage URLs, reload and distinct task outcomes), lint and production build
  pass. Desktop/mobile screenshots were inspected. Independent review found no
  material issues. Existing build warnings concern bundle size and browser data.

After exact approval, `b3d49c0ddb368d76ec0c9bf8b9d9085ad33256b1` was promoted to
main/Vercel. Primary Production deployment `7730925049` completed successfully.
The primary domain serves the approved changes. Normal Recruiter and Coordinator
sessions verified the new labels, aligned desktop controls, individual task lines,
and read-only Coordinator controls. Search plus Needs attention returned the
expected synthetic row and persisted after reload. The old Joining preparation
URL selects Pre-joining and retains its result. No production records were changed;
negative outcome styling was verified with synthetic local browser fixtures.
The temporary Chrome verification tab was closed, preserving the user's tab.
Private visual proof: `.local/recruitment-release-20261112/production-ui-b3d49c0.png`.

This frontend-only follow-up has no migration, Function, Needle, hosting,
subscription or intake change. Rollback frontend is `c89a0c2`.
