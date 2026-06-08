# Recruiter Workspace Redesign Spec

## Goal

Redesign the recruiter-side product into a clearer operating model:

`Dashboard | Workspace | KPI | Expiry | Calendar | Search | Settings`

Remove `Prospects` as a standalone top-level page. Prospect/candidate creation and management moves into `Workspace`.

The new model should feel closer to the existing Excel workflow: spreadsheet-style row entry, table management, simple filters, recruiter action attribution, and KPI-ready activity logging.

## 1. Global Navigation

### Final Main Navigation

Order must be:

1. Dashboard
2. Workspace
3. KPI
4. Expiry
5. Calendar
6. Search
7. Settings

### Changes

- Remove top-level `Prospects`.
- Replace it with `KPI`.
- Prospect/candidate functionality moves inside `Workspace`.

### Acceptance Criteria

- Main recruiter nav displays exactly: `Dashboard | Workspace | KPI | Expiry | Calendar | Search | Settings`.
- `Prospects` no longer appears as a primary nav item.
- Existing prospect routes may remain for compatibility, but UI entry should shift to Workspace.

## 2. Dashboard

### Purpose

Dashboard should be a simple executive snapshot, not another workspace.

It answers:

> What is happening across recruitment right now?

### Remove

- Dashboard subtabs:
  - Operations
  - Prospects
  - Requirements
  - Funnel
  - KPI
  - Reports
- Queue Focus card
- Reference Search card
- Pipeline Shortcuts
- Prospect enrollment button
- Heavy workspace/action cards

### Keep / Add

Dashboard should contain:

1. Header
   - Title
   - Short summary text

2. KPI Snapshot
   - Compact top-level metrics
   - Should preview key KPI values, not replace the full KPI page

3. Needs Attention
   - Optional but recommended
   - Examples:
     - pending application completions
     - overdue follow-ups
     - expiring documents
     - open requirements delayed

4. Upcoming Schedule
   - Keep this section
   - Should link to Calendar

### Acceptance Criteria

- Dashboard has no internal tabs.
- Dashboard does not include Queue Focus or Reference Search.
- Upcoming Schedule remains visible below KPI/attention summary.
- KPI details link to dedicated KPI page where appropriate.

## 3. Workspace

### Purpose

Workspace is where recruiters perform daily work.

Workspace tabs:

`Requirements | Candidates | Candidate Pipeline`

No Workspace KPI tab. No Reports tab. KPI and reports belong in the main KPI page.

### Key Principle

Do **not** implement an ownership model.

Use **action attribution** instead:

> Every completed recruiter action must record which recruiter performed it.

Do not add conceptual owners like:

- Requirement Owner
- Candidate Owner
- Pipeline Action Owner

Instead use labels like:

- `Logged By`
- `Added By`
- `Completed By`
- `Last Action By`
- `Sent By`

Default recruiter attribution to the logged-in recruiter, but allow selecting another recruiter where product permissions allow it.

## 4. Requirements Tab

### Purpose

Replicate the current Excel Requirements sheet inside the app.

Spreadsheet-style design:

- Add row / input row at top
- Requirements table below
- Row-level actions
- Optional notes/remarks per row

### Fields

Fields from the Excel sheet:

- Req ID
- Date Opened
- Date Closed
- Vessel
- Vessel Type
- Rank
- Positions Required
- Candidates Joined
- Open Positions
- Requirement Status
- Days Open
- Days to Close
- Target Days
- On-Time Status
- Recruiter / Logged By
- Remarks / Notes

### Manual Input Fields

Recruiter enters:

- Date Opened
- Vessel
- Vessel Type
- Rank
- Positions Required
- Target Days
- Requirement Status
- Logged By recruiter
- Remarks / Notes

### System-Calculated Fields

System calculates:

- Req ID
- Candidates Joined
- Open Positions
- Days Open
- Days to Close
- On-Time Status

### Filters

Final filter set:

`Open | Active | Closed | Archived | All`

Definitions:

- Open: requirements currently needing candidates, with open positions remaining.
- Active: all non-closed, non-archived requirements.
- Closed: completed requirements.
- Archived: hidden from daily operations but retained.
- All: all non-hard-deleted requirements.

Default filter should be `Open`.

### Row Actions

Each row should support:

- Edit
- Close
- Cancel
- Archive
- Delete, restricted

### Delete vs Archive

Use archive as the normal way to hide rows.

Hard delete should be avoided for real operational records. If supported, restrict it to Master Recruiter or same-day mistaken entries.

### Completion Behavior

When a requirement is completed:

- status becomes `Closed`
- `Date Closed` is filled
- `Open Positions` becomes `0`
- row leaves default `Open` view
- row remains visible under `Closed` and `All`
- row continues feeding KPI/reporting

### DB Notes

Existing DB has `requirements`, `date_closed`, `status`, `created_by_recruiter_id`, `owner_recruiter_id`.

Needed changes likely include:

- Add `archived_at`
- Add `archived_by_recruiter_id`
- Add `archive_reason`
- Consider soft-delete fields:
  - `deleted_at`
  - `deleted_by_recruiter_id`
  - `delete_reason`
- Decide whether existing `owner_recruiter_id` should be retained internally for compatibility but hidden from product language.
- Requirement action attribution should be logged to action log.

## 5. Candidates Tab

### Purpose

Replicate the current Excel Candidates sheet inside the app.

Important change:

> Candidate/prospect creation must not require a requirement.

Recruiters should be able to add candidates at any time. They can attach a requirement later.

### Fields

Fields from the Excel sheet:

- Candidate ID
- Date Contacted
- Recruiter / Added By
- Candidate Name
- Req ID
- Rank
- Vessel Type
- Current Stage
- Date Joined
- Joined?
- Days to Join
- In Active Pipeline?
- Cycle Completed?
- Notes

### Candidate Creation

Candidate can be created without requirement.

Required initial fields should include:

- Candidate Name
- Date Contacted
- Added By recruiter
- Rank
- Vessel Type
- Basic contact info as currently required by the app
- Notes optional

`Req ID` should be optional.

### Requirement Attachment

Candidate can later be attached to a requirement.

That action should create the candidate-requirement pipeline relationship and log:

- candidate
- requirement
- attached by recruiter
- timestamp
- optional note

### Filters

Final filter set:

`Open | Active | Unattached | In Pipeline | Joined | Archived | All`

Definitions:

- Open: candidates who still need action and are not joined/rejected/archived.
- Active: all live candidates, including unattached and pipeline candidates.
- Unattached: candidates not linked to any requirement.
- In Pipeline: candidates linked to a requirement and moving through stages.
- Joined: candidates who completed the cycle successfully.
- Archived: hidden from daily operations but retained.
- All: all non-hard-deleted candidates.

Default filter should be `Open`.

### History

No separate History page.

Candidate history should live in candidate detail/drawer:

- candidate created
- requirement attached
- stage changes
- application link sent
- application completed
- notes
- joined/rejected/archive events

Aggregated history belongs in KPI/report exports.

### DB Notes

Existing `prospects` table has `created_by_recruiter_id`, `archived_at`, `deleted_at`.

Needed changes:

- Add RPC to create candidate/prospect without requirement, such as `create_prospect` or `create_candidate`.
- Existing RPC `create_prospect_with_requirement` is too rigid for the new workflow.
- Existing attach RPC may be reused: `attach_existing_prospect_to_requirement`.
- Ensure candidate creation logs recruiter attribution.
- Ensure candidate can exist without a `prospect_requirements` row.

## 6. Candidate Pipeline Tab

### Purpose

Operational pipeline for candidates already attached to requirements.

Unattached candidates stay in Candidates tab until attached.

### Keep From Current UI

- Left stage rail/filter is useful and should remain.
- Stage jump menu can remain, but all jumps must be logged.

### Core Columns

- Candidate ID
- Candidate Name
- Req ID
- Requirement / Vessel
- Rank
- Vessel Type
- Current Stage
- Previous Stage
- Stage Updated Date
- Last Action By / Completed By
- Application Status
- Next Action
- Notes
- Actions

Use `Last Action By` or `Completed By`, not `Owner`.

### Stage Movement

Every stage change must record:

- candidate
- requirement
- previous stage
- new stage
- completed by recruiter
- completed date
- notes
- timestamp

Default `Completed By` to logged-in recruiter.

### Stage Jump

Stage jumps are allowed, because operations are messy.

But every jump must create a log entry.

### Application Completion Gate

This is critical.

After candidate passes test, recruiter must send application link to candidate.

#### Flow

1. Candidate reaches `Test Passed`.
2. System asks recruiter for confirmation: "Send application link to candidate?"
3. If confirmed:
   - email is sent automatically
   - candidate moves to `Application Pending` or `Application Link Sent`
   - recruiter who confirmed is logged
   - sent timestamp is recorded
4. Candidate fills application through applicant portal.
5. Once submitted:
   - candidate shows `Application Completed`
   - completed timestamp is recorded
   - candidate can progress further in pipeline

### Progression Rule

Candidate cannot move beyond the application gate until application is completed.

Recommended gate:

- After `Test Passed`, block movement to later stages until `Application Status = Completed`.

If recruiter tries to advance before completion, show:

> Candidate application has not been completed yet.

### Application Status Values

Suggested statuses:

- Not Sent
- Link Sent
- Pending
- Completed
- Expired
- Bounced, optional later

### Pipeline Stages

Align with existing stages, but add application gate:

- Added / Contacted
- Under Review / Screened
- Test Scheduled
- Test Passed
- Application Link Sent / Application Pending
- Application Completed
- Interview Scheduled
- Interview Passed
- Offered
- Offer Accepted
- Documents Pending
- Joined / Hired
- Rejected
- Withdrawn

### Recruiter View Application

Once application is completed:

- Candidate row should show `Application Completed`
- Row action should include `View Application`
- Clicking candidate opens detail drawer/page
- Candidate detail should include link/button to view filled application
- Application should be read-only from candidate detail, except existing recruiter review/compliance actions if still required

### DB Notes

Needed changes likely include:

- Link candidate/prospect to submitted application record.
- Store application invite/link sent timestamp.
- Store application completed timestamp/status.
- Store recruiter who sent application link.
- Ensure pipeline transition RPC blocks post-test progression until application completed.
- Existing invite/bounce logic may be reusable, but verify it is tied to this new pipeline trigger.

## 7. KPI Page

### Purpose

Dedicated analytics and reporting page.

KPI answers:

> How are we performing, by requirement, candidate flow, recruiter, and stage?

### App Presentation

Do not show one giant spreadsheet as the main UI.

Use readable sections:

1. Report Header
   - Report date
   - Date range selector
   - Recruiter filter
   - Export button

2. Core KPI Cards
   - Open Requirements
   - Closed Requirements
   - Open Positions
   - Joined vs Required
   - Requirement Closure %
   - Candidates Contacted Today
   - Candidates Joined Today
   - Contact-to-Join Conversion %
   - Active Pipeline
   - Avg Days to Join

3. Recruiter Snapshot
   - Recruiter
   - Contacted Today
   - Joined
   - Conversion %
   - Active Pipeline

4. Pipeline by Stage
   - Stage
   - Count

5. Open Requirement Aging
   - Req ID
   - Vessel
   - Rank
   - Days Open
   - Target Days
   - On-Time / Delayed

6. Reports / Export
   - KPI report
   - Recruiter activity report
   - Requirement aging report
   - CSV/PDF/XLSX as appropriate

### KPI Export

The exported KPI report can and should match the attached Excel-style sheet closely.

The app page can be cleaner; the export should preserve the familiar sheet layout.

### DB Dependency

Accurate KPI requires action attribution.

Current fields like `created_by_recruiter_id`, `assigned_by_recruiter_id`, and `last_transition_by_recruiter_id` are not enough because they only capture current/latest state.

Need either:

- formal `recruiter_action_log` table, recommended
- or strong use of existing audit log if it has consistent structured fields for reporting

Recommended table concept:

`recruiter_action_log`

Fields:

- id
- action_type
- recruiter_id
- prospect_id / candidate_id
- requirement_id
- prospect_requirement_id
- application_id
- from_stage
- to_stage
- completed_at
- note
- metadata jsonb
- created_at

Example action types:

- `requirement_logged`
- `requirement_updated`
- `requirement_closed`
- `requirement_cancelled`
- `requirement_archived`
- `candidate_added`
- `candidate_attached_to_requirement`
- `pipeline_stage_changed`
- `application_link_sent`
- `application_completed`
- `candidate_joined`
- `candidate_rejected`
- `candidate_withdrawn`

## 8. Reports and History

### No Separate Reports Main Page

Reports belong inside KPI.

### Individual History

Individual record history belongs inside:

- Candidate detail drawer/page
- Requirement detail drawer/page

### Aggregated History

Aggregated history belongs in:

- KPI page
- KPI exports
- Recruiter activity reports

## 9. Database / Backend Task List

### Required DB Changes

1. Candidate creation without requirement
   - Add RPC: `create_prospect` or `create_candidate`.
   - Should not require requirement ID.
   - Should create prospect/candidate only.
   - Should log action attribution.

2. Action attribution log
   - Add `recruiter_action_log` table or formalize existing audit table for KPI.
   - Ensure every meaningful recruiter action writes to it.

3. Requirement archive
   - Add:
     - `archived_at`
     - `archived_by_recruiter_id`
     - `archive_reason`
   - Add archive/unarchive RPCs.

4. Requirement soft delete
   - Decide whether needed.
   - If yes, add:
     - `deleted_at`
     - `deleted_by_recruiter_id`
     - `delete_reason`
   - Restrict permissions.

5. Pipeline stages
   - Expand current pipeline status model or add pipeline stage/action table.
   - Current statuses are not enough for test/interview/application gate flow.

6. Application gate
   - Store application link sent state.
   - Store application completed state.
   - Link prospect/candidate to submitted application.
   - Prevent movement past application gate until completed.

7. Application link sending
   - When status becomes `Test Passed`, provide confirmed action to send applicant portal link.
   - Log recruiter attribution.
   - Reuse existing invite/bounce infrastructure if suitable.

8. KPI views/RPCs
   - Create read RPCs/views for:
     - KPI summary
     - recruiter snapshot
     - pipeline by stage
     - open requirement aging
     - export data

### Existing DB Pieces To Reuse

- `requirements`
- `prospects`
- `prospect_requirements`
- `requirement_remarks`
- `prospect_notes`
- existing audit event system
- existing invite/bounce logic if compatible
- existing application review/detail routes

## 10. Frontend Task List

### Navigation

- Update recruiter nav order.
- Remove top-level Prospects.
- Add KPI nav item.

### Dashboard

- Remove subtabs and heavy operational cards.
- Build snapshot layout.
- Keep Upcoming Schedule.

### Workspace Shell

- Create Workspace tabs:
  - Requirements
  - Candidates
  - Candidate Pipeline

### Requirements UI

- Build spreadsheet-style Add Row.
- Build active table.
- Add filters: `Open | Active | Closed | Archived | All`.
- Add row actions: edit, close, cancel, archive, delete if allowed.
- Add notes field.
- Add `Logged By` recruiter selector.

### Candidates UI

- Build spreadsheet-style Add Row.
- Allow candidate without requirement.
- Add optional requirement attach flow.
- Add filters: `Open | Active | Unattached | In Pipeline | Joined | Archived | All`.
- Add notes field.
- Add `Added By` recruiter selector.
- Candidate detail drawer/page with history and application link.

### Candidate Pipeline UI

- Show only requirement-linked candidates.
- Keep left stage rail.
- Add `Last Action By` / `Completed By` column.
- Add `Application Status` column.
- Add stage action modal:
  - new stage
  - completed by
  - date
  - notes
- Add application link confirmation after `Test Passed`.
- Add gate preventing further movement until application completion.
- Add `View Application` action when completed.

### KPI UI

- Build KPI page sections:
  - core cards
  - recruiter snapshot
  - pipeline by stage
  - open requirement aging
  - exports
- KPI export should match attached spreadsheet format.

## 11. Documentation Updates

Update:

- `documentation.md`
- `docs/prd.md`
- `docs/tasks.md`
- `docs/decisions.md`
- `docs/test-plan.md`

Record decisions:

- Prospects removed from main nav.
- Workspace is operational home.
- No ownership model.
- Use action attribution.
- Candidate can be created without requirement.
- Application completion gate after Test Passed.
- KPI export mirrors existing spreadsheet.

## 12. Verification

Before closing implementation:

```bash
npm run lint
npm run build
```

If UI flow changes are implemented:

```bash
npm run test:smoke
```

Add or update tests for:

- candidate creation without requirement
- candidate attach to requirement
- requirement archive/closed filters
- pipeline stage attribution
- test-passed application link send
- blocking progression before application completion
- completed application view from candidate detail
- KPI action attribution counts

## Implementation Priority

Recommended sequence:

1. DB/action attribution design
2. Candidate creation without requirement
3. Requirement archive/filters
4. Workspace tab UI
5. Candidate Pipeline application gate
6. Dashboard simplification
7. KPI page and export
8. Smoke tests and docs

The main thing not to miss: **KPI depends on action attribution**, and **pipeline depends on the application completion gate after Test Passed**.
