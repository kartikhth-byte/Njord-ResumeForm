# Dashboard and KPI review

Date: 2026-11-03 · Status: recorded, build deferred until recruitment-case v1 (stage history) is live.

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
