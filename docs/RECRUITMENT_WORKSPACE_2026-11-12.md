# Recruitment workspace and activity attribution

## Scope

Implementation of the 2026-11-12 owner-approved discussion. Production release is
not included in the implementation approval. Current production remains the
Candidates release; migration 2026111201 must precede frontend promotion.

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

Migration 2026111201 is applied only to staging `dwslhetniuzpyuspuomy`.
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

Production release remains pending exact approval for this committed candidate
and Holmes migration 2026111201, followed by frontend promotion and live synthetic
smoke. Frontend rollback preserves additive task/history data; the requirement
progress guard remains a database protection. No Needle, Function, subscription,
region, hosting or intake activation change is part of this release.
