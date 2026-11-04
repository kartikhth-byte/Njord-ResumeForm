# Dashboard and KPI review

Date: 2026-11-03 · Status: phase 1 (KPI + Dashboard "My work") built 2026-11-04 on `ui/warm-theme`, not deployed; case-v1-dependent items pending.

## Question

Can a manager see, from Dashboard and KPI:

1. where each recruitment task (requirement) stands,
2. where each recruiter is right now,
3. how each recruiter is performing?

## Verdict

Partly. KPI covers team totals and today's activity. It does not show how close each requirement is to being filled, and per-recruiter performance is all-time only. Dashboard is a thin summary (5 counts, up to 4 attention items, upcoming schedule); managers would use KPI.

## What is shown today

| Question | Shown | Where |
|---|---|---|
| Task status | Open / closed requirements, open positions, joined vs required, closure % | KPI overview, Dashboard |
| | Ageing table: req, vessel, rank, open positions, days open, on-time | KPI overview |
| | Overdue and near-target alerts | KPI "Needs action now", Dashboard (max 2) |
| | Open positions by rank, requirements by age bucket | KPI charts |
| Recruiter now | Active pipeline (candidates added by them), applications handled, contacted today | KPI scorecard |
| Performance | Total touched, joined, conversion % (all-time) | KPI scorecard |
| | Weekly contacted vs joined (team, or one recruiter via the filter) | KPI charts |

## Gaps

### 1. Task status
- **No pipeline depth per requirement.** You see how old a requirement is, not how close it is to filling. Needed: candidates per stage for each open requirement (contacted / screened / shortlisted / interviewed / approved / joined).
- Owner, customer and last activity exist in the data (`buildRequirementTrackerRows`: `recruiterName`, customer, `latestRemark`) but are not shown in the ageing table.

### 2. Recruiter now
- Requirements owned per recruiter, and how many are overdue.
- Stale items per recruiter (no activity > 7 days).
- Upcoming interviews and tests per recruiter.

### 3. Performance
- **No time period.** Scorecard is all-time, so it cannot show this week or month, or a trend.
- Outcome metrics exist only team-wide: requirements closed, on-time closure %, avg days to join.
- **Attribution.** Candidates are credited to `created_by_recruiter_id` (who added them), not to who moved them forward. This rewards data entry over placements.
- Time in stage per recruiter needs a stage-change log. Today only "time sitting in current stage" (team) exists. Recruitment-case v1 (`recruitment_case_events`) provides this.

## What to build (agreed scope)

1. **Requirement progress table** (replaces KPI ageing table). One row per open requirement: req ID, customer, vessel / rank, owner, positions open of required, a compact stage bar (counts per stage), days open vs target, last activity. Sorted by risk (overdue first). Row opens the requirement.
2. **Scorecard upgrade.** Period switch (This week / This month / All time). Columns: open requirements owned, overdue, contacted (period), joined (period), conversion, on-time closure %, avg days to join. Credit by the recruiter who moved the candidate, once case events exist.
3. **Dashboard as "My work".** Recruiter: my requirements (progress rows), my follow-ups (stale > 7 days), my upcoming interviews and tests. Manager (Master Recruiter): the same, team-wide, with a recruiter filter.

## Presentation

- One question per section, in this order: **Needs action** → **Requirements progress** → **Recruiters** → **Trends**. Answers first, charts last.
- Every count is a link to the filtered list behind it.
- Status uses the existing tone tokens (success / warning / danger) with a text label, never colour alone.
- Stage bar: one horizontal bar per requirement, segments in funnel order, counts as labels. No separate funnel chart needed on the overview.
- Period switch and recruiter filter at the top, applied to every section.

## Data notes

- Two pipelines feed KPI: workspace prospects / `prospect_requirements` and form `applications`, merged by stage mapping in `src/utils/kpiTracker.js`. Recruitment-case v1 replaces this with one case per candidate per requirement.
- Numbers were not verified against real volumes: staging holds only synthetic rows.

## Build log

**2026-11-04, phase 1 (`b32efd3`, `ui/warm-theme`, not pushed).** Built without waiting for recruitment-case v1, using only data that exists today:

- KPI "Open requirement ageing" replaced by **Requirements progress**: customer, vessel / rank, owner, filled vs required, candidates by stage, days open vs target, on-time (with "Near target" at >= 80% of target), last activity (warning after 7 days). Sorted overdue, near target, then share of target used.
- Stage bar uses `prospect_requirements` statuses only (Shortlisted, With customer, Accepted, Joined). Interview and test stages are per application, not per requirement, so they wait for case v1.
- Period switch (This week / This month / All time; default This month) drives the scorecard: open and overdue requirements owned (current), contacted, joined, cohort conversion, on-time closure, avg days to join.
- Overview's "Pipeline by stage" panel removed: it duplicated "Funnel by stage" on Charts.
- Tests: `tests/kpiTracker.test.mjs` (12 checks).

**2026-11-04, phase 1 completed.**

- **Dashboard is now "My work"**, built on the same tracker data as KPI. Recruiters and Coordinators see their own: open requirements (progress table), follow-ups (active candidates they added with no activity for over 7 days, longest-waiting first), interviews and tests in the next 14 days (events they scheduled or for applications they handle). The Master Recruiter sees the whole team by default, with a recruiter filter.
- **KPI headline cards follow the period switch:** closed requirements, conversion (cohort), avg days to join, contacted and joined. "Contacted today" stays for the daily 15–25 target. Open requirements, open positions, joined vs required and active pipeline stay current.
- **Every headline count is a link** to the list behind it. Requirements and Candidates now read `status` / `view`, `stage`, `recruiter` and `from` from the URL to preset their filters.
- Shared `RequirementProgressTable` component for KPI and Dashboard. Requirement remarks now feed "last activity" (the KPI page was passing them under the wrong key).
- Tests: `tests/kpiTracker.test.mjs` now 18 checks.
- Not verified against staging data; rendered with synthetic fixtures only.
**After case v1:** per-requirement interview/test stages, credit by the recruiter who moved the candidate, time in stage per recruiter.
